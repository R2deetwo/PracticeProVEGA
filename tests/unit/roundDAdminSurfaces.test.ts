/**
 * roundDAdminSurfaces.test.ts — ROUND D (Wave 1, D1) regression tests.
 *
 * PINNED BUG CLASS (the Round D audit, finding D1): admin mutations gated on
 * a CALLER-SUPPLIED identity string. requireFirmUser ignores those strings
 * (R16 Phase B strict identity), but the gates read them directly, so any
 * authenticated user could clear a founder gate by typing a founder email;
 * cross-firm targets were never checked; audit attribution recorded the
 * forged string. The two activate* add-on mutations had NO session
 * resolution at all — a spoofable string was the ONLY auth.
 *
 * Every fix is pinned in BOTH directions, per the house convention:
 *   • the SPOOF is dead — a valid non-admin session + a forged founder
 *     email claim is rejected; no session is rejected; cross-firm is
 *     rejected; privilege patches through the generic updateItem path are
 *     rejected for non-admins,
 *   • the LEGITIMATE workflows still work — own-firm admin deactivations,
 *     reactivations, role edits, trials, cancels, status reads and
 *     platform-founder activations succeed, with session-derived
 *     attribution.
 *
 * Testing style: the Round A/B behavioural harness (fixture-backed mock ctx
 * executing the real Convex handlers via `_handler(ctx, args)`), extended
 * with a REAL filter() evaluator (the add-on family resolves firms through
 * `query("firms").filter(q => q.eq(q.field("id"), ...))`), plus
 * source-contract tests for the FirmSettings UI wiring (the R16 pattern —
 * the deactivation calls shipped without a sessionToken, which made the
 * feature silently throw under strict identity).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Convex functions under test ─────────────────────────────────────────────
import {
  deactivateTeamMember,
  reactivateTeamMember,
  getFirmMembersWithDeactivationStatus,
  updateItem,
  startVmsAddonTrial,
  activateVmsAddon,
  cancelVmsAddon,
  getVmsAddonStatus,
  startEstateCommunityTrial,
  activateEstateCommunityAddon,
  cancelEstateCommunityAddon,
  getEstateCommunityAddonStatus,
} from '../../convex/myFunctions';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed mock ctx (Round A/B harness + real filter()) ────────────
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
      // REAL filter semantics: the add-on family resolves firms through
      // `filter(q => q.eq(q.field("id"), firmId))` — the Round B permissive
      // stub (return all rows) cannot prove cross-firm rejections.
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
const LAWYER = { _id: 'u-lawyer-1', email: 'lawyer@example.com', tokenIdentifier: 'lawyer@example.com', name: 'Lola Lawyer', role: 'Lawyer', firmId: 'firm-1' };
const LAWYER_SESSION = { token: 'tok-lawyer-abc', userId: 'u-lawyer-1' };
const PARALEGAL = { _id: 'u-para-1', email: 'para@example.com', tokenIdentifier: 'para@example.com', name: 'Pia Paralegal', role: 'Paralegal', firmId: 'firm-1' };
const PARALEGAL_SESSION = { token: 'tok-para-def', userId: 'u-para-1' };
const OTHER_FIRM_ADMIN = { _id: 'u-admin-2', email: 'other@example.com', tokenIdentifier: 'other@example.com', name: 'Ope Other', role: 'Admin', firmId: 'firm-2' };
const OTHER_FIRM_SESSION = { token: 'tok-admin-2', userId: 'u-admin-2' };
// The platform super-admin: session-proven, sits in its own holding firm.
const PLATFORM_FOUNDER = { _id: 'u-founder-1', email: 'founder@practicepro.ng', tokenIdentifier: 'founder@practicepro.ng', name: 'Platform Founder', role: 'Admin', firmId: 'firm-platform' };
const FOUNDER_SESSION = { token: 'tok-founder-1', userId: 'u-founder-1' };

const FIRM_1 = { _id: 'f-1', id: 'firm-1', name: 'Firm One', subscriptionPlan: 'Starter', subscriptionAddons: {} };
const FIRM_2 = { _id: 'f-2', id: 'firm-2', name: 'Firm Two', subscriptionPlan: 'Starter', subscriptionAddons: {} };

const NOW = Date.now();

beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(NOW); });
afterEach(() => { vi.restoreAllMocks(); });

// ═══════════════════════════════════════════════════════════════════════════
// D1-a — deactivateTeamMember / reactivateTeamMember
// ═══════════════════════════════════════════════════════════════════════════
describe('D1 — deactivateTeamMember', () => {
  it('REJECTS the spoofed-founder bypass: a valid Lawyer session + a forged deactivatedBy string cannot deactivate', async () => {
    const { ctx, tables } = makeCtx({
      user: LAWYER, session: LAWYER_SESSION,
      users: [{ _id: 'u-victim-1', email: 'victim@example.com', role: 'Paralegal', firmId: 'firm-1', name: 'Vic Victim' }],
    });
    await expect((deactivateTeamMember as any)._handler(ctx, {
      userId: 'u-victim-1',
      sessionToken: LAWYER_SESSION.token, // valid session of a NON-admin
      deactivatedBy: 'founder@practicepro.ng', // the legacy spoof — must be ignored
    })).rejects.toThrow(/Only administrators can deactivate team members/);
    expect(tables.users.find((u) => u._id === 'u-victim-1')!.deactivatedAt).toBeUndefined();
  });

  it('REJECTS a caller with no session at all', async () => {
    const { ctx } = makeCtx({});
    await expect((deactivateTeamMember as any)._handler(ctx, {
      userId: 'u-victim-1',
      deactivatedBy: 'founder@practicepro.ng',
    })).rejects.toThrow(/Unauthenticated/);
  });

  it('REJECTS cross-firm deactivation: firm-1 Admin cannot deactivate firm-2 member', async () => {
    const { ctx } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      users: [{ _id: 'u-victim-2', email: 'victim2@example.com', role: 'Paralegal', firmId: 'firm-2', name: 'Vic Two' }],
    });
    await expect((deactivateTeamMember as any)._handler(ctx, {
      userId: 'u-victim-2',
      sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/different firm/);
  });

  it('REJECTS self-deactivation (real identities)', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION });
    await expect((deactivateTeamMember as any)._handler(ctx, {
      userId: 'u-admin-1',
      sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/cannot deactivate your own account/i);
  });

  it('ALLOWS own-firm Admin deactivation with session-derived attribution', async () => {
    const { ctx, tables } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      users: [{ _id: 'u-victim-1', email: 'victim@example.com', role: 'Paralegal', firmId: 'firm-1', name: 'Vic Victim' }],
    });
    const result: any = await (deactivateTeamMember as any)._handler(ctx, {
      userId: 'u-victim-1',
      sessionToken: ADMIN_SESSION.token,
      reason: 'Offboarding',
    });
    expect(result.success).toBe(true);
    const row = tables.users.find((u) => u._id === 'u-victim-1')!;
    expect(row.deactivatedAt).toBe(NOW);
    // Attribution is the SESSION identity, never a caller-supplied string.
    expect(row.deactivatedBy).toBe('admin@example.com');
    expect(row.deactivationReason).toBe('Offboarding');
  });

  it('ALLOWS a session-proven platform founder to deactivate across firms', async () => {
    const { ctx, tables } = makeCtx({
      user: PLATFORM_FOUNDER, session: FOUNDER_SESSION,
      users: [{ _id: 'u-victim-2', email: 'victim2@example.com', role: 'Paralegal', firmId: 'firm-2', name: 'Vic Two' }],
    });
    const result: any = await (deactivateTeamMember as any)._handler(ctx, {
      userId: 'u-victim-2', sessionToken: FOUNDER_SESSION.token,
    });
    expect(result.success).toBe(true);
    expect(tables.users.find((u) => u._id === 'u-victim-2')!.deactivatedBy).toBe('founder@practicepro.ng');
  });

  it('is idempotent for already-deactivated members', async () => {
    const { ctx } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      users: [{ _id: 'u-victim-1', email: 'victim@example.com', role: 'Paralegal', firmId: 'firm-1', name: 'Vic Victim', deactivatedAt: NOW - 1000 }],
    });
    const result: any = await (deactivateTeamMember as any)._handler(ctx, {
      userId: 'u-victim-1', sessionToken: ADMIN_SESSION.token,
    });
    expect(result).toEqual({ success: true, alreadyDeactivated: true });
  });
});

describe('D1 — reactivateTeamMember', () => {
  it('REJECTS the spoofed-founder bypass for reactivation', async () => {
    const { ctx } = makeCtx({
      user: PARALEGAL, session: PARALEGAL_SESSION,
      users: [{ _id: 'u-victim-1', email: 'victim@example.com', role: 'Paralegal', firmId: 'firm-1', deactivatedAt: NOW - 1000 }],
    });
    await expect((reactivateTeamMember as any)._handler(ctx, {
      userId: 'u-victim-1',
      sessionToken: PARALEGAL_SESSION.token,
      reactivatedBy: 'admin@practicepro.ng', // legacy spoof — ignored
    })).rejects.toThrow(/Only administrators can reactivate team members/);
  });

  it('REJECTS cross-firm reactivation', async () => {
    const { ctx } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      users: [{ _id: 'u-victim-2', email: 'victim2@example.com', role: 'Paralegal', firmId: 'firm-2', deactivatedAt: NOW - 1000 }],
    });
    await expect((reactivateTeamMember as any)._handler(ctx, {
      userId: 'u-victim-2', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/different firm/);
  });

  it('ALLOWS own-firm Admin reactivation (deactivation fields cleared)', async () => {
    const { ctx, tables } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      users: [{
        _id: 'u-victim-1', email: 'victim@example.com', role: 'Paralegal', firmId: 'firm-1',
        deactivatedAt: NOW - 1000, deactivatedBy: 'admin@example.com', deactivationReason: 'Offboarding',
      }],
    });
    const result: any = await (reactivateTeamMember as any)._handler(ctx, {
      userId: 'u-victim-1', sessionToken: ADMIN_SESSION.token,
    });
    expect(result.success).toBe(true);
    const row = tables.users.find((u) => u._id === 'u-victim-1')!;
    expect(row.deactivatedAt).toBeUndefined();
    expect(row.deactivatedBy).toBeUndefined();
    expect(row.deactivationReason).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D1-b — getFirmMembersWithDeactivationStatus (firm-scoped roster read)
// ═══════════════════════════════════════════════════════════════════════════
describe('D1 — getFirmMembersWithDeactivationStatus', () => {
  // NOTE: the caller (ADMIN) is also seeded into the users table by the
  // harness, so the roster fixtures must not duplicate the caller's _id.
  const roster = [
    { _id: 'u-dead-1', email: 'dead@example.com', role: 'Paralegal', firmId: 'firm-1', name: 'Dee Dead', deactivatedAt: NOW - 5000 },
    { _id: 'u-active-1', email: 'active@example.com', role: 'Lawyer', firmId: 'firm-1', name: 'Lee Active' },
  ];

  it('REJECTS a member of firm-1 enumerating firm-2 roster', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: roster });
    await expect((getFirmMembersWithDeactivationStatus as any)._handler(ctx, {
      firmId: 'firm-2', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/different firm/);
  });

  it('ALLOWS the own-firm roster, deactivated sorted last', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: roster });
    const rows: any[] = await (getFirmMembersWithDeactivationStatus as any)._handler(ctx, {
      firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
    });
    expect(rows).toHaveLength(3);
    expect(rows[rows.length - 1]._id).toBe('u-dead-1'); // deactivated sink to the bottom
  });

  it('ALLOWS a platform founder to read any roster', async () => {
    const { ctx } = makeCtx({ user: PLATFORM_FOUNDER, session: FOUNDER_SESSION, users: roster });
    const rows: any[] = await (getFirmMembersWithDeactivationStatus as any)._handler(ctx, {
      firmId: 'firm-1', sessionToken: FOUNDER_SESSION.token,
    });
    // The founder's own holding-firm row is NOT in firm-1 — every firm-1
    // member is returned (caller excluded by firm scope).
    expect(rows).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D1-c — updateItem users path: privilege-field gate
// ═══════════════════════════════════════════════════════════════════════════
describe('D1 — updateItem users table: privilege fields', () => {
  const MEMBER = { _id: 'u-member-1', email: 'member@example.com', role: 'Lawyer', firmId: 'firm-1', name: 'Mia Member' };

  it('REJECTS a Paralegal promoting themselves to Admin through the generic path', async () => {
    const { ctx, tables } = makeCtx({ user: PARALEGAL, session: PARALEGAL_SESSION, users: [MEMBER] });
    await expect((updateItem as any)._handler(ctx, {
      table: 'users', id: 'u-para-1', data: { role: 'Admin' }, sessionToken: PARALEGAL_SESSION.token,
    })).rejects.toThrow(/Only administrators can change team member roles/);
    expect(tables.users.find((u) => u._id === 'u-para-1')!.role).toBe('Paralegal');
  });

  it('REJECTS a Paralegal deactivating a colleague through the generic path', async () => {
    const { ctx } = makeCtx({ user: PARALEGAL, session: PARALEGAL_SESSION, users: [MEMBER] });
    await expect((updateItem as any)._handler(ctx, {
      table: 'users', id: 'u-member-1', data: { deactivatedAt: NOW }, sessionToken: PARALEGAL_SESSION.token,
    })).rejects.toThrow(/Only administrators can change team member roles/);
  });

  it('REJECTS a firm Admin GRANTING the Founding Partner role (platform-only)', async () => {
    const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [MEMBER] });
    await expect((updateItem as any)._handler(ctx, {
      table: 'users', id: 'u-member-1', data: { role: 'Founder' }, sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/Founding Partner role can only be changed by the platform founder/);
  });

  it('REJECTS a firm Admin editing the Founding Partner record (platform-only)', async () => {
    const { ctx } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      users: [{ _id: 'u-fp-1', email: 'fp@example.com', role: 'Founder', firmId: 'firm-1', name: 'Fred Founding' }],
    });
    await expect((updateItem as any)._handler(ctx, {
      table: 'users', id: 'u-fp-1', data: { role: 'Admin' }, sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/Founding Partner role can only be changed by the platform founder/);
  });

  it('ALLOWS a firm Admin changing an ordinary member role (Lawyer → Paralegal)', async () => {
    const { ctx, tables } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [MEMBER] });
    await (updateItem as any)._handler(ctx, {
      table: 'users', id: 'u-member-1', data: { role: 'Paralegal' }, sessionToken: ADMIN_SESSION.token,
    });
    expect(tables.users.find((u) => u._id === 'u-member-1')!.role).toBe('Paralegal');
  });

  it('ALLOWS ordinary self-service profile edits by non-admins (no privilege fields)', async () => {
    const { ctx, tables } = makeCtx({ user: PARALEGAL, session: PARALEGAL_SESSION, users: [MEMBER] });
    await (updateItem as any)._handler(ctx, {
      table: 'users', id: 'u-para-1', data: { professionalTitle: 'Senior Paralegal' }, sessionToken: PARALEGAL_SESSION.token,
    });
    expect(tables.users.find((u) => u._id === 'u-para-1')!.professionalTitle).toBe('Senior Paralegal');
  });

  it('ALLOWS a platform founder to set the Founding Partner role', async () => {
    // The generic update path is firm-scoped (the record must belong to the
    // caller's firm), so the platform founder acts on a member of their own
    // holding firm here.
    const { ctx, tables } = makeCtx({
      user: PLATFORM_FOUNDER, session: FOUNDER_SESSION,
      users: [{ _id: 'u-member-2', email: 'member2@example.com', role: 'Lawyer', firmId: 'firm-platform', name: 'Mo Member' }],
    });
    await (updateItem as any)._handler(ctx, {
      table: 'users', id: 'u-member-2', data: { role: 'Founder' }, sessionToken: FOUNDER_SESSION.token,
    });
    expect(tables.users.find((u) => u._id === 'u-member-2')!.role).toBe('Founder');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D1-d — VMS add-on family
// ═══════════════════════════════════════════════════════════════════════════
describe('D1 — startVmsAddonTrial', () => {
  it('REJECTS the spoofed-founder string bypass (valid non-admin session)', async () => {
    const { ctx, tables } = makeCtx({
      user: LAWYER, session: LAWYER_SESSION,
      tables: { firms: [{ ...FIRM_1 }] },
    });
    await expect((startVmsAddonTrial as any)._handler(ctx, {
      firmId: 'firm-1', userEmail: 'founder@practicepro.ng', // legacy spoof — ignored
      sessionToken: LAWYER_SESSION.token,
    })).rejects.toThrow(/Only firm administrators can start add-on trials/);
    expect((tables.firms[0].subscriptionAddons as any)?.vms).toBeUndefined();
  });

  it('REJECTS cross-firm trial starts', async () => {
    const { ctx } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { firms: [{ ...FIRM_1 }, { ...FIRM_2 }] },
    });
    await expect((startVmsAddonTrial as any)._handler(ctx, {
      firmId: 'firm-2', userEmail: 'admin@example.com', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/different firm/);
  });

  it('ALLOWS the own-firm Admin to start a trial', async () => {
    const { ctx, tables } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { firms: [{ ...FIRM_1 }] },
    });
    const result: any = await (startVmsAddonTrial as any)._handler(ctx, {
      firmId: 'firm-1', userEmail: 'admin@example.com', sessionToken: ADMIN_SESSION.token,
    });
    expect(result.success).toBe(true);
    expect((tables.firms[0].subscriptionAddons as any).vms.status).toBe('trial');
    expect((tables.firms[0].subscriptionAddons as any).vms.trialEndsAt).toBe(NOW + 30 * 24 * 60 * 60 * 1000);
  });
});

describe('D1 — activateVmsAddon (previously NO session at all)', () => {
  it('REJECTS the unauthenticated spoof: no session, forged activatedBy string', async () => {
    const { ctx, tables } = makeCtx({
      tables: { firms: [{ ...FIRM_1 }] },
    });
    await expect((activateVmsAddon as any)._handler(ctx, {
      firmId: 'firm-1',
      activatedBy: 'founder@practicepro.ng', // the entire pre-D1 "auth" — now ignored
    })).rejects.toThrow(/Unauthenticated/);
    expect((tables.firms[0].subscriptionAddons as any)?.vms).toBeUndefined();
  });

  it('REJECTS a valid session that is not a platform founder (even a firm Admin)', async () => {
    const { ctx } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { firms: [{ ...FIRM_1 }] },
    });
    await expect((activateVmsAddon as any)._handler(ctx, {
      firmId: 'firm-1', sessionToken: ADMIN_SESSION.token,
      activatedBy: 'founder@practicepro.ng',
    })).rejects.toThrow(/Only the platform founder can activate add-ons/);
  });

  it('ALLOWS a session-proven platform founder, with session-derived attribution', async () => {
    const { ctx, tables } = makeCtx({
      user: PLATFORM_FOUNDER, session: FOUNDER_SESSION,
      tables: { firms: [{ ...FIRM_1 }] },
    });
    const result: any = await (activateVmsAddon as any)._handler(ctx, {
      firmId: 'firm-1', sessionToken: FOUNDER_SESSION.token, expiresAt: NOW + 31 * 24 * 60 * 60 * 1000,
    });
    expect(result.success).toBe(true);
    const vms = (tables.firms[0].subscriptionAddons as any).vms;
    expect(vms.status).toBe('active');
    expect(vms.activatedBy).toBe('founder@practicepro.ng'); // from the session, not the wire
    expect(vms.expiresAt).toBe(NOW + 31 * 24 * 60 * 60 * 1000);
  });
});

describe('D1 — cancelVmsAddon', () => {
  it('REJECTS the spoof bypass and cross-firm cancels', async () => {
    const spoof = makeCtx({
      user: LAWYER, session: LAWYER_SESSION,
      tables: { firms: [{ ...FIRM_1, subscriptionAddons: { vms: { status: 'active' } } }] },
    });
    await expect((cancelVmsAddon as any)._handler(spoof.ctx, {
      firmId: 'firm-1', userEmail: 'founder@practicepro.ng', sessionToken: LAWYER_SESSION.token,
    })).rejects.toThrow(/Only firm administrators can cancel add-ons/);

    const crossFirm = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { firms: [{ ...FIRM_2, subscriptionAddons: { vms: { status: 'active' } } }] },
    });
    await expect((cancelVmsAddon as any)._handler(crossFirm.ctx, {
      firmId: 'firm-2', userEmail: 'admin@example.com', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/different firm/);
  });

  it('ALLOWS the own-firm Admin to cancel an active add-on', async () => {
    const { ctx, tables } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { firms: [{ ...FIRM_1, subscriptionAddons: { vms: { status: 'active', trialStartsAt: NOW - 1000 } } }] },
    });
    const result: any = await (cancelVmsAddon as any)._handler(ctx, {
      firmId: 'firm-1', userEmail: 'admin@example.com', sessionToken: ADMIN_SESSION.token,
    });
    expect(result.success).toBe(true);
    expect((tables.firms[0].subscriptionAddons as any).vms.status).toBe('expired');
  });
});

describe('D1 — getVmsAddonStatus (firm-scoped read)', () => {
  it('REJECTS cross-firm status reads', async () => {
    const { ctx } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { firms: [{ ...FIRM_1 }, { ...FIRM_2 }] },
    });
    await expect((getVmsAddonStatus as any)._handler(ctx, {
      firmId: 'firm-2', userEmail: 'admin@example.com', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/different firm/);
  });

  it('ALLOWS the own-firm status read', async () => {
    const { ctx } = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { firms: [{ ...FIRM_1, subscriptionAddons: { vms: { status: 'active' } } }] },
    });
    const result: any = await (getVmsAddonStatus as any)._handler(ctx, {
      firmId: 'firm-1', userEmail: 'admin@example.com', sessionToken: ADMIN_SESSION.token,
    });
    expect(result.status).toBe('active');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D1-e — Estate Community add-on family (mirrors VMS)
// ═══════════════════════════════════════════════════════════════════════════
describe('D1 — Estate Community add-on family', () => {
  it('startEstateCommunityTrial: REJECTS the spoof bypass and cross-firm; ALLOWS own-firm Admin', async () => {
    const spoof = makeCtx({
      user: LAWYER, session: LAWYER_SESSION,
      tables: { firms: [{ ...FIRM_1 }] },
    });
    await expect((startEstateCommunityTrial as any)._handler(spoof.ctx, {
      firmId: 'firm-1', userEmail: 'founder@practicepro.ng', sessionToken: LAWYER_SESSION.token,
    })).rejects.toThrow(/Only firm administrators can start add-on trials/);

    const crossFirm = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { firms: [{ ...FIRM_2 }] },
    });
    await expect((startEstateCommunityTrial as any)._handler(crossFirm.ctx, {
      firmId: 'firm-2', userEmail: 'admin@example.com', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/different firm/);

    const legit = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { firms: [{ ...FIRM_1 }] },
    });
    const result: any = await (startEstateCommunityTrial as any)._handler(legit.ctx, {
      firmId: 'firm-1', userEmail: 'admin@example.com', sessionToken: ADMIN_SESSION.token,
    });
    expect(result.success).toBe(true);
    expect((legit.tables.firms[0].subscriptionAddons as any).estateCommunity.status).toBe('trial');
  });

  it('activateEstateCommunityAddon: REJECTS the unauthenticated spoof; ALLOWS a session-proven platform founder', async () => {
    const spoof = makeCtx({
      tables: { firms: [{ ...FIRM_1 }] },
    });
    await expect((activateEstateCommunityAddon as any)._handler(spoof.ctx, {
      firmId: 'firm-1', activatedBy: 'admin@practicepro.ng',
    })).rejects.toThrow(/Unauthenticated/);
    expect((spoof.tables.firms[0].subscriptionAddons as any)?.estateCommunity).toBeUndefined();

    const legit = makeCtx({
      user: PLATFORM_FOUNDER, session: FOUNDER_SESSION,
      tables: { firms: [{ ...FIRM_1 }] },
    });
    const result: any = await (activateEstateCommunityAddon as any)._handler(legit.ctx, {
      firmId: 'firm-1', sessionToken: FOUNDER_SESSION.token,
    });
    expect(result.success).toBe(true);
    const ec = (legit.tables.firms[0].subscriptionAddons as any).estateCommunity;
    expect(ec.status).toBe('active');
    expect(ec.activatedBy).toBe('founder@practicepro.ng');
  });

  it('cancelEstateCommunityAddon: REJECTS spoof + cross-firm; ALLOWS own-firm Admin', async () => {
    const spoof = makeCtx({
      user: PARALEGAL, session: PARALEGAL_SESSION,
      tables: { firms: [{ ...FIRM_1, subscriptionAddons: { estateCommunity: { status: 'active' } } }] },
    });
    await expect((cancelEstateCommunityAddon as any)._handler(spoof.ctx, {
      firmId: 'firm-1', userEmail: 'founder@practicepro.ng', sessionToken: PARALEGAL_SESSION.token,
    })).rejects.toThrow(/Only firm administrators can cancel add-ons/);

    const crossFirm = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { firms: [{ ...FIRM_2, subscriptionAddons: { estateCommunity: { status: 'active' } } }] },
    });
    await expect((cancelEstateCommunityAddon as any)._handler(crossFirm.ctx, {
      firmId: 'firm-2', userEmail: 'admin@example.com', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/different firm/);

    const legit = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { firms: [{ ...FIRM_1, subscriptionAddons: { estateCommunity: { status: 'active' } } }] },
    });
    const result: any = await (cancelEstateCommunityAddon as any)._handler(legit.ctx, {
      firmId: 'firm-1', userEmail: 'admin@example.com', sessionToken: ADMIN_SESSION.token,
    });
    expect(result.success).toBe(true);
    expect((legit.tables.firms[0].subscriptionAddons as any).estateCommunity.status).toBe('expired');
  });

  it('getEstateCommunityAddonStatus: REJECTS cross-firm; ALLOWS own-firm', async () => {
    const crossFirm = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { firms: [{ ...FIRM_2 }] },
    });
    await expect((getEstateCommunityAddonStatus as any)._handler(crossFirm.ctx, {
      firmId: 'firm-2', userEmail: 'admin@example.com', sessionToken: ADMIN_SESSION.token,
    })).rejects.toThrow(/different firm/);

    const legit = makeCtx({
      user: ADMIN, session: ADMIN_SESSION,
      tables: { firms: [{ ...FIRM_1, subscriptionAddons: { estateCommunity: { status: 'active' } } }] },
    });
    const result: any = await (getEstateCommunityAddonStatus as any)._handler(legit.ctx, {
      firmId: 'firm-1', userEmail: 'admin@example.com', sessionToken: ADMIN_SESSION.token,
    });
    expect(result.status).toBe('active');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D1-f — UI wiring source contracts (FirmSettings carries the session)
// ═══════════════════════════════════════════════════════════════════════════
describe('D1 — FirmSettings UI wiring (source contracts)', () => {
  const src = read('src/components/settings/FirmSettings.tsx');

  it('deactivation call passes the bearer sessionToken (the pre-D1 call threw Unauthenticated)', () => {
    const call = src.slice(src.indexOf('deactivateMutation({'));
    expect(call).toMatch(/sessionToken\s*:/);
    // The spoofable argument is gone from the wire.
    expect(call.slice(0, 400)).not.toMatch(/deactivatedBy\s*:/);
  });

  it('reactivation call passes the bearer sessionToken and no reactivatedBy', () => {
    const call = src.slice(src.indexOf('reactivateMutation({'));
    expect(call).toMatch(/sessionToken\s*:/);
    expect(call.slice(0, 400)).not.toMatch(/reactivatedBy\s*:/);
  });

  it('the FirmSettings component reads bearerToken from useAuth', () => {
    expect(src).toMatch(/useAuth\(\)[\s\S]{0,80}bearerToken|const\s*\{\s*[^}]*bearerToken[^}]*\}\s*=\s*useAuth\(\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D1-g — no spoofable string gates remain in myFunctions.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('D1 — the spoofable-string gate class is gone from myFunctions.ts', () => {
  // Comment lines (the D1 documentation itself) legitimately mention the
  // retired pattern — only CODE lines are under contract.
  const codeOnly = read('convex/myFunctions.ts')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');

  it('no FOUNDER_EMAILS.includes(args.…) pattern remains in code', () => {
    expect(codeOnly).not.toMatch(/FOUNDER_EMAILS\.includes\(args\./);
  });

  it('no admin gate reads a caller-supplied identity string anymore', () => {
    // The only remaining FOUNDER_EMAILS reference is the session-derived
    // PLATFORM_FOUNDER_EMAILS membership helper.
    expect(codeOnly).not.toMatch(/(?<!PLATFORM_)FOUNDER_EMAILS/);
    expect(codeOnly).toMatch(/PLATFORM_FOUNDER_EMAILS = new Set/);
  });
});
