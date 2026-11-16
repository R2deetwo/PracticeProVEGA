/**
 * roundR3TruthAlignment — R3 of the discovery report's roadmap.
 *
 * R3.1: getIndexStatus tells the truth — an EMPTY corpus is NOT "ready".
 * R3.2: the eviction countdown computes exactly the framework the UI
 *       footnote advertises (weekly 1 week · monthly 1 month ·
 *       quarterly 3 months · yearly 6 months), state-aware via the
 *       property address.
 * R3.3: marketing/onboarding copy no longer claims statute verification
 *       that the live path does not perform — source-contract pins (the
 *       persistenceRegression pattern).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { dirname, resolve as resolvePath } from 'path';
import { fileURLToPath } from 'url';

import { getIndexStatus } from '../../convex/legalKnowledge';
import {
    noticeToQuitPeriod,
    resolveTenancyPeriod,
    extractNigerianState,
    noticePeriodForUnit,
} from '../../src/utils/tenancyNoticePeriods';
import {
    getNoticePeriod,
    getNoticePeriodEndDate,
    getNoticePeriodMonths,
} from '../../src/components/details/units/evictionTracker';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../src/components/App.tsx'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

// ─── R3.2: the framework normalizer ────────────────────────────────────────
describe('R3.2 — resolveTenancyPeriod: free-text frequencies → framework periods', () => {
    it('maps the app’s own rentFrequency values', () => {
        expect(resolveTenancyPeriod('Annually')).toBe('yearly');
        expect(resolveTenancyPeriod('Bi-Annually')).toBe('quarterly'); // half-year → quarter’s notice
        expect(resolveTenancyPeriod('Quarterly')).toBe('quarterly');
        expect(resolveTenancyPeriod('Monthly')).toBe('monthly');
    });

    it('maps the free-text forms the units console sees', () => {
        expect(resolveTenancyPeriod('weekly')).toBe('weekly');
        expect(resolveTenancyPeriod('Yearly')).toBe('yearly');
        expect(resolveTenancyPeriod('6-month')).toBe('quarterly');
        expect(resolveTenancyPeriod(undefined)).toBe('yearly'); // the old default, preserved
        expect(resolveTenancyPeriod('')).toBe('yearly');
    });
});

// ─── R3.2: state extraction from a free-text address ───────────────────────
describe('R3.2 — extractNigerianState: property address → state', () => {
    it('pulls the state out of real-shaped addresses', () => {
        expect(extractNigerianState('No. 20 Westsyde Drive, Ogombo, Ajah, Lagos State')).toBe('Lagos');
        expect(extractNigerianState('12 Court Road,GRA, Phase 2, Port Harcourt, Rivers')).toBe('Rivers');
        expect(extractNigerianState('Plot 45, Central Business District, FCT Abuja')).toBe('FCT');
    });

    it('returns empty for unknown/blank addresses (general framework applies)', () => {
        expect(extractNigerianState('')).toBe('');
        expect(extractNigerianState(undefined)).toBe('');
        expect(extractNigerianState('1 High Street, London')).toBe('');
    });
});

// ─── R3.2: the eviction countdown == the advertised framework ──────────────
describe('R3.2 — evictionTracker delegates to the encoded framework', () => {
    it('computes exactly what the AtriumAI footnote advertises', () => {
        // "weekly 1 week, monthly 1 month, quarterly 3 months, yearly 6 months"
        expect(getNoticePeriod('weekly').days).toBe(7);
        expect(getNoticePeriod('Monthly').days).toBe(30);
        expect(getNoticePeriod('Quarterly').days).toBe(91);
        expect(getNoticePeriod('Annually').days).toBe(182);
    });

    it('the weekly case no longer falls through to a 6-month default (the audited bug)', () => {
        // OLD behaviour: weekly hit the default branch → 6 months.
        // NEW: 7 days, in DAYS — the countdown math keeps unit fidelity.
        const { endDate, period } = getNoticePeriodEndDate(0, 'weekly', 'Ogun');
        expect(period.days).toBe(7);
        expect(endDate).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('quarterly computes 3 months (91 days), not the old divergent 1 month', () => {
        const { endDate, period } = getNoticePeriodEndDate(0, 'Quarterly', 'Rivers');
        expect(period.days).toBe(91);
        expect(endDate).toBe(91 * 24 * 60 * 60 * 1000);
    });

    it('Lagos cites its encoded statute; other states carry the verification flag', () => {
        const lagos = getNoticePeriod('Annually', 'No. 20 Westsyde Drive, Ogombo, Ajah, Lagos State');
        expect(lagos.basis).toBe('lagos_tenancy_law_2011');
        expect(lagos.verifyStateStatute).toBe(false);
        const ogun = getNoticePeriod('Annually', '5 Quarry Road, Abeokuta, Ogun State');
        expect(ogun.basis).toBe('general framework');
        expect(ogun.verifyStateStatute).toBe(true);
        expect(ogun.state).toBe('Ogun');
    });

    it('the deprecated months shim reports the framework months (quarterly fixed 1 → 3)', () => {
        expect(getNoticePeriodMonths('Quarterly')).toBe(3);
        expect(getNoticePeriodMonths('Monthly')).toBe(1);
        expect(getNoticePeriodMonths('Annually')).toBe(6);
        expect(getNoticePeriodMonths('weekly')).toBe(0); // weekly is days-only — callers must use getNoticePeriod
    });

    it('the framework util itself is unchanged (scaleAndTenancy pins it too)', () => {
        expect(noticeToQuitPeriod('Ogun', 'weekly').days).toBe(7);
        expect(noticePeriodForUnit('Lagos', 'Monthly').basis).toBe('lagos_tenancy_law_2011');
    });
});

// ─── R3.1: index-status truth ──────────────────────────────────────────────
describe('R3.1 — getIndexStatus: an empty corpus is NOT ready', () => {
    type Row = Record<string, any>;
    const makeCtx = (provisions: Row[], forms: Row[]) => {
        const chain = (rows: Row[]) => ({ take: async () => rows });
        return {
            db: {
                query: (table: string) => ({
                    withIndex: (_name: string, fn?: (q: any) => any) => {
                        if (fn) {
                            const conds: Array<[string, any]> = [];
                            const q: any = { eq: (f: string, v: any) => { conds.push([f, v]); return q; } };
                            fn(q);
                            const rows = (table === 'instrument_provisions' ? provisions : forms)
                                .filter((r) => conds.every(([f, v]) => String(r[f]) === String(v)));
                            return chain(rows);
                        }
                        return chain(table === 'instrument_provisions' ? provisions : forms);
                    },
                }),
            },
        } as any;
    };
    const call = (fn: any, ctx: any, args: any) => (fn as any)._handler(ctx, args);

    it('EMPTY corpus: hasCorpus false, ready FALSE (the audited truth bug)', async () => {
        const status = await call(getIndexStatus, makeCtx([], []), {});
        expect(status.hasCorpus).toBe(false);
        expect(status.ready).toBe(false); // was true before the fix — "nothing to embed" ≠ "knowledge ready"
        expect(status.pendingProvisions).toBe(0);
        expect(status.totalProvisions).toBe(0);
    });

    it('SEEDED but unindexed: hasCorpus true, ready false, pending counted', async () => {
        const provisions = [
            { _id: 'p1', embedded: false },
            { _id: 'p2', embedded: false },
        ];
        const forms = [{ _id: 'f1', embedded: false }];
        const status = await call(getIndexStatus, makeCtx(provisions, forms), {});
        expect(status.hasCorpus).toBe(true);
        expect(status.ready).toBe(false);
        expect(status.pendingProvisions).toBe(2);
        expect(status.pendingForms).toBe(1);
        expect(status.totalProvisions).toBe(2);
    });

    it('SEEDED and fully indexed: ready true with the totals the UI shows', async () => {
        const provisions = [
            { _id: 'p1', embedded: true },
            { _id: 'p2', embedded: true },
        ];
        const forms = [{ _id: 'f1', embedded: true }];
        const status = await call(getIndexStatus, makeCtx(provisions, forms), {});
        expect(status.hasCorpus).toBe(true);
        expect(status.ready).toBe(true);
        expect(status.pendingProvisions).toBe(0);
        expect(status.totalProvisions).toBe(2);
    });

    it('partial progress reports both counts honestly', async () => {
        const provisions = [
            { _id: 'p1', embedded: true },
            { _id: 'p2', embedded: false },
        ];
        const status = await call(getIndexStatus, makeCtx(provisions, []), {});
        expect(status.hasCorpus).toBe(true);
        expect(status.ready).toBe(false);
        expect(status.pendingProvisions).toBe(1);
        expect(status.totalProvisions).toBe(2);
    });
});

// ─── R3.3: the over-claiming copy is gone ──────────────────────────────────
describe('R3.3 — marketing/onboarding copy matches the honest contract', () => {
    it('AtriumAI no longer claims live statute verification', () => {
        const src = read('src/sites/atrium/sections/AtriumAI.tsx');
        expect(src).not.toMatch(/ARIA verifies the current statute/i);
        expect(src).toMatch(/flags the notice for verification/i);
        // The advertised framework numbers stay (the code now computes them):
        expect(src).toContain('weekly 1 week, monthly 1 month, quarterly 3 months, yearly 6 months');
    });

    it('AtriumWhyRunOn no longer claims "verified against the current statute before a quit notice is drafted"', () => {
        const src = read('src/sites/atrium/sections/AtriumWhyRunOn.tsx');
        expect(src).not.toMatch(/verified against the current statute/i);
        expect(src).toMatch(/verification flag/i);
    });

    it('AtriumFAQ states the Lagos corpus + verification-flag boundary', () => {
        const src = read('src/sites/atrium/sections/AtriumFAQ.tsx');
        expect(src).not.toMatch(/ARIA verifying the current statute/i);
        expect(src).toMatch(/verification flag against the current state statute/i);
    });

    it('VegaWhyNigeria describes the deterministic gate + UNVERIFIABLE citation contract, not a statute-audit claim', () => {
        const src = read('src/sites/vega/sections/VegaWhyNigeria.tsx');
        expect(src).not.toMatch(/Statutory audits with exact section citations/);
        expect(src).toMatch(/jurisdiction routing, limitation periods, frontloading and signature requirements/i);
        expect(src).toMatch(/unverifiable/i);
    });

    it('the onboarding tour no longer promises Nigerian case-law search', () => {
        const src = read('src/onboardingConfig.ts');
        expect(src).not.toMatch(/find Nigerian case law/i);
        expect(src).toMatch(/honest about which sources it has/i);
    });
});
