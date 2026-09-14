# Design Tokens — Inventory, Semantic Layer & Migration Plan

**Status:** Token set defined ✅ · Batch 1 (Task components) ✅ · Batch 2 (gray scale eliminated → `dim` + slate convergence) ✅ · Batches 3–N planned
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

All scales are mapped in `tailwind.config.ts` to `rgb(var(--color-*) / <alpha-value>)`, so **every `slate-*`/`zinc-*`/`dim-*` class is variable-backed and theme-aware**:

| Scale | Occurrences (src/components) | Role in the app |
|-------|------------------------------|-----------------|
| `slate-*` | 8,655 | **Light-mode workhorse** — text/borders/surfaces |
| `zinc-*` | 6,351 | **Dark-mode workhorse** — explicit `dark:` variants (5,798 `dark:`-prefixed neutral classes) |
| `dim-*` | 373 | **Theme-inverted neutral ramp** (formerly `gray-*`, renamed batch 2) — auto-flips in every dark/colored theme; converges into the batch-7 dark role layer |
| `white`/`black` | — | Var-backed (`.dark` flips both) |

Top shades: `zinc-700` (1,703) · `zinc-800` (1,433) · `slate-200` (1,432) · `slate-400` (1,330) · `slate-500` (1,292) · `slate-100` (1,049).

**Consistency verdict:** the same semantic role (e.g. "muted text") can still render as `slate-400`, `slate-500` or `dim-400` depending on the file — that drift is what batches 3–7 retire as each area moves to role tokens. The theme layer is consistent (`.dark` flips `white`/`black`/`dim` and pins `zinc`/`slate`), so the drift is hue-level, not theme-level.

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

### 2b. Batch 2 — why "gray → slate everywhere" was impossible, and what shipped instead

The batch plan's original line ("gray → slate, mechanical") assumed the two scales only differ by hue. **They do not.** Per-theme analysis of all 10 theme combinations (`scripts/compare_gray_slate.py`, `dark_gray_zinc_map.py`) found:

- **Light (`:root`):** gray-N vs slate-N differ by ≤ 8/255 per channel — genuinely sub-perceptual.
- **`.dark`:** `gray` is remapped to the inverted zinc ramp (auto-flips: low shades → dark surfaces, high shades → light text) while `slate` is *pinned* at light-theme values. An unpaired `text-gray-800` is light text on dark bg; the same element as `text-slate-800` would be **invisible**.
- **Colored themes (midnight, oled, neon-cyber, …):** gray and slate get *independently authored* ramps — `dark:gray-N → dark:zinc-M` carries 15–51/255 deltas; there is no non-gray class that matches gray-N across all themes.

So the only zero-visual-change elimination is a **rename**, not a remap:

| Rule | Pattern | Target | Why it's exact |
|------|---------|--------|----------------|
| D | gray class under `dark:` | `dim-N` | same variable, renamed |
| S | light gray + same-utility `dark:` partner **in the same string literal** | `slate-N` | dark covered by partner (`.dark .dark\:*` always outspecifies); light delta ≤ 8/255 |
| X | everything else (auto-flip reliance, ternary branches, cross-literal pairing) | `dim-N` | same variable, renamed |

- New Tailwind key **`dim`** maps `--color-dim-50…950` — the variables formerly named `--color-gray-*`, values untouched in all 9 theme blocks (verified: 99/99 var lines byte-identical).
- The **`gray` key is deleted** from `tailwind.config.ts` — any future `gray-*` class silently generates no CSS, so the CI gate now **hard-fails on any gray-* occurrence**.
- Rule S is restricted to a single string literal because a ternary can put mutually-exclusive branches on one line (`x ? 'bg-gray-100' : 'bg-white dark:bg-zinc-900'`) — line-level pairing would convert the light branch to slate and break its dark auto-flip.
- Totals: 779 occurrences in 67 files → **406 slate + 373 dim**; built-CSS proof (`scripts/batch2_css_proof.py`): all 42 dim selectors declaration-identical to their gray predecessors, 0 gray selectors residual, 0 `var(--color-gray-*)` refs.
- `dim` is a **transitional name**: those 373 usages rely on the theme auto-flip and converge into the batch-7 dark role layer (`--text-strong-dark` etc.).

---

## 3. Batch plan

| Batch | Scope | Files (approx.) | Status |
|-------|-------|-----------------|--------|
| 1 | Task components: `TasksView`, `TaskList`, `TaskDetailModal`, `TasksWidget`, `UserTaskSummaryPanel` — 96 class swaps (incl. `hover:`/`focus:` variants); `divide-slate-*` and non-exact shades deliberately held | 5 | ✅ done (this round) |
| 2 | Orphan `gray-*` elimination — **executed as a rename + split**, see §2b: 406 paired classes → `slate-*` (light-side convergence, dark covered by existing `dark:` partners); 373 auto-flip/dark-variant classes → new `dim-*` key mapped to the SAME variables (renamed `--color-dim-*`); `gray` Tailwind key deleted | 67 | ✅ done |
| 3 | Financial components (`BillingView`, `BillingMonitorView`, `reports/FinancialReports`, invoice/receipt details) | ~15 | planned |
| 4 | Messaging components (`MessagesView`, `messaging/*`, `aloa/*`) | ~20 | planned |
| 5 | Settings & modals (`settings/*`, `modals/*`) | ~55 | planned |
| 6 | Details & forms (`details/*`, `forms/*`) | ~57 | planned |
| 7 | Dark-mode role layer (`--text-strong-dark` etc.) + `dark:` pair consolidation | — | planned, needs design |
| 8 | Landing page: converge on `--color-ink/paper/sage` brand tokens where they already match | 1 | planned |

## 4. Enforcement decision (recorded, updated batch 2)

**Hard gate — gray zero-tolerance:** `scripts/check-design-tokens.mjs` (CI via `tests.yml`) counts neutral-scale usage in `src/` against a committed baseline (`scripts/.token-baseline.json`). Since batch 2 the `gray` Tailwind key **no longer exists** — any `gray-*` class generates no CSS at all, so the gate **fails on any gray-* occurrence** (was: growth-only ban). It **warns** when `slate-*`/`zinc-*` grow in already-migrated files. Rationale: a hard ban on all scales is premature until the semantic layer covers dark-mode roles (batch 7).

**Revisit trigger:** flip `slate-*`/`zinc-*` growth to *fail* (per-file allowlist for unmigrated areas) after batches 2–6 land.
