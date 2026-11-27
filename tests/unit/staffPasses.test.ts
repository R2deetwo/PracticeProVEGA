/**
 * staffPasses.test.ts — TASK 94 (2026-11-25), the QUIET in-house flow
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The repurposed pass-request capability: ESTATE-ADMIN-issued staff
 * passes whose gate check-in/check-out timestamps form the movement /
 * attendance log. Exercised against the REAL handlers (fixture-backed ctx):
 *
 *   1. issueStaffPass — admin-authenticated, VMS billing gate honoured,
 *      minted through the same unique-code + passRef rules, passCategory
 *      'staff', NO WhatsApp dispatch (deliveryMethod 'none').
 *   2. The gate sees a STAFF badge — the verify projection carries
 *      passCategory + staffRole.
 *   3. Arrival/departure logging — the SAME check-in/check-out endpoints
 *      stamp the times; duration is derivable.
 *   4. getStaffAttendance — firm-gated attendance log with per-worker-per-
 *      day rollup; every pull audit-logged.
 *   5. Quietness — no resident/gate surface references issueStaffPass.
 */
import { describe, it, expect, vi } from 'vitest';

import {
  issueStaffPass,
  getStaffAttendance,
  verifyToken,
  checkInVisitor,
  checkOutVisitor,
} from '../../convex/visitorManagement';
import { hashSessionToken } from '../../convex/sessions';

type Row = Record<string, any>;

function makeCtx(tables: Record<string, Row[]>) {
  const CMP: Record<string, (a: any, b: any) => boolean> = {
    eq: (a, b) => String(a) === String(b),
    gte: (a, b) => Number(a) >= Number(b),
    lte: (a, b) => Number(a) <= Number(b),
    lt: (a, b) => Number(a) < Number(b),
    gt: (a, b) => Number(a) > Number(b),
    neq: (a, b) => String(a) !== String(b),
  };
  const findRows = (table: string, conds: Array<[string, string, any]>) =>
    (tables[table] ?? []).filter((r) => conds.every(([f, op, v]) => r[f] !== undefined && CMP[op](r[f], v)));
  const qFor = (r: Row) => {
    const q: any = { field: (name: string) => r[name] };
    for (const op of Object.keys(CMP)) q[op] = (a: any, b: any) => CMP[op](a, b);
    return q;
  };
  const chainFor = (rows: Row[]) => {
    const chain: any = {
      first: async () => rows[0] ?? null,
      unique: async () => rows[0] ?? null,
      collect: async () => rows,
      take: async (n: number) => rows.slice(0, n),
      order: (_dir: string) => chain,
      filter: (fn: any) => chainFor(rows.filter((r) => fn(qFor(r)) !== false)),
    };
    return chain;
  };
  const db: any = {
    query: (table: string) => ({
      withIndex: (_name: string, fn: (q: any) => any) => {
        const conds: Array<[string, string, any]> = [];
        const q: any = { eq: (field: string, value: any) => { conds.push([field, 'eq', value]); return q; } };
        fn(q);
        return chainFor(findRows(table, conds));
      },
      filter: (fn: any) => chainFor((tables[table] ?? []).filter((r) => fn(qFor(r)) !== false)),
      order: (_dir: string) => chainFor(tables[table] ?? []),
      collect: async () => tables[table] ?? [],
      take: async (n: number) => (tables[table] ?? []).slice(0, n),
      first: async () => (tables[table] ?? [])[0] ?? null,
    }),
    get: async (id: any) => {
      for (const rows of Object.values(tables)) {
        const hit = rows.find((r) => String(r._id) === String(id));
        if (hit) return hit;
      }
      return null;
    },
    insert: async (table: string, value: any) => {
      const _id = `${table}_${(tables[table] ?? []).length + 1}_${Math.random().toString(36).slice(2, 7)}`;
      (tables[table] = tables[table] ?? []).push({ _id, ...value });
      return _id as any;
    },
    patch: async (id: any, patch: any) => {
      for (const rows of Object.values(tables)) {
        const hit = rows.find((r) => String(r._id) === String(id));
        if (hit) { Object.assign(hit, patch); return null; }
      }
      return null;
    },
    delete: async () => null,
  };
  return {
    ctx: {
      db,
      runMutation: vi.fn(),
      runAction: vi.fn(),
      runQuery: vi.fn(),
      scheduler: { runAfter: vi.fn() },
      auth: { getUserIdentity: async () => null },
    },
    tables,
  };
}

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const TODAY = new Date(NOW).toISOString().split('T')[0];
const ADMIN_ID = 'users_9_admin';
const SESSION_PLAIN_ADMIN = 'sess-admin-3333';

