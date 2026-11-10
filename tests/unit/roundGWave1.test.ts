/**
 * roundGWave1.test.ts — ROUND G (Wave G1) regression tests.
 *
 * G1 gave ARIA the REAL books: the `query_financials` chat tool backed
 * by Round F's money-truth server reads (getFinancialOverview,
 * getFinancialReports, getResidentBill). Contracts pinned in BOTH
 * directions:
 *   • the BROKEN behaviour is impossible (no report runs without the
 *     auth triple; an unknown report throws instead of inventing data;
 *     resident_bill without a unitId instructs the model to resolve the
 *     unit — it never guesses a bill; every result carries the
 *     anti-fabrication grounding note),
 *   • the legitimate paths dispatch to the right server read with the
 *     right slice (overview → getFinancialOverview; the six report keys
 *     → getFinancialReports' matching slice; resident_bill with identity
 *     keys → getResidentBill with the full union).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ARIA_FINANCIAL_REPORTS,
  ARIA_FINANCIAL_GROUNDING_NOTE,
  isAriaFinancialReport,
  runAriaFinancialQuery,
  describeAriaFinancialQuery,
} from '../../src/utils/ariaFinancials';
import { tools } from '../../src/services/geminiService';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fake backend reads ──────────────────────────────────────────────────────
const AUTH = { firmId: 'firm-1', sessionToken: 'tok-live', userEmail: 'ada@example.com' };

function makeDeps() {
  return {
    getFinancialOverview: vi.fn(async (args: any) => {
        // The auth triple MUST be forwarded — a query without it is a
        // rejected query on the real backend.
        if (args.firmId !== AUTH.firmId || args.sessionToken !== AUTH.sessionToken || args.userEmail !== AUTH.userEmail) {
            throw new Error('UNAUTHORIZED');
        }
        return { cashFlow: { totalIncome: '₦1,250,000.00' }, serviceCharges: { defaulters: 2 } };
    }),
    getFinancialReports: vi.fn(async (args: any) => {
        if (args.firmId !== AUTH.firmId || args.sessionToken !== AUTH.sessionToken || args.userEmail !== AUTH.userEmail) {
            throw new Error('UNAUTHORIZED');
        }
        return {
            rentRoll: { rows: [{ address: '12 Admiralty Way' }] },
            arrearsAging: { buckets: [{ label: '0-30', outstanding: '₦450,000.00', count: 3 }] },
            scCollections: { byCategory: [] },
            revenueByType: { months: [] },
            paymentHistory: { rows: [] },
            periodComparison: { current: { income: '₦500,000.00' }, previous: { income: '₦400,000.00' }, delta: { income: '₦100,000.00' } },
            proof: { clearedTotal: '₦1,250,000.00' },
        };
    }),
    getResidentBill: vi.fn(async (args: any) => {
        if (!args.unitId) throw new Error('unitId required');
        return { openingBalance: '₦50,000.00', endingBalance: '₦155,000.00', endingNote: 'due' };
    }),
  };
}

// ── The dispatch ────────────────────────────────────────────────────────────
describe('roundG wave1 — runAriaFinancialQuery dispatch', () => {
  it('overview reads getFinancialOverview with the auth triple', async () => {
    const deps = makeDeps();
    const res = await runAriaFinancialQuery({ report: 'overview' }, AUTH, deps);
    expect(deps.getFinancialOverview).toHaveBeenCalledTimes(1);
    expect(deps.getFinancialReports).not.toHaveBeenCalled();
    expect(deps.getResidentBill).not.toHaveBeenCalled();
    expect(res.report).toBe('overview');
    expect((res.data as any).cashFlow.totalIncome).toBe('₦1,250,000.00');
    expect(res.note).toBe(ARIA_FINANCIAL_GROUNDING_NOTE);
  });

  it.each([
    ['rent_roll', 'rentRoll'],
    ['arrears_aging', 'arrearsAging'],
    ['collections', 'scCollections'],
    ['revenue_by_type', 'revenueByType'],
    ['payment_history', 'paymentHistory'],
    ['period_comparison', 'periodComparison'],
  ] as const)('%s returns the matching getFinancialReports slice — and ONLY that slice', async (report, key) => {
    const deps = makeDeps();
    const res = await runAriaFinancialQuery({ report }, AUTH, deps);
    expect(deps.getFinancialReports).toHaveBeenCalledTimes(1);
    expect(deps.getFinancialOverview).not.toHaveBeenCalled();
    // Compare against the same authed call the dispatch made.
    const all = (await deps.getFinancialReports({
      firmId: AUTH.firmId, sessionToken: AUTH.sessionToken, userEmail: AUTH.userEmail,
    })) as Record<string, unknown>;
    expect(res.data).toEqual(all[key]);
    expect(res.note).toBe(ARIA_FINANCIAL_GROUNDING_NOTE);
  });

  it('resident_bill without unitId instructs the model to resolve the unit — and NEVER calls the bill read', async () => {
    const deps = makeDeps();
    const res = await runAriaFinancialQuery({ report: 'resident_bill' }, AUTH, deps);
    expect(deps.getResidentBill).not.toHaveBeenCalled();
    expect(res.data).toBeNull();
    expect(res.note).toContain("category='properties'");
    expect(res.note).toContain('NEVER invent');
  });

  it('resident_bill with unitId + identity keys forwards the full union', async () => {
    const deps = makeDeps();
    const res = await runAriaFinancialQuery(
      { report: 'resident_bill', unitId: 'unit-b2', tenantContactId: 'c-9', tenantEmail: 't@x.ng' },
      AUTH,
      deps,
    );
    expect(deps.getResidentBill).toHaveBeenCalledWith(expect.objectContaining({
      firmId: AUTH.firmId,
      sessionToken: AUTH.sessionToken,
      userEmail: AUTH.userEmail,
      unitId: 'unit-b2',
      tenantContactId: 'c-9',
      tenantEmail: 't@x.ng',
    }));
    expect((res.data as any).endingBalance).toBe('₦155,000.00');
  });

  it('an unknown report throws — it never fabricates a report', async () => {
    const deps = makeDeps();
    await expect(
      runAriaFinancialQuery({ report: 'made_up_report' as any }, AUTH, deps),
    ).rejects.toThrow(/Unknown financial report/);
    expect(deps.getFinancialOverview).not.toHaveBeenCalled();
  });

  it('every report name in the enum is a real dispatch (no dead enum entry)', () => {
    for (const r of ARIA_FINANCIAL_REPORTS) expect(isAriaFinancialReport(r)).toBe(true);
    expect(isAriaFinancialReport('nope')).toBe(false);
  });

  it('auth is forwarded on EVERY path — a missing session fails the read', async () => {
    const deps = makeDeps();
    await expect(
      runAriaFinancialQuery({ report: 'overview' }, { firmId: 'firm-1' }, deps),
    ).rejects.toThrow('UNAUTHORIZED');
  });

  it('describeAriaFinancialQuery yields a human string for every report', () => {
    for (const r of ARIA_FINANCIAL_REPORTS) {
      expect(describeAriaFinancialQuery({ report: r }).length).toBeGreaterThan(3);
    }
  });
});

// ── Tool declaration + wiring + prompt contracts ───────────────────────────
describe('roundG wave1 — tool declaration, wiring and prompt contracts', () => {
  it('the chat tool registry declares query_financials with the full report enum', () => {
    const decl = tools.find(t => t.name === 'query_financials');
    expect(decl).toBeTruthy();
    const reportProp = (decl!.parameters as any).properties.report;
    expect(reportProp.enum.sort()).toEqual([...ARIA_FINANCIAL_REPORTS].sort());
    expect((decl!.parameters as any).required).toContain('report');
    // The declaration itself carries the anti-fabrication rule.
    expect(decl!.description).toContain('never compute, estimate or recall amounts yourself');
  });

  it('AloaChat wires query_financials to the REAL convex reads with the auth triple', () => {
    const src = read('src/components/aloa/AloaChat.tsx');
    const branch = src.indexOf("name === 'query_financials'");
    expect(branch).toBeGreaterThan(0);
    expect(src).toContain("api.financialReporting.getFinancialOverview");
    expect(src).toContain("api.financialReporting.getFinancialReports");
    expect(src).toContain("api.tenancyLifecycle.getResidentBill");
    // The dispatch goes through the tested module — no inline re-implementation.
    expect(src).toContain('runAriaFinancialQuery(');
    // Guarded: an invalid report name is refused before any read runs.
    expect(src).toContain('isAriaFinancialReport(args?.report)');
  });

  it('the ARIA identity prompt teaches the money-figures rule (roster = terms, tool = balances)', () => {
    const prompt = read('ai/prompts/02-aria-property-identity.md');
    expect(prompt).toContain('query_financials');
    expect(prompt).toContain('MONEY FIGURES COME FROM `query_financials` — NOWHERE ELSE');
    expect(prompt).toContain('not live balances');
  });
});
