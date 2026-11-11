/**
 * roundV1DFinalVerification.test.ts — V1-D: FINAL V1 SECURITY VERIFICATION.
 * Real-handler tests for the two findings the independent rescan surfaced
 * (the rescan itself is scripts/v1d_rescan.py; the identity audit ran too,
 * but was NOT treated as sufficient proof — these endpoints were classified
 * GATED only after this manual review + these gates).
 * ─────────────────────────────────────────────────────────────────────────
 * Rescan findings under test (both were UNGATED before this round):
 *   1. myFunctions.getChatMessages — any caller could read ANY firm's team
 *      chat by conversationId, or any firm's whole chat history by firmId.
 *   2. myFunctions.createFirm — ungated firm creation, and the post-create
 *      linkage patched the user row found by CALLER-SUPPLIED email (an
 *      attacker could rebind a victim's firmId, role and joinedFirmIds by
 *      passing the victim's email as user_email).
 */
import { describe, it, expect, vi } from 'vitest';

import { getChatMessages, createFirm } from '../../convex/myFunctions';
import { hashSessionToken } from '../../convex/sessions';

// ── Fixture-backed ctx (the V1-B harness: sessions + honest Convex rules) ──
type Row = Record<string, any>;

function makeCtx(fix: { tables?: Record<string, Row[]> } = {}) {
    const tables: Record<string, Row[]> = {
        sessions: [],
        users: [],
        firms: [],
        chatMessages: [],
        chatConversations: [],
        documentCategories: [],
        securityEvents: [],
        rateLimits: [],
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
        delete: async (id: any) => {
            const idStr = String(id);
            for (const rows of Object.values(tables)) {
                const idx = rows.findIndex((r) => String(r._id) === idStr);
                if (idx >= 0) rows.splice(idx, 1);
            }
            return null;
        },
    };

    const ctx: any = {
        db,
        runMutation: vi.fn(async (_ref: any, args: any) => {
            // minimal internal-mutation shim: record insert
            if (String(_ref).includes('insert')) tables.__shim = args;
            return { success: true };
        }),
        runAction: vi.fn(async () => ({ success: true })),
        runQuery: vi.fn(async () => null),
        scheduler: { runAfter: vi.fn(async () => null) },
        auth: { getUserIdentity: async () => null },
    };
    return { ctx, tables };
}

function sessionRow(token: string, userId: string, opts: { expiresAt?: number; revokedAt?: number } = {}) {
    return {
        tokenHash: hashSessionToken(token),
        userId,
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        expiresAt: opts.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000,
        ...(opts.revokedAt != null ? { revokedAt: opts.revokedAt } : {}),
    };
}

// ── World ───────────────────────────────────────────────────────────────────
const STAFF_A: Row = { _id: 'u-staff-a', email: 'a@firm.example', tokenIdentifier: 'a@firm.example', name: 'Staff A', role: 'Admin', firmId: 'firm-1' };
const VICTIM: Row = { _id: 'u-victim', email: 'victim@firm.example', tokenIdentifier: 'victim@firm.example', name: 'Victim', role: 'Admin', firmId: 'firm-1', joinedFirmIds: ['firm-1'] };
const PORTAL_USER: Row = { _id: 'u-client', email: 'client@firm.example', tokenIdentifier: 'client@firm.example', name: 'Client', role: 'Client', firmId: 'firm-1' };

