/**
 * roundSentry.test.ts — ROUND SENTRY acceptance suite.
 *
 * The owner brief lists TEN acceptance criteria. Every one of them is
 * exercised here against the REAL Convex handlers (the Round A/B/F/G
 * house pattern: fixture-backed ctx, `(fn as any)._handler(ctx, args)`,
 * zero reimplementation of the code under test):
 *
 *   1.  Visitor pre-authorisation        — the §2 arrival-request workflow
 *   2.  Pass generation                  — code + passRef + display-only extras
 *   3.  Valid pass verification          — minimal projection, instructions
 *   4.  Expired pass rejection           — reason 'expired'
 *   5.  Cancelled pass rejection         — reason 'revoked'
 *   6.  Duplicate entry prevention       — 'already_inside' / 'used'
 *   7.  Arrival recording                — check-in patches the row
 *   8.  Departure recording              — check-out patches the row
 *   9.  Permission enforcement           — possession gates on every path
 *   10. Audit history                    — securityEvents + audit_logs rows
 *
 * Plus the §4 security-contract pins that are awkward to drive through
 * fixtures (charset, entropy source, expiry semantics never widened).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateVisitorToken, verifyToken, checkInVisitor, checkOutVisitor, recordDeniedEntry, getSentryDailyReport, getSentryOnSite, getSentryHistorical, getSentrySecurityReport, getResidentTokens } from '../../convex/visitorManagement';
import { createArrivalRequest, decideArrivalRequest, getSentryResidentRequests, getGatehouseRequests } from '../../convex/sentryRequests';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/visitorManagement.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

// ─── Fixture-backed mock ctx (Round A/B/F/G harness, extended) ─────────────
// EXTENSIONS this suite needs over the roundG harness:
//   1. `.filter(fn)` actually EVALUATES the Convex q-DSL (eq/gte/lt/neq +
//      JS boolean composition) instead of ignoring it — the Sentry handlers
//      lean on filter for visitDate scoping and 24h-code-collision windows.
//   2. `patch(id, patch)` mutates the stored row — arrival/departure
//      recording is exactly a patch, and the roundG no-op patch would
//      fake-pass the acceptance criteria.
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

  // The q-DSL handed to .filter(fn): field(name) returns the ROW's value so
  // the handler's JS boolean composition evaluates truthfully per row.
  const qFor = (r: Row) => {
    const q: any = {
      field: (name: string) => r[name],
    };
    for (const op of Object.keys(CMP)) {
      q[op] = (a: any, b: any) => CMP[op](a, b);
    }
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
const isoDay = (offsetDays: number) => new Date(NOW + offsetDays * DAY).toISOString().split('T')[0];

// ─── Shared fixtures ────────────────────────────────────────────────────────
const RESIDENT_ID = 'users_1_resA';
const OTHER_RESIDENT_ID = 'users_2_resB';
const ADMIN_ID = 'users_9_admin';
const SESSION_PLAIN_RESIDENT = 'sess-resident-1111';
const SESSION_PLAIN_OTHER = 'sess-other-2222';
const SESSION_PLAIN_ADMIN = 'sess-admin-3333';

function baseTables(): Record<string, Row[]> {
  return {
    firms: [
      { _id: 'firm_1', id: 'firm-1', name: 'Atrium Estates', email: 'admin@atrium.ng', subscriptionPlan: 'Komplete' },
    ],
    users: [
      { _id: RESIDENT_ID, id: RESIDENT_ID, name: 'Ada Resident', email: 'ada@res.ng', role: 'Tenant', firmId: 'firm-1', phone: '+2348010000001' },
      { _id: OTHER_RESIDENT_ID, id: OTHER_RESIDENT_ID, name: 'Bode Other', email: 'bode@res.ng', role: 'Tenant', firmId: 'firm-1', phone: '+2348010000002' },
      { _id: ADMIN_ID, id: ADMIN_ID, name: 'Estate Admin', email: 'admin@atrium.ng', role: 'Administrator', firmId: 'firm-1' },
    ],
    sessions: [
      { _id: 'sess_1', tokenHash: hashSessionToken(SESSION_PLAIN_RESIDENT), userId: RESIDENT_ID, expiresAt: NOW + DAY, revokedAt: null },
      { _id: 'sess_2', tokenHash: hashSessionToken(SESSION_PLAIN_OTHER), userId: OTHER_RESIDENT_ID, expiresAt: NOW + DAY, revokedAt: null },
      { _id: 'sess_3', tokenHash: hashSessionToken(SESSION_PLAIN_ADMIN), userId: ADMIN_ID, expiresAt: NOW + DAY, revokedAt: null },
    ],
    suspendedUsers: [],
    portal_settings: [{ _id: 'ps_1', firmId: 'firm-1', vmsGracePeriodMinutes: 30, vmsDefaultExpiryHours: 6 }],
    properties: [{ _id: 'prop_1', id: 'prop_1', firmId: 'firm-1', name: 'Palm Grove', address: '12 Marina Rd' }],
    tenancies: [
      { _id: 'ten_1', firmId: 'firm-1', propertyId: 'prop_1', unitId: 'unit_1', unitKey: 'B14', unitName: 'B14', tenantUserId: RESIDENT_ID, tenantName: 'Ada Resident', status: 'active', createdAt: '2026-01-01' },
    ],
    visitor_tokens: [],
    sentry_arrival_requests: [],
    app_notifications: [],
    securityEvents: [],
    audit_logs: [],
    rateLimits: [],
    communicationsOutbox: [],
  };
}

/** A freshly generated (2019-style active) token row helper. */
function activeToken(overrides: Partial<Row> = {}): Row {
  return {
    _id: 'vt_active_1',
    firmId: 'firm-1',
    propertyId: 'prop_1',
    propertyName: 'Palm Grove',
    propertyAddress: '12 Marina Rd',
    unitId: 'unit_1',
    unitName: 'B14',
    residentId: RESIDENT_ID,
    residentName: 'Ada Resident',
    residentPhone: '+2348010000001',
    visitorName: 'Tunde Visitor',
    visitorPhone: '+2348020000009',
    tokenCode: '482917',
    passRef: 'A7K2M9P4Q6R8',
    deliveryMethod: 'client_share',
    status: 'active',
    visitDate: TODAY,
    // TIME-INDEPENDENT validity: the window must be in the FUTURE relative to
    // real clock time when the suite runs, or every "valid" assertion flips to
    // expired after 06:30 local. visitDate stays TODAY so validFrom (00:00 -
    // grace) is always in the past; expiresAt rides NOW + 2h.
    expiresAt: NOW + 2 * 60 * 60 * 1000,
    expiryWindowHours: 6,
    gracePeriodMinutes: 30,
    expectedArrival: '14:30',
    accessNote: 'Gate 2, call on arrival',
    createdAt: NOW - 60 * 60 * 1000,
    updatedAt: NOW - 60 * 60 * 1000,
    ...overrides,
  };
}

