/**
 * gatehouseAccounts.test.ts — TASK 94 (2026-11-25)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The Sentry Pass gatehouse station flow against the REAL Convex handlers
 * (fixture-backed ctx, `_handler(ctx, args)`, zero reimplementation):
 *
 *   1. Admin provisioning — stations are created by an authenticated
 *      estate admin (requireFirmUser), bound to the firm's own property,
 *      PIN hashed (sha256(salt:pin)), audit row written, PIN returned once.
 *   2. Station login — right PIN mints a 30-day session token (server
 *      stores ONLY the sha256); wrong PIN throws AND lands a
 *      gatehouse_login_failed security event (no PIN echo).
 *   3. THE LOCK FLIP — before any station exists, verifyToken /
 *      checkInVisitor work in legacy anonymous mode; the moment a station
 *      exists, both REQUIRE a valid station session; revoking the station
 *      instantly invalidates its sessions.
 *   4. Least privilege — the station token unlocks ONLY the gate surface
 *      (verify/check-in here); it is not a user session (it cannot, e.g.,
 *      pull the §5 admin reports).
 */
import { describe, it, expect, vi } from 'vitest';

import {
  provisionGatehouseAccount,
  listGatehouseAccounts,
  resetGatehousePin,
  revokeGatehouseAccount,
  gatehouseLogin,
  getGatehouseStations,
  resolveStationSession,
  propertyHasActiveStations,
} from '../../convex/gatehouseAccounts';
import { verifyToken, checkInVisitor, getSentryDailyReport } from '../../convex/visitorManagement';
import { hashSessionToken } from '../../convex/sessions';
import { sha256Hex } from '../../convex/sha256';

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
    portal_settings: [{ _id: 'ps_1', firmId: 'firm-1', vmsGracePeriodMinutes: 30, vmsDefaultExpiryHours: 6 }],
    properties: [
      { _id: 'prop_1', id: 'prop_1', firmId: 'firm-1', name: 'Palm Grove', address: '12 Marina Rd' },
      { _id: 'prop_2', id: 'prop_2', firmId: 'firm-1', name: 'Palm Annex', address: '14 Marina Rd' },
      { _id: 'prop_other', id: 'prop_other', firmId: 'firm-2', name: 'Other Firm Estate', address: 'Elsewhere' },
    ],
    gatehouse_accounts: [],
    gatehouse_sessions: [],
    visitor_tokens: [],
    securityEvents: [],
    audit_logs: [],
    rateLimits: [],
    app_notifications: [],
  };
}

/** An active resident visitor token the gate can verify. */
function activeToken(overrides: Partial<Row> = {}): Row {
  return {
    _id: 'vt_1',
    firmId: 'firm-1',
    propertyId: 'prop_1',
    propertyName: 'Palm Grove',
    propertyAddress: '12 Marina Rd',
    unitId: 'unit_1',
    unitName: 'B14',
    residentId: 'users_1_resA',
    residentName: 'Ada Resident',
    visitorName: 'Tunde Visitor',
    visitorPhone: '2348020000009',
    tokenCode: '482917',
    passRef: 'A7K2M9P4Q6R8',
    deliveryMethod: 'client_share',
    status: 'active',
    visitDate: TODAY,
    expiresAt: NOW + 2 * 60 * 60 * 1000,
    expiryWindowHours: 6,
    gracePeriodMinutes: 30,
    createdAt: NOW - 3600,
    updatedAt: NOW - 3600,
    ...overrides,
  };
}

const h = (fn: any) => (fn as any)._handler ?? fn;
const ADMIN_ARGS = { userEmail: 'admin@atrium.ng', sessionToken: SESSION_PLAIN_ADMIN };