function baseWorld(overrides: Record<string, Row[]> = {}) {
    return makeCtx({
        tables: {
            users: [STAFF_A, VICTIM, PORTAL_USER],
            sessions: [sessionRow('tok-a', 'u-staff-a')],
            firms: [{ _id: 'firm-1', name: 'Existing Firm', inviteCode: 'INV-0001' }],
            chatMessages: [
                { _id: 'cm-1', firmId: 'firm-1', conversationId: 'conv-1', authorId: 'u-staff-a', authorName: 'Staff A', content: 'own-firm-message', timestamp: '2026-11-01T10:00:00Z', _creationTime: 1 },
                { _id: 'cm-2', firmId: 'firm-2', conversationId: 'conv-2', authorId: 'u-other', authorName: 'Other', content: 'victim-firm-message', timestamp: '2026-11-01T11:00:00Z', _creationTime: 2 },
            ],
            chatConversations: [
                { _id: 'conv-1', firmId: 'firm-1', title: 'Firm 1 convo' },
                { _id: 'conv-2', firmId: 'firm-2', title: 'Firm 2 convo' },
            ],
            documentCategories: [],
            ...overrides,
        },
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. getChatMessages — the ungated cross-firm chat read, now gated
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-D rescan — getChatMessages', () => {
    it('anonymous callers are rejected', async () => {
        const { ctx } = baseWorld();
        await expect((getChatMessages as any)._handler(ctx, { firmId: 'firm-1' }))
            .rejects.toThrow(/Unauthenticated|verified session/);
    });

    it('a cross-firm firmId read is refused', async () => {
        const { ctx } = baseWorld();
        await expect((getChatMessages as any)._handler(ctx, { firmId: 'firm-2', sessionToken: 'tok-a' }))
            .rejects.toThrow(/different firm/);
    });

    it('a foreign conversationId (another firm’s conversation) is refused', async () => {
        const { ctx } = baseWorld();
        await expect((getChatMessages as any)._handler(ctx, { conversationId: 'conv-2', sessionToken: 'tok-a' }))
            .rejects.toThrow(/belongs to a different firm/);
    });

    it('portal users are refused — this is a staff surface', async () => {
        const { ctx } = baseWorld({
            sessions: [sessionRow('tok-a', 'u-staff-a'), sessionRow('tok-client', 'u-client')],
        });
        await expect((getChatMessages as any)._handler(ctx, { firmId: 'firm-1', sessionToken: 'tok-client' }))
            .rejects.toThrow(/Portal users do not have access/i);
    });

    it('the owning firm’s staff read their chat (legit workflow)', async () => {
        const { ctx } = baseWorld();
        const rows = await (getChatMessages as any)._handler(ctx, { firmId: 'firm-1', sessionToken: 'tok-a' });
        expect(Array.isArray(rows)).toBe(true);
        expect(rows.some((r: any) => r.content === 'own-firm-message')).toBe(true);
        expect(rows.every((r: any) => r.content !== 'victim-firm-message')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. createFirm — ungated firm creation + victim-email linkage, now gated
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-D rescan — createFirm', () => {
    it('anonymous callers cannot create firms', async () => {
        const { ctx, tables } = baseWorld();
        await expect((createFirm as any)._handler(ctx, {
            name: 'Rogue Firm', address: 'x', subscriptionPlan: 'Core',
            user_email: 'anyone@evil.example', user_name: 'Rogue', tokenIdentifier: 'anyone@evil.example',
        })).rejects.toThrow(/Unauthenticated|verified session/);
        expect(tables.firms.filter((f) => f.name === 'Rogue Firm').length).toBe(0);
    });

    it('the linkage patches the CALLER’S OWN row only — a caller-supplied victim email is overridden', async () => {
        const { ctx, tables } = baseWorld();
        const victimBefore = JSON.stringify(tables.users.find((u) => u._id === 'u-victim'));
        const firmId = await (createFirm as any)._handler(ctx, {
            name: 'New Firm', address: 'Lagos', subscriptionPlan: 'Core',
            // The attacker tries to pass the VICTIM's email for the linkage:
            user_email: 'victim@firm.example', user_name: 'Attacker', tokenIdentifier: 'victim@firm.example',
            sessionToken: 'tok-a',
        });
        // The firm was created, attributed to the SESSION caller:
        const firm = tables.firms.find((f) => String(f._id) === String(firmId)) as Row;
        expect(firm).toBeTruthy();
        expect(firm.createdBy).toBe('a@firm.example');            // session-derived, not the victim email
        // The CALLER (staff A) got the new firm linkage:
        const staffA = tables.users.find((u) => u._id === 'u-staff-a') as any;
        expect(String(staffA.firmId)).toBe(String(firmId));
        expect((staffA.joinedFirmIds || []).map(String)).toContain(String(firmId));
        expect(staffA.role).toBe('Admin');
        // The VICTIM row is untouched (the pre-fix behaviour would have
        // rebound the victim's firmId/role/joinedFirmIds):
        expect(JSON.stringify(tables.users.find((u) => u._id === 'u-victim'))).toBe(victimBefore);
    });
});
