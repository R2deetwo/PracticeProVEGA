#!/usr/bin/env node
/**
 * check-ui-primitives.mjs — UI-primitives adoption gate (ADR-0004, Task 61).
 *
 * The adoption rule in src/components/ui/index.ts ("NEW code uses these
 * primitives") was advisory only, so it was ignored: src/components/ carries
 * ~2,400 raw <button>/<input>/<select>/<textarea> elements while the ui/
 * layer had 2 adopters. This script makes the rule REAL:
 *
 *   1. WARN on every raw element outside ui/ (advisory — existing debt keeps
 *      building; Task 1 explicitly does NOT mass-migrate).
 *   2. RATCHET (hard gate): FAIL only when the TOTAL count grows vs. the
 *      committed baseline (scripts/.ui-primitives-baseline.json). Debt can
 *      shrink, never grow. Same discipline as check-design-tokens.mjs.
 *
 * Scope: src/components (all .tsx files), excluding:
 *   - src/components/ui/**  (the primitives themselves)
 *   - generated / vendored code (none today; list below if that changes)
 *
 * Run locally:  node scripts/check-ui-primitives.mjs [--update-baseline]
 * Wired into:   npm run lint  and  CI (.github/workflows/tests.yml)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(process.cwd());
const SRC_COMPONENTS = join(ROOT, 'src', 'components');
const BASELINE_PATH = join(ROOT, 'scripts', '.ui-primitives-baseline.json');
const UPDATE = process.argv.includes('--update-baseline');

const ELEMENTS = ['button', 'input', 'select', 'textarea'];

// Raw-element match: '<button' followed by whitespace, '>' or '/' so that
// custom components like <Button or <IconButton do NOT match.
const ELEMENT_RES = Object.fromEntries(
  ELEMENTS.map((el) => [el, new RegExp(`<${el}(?=[\\s>/])`, 'g')])
);

/** Recursively collect .tsx files under a directory. */
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (entry.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

function scan() {
  const totals = Object.fromEntries(ELEMENTS.map((el) => [el, 0]));
  const files = {};
  for (const f of walk(SRC_COMPONENTS)) {
    const rel = relative(ROOT, f).split('\\').join('/');
    if (rel.startsWith('src/components/ui/')) continue; // the primitives themselves
    const text = readFileSync(f, 'utf8');
    const perFile = {};
    let any = false;
    for (const el of ELEMENTS) {
      const re = ELEMENT_RES[el];
      re.lastIndex = 0;
      const n = (text.match(re) || []).length;
      if (n) {
        totals[el] += n;
        perFile[el] = n;
        any = true;
      }
    }
    if (any) files[rel] = perFile;
  }
  const total = ELEMENTS.reduce((s, el) => s + totals[el], 0);
  return { totals, total, files };
}

const current = scan();

if (UPDATE) {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), totals: current.totals, total: current.total, files: current.files },
      null,
      2
    ) + '\n'
  );
  console.log(
    `Baseline updated: button=${current.totals.button} input=${current.totals.input} select=${current.totals.select} textarea=${current.totals.textarea} | total=${current.total} (${Object.keys(current.files).length} files)`
  );
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error('::error::scripts/.ui-primitives-baseline.json missing or invalid — run `node scripts/check-ui-primitives.mjs --update-baseline` and commit it.');
  process.exit(1);
}

// ── 1. Advisory warnings (per file, GitHub-annotation format) ────────────
const warnFiles = Object.entries(current.files)
  .sort((a, b) => {
    const sum = (x) => ELEMENTS.reduce((s, el) => s + (x[1][el] || 0), 0);
    return sum(b) - sum(a);
  })
  .slice(0, 10); // top 10 noisiest files — full list is in the baseline JSON

console.log(`Top offenders (raw elements outside ui/):`);
for (const [file, perFile] of warnFiles) {
  const parts = ELEMENTS.filter((el) => perFile[el]).map((el) => `${perFile[el]} <${el}>`);
  console.log(`::warning file=${file}::${parts.join(', ')} — migrate to ui/ primitives (ADR-0004); new code must not add raw elements.`);
}

// ── 2. Ratchet: total may not grow vs. baseline ───────────────────────────
let exitCode = 0;
if (current.total > baseline.total) {
  console.error(
    `::error::Raw form-element count GREW: ${baseline.total} -> ${current.total} (+${current.total - baseline.total}). New raw <button>/<input>/<select>/<textarea> in src/components is banned by ADR-0004 — use the ui/ primitives (import { Button, Input, Select } from '../ui'). If this is a genuine migration exception, update scripts/.ui-primitives-baseline.json with justification in the commit message.`
  );
  exitCode = 1;
} else if (current.total < baseline.total) {
  console.log(
    `Ratchet improved: ${baseline.total} -> ${current.total} (-${baseline.total - current.total}). Run \`node scripts/check-ui-primitives.mjs --update-baseline\` and commit the tighter baseline so the debt can never grow back.`
  );
} else {
  console.log('Ratchet held: raw-element count unchanged vs. baseline.');
}

console.log(
  `UI-primitives gate: button=${current.totals.button} input=${current.totals.input} select=${current.totals.select} textarea=${current.totals.textarea} | total=${current.total} (baseline ${baseline.total}) | files with debt: ${Object.keys(current.files).length} | gate: ratchet (no growth)`
);
process.exit(exitCode);
