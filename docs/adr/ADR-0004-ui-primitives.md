# ADR-0004: Shared UI primitives (Button/Input/Select/Card/Badge) over hand-rolled class strings

**Status:** Accepted (2026-09-14, design-system Chunk A)
**Context:** code audit workstream 1.6/1.7/6.1/6.2 — 1,818 `<button>` elements (only 137 with `type=`, so untyped buttons inside forms default to submit and cause accidental submissions), 523 `<label>` elements with only 109 wired via `htmlFor`, no shared Button/Input/Card/Select/Badge, ~17 files hand-rolling identical button class strings, and `designTokens.ts` with zero importers.

## Decision

Build a small homegrown primitive layer in `src/components/ui/` (barrel `index.ts`):

- **Button** — `type="button"` is the DEFAULT (the footgun fix); variants primary/secondary/ghost/danger/outline; sizes sm/md/lg; `loading`, `icon`, `iconOnly` (accessible-name guarded), opt-in `minTouchTarget` (44×44) and `activePress`; forwardRef; native props spread.
- **Input / Select** — auto-generated `id` + `htmlFor` label + `hint`/`error` wired through `aria-describedby`/`aria-invalid`; visual styles imported from the established `formStyles.ts` variants (single source of truth).
- **Card** — consumes `CARD_BASE`/`CARD_WIDGET`/`CARD_PAD` from `designTokens.ts` (its first real adopters).
- **Badge** — tone vocabulary mirrors `FinancialStatusBadge` exactly (success/warning/danger/info/neutral + outline).
- **useToastFeedback** — typed façade (`success/error/warning/info`) over the already-centralized `UIContext.addToast` system (debounce, 3-toast cap, haptics, hover-hold). The toast system is NOT replaced — it was already unified; only the call ergonomics are.

### Why homegrown, not shadcn/Radix

The repo carries a dead shadcn config block (undefined HSL vars, zero usages — TOKENS.md §1e) from an abandoned scaffold. Pulling Radix in for primitives that must look EXACTLY like the existing app would mean fighting its default styling at every turn; the measured dominant patterns are 4–6 class strings each. The primitives encode those patterns verbatim, so adoption is a zero-visual-change refactor — the same discipline as the token batches.

### Variant strings = measured dominant patterns

`designTokens.ts` `BTN_*` constants were updated (they had zero importers, so the change is free) to the most frequent measured button patterns in the codebase — e.g. `px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm` appears 11× verbatim. `ui/Button.tsx` imports these constants rather than re-declaring them: `designTokens.ts` is the vocabulary, `ui/` is the component layer.

### Adoption rule

- **New code** must use the primitives.
- **Existing code** migrates screen by screen (never a big-bang sweep), each migration zero-visual-change at rest. Deliberate improvements are confined to keyboard-only states (focus-visible ring) and semantics (aria wiring), which do not alter the resting pixels.
- The z-index scale and overlay consolidation (audit workstream 2) are recorded separately; this ADR covers form/control primitives only.

## Consequences

- Accidental form submission becomes impossible for adopters (`type="button"` default).
- Screen-reader label association and error announcement come for free with `Input`/`Select`.
- `designTokens.ts` graduates from dead code to the canonical vocabulary consumed by the primitive layer.
- The 44px touch-target rule (a11y audit 7.3) remains opt-in per button until a per-screen decision, because the dominant measured patterns are 36px tall — defaulting it on would resize every adopted button.
