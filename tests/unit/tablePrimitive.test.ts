/**
 * Table-primitive contract tests (UX-48 — table grammar consistency).
 *
 * The audit catalogued 31 hand-rolled <table> sites with four competing
 * header styles. The ui/Table primitives now carry the grammar; the six
 * widest money/list surfaces are migrated. These tests pin:
 *   1. the primitive family exists with its density/align/sortable API;
 *   2. the six migrated surfaces compose the primitives and no longer
 *      hand-roll their cells;
 *   3. remaining raw <table> sites are unmigrated debt, not new code
 *      (the count may only shrink from here).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.tsx$/.test(entry)) acc.push(p);
  }
  return acc;
}

const MIGRATED = [
  'src/components/TaskList.tsx',
  'src/components/details/PropertyDetailView.tsx',
  'src/components/tenant/TenantPortal/LedgerTab.tsx',
  'src/components/settings/LegalIntelligenceHub.tsx',
  'src/components/reports/FinancialReports.tsx',
  'src/admin/views/FounderSignals.tsx',
];

describe('UX-48: ui/Table primitives', () => {
  it('the primitive family exists with the density/align/sortable grammar', () => {
    const src = read('src/components/ui/Table.tsx');
    for (const name of [
      'export const Table', 'export const TableHeader', 'export const TableBody',
      'export const TableRow', 'export const TableHead', 'export const TableCell',
    ]) {
      expect(src).toContain(name);
    }
    // density flows via context; sortable adds the affordance; align
    // maps to the text utility
    expect(src).toContain("createContext<Density>('comfortable')");
    expect(src).toContain('sortable &&');
    expect(src).toContain("a === 'right' ? 'text-right'");
  });

  it('is exported from the ui primitives layer', () => {
    expect(read('src/components/ui/index.ts')).toContain("export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './Table'");
  });

  it('the six biggest surfaces compose the primitives, not hand-rolled cells', () => {
    for (const f of MIGRATED) {
      const src = read(f);
      expect(src, `${f} must import from ui/Table`).toMatch(/ui\/Table/);
      expect(src, `${f} hand-rolls a th cell`).not.toMatch(/<th[\s>]/);
      expect(src, `${f} hand-rolls a td cell`).not.toMatch(/<td[\s>]/);
    }
  });

  it('remaining raw <table> sites are unmigrated debt only — the count may only shrink', () => {
    // Baseline after this round: 24 raw <table> sites remain (the six
    // biggest surfaces — 10 table instances — now compose ui/Table).
    let raw = 0;
    for (const f of walk(join(ROOT, 'src'))) {
      if (f.endsWith('/ui/Table.tsx')) continue;
      raw += (readFileSync(f, 'utf8').match(/<table[\s>]/g) || []).length;
    }
    expect(raw).toBeLessThanOrEqual(24);
  });
});
