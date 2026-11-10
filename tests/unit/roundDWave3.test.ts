/**
 * roundDWave3.test.ts — ROUND D (Wave 3) regression tests: D4 (security
 * response console truth) + D5 (subscription request truth loop) + D6
 * (proactive insight read auth) + D7 (firm-wide maintenance queue).
 *
 * PINNED BUG CLASSES (the Round D audit, Wave 3 findings — re-derived on the
 * R79 tree when the original audit enumeration was lost with the session
 * context; every claim re-verified before fixing):
 *
 * D4 — the security console was DETECT-ONLY, and worse:
 *   • securityHelpers' whole response suite (blockIp / unblockIp /
 *     suspendUser / unsuspendUser + the blockedIps / suspendedUsers lists)
 *     had ZERO UI — properly gated (session-verified requireFounder) but
 *     unreachable;
 *   • blockedIps rows were read by NOTHING — blocking was placebo;
 *   • sessions.revokeAllUserSessions was an UNGATED public mutation — any
 *     caller could force-logout ANY user by id.
 *
 * D5 — the subscription request loop was half-dead with drifting twins:
 *   • the bank-transfer fallback wrote a pending_review row the user could
 *     never see again (getMyPendingSubscriptionRequest: zero callers);
 *   • the dead myFunctions approval twins were superseded by the wired
 *     founderMetrics console variants, but ONLY the dead twin carried the
 *     REVENUE-LEAK FIX #9 (unified-firm downgrade must flip firm.product) —
 *     the live approval path was leaking ~₦400K+/yr per downgraded firm.
 *
 * D6 — proactive insight reads were UNAUTHENTICATED: getInsights took a bare
 *   firmId (cross-firm deadline/anomaly/briefing reads); its orphaned twins
 *   getLatestBriefing / getInsightCounts were the same hole with no callers.
 *
 * D7 — the firm-wide maintenance queue never existed: tenants could submit
 *   tickets and the property view showed per-property lists, but
 *   getMaintenanceTicketsByFirm had zero callers — staff triage (see all,
 *   advance status, assign) was only possible inside a message thread that
 *   happened to link the ticket.
 *
 * Every fix is pinned in BOTH directions per the house convention: the
 * broken path is dead, the legitimate workflow works.
 *
 * Testing style: the Round A/B/D behavioural harness (fixture-backed mock
 * ctx executing the real Convex handlers via `_handler(ctx, args)`) plus
 * source-contract tests for the UI wiring (the R16/R77/R79 pattern).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Convex functions under test ─────────────────────────────────────────────
import { revokeAllUserSessions } from '../../convex/sessions';
import { blockIp, unblockIp, suspendUser, unsuspendUser, isIpBlocked } from '../../convex/securityHelpers';
import { getMyPendingSubscriptionRequest } from '../../convex/myFunctions';
import { approveSubscriptionRequestAsFounder } from '../../convex/founderMetrics';
import { getInsights } from '../../convex/proactive';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
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
    suspendedUsers: [],
    securityEvents: [],
    blockedIps: [],
    firms: [],
    notifications: [],
    analytics_events: [],
    subscriptionRequests: [],
    proactive_insights: [],
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
      // Actually remove the row so table-state assertions are meaningful
      // (unblockIp/unsuspendUser delete their rows).
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
// Platform founder — no firmId (founders are platform-level users).
const PLATFORM_FOUNDER = { _id: 'u-pf-1', email: 'founder@practicepro.ng', tokenIdentifier: 'founder@practicepro.ng', name: 'Fola Founder', role: 'Founder', firmId: null };
const PLATFORM_FOUNDER_SESSION = { token: 'tok-pf-1', userId: 'u-pf-1' };
const TARGET_USER = { _id: 'u-target-1', email: 'target@firm1.com', tokenIdentifier: 'target@firm1.com', name: 'Tayo Target', role: 'Lawyer', firmId: 'firm-1' };
const FIRM2_ADMIN = { _id: 'u-f2-admin', email: 'admin@firm2.com', tokenIdentifier: 'admin@firm2.com', name: 'Bisi Firm2', role: 'Admin', firmId: 'firm-2' };
const FIRM2_ADMIN_SESSION = { token: 'tok-f2-admin', userId: 'u-f2-admin' };
const TENANT = { _id: 'u-tenant-1', email: 'resident@firm1.com', tokenIdentifier: 'resident@firm1.com', name: 'Tunde Tenant', role: 'Tenant', firmId: 'firm-1' };
const TENANT_SESSION = { token: 'tok-tenant-1', userId: 'u-tenant-1' };

const NOW = Date.now();

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

// ═══════════════════════════════════════════════════════════════════════════
// D4 — sessions.revokeAllUserSessions: the ungate is closed
// ═══════════════════════════════════════════════════════════════════════════
describe('D4 — revokeAllUserSessions (was: unauthenticated force-logout of anyone)', () => {
  it('REJECTS a caller with no session (was: anyone could revoke anyone)', async () => {
    const { ctx } = makeCtx();
    await expect(
      (revokeAllUserSessions as any)._handler(ctx, { userId: 'u-target-1' })
    ).rejects.toThrow(/Unauthenticated/);
  });

  it('REJECTS an Admin trying to revoke ANOTHER user (not self, not founder)', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN });
    await expect(
      (revokeAllUserSessions as any)._handler(ctx, { userId: 'u-target-1', sessionToken: 'tok-admin-xyz' })
    ).rejects.toThrow(/you may only revoke your own sessions/i);
  });

  it('ALLOWS self-service revocation (password change: kill my other sessions)', async () => {
    const { ctx, tables } = makeCtx({
      session: ADMIN_SESSION, user: ADMIN,
      tables: {
        sessions: [
          { _id: 's1', tokenHash: hashSessionToken('tok-admin-xyz'), userId: 'u-admin-1', expiresAt: NOW + 86400000 },
          { _id: 's2', tokenHash: hashSessionToken('tok-other-device'), userId: 'u-admin-1', expiresAt: NOW + 86400000 },
        ],
      },
    });
    const res = await (revokeAllUserSessions as any)._handler(ctx, { userId: 'u-admin-1', sessionToken: 'tok-admin-xyz' });
    expect(res.revoked).toBe(2);
    expect(tables.sessions.every((s) => typeof s.revokedAt === 'number')).toBe(true);
  });

  it('ALLOWS a platform founder to revoke a suspended user\'s sessions (the SecurityCenter flow)', async () => {
    const { ctx, tables } = makeCtx({
      session: PLATFORM_FOUNDER_SESSION, user: PLATFORM_FOUNDER,
      tables: {
        sessions: [
          // The founder's OWN session (the caller's bearer)…
          { _id: 's0', tokenHash: hashSessionToken('tok-pf-1'), userId: 'u-pf-1', expiresAt: NOW + 86400000 },
          // …and the target user's live session that must die with the ban.
          { _id: 's1', tokenHash: hashSessionToken('tok-target-live'), userId: 'u-target-1', expiresAt: NOW + 86400000 },
        ],
      },
    });
    const res = await (revokeAllUserSessions as any)._handler(ctx, { userId: 'u-target-1', sessionToken: 'tok-pf-1' });
    expect(res.revoked).toBe(1);
    const target = tables.sessions.find((s) => s._id === 's1')!;
    expect(target.revokedAt).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D4 — securityHelpers response suite: gated, real, enforceable
// ═══════════════════════════════════════════════════════════════════════════
describe('D4 — securityHelpers actions (founder-gated, attribution from the session)', () => {
  it('blockIp REJECTS a non-founder session', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN });
    await expect(
      (blockIp as any)._handler(ctx, { tokenIdentifier: 'admin@firm1.com', sessionToken: 'tok-admin-xyz', ip: '197.210.0.5', reason: 'spam' })
    ).rejects.toThrow(/founder access required/i);
  });

  it('blockIp inserts with SESSION-DERIVED attribution (founder email, never caller-supplied)', async () => {
    const { ctx, tables } = makeCtx({ session: PLATFORM_FOUNDER_SESSION, user: PLATFORM_FOUNDER });
    await (blockIp as any)._handler(ctx, { tokenIdentifier: 'whoever@example.com', sessionToken: 'tok-pf-1', ip: '197.210.0.5', reason: 'AI proxy abuse' });
    const row = tables.blockedIps.find((r) => r.ip === '197.210.0.5');
    expect(row).toBeTruthy();
    expect(row!.blockedBy).toBe('founder@practicepro.ng');
  });

  it('blockIp is idempotent (re-blocking returns the existing row)', async () => {
    const { ctx, tables } = makeCtx({
      session: PLATFORM_FOUNDER_SESSION, user: PLATFORM_FOUNDER,
      tables: { blockedIps: [{ _id: 'b1', ip: '197.210.0.5', reason: 'existing', blockedBy: 'x', blockedAt: 1 }] },
    });
    await (blockIp as any)._handler(ctx, { tokenIdentifier: 'f', sessionToken: 'tok-pf-1', ip: '197.210.0.5' });
    expect(tables.blockedIps.length).toBe(1);
  });

  it('unblockIp removes the row; suspendUser/unsuspendUser enforce founder-only with session attribution', async () => {
    const { ctx, tables } = makeCtx({
      session: PLATFORM_FOUNDER_SESSION, user: PLATFORM_FOUNDER,
      tables: { blockedIps: [{ _id: 'b1', ip: '197.210.0.5', reason: 'x', blockedBy: 'y', blockedAt: 1 }] },
    });
    await (unblockIp as any)._handler(ctx, { tokenIdentifier: 'f', sessionToken: 'tok-pf-1', ip: '197.210.0.5' });
    expect(tables.blockedIps.length).toBe(0);

    await (suspendUser as any)._handler(ctx, { tokenIdentifier: 'f', sessionToken: 'tok-pf-1', userId: 'u-target-1', reason: 'Abuse' });
    const s = tables.suspendedUsers.find((r) => r.userId === 'u-target-1');
    expect(s).toBeTruthy();
    expect(s!.suspendedBy).toBe('founder@practicepro.ng');

    await (unsuspendUser as any)._handler(ctx, { tokenIdentifier: 'f', sessionToken: 'tok-pf-1', userId: 'u-target-1' });
    expect(tables.suspendedUsers.find((r) => r.userId === 'u-target-1')).toBeFalsy();

    // Admin cannot suspend.
    const adminCtx = makeCtx({ session: ADMIN_SESSION, user: ADMIN });
    await expect(
      (suspendUser as any)._handler(adminCtx.ctx, { tokenIdentifier: 'admin@firm1.com', sessionToken: 'tok-admin-xyz', userId: 'u-target-1' })
    ).rejects.toThrow(/founder access required/i);
  });

  it('isIpBlocked: the enforcement read that was missing (placebo → real)', async () => {
    const { ctx } = makeCtx({
      tables: { blockedIps: [{ _id: 'b1', ip: '197.210.0.5', reason: 'x', blockedBy: 'y', blockedAt: 1 }] },
    });
    expect(await (isIpBlocked as any)._handler(ctx, { ip: '197.210.0.5' })).toBe(true);
    expect(await (isIpBlocked as any)._handler(ctx, { ip: '102.89.0.1' })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D4 — source contracts: the console is wired, the chokepoint enforces
// ═══════════════════════════════════════════════════════════════════════════
describe('D4 — SecurityCenter + /ai/stream source contracts', () => {
  it('SecurityCenter wires the full response suite with the founder bearer', () => {
    const src = read('src/admin/views/SecurityCenter.tsx');
    expect(src).toContain('api.securityHelpers.getBlockedIps');
    expect(src).toContain('api.securityHelpers.getSuspendedUsers');
    expect(src).toContain('api.securityHelpers.blockIp');
    expect(src).toContain('api.securityHelpers.unblockIp');
    expect(src).toContain('api.securityHelpers.suspendUser');
    expect(src).toContain('api.securityHelpers.unsuspendUser');
    // Suspend flow force-revokes sessions.
    expect(src).toContain('api.sessions.revokeAllUserSessions');
    expect(src).toMatch(/sessionToken: authArgs\.sessionToken/);
  });

  it('/ai/stream enforces the IP block (x-forwarded-for → isIpBlocked → 403)', () => {
    const src = read('convex/http.ts');
    const streamAt = src.indexOf('path: "/ai/stream"');
    expect(streamAt).toBeGreaterThan(-1);
    const body = src.slice(streamAt, streamAt + 3000);
    expect(body).toContain('x-forwarded-for');
    expect(body).toContain('internal.securityHelpers.isIpBlocked');
    expect(body).toContain('status: 403');
    // The pre-existing H18 auth contract still holds.
    expect(body).toContain('resolveUserBySessionToken(ctx, bearer)');
    expect(body).toContain('status: 401');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D5 — getMyPendingSubscriptionRequest (the user-side truth surface)
// ═══════════════════════════════════════════════════════════════════════════
describe('D5 — getMyPendingSubscriptionRequest', () => {
  it('REJECTS a caller with no session', async () => {
    const { ctx } = makeCtx();
    await expect(
      (getMyPendingSubscriptionRequest as any)._handler(ctx, {})
    ).rejects.toThrow(/Unauthenticated/);
  });

  it('returns the firm\'s LATEST request, scoped to the caller\'s own firm', async () => {
    const { ctx } = makeCtx({
      session: ADMIN_SESSION, user: ADMIN,
      tables: {
        subscriptionRequests: [
          { _id: 'req-f1-new', firmId: 'firm-1', status: 'pending_review', requestedPlan: 'Pro', amount: 2500000, requestedAt: '2026-11-09T10:00:00Z' },
          { _id: 'req-f2', firmId: 'firm-2', status: 'pending_review', requestedPlan: 'Komplete', amount: 9000000, requestedAt: '2026-11-09T11:00:00Z' },
        ],
      },
    });
    const res: any = await (getMyPendingSubscriptionRequest as any)._handler(ctx, { userEmail: 'admin@firm1.com', sessionToken: 'tok-admin-xyz' });
    expect(res._id).toBe('req-f1-new');
    expect(res.requestedPlan).toBe('Pro');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D5 — the revenue-leak guard #9 now lives in the WIRED approval path
// ═══════════════════════════════════════════════════════════════════════════
describe('D5 — approveSubscriptionRequestAsFounder carries the revenue-leak guard', () => {
  const baseFix = (request: Row, firm: Row): Fixtures => ({
    session: PLATFORM_FOUNDER_SESSION,
    user: PLATFORM_FOUNDER,
    tables: {
      subscriptionRequests: [request],
      firms: [firm],
    },
  });

  it('REFUSES an ambiguous Komplete downgrade (unified firm, non-Komplete plan, no target product)', async () => {
    const { ctx } = makeCtx(baseFix(
      { _id: 'req-amb', firmId: 'firm-1', status: 'pending_review', requestedPlan: 'Pro', billingInterval: 'annual', amount: 2500000 },
      { _id: 'firm-1', id: 'firm-1', subscriptionPlan: 'Komplete', product: 'unified' },
    ));
    await expect(
      (approveSubscriptionRequestAsFounder as any)._handler(ctx, { requestId: 'req-amb', tokenIdentifier: 'founder@practicepro.ng', sessionToken: 'tok-pf-1' })
    ).rejects.toThrow(/Ambiguous downgrade/i);
  });

  it('FLIPS firm.product on a unified → single-product downgrade (the leak itself)', async () => {
    const { ctx, tables } = makeCtx(baseFix(
      { _id: 'req-dg', firmId: 'firm-1', status: 'pending_review', requestedPlan: 'Pro', requestedProduct: 'legal', billingInterval: 'annual', amount: 768000 },
      { _id: 'firm-1', id: 'firm-1', subscriptionPlan: 'Komplete', product: 'unified' },
    ));
    await (approveSubscriptionRequestAsFounder as any)._handler(ctx, { requestId: 'req-dg', tokenIdentifier: 'founder@practicepro.ng', sessionToken: 'tok-pf-1' });
    const firm = tables.firms.find((f) => f._id === 'firm-1')!;
    expect(firm.subscriptionPlan).toBe('Pro');
    expect(firm.product).toBe('legal'); // THE FIX — was left 'unified' before
    const req = tables.subscriptionRequests[0];
    expect(req.status).toBe('approved');
    expect(req.reviewedBy).toBe('founder@practicepro.ng');
  });

  it('leaves product untouched when the request does not cross products', async () => {
    // Single-product (legal) firm upgrading within the same product — the
    // client only ever sends 'property' | 'legal' | undefined, never 'unified'.
    const { ctx, tables } = makeCtx(baseFix(
      { _id: 'req-up', firmId: 'firm-1', status: 'pending_review', requestedPlan: 'Growth', billingInterval: 'annual', amount: 500000 },
      { _id: 'firm-1', id: 'firm-1', subscriptionPlan: 'Core', product: 'legal' },
    ));
    await (approveSubscriptionRequestAsFounder as any)._handler(ctx, { requestId: 'req-up', tokenIdentifier: 'founder@practicepro.ng', sessionToken: 'tok-pf-1' });
    const firm = tables.firms.find((f) => f._id === 'firm-1')!;
    expect(firm.subscriptionPlan).toBe('Growth');
    expect(firm.product).toBe('legal');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D5 — SubscriptionSettings banner source contract
// ═══════════════════════════════════════════════════════════════════════════
describe('D5 — SubscriptionSettings pending-request banner', () => {
  it('queries getMyPendingSubscriptionRequest WITH the session bearer and renders both outcomes', () => {
    const src = read('src/components/settings/SubscriptionSettings.tsx');
    expect(src).toContain('api.myFunctions.getMyPendingSubscriptionRequest');
    expect(src).toMatch(/sessionToken: bearerToken \?\? undefined/);
    expect(src).toContain(`=== 'pending_review'`);
    expect(src).toContain(`=== 'rejected'`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D6 — getInsights is now staff-gated + firm-bound
// ═══════════════════════════════════════════════════════════════════════════
describe('D6 — getInsights auth truth', () => {
  const insightTables = {
    proactive_insights: [
      { _id: 'ins-1', firmId: 'firm-1', category: 'deadline', severity: 'critical', title: 'Filing due', body: 'A v B — 3 days', dismissed: false, createdAt: NOW },
      { _id: 'ins-2', firmId: 'firm-2', category: 'anomaly', severity: 'warning', title: 'Firm2 secret', body: 'revenue drop', dismissed: false, createdAt: NOW },
    ],
  };

  it('REJECTS a caller with no session (was: firmId-only, cross-firm reads)', async () => {
    const { ctx } = makeCtx({ tables: insightTables });
    await expect(
      (getInsights as any)._handler(ctx, { firmId: 'firm-1' })
    ).rejects.toThrow(/Unauthenticated|Portal users|sign in/i);
  });

  it('REJECTS a staff caller from ANOTHER firm reading firm-1 insights', async () => {
    const { ctx } = makeCtx({ session: FIRM2_ADMIN_SESSION, user: FIRM2_ADMIN, tables: insightTables });
    await expect(
      (getInsights as any)._handler(ctx, { firmId: 'firm-1', sessionToken: 'tok-f2-admin' })
    ).rejects.toThrow(/Not authorized|firm/i);
  });

  it('REJECTS a portal (Tenant) caller', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: insightTables });
    await expect(
      (getInsights as any)._handler(ctx, { firmId: 'firm-1', sessionToken: 'tok-tenant-1' })
    ).rejects.toThrow(/Portal users do not have access/i);
  });

  it('RETURNS own-firm insights for a legitimate staff caller', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: insightTables });
    const rows: any[] = await (getInsights as any)._handler(ctx, { firmId: 'firm-1', sessionToken: 'tok-admin-xyz', dismissed: false });
    expect(rows.length).toBe(1);
    expect(rows[0]._id).toBe('ins-1');
  });

  it('the unauthenticated orphan twins are gone (deletion record present)', () => {
    const src = read('convex/proactive.ts');
    expect(src.includes('export const getLatestBriefing')).toBe(false);
    expect(src.includes('export const getInsightCounts')).toBe(false);
    expect(src).toContain('ROUND D (D6) — DELETION RECORD');
  });

  it('AloaChat passes the session bearer to getInsights', () => {
    const src = read('src/components/aloa/AloaChat.tsx');
    const at = src.indexOf('api.proactive.getInsights');
    expect(at).toBeGreaterThan(-1);
    const callSite = src.slice(at - 400, at + 500);
    expect(callSite).toContain('sessionToken: bearerToken ?? undefined');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D7 — the firm-wide maintenance queue exists and is wired
// ═══════════════════════════════════════════════════════════════════════════
describe('D7 — MaintenanceQueue source contracts', () => {
  it('the console exists and queries the firm-wide queue WITH the bearer', () => {
    const src = read('src/components/atrium/MaintenanceQueue.tsx');
    expect(src).toContain('api.portals.getMaintenanceTicketsByFirm');
    expect(src).toMatch(/sessionToken: \(bearerToken \?\? undefined\)/);
    expect(src).toContain('api.portals.updateMaintenanceTicketStatus');
    expect(src).toContain('api.portals.assignTicketToTeamMember');
  });

  it('built on ui/ primitives (ADR-0004 — the raw-element ratchet must not grow)', () => {
    const src = read('src/components/atrium/MaintenanceQueue.tsx');
    expect(src).toContain("from '../ui/Badge'");
    expect(src).toContain("from '../ui/Button'");
    expect(src).toContain("from '../ui/Input'");
    expect(src).toContain("from '../ui/Select'");
    expect(src).toContain("from '../ui/Textarea'");
    // No raw form elements in JSX.
    expect(/<button[\s>]/.test(src)).toBe(false);
    expect(/<input[\s>]/.test(src)).toBe(false);
    expect(/<select[\s>]/.test(src)).toBe(false);
    expect(/<textarea[\s>]/.test(src)).toBe(false);
  });

  it('BillingView mounts the Maintenance tab for property/unified firms', () => {
    const src = read('src/components/BillingView.tsx');
    expect(src).toContain("id: 'maintenance'");
    expect(src).toContain("from './atrium/MaintenanceQueue'");
    expect(src).toMatch(/activeTab === 'maintenance'/);
    expect(src).toMatch(/<MaintenanceQueue \/>/);
  });
});
