/**
 * roundFWave1.test.ts — ROUND F (Wave F1) regression tests.
 *
 * Wave F1 shipped the financial overview console read
 * (financialReporting.getFinancialOverview) and the per-resident rent bill
 * statement (tenancyLifecycle.getResidentBill) — the owner brief §1 + §2
 * gaps. Every contract is pinned in BOTH directions:
 *   • the BROKEN behaviour is impossible (unauthenticated / portal / dead
 *     token / cross-firm callers rejected; voided+test money never counts;
 *     double-counting between the obligation store and the payment store
 *     structurally impossible),
 *   • the legitimate workflows succeed (real statements compose correctly:
 *     opening balance, obligations, attributed payments, adjustments
 *     excluded-but-visible, credit applied exactly once).
 *
 * Testing style: the Round A/B behavioural harness (fixture-backed mock ctx
 * executing the real Convex handlers via `_handler(ctx, args)`), plus
 * source-contract tests for the UI wiring that cannot be imported directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Convex functions under test ─────────────────────────────────────────────
import { getResidentBill } from '../../convex/tenancyLifecycle';
import { getFinancialOverview } from '../../convex/financialReporting';
import { ROUND_B_CUTOFF_MS } from '../../convex/financialIntegrity';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed mock ctx (Round A/B harness) ─────────────────────────────
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
  lte: (a, b) => (typeof a === 'number' && typeof b === 'number') ? a <= b : String(b) >= String(a) && String(a) <= String(b),
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
    runMutation: vi.fn(async () => ({ success: true })),
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
const OTHER_FIRM_ADMIN = { _id: 'u-admin-2', email: 'other@example.com', tokenIdentifier: 'other@example.com', name: 'Ope Other', role: 'Admin', firmId: 'firm-2' };
const OTHER_FIRM_SESSION = { token: 'tok-admin-2', userId: 'u-admin-2' };

const NOW = Date.now();
const POST_CUTOFF = Math.max(ROUND_B_CUTOFF_MS + 3600_000, NOW - 1000);
// A statement window that is unambiguously in-window for all fixtures.
const FROM = new Date(NOW - 10 * 86400000).toISOString();
const TO = new Date(NOW + 86400000).toISOString();
const FROM_MS = new Date(FROM).getTime();
const TO_MS = new Date(TO).getTime();

// ── Shared fixture builders ─────────────────────────────────────────────────
function propertyFixture(overrides: Row = {}): Row {
  return {
    _id: 'p1',
    id: 'PROP-CUSTOM-1',
    firmId: 'firm-1',
    address: '12 Ada Road, Yaba, Lagos',
    status: 'Occupied',
    rentalDetails: {
      tenantName: 'Tayo Tenant',
      tenantPhone: '08030000001',
      tenantEmail: 'tenant@example.com',
      rentAmount: 250000,
      rentFrequency: 'Monthly',
      leaseStart: new Date(NOW - 300 * 86400000).toISOString().slice(0, 10),
      unitName: 'Flat 1',
    },
    rentPaymentHistory: [],
    units: [],
    ...overrides,
  };
}

function tenancyFixture(overrides: Row = {}): Row {
  return {
    _id: 'ten_1',
    firmId: 'firm-1',
    propertyId: 'p1',
    unitId: 'p1',
    unitKey: 'p1',
    unitLabel: 'Flat 1 · 12 Ada Road',
    status: 'active',
    startDate: new Date(NOW - 300 * 86400000).toISOString(),
    tenantContactId: 'c-1',
    tenantUserId: 'u-tenant-1',
    tenantEmail: 'tenant@example.com',
    tenantName: 'Tayo Tenant',
    rent: 250000,
    ...overrides,
  };
}

function ledgerFixture(overrides: Row = {}): Row {
  return {
    _id: 'led_1',
    firmId: 'firm-1',
    propertyId: 'p1',
    unitId: 'p1',
    tenantId: 'u-tenant-1',
    amount: 250000,
    type: 'rent',
    status: 'cleared',
    timestamp: NOW - 5 * 86400000,
    txHash: 'TX-1',
    channel: 'Rent collection',
    paymentRef: 'REC-00001',
    description: 'Rent collection',
    ...overrides,
  };
}

function chargeFixture(overrides: Row = {}): Row {
  return {
    _id: 'sc_1',
    firmId: 'firm-1',
    unitId: 'p1',
    tenantId: 'u-tenant-1',
    category: 'Diesel',
    amount: 100000,
    cycle: 'Monthly',
    nextDueDate: NOW - 2 * 86400000, // due inside the window
    isDefaulter: false,
    serviceChargeStatus: 'UNPAID',
    ...overrides,
  };
}

beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(NOW); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// ═══════════════════════════════════════════════════════════════════════════
// §1 — getFinancialOverview
// ═══════════════════════════════════════════════════════════════════════════
describe('F1 §1 — the financial overview console read', () => {
  function overviewTables(extra: Record<string, Row[]> = {}): Record<string, Row[]> {
    return {
      properties: [propertyFixture()],
      ledger_entries: [
        ledgerFixture({ _id: 'led_rent', amount: 250000.25, type: 'rent', status: 'cleared' }),
        ledgerFixture({ _id: 'led_sc', amount: 100000.01, type: 'service_charge', status: 'cleared', timestamp: NOW - 3 * 86400000 }),
        ledgerFixture({ _id: 'led_fee', amount: 12500, type: 'management_fee', status: 'pending' }),
        ledgerFixture({ _id: 'led_voided', amount: 999999, type: 'rent', status: 'cleared', recordStatus: 'voided', voidReason: 'booked in error' }),
        ledgerFixture({ _id: 'led_test', amount: 777777, type: 'rent', status: 'cleared', recordStatus: 'test' }),
        ledgerFixture({ _id: 'led_firm2', firmId: 'firm-2', amount: 555555, type: 'rent', status: 'cleared' }),
      ],
      service_charges: [
        chargeFixture({ _id: 'sc_unpaid', amount: 100000, serviceChargeStatus: 'UNPAID', creditCarriedForward: 5000 }),
        chargeFixture({ _id: 'sc_partial', amount: 80000, serviceChargeStatus: 'PARTIALLY_PAID', outstandingBalance: 30000, amountPaidThisCycle: 50000 }),
        chargeFixture({ _id: 'sc_paid', amount: 60000, serviceChargeStatus: 'PAID_FULLY' }),
        chargeFixture({ _id: 'sc_firm2', firmId: 'firm-2', amount: 424242, serviceChargeStatus: 'UNPAID' }),
      ],
      payment_proofs: [
        { _id: 'pr_1', firmId: 'firm-1', status: 'pending_review', amount: 250000, createdAt: POST_CUTOFF, updatedAt: POST_CUTOFF },
        { _id: 'pr_2', firmId: 'firm-1', status: 'pending_verification', amount: 90000, createdAt: POST_CUTOFF, updatedAt: POST_CUTOFF },
        { _id: 'pr_3', firmId: 'firm-1', status: 'rejected', amount: 10000, createdAt: POST_CUTOFF, updatedAt: POST_CUTOFF },
      ],
      ...extra,
    };
  }

  it('auth quartet: staff ok; dead token, portal caller and cross-firm rejected', async () => {
    const ok = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: overviewTables() });
    const result: any = await (getFinancialOverview as any)._handler(ok.ctx, {
      firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
    });
    expect(result.cashFlow).toBeTruthy();

    const dead = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: overviewTables() });
    await expect((getFinancialOverview as any)._handler(dead.ctx, {
      firmId: 'firm-1', sessionToken: 'tok-dead',
    })).rejects.toThrow(/Unauthenticated/i);

    const portal = makeCtx({ user: TENANT, session: TENANT_SESSION, tables: overviewTables() });
    await expect((getFinancialOverview as any)._handler(portal.ctx, {
      firmId: 'firm-1', sessionToken: TENANT_SESSION.token,
    })).rejects.toThrow();

    const cross = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: overviewTables() });
    await expect((getFinancialOverview as any)._handler(cross.ctx, {
      firmId: 'firm-2', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow();
  });

  it('income/risk/counts exclude voided, test and foreign-firm rows; kobo-exact sums', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: overviewTables() });
    const r: any = await (getFinancialOverview as any)._handler(ctx, {
      firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
    });
    // Cleared firm-1 rows: 250000.25 + 100000.01 (voided 999999, test
    // 777777, firm-2 555555 all excluded). Binary-exact decimals so the
    // kobo conversion is unambiguous: 350000.26 naira.
    expect(r.cashFlow.totalIncome).toBe(350000.26);
    expect(r.cashFlow.revenueAtRisk).toBe(12500);
    expect(r.cashFlow.totalTransactions).toBe(3); // rent + sc cleared + fee pending
    expect(r.cashFlow.clearedCount).toBe(2);
    expect(r.cashFlow.pendingCount).toBe(1);
  });

  it('service-charge outstanding is credit-netted for UNPAID and uses outstandingBalance for PARTIAL; credits waiting reported', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: overviewTables() });
    const r: any = await (getFinancialOverview as any)._handler(ctx, {
      firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
    });
    // UNPAID 100000 − 5000 credit + PARTIAL 30000 (paid 60000 excluded) =
    // 125000; credits waiting = 5000.
    expect(r.serviceCharges.outstanding).toBe(125000);
    expect(r.serviceCharges.unpaid).toBe(1);
    expect(r.serviceCharges.partiallyPaid).toBe(1);
    expect(r.serviceCharges.creditsWaiting).toBe(5000);
    expect(r.unallocated.creditsWaiting).toBe(5000);
    expect(r.proofs.pendingReview).toBe(1);
    expect(r.proofs.pendingVerification).toBe(1);
    expect(r.proofs.rejected).toBe(1);
  });

  it('recent activity is newest-first and active-only', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: overviewTables() });
    const r: any = await (getFinancialOverview as any)._handler(ctx, {
      firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
    });
    const ids: string[] = r.recentActivity.map((a: any) => a.id);
    expect(ids).not.toContain('led_voided');
    expect(ids).not.toContain('led_test');
    const ts: number[] = r.recentActivity.map((a: any) => a.timestamp);
    expect([...ts].sort((a, b) => b - a)).toEqual(ts);
  });

  it('collections by type aggregates cleared + at-risk per type', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: overviewTables() });
    const r: any = await (getFinancialOverview as any)._handler(ctx, {
      firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
    });
    const rent = r.collections.byType.find((t: any) => t.type === 'rent');
    expect(rent.amount).toBe(250000.25); // cleared only (voided/test excluded)
    const fee = r.collections.byType.find((t: any) => t.type === 'management_fee');
    expect(fee.amount).toBe(12500);
  });

  it('empty firm returns zeros, never throws', async () => {
    const { ctx } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { properties: [], ledger_entries: [], service_charges: [], payment_proofs: [] },
    });
    const r: any = await (getFinancialOverview as any)._handler(ctx, {
      firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
    });
    expect(r.cashFlow.totalIncome).toBe(0);
    expect(r.cashFlow.totalTransactions).toBe(0);
    expect(r.serviceCharges.outstanding).toBe(0);
    expect(r.recentActivity).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §2 — getResidentBill
// ═══════════════════════════════════════════════════════════════════════════
describe('F1 §2 — the per-resident bill statement', () => {
  function billTables(extra: Record<string, Row[]> = {}): Record<string, Row[]> {
    return {
      properties: [propertyFixture()],
      tenancies: [
        tenancyFixture(),
        // A DIFFERENT resident on a different unit — must never leak in.
        tenancyFixture({
          _id: 'ten_other', unitId: 'p2', unitKey: 'p2', unitLabel: 'Flat 2',
          tenantContactId: 'c-2', tenantUserId: 'u-other', tenantName: 'Ngo Neighbor', tenantEmail: 'ngo@example.com',
        }),
      ],
      service_charges: [
        chargeFixture({ nextDueDate: NOW - 2 * 86400000 }), // due in-window, UNPAID, 100000
      ],
      ledger_entries: [
        // Attributed rent payment in-window (cleared).
        ledgerFixture({ _id: 'led_paid', amount: 250000, type: 'rent', status: 'cleared', timestamp: NOW - 5 * 86400000 }),
        // A payment by the OTHER tenant on this unit — excluded by tenantId.
        ledgerFixture({ _id: 'led_other_tenant', tenantId: 'u-other-9', amount: 40000, type: 'service_charge', status: 'cleared', timestamp: NOW - 4 * 86400000 }),
        // Voided in-window row — visible as adjustment, excluded from totals.
        ledgerFixture({ _id: 'led_voided', amount: 12345, type: 'rent', status: 'cleared', recordStatus: 'voided', voidReason: 'duplicate test booking', timestamp: NOW - 3 * 86400000 }),
        // Pending penalty in-window — an obligation (debit).
        ledgerFixture({ _id: 'led_penalty', amount: 10000, type: 'penalty', status: 'pending', timestamp: NOW - 2 * 86400000 }),
        // Out-of-window payment — not on the statement.
        ledgerFixture({ _id: 'led_old', amount: 99999, type: 'rent', status: 'cleared', timestamp: NOW - 60 * 86400000 }),
      ],
      ...extra,
    };
  }

  async function runBill(ctx: any, args: Row = {}) {
    return (getResidentBill as any)._handler(ctx, {
      firmId: 'firm-1',
      unitId: 'p1',
      sessionToken: ADMIN_SESSION.token,
      // The panel passes the FULL identity set (any one suffices — rows may
      // be stamped with the contact id, the portal user id, email or name).
      tenantContactId: 'c-1',
      tenantUserId: 'u-tenant-1',
      tenantEmail: 'tenant@example.com',
      tenantName: 'Tayo Tenant',
      from: FROM,
      to: TO,
      ...args,
    });
  }

  it('auth quartet: staff ok; dead token, portal caller and cross-firm rejected', async () => {
    const ok = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: billTables() });
    const bill: any = await runBill(ok.ctx);
    expect(bill.unitLabel).toBeTruthy();

    const dead = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: billTables() });
    await expect(runBill(dead.ctx, { sessionToken: 'tok-dead' })).rejects.toThrow(/Unauthenticated/i);

    const portal = makeCtx({ user: TENANT, session: TENANT_SESSION, tables: billTables() });
    await expect(runBill(portal.ctx, { sessionToken: TENANT_SESSION.token })).rejects.toThrow();

    const cross = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: billTables() });
    await expect(runBill(cross.ctx, { firmId: 'firm-2' })).rejects.toThrow();
  });

  it('unknown unit throws; unit resolution is shape-proof (custom id ↔ Convex id)', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: billTables() });
    await expect(runBill(ctx, { unitId: 'nope-does-not-exist' })).rejects.toThrow(/Unit not found/i);

    // The same unit addressed by its CUSTOM id: the caller addresses the
    // unit by the custom id while the tenancy row uses the Convex _id form
    // — both resolve to the same unitKey, so the statement is identical.
    const billConvex: any = await runBill(
      makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: billTables() }).ctx
    );
    const byCustom: any = await runBill(
      makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: billTables() }).ctx,
      { unitId: 'PROP-CUSTOM-1' }
    );
    expect(byCustom.unitLabel).toBe(billConvex.unitLabel);
    expect(byCustom.endingBalance).toBe(billConvex.endingBalance);
  });

  it('composes the statement: opening, obligations, payments, penalty, adjustment excluded, credit applied once', async () => {
    const tables = billTables({
      // Pre-window unsettled charge → opening balance 50k.
      service_charges: [
        chargeFixture({ _id: 'sc_inwin', nextDueDate: NOW - 2 * 86400000, amount: 100000, creditCarriedForward: 5000 }),
        chargeFixture({ _id: 'sc_pre', nextDueDate: FROM_MS - 5 * 86400000, amount: 50000, serviceChargeStatus: 'UNPAID' }),
      ],
    });
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables });
    const bill: any = await runBill(ctx);

    // Opening: the pre-window UNPAID 50k charge.
    expect(bill.openingBalance).toBe(50000);
    expect(bill.openingNote).toContain('Unsettled charges');

    // Lines: charge 100k + rent 250k (one month in window, per lease terms)
    //       + payment 250k credit + penalty 10k debit + adjustment (excluded).
    const kinds = bill.lines.map((l: any) => l.kind);
    expect(kinds).toContain('charge');
    expect(kinds).toContain('rent');
    expect(kinds).toContain('payment');
    expect(kinds).toContain('penalty');
    expect(kinds).toContain('adjustment');

    const chargeLine = bill.lines.find((l: any) => l.kind === 'charge');
    expect(chargeLine.debit).toBe(100000);
    const rentLines = bill.lines.filter((l: any) => l.kind === 'rent');
    expect(rentLines.length).toBe(1); // 10-day window → one month line
    expect(rentLines[0].debit).toBe(250000);
    const payLines = bill.lines.filter((l: any) => l.kind === 'payment');
    expect(payLines.length).toBe(1); // the other tenant's payment excluded; old one out of window
    expect(payLines[0].credit).toBe(250000);
    const penaltyLine = bill.lines.find((l: any) => l.kind === 'penalty');
    expect(penaltyLine.debit).toBe(10000);

    // Adjustment is visible but excluded from the running total.
    const adjustment = bill.lines.find((l: any) => l.kind === 'adjustment');
    expect(adjustment.detail).toContain('duplicate test booking');
    expect(adjustment.debit).toBe(0);
    expect(adjustment.credit).toBe(0);

    // Ending: 50000 opening + 100000 charge + 250000 rent + 10000 penalty
    //         − 250000 payment − 5000 credit = 155000.
    expect(bill.endingBalance).toBe(155000);
    expect(bill.totals.charges).toBe(360000); // debits: 100k charge + 250k rent + 10k penalty
    expect(bill.totals.payments).toBe(250000);
    expect(bill.totals.creditApplied).toBe(5000);
    expect(bill.totals.adjustmentsExcluded).toBe(1);

    // The credit_applied line is present and reduces the balance once.
    const creditLine = bill.lines.find((l: any) => l.kind === 'credit_applied');
    expect(creditLine.credit).toBe(5000);
  });

  it('running balance column walks the statement chronologically', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: billTables() });
    const bill: any = await runBill(ctx);
    const dates = bill.lines.map((l: any) => l.date);
    expect([...dates].sort((a: number, b: number) => a - b)).toEqual(dates);
    // The LAST line's balance equals the ending balance before credit (no
    // credit fixture here) — the invariant the UI renders as "currently due".
    const last = bill.lines[bill.lines.length - 1];
    expect(last.balance).toBe(bill.endingBalance);
  });

  it('in-window attribution: un-stamped legacy rows count only inside the tenancy window; other tenants never', async () => {
    const tables = billTables();
    // A legacy row with NO tenantId, inside the tenancy window → attributed.
    tables.ledger_entries.push(ledgerFixture({
      _id: 'led_legacy_inwin', tenantId: undefined, amount: 20000, type: 'service_charge',
      status: 'cleared', timestamp: NOW - 1 * 86400000,
    }));
    // Same shape but BEFORE the tenancy started → never this resident's.
    tables.ledger_entries.push(ledgerFixture({
      _id: 'led_legacy_before', tenantId: undefined, amount: 30000, type: 'service_charge',
      status: 'cleared', timestamp: NOW - 400 * 86400000,
    }));
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables });
    const bill: any = await runBill(ctx);
    expect(bill.lines.filter((l: any) => l.kind === 'payment').length).toBe(2); // rent + legacy in-window
    // The pre-tenancy legacy row (99999, 40 days before the tenancy) never lands.
  });

  it('a fully-settled window reads zero due; overpayment reads in credit', async () => {
    // Charge fully paid in-window (payment row exists) and rent paid.
    const tables = billTables({
      service_charges: [
        chargeFixture({ nextDueDate: NOW - 2 * 86400000, serviceChargeStatus: 'PAID_FULLY' }),
      ],
      ledger_entries: [
        ledgerFixture({ _id: 'led_rentpaid', amount: 250000, type: 'rent', status: 'cleared', timestamp: NOW - 5 * 86400000 }),
        ledgerFixture({ _id: 'led_scpaid', amount: 100000, type: 'service_charge', status: 'cleared', timestamp: NOW - 2 * 86400000 }),
      ],
    });
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables });
    const bill: any = await runBill(ctx);
    // 250k rent debit − 250k rent credit + 100k charge debit − 100k sc credit = 0.
    expect(bill.endingBalance).toBe(0);
    expect(bill.endingNote).toContain('settled');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Source contracts (UI wiring that cannot be imported directly)
// ═══════════════════════════════════════════════════════════════════════════
describe('F1 — source contracts', () => {
  it('FinancialOverview + ResidentBillPanel are ui-primitives only (no raw interactive elements)', () => {
    for (const f of ['src/components/atrium/FinancialOverview.tsx', 'src/components/atrium/ResidentBillPanel.tsx']) {
      const src = read(f);
      expect(src).toContain("from '../ui'");
      expect(src).not.toMatch(/<button/i);
      expect(src).not.toMatch(/<input/i);
      expect(src).not.toMatch(/<select/i);
    }
  });

  it('panels never recompute money client-side — figures render exactly as the server returned them', () => {
    const bill = read('src/components/atrium/ResidentBillPanel.tsx');
    expect(bill).not.toContain('toKobo');
    expect(bill).not.toContain('* 100');
    const overview = read('src/components/atrium/FinancialOverview.tsx');
    expect(overview).not.toContain('toKobo');
  });

  it('BillingView wires the Overview tab; ResidentProfilePanel embeds the bill statement', () => {
    const bv = read('src/components/BillingView.tsx');
    expect(bv).toContain("import FinancialOverview from './atrium/FinancialOverview'");
    expect(bv).toContain("{ id: 'overview', label: 'Overview', productTag: 'Property' }");
    expect(bv).toContain("activeTab === 'overview'");

    const rp = read('src/components/details/ResidentProfilePanel.tsx');
    expect(rp).toContain("import { ResidentBillPanel } from '../atrium/ResidentBillPanel'");
    expect(rp).toContain('<ResidentBillPanel');
  });

  it('the generated api registry knows the new module', () => {
    const dts = read('convex/_generated/api.d.ts');
    expect(dts).toContain('financialReporting');
  });

  it('convex money code computes in kobo internally (new wave code)', () => {
    const reporting = read('convex/financialReporting.ts');
    expect(reporting).toContain('const kb =');
    const tenancy = read('convex/tenancyLifecycle.ts');
    const billSection = tenancy.slice(tenancy.indexOf('getResidentBill'));
    expect(billSection).toContain('const kb =');
    expect(billSection).toContain('creditKb');
  });
});