const h = (fn: any) => (fn as any)._handler ?? fn;

// ═══════════════════════════════════════════════════════════════════════════
// §1 — Visitor registration + pass generation (acceptance 2)
// ═══════════════════════════════════════════════════════════════════════════
describe('roundSentry §1 — registration & pass generation (acceptance 2)', () => {
  it('generateVisitorToken mints a 6-digit code AND a 12-char non-guessable passRef, and carries the display-only extras', async () => {
    const { ctx, tables } = makeCtx(baseTables());
    const out = await h(generateVisitorToken)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', unitId: 'unit_1', residentId: RESIDENT_ID,
      visitorName: 'Grace Guest', visitorPhone: '+2348030000007',
      visitDate: TODAY, expiryWindowHours: 6, deliveryMethod: 'client_share',
      sessionToken: SESSION_PLAIN_RESIDENT,
      expectedArrival: '10:15', accessNote: 'Use the service gate',
    });
    expect(out.tokenCode).toMatch(/^\d{6}$/);
    expect(out.passRef).toMatch(/^[A-HJKMNP-Z2-9]{12}$/); // no I/L/O/0/1
    const row = tables.visitor_tokens.find((t) => t._id === out.tokenId)!;
    expect(row.expectedArrival).toBe('10:15');
    expect(row.accessNote).toBe('Use the service gate');
    expect(row.passRef).toBe(out.passRef);
    expect(row.status).toBe('active');
  });

  it('rejects a malformed expected arrival time (display-only extras are validated, not trusted)', async () => {
    const { ctx } = makeCtx(baseTables());
    await expect(h(generateVisitorToken)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', residentId: RESIDENT_ID,
      visitorName: 'G', visitorPhone: '+234', visitDate: TODAY, expiryWindowHours: 6,
      deliveryMethod: 'client_share', sessionToken: SESSION_PLAIN_RESIDENT,
      expectedArrival: '25:99',
    })).rejects.toThrow(/Invalid expected arrival time/);
  });

  it('never widens the validity window: expiry is visitDate 00:00 + window, with grace — unchanged semantics', async () => {
    const { ctx } = makeCtx(baseTables());
    const out = await h(generateVisitorToken)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', residentId: RESIDENT_ID,
      visitorName: 'W', visitorPhone: '+234', visitDate: TODAY, expiryWindowHours: 2,
      deliveryMethod: 'client_share', sessionToken: SESSION_PLAIN_RESIDENT,
      expectedArrival: '09:00',
    });
    expect(out.expiresAt).toBe(new Date(TODAY + 'T00:00:00').getTime() + 2 * 60 * 60 * 1000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §4 — Verification state machine (acceptance 3, 4, 5, 6)
// ═══════════════════════════════════════════════════════════════════════════
describe('roundSentry §4 — verification state machine (acceptance 3/4/5/6)', () => {
  it('acceptance 3: a valid pass verifies with the minimal projection + the resident instructions', async () => {
    const { ctx } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken()] });
    const out = await h(verifyToken)(ctx, { tokenCode: '482917', propertyId: 'prop_1' });
    expect(out.valid).toBe(true);
    expect(out.visitorName).toBe('Tunde Visitor');
    expect(out.expectedArrival).toBe('14:30');
    expect(out.accessNote).toBe('Gate 2, call on arrival');
    // Minimal projection: no phones, no address, no internal ids
    expect((out as any).visitorPhone).toBeUndefined();
    expect((out as any).propertyAddress).toBeUndefined();
    expect((out as any)._id).toBeUndefined();
  });

  it('acceptance 3 (passRef): the 12-char Pass ID verifies too, case-insensitively', async () => {
    const { ctx } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken()] });
    const out = await h(verifyToken)(ctx, { passRef: 'a7k2m9p4q6r8', propertyId: 'prop_1' });
    expect(out.valid).toBe(true);
    expect(out.visitorName).toBe('Tunde Visitor');
  });

  it('acceptance 4: an expired pass is rejected with reason "expired"', async () => {
    const { ctx } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken({ status: 'expired', expiresAt: NOW - 2 * DAY })] });
    const out = await h(verifyToken)(ctx, { tokenCode: '482917', propertyId: 'prop_1' });
    expect(out.valid).toBe(false);
    expect(out.reason).toBe('expired');
  });

  it('acceptance 5: a cancelled (revoked) pass is rejected with reason "revoked"', async () => {
    const { ctx } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken({ status: 'revoked', revokedAt: NOW - 3600, revokedReason: 'plan changed' })] });
    const out = await h(verifyToken)(ctx, { tokenCode: '482917', propertyId: 'prop_1' });
    expect(out.valid).toBe(false);
    expect(out.reason).toBe('revoked');
  });

  it('acceptance 6: duplicate entry is prevented — "already_inside" while on-site, "used" after check-out', async () => {
    const inside = activeToken({ status: 'used', checkedInAt: NOW - 30 * 60 * 1000 });
    const gone = activeToken({
      _id: 'vt_gone', tokenCode: '314159', passRef: 'W9X2Y4Z6A8B2',
      status: 'used', checkedInAt: NOW - 5 * 3600 * 1000, checkedOutAt: NOW - 3600 * 1000,
    });
    const { ctx } = makeCtx({ ...baseTables(), visitor_tokens: [inside, gone] });

    const a = await h(verifyToken)(ctx, { tokenCode: '482917', propertyId: 'prop_1' });
    expect(a.valid).toBe(false);
    expect(a.reason).toBe('already_inside');

    const b = await h(verifyToken)(ctx, { passRef: 'w9x2y4z6a8b2', propertyId: 'prop_1' });
    expect(b.valid).toBe(false);
    expect(b.reason).toBe('used');
  });

  it('a pass for another day is "not_yet_valid" (grace applies only around its own window)', async () => {
    const { ctx } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken({ visitDate: isoDay(2), expiresAt: new Date(isoDay(2) + 'T00:00:00').getTime() + 6 * 3600 * 1000 })] });
    const out = await h(verifyToken)(ctx, { tokenCode: '482917', propertyId: 'prop_1' });
    expect(out.valid).toBe(false);
    expect(out.reason).toBe('not_yet_valid');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §3 — Gatehouse operations (acceptance 7, 8) + failure audit
