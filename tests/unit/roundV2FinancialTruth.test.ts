/**
 * roundV2FinancialTruth.test.ts — V2: VEGA FINANCIAL TRUTH AND INTEGRITY.
 * Real-handler tests for every acceptance scenario in the round brief,
 * plus the client-mirror equivalence contract and source contracts for the
 * frontend integration points.
 * ─────────────────────────────────────────────────────────────────────────
 * Findings under test (V0 audit → V2 brief):
 *   V-FIN-2/15  VAT silently zero in generate-from-matter + the
 *               percentage-vs-fraction ambiguity → the ONE tax contract,
 *               enforced server-side on every invoice write path.
 *   V-FIN-6     collision-prone client-side invoice numbering → atomic
 *               per-firm financial_counters sequence.
 *   V-FIN-3/4/5 retainer auto-billing: fake review window, "Sent" claimed
 *               with no email, catch-up flooding → pending-review state
 *               machine, honest delivery states, catch-up clamp.
 *   V-FIN-8/13  trust ledger: no idempotency, float balances, unsafe
 *               offline replay → idempotency keys, kobo arithmetic,
 *               explicit audited reversals.
 *   V-FIN-7/9   payment truth: fake credit-note/receipt promises, no
 *               partial payments → audited record/revert, truthful
 *               'Partially Paid' transitions.
 *   V-FIN-1     portal financials: ghost-field totals (₦0 forever) +
 *               incompatible invoice/matter identifiers → dual-convention
 *               resolution + the server-computed summary.
 *   V-FIN-10    reporting formula drift → one contract everywhere
 *               (mirror-equivalence + source contracts).
 *
 * Every handler test drives the REAL exported handler against the
 * fixture-backed ctx (the V1-A/V1-B/V1-C harness) — no mocks of the code
 * under test.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── The code under test: real handlers + the contract (server canon) ───────
import { createItem, updateItem } from '../../convex/myFunctions';
import { recordTrustTransaction, reverseTrustTransaction, getTrustBalance } from '../../convex/trustAccount';
import { recordInvoicePayment, revertInvoicePayment } from '../../convex/financialIntegrity';
import { getClientInvoices, getClientFinancialSummary } from '../../convex/portals';
import {
    scanMattersForRetainerCycle,
    advanceStagedOutbox,
    approveAndSendNow,
    createInvoiceFromOutbox,
    RETAINER_REVIEW_WINDOW_MS,
} from '../../convex/retainerBilling';
import { hashSessionToken } from '../../convex/sessions';
import * as serverContract from '../../convex/invoiceFinancials';

// ── The client mirror (drift-tested) ────────────────────────────────────────
import * as clientMirror from '../../src/utils/invoiceFinancials';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolvePath(here, '../..');
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed ctx (the established V1 harness) ─────────────────────────
type Row = Record<string, any>;

function makeCtx(fix: { tables?: Record<string, Row[]> } = {}) {
    const tables: Record<string, Row[]> = {
        sessions: [],
        users: [],
        contacts: [],
        matters: [],
        documents: [],
        invoices: [],
        invoice_outbox: [],
        financial_counters: [],
        financial_audit_log: [],
        trust_transactions: [],
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
                const q: any = { field: (f: any) => f, eq: (f: any, v: any) => { conds.push([String(f), v]); return q; } };
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
        runMutation: vi.fn(async (fn: any, args: any) => (fn as any)._handler(ctx, args)),
        runAction: vi.fn(async (fn: any, args: any) => {
            // The email gateway stub — configured per-test via ctx.__emailResult.
            if (ctx.__emailResult !== undefined) return ctx.__emailResult;
            return { success: true, simulated: true, error: 'not configured' };
        }),
        runQuery: vi.fn(async (fn: any, args: any) => (fn as any)._handler(ctx, args)),
        scheduler: { runAfter: vi.fn(async () => null) },
        auth: { getUserIdentity: async () => null },
        __emailResult: undefined as any,
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

// ── World: firm-1 (Vega legal, VAT 7.5% stored as legacy fraction 0.075) ───
const ADMIN: Row = { _id: 'u-admin-1', email: 'admin@example.com', tokenIdentifier: 'admin@example.com', name: 'Ada Admin', role: 'Admin', firmId: 'firm-1' };
const LAWYER: Row = { _id: 'u-lawyer-1', email: 'lawyer@example.com', tokenIdentifier: 'lawyer@example.com', name: 'Bola Lawyer', role: 'Lawyer', firmId: 'firm-1' };
const CLIENT_A: Row = { _id: 'u-client-1', email: 'client@example.com', tokenIdentifier: 'client@example.com', name: 'Chidi Client', role: 'Client', firmId: 'firm-1' };
const FIRM: Row = { _id: 'firm-1', id: 'firm-1', name: 'Avery & Jarvis', taxSettings: { vatRate: 0.075 }, subscriptionPlan: 'Growth', product: 'legal' };
// The client's contact row carries BOTH id shapes (the split-brain world):
// _id (Convex) AND id (custom uuid) — matters exist keyed on EACH convention.
const CONTACT_A: Row = { _id: 'contact-1', id: 'cust-contact-1', firmId: 'firm-1', userId: 'u-client-1', email: 'client@example.com', name: 'Chidi Client', category: 'Client' };
// M_BY_CONVEX keys on the contact's CONVEX _id; M_BY_CUSTOM keys on the
// contact's CUSTOM id (the app-forms convention) — V-FIN-1 fixtures.
const M_BY_CONVEX: Row = { _id: 'matter-1', id: 'cust-matter-1', firmId: 'firm-1', clientId: 'contact-1', title: 'Contract Review', status: 'Active', stage: 'Drafting', type: 'Corporate' };
const M_BY_CUSTOM: Row = { _id: 'matter-2', id: 'cust-matter-2', firmId: 'firm-1', clientId: 'cust-contact-1', title: 'Estate Probate', status: 'Active', stage: 'Pleadings', type: 'Probate' };

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

function makeWorld(overrides: Record<string, Row[]> = {}) {
    const tables: Record<string, Row[]> = {
        users: [ADMIN, LAWYER, CLIENT_A],
        firms: [FIRM],
        sessions: [
            sessionRow('tok-admin', 'u-admin-1'),
            sessionRow('tok-lawyer', 'u-lawyer-1'),
            sessionRow('tok-a', 'u-client-1'),
        ],
        contacts: [CONTACT_A],
        matters: [M_BY_CONVEX, M_BY_CUSTOM],
        invoices: [],
        invoice_outbox: [],
        financial_counters: [],
        financial_audit_log: [],
        trust_transactions: [],
        clientMessages: [],
        ...overrides,
    };
    // Deep-clone every fixture row: handlers under test MUTATE rows (the
    // retainer scan patches matters; fences patch invoices) and the
    // module-level fixtures must stay pristine across tests.
    const cloned = Object.fromEntries(
        Object.entries(tables).map(([k, rows]) => [k, (rows as Row[]).map((r) => structuredClone(r))])
    );
    return makeCtx({ tables: cloned });
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE TAX CONTRACT (V-FIN-2 / V-FIN-15) — server-authoritative on create
// ═══════════════════════════════════════════════════════════════════════════
describe('V2 — invoice tax contract through the REAL createItem handler', () => {
    const baseInvoice = (extra: any = {}) => ({
        table: 'invoices',
        data: {
            id: `inv-${Math.random().toString(36).slice(2)}`,
            client: { id: 'cust-contact-1', name: 'Chidi Client' },
            matter: { id: 'cust-matter-1', title: 'Contract Review' },
            lineItems: [
                { id: 'li-1', description: 'Drafting', hours: 2, rate: 50000, total: 100000 },
                { id: 'li-2', description: 'Filing', hours: 0, rate: 0, total: 25000.5 },
            ],
            status: 'Unpaid',
            issueDate: '2026-11-11',
            dueDate: '2026-12-11',
            ...extra,
        },
        userEmail: 'lawyer@example.com',
        sessionToken: 'tok-lawyer',
    });

    async function createInvoice(ctx: any, extra: any = {}) {
        await (createItem as any)._handler(ctx, baseInvoice(extra));
        return ctx.__tables.invoices[ctx.__tables.invoices.length - 1];
    }

    it('VAT-INCLUSIVE: the server computes VAT from line items at the firm rate — client-passed totals are hints (V-FIN-2/15)', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        // The legacy caller sends fraction-math totals (the pre-V2 bug shape:
        // the firm stored 0.075; the old code produced subTotal×0.075 = ₦9,378
        // on a ₦125,000.5 fee — and the generate path sent NO applicable flag
        // at all, zeroing VAT). The client ALSO tries to claim a wrong total.
        const inv = await createInvoice(ctx, {
            taxApplicable: true,
            taxAmount: 9378,          // wrong (fraction math)
            total_amount: 999999,     // wrong (client-authoritative attempt)
            subTotal: 999999,
        });
        // Server truth: subTotal 125,000.50 + VAT 7.5% (9,375.04 kobo-exact)
        expect(inv.subTotal).toBe(125000.5);
        expect(inv.taxRate).toBe(7.5);                       // PERCENT, persisted
        expect(inv.taxApplicable).toBe(true);
        expect(inv.taxAmount).toBe(9375.04);
        expect(inv.total_amount).toBe(134375.54);
        expect(inv.total_amount).not.toBe(999999);           // client value rejected
    });

    it('VAT-EXCLUSIVE (non-taxable): taxApplicable=false → no VAT, and the flag is persisted as the financial statement', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        const inv = await createInvoice(ctx, { taxApplicable: false });
        expect(inv.taxAmount).toBe(0);
        expect(inv.taxApplicable).toBe(false);
        expect(inv.taxRate).toBe(0);
        expect(inv.total_amount).toBe(inv.subTotal);
    });

    it('ZERO-RATED vs NON-TAXABLE are distinct statements: rate 0 with applicable=true persists taxRate 0 (V-FIN-15)', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        const inv = await createInvoice(ctx, { taxApplicable: true, taxRate: 0 });
        expect(inv.taxApplicable).toBe(true);
        expect(inv.taxRate).toBe(0);      // explicit zero-rating — never defaulted to 7.5
        expect(inv.taxAmount).toBe(0);
    });

    it('WITHHOLDING TAX is computed on the fee and persisted (withholdingAmount / netReceivable)', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        const inv = await createInvoice(ctx, { taxApplicable: false, withholdingApplicable: true, withholdingRate: 10 });
        expect(inv.withholdingApplicable).toBe(true);
        expect(inv.withholdingRate).toBe(10);               // percent
        expect(inv.withholdingAmount).toBe(12500.05);       // 10% of the fee, kobo-exact
        expect(inv.netReceivable).toBe(125000.5 - 12500.05);
        expect(inv.total_amount).toBe(125000.5);            // WHT does not reduce the invoice total
    });

    it('legacy inference: a caller that computed VAT (taxAmount > 0) but sent no flags keeps VAT — at the NORMALIZED rate', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        // The pre-V2 manual form on a fraction-storing firm: taxAmount came
        // out as subTotal × 0.075 — the fence infers VAT applies and applies
        // it at the correct 7.5%.
        const inv = await createInvoice(ctx, { taxAmount: 9375.04 });
        expect(inv.taxApplicable).toBe(true);
        expect(inv.taxRate).toBe(7.5);
        expect(inv.taxAmount).toBe(9375.04);
    });

    it('EDITED invoices recompute with the same rules — one calculation for manual, generated and edited (V-FIN-15)', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        const inv = await createInvoice(ctx, { taxApplicable: true });
        const before = inv.total_amount;
        await (updateItem as any)._handler(ctx, {
            table: 'invoices',
            id: inv.id,
            data: { lineItems: [{ id: 'li-9', description: 'Heavier drafting', hours: 3, rate: 50000, total: 150000 }] },
            userEmail: 'lawyer@example.com',
            sessionToken: 'tok-lawyer',
        });
        expect(inv.subTotal).toBe(150000);
        expect(inv.taxAmount).toBe(11250);          // 7.5% of the NEW fee
        expect(inv.total_amount).toBe(161250);
        expect(inv.total_amount).not.toBe(before);
        // The audited edit was snapshotted.
        expect(tables.financial_audit_log.length).toBeGreaterThanOrEqual(1);
    });

    it('client attempts to write amountPaid through the generic path are stripped — payments enter only via the audited lifecycle', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        const inv = await createInvoice(ctx, {});
        await (updateItem as any)._handler(ctx, {
            table: 'invoices',
            id: inv.id,
            data: { amountPaid: 99999 },
            userEmail: 'lawyer@example.com',
            sessionToken: 'tok-lawyer',
        });
        expect(inv.amountPaid).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. CONCURRENT-SAFE NUMBERING (V-FIN-6)
// ═══════════════════════════════════════════════════════════════════════════
describe('V2 — atomic per-firm invoice numbering through the REAL handler', () => {
    it('two creations in the same instant receive DISTINCT sequential numbers (the client-side count+1 generator collided)', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        const mk = () => (createItem as any)._handler(ctx, {
            table: 'invoices',
            data: {
                id: `inv-${Math.random().toString(36).slice(2)}`,
                client: { id: 'cust-contact-1', name: 'Chidi Client' },
                matter: { id: 'cust-matter-1', title: 'Contract Review' },
                lineItems: [{ id: 'li-1', description: 'Fee', total: 10000 }],
                status: 'Unpaid',
            },
            userEmail: 'lawyer@example.com',
            sessionToken: 'tok-lawyer',
        });
        await mk(); await mk(); await mk();
        const numbers = tables.invoices.map((i) => i.invoiceNumber);
        expect(new Set(numbers).size).toBe(3);                       // all distinct
        expect(numbers).toEqual(['INV-AJAA-0001', 'INV-AJAA-0002', 'INV-AJAA-0003']); // sequential, firm-branded format preserved (solo-initials + lead)
        // The counter row (not the invoice count) is the sequence authority.
        const counter = tables.financial_counters.find((c) => c.scope === 'invoices');
        expect(counter!.value).toBe(3);
    });

    it('the sequence CONTINUES the firm’s legacy client-generated numbers (max ≤4-digit suffix + 1)', async () => {
        const { ctx, tables } = makeWorld({
            invoices: [
                { _id: 'seed-1', id: 'seed-1', firmId: 'firm-1', invoiceNumber: 'INV-AJ-0007', status: 'Paid', lineItems: [] },
                { _id: 'seed-2', id: 'seed-2', firmId: 'firm-1', invoiceNumber: 'INV-AJ-0009', status: 'Paid', lineItems: [] },
                // 6-digit retainer junk must NOT seed the human sequence:
                { _id: 'seed-3', id: 'seed-3', firmId: 'firm-1', invoiceNumber: 'INV-RET-531234', status: 'Paid', lineItems: [] },
            ],
        });
        (ctx as any).__tables = tables;
        await (createItem as any)._handler(ctx, {
            table: 'invoices',
            data: { id: 'new-1', lineItems: [{ id: 'li-1', description: 'Fee', total: 100 }], status: 'Unpaid' },
            userEmail: 'lawyer@example.com',
            sessionToken: 'tok-lawyer',
        });
        expect(tables.invoices[tables.invoices.length - 1].invoiceNumber).toBe('INV-AJAA-0010');
    });

    it('a manual number EDIT that collides with another firm invoice is rejected', async () => {
        const { ctx, tables } = makeWorld();
        (ctx as any).__tables = tables;
        const mk = async (id: string) => (createItem as any)._handler(ctx, {
            table: 'invoices',
            data: { id, lineItems: [{ id: 'li-1', description: 'Fee', total: 100 }], status: 'Unpaid' },
            userEmail: 'lawyer@example.com',
            sessionToken: 'tok-lawyer',
        });
        await mk('a-1'); await mk('a-2');
        const second = tables.invoices[1];
        await expect((updateItem as any)._handler(ctx, {
            table: 'invoices',
            id: second.id,
            data: { invoiceNumber: tables.invoices[0].invoiceNumber },
            userEmail: 'lawyer@example.com',
            sessionToken: 'tok-lawyer',
        })).rejects.toThrow(/already used/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. RETAINER SCHEDULING + CATCH-UP (V-FIN-3/4/5) — real internal handlers
// ═══════════════════════════════════════════════════════════════════════════
describe('V2 — retainer scheduling: honest review window + catch-up clamp', () => {
    const OLD_MATTER: Row = {
        _id: 'matter-old', id: 'cust-matter-old', firmId: 'firm-1', clientId: 'cust-contact-1',
        title: 'Ancient Retainer', status: 'Active', billingModel: 'Retainer',
        retainerAutoBillingEnabled: true, billingFrequency: 'Monthly',
        fixedFeeAmount: 100000,
        // nextBillingDate 8 MONTHS in the past — the flood scenario:
        nextBillingDate: new Date(Date.now() - 240 * 86400000).toISOString(),
        createdAt: new Date(Date.now() - 300 * 86400000).toISOString(),
    };

    it('a scan of a long-overdue matter stages AT MOST ONE entry and clamps nextBillingDate into the future (V-FIN-4)', async () => {
        const { ctx, tables } = makeWorld({ matters: [M_BY_CONVEX, M_BY_CUSTOM, OLD_MATTER] });
        const res = await (scanMattersForRetainerCycle as any)._handler(ctx, {});
        expect(res.stagedCount).toBe(1);                       // ONE catch-up invoice, not eight
        expect(tables.invoice_outbox.length).toBe(1);
        const entry = tables.invoice_outbox[0];
        expect(entry.state).toBe('Staged');                    // pending review
        expect(entry.reviewDueBy).toBeDefined();               // the honest review deadline
        // The matter's next billing date is now in the FUTURE — repeated
        // cron ticks can never stage a second catch-up.
        const after = tables.matters.find((m) => m._id === 'matter-old');
        expect(new Date(after!.nextBillingDate).getTime()).toBeGreaterThan(Date.now());
        // A second scan stages NOTHING more.
        const res2 = await (scanMattersForRetainerCycle as any)._handler(ctx, {});
        expect(res2.stagedCount).toBe(0);
        expect(tables.invoice_outbox.length).toBe(1);
    });

    it('the staged entry is PENDING REVIEW: the 15-minute cron does NOT auto-issue it (V-FIN-3)', async () => {
        const { ctx, tables } = makeWorld({ matters: [M_BY_CONVEX, M_BY_CUSTOM, OLD_MATTER] });
        await (scanMattersForRetainerCycle as any)._handler(ctx, {});
        await (advanceStagedOutbox as any)._handler(ctx, {});   // what the cron now does
        await (advanceStagedOutbox as any)._handler(ctx, {});
        expect(tables.invoice_outbox[0].state).toBe('Staged');  // STILL staged — no lawyer approval, no issue
        expect(tables.invoices.length).toBe(0);                 // no invoice was created
    });

    it('the staged totals follow the ONE tax contract at the firm rate (V-FIN-15 in the retainer path)', async () => {
        const { ctx, tables } = makeWorld({ matters: [M_BY_CONVEX, M_BY_CUSTOM, OLD_MATTER] });
        await (scanMattersForRetainerCycle as any)._handler(ctx, {});
        const entry = tables.invoice_outbox[0];
        expect(entry.subTotal).toBe(100000);
        expect(entry.taxAmount).toBe(7500);                     // 7.5% — kobo-exact, from the firm setting
        expect(entry.totalAmount).toBe(107500);
    });

    it('approval is the ONLY path to issue: approveAndSendNow → invoice created with a server number; "Sent" ONLY when the gateway confirms (V-FIN-3)', async () => {
        const { ctx, tables } = makeWorld({ matters: [M_BY_CONVEX, M_BY_CUSTOM, OLD_MATTER] });
        await (scanMattersForRetainerCycle as any)._handler(ctx, {});
        const entry = tables.invoice_outbox[0];

        await (approveAndSendNow as any)._handler(ctx, { outboxId: entry._id, sessionToken: 'tok-admin' });
        expect(entry.state).toBe('Queued');
        expect(entry.approvedAt).toBeDefined();
        expect(entry.approvedBy).toBe('u-admin-1');

        // Delivery with NO gateway configured (simulated) → Issued + not_emailed.
        // "Sent" is NOT claimed — the pre-V2 code marked Sent with zero email.
        await (createInvoiceFromOutbox as any)._handler(ctx, { outboxId: entry._id });
        expect(tables.invoices.length).toBe(1);
        const inv = tables.invoices[0];
        expect(inv.invoiceNumber).toMatch(/^INV-[A-Z]+-\d{4}$/);    // server-issued sequence, not INV-RET-<junk>
        expect(inv.status).toBe('Unpaid');                      // issued but not delivered
        expect(inv.total_amount).toBe(107500);                  // authoritative recompute at issue
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. TRUST LEDGER (V-FIN-8 / V-FIN-13) — real handlers
// ═══════════════════════════════════════════════════════════════════════════
describe('V2 — trust ledger: idempotency, kobo arithmetic, reversals', () => {
    const deposit = (ctx: any, overrides: any = {}) =>
        (recordTrustTransaction as any)._handler(ctx, {
            type: 'deposit', amount: 100000, matterId: 'matter-1', clientName: 'Chidi Client',
            description: 'Retainer deposit', userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
            ...overrides,
        });

    it('DUPLICATE SUBMISSIONS with the same idempotency key book ONCE — the replay returns the original (V-FIN-8)', async () => {
        const { ctx, tables } = makeWorld();
        const first = await deposit(ctx, { idempotencyKey: 'trust:key-1' });
        expect(first.duplicate).toBe(false);
        const replay = await deposit(ctx, { idempotencyKey: 'trust:key-1' });
        expect(replay.duplicate).toBe(true);
        expect(replay.transactionId).toBe(first.transactionId);
        expect(tables.trust_transactions.length).toBe(1);      // exactly one row
    });

    it('OFFLINE REPLAY is safe: the queue-key shape (offline:<itemId>) replays to the same single row (V-FIN-13)', async () => {
        const { ctx, tables } = makeWorld();
        await deposit(ctx, { idempotencyKey: 'offline:offline_1234_abc' });
        await deposit(ctx, { idempotencyKey: 'offline:offline_1234_abc' });  // the retry after a mid-replay reload
        await deposit(ctx, { idempotencyKey: 'offline:offline_1234_abc' });  // the 30s periodic retry
        expect(tables.trust_transactions.length).toBe(1);
        // And a DIFFERENT key (a genuinely new action) books normally.
        await deposit(ctx, { idempotencyKey: 'offline:offline_9999_xyz' });
        expect(tables.trust_transactions.length).toBe(2);
    });

    it('KOBO ARITHMETIC: 0.1 + 0.2 style fixtures sum exactly — no float drift in balances (V-FIN-13)', async () => {
        const { ctx } = makeWorld();
        await (recordTrustTransaction as any)._handler(ctx, {
            type: 'deposit', amount: 0.1, matterId: 'matter-1', clientName: 'Chidi Client',
            description: 'a', userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        await (recordTrustTransaction as any)._handler(ctx, {
            type: 'deposit', amount: 0.2, matterId: 'matter-1', clientName: 'Chidi Client',
            description: 'b', userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        const balance = await (getTrustBalance as any)._handler(ctx, {
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(balance).toBe(0.3);                             // NOT 0.30000000000000004
    });

    it('INSUFFICIENT BALANCE: a withdrawal beyond the matter balance is rejected — and the recorded rows stay exact', async () => {
        const { ctx, tables } = makeWorld();
        await deposit(ctx, {});
        await expect((recordTrustTransaction as any)._handler(ctx, {
            type: 'withdrawal', amount: 100001, matterId: 'matter-1',
            description: 'overdraft attempt', userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        })).rejects.toThrow(/Insufficient trust balance for this matter/);
        expect(tables.trust_transactions.length).toBe(1);
    });

    it('EXPLICIT REVERSAL: a contra entry is booked, the original is marked (never edited), and both are audited (V-FIN-8)', async () => {
        const { ctx, tables } = makeWorld();
        const dep = await deposit(ctx, {});
        const before = { ...tables.trust_transactions[0] };

        const rev = await (reverseTrustTransaction as any)._handler(ctx, {
            transactionId: dep.transactionId, reason: 'Wrong matter — re-entered correctly',
            userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        });
        expect(rev.success).toBe(true);

        const rows = tables.trust_transactions;
        expect(rows.length).toBe(2);                            // original + contra — nothing deleted
        const original = rows.find((r) => String(r._id) === String(dep.transactionId))!;
        const contra = rows.find((r) => r.type === 'reversal')!;
        // The original keeps every field, gains only the reversal markers:
        for (const field of ['amount', 'type', 'description', 'matterId', 'createdAt']) {
            expect(original[field]).toEqual(before[field]);
        }
        expect(original.reversedAt).toBeDefined();
        expect(contra.reversalOf).toBe(String(dep.transactionId));
        expect(contra.amount).toBe(100000);
        // Net balance is zero:
        const balance = await (getTrustBalance as any)._handler(ctx, {
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(balance).toBe(0);
        // The reversal is in the append-only audit log:
        const audit = tables.financial_audit_log.find((a) => a.action === 'reverse');
        expect(audit).toBeDefined();
        expect(audit!.reason).toBe('Wrong matter — re-entered correctly');
        // Double reversal is refused:
        await expect((reverseTrustTransaction as any)._handler(ctx, {
            transactionId: dep.transactionId, reason: 'trying again',
            userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        })).rejects.toThrow(/already been reversed/);
    });

    it('the concurrency anchor exists: every trust write patches the firm’s trust counter row (the OCC serializer)', async () => {
        const { ctx, tables } = makeWorld();
        await deposit(ctx, {});
        await deposit(ctx, {});
        const counter = tables.financial_counters.find((c) => c.scope === 'trust');
        expect(counter).toBeDefined();
        expect(counter!.value).toBe(2);                         // patched once per write
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. INVOICE PAYMENTS + REVERSALS (V-FIN-7 / V-FIN-9) — real handlers
// ═══════════════════════════════════════════════════════════════════════════
describe('V2 — truthful payment recording and reversal', () => {
    async function seedInvoice(ctx: any, tables: Record<string, Row[]>) {
        (ctx as any).__tables = tables;
        await (createItem as any)._handler(ctx, {
            table: 'invoices',
            data: {
                id: 'pay-inv-1', client: { id: 'cust-contact-1', name: 'Chidi Client' },
                matter: { id: 'cust-matter-1', title: 'Contract Review' },
                lineItems: [{ id: 'li-1', description: 'Fees', total: 200000 }],
                status: 'Unpaid',
            },
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        return tables.invoices[0];
    }

    it('PARTIAL PAYMENT: status becomes Partially Paid, amountPaid persists, outstanding is the true remainder', async () => {
        const { ctx, tables } = makeWorld();
        const inv = await seedInvoice(ctx, tables);
        const res = await (recordInvoicePayment as any)._handler(ctx, {
            invoiceId: inv.id, amount: 50000, paymentMethod: 'bank_transfer', reference: 'TRF-889',
            userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        });
        expect(res.status).toBe('Partially Paid');
        expect(res.amountPaid).toBe(50000);
        expect(res.outstanding).toBe(150000);
        expect(inv.status).toBe('Partially Paid');
        expect(inv.amountPaid).toBe(50000);
        expect(inv.paidDate).toBeUndefined();                   // NOT paid yet
        // The recording is audited:
        const audit = tables.financial_audit_log.find((a) => a.action === 'record_payment');
        expect(audit!.metadata.previousStatus).toBe('Unpaid');
        expect(audit!.metadata.outstandingAfter).toBe(150000);
    });

    it('the SECOND partial payment settles to Paid with paidDate — kobo-exact accumulation', async () => {
        const { ctx, tables } = makeWorld();
        const inv = await seedInvoice(ctx, tables);
        await (recordInvoicePayment as any)._handler(ctx, { invoiceId: inv.id, amount: 50000, userEmail: 'admin@example.com', sessionToken: 'tok-admin' });
        const res = await (recordInvoicePayment as any)._handler(ctx, { invoiceId: inv.id, amount: 150000, userEmail: 'admin@example.com', sessionToken: 'tok-admin' });
        expect(res.status).toBe('Paid');
        expect(res.amountPaid).toBe(200000);
        expect(res.outstanding).toBe(0);
        expect(inv.status).toBe('Paid');
        expect(inv.paidDate).toBeDefined();
    });

    it('OVERPAYMENT is rejected with guidance — an excess is never silently absorbed', async () => {
        const { ctx, tables } = makeWorld();
        const inv = await seedInvoice(ctx, tables);
        await expect((recordInvoicePayment as any)._handler(ctx, {
            invoiceId: inv.id, amount: 200001, userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        })).rejects.toThrow(/exceeds the invoice total/);
    });

    it('INVOICE REVERSAL (payment revert): audited, requires a reason, returns the invoice to open with amountPaid cleared — no credit-note pretence', async () => {
        const { ctx, tables } = makeWorld();
        const inv = await seedInvoice(ctx, tables);
        await (recordInvoicePayment as any)._handler(ctx, { invoiceId: inv.id, amount: 200000, userEmail: 'admin@example.com', sessionToken: 'tok-admin' });
        expect(inv.status).toBe('Paid');

        await expect((revertInvoicePayment as any)._handler(ctx, {
            invoiceId: inv.id, reason: 'no', userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        })).rejects.toThrow(/reason is required/i);              // min-length reason enforced

        const res = await (revertInvoicePayment as any)._handler(ctx, {
            invoiceId: inv.id, reason: 'Payment recorded on the wrong invoice', userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        });
        expect(res.success).toBe(true);
        expect(inv.status).toBe('Unpaid');
        expect(inv.amountPaid).toBeUndefined();
        expect(inv.paidDate).toBeUndefined();
        const audit = tables.financial_audit_log.filter((a) => a.action === 'revert_payment');
        expect(audit.length).toBe(1);
        expect(audit[0]!.metadata.previousStatus).toBe('Paid');
    });

    it('voided invoices cannot receive payments', async () => {
        const { ctx, tables } = makeWorld();
        const inv = await seedInvoice(ctx, tables);
        inv.recordStatus = 'voided';
        await expect((recordInvoicePayment as any)._handler(ctx, {
            invoiceId: inv.id, amount: 1, userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        })).rejects.toThrow(/voided/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. CLIENT OUTSTANDING BALANCES (V-FIN-1) — real handlers, both id conventions
// ═══════════════════════════════════════════════════════════════════════════
describe('V2 — the authoritative client balance across BOTH id conventions', () => {
    function clientWorld() {
        // Representative fixtures: one matter keyed on the contact's CONVEX
        // _id, one on its CUSTOM id; invoices referencing matters by EITHER
        // the matter's _id OR its custom id; a voided + a test invoice that
        // must never count; a partially-paid invoice contributing its
        // remainder.
        const invoices: Row[] = [
            { _id: 'inv-1', id: 'ci-1', firmId: 'firm-1', invoiceNumber: 'INV-AJ-0001', status: 'Sent',
              matter: { id: 'matter-1', title: 'Contract Review' },            // matter by CONVEX _id
              lineItems: [{ total: 100000 }], subTotal: 100000, taxAmount: 7500, total_amount: 107500,
              issueDate: daysAgo(41), dueDate: daysAgo(12) },
            { _id: 'inv-2', id: 'ci-2', firmId: 'firm-1', invoiceNumber: 'INV-AJ-0002', status: 'Unpaid',
              matterId: 'matter-2',                                            // matter by CONVEX _id, field form
              lineItems: [{ total: 50000 }], subTotal: 50000, taxAmount: 0, total_amount: 50000,
              issueDate: daysAgo(27), dueDate: daysAgo(12) },
            { _id: 'inv-3', id: 'ci-3', firmId: 'firm-1', invoiceNumber: 'INV-AJ-0003', status: 'Partially Paid',
              matter: { id: 'cust-matter-2', title: 'Estate Probate' },        // matter by CUSTOM id
              lineItems: [{ total: 80000 }], subTotal: 80000, taxAmount: 0, total_amount: 80000, amountPaid: 30000,
              issueDate: daysAgo(32), dueDate: inDays(19) },
            { _id: 'inv-4', id: 'ci-4', firmId: 'firm-1', invoiceNumber: 'INV-AJ-0004', status: 'Paid',
              matter: { id: 'cust-matter-1', title: 'Contract Review' },
              lineItems: [{ total: 10000 }], subTotal: 10000, taxAmount: 0, total_amount: 10000,
              paidDate: daysAgo(27), issueDate: daysAgo(41), dueDate: daysAgo(37) },
            { _id: 'inv-5', id: 'ci-5', firmId: 'firm-1', invoiceNumber: 'INV-AJ-0005', status: 'Void',
              recordStatus: 'voided', matter: { id: 'cust-matter-1' },
              lineItems: [{ total: 999999 }], total_amount: 999999, issueDate: daysAgo(41), dueDate: daysAgo(41) },
            { _id: 'inv-6', id: 'ci-6', firmId: 'firm-1', invoiceNumber: 'INV-AJ-0006', status: 'Sent',
              recordStatus: 'test', matter: { id: 'cust-matter-2' },
              lineItems: [{ total: 777777 }], total_amount: 777777, issueDate: daysAgo(41), dueDate: daysAgo(41) },
        ];
        return makeWorld({ invoices });
    }

    it('getClientInvoices resolves BOTH contact conventions and BOTH matter conventions (V-FIN-1 fixtures)', async () => {
        const { ctx, tables } = clientWorld();
        (ctx as any).__tables = tables;
        // The client passes their CONTACT _id; their matters hold BOTH shapes.
        const rows = await (getClientInvoices as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        });
        const ids = rows.map((r: any) => String(r._id)).sort();
        // All four live invoices deliver (voided + test quarantined), across
        // every id-convention combination in the fixtures.
        expect(ids).toEqual(['inv-1', 'inv-2', 'inv-3', 'inv-4']);
        // Each row carries the SERVER-computed outstanding (the portal never
        // recomputes money):
        const inv3 = rows.find((r: any) => String(r._id) === 'inv-3');
        expect(inv3.outstanding).toBe(50000);                   // 80,000 − 30,000 recorded
        expect(inv3.amountPaid).toBe(30000);
        // Payment instructions are the 3-field projection:
        expect(Object.keys(rows[0].paymentDetails ?? {}).every((k) => ['bankName', 'accountNumber', 'accountName'].includes(k))).toBe(true);
    });

    it('getClientFinancialSummary — the ONE server-computed balance the portal surfaces render', async () => {
        const { ctx, tables } = clientWorld();
        (ctx as any).__tables = tables;
        const summary = await (getClientFinancialSummary as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'contact-1', sessionToken: 'tok-a',
        });
        // open = inv-1 (107,500) + inv-2 (50,000) + inv-3 remainder (50,000)
        expect(summary.outstandingBalance).toBe(207500);
        expect(summary.openInvoiceCount).toBe(3);
        expect(summary.paidTotal).toBe(10000);
        // inv-1 and inv-2 are past due; inv-3 is still within its window:
        expect(summary.overdueBalance).toBe(157500);
    });

    it('the same summary when the client passes their CUSTOM contact id (the app-forms convention)', async () => {
        const { ctx, tables } = clientWorld();
        (ctx as any).__tables = tables;
        const summary = await (getClientFinancialSummary as any)._handler(ctx, {
            firmId: 'firm-1', contactId: 'cust-contact-1', sessionToken: 'tok-a',
        });
        expect(summary.outstandingBalance).toBe(207500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. CROSS-SURFACE RECONCILIATION (V-FIN-10) — mirror equivalence + contracts
// ═══════════════════════════════════════════════════════════════════════════
describe('V2 — one contract on every surface (mirror equivalence + source contracts)', () => {
    const rateCases: Array<[number | undefined, number]> = [
        [undefined, 7.5], [0, 0], [0.075, 7.5], [7.5, 7.5], [10, 10], [0.5, 50], [5, 5],
    ];
    it('normalizeTaxRate: server canon === client mirror on the full input matrix', () => {
        for (const [raw, expected] of rateCases) {
            expect(clientMirror.normalizeTaxRate(raw)).toBe(expected);
            expect(serverContract.normalizeTaxRate(raw)).toBe(expected);
        }
        expect(() => serverContract.normalizeTaxRate(-1)).toThrow();
        expect(() => clientMirror.normalizeTaxRate(-1)).toThrow();
    });

    it('computeInvoiceTotals: server canon === client mirror, kobo-exact', () => {
        const items = [{ total: 100000 }, { total: 25000.5 }, { hours: 2, rate: 1250.33 }, { total: 0 }];
        for (const tax of [{ applicable: true, ratePct: 7.5 }, { applicable: false, ratePct: 0 }, { applicable: true, ratePct: 0 }]) {
            for (const wht of [{ applicable: true, ratePct: 10 }, { applicable: false, ratePct: 0 }]) {
                expect(clientMirror.computeInvoiceTotals(items, tax, wht)).toEqual(serverContract.computeInvoiceTotals(items, tax, wht));
            }
        }
        // The canonical VAT case: (100,000 + 25,000.50 + 2×1,250.33) = 127,501.16
        // × 7.5% = 9,562.59 — rounded once, in kobo.
        expect(serverContract.computeInvoiceTotals(items, { applicable: true, ratePct: 7.5 }).taxAmount).toBe(9562.59);
    });

    it('invoiceTotalAmount / invoiceOutstanding / summary: canon === mirror on the V-FIN-1 fixture corpus', () => {
        const corpus = [
            { status: 'Sent', total_amount: 107500, subTotal: 100000, taxAmount: 7500, dueDate: daysAgo(12), lineItems: [{ total: 100000 }] },
            { status: 'Unpaid', total_amount: 50000, dueDate: daysAgo(12), lineItems: [{ total: 50000 }] },
            { status: 'Partially Paid', total_amount: 80000, amountPaid: 30000, dueDate: inDays(19), lineItems: [{ total: 80000 }] },
            { status: 'Paid', total_amount: 10000, paidDate: daysAgo(27), lineItems: [{ total: 10000 }] },
            { status: 'Void', recordStatus: 'voided', total_amount: 999999, lineItems: [] },
            { status: 'Sent', recordStatus: 'test', total_amount: 777777, lineItems: [] },
            // A TRUE ₦0 total must not fall back to subTotal (the pre-V2
            // total_amount-or-subTotal bug):
            { status: 'Sent', total_amount: 0, subTotal: 45000, taxAmount: 0, dueDate: inDays(19), lineItems: [] },
            // Legacy rows with NO persisted totals fall back through the ONE chain:
            { status: 'Sent', subTotal: 60000, taxAmount: 4500, dueDate: inDays(19), lineItems: [{ total: 60000 }] },
        ];
        for (const inv of corpus) {
            expect(clientMirror.invoiceTotalAmount(inv)).toBe(serverContract.invoiceTotalAmount(inv));
            expect(clientMirror.invoiceOutstanding(inv)).toBe(serverContract.invoiceOutstanding(inv));
        }
        const now = Date.now();
        expect(clientMirror.computeClientFinancialSummary(corpus as any, now))
            .toEqual(serverContract.computeClientFinancialSummary(corpus as any, now));
        // The ₦0-total invoice contributes ZERO (not subTotal):
        const summary = serverContract.computeClientFinancialSummary(corpus as any, now);
        expect(summary.outstandingBalance).toBe(107500 + 50000 + 50000 + 0 + 64500);
    });

    it('SOURCE CONTRACTS — the five previously-drifting surfaces use the shared helpers (no hand-rolled sums)', () => {
        const billingView = read('src/components/BillingView.tsx');
        expect(billingView).toContain("computeClientFinancialSummary(invoices as any)");
        expect(billingView).toContain('invoiceOutstanding(invoice as any)');
        expect(billingView).not.toContain('(i.total_amount || i.subTotal || 0)');   // the drifted formula is gone

        const reports = read('src/components/reports/FinancialReports.tsx');
        expect(reports).toContain('invoiceTotalAmount(i as any)');
        expect(reports).toContain('invoiceOutstanding(i as any)');
        expect(reports).not.toContain('lineItems?.reduce((s, li) => s + li.total, 0) || 0)');

        const detail = read('src/components/details/InvoiceDetailView.tsx');
        expect(detail).toContain('invoiceTotalAmount(invoice as any)');

        const contact = read('src/components/details/ContactDetailView.tsx');
        expect(contact).toContain('invoiceTotalAmount(inv)');

        // The portal renders the SERVER-computed balance — the ghost-field
        // sum (`inv.totalAmount || inv.amount`) is gone from every client surface.
        const dash = read('src/components/client/ClientDashboard.tsx');
        expect(dash).toContain('api.portals.getClientFinancialSummary');
        expect(dash).not.toContain('inv.totalAmount || inv.amount');
        const billingTab = read('src/components/client/ClientBillingTab.tsx');
        expect(billingTab).toContain('invoiceTotalAmount(inv as any)');
        expect(billingTab).not.toContain('inv.totalAmount || inv.amount');
    });

    it('SOURCE CONTRACT — the honest payment surfaces: no fake Pay Now confirmation, no simulated success', () => {
        const gateway = read('src/components/modals/PaymentGatewayModal.tsx');
        // The invoice path only confirms through a REAL report callback:
        expect(gateway).toContain('onPaymentReport');
        expect(gateway).not.toContain("setTimeout(() => {\n        setStep('confirmed');\n      }, 800)");
        expect(gateway).toContain('No payment is taken by this app');

        const useFinance = read('src/hooks/useFinance.ts');
        // The credit-note promise is gone; the audited revert is wired:
        expect(useFinance).not.toContain('create credit note');
        expect(useFinance).toContain('api.financialIntegrity.revertInvoicePayment');
        expect(useFinance).toContain('api.financialIntegrity.recordInvoicePayment');
        // The generate-from-matter path sends the explicit tax statement:
        expect(useFinance).toContain('tax?.applicable === true');

        const detail = read('src/components/details/InvoiceDetailView.tsx');
        expect(detail).not.toContain('Credit Note');
        expect(detail).not.toContain('including a receipt');

        const offlineQueue = read('src/hooks/useOfflineQueue.ts');
        expect(offlineQueue).toContain("recordTrustTransaction' && !replayArgs.idempotencyKey");
    });

    it('SOURCE CONTRACT — the retainer engine no longer claims sends it did not perform', () => {
        const engine = read('convex/retainerBilling.ts');
        expect(engine).not.toContain('simulate a successful send');
        expect(engine).toContain("simulated !== true");
        expect(engine).toContain('deliveryStatus: "not_emailed"');
        expect(engine).not.toContain('review window = 0');
        // The catch-up clamp and the enable clamp are both present:
        expect(engine).toContain('guard < 240');
        expect(engine).toContain('existingFuture');
    });

    it('SOURCE CONTRACT — the audit history is accessible in the Vega reports surface (V-FIN-14)', () => {
        const reports = read('src/components/reports/FinancialReports.tsx');
        expect(reports).toContain('api.financialIntegrity.getFinancialAuditLog');
        expect(reports).toContain('Financial Audit History');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. THE REVIEW WINDOW CONSTANT (V-FIN-3) — the honest 48h advisory
// ═══════════════════════════════════════════════════════════════════════════
describe('V2 — the retainer review window', () => {
    it('is a real 48-hour advisory window, not the pre-V2 zero', () => {
        expect(RETAINER_REVIEW_WINDOW_MS).toBe(48 * 60 * 60 * 1000);
    });
});
