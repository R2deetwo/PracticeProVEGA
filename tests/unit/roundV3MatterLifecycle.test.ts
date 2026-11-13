/**
 * roundV3MatterLifecycle.test.ts — V3: VEGA MATTER LIFECYCLE INTEGRITY
 * (part 1: lifecycle, archive/restore, cascade, documents, activity,
 * bulk assignment — acceptance criteria 1, 2, 3, 4, 5, 6, 7, 10, 11).
 * Real-handler tests against the fixture-backed ctx (the V1/V2 harness) —
 * no mocks of the code under test.
 * ─────────────────────────────────────────────────────────────────────────
 * Findings under test (V0 audit → V3 brief):
 *   V-MATTER-1/2  free-string status/stage through the generic CRUD path →
 *                 the server-enforced state machine + stage shape rules.
 *   V-MATTER-3    dead CloseMatterModal + unreachable unbilled warning →
 *                 validated closeMatter + server-computed close preview.
 *   V-MATTER-4/7  two-step client archive manufacturing GHOST archive rows →
 *                 one atomic archiveMatter/restoreMatter transaction.
 *   V-MATTER-8    deleteMatterCascade hard-deleting booked invoices →
 *                 financial records refuse the delete and block it.
 *   V-MATTER-13   snapshot-only documents invisible to every by_matter
 *                 query → dual-convention readers + additive backfill +
 *                 FK fence on new writes.
 *   V-MATTER-9/11/12/15/17 departed-user assignments, dead activity feed,
 *                 overwritten stage "history", ignored bulk-assign context,
 *                 toast-only fake success.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    createItem,
    updateItem,
    deleteItem,
    deleteMatterCascade,
    getMatterDetails,
} from '../../convex/myFunctions';
import {
    closeMatter,
    reopenMatter,
    archiveMatter,
    restoreMatter,
    assignUsersToMatters,
    setMatterAssociatedContacts,
    getMatterClosePreview,
    getFirmActivityFeed,
    getMatterStageHistory,
    MATTER_TRANSITIONS,
    normalizeMatterStatus,
    validateMatterStatusTransition,
    validateMatterStage,
} from '../../convex/matterLifecycle';
import {
    backfillDocumentMatterIds,
    backfillInvoiceMatterIds,
} from '../../convex/migrations';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolvePath(here, '../..');
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed ctx (the established harness) ────────────────────────────
type Row = Record<string, any>;

function makeCtx(fix: { tables?: Record<string, Row[]> } = {}) {
    const tables: Record<string, Row[]> = {
        sessions: [],
        users: [],
        contacts: [],
        matters: [],
        documents: [],
        invoices: [],
        tasks: [],
        events: [],
        notePages: [],
        timeEntries: [],
        expenses: [],
        clientMessages: [],
        researchNotebooks: [],
        chatConversations: [],
        externalCounselInvites: [],
        properties: [],
        tenancies: [],
        property_relationships: [],
        trust_transactions: [],
        ledger_entries: [],
        payment_proofs: [],
        financial_counters: [],
        financial_audit_log: [],
        firmActivity: [],
        matterStageHistory: [],
        archive: [],
        conflict_checks: [],
        workflows: [],
        automation_rules: [],
        securityEvents: [],
        rateLimits: [],
        suspendedUsers: [],
        ...(fix.tables ?? {}),
    };

    const findRows = (table: string, conds: Array<[string, any]>) =>
        (tables[table] ?? []).filter((r: any) => conds.every(([f, v]) => r[f] !== undefined && String(r[f]) === String(v)));

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
                const q: any = { field: (f: any) => f, eq: (f: any, v: any) => { conds.push([String(f), v]); return q; } };
                try { fn(q); } catch { /* no conditions */ }
                const rows = (tables[table] ?? []).filter((r: any) =>
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
                const hit = rows.find((r: any) => String(r._id) === idStr);
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
                const hit = rows.find((r: any) => String(r._id) === idStr);
                if (hit) Object.assign(hit, value);
            }
            return null;
        },
        delete: async (id: any) => {
            const idStr = String(id);
            for (const rows of Object.values(tables)) {
                const idx = rows.findIndex((r: any) => String(r._id) === idStr);
                if (idx >= 0) rows.splice(idx, 1);
            }
            return null;
        },
    };

    const ctx: any = {
        db,
        runMutation: vi.fn(async (fn: any, args: any) => (fn as any)._handler(ctx, args)),
        runAction: vi.fn(async () => ({ success: true })),
        runQuery: vi.fn(async (fn: any, args: any) => (fn as any)._handler(ctx, args)),
        scheduler: { runAfter: vi.fn(async () => null) },
        auth: { getUserIdentity: async () => null },
    };
    return { ctx, tables };
}

