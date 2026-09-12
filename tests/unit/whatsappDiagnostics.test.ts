/**
 * WhatsApp live diagnostics — unit tests for the pure helpers.
 *
 * Task 37: the liveSendDiagnostic internal action is exercised against
 * production by the "WhatsApp Live Test" GitHub workflow; here we lock in
 * the pure variable-building logic so a template with N placeholders
 * always receives N non-empty values (Meta rejects count mismatches and
 * empty strings with param errors).
 */
import { describe, it, expect } from 'vitest';
import { buildTestVars } from '../../convex/whatsappDiagnostics';

describe('buildTestVars — Meta-safe test variable construction', () => {
  it('fills exactly N slots with non-empty strings (count parity is what Meta validates)', () => {
    const vars = buildTestVars(3, null);
    expect(vars).toHaveLength(3);
    for (const v of vars) expect(typeof v).toBe('string');
    expect(vars.filter((x) => x.length > 0)).toHaveLength(3);
  });

  it('cycles fallback values when the template has more slots than the fallback list', () => {
    const vars = buildTestVars(9, null);
    expect(vars).toHaveLength(9);
    for (const v of vars) expect(v.length).toBeGreaterThan(0);
  });

  it('prefers real templateData values so the test is an exact reproduction of the failed send', () => {
    const vars = buildTestVars(3, {
      tenantName: 'Mr. Chigozie Ubah',
      amount: 450000,
      address: 'Plot 12, Test Close',
    });
    expect(vars[0]).toBe('Mr. Chigozie Ubah');
    expect(vars[1]).toBe('450000');
    expect(vars[2]).toBe('Plot 12, Test Close');
  });

  it('skips absent templateData fields instead of emitting "undefined"/"null" strings', () => {
    const vars = buildTestVars(3, { amount: 450000 });
    expect(vars).toHaveLength(3);
    for (const v of vars) expect(v).not.toMatch(/undefined|null/);
    // amount was present → used; the other slots fall back to test values
    expect(vars).toContain('450000');
  });

  it('handles zero-placeholder templates (plain text templates) with an empty array', () => {
    expect(buildTestVars(0, null)).toEqual([]);
  });
});
