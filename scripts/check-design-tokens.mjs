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

const CLASS_RE = /\b(?:slate|gray|zinc|dim)-\d{2,3}\b/g;

// V7 (F: UI consistency): STYLE_GUIDE.md deprecates rounded-xl (14px) in
// favour of rounded-lg / rounded-2xl. 74 legacy uses remain — wholesale
// migration would be visual churn with no usability evidence (STYLE_GUIDE
// §“avoid visual redesign without evidence”), so this gate RATCHETS the
// count: new rounded-xl uses fail CI, existing debt may only shrink.
const ROUNDED_XL_RE = /\brounded-xl\b/g;
const ROUNDED_XL_BASELINE = 74;

// UX-16 (typography foundation): arbitrary text sizes (text-[11px] etc.)
// bypass the compiled type scale — tailwind.config.ts bans them by comment
// but nothing enforced it. 72 remain (concentrated in marketing-site
// sections); ratcheted so the count may only shrink. Use the scale: 3xs/2xs/
// xs/sm/base (8/10/12/14/16px).
const TEXT_PX_RE = /\btext-\[\d+(?:\.\d+)?px\]/g;
const TEXT_PX_BASELINE = 72;

// UX-18 (z-index governance): raw z-[NNNN] literals are banned outside
// src/overlays/constants.ts (the single home of the tier ladder). The
// migration took the codebase to zero, so the baseline is zero — any new
// fixed layer must take a named tier (Z_TIERS / Z_CLASS).
const Z_INDEX_RE = /\bz-\[\d+\]/g;
const Z_INDEX_BASELINE = 0;
const Z_INDEX_EXEMPT = /src[\\/]overlays[\\/]constants\.ts$/;