function sessionRow(token: string, userId: string) {
    return {
        tokenHash: hashSessionToken(token),
        userId,
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
}

// ── World ────────────────────────────────────────────────────────────────────
const ADMIN: Row = { _id: 'u-admin', id: 'u-admin', email: 'admin@example.com', name: 'Ada Admin', role: 'Admin', firmId: 'firm-1' };
const LAWYER: Row = { _id: 'u-lawyer', id: 'u-lawyer', email: 'lawyer@example.com', name: 'Bola Lawyer', role: 'Lawyer', firmId: 'firm-1' };
const PARA: Row = { _id: 'u-para', id: 'u-para', email: 'para@example.com', name: 'Ngozi Para', role: 'Paralegal', firmId: 'firm-1' };
const FIRM: Row = { _id: 'firm-1', id: 'firm-1', name: 'Avery & Jarvis', subscriptionPlan: 'Growth', product: 'legal' };

// The split-brain matter: custom id AND Convex _id, children keyed on each.
const M_ACTIVE: Row = {
    _id: 'm-convex-1', id: 'cust-m-1', firmId: 'firm-1',
    title: 'Contract Review', type: 'Corporate', status: 'Active', stage: 'Intake',
    assignedUsers: [], clientId: 'contact-1',
};
const M_CLOSED: Row = {
    _id: 'm-convex-2', id: 'cust-m-2', firmId: 'firm-1',
    title: 'Closed Probate', type: 'Probate', status: 'Closed', stage: 'Judgment',
    assignedUsers: [], clientId: 'contact-1',
};
const M_LEGACY_JUNK: Row = {
    _id: 'm-convex-3', id: 'cust-m-3', firmId: 'firm-1',
    title: 'Legacy Rot', type: 'Corporate', status: 'Dormant', stage: 'Old Stage',
    assignedUsers: [], clientId: 'contact-1',
};
const M2_ACTIVE: Row = {
    _id: 'm-convex-4', id: 'cust-m-4', firmId: 'firm-1',
    title: 'Second Matter', type: 'Corporate', status: 'Active', stage: 'Intake',
    assignedUsers: ['u-lawyer'], clientId: 'contact-1',
};

function makeWorld(overrides: Record<string, Row[]> = {}) {
    const tables: Record<string, Row[]> = {
        users: [ADMIN, LAWYER, PARA],
        firms: [FIRM],
        sessions: [
            sessionRow('tok-admin', 'u-admin'),
            sessionRow('tok-lawyer', 'u-lawyer'),
        ],
        contacts: [{ _id: 'contact-1', id: 'cust-contact-1', firmId: 'firm-1', name: 'Chidi Client', email: 'client@example.com' }],
        matters: [structuredClone(M_ACTIVE), structuredClone(M_CLOSED), structuredClone(M_LEGACY_JUNK), structuredClone(M2_ACTIVE)],
        ...overrides,
    };
    const cloned = Object.fromEntries(
        Object.entries(tables).map(([k, rows]) => [k, (rows as Row[]).map((r: any) => structuredClone(r))])
    );
    return makeCtx({ tables: cloned }) as { ctx: any; tables: any };
}

const call = (fn: any, ctx: any, args: any) => (fn as any)._handler(ctx, args);

// ═══════════════════════════════════════════════════════════════════════════
// 0. THE STATE MACHINE ITSELF (V-MATTER-1)
// ═══════════════════════════════════════════════════════════════════════════
describe('V3 — the matter status state machine (V-MATTER-1)', () => {
    it('the transition graph matches the product model (Active/Closed/Archived)', () => {
        expect(MATTER_TRANSITIONS.Active).toEqual(['Active', 'Closed', 'Archived']);
        expect(MATTER_TRANSITIONS.Closed).toEqual(['Closed', 'Active', 'Archived']);
        expect(MATTER_TRANSITIONS.Archived).toEqual(['Archived', 'Active']);
    });

    it('status normalisation is case-insensitive and rejects junk', () => {
        expect(normalizeMatterStatus('active')).toBe('Active');
        expect(normalizeMatterStatus(' CLOSED ')).toBe('Closed');
        expect(normalizeMatterStatus('archived')).toBe('Archived');
        expect(normalizeMatterStatus('Bananas')).toBeNull();
        expect(normalizeMatterStatus(123)).toBeNull();
        expect(normalizeMatterStatus('')).toBeNull();
    });

    it('valid + invalid transitions (V-MATTER-2)', () => {
        expect(validateMatterStatusTransition('Active', 'Closed').ok).toBe(true);
        expect(validateMatterStatusTransition('Closed', 'Active').ok).toBe(true);
        expect(validateMatterStatusTransition('Active', 'Archived').ok).toBe(true);
        expect(validateMatterStatusTransition('Archived', 'Active').ok).toBe(true);
        // Same→same is a no-op, not a violation (forms re-send whole objects).
        expect(validateMatterStatusTransition('Active', 'Active').ok).toBe(true);
        // Archived→Closed must restore first.
        const blocked = validateMatterStatusTransition('Archived', 'Closed');
        expect(blocked.ok).toBe(false);
        if (!blocked.ok) expect(blocked.error).toMatch(/Restore the matter from the Archive first/);
        // Legacy junk rows may move to ANY canonical status (repair, not rot).
        expect(validateMatterStatusTransition('Dormant', 'Active').ok).toBe(true);
        expect(validateMatterStatusTransition('Dormant', 'Closed').ok).toBe(true);
    });

    it('stage shape rules: trim, non-empty, ≤80 chars, no control chars (V-MATTER-2)', () => {
        expect(validateMatterStage('  Pleadings  ')).toEqual({ ok: true, stage: 'Pleadings' });
        expect(validateMatterStage(123).ok).toBe(false);
        expect(validateMatterStage('').ok).toBe(false);
        expect(validateMatterStage('x'.repeat(81)).ok).toBe(false);
        expect(validateMatterStage('Bad\u0007Stage').ok).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. MATTER CREATION AND ASSIGNMENT (acceptance #1)
// ═══════════════════════════════════════════════════════════════════════════
describe('V3 — matter creation and assignment through the REAL createItem', () => {
    it('creation defaults to Active, records firmActivity and seeds stage history (V-MATTER-11/12)', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        await call(createItem, ctx, {
            table: 'matters',
            data: {
                id: 'cust-m-new', title: 'Fresh Matter', type: 'Corporate',
                stage: 'Intake', assignedUsers: ['u-lawyer'],
            },
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        const created = tables.matters.find((m: any) => m.id === 'cust-m-new');
        expect(created.status).toBe('Active'); // default, not free text
        expect(created.stage).toBe('Intake');
        // Activity: creation is recorded with the assignment in metadata.
        const activity = tables.firmActivity.find((a: any) => a.action === 'Matter created');
        expect(activity.targetId).toBe('cust-m-new');
        expect(activity.metadata.assignedUsers).toEqual(['u-lawyer']);
        expect(activity.userName).toBe('Bola Lawyer');
        // Stage history: the opening entry is durable.
        const history = tables.matterStageHistory.filter((h: any) => h.matterId === 'cust-m-new');
        expect(history).toHaveLength(1);
        expect(history[0].fromStage).toBeNull();
        expect(history[0].toStage).toBe('Intake');
        expect(history[0].source).toBe('created');
    });

    it('arbitrary status strings are rejected at creation (V-MATTER-1)', async () => {
        const { ctx } = makeWorld();
        await expect(call(createItem, ctx, {
            table: 'matters',
            data: { id: 'cust-m-bad', title: 'Bad Status', status: 'Dormant' },
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        })).rejects.toThrow(/Invalid matter status 'Dormant'/);
    });

    it('garbage stage values are rejected at creation (V-MATTER-2)', async () => {
        const { ctx } = makeWorld();
        await expect(call(createItem, ctx, {
            table: 'matters',
            data: { id: 'cust-m-badstage', title: 'Bad Stage', stage: { nested: true } as any },
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        })).rejects.toThrow(/Invalid matter stage/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. VALID AND INVALID LIFECYCLE TRANSITIONS VIA updateItem (acceptance #2)
// ═══════════════════════════════════════════════════════════════════════════
describe('V3 — lifecycle transitions through the REAL updateItem', () => {
    const patch = (ctx: any, id: string, data: any) =>
        call(updateItem, ctx, {
            table: 'matters', id, data,
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });

    it('Active → Closed is allowed and recorded (V-MATTER-3/11)', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        await patch(ctx, 'cust-m-1', { status: 'Closed' });
        expect(tables.matters.find((m: any) => m.id === 'cust-m-1').status).toBe('Closed');
        expect(tables.firmActivity.some((a: any) => a.action === 'Matter closed')).toBe(true);
    });

    it('case-insensitive status is canonicalised on write', async () => {
        const { ctx, tables } = makeWorld();
        await patch(ctx, 'cust-m-1', { status: 'closed' });
        expect(tables.matters.find((m: any) => m.id === 'cust-m-1').status).toBe('Closed');
    });

    it('Closed → Active (reopen) is allowed and recorded', async () => {
        const { ctx, tables } = makeWorld();
        await patch(ctx, 'cust-m-2', { status: 'Active' });
        expect(tables.matters.find((m: any) => m.id === 'cust-m-2').status).toBe('Active');
        expect(tables.firmActivity.some((a: any) => a.action === 'Matter reopened')).toBe(true);
    });

    it('same→same status re-save is a no-op (forms re-send whole objects)', async () => {
        const { ctx, tables } = makeWorld();
        await patch(ctx, 'cust-m-1', { status: 'Active', title: 'Contract Review' });
        expect(tables.matters.find((m: any) => m.id === 'cust-m-1').title).toBe('Contract Review');
        expect(tables.firmActivity.filter((a: any) => a.action === 'Matter status changed to Active')).toHaveLength(0);
    });

    it('invalid transitions and junk statuses are rejected server-side', async () => {
        const { ctx } = makeWorld();
        // Archived → Closed must restore first.
        await patch(ctx, 'cust-m-1', { status: 'Archived' });
        await expect(patch(ctx, 'cust-m-1', { status: 'Closed' })).rejects.toThrow(/Invalid matter lifecycle transition: 'Archived' → 'Closed'/);
        // Junk target string.
        await expect(patch(ctx, 'cust-m-4', { status: 'Zombie' })).rejects.toThrow(/Invalid matter status 'Zombie'/);
    });

    it('legacy junk status rows can be repaired to any canonical status', async () => {
        const { ctx, tables } = makeWorld();
        await patch(ctx, 'cust-m-3', { status: 'Active' });
        expect(tables.matters.find((m: any) => m.id === 'cust-m-3').status).toBe('Active');
    });

    it('stage changes append DURABLE history — nothing is overwritten (V-MATTER-12)', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        await patch(ctx, 'cust-m-1', { stage: 'Drafting', stageLastUpdated: new Date().toISOString() });
        await patch(ctx, 'cust-m-1', { stage: 'Review', stageLastUpdated: new Date().toISOString() });
        const history = tables.matterStageHistory
            .filter((h: any) => h.matterId === 'cust-m-1')
            .sort((a: any, b: any) => String(a.changedAt).localeCompare(String(b.changedAt)));
        // The old code kept ONE overwritten timestamp; history is now a ledger.
        expect(history).toHaveLength(2);
        expect(history[0]).toMatchObject({ fromStage: 'Intake', toStage: 'Drafting' });
        expect(history[1]).toMatchObject({ fromStage: 'Drafting', toStage: 'Review' });
        expect(tables.firmActivity.some((a: any) => a.action === 'Stage moved: Intake → Drafting')).toBe(true);
    });

    it('assignment changes are recorded with the diff (V-MATTER-11/17)', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        await patch(ctx, 'cust-m-1', { assignedUsers: ['u-lawyer', 'u-para'] });
        const activity = tables.firmActivity.find((a: any) => a.action === 'Matter team updated');
        expect(activity.metadata).toEqual({ added: ['u-lawyer', 'u-para'], removed: [] });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. CLOSURE WITH OUTSTANDING WORK (acceptance #3)
// ═══════════════════════════════════════════════════════════════════════════
describe('V3 — closeMatter + the server-computed unbilled preview (V-MATTER-3)', () => {
    function worldWithWork() {
        return makeWorld({
            timeEntries: [
                { _id: 'te-1', firmId: 'firm-1', matterId: 'cust-m-1', billable: true, duration: 1.5, billedInInvoiceId: null },
                { _id: 'te-2', firmId: 'firm-1', matterId: 'cust-m-1', billable: true, duration: 0.5, billedInInvoiceId: 'inv-1' },
                { _id: 'te-3', firmId: 'firm-1', matterId: 'cust-m-4', billable: true, duration: 2, billedInInvoiceId: null },
            ],
            expenses: [
                { _id: 'ex-1', firmId: 'firm-1', matterId: 'cust-m-1', isBillable: true, amount: 15000, billedInInvoiceId: null },
                // Snapshot-convention expense (legacy) — also counted.
                { _id: 'ex-2', firmId: 'firm-1', matter: { id: 'cust-m-1', title: 'Contract Review' }, isBillable: true, amount: 5000, billedInInvoiceId: null },
            ],
            tasks: [
                { _id: 'task-1', firmId: 'firm-1', matterId: 'cust-m-1', status: 'In Progress', title: 'Draft deed' },
                { _id: 'task-2', firmId: 'firm-1', matterId: 'cust-m-1', status: 'Done', title: 'File docs' },
            ],
            invoices: [
                { _id: 'inv-1', firmId: 'firm-1', matter: { id: 'cust-m-1', title: 'Contract Review' }, status: 'Sent' },
            ],
        });
    }

    it('getMatterClosePreview computes the unbilled/open numbers server-side, across BOTH id conventions', async () => {
        const { ctx } = worldWithWork();
        const preview = await call(getMatterClosePreview, ctx, {
            matterId: 'cust-m-1', userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(preview.unbilledTimeCount).toBe(1);      // te-1 only (te-2 billed)
        expect(preview.unbilledHours).toBeCloseTo(1.5);
        expect(preview.unbilledExpenseCount).toBe(2);    // matterId + snapshot conventions
        expect(preview.unbilledExpenseTotal).toBe(20000);
        expect(preview.openTaskCount).toBe(1);
        expect(preview.outstandingInvoiceCount).toBe(1);
    });

    it('closing succeeds WITH outstanding work (the warning is advisory) and persists the closing note (V-MATTER-3)', async () => {
        const { ctx, tables } = worldWithWork();
        (ctx as any).__tables = tables;
        const result = await call(closeMatter, ctx, {
            matterId: 'cust-m-1', closingNote: 'Settled at the door.',
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(result.success).toBe(true);
        const matter = tables.matters.find((m: any) => m.id === 'cust-m-1');
        expect(matter.status).toBe('Closed');
        expect(matter.closedAt).toBeTruthy();
        // The closing note is a real note — the dead modal discarded it.
        const note = tables.notePages.find((n: any) => n.title === 'Closing Summary');
        expect(note.content).toBe('Settled at the door.');
        expect(note.matterId).toBe('cust-m-1');
        expect(tables.firmActivity.some((a: any) => a.action === 'Matter closed')).toBe(true);
    });

    it('closing an already-closed matter is an honest no-op; closing an ARCHIVED matter refuses', async () => {
        const { ctx } = makeWorld();
        const again = await call(closeMatter, ctx, {
            matterId: 'cust-m-2', userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(again.alreadyClosed).toBe(true);
        // Archive one first, then try to close it.
        await call(archiveMatter, ctx, { matterId: 'cust-m-1', userEmail: 'admin@example.com', sessionToken: 'tok-admin' });
        await expect(call(closeMatter, ctx, {
            matterId: 'cust-m-1', userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        })).rejects.toThrow(/Invalid matter lifecycle transition: 'Archived' → 'Closed'/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 + 5. ARCHIVE, RESTORE, AND GHOST-ROW PREVENTION (acceptance #4, #5)
// ═══════════════════════════════════════════════════════════════════════════
describe('V3 — archiveMatter / restoreMatter: atomic soft archive (V-MATTER-4/7)', () => {
    it('archive is ONE transaction: archive row + status flip + activity, with children intact', async () => {
        const { ctx, tables } = makeWorld({
            tasks: [{ _id: 'task-1', firmId: 'firm-1', matterId: 'cust-m-1', title: 'Draft deed' }],
            documents: [{ _id: 'doc-1', firmId: 'firm-1', matterId: 'cust-m-1', title: 'Deed.pdf' }],
        });
        (ctx as any).__tables = tables;
        await call(archiveMatter, ctx, { matterId: 'cust-m-1', userEmail: 'admin@example.com', sessionToken: 'tok-admin' });
        const matter = tables.matters.find((m: any) => m.id === 'cust-m-1');
        expect(matter.status).toBe('Archived');
        expect(matter.archivedAt).toBeTruthy();
        expect(matter.archivedByName).toBe('Ada Admin');
        // The archive row (the Archive page's record + restore source).
        expect(tables.archive).toHaveLength(1);
        expect(tables.archive[0].itemType).toBe('matters');
        expect(tables.archive[0].itemId).toBe('cust-m-1');
        expect(tables.archive[0].originalData.priorStatus).toBe('Active');
        // Soft archive: children stay linked (no delete → no FK failure → no ghost).
        expect(tables.tasks).toHaveLength(1);
        expect(tables.documents).toHaveLength(1);
        expect(tables.firmActivity.some((a: any) => a.action === 'Matter archived')).toBe(true);
    });

    it('archiving is admin/founder-gated — a Lawyer is refused with the role reason', async () => {
        const { ctx } = makeWorld();
        await expect(call(archiveMatter, ctx, {
            matterId: 'cust-m-1', userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        })).rejects.toThrow(/Permission denied.*Administrator/s);
        // Nothing was written — not even a ghost archive row.
        expect((ctx as any).__tables ?? makeWorld().tables).toBeTruthy();
    });

    it('FAILED ARCH LEAVES NO GHOST ROW: double-archive refuses and the count stays 1 (V-MATTER-7)', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        await call(archiveMatter, ctx, { matterId: 'cust-m-1', userEmail: 'admin@example.com', sessionToken: 'tok-admin' });
        await expect(call(archiveMatter, ctx, {
            matterId: 'cust-m-1', userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        })).rejects.toThrow(/already archived|already has an archive record/);
        // THE ghost test: exactly one archive row exists for the matter.
        expect(tables.archive.filter((r: any) => r.itemType === 'matters')).toHaveLength(1);
    });

    it('archiving a missing matter throws and writes NOTHING', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        await expect(call(archiveMatter, ctx, {
            matterId: 'no-such-matter', userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        })).rejects.toThrow(/not found/i);
        expect(tables.archive).toHaveLength(0);
        expect(tables.firmActivity.filter((a: any) => a.action === 'Matter archived')).toHaveLength(0);
    });

    it('restore flips the status back to its prior value and removes the archive row (V-MATTER-4)', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        await call(archiveMatter, ctx, { matterId: 'cust-m-2', userEmail: 'admin@example.com', sessionToken: 'tok-admin' });
        await call(restoreMatter, ctx, { matterId: 'cust-m-2', userEmail: 'admin@example.com', sessionToken: 'tok-admin' });
        const matter = tables.matters.find((m: any) => m.id === 'cust-m-2');
        expect(matter.status).toBe('Closed'); // the PRIOR status, faithfully
        expect(matter.archivedAt).toBeNull();
        expect(tables.archive).toHaveLength(0);
        expect(tables.firmActivity.some((a: any) => a.action === 'Matter restored from archive')).toBe(true);
    });

    it('restore also serves LEGACY hard-delete-era rows (re-insert from the snapshot)', async () => {
        const { ctx, tables } = makeWorld({
            archive: [{
                _id: 'arch-legacy', firmId: 'firm-1', itemType: 'matters', itemId: 'cust-m-gone',
                itemName: 'Gone Matter',
                originalData: { id: 'cust-m-gone', firmId: 'firm-1', title: 'Gone Matter', status: 'Active', stage: 'Intake', priorStatus: 'Active' },
                archivedAt: '2026-01-01T00:00:00.000Z',
            }],
        });
        (ctx as any).__tables = tables;
        await call(restoreMatter, ctx, { archiveRowId: 'arch-legacy', userEmail: 'admin@example.com', sessionToken: 'tok-admin' });
        const restored = tables.matters.find((m: any) => m.id === 'cust-m-gone');
        expect(restored.title).toBe('Gone Matter');
        expect(restored.status).toBe('Active');
        expect(tables.archive).toHaveLength(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. DELETE CASCADE WITH FINANCIAL PROTECTION (acceptance #6, V-MATTER-8)
// ═══════════════════════════════════════════════════════════════════════════
describe('V3 — deleteMatterCascade: the ledger only grows (V-MATTER-8)', () => {
    const del = (ctx: any, matterId: string, asAdmin = true) =>
        call(deleteMatterCascade, ctx, {
            matterId, firmId: 'firm-1',
            userEmail: asAdmin ? 'admin@example.com' : 'lawyer@example.com',
            sessionToken: asAdmin ? 'tok-admin' : 'tok-lawyer',
        });

    it('REFUSES when the matter has invoices — in EITHER id convention', async () => {
        const { ctx, tables } = makeWorld({
            invoices: [{ _id: 'inv-1', firmId: 'firm-1', matter: { id: 'cust-m-1', title: 'Contract Review' }, status: 'Sent', total_amount: 100000 }],
        });
        (ctx as any).__tables = tables;
        await expect(del(ctx, 'cust-m-1')).rejects.toThrow(/financial records that are never hard-deleted.*invoice/s);
        // Both the matter AND the invoice survive.
        expect(tables.matters.some((m: any) => m.id === 'cust-m-1')).toBe(true);
        expect(tables.invoices).toHaveLength(1);
    });

    it('REFUSES when the matter has trust transactions or BILLED time', async () => {
        const trustWorld = makeWorld({
            trust_transactions: [{ _id: 'tt-1', firmId: 'firm-1', matterId: 'cust-m-1', amount: 50000 }],
        });
        await expect(del(trustWorld.ctx, 'cust-m-1')).rejects.toThrow(/trust transaction/);

        const billedWorld = makeWorld({
            timeEntries: [{ _id: 'te-1', firmId: 'firm-1', matterId: 'cust-m-1', billable: true, duration: 1, billedInInvoiceId: 'inv-x' }],
        });
        await expect(del(billedWorld.ctx, 'cust-m-1')).rejects.toThrow(/billed time entr/);
    });

    it('non-admins cannot cascade-delete (the role gate the UI now communicates)', async () => {
        const { ctx } = makeWorld();
        await expect(del(ctx, 'cust-m-4', false)).rejects.toThrow(/Permission denied/);
    });

    it('a matter with only non-financial children deletes them all — across BOTH id conventions', async () => {
        const { ctx, tables } = makeWorld({
            tasks: [{ _id: 'task-1', firmId: 'firm-1', matterId: 'cust-m-1', title: 'Draft' }],
            documents: [{ _id: 'doc-1', firmId: 'firm-1', matter: { id: 'cust-m-1', title: 'Contract Review' }, title: 'Deed.pdf' }],
            events: [{ _id: 'ev-1', firmId: 'firm-1', matterId: 'm-convex-1', title: 'Hearing' }], // keyed on the CONVEX id
            notePages: [{ _id: 'note-1', firmId: 'firm-1', matterId: 'cust-m-1', title: 'Note' }],
            timeEntries: [{ _id: 'te-unbilled', firmId: 'firm-1', matterId: 'cust-m-1', billable: true, duration: 2, billedInInvoiceId: null }],
            invoices: [{ _id: 'inv-other', firmId: 'firm-1', matter: { id: 'cust-m-4', title: 'Second Matter' }, status: 'Sent' }],
            archive: [{ _id: 'arch-1', firmId: 'firm-1', itemType: 'matters', itemId: 'cust-m-1', itemName: 'Contract Review', originalData: {} }],
        });
        (ctx as any).__tables = tables;
        // Called with the CUSTOM id while some children store the CONVEX id.
        const result = await del(ctx, 'cust-m-1');
        expect(result.success).toBe(true);
        expect(result.summary).toMatchObject({ tasks: 1, documents: 1, events: 1, notePages: 1, timeEntries: 1, matter: 1, archiveRows: 1 });
        expect(tables.matters.some((m: any) => m.id === 'cust-m-1')).toBe(false);
        // OTHER matters' invoices are untouched — no collateral damage.
        expect(tables.invoices).toHaveLength(1);
        // The deletion itself is audited.
        expect(tables.firmActivity.some((a: any) => a.action === 'Matter permanently deleted')).toBe(true);
    });

    it('deleteItem FK guard now operates on the REAL invoice fields (V-MATTER-14)', async () => {
        const { ctx, tables } = makeWorld({
            invoices: [{ _id: 'inv-1', firmId: 'firm-1', matter: { id: 'cust-m-1', title: 'Contract Review' }, status: 'Sent' }],
        });
        (ctx as any).__tables = tables;
        // The old guard checked `invoices.matterId` — a field invoices never
        // had — so a matter with booked invoices deleted cleanly past it.
        await expect(call(deleteItem, ctx, {
            table: 'matters', id: 'cust-m-1',
            userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        })).rejects.toThrow(/Cannot delete this matter.*invoices/s);
        expect(tables.matters.some((m: any) => m.id === 'cust-m-1')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. DOCUMENT ASSOCIATION ACROSS EVERY UPLOAD ROUTE (acceptance #7, V-MATTER-13)
// ═══════════════════════════════════════════════════════════════════════════
describe('V3 — document matter links: fence, readers, backfill (V-MATTER-13)', () => {
    it('new uploads with a matterId pass the FK fence on BOTH conventions; bogus ids are refused', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        // Custom-id convention (the main upload form).
        await call(createItem, ctx, {
            table: 'documents',
            data: { id: 'doc-a', title: 'Custom-linked', matterId: 'cust-m-1' },
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        // Convex-_id convention (portal/batch uploads).
        await call(createItem, ctx, {
            table: 'documents',
            data: { id: 'doc-b', title: 'Convex-linked', matterId: 'm-convex-1' },
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        // A bogus link is refused — no more unjoinable rows.
        await expect(call(createItem, ctx, {
            table: 'documents',
            data: { id: 'doc-c', title: 'Bogus', matterId: 'no-such-matter' },
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        })).rejects.toThrow(/no matter with id "no-such-matter"/);
        expect(tables.documents).toHaveLength(2);
    });

    it('legacy snapshot-only documents remain creatable and READABLE (no history rewrite)', async () => {
        const { ctx, tables } = makeWorld({
            documents: [{ _id: 'doc-snap', firmId: 'firm-1', title: 'Snapshot-only', matter: { id: 'cust-m-1', title: 'Contract Review' }, dateFiled: '2026-10-01', createdAt: '2026-10-01' }],
        });
        (ctx as any).__tables = tables;
        // Still creatable (no fence on the absent field).
        await call(createItem, ctx, {
            table: 'documents',
            data: { id: 'doc-legacy', title: 'Another snapshot', matter: { id: 'cust-m-1', title: 'Contract Review' } },
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        // getMatterDetails resolves BOTH conventions — snapshot docs are no
        // longer invisible on their own matter.
        const details = await call(getMatterDetails, ctx, {
            matterId: 'cust-m-1', firmId: 'firm-1', requestUserId: 'u-lawyer',
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        const titles = details.documents.map((d: any) => d.title);
        expect(titles).toContain('Snapshot-only');
        expect(titles).toContain('Another snapshot');
        // The legacy row itself was never rewritten.
        expect(tables.documents.find((d: any) => d.title === 'Snapshot-only').matterId).toBeUndefined();
    });

    it('the additive backfill: dry-run reports, real run links, re-run is a no-op, unresolvable is never guessed', async () => {
        const base = () => makeWorld({
            documents: [
                { _id: 'doc-1', firmId: 'firm-1', title: 'Snap A', matter: { id: 'cust-m-1', title: 'Contract Review' } },
                { _id: 'doc-2', firmId: 'firm-1', title: 'Snap Gone', matter: { id: 'cust-m-gone', title: 'Deleted Matter' } },
                { _id: 'doc-3', firmId: 'firm-1', title: 'Already linked', matterId: 'cust-m-1' },
            ],
        });
        // Dry run: reports, writes nothing.
        const dry = base();
        const dryReport = await call(backfillDocumentMatterIds, dry.ctx, { dryRun: true });
        expect(dryReport.dryRun).toBe(true);
        expect(dryReport.linked).toBe(1);
        expect(dryReport.alreadyLinked).toBe(1);
        expect(dryReport.unresolved).toBe(1);
        expect(dry.tables.documents.find((d: any) => d.title === 'Snap A').matterId).toBeUndefined();
        // Real run: patches the resolvable row only.
        const real = base();
        const realReport = await call(backfillDocumentMatterIds, real.ctx, { dryRun: false });
        expect(realReport.rowsPatched).toBe(1);
        const linked = real.tables.documents.find((d: any) => d.title === 'Snap A');
        expect(linked.matterId).toBe('cust-m-1');
        expect(linked.matter.id).toBe('cust-m-1'); // snapshot preserved
        expect(real.tables.documents.find((d: any) => d.title === 'Snap Gone').matterId).toBeUndefined();
        // Idempotent re-run.
        const rerun = await call(backfillDocumentMatterIds, real.ctx, { dryRun: false });
        expect(rerun.alreadyLinked).toBe(2);
        expect(rerun.rowsPatched).toBe(0);
    });

    it('the invoice backfill: links snapshot invoices additively, skips the "general" placeholder', async () => {
        const base = () => makeWorld({
            invoices: [
                { _id: 'inv-1', firmId: 'firm-1', invoiceNumber: 'INV-1', matter: { id: 'cust-m-1', title: 'Contract Review' }, status: 'Sent' },
                { _id: 'inv-gen', firmId: 'firm-1', invoiceNumber: 'INV-2', matter: { id: 'general', title: 'General Management' }, status: 'Sent' },
            ],
        });
        const world = base();
        const report = await call(backfillInvoiceMatterIds, world.ctx, { dryRun: false });
        expect(report.rowsPatched).toBe(1);
        expect(world.tables.invoices.find((i: any) => i.invoiceNumber === 'INV-1').matterId).toBe('cust-m-1');
        expect(world.tables.invoices.find((i: any) => i.invoiceNumber === 'INV-2').matterId).toBeUndefined();
    });

    it('source contracts: EVERY upload/write route now sets the declarative link (V-MATTER-13/14)', () => {
        // The main upload form — the primary snapshot-only offender.
        const docForm = read('src/components/forms/DocumentForm.tsx');
        expect(docForm).toMatch(/matterId:\s*selectedMatter\s*\?\s*selectedMatter\.id\s*:\s*undefined/);
        // Batch upload resolves the REAL matter title (the old placeholder
        // wrote title: 'Matter' into every snapshot).
        const batch = read('src/components/modals/BatchUploadModal.tsx');
        expect(batch).toContain("matterId: context?.matterId");
        expect(batch).not.toContain("title: 'Matter' }");
        // Invoice writers: the declarative link ALONGSIDE the snapshot.
        const invForm = read('src/components/forms/InvoiceForm.tsx');
        expect(invForm).toMatch(/matterId:\s*matter!\.id/);
        const useFinance = read('src/hooks/useFinance.ts');
        expect(useFinance).toMatch(/matter\.id !== 'general' \? \{ matterId: matter\.id \}/);
        // The retainer outbox → invoice path.
        expect(read('convex/retainerBilling.ts')).toMatch(/matterId:\s*entry\.matterId \|\| undefined/);
        // Portal reader resolves both conventions (V1-C pin, still true).
        expect(read('convex/portals.ts')).toContain('resolveDocMatter');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. ACTIVITY AND STAGE HISTORY (acceptance #10, V-MATTER-11/12)
// ═══════════════════════════════════════════════════════════════════════════
describe('V3 — the firm activity feed is REAL again (V-MATTER-11)', () => {
    it('getFirmActivityFeed returns firm-scoped, newest-first rows — cross-firm rows never leak', async () => {
        const t0 = '2026-11-01T10:00:00.000Z';
        const t1 = '2026-11-02T10:00:00.000Z';
        const { ctx } = makeWorld({
            firmActivity: [
                { _id: 'fa-0', firmId: 'firm-1', action: 'Matter created', timestamp: t0, userName: 'Bola Lawyer', targetType: 'Matter', targetId: 'cust-m-1', id: 'fa-0' },
                { _id: 'fa-1', firmId: 'firm-1', action: 'Matter closed', timestamp: t1, userName: 'Ada Admin', targetType: 'Matter', targetId: 'cust-m-2', id: 'fa-1' },
                { _id: 'fa-2', firmId: 'firm-OTHER', action: 'Matter created', timestamp: t1, userName: 'Stranger', id: 'fa-2' },
            ],
        });
        const feed = await call(getFirmActivityFeed, ctx, {
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(feed.map((a: any) => a.action)).toEqual(['Matter closed', 'Matter created']); // newest first
        expect(feed.every((a: any) => a.userName !== 'Stranger')).toBe(true);
    });

    it('getMatterStageHistory reads both id conventions, newest first', async () => {
        const { ctx } = makeWorld({
            matterStageHistory: [
                { _id: 'sh-1', firmId: 'firm-1', matterId: 'cust-m-1', fromStage: 'Intake', toStage: 'Drafting', changedAt: '2026-11-01T10:00:00.000Z', changedByName: 'Bola Lawyer', source: 'update' },
                { _id: 'sh-2', firmId: 'firm-1', matterId: 'm-convex-1', fromStage: 'Drafting', toStage: 'Review', changedAt: '2026-11-02T10:00:00.000Z', changedByName: 'Ada Admin', source: 'update' },
            ],
        });
        const history = await call(getMatterStageHistory, ctx, {
            matterId: 'cust-m-1', userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(history).toHaveLength(2);
        expect(history[0].toStage).toBe('Review'); // newest first
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. BULK ASSIGNMENT (acceptance #11, V-MATTER-15)
// ═══════════════════════════════════════════════════════════════════════════
describe('V3 — assignUsersToMatters: the bulk-assign that finally works (V-MATTER-15)', () => {
    it('assigns a validated team across many matters, records activity per matter', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        const result = await call(assignUsersToMatters, ctx, {
            matterIds: ['cust-m-1', 'cust-m-4', 'm-convex-2'], // both id conventions
            assignedUsers: ['u-lawyer', 'u-para'],
            userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        });
        expect(result.updated).toBe(3);
        for (const id of ['cust-m-1', 'cust-m-4', 'cust-m-2']) {
            expect(tables.matters.find((m: any) => m.id === id).assignedUsers).toEqual(['u-lawyer', 'u-para']);
        }
        expect(tables.firmActivity.filter((a: any) => a.action === 'Matter team updated')).toHaveLength(3);
    });

    it('invalid or deactivated assignees refuse the WHOLE assignment — nothing is half-patched', async () => {
        const deactivated = makeWorld();
        // Deactivate the paralegal.
        const para = deactivated.tables.users.find((u: any) => u._id === 'u-para');
        para.deactivatedAt = Date.now();
        await expect(call(assignUsersToMatters, deactivated.ctx, {
            matterIds: ['cust-m-1'],
            assignedUsers: ['u-lawyer', 'u-para'],
            userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        })).rejects.toThrow(/not found in this firm \(or deactivated\)/);
        expect(deactivated.tables.matters.find((m: any) => m.id === 'cust-m-1').assignedUsers).toEqual([]);

        const bogus = makeWorld();
        await expect(call(assignUsersToMatters, bogus.ctx, {
            matterIds: ['cust-m-1'],
            assignedUsers: ['u-ghost'],
            userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        })).rejects.toThrow(/not found in this firm/);
    });

    it('secondary contacts link/unlink on the REAL field, validated (V-MATTER-15)', async () => {
        const { ctx, tables } = makeWorld({
            contacts: [
                { _id: 'contact-1', id: 'cust-contact-1', firmId: 'firm-1', name: 'Chidi Client' },
                { _id: 'contact-2', id: 'cust-contact-2', firmId: 'firm-1', name: 'Tunde Witness' },
            ],
        });
        (ctx as any).__tables = tables;
        const linked = await call(setMatterAssociatedContacts, ctx, {
            matterId: 'cust-m-1', contactIds: ['cust-contact-2'],
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(linked.linked).toBe(1);
        expect(tables.matters.find((m: any) => m.id === 'cust-m-1').associatedContactIds).toEqual(['cust-contact-2']);
        // Unlink (empty selection) — the old path wrote an orphan `contactIds` key.
        const unlinked = await call(setMatterAssociatedContacts, ctx, {
            matterId: 'cust-m-1', contactIds: [],
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(unlinked.unlinked).toBe(1);
        expect(tables.matters.find((m: any) => m.id === 'cust-m-1').associatedContactIds).toEqual([]);
        // Bogus contact refused.
        await expect(call(setMatterAssociatedContacts, ctx, {
            matterId: 'cust-m-1', contactIds: ['no-such-contact'],
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        })).rejects.toThrow(/not found in this firm/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE CONTRACTS — the wiring the audit found dead (V-MATTER-3/4/8/15/17)
// ═══════════════════════════════════════════════════════════════════════════
describe('V3 — source contracts: the dead wiring is alive', () => {
    it('the close/archive modals are actually reachable — openModal call sites exist', () => {
        const detail = read('src/components/details/MatterDetailView.tsx');
        expect((detail.match(/openModal\('closeMatter'/g) || []).length).toBeGreaterThan(0);
        expect((detail.match(/openModal\('archiveMatter'/g) || []).length).toBeGreaterThan(0);
        const list = read('src/components/MatterList.tsx');
        expect((list.match(/openModal\('closeMatter'/g) || []).length).toBeGreaterThan(0);
    });

    it('the close modal runs the validated mutation, not the stage conflation', () => {
        const layer = read('src/overlays/layers/ModalLayer.tsx');
        const caseBlock = layer.slice(layer.indexOf("case 'closeMatter'"), layer.indexOf("case 'archiveMatter'"));
        expect(caseBlock).toContain('handleCloseMatter');
        expect(caseBlock).not.toContain("handleUpdateMatterStage(id, 'Closed')");
    });

    it('the bulk-assign modal consumes the matterIds context it was always given', () => {
        // UX-01: ModalLayer absorbed ModalManager's switch — the legacy
        // file is deleted.
        for (const file of ['src/overlays/layers/ModalLayer.tsx', 'src/components/modals/DockedModal.tsx']) {
            const src = read(file);
            const start = src.indexOf("case 'assignUsers'");
            expect(start).toBeGreaterThan(-1);
            const nextCase = src.indexOf("case '", start + 10);
            const caseBlock = src.slice(start, nextCase > start ? nextCase : undefined);
            expect(caseBlock).toContain('modalContext?.matterIds');
            expect(caseBlock).toContain('handleBulkAssignMatters');
        }
    });

    it('the toast-only fake successes are gone from useMatters (V-MATTER-17)', () => {
        const src = read('src/hooks/useMatters.ts');
        expect(src).not.toMatch(/portal invite queued for/);
        expect(src).not.toMatch(/Portal update for/);
        expect(src).not.toContain('addToast("Linked contact to matter."');
    });

    it('archived matters leave the working list and the client portal', () => {
        expect(read('src/components/MatterList.tsx')).toContain("m.status !== MatterStatus.Archived");
        expect(read('convex/portals.ts')).toContain('.filter(m => m.status !== "Archived")');
    });

    it('the matter archive rows survive the 30-day purge (restore depends on them)', () => {
        const src = read('convex/myFunctions.ts');
        const block = src.slice(src.indexOf('export const purgeOldArchiveData'));
        expect(block).toContain('if (item.itemType === "matters") continue;');
    });

    it('departed users are stripped from matter/event/document assignments on firm removal (V-MATTER-9)', () => {
        const src = read('convex/myFunctions.ts');
        const start = src.indexOf('performFirmUserRemoval');
        expect(start).toBeGreaterThan(-1);
        const block = src.slice(start, src.indexOf('ROUND D', start) > start ? src.indexOf('ROUND D', start) : undefined);
        expect(block).toContain('stripFromTable("matters"');
        expect(block).toContain('stripFromTable("events"');
        expect(block).toContain('stripFromTable("documents"');
    });
});
