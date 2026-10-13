# Atrium — Brand Source of Truth

> Atrium is PracticePro's property management OS. **Owner direction
> (2026-10-13): "I kind of like how Atrium is at the moment… other than
> that, I'm okay with Atrium"** — this file therefore records the SHIPPED
> identity ("The Well-Kept Estate") as the source of truth. The
> terracotta/Bricolage Grotesque direction drafted for this round is
> recorded below as CONSIDERED AND DEFERRED, not as truth.

## Concept (shipped)

The well-kept estate: warm cream surfaces, sage panels, emerald accents,
rounded cards, photography of real properties, and the product's best
objects as the identity — the resident receipt, the unit-grid occupancy
board, the gatehouse Sentry Pass terminal. Atrium is friendlier and
rounder than either the hub or Vega, on purpose.

## Palette (shipped — `src/index.css` + atrium section files)

| Token | Triplet | Hex | Role |
|---|---|---|---|
| `--color-atrium-emerald` | `5 150 105` | `#059669` | Primary accent — CTAs, links, marks |
| `--color-atrium-jade` | `12 122 87` | `#0C7A57` | The mark's lit corner (R23) |
| `--color-atrium-pine` | `5 61 44` | `#053D2C` | The mark's deep corner (R23) |
| `--color-atrium-mint` | `110 231 183` | `#6EE7B7` | The mark's inner ring (R23) |
| `--color-cream` | `250 247 242` | `#FAF7F2` | Warm base surface |
| `--color-clay` | `180 132 108` | `#B4846C` | Warm supporting tone |
| `--color-sage` | — | `#EEF2EB` | Section band surface (light AI band, final CTA) |

Emerald `#059669` is Atrium's own — deliberately distinct from the hub's
brand green `#16A34A` (they are close cousins by family, but the hub is
the COMPANY and Atrium is the PRODUCT).

## Typography (shipped)

| Role | Face |
|---|---|
| Display | Space Grotesk (`--font-display`) |
| Body | Figtree (`--font-sans`) |
| Mono | IBM Plex Mono (`--font-mono`) — amounts, unit numbers |

## Radius scale (shipped)

Rounded: cards `rounded-2xl`/`rounded-3xl` registers, controls `rounded-lg`,
the receipt `rounded-[20px]`-family. Square corners are Vega's register —
never on Atrium.

## Motion rules (shipped)

- Warm hover-expand feature cards; gentle transitions.
- `prefers-reduced-motion` respected (shared CSS).

## Banned patterns

- Dark/ink bands (`bg-vega-ink`, `bg-slate-900` bands) — Atrium is light.
- Vega's ruled-ledger register (`vg-rule-h`), Fraunces, gilt/night tokens.
- Pricing tiers (owner removed them — pricing is sales-led).

## Logo usage

- The **Atrium mark** (`src/components/marketing/brand/ProductMarks.tsx`):
  a solid domed-A monogram (the atrium cupola) with an open doorway and a
  high crossbar, on a jade→pine lit squircle — SaaS-grade geometric
  monogram, replacing the old doorway-arch tile (owner: the old marks
  "looked like emojis").
- Header lockup: mark + "Atrium" wordmark (Space Grotesk) only. Footer
  lockup: mark + "Atrium" + "BY PRACTICEPRO" (R24: no byline in the
  header).
- Favicons: `/brand/atrium/favicon.svg` + `favicon-48.png` + `apple-touch-icon.png`.

## Considered and deferred (owner note, 2026-10-13)

A full terracotta rebrand was drafted this round — `--at-cream #F7F1E6`,
`--at-ink #2B2118`, `--at-clay #B4532A` primary, `--at-sand #E8DCC6`
surfaces, Bricolage Grotesque display, plan-view estate-map hero. The
owner declined it for now: Atrium keeps the shipped emerald identity. The
draft lives in git history and in the Prompt 3 spec; revisit only on
explicit owner direction.