describe('gatehouseAccounts §1 — admin provisioning', () => {
  it('provisioning creates a hashed-PIN station bound to the firm\u2019s property, writes an audit row, and returns the PIN once', async () => {
    const { ctx, tables } = makeCtx(baseTables());
    const out = await h(provisionGatehouseAccount)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', stationName: 'Main Gate', ...ADMIN_ARGS,
    });
    expect(out.pin).toMatch(/^\d{6}$/);
    expect(out.stationName).toBe('Main Gate');
    const acc = tables.gatehouse_accounts[0];
    expect(acc.pinHash).not.toBe(out.pin);           // the PIN itself is never stored
    expect(acc.pinHash).toBe(sha256Hex(`${acc.pinSalt}:${out.pin}`)); // salted sha256 form
    expect(acc.status).toBe('active');
    expect(acc.propertyId).toBe('prop_1');
    expect(tables.audit_logs.some((l: any) => l.resource === 'gatehouse_account')).toBe(true);
  });

  it('a property from ANOTHER firm cannot host the station', async () => {
    const { ctx } = makeCtx(baseTables());
    await expect(h(provisionGatehouseAccount)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_other', stationName: 'Main Gate', ...ADMIN_ARGS,
    })).rejects.toThrow(/not found in this firm/i);
  });

  it('provisioning requires an authenticated admin (no session → unauthenticated)', async () => {
    const { ctx } = makeCtx(baseTables());
    await expect(h(provisionGatehouseAccount)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', stationName: 'Main Gate',
    })).rejects.toThrow(/Unauthenticated/);
  });

  it('listing is firm-scoped and carries status + lastLoginAt', async () => {
    const { ctx } = makeCtx(baseTables());
    await h(provisionGatehouseAccount)(ctx, { firmId: 'firm-1', propertyId: 'prop_1', stationName: 'Main Gate', ...ADMIN_ARGS });
    const list = await h(listGatehouseAccounts)(ctx, { firmId: 'firm-1', ...ADMIN_ARGS });
    expect(list).toHaveLength(1);
    expect(list[0].stationName).toBe('Main Gate');
    expect(list[0].status).toBe('active');
  });

  it('PIN reset re-issues a working PIN and revocation closes the station', async () => {
    const { ctx, tables } = makeCtx(baseTables());
    const created = await h(provisionGatehouseAccount)(ctx, { firmId: 'firm-1', propertyId: 'prop_1', stationName: 'Gate 1', ...ADMIN_ARGS });
    const reset = await h(resetGatehousePin)(ctx, { firmId: 'firm-1', accountId: created.accountId as any, ...ADMIN_ARGS });
    expect(reset.pin).toMatch(/^\d{6}$/);
    expect(reset.pin).not.toBe(created.pin);

    await h(revokeGatehouseAccount)(ctx, { firmId: 'firm-1', accountId: created.accountId as any, reason: 'guard left', ...ADMIN_ARGS });
    expect(tables.gatehouse_accounts[0].status).toBe('revoked');
    // A revoked station cannot be reset and its login is refused.
    await expect(h(resetGatehousePin)(ctx, { firmId: 'firm-1', accountId: created.accountId as any, ...ADMIN_ARGS }))
      .rejects.toThrow(/revoked/i);
    await expect(h(gatehouseLogin)(ctx, { accountId: created.accountId as any, pin: reset.pin }))
      .rejects.toThrow(/revoked/i);
  });
});

