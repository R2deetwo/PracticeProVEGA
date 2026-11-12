/**
 * roundDWave3b.test.ts — ROUND D (Wave 3b, D8) regression tests: the
 * dead/dangerous orphan surface sweep.
 *
 * PINNED BUG CLASSES (D8 — the re-derived enumeration from the R80 record,
 * every claim re-verified on the R80 tree before fixing):
 *
 * D8(a) findDuplicateEmails — THE SPOOFABLE CENSUS: an 'admin only' gate
 *   that read a CALLER-SUPPLIED role string (args.requesterRole), where
 *   OMITTING the arg entirely PASSED the gate — any unauthenticated caller
 *   could census up to 2000 users (emails, roles, firmIds, names,
 *   verification state). One-time diagnostic, zero product callers →
 *   deleted with a record (not re-gated: a census has no legitimate
 *   unauthenticated use).
 *
 * D8(b) the dangerous ungated publics with zero callers: dumpAll (neutered
 *   stub, still public), getFirmActivity + getResearchSourceContent
 *   (cross-firm reads whose only 'gate' was knowing the target's firmId),
 *   checkIncompleteRegistration (email-status enumeration oracle),
 *   ai.extractContactInfo (unauthenticated AI spend), backups pair,
 *   legalRepo/legalKnowledge reference reads, migrations reports → deleted
 *   with records.
 *
 * D8(c) the unauth'd research reads: getResearchMessages /
 *   getResearchAnalysisResults were WIRED (ResearchView) but took a bare
 *   notebookId with no session — anyone who knew a notebook id could read
 *   any firm's research chat → retrofitted with the Round 8 pattern
 *   (requireStaffCaller + assertSameFirm bound to the notebook's own
 *   firmId); ResearchView passes the bearer + email.
 *
 * D8(d) the dead twins: estateCommunity (getBookingsForResident /
 *   getServiceProvider — superseded by the R79-wired surface), the eleven
 *   sentry console twins (superseded by getCashFlowSummary /
 *   getPipelineByFirm / getServiceChargesByFirm / getInboundMessages),
 *   securityHelpers.getSecurityEvents (superseded by
 *   founderMetrics.getSecurityEventsForAdmin), plus the misc gated-orphan
 *   pool across 20 further modules (founderMetrics, portals, conversation
 *   memory, legal knowledge/repo, financialIntegrity, …) → all deleted
 *   with records; 62 publics in total, plus the dead scripts/checkDB*.ts
 *   probes.
 *
 * Every fix is pinned in BOTH directions per the house convention: the
 * dangerous path is dead, the legitimate workflow works, and the LIVE
 * surfaces the deletions must NOT touch are contract-pinned as still
 * exported.
 *
 * Testing style: the Round A/B/D behavioural harness (fixture-backed mock
 * ctx executing the real Convex handlers via `_handler(ctx, args)`) plus
 * source-contract tests (the R16/R77/R79/R80 pattern).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Convex functions under test ─────────────────────────────────────────────
import { getResearchMessages, getResearchAnalysisResults } from '../../convex/myFunctions';
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
    researchNotebooks: [],
    researchMessages: [],
    researchAnalysisResults: [],
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
    // HOTFIX (2026-11-12) fidelity: mirror Convex's normalizeId — a valid
    // table id normalizes to itself; anything else (a client UUID v4, a
// fixture label with dashes, garbage) returns null instead of the throw
    // a real db.get() would produce for non-base32 ids.
    normalizeId: (_table: string, id: any) => {
      const s = String(id ?? '');
      return /^[a-z0-9]{22,40}$/.test(s) ? (id as any) : null;
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

const NOW = Date.now();

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

// ═══════════════════════════════════════════════════════════════════════════
// D8(c) — the research reads are authenticated (the unauth'd read cluster)
// ═══════════════════════════════════════════════════════════════════════════
describe('D8 — research reads auth truth (getResearchMessages / getResearchAnalysisResults)', () => {
  // HOTFIX (2026-11-12) fixture fidelity: production notebooks carry the
  // CLIENT uuid v4 in their `id` field (createItem path; documentState keeps
  // it as nb.id) alongside the Convex `_id`. Messages are keyed by that
  // client UUID. The old fixtures only had `_id` labels, so the mock never
  // exercised the id form that actually crashed production.
  const NB1_UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
  const NB2_UUID = 'b6c2a7d0-8f11-4c22-9e3f-1a2b3c4d5e6f';
  const NB_LEGACY_UUID = '0d5f9a22-6d51-4d84-8b1e-77c9b0a12345';
  const NB1_CONVEX_ONLY = 'k57convexonly000000000000000000';
  const researchTables = {
    researchNotebooks: [
      { _id: 'k57f1nb000000000000000000000000', id: NB1_UUID, firmId: 'firm-1', userId: 'u-admin-1', name: 'Firm 1 notebook', title: 'Lead matter research' },
      { _id: 'k57f2nb000000000000000000000000', id: NB2_UUID, firmId: 'firm-2', userId: 'u-f2-admin', name: 'Firm 2 notebook', title: 'Competitor research' },
      { _id: 'k57legnb00000000000000000000000', id: NB_LEGACY_UUID, firmId: null, userId: 'u-admin-1', name: 'Legacy unbound notebook', title: 'pre-firm era' },
      // No client `id` field — resolvable ONLY by its Convex _id (exercises
      // the normalizeId + db.get fallback path).
      { _id: NB1_CONVEX_ONLY, firmId: 'firm-1', userId: 'u-admin-1', name: 'Convex-id-only notebook' },
    ],
    researchMessages: [
      { _id: 'rm-1', notebookId: NB1_UUID, firmId: 'firm-1', role: 'user', content: 'F1 research chat', createdAt: NOW },
      { _id: 'rm-2', notebookId: NB2_UUID, firmId: 'firm-2', role: 'user', content: 'F2 SECRET research chat', createdAt: NOW },
      { _id: 'rm-3', notebookId: NB1_CONVEX_ONLY, firmId: 'firm-1', role: 'user', content: 'F1 convex-keyed chat', createdAt: NOW },
    ],
    researchAnalysisResults: [
      { _id: 'ar-1', notebookId: NB1_UUID, firmId: 'firm-1', summary: 'F1 analysis', createdAt: NOW },
      { _id: 'ar-2', notebookId: NB2_UUID, firmId: 'firm-2', summary: 'F2 SECRET analysis', createdAt: NOW },
    ],
  };

  it('REJECTS a caller with no session (was: bare notebookId, cross-firm reads)', async () => {
    const { ctx } = makeCtx({ tables: researchTables });
    await expect(
      (getResearchMessages as any)._handler(ctx, { notebookId: NB1_UUID })
    ).rejects.toThrow(/Unauthenticated|sign in/i);
    await expect(
      (getResearchAnalysisResults as any)._handler(ctx, { notebookId: NB1_UUID })
    ).rejects.toThrow(/Unauthenticated|sign in/i);
  });

  it('REJECTS a staff caller from ANOTHER firm reading firm-1 notebooks', async () => {
    const { ctx } = makeCtx({ session: FIRM2_ADMIN_SESSION, user: FIRM2_ADMIN, tables: researchTables });
    await expect(
      (getResearchMessages as any)._handler(ctx, { notebookId: NB1_UUID, sessionToken: 'tok-f2-admin' })
    ).rejects.toThrow(/Not authorized|firm/i);
    await expect(
      (getResearchAnalysisResults as any)._handler(ctx, { notebookId: NB1_UUID, sessionToken: 'tok-f2-admin' })
    ).rejects.toThrow(/Not authorized|firm/i);
  });

  it('REJECTS a portal (Tenant) caller', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: researchTables });
    await expect(
      (getResearchMessages as any)._handler(ctx, { notebookId: NB1_UUID, sessionToken: 'tok-tenant-1' })
    ).rejects.toThrow(/Portal users do not have access/i);
  });

  it('returns [] for an unbound (legacy firmId=null) notebook — never a cross-firm leak', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: researchTables });
    const rows: any[] = await (getResearchMessages as any)._handler(ctx, { notebookId: NB_LEGACY_UUID, sessionToken: 'tok-admin-xyz' });
    expect(rows).toEqual([]);
  });

  it('returns [] for an unknown notebookId and for a missing notebookId', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: researchTables });
    expect(await (getResearchMessages as any)._handler(ctx, { notebookId: 'nb-does-not-exist', sessionToken: 'tok-admin-xyz' })).toEqual([]);
    expect(await (getResearchMessages as any)._handler(ctx, {})).toEqual([]);
    expect(await (getResearchAnalysisResults as any)._handler(ctx, {})).toEqual([]);
  });

  it('RETURNS own-firm rows for a legitimate staff caller — the workflow works', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: researchTables });
    const msgs: any[] = await (getResearchMessages as any)._handler(ctx, { notebookId: NB1_UUID, sessionToken: 'tok-admin-xyz' });
    expect(msgs.length).toBe(1);
    expect(msgs[0]._id).toBe('rm-1');
    expect(JSON.stringify(msgs)).not.toContain('F2 SECRET');
    const ars: any[] = await (getResearchAnalysisResults as any)._handler(ctx, { notebookId: NB1_UUID, sessionToken: 'tok-admin-xyz' });
    expect(ars.length).toBe(1);
    expect(ars[0]._id).toBe('ar-1');
  });

  // ── HOTFIX (2026-11-12) — the production Research crash regression tests ──
  // ResearchView passes selectedNotebook.id, which is the CLIENT uuid v4 the
  // notebook was created with (createItem keeps it in the `id` field;
  // documentState preserves it as nb.id). The old handler handed that UUID
  // straight to db.get(), which threw "Unable to decode ID: ID wasn't valid
  // base32" and took the whole Research view down with "Something went wrong".
  it('accepts a client-uuid-v4 notebookId (the production crash form) WITHOUT throwing, and resolves it by the id field', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: researchTables });
    const arbitraryUuid = '9c858661-3c12-4d0e-a3b2-71f6c1e84f11';
    // A uuid that matches NO notebook: [] — not a throw (this is the exact
    // production error surface: any fresh/optimistic notebook id).
    await expect(
      (getResearchMessages as any)._handler(ctx, { notebookId: arbitraryUuid, sessionToken: 'tok-admin-xyz' })
    ).resolves.toEqual([]);
    await expect(
      (getResearchAnalysisResults as any)._handler(ctx, { notebookId: arbitraryUuid, sessionToken: 'tok-admin-xyz' })
    ).resolves.toEqual([]);
    // A uuid that DOES match a notebook resolves via the by_custom_id index
    // and returns that notebook's messages.
    const msgs: any[] = await (getResearchMessages as any)._handler(ctx, { notebookId: NB1_UUID, sessionToken: 'tok-admin-xyz' });
    expect(msgs.map((m: any) => m._id)).toEqual(['rm-1']);
  });

  it('resolves a notebook passed by its CONVEX document id (the normalizeId fallback)', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: researchTables });
    const msgs: any[] = await (getResearchMessages as any)._handler(ctx, { notebookId: NB1_CONVEX_ONLY, sessionToken: 'tok-admin-xyz' });
    expect(msgs.map((m: any) => m._id)).toEqual(['rm-3']);
    // The convex fallback is still firm-bound: firm-2's admin gets rejected.
    const f2 = makeCtx({ session: FIRM2_ADMIN_SESSION, user: FIRM2_ADMIN, tables: researchTables });
    await expect(
      (getResearchMessages as any)._handler(f2.ctx, { notebookId: NB1_CONVEX_ONLY, sessionToken: 'tok-f2-admin' })
    ).rejects.toThrow(/Not authorized|firm/i);
  });

  it('ResearchView passes the session bearer to both research reads', () => {
    const src = read('src/components/ResearchView.tsx');
    for (const fn of ['getResearchMessages', 'getResearchAnalysisResults'] as const) {
      const at = src.indexOf(`api.myFunctions.${fn}`);
      expect(at).toBeGreaterThan(-1);
      const callSite = src.slice(at, at + 400);
      expect(callSite).toContain('sessionToken: bearerToken ?? undefined');
      expect(callSite).toContain('userEmail: currentUser?.email ?? undefined');
    }
    // the bearer is actually pulled from the auth context
    expect(src).toContain('const { currentUser, bearerToken } = useAuth()');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D8(a) — the spoofable census is gone
// ═══════════════════════════════════════════════════════════════════════════
describe('D8 — the spoofable census (findDuplicateEmails) is gone', () => {
  it('no export, no caller-supplied role gate, deletion record present', () => {
    const src = read('convex/myFunctions.ts');
    expect(src.includes('export const findDuplicateEmails')).toBe(false);
    // the spoofable gate's arg declaration is gone from code (the deletion
    // record's PROSE still names args.requesterRole — that is the point of a
    // record; no live declaration may remain).
    expect(src.includes('requesterRole:')).toBe(false);
    expect(src).toContain('ROUND D (D8) — DELETION RECORD');
    expect(src).toContain('SPOOFABLE CENSUS');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D8(b)+(d) — the twins-gone sweep: all 62 deleted publics, by module
// ═══════════════════════════════════════════════════════════════════════════
describe('D8 — the dead/dangerous orphan sweep (62 publics across 24 modules)', () => {
  const GONE: Record<string, string[]> = {
    'convex/myFunctions.ts': [
      'dumpAll', 'findDuplicateEmails', 'getFirmActivity', 'getResearchSourceContent',
      'checkIncompleteRegistration', 'removeUserFromFirm', 'removeFirmUserAndCleanup',
      'markMessagingNotificationsRead', 'deleteContactCascade', 'fixCorporateName',
    ],
    'convex/estateCommunity.ts': ['getBookingsForResident', 'getServiceProvider'],
    'convex/sentry.ts': [
      'getLedgerByFirm', 'getLedgerByUnit', 'updateLedgerStatus', 'getDefaulters',
      'getPipelineByUnit', 'getAuditTrail', 'getCommunicationsForPrint', 'checkSpamGuard',
      'setPropertyRemindersEnabled', 'setUnitRemindersMuted', 'unpauseReminders',
    ],
    'convex/securityHelpers.ts': ['getSecurityEvents'],
    'convex/ai.ts': ['extractContactInfo'],
    'convex/aiAudit.ts': ['listAiOutputLogs'],
    'convex/backups.ts': ['triggerBackupNow', 'getBackupStatus'],
    'convex/broadcasts.ts': ['getBroadcastHistory'],
    'convex/chargeTypes.ts': ['archiveChargeType'],
    'convex/conversationMemory.ts': ['getSummaries', 'getRecentContextSummaries'],
    'convex/drafting.ts': ['generateRentDemand'],
    'convex/feedback.ts': ['restoreFeedbackThread'],
    'convex/financialIntegrity.ts': ['bulkVoidLedgerEntries', 'markInvoiceAsTest', 'getLatestFinancialReconciliation'],
    'convex/founderMetrics.ts': [
      'triggerManualRefresh', 'recordFounderSignalSeen', 'cleanupDuplicateBroadcastNotifications',
      'globalSearch', 'setFeatureFlag', 'getFeatureFlags', 'getVisitorAnalytics',
    ],
    'convex/impersonation.ts': ['getMyImpersonationHistory'],
    'convex/legalKnowledge.ts': ['getCoverageManifest', 'getRecentChanges', 'getProvisionsForInstrument', 'getFormsForInstitution'],
    'convex/legalRepo.ts': ['getModulesByCategory', 'getStatutesByModule'],
    'convex/migrations.ts': ['reportUnlinkedServiceCharges', 'reportNotificationTimestamps'],
    'convex/observability.ts': ['getRecentErrorEvents'],
    'convex/portals.ts': ['completePortalTask', 'getPendingScheduledMessages', 'markPortalMessageRead', 'getPortalAccessToken'],
    'convex/queryMetrics.ts': ['getTableSizeHistory'],
    'convex/retainerBilling.ts': ['stageRetainerInvoiceManually'],
    'convex/trustAccount.ts': ['getTrustBalancesByMatter'],
  };

  it('every deleted name is gone from its module (export form), record present', () => {
    let checked = 0;
    for (const [mod, names] of Object.entries(GONE)) {
      const src = read(mod);
      for (const n of names) {
        expect(src.includes(`export const ${n} = `)).toBe(false);
        checked++;
      }
      expect(src).toContain('ROUND D (D8) — DELETION RECORD');
    }
    expect(checked).toBe(61);
  });

  it('the dead dumpAll probes are gone too (scripts/checkDB*.ts)', () => {
    expect(existsSync(resolvePath(repoRoot, 'scripts/checkDB.ts'))).toBe(false);
    expect(existsSync(resolvePath(repoRoot, 'scripts/checkDB2.ts'))).toBe(false);
    expect(existsSync(resolvePath(repoRoot, 'scripts/checkDB3.ts'))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D8 — the LIVE surfaces the sweep must NOT touch (still exported)
// ═══════════════════════════════════════════════════════════════════════════
describe('D8 — live surfaces intact (the deletions touched nothing wired)', () => {
  it('sentry keeps its wired reads (the Financials surface)', () => {
    const src = read('convex/sentry.ts');
    for (const n of ['getCashFlowSummary', 'getPipelineByFirm', 'getServiceChargesByFirm', 'getInboundMessages', 'collectRentPayment', 'settleUnitPeriods']) {
      expect(src.includes(`export const ${n} = `)).toBe(true);
    }
  });

  it('securityHelpers keeps the D4-wired response suite', () => {
    const src = read('convex/securityHelpers.ts');
    for (const n of ['blockIp', 'unblockIp', 'suspendUser', 'unsuspendUser', 'getSuspendedUsers', 'getBlockedIps', 'isIpBlocked']) {
      expect(src.includes(`export const ${n} = `)).toBe(true);
    }
  });

  it('estateCommunity keeps the R79-wired surface', () => {
    const src = read('convex/estateCommunity.ts');
    for (const n of ['getMyBookings', 'cancelMyBooking', 'getBookingsForFirm', 'getServiceProviders', 'reviewBooking', 'createBookingAsResident']) {
      expect(src.includes(`export const ${n} = `)).toBe(true);
    }
  });

  it('founderMetrics keeps the wired founder console; proactive keeps getInsights', () => {
    const fm = read('convex/founderMetrics.ts');
    for (const n of ['getSecurityEventsForAdmin', 'getAllPresenceForAdmin', 'approveSubscriptionRequestAsFounder']) {
      expect(fm.includes(`export const ${n} = `)).toBe(true);
    }
    expect(read('convex/proactive.ts').includes('export const getInsights = ')).toBe(true);
    expect(read('convex/conversationMemory.ts').includes('export const getInjectionContext = ')).toBe(true);
    expect(read('convex/myFunctions.ts').includes('export const getFirmData = ')).toBe(true);
    expect(read('convex/myFunctions.ts').includes('export const getNotePage = ')).toBe(true);
    expect(read('convex/myFunctions.ts').includes('export const getDocumentContent = ')).toBe(true);
  });

  it('legalRepo keeps getStatuteById — the near-miss the convex tsc gate caught', () => {
    // getStatuteById was on the initial deletion list, then RESTORED: it is a
    // live internal dependency of searchStatutes (same-file api.legalRepo
    // self-reference, invisible to an outside-file caller scan). The tsc gate
    // caught it; the deletion record in convex/legalRepo.ts documents it.
    const src = read('convex/legalRepo.ts');
    expect(src.includes('export const getStatuteById = ')).toBe(true);
    expect(src.includes('api.legalRepo.getStatuteById')).toBe(true);
  });
});
