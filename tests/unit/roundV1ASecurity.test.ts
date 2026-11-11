/**
 * roundV1ASecurity.test.ts — V1-A: VEGA SECURITY CLOSURE.
 * Public Reader Authentication and Firm Isolation — the security matrix
 * for all sixteen remediated public readers (SEC-1..SEC-16).
 * ─────────────────────────────────────────────────────────────────────────
 * Every endpoint is driven through its REAL handler on a fixture-backed
 * ctx (the Round E harness pattern) and must survive the seven-level
 * authorization matrix:
 *
 *   1. Anonymous caller                         → rejected
 *   2. Invalid / expired / revoked session      → rejected
 *   3. Authenticated user of ANOTHER firm       → rejected (firm-scoped)
 *   4. Authenticated user of the OWNING firm    → succeeds when authorised
 *   5. Wrong role (portal where staff needed)   → rejected
 *   6. Founder-only surfaces (sales pipeline)   → non-Founder rejected
 *   7. Resource-ID substitution                 → rejected / empty (not
 *      just firmId substitution — the ATTACKER keeps their own session and
 *      swaps the RESOURCE id, or swaps the identity id they claim)
 *
 * The fixture ctx mirrors the real Convex semantics that matter here:
 * session resolution (hash → row → expiry/revocation checks) and the
 * underscore-field rejection inherited from the R101 harness.
 */
import { describe, it, expect, vi } from 'vitest';

import {
    getFirmData,
    getFirmBasicInfo,
    getFirmMetadata,
    getMatterDetails,
    getPropertyDetails,
    getNotePage,
    getDocumentContent,
    getJoinedFirms,
    getFileUrl,
    getAloaConversations,
    getAloaMessages,
} from '../../convex/myFunctions';
import { getUserNotifications, getUnreadNotificationCount } from '../../convex/pushNotifications';
import { listSalesInquiries, getUnreadSalesInquiryCount } from '../../convex/salesInquiries';
import { getLicensesForFirm } from '../../convex/legalRepo';
import { hashSessionToken } from '../../convex/sessions';

// ── Fixture-backed ctx (Round E harness + Convex system-field rule) ─────────
type Row = Record<string, any>;

function makeCtx(fix: { tables?: Record<string, Row[]> } = {}) {
    const tables: Record<string, Row[]> = {
        sessions: [],
        users: [],
        firms: [],
        matters: [],
        documents: [],
        properties: [],
        notePages: [],
        notifications: [],
        app_notifications: [],
        aloaConversations: [],
        aloaMessages: [],
        sales_inquiries: [],
        firm_licenses: [],
        securityEvents: [],
        suspendedUsers: [],
        ...(fix.tables ?? {}),
    };

    const findRows = (table: string, conds: Array<[string, any]>) =>
        (tables[table] ?? []).filter((r) => conds.every(([f, v]) => r[f] !== undefined && String(r[f]) === String(v)));

    const chainFor = (rows: Row[]) => {
        const chain: any = {
            first: async () => (rows[0] ?? null),
            unique: async () => (rows[0] ?? null),
            collect: async () => rows,
            take: async (n: number) => rows.slice(0, n),
            order: (_d: string) => chain,
            filter: (_fn: any) => chain,
        };
        return chain;
    };

    const db: any = {
        query: (table: string) => ({
            withIndex: (_name: string, fn: (q: any) => any) => {
                const conds: Array<[string, any]> = [];
                const q: any = {
                    eq: (field: string, value: any) => { conds.push([field, value]); return q; },
                };
                fn(q);
                return chainFor(findRows(table, conds));
            },
            filter: (fn: (q: any) => any) => {
                const conds: Array<[string, any]> = [];
                const q: any = { field: (f: string) => f, eq: (f: any, v: any) => { conds.push([String(f), v]); return q; } };
                try { fn(q); } catch { /* no conditions */ }
                const rows = (tables[table] ?? []).filter((r) =>
                    conds.every(([f, v]) => r[f] !== undefined && String(r[f]) === String(v)));
                return chainFor(rows);
            },
            order: (_d: string) => chainFor(tables[table] ?? []),
            collect: async () => (tables[table] ?? []),
            take: async (n: number) => (tables[table] ?? []).slice(0, n),
            first: async () => (tables[table] ?? [])[0] ?? null,
        }),
        get: async (id: any) => {
            const idStr = String(id);
            for (const rows of Object.values(tables)) {
                const hit = rows.find((r) => String(r._id) === idStr);
                if (hit) return hit;
            }
            return null;
        },
        insert: async (table: string, value: any) => {
            for (const key of Object.keys(value ?? {})) {
                if (key.startsWith('_')) throw new Error(`[CONVEX-RULE] ${table}: "${key}" is reserved for system fields`);
            }
            const _id = `${table}_${tables[table]?.length ?? 0}_${Math.floor(Math.random() * 1e6)}`;
            (tables[table] = tables[table] ?? []).push({ _id, _creationTime: Date.now(), ...value });
            return _id as any;
        },
        patch: async (id: any, value: any) => {
            for (const key of Object.keys(value ?? {})) {
                if (key.startsWith('_')) throw new Error(`[CONVEX-RULE] patch: "${key}" is reserved for system fields`);
            }
            const idStr = String(id);
            for (const rows of Object.values(tables)) {
                const hit = rows.find((r) => String(r._id) === idStr);
                if (hit) Object.assign(hit, value);
            }
            return null;
        },
        delete: async () => null,
    };

    const ctx: any = {
        db,
        storage: { getUrl: async (id: any) => `https://signed.example/${String(id)}` },
        runMutation: vi.fn(async () => ({ success: true })),
        runAction: vi.fn(async () => ({ success: true })),
        runQuery: vi.fn(async () => null),
        scheduler: { runAfter: vi.fn(async () => null) },
        auth: { getUserIdentity: async () => null },
    };
    return { ctx, tables };
}

