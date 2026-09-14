# Design Tokens — Inventory, Semantic Layer & Migration Plan

**Status:** Token set defined ✅ · Batch 1 (Task components) migrated ✅ · Batches 2–N planned
**Source of truth:** `src/index.css` (variables) · `tailwind.config.ts` (utility mapping)
**Migration rule:** a component migrates from a scale class to a role token **only when the token aliases the exact same CSS variable** — the refactor is zero-visual-change *by construction* (same variable, same value, under every theme).

---

## 1. Full variable inventory (as of 2026-09-14)

### 1a. Landing-page brand tokens (`:root`)

| Token | Value | Used for |
|-------|-------|----------|
| `--color-ink` | `#0B1220` | Landing hero text (near-black navy) |
| `--color-paper` | `#FBFBF9` | Landing page background (warm paper) |
| `--color-sage` | `#EEF2EB` | Soft sage section background |
| `--color-moss` | `#16A34A` | Brand moss green (logo green) |
| `--color-amber` | `#D97706` | Amber accent (highlights) |
| `--color-emerald` | `#059669` | Emerald accent (success-adjacent) |

### 1b. App functional tokens (`:root`, overridden per theme)

| Token | Light value | Notes |
|-------|-------------|-------|
| `--bg-main` | `248 250 252` | Page background |
| `--bg-card` | `255 255 255` | Card surface |
| `--text-main` | `15 23 42` | Primary text |
| `--text-muted` | `100 116 139` | Secondary text |
| `--primary-accent` / `--primary-light` | `22,163,74` / `220,252,231` | Brand accents |
| `--success` / `--warning` / `--danger` | `16,185,129` / `245,158,11` / `239,68,68` | Status |
| `--radius-sm/md/lg/xl` | `0.5/0.75/1/1.5rem` | Radii |
| `--duration-fast/base/slow`, `--ease-out`, `--ease-in-out` | — | Motion |
| `--shadow-sm/md/lg`, `--shadow-card*`, `--border-card*`, `--radius-card*` | — | Landing card kit |

### 1c. Neutral scales (Tailwind-mapped, theme-overridable)

All three scales are mapped in `tailwind.config.ts` to `rgb(var(--color-*) / <alpha-value>)`, so **every `slate-*`/`zinc-*`/`gray-*` class is already variable-backed and theme-aware**:

| Scale | Occurrences (src/components) | Role in the app |
|-------|------------------------------|-----------------|
| `slate-*` | 8,655 | **Light-mode workhorse** — text/borders/surfaces |
| `zinc-*` | 6,351 | **Dark-mode workhorse** — explicit `dark:` variants (5,798 `dark:`-prefixed neutral classes) |
| `gray-*` | 752 | **Orphan scale** — inconsistent third hue, to be eliminated (batches 2–3) |
| `white`/`black` | — | Var-backed (`.dark` flips both) |

Top shades: `zinc-700` (1,703) · `zinc-800` (1,433) · `slate-200` (1,432) · `slate-400` (1,330) · `slate-500` (1,292) · `slate-100` (1,049).

**Consistency verdict:** the app is *not* internally consistent today — the same semantic role (e.g. "muted text") is rendered as `slate-400`, `slate-500`, `gray-400`, `gray-500` or `zinc-400` depending on the file. The theme layer is consistent (all three scales are var-backed; `.dark` flips `white`/`black`/`gray` and pins `zinc`/`slate`), so the drift is hue-level, not theme-level.

### 1d. Brand scale

`--color-primary-50…950` (moss green ramp, `primary-500` = `#16A34A`), exposed as `primary-*` utilities, plus the Premium Portal tokens (`brand.primary/surface/card`).

### 1e. Dead config (flagged, not removed)

