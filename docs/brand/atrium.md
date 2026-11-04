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

- The **Atrium mark — the Stepped Stack (R57)**
  (`src/components/marketing/brand/ProductMarks.tsx`): the company
  logo's own construction in Atrium's register, per owner direction
  ("too chunky… it should look like the style of the practicepro logo
  but it should be a different color that works well"). A FLAT indigo
  tile `#4F46E5` (`--color-atrium-indigo`), three stepped translucent
  white blocks (100% / 80% / 60%, each wider than the one above — the
  document stack), and the box A cut in negative space from the top
  block in the tile's own color — exactly how the company P is cut.
  The letterform keeps the R51 box register (flat top, orthogonal
  edges) at the company P's stroke ratio (stems = 25% of letter
  width). Indigo was chosen because it is distinct from the hub green
  `#16A34A`, Vega's burnt orange and Komplete's deep ink at 16px, and
  it is the classic cool counterpoint to this page's cream, sage and
  emerald. History: R23 jade→pine tile → R47 big white A → R51 box A
  → R57 stepped stack.
- Header lockup: mark + "Atrium" wordmark (Space Grotesk) only. Footer
  lockup: mark + "Atrium" + "BY PRACTICEPRO" (R24: no byline in the
  header).
- Favicons: `/brand/atrium/favicon.svg` + `favicon-48.png` +
  `apple-touch-icon.png` — identical geometry to the in-app mark;
  regenerate with `node scripts/generate-brand-assets.cjs atrium`.
  The OG card `og-atrium.png` carries the same mark (R57 fixed a
  stale R28 house coin that had survived there).
- The page keeps its emerald accent (`#059669`) and the emerald
  `theme-color` — the indigo is the MARK's register, not the page's.

## Considered and deferred (owner note, 2026-10-13)

A full terracotta rebrand was drafted this round — `--at-cream #F7F1E6`,
`--at-ink #2B2118`, `--at-clay #B4532A` primary, `--at-sand #E8DCC6`
surfaces, Bricolage Grotesque display, plan-view estate-map hero. The
owner declined it for now: Atrium keeps the shipped emerald identity. The
draft lives in git history and in the Prompt 3 spec; revisit only on
explicit owner direction.
