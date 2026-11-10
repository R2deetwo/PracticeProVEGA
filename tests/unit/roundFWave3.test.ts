/**
 * roundFWave3.test.ts — ROUND F (Wave F3) regression tests.
 *
 * Wave F3 shipped the report suite (§5): rent roll, arrears aging, SC
 * collections, revenue by type, payment history, period comparison — every
 * figure server-computed kobo-internally — plus CSV export and the four
 * §7 acceptance pins the round was missing (failed payment, unmatched
 * payment end-to-end, payment reversal feeding the bill's adjustment line,
 * period report) and the §5 totals-vs-transactions proof.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Convex functions under test ─────────────────────────────────────────────
import { getFinancialReports } from '../../convex/financialReporting';
import { getResidentBill } from '../../convex/tenancyLifecycle';
import { voidLedgerEntry } from '../../convex/financialIntegrity';
import { updatePaymentProofStatus } from '../../convex/portals';
import { buildCsv, csvField } from '../../src/utils/csvExport';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed mock ctx (the shared F-wave harness) ─────────────────────
type Row = Record<string, any>;

interface Fixtures {
  session?: { token: string; userId: string };
  user?: Row;
  users?: Row[];
  tables?: Record<string, Row[]>;
}

const CMP: Record<string, (a: any, b: any) => boolean> = {
  eq: (a, b) => String(a) === String(b),
  neq: (a, b) => String(a) !== String(b),
  lt: (a, b) => (typeof a === 'number' && typeof b === 'number') ? a < b : String(a) < String(b),
  lte: (a, b) => (typeof a === 'number' && typeof b === 'number') ? a <= b : String(a) <= String(b),
  gt: (a, b) => (typeof a === 'number' && typeof b === 'number') ? a > b : String(a) > String(b),
  gte: (a, b) => (typeof a === 'number' && typeof b === 'number') ? a >= b : String(a) >= String(b),
};

function makeCtx(fix: Fixtures = {}, overrides: Record<string, any> = {}) {
  const callerUser = fix.user ?? null;
  const sessionRow = fix.session
    ? [{
        tokenHash: hashSessionToken(fix.session.token),
        userId: fix.session.userId,
        userEmail: 'fixture',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }]
    : [];
  const tables: Record<string, Row[]> = {
    sessions: sessionRow,
    users: [...(callerUser ? [callerUser] : []), ...(fix.users ?? [])],
    suspendedUsers: [],
    securityEvents: [],
    rateLimits: [],
    ...(fix.tables ?? {}),
  };
  const writes = { patches: [] as any[], inserts: [] as any[], deletes: [] as any[] };

  const findRows = (table: string, conds: Array<[string, string, any]>) =>
    (tables[table] ?? []).filter((r) => conds.every(([f, op, v]) => {
      const rv = r[f];
      if (rv === undefined) return false;
      return CMP[op](rv, v);
    }));

  const chainFor = (rows: Row[]) => {
    const chain: any = {
      first: async () => (rows[0] ?? null),
      unique: async () => (rows[0] ?? null),
      collect: async () => rows,
      take: async (n: number) => rows.slice(0, n),
      order: (_dir: string) => chain,
      filter: (_fn: any) => chain,
    };
    return chain;
  };

  const db: any = {
    query: (table: string) => ({
      withIndex: (_name: string, fn: (q: any) => any) => {
        const conds: Array<[string, string, any]> = [];
        const q: any = {
          eq: (field: string, value: any) => { conds.push([field, 'eq', value]); return q; },
          lt: (field: string, value: any) => { conds.push([field, 'lt', value]); return q; },
          lte: (field: string, value: any) => { conds.push([field, 'lte', value]); return q; },
          gte: (field: string, value: any) => { conds.push([field, 'gte', value]); return q; },
          gt: (field: string, value: any) => { conds.push([field, 'gt', value]); return q; },
          neq: (field: string, value: any) => { conds.push([field, 'neq', value]); return q; },
        };
        fn(q);
        return chainFor(findRows(table, conds));
      },
      filter: (_fn: any) => chainFor(tables[table] ?? []),
      order: (_dir: string) => chainFor(tables[table] ?? []),
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
      writes.inserts.push({ table, value });
      const _id = `${table}_${writes.inserts.length}`;
      (tables[table] = tables[table] ?? []).push({ _id, ...value });
      return _id as any;
    },
    patch: async (id: any, value: any) => {
      writes.patches.push({ id: String(id), value });
      const idStr = String(id);
      for (const rows of Object.values(tables)) {
        const hit = rows.find((r) => String(r._id) === idStr);
        if (hit) Object.assign(hit, value);
      }
      return null;
    },
    delete: async (id: any) => {
      writes.deletes.push(String(id));
      return null;
    },
  };

  const ctx: any = {
    db,
    runMutation: vi.fn(async (_ref: any, args: any) => {
      if (args && typeof (args as any).proofId === 'string' && typeof (args as any).source === 'string') {
        const { settleApprovedProof } = require('../../convex/portals');
        return (settleApprovedProof as any)._handler(ctx, args);
      }
      return { success: true };
    }),
    runAction: vi.fn(async () => ({ success: true })),
    runQuery: vi.fn(async () => null),
    scheduler: { runAfter: vi.fn(async () => null) },
    auth: { getUserIdentity: async () => null },
    ...overrides,
  };
  return { ctx, writes, tables };
}

// ── Standard callers ────────────────────────────────────────────────────────
const ADMIN = { _id: 'u-admin-1', email: 'admin@example.com', tokenIdentifier: 'admin@example.com', name: 'Ada Admin', role: 'Admin', firmId: 'firm-1' };
const ADMIN_SESSION = { token: 'tok-admin-xyz', userId: 'u-admin-1' };
const TENANT = { _id: 'u-tenant-1', email: 'tenant@example.com', tokenIdentifier: 'tenant@example.com', name: 'Tayo Tenant', role: 'Tenant', firmId: 'firm-1' };
const TENANT_SESSION = { token: 'tok-tenant-abc', userId: 'u-tenant-1' };

const NOW = Date.now();
// Deterministic months: this month and the previous one, both in-window.
const THIS_MONTH = new Date(NOW);
const PREV_MONTH = new Date(THIS_MONTH.getFullYear(), THIS_MONTH.getMonth() - 1, 15);
const thisKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const KEY_NOW = thisKey(THIS_MONTH);
const KEY_PREV = thisKey(PREV_MONTH);

function reportTables(extra: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    properties: [
      {
        _id: 'p1', id: 'PROP-1', firmId: 'firm-1', address: '12 Ada Road, Yaba', status: 'Occupied',
        rentalDetails: { tenantName: 'Tayo Tenant', rentAmount: 250000, rentFrequency: 'Monthly', leaseStart: '2026-08-01', unitName: 'Flat 1' },
        rentPaymentHistory: [], units: [],
      },
      {
        _id: 'p2', id: 'PROP-2', firmId: 'firm-1', address: '12 Ada Road, Yaba', status: 'Vacant',
        rentalDetails: { rentAmount: 120000, unitName: 'Flat 2' },
        rentPaymentHistory: [], units: [],
      },
    ],
    tenancies: [
      {
        _id: 'ten_1', firmId: 'firm-1', propertyId: 'p1', unitId: 'p1', unitKey: 'p1', unitLabel: 'Flat 1 · 12 Ada Road',
        status: 'active', startDate: '2026-08-01', endDate: null,
        tenantContactId: 'c-1', tenantUserId: 'u-tenant-1', tenantEmail: 'tenant@example.com', tenantName: 'Tayo Tenant',
        rent: 250000, paymentFrequency: 'Monthly',
      },
    ],
    ledger_entries: [
      // This month: cleared rent 250k + pending fee 12.5k.
      { _id: 'led_now_rent', firmId: 'firm-1', propertyId: 'p1', unitId: 'p1', tenantId: 'u-tenant-1', amount: 250000.25, type: 'rent', status: 'cleared', timestamp: NOW - 5 * 86400000, txHash: 'T1', channel: 'Rent collection', paymentRef: 'REC-00001' },
      { _id: 'led_now_fee', firmId: 'firm-1', propertyId: 'p1', unitId: 'p1', amount: 12500, type: 'management_fee', status: 'pending', timestamp: NOW - 4 * 86400000, txHash: 'T2' },
      // Previous month: cleared SC 80k.
      { _id: 'led_prev_sc', firmId: 'firm-1', propertyId: 'p1', unitId: 'p1', amount: 80000, type: 'service_charge', status: 'cleared', timestamp: PREV_MONTH.getTime(), txHash: 'T3', channel: 'Wallet Auto-Deduct' },
      // Excluded annotations.
      { _id: 'led_voided', firmId: 'firm-1', propertyId: 'p1', unitId: 'p1', amount: 99999, type: 'rent', status: 'cleared', recordStatus: 'voided', timestamp: NOW - 2 * 86400000, txHash: 'T4', voidReason: 'test noise' },
    ],
    service_charges: [
      // 45 days overdue, UNPAID, credit-netted: 100k − 5k credit = 95k → 31-60 bucket.
      { _id: 'sc_diesel', firmId: 'firm-1', unitId: 'p1', tenantId: 'u-tenant-1', category: 'Diesel', amount: 100000, cycle: 'Monthly', nextDueDate: NOW - 45 * 86400000, isDefaulter: true, daysOverdue: 45, serviceChargeStatus: 'UNPAID', creditCarriedForward: 5000 },
      // 100 days overdue, PARTIAL with explicit outstanding 30k → 90+ bucket.
      { _id: 'sc_security', firmId: 'firm-1', unitId: 'p2', category: 'Security', amount: 60000, cycle: 'Monthly', nextDueDate: NOW - 100 * 86400000, isDefaulter: true, daysOverdue: 100, serviceChargeStatus: 'PARTIALLY_PAID', outstandingBalance: 30000, amountPaidThisCycle: 30000 },
      // Paid in full → not in arrears; contributes to collections.
      { _id: 'sc_cleaning', firmId: 'firm-1', unitId: 'p1', category: 'Cleaning', amount: 20000, cycle: 'Monthly', nextDueDate: NOW - 10 * 86400000, isDefaulter: false, serviceChargeStatus: 'PAID_FULLY' },
    ],
    reconciliation_matches: [],
    payment_proofs: [],
    ...extra,
  };
}

beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(NOW); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function runReports(ctx: any, args: Row = {}) {
  return (getFinancialReports as any)._handler(ctx, {
    firmId: 'firm-1', sessionToken: ADMIN_SESSION.token, ...args,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// The report suite
// ═══════════════════════════════════════════════════════════════════════════
describe('F3 §5 — the report suite', () => {
  it('auth quartet: staff ok; dead token, portal, cross-firm rejected', async () => {
    const ok = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: reportTables() });
    const r: any = await runReports(ok.ctx);
    expect(r.rentRoll.length).toBe(2);

    await expect(runReports(makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: reportTables() }).ctx, { sessionToken: 'tok-dead' }))
      .rejects.toThrow(/Unauthenticated/i);
    await expect(runReports(makeCtx({ user: TENANT, session: TENANT_SESSION, tables: reportTables() }).ctx, { sessionToken: TENANT_SESSION.token }))
      .rejects.toThrow();
    await expect(runReports(makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: reportTables() }).ctx, { firmId: 'firm-2' }))
      .rejects.toThrow();
  });

  it('rent roll: every unit with lease state + last payment; vacant units included', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: reportTables() });
    const r: any = await runReports(ctx);
    const p1 = r.rentRoll.find((u: any) => u.unitKey === 'p1');
    expect(p1.leaseActive).toBe(true);
    expect(p1.tenantName).toBe('Tayo Tenant');
    expect(p1.rent).toBe(250000);
    expect(p1.frequency).toBe('Monthly');
    expect(p1.lastPaymentAmount).toBe(250000.25); // the newest cleared row for the unit
    expect(p1.lastPaymentRef).toBe('REC-00001');
    const p2 = r.rentRoll.find((u: any) => u.unitKey === 'p2');
    expect(p2.leaseActive).toBe(false);
    expect(p2.tenantName).toBeNull();
    expect(p2.rent).toBe(120000);
  });

  it('arrears aging: credit-netted UNPAID and PARTIAL outstanding bucketed by days overdue', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: reportTables() });
    const r: any = await runReports(ctx);
    const b3160 = r.arrearsAging.buckets.find((b: any) => b.label === '31-60 days');
    expect(b3160.outstanding).toBe(95000); // 100k − 5k credit
    expect(b3160.count).toBe(1);
    const b90 = r.arrearsAging.buckets.find((b: any) => b.label === '90+ days');
    expect(b90.outstanding).toBe(30000);
    // The paid-in-full cleaning charge is in NO bucket.
    const allRows = r.arrearsAging.rows.map((x: any) => x.category);
    expect(allRows).not.toContain('Cleaning');
    // Rows sort by days overdue descending.
    expect(r.arrearsAging.rows[0].daysOverdue).toBeGreaterThanOrEqual(r.arrearsAging.rows[1].daysOverdue);
  });

  it('SC collections by category: cycle amount, collected-this-cycle, outstanding', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: reportTables() });
    const r: any = await runReports(ctx);
    const cleaning = r.scCollections.byCategory.find((c: any) => c.category === 'Cleaning');
    // PAID_FULLY: collected-this-cycle reconstructs the full amount.
    expect(cleaning.collectedThisCycle).toBe(20000);
    expect(cleaning.outstanding).toBe(0);
    const diesel = r.scCollections.byCategory.find((c: any) => c.category === 'Diesel');
    expect(diesel.outstanding).toBe(95000);
  });

  it('revenue by type: months bucketed, income/risk split, voided excluded', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: reportTables() });
    const r: any = await runReports(ctx);
    const nowMonth = r.revenueByType.months.find((m: any) => m.key === KEY_NOW);
    expect(nowMonth.income).toBe(250000.25); // the voided 99999 excluded
    expect(nowMonth.risk).toBe(12500);
    const prevMonth = r.revenueByType.months.find((m: any) => m.key === KEY_PREV);
    expect(prevMonth.income).toBe(80000);
    const rentType = nowMonth.byType.find((t: any) => t.type === 'rent');
    expect(rentType.amount).toBe(250000.25);
  });

  it('payment history: newest-first, cleared-only, bounded', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: reportTables() });
    const r: any = await runReports(ctx);
    expect(r.paymentHistory.length).toBe(2); // this-month rent + prev-month SC (voided excluded)
    expect(Number(r.paymentHistory[0].at)).toBeGreaterThan(Number(r.paymentHistory[1].at));
    expect(r.paymentHistory.some((p: any) => p.paymentRef === 'REC-00001')).toBe(true);
  });

  it('period comparison: current vs previous with exact deltas', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: reportTables() });
    const r: any = await runReports(ctx);
    expect(r.periodComparison.current.key).toBe(KEY_NOW);
    expect(r.periodComparison.previous.key).toBe(KEY_PREV);
    expect(r.periodComparison.current.income).toBe(250000.25);
    expect(r.periodComparison.previous.income).toBe(80000);
    expect(r.periodComparison.delta.income).toBe(170000.25);
    expect(r.periodComparison.delta.risk).toBe(12500);
  });

  it('§5 totals-vs-transactions proof: report totals equal the raw row sums', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: reportTables() });
    const r: any = await runReports(ctx);
    // Cleared total must equal the sum of the raw active cleared rows.
    const rawCleared = tables.ledger_entries
      .filter((l: any) => l.status === 'cleared' && !['voided', 'test'].includes(String(l.recordStatus ?? '')))
      .reduce((s: number, l: any) => s + Math.round(Number(l.amount) * 100), 0) / 100;
    expect(r.proof.clearedTotal).toBe(rawCleared);
    expect(r.proof.clearedCount).toBe(2);
    // Outstanding total must equal the sum of the aging buckets.
    const bucketSum = r.arrearsAging.buckets.reduce((s: number, b: any) => s + Math.round(Number(b.outstanding) * 100), 0) / 100;
    expect(r.proof.outstandingTotal).toBe(bucketSum);
    expect(r.proof.outstandingTotal).toBe(125000); // 95k + 30k
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The four missing §7 acceptance pins
// ═══════════════════════════════════════════════════════════════════════════
describe('F3 §7 — the four missing acceptance pins', () => {
  it('FAILED PAYMENT: a rejected proof books nothing — no ledger row, no charge settlement', async () => {
    const tables = reportTables();
    tables.payment_proofs = [
      {
        _id: 'proof_pending', firmId: 'firm-1', tenantId: 'u-tenant-1', tenantName: 'Tayo Tenant',
        propertyId: 'p1', unitId: 'p1', amount: 70000, period: 'December 2026', description: 'Diesel',
        storageIds: [], status: 'pending_review', paymentMethod: 'bank_transfer', paystackReference: null,
        ledgerEntryId: null, createdAt: NOW, updatedAt: NOW,
      },
    ];
    const chargeBefore = JSON.stringify(tables.service_charges.find((c: any) => c._id === 'sc_diesel'));
    const { ctx, writes } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables });
    const result: any = await (updatePaymentProofStatus as any)._handler(ctx, {
      proofId: 'proof_pending', status: 'rejected', adminNote: 'slip unreadable — resubmit',
      sessionToken: ADMIN_SESSION.token,
    });
    expect(result.success).toBe(true);
    // Nothing booked: no ledger insert anywhere in this flow.
    expect(writes.inserts.filter((w: any) => w.table === 'ledger_entries').length).toBe(0);
    // The charge is untouched.
    expect(JSON.stringify(tables.service_charges.find((c: any) => c._id === 'sc_diesel'))).toBe(chargeBefore);
    // The proof row is rejected, still unbooked.
    const proof = tables.payment_proofs[0] as any;
    expect(proof.status).toBe('rejected');
    expect(proof.ledgerEntryId).toBeNull();
  });

  it('UNMATCHED PAYMENT end-to-end: settle unlinked → queue → match → the report suite reflects it', async () => {
    // The F2 queue + match were pinned in roundFWave2; this pin drives the
    // WHOLE chain through the real handlers and asserts the report suite's
    // outstanding reflects the match (the obligation side settled without a
    // second ledger row).
    const { matchProofToCharge, getUnallocatedPayments } = await import('../../convex/reconciliationWorkflow');
    const tables = reportTables();
    tables.payment_proofs = [
      {
        _id: 'proof_ok', firmId: 'firm-1', tenantId: 'u-tenant-1', tenantName: 'Tayo Tenant',
        propertyId: 'p1', unitId: 'p1', amount: 40000, period: 'December 2026', description: 'Diesel',
        storageIds: [], status: 'approved', paymentMethod: 'bank_transfer', paystackReference: null,
        ledgerEntryId: 'led_proof_ok', createdAt: NOW, updatedAt: NOW,
      },
    ];
    const { ctx, writes } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables });
    const before: any = await runReports(ctx);
    expect(before.arrearsAging.buckets.find((b: any) => b.label === '31-60 days').outstanding).toBe(95000);

    // In the queue before; matched after; the obligation side settles.
    const q1: any = await (getUnallocatedPayments as any)._handler(ctx, { firmId: 'firm-1', sessionToken: ADMIN_SESSION.token });
    expect(q1.unmatchedCount).toBe(1);
    const m: any = await (matchProofToCharge as any)._handler(ctx, {
      firmId: 'firm-1', proofId: 'proof_ok', chargeId: 'sc_diesel',
      reason: 'Bank alert for the December diesel levy', sessionToken: ADMIN_SESSION.token,
    });
    expect(m.chargeStatus).toBe('PARTIALLY_PAID');
    // NO second ledger row was written by the match.
    expect(writes.inserts.filter((w: any) => w.table === 'ledger_entries').length).toBe(0);
    const q2: any = await (getUnallocatedPayments as any)._handler(ctx, { firmId: 'firm-1', sessionToken: ADMIN_SESSION.token });
    expect(q2.unmatchedCount).toBe(0);
    // The report suite now shows 60k outstanding for Diesel: the match
    // settled the paid portion (PARTIALLY_PAID, outstandingBalance 60k) and —
    // exactly like every settlement path — did NOT consume the carried
    // credit (the 5k waits for the next cycle's reset; the report's PARTIAL
    // branch reads outstandingBalance directly).
    const after: any = await runReports(ctx);
    expect(after.arrearsAging.buckets.find((b: any) => b.label === '31-60 days').outstanding).toBe(60000);
    const dieselCharge = tables.service_charges.find((c: any) => c._id === 'sc_diesel') as any;
    expect(dieselCharge.creditCarriedForward).toBe(5000); // still waiting
  });

  it('PAYMENT REVERSAL: voiding a payment feeds the bill statement as an excluded adjustment', async () => {
    // This pin's ledger is date-independent: both rows sit squarely inside
    // the 30-day statement window regardless of when the suite runs.
    const tables = reportTables();
    tables.ledger_entries = [
      { _id: 'led_now_rent', firmId: 'firm-1', propertyId: 'p1', unitId: 'p1', tenantId: 'u-tenant-1', amount: 250000.25, type: 'rent', status: 'cleared', timestamp: NOW - 5 * 86400000, txHash: 'T1', channel: 'Rent collection', paymentRef: 'REC-00001' },
      { _id: 'led_near_sc', firmId: 'firm-1', propertyId: 'p1', unitId: 'p1', tenantId: 'u-tenant-1', amount: 80000, type: 'service_charge', status: 'cleared', timestamp: NOW - 3 * 86400000, txHash: 'T5', channel: 'Wallet Auto-Deduct' },
    ];
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables });
    // Before: the payment counts.
    const beforeBill: any = await (getResidentBill as any)._handler(ctx, {
      firmId: 'firm-1', unitId: 'p1', sessionToken: ADMIN_SESSION.token,
      tenantContactId: 'c-1', tenantUserId: 'u-tenant-1', tenantEmail: 'tenant@example.com', tenantName: 'Tayo Tenant',
      from: new Date(NOW - 30 * 86400000).toISOString(), to: new Date(NOW + 86400000).toISOString(),
    });
    expect(beforeBill.lines.some((l: any) => l.kind === 'payment')).toBe(true);
    expect(beforeBill.totals.payments).toBe(330000.25);

    // The audited void (the REAL handler).
    const voided: any = await (voidLedgerEntry as any)._handler(ctx, {
      entryId: 'led_now_rent', reason: 'Duplicate booking — reversing via the audited void lifecycle',
      sessionToken: ADMIN_SESSION.token,
    });
    expect(voided.success).toBe(true);

    // After: the payment shows as a struck adjustment with the void reason
    // and the ending balance no longer contains it.
    const afterBill: any = await (getResidentBill as any)._handler(ctx, {
      firmId: 'firm-1', unitId: 'p1', sessionToken: ADMIN_SESSION.token,
      tenantContactId: 'c-1', tenantUserId: 'u-tenant-1', tenantEmail: 'tenant@example.com', tenantName: 'Tayo Tenant',
      from: new Date(NOW - 30 * 86400000).toISOString(), to: new Date(NOW + 86400000).toISOString(),
    });
    const adjustment = afterBill.lines.find((l: any) => l.kind === 'adjustment');
    expect(adjustment).toBeTruthy();
    expect(String(adjustment.detail)).toContain('Duplicate booking');
    expect(adjustment.credit).toBe(0);
    expect(afterBill.totals.payments).toBe(80000); // only the surviving SC payment counts
    expect(afterBill.totals.adjustmentsExcluded).toBe(1);
    expect(afterBill.endingBalance).toBeGreaterThan(beforeBill.endingBalance);
  });

  it('PERIOD REPORT: the comparison is the §7 pin (asserted above) — here: empty books never throw', async () => {
    const empty = reportTables({
      ledger_entries: [],
      service_charges: [],
      tenancies: [],
      properties: [],
    });
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: empty });
    const r: any = await runReports(ctx);
    expect(r.rentRoll).toEqual([]);
    expect(r.periodComparison.delta.income).toBe(0);
    expect(r.proof.clearedTotal).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CSV export (pure)
// ═══════════════════════════════════════════════════════════════════════════
describe('F3 §5 — CSV export (pure)', () => {
  it('csvField quotes per RFC 4180', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvField('line\nbreak')).toBe('"line\nbreak"');
    expect(csvField(null)).toBe('');
    expect(csvField(42)).toBe('42');
  });

  it('buildCsv fixes column order and renders missing keys as empty fields', () => {
    const csv = buildCsv(
      [{ b: 2, a: 'x' }, { a: 'y' }],
      ['a', 'b'],
    );
    expect(csv).toBe('a,b\r\nx,2\r\ny,');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Source contracts
// ═══════════════════════════════════════════════════════════════════════════
describe('F3 — source contracts', () => {
  it('FinancialReportsConsole is ui-primitives only and never computes money', () => {
    const src = read('src/components/atrium/FinancialReportsConsole.tsx');
    expect(src).toContain("from '../ui'");
    expect(src).not.toMatch(/<button\s/);
    expect(src).not.toMatch(/<input\s/);
    expect(src).not.toMatch(/<select\s/);
    expect(src).not.toContain('toKobo');
    expect(src).not.toContain('* 100');
  });

  it('BillingView wires the reports tab', () => {
    const bv = read('src/components/BillingView.tsx');
    expect(bv).toContain("import FinancialReportsConsole from './atrium/FinancialReportsConsole'");
    expect(bv).toContain("{ id: 'reports', label: 'Reports', productTag: 'Property' }");
    expect(bv).toContain("activeTab === 'reports'");
  });

  it('the console exports via the shared csvExport util', () => {
    const src = read('src/components/atrium/FinancialReportsConsole.tsx');
    expect(src).toContain("from '../../utils/csvExport'");
    expect(src).toContain('downloadCsv');
    expect(src).toContain('buildCsv');
  });
});
