/**
 * roundGWave3.test.ts — ROUND G (Wave G3) regression tests.
 *
 * G3 extended the proactive engine to the property portfolio: lease
 * expiry escalation (60/30/expired) and money waiting in the Round F
 * reconciliation queues (weekly cadence). Contracts pinned in BOTH
 * directions:
 *   • the pure window/week classifiers are exact (no insight for a lease
 *     90 days out; no off-by-one at the 30/60 boundaries),
 *   • the scan through the REAL handler creates the right insights with
 *     the right severities, deduplicates on re-run, honours both unit
 *     storage shapes + the legacy single-unit shape, and mirrors the
 *     F2 queue semantics exactly (settled = approved OR verified;
 *     linked/matched proofs are NOT waiting).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  leaseExpiryWindow,
  isoWeekKey,
  scanPropertyPortfolio,
} from '../../convex/proactive';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

const DAY = 86400000;

// ── Pure classifiers ────────────────────────────────────────────────────────
describe('roundG wave3 — leaseExpiryWindow', () => {
  it('classifies expired / 30 / 60 / far-future exactly', () => {
    const now = Date.now();
    expect(leaseExpiryWindow(new Date(now - 5 * DAY).toISOString(), now)).toBe('expired');
    expect(leaseExpiryWindow(new Date(now + 15 * DAY).toISOString(), now)).toBe('critical30');
    expect(leaseExpiryWindow(new Date(now + 30 * DAY).toISOString(), now)).toBe('critical30'); // boundary inclusive
    expect(leaseExpiryWindow(new Date(now + 31 * DAY).toISOString(), now)).toBe('warning60');
    expect(leaseExpiryWindow(new Date(now + 60 * DAY).toISOString(), now)).toBe('warning60'); // boundary inclusive
    expect(leaseExpiryWindow(new Date(now + 61 * DAY).toISOString(), now)).toBeNull();
    expect(leaseExpiryWindow(new Date(now + 400 * DAY).toISOString(), now)).toBeNull();
  });

  it('refuses junk — never invents a window', () => {
    const now = Date.now();
    expect(leaseExpiryWindow(undefined, now)).toBeNull();
    expect(leaseExpiryWindow(null, now)).toBeNull();
    expect(leaseExpiryWindow('', now)).toBeNull();
    expect(leaseExpiryWindow('not-a-date', now)).toBeNull();
    expect(leaseExpiryWindow(12345, now)).toBeNull(); // numbers are not accepted
  });
});

describe('roundG wave3 — isoWeekKey', () => {
  it('returns the ISO-8601 week for known dates', () => {
    expect(isoWeekKey(Date.UTC(2026, 0, 1))).toBe('2026-W01');   // Thursday
    expect(isoWeekKey(Date.UTC(2026, 10, 11))).toBe('2026-W46'); // a Wednesday
  });

  it('is stable across the week it names (Monday and Sunday agree)', () => {
    const monday = Date.UTC(2026, 10, 9);  // Mon 2026-11-09
    const sunday = Date.UTC(2026, 10, 15); // Sun 2026-11-15
    expect(isoWeekKey(monday)).toBe(isoWeekKey(sunday));
  });
});

// ── Fixture-backed mock ctx (Round A/B/F harness pattern) ───────────────────
type Row = Record<string, any>;

function makeCtx(tables: Record<string, Row[]>) {
  const CMP: Record<string, (a: any, b: any) => boolean> = {
    eq: (a, b) => String(a) === String(b),
  };
  const findRows = (table: string, conds: Array<[string, string, any]>) =>
    (tables[table] ?? []).filter((r) => conds.every(([f, op, v]) => r[f] !== undefined && CMP[op](r[f], v)));

  const chainFor = (rows: Row[]) => {
    const chain: any = {
      first: async () => rows[0] ?? null,
      unique: async () => rows[0] ?? null,
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
        const q: any = { eq: (field: string, value: any) => { conds.push([field, 'eq', value]); return q; } };
        fn(q);
        return chainFor(findRows(table, conds));
      },
      filter: (_fn: any) => chainFor(tables[table] ?? []),
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
    patch: async () => null,
    delete: async () => null,
  };

  return { ctx: { db, runMutation: vi.fn(), runAction: vi.fn(), runQuery: vi.fn(), scheduler: { runAfter: vi.fn() }, auth: { getUserIdentity: async () => null } }, tables };
}

const NOW = Date.now();
const iso = (daysFromNow: number) => new Date(NOW + daysFromNow * DAY).toISOString();

function baseTables(): Record<string, Row[]> {
  return {
    firms: [{ _id: 'firm-1', name: 'Atrium Co' }],
    proactive_insights: [],
    properties: [],
    payment_proofs: [],
    reconciliation_matches: [],
    service_charges: [],
  };
}

// ── The scan through the REAL handler ───────────────────────────────────────
describe('roundG wave3 — scanPropertyPortfolio (lease expiry)', () => {
  it('a lease ending in 15 days creates a CRITICAL insight with the unit and tenant named', async () => {
    const { ctx, tables } = makeCtx({
      ...baseTables(),
      properties: [{
        _id: 'prop-1', firmId: 'firm-1', address: '12 Admiralty Way, Lekki',
        units: [{ id: 'unit-1', unitName: 'Flat B2', rentalDetails: { leaseEnd: iso(15), tenantName: 'Adaeze Okafor' } }],
      }],
    });
    const res = await (scanPropertyPortfolio as any)._handler(ctx, {});
    expect(res.created).toBe(1);
    const insight = tables.proactive_insights[0]!;
    expect(insight.category).toBe('property');
    expect(insight.severity).toBe('critical');
    expect(insight.title).toContain('Flat B2');
    expect(insight.title).toContain('Adaeze Okafor');
    expect(insight.body).toContain('12 Admiralty Way');
    expect(insight.entityType).toBe('property');
    expect(insight.dismissed).toBe(false);
  });

  it('a lease ending in 45 days is a warning; 90 days out creates NOTHING', async () => {
    const far = makeCtx({
      ...baseTables(),
      properties: [{ _id: 'prop-far', firmId: 'firm-1', address: 'Far House', units: [{ id: 'u-far', unitName: 'Unit 1', rentalDetails: { leaseEnd: iso(90) } }] }],
    });
    expect((await (scanPropertyPortfolio as any)._handler(far.ctx, {})).created).toBe(0);
    expect(far.tables.proactive_insights).toHaveLength(0);

    const near = makeCtx({
      ...baseTables(),
      properties: [{ _id: 'prop-near', firmId: 'firm-1', address: 'Near House', units: [{ id: 'u-near', unitName: 'Unit 1', rentalDetails: { leaseEnd: iso(45) } }] }],
    });
    expect((await (scanPropertyPortfolio as any)._handler(near.ctx, {})).created).toBe(1);
    expect(near.tables.proactive_insights[0]!.severity).toBe('warning');
  });

  it('an ALREADY-EXPIRED lease is critical and says the lease has ended', async () => {
    const { ctx, tables } = makeCtx({
      ...baseTables(),
      properties: [{ _id: 'prop-x', firmId: 'firm-1', address: 'Old House', units: [{ id: 'u-x', unitName: 'Shop 3', rentalDetails: { leaseEnd: iso(-10) } }] }],
    });
    await (scanPropertyPortfolio as any)._handler(ctx, {});
    const insight = tables.proactive_insights[0]!;
    expect(insight.severity).toBe('critical');
    expect(insight.title).toContain('Lease Expired');
  });

  it('the LEGACY single-unit property shape (rentalDetails on the property row) is covered', async () => {
    const { ctx, tables } = makeCtx({
      ...baseTables(),
      properties: [{ _id: 'prop-legacy', firmId: 'firm-1', address: '4 Marina Road', rentalDetails: { leaseEnd: iso(20), tenantName: 'Chidi' } }],
    });
    expect((await (scanPropertyPortfolio as any)._handler(ctx, {})).created).toBe(1);
    expect(tables.proactive_insights[0]!.title).toContain('4 Marina Road');
  });

  it('the BARE unit shape (leaseEnd directly on the unit, no rentalDetails) is covered', async () => {
    const { ctx, tables } = makeCtx({
      ...baseTables(),
      properties: [{ _id: 'prop-bare', firmId: 'firm-1', address: '9 Bishop Aboyade', units: [{ id: 'u-bare', unitName: 'Unit 5', leaseEnd: iso(25) }] }],
    });
    expect((await (scanPropertyPortfolio as any)._handler(ctx, {})).created).toBe(1);
  });

  it('re-running the scan the same month does NOT duplicate the insight (dedup)', async () => {
    const tables: Record<string, Row[]> = {
      ...baseTables(),
      properties: [{ _id: 'prop-1', firmId: 'firm-1', address: '12 Admiralty Way', units: [{ id: 'unit-1', unitName: 'Flat B2', rentalDetails: { leaseEnd: iso(15) } }] }],
    };
    const { ctx } = makeCtx(tables);
    const first = await (scanPropertyPortfolio as any)._handler(ctx, {});
    expect(first.created).toBe(1);
    const second = await (scanPropertyPortfolio as any)._handler(ctx, {});
    expect(second.created).toBe(0);
    expect(tables.proactive_insights).toHaveLength(1);
  });

  it('insights are FIRM-SCOPED — another firm\'s property never leaks in', async () => {
    const { ctx, tables } = makeCtx({
      ...baseTables(),
      firms: [{ _id: 'firm-1' }, { _id: 'firm-2' }],
      properties: [
        { _id: 'prop-mine', firmId: 'firm-1', address: 'Mine', units: [{ id: 'u1', unitName: 'A', rentalDetails: { leaseEnd: iso(15) } }] },
        { _id: 'prop-theirs', firmId: 'firm-2', address: 'Theirs', units: [{ id: 'u2', unitName: 'B', rentalDetails: { leaseEnd: iso(15) } }] },
      ],
    });
    await (scanPropertyPortfolio as any)._handler(ctx, {});
    // Both firms get THEIR OWN insight (the scan iterates all firms) — but
    // each insight is stamped with its own firm and references its own entity.
    const byFirm = new Map(tables.proactive_insights.map((i) => [i.firmId, i]));
    expect(byFirm.size).toBe(2);
    expect(String(byFirm.get('firm-1')!.entityId)).toBe('prop-mine');
    expect(String(byFirm.get('firm-2')!.entityId)).toBe('prop-theirs');
    expect(tables.proactive_insights.every((i) => i.title.includes(i.firmId === 'firm-1' ? 'Mine' : 'Theirs'))).toBe(true);
  });
});

describe('roundG wave3 — scanPropertyPortfolio (money waiting)', () => {
  it('a settled UNMATCHED proof + a charge with credit → ONE warning insight naming both queues', async () => {
    const { ctx, tables } = makeCtx({
      ...baseTables(),
      payment_proofs: [
        { _id: 'proof-1', firmId: 'firm-1', status: 'approved', amount: 250000 },        // waiting
        { _id: 'proof-2', firmId: 'firm-1', status: 'verified', amount: 100000 },        // waiting (verified IS settled)
        { _id: 'proof-3', firmId: 'firm-1', status: 'approved', amount: 50000, linkedChargeId: 'c1' }, // tied — NOT waiting
        { _id: 'proof-4', firmId: 'firm-1', status: 'pending_review', amount: 75000 },   // not settled — NOT waiting
      ],
      reconciliation_matches: [
        { _id: 'm-1', firmId: 'firm-1', proofId: 'proof-5', status: 'active' },
      ],
      payment_proofs_extra: [],
      service_charges: [{ _id: 'c-9', firmId: 'firm-1', creditCarriedForward: 5000 }],
    });
    // proof-5 needs to exist with settled status + money but an ACTIVE match → not waiting.
    tables.payment_proofs.push({ _id: 'proof-5', firmId: 'firm-1', status: 'approved', amount: 80000 });

    const res = await (scanPropertyPortfolio as any)._handler(ctx, {});
    expect(res.created).toBe(1);
    const insight = tables.proactive_insights.find((i) => i.dedupKey.startsWith('property|unallocated|'))!;
    expect(insight).toBeTruthy();
    expect(insight.severity).toBe('warning');
    expect(insight.title).toContain('2 payment(s)');   // proof-1 + proof-2 only
    expect(insight.title).toContain('1 credit(s)');    // c-9 only
    expect(insight.body).toContain('Reconcile');
  });

  it('a reversed match re-opens the proof (it counts as waiting again)', async () => {
    const { ctx, tables } = makeCtx({
      ...baseTables(),
      payment_proofs: [{ _id: 'proof-r', firmId: 'firm-1', status: 'approved', amount: 60000 }],
      reconciliation_matches: [{ _id: 'm-r', firmId: 'firm-1', proofId: 'proof-r', status: 'reversed' }],
      service_charges: [],
    });
    await (scanPropertyPortfolio as any)._handler(ctx, {});
    const insight = tables.proactive_insights.find((i) => i.dedupKey.startsWith('property|unallocated|'))!;
    expect(insight).toBeTruthy();
    expect(insight.title).toContain('1 payment(s)');
  });

  it('clean books → no unallocated insight at all', async () => {
    const { ctx, tables } = makeCtx({
      ...baseTables(),
      payment_proofs: [{ _id: 'proof-ok', firmId: 'firm-1', status: 'approved', amount: 50000, linkedChargeId: 'c1' }],
      service_charges: [{ _id: 'c-ok', firmId: 'firm-1', creditCarriedForward: 0 }],
    });
    await (scanPropertyPortfolio as any)._handler(ctx, {});
    expect(tables.proactive_insights.filter((i) => i.dedupKey.startsWith('property|unallocated|'))).toHaveLength(0);
  });

  it('weekly dedup — re-running in the SAME week creates nothing new', async () => {
    const tables: Record<string, Row[]> = {
      ...baseTables(),
      payment_proofs: [{ _id: 'proof-w', firmId: 'firm-1', status: 'approved', amount: 90000 }],
      service_charges: [],
    };
    const { ctx } = makeCtx(tables);
    expect((await (scanPropertyPortfolio as any)._handler(ctx, {})).created).toBe(1);
    expect((await (scanPropertyPortfolio as any)._handler(ctx, {})).created).toBe(0);
    expect(tables.proactive_insights).toHaveLength(1);
  });
});

// ── Source contracts ────────────────────────────────────────────────────────
describe('roundG wave3 — wiring contracts', () => {
  it('the cron is registered daily at 06:05 UTC, between detectAnomalies and the briefing', () => {
    const crons = read('convex/crons.ts');
    const scanPos = crons.indexOf('scanPropertyPortfolio');
    expect(scanPos).toBeGreaterThan(-1);
    expect(crons).toContain('hourUTC: 6, minuteUTC: 5');
    // Ordering: after detectAnomalies, before generateMorningBriefing.
    expect(crons.indexOf('detectAnomalies')).toBeLessThan(scanPos);
    expect(scanPos).toBeLessThan(crons.indexOf('generateMorningBriefing'));
  });

  it('the scan mirrors the F2 queue semantics exactly (settled = approved OR verified)', () => {
    const src = read('convex/proactive.ts');
    const scan = src.slice(src.indexOf('scanPropertyPortfolio'));
    expect(scan).toContain('"approved" || String(p.status ?? "") === "verified"');
    expect(scan).toContain('linkedChargeId');
    expect(scan).toContain('"active"');
    expect(scan).toContain('creditCarriedForward');
  });

  it('the scan mutates NOTHING except proactive_insights (read-only scan + insert)', () => {
    const src = read('convex/proactive.ts');
    const scan = src.slice(src.indexOf('scanPropertyPortfolio'));
    const body = scan.slice(scan.indexOf('handler:'));
    expect(body).toContain('db.insert("proactive_insights"');
    expect(body).not.toContain('db.patch(');
    expect(body).not.toContain('db.delete(');
    expect(body).not.toContain('db.replace(');
  });
});
