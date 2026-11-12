/**
 * UX-02 — semantic status vocabulary (source contract).
 *
 * Status colour is expressed in ONE place: the --status-* CSS variables
 * (index.css, light + dark ramps) exposed as Tailwind's status-* family.
 * FinancialStatusBadge, Badge, the ledger status dots, the priority
 * colours and the toast accents all consume the tokens — no component may
 * hand-roll a private hue map for a semantic status again.
 *
 * These guards read SOURCE (the repo's source-contract test pattern), so
 * drift fails CI without rendering anything.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(repoRoot, p), 'utf8');

describe('UX-02 — semantic status tokens (source contract)', () => {
  it('index.css defines the four status vars in BOTH theme ramps', () => {
    const css = read('src/index.css');
    for (const v of ['--status-success', '--status-warning', '--status-danger', '--status-info']) {
      const occurrences = css.split(v).length - 1;
      expect(occurrences, `${v} must appear in :root AND .dark`).toBeGreaterThanOrEqual(2);
    }
    // The orphaned pre-UX-02 singles are gone (they had zero consumers).
    expect(css).not.toMatch(/^\s*--success:/m);
    expect(css).not.toMatch(/^\s*--warning:/m);
    expect(css).not.toMatch(/^\s*--danger:/m);
  });

  it('tailwind.config.ts maps the status family onto the CSS vars', () => {
    const cfg = read('tailwind.config.ts');
    expect(cfg).toContain("success: 'rgb(var(--status-success) / <alpha-value>)'");
    expect(cfg).toContain("danger: 'rgb(var(--status-danger) / <alpha-value>)'");
    expect(cfg).toContain("warning: 'rgb(var(--status-warning) / <alpha-value>)'");
    expect(cfg).toContain("info: 'rgb(var(--status-info) / <alpha-value>)'");
  });

  it('FinancialStatusBadge and Badge consume the tokens, not raw hues', () => {
    const fsb = read('src/components/ui/FinancialStatusBadge.tsx');
    expect(fsb).toContain("success: 'bg-status-success/10 text-status-success'");
    expect(fsb).toContain("danger: 'bg-status-danger/10 text-status-danger'");
    // Vocabulary: unpaid invoices are money-expected (warning), not neutral.
    expect(fsb).toContain("'unpaid'");
    // Retired statuses render struck-through (audit-trail contract).
    expect(fsb).toContain('isRetiredStatus');
  });

  it('the invoice list renders statuses via FinancialStatusBadge (no private hue map)', () => {
    const billing = read('src/components/BillingView.tsx');
    expect(billing).toContain('FinancialStatusBadge');
    expect(billing).not.toContain('getStatusBadgeClass');
    expect(billing).not.toMatch(/bg-green-100 text-green-800/);
    expect(billing).not.toMatch(/bg-teal-100 text-teal-800/);
    expect(billing).not.toMatch(/bg-yellow-100 text-yellow-800/);
  });

  it('the ledger status dots use the tokens', () => {
    const ledger = read('src/components/atrium/LedgerManager.tsx');
    expect(ledger).toContain("'bg-status-success'");
    expect(ledger).toContain("'bg-status-danger'");
    expect(ledger).toContain("'bg-status-warning'");
    expect(ledger).not.toContain("'bg-emerald-500'");
  });

  it('priority colours map onto danger/warning/info', () => {
    const popover = read('src/components/PriorityPopover.tsx');
    expect(popover).toContain('text-status-danger');
    expect(popover).toContain('text-status-warning');
    expect(popover).toContain('text-status-info');
    expect(popover).not.toContain("colorClass: 'text-red-500'");
  });

  it('toast accents carry the token vocabulary', () => {
    const toast = read('src/components/Toast.tsx');
    expect(toast).toContain('border-status-success/30');
    expect(toast).toContain('border-status-danger/30');
    expect(toast).toContain('border-status-warning/30');
    expect(toast).toContain('border-status-info/30');
  });
});
