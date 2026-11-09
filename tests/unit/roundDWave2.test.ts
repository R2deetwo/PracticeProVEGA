/**
 * roundDWave2.test.ts — ROUND D (Wave 2) regression tests: D2 (add-on
 * approval flow truth) + D3 (booking loop truth).
 *
 * PINNED BUG CLASSES (the Round D audit, findings D2 + D3):
 *
 * D2 — the add-on approval flow was orphaned THREE ways:
 *   • the Paystack callback took MONEY then wrote the same pending_review
 *     row as an unpaid request (no paymentReference) — nothing could ever
 *     activate it, and the toast lied ("ready momentarily");
 *   • the founder approval functions (getAddonRequests /
 *     approveAddonRequestAsFounder / rejectAddonRequestAsFounder) had
 *     ZERO UI — pending requests could never be actioned;
 *   • purgeStalePendingAddons — a public mutation with no callers — would
 *     have hard-DELETED 72h-old paid-but-pending rows (plus heuristic
 *     'test'/'demo' matches regardless of age).
 *
 * D3 — the entire amenity-booking loop was dead past submission:
 *   • the resident view called STAFF endpoints (requireFirmUser) with no
 *     bearer — dead under R16 Phase B — and Tenants are rejected by
 *     requireFirmUser by design, so even the initial submission never
 *     worked for a real resident;
 *   • reviewBooking / getBookingsForFirm had zero UI — approval-needed
 *     bookings stayed pending forever;
 *   • no amenity CRUD UI, no resident bookings list, no cancel;
 *   • authHelpers.requireAdmin (Admin-only) locked out Founding Partners
 *     (role 'Founder') from the whole estate admin surface.
 *
 * Every fix is pinned in BOTH directions per the house convention: the
 * broken path is dead, the legitimate workflow works.
 *
 * Testing style: the Round A/B/D behavioural harness (fixture-backed mock
 * ctx executing the real Convex handlers via `_handler(ctx, args)`,
 * including a REAL filter() evaluator — hasEstateCommunityAccess resolves
 * firms through `filter(q => q.eq(q.field("id"), firmId))`), plus
 * source-contract tests for the UI wiring (the R16/R77 pattern).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Convex functions under test ─────────────────────────────────────────────
import {
  purchaseAddonWithPayment,
  insertPaidAddonActivation,
  settleAddonPaymentWebhook,
  resolveSessionForAddonPurchase,
  cancelAddon,
} from '../../convex/myFunctions';
import {
  getAmenitiesForResident,
  getMyBookings,
  cancelMyBooking,
  createBookingAsResident,
  reviewBooking,
  createAmenity,
  getBookingsForFirm,
} from '../../convex/estateCommunity';
import { ADDON_CATALOG, expectedAddonAmount } from '../../convex/addonCatalog';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed mock ctx (Round A/B/D harness + real filter()) ──────────
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
    firms: [],
    subscriptionAddons: [],
    analytics_events: [],
    error_events: [],
    notifications: [],
    estate_amenities: [],
    estate_amenity_bookings: [],
    estate_bulletins: [],
    estate_service_providers: [],
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
      // REAL filter semantics — hasEstateCommunityAccess resolves firms via
      // `filter(q => q.eq(q.field("id"), firmId))`; a permissive stub cannot
      // prove the access gate.
      filter: (fn: (q: any) => any) => {
        const conds: Array<[string, any]> = [];
        const q: any = {
          field: (f: string) => f,
          eq: (field: any, value: any) => { conds.push([String(field), value]); return q; },
        };
        try { fn(q); } catch { /* fall through with no conditions */ }
        const rows = (tables[table] ?? []).filter((r) =>
          conds.every(([f, v]) => r[f] !== undefined && String(r[f]) === String(v)));
        return chainFor(rows);
      },
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
      const _id = `${table}_${tables[table]?.length ?? 0}_${writes.inserts.length}`;
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
const ADMIN = { _id: 'u-admin-1', email: 'admin@firm1.com', tokenIdentifier: 'admin@firm1.com', name: 'Ada Admin', role: 'Admin', firmId: 'firm-1' };
const ADMIN_SESSION = { token: 'tok-admin-xyz', userId: 'u-admin-1' };
const FIRM_FOUNDER = { _id: 'u-founder-1', email: 'founder@firm1.com', tokenIdentifier: 'founder@firm1.com', name: 'Fola Founder', role: 'Founder', firmId: 'firm-1' };
const FOUNDER_SESSION = { token: 'tok-founder-1', userId: 'u-founder-1' };
const LAWYER = { _id: 'u-lawyer-1', email: 'lawyer@firm1.com', tokenIdentifier: 'lawyer@firm1.com', name: 'Lola Lawyer', role: 'Lawyer', firmId: 'firm-1' };
const LAWYER_SESSION = { token: 'tok-lawyer-abc', userId: 'u-lawyer-1' };
const TENANT = { _id: 'u-tenant-1', email: 'resident@firm1.com', tokenIdentifier: 'resident@firm1.com', name: 'Tunde Tenant', role: 'Tenant', firmId: 'firm-1' };
const TENANT_SESSION = { token: 'tok-tenant-1', userId: 'u-tenant-1' };
const TENANT2 = { _id: 'u-tenant-2', email: 'resident2@firm1.com', tokenIdentifier: 'resident2@firm1.com', name: 'Rita Resident', role: 'Tenant', firmId: 'firm-1' };
const TENANT2_SESSION = { token: 'tok-tenant-2', userId: 'u-tenant-2' };
const FIRM2_TENANT = { _id: 'u-tenant-f2', email: 'resident@firm2.com', tokenIdentifier: 'resident@firm2.com', name: 'Femi Firm2', role: 'Tenant', firmId: 'firm-2' };
const FIRM2_TENANT_SESSION = { token: 'tok-tenant-f2', userId: 'u-tenant-f2' };
const BUYER = { _id: 'u-buyer-1', email: 'buyer@firm1.com', tokenIdentifier: 'buyer@firm1.com', name: 'Bola Buyer', role: 'Admin', firmId: 'firm-1' };
const BUYER_SESSION = { token: 'tok-buyer-1', userId: 'u-buyer-1' };

