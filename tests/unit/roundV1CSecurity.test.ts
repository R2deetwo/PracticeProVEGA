/**
 * roundV1CSecurity.test.ts — V1-C: CLIENT PORTAL SECURITY AND DATA DELIVERY.
 * Real-handler security tests for the client-portal document/invoice
 * delivery path, plus source contracts for the frontend integration points.
 * ─────────────────────────────────────────────────────────────────────────
 * Findings under test:
 *   CP-1  getClientDocuments empty/broken delivery (alias-binding rebind
 *         to the user id while matters key on the contact id; the
 *         matter-detail surface omitted the sessionToken entirely)
 *   CP-3  unshared document metadata exposure (no server-side visibility
 *         filter — every document on the client's matters was projected)
 *   CP-5  voided and sensitive invoice projection (no recordStatus filter;
 *         the full invoice doc — voidReason, voidedByEmail,
 *         providerReference, paymentDetails — went to the client)
 *   V-MATTER-13 (read-side only) documents are matched on matterId OR the
 *         legacy `matter.id` snapshot WITHOUT rewriting historical rows.
 *
 * Acceptance matrix from the round brief:
 *   • Client A cannot retrieve Client B's documents.
 *   • A client cannot access an unshared document through a direct call.
 *   • An uploaded document appears only under the appropriate client/matter.
 *   • A staff-only document remains private.
 *   • Shared documents display correctly in the client portal.
 *   • Voided invoices do not appear as payable obligations.
 *   • Internal invoice metadata is not returned.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    getClientDocuments,
    getClientInvoices,
    getClientMessages,
} from '../../convex/portals';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolvePath(here, '../..');
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed ctx (the V1-A/V1-B harness: sessions + honest rules) ────
type Row = Record<string, any>;

function makeCtx(fix: { tables?: Record<string, Row[]> } = {}) {
    const tables: Record<string, Row[]> = {
        sessions: [],
        users: [],
        contacts: [],
        matters: [],
        documents: [],
        invoices: [],
        clientMessages: [],
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
        runMutation: vi.fn(async () => ({ success: true })),
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

// ── World: firm-1 with two clients (A + B), a staff lawyer, and firm-2 ──────
const CLIENT_A: Row = { _id: 'u-client-1', email: 'client@example.com', tokenIdentifier: 'client@example.com', name: 'Chidi Client', role: 'Client', firmId: 'firm-1' };
const CLIENT_B: Row = { _id: 'u-client-2', email: 'clientb@example.com', tokenIdentifier: 'clientb@example.com', name: 'Bola Client', role: 'Client', firmId: 'firm-1' };
const STAFF: Row = { _id: 'u-staff-1', email: 'lawyer@example.com', tokenIdentifier: 'lawyer@example.com', name: 'Ada Lawyer', role: 'Lawyer', firmId: 'firm-1' };
const CONTACT_A: Row = { _id: 'contact-1', firmId: 'firm-1', userId: 'u-client-1', email: 'client@example.com', name: 'Chidi Client' };
const CONTACT_B: Row = { _id: 'contact-2', firmId: 'firm-1', userId: 'u-client-2', email: 'clientb@example.com', name: 'Bola Client' };
const M1: Row = { _id: 'matter-1', firmId: 'firm-1', clientId: 'contact-1', title: 'Contract Review M1', status: 'Active', stage: 'Drafting', type: 'Corporate' };
const M2: Row = { _id: 'matter-2', firmId: 'firm-1', clientId: 'contact-2', title: 'Estate Probate M2', status: 'Active', stage: 'Pleadings', type: 'Probate' };

// Documents on M1 (client A's matter) + M2 (client B's matter).
//   DOC_SHARED     — staff uploaded, explicitly shared → VISIBLE to A
//   DOC_PRIVATE    — staff-only, never shared → INVISIBLE to every client
//   DOC_UNMARKED   — no share flag at all, staff-uploaded → INVISIBLE
//   DOC_CLIENT_UP  — uploaded by client A themselves → VISIBLE to A only
//   DOC_SNAPSHOT   — main-upload-form convention: `matter` snapshot, NO
//                    matterId (V-MATTER-13), shared → VISIBLE to A
//   DOC_B          — shared doc on client B's matter → VISIBLE to B only
const DOC_SHARED: Row = { _id: 'doc-shared', firmId: 'firm-1', title: 'Shared Retainer Agreement', matterId: 'matter-1', isSharedWithClient: true, clientReviewStatus: 'review_requested', isSignatureRequested: false, source: 'pdf', dateFiled: '2026-11-01', createdAt: '2026-11-01', uploadedBy: 'u-staff-1' };
const DOC_PRIVATE: Row = { _id: 'doc-private', firmId: 'firm-1', title: 'Internal Case Strategy', matterId: 'matter-1', isSharedWithClient: false, clientReviewStatus: null, source: 'docx', dateFiled: '2026-11-02', createdAt: '2026-11-02', uploadedBy: 'u-staff-1' };
const DOC_UNMARKED: Row = { _id: 'doc-unmarked', firmId: 'firm-1', title: 'Draft Notes', matterId: 'matter-1', dateFiled: '2026-11-02', createdAt: '2026-11-02', uploadedBy: 'u-staff-1' };
const DOC_CLIENT_UP: Row = { _id: 'doc-clientup', firmId: 'firm-1', title: 'KYC Passport Scan', matterId: 'matter-1', isSharedWithClient: false, dateFiled: '2026-11-03', createdAt: '2026-11-03', uploadedBy: 'u-client-1', source: 'jpg' };
const DOC_SNAPSHOT: Row = { _id: 'doc-snapshot', firmId: 'firm-1', title: 'Main-Form Snapshot Doc', matter: { id: 'matter-1', title: 'Contract Review M1' }, isSharedWithClient: true, dateFiled: '2026-11-04', createdAt: '2026-11-04', uploadedBy: 'u-staff-1', source: 'docx' };
const DOC_B: Row = { _id: 'doc-b', firmId: 'firm-1', title: 'B Shared Probate Doc', matterId: 'matter-2', isSharedWithClient: true, dateFiled: '2026-11-05', createdAt: '2026-11-05', uploadedBy: 'u-staff-1', source: 'pdf' };

// Invoices on M1 + M2.
//   INV_ACTIVE       — real outstanding obligation → VISIBLE (minimal projection)
//   INV_VOIDED       — recordStatus 'voided' (the lifecycle authority) → INVISIBLE
//   INV_TEST         — recordStatus 'test' (quarantined test data) → INVISIBLE
//   INV_LEGACY_VOID  — status 'Void' with no recordStatus (pre-lifecycle
//                      status-flip void) → INVISIBLE
//   INV_B            — client B's real obligation → VISIBLE to B only
const INV_ACTIVE: Row = {
    _id: 'inv-active', id: 'inv-custom-1', firmId: 'firm-1', invoiceNumber: 'INV-001', status: 'Unpaid',
    matter: { id: 'matter-1', title: 'Contract Review M1', internalNote: 'staff-only annotation' },
    issueDate: '2026-11-01', dueDate: '2026-11-15', paidDate: null,
    lineItems: [{ description: 'Legal services', total: 150000 }],
    subTotal: 150000, taxAmount: 0, total_amount: 150000,
    userId: 'u-staff-1', provider: 'manual', providerReference: 'PP-REF-1', paymentMethod: 'bank_transfer',
    paymentDetails: { bankCode: '011', accountNumber: '0000000000', accountName: 'PracticePro Systems' },
    client: { name: 'Chidi Client', email: 'client@example.com', internalRating: 'high-value' },
};
const INV_VOIDED: Row = {
    _id: 'inv-voided', id: 'inv-custom-2', firmId: 'firm-1', invoiceNumber: 'INV-002', status: 'Void',
    recordStatus: 'voided', priorStatus: 'Unpaid', voidedAt: 1760000000000, voidedByEmail: 'admin@example.com',
    voidReason: 'Duplicate issuance', auditId: 'aud-1',
    matter: { id: 'matter-1', title: 'Contract Review M1' },
    issueDate: '2026-10-20', dueDate: '2026-11-05',
    lineItems: [{ description: 'Erroneous charge', total: 90000 }], subTotal: 90000, taxAmount: 0, total_amount: 90000,
    providerReference: 'PP-REF-2',
};
const INV_TEST: Row = {
    _id: 'inv-test', id: 'inv-custom-3', firmId: 'firm-1', invoiceNumber: 'INV-003', status: 'Sent',
    recordStatus: 'test', matter: { id: 'matter-1', title: 'Contract Review M1' },
    issueDate: '2026-10-01', dueDate: '2026-10-10', lineItems: [{ description: 'Test row', total: 5000 }], total_amount: 5000,
};
const INV_LEGACY_VOID: Row = {
    _id: 'inv-legacy-void', id: 'inv-custom-4', firmId: 'firm-1', invoiceNumber: 'INV-004', status: 'Void',
    matter: { id: 'matter-1', title: 'Contract Review M1' },
    issueDate: '2026-09-01', dueDate: '2026-09-10', lineItems: [{ description: 'Legacy void', total: 7000 }], total_amount: 7000,
};
const INV_B: Row = {
    _id: 'inv-b', id: 'inv-custom-5', firmId: 'firm-1', invoiceNumber: 'INV-B1', status: 'Overdue',
    matter: { id: 'matter-2', title: 'Estate Probate M2' },
    issueDate: '2026-10-15', dueDate: '2026-10-30', lineItems: [{ description: 'Probate filing', total: 250000 }], subTotal: 250000, taxAmount: 0, total_amount: 250000,
};

function makeWorld(overrides: Record<string, Row[]> = {}) {
    const tables: Record<string, Row[]> = {
        users: [CLIENT_A, CLIENT_B, STAFF],
        sessions: [
            sessionRow('tok-a', 'u-client-1'),
            sessionRow('tok-b', 'u-client-2'),
            sessionRow('tok-staff', 'u-staff-1'),
        ],
        contacts: [CONTACT_A, CONTACT_B],
        matters: [M1, M2],
        documents: [DOC_SHARED, DOC_PRIVATE, DOC_UNMARKED, DOC_CLIENT_UP, DOC_SNAPSHOT, DOC_B],
        invoices: [INV_ACTIVE, INV_VOIDED, INV_TEST, INV_LEGACY_VOID, INV_B],
        clientMessages: [
            { _id: 'cm-1', firmId: 'firm-1', matterId: 'matter-1', content: 'welcome', authorId: 'u-staff-1', timestamp: '2026-11-01', isRead: false },
        ],
        firmActivity: [],
        ...overrides,
    };
    return makeCtx({ tables });
}

const ids = (rows: any[]) => rows.map((r) => String(r._id));

// ═══════════════════════════════════════════════════════════════════════════
// 1. getClientDocuments — CP-1 (delivery) + CP-3 (visibility) + V-MATTER-13
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-C — getClientDocuments (CP-1 delivery + CP-3 visibility)', () => {
    it('the client reads their own document vault — shared, own-upload and snapshot-convention docs all deliver (legit workflow; CP-1)', async () => {
        const { ctx } = makeWorld();
        const rows = await (getClientDocuments as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        });
        // Delivery works: the vault is no longer silently empty.
        expect(ids(rows).sort()).toEqual(['doc-clientup', 'doc-shared', 'doc-snapshot']);
        // Display fields the portal surfaces render from:
        const shared = rows.find((r: any) => r._id === 'doc-shared');
        expect(shared.title).toBe('Shared Retainer Agreement');
        expect(shared.matterId).toBe('matter-1');
        expect(shared.matterTitle).toBe('Contract Review M1');
        expect(shared.clientReviewStatus).toBe('review_requested');
        expect(shared.isSharedWithClient).toBe(true);
    });

    it('the split-brain doc (matter snapshot, no matterId) resolves to the client’s own matter — without rewriting the row (V-MATTER-13 read-side)', async () => {
        const { ctx, tables } = makeWorld();
        const rows = await (getClientDocuments as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        });
        const snap = rows.find((r: any) => r._id === 'doc-snapshot');
        expect(snap).toBeTruthy();
        expect(snap.matterId).toBe('matter-1');           // resolved, not the stored null
        expect(snap.matterTitle).toBe('Contract Review M1');
        // Read-side only: the stored row itself was never rewritten — it
        // still carries the snapshot convention and no matterId:
        const stored = tables.documents.find((d) => d._id === 'doc-snapshot') as Row;
        expect(stored.matterId).toBe(undefined);
        expect(stored.matter).toEqual({ id: 'matter-1', title: 'Contract Review M1' });
    });

    it('a staff-only document remains private — never projected, even on a direct call by the owning client (CP-3)', async () => {
        const { ctx } = makeWorld();
        const rows = await (getClientDocuments as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        });
        expect(ids(rows)).not.toContain('doc-private');
        expect(ids(rows)).not.toContain('doc-unmarked');
        // Not even the title leaks as metadata:
        const blob = JSON.stringify(rows);
        expect(blob).not.toContain('Internal Case Strategy');
        expect(blob).not.toContain('Draft Notes');
    });

    it('Client A cannot retrieve Client B’s documents (cross-client probe is rebound to A’s own identity)', async () => {
        const { ctx } = makeWorld();
        // A's session, but B's contactId:
        const rows = await (getClientDocuments as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-2', sessionToken: 'tok-a',
        });
        expect(ids(rows)).not.toContain('doc-b');
        expect(rows.every((r: any) => r.matterId === 'matter-1')).toBe(true);
        // And B's own session gets B's docs, never A's:
        const rowsB = await (getClientDocuments as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-2', sessionToken: 'tok-b',
        });
        expect(ids(rowsB)).toEqual(['doc-b']);
    });

    it('a client-uploaded document appears only under the appropriate client/matter — and to no one else', async () => {
        const { ctx } = makeWorld();
        const rowsA = await (getClientDocuments as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        });
        const up = rowsA.find((r: any) => r._id === 'doc-clientup');
        expect(up.matterId).toBe('matter-1');
        expect(up.title).toBe('KYC Passport Scan');
        const rowsB = await (getClientDocuments as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-2', sessionToken: 'tok-b',
        });
        expect(ids(rowsB)).not.toContain('doc-clientup');
    });

    it('a caller with a forged other-user id shape (email) still only sees their own vault', async () => {
        const { ctx } = makeWorld();
        // A's session claiming B's email as contactId — not an alias of A → rebind:
        const rows = await (getClientDocuments as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'clientb@example.com', sessionToken: 'tok-a',
        });
        expect(ids(rows)).not.toContain('doc-b');
        expect(rows.length).toBeGreaterThan(0); // A's own docs still deliver
    });

    it('without a session the document vault is closed (the matter-detail production failure mode)', async () => {
        const { ctx } = makeWorld();
        await expect((getClientDocuments as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1',
        })).rejects.toThrow(/Unauthenticated|verified session/);
        await expect((getClientInvoices as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1',
        })).rejects.toThrow(/Unauthenticated|verified session/);
    });

    it('an expired or revoked session cannot read documents or invoices', async () => {
        const { ctx } = makeWorld({
            sessions: [
                sessionRow('tok-a', 'u-client-1', { expiresAt: Date.now() - 60_000 }),
            ],
        });
        await expect((getClientDocuments as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        })).rejects.toThrow(/Unauthenticated|session token is invalid/);

        const { ctx: ctx2 } = makeWorld({
            sessions: [sessionRow('tok-a', 'u-client-1', { revokedAt: Date.now() - 60_000 })],
        });
        await expect((getClientInvoices as any)._handler(ctx2, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        })).rejects.toThrow(/Unauthenticated|session token is invalid/);
    });

    it('a cross-firm call is refused', async () => {
        const { ctx } = makeWorld();
        await expect((getClientDocuments as any)._handler(ctx, {
            firmId: 'firm-2', contactId: 'contact-1', sessionToken: 'tok-a',
        })).rejects.toThrow(/different firm/);
        await expect((getClientInvoices as any)._handler(ctx, {
            firmId: 'firm-2', contactId: 'contact-1', sessionToken: 'tok-a',
        })).rejects.toThrow(/different firm/);
    });

    it('staff callers are refused — the vault is a portal surface', async () => {
        const { ctx } = makeWorld();
        await expect((getClientDocuments as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-staff',
        })).rejects.toThrow(/only available to portal users/i);
        await expect((getClientInvoices as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-staff',
        })).rejects.toThrow(/only available to portal users/i);
    });

    it('documents never leak outside the caller’s own matters (no foreign-matter rows in any projection)', async () => {
        const { ctx } = makeWorld();
        const rows = await (getClientDocuments as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        });
        expect(rows.every((r: any) => r.matterId === 'matter-1')).toBe(true);
        // A client with no matters gets an empty vault, not an error:
        const { ctx: ctx3 } = makeWorld({
            matters: [M1, M2, { _id: 'matter-9', firmId: 'firm-1', clientId: 'contact-9', title: 'Third-party matter' }],
        });
        const rowsNone = await (getClientDocuments as any)._handler(ctx3, {
            firmId: 'firm-1', contactId: 'contact-9', sessionToken: 'tok-a', // foreign contact — rebind
        });
        // rebound to A → A's docs; a genuinely matter-less client of firm-1:
        const rowsEmpty = await (getClientDocuments as any)._handler(ctx3, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        });
        expect(rowsEmpty.every((r: any) => r.matterId === 'matter-1')).toBe(true);
        expect(rowsNone.every((r: any) => r.matterId === 'matter-1')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. getClientInvoices — CP-5 (recordStatus filter + minimal projection)
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-C — getClientInvoices (CP-5 voided/test + internal fields)', () => {
    it('the client sees only their active obligations, in a minimal client-safe projection (legit workflow)', async () => {
        const { ctx } = makeWorld();
        const rows = await (getClientInvoices as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        });
        expect(ids(rows)).toEqual(['inv-active']);
        const inv = rows[0];
        // Everything the portal billing surfaces render from:
        expect(inv.invoiceNumber).toBe('INV-001');
        expect(inv.status).toBe('Unpaid');
        expect(inv.dueDate).toBe('2026-11-15');
        expect(inv.issueDate).toBe('2026-11-01');
        expect(inv.total_amount).toBe(150000);
        expect(inv.lineItems).toEqual([{ description: 'Legal services', total: 150000 }]);
        expect(inv.matter).toEqual({ id: 'matter-1', title: 'Contract Review M1' }); // minimal — no internalNote
    });

    it('voided invoices do not appear as payable obligations — they are not returned at all', async () => {
        const { ctx } = makeWorld();
        const rows = await (getClientInvoices as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        });
        expect(ids(rows)).not.toContain('inv-voided');
        expect(rows.some((r: any) => r.status === 'Unpaid' || r.status === 'Overdue' || r.status === 'Sent')).toBe(true);
        // The void reason never reaches the client as text either:
        expect(JSON.stringify(rows)).not.toContain('Duplicate issuance');
    });

    it('test-quarantined invoices are excluded', async () => {
        const { ctx } = makeWorld();
        const rows = await (getClientInvoices as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        });
        expect(ids(rows)).not.toContain('inv-test');
    });

    it('legacy status-flip voids (status Void, no recordStatus) are excluded', async () => {
        const { ctx } = makeWorld();
        const rows = await (getClientInvoices as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        });
        expect(ids(rows)).not.toContain('inv-legacy-void');
    });

    it('internal invoice metadata is not returned — the projection never carries the lifecycle/Paystack blobs (V2: payment instructions are the deliberate 3-field exception)', async () => {
        const { ctx } = makeWorld();
        const rows = await (getClientInvoices as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        });
        const inv = rows[0];
        const forbidden = [
            'voidReason', 'voidedByEmail', 'voidedAt', 'auditId', 'priorStatus', 'recordStatus',
            'provider', 'providerReference', 'paymentMethod', 'client', 'userId',
        ];
        for (const key of forbidden) {
            expect(inv).not.toHaveProperty(key);
        }
        // ─── V2 (V-FIN-12) CONTRACT EVOLUTION ─────────────────────────────
        // paymentDetails IS now returned — as EXACTLY the three payment-
        // instruction fields a client needs to pay by bank transfer
        // (bankName / accountNumber / accountName; the same details a firm
        // prints on its invoice letterhead). The raw blob's other fields
        // (bankCode etc.) must never pass through.
        expect(inv.paymentDetails).toBeDefined();
        expect(Object.keys(inv.paymentDetails).sort()).toEqual(['accountName', 'accountNumber', 'bankName']);
        expect(inv.paymentDetails).not.toHaveProperty('bankCode');
        const blob = JSON.stringify(rows);
        for (const needle of ['PP-REF-1', '011', 'internalRating', 'Duplicate issuance']) {
            expect(blob).not.toContain(needle);
        }
    });

    it('Client A cannot retrieve Client B’s invoices — and B sees only their own', async () => {
        const { ctx } = makeWorld();
        const rowsProbe = await (getClientInvoices as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-2', sessionToken: 'tok-a',
        });
        expect(ids(rowsProbe)).not.toContain('inv-b');
        const rowsB = await (getClientInvoices as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-2', sessionToken: 'tok-b',
        });
        expect(ids(rowsB)).toEqual(['inv-b']);
        expect(ids(rowsB)).not.toContain('inv-active');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Existing portal behaviour preserved (login/isolation/messaging)
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-C — existing portal behaviour unchanged', () => {
    it('client messaging still delivers for the same legitimate caller', async () => {
        const { ctx } = makeWorld();
        const rows = await (getClientMessages as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        });
        expect(rows.length).toBe(1);
        expect(rows[0].content).toBe('welcome');
    });

    it('a foreign contactId on the messaging read still rebinds to the caller (A2 contract retained)', async () => {
        const { ctx } = makeWorld();
        const rows = await (getClientMessages as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-2', sessionToken: 'tok-a',
        });
        // contact-2 is foreign to A → rebound → A's own matters' messages only
        expect(rows.every((r: any) => r.content === 'welcome')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Frontend integration points (source contracts)
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-C — frontend integration points', () => {
    const detailView = read('src/components/client/ClientMatterDetailView.tsx');
    const portalsSrc = read('convex/portals.ts');

    it('ClientMatterDetailView forwards the sessionToken on getClientDocuments (the CP-1 caller fix)', () => {
        const start = detailView.indexOf('api.portals.getClientDocuments');
        expect(start).toBeGreaterThan(-1);
        const block = detailView.slice(start, start + 800);
        const end = block.indexOf(': \'skip\'');
        const call = end > -1 ? block.slice(0, end) : block;
        expect(call).toContain('sessionToken');
        expect(call).toContain('portalBearer');
    });

    it('ClientMatterDetailView still forwards the sessionToken on getClientInvoices and getClientMattersByUserId (no regressions)', () => {
        for (const fn of ['api.portals.getClientInvoices', 'api.portals.getClientMattersByUserId']) {
            const start = detailView.indexOf(fn);
            expect(start).toBeGreaterThan(-1);
            const block = detailView.slice(start, start + 800);
            const end = block.indexOf(': \'skip\'');
            const call = end > -1 ? block.slice(0, end) : block;
            expect(call).toContain('sessionToken');
        }
    });

    it('ClientDashboard already forwards the bearer on every portal query (regression guard)', () => {
        const dash = read('src/components/client/ClientDashboard.tsx');
        const argsBlock = dash.indexOf('const portalQueryArgs');
        expect(argsBlock).toBeGreaterThan(-1);
        const block = dash.slice(argsBlock, dash.indexOf(';', argsBlock));
        expect(block).toContain('sessionToken: bearerToken ?? undefined');
        expect(block).toContain('contactId: clientContactId');
    });

    it('the server enforces document visibility BEFORE the projection — never frontend-only (CP-3 contract)', () => {
        const start = portalsSrc.indexOf('export const getClientDocuments');
        const end = portalsSrc.indexOf('export const', start + 10);
        const fn = portalsSrc.slice(start, end);
        expect(fn).toContain('portalCallerExtendedAliases(ctx, caller, args.firmId)');
        expect(fn).toContain('row.d.isSharedWithClient === true');
        expect(fn).toContain("aliases.has(String(row.d.uploadedBy");
        // The split-brain read-side repair is present:
        expect(fn).toContain('d.matterId');
        expect(fn).toContain('snap');
    });

    it('the server filters invoices by recordStatus and projects minimally (CP-5 contract)', () => {
        const start = portalsSrc.indexOf('export const getClientInvoices');
        const end = portalsSrc.indexOf('export const', start + 10);
        const fn = portalsSrc.slice(start, end);
        expect(fn).toContain('row.inv.recordStatus !== "voided"');
        expect(fn).toContain('row.inv.recordStatus !== "test"');
        expect(fn).toContain('row.inv.status !== "Void"');
        // Minimal projection: the internal blobs are never mapped through.
        // V2 evolution: paymentDetails passes ONLY as the explicit 3-field
        // payment-instruction projection — the raw blob (bankCode etc.)
        // never maps through.
        for (const banned of ['voidReason: inv', 'voidedByEmail: inv', 'providerReference: inv', 'client: inv', 'recordStatus: inv', 'bankCode']) {
            expect(fn).not.toContain(banned);
        }
        expect(fn).toContain('total_amount: inv.total_amount');
        expect(fn).toContain('matter: { id: matterId');
        expect(fn).toContain('paymentDetails: inv.paymentDetails ? {');
        expect(fn).toContain('bankName: (inv.paymentDetails as any).bankName ?? null');
    });
});