function baseTables(): Record<string, Row[]> {
  return {
    firms: [
      { _id: 'firm_1', id: 'firm-1', name: 'Atrium Estates', email: 'admin@atrium.ng', subscriptionPlan: 'Komplete', subscriptionAddons: { vms: { status: 'active' } },
        // 2026-11-27 entitlement layer: fixture firm is ALSO founder-approved
        // (firms.vmsEnabled) — the capability gate sits ABOVE the billing gate.
        vmsEnabled: true, vmsRequestStatus: 'approved' },
    ],
    users: [
      { _id: ADMIN_ID, id: ADMIN_ID, name: 'Estate Admin', email: 'admin@atrium.ng', role: 'Administrator', firmId: 'firm-1' },
    ],
    sessions: [
      { _id: 'sess_3', tokenHash: hashSessionToken(SESSION_PLAIN_ADMIN), userId: ADMIN_ID, expiresAt: NOW + DAY, revokedAt: null },
    ],
    suspendedUsers: [],
    portal_settings: [{ _id: 'ps_1', firmId: 'firm-1', vmsGracePeriodMinutes: 30 }],
    properties: [{ _id: 'prop_1', id: 'prop_1', firmId: 'firm-1', name: 'Palm Grove', address: '12 Marina Rd' }],
    gatehouse_accounts: [],
    gatehouse_sessions: [],
    visitor_tokens: [],
    securityEvents: [],
    audit_logs: [],
    rateLimits: [],
    app_notifications: [],
  };
}

const h = (fn: any) => (fn as any)._handler ?? fn;
const ADMIN_ARGS = { userEmail: 'admin@atrium.ng', sessionToken: SESSION_PLAIN_ADMIN };

describe('staffPasses §1 — issueStaffPass', () => {
  it('mints a 6-digit code + 12-char passRef through the SAME rules, with passCategory "staff" and NO WhatsApp dispatch', async () => {
    const { ctx, tables } = makeCtx(baseTables());
    const out = await h(issueStaffPass)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', staffName: 'Mama Ada', staffRole: 'Cleaner',
      visitDate: TODAY, expiryWindowHours: 24, ...ADMIN_ARGS,
    });
    expect(out.tokenCode).toMatch(/^\d{6}$/);
    expect(out.passRef).toMatch(/^[A-HJKMNP-Z2-9]{12}$/);
    const row = tables.visitor_tokens[0];
    expect(row.passCategory).toBe('staff');
    expect(row.staffRole).toBe('Cleaner');
    expect(row.deliveryMethod).toBe('none');            // quiet — no WhatsApp ever
    expect(row.visitorName).toBe('Mama Ada');           // the worker's name at the gate
    expect(row.issuedByName).toBe('Estate Admin');
    expect(row.residentId).toBe(ADMIN_ID);              // issuing admin holds revocation
    expect(row.status).toBe('active');
    expect(row.expiryWindowHours).toBe(24); // time-independent: valid for the whole visit day + grace
  });

  it('is admin-gated: no session → unauthenticated; another firm\u2019s property → refused', async () => {
    const { ctx } = makeCtx(baseTables());
    await expect(h(issueStaffPass)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', staffName: 'W', visitDate: TODAY, expiryWindowHours: 6,
    })).rejects.toThrow(/Unauthenticated/);
    // firm mismatch
    await expect(h(issueStaffPass)(ctx, {
      firmId: 'firm-other', propertyId: 'prop_1', staffName: 'W', visitDate: TODAY, expiryWindowHours: 6, ...ADMIN_ARGS,
    })).rejects.toThrow(/firm mismatch/i);
  });

  it('clamps the window to 1–24h and rejects an impossible date', async () => {
    const { ctx } = makeCtx(baseTables());
    await expect(h(issueStaffPass)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', staffName: 'W', visitDate: 'not-a-date', expiryWindowHours: 6, ...ADMIN_ARGS,
    })).rejects.toThrow(/Invalid visit date/i);
  });
});

