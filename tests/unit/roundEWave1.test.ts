/**
 * roundEWave1.test.ts — ROUND E (Wave E1) regression tests: the tenancy
 * lifecycle engine.
 *
 * PINNED INVARIANTS (see convex/tenancyLifecycle.ts header):
 *
 * E1(a) AUTH TRUTH: every lifecycle mutation/query self-authenticates via
 *   requireStaffCaller — no session → throw; portal roles (Tenant/Client)
 *   → throw; a firm's staff cannot touch another firm's units or tenancies.
 *
 * E1(b) ONE ACTIVE TENANCY PER UNIT: the by_firm_unit_key check-then-insert
 *   runs inside the mutation's serializable transaction; a second allocation
 *   (and an idempotency-key replay) can never create a duplicate. The
 *   normalized unitKey defeats "same unit, different id shape" bypasses.
 *
 * E1(c) HISTORY IS NEVER DELETED: ending a tenancy clears only the unit's
 *   resident-identity fields — rentPaymentHistory survives move-outs,
 *   renewals chain via previousTenancyId/renewedToTenancyId, transfers end
 *   the old row and open the new one ATOMICALLY.
 *
 * E1(d) THE LEGACY BRIDGE: occupied units let before the ledger existed are
 *   registered via recordExistingTenancy (idempotent) — allocation onto an
 *   informally-occupied unit is refused with guidance, so an allocation can
 *   never silently evict a sitting resident.
 *
 * E1(e) THE PUBLIC READ IS PROJECTED: getPropertyById feeds the anonymous
 *   /apply form and must never return the raw property document (tenant
 *   PII, payment history, owner contact ids).
 *
 * Testing style: the Round A/B/D behavioural harness (fixture-backed mock
 * ctx executing the real Convex handlers via `_handler(ctx, args)`) plus
 * source-contract tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Convex functions under test ─────────────────────────────────────────────
import {
  allocateTenant,
  recordExistingTenancy,
  renewTenancy,
  endTenancy,
  transferTenant,
  getUnitsTenancyStatus,
  getUnitTenancyHistory,
  getResidentHistory,
} from '../../convex/tenancyLifecycle';
import { getPropertyById } from '../../convex/myFunctions';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/tenancyLifecycle.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed mock ctx (Round A/B/D harness) ───────────────────────────
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
    tenancies: [],
    maintenance_tickets: [],
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
    ...overrides,
  };
  return { ctx, writes, tables };
}

// ── Standard callers ────────────────────────────────────────────────────────
const ADMIN = { _id: 'u-admin-1', email: 'admin@firm1.com', tokenIdentifier: 'admin@firm1.com', name: 'Ada Admin', role: 'Admin', firmId: 'firm-1' };
const ADMIN_SESSION = { token: 'tok-admin-xyz', userId: 'u-admin-1' };
const FIRM2_ADMIN = { _id: 'u-f2-admin', email: 'admin@firm2.com', tokenIdentifier: 'admin@firm2.com', name: 'Bisi Firm2', role: 'Admin', firmId: 'firm-2' };
const FIRM2_ADMIN_SESSION = { token: 'tok-f2-admin', userId: 'u-f2-admin' };
const TENANT = { _id: 'u-tenant-1', email: 'resident@firm1.com', tokenIdentifier: 'resident@firm1.com', name: 'Tunde Tenant', role: 'Tenant', firmId: 'firm-1' };
const TENANT_SESSION = { token: 'tok-tenant-1', userId: 'u-tenant-1' };

// ── Property fixtures (standalone rows = one unit per row; the primary model)
const PROP1_OCCUPIED = {
  _id: 'prop-conv-1',
  id: 'prop-custom-1',
  firmId: 'firm-1',
  address: '12 Marina Rd, Lagos',
  status: 'Occupied',
  contactId: 'owner-1',
  currentTenantId: null,
  tenantId: null,
  rentalDetails: {
    rentAmount: 1200000,
    rentFrequency: 'Annually',
    leaseStart: '2026-01-01',
    leaseEnd: '2026-12-31',
    tenantName: 'Sitting Tenant',
    tenantPhone: '08030000001',
    tenantEmail: 'sitting@firm1.com',
    cautionDeposit: 200000,
  },
  rentPaymentHistory: [
    { id: 'p1', dueDate: '2026-01-01', paidDate: '2026-01-02', amount: 1200000, status: 'paid', receiptNumber: 'REC-00001' },
  ],
  trackingTimeline: [],
};
const PROP2_VACANT = {
  _id: 'prop-conv-2',
  id: 'prop-custom-2',
  firmId: 'firm-1',
  address: '14 Marina Rd, Lagos',
  status: 'Vacant',
  currentTenantId: null,
  tenantId: null,
  rentalDetails: { rentAmount: 800000, rentFrequency: 'Annually' },
  rentPaymentHistory: [],
  trackingTimeline: [],
};
const PROP2B_VACANT = {
  _id: 'prop-conv-2b',
  id: 'prop-custom-2b',
  firmId: 'firm-1',
  address: '16 Marina Rd, Lagos',
  status: 'Vacant',
  currentTenantId: null,
  tenantId: null,
  rentalDetails: {},
  rentPaymentHistory: [],
  trackingTimeline: [],
};
const FIRM2_PROP_VACANT = {
  _id: 'prop-conv-f2',
  id: 'prop-custom-f2',
  firmId: 'firm-2',
  address: '99 Other St, Abuja',
  status: 'Vacant',
  rentalDetails: {},
  rentPaymentHistory: [],
  trackingTimeline: [],
};
const PROP3_EMBEDDED = {
  _id: 'prop-conv-3',
  id: 'prop-custom-3',
  firmId: 'firm-1',
  address: '20 Ekwe St, Lagos',
  status: 'Vacant',
  currentTenantId: null,
  tenantId: null,
  rentalDetails: {},
  units: [
    { id: 'unit-a', unitName: 'Flat A', status: 'Vacant', rentAmount: 500000, rentFrequency: 'Monthly' },
  ],
  rentPaymentHistory: [],
  trackingTimeline: [],
};

const propsTable = () => [
  { ...PROP1_OCCUPIED, rentalDetails: { ...PROP1_OCCUPIED.rentalDetails }, rentPaymentHistory: [...PROP1_OCCUPIED.rentPaymentHistory], trackingTimeline: [] },
  { ...PROP2_VACANT, rentalDetails: { ...PROP2_VACANT.rentalDetails } },
  { ...PROP2B_VACANT, rentalDetails: {} },
  { ...FIRM2_PROP_VACANT, rentalDetails: {} },
  { ...PROP3_EMBEDDED, rentalDetails: {}, units: [{ ...PROP3_EMBEDDED.units[0] }] },
];

const baseArgs = {
  firmId: 'firm-1',
  sessionToken: 'tok-admin-xyz',
};

const NOW = Date.now();

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

const call = (fn: any, ctx: any, args: any) => (fn as any)._handler(ctx, args);

// ═══════════════════════════════════════════════════════════════════════════
// E1(a) — AUTH TRUTH
// ═══════════════════════════════════════════════════════════════════════════

describe('E1 — allocateTenant auth truth', () => {
  it('rejects an anonymous caller (no session token)', async () => {
    const { ctx } = makeCtx({ user: ADMIN, users: [TENANT] });
    await expect(
      call(allocateTenant, ctx, { ...baseArgs, sessionToken: undefined, unitId: 'prop-custom-2', tenantName: 'New Resident', leaseStart: '2026-06-01', rentAmount: 500000, rentFrequency: 'Monthly' })
    ).rejects.toThrow(/Unauthenticated: a verified session is required/);
  });

  it('rejects an invalid session token (never falls through to email)', async () => {
    const { ctx } = makeCtx({ user: ADMIN, users: [TENANT] });
    await expect(
      call(allocateTenant, ctx, { ...baseArgs, sessionToken: 'tok-dead-beef', unitId: 'prop-custom-2', tenantName: 'New Resident', leaseStart: '2026-06-01', rentAmount: 500000, rentFrequency: 'Monthly' })
    ).rejects.toThrow(/Unauthenticated: the session token is invalid/);
  });

  it('rejects staff of another firm (firm-scoped units)', async () => {
    const { ctx } = makeCtx({ user: FIRM2_ADMIN, session: FIRM2_ADMIN_SESSION, users: [ADMIN] });
    await expect(
      call(allocateTenant, ctx, { ...baseArgs, sessionToken: 'tok-f2-admin', unitId: 'prop-custom-2', tenantName: 'New Resident', leaseStart: '2026-06-01', rentAmount: 500000, rentFrequency: 'Monthly' })
    ).rejects.toThrow(/Not authorized: cannot access data belonging to a different firm/);
  });

  it('rejects a portal (Tenant) caller — staff-only operation', async () => {
    const { ctx } = makeCtx({ user: TENANT, session: TENANT_SESSION, users: [ADMIN] });
    await expect(
      call(allocateTenant, ctx, { ...baseArgs, sessionToken: 'tok-tenant-1', unitId: 'prop-custom-2', tenantName: 'New Resident', leaseStart: '2026-06-01', rentAmount: 500000, rentFrequency: 'Monthly' })
    ).rejects.toThrow(/Portal users do not have access/);
  });

  it('refuses a unit belonging to another firm (resolver is firm-scoped)', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    await expect(
      call(allocateTenant, ctx, { ...baseArgs, unitId: 'prop-custom-f2', tenantName: 'New Resident', leaseStart: '2026-06-01', rentAmount: 500000, rentFrequency: 'Monthly' })
    ).rejects.toThrow(/Unit not found for this firm/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E1(b) — ONE ACTIVE TENANCY PER UNIT + VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe('E1 — allocateTenant lifecycle truth', () => {
  it('allocates a resident onto a vacant unit and syncs the denormalized fields', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    const res = await call(allocateTenant, ctx, {
      ...baseArgs,
      unitId: 'prop-custom-2',
      tenantName: 'Chidi New',
      tenantPhone: '08030000002',
      leaseStart: '2026-06-01',
      leaseEnd: '2027-05-31',
      rentAmount: 800000,
      rentFrequency: 'Annually',
      cautionDeposit: 100000,
    });
    expect(res.tenancyId).toBeTruthy();
    expect(res.replayed).toBe(false);

    const row = tables.tenancies.find((t: any) => String(t._id) === res.tenancyId)!;
    expect(row.status).toBe('active');
    expect(row.unitKey).toBe('prop-conv-2'); // normalized identity, not the raw arg
    expect(row.source).toBe('allocation');
    expect(row.tenantName).toBe('Chidi New');
    expect(row.cautionDeposit).toBe(100000);

    const prop = tables.properties.find((p: any) => p._id === 'prop-conv-2')!;
    expect(prop.status).toBe('Occupied');
    expect(prop.rentalDetails.tenantName).toBe('Chidi New');
    expect(prop.rentalDetails.leaseStart).toBe('2026-06-01');
    expect(prop.trackingTimeline.some((e: any) => e.type === 'tenant_change')).toBe(true);
  });

  it('resolves the resident portal user from their email (canonical tenant id)', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    const res = await call(allocateTenant, ctx, {
      ...baseArgs,
      unitId: 'prop-custom-2',
      tenantName: 'Tunde Tenant',
      tenantEmail: 'resident@firm1.com',
      leaseStart: '2026-06-01',
      rentAmount: 800000,
      rentFrequency: 'Annually',
    });
    const row = tables.tenancies.find((t: any) => String(t._id) === res.tenancyId)!;
    expect(row.tenantUserId).toBe('u-tenant-1');
    const prop = tables.properties.find((p: any) => p._id === 'prop-conv-2')!;
    expect(prop.currentTenantId).toBe('u-tenant-1'); // the field portal alias-matching keys on
  });

  it('refuses an informally-occupied unit with guidance (no silent evictions)', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    await expect(
      call(allocateTenant, ctx, { ...baseArgs, unitId: 'prop-custom-1', tenantName: 'New Resident', leaseStart: '2026-06-01', rentAmount: 500000, rentFrequency: 'Monthly' })
    ).rejects.toThrow(/Record Current Tenancy/);
  });

  it('refuses a second active tenancy on the same unit (duplicate guard)', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    const args = { ...baseArgs, unitId: 'prop-custom-2', tenantName: 'Chidi New', leaseStart: '2026-06-01', rentAmount: 800000, rentFrequency: 'Annually' };
    await call(allocateTenant, ctx, args);
    await expect(call(allocateTenant, ctx, { ...args, tenantName: 'Someone Else' })).rejects.toThrow(/already has an active tenancy/);
  });

  it('replays an idempotency key to the SAME row (concurrent double-submit safe)', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    const args = {
      ...baseArgs,
      unitId: 'prop-custom-2',
      tenantName: 'Chidi New',
      leaseStart: '2026-06-01',
      rentAmount: 800000,
      rentFrequency: 'Annually',
      idempotencyKey: 'alloc-key-1',
    };
    const first = await call(allocateTenant, ctx, args);
    const second = await call(allocateTenant, ctx, args);
    expect(second.tenancyId).toBe(first.tenancyId);
    expect(second.replayed).toBe(true);
    expect(tables.tenancies.filter((t: any) => t.unitKey === 'prop-conv-2')).toHaveLength(1);
  });

  it('the duplicate guard is shape-proof (composite id of the same embedded unit)', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    await call(allocateTenant, ctx, { ...baseArgs, unitId: 'unit-a', tenantName: 'Embedded Resident', leaseStart: '2026-06-01', rentAmount: 500000, rentFrequency: 'Monthly' });
    // Same unit, different id shape: composite prop-custom-3_unit-a.
    await expect(
      call(allocateTenant, ctx, { ...baseArgs, unitId: 'prop-custom-3_unit-a', tenantName: 'Someone Else', leaseStart: '2026-06-01', rentAmount: 500000, rentFrequency: 'Monthly' })
    ).rejects.toThrow(/already has an active tenancy/);
  });

  it('validates lease dates, rent frequency and the resident name', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    await expect(
      call(allocateTenant, ctx, { ...baseArgs, unitId: 'prop-custom-2', tenantName: 'A', leaseStart: '2026-06-01', leaseEnd: '2026-06-01', rentAmount: 5, rentFrequency: 'Monthly' })
    ).rejects.toThrow(/Lease end must be after lease start/);
    await expect(
      call(allocateTenant, ctx, { ...baseArgs, unitId: 'prop-custom-2', tenantName: 'A', leaseStart: '2026-06-01', rentAmount: 5, rentFrequency: 'Weekly' })
    ).rejects.toThrow(/Rent frequency must be one of/);
    await expect(
      call(allocateTenant, ctx, { ...baseArgs, unitId: 'prop-custom-2', tenantName: '   ', leaseStart: '2026-06-01', rentAmount: 5, rentFrequency: 'Monthly' })
    ).rejects.toThrow(/Resident name is required/);
  });

  it('syncs embedded units (patch of the parent units[] entry)', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    const res = await call(allocateTenant, ctx, { ...baseArgs, unitId: 'unit-a', tenantName: 'Embedded Resident', leaseStart: '2026-06-01', rentAmount: 500000, rentFrequency: 'Monthly' });
    const row = tables.tenancies.find((t: any) => String(t._id) === res.tenancyId)!;
    expect(row.unitKey).toBe('prop-conv-3_unit-a');
    const prop = tables.properties.find((p: any) => p._id === 'prop-conv-3')!;
    const unit = (prop.units as any[]).find((u: any) => u.id === 'unit-a');
    expect(unit.tenantName).toBe('Embedded Resident');
    expect(unit.status).toBe('Occupied');
    expect(prop.rentalDetails.tenantName).toBe('Embedded Resident'); // single-embedded-unit mirror
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E1(d) — THE LEGACY BRIDGE
// ═══════════════════════════════════════════════════════════════════════════

describe('E1 — recordExistingTenancy (the bridge for legacy occupied units)', () => {
  it('registers the sitting resident as an active ledger row from the unit record', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    const res = await call(recordExistingTenancy, ctx, { ...baseArgs, unitId: 'prop-custom-1' });
    expect(res.alreadyRecorded).toBe(false);
    const row = tables.tenancies.find((t: any) => String(t._id) === res.tenancyId)!;
    expect(row.status).toBe('active');
    expect(row.tenantName).toBe('Sitting Tenant');
    expect(row.rentAmount).toBe(1200000);
    expect(row.source).toBe('record_existing');
    expect(row.startDate).toBe('2026-01-01');
  });

  it('is idempotent — a second call returns the same row', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    const first = await call(recordExistingTenancy, ctx, { ...baseArgs, unitId: 'prop-custom-1' });
    const second = await call(recordExistingTenancy, ctx, { ...baseArgs, unitId: 'prop-custom-1' });
    expect(second.alreadyRecorded).toBe(true);
    expect(second.tenancyId).toBe(first.tenancyId);
    expect(tables.tenancies).toHaveLength(1);
  });

  it('refuses a unit with no sitting resident', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    await expect(
      call(recordExistingTenancy, ctx, { ...baseArgs, unitId: 'prop-custom-2' })
    ).rejects.toThrow(/no current resident/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E1(c) — RENEW / END / TRANSFER (history preservation)
// ═══════════════════════════════════════════════════════════════════════════

async function seedRecordedTenancy() {
  const env = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
  const rec = await call(recordExistingTenancy, env.ctx, { ...baseArgs, unitId: 'prop-custom-1' });
  return { ...env, tenancyId: rec.tenancyId as string };
}

describe('E1 — renewTenancy', () => {
  it('chains the successor row and preserves payment history', async () => {
    const { ctx, tables, tenancyId } = await seedRecordedTenancy();
    const res = await call(renewTenancy, ctx, {
      ...baseArgs,
      tenancyId,
      newLeaseStart: '2027-01-01',
      newLeaseEnd: '2027-12-31',
      newRentAmount: 1400000,
    });
    const oldRow = tables.tenancies.find((t: any) => String(t._id) === tenancyId)!;
    const newRow = tables.tenancies.find((t: any) => String(t._id) === res.tenancyId)!;
    expect(oldRow.status).toBe('ended');
    expect(oldRow.endReason).toBe('renewed');
    expect(oldRow.renewedToTenancyId).toBe(String(res.tenancyId));
    expect(newRow.status).toBe('active');
    expect(newRow.previousTenancyId).toBe(String(tenancyId));
    expect(newRow.rentAmount).toBe(1400000);
    expect(newRow.tenantName).toBe('Sitting Tenant'); // identity carried through

    const prop = tables.properties.find((p: any) => p._id === 'prop-conv-1')!;
    expect(prop.rentalDetails.leaseStart).toBe('2027-01-01'); // live lease terms synced
    expect(prop.rentPaymentHistory).toHaveLength(1); // history untouched
    expect(prop.rentPaymentHistory[0].receiptNumber).toBe('REC-00001');
  });

  it('refuses to renew an already-ended tenancy', async () => {
    const { ctx, tenancyId } = await seedRecordedTenancy();
    await call(renewTenancy, ctx, { ...baseArgs, tenancyId, newLeaseStart: '2027-01-01' });
    await expect(
      call(renewTenancy, ctx, { ...baseArgs, tenancyId, newLeaseStart: '2028-01-01' })
    ).rejects.toThrow(/Only an active tenancy can be renewed/);
  });

  it('refuses a cross-firm tenancy', async () => {
    const { tables, tenancyId } = await seedRecordedTenancy();
    // The foreign firm's context holds the same ledger rows (shared world).
    const firm2 = makeCtx({ user: FIRM2_ADMIN, session: FIRM2_ADMIN_SESSION, users: [ADMIN, TENANT], tables: { properties: propsTable() } });
    firm2.tables.tenancies.push(...tables.tenancies);
    await expect(
      call(renewTenancy, firm2.ctx, { firmId: 'firm-2', sessionToken: 'tok-f2-admin', tenancyId, newLeaseStart: '2027-01-01' })
    ).rejects.toThrow(/belongs to a different firm/);
  });
});

describe('E1 — endTenancy', () => {
  it('ends the tenancy, vacates the unit and PRESERVES all financial history', async () => {
    const { ctx, tables, tenancyId } = await seedRecordedTenancy();
    const res = await call(endTenancy, ctx, {
      ...baseArgs,
      tenancyId,
      endDate: '2026-09-30',
      endReason: 'move_out',
      notes: 'Relocated abroad',
    });
    expect(res.unitVacated).toBe(true);

    const row = tables.tenancies.find((t: any) => String(t._id) === tenancyId)!;
    expect(row.status).toBe('ended');
    expect(row.endReason).toBe('move_out');
    expect(row.endedAt).toBe('2026-09-30');
    expect(row.endNotes).toBe('Relocated abroad');

    const prop = tables.properties.find((p: any) => p._id === 'prop-conv-1')!;
    expect(prop.status).toBe('Vacant');
    expect(prop.rentalDetails.tenantName).toBe(''); // identity cleared…
    expect(prop.currentTenantId).toBe(null);
    expect(prop.rentPaymentHistory).toHaveLength(1); // …but history preserved verbatim
    expect(prop.rentPaymentHistory[0].receiptNumber).toBe('REC-00001');
  });

  it('rejects an invalid end reason', async () => {
    const { ctx, tenancyId } = await seedRecordedTenancy();
    await expect(
      call(endTenancy, ctx, { ...baseArgs, tenancyId, endDate: '2026-09-30', endReason: 'evicted' })
    ).rejects.toThrow(/End reason must be one of/);
  });
});

describe('E1 — transferTenant', () => {
  it('moves the resident atomically: old unit vacated, target occupied, rows chained', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    const alloc = await call(allocateTenant, ctx, {
      ...baseArgs,
      unitId: 'prop-custom-2',
      tenantName: 'Chidi New',
      tenantPhone: '08030000002',
      leaseStart: '2026-06-01',
      rentAmount: 800000,
      rentFrequency: 'Annually',
    });
    const res = await call(transferTenant, ctx, {
      ...baseArgs,
      tenancyId: alloc.tenancyId,
      targetUnitId: 'prop-custom-2b',
      newLeaseStart: '2026-08-01',
      newRentAmount: 900000,
    });

    const oldRow = tables.tenancies.find((t: any) => String(t._id) === alloc.tenancyId)!;
    const newRow = tables.tenancies.find((t: any) => String(t._id) === res.tenancyId)!;
    expect(oldRow.status).toBe('ended');
    expect(oldRow.endReason).toBe('transferred');
    expect(newRow.status).toBe('active');
    expect(newRow.unitKey).toBe('prop-conv-2b');
    expect(newRow.previousTenancyId).toBe(String(alloc.tenancyId));
    expect(newRow.rentAmount).toBe(900000);

    const oldProp = tables.properties.find((p: any) => p._id === 'prop-conv-2')!;
    const newProp = tables.properties.find((p: any) => p._id === 'prop-conv-2b')!;
    expect(oldProp.status).toBe('Vacant');
    expect(oldProp.rentalDetails.tenantName).toBe('');
    expect(newProp.status).toBe('Occupied');
    expect(newProp.rentalDetails.tenantName).toBe('Chidi New');
  });

  it('refuses a transfer into an occupied unit', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    const alloc = await call(allocateTenant, ctx, {
      ...baseArgs, unitId: 'prop-custom-2', tenantName: 'Chidi New', leaseStart: '2026-06-01', rentAmount: 800000, rentFrequency: 'Annually',
    });
    await expect(
      call(transferTenant, ctx, { ...baseArgs, tenancyId: alloc.tenancyId, targetUnitId: 'prop-custom-1', newLeaseStart: '2026-08-01' })
    ).rejects.toThrow(/target unit is marked occupied/);
  });

  it('refuses a transfer onto the same unit', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    const alloc = await call(allocateTenant, ctx, {
      ...baseArgs, unitId: 'prop-custom-2', tenantName: 'Chidi New', leaseStart: '2026-06-01', rentAmount: 800000, rentFrequency: 'Annually',
    });
    await expect(
      call(transferTenant, ctx, { ...baseArgs, tenancyId: alloc.tenancyId, targetUnitId: 'prop-custom-2', newLeaseStart: '2026-08-01' })
    ).rejects.toThrow(/must be a different unit/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E1 — READS (board, history, resident history)
// ═══════════════════════════════════════════════════════════════════════════

describe('E1 — getUnitsTenancyStatus (the board read)', () => {
  it('rejects an unauthenticated caller', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    await expect(
      call(getUnitsTenancyStatus, ctx, { firmId: 'firm-1', unitIds: ['prop-custom-2'] })
    ).rejects.toThrow(/Unauthenticated/);
  });

  it('reports per-unit active tenancy and totals; foreign units resolve to nothing', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    await call(recordExistingTenancy, ctx, { ...baseArgs, unitId: 'prop-custom-1' });
    const out = await call(getUnitsTenancyStatus, ctx, { ...baseArgs, unitIds: ['prop-custom-1', 'prop-custom-2', 'prop-custom-f2'] });
    expect(out['prop-custom-1'].active.tenantName).toBe('Sitting Tenant');
    expect(out['prop-custom-1'].total).toBe(1);
    expect(out['prop-custom-2'].active).toBe(null);
    expect(out['prop-custom-f2'].resolved).toBe(false); // firm-2 property, firm-1 caller
    void tables;
  });
});

describe('E1 — getUnitTenancyHistory (payment attribution)', () => {
  it('returns the ledger newest-first with in-window payments attributed', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    const rec = await call(recordExistingTenancy, ctx, { ...baseArgs, unitId: 'prop-custom-1' });
    await call(renewTenancy, ctx, { ...baseArgs, tenancyId: rec.tenancyId, newLeaseStart: '2027-01-01', newLeaseEnd: '2027-12-31' });
    const out = await call(getUnitTenancyHistory, ctx, { ...baseArgs, unitId: 'prop-custom-1' });
    expect(out.unit.unitKey).toBe('prop-conv-1');
    expect(out.tenancies).toHaveLength(2);
    expect(out.tenancies[0].startDate).toBe('2027-01-01'); // newest first
    const ended = out.tenancies.find((t: any) => t.status === 'ended');
    expect(ended.payments).toHaveLength(1); // the 2026-01-02 payment falls in the first lease window
    expect(ended.totalPaid).toBe(1200000);
    const active = out.tenancies.find((t: any) => t.status === 'active');
    expect(active.payments).toHaveLength(0); // and NOT in the renewal window
    void tables;
  });
});

describe('E1 — getResidentHistory (the consolidated read)', () => {
  it('aggregates tenancies, attributed payments and maintenance by name; rejects cross-firm callers', async () => {
    const { ctx, tables } = makeCtx({
      user: ADMIN,
      session: ADMIN_SESSION,
      users: [TENANT],
      tables: {
        properties: propsTable(),
        maintenance_tickets: [
          { _id: 'mt-1', firmId: 'firm-1', tenantId: null, tenantName: 'Sitting Tenant', subject: 'Leaking tap', status: 'open' },
        ],
      },
    });
    const rec = await call(recordExistingTenancy, ctx, { ...baseArgs, unitId: 'prop-custom-1' });
    await call(renewTenancy, ctx, { ...baseArgs, tenancyId: rec.tenancyId, newLeaseStart: '2027-01-01', newLeaseEnd: '2027-12-31' });

    const out = await call(getResidentHistory, ctx, { ...baseArgs, tenantName: 'Sitting Tenant' });
    expect(out.resident.name).toBe('Sitting Tenant');
    expect(out.tenancies).toHaveLength(2);
    expect(out.totals.activeCount).toBe(1);
    expect(out.totals.paymentsCount).toBe(1);
    expect(out.totals.totalPaid).toBe(1200000);
    expect(out.maintenance).toHaveLength(1);
    expect(out.maintenance[0].subject).toBe('Leaking tap');
    expect(out.tenancies.every((t: any) => typeof t.unitLabel === 'string')).toBe(true);

    // Firm-scoped read: a foreign firm's staff sees ZERO of this firm's
    // tenancies (no cross-firm leak) — the read is empty, not an error.
    const firm2 = makeCtx({ user: FIRM2_ADMIN, session: FIRM2_ADMIN_SESSION, users: [ADMIN, TENANT], tables: { properties: propsTable() } });
    const foreign = await call(getResidentHistory, firm2.ctx, { firmId: 'firm-2', sessionToken: 'tok-f2-admin', tenantName: 'Sitting Tenant' });
    expect(foreign.tenancies).toHaveLength(0);
    expect(foreign.maintenance).toHaveLength(0);
    expect(foreign.totals.tenancies).toBe(0);
    void tables;
  });

  it('resolves a resident by their portal email and matches their ledger rows', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    await call(allocateTenant, ctx, {
      ...baseArgs, unitId: 'prop-custom-2', tenantName: 'Tunde Tenant', tenantEmail: 'resident@firm1.com',
      leaseStart: '2026-06-01', rentAmount: 800000, rentFrequency: 'Annually',
    });
    const out = await call(getResidentHistory, ctx, { ...baseArgs, tenantEmail: 'resident@firm1.com' });
    expect(out.resident.userId).toBe('u-tenant-1');
    expect(out.tenancies).toHaveLength(1);
    expect(out.tenancies[0].tenantName).toBe('Tunde Tenant');
    void tables;
  });

  it('requires at least one identifier', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    await expect(call(getResidentHistory, ctx, { ...baseArgs })).rejects.toThrow(/Provide a contact, portal user, email or name/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E1(e) — THE PUBLIC READ IS PROJECTED
// ═══════════════════════════════════════════════════════════════════════════

describe('E1 — getPropertyById public projection (the /apply form read)', () => {
  it('returns disclosure fields only — no tenant PII, no raw document', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    const out = await call(getPropertyById, ctx, { propertyId: 'prop-conv-1' });
    expect(out.firmId).toBe('firm-1'); // the lead-routing field the form needs
    expect(out.units).toHaveLength(1); // standalone property → synthesized single unit
    expect(out.units[0].rentAmount).toBe(1200000);
    expect(out.units[0].isOccupied).toBe(true);
    // The raw-document leak is dead:
    expect(out.rentalDetails).toBeUndefined();
    expect(out.tenantName ?? (out.rentalDetails as any)?.tenantName).toBeUndefined();
    expect(out.units[0].tenantName).toBeUndefined();
    expect(out.units[0].tenantEmail).toBeUndefined();
    expect(out.rentPaymentHistory).toBeUndefined();
    expect(out.contactId).toBeUndefined();
    expect(out.currentTenantId).toBeUndefined();
  });

  it('projects embedded units with occupancy flags instead of tenant names', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [TENANT], tables: { properties: propsTable() } });
    // Occupy the embedded unit first so the flag has something to read.
    await call(allocateTenant, ctx, { ...baseArgs, unitId: 'unit-a', tenantName: 'Embedded Resident', leaseStart: '2026-06-01', rentAmount: 500000, rentFrequency: 'Monthly' });
    const out = await call(getPropertyById, ctx, { propertyId: 'prop-conv-3' });
    expect(out.units).toHaveLength(1);
    expect(out.units[0].unitName).toBe('Flat A');
    expect(out.units[0].isOccupied).toBe(true);
    expect(out.units[0].tenantName).toBeUndefined();
    void tables;
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE CONTRACTS (the R16/R77/R79/R80/R81 pattern)
// ═══════════════════════════════════════════════════════════════════════════

describe('E1 — source contracts', () => {
  it('schema: the tenancy ledger fields + indexes exist', () => {
    const schema = read('convex/schema.ts');
    expect(schema).toContain('unitKey: nullableString');
    expect(schema).toContain('emergencyContactName: nullableString');
    expect(schema).toContain('previousTenancyId: nullableString');
    expect(schema).toContain('idempotencyKey: nullableString');
    expect(schema).toContain('.index("by_firm_unit_key", ["firmId", "unitKey"])');
    expect(schema).toContain('.index("by_idempotency", ["idempotencyKey"])');
  });

  it('api.d.ts: the tenancyLifecycle module is registered', () => {
    const apiD = read('convex/_generated/api.d.ts');
    expect(apiD).toContain('import type * as tenancyLifecycle from "../tenancyLifecycle.js"');
    expect(apiD).toContain('tenancyLifecycle: typeof tenancyLifecycle;');
  });

  it('PropertyDetailView wires the lifecycle console (Units tab + Summary fallback)', () => {
    const view = read('src/components/details/PropertyDetailView.tsx');
    expect(view).toContain("import { TenancyLifecyclePanel } from './TenancyLifecyclePanel'");
    expect(view.match(/<TenancyLifecyclePanel/g)?.length).toBe(2);
    expect(view).toContain('ROUND E (Wave E1)');
  });

  it('the panel uses ui primitives only — no raw button/input/select/textarea (ratchet)', () => {
    const panel = read('src/components/details/TenancyLifecyclePanel.tsx');
    expect(panel).toContain("from '../ui'");
    expect(panel).toContain('matchResidentContact'); // duplicate-resident detection
    expect(panel).toContain('useConfirm');           // confirm-before-consequential
    expect(panel).toContain('idempotencyKey');       // double-submit guard
    for (const raw of ['<button', '<input', '<select', '<textarea']) {
      expect(panel.includes(raw)).toBe(false);
    }
  });

  it('the lifecycle module follows the auth-first convention (requireStaffCaller before writes)', () => {
    const mod = read('convex/tenancyLifecycle.ts');
    expect(mod).toContain('requireStaffCaller');
    expect(mod).toContain('are read-only here'); // documented invariant
    expect((mod.match(/requireStaffCaller\(/g) || []).length).toBe(8); // 8 public functions
  });
});