const FIRM_1 = { _id: 'f-1', id: 'firm-1', name: 'Firm One', subscriptionPlan: 'Pro', subscriptionAddons: {} };
const FIRM_2 = { _id: 'f-2', id: 'firm-2', name: 'Firm Two', subscriptionPlan: 'Starter', subscriptionAddons: {} }; // no estate access

const AMENITY_1 = { _id: 'am-1', firmId: 'firm-1', name: 'Clubhouse Gym', isActive: true, slotDurationMinutes: 60, maxConcurrentBookings: 1, requiresApproval: true };
const AMENITY_2 = { _id: 'am-2', firmId: 'firm-1', name: 'Tennis Court', isActive: true, slotDurationMinutes: 60, maxConcurrentBookings: 1, requiresApproval: false };
const AMENITY_INACTIVE = { _id: 'am-3', firmId: 'firm-1', name: 'Old Pool', isActive: false, slotDurationMinutes: 60, maxConcurrentBookings: 1, requiresApproval: false };
const AMENITY_FIRM2 = { _id: 'am-f2', firmId: 'firm-2', name: 'Firm2 Gym', isActive: true, slotDurationMinutes: 60, maxConcurrentBookings: 1, requiresApproval: false };

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  vi.spyOn(console, 'error').mockImplementation(() => {}); // logError is chatty on the rejection paths
});
afterEach(() => { vi.restoreAllMocks(); });

// ctx factory extensions for the D2 action chain: runQuery/runAction/runMutation
// execute the REAL handlers so the whole settlement chain is exercised.
function makePurchaseCtx(fix: Fixtures, verification: any) {
  const { ctx, writes, tables } = makeCtx(fix);
  ctx.runQuery = vi.fn(async (_ref: any, args: any) =>
    (resolveSessionForAddonPurchase as any)._handler(ctx, args));
  ctx.runAction = vi.fn(async (_ref: any, _args: any) => verification);
  ctx.runMutation = vi.fn(async (_ref: any, args: any) =>
    (insertPaidAddonActivation as any)._handler(ctx, args));
  return { ctx, writes, tables };
}