describe('gatehouseAccounts §2 — station login + sessions', () => {
  it('the right PIN mints a 30-day session; the server stores ONLY the sha256', async () => {
    const { ctx, tables } = makeCtx(baseTables());
    const created = await h(provisionGatehouseAccount)(ctx, { firmId: 'firm-1', propertyId: 'prop_1', stationName: 'Main Gate', ...ADMIN_ARGS });
    const s: any = await h(gatehouseLogin)(ctx, { accountId: created.accountId as any, pin: created.pin });
    expect(s.stationToken).toMatch(/^[0-9a-f]{64}$/);
    expect(s.stationName).toBe('Main Gate');
    expect(s.propertyId).toBe('prop_1');
    const row = tables.gatehouse_sessions[0];
    expect(row.tokenHash).toBe(sha256Hex(s.stationToken));
    expect(row.tokenHash).not.toBe(s.stationToken);
    expect(row.expiresAt).toBeGreaterThan(NOW + 29 * DAY);
  });

  it('a wrong PIN throws AND lands a gatehouse_login_failed security event with NO PIN echo', async () => {
    const { ctx, tables } = makeCtx(baseTables());
    const created = await h(provisionGatehouseAccount)(ctx, { firmId: 'firm-1', propertyId: 'prop_1', stationName: 'Main Gate', ...ADMIN_ARGS });
    await expect(h(gatehouseLogin)(ctx, { accountId: created.accountId as any, pin: '000001' }))
      .rejects.toThrow(/Wrong PIN/i);
    const evt = tables.securityEvents.find((e: any) => e.eventType === 'gatehouse_login_failed');
    expect(evt).toBeTruthy();
    expect(evt!.details).not.toContain('000001'); // the PIN value never lands in the audit
    expect(JSON.parse(evt!.details).stationName).toBe('Main Gate');
  });

  it('the public station list is names-only (no hashes, no PII)', async () => {
    const { ctx } = makeCtx(baseTables());
    await h(provisionGatehouseAccount)(ctx, { firmId: 'firm-1', propertyId: 'prop_1', stationName: 'Main Gate', ...ADMIN_ARGS });
    const list = await h(getGatehouseStations)(ctx, { firmId: 'firm-1' });
    expect(list).toHaveLength(1);
    expect(Object.keys(list[0]).sort()).toEqual(['accountId', 'propertyId', 'propertyName', 'stationName']);
  });
});

describe('gatehouseAccounts §3 — THE LOCK FLIP on the gate endpoints', () => {
  it('legacy mode: with no stations, verify + check-in work anonymously (back-compat)', async () => {
    const { ctx } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken()] });
    const v: any = await h(verifyToken)(ctx, { tokenCode: '482917', propertyId: 'prop_1' });
    expect(v.valid).toBe(true);
    const out = await h(checkInVisitor)(ctx, { tokenCode: '482917', propertyId: 'prop_1' });
    expect(out.success).toBe(true);
  });

  it('once a station exists, the same anonymous calls are REFUSED with the lock error', async () => {
    const { ctx } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken()] });
    await h(provisionGatehouseAccount)(ctx, { firmId: 'firm-1', propertyId: 'prop_1', stationName: 'Main Gate', ...ADMIN_ARGS });
    await expect(h(verifyToken)(ctx, { tokenCode: '482917', propertyId: 'prop_1' }))
      .rejects.toThrow(/GATEHOUSE_SESSION_REQUIRED/);
    await expect(h(checkInVisitor)(ctx, { tokenCode: '482917', propertyId: 'prop_1' }))
      .rejects.toThrow(/GATEHOUSE_SESSION_REQUIRED/);
  });

  it('a logged-in station session unlocks verify + check-in, and stamps the station on the check-in', async () => {
    const { ctx, tables } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken()] });
    const created = await h(provisionGatehouseAccount)(ctx, { firmId: 'firm-1', propertyId: 'prop_1', stationName: 'Main Gate', ...ADMIN_ARGS });
    const s: any = await h(gatehouseLogin)(ctx, { accountId: created.accountId as any, pin: created.pin });

    const v: any = await h(verifyToken)(ctx, { tokenCode: '482917', propertyId: 'prop_1', stationToken: s.stationToken });
    expect(v.valid).toBe(true);
    const out = await h(checkInVisitor)(ctx, {
      tokenCode: '482917', propertyId: 'prop_1',
      gatekeeperName: s.stationName, stationToken: s.stationToken,
    });
    expect(out.success).toBe(true);
    expect(tables.visitor_tokens[0].checkedInBy).toBe('Main Gate');
  });

  it('a station session for ANOTHER property does not open this one (cross-property misuse)', async () => {
    const { ctx } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken()] });
    // Both estates locked; the guard logs into Palm Annex's station and
    // tries to verify a Palm Grove code with that session.
    const a = await h(provisionGatehouseAccount)(ctx, { firmId: 'firm-1', propertyId: 'prop_1', stationName: 'Main Gate', ...ADMIN_ARGS });
    const b = await h(provisionGatehouseAccount)(ctx, { firmId: 'firm-1', propertyId: 'prop_2', stationName: 'Annex Gate', ...ADMIN_ARGS });
    const s: any = await h(gatehouseLogin)(ctx, { accountId: b.accountId as any, pin: b.pin });
    expect(a.accountId).toBeTruthy(); // prop_1 stays locked by ITS station
    await expect(h(verifyToken)(ctx, { tokenCode: '482917', propertyId: 'prop_1', stationToken: s.stationToken }))
      .rejects.toThrow(/GATEHOUSE_SESSION_REQUIRED/);
  });

  it('revoking a station instantly kills its live sessions while the gate stays locked by the remaining station', async () => {
    const { ctx } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken()] });
    const first = await h(provisionGatehouseAccount)(ctx, { firmId: 'firm-1', propertyId: 'prop_1', stationName: 'Main Gate', ...ADMIN_ARGS });
    const second = await h(provisionGatehouseAccount)(ctx, { firmId: 'firm-1', propertyId: 'prop_1', stationName: 'Gate 1', ...ADMIN_ARGS });
    const s: any = await h(gatehouseLogin)(ctx, { accountId: first.accountId as any, pin: first.pin });
    await h(revokeGatehouseAccount)(ctx, { firmId: 'firm-1', accountId: first.accountId as any, reason: 'test', ...ADMIN_ARGS });
    // The revoked station's session no longer opens the locked gate…
    await expect(h(verifyToken)(ctx, { tokenCode: '482917', propertyId: 'prop_1', stationToken: s.stationToken }))
      .rejects.toThrow(/GATEHOUSE_SESSION_REQUIRED/);
    // …while the other station still works — and its session still opens it.
    const s2: any = await h(gatehouseLogin)(ctx, { accountId: second.accountId as any, pin: second.pin });
    const v: any = await h(verifyToken)(ctx, { tokenCode: '482917', propertyId: 'prop_1', stationToken: s2.stationToken });
    expect(v.valid).toBe(true);
    // Revoking the LAST station returns the property to legacy open mode
    // (documented flip) — and the resolver treats a lone-station property
    // with zero ACTIVE stations as unlocked.
    await h(revokeGatehouseAccount)(ctx, { firmId: 'firm-1', accountId: second.accountId as any, reason: 'test', ...ADMIN_ARGS });
    expect(await propertyHasActiveStations(ctx, 'prop_1')).toBe(false);
  });

  it('propertyHasActiveStations + resolveStationSession are the shared resolver pair', async () => {
    const { ctx } = makeCtx(baseTables());
    expect(await propertyHasActiveStations(ctx, 'prop_1')).toBe(false);
    expect(await resolveStationSession(ctx, 'prop_1', 'nonsense-token')).toBeNull();
  });
});