// ═══════════════════════════════════════════════════════════════════════════
describe('roundSentry §3 — arrival & departure recording (acceptance 7/8)', () => {
  it('acceptance 7: check-in patches the row to used + checkedInAt + checkedInBy', async () => {
    const { ctx, tables } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken()] });
    const out = await h(checkInVisitor)(ctx, { tokenCode: '482917', propertyId: 'prop_1', gatekeeperName: 'Main Gate' });
    expect(out.success).toBe(true);
    const row = tables.visitor_tokens[0];
    expect(row.status).toBe('used');
    expect(row.checkedInAt).toBeTypeOf('number');
    expect(row.checkedInBy).toBe('Main Gate');
  });

  it('check-in by passRef works the same (possession proof is the identifier)', async () => {
    const { ctx, tables } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken()] });
    await h(checkInVisitor)(ctx, { passRef: 'a7k2m9p4q6r8', propertyId: 'prop_1', gatekeeperName: 'Post 2' });
    expect(tables.visitor_tokens[0].status).toBe('used');
  });

  it('checking in a non-active pass throws AND is audited as a rejected pass attempt', async () => {
    const { ctx, tables } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken({ status: 'expired', expiresAt: NOW - DAY })] });
    await expect(h(checkInVisitor)(ctx, { tokenCode: '482917', propertyId: 'prop_1' }))
      .rejects.toThrow(/Token is expired/);
    expect(tables.securityEvents.filter(e => e.eventType === 'sentry_pass_attempt_rejected').length).toBe(1);
  });

  it('acceptance 8: check-out patches checkedOutAt (and refuses a never-checked-in visitor)', async () => {
    const inSide = activeToken({ status: 'used', checkedInAt: NOW - 3600 });
    const { ctx, tables } = makeCtx({ ...baseTables(), visitor_tokens: [inSide] });
    const out = await h(checkOutVisitor)(ctx, { tokenCode: '482917', propertyId: 'prop_1' });
    expect(out.success).toBe(true);
    expect(tables.visitor_tokens[0].checkedOutAt).toBeTypeOf('number');

    const fresh = activeToken({ _id: 'vt_fresh' });
    const { ctx: ctx2 } = makeCtx({ ...baseTables(), visitor_tokens: [fresh] });
    await expect(h(checkOutVisitor)(ctx2, { tokenCode: '482917', propertyId: 'prop_1' }))
      .rejects.toThrow(/has not checked in/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §2 — Resident authorisation workflow (acceptance 1)
// ═══════════════════════════════════════════════════════════════════════════
describe('roundSentry §2 — arrival-request workflow (acceptance 1)', () => {
  it('createArrivalRequest resolves the resident SERVER-SIDE from the active tenancy, notifies in-app, and leaves a pending row', async () => {
    const { ctx, tables } = makeCtx(baseTables());
    const out = await h(createArrivalRequest)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', unitLabel: 'b14',
      visitorName: 'Chidi Courier', visitorPhone: '+2348090000004',
      notes: 'Says he has a delivery for Ada', requestedBy: 'Main Gate',
    });
    const row = tables.sentry_arrival_requests[0];
    expect(row.status).toBe('pending');
    expect(row.residentId).toBe(RESIDENT_ID);           // from the tenancy, not the caller
    expect(row.requestedBy).toBe('Main Gate');
    expect(tables.app_notifications.length).toBe(1);     // the resident ping
    expect(tables.app_notifications[0].userId).toBe(RESIDENT_ID);
    expect(tables.app_notifications[0].type).toBe('security');
    expect(out.residentName).toBe('Ada Resident');
  });

  it('an unknown unit is refused honestly (no resident invented)', async () => {
    const { ctx } = makeCtx(baseTables());
    await expect(h(createArrivalRequest)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', unitLabel: 'Z99',
      visitorName: 'Nobody', requestedBy: 'Main Gate',
    })).rejects.toThrow(/No active resident found/);
  });

  it('approval mints a today-pass through the same gate + uniqueness rule, links tokenId, and schedules WhatsApp when a phone was left', async () => {
    const { ctx, tables } = makeCtx(baseTables());
    const req = await h(createArrivalRequest)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', unitLabel: 'B14',
      visitorName: 'Chidi Courier', visitorPhone: '+2348090000004',
      requestedBy: 'Main Gate',
    });

    const out = await h(decideArrivalRequest)(ctx, {
      requestId: req.requestId, decision: 'approved',
      residentId: RESIDENT_ID, sessionToken: SESSION_PLAIN_RESIDENT,
    });
    expect(out.decision).toBe('approved');
    expect(out.tokenCode).toMatch(/^\d{6}$/);
    expect(out.passRef).toMatch(/^[A-HJKMNP-Z2-9]{12}$/);
    expect(out.delivered).toBe('whatsapp');

    const reqRow = tables.sentry_arrival_requests[0];
    expect(reqRow.status).toBe('approved');
    expect(String(reqRow.tokenId)).toBe(String(out.tokenId));
    expect(reqRow.decidedBy).toBe(RESIDENT_ID);

    const tokenRow = tables.visitor_tokens.find((t: any) => String(t._id) === String(out.tokenId))!;
    expect(tokenRow.visitDate).toBe(TODAY);
    expect(tokenRow.status).toBe('active');

    expect((ctx.scheduler.runAfter as any).mock.calls.length).toBeGreaterThanOrEqual(1); // WhatsApp scheduled
  });

  it('rejection is recorded with the reason on the row (the authorisation record)', async () => {
    const { ctx, tables } = makeCtx(baseTables());
    const req = await h(createArrivalRequest)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', unitLabel: 'B14',
      visitorName: 'Stranger', requestedBy: 'Post 3',
    });
    const out = await h(decideArrivalRequest)(ctx, {
      requestId: req.requestId, decision: 'rejected',
      rejectReason: 'Not expecting anyone',
      residentId: RESIDENT_ID, sessionToken: SESSION_PLAIN_RESIDENT,
    });
    expect(out.decision).toBe('rejected');
    const reqRow = tables.sentry_arrival_requests[0];
    expect(reqRow.status).toBe('rejected');
    expect(reqRow.rejectReason).toBe('Not expecting anyone');
    expect(tables.visitor_tokens.length).toBe(0); // no pass minted
  });

  it('a pending request cannot be decided twice, and an expired request cannot be decided at all', async () => {
    const { ctx } = makeCtx(baseTables());
    const req = await h(createArrivalRequest)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', unitLabel: 'B14',
      visitorName: 'Late Arrival', requestedBy: 'Main Gate',
    });
    await h(decideArrivalRequest)(ctx, { requestId: req.requestId, decision: 'approved', residentId: RESIDENT_ID, sessionToken: SESSION_PLAIN_RESIDENT });
    await expect(h(decideArrivalRequest)(ctx, { requestId: req.requestId, decision: 'rejected', residentId: RESIDENT_ID, sessionToken: SESSION_PLAIN_RESIDENT }))
      .rejects.toThrow(/already approved/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §4/§7 — Permission enforcement (acceptance 9)
// ═══════════════════════════════════════════════════════════════════════════
describe('roundSentry §4/§7.9 — permission enforcement (acceptance 9)', () => {
  it('a resident cannot decide a request that belongs to someone else', async () => {
    const { ctx } = makeCtx(baseTables());
    const req = await h(createArrivalRequest)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', unitLabel: 'B14',
      visitorName: 'Ada Visitor', requestedBy: 'Main Gate',
    });
    await expect(h(decideArrivalRequest)(ctx, {
      requestId: req.requestId, decision: 'approved',
      residentId: OTHER_RESIDENT_ID, sessionToken: SESSION_PLAIN_OTHER,
    })).rejects.toThrow(/belongs to another resident/);
  });

  it('generateVisitorToken refuses a caller whose session is not the resident named in the args', async () => {
    const { ctx } = makeCtx(baseTables());
    await expect(h(generateVisitorToken)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', residentId: RESIDENT_ID,
      visitorName: 'Spoofed', visitorPhone: '+234', visitDate: TODAY, expiryWindowHours: 6,
      deliveryMethod: 'client_share', sessionToken: SESSION_PLAIN_OTHER,  // Bode's session
    })).rejects.toThrow(/Not authorized/);
  });

  it('no session at all → unauthenticated (no spoofable fallback)', async () => {
    const { ctx } = makeCtx(baseTables());
    await expect(h(getResidentTokens)(ctx, { firmId: 'firm-1', residentId: RESIDENT_ID }))
      .rejects.toThrow(/Unauthenticated/);
  });

  it('the §5 reports are firm-gated: no session → unauthenticated; the gatehouse board stays public-but-minimal', async () => {
    const { ctx } = makeCtx(baseTables());
    await expect(h(getSentryDailyReport)(ctx, { date: TODAY }))
      .rejects.toThrow(/Unauthenticated/);
    const board = await h(getGatehouseRequests)(ctx, { propertyId: 'prop_1' });
    expect(Array.isArray(board)).toBe(true); // public board answers (throttled in production)
  });

  it('approval does NOT bypass the VMS billing gate (a Starter firm without the add-on is refused)', async () => {
    const tables = baseTables();
    tables.firms = [{ _id: 'firm_1', id: 'firm-1', name: 'Starter Co', email: 'pay@starter.ng', subscriptionPlan: 'Starter', subscriptionAddons: { vms: { status: 'none' } } }];
    const { ctx } = makeCtx(tables);
    const req = await h(createArrivalRequest)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', unitLabel: 'B14',
      visitorName: 'Trial Visitor', requestedBy: 'Main Gate',
    });
    await expect(h(decideArrivalRequest)(ctx, {
      requestId: req.requestId, decision: 'approved',
      residentId: RESIDENT_ID, sessionToken: SESSION_PLAIN_RESIDENT,
    })).rejects.toThrow(/VMS_ADDON_REQUIRED/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §5 + §7.10 — Audit history (acceptance 10)
// ═══════════════════════════════════════════════════════════════════════════
describe('roundSentry §5/§7.10 — denied entries & audit history (acceptance 10)', () => {
  it('recordDeniedEntry lands a sentry_denied_entry security event with the minimal payload + tokenId join', async () => {
    const { ctx, tables } = makeCtx({ ...baseTables(), visitor_tokens: [activeToken()] });
    const out = await h(recordDeniedEntry)(ctx, {
      propertyId: 'prop_1', propertyName: 'Palm Grove',
      tokenCode: '482917', visitorName: 'Tunde Visitor',
      reason: 'Resident unreachable', gatekeeperName: 'Main Gate',
    });
    expect(out.tokenId).toBe(String(tables.visitor_tokens[0]._id));
    const evt = tables.securityEvents.find(e => e.eventType === 'sentry_denied_entry')!;
    expect(evt).toBeTruthy();
    const detail = JSON.parse(evt.details);
    expect(detail.reason).toBe('Resident unreachable');
    expect(detail.gatekeeper).toBe('Main Gate');
    expect(detail.propertyId).toBe('prop_1');
    // The denial must NOT mutate the pass lifecycle
    expect(tables.visitor_tokens[0].status).toBe('active');
  });

  it('a denial without a reason is refused (the report is only as good as its data)', async () => {
    const { ctx } = makeCtx(baseTables());
    await expect(h(recordDeniedEntry)(ctx, { propertyId: 'prop_1', reason: '   ' }))
      .rejects.toThrow(/reason is required/);
  });

  it('each §5 report pull writes an audit_logs row BEFORE returning the data', async () => {
    const tables = baseTables();
    tables.visitor_tokens = [
      activeToken(), // expected (active, not checked in)
      activeToken({ _id: 'vt_in', status: 'used', checkedInAt: NOW - 3600 }), // on-site
      activeToken({ _id: 'vt_done', status: 'used', checkedInAt: NOW - 5 * 3600, checkedOutAt: NOW - 3600, visitDate: isoDay(-1) }),
      activeToken({ _id: 'vt_exp', status: 'expired', expiresAt: NOW - DAY, visitDate: isoDay(-1) }),
    ];
    const { ctx } = makeCtx(tables);

    const daily = await h(getSentryDailyReport)(ctx, { date: TODAY, userEmail: 'admin@atrium.ng', sessionToken: SESSION_PLAIN_ADMIN });
    expect(daily.counts.expected).toBe(1);
    expect(daily.counts.onSite).toBe(1);
    expect(daily.visitors.length).toBe(2); // only TODAY's visitDate rows
    expect(tables.audit_logs.filter(a => a.resource === 'sentry_report' && a.action === 'read').length).toBe(1);

    const onsite = await h(getSentryOnSite)(ctx, { userEmail: 'admin@atrium.ng', sessionToken: SESSION_PLAIN_ADMIN });
    expect(onsite.length).toBe(1);
    expect(onsite[0].visitorName).toBe('Tunde Visitor');

    const hist = await h(getSentryHistorical)(ctx, { from: isoDay(-2), to: TODAY, limit: 200, userEmail: 'admin@atrium.ng', sessionToken: SESSION_PLAIN_ADMIN });
    expect(hist.total).toBe(4);
    expect(hist.records.length).toBe(4);

    expect(tables.audit_logs.filter(a => a.resource === 'sentry_report').length).toBe(3); // one per pull
  });

  it('the security report counts denied entries, rejected pass attempts and vms throttles (7-day window)', async () => {
    const tables = baseTables();
    tables.securityEvents = [
      { _id: 'se_1', eventType: 'sentry_denied_entry', details: JSON.stringify({ propertyId: 'prop_1', reason: 'No pass', visitorName: 'X' }), timestamp: NOW - 3600 },
      { _id: 'se_2', eventType: 'sentry_pass_attempt_rejected', details: JSON.stringify({ propertyId: 'prop_1', stage: 'checkin_expired_pass' }), timestamp: NOW - 2 * 3600 },
      { _id: 'se_3', eventType: 'rate_limit_exceeded', details: 'Key: vms-verify:prop_1, Count: 31, Limit: 30', timestamp: NOW - 3 * 3600 },
      { _id: 'se_4', eventType: 'rate_limit_exceeded', details: 'Key: login:ip:1.2.3.4, Count: 9', timestamp: NOW - 3600 }, // not Sentry — excluded
      { _id: 'se_5', eventType: 'sentry_denied_entry', details: JSON.stringify({ propertyId: 'prop_1', reason: 'Old one' }), timestamp: NOW - 9 * DAY }, // outside window
    ];
    const { ctx } = makeCtx(tables);
    const out = await h(getSentrySecurityReport)(ctx, { from: NOW - 7 * DAY, to: NOW + 1000, userEmail: 'admin@atrium.ng', sessionToken: SESSION_PLAIN_ADMIN });
    expect(out.counts.denied).toBe(1);
    expect(out.counts.rejectedPassAttempts).toBe(1);
    expect(out.counts.throttled).toBe(1);
    expect(out.events.length).toBe(3); // excludes the login throttle + the 9-day-old denial
  });

  it('the resident sees their own request history (pending + last 7 days) via their session', async () => {
    const { ctx } = makeCtx(baseTables());
    const req = await h(createArrivalRequest)(ctx, {
      firmId: 'firm-1', propertyId: 'prop_1', unitLabel: 'B14',
      visitorName: 'History Check', requestedBy: 'Main Gate',
    });
    const rows = await h(getSentryResidentRequests)(ctx, { firmId: 'firm-1', residentId: RESIDENT_ID, sessionToken: SESSION_PLAIN_RESIDENT });
    expect(rows.length).toBe(1);
    expect(rows[0].visitorName).toBe('History Check');
    expect(rows[0].status).toBe('pending');
    // No phones in the projection
    expect((rows[0] as any).residentPhone).toBeUndefined();
    expect((rows[0] as any).visitorPhone).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §4 — Source-scanned security contracts (hard to fake through fixtures)
// ═══════════════════════════════════════════════════════════════════════════
describe('roundSentry §4 — source-scanned security contracts', () => {
  const vm = read('convex/visitorManagement.ts');
  const sr = read('convex/sentryRequests.ts');
  const schema = read('convex/schema.ts');
  const gatekeeper = read('src/components/portal/GatekeeperInterface.tsx');
  const portal = read('src/components/portal/VisitorPortal.tsx');

  it('passRef entropy comes from the crypto-secure helpers (never Math.random), and the alphabet excludes I/L/O/0/1', () => {
    expect(vm).toContain('const PASSREF_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"');
    expect(vm).toContain('codeFromCharset(PASSREF_CHARSET, PASSREF_LENGTH)');
    expect(sr).toContain('codeFromCharset(PASSREF_CHARSET, PASSREF_LENGTH)');
  });

  it('a visitor pass can never be permanent: every generated row carries expiresAt + expiryWindowHours, and the expiry cron still sweeps', () => {
    expect(schema).toContain('expiresAt: v.number(),');
    expect(read('convex/crons.ts')).toContain('"cleanupExpiredVisitorTokens"');
    expect(read('convex/crons.ts')).toContain('"expireStaleArrivalRequests"');
  });

  it('the display-only extras never widen the window: the generator slices accessNote to 120 and validates HH:MM', () => {
    expect(vm).toContain(".slice(0, 120)");
    expect(vm).toContain("/^([01]\\d|2[0-3]):[0-5]\\d$/");
  });

  it('PII minimization pins: NO public projection carries a phone — verify AND the report projections both exclude it', () => {
    // The PUBLIC verify projection excludes phones/addresses
    const verifyIdx = vm.indexOf('export const verifyToken');
    const verifyEnd = vm.indexOf('export const checkInVisitor');
    const verifyBody = vm.slice(verifyIdx, verifyEnd);
    expect(verifyBody).toContain('expectedArrival: token.expectedArrival,');
    expect(verifyBody).toContain('accessNote: token.accessNote,');
    expect(verifyBody).not.toContain('visitorPhone: token.visitorPhone');
    expect(verifyBody).not.toContain('propertyAddress: token.propertyAddress');
    // The admin report projection excludes phones too (names/units suffice)
    const projIdx = vm.indexOf('const REPORT_PROJECTION');
    const projEnd = vm.indexOf('// 5a —');
    const projBody = vm.slice(projIdx, projEnd);
    expect(projBody).not.toContain('visitorPhone');
    expect(projBody).not.toContain('residentPhone');
    expect(projBody).not.toContain('propertyAddress');
  });

  it('every new public endpoint is throttled (verify/check-in/check-out/denial/search/requests/boards)', () => {
    for (const key of ['vms-verify:', 'vms-checkin:', 'vms-checkout:', 'vms-denied:', 'vms-search:', 'sentry-req:', 'sentry-req-board:']) {
      expect(vm + sr).toContain(key);
    }
  });

  it('the §5 reports are the ONLY Sentry surface behind requireFirmUser, and they audit before returning', () => {
    for (const fn of ['getSentryDailyReport', 'getSentryOnSite', 'getSentryHistorical', 'getSentrySecurityReport']) {
      expect(vm).toContain(`export const ${fn} = mutation`);
    }
    expect(vm).toContain('resource: "sentry_report"');
  });

  it('UX pins: the gate accepts PIN or Pass ID in one box, auto-verifies, and denial is one tap + one reason', () => {
    expect(gatekeeper).toContain("looksLikePin(value)");
    expect(gatekeeper).toContain('DENIAL_REASONS');
    expect(gatekeeper).toContain('Record denied entry');
    expect(gatekeeper).toContain('Access instructions');
    expect(portal).toContain('never widens the');
    expect(portal).toContain('At the gate (');
  });

  it('the §1 information-minimisation promise: only what the resident volunteers (arrival + note are optional on the form)', () => {
    expect(portal).toContain('Expected Arrival (optional)');
    expect(portal).toContain('Instructions for the gate (optional)');
    expect(schema).toContain('expectedArrival: v.optional(v.string())');
    expect(schema).toContain('accessNote: v.optional(v.string())');
  });
});
