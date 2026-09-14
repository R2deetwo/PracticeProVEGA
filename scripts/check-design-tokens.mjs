#!/usr/bin/env node
/**
 * check-design-tokens.mjs — P4 enforcement gate (docs/design/TOKENS.md).
 *
 * Counts neutral-scale class usage in src/ and compares against the committed
 * baseline (scripts/.token-baseline.json):
 *   - gray-*  GROWS  → FAIL  (gray is the scale being eliminated; any growth is a defect)
 *   - slate/zinc grow in already-migrated files → WARN (hard gate flips on after batches 2–6)
 *
 * Run locally:  node scripts/check-design-tokens.mjs [--update-baseline]
 * Run in CI:    .github/workflows/tests.yml (design-tokens job step)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(process.cwd());
const SRC = join(ROOT, 'src');
const BASELINE_PATH = join(ROOT, 'scripts', '.token-baseline.json');
const UPDATE = process.argv.includes('--update-baseline');

// Files that have completed semantic-token migration (batch 1). New entries
// get appended as batches land.
const MIGRATED_FILES = [
  'src/components/TasksView.tsx',
  'src/components/TaskList.tsx',
  'src/components/modals/TaskDetailModal.tsx',
  'src/components/dashboard/TasksWidget.tsx',
  'src/components/UserTaskSummaryPanel.tsx',
];

const CLASS_RE = /\b(?:slate|gray|zinc)-\d{2,3}\b/g;

/** Recursively collect .tsx/.ts files under a directory. */
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(entry)) acc.push(p);
  }
  return acc;
}

function scan() {
  const counts = { gray: 0, slate: 0, zinc: 0 };
  const perFile = {};
  for (const f of walk(SRC)) {
    const rel = relative(ROOT, f);
    const text = readFileSync(f, 'utf8');
    const matches = text.match(CLASS_RE) || [];
    if (matches.length) {
      perFile[rel] = matches.length;
      for (const m of matches) {
        counts[m.split('-')[0]] += 1;
      }
    }
  }
  return { counts, perFile };
}

const { counts, perFile } = scan();

if (UPDATE) {
  writeFileSync(BASELINE_PATH, JSON.stringify({ counts, perFile }, null, 2) + '\n');
  console.log(`Baseline updated: gray=${counts.gray} slate=${counts.slate} zinc=${counts.zinc} (${Object.keys(perFile).length} files)`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error('::error::scripts/.token-baseline.json missing or invalid — run `node scripts/check-design-tokens.mjs --update-baseline` and commit it.');
  process.exit(1);
}

let exitCode = 0;

// ── HARD GATE: gray growth ────────────────────────────────────────────────
if (counts.gray > baseline.counts.gray) {
  console.error(`::error::gray-* usage GREW from ${baseline.counts.gray} to ${counts.gray}. gray is the orphan scale being eliminated (docs/design/TOKENS.md batch 2) — use slate-*, zinc-* (dark: variants), or a semantic token instead.`);
  exitCode = 1;
} else if (counts.gray < baseline.counts.gray) {
  console.log(`✓ gray-* shrank: ${baseline.counts.gray} → ${counts.gray} (migration progressing — commit an updated baseline)`);
} else {
  console.log(`✓ gray-* stable at ${counts.gray}`);
}

// ── SOFT GATE: growth in migrated files ──────────────────────────────────
for (const f of MIGRATED_FILES) {
  const now = perFile[f] ?? 0;
  const before = baseline.perFile[f] ?? 0;
  if (now > before) {
    console.log(`::warning file=${f}::neutral-scale usage grew (${before} → ${now}) in a file migrated to semantic tokens — prefer text-strong/body/muted/subtle, bg-surface(-2), border-hairline/edge.`);
  }
}

console.log(`Design-token gate: gray=${counts.gray} slate=${counts.slate} zinc=${counts.zinc} | migrated files: ${MIGRATED_FILES.length} | hard gate: gray growth`);
process.exit(exitCode);