// UX-47 (loading-state consistency): animate-pulse is reserved for the
// skeleton family (src/components/ui/Skeleton.tsx — the one home) and
// for SEMANTIC attention states (live dots, unread badges, recording
// rings). 80 semantic uses remain; hand-rolled skeleton blocks were
// migrated to the family. New raw animate-pulse loading placeholders
// fail this ratchet — use <Skeleton>/<SkeletonList>/composites.
const ANIMATE_PULSE_RE = /\banimate-pulse\b/g;
const ANIMATE_PULSE_BASELINE = 80;
const ANIMATE_PULSE_EXEMPT = /src[\\/]components[\\/]ui[\\/]Skeleton\.tsx$/;

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
  const counts = { gray: 0, slate: 0, zinc: 0, dim: 0, roundedXl: 0, textPx: 0, zIndex: 0, animatePulse: 0 };
  const perFile = {};
  for (const f of walk(SRC)) {
    const rel = relative(ROOT, f);
    const text = readFileSync(f, 'utf8');
    const matches = text.match(CLASS_RE) || [];
    const rxl = text.match(ROUNDED_XL_RE) || [];
    const tpx = text.match(TEXT_PX_RE) || [];
    counts.roundedXl += rxl.length;
    counts.textPx += tpx.length;
    if (!Z_INDEX_EXEMPT.test(rel)) counts.zIndex += (text.match(Z_INDEX_RE) || []).length;
    if (!ANIMATE_PULSE_EXEMPT.test(rel)) counts.animatePulse += (text.match(ANIMATE_PULSE_RE) || []).length;
    // perFile stays NEUTRAL-SCALE ONLY — the committed .token-baseline.json
    // per-file counts were captured without rounded-xl; mixing the new
    // counter in would false-trigger the migrated-files soft gate.
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
  console.log(`Baseline updated: gray=${counts.gray} slate=${counts.slate} zinc=${counts.zinc} dim=${counts.dim} (${Object.keys(perFile).length} files)`);
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

// ── HARD GATE: gray zero-tolerance ───────────────────────────────────────
// Batch 2 eliminated the gray scale (renamed to `dim`, mapped to the same
// --color-dim-* variables). Any gray-* occurrence is now a defect: the
// `gray` Tailwind key no longer exists, so such a class silently generates
// NO CSS at all.
if (counts.gray > 0) {
  console.error(`::error::gray-* usage found (${counts.gray} occurrences). The gray scale was eliminated in P4 batch 2 — its Tailwind key is deleted, so these classes generate no CSS. Use slate-* (light), zinc-* (dark: variants), dim-* (theme-auto-flip), or a semantic token.`);
  exitCode = 1;
} else {
  console.log('✓ gray-* at zero (scale eliminated, batch 2)');
}

// ── SOFT GATE: growth in migrated files ──────────────────────────────────
for (const f of MIGRATED_FILES) {
  const now = perFile[f] ?? 0;
  const before = baseline.perFile[f] ?? 0;
  if (now > before) {
    console.log(`::warning file=${f}::neutral-scale usage grew (${before} → ${now}) in a file migrated to semantic tokens — prefer text-strong/body/muted/subtle, bg-surface(-2), border-hairline/edge.`);
  }
}

// ── RATCHET: rounded-xl must not grow (STYLE_GUIDE deprecation) ────────
if (counts.roundedXl > ROUNDED_XL_BASELINE) {
  console.error(`::error::rounded-xl usage grew (${ROUNDED_XL_BASELINE} → ${counts.roundedXl}). STYLE_GUIDE.md deprecates rounded-xl — use rounded-lg (tight contexts) or rounded-2xl (card surfaces). Raise ROUNDED_XL_BASELINE in scripts/check-design-tokens.mjs only to LOWER it (ratchet moves down, never up).`);
  exitCode = 1;
} else {
  console.log(`✓ rounded-xl ratchet held (${counts.roundedXl}/${ROUNDED_XL_BASELINE} — deprecated per STYLE_GUIDE, may only shrink)`);
}

// ── RATCHET: arbitrary text-[Npx] must not grow (UX-16) ──────────────
if (counts.textPx > TEXT_PX_BASELINE) {
  console.error(`::error::arbitrary text-[Npx] usage grew (${TEXT_PX_BASELINE} → ${counts.textPx}). tailwind.config.ts bans arbitrary text sizes — use the compiled scale (text-3xs/2xs/xs/sm/base = 8/10/12/14/16px). Raise TEXT_PX_BASELINE in scripts/check-design-tokens.mjs only to LOWER it (ratchet moves down, never up).`);
  exitCode = 1;
} else {
  console.log(`✓ text-[Npx] ratchet held (${counts.textPx}/${TEXT_PX_BASELINE} — banned per tailwind.config.ts, may only shrink)`);
}

// ── HARD GATE: raw z-[NNNN] literals stay at zero (UX-18) ─────────────
if (counts.zIndex > Z_INDEX_BASELINE) {
  console.error(`::error::raw z-[NNNN] literal found outside src/overlays/constants.ts (${counts.zIndex} occurrence(s)). Import Z_CLASS (className) or Z_TIERS (style={{zIndex}}) from src/overlays/constants.ts and pick a named tier; add a tier there (with a comment) only if the ladder genuinely lacks a rung.`);
  exitCode = 1;
} else {
  console.log(`✓ z-index literals at zero outside the tier ladder (UX-18)`);
}

// ── RATCHET: animate-pulse may only shrink (UX-47) ────────────────────
if (counts.animatePulse > ANIMATE_PULSE_BASELINE) {
  console.error(`::error::animate-pulse usage grew outside the skeleton family (${ANIMATE_PULSE_BASELINE} → ${counts.animatePulse}). Loading placeholders must use the ONE family (src/components/ui/Skeleton.tsx: Skeleton, SkeletonText, SkeletonCard, SkeletonList, SkeletonTable, SkeletonDetail + per-screen composites); animate-pulse stays reserved for semantic attention states (live dots, unread badges, recording rings).`);
  exitCode = 1;
} else {
  console.log(`✓ animate-pulse ratchet held (${counts.animatePulse}/${ANIMATE_PULSE_BASELINE} — semantic attention states only, skeletons live in the family)`);
}

console.log(`Design-token gate: gray=${counts.gray} slate=${counts.slate} zinc=${counts.zinc} dim=${counts.dim} roundedXl=${counts.roundedXl} textPx=${counts.textPx} zIndex=${counts.zIndex} animatePulse=${counts.animatePulse} | migrated files: ${MIGRATED_FILES.length} | hard gate: gray zero-tolerance`);
process.exit(exitCode);
