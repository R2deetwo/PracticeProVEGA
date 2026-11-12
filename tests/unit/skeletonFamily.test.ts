/**
 * Skeleton-family contract tests (UX-47 — loading-state consistency).
 *
 * The audit found three skeleton systems plus ~44 hand-rolled
 * animate-pulse block clusters. These tests pin the consolidated state:
 *   1. ONE family file; DataSkeleton.tsx is gone, its names live on as
 *      aliases so old importers keep working.
 *   2. The migrated surfaces render <Skeleton> (or a composite) and
 *      carry no raw animate-pulse.
 *   3. The only animate-pulse left outside the family is semantic
 *      attention chrome (dots, badges, rings) — pinned by the
 *      check-design-tokens.mjs ratchet; this test independently
 *      recounts it so a test-only run also catches regressions.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(process.cwd());
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(entry)) acc.push(p);
  }
  return acc;
}

describe('UX-47: ONE skeleton family', () => {
  it('src/components/ui/DataSkeleton.tsx is deleted (absorbed into Skeleton.tsx)', () => {
    expect(existsSync(join(ROOT, 'src/components/ui/DataSkeleton.tsx'))).toBe(false);
  });

  it('Skeleton.tsx exports the full family, including the absorbed DataSkeleton names', () => {
    const src = read('src/components/ui/Skeleton.tsx');
    for (const name of [
      'export const Skeleton', 'export const SkeletonText', 'export const SkeletonCard',
      'export const SkeletonList', 'export const SkeletonTable', 'export const SkeletonDetail',
      'export const ListItemSkeleton', 'export const CardSkeleton',
      'export const TableSkeleton', 'export const DetailSkeleton',
      'export const TabContentSkeleton',
      'export const DashboardSkeleton', 'export const TasksSkeleton',
      'export const MattersSkeleton', 'export const ContactsSkeleton',
      'export const DocumentsSkeleton', 'export const GenericSkeleton',
    ]) {
      expect(src).toContain(name);
    }
  });

  it('ui/index.ts re-exports the family from the ONE file', () => {
    const idx = read('src/components/ui/index.ts');
    expect(idx).toContain("from './Skeleton'");
    expect(idx).not.toContain("from './DataSkeleton'");
  });

  it('migrated money-hub and portal surfaces render the family, not hand-rolled pulses', () => {
    // LedgerManager: the audit's flagship "hand-rolls dark skeletons".
    const ledger = read('src/components/atrium/LedgerManager.tsx');
    expect(ledger).toContain('<Skeleton key={i} className="h-16" />');
    expect(ledger).toContain('<Skeleton key={i} className="h-14" />');
    expect(ledger).not.toMatch(/animate-pulse bg-slate/);
    // ServiceChargeMonitor rows.
    const scm = read('src/components/atrium/ServiceChargeMonitor.tsx');
    expect(scm).toContain('<Skeleton key={i} className="h-16" />');
    // Tenant portal tabs: card frames keep their chrome, children pulse.
    const notices = read('src/components/tenant/TenantPortal/NoticesTab.tsx');
    expect(notices).toContain('Skeleton variant="text"');
    expect(notices).not.toContain('animate-pulse');
    // Client dashboard list cluster uses the composite.
    const client = read('src/components/client/ClientDashboard.tsx');
    expect(client).toContain('<SkeletonList count={3} />');
  });

  it('every remaining animate-pulse outside the family is an attention state, not a loading block', () => {
    let semantic = 0;
    for (const f of walk(join(ROOT, 'src'))) {
      const rel = relative(ROOT, f);
      if (/src[\\/]components[\\/]ui[\\/]Skeleton\.tsx$/.test(rel)) continue;
      const text = readFileSync(f, 'utf8');
      const uses = text.match(/\banimate-pulse\b/g) || [];
      semantic += uses.length;
      // No hand-rolled skeleton blocks: pulse must never ride a
      // skeleton-coloured placeholder block or an empty card wrapper
      // (patterns are scoped to one className string — the gap class
      // excludes every quote flavour so they cannot cross template
      // chunks or ternary branches).
      const GAP = "[^\\n'\"`]*";
      const HAND_ROLLED_BLOCK = new RegExp(
        `(?:bg-slate-\\d00 dark:bg-zinc-\\d00${GAP}animate-pulse|animate-pulse${GAP}bg-slate-\\d00 dark:bg-zinc-\\d00)`,
      );
      const PULSING_CARD = new RegExp(
        `bg-white dark:bg-zinc-800${GAP}animate-pulse|animate-pulse${GAP}bg-white dark:bg-zinc-800`,
      );
      expect(
        text,
        `${rel} hand-rolls a skeleton block — use the Skeleton family (UX-47)`,
      ).not.toMatch(HAND_ROLLED_BLOCK);
      expect(text, `${rel} pulses an empty bordered card — use the Skeleton family (UX-47)`).not.toMatch(
        PULSING_CARD,
      );
    }
    // The ratchet baseline in scripts/check-design-tokens.mjs.
    expect(semantic).toBeLessThanOrEqual(80);
  });
});
