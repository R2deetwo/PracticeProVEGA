/**
 * roundFWave2.test.ts — ROUND F (Wave F2) regression tests.
 *
 * Wave F2 shipped the interactive reconciliation workflow — the §4 capstone:
 * the unallocated queue (getUnallocatedPayments), the audited match
 * (matchProofToCharge), the faithful reversal (reverseMatch), the status
 * reads (getReconciliationMatches, getReconciliationReportHistory) and the
 * checker's informational queue extension. Every contract is pinned in BOTH
 * directions:
 *   • the BROKEN behaviour is impossible (unauthenticated / portal /
 *     cross-firm rejected; double-match is a no-op; a PAID_FULLY charge
 *     refuses loudly; short reasons rejected; the MONEY is never moved by a
 *     match — zero new ledger rows, ever),
 *   • the legitimate workflows succeed (partial/full/overpay-credit state
 *     math, faithful snapshot restoration, the queue re-opening).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Convex functions under test ─────────────────────────────────────────────
import {
  getUnallocatedPayments,
  matchProofToCharge,
  reverseMatch,
  getReconciliationMatches,
  getReconciliationReportHistory,
} from '../../convex/reconciliationWorkflow';
import { runFinancialReconciliation, ROUND_B_CUTOFF_MS } from '../../convex/financialIntegrity';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed mock ctx (Round A/B/F1 harness) ──────────────────────────
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

const NOW = Date.now();
const POST_CUTOFF = Math.max(ROUND_B_CUTOFF_MS + 3600_000, NOW - 1000);

// ── Fixture builders ─────────────────────────────────────────────────────────
function proofFixture(overrides: Row = {}): Row {
  return {
    _id: 'proof_unmatched',
    firmId: 'firm-1',
    tenantId: 'u-tenant-1',
    tenantName: 'Tayo Tenant',
    tenantEmail: 'tenant@example.com',
    propertyId: 'p1',
    unitId: 'u1',
    amount: 30000,
    period: 'November 2026',
    description: 'Diesel levy',
    storageIds: [],
    status: 'approved',
    paymentMethod: 'bank_transfer',
    paystackReference: null,
    ledgerEntryId: 'led_proof_1',
    createdAt: POST_CUTOFF,
    updatedAt: POST_CUTOFF,
    ...overrides,
  };
}

function chargeFixture(overrides: Row = {}): Row {
  return {
    _id: 'sc_open',
    firmId: 'firm-1',
    unitId: 'u1',
    tenantId: 'u-tenant-1',
    category: 'Diesel',
    amount: 100000,
    cycle: 'Monthly',
    nextDueDate: NOW - 2 * 86400000,
    isDefaulter: false,
    serviceChargeStatus: 'UNPAID',
    ...overrides,
  };
}

function queueTables(extra: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    payment_proofs: [
      proofFixture(), // settled, no link, no match → IN the queue
      proofFixture({ _id: 'proof_linked', linkedChargeId: 'sc_open' }), // linked at settlement → NOT in queue
      proofFixture({ _id: 'proof_pending', status: 'pending_review' }), // not settled → NOT in queue
      proofFixture({ _id: 'proof_nomoney', amount: 0 }), // settled without money → NOT in queue
      proofFixture({ _id: 'proof_firm2', firmId: 'firm-2' }), // foreign → NOT in queue
    ],
    service_charges: [
      chargeFixture(), // no credit → not in the credits section
      chargeFixture({ _id: 'sc_credit', creditCarriedForward: 5000, serviceChargeStatus: 'UNPAID' }),
    ],
    reconciliation_matches: [],
    ...extra,
  };
}

beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(NOW); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// ═══════════════════════════════════════════════════════════════════════════
// The unallocated queue
// ═══════════════════════════════════════════════════════════════════════════
describe('F2 §4 — getUnallocatedPayments (the queue)', () => {
  it('auth quartet: staff ok; dead token, portal and cross-firm rejected', async () => {
    const ok = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: queueTables() });
    const r: any = await (getUnallocatedPayments as any)._handler(ok.ctx, {
      firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
    });
    expect(r.unmatchedCount).toBe(1);

    const dead = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: queueTables() });
    await expect((getUnallocatedPayments as any)._handler(dead.ctx, {
      firmId: 'firm-1', sessionToken: 'tok-dead',
    })).rejects.toThrow(/Unauthenticated/i);

    const portal = makeCtx({ user: TENANT, session: TENANT_SESSION, tables: queueTables() });
    await expect((getUnallocatedPayments as any)._handler(portal.ctx, {
      firmId: 'firm-1', sessionToken: TENANT_SESSION.token,
    })).rejects.toThrow();

    const cross = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: queueTables() });
    await expect((getUnallocatedPayments as any)._handler(cross.ctx, {
      firmId: 'firm-2', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow();
  });

  it('lists exactly the settled proofs with money, no link and no active match; credits section lists creditCarriedForward', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: queueTables() });
    const r: any = await (getUnallocatedPayments as any)._handler(ctx, {
      firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
    });
    expect(r.unmatchedProofs.map((p: any) => p.id)).toEqual(['proof_unmatched']);
    expect(r.unmatchedTotal).toBe(30000);
    expect(r.creditsWaiting.map((c: any) => c.id)).toEqual(['sc_credit']);
    expect(r.creditsTotal).toBe(5000);
  });

  it('an active match takes the proof OUT of the queue; a reversed match puts it BACK', async () => {
    const matched = queueTables();
    matched.reconciliation_matches = [
      {
        _id: 'match_1', firmId: 'firm-1', proofId: 'proof_unmatched', chargeId: 'sc_open',
        matchedAmount: 30000, chargeBefore: {}, matchedBy: 'admin@example.com', matchedAt: NOW,
        reason: 'bank alert for diesel', status: 'active',
      },
    ];
    const { ctx: ctxMatched } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: matched });
    const matchedResult: any = await (getUnallocatedPayments as any)._handler(ctxMatched, {
      firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
    });
    expect(matchedResult.unmatchedCount).toBe(0);

    const reversed = queueTables();
    reversed.reconciliation_matches = [
      {
        _id: 'match_1', firmId: 'firm-1', proofId: 'proof_unmatched', chargeId: 'sc_open',
        matchedAmount: 30000, chargeBefore: {}, matchedBy: 'admin@example.com', matchedAt: NOW - 86400000,
        reason: 'bank alert for diesel', status: 'reversed', reversedAt: NOW, reversedBy: 'admin@example.com',
        reversalReason: 'wrong charge',
      },
    ];
    const { ctx: ctxReversed } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: reversed });
    const reversedResult: any = await (getUnallocatedPayments as any)._handler(ctxReversed, {
      firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
    });
    expect(reversedResult.unmatchedCount).toBe(1); // re-opened
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// matchProofToCharge
// ═══════════════════════════════════════════════════════════════════════════
describe('F2 §4 — matchProofToCharge (the audited match)', () => {
  async function runMatch(ctx: any, args: Row = {}) {
    return (matchProofToCharge as any)._handler(ctx, {
      firmId: 'firm-1',
      proofId: 'proof_unmatched',
      chargeId: 'sc_open',
      reason: 'Bank alert for the October diesel levy',
      sessionToken: ADMIN_SESSION.token,
      ...args,
    });
  }

  it('partial payment: settles the charge state, records the join, patches the proof link, audits — and moves NO money', async () => {
    const { ctx, writes, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: queueTables() });
    const ledgerInsertsBefore = 0;
    const r: any = await runMatch(ctx);
    expect(r.success).toBe(true);
    expect(r.duplicate).toBe(false);
    expect(r.chargeStatus).toBe('PARTIALLY_PAID');
    expect(r.outstanding).toBe(70000);

    // The charge state math (kobo-internal, same as settlement-time linkage).
    const charge = tables.service_charges.find((c: any) => c._id === 'sc_open') as any;
    expect(charge.serviceChargeStatus).toBe('PARTIALLY_PAID');
    expect(charge.outstandingBalance).toBe(70000);
    expect(charge.amountPaidThisCycle).toBe(30000);
    expect(charge.lastPaidDate).toBe(NOW);
    expect(charge.consecutiveReminderCount).toBe(0);

    // The proof linkage is persisted.
    const proof = tables.payment_proofs.find((p: any) => p._id === 'proof_unmatched') as any;
    expect(proof.linkedChargeId).toBe('sc_open');

    // The match row with its before-snapshot + reason + actor.
    const match = tables.reconciliation_matches[0] as any;
    expect(match.status).toBe('active');
    expect(match.reason).toContain('diesel');
    expect(match.matchedBy).toBe('admin@example.com');
    expect(match.chargeBefore.serviceChargeStatus).toBe('UNPAID');

    // MONEY UNTOUCHED: zero ledger writes; the audit row exists.
    expect(writes.inserts.filter((w: any) => w.table === 'ledger_entries').length).toBe(ledgerInsertsBefore);
    const auditInserts = writes.inserts.filter((w: any) => w.table === 'financial_audit_log');
    expect(auditInserts.length).toBe(1);
    expect(auditInserts[0].value.action).toBe('reconcile_match');
    expect(auditInserts[0].value.reason).toContain('diesel');
  });

  it('full payment with overpay: PAID_FULLY, credit carried, cycle advanced, defaulter cleared', async () => {
    const tables = queueTables();
    tables.payment_proofs = [proofFixture({ amount: 150000 })];
    tables.service_charges = [chargeFixture({ isDefaulter: true, daysOverdue: 40 })];
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables });
    const r: any = await runMatch(ctx);
    expect(r.chargeStatus).toBe('PAID_FULLY');
    expect(r.credit).toBe(50000);
    const charge = tables.service_charges[0] as any;
    expect(charge.creditCarriedForward).toBe(50000);
    expect(charge.outstandingBalance).toBe(0);
    expect(charge.amountPaidThisCycle).toBe(0);
    expect(charge.isDefaulter).toBe(false);
    expect(charge.daysOverdue).toBe(0);
    expect(Number(charge.nextDueDate)).toBeGreaterThan(NOW); // cycle advanced
  });

  it('re-match is a no-op returning the ORIGINAL match (exactly-once per payment)', async () => {
    const { ctx, writes, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: queueTables() });
    const first: any = await runMatch(ctx);
    const patchesAfterFirst = writes.patches.length;
    const second: any = await runMatch(ctx);
    expect(second.duplicate).toBe(true);
    expect(second.matchId).toBe(first.matchId);
    expect(writes.patches.length).toBe(patchesAfterFirst); // zero new writes
    expect(tables.reconciliation_matches.length).toBe(1); // still ONE match row
  });

  it('PAID_FULLY charge refuses loudly (never a silent double-credit)', async () => {
    const tables = queueTables();
    tables.service_charges = [chargeFixture({ serviceChargeStatus: 'PAID_FULLY' })];
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables });
    await expect(runMatch(ctx)).rejects.toThrow(/already paid in full/i);
  });

  it('guards: unsettled proof, moneyless proof, cross-firm proof/charge, short reason, dead token, portal', async () => {
    const pending = queueTables();
    pending.payment_proofs = [proofFixture({ status: 'pending_review' })];
    await expect(runMatch(makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: pending }).ctx))
      .rejects.toThrow(/settled proofs/i);

    const moneyless = queueTables();
    moneyless.payment_proofs = [proofFixture({ amount: 0 })];
    await expect(runMatch(makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: moneyless }).ctx))
      .rejects.toThrow(/no money/i);

    const foreignProof = queueTables();
    foreignProof.payment_proofs = [proofFixture({ firmId: 'firm-2' })];
    await expect(runMatch(makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: foreignProof }).ctx))
      .rejects.toThrow(/does not belong to your firm/i);

    const foreignCharge = queueTables();
    foreignCharge.service_charges = [chargeFixture({ firmId: 'firm-2' })];
    await expect(runMatch(makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: foreignCharge }).ctx))
      .rejects.toThrow(/does not belong to your firm/i);

    await expect(runMatch(makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: queueTables() }).ctx, { reason: 'ok' }))
      .rejects.toThrow(/reason is required/i);

    await expect(runMatch(makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: queueTables() }).ctx, { sessionToken: 'tok-dead' }))
      .rejects.toThrow(/Unauthenticated/i);

    await expect(runMatch(makeCtx({ user: TENANT, session: TENANT_SESSION, tables: queueTables() }).ctx, { sessionToken: TENANT_SESSION.token }))
      .rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// reverseMatch
// ═══════════════════════════════════════════════════════════════════════════
describe('F2 §4 — reverseMatch (the faithful reversal)', () => {
  async function matchFirst(ctx: any) {
    return (matchProofToCharge as any)._handler(ctx, {
      firmId: 'firm-1', proofId: 'proof_unmatched', chargeId: 'sc_open',
      reason: 'Bank alert for the October diesel levy', sessionToken: ADMIN_SESSION.token,
    });
  }

  it('restores the charge from the before-snapshot, reverses the match, re-opens the proof, audits', async () => {
    const { ctx, writes, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: queueTables() });
    const matched: any = await matchFirst(ctx);
    expect(tables.service_charges.find((c: any) => c._id === 'sc_open')!.serviceChargeStatus).toBe('PARTIALLY_PAID');

    const r: any = await (reverseMatch as any)._handler(ctx, {
      firmId: 'firm-1', matchId: matched.matchId,
      reason: 'Matched to the wrong charge — reversing to re-match correctly',
      sessionToken: ADMIN_SESSION.token,
    });
    expect(r.success).toBe(true);
    expect(r.chargeRestored).toBe(true);
    expect(r.proofReopened).toBe(true);

    // The charge is EXACTLY its pre-match self (from the snapshot, not recomputed).
    const charge = tables.service_charges.find((c: any) => c._id === 'sc_open') as any;
    expect(charge.serviceChargeStatus).toBe('UNPAID');
    expect(charge.outstandingBalance).toBeUndefined();
    expect(charge.amountPaidThisCycle).toBeUndefined();

    // The match is reversed with its reason; the proof re-opened.
    const match = tables.reconciliation_matches[0] as any;
    expect(match.status).toBe('reversed');
    expect(match.reversalReason).toContain('wrong charge');
    const proof = tables.payment_proofs.find((p: any) => p._id === 'proof_unmatched') as any;
    expect(proof.linkedChargeId).toBeUndefined();

    // Audited: match reversal + charge restore.
    const audits = writes.inserts.filter((w: any) => w.table === 'financial_audit_log');
    expect(audits.some((a: any) => a.value.action === 'reconcile_reversal')).toBe(true);
    expect(audits.some((a: any) => a.value.action === 'reconcile_reversal_restore')).toBe(true);
  });

  it('double reversal and guards: only active, short reason, cross-firm, dead token, portal', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: queueTables() });
    const matched: any = await matchFirst(ctx);

    await expect((reverseMatch as any)._handler(ctx, {
      firmId: 'firm-1', matchId: 'match_missing', reason: 'not found case', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/not found/i);

    await expect((reverseMatch as any)._handler(ctx, {
      firmId: 'firm-1', matchId: matched.matchId, reason: 'no', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/reason is required/i);

    await expect((reverseMatch as any)._handler(ctx, {
      firmId: 'firm-2', matchId: matched.matchId, reason: 'cross firm attempt', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow();

    const reversed: any = await (reverseMatch as any)._handler(ctx, {
      firmId: 'firm-1', matchId: matched.matchId, reason: 'Correcting the books', sessionToken: ADMIN_SESSION.token,
    });
    expect(reversed.success).toBe(true);

    await expect((reverseMatch as any)._handler(ctx, {
      firmId: 'firm-1', matchId: matched.matchId, reason: 'Second reversal attempt', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/only active/i);

    expect(tables.reconciliation_matches.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Status reads + the checker extension
// ═══════════════════════════════════════════════════════════════════════════
describe('F2 §4 — status reads + the checker extension', () => {
  it('getReconciliationMatches returns newest-first with status; by_proof filter works', async () => {
    const tables = queueTables();
    tables.reconciliation_matches = [
      { _id: 'm_old', firmId: 'firm-1', proofId: 'proof_a', chargeId: 'sc_open', matchedAmount: 1000, reason: 'old', matchedAt: NOW - 5000, status: 'active' },
      { _id: 'm_new', firmId: 'firm-1', proofId: 'proof_unmatched', chargeId: 'sc_credit', matchedAmount: 2000, reason: 'new', matchedAt: NOW, status: 'active' },
      { _id: 'm_firm2', firmId: 'firm-2', proofId: 'proof_x', chargeId: 'sc_y', matchedAmount: 3000, reason: 'foreign', matchedAt: NOW, status: 'active' },
    ];
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables });
    const rows: any[] = await (getReconciliationMatches as any)._handler(ctx, {
      firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
    });
    expect(rows.map((r: any) => r.id)).toEqual(['m_new', 'm_old']); // newest first, firm-scoped

    const byProof: any[] = await (getReconciliationMatches as any)._handler(ctx, {
      firmId: 'firm-1', proofId: 'proof_unmatched', sessionToken: ADMIN_SESSION.token,
    });
    expect(byProof.map((r: any) => r.id)).toEqual(['m_new']);
  });

  it('the checker reports the queues as INFORMATIONAL (ok unchanged by an unmatched payment)', async () => {
    // Consistent books + one unmatched settled proof → ok:true, queue 1.
    // (The checker is GLOBAL across firms — the fixture keeps only the
    // proofs the queue should actually count.)
    const tables = queueTables({ ledger_entries: [], wallet_transactions: [] });
    tables.payment_proofs = [
      proofFixture(), // settled, unlinked, unmatched → the queue
      proofFixture({ _id: 'proof_linked', linkedChargeId: 'sc_open' }), // linked → never queued
    ];
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables });
    const summary: any = await (runFinancialReconciliation as any)._handler(ctx, {});
    expect(summary.ok).toBe(true);
    expect(summary.unmatchedSettledProofs).toBe(1);
    expect(summary.creditsWaiting).toBe(1);
    expect(summary.creditsWaitingTotal).toBe(5000);

    // With the proof actively matched → the queue drops to zero.
    const matchedTables = queueTables({ ledger_entries: [], wallet_transactions: [] });
    matchedTables.payment_proofs = [
      proofFixture(),
      proofFixture({ _id: 'proof_linked', linkedChargeId: 'sc_open' }),
    ];
    matchedTables.reconciliation_matches = [
      { _id: 'm1', firmId: 'firm-1', proofId: 'proof_unmatched', chargeId: 'sc_open', matchedAmount: 30000, reason: 'r', matchedAt: NOW, status: 'active' },
    ];
    const { ctx: ctxMatched } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: matchedTables });
    const summaryMatched: any = await (runFinancialReconciliation as any)._handler(ctxMatched, {});
    expect(summaryMatched.ok).toBe(true);
    expect(summaryMatched.unmatchedSettledProofs).toBe(0);
  });

  it('getReconciliationReportHistory returns the rows newest-first with the queue fields', async () => {
    const tables = queueTables();
    tables.financial_reconciliation_reports = [
      { _id: 'rep_1', ranAt: NOW, ok: true, walletDebitsWithoutLedger: 0, approvedProofsUnbooked: 0, invalidAmountRows: 0, duplicateReceiptNumbers: 0, balanceDriftWallets: 0, legacyWalletDebits: 0, legacyApprovedProofs: 0, unmatchedSettledProofs: 2, creditsWaiting: 1 },
      { _id: 'rep_0', ranAt: NOW - 86400000, ok: false, walletDebitsWithoutLedger: 1, approvedProofsUnbooked: 0, invalidAmountRows: 0, duplicateReceiptNumbers: 0, balanceDriftWallets: 0, legacyWalletDebits: 0, legacyApprovedProofs: 0, unmatchedSettledProofs: 0, creditsWaiting: 0 },
    ];
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables });
    const rows: any[] = await (getReconciliationReportHistory as any)._handler(ctx, {
      firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
    });
    expect(rows.map((r: any) => r.id)).toEqual(['rep_1', 'rep_0']);
    expect(rows[0].ok).toBe(true);
    expect(rows[0].unmatchedSettledProofs).toBe(2);
    expect(rows[1].ok).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Source contracts
// ═══════════════════════════════════════════════════════════════════════════
describe('F2 — source contracts', () => {
  it('ReconciliationConsole is ui-primitives only (interactive elements via ui/)', () => {
    const src = read('src/components/atrium/ReconciliationConsole.tsx');
    expect(src).toContain("from '../ui'");
    // Case-sensitive: <Button/<Input/<Select are the ALLOWED ui primitives;
    // raw <button/<input/<select are the ADR-0004 violations.
    expect(src).not.toMatch(/<button\s/);
    expect(src).not.toMatch(/<input\s/);
    expect(src).not.toMatch(/<select\s/);
  });

  it('BillingView wires the reconcile tab', () => {
    const bv = read('src/components/BillingView.tsx');
    expect(bv).toContain("import ReconciliationConsole from './atrium/ReconciliationConsole'");
    expect(bv).toContain("{ id: 'reconcile', label: 'Reconciliation', productTag: 'Property' }");
    expect(bv).toContain("activeTab === 'reconcile'");
  });

  it('the schema carries the F2 additions (linkedChargeId, reconciliation_matches, report queue fields)', () => {
    const schema = read('convex/schema.ts');
    expect(schema).toContain('linkedChargeId');
    expect(schema).toContain('reconciliation_matches: defineTable');
    expect(schema).toContain('unmatchedSettledProofs');
    expect(schema).toContain('creditsWaiting');
  });

  it('the settlement path persists the charge linkage on the proof', () => {
    const portals = read('convex/portals.ts');
    expect(portals).toContain('linkedChargeId: String(opts.serviceChargeId)');
  });

  it('the api registry knows reconciliationWorkflow', () => {
    const dts = read('convex/_generated/api.d.ts');
    expect(dts).toContain('reconciliationWorkflow');
  });
});