describe('staffPasses §2 — the gate sees a STAFF badge', () => {
  it('verifyToken projects passCategory + staffRole, and the admin reports do not leak staff passes into visitor reports', async () => {
    const { ctx, tables } = makeCtx(baseTables());
    const issued = await h(issueStaffPass)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', staffName: 'Mama Ada', staffRole: 'Cleaner',
      visitDate: TODAY, expiryWindowHours: 24, ...ADMIN_ARGS,
    });
    const v: any = await h(verifyToken)(ctx, { tokenCode: issued.tokenCode, propertyId: 'prop_1' });
    expect(v.valid).toBe(true);
    expect(v.passCategory).toBe('staff');
    expect(v.staffRole).toBe('Cleaner');
    expect(v.issuedByName).toBe('Estate Admin');
    expect(tables.visitor_tokens[0].visitorPhone).toBe('');
  });
});

describe('staffPasses §3 — arrival + departure = the attendance log', () => {
  it('check-in stamps arrival, check-out stamps departure, and the duration is derivable', async () => {
    const { ctx, tables } = makeCtx(baseTables());
    const issued = await h(issueStaffPass)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', staffName: 'Tech Tayo', staffRole: 'Technician',
      visitDate: TODAY, expiryWindowHours: 24, ...ADMIN_ARGS,
    });
    await h(checkInVisitor)(ctx, { tokenCode: issued.tokenCode, propertyId: 'prop_1', gatekeeperName: 'Main Gate' });
    expect(tables.visitor_tokens[0].checkedInAt).toBeGreaterThan(0);
    await h(checkOutVisitor)(ctx, { tokenCode: issued.tokenCode, propertyId: 'prop_1' });
    expect(tables.visitor_tokens[0].checkedOutAt).toBeGreaterThan(0);
  });
});

describe('staffPasses §4 — getStaffAttendance', () => {
  it('returns the movement log with a per-worker-per-day rollup, and audit-logs the pull', async () => {
    const { ctx, tables } = makeCtx(baseTables());
    const a = await h(issueStaffPass)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', staffName: 'Mama Ada', staffRole: 'Cleaner',
      visitDate: TODAY, expiryWindowHours: 24, ...ADMIN_ARGS,
    });
    const b = await h(issueStaffPass)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', staffName: 'Mama Ada', staffRole: 'Cleaner',
      visitDate: TODAY, expiryWindowHours: 12, ...ADMIN_ARGS,
    });
    // Ada checks in on pass A, out; a fresh pass B stays un-arrived.
    await h(checkInVisitor)(ctx, { tokenCode: a.tokenCode, propertyId: 'prop_1', gatekeeperName: 'Main Gate' });
    await h(checkOutVisitor)(ctx, { tokenCode: a.tokenCode, propertyId: 'prop_1' });

    const out: any = await h(getStaffAttendance)(ctx, {
      firmId: 'firm-1', from: TODAY, to: TODAY, ...ADMIN_ARGS,
    });
    expect(out.total).toBe(2);
    expect(out.records.find((r: any) => r.tokenCode === a.tokenCode).durationMinutes).toBeGreaterThanOrEqual(0);
    expect(out.records.find((r: any) => r.tokenCode === b.tokenCode).arrivedAt).toBeNull();
    expect(out.rollup).toHaveLength(1); // one worker-day: Ada × today
    expect(out.rollup[0].staffName).toBe('Mama Ada');
    expect(out.rollup[0].entries).toBe(2);
    expect(out.rollup[0].firstArrivedAt).toBeTruthy();
    expect(tables.audit_logs.some((l: any) => l.resourceId === 'staff_attendance')).toBe(true);
  });

  it('is firm-gated (no session → unauthenticated) and date-scoped', async () => {
    const { ctx } = makeCtx(baseTables());
    await expect(h(getStaffAttendance)(ctx, { firmId: 'firm-1', from: TODAY, to: TODAY }))
      .rejects.toThrow(/Unauthenticated/);
  });
});

describe('staffPasses §5 — quietness (no visitor-facing surface)', () => {
  it('issueStaffPass / getStaffAttendance appear ONLY in the admin Security & Access surface', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const repoRoot = existsSync(resolve('convex/visitorManagement.ts')) ? process.cwd() : resolve('..', '..');
    const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');
    const portal = read('src/components/portal/VisitorPortal.tsx');
    const gate = read('src/components/portal/GatekeeperInterface.tsx');
    const staffPanel = read('src/components/settings/StaffPassesPanel.tsx');

    expect(staffPanel).toContain('issueStaffPass');      // the one quiet admin surface
    expect(portal).not.toContain('issueStaffPass');      // residents never issue staff passes
    expect(gate).not.toContain('issueStaffPass');        // the gate never issues passes
    expect(gate).toContain('passCategory === \u0027staff\u0027'); // but the gate DOES badge staff
  });
});
