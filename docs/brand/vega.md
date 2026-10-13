# Vega — Brand Source of Truth

> Vega is PracticePro's legal practice OS for Nigerian law firms. This file
> records the SHIPPED identity — "The Night Chambers" — exactly as it lives
> in `src/index.css` (L2009 onward) and `src/sites/vega/`. Where
> `COLOR_SCHEME.md` disagrees (it describes a light amber page), this file
> and the CSS win.

## Concept

A law library at night. Vega speaks in the register of a law report: a
near-black ground, parchment text, one gilt accent, hairline rules, square
corners, documents as the hero objects. The product's craft is legal
drafting — so the page shows REAL instruments (a Motion on Notice, tracked
changes, a Scale of Charges ledger) rendered accurately, never mocked up.

## Palette (shipped — `src/index.css` "The Night Chambers" tokens)

| Token | Triplet | Hex | Role |
|---|---|---|---|
| `--color-vega-night` | `7 9 15` | `#07090F` | The page ground |
| `--color-vega-night-2` | `13 17 27` | `#0D111B` | Panels on the ground |
| `--color-vega-parchment` | `245 240 229` | `#F5F0E5` | Warm text on night |
| `--color-vega-gilt` | `216 178 108` | `#D8B26C` | Brass rules + fills |
| `--color-vega-gilt-bright` | `233 205 145` | `#E9CD91` | Gilt text on night |
| `--color-vega-claret` | `123 30 30` | `#7B1E1E` | Seals, stamps, ribbon |
| `--color-vega-claret-deep` | `92 20 20` | `#5C1414` | Claret text on light |
| `--color-vega-claret-bright` | `196 92 92` | `#C45C5C` | Claret legible on night |
| `--color-vega-claret-lift` | `143 42 56` | `#8F2A38` | The mark's lit corner (R23) |
| `--color-vega-oxblood` | `74 14 25` | `#4A0E19` | The mark's deep corner (R23) |
| `--color-vega-ink` | `11 18 32` | `#0B1220` | Raised band surface |
| `--color-vega-ink-soft` | `21 31 51` | `#152033` | Card surfaces on ink bands |

No green anywhere on /vega. No gradient text — the serif carries emphasis.

## Typography

| Role | Face | Token |
|---|---|---|
| Display | Fraunces Variable (incl. italic) | `--font-vega-display` |
| Documents | Times New Roman | `--font-vega-document` (court pleadings render in the face they are filed in) |
| Labels | IBM Plex Mono | `--font-mono` |

## Radius scale

Square. `rounded-` classes are banned on /vega (enforced by test:
`features are a ruled ledger index…not.toContain("rounded-")`).

## P2 refinements (2026-10-13)

- Hero: H1 `clamp(2.75rem, 6.2vw, 5.25rem)`, tightened spacing — H1, sub
  and both CTAs fit the first viewport at 1440x900 and 390x844 (the
  hero CTAs are visible on mobile; the exhibit sits below them).
- Nav labels: "ALL PRODUCTS" and "BY PRACTICEPRO" are 12px minimum,
  slate-300/400 on the night glass (>= 4.5:1).
- Chat button: a square gilt-bordered tile on the night ground.
- Claims: the index line reads COURT RULES · 36 STATES + FCT (code-
  verifiable) instead of the unverifiable 99.9% uptime; "Sign up in
  minutes"; drafting exhibits are labelled ILLUSTRATIVE.
- Routes: every exit route reads from `src/sites/vega/siteConfig.ts`
  (the standalone-domain seam). Cookie/terms restyling keys on
  `body.site-vega` (mirrors the legacy `on-vega-page` hooks).

## Motion rules

- Scroll reveals opt in via `[data-vg-reveal]`; one IntersectionObserver,
  staggered by each element's `--vg-d` delay; a `vg:reveal-all` document
  event force-reveals (used by audits/screenshots).
- `prefers-reduced-motion` users get everything visible immediately (CSS).

## Banned patterns

- Rounded cards, shadows, hover-expand grids (Atrium's register).
- Emerald/primary green anywhere.
- Gradient/clip text; emojis; literal-object iconography.
- Pricing tiers (owner removed them — pricing is sales-led).

## Logo usage

- The **Vega mark** (`src/components/marketing/brand/ProductMarks.tsx`): a
  solid parchment "V" with the star cut into its point as a diamond void,
  on a claret-lift→oxblood lit squircle. SaaS-grade geometric monogram —
  never the old sparkle-star seal.
- Nav/footer lockups: mark + "Vega" wordmark (Fraunces) + "BY PRACTICEPRO".
- Favicons: `/brand/vega/favicon.svg` + `favicon-48.png` + `apple-touch-icon.png`.