The shadcn-style HSL token block in `tailwind.config.ts` (`background`, `foreground`, `card`, `popover`, `secondary`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-*`, bare `primary` DEFAULT) has **zero component usages** and its HSL variables are **not defined anywhere**. The `muted` key was repurposed for the semantic layer (Batch 1); the rest is inert and safe to leave until a cleanup pass.

---

## 2. The semantic role layer (new, Batch 1)

Defined in `src/index.css` as **variable references, not literals** — they track every theme override automatically:

```css
--text-strong:   var(--color-slate-900);   /* headings, emphasized text   */
--text-body:     var(--color-slate-700);   /* body copy                   */
--text-muted:    var(--color-slate-500);   /* secondary text, captions    */
--text-subtle:   var(--color-slate-400);   /* placeholders, timestamps    */
--bg-surface:    var(--color-slate-50);    /* page/inset backgrounds      */
--bg-surface-2:  var(--color-slate-100);   /* nested surfaces, hover fill */
--border-subtle: var(--color-slate-200);   /* default borders, dividers   */
--border-strong: var(--color-slate-300);   /* emphasized borders          */
```

Tailwind keys (`tailwind.config.ts`): `strong`, `body`, `subtle`, `hairline` (class `border-hairline` = `--border-subtle`), `edge` (class `border-edge` = `--border-strong`), `surface` (`DEFAULT`/`2`), `muted` (redefined from the dead shadcn entry).

> **Why border keys have distinct names:** a Tailwind color key serves *every* utility prefix (`text-`/`bg-`/`border-`). Sharing the `subtle`/`strong` keys would have made `border-subtle` resolve to the TEXT variable (`--text-subtle`, slate-400) instead of the border one (slate-200). The first built-CSS equivalence check caught exactly this during batch 1 — `border-hairline`/`border-edge` are the fix.

**Why aliases, not new values:** replacing `text-slate-900` with `text-strong` compiles to `rgb(var(--text-strong))` = `rgb(var(--color-slate-900))` — the identical declaration under every theme. This is the zero-visual-change guarantee.

**Verification method (used for batch 1):** production build → extract the generated rule for each new class and its old counterpart from `dist/assets/*.css` → confirm the declarations differ only by variable name → confirm the alias lines (`--text-strong: var(--color-slate-900)` etc.) exist in the built CSS. Resolved values are identical by construction, so rendered pixels are unchanged; on-device confirmation rides along with the next APK build.

**Migration discipline:** a class is only swapped when the token aliases its exact variable. E.g. `text-slate-600` (no exact token yet) stays as-is until a decision is made about whether body text converges to 600 or 700 — that's a *visual* decision, not a refactor. Dark-mode classes (`dark:text-zinc-*`) are deliberately untouched in Batch 1; they get their own role layer (`--text-strong-dark` etc.) in a later batch after the light layer proves out.

---

## 3. Batch plan

| Batch | Scope | Files (approx.) | Status |
|-------|-------|-----------------|--------|
| 1 | Task components: `TasksView`, `TaskList`, `TaskDetailModal`, `TasksWidget`, `UserTaskSummaryPanel` — 96 class swaps (incl. `hover:`/`focus:` variants); `divide-slate-*` and non-exact shades deliberately held | 5 | ✅ done (this round) |
| 2 | Orphan `gray-*` elimination → `slate-*` (app-wide, mechanical; ~sub-perceptual hue shift, flagged separately) | ~40 | planned |
| 3 | Financial components (`BillingView`, `BillingMonitorView`, `reports/FinancialReports`, invoice/receipt details) | ~15 | planned |
| 4 | Messaging components (`MessagesView`, `messaging/*`, `aloa/*`) | ~20 | planned |
| 5 | Settings & modals (`settings/*`, `modals/*`) | ~55 | planned |
| 6 | Details & forms (`details/*`, `forms/*`) | ~57 | planned |
| 7 | Dark-mode role layer (`--text-strong-dark` etc.) + `dark:` pair consolidation | — | planned, needs design |
| 8 | Landing page: converge on `--color-ink/paper/sage` brand tokens where they already match | 1 | planned |

## 4. Enforcement decision (recorded)

**Feasible now, adopted as a soft gate:** `scripts/check-design-tokens.mjs` (run in CI via `tests.yml`) counts neutral-scale usage in `src/` against a committed baseline (`scripts/.token-baseline.json`). It **fails the build when `gray-*` usage grows** (the scale we are eliminating) and **warns** when `slate-*`/`zinc-*` grow in already-migrated files. Rationale: a hard ban on all three scales is premature until the semantic layer covers dark-mode roles (batch 7); a `gray-*` growth ban is actionable today because every new `gray-*` is a defect by definition under the consolidation rule.

**Revisit trigger:** flip `slate-*`/`zinc-*` growth to *fail* (per-file allowlist for unmigrated areas) after batches 2–6 land.