// ═══════════════════════════════════════════════════════════════════════════
// D2 — PAID ADD-ON ACTIVATION (purchaseAddonWithPayment)
// ═══════════════════════════════════════════════════════════════════════════
describe('D2 — purchaseAddonWithPayment (the paid path settles server-side)', () => {
  it('ACTIVATES DIRECTLY on a verified payment: ACTIVE row with the payment audit trail', async () => {
    const { ctx, tables } = makePurchaseCtx(
      { user: BUYER, session: BUYER_SESSION },
      { status: 'success', amount: 20000, paidAt: '2026-11-09T10:00:00Z', channel: 'card' }
    );
    const result: any = await (purchaseAddonWithPayment as any)._handler(ctx, {
      addonId: 'extra_seats_5',
      quantity: 1,
      paymentReference: 'ADDON-extra_seats_5-1731000000000',
      sessionToken: BUYER_SESSION.token,
    });
    expect(result.alreadyActive).toBe(false);
    expect(result.addonName).toBe('Extra 5 Seats');

    const row = tables.subscriptionAddons.find((r) => r.paymentReference === 'ADDON-extra_seats_5-1731000000000');
    expect(row).toBeTruthy();
    if (!row) throw new Error('row missing');
    expect(row.status).toBe('active');                       // NOT pending_review — the D2 headline
    expect(row.paymentReference).toBe('ADDON-extra_seats_5-1731000000000');
    expect(row.paidAmount).toBe(20000);
    expect(row.reviewedBy).toBe('paystack:verified');
    expect(row.activatedAt).toBeTruthy();
    expect(row.firmId).toBe('firm-1');
    // Money movement audit trail.
    expect(tables.analytics_events.some((e) => e.event === 'ADDON_PURCHASE_PAID_ACTIVATION')).toBe(true);
  });

  it('REJECTS the ₦1-for-₦20,000 manipulation: verified amount below the catalog price never activates', async () => {
    const { ctx, tables } = makePurchaseCtx(
      { user: BUYER, session: BUYER_SESSION },
      { status: 'success', amount: 1, paidAt: '2026-11-09T10:00:00Z', channel: 'card' }
    );
    await expect((purchaseAddonWithPayment as any)._handler(ctx, {
      addonId: 'extra_seats_5',
      quantity: 1,
      paymentReference: 'ADDON-extra_seats_5-999',
      sessionToken: BUYER_SESSION.token,
    })).rejects.toThrow(/Payment mismatch/i);
    expect(tables.subscriptionAddons.length).toBe(0);
  });

  it('Validates QUANTITY against the catalog: 2 × extra_seats_5 requires ₦40,000, and lands quantity 2', async () => {
    const cheap = makePurchaseCtx(
      { user: BUYER, session: BUYER_SESSION },
      { status: 'success', amount: 20000, paidAt: '2026-11-09T10:00:00Z', channel: 'card' }
    );
    await expect((purchaseAddonWithPayment as any)._handler(cheap.ctx, {
      addonId: 'extra_seats_5', quantity: 2,
      paymentReference: 'ADDON-extra_seats_5-qty2', sessionToken: BUYER_SESSION.token,
    })).rejects.toThrow(/Payment mismatch/i);

    const ok = makePurchaseCtx(
      { user: BUYER, session: BUYER_SESSION },
      { status: 'success', amount: 40000, paidAt: '2026-11-09T10:00:00Z', channel: 'card' }
    );
    await (purchaseAddonWithPayment as any)._handler(ok.ctx, {
      addonId: 'extra_seats_5', quantity: 2,
      paymentReference: 'ADDON-extra_seats_5-qty2b', sessionToken: BUYER_SESSION.token,
    });
    const row = ok.tables.subscriptionAddons[0]!;
    expect(row.quantity).toBe(2);
    expect(row.amount).toBe(40000);
    expect(row.paidAmount).toBe(40000);
  });

  it('REJECTS a failed / pending verification — no row, clear error', async () => {
    for (const status of ['failed', 'pending', 'abandoned']) {
      const { ctx, tables } = makePurchaseCtx(
        { user: BUYER, session: BUYER_SESSION },
        { status, amount: 20000 }
      );
      await expect((purchaseAddonWithPayment as any)._handler(ctx, {
        addonId: 'extra_seats_5', quantity: 1,
        paymentReference: `ADDON-extra_seats_5-${status}`,
        sessionToken: BUYER_SESSION.token,
      })).rejects.toThrow(/could not be verified/i);
      expect(tables.subscriptionAddons.length).toBe(0);
    }
  });

  it('REJECTS an unknown add-on id (server-side catalog is the only price source)', async () => {
    const { ctx } = makePurchaseCtx(
      { user: BUYER, session: BUYER_SESSION },
      { status: 'success', amount: 20000 }
    );
    await expect((purchaseAddonWithPayment as any)._handler(ctx, {
      addonId: 'made_up_addon', quantity: 1,
      paymentReference: 'ADDON-made_up_addon-1', sessionToken: BUYER_SESSION.token,
    })).rejects.toThrow(/Unknown add-on/i);
  });

  it('REQUIRES a session — the client-claimed email is never trusted', async () => {
    const { ctx } = makePurchaseCtx(
      { user: BUYER }, // session omitted
      { status: 'success', amount: 20000 }
    );
    await expect((purchaseAddonWithPayment as any)._handler(ctx, {
      addonId: 'extra_seats_5', quantity: 1,
      paymentReference: 'ADDON-extra_seats_5-nosession',
      userEmail: 'founder@practicepro.ng', // forged identity string — ignored
    })).rejects.toThrow(/Unauthenticated/i);
  });

  it('IDEMPOTENT: the same reference settles exactly once (double-callback safe)', async () => {
    const { ctx, tables } = makePurchaseCtx(
      { user: BUYER, session: BUYER_SESSION },
      { status: 'success', amount: 20000, paidAt: '2026-11-09T10:00:00Z', channel: 'card' }
    );
    const ref = 'ADDON-extra_seats_5-dbl';
    const first: any = await (purchaseAddonWithPayment as any)._handler(ctx, {
      addonId: 'extra_seats_5', quantity: 1, paymentReference: ref, sessionToken: BUYER_SESSION.token,
    });
    const second: any = await (purchaseAddonWithPayment as any)._handler(ctx, {
      addonId: 'extra_seats_5', quantity: 1, paymentReference: ref, sessionToken: BUYER_SESSION.token,
    });
    expect(first.alreadyActive).toBe(false);
    expect(second.alreadyActive).toBe(true);
    expect(second.requestId).toBe(first.requestId);
    expect(tables.subscriptionAddons.length).toBe(1); // ONE row, not two
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D2 — WEBHOOK SELF-HEAL (settleAddonPaymentWebhook)
// ═══════════════════════════════════════════════════════════════════════════
describe('D2 — settleAddonPaymentWebhook (paid-but-callback-died self-heal)', () => {
  const baseArgs = {
    reference: 'ADDON-extra_seats_5-1731000000000',
    amount: 20000,
    paidAt: '2026-11-09T10:00:00Z',
    channel: 'card',
    customerEmail: 'buyer@firm1.com',
    quantity: 1,
  };

  function makeWebhookCtx(fix: Fixtures = {}) {
    const { ctx, tables, writes } = makeCtx({
      user: BUYER, session: BUYER_SESSION, ...fix,
    });
    ctx.runMutation = vi.fn(async (_ref: any, args: any) =>
      (insertPaidAddonActivation as any)._handler(ctx, args));
    return { ctx, tables, writes };
  }

  it('SETTLES a paid charge whose client callback died: ACTIVE row resolved from the customer email', async () => {
    const { ctx, tables } = makeWebhookCtx();
    const result: any = await (settleAddonPaymentWebhook as any)._handler(ctx, baseArgs);
    expect(result.settled).toBe(true);
    expect(result.alreadySettled).toBeUndefined();
    const row = tables.subscriptionAddons[0];
    expect(row.status).toBe('active');
    expect(row.reviewedBy).toBe('paystack:webhook');
    expect(row.firmId).toBe('firm-1');
    expect(row.paidAmount).toBe(20000);
    expect(row.paymentReference).toBe(baseArgs.reference);
  });

  it('IS IDEMPOTENT against the client path: a reference the callback already settled is a no-op', async () => {
    const { ctx, tables, writes } = makeWebhookCtx({
      tables: {
        subscriptionAddons: [{
          _id: 'existing-1', firmId: 'firm-1', addonId: 'extra_seats_5',
          addonName: 'Extra 5 Seats', status: 'active',
          paymentReference: baseArgs.reference, amount: 20000, paidAmount: 20000,
        }],
      },
    });
    const result: any = await (settleAddonPaymentWebhook as any)._handler(ctx, baseArgs);
    expect(result.alreadySettled).toBe(true);
    expect(result.requestId).toBe('existing-1');
    expect(tables.subscriptionAddons.length).toBe(1); // no duplicate
  });

  it('REFUSES an underpaid charge (never activates below the catalog price) and logs it', async () => {
    const { ctx, tables } = makeWebhookCtx();
    const result: any = await (settleAddonPaymentWebhook as any)._handler(ctx, {
      ...baseArgs, reference: 'ADDON-extra_seats_5-1731000000001', amount: 500,
    });
    expect(result).toMatchObject({ settled: false, reason: 'underpaid' });
    expect(tables.subscriptionAddons.length).toBe(0);
    expect(tables.error_events.length).toBeGreaterThan(0);
  });

  it('REFUSES an unparseable / non-ADDON reference shape', async () => {
    const { ctx } = makeWebhookCtx();
    const r1: any = await (settleAddonPaymentWebhook as any)._handler(ctx, {
      ...baseArgs, reference: 'ADDON-nonsense',
    });
    expect(r1).toMatchObject({ settled: false, reason: 'bad_reference' });
  });

  it('REFUSES an unknown addonId parsed from the reference', async () => {
    const { ctx } = makeWebhookCtx();
    const r: any = await (settleAddonPaymentWebhook as any)._handler(ctx, {
      ...baseArgs, reference: 'ADDON-nonexistent_addon-1731000000000',
    });
    expect(r).toMatchObject({ settled: false, reason: 'unknown_addon' });
  });

  it('REFUSES an unresolvable buyer (no user row for the customer email) — logged, never dropped silently', async () => {
    const { ctx, tables } = makeWebhookCtx();
    const r: any = await (settleAddonPaymentWebhook as any)._handler(ctx, {
      ...baseArgs, reference: 'ADDON-extra_seats_5-1731000000002', customerEmail: 'ghost@nowhere.com',
    });
    expect(r).toMatchObject({ settled: false, reason: 'unresolvable_buyer' });
    expect(tables.subscriptionAddons.length).toBe(0);
    expect(tables.error_events.length).toBeGreaterThan(0);
  });

  it('Carries the metadata QUANTITY (2 seats packs) into the settled row', async () => {
    const { ctx, tables } = makeWebhookCtx();
    await (settleAddonPaymentWebhook as any)._handler(ctx, {
      ...baseArgs, reference: 'ADDON-extra_seats_5-1731000000003', amount: 40000, quantity: 2,
    });
    const row = tables.subscriptionAddons[0];
    expect(row.quantity).toBe(2);
    expect(row.amount).toBe(40000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D2 — THE PURGE IS GONE + catalog single source
// ═══════════════════════════════════════════════════════════════════════════
describe('D2 — purgeStalePendingAddons is deleted (paid-request purge class closed)', () => {
  it('no exported purgeStalePendingAddons remains in convex/myFunctions.ts', () => {
    const src = read('convex/myFunctions.ts');
    expect(src).not.toMatch(/export const purgeStalePendingAddons\b/);
    // The deletion record is kept for archaeology.
    expect(src).toMatch(/purgeStalePendingAddons DELETED/);
  });

  it('the canonical catalog lives SERVER-side and matches the shipped prices', () => {
    const seats5 = ADDON_CATALOG.find((a) => a.id === 'extra_seats_5');
    expect(seats5?.amount).toBe(20000);
    expect(expectedAddonAmount('extra_seats_5', 1)).toBe(20000);
    expect(expectedAddonAmount('extra_seats_5', 3)).toBe(60000);
    expect(expectedAddonAmount('made_up', 1)).toBeNull();
    // The frontend module re-exports the SAME catalog (single source).
    const fe = read('src/constants/addons.ts');
    expect(fe).toMatch(/from '\.\.\/\.\.\/convex\/addonCatalog'/);
    expect(fe).not.toMatch(/amount: 20000/); // no duplicated price data client-side
  });

  it('schema records the payment audit trail (paymentReference + paidAmount + index)', () => {
    const schema = read('convex/schema.ts');
    expect(schema).toMatch(/paymentReference: nullableString/);
    expect(schema).toMatch(/paidAmount: nullableNumber/);
    expect(schema).toMatch(/by_payment_reference/);
  });

  it('the webhook routes ADDON- references to the add-on settlement BEFORE invoice settlement', () => {
    const src = read('convex/paystack.ts');
    const addonBranch = src.indexOf("reference.startsWith('ADDON-')");
    const invoiceBranch = src.indexOf('internal.payments.completePaystackPayment');
    expect(addonBranch).toBeGreaterThan(-1);
    expect(invoiceBranch).toBeGreaterThan(-1);
    expect(addonBranch).toBeLessThan(invoiceBranch);
    expect(src).toMatch(/settleAddonPaymentWebhook/);
  });

  it('unpaid requests still take the pending path — and cancelAddon still hard-deletes ONLY pending rows', async () => {
    // (Sanity: the bank-transfer fallback was not broken by the paid path.)
    const pending = { _id: 'sa-pending', firmId: 'firm-1', status: 'pending_review', addonName: 'Extra 5 Seats' };
    const active = { _id: 'sa-active', firmId: 'firm-1', status: 'active', addonName: 'Extra 5 Seats' };
    const { ctx, writes } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { subscriptionAddons: [pending, active] },
    });
    await (cancelAddon as any)._handler(ctx, {
      addonRequestId: 'sa-pending', sessionToken: ADMIN_SESSION.token,
    });
    expect(writes.deletes).toContain('sa-pending');
    await (cancelAddon as any)._handler(ctx, {
      addonRequestId: 'sa-active', sessionToken: ADMIN_SESSION.token,
    });
    expect(writes.deletes).not.toContain('sa-active'); // active rows are soft-cancelled, never deleted
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D3 — RESIDENT PORTAL SURFACE (estateCommunity portal endpoints)
// ═══════════════════════════════════════════════════════════════════════════
function estateCtx(overrides: Fixtures = {}) {
  return makeCtx({
    user: TENANT, session: TENANT_SESSION,
    tables: {
      firms: [FIRM_1, FIRM_2],
      estate_amenities: [AMENITY_1, AMENITY_2, AMENITY_INACTIVE, AMENITY_FIRM2],
      ...overrides.tables,
    },
    ...overrides,
  });
}

describe('D3 — portal surface auth (strict identity, portal roles only)', () => {
  it('REJECTS a caller with no session token', async () => {
    const { ctx } = estateCtx({ user: TENANT }); // no session
    await expect((getAmenitiesForResident as any)._handler(ctx, {}))
      .rejects.toThrow(/Unauthenticated/i);
  });

  it('REJECTS staff callers — Admins use the firm-side endpoints', async () => {
    const { ctx } = estateCtx({ user: ADMIN, session: ADMIN_SESSION });
    await expect((getAmenitiesForResident as any)._handler(ctx, {
      sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/only available to portal users/i);
  });

  it("ALLOWS a Tenant session and returns ONLY their firm's ACTIVE amenities", async () => {
    const { ctx } = estateCtx();
    const rows: any = await (getAmenitiesForResident as any)._handler(ctx, {
      sessionToken: TENANT_SESSION.token,
    });
    const ids = rows.map((r: any) => r._id).sort();
    expect(ids).toEqual(['am-1', 'am-2']); // active firm-1 only — not the inactive one, not firm-2's
  });

  it('BLOCKS residents of firms without Estate Community access (plan gate)', async () => {
    const { ctx } = estateCtx({ user: FIRM2_TENANT, session: FIRM2_TENANT_SESSION });
    await expect((getAmenitiesForResident as any)._handler(ctx, {
      sessionToken: FIRM2_TENANT_SESSION.token,
    })).rejects.toThrow(/not active on your plan/i);
  });
});

describe('D3 — createBookingAsResident (the booking loop lives)', () => {
  it('creates a PENDING booking for a requiresApproval amenity, attributed to the session identity', async () => {
    const { ctx, tables } = estateCtx();
    await (createBookingAsResident as any)._handler(ctx, {
      sessionToken: TENANT_SESSION.token,
      amenityId: 'am-1',
      bookingDate: '2026-11-20',
      slotStart: NOW + 5 * DAY,
      slotEnd: NOW + 5 * DAY + 3600000,
    });
    const row = tables.estate_amenity_bookings[0];
    expect(row.status).toBe('pending');               // approval semantics preserved
    expect(row.residentUserId).toBe(TENANT._id);      // session-derived, not caller-claimed
    expect(row.firmId).toBe('firm-1');
  });

  it('auto-approves a no-approval amenity', async () => {
    const { ctx, tables } = estateCtx();
    await (createBookingAsResident as any)._handler(ctx, {
      sessionToken: TENANT_SESSION.token,
      amenityId: 'am-2',
      bookingDate: '2026-11-20',
      slotStart: NOW + 5 * DAY,
      slotEnd: NOW + 5 * DAY + 3600000,
    });
    expect(tables.estate_amenity_bookings[0].status).toBe('approved');
  });

  it('REFUSES a fully-booked slot (conflict check preserved on the portal path)', async () => {
    const { ctx } = estateCtx({
      tables: {
        firms: [FIRM_1, FIRM_2],
        estate_amenities: [AMENITY_1, AMENITY_2, AMENITY_INACTIVE, AMENITY_FIRM2],
        estate_amenity_bookings: [{
          _id: 'bk-existing', firmId: 'firm-1', amenityId: 'am-1',
          residentUserId: TENANT2._id, residentName: 'Rita', bookingDate: '2026-11-20',
          slotStart: NOW + 5 * DAY, slotEnd: NOW + 5 * DAY + 3600000, status: 'approved',
          createdAt: NOW, updatedAt: NOW,
        }],
      },
    });
    await expect((createBookingAsResident as any)._handler(ctx, {
      sessionToken: TENANT_SESSION.token,
      amenityId: 'am-1',
      bookingDate: '2026-11-20',
      slotStart: NOW + 5 * DAY,
      slotEnd: NOW + 5 * DAY + 3600000,
    })).rejects.toThrow(/fully booked/i);
  });

  it("REFUSES booking another firm's amenity", async () => {
    const { ctx } = estateCtx();
    await expect((createBookingAsResident as any)._handler(ctx, {
      sessionToken: TENANT_SESSION.token,
      amenityId: 'am-f2',
      bookingDate: '2026-11-20',
      slotStart: NOW + 5 * DAY,
      slotEnd: NOW + 5 * DAY + 3600000,
    })).rejects.toThrow(/Not authorized/i);
  });
});

describe('D3 — getMyBookings / cancelMyBooking (the resident finally sees their bookings)', () => {
  const bookings = [
    { _id: 'bk-mine-1', firmId: 'firm-1', amenityId: 'am-1', residentUserId: TENANT._id, residentName: 'Tunde', bookingDate: '2026-11-20', slotStart: NOW + 5 * DAY, slotEnd: NOW + 5 * DAY + 3600000, status: 'pending', createdAt: NOW - 1000, updatedAt: NOW },
    { _id: 'bk-mine-2', firmId: 'firm-1', amenityId: 'am-2', residentUserId: TENANT._id, residentName: 'Tunde', bookingDate: '2026-11-22', slotStart: NOW + 7 * DAY, slotEnd: NOW + 7 * DAY + 3600000, status: 'approved', createdAt: NOW - 500, updatedAt: NOW },
    { _id: 'bk-theirs', firmId: 'firm-1', amenityId: 'am-1', residentUserId: TENANT2._id, residentName: 'Rita', bookingDate: '2026-11-21', slotStart: NOW + 6 * DAY, slotEnd: NOW + 6 * DAY + 3600000, status: 'pending', createdAt: NOW, updatedAt: NOW },
  ];

  it("returns ONLY the caller's own bookings, enriched with amenity names, newest first", async () => {
    const { ctx } = estateCtx({ tables: {
      firms: [FIRM_1, FIRM_2],
      estate_amenities: [AMENITY_1, AMENITY_2, AMENITY_INACTIVE, AMENITY_FIRM2],
      estate_amenity_bookings: bookings.map((b) => ({ ...b })),
    } });
    const rows: any = await (getMyBookings as any)._handler(ctx, {
      sessionToken: TENANT_SESSION.token,
    });
    expect(rows.map((r: any) => r._id)).toEqual(['bk-mine-2', 'bk-mine-1']);
    expect(rows.every((r: any) => r.residentUserId === TENANT._id)).toBe(true);
    expect(rows[0].amenityName).toBe('Tennis Court');
    expect(rows[1].amenityName).toBe('Clubhouse Gym');
  });

  it("cancels the caller's OWN booking", async () => {
    const { ctx, tables } = estateCtx({ tables: {
      firms: [FIRM_1, FIRM_2],
      estate_amenities: [AMENITY_1, AMENITY_2, AMENITY_INACTIVE, AMENITY_FIRM2],
      estate_amenity_bookings: bookings.map((b) => ({ ...b })),
    } });
    await (cancelMyBooking as any)._handler(ctx, {
      sessionToken: TENANT_SESSION.token, bookingId: 'bk-mine-1',
    });
    expect(tables.estate_amenity_bookings.find((b) => b._id === 'bk-mine-1')!.status).toBe('cancelled');
  });

  it("REFUSES cancelling another resident's booking (ownership from the session, not the id)", async () => {
    const { ctx } = estateCtx({ tables: {
      firms: [FIRM_1, FIRM_2],
      estate_amenities: [AMENITY_1, AMENITY_2, AMENITY_INACTIVE, AMENITY_FIRM2],
      estate_amenity_bookings: bookings.map((b) => ({ ...b })),
    } });
    await expect((cancelMyBooking as any)._handler(ctx, {
      sessionToken: TENANT_SESSION.token, bookingId: 'bk-theirs',
    })).rejects.toThrow(/only cancel your own/i);
  });

  it('no-ops on an already-terminal booking', async () => {
    const { ctx } = estateCtx({ tables: {
      firms: [FIRM_1, FIRM_2],
      estate_amenities: [AMENITY_1, AMENITY_2, AMENITY_INACTIVE, AMENITY_FIRM2],
      estate_amenity_bookings: [{ ...bookings[0], status: 'cancelled' }],
    } });
    const r: any = await (cancelMyBooking as any)._handler(ctx, {
      sessionToken: TENANT_SESSION.token, bookingId: 'bk-mine-1',
    });
    expect(r.noOp).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D3 — THE ESTATE ADMIN GATE (Admin AND Founding Partner)
// ═══════════════════════════════════════════════════════════════════════════
describe('D3 — requireEstateAdmin (Founding Partners unblocked, non-admins out)', () => {
  const pendingBooking = {
    _id: 'bk-pend', firmId: 'firm-1', amenityId: 'am-1', residentUserId: TENANT._id,
    residentName: 'Tunde', bookingDate: '2026-11-20', slotStart: NOW + 5 * DAY,
    slotEnd: NOW + 5 * DAY + 3600000, status: 'pending', createdAt: NOW, updatedAt: NOW,
  };

  function adminCtx(user: Row, session: { token: string; userId: string }) {
    return makeCtx({
      user, session,
      tables: {
        firms: [FIRM_1, FIRM_2],
        estate_amenities: [AMENITY_1, AMENITY_2, AMENITY_INACTIVE, AMENITY_FIRM2],
        // CLONE per test — reviewBooking patches the row in place, and the
        // shared object would leak status changes into later tests.
        estate_amenity_bookings: [{ ...pendingBooking }],
      },
    });
  }

  it('A firm FOUNDER (Founding Partner) can review bookings — the D3 lockout fix', async () => {
    const { ctx, writes } = adminCtx(FIRM_FOUNDER, FOUNDER_SESSION);
    await (reviewBooking as any)._handler(ctx, {
      bookingId: 'bk-pend', status: 'approved',
      sessionToken: FOUNDER_SESSION.token,
    });
    expect(writes.patches.find((p) => p.id === 'bk-pend')?.value.status).toBe('approved');
  });

  it('An Admin can review bookings (the old path still works)', async () => {
    const { ctx, writes } = adminCtx(ADMIN, ADMIN_SESSION);
    await (reviewBooking as any)._handler(ctx, {
      bookingId: 'bk-pend', status: 'rejected', adminNotes: 'Maintenance that day',
      sessionToken: ADMIN_SESSION.token,
    });
    expect(writes.patches.find((p) => p.id === 'bk-pend')?.value.status).toBe('rejected');
  });

  it('REJECTS a Lawyer — firm-admin roles only', async () => {
    const { ctx } = adminCtx(LAWYER, LAWYER_SESSION);
    await expect((reviewBooking as any)._handler(ctx, {
      bookingId: 'bk-pend', status: 'approved', sessionToken: LAWYER_SESSION.token,
    })).rejects.toThrow(/Administrator or Founding Partner/i);
  });

  it('REJECTS Tenants from the admin surface (portal roles stay on the portal surface)', async () => {
    const { ctx } = adminCtx(TENANT, TENANT_SESSION);
    await expect((reviewBooking as any)._handler(ctx, {
      bookingId: 'bk-pend', status: 'approved', sessionToken: TENANT_SESSION.token,
    })).rejects.toThrow(/do not have access to this feature/i);
  });

  it('REJECTS no-session callers on the admin mutations', async () => {
    const { ctx } = adminCtx(ADMIN, ADMIN_SESSION);
    await expect((createAmenity as any)._handler(ctx, {
      firmId: 'firm-1', name: 'Pool', slotDurationMinutes: 60,
    })).rejects.toThrow(/Unauthenticated/i);
  });

  it('getBookingsForFirm: Admin sees the firm queue, filtered by status', async () => {
    const { ctx } = adminCtx(ADMIN, ADMIN_SESSION);
    const rows: any = await (getBookingsForFirm as any)._handler(ctx, {
      firmId: 'firm-1', status: 'pending',
      sessionToken: ADMIN_SESSION.token, userEmail: ADMIN.email,
    });
    expect(rows.map((r: any) => r._id)).toEqual(['bk-pend']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D2 + D3 — SOURCE CONTRACTS (the UI wiring the audit found missing)
// ═══════════════════════════════════════════════════════════════════════════
describe('D2 — UI source contracts (the orphaned approval functions get their surface)', () => {
  it('SubscriptionRequestsCenter wires the add-on approval trio (get/approve/reject)', () => {
    const src = read('src/admin/views/SubscriptionRequestsCenter.tsx');
    expect(src).toMatch(/api\.founderMetrics\.getAddonRequests/);
    expect(src).toMatch(/api\.founderMetrics\.approveAddonRequestAsFounder/);
    expect(src).toMatch(/api\.founderMetrics\.rejectAddonRequestAsFounder/);
    expect(src).toMatch(/handleAddonApprove/);
    expect(src).toMatch(/handleAddonReject/);
  });

  it('SubscriptionSettings: the Paystack callback settles via the server-verified ACTION (not createAddonRequest)', () => {
    const src = read('src/components/settings/SubscriptionSettings.tsx');
    expect(src).toMatch(/convex\.action\(api\.myFunctions\.purchaseAddonWithPayment/);
    // The paid callback must NOT CALL createAddonRequest anymore (the
    // comment HISTORY mentions it — only the CALL is banned).
    const callbackStart = src.indexOf('callback: async (response: any)');
    const callbackEnd = src.indexOf('onClose: ()');
    const callbackBlock = src.slice(callbackStart, callbackEnd);
    expect(callbackStart).toBeGreaterThan(-1);
    expect(callbackBlock).not.toMatch(/convex\.mutation\(api\.myFunctions\.createAddonRequest/);
    // The bank-transfer FALLBACK (Paystack unconfigured) keeps the request path.
    expect(src).toMatch(/createAddonRequest/);
    // The active/pending fetches carry the bearer (were silently dead).
    expect(src).toMatch(/getActiveAddonsForFirm, \{ userEmail: email, sessionToken: token \}/);
  });
});

describe('D3 — UI source contracts (the dead loop gets its surfaces)', () => {
  it('The resident view calls the PORTAL endpoints with the bearer — not the dead staff endpoints', () => {
    const src = read('src/components/tenant/EstateCommunityResidentView.tsx');
    expect(src).toMatch(/api\.estateCommunity\.getAmenitiesForResident/);
    expect(src).toMatch(/api\.estateCommunity\.getBulletinsForResident/);
    expect(src).toMatch(/api\.estateCommunity\.getServiceProvidersForResident/);
    expect(src).toMatch(/api\.estateCommunity\.createBookingAsResident/);
    expect(src).toMatch(/api\.estateCommunity\.getMyBookings/);
    expect(src).toMatch(/api\.estateCommunity\.cancelMyBooking/);
    expect(src).toMatch(/bearerToken/);
    // The dead staff calls are gone (the exact calls that threw Unauthenticated).
    expect(src).not.toMatch(/api\.estateCommunity\.getAmenities\b/);
    expect(src).not.toMatch(/api\.estateCommunity\.getBulletins\b/);
    expect(src).not.toMatch(/api\.estateCommunity\.getServiceProviders\b/);
    expect(src).not.toMatch(/api\.estateCommunity\.createBooking\b/);
    // My Bookings section exists (the list that never existed).
    expect(src).toMatch(/My Bookings/);
  });

  it('TenantPortal passes the bearerToken into the resident view', () => {
    const src = read('src/components/tenant/TenantPortal/index.tsx');
    expect(src).toMatch(/bearerToken=\{bearerToken\}/);
  });

  it('The admin panel wires EVERY previously-orphaned staff function', () => {
    const src = read('src/components/settings/EstateCommunityAdminPanel.tsx');
    for (const fn of [
      'getAmenities', 'createAmenity', 'updateAmenity', 'deleteAmenity',
      'getBookingsForFirm', 'reviewBooking',
      'getBulletins', 'createBulletin', 'updateBulletin', 'archiveBulletin',
      'getServiceProviders', 'createServiceProvider', 'updateServiceProvider', 'deleteServiceProvider',
    ]) {
      expect(src).toMatch(new RegExp(`api\\.estateCommunity\\.${fn}\\b`));
    }
  });

  it('The settings card mounts the management console and no longer promises a nonexistent "Estate tab"', () => {
    const src = read('src/components/settings/EstateCommunitySettings.tsx');
    expect(src).toMatch(/EstateCommunityAdminPanel/);
    expect(src).not.toMatch(/from the Estate tab/);
    expect(src).toMatch(/console below/); // the pointer to the real console
  });
});