describe('gatehouseAccounts §4 — least privilege', () => {
  it('a station session is NOT a user session: it cannot pull the admin §5 reports', async () => {
    const { ctx } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken()] });
    const created = await h(provisionGatehouseAccount)(ctx, { firmId: 'firm-1', propertyId: 'prop_1', stationName: 'Main Gate', ...ADMIN_ARGS });
    const s: any = await h(gatehouseLogin)(ctx, { accountId: created.accountId as any, pin: created.pin });
    // getSentryDailyReport authenticates via requireFirmUser — the station
    // token is not a bearer session, so it must be rejected.
    await expect(h(getSentryDailyReport)(ctx, { date: TODAY, sessionToken: s.stationToken } as any))
      .rejects.toThrow(/Unauthenticated/);
  });

  it('the terminal is the only consumer: the station login mutation exists nowhere in the resident portal source', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const repoRoot = existsSync(resolve('convex/gatehouseAccounts.ts')) ? process.cwd() : resolve('..', '..');
    const portal = readFileSync(resolve(repoRoot, 'src/components/portal/VisitorPortal.tsx'), 'utf8');
    const gate = readFileSync(resolve(repoRoot, 'src/components/portal/GatekeeperInterface.tsx'), 'utf8');
    expect(gate).toContain('gatehouseLogin');
    expect(portal).not.toContain('gatehouseLogin');       // residents never see station auth
    expect(portal).not.toContain('raiseRequest');          // the request desk is gone from the portal side
    expect(gate).not.toContain('createArrivalRequest');   // …and from the gate side (TASK 94 retirement)
  });
});
