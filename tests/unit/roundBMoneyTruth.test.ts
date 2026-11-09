/**
 * roundBMoneyTruth.test.ts — ROUND B (Wave S2, money truth) regression tests.
 *
 * Every fix in the Round B register (H1, H2, H10, M5, M6, M7, M8 + the
 * reconciliation checker) is pinned here in BOTH directions, per the round's
 * acceptance gates:
 *   • the BROKEN behaviour is now impossible (replay/duplicate/invalid
 *     amounts/unbooked money → rejected, no-op or flagged),
 *   • the legitimate money workflows still succeed and book atomically.
 *
 * Testing style: the Round A behavioural harness (fixture-backed mock ctx
 * executing the real Convex handlers via `_handler(ctx, args)`), extended
 * with REAL range-query semantics for gte/lte/lt/gt (money windows need
 * them; Round A only needed equality lookups) plus source-contract tests
 * for the UI wiring that cannot be imported directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Convex functions under test ─────────────────────────────────────────────
import { fundWallet, processAutoDeductions } from '../../convex/wallets';
import {
  addLedgerEntry,
  markChargeAsPaid,
  applyLatePenalty,
  upsertServiceCharge,
  flagOverdueCharges,
  resetMonthlyServiceCharges,
  collectRentPayment,
} from '../../convex/sentry';
import {
  submitPaymentProof,
  updatePaymentProofStatus,
  getTenantInfo,
  settleApprovedProof,
} from '../../convex/portals';
import { recordPaystackEvent } from '../../convex/paystack';
import { runFinancialReconciliation, ROUND_B_CUTOFF_MS } from '../../convex/financialIntegrity';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed mock ctx (Round A harness + range-query semantics) ──────
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
      filter: (_fn: any) => chain, // permissive: index conditions carry the test's intent
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
      // Shape-based dispatch for the internal mutations Round B touches.
      if (args && typeof args.key === 'string' && typeof args.maxRequests === 'number') {
        return true; // consumeRateLimit
      }
      if (args && 'paystackReference' in (args ?? {}) && 'amount' in (args ?? {}) && !('proofId' in (args ?? {}))) {
        return (fundWallet as any)._handler(ctx, args); // internal.wallets.fundWallet
      }
      if (args && 'propertyId' in (args ?? {}) && 'tenantId' in (args ?? {}) && !('amount' in (args ?? {}))) {
        // internal.wallets.getOrCreateWallet — minimal get-or-create.
        const existing = (tables.resident_wallets ?? []).find((w) => String(w.tenantId) === String(args.tenantId));
        if (existing) return existing;
        const _id = 'wallet_created_1';
        tables.resident_wallets = [{ _id, tenantId: args.tenantId, firmId: args.firmId, propertyId: args.propertyId, balance: 0, currency: 'NGN', autoDeductEnabled: false, status: 'active', lowBalanceThreshold: 1000, createdAt: Date.now(), updatedAt: Date.now() }];
        return tables.resident_wallets[0];
      }
      if (args && typeof (args as any).proofId === 'string' && typeof (args as any).source === 'string') {
        // internal.portals.settleApprovedProof (webhook / self-heal path)
        return (settleApprovedProof as any)._handler(ctx, args);
      }
      return { success: true };
    }),
    runAction: vi.fn(async (_ref: any, args: any) => ({ success: true })),
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
const POST_CUTOFF = Math.max(ROUND_B_CUTOFF_MS + 3600_000, NOW - 1000); // unambiguously post-Round-B

function proofFixture(overrides: Row = {}) {
  return {
    _id: 'proof_1',
    firmId: 'firm-1',
    tenantId: 'u-tenant-1',
    tenantName: 'Tayo Tenant',
    tenantEmail: 'tenant@example.com',
    propertyId: 'p1',
    unitId: 'u1',
    amount: 250000,
    period: 'November 2026',
    description: 'Rent',
    storageIds: [],
    status: 'pending_review',
    paymentMethod: 'bank_transfer',
    paystackReference: null,
    createdAt: POST_CUTOFF,
    updatedAt: POST_CUTOFF,
    ...overrides,
  };
}

beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(NOW); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// ═══════════════════════════════════════════════════════════════════════════
// H1 — proof approval books the money atomically
// ═══════════════════════════════════════════════════════════════════════════
describe('H1 — approving a payment proof books a ledger entry', () => {
  it('staff approval writes the ledger entry + proof link + audit row in one transaction', async () => {
    const { ctx, writes, tables } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { payment_proofs: [proofFixture()] },
    });
    const result: any = await (updatePaymentProofStatus as any)._handler(ctx, {
      proofId: 'proof_1', status: 'approved', sessionToken: ADMIN_SESSION.token,
    });
    expect(result.success).toBe(true);
    expect(result.bookedAmount).toBe(250000);
    expect(result.ledgerEntryId).toBeTruthy();

    const ledgerInsert = writes.inserts.find((w) => w.table === 'ledger_entries');
    expect(ledgerInsert).toBeTruthy();
    expect(ledgerInsert.value.amount).toBe(250000);
    expect(ledgerInsert.value.type).toBe('rent');
    expect(ledgerInsert.value.status).toBe('cleared');
    expect(ledgerInsert.value.idempotencyKey).toBe('proof-approved-proof_1');
    expect(ledgerInsert.value.paymentRef).toBe('proof_1');

    const proof = tables.payment_proofs[0];
    expect(proof.status).toBe('approved');
    expect(proof.ledgerEntryId).toBe(String(result.ledgerEntryId));
    expect(proof.reviewedBy).toBe('admin@example.com');
    expect(proof.reviewedAt).toBe(NOW);

    expect(writes.inserts.some((w) => w.table === 'financial_audit_log')).toBe(true);
  });

  it('re-approving an already-settled proof is an idempotent no-op (no double-booking)', async () => {
    const { ctx, writes } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: {
        payment_proofs: [proofFixture()],
        ledger_entries: [{
          _id: 'led_1', firmId: 'firm-1', unitId: 'u1', amount: 250000, type: 'rent',
          status: 'cleared', timestamp: POST_CUTOFF, txHash: 'TX-1',
          idempotencyKey: 'proof-approved-proof_1', paymentRef: 'proof_1',
        }],
      },
    });
    const result: any = await (updatePaymentProofStatus as any)._handler(ctx, {
      proofId: 'proof_1', status: 'approved', sessionToken: ADMIN_SESSION.token,
    });
    expect(result.duplicate).toBe(true);
    expect(result.ledgerEntryId).toBe('led_1');
    expect(writes.inserts.filter((w) => w.table === 'ledger_entries').length).toBe(0);
  });

  it('approving an amount-less proof without a confirmed amount fails loudly (nothing booked)', async () => {
    const { ctx, writes } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { payment_proofs: [proofFixture({ amount: null })] },
    });
    await expect((updatePaymentProofStatus as any)._handler(ctx, {
      proofId: 'proof_1', status: 'approved', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/confirmed amount/i);
    expect(writes.inserts.filter((w) => w.table === 'ledger_entries').length).toBe(0);
  });

  it('approving an amount-less proof WITH a confirmed amount books that figure', async () => {
    const { ctx, writes } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { payment_proofs: [proofFixture({ amount: null })] },
    });
    const result: any = await (updatePaymentProofStatus as any)._handler(ctx, {
      proofId: 'proof_1', status: 'approved', confirmedAmount: 180000, sessionToken: ADMIN_SESSION.token,
    });
    expect(result.bookedAmount).toBe(180000);
    const ledgerInsert = writes.inserts.find((w) => w.table === 'ledger_entries');
    expect(ledgerInsert.value.amount).toBe(180000);
  });

  it('an unauthenticated caller cannot approve (and nothing is booked)', async () => {
    const { ctx, writes } = makeCtx({
      tables: { payment_proofs: [proofFixture()] },
    });
    await expect((updatePaymentProofStatus as any)._handler(ctx, {
      proofId: 'proof_1', status: 'approved',
    })).rejects.toThrow(/unauthenticated|session/i);
    expect(writes.inserts.filter((w) => w.table === 'ledger_entries').length).toBe(0);
  });

  it('optional charge linkage settles the linked service charge in the same transaction', async () => {
    const { ctx, tables } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: {
        payment_proofs: [proofFixture()],
        service_charges: [{
          _id: 'sc1', firmId: 'firm-1', unitId: 'u1', tenantId: 'u-tenant-1', category: 'Diesel',
          amount: 250000, cycle: 'Monthly', nextDueDate: NOW - 5000, isDefaulter: true,
          serviceChargeStatus: 'UNPAID', outstandingBalance: 250000,
        }],
      },
    });
    const result: any = await (updatePaymentProofStatus as any)._handler(ctx, {
      proofId: 'proof_1', status: 'approved', serviceChargeId: 'sc1', chargeType: 'service_charge',
      sessionToken: ADMIN_SESSION.token,
    });
    expect(result.chargeSettled).toBe(true);
    const charge = tables.service_charges[0];
    expect(charge.serviceChargeStatus).toBe('PAID_FULLY');
    expect(charge.outstandingBalance).toBe(0);
    expect(charge.isDefaulter).toBe(false);
  });

  it('a cross-firm charge link is rejected', async () => {
    const { ctx } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: {
        payment_proofs: [proofFixture()],
        service_charges: [{
          _id: 'scx', firmId: 'firm-2', unitId: 'u1', tenantId: 't', category: 'Diesel',
          amount: 100, cycle: 'Monthly', nextDueDate: NOW, isDefaulter: false,
        }],
      },
    });
    await expect((updatePaymentProofStatus as any)._handler(ctx, {
      proofId: 'proof_1', status: 'approved', serviceChargeId: 'scx', chargeType: 'service_charge',
      sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/different firm/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H2 — wallet auto-deduct writes ledger rows atomically
// ═══════════════════════════════════════════════════════════════════════════
describe('H2 — wallet auto-deduct revenue reaches the ledger', () => {
  const dueCharge = (overrides: Row = {}) => ({
    _id: 'sc1', firmId: 'firm-1', unitId: 'u1', tenantId: 'u-tenant-1', category: 'Diesel',
    amount: 50000, cycle: 'Monthly', nextDueDate: NOW - 86400000, isDefaulter: false,
    serviceChargeStatus: 'UNPAID', outstandingBalance: 50000, ...overrides,
  });
  const fundedWallet = (overrides: Row = {}) => ({
    _id: 'w1', tenantId: 'u-tenant-1', firmId: 'firm-1', propertyId: 'p1', balance: 100000,
    currency: 'NGN', autoDeductEnabled: true, status: 'active', lowBalanceThreshold: 1000,
    createdAt: NOW, updatedAt: NOW, ...overrides,
  });

  it('a deduction debits the wallet, settles the charge AND books the ledger row in one transaction', async () => {
    const { ctx, writes, tables } = makeCtx({
      tables: {
        service_charges: [dueCharge()],
        resident_wallets: [fundedWallet()],
        properties: [{ _id: 'p1', id: 'p1', firmId: 'firm-1', address: '12 Marina', units: [{ id: 'u1', tenantId: 'u-tenant-1' }] }],
      },
    });
    const result: any = await (processAutoDeductions as any)._handler(ctx, {});
    expect(result.deductionsMade).toBe(1);

    const ledgerInsert = writes.inserts.find((w) => w.table === 'ledger_entries');
    expect(ledgerInsert).toBeTruthy();
    expect(ledgerInsert.value.amount).toBe(50000);
    expect(ledgerInsert.value.type).toBe('service_charge');
    expect(ledgerInsert.value.status).toBe('cleared');
    expect(ledgerInsert.value.idempotencyKey).toBe(`wallet-deduct-sc1-${NOW - 86400000}`);
    expect(ledgerInsert.value.channel).toBe('Wallet Auto-Deduct');

    const wtxInsert = writes.inserts.find((w) => w.table === 'wallet_transactions' && w.value.type === 'debit');
    expect(wtxInsert.value.ledgerIdempotencyKey).toBe(`wallet-deduct-sc1-${NOW - 86400000}`);

    expect(tables.resident_wallets[0].balance).toBe(50000);
    expect(tables.service_charges[0].serviceChargeStatus).toBe('PAID_FULLY');
  });

  it('a second run does not double-deduct or double-book (charge already PAID_FULLY)', async () => {
    const { ctx, writes } = makeCtx({
      tables: {
        service_charges: [dueCharge({ serviceChargeStatus: 'PAID_FULLY', outstandingBalance: 0, nextDueDate: NOW + 30 * 86400000 })],
        resident_wallets: [fundedWallet({ balance: 50000 })],
        properties: [{ _id: 'p1', id: 'p1', firmId: 'firm-1', address: '12 Marina', units: [{ id: 'u1', tenantId: 'u-tenant-1' }] }],
      },
    });
    const result: any = await (processAutoDeductions as any)._handler(ctx, {});
    expect(result.deductionsMade).toBe(0);
    expect(writes.inserts.filter((w) => w.table === 'ledger_entries').length).toBe(0);
  });

  it('insufficient funds: no wallet debit, no ledger row, low_balance transaction only', async () => {
    const { ctx, writes } = makeCtx({
      tables: {
        service_charges: [dueCharge()],
        resident_wallets: [fundedWallet({ balance: 10000 })],
        properties: [{ _id: 'p1', id: 'p1', firmId: 'firm-1', address: '12 Marina', units: [{ id: 'u1', tenantId: 'u-tenant-1' }] }],
      },
    });
    const result: any = await (processAutoDeductions as any)._handler(ctx, {});
    expect(result.insufficientFunds).toBe(1);
    expect(result.deductionsMade).toBe(0);
    expect(writes.inserts.filter((w) => w.table === 'ledger_entries').length).toBe(0);
    expect(writes.inserts.some((w) => w.table === 'wallet_transactions' && w.value.type === 'insufficient_funds')).toBe(true);
  });

  it('carried-forward credit covers the cycle: charge settles with NO wallet debit and NO ledger row', async () => {
    const { ctx, writes, tables } = makeCtx({
      tables: {
        service_charges: [dueCharge({ creditCarriedForward: 50000 })],
        resident_wallets: [fundedWallet({ balance: 100000 })],
        properties: [{ _id: 'p1', id: 'p1', firmId: 'firm-1', address: '12 Marina', units: [{ id: 'u1', tenantId: 'u-tenant-1' }] }],
      },
    });
    const result: any = await (processAutoDeductions as any)._handler(ctx, {});
    expect(result.deductionsMade).toBe(1);
    expect(writes.inserts.filter((w) => w.table === 'ledger_entries').length).toBe(0); // credit was booked last cycle
    expect(tables.resident_wallets[0].balance).toBe(100000); // wallet untouched
    expect(tables.service_charges[0].serviceChargeStatus).toBe('PAID_FULLY');
    expect(tables.service_charges[0].creditCarriedForward).toBe(0);
  });

  it('partial credit: only the wallet-funded remainder is debited and booked', async () => {
    const { ctx, writes, tables } = makeCtx({
      tables: {
        service_charges: [dueCharge({ creditCarriedForward: 20000 })],
        resident_wallets: [fundedWallet({ balance: 100000 })],
        properties: [{ _id: 'p1', id: 'p1', firmId: 'firm-1', address: '12 Marina', units: [{ id: 'u1', tenantId: 'u-tenant-1' }] }],
      },
    });
    await (processAutoDeductions as any)._handler(ctx, {});
    const ledgerInsert = writes.inserts.find((w) => w.table === 'ledger_entries');
    expect(ledgerInsert.value.amount).toBe(30000); // 50k obligation − 20k credit
    expect(tables.resident_wallets[0].balance).toBe(70000);
  });

  it('a pre-booked cycle key (retry edge) is skipped, never double-booked', async () => {
    const { ctx, writes } = makeCtx({
      tables: {
        service_charges: [dueCharge()],
        resident_wallets: [fundedWallet()],
        properties: [{ _id: 'p1', id: 'p1', firmId: 'firm-1', address: '12 Marina', units: [{ id: 'u1', tenantId: 'u-tenant-1' }] }],
        ledger_entries: [{
          _id: 'led_prev', firmId: 'firm-1', unitId: 'u1', amount: 50000, type: 'service_charge',
          status: 'cleared', timestamp: NOW, txHash: 'TX-9', idempotencyKey: `wallet-deduct-sc1-${NOW - 86400000}`,
        }],
      },
    });
    const result: any = await (processAutoDeductions as any)._handler(ctx, {});
    expect(result.deductionsMade).toBe(0);
    expect(writes.inserts.filter((w) => w.table === 'ledger_entries').length).toBe(0);
    expect(writes.patches.some((p) => String(p.id) === 'w1' && p.value.balance !== undefined)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M5 — amount validation, rounding, overpayment credit
// ═══════════════════════════════════════════════════════════════════════════
describe('M5 — server-side amount validation + overpayment credit carry', () => {
  const charge = (overrides: Row = {}) => ({
    _id: 'sc1', firmId: 'firm-1', unitId: 'u1', tenantId: 'u-tenant-1', category: 'Diesel',
    amount: 100000, cycle: 'Monthly', nextDueDate: NOW + 86400000, isDefaulter: false,
    serviceChargeStatus: 'UNPAID', outstandingBalance: 100000, ...overrides,
  });

  it('zero/negative/NaN amounts are rejected by every dedicated money mutation', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: {} });
    await expect((addLedgerEntry as any)._handler(ctx, {
      firmId: 'firm-1', unitId: 'u1', amount: 0, type: 'rent', status: 'cleared', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/greater than zero/i);
    await expect((addLedgerEntry as any)._handler(ctx, {
      firmId: 'firm-1', unitId: 'u1', amount: -500, type: 'rent', status: 'cleared', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/greater than zero/i);
    await expect((addLedgerEntry as any)._handler(ctx, {
      firmId: 'firm-1', unitId: 'u1', amount: NaN, type: 'rent', status: 'cleared', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/valid number|greater than zero/i);

    await expect((markChargeAsPaid as any)._handler(ctx, {
      serviceChargeId: 'sc1', paidAmount: 0, firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow();

    await expect((applyLatePenalty as any)._handler(ctx, {
      firmId: 'firm-1', serviceChargeId: 'sc1', penaltyAmount: -100, sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow();

    await expect((upsertServiceCharge as any)._handler(ctx, {
      firmId: 'firm-1', unitId: 'u1', category: 'Diesel', amount: 0, cycle: 'Monthly', nextDueDate: NOW,
      sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow();

    await expect((fundWallet as any)._handler(ctx, {
      tenantId: 'u-tenant-1', firmId: 'firm-1', propertyId: 'p1', amount: -1000,
    })).rejects.toThrow();

    // submitPaymentProof is a PORTAL endpoint — validate with the tenant's session.
    const tenantCtx = makeCtx({ user: TENANT, session: TENANT_SESSION });
    await expect((submitPaymentProof as any)._handler(tenantCtx.ctx, {
      firmId: 'firm-1', tenantId: 'u-tenant-1', tenantEmail: 'tenant@example.com',
      storageIds: [], amount: 0, sessionToken: TENANT_SESSION.token,
    })).rejects.toThrow(/greater than zero/i);
  });

  it('overpayment credit is carried forward, not discarded (₦150k paid on a ₦100k charge)', async () => {
    const { ctx, writes, tables } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { service_charges: [charge()] },
    });
    await (markChargeAsPaid as any)._handler(ctx, {
      serviceChargeId: 'sc1', paidAmount: 150000, firmId: 'firm-1', channel: 'Bank Transfer',
      sessionToken: ADMIN_SESSION.token, idempotencyKey: 'pay-1',
    });
    const sc = tables.service_charges[0];
    expect(sc.serviceChargeStatus).toBe('PAID_FULLY');
    expect(sc.creditCarriedForward).toBe(50000);
    const ledgerInsert = writes.inserts.find((w) => w.table === 'ledger_entries');
    expect(ledgerInsert.value.amount).toBe(150000); // the FULL payment is booked
    expect(ledgerInsert.value.description).toMatch(/credit carried/i);
  });

  it('the monthly reset consumes carried-forward credit (next cycle outstanding reduced)', async () => {
    const { ctx, tables } = makeCtx({
      tables: { service_charges: [charge({ creditCarriedForward: 30000, lastResetAt: NOW - 40 * 86400000 })] },
    });
    await (resetMonthlyServiceCharges as any)._handler(ctx, {});
    const sc = tables.service_charges[0];
    expect(sc.outstandingBalance).toBe(70000); // 100k − 30k credit
    expect(sc.creditCarriedForward).toBe(0);   // fully consumed
    expect(sc.serviceChargeStatus).toBe('UNPAID');
  });

  it('the overdue flagger nets carried credit into what the tenant actually owes', async () => {
    const { ctx, tables } = makeCtx({
      tables: { service_charges: [charge({ nextDueDate: NOW - 86400000, creditCarriedForward: 25000 })] },
    });
    await (flagOverdueCharges as any)._handler(ctx, {});
    const sc = tables.service_charges[0];
    expect(sc.isDefaulter).toBe(true);
    expect(sc.outstandingBalance).toBe(75000); // 100k − 25k credit
  });

  it('money values are rounded to 2dp on write (markChargeAsPaid)', async () => {
    const { ctx, writes } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { service_charges: [charge()] },
    });
    await (markChargeAsPaid as any)._handler(ctx, {
      serviceChargeId: 'sc1', paidAmount: 100000.005, firmId: 'firm-1', channel: 'Cash',
      sessionToken: ADMIN_SESSION.token, idempotencyKey: 'pay-2',
    });
    const ledgerInsert = writes.inserts.find((w) => w.table === 'ledger_entries');
    expect(ledgerInsert.value.amount).toBe(100000.01);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M6 + M8 — atomic rent collection + server-side sequential receipt numbers
// ═══════════════════════════════════════════════════════════════════════════
describe('M6/M8 — collectRentPayment: one atomic transaction, sequential receipts', () => {
  const property = () => ({
    _id: 'p1', id: 'p1', firmId: 'firm-1', address: '12 Marina Rd',
    rentPaymentHistory: [], status: 'Available',
  });

  it('books receipt number + property history + rent & fee ledger entries atomically', async () => {
    const { ctx, writes, tables } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { properties: [property()] },
    });
    const result: any = await (collectRentPayment as any)._handler(ctx, {
      firmId: 'firm-1', propertyId: 'p1', unitId: 'u1', tenantId: 'u-tenant-1',
      amount: 500000, feeAmount: 25000, paymentMethod: 'Cash', transactionRef: 'TXN-1',
      periodStart: '2026-11-01', periodEnd: '2026-11-30', idempotencyKey: 'collect-1',
      sessionToken: ADMIN_SESSION.token,
    });
    expect(result.success).toBe(true);
    expect(result.receiptNumber).toBe('REC-00001');

    const counter = tables.financial_counters[0];
    expect(counter.value).toBe(1);
    expect(counter.scope).toBe('receipts');

    const prop = tables.properties[0];
    expect(prop.rentPaymentHistory).toHaveLength(1);
    expect(prop.rentPaymentHistory[0].receiptNumber).toBe('REC-00001');
    expect(prop.rentPaymentHistory[0].amount).toBe(500000);
    expect(prop.status).toBe('Occupied');

    const ledgerInserts = writes.inserts.filter((w) => w.table === 'ledger_entries');
    expect(ledgerInserts).toHaveLength(2);
    expect(ledgerInserts[0].value.type).toBe('rent');
    expect(ledgerInserts[0].value.status).toBe('cleared');
    expect(ledgerInserts[0].value.amount).toBe(500000);
    expect(ledgerInserts[0].value.paymentRef).toBe('REC-00001');
    expect(ledgerInserts[0].value.idempotencyKey).toBe('collect-1');
    expect(ledgerInserts[1].value.type).toBe('management_fee');
    expect(ledgerInserts[1].value.status).toBe('pending');
    expect(ledgerInserts[1].value.amount).toBe(25000);
    expect(ledgerInserts[1].value.idempotencyKey).toBe('collect-1:fee');
  });

  it('two same-second collections get DISTINCT SEQUENTIAL numbers (the M8 gate)', async () => {
    const { ctx } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { properties: [property(), { ...property(), _id: 'p2', id: 'p2', address: '3 Broad St' }] },
    });
    const first: any = await (collectRentPayment as any)._handler(ctx, {
      firmId: 'firm-1', propertyId: 'p1', unitId: 'u1', amount: 100000,
      idempotencyKey: 'collect-a', sessionToken: ADMIN_SESSION.token,
    });
    const second: any = await (collectRentPayment as any)._handler(ctx, {
      firmId: 'firm-1', propertyId: 'p2', unitId: 'u2', amount: 100000,
      idempotencyKey: 'collect-b', sessionToken: ADMIN_SESSION.token,
    });
    expect(first.receiptNumber).toBe('REC-00001');
    expect(second.receiptNumber).toBe('REC-00002');
    expect(first.receiptNumber).not.toBe(second.receiptNumber);
  });

  it('an idempotency-key replay returns the ORIGINAL receipt and books nothing new', async () => {
    const { ctx, writes } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: {
        properties: [property()],
        ledger_entries: [{
          _id: 'led_1', firmId: 'firm-1', unitId: 'u1', amount: 500000, type: 'rent',
          status: 'cleared', timestamp: NOW, txHash: 'TX-5', idempotencyKey: 'collect-1',
          paymentRef: 'REC-00007',
        }],
      },
    });
    const result: any = await (collectRentPayment as any)._handler(ctx, {
      firmId: 'firm-1', propertyId: 'p1', unitId: 'u1', amount: 500000,
      idempotencyKey: 'collect-1', sessionToken: ADMIN_SESSION.token,
    });
    expect(result.duplicate).toBe(true);
    expect(result.receiptNumber).toBe('REC-00007');
    expect(writes.inserts.filter((w) => w.table === 'ledger_entries').length).toBe(0);
    expect(writes.patches.length).toBe(0); // property untouched, counter untouched
  });

  it('rejects zero/negative rent and negative management fees before any write', async () => {
    const { ctx, writes } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION, tables: { properties: [property()] },
    });
    await expect((collectRentPayment as any)._handler(ctx, {
      firmId: 'firm-1', propertyId: 'p1', unitId: 'u1', amount: 0,
      sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/greater than zero/i);
    await expect((collectRentPayment as any)._handler(ctx, {
      firmId: 'firm-1', propertyId: 'p1', unitId: 'u1', amount: 1000, feeAmount: -50,
      sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/cannot be negative/i);
    expect(writes.inserts.length).toBe(0);
  });

  it('unauthenticated calls are rejected', async () => {
    const { ctx } = makeCtx({ tables: { properties: [property()] } });
    await expect((collectRentPayment as any)._handler(ctx, {
      firmId: 'firm-1', propertyId: 'p1', unitId: 'u1', amount: 100000,
    })).rejects.toThrow(/unauthenticated|session/i);
  });

  it('cross-firm property access is rejected', async () => {
    const { ctx } = makeCtx({
      user: OTHER_FIRM_ADMIN, session: OTHER_FIRM_SESSION,
      tables: { properties: [property()] },
    });
    await expect((collectRentPayment as any)._handler(ctx, {
      firmId: 'firm-2', propertyId: 'p1', unitId: 'u1', amount: 100000,
      sessionToken: OTHER_FIRM_SESSION.token,
    })).rejects.toThrow(/different firm|not found/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H10 — server-side outstanding balance for the resident dashboard
// ═══════════════════════════════════════════════════════════════════════════
describe('H10 — getTenantInfo returns the real outstanding balance', () => {
  it('sums open charges for the tenant (partial + unpaid, credits netted, paid/foreign excluded)', async () => {
    const { ctx } = makeCtx({
      user: TENANT, session: TENANT_SESSION,
      tables: {
        properties: [{
          _id: 'p1', id: 'p1', firmId: 'firm-1', address: '12 Marina Rd',
          units: [{ id: 'u1', currentTenantId: 'u-tenant-1', tenantEmail: 'tenant@example.com', unitName: 'Flat 1' }],
        }],
        service_charges: [
          { _id: 'sc1', firmId: 'firm-1', unitId: 'u1', tenantId: 'u-tenant-1', category: 'Diesel', amount: 50000, cycle: 'Monthly', nextDueDate: NOW, isDefaulter: false, serviceChargeStatus: 'PARTIALLY_PAID', outstandingBalance: 30000 },
          { _id: 'sc2', firmId: 'firm-1', unitId: 'u1', tenantId: 'u-tenant-1', category: 'Security', amount: 50000, cycle: 'Monthly', nextDueDate: NOW, isDefaulter: false, serviceChargeStatus: 'UNPAID', outstandingBalance: 50000 },
          { _id: 'sc3', firmId: 'firm-1', unitId: 'u1', tenantId: 'u-tenant-1', category: 'Water', amount: 20000, cycle: 'Monthly', nextDueDate: NOW, isDefaulter: false, serviceChargeStatus: 'PAID_FULLY', outstandingBalance: 0 },
          { _id: 'sc4', firmId: 'firm-1', unitId: 'u9', tenantId: 'someone-else', category: 'Diesel', amount: 99999, cycle: 'Monthly', nextDueDate: NOW, isDefaulter: false, serviceChargeStatus: 'UNPAID', outstandingBalance: 99999 },
          { _id: 'sc5', firmId: 'firm-1', unitId: 'u1', tenantId: 'u-tenant-1', category: 'Cleaning', amount: 10000, cycle: 'Monthly', nextDueDate: NOW, isDefaulter: false, serviceChargeStatus: 'UNPAID', outstandingBalance: 10000, creditCarriedForward: 4000 },
        ],
      },
    });
    const result: any = await (getTenantInfo as any)._handler(ctx, {
      firmId: 'firm-1', userId: 'u-tenant-1', email: 'tenant@example.com',
      sessionToken: TENANT_SESSION.token,
    });
    // 30k (partial) + 50k (unpaid) + (10k − 4k credit) = 86k
    expect(result.outstandingBalance).toBe(86000);
  });

  it('a tenant with everything paid sees 0', async () => {
    const { ctx } = makeCtx({
      user: TENANT, session: TENANT_SESSION,
      tables: {
        properties: [{
          _id: 'p1', id: 'p1', firmId: 'firm-1', address: '12 Marina Rd',
          units: [{ id: 'u1', currentTenantId: 'u-tenant-1', tenantEmail: 'tenant@example.com' }],
        }],
        service_charges: [
          { _id: 'sc1', firmId: 'firm-1', unitId: 'u1', tenantId: 'u-tenant-1', category: 'Diesel', amount: 50000, cycle: 'Monthly', nextDueDate: NOW, isDefaulter: false, serviceChargeStatus: 'PAID_FULLY', outstandingBalance: 0 },
        ],
      },
    });
    const result: any = await (getTenantInfo as any)._handler(ctx, {
      firmId: 'firm-1', userId: 'u-tenant-1', email: 'tenant@example.com',
      sessionToken: TENANT_SESSION.token,
    });
    expect(result.outstandingBalance).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M7 — the Paystack webhook settles proofs (verified amount) + race self-heal
// ═══════════════════════════════════════════════════════════════════════════
describe('M7 — Paystack webhook verification books the VERIFIED amount', () => {
  it('charge.success settles a pending_verification proof and books the Paystack amount (claim corrected)', async () => {
    const { ctx, writes, tables } = makeCtx({
      tables: {
        payment_proofs: [proofFixture({
          status: 'pending_verification', paymentMethod: 'paystack',
          paystackReference: 'PS-REF-1', amount: 500, // tenant mis-typed the amount
        })],
      },
    });
    await (recordPaystackEvent as any)._handler(ctx, {
      eventId: 'evt-1', eventType: 'charge.success', reference: 'PS-REF-1',
      amount: 5000, status: 'success', raw: {},
    });
    const proof = tables.payment_proofs[0];
    expect(proof.status).toBe('verified');
    expect(proof.amount).toBe(5000); // corrected to the verified figure
    const ledgerInsert = writes.inserts.find((w) => w.table === 'ledger_entries');
    expect(ledgerInsert).toBeTruthy();
    expect(ledgerInsert.value.amount).toBe(5000);
    expect(ledgerInsert.value.idempotencyKey).toBe('proof-approved-proof_1');
    expect(tables.paystackEvents).toHaveLength(1); // event recorded
  });

  it('legacy pending_review proofs carrying a reference also settle (pre-H19 data)', async () => {
    const { ctx, writes } = makeCtx({
      tables: {
        payment_proofs: [proofFixture({
          status: 'pending_review', paymentMethod: 'paystack', paystackReference: 'PS-REF-2',
        })],
      },
    });
    await (recordPaystackEvent as any)._handler(ctx, {
      eventId: 'evt-2', eventType: 'charge.success', reference: 'PS-REF-2',
      amount: 250000, status: 'success', raw: {},
    });
    const ledgerInsert = writes.inserts.find((w) => w.table === 'ledger_entries');
    expect(ledgerInsert).toBeTruthy();
    expect(ledgerInsert.value.amount).toBe(250000);
  });

  it('a webhook redelivery is a no-op (event dedup) — money booked exactly once', async () => {
    const { ctx, writes } = makeCtx({
      tables: {
        payment_proofs: [proofFixture({
          status: 'pending_verification', paymentMethod: 'paystack', paystackReference: 'PS-REF-3',
        })],
        paystackEvents: [{
          _id: 'pe_1', eventId: 'evt-3', eventType: 'charge.success', reference: 'PS-REF-3',
          amount: 250000, status: 'success', receivedAt: new Date().toISOString(),
        }],
      },
    });
    await (recordPaystackEvent as any)._handler(ctx, {
      eventId: 'evt-3', eventType: 'charge.success', reference: 'PS-REF-3',
      amount: 250000, status: 'success', raw: {},
    });
    // Duplicate event → early return; the proof is untouched for the settle path.
    expect(writes.inserts.filter((w) => w.table === 'ledger_entries').length).toBe(0);
  });

  it('submitPaymentProof self-heals when the webhook landed BEFORE the proof (the race)', async () => {
    const { ctx, writes, tables } = makeCtx({
      user: TENANT, session: TENANT_SESSION,
      tables: {
        paystackEvents: [{
          _id: 'pe_1', eventId: 'evt-9', eventType: 'charge.success', reference: 'PS-REF-RACE',
          amount: 120000, status: 'success', receivedAt: new Date().toISOString(),
        }],
      },
    });
    const proofId = await (submitPaymentProof as any)._handler(ctx, {
      firmId: 'firm-1', tenantId: 'u-tenant-1', tenantName: 'Tayo Tenant',
      tenantEmail: 'tenant@example.com', propertyId: 'p1', unitId: 'u1',
      amount: 120000, paymentMethod: 'paystack', paystackReference: 'PS-REF-RACE',
      storageIds: [], sessionToken: TENANT_SESSION.token,
    });
    const proof = tables.payment_proofs[0];
    expect(proof.status).toBe('verified'); // settled immediately, not stranded
    const ledgerInsert = writes.inserts.find((w) => w.table === 'ledger_entries');
    expect(ledgerInsert).toBeTruthy();
    expect(ledgerInsert.value.amount).toBe(120000);
    expect(proof.ledgerEntryId).toBe(String(ledgerInsert.value && tables.ledger_entries[0]._id));
    expect(proofId).toBeTruthy();
  });

  it('a normal Paystack submission (webhook not yet arrived) stays pending_verification, unbooked', async () => {
    const { ctx, writes, tables } = makeCtx({ user: TENANT, session: TENANT_SESSION });
    await (submitPaymentProof as any)._handler(ctx, {
      firmId: 'firm-1', tenantId: 'u-tenant-1', tenantEmail: 'tenant@example.com',
      propertyId: 'p1', unitId: 'u1', amount: 90000, paymentMethod: 'paystack',
      paystackReference: 'PS-REF-NORMAL', storageIds: [], sessionToken: TENANT_SESSION.token,
    });
    expect(tables.payment_proofs[0].status).toBe('pending_verification');
    expect(writes.inserts.filter((w) => w.table === 'ledger_entries').length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The reconciliation checker
// ═══════════════════════════════════════════════════════════════════════════
describe('Reconciliation checker — ledger ↔ wallet ↔ proofs ↔ receipts', () => {
  it('consistent books → ok:true (the demo-firm gate)', async () => {
    const { ctx, tables } = makeCtx({
      tables: {
        wallet_transactions: [{
          _id: 'wtx_1', walletId: 'w1', tenantId: 'u-tenant-1', firmId: 'firm-1', type: 'debit',
          amount: 50000, previousBalance: 100000, newBalance: 50000, currency: 'NGN',
          reason: 'Auto-deduct', reference: 'TXN-1', chargeId: 'sc1',
          ledgerIdempotencyKey: 'wallet-deduct-sc1-1000', timestamp: POST_CUTOFF,
        }],
        ledger_entries: [
          { _id: 'led_1', firmId: 'firm-1', unitId: 'u1', amount: 50000, type: 'service_charge', status: 'cleared', timestamp: POST_CUTOFF, txHash: 'T1', idempotencyKey: 'wallet-deduct-sc1-1000', channel: 'Wallet Auto-Deduct' },
          { _id: 'led_2', firmId: 'firm-1', unitId: 'u1', amount: 250000, type: 'rent', status: 'cleared', timestamp: POST_CUTOFF, txHash: 'T2', idempotencyKey: 'proof-approved-proof_1', paymentRef: 'REC-00001' },
        ],
        payment_proofs: [{
          _id: 'proof_1', firmId: 'firm-1', tenantId: 'u-tenant-1', amount: 250000,
          status: 'approved', ledgerEntryId: 'led_2', createdAt: POST_CUTOFF, updatedAt: POST_CUTOFF,
        }],
        resident_wallets: [{
          _id: 'w1', tenantId: 'u-tenant-1', firmId: 'firm-1', propertyId: 'p1', balance: 50000,
          currency: 'NGN', autoDeductEnabled: true, status: 'active', createdAt: POST_CUTOFF, updatedAt: POST_CUTOFF,
        }],
      },
    });
    const summary: any = await (runFinancialReconciliation as any)._handler(ctx, {});
    expect(summary.ok).toBe(true);
    expect(summary.walletDebitsWithoutLedger).toBe(0);
    expect(summary.approvedProofsUnbooked).toBe(0);
    expect(summary.balanceDriftWallets).toBe(0);
    expect(tables.financial_reconciliation_reports).toHaveLength(1);
    expect(tables.financial_reconciliation_reports[0].ok).toBe(true);
  });

  it('a post-cutoff wallet debit without its ledger row REDS the run (the H2 invariant)', async () => {
    const { ctx } = makeCtx({
      tables: {
        wallet_transactions: [{
          _id: 'wtx_1', walletId: 'w1', tenantId: 't', firmId: 'firm-1', type: 'debit',
          amount: 50000, previousBalance: 100000, newBalance: 50000, currency: 'NGN',
          reason: 'Auto-deduct', reference: 'TXN-1', chargeId: 'sc1',
          ledgerIdempotencyKey: 'wallet-deduct-sc1-1000', timestamp: POST_CUTOFF,
          // …but NO matching ledger row exists
        }],
      },
    });
    const summary: any = await (runFinancialReconciliation as any)._handler(ctx, {});
    expect(summary.ok).toBe(false);
    expect(summary.walletDebitsWithoutLedger).toBe(1);
  });

  it('a post-cutoff approved proof without a ledger link REDS the run (the H1 invariant)', async () => {
    const { ctx } = makeCtx({
      tables: {
        payment_proofs: [{
          _id: 'proof_1', firmId: 'firm-1', tenantId: 't', amount: 250000,
          status: 'approved', createdAt: POST_CUTOFF, updatedAt: POST_CUTOFF,
          // no ledgerEntryId
        }],
      },
    });
    const summary: any = await (runFinancialReconciliation as any)._handler(ctx, {});
    expect(summary.ok).toBe(false);
    expect(summary.approvedProofsUnbooked).toBe(1);
  });

  it('duplicate server receipt numbers on rent entries RED the run (the M8 invariant)', async () => {
    const { ctx } = makeCtx({
      tables: {
        ledger_entries: [
          { _id: 'led_1', firmId: 'firm-1', unitId: 'u1', amount: 100, type: 'rent', status: 'cleared', timestamp: POST_CUTOFF, txHash: 'T1', paymentRef: 'REC-00001' },
          { _id: 'led_2', firmId: 'firm-1', unitId: 'u2', amount: 100, type: 'rent', status: 'cleared', timestamp: POST_CUTOFF, txHash: 'T2', paymentRef: 'REC-00001' },
        ],
      },
    });
    const summary: any = await (runFinancialReconciliation as any)._handler(ctx, {});
    expect(summary.ok).toBe(false);
    expect(summary.duplicateReceiptNumbers).toBe(1);
  });

  it('pre-Round-B legacy rows land in the legacy buckets WITHOUT redding the run', async () => {
    const pre = ROUND_B_CUTOFF_MS - 86400000;
    const { ctx } = makeCtx({
      tables: {
        wallet_transactions: [{
          _id: 'wtx_old', walletId: 'w_old', tenantId: 't', firmId: 'firm-1', type: 'debit',
          amount: 5000, previousBalance: 6000, newBalance: 1000, currency: 'NGN',
          reason: 'Auto-deduct (pre-Round-B)', reference: 'TXN-OLD', chargeId: 'sc_old',
          timestamp: pre, // no ledgerIdempotencyKey — legacy writer
        }],
        payment_proofs: [{
          _id: 'proof_old', firmId: 'firm-1', tenantId: 't', amount: 9000,
          status: 'approved', createdAt: pre, updatedAt: pre,
        }],
        resident_wallets: [{
          _id: 'w_old', tenantId: 't', firmId: 'firm-1', propertyId: 'p', balance: 1000,
          currency: 'NGN', autoDeductEnabled: true, status: 'active', createdAt: pre, updatedAt: pre,
        }],
      },
    });
    const summary: any = await (runFinancialReconciliation as any)._handler(ctx, {});
    expect(summary.legacyWalletDebits).toBe(1);
    expect(summary.legacyApprovedProofs).toBe(1);
    expect(summary.ok).toBe(true); // historical data never reds a healthy deployment
  });

  it('wallet balance drift (balance changed without a transaction) is reported', async () => {
    const { ctx } = makeCtx({
      tables: {
        wallet_transactions: [{
          _id: 'wtx_1', walletId: 'w1', tenantId: 't', firmId: 'firm-1', type: 'credit',
          amount: 5000, previousBalance: 0, newBalance: 5000, currency: 'NGN',
          reason: 'Top-up', reference: 'TXN-1', timestamp: POST_CUTOFF,
        }],
        resident_wallets: [{
          _id: 'w1', tenantId: 't', firmId: 'firm-1', propertyId: 'p', balance: 4000, // drifted!
          currency: 'NGN', autoDeductEnabled: true, status: 'active', createdAt: POST_CUTOFF, updatedAt: POST_CUTOFF,
        }],
      },
    });
    const summary: any = await (runFinancialReconciliation as any)._handler(ctx, {});
    expect(summary.balanceDriftWallets).toBe(1);
    expect(summary.ok).toBe(true); // drift is informational, not a structural gap
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Source contracts — UI wiring that cannot be imported directly
// ═══════════════════════════════════════════════════════════════════════════
describe('Source contracts — money-path UI wiring', () => {
  it('H8: DashboardTab passes the session bearer to getMyWallet + toggleAutoDeduct', () => {
    const src = read('src/components/tenant/TenantPortal/DashboardTab.tsx');
    expect(src).toMatch(/getMyWallet,[^]*sessionToken:\s*bearerToken/);
    expect(src).toMatch(/toggleAutoDeduct\?\.\(\{[^]*sessionToken:\s*bearerToken/);
  });

  it('M6: CollectRentModal uses the atomic collectRentPayment (no client minted receipt numbers)', () => {
    const src = read('src/components/modals/CollectRentModal.tsx');
    expect(src).toMatch(/useMutation\(api\.sentry\.collectRentPayment\)/);
    expect(src).toMatch(/mutationName:\s*'collectRentPayment'/);
    // The old client-minted random receipt number is gone from BOTH paths.
    expect(src).not.toMatch(/REC-\$\{Date\.now\(\)/);
  });

  it('M18: PaymentsTab takes Paystack availability + key from the server (pk_test fallback gone)', () => {
    const src = read('src/components/tenant/TenantPortal/PaymentsTab.tsx');
    expect(src).toMatch(/api\.paystack\.isPaystackActive/);
    // The client-side key lookup (hardcoded pk_test fallback) is gone from code —
    // only explanatory comments may mention the old constant by name.
    expect(src).not.toMatch(/VITE_PAYSTACK_PUBLIC_KEY/);
    expect(src).not.toMatch(/const PAYSTACK_PUBLIC_KEY/);
  });

  it('H1: PaymentProofsTab passes confirmedAmount / charge link on approval', () => {
    const src = read('src/components/atrium/PaymentProofsTab.tsx');
    expect(src).toMatch(/confirmedAmount/);
    expect(src).toMatch(/serviceChargeId/);
  });

  it('H13: money mutations in ServiceChargeMonitor + LedgerManager surface failures', () => {
    const monitor = read('src/components/atrium/ServiceChargeMonitor.tsx');
    expect(monitor).toMatch(/ROUND B \(H13\)/);
    expect(monitor).toMatch(/Failed to record the payment/);
    const ledger = read('src/components/atrium/LedgerManager.tsx');
    expect(ledger).toMatch(/ROUND B \(H13\)/);
    expect(ledger).toMatch(/Failed to save the ledger entry/);
  });

  it('the reconciliation cron is registered daily (after auto-deduct settles)', () => {
    const src = read('convex/crons.ts');
    expect(src).toMatch(/crons\.daily\(\s*"financialReconciliation"/);
    expect(src).toMatch(/internal\.financialIntegrity\.runFinancialReconciliation/);
  });

  it('the offline queue can replay collectRentPayment', () => {
    const src = read('src/hooks/useOfflineQueue.ts');
    expect(src).toMatch(/'collectRentPayment'/);
    expect(src).toMatch(/collectRentPayment:\s*collectRentPaymentMutation/);
  });
});