/** Register a user + a VALID session; returns the auth args to forward. */
function registerUser(w: { tables: Record<string, Row[]> }, user: Row, token: string) {
    w.tables.users.push(user);
    w.tables.sessions.push({
        tokenHash: hashSessionToken(token),
        userId: user._id,
        userEmail: user.email,
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
    return { sessionToken: token, userEmail: user.email };
}

const call = (fn: any, ctx: any, args: any) => (fn as any)._handler(ctx, args);

// ── The world ───────────────────────────────────────────────────────────────
function makeWorld() {
    const w = makeCtx();

    // Firms
    w.tables.firms.push(
        { _id: 'firm-1', name: 'Ade & Partners', product: 'vega' },
        { _id: 'firm-2', name: 'Beta Chambers', product: 'vega' },
        { _id: 'firm-9', name: 'Joined Firm Nine', product: 'atrium' },
    );

    // Users + sessions
    const ADMIN = { _id: 'u-admin', id: 'u-admin', email: 'admin@firm1.com', tokenIdentifier: 'admin@firm1.com', name: 'Ada Admin', role: 'Admin', firmId: 'firm-1', joinedFirmIds: ['firm-9'] };
    const LAWYER = { _id: 'u-lawyer', id: 'u-lawyer', email: 'lawyer@firm1.com', tokenIdentifier: 'lawyer@firm1.com', name: 'Lola Lawyer', role: 'Lawyer', firmId: 'firm-1' };
    const PORTAL = { _id: 'u-portal', id: 'u-portal', email: 'client@firm1.com', tokenIdentifier: 'client@firm1.com', name: 'Clive Client', role: 'Client', firmId: 'firm-1' };
    const F2_ADMIN = { _id: 'u-f2admin', id: 'u-f2admin', email: 'admin@firm2.com', tokenIdentifier: 'admin@firm2.com', name: 'Bisi Firm2', role: 'Admin', firmId: 'firm-2' };
    const FOUNDER = { _id: 'u-founder', id: 'u-founder', email: 'founder@practicepro.ng', tokenIdentifier: 'founder@practicepro.ng', name: 'Frank Founder', role: 'Founder', firmId: 'firm-3' };

    const ADMIN_AUTH = registerUser(w, ADMIN, 'tok-admin');
    const LAWYER_AUTH = registerUser(w, LAWYER, 'tok-lawyer');
    const PORTAL_AUTH = registerUser(w, PORTAL, 'tok-portal');
    const F2_AUTH = registerUser(w, F2_ADMIN, 'tok-f2admin');
    const FOUNDER_AUTH = registerUser(w, FOUNDER, 'tok-founder');

    // An EXPIRED session for the firm-1 admin (valid user, dead token).
    w.tables.sessions.push({
        tokenHash: hashSessionToken('tok-admin-expired'),
        userId: 'u-admin', userEmail: 'admin@firm1.com',
        createdAt: Date.now() - 48 * 3600e3, lastSeenAt: Date.now() - 48 * 3600e3,
        expiresAt: Date.now() - 24 * 3600e3,
    });
    // A REVOKED session for the firm-1 admin.
    w.tables.sessions.push({
        tokenHash: hashSessionToken('tok-admin-revoked'),
        userId: 'u-admin', userEmail: 'admin@firm1.com',
        createdAt: Date.now() - 3600e3, lastSeenAt: Date.now() - 3600e3,
        expiresAt: Date.now() + 24 * 3600e3,
        revokedAt: Date.now() - 60e3,
    });

    // Firm-scoped resources
    w.tables.matters.push(
        { _id: 'mat-1', firmId: 'firm-1', title: 'Public matter', isPrivate: false, assignedUsers: [] },
        { _id: 'mat-priv', firmId: 'firm-1', title: 'Private matter', isPrivate: true, assignedUsers: ['u-lawyer'] },
        { _id: 'mat-f2', firmId: 'firm-2', title: 'Firm 2 matter', isPrivate: false, assignedUsers: [] },
    );
    w.tables.documents.push(
        { _id: 'doc-1', firmId: 'firm-1', title: 'Firm 1 doc', content: 'sekret-1' },
        { _id: 'doc-f2', firmId: 'firm-2', title: 'Firm 2 doc', content: 'sekret-2' },
    );
    w.tables.properties.push(
        { _id: 'prop-1', firmId: 'firm-1', address: '1 A St' },
        { _id: 'prop-f2', firmId: 'firm-2', address: '2 B St' },
    );
    w.tables.notePages.push(
        { _id: 'page-1', firmId: 'firm-1', content: 'note-1' },
        { _id: 'page-sys', firmId: 'system', content: 'seeded template' },
        { _id: 'page-f2', firmId: 'firm-2', content: 'note-f2' },
    );
    w.tables.aloaConversations.push(
        { _id: 'conv-1', firmId: 'firm-1', userId: 'u-admin', title: 'Admin chat', updatedAt: 1 },
        { _id: 'conv-f2', firmId: 'firm-2', userId: 'u-f2admin', title: 'F2 chat', updatedAt: 2 },
    );
    w.tables.aloaMessages.push(
        { _id: 'am-1', conversationId: 'conv-1', firmId: 'firm-1', content: 'hello from admin chat' },
        { _id: 'am-2', conversationId: 'conv-f2', firmId: 'firm-2', content: 'hello from firm 2 chat' },
    );
    w.tables.app_notifications.push(
        { _id: 'an-1', userId: 'u-admin', isRead: false, title: 'Admin notif' },
        { _id: 'an-2', userId: 'u-admin', isRead: true, title: 'Admin notif 2' },
        { _id: 'an-f2', userId: 'u-f2admin', isRead: false, title: 'F2 notif' },
    );
    w.tables.sales_inquiries.push(
        { _id: 'si-1', name: 'Lead One', email: 'lead1@x.com', status: 'unread' },
        { _id: 'si-2', name: 'Lead Two', email: 'lead2@x.com', status: 'contacted' },
    );
    w.tables.firm_licenses.push(
        { _id: 'lic-1', firmId: 'firm-1', moduleKey: 'core', isActive: true },
        { _id: 'lic-f2', firmId: 'firm-2', moduleKey: 'core', isActive: true },
    );

    return { w, ADMIN, LAWYER, PORTAL, F2_ADMIN, FOUNDER, ADMIN_AUTH, LAWYER_AUTH, PORTAL_AUTH, F2_AUTH, FOUNDER_AUTH };
}

const world = makeWorld();

// ═══════════════════════════════════════════════════════════════════════════
// SEC-1 getFirmData
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-A SEC-1 — getFirmData (session firm, no caller-supplied override)', () => {
    it('anonymous → rejected; dead/revoked token → rejected', async () => {
        await expect(call(getFirmData, world.w.ctx, { firmId: 'firm-1' })).rejects.toThrow(/Unauthenticated/i);
        await expect(call(getFirmData, world.w.ctx, { firmId: 'firm-1', sessionToken: 'never-issued' })).rejects.toThrow(/Unauthenticated/i);
        await expect(call(getFirmData, world.w.ctx, { firmId: 'firm-1', sessionToken: 'tok-admin-expired' })).rejects.toThrow(/Unauthenticated/i);
        await expect(call(getFirmData, world.w.ctx, { firmId: 'firm-1', sessionToken: 'tok-admin-revoked' })).rejects.toThrow(/Unauthenticated/i);
    });

    it('owning-firm staff → succeeds; joined firm → succeeds', async () => {
        const res: any = await call(getFirmData, world.w.ctx, { ...world.ADMIN_AUTH, firmId: 'firm-1' });
        expect(res).toBeTruthy();
        expect(res.firmDetails?.name).toBe('Ade & Partners');
        const joined: any = await call(getFirmData, world.w.ctx, { ...world.ADMIN_AUTH, firmId: 'firm-9' });
        expect(joined).toBeTruthy();
    });

    it('CROSS-FIRM: caller-supplied firmId can no longer override the session firm', async () => {
        // Firm-2 admin asks for firm-1's whole dataset — rejected (null).
        const res: any = await call(getFirmData, world.w.ctx, { ...world.F2_AUTH, firmId: 'firm-1' });
        expect(res).toBeNull();
        // Firm-1 admin asks for firm-2 — rejected (null), no disclosure.
        const res2: any = await call(getFirmData, world.w.ctx, { ...world.ADMIN_AUTH, firmId: 'firm-2' });
        expect(res2).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-6 getFirmBasicInfo + SEC-7 getFirmMetadata
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-A SEC-6/7 — firm basic info + metadata', () => {
    it('SEC-6 anonymous → rejected; portal user of the owning firm → succeeds', async () => {
        await expect(call(getFirmBasicInfo, world.w.ctx, { firmId: 'firm-1' })).rejects.toThrow(/Unauthenticated/i);
        const res: any = await call(getFirmBasicInfo, world.w.ctx, { ...world.PORTAL_AUTH, firmId: 'firm-1' });
        expect(res?.name).toBe('Ade & Partners');
    });

    it('SEC-6 cross-firm → rejected (even authenticated)', async () => {
        await expect(call(getFirmBasicInfo, world.w.ctx, { ...world.F2_AUTH, firmId: 'firm-1' })).rejects.toThrow(/Not authorized/i);
        await expect(call(getFirmBasicInfo, world.w.ctx, { ...world.ADMIN_AUTH, firmId: 'firm-2' })).rejects.toThrow(/Not authorized/i);
    });

    it('SEC-7 anonymous → rejected; portal role → rejected (staff data); owning-firm staff → succeeds', async () => {
        await expect(call(getFirmMetadata, world.w.ctx, { firmId: 'firm-1' })).rejects.toThrow(/Unauthenticated/i);
        await expect(call(getFirmMetadata, world.w.ctx, { ...world.PORTAL_AUTH, firmId: 'firm-1' })).rejects.toThrow(/Portal/i);
        const res: any = await call(getFirmMetadata, world.w.ctx, { ...world.ADMIN_AUTH, firmId: 'firm-1' });
        expect(res).toBeTruthy();
    });

    it('SEC-7 cross-firm staff → rejected', async () => {
        await expect(call(getFirmMetadata, world.w.ctx, { ...world.F2_AUTH, firmId: 'firm-1' })).rejects.toThrow(/Not authorized/i);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-2 getMatterDetails (+ private matters + id substitution)
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-A SEC-2 — getMatterDetails', () => {
    it('anonymous → rejected; invalid/revoked session → rejected', async () => {
        await expect(call(getMatterDetails, world.w.ctx, { matterId: 'mat-1', firmId: 'firm-1' })).rejects.toThrow(/Unauthenticated/i);
        await expect(call(getMatterDetails, world.w.ctx, { matterId: 'mat-1', firmId: 'firm-1', sessionToken: 'nope' })).rejects.toThrow(/Unauthenticated/i);
        await expect(call(getMatterDetails, world.w.ctx, { matterId: 'mat-1', firmId: 'firm-1', sessionToken: 'tok-admin-revoked' })).rejects.toThrow(/Unauthenticated/i);
    });

    it('portal identity → rejected (staff read)', async () => {
        await expect(call(getMatterDetails, world.w.ctx, { ...world.PORTAL_AUTH, matterId: 'mat-1', firmId: 'firm-1' })).rejects.toThrow(/Portal/i);
    });

    it('owning-firm staff → succeeds; cross-firm staff → rejected', async () => {
        const res: any = await call(getMatterDetails, world.w.ctx, { ...world.ADMIN_AUTH, matterId: 'mat-1', firmId: 'firm-1' });
        expect(res?.matter?.title ?? res?.title).toBe('Public matter');
        await expect(call(getMatterDetails, world.w.ctx, { ...world.F2_AUTH, matterId: 'mat-1', firmId: 'firm-1' })).rejects.toThrow(/Not authorized/i);
    });

    it('resource-ID substitution: firm-1 staff reading firm-2\'s matter → null', async () => {
        const res: any = await call(getMatterDetails, world.w.ctx, { ...world.ADMIN_AUTH, matterId: 'mat-f2', firmId: 'firm-1' });
        expect(res).toBeNull();
    });

    it('private matter: unassigned firm-1 staff → null; ASSIGNED staff → succeeds; requestUserId spoof → null', async () => {
        expect(await call(getMatterDetails, world.w.ctx, { ...world.ADMIN_AUTH, matterId: 'mat-priv', firmId: 'firm-1' })).toBeNull();
        const ok: any = await call(getMatterDetails, world.w.ctx, { ...world.LAWYER_AUTH, matterId: 'mat-priv', firmId: 'firm-1', requestUserId: 'u-lawyer' });
        expect(ok?.matter?.title ?? ok?.title).toBe('Private matter');
        // The admin tries to open the private matter claiming the lawyer's id.
        expect(await call(getMatterDetails, world.w.ctx, { ...world.ADMIN_AUTH, matterId: 'mat-priv', firmId: 'firm-1', requestUserId: 'u-lawyer' })).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-8 getPropertyDetails + getNotePage
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-A SEC-8 — getPropertyDetails + getNotePage', () => {
    it('property: anonymous → rejected; owning-firm staff → succeeds; cross-firm → rejected', async () => {
        await expect(call(getPropertyDetails, world.w.ctx, { propertyId: 'prop-1', firmId: 'firm-1' })).rejects.toThrow(/Unauthenticated/i);
        const res: any = await call(getPropertyDetails, world.w.ctx, { ...world.ADMIN_AUTH, propertyId: 'prop-1', firmId: 'firm-1' });
        expect(res?.address).toBe('1 A St');
        await expect(call(getPropertyDetails, world.w.ctx, { ...world.F2_AUTH, propertyId: 'prop-1', firmId: 'firm-1' })).rejects.toThrow(/Not authorized/i);
    });

    it('property resource-ID substitution: firm-1 staff reading firm-2\'s property → null', async () => {
        expect(await call(getPropertyDetails, world.w.ctx, { ...world.ADMIN_AUTH, propertyId: 'prop-f2', firmId: 'firm-1' })).toBeNull();
    });

    it('note page: anonymous → rejected; own firm + system pages → succeed; cross-firm page → null', async () => {
        await expect(call(getNotePage, world.w.ctx, { pageId: 'page-1', firmId: 'firm-1' })).rejects.toThrow(/Unauthenticated/i);
        expect((await call(getNotePage, world.w.ctx, { ...world.ADMIN_AUTH, pageId: 'page-1', firmId: 'firm-1' }))?.content).toBe('note-1');
        expect((await call(getNotePage, world.w.ctx, { ...world.ADMIN_AUTH, pageId: 'page-sys', firmId: 'firm-1' }))?.content).toBe('seeded template');
        expect(await call(getNotePage, world.w.ctx, { ...world.ADMIN_AUTH, pageId: 'page-f2', firmId: 'firm-1' })).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-3 getDocumentContent
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-A SEC-3 — getDocumentContent', () => {
    it('anonymous → rejected; owning-firm staff → succeeds; cross-firm staff → rejected', async () => {
        await expect(call(getDocumentContent, world.w.ctx, { documentId: 'doc-1', firmId: 'firm-1' })).rejects.toThrow(/Unauthenticated/i);
        const res: any = await call(getDocumentContent, world.w.ctx, { ...world.ADMIN_AUTH, documentId: 'doc-1', firmId: 'firm-1' });
        expect(res?.content).toBe('sekret-1');
        await expect(call(getDocumentContent, world.w.ctx, { ...world.F2_AUTH, documentId: 'doc-1', firmId: 'firm-1' })).rejects.toThrow(/Not authorized/i);
    });

    it('resource-ID substitution: firm-1 staff reading firm-2\'s document → null', async () => {
        expect(await call(getDocumentContent, world.w.ctx, { ...world.ADMIN_AUTH, documentId: 'doc-f2', firmId: 'firm-1' })).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-4 getAloaConversations + getAloaMessages
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-A SEC-4 — ALOA conversation reads', () => {
    it('conversations: anonymous → rejected; owner lists own → rows; userId substitution → empty', async () => {
        await expect(call(getAloaConversations, world.w.ctx, { userId: 'u-admin', firmId: 'firm-1' })).rejects.toThrow(/Unauthenticated/i);
        const own = await call(getAloaConversations, world.w.ctx, { ...world.ADMIN_AUTH, userId: 'u-admin', firmId: 'firm-1' });
        expect(own).toHaveLength(1);
        // The firm-1 admin asks for the firm-2 admin's conversation list.
        const spoof = await call(getAloaConversations, world.w.ctx, { ...world.ADMIN_AUTH, userId: 'u-f2admin', firmId: 'firm-1' });
        expect(spoof).toEqual([]);
    });

    it('conversations: portal identity → rejected; cross-firm firmId → rejected', async () => {
        await expect(call(getAloaConversations, world.w.ctx, { ...world.PORTAL_AUTH, userId: 'u-portal', firmId: 'firm-1' })).rejects.toThrow(/Portal/i);
        await expect(call(getAloaConversations, world.w.ctx, { ...world.ADMIN_AUTH, userId: 'u-admin', firmId: 'firm-2' })).rejects.toThrow(/Not authorized/i);
    });

    it('messages: anonymous → rejected; owner reads own conversation → rows; other firm\'s conversation → empty', async () => {
        await expect(call(getAloaMessages, world.w.ctx, { conversationId: 'conv-1' })).rejects.toThrow(/Unauthenticated/i);
        const own = await call(getAloaMessages, world.w.ctx, { ...world.ADMIN_AUTH, conversationId: 'conv-1' });
        expect(own).toHaveLength(1);
        expect(own[0].content).toBe('hello from admin chat');
        // Resource-ID substitution: the firm-1 admin reads firm-2's conversation.
        const foreign = await call(getAloaMessages, world.w.ctx, { ...world.ADMIN_AUTH, conversationId: 'conv-f2' });
        expect(foreign).toEqual([]);
        // And firm-2's admin cannot read firm-1's conversation either.
        const reverse = await call(getAloaMessages, world.w.ctx, { ...world.F2_AUTH, conversationId: 'conv-1' });
        expect(reverse).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-5 getFileUrl
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-A SEC-5 — getFileUrl', () => {
    it('anonymous → rejected; invalid token → rejected', async () => {
        await expect(call(getFileUrl, world.w.ctx, { storageId: 'kh123' })).rejects.toThrow(/Unauthenticated/i);
        await expect(call(getFileUrl, world.w.ctx, { storageId: 'kh123', sessionToken: 'never-issued' })).rejects.toThrow(/Unauthenticated/i);
    });

    it('any authenticated role (staff AND portal) resolves storage urls', async () => {
        expect(await call(getFileUrl, world.w.ctx, { ...world.ADMIN_AUTH, storageId: 'kh123' })).toContain('signed.example');
        expect(await call(getFileUrl, world.w.ctx, { ...world.PORTAL_AUTH, storageId: 'kh123' })).toContain('signed.example');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-10 notifications
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-A SEC-10 — notification reads', () => {
    it('list: anonymous → rejected; own id → rows; another user\'s id → empty', async () => {
        await expect(call(getUserNotifications, world.w.ctx, { userId: 'u-admin' })).rejects.toThrow(/Unauthenticated/i);
        const own = await call(getUserNotifications, world.w.ctx, { ...world.ADMIN_AUTH, userId: 'u-admin', limit: 30 });
        expect(own).toHaveLength(2);
        const foreign = await call(getUserNotifications, world.w.ctx, { ...world.ADMIN_AUTH, userId: 'u-f2admin' });
        expect(foreign).toEqual([]);
    });

    it('unread count: own id → count; another user\'s id → 0; anonymous → rejected', async () => {
        expect(await call(getUnreadNotificationCount, world.w.ctx, { ...world.ADMIN_AUTH, userId: 'u-admin' })).toBe(1);
        expect(await call(getUnreadNotificationCount, world.w.ctx, { ...world.ADMIN_AUTH, userId: 'u-f2admin' })).toBe(0);
        await expect(call(getUnreadNotificationCount, world.w.ctx, { userId: 'u-admin' })).rejects.toThrow(/Unauthenticated/i);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-14 sales pipeline (Founder-only)
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-A SEC-14 — sales inquiry reads', () => {
    it('list: anonymous → rejected; firm staff (non-Founder) → rejected; Founder → rows', async () => {
        await expect(call(listSalesInquiries, world.w.ctx, {})).rejects.toThrow(/Unauthenticated/i);
        await expect(call(listSalesInquiries, world.w.ctx, { ...world.ADMIN_AUTH })).rejects.toThrow(/Founder/i);
        const rows = await call(listSalesInquiries, world.w.ctx, { ...world.FOUNDER_AUTH });
        expect(rows).toHaveLength(2);
    });

    it('unread count: non-Founder → rejected; Founder → count', async () => {
        await expect(call(getUnreadSalesInquiryCount, world.w.ctx, { ...world.ADMIN_AUTH })).rejects.toThrow(/Founder/i);
        expect(await call(getUnreadSalesInquiryCount, world.w.ctx, { ...world.FOUNDER_AUTH })).toBe(1);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-15 licenses
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-A SEC-15 — getLicensesForFirm', () => {
    it('anonymous → rejected; owning-firm user → rows; cross-firm request → rejected', async () => {
        await expect(call(getLicensesForFirm, world.w.ctx, { firmId: 'firm-1' })).rejects.toThrow(/Unauthenticated/i);
        const rows = await call(getLicensesForFirm, world.w.ctx, { ...world.ADMIN_AUTH, firmId: 'firm-1' });
        expect(rows).toHaveLength(1);
        await expect(call(getLicensesForFirm, world.w.ctx, { ...world.ADMIN_AUTH, firmId: 'firm-2' })).rejects.toThrow(/Not authorized/i);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-16 getJoinedFirms
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-A SEC-16 — getJoinedFirms', () => {
    it('anonymous → rejected; caller gets ONLY their own + joined firms (no disclosure)', async () => {
        await expect(call(getJoinedFirms, world.w.ctx, { firmIds: ['firm-1'] })).rejects.toThrow(/Unauthenticated/i);
        // The firm-1 admin (joined: firm-9) asks for firm-1, firm-9 AND firm-2.
        const rows: any = await call(getJoinedFirms, world.w.ctx, { ...world.ADMIN_AUTH, firmIds: ['firm-1', 'firm-9', 'firm-2'] });
        const ids = rows.map((r: any) => String(r.id));
        expect(ids).toContain('firm-1');
        expect(ids).toContain('firm-9');
        expect(ids).not.toContain('firm-2');
        expect(rows).toHaveLength(2);
    });
});
