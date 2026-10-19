# Atrium — Brand Source of Truth

> Atrium is PracticePro's property management OS. **Owner direction
> (2026-10-19): "we still need to sort out atrium — i am still not happy
> with it"** — this re-opened the brand and R32 executed the deferred
> terracotta direction. This file records the SHIPPED identity
> ("The Terracotta Estate") as the source of truth.

## Concept (shipped, R32)

The Terracotta Estate: warm cream parchment, sand bands, terracotta clay
accents, Bricolage Grotesque display, rounded cards, and the product's
best objects as the identity — the plan-view master plan, the resident
receipt with its clay PAID stamp, the unit-grid occupancy board, the
gatehouse Sentry Pass terminal. Atrium is friendlier and rounder than
either the hub or Vega, on purpose — and now it owns a colour family no
other surface touches (the emerald era sat one hue from the hub's moss
and forced three green ramps into one chrome).

The whole page tells ONE estate's story: Wemabod Estate, Phase 2 —
24 units, 22 occupied (B3 and D4 vacant), 91.7% — appears as the hero's
master plan, the occupancy grid, Unit B14's receipt, Adaeze's portal and
the gatehouse pass.

## Palette (shipped — `src/index.css` + atrium section files)

| Token | Triplet | Hex | Role |
|---|---|---|---|
| `--color-atrium-clay` | `180 83 42` | `#B4532A` | Primary accent — CTAs, links, stamps, occupied units |
| `--color-atrium-clay-bright` | `201 106 66` | `#C96A42` | Hover / lit accent |
| `--color-atrium-clay-deep` | `122 52 25` | `#7A3419` | Pressed / deep text, verified states |
| `--color-atrium-rust` | `158 64 32` | `#9E4020` | The mark's lit corner |
| `--color-atrium-umber` | `74 34 16` | `#4A2210` | The mark's deep corner |
| `--color-atrium-sand` | `232 220 198` | `#E8DCC6` | Section band surface (scoped: `--color-sage` on `/atrium`) |
| `--color-atrium-ink` | `43 33 24` | `#2B2118` | Headline ink (scoped: `--color-ink` on `/atrium`) |
| `--color-atrium-cream` | `247 241 230` | `#F7F1E6` | Base surface (scoped: `--color-paper` on `/atrium`) |
| `--color-clay` (tan, legacy name) | `180 132 108` | `#B4846C` | Warm neutral — vacant units, maintenance items (`atrium-tan` in Tailwind) |

`.theme-atrium` scopes three overrides so every existing section
re-skins without per-file edits: `--color-paper` → cream, `--color-sage`
→ sand, `--color-ink` → warm ink, and `--font-display` → Bricolage.

## Typography (shipped)

| Role | Face |
|---|---|
| Display | Bricolage Grotesque Variable (`--font-atrium-display`, resolved via `--font-display` inside `.theme-atrium`) |
| Body | Figtree (`--font-sans`) |
| Mono | IBM Plex Mono (`--font-mono`) — amounts, unit numbers, plan furniture |

## Radius scale (shipped)

Rounded: cards `rounded-2xl`/`rounded-3xl` registers, controls
`rounded-lg`, CTAs **`rounded-full` capsules** (R32 radius discipline —
the old `rounded-sm` CTAs were Vega-adjacent squareness). Square corners
are Vega's register — never on Atrium.

## Motion rules (shipped, R32)

- The hero's **plan-view estate map** is the signature moment: a physical
  model that rests tilted (10° draft), leans toward the pointer a few
  degrees (Kowalski spring release), occupied units breathe in a slow
  staggered wave, a resident's car traces the ring road (SMIL
  `animateMotion`), and the gatehouse beacon pings. All guarded by
  `prefers-reduced-motion` (static frame, car hidden).
- Kowalski press physics everywhere: `active:scale-[0.98]`,
  `duration-150`; NO `hover:scale-110` (the old ChatFab pattern is dead).
- Warm hover-expand feature cards; gentle transitions.
- `prefers-reduced-motion` respected (shared CSS).

## Banned patterns

- Dark/ink bands (`bg-vega-ink`, `bg-slate-900` bands, dark footers) —
  Atrium is light END TO END (R32: the footer is now cream, not the
  shared dark colophon).
- Vega's ruled-ledger register (`vg-rule-h`), Fraunces, gilt/night tokens.
- The emerald family (`#059669`, jade/pine/mint, raw Tailwind
  `emerald-*` on /atrium surfaces) — retired R32.
- The hub's moss ramp (`primary-*`) for accents on /atrium.
- Pricing tiers (owner removed them — pricing is sales-led).

## Logo usage

- The **Atrium mark** (`src/components/marketing/brand/ProductMarks.tsx`):
  the Coin of the House (owner-approved geometry, R28) on a RUST→UMBER
  terracotta gradient, cream tile, clay hairline (re-tinted R32).
- Header lockup: mark + "Atrium" wordmark (Bricolage via the theme's
  font override) only. Footer lockup: mark + "Atrium" + "BY PRACTICEPRO"
  (R24: no byline in the header).
- Favicons: `/brand/atrium/favicon.svg` + `favicon-48.png` +
  `apple-touch-icon.png` (all regenerated in the terracotta register).

## History

- R23–R31: "The Well-Kept Estate" emerald era (this file's previous
  truth). Owner liked it on 2026-10-13, then re-opened the brand on
  2026-10-19.
- R32 (2026-10-19): The Terracotta Estate — clay/cream/sand, Bricolage
  Grotesque, plan-view estate-map hero, light footer, radius discipline,
  one-estate story. The emerald tokens are retired.
