/**
 * vmsAccessRequests.test.ts — VMS (SentryPass) founder-approval entitlement
 * flow, behavioural tests (2026-11-27 restructure).
 *
 * WHAT IS PINNED (both directions, per the house convention):
 *   submitVmsAccessRequest
 *   • the SPOOF paths are dead — a non-admin caller, a cross-firm admin,
 *     and a Vega (legal-only) workspace are all rejected;
 *   • the LEGITIMATE path works — an Atrium or Komplete firm admin submits
 *     the lightweight qualification form, the firm record flips to
 *     vmsRequestStatus 'pending', the founder gets an in-app notification,
 *     and the founder email is scheduled;
 *   • duplicate submissions while pending are rejected.
 *
 *   decideVmsAccessRequest
 *   • ONLY a session-proven platform founder may decide (firm admins and
 *     forged emails are rejected);
 *   • Approve → firms.vmsEnabled = true + vmsRequestStatus 'approved' +
 *     the workspace's admins are notified;
 *   • Decline → vmsRequestStatus 'declined', vmsEnabled untouched (false);
 *   • deciding with no pending request is rejected.
 *
 * Testing style: the Round D fixture-backed mock ctx harness executing the
 * real Convex handlers via `_handler(ctx, args)` (real filter() evaluator).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  submitVmsAccessRequest,
  decideVmsAccessRequest,
} from '../../convex/myFunctions';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

// ── Fixture-backed mock ctx (Round D harness, real filter()) ────────────────
type Row = Record<string, any>;

interface Fixtures {
  session?: { token: string; userId: string };
  user?: Row;
  users?: Row[];
  tables?: Record<string, Row[]>;
}

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
    notifications: [],
    firms: [],
    ...(fix.tables ?? {}),
  };
  const writes = { patches: [] as any[], inserts: [] as any[], deletes: [] as any[] };

  const findRows = (table: string, conds: Array<[string, string, any]>) =>
    (tables[table] ?? []).filter((r) => conds.every(([f, op, v]) => {
      const rv = r[f];
      if (rv === undefined) return false;
      return String(rv) === String(v);
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
const ATRIUM_ADMIN = { _id: 'u-a-1', email: 'estate@example.com', tokenIdentifier: 'estate@example.com', name: 'Estate Admin', role: 'Admin', firmId: 'firm-atrium' };
const ATRIUM_SESSION = { token: 'tok-atrium-1', userId: 'u-a-1' };
const VEGA_ADMIN = { _id: 'u-veg-1', email: 'chambers@example.com', tokenIdentifier: 'chambers@example.com', name: 'Vega Admin', role: 'Admin', firmId: 'firm-vega' };
const VEGA_SESSION = { token: 'tok-vega-1', userId: 'u-veg-1' };
const KOMPLETE_ADMIN = { _id: 'u-k-1', email: 'unified@example.com', tokenIdentifier: 'unified@example.com', name: 'Unified Admin', role: 'Admin', firmId: 'firm-komplete' };
const KOMPLETE_SESSION = { token: 'tok-komplete-1', userId: 'u-k-1' };
const LAWYER = { _id: 'u-l-1', email: 'lawyer@example.com', tokenIdentifier: 'lawyer@example.com', name: 'Lola Lawyer', role: 'Lawyer', firmId: 'firm-atrium' };
const LAWYER_SESSION = { token: 'tok-lawyer-1', userId: 'u-l-1' };
const OTHER_FIRM_ADMIN = { _id: 'u-o-1', email: 'other@example.com', tokenIdentifier: 'other@example.com', name: 'Ope Other', role: 'Admin', firmId: 'firm-other' };
const OTHER_FIRM_SESSION = { token: 'tok-other-1', userId: 'u-o-1' };
const PLATFORM_FOUNDER = { _id: 'u-founder-1', email: 'founder@practicepro.ng', tokenIdentifier: 'founder@practicepro.ng', name: 'Platform Founder', role: 'Admin', firmId: 'firm-platform' };
const FOUNDER_SESSION = { token: 'tok-founder-1', userId: 'u-founder-1' };
// A platform founder-role user (notifyFounders targets role === 'Founder').
const FOUNDER_ROLE_USER = { _id: 'u-founder-role', email: 'founder-role@practicepro.ng', tokenIdentifier: 'founder-role@practicepro.ng', name: 'Founder Role', role: 'Founder', firmId: 'firm-platform' };

// Firm fixtures are FACTORIES — the harness's patch() mutates rows in
// place, so a shared literal would leak state across tests.
const FIRM_ATRIUM = () => ({ _id: 'f-a', id: 'firm-atrium', name: 'Atrium Estates Ltd', product: 'property', subscriptionPlan: 'Growth', subscriptionAddons: {} });
const FIRM_ATRIUM_VEGA = () => ({ _id: 'f-v', id: 'firm-vega', name: 'Vega Chambers', product: 'legal', subscriptionPlan: 'Core', subscriptionAddons: {} });
const FIRM_KOMPLETE = () => ({ _id: 'f-k', id: 'firm-komplete', name: 'Komplete Group', product: 'unified', subscriptionPlan: 'Komplete', subscriptionAddons: {} });

const REQUEST_FORM = {
  estateName: 'Lekki Gardens Phase 2',
  unitCount: '120 units, 2 gates',
  useCase: 'We manage three gated estates and need verifiable visitor codes at the main gates.',
};

const NOW = Date.now();
beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(NOW); });
afterEach(() => { vi.restoreAllMocks(); });

// ═══════════════════════════════════════════════════════════════════════════
// submitVmsAccessRequest
// ═══════════════════════════════════════════════════════════════════════════
describe('submitVmsAccessRequest — the lightweight qualification form', () => {
  it('REJECTS Vega (legal-only) workspaces outright — VMS is not applicable', async () => {
    const { ctx, tables } = makeCtx({
      user: VEGA_ADMIN, session: VEGA_SESSION,
      tables: { firms: [FIRM_ATRIUM_VEGA()] },
    });
    await expect((submitVmsAccessRequest as any)._handler(ctx, {
      firmId: 'firm-vega',
      sessionToken: VEGA_SESSION.token,
      userEmail: VEGA_ADMIN.email,
      ...REQUEST_FORM,
    })).rejects.toThrow(/VMS_NOT_AVAILABLE/);
    const firm = tables.firms[0];
    expect(firm.vmsRequestStatus).toBeUndefined();
    expect(firm.vmsRequest).toBeUndefined();
  });

  it('REJECTS non-admin callers — requests are a workspace-admin action', async () => {
    const { ctx } = makeCtx({
      user: LAWYER, session: LAWYER_SESSION,
      tables: { firms: [FIRM_ATRIUM()] },
    });
    await expect((submitVmsAccessRequest as any)._handler(ctx, {
      firmId: 'firm-atrium',
      sessionToken: LAWYER_SESSION.token,
      userEmail: LAWYER.email,
      ...REQUEST_FORM,
    })).rejects.toThrow(/Only firm administrators/);
  });

  it('REJECTS a cross-firm admin — the request is for the caller\u2019s own workspace', async () => {
    const { ctx } = makeCtx({
      user: OTHER_FIRM_ADMIN, session: OTHER_FIRM_SESSION,
      tables: { firms: [FIRM_ATRIUM()] },
    });
    await expect((submitVmsAccessRequest as any)._handler(ctx, {
      firmId: 'firm-atrium',
      sessionToken: OTHER_FIRM_SESSION.token,
      userEmail: OTHER_FIRM_ADMIN.email,
      ...REQUEST_FORM,
    })).rejects.toThrow(/different firm/i);
  });

  it('ALLOWS an Atrium firm admin: pending status + request payload + founder alert (in-app + email)', async () => {
    const { ctx, tables } = makeCtx({
      user: ATRIUM_ADMIN, session: ATRIUM_SESSION,
      users: [FOUNDER_ROLE_USER],
      tables: { firms: [FIRM_ATRIUM()] },
    });
    const result: any = await (submitVmsAccessRequest as any)._handler(ctx, {
      firmId: 'firm-atrium',
      sessionToken: ATRIUM_SESSION.token,
      userEmail: ATRIUM_ADMIN.email,
      ...REQUEST_FORM,
    });
    expect(result.success).toBe(true);
    expect(result.vmsRequestStatus).toBe('pending');

    const firm = tables.firms[0];
    expect(firm.vmsRequestStatus).toBe('pending');
    expect(firm.vmsEnabled).toBeUndefined(); // capability still locked
    expect(firm.vmsRequest.estateName).toBe(REQUEST_FORM.estateName);
    expect(firm.vmsRequest.unitCount).toBe(REQUEST_FORM.unitCount);
    expect(firm.vmsRequest.useCase).toBe(REQUEST_FORM.useCase);
    expect(firm.vmsRequest.requestedBy).toBe(ATRIUM_ADMIN.name);
    expect(firm.vmsRequest.planLabel).toBe('Atrium');

    // Founder in-app alert (notifyFounders → role 'Founder' users).
    const founderAlert = tables.notifications.find((n) => n.type === 'vms_access_request');
    expect(founderAlert).toBeTruthy();
    expect(founderAlert.message).toContain('Atrium Estates Ltd');
    expect(founderAlert.message).toContain('Lekki Gardens Phase 2');
    // Founder email scheduled (fire-and-forget via the scheduler).
    expect(ctx.scheduler.runAfter).toHaveBeenCalled();
  });

  it('ALLOWS a Komplete firm admin (tailored case-by-case path)', async () => {
    const { ctx, tables } = makeCtx({
      user: KOMPLETE_ADMIN, session: KOMPLETE_SESSION,
      users: [FOUNDER_ROLE_USER],
      tables: { firms: [FIRM_KOMPLETE()] },
    });
    const result: any = await (submitVmsAccessRequest as any)._handler(ctx, {
      firmId: 'firm-komplete',
      sessionToken: KOMPLETE_SESSION.token,
      userEmail: KOMPLETE_ADMIN.email,
      ...REQUEST_FORM,
    });
    expect(result.success).toBe(true);
    expect(tables.firms[0].vmsRequestStatus).toBe('pending');
    expect(tables.firms[0].vmsRequest.planLabel).toBe('Komplete');
  });

  it('REJECTS a duplicate submission while a request is pending', async () => {
    const { ctx } = makeCtx({
      user: ATRIUM_ADMIN, session: ATRIUM_SESSION,
      users: [FOUNDER_ROLE_USER],
      tables: { firms: [{ ...FIRM_ATRIUM(), vmsRequestStatus: 'pending', vmsRequest: { estateName: 'x' } }] },
    });
    await expect((submitVmsAccessRequest as any)._handler(ctx, {
      firmId: 'firm-atrium',
      sessionToken: ATRIUM_SESSION.token,
      userEmail: ATRIUM_ADMIN.email,
      ...REQUEST_FORM,
    })).rejects.toThrow(/already pending/);
  });

  it('REJECTS submission when VMS is already enabled', async () => {
    const { ctx } = makeCtx({
      user: ATRIUM_ADMIN, session: ATRIUM_SESSION,
      tables: { firms: [{ ...FIRM_ATRIUM(), vmsEnabled: true }] },
    });
    await expect((submitVmsAccessRequest as any)._handler(ctx, {
      firmId: 'firm-atrium',
      sessionToken: ATRIUM_SESSION.token,
      userEmail: ATRIUM_ADMIN.email,
      ...REQUEST_FORM,
    })).rejects.toThrow(/already enabled/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// decideVmsAccessRequest
// ═══════════════════════════════════════════════════════════════════════════
describe('decideVmsAccessRequest — founder Approve / Decline', () => {
  // FRESH per test (factory) — the harness patch mutates rows in place.
  const PENDING_FIRM = () => ({ ...FIRM_ATRIUM(), vmsRequestStatus: 'pending', vmsRequest: { estateName: 'Lekki Gardens Phase 2', unitCount: '120 units, 2 gates', useCase: 'Gated estates.', requestedBy: 'Estate Admin', requestedAt: NOW - 5000 } });

  it('REJECTS a firm admin trying to approve their own request', async () => {
    const { ctx } = makeCtx({
      user: ATRIUM_ADMIN, session: ATRIUM_SESSION,
      tables: { firms: [PENDING_FIRM()] },
    });
    await expect((decideVmsAccessRequest as any)._handler(ctx, {
      firmId: 'firm-atrium',
      sessionToken: ATRIUM_SESSION.token,
      decision: 'approve',
    })).rejects.toThrow(/Only the platform founder/);
  });

  it('ALLOWS the session-proven platform founder to APPROVE: vmsEnabled=true + admins notified', async () => {
    const { ctx, tables } = makeCtx({
      user: PLATFORM_FOUNDER, session: FOUNDER_SESSION,
      users: [ATRIUM_ADMIN],
      tables: { firms: [PENDING_FIRM()] },
    });
    const result: any = await (decideVmsAccessRequest as any)._handler(ctx, {
      firmId: 'firm-atrium',
      sessionToken: FOUNDER_SESSION.token,
      decision: 'approve',
      note: 'Welcome aboard',
    });
    expect(result.success).toBe(true);
    expect(result.decision).toBe('approve');

    const firm = tables.firms[0];
    expect(firm.vmsEnabled).toBe(true);
    expect(firm.vmsRequestStatus).toBe('approved');
    expect(firm.vmsRequest.decidedBy).toBe('founder@practicepro.ng');
    expect(firm.vmsRequest.decisionNote).toBe('Welcome aboard');

    // The workspace's admins are notified (in-app row).
    const notify = tables.notifications.find((n) => n.type === 'vms_access_approved');
    expect(notify).toBeTruthy();
    expect(notify.userId).toBe(ATRIUM_ADMIN._id);
  });

  it('ALLOWS the founder to DECLINE: capability stays locked, admins notified', async () => {
    const { ctx, tables } = makeCtx({
      user: PLATFORM_FOUNDER, session: FOUNDER_SESSION,
      users: [ATRIUM_ADMIN],
      tables: { firms: [PENDING_FIRM()] },
    });
    const result: any = await (decideVmsAccessRequest as any)._handler(ctx, {
      firmId: 'firm-atrium',
      sessionToken: FOUNDER_SESSION.token,
      decision: 'decline',
      note: 'Not a fit for now',
    });
    expect(result.success).toBe(true);
    const firm = tables.firms[0];
    expect(firm.vmsEnabled).toBeUndefined(); // still locked
    expect(firm.vmsRequestStatus).toBe('declined');
    const notify = tables.notifications.find((n) => n.type === 'vms_access_declined');
    expect(notify).toBeTruthy();
    expect(String(notify.message)).toContain('not approved');
  });

  it('REJECTS deciding a workspace with no pending request', async () => {
    const { ctx } = makeCtx({
      user: PLATFORM_FOUNDER, session: FOUNDER_SESSION,
      tables: { firms: [FIRM_ATRIUM()] },
    });
    await expect((decideVmsAccessRequest as any)._handler(ctx, {
      firmId: 'firm-atrium',
      sessionToken: FOUNDER_SESSION.token,
      decision: 'approve',
    })).rejects.toThrow(/No pending VMS access request/);
  });
});

// ── Source-contract pins (the surfaces the flow promises) ──────────────────
describe('VMS access flow — source contracts', () => {
  it('the firm record carries the capability flags and the gate reads them', () => {
    const schema = read('convex/schema.ts');
    expect(schema).toContain('vmsEnabled: v.optional(v.boolean())');
    expect(schema).toContain('vmsRequestStatus: v.optional(v.string())');
    expect(schema).toContain('vmsRequest: v.optional(v.any())');
  });

  it('the founder email carries workspace, plan and estate details', () => {
    const fns = read('convex/myFunctions.ts');
    const emailIdx = fns.indexOf('export const sendVmsRequestFounderEmail');
    expect(emailIdx).toBeGreaterThan(-1);
    const emailBody = fns.slice(emailIdx, fns.indexOf('export const getVmsAccessRequests'));
    for (const pin of ['firmName', 'planLabel', 'estateName', 'unitCount', 'useCase', 'requestedBy']) {
      expect(emailBody).toContain(pin);
    }
  });

  it('the tailored confirmation copy ships for BOTH product variants', () => {
    const view = read('src/components/SecurityAccessView.tsx');
    expect(view).toContain('The founder will review your estate details and follow up shortly with activation and pricing details.');
    expect(view).toContain('typically reserved for dedicated facilities and estate management teams rather than Komplete workspaces');
    // The form captures the three qualifying questions.
    expect(view).toContain('Property / Estate Name');
    expect(view).toContain('Approximate Number of Units / Gates');
    expect(view).toContain('Brief Use Case');
  });
});
