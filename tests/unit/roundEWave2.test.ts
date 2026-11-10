/**
 * roundEWave2.test.ts — ROUND E (Wave E2) regression tests: the resident
 * directory + consolidated resident profile.
 *
 * PINNED INVARIANTS (see convex/tenancyLifecycle.ts Wave E2 section):
 *
 * E2(a) AUTH + FIRM SCOPE: both reads self-authenticate via
 *   requireStaffCaller (assertSameFirm binds the caller to args.firmId) —
 *   no session → throw; dead token → throw; portal roles → throw; a
 *   firm-1 staff passing firm-2's id → throw; firm-2's own staff see
 *   ONLY firm-2 rows.
 *
 * E2(b) THE ROSTER IS LEDGER-DERIVED AND UNION-MERGED: one entry per
 *   resident — rows sharing ANY of contact id / portal user / email /
 *   exact name merge into one resident (a contact-less early row and a
 *   contact-linked later row are ONE person, not two). Residents never
 *   linked to a Contact row still appear. Outstanding balances come from
 *   current-state service charges matched SHAPE-PROOF on the active unit
 *   (a charge stored under the custom id matches a tenancy stored under
 *   the Convex _id — the same resolver that backs the duplicate guard).
 *
 * E2(c) THE PROFILE IS A COMPLETE, READ-ONLY AGGREGATION: identity +
 *   emergency contact, current + previous tenancies with in-window
 *   attributed payments, balances on the active unit, maintenance by
 *   portal user (with the bounded exact-name fallback), documents filed
 *   on the resident's tenancy properties ONLY, and portal conversations
 *   by participant. Ended tenancies remain in the profile by construction
 *   (E1(c) — history is never deleted). getResidentHistory stays
 *   byte-stable for the same key (the E1 twin).
 *
 * E2(d) SOURCE CONTRACTS: 10 staff-authed publics in tenancyLifecycle
 *   (8 E1 + 2 E2), ui-primitives-only components, wiring present in
 *   ContactDetailView + BillingView, no api.d.ts churn (existing module).
 *
 * Testing style: the Round A/B/D/E1 behavioural harness (fixture-backed
 * mock ctx executing the real Convex handlers via `_handler(ctx, args)`)
 * plus source-contract tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Convex functions under test ─────────────────────────────────────────────
import {
  getResidentDirectory,
  getResidentProfile,
  getResidentHistory,
} from '../../convex/tenancyLifecycle';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/tenancyLifecycle.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed mock ctx (Round A/B/D/E1 harness) ────────────────────────
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

const call = (fn: any, ctx: any, args: any) => (fn as any)._handler(ctx, args);

// The standard auth args (mirrors E1's baseArgs convention — the bearer
// session is THE credential; email alone never authenticates).
const ADMIN_AUTH = { sessionToken: 'tok-admin-xyz', userEmail: 'admin@firm1.com' };

// ── Property fixtures (standalone rows — the primary model; unitKey = _id) ──
const PROP1 = {
  _id: 'prop-conv-1',
  id: 'prop-custom-1',
  firmId: 'firm-1',
  address: '12 Marina Rd, Lagos',
  status: 'Occupied',
  currentTenantId: 'u-tenant-1',
  rentalDetails: {
    rentAmount: 1200000,
    rentFrequency: 'Annually',
    leaseStart: '2026-01-01',
    leaseEnd: '2026-12-31',
    tenantName: 'Tunde Tenant',
    tenantPhone: '08030000001',
    tenantEmail: 'resident@firm1.com',
    cautionDeposit: 200000,
  },
  rentPaymentHistory: [
    { id: 'p1', dueDate: '2026-01-01', paidDate: '2026-01-02', amount: 1200000, status: 'paid', receiptNumber: 'REC-00001' },
  ],
  trackingTimeline: [],
};
const PROP2 = {
  _id: 'prop-conv-2',
  id: 'prop-custom-2',
  firmId: 'firm-1',
  address: '14 Marina Rd, Lagos',
  status: 'Vacant',
  rentalDetails: {},
  rentPaymentHistory: [],
  trackingTimeline: [],
};
const FIRM2_PROP = {
  _id: 'prop-conv-f2',
  id: 'prop-custom-f2',
  firmId: 'firm-2',
  address: '99 Other St, Abuja',
  status: 'Occupied',
  rentalDetails: {},
  rentPaymentHistory: [],
  trackingTimeline: [],
};

// ── Tenancy ledger fixtures ─────────────────────────────────────────────────
// Tunde's pre-link era row (no contact id, no portal user — the 2024 letting).
const TEN_OLD = {
  _id: 'ten-old', firmId: 'firm-1', status: 'ended', endReason: 'move_out', endedAt: '2024-12-31',
  unitId: 'prop-conv-1', unitKey: 'prop-conv-1', propertyId: 'prop-conv-1',
  unitName: '12 Marina Rd, Lagos',
  tenantName: 'Tunde Tenant', tenantPhone: '08030000001', tenantEmail: 'resident@firm1.com',
  startDate: '2024-01-01', endDate: '2024-12-31', rentAmount: 1000000, paymentFrequency: 'Annually',
  source: 'allocation', createdAt: '2024-01-01', updatedAt: '2024-01-01', _version: 1,
};
// Tunde's current row (contact-linked, active — the 2026 re-let).
const TEN_NEW = {
  _id: 'ten-new', firmId: 'firm-1', status: 'active',
  unitId: 'prop-conv-1', unitKey: 'prop-conv-1', propertyId: 'prop-conv-1',
  unitName: '12 Marina Rd, Lagos',
  tenantContactId: 'contact-1', tenantUserId: 'u-tenant-1',
  tenantName: 'Tunde Tenant', tenantPhone: '08030000001', tenantEmail: 'resident@firm1.com',
  emergencyContactName: 'Kola Tenant', emergencyContactPhone: '08099990000', emergencyContactRelationship: 'Brother',
  startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 1200000, paymentFrequency: 'Annually',
  cautionDeposit: 200000, source: 'allocation', createdAt: '2026-01-01', updatedAt: '2026-01-01', _version: 1,
};
// A past, contact-less resident on another unit (never linked to a Contact row).
const TEN_PAST = {
  _id: 'ten-past', firmId: 'firm-1', status: 'ended', endReason: 'terminated', endedAt: '2025-06-30',
  unitId: 'prop-conv-2', unitKey: 'prop-conv-2', propertyId: 'prop-conv-2',
  unitName: '14 Marina Rd, Lagos',
  tenantName: 'Sade Past', tenantPhone: '08021111111', tenantEmail: 'sade@firm1.com',
  startDate: '2024-07-01', endDate: '2025-06-30', rentAmount: 800000, paymentFrequency: 'Annually',
  source: 'record_existing', createdAt: '2024-07-01', updatedAt: '2024-07-01', _version: 1,
};
// A firm-2 resident (must be invisible to firm-1 and vice versa).
const TEN_F2 = {
  _id: 'ten-f2', firmId: 'firm-2', status: 'active',
  unitId: 'prop-conv-f2', unitKey: 'prop-conv-f2', propertyId: 'prop-conv-f2',
  unitName: '99 Other St, Abuja', tenantName: 'F2 Resident', tenantEmail: 'f2resident@firm2.com',
  startDate: '2026-03-01', endDate: '2027-02-28', rentAmount: 500000, paymentFrequency: 'Annually',
  source: 'allocation', createdAt: '2026-03-01', updatedAt: '2026-03-01', _version: 1,
};

// ── Service charge fixtures (PROP1's charges use the CUSTOM id shape — the
//    ledger rows use the Convex _id shape; both resolve to unitKey
//    'prop-conv-1'. CH_FOREIGN_UNIT is on PROP2 — a different unit.) ────────
const CH_UNPAID = {
  _id: 'ch-1', firmId: 'firm-1', unitId: 'prop-custom-1', tenantId: 'u-tenant-1',
  category: 'Diesel', amount: 50000, cycle: 'Monthly', nextDueDate: 1767225600000,
  isDefaulter: true, daysOverdue: 12, serviceChargeStatus: 'UNPAID', creditCarriedForward: 5000,
};
const CH_PARTIAL = {
  _id: 'ch-2', firmId: 'firm-1', unitId: 'prop-custom-1', tenantId: 'u-tenant-1',
  category: 'Security', amount: 20000, cycle: 'Monthly', nextDueDate: 1767225600000,
  isDefaulter: false, serviceChargeStatus: 'PARTIALLY_PAID', outstandingBalance: 8000, amountPaidThisCycle: 12000,
};
const CH_PAID = {
  _id: 'ch-3', firmId: 'firm-1', unitId: 'prop-custom-1', tenantId: 'u-tenant-1',
  category: 'Cleaning', amount: 10000, cycle: 'Monthly', nextDueDate: 1767225600000,
  isDefaulter: false, serviceChargeStatus: 'PAID_FULLY',
};
const CH_FOREIGN_UNIT = {
  _id: 'ch-9', firmId: 'firm-1', unitId: 'prop-custom-2',
  category: 'Water', amount: 999999, cycle: 'Monthly', nextDueDate: 1767225600000,
  isDefaulter: false, serviceChargeStatus: 'UNPAID',
};

// ── Maintenance / documents / conversations fixtures ────────────────────────
const MT_USER = {
  _id: 'mt-1', firmId: 'firm-1', propertyId: 'prop-conv-1', tenantId: 'u-tenant-1',
  tenantName: 'Tunde Tenant', subject: 'Leaking tap', description: 'Kitchen tap',
  category: 'plumbing', status: 'open', createdAt: 1735600000000, updatedAt: 1735600000000,
};
const MT_NAME_ONLY = {
  _id: 'mt-2', firmId: 'firm-1', propertyId: 'prop-conv-1',
  tenantName: 'Tunde Tenant', subject: 'Gate hinge', description: 'Main gate',
  category: 'other', status: 'resolved', createdAt: 1735500000000, updatedAt: 1735500000000,
};
const DOC_THEIR = {
  _id: 'doc-1', firmId: 'firm-1', title: 'Tenancy agreement — 12 Marina',
  propertyId: 'prop-conv-1', dateFiled: '2026-02-01', categoryId: 'cat-1', source: 'upload',
};
const DOC_FOREIGN = {
  _id: 'doc-2', firmId: 'firm-1', title: 'Other property doc',
  propertyId: 'prop-conv-2', dateFiled: '2026-02-02', categoryId: 'cat-1', source: 'upload',
};
const CONV_1 = {
  _id: 'conv-1', firmId: 'firm-1', participantId: 'u-tenant-1', participantName: 'Tunde Tenant',
  participantEmail: 'resident@firm1.com', participantRole: 'Tenant', propertyId: 'prop-conv-1',
  unitId: 'prop-conv-1', lastMessageAt: 1735700000000, lastMessagePreview: 'The tap is still leaking',
  lastMessageBy: 'participant',
};

// ── The standard fixture set ─────────────────────────────────────────────────
const baseFix = (extra: Fixtures = {}) => ({
  user: ADMIN,
  session: ADMIN_SESSION,
  users: [TENANT],
  tables: {
    properties: [PROP1, PROP2, FIRM2_PROP],
    tenancies: [TEN_OLD, TEN_NEW, TEN_PAST, TEN_F2],
    service_charges: [CH_UNPAID, CH_PARTIAL, CH_PAID, CH_FOREIGN_UNIT],
    maintenance_tickets: [MT_USER, MT_NAME_ONLY],
    documents: [DOC_THEIR, DOC_FOREIGN],
    portal_conversations: [CONV_1],
  },
  ...extra,
});

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

// ═══════════════════════════════════════════════════════════════════════════
// E2(a) — auth + firm scope
// ═══════════════════════════════════════════════════════════════════════════
describe('E2(a) — the directory + profile self-authenticate and firm-scope', () => {
  it('rejects anonymous callers (no session, no user)', async () => {
    const { ctx } = makeCtx(baseFix({ user: undefined, session: undefined, users: [TENANT] }));
    await expect(call(getResidentDirectory, ctx, { firmId: 'firm-1' })).rejects.toThrow(/Unauthenticated: a verified session is required/);
    await expect(call(getResidentProfile, ctx, { firmId: 'firm-1', tenantContactId: 'contact-1' })).rejects.toThrow(/Unauthenticated: a verified session is required/);
  });

  it('rejects dead tokens', async () => {
    const { ctx } = makeCtx(baseFix({ session: undefined }));
    await expect(call(getResidentDirectory, ctx, { ...ADMIN_AUTH, firmId: 'firm-1', sessionToken: 'tok-dead-1' })).rejects.toThrow(/the session token is invalid/);
    await expect(call(getResidentProfile, ctx, { ...ADMIN_AUTH, firmId: 'firm-1', sessionToken: 'tok-dead-1', tenantName: 'Tunde Tenant' })).rejects.toThrow(/the session token is invalid/);
  });

  it('rejects portal roles (a resident can never read the roster)', async () => {
    const { ctx } = makeCtx(baseFix({ user: TENANT, session: TENANT_SESSION, users: [] }));
    await expect(call(getResidentDirectory, ctx, { ...ADMIN_AUTH, firmId: 'firm-1', sessionToken: 'tok-tenant-1', userEmail: 'resident@firm1.com' })).rejects.toThrow(/Portal users do not have access/i);
    await expect(call(getResidentProfile, ctx, { ...ADMIN_AUTH, firmId: 'firm-1', sessionToken: 'tok-tenant-1', userEmail: 'resident@firm1.com', tenantContactId: 'contact-1' })).rejects.toThrow(/Portal users do not have access/i);
  });

  it('rejects a firm-1 staff member passing firm-2\'s id (assertSameFirm)', async () => {
    const { ctx } = makeCtx(baseFix());
    await expect(call(getResidentDirectory, ctx, { ...ADMIN_AUTH, firmId: 'firm-2' })).rejects.toThrow(/different firm/i);
    await expect(call(getResidentProfile, ctx, { ...ADMIN_AUTH, firmId: 'firm-2', tenantContactId: 'contact-1' })).rejects.toThrow(/different firm/i);
  });

  it('firm-2 staff see only firm-2 rows (and firm-1 rows never leak)', async () => {
    const { ctx } = makeCtx(baseFix({ user: FIRM2_ADMIN, session: FIRM2_ADMIN_SESSION }));
    const dir = await call(getResidentDirectory, ctx, { ...ADMIN_AUTH, firmId: 'firm-2', sessionToken: 'tok-f2-admin', userEmail: 'admin@firm2.com' });
    expect(dir.residents).toHaveLength(1);
    expect(dir.residents[0].name).toBe('F2 Resident');
    const names = JSON.stringify(dir.residents);
    expect(names).not.toContain('Tunde');
    expect(names).not.toContain('Sade');

    const prof = await call(getResidentProfile, ctx, { ...ADMIN_AUTH, firmId: 'firm-2', sessionToken: 'tok-f2-admin', userEmail: 'admin@firm2.com', tenantName: 'F2 Resident' });
    expect(prof.tenancies).toHaveLength(1);
    expect(prof.tenancies[0].unitKey).toBe('prop-conv-f2');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E2(b) — the roster: union-merge, ledger-derived, shape-proof balances
// ═══════════════════════════════════════════════════════════════════════════
describe('E2(b) — the resident directory', () => {
  it('union-merges a contact-less early row with the contact-linked later row (ONE resident, not two)', async () => {
    const { ctx } = makeCtx(baseFix());
    const dir = await call(getResidentDirectory, ctx, { ...ADMIN_AUTH, firmId: 'firm-1' });

    const tundes = dir.residents.filter((r: any) => (r.name || '') === 'Tunde Tenant');
    expect(tundes).toHaveLength(1); // the 2026-09-12 fragmentation failure mode — closed
    expect(tundes[0].totals.tenancies).toBe(2); // TEN_OLD + TEN_NEW merged
    expect(tundes[0].contactId).toBe('contact-1');
    expect(tundes[0].userId).toBe('u-tenant-1');
    expect(tundes[0].hasPortalAccount).toBe(true);
  });

  it('includes residents never linked to a Contact row (the roster is ledger-derived)', async () => {
    const { ctx } = makeCtx(baseFix());
    const dir = await call(getResidentDirectory, ctx, { ...ADMIN_AUTH, firmId: 'firm-1' });

    const sade = dir.residents.find((r: any) => (r.name || '') === 'Sade Past');
    expect(sade).toBeTruthy();
    expect(sade.contactId).toBeNull();       // never linked — still visible
    expect(sade.hasPortalAccount).toBe(false);
    expect(sade.active).toBe(false);
    expect(sade.currentTenancy).toBeNull();
    expect(sade.outstanding).toBeNull();      // no active tenancy → no balance projection
  });

  it('sorts active residents first, then by name', async () => {
    const { ctx } = makeCtx(baseFix());
    const dir = await call(getResidentDirectory, ctx, { ...ADMIN_AUTH, firmId: 'firm-1' });
    expect(dir.residents.map((r: any) => r.name)).toEqual(['Tunde Tenant', 'Sade Past']);
    expect(dir.counts).toEqual({ total: 2, active: 1, withOutstanding: 1 });
  });

  it('computes outstanding balances SHAPE-PROOF (custom-id charge ↔ Convex-_id tenancy, same unit)', async () => {
    const { ctx } = makeCtx(baseFix());
    const dir = await call(getResidentDirectory, ctx, { ...ADMIN_AUTH, firmId: 'firm-1' });

    const tunde = dir.residents.find((r: any) => (r.name || '') === 'Tunde Tenant');
    // CH_UNPAID 50000 − credit 5000 = 45000; CH_PARTIAL outstandingBalance 8000;
    // CH_PAID 0; CH_FOREIGN_UNIT (different unit) excluded entirely.
    expect(tunde.outstanding).toEqual({
      amount: 53000, charges: 3, unpaid: 1, partial: 1, paid: 1, defaulters: 1,
    });
    expect(tunde.currentTenancy.unitKey).toBe('prop-conv-1');
    expect(tunde.currentTenancy.unitLabel).toBeTruthy();
    expect(tunde.currentTenancy.rentAmount).toBe(1200000);
  });

  it('counts maintenance tickets by portal user OR exact name (the directory stat)', async () => {
    const { ctx } = makeCtx(baseFix());
    const dir = await call(getResidentDirectory, ctx, { ...ADMIN_AUTH, firmId: 'firm-1' });
    const tunde = dir.residents.find((r: any) => (r.name || '') === 'Tunde Tenant');
    expect(tunde.totals.maintenanceCount).toBe(2); // MT_USER (by id) + MT_NAME_ONLY (by name)
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E2(c) — the consolidated profile
// ═══════════════════════════════════════════════════════════════════════════
describe('E2(c) — the consolidated resident profile', () => {
  it('aggregates identity, tenancies, balances, maintenance, documents, communications', async () => {
    const { ctx } = makeCtx(baseFix());
    // The ContactDetailView call shape: all the contact's keys at once —
    // richer than a single-key lookup; the server matches on ANY.
    const prof = await call(getResidentProfile, ctx, {
      ...ADMIN_AUTH,
      firmId: 'firm-1',
      tenantContactId: 'contact-1',
      tenantUserId: 'u-tenant-1',
      tenantEmail: 'resident@firm1.com',
      tenantName: 'Tunde Tenant',
    });

    // Identity + emergency contact (from the LATEST row).
    expect(prof.resident.name).toBe('Tunde Tenant');
    expect(prof.resident.hasPortalAccount).toBe(true);
    expect(prof.resident.emergencyContact).toEqual({
      name: 'Kola Tenant', phone: '08099990000', relationship: 'Brother',
    });

    // Tenancies: BOTH rows matched (the email/name keys bridge the eras),
    // newest first, with in-window attributed payments.
    expect(prof.tenancies).toHaveLength(2);
    expect(prof.tenancies[0]._id).toBe('ten-new');
    expect(prof.tenancies[0].payments).toHaveLength(1);
    expect(prof.tenancies[0].totalPaid).toBe(1200000);
    expect(prof.tenancies[1]._id).toBe('ten-old');
    expect(prof.tenancies[1].totalPaid).toBe(0); // 2024 window: the 2026 receipt is out of window

    // Balances on the active unit only, shape-proof, read-only.
    expect(prof.balances.totals).toEqual({
      outstanding: 53000, unpaid: 1, partial: 1, paid: 1, defaulters: 1,
    });
    expect(prof.balances.charges.map((c: any) => c.category)).toEqual(
      expect.arrayContaining(['Diesel', 'Security', 'Cleaning'])
    );
    expect(prof.balances.charges.find((c: any) => c.category === 'Water')).toBeUndefined();

    // Documents: only from the resident's tenancy properties.
    expect(prof.documents.map((d: any) => d.title)).toEqual(['Tenancy agreement — 12 Marina']);

    // Communications: portal conversations by participant id.
    expect(prof.communications).toHaveLength(1);
    expect(prof.communications[0].lastMessagePreview).toBe('The tap is still leaking');
    expect(prof.communications[0].lastMessageBy).toBe('participant');

    // Maintenance: the OR keying (portal user ∨ exact name) — with the full
    // panel keys BOTH the id-keyed and the name-snapshot tickets match (the
    // same rule as E1's getResidentHistory).
    expect(prof.maintenance.map((m: any) => m._id)).toEqual(['mt-1', 'mt-2']);

    // Totals strip.
    expect(prof.totals).toEqual({
      tenancies: 2, activeCount: 1, paymentsCount: 1, totalPaid: 1200000,
      maintenanceCount: 2, documentsCount: 1, conversationsCount: 1, outstanding: 53000,
    });
  });

  it('matches maintenance by exact name when no portal user key is given (the bounded fallback)', async () => {
    const { ctx } = makeCtx(baseFix());
    const byName = await call(getResidentProfile, ctx, {
      ...ADMIN_AUTH,
      firmId: 'firm-1', tenantName: 'Tunde Tenant',
    });
    expect(byName.maintenance.map((m: any) => m._id)).toEqual(['mt-1', 'mt-2']); // name matches both
    expect(byName.communications).toEqual([]); // no userId key → no conversation read
  });

  it('resolves an email lookup to the portal user (userId), unlocking conversations', async () => {
    const { ctx } = makeCtx(baseFix());
    const prof = await call(getResidentProfile, ctx, {
      ...ADMIN_AUTH,
      firmId: 'firm-1', tenantEmail: 'resident@firm1.com',
    });
    expect(prof.resident.userId).toBe('u-tenant-1');
    expect(prof.communications).toHaveLength(1);
  });

  it('keeps a past resident\'s profile complete (ended rows + no balance projection)', async () => {
    const { ctx } = makeCtx(baseFix());
    const prof = await call(getResidentProfile, ctx, {
      ...ADMIN_AUTH,
      firmId: 'firm-1', tenantName: 'Sade Past',
    });
    expect(prof.tenancies).toHaveLength(1);
    expect(prof.tenancies[0].status).toBe('ended');
    expect(prof.tenancies[0].endReason).toBe('terminated');
    expect(prof.balances).toBeNull(); // no active tenancy → nothing invented
    expect(prof.totals.activeCount).toBe(0);
    expect(prof.totals.outstanding).toBe(0);
  });

  it('throws when no lookup key is provided at all', async () => {
    const { ctx } = makeCtx(baseFix());
    await expect(call(getResidentProfile, ctx, { ...ADMIN_AUTH, firmId: 'firm-1' })).rejects.toThrow(/contact, portal user, email or name/i);
  });

  it('getResidentHistory stays byte-stable for the same key (the E1 twin)', async () => {
    const { ctx } = makeCtx(baseFix());
    const history = await call(getResidentHistory, ctx, {
      ...ADMIN_AUTH,
      firmId: 'firm-1', tenantContactId: 'contact-1',
    });
    const profile = await call(getResidentProfile, ctx, {
      ...ADMIN_AUTH,
      firmId: 'firm-1', tenantContactId: 'contact-1',
    });
    // Single-key (contactId only): both surfaces match the same ONE row.
    expect(history.tenancies).toHaveLength(1);
    expect(profile.tenancies).toHaveLength(1);
    expect(history.tenancies[0].totalPaid).toBe(profile.tenancies[0].totalPaid);
    // And the E1 surface still returns its documented shape.
    expect(history.totals).toHaveProperty('maintenanceCount');
    expect(profile.resident.emergencyContact.name).toBe('Kola Tenant');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E2(d) — source contracts
// ═══════════════════════════════════════════════════════════════════════════
describe('E2(d) — source contracts', () => {
  it('the lifecycle module: 12 staff-authed publics (E4 raised 11 → 12), union-merge documented', () => {
    const mod = read('convex/tenancyLifecycle.ts');
    expect((mod.match(/requireStaffCaller\(/g) || []).length).toBe(12); // 8 E1 + 2 E2 reads + 1 E3 read + 1 E4 bulk mutation (roundEWave4.test.ts)
    expect(mod).toContain('groupResidentRows');
    expect(mod).toContain('union-merge'); // documented invariant
    expect(mod).toContain('READ-ONLY');
  });

  it('api.d.ts registers the module (no new module — no registration churn)', () => {
    const apiDts = read('convex/_generated/api.d.ts');
    expect(apiDts).toContain('tenancyLifecycle');
  });

  it('the new components use ui/ primitives ONLY (no raw interactive elements)', () => {
    const panel = read('src/components/details/ResidentProfilePanel.tsx');
    const dir = read('src/components/atrium/ResidentDirectory.tsx');
    const rawElement = /<(button|input|select|textarea)[\s>]/;
    expect(panel).not.toMatch(rawElement);
    expect(dir).not.toMatch(rawElement);
    expect(panel).toContain("from '../ui'");
    expect(dir).toContain("from '../ui'");
  });

  it('ContactDetailView renders the profile panel; BillingView hosts the directory', () => {
    const contactDetail = read('src/components/details/ContactDetailView.tsx');
    expect(contactDetail).toContain('ResidentProfilePanel');
    expect(contactDetail).toContain('ROUND E (Wave E2)');

    const billing = read('src/components/BillingView.tsx');
    expect(billing).toContain("id: 'residents'");
    expect(billing).toContain('ResidentDirectory');
    expect(billing).toContain("| 'residents'");
  });
});
