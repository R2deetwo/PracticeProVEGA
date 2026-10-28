# DESIGN.md — the PracticePro house design system (locked R37)

This file is the contract. Every round of design or copy work on this repo
obeys it. If a change violates a rule here, the change is wrong — not the
rule. (Established R37, "The Daylight Chambers", 2026-10-28.)

## 0. The one-line law

Warm paper, espresso ink, one accent per surface, an editorial serif doing
the talking — never the statistical average of AI-generated landing pages.

## 1. Surfaces and their registers

| Surface | Route | Register | Accent |
|---|---|---|---|
| Corporate hub | `/` | Paper + moss, the builder's studio | Moss/emerald (existing) |
| **Vega** | `/vega` | **Daylight Chambers (R37)** — warm ivory law library by day | **Notary claret** |
| Atrium | `/atrium` | Well-Kept Estate — photo-led, warm | Emerald `#059669` |

The logo system stays as-is (owner direction R37). Products may be named
in the "Our Work / systems we've built" surfaces and on the product pages
themselves — never inside the hub's capability sections, which sell what
we can build for THE VISITOR'S business, not our catalogue.

## 2. Vega — "The Daylight Chambers" (R37) exact values

All Vega tokens live in `src/index.css` under `.theme-vega` / `.site-vega`
(`--color-vega-*`). Do not invent new colors; re-use these tokens.

### Palette

| Token | Hex | Role |
|---|---|---|
| `--color-paper` | `#F5EFE3` | Page ground — warm ivory, never stark white |
| `--color-ink` | `#2A2118` | Display + body ink — espresso, never pure black |
| `--color-vega-gilt` | `#7B1E1E` | THE accent: notary claret — rules, fills, rings, CTA fills |
| `--color-vega-gilt-bright` | `#8E261E` | Claret type register on the ivory ground |
| `--color-vega-claret-bright` | `#C45C5C` | Lit claret — legible accent type on espresso interludes |
| `--color-vega-night` | `#22170F` | Espresso chrome: masthead, ledger band, deep footer |
| `--color-vega-night-2` | `#382A1C` | Raised dark panels (the evening exchange, dropdowns) |
| `--color-vega-parchment` | `#FBF6EC` | Cream card stock on the ivory ground |
| `--color-vega-ink-soft` | `#6E5C4A` | Taupe body type on cream stock |

The espresso side is RATIONED to measured interludes (masthead, matters
ledger band, the two ink bands, deep footer). The page reads as daylight;
drama is an accent, not the ground.

### Typography (all self-hosted via @fontsource — no Google CDN)

| Voice | Stack | Use |
|---|---|---|
| Display | `Fraunces Variable` (`--font-vega-display`) | Every Vega headline; weight 600; ONE italic Fraunces flourish per headline, in claret |
| Body/UI | `Figtree` (`--font-sans`) | Body copy, controls, nav |
| Micro/data | `IBM Plex Mono` (`--font-mono`) | Eyebrows, captions, timestamps, ledger numerals |
| Documents | `Times New Roman` (`--font-vega-document`) | The pleading exhibits only |

Scale: hero `clamp(2.75rem, 6.2vw, 5.25rem)`; section heads `text-3xl → text-5xl`;
body `text-base/lg` at `leading-[1.65–1.75]`. Mobile hero floor `2.5rem`.

### Radius, borders, shadows

- Radius: pills (`rounded-full`) for CTAs and tabs; `rounded-xl/2xl` only
  on card stock and the product chrome. Never round every container.
- Borders: 1px hairlines — `rgb(vega-night / 0.10–0.26)` on ivory,
  `white/10` on espresso. Rules are quiet; the claret hairline under
  section heads (`vg-rule-h`) is the signature.
- Shadows: warm-tinted only (`rgb(42 33 24 / …)`), long and soft.
  No black shadows, no colored glows.
- Atmosphere: paper grain at 0.04 multiply; hero/CTA washes at 0.05
  claret/ink alpha. A wash, not a lamp — no vignettes, no glows, no orbs.

## 3. Anti-slop restrictions (STRICT — every surface)

- NO purple/blue-indigo anything, rainbow accents, neon glows, glowing
  orbs or floating lights. One accent per surface, used sparingly.
- NO Inter, Geist or Space Grotesk on `/vega` (Fraunces + Figtree there).
  Hub display may keep Space Grotesk until its own re-theme round.
- NO pure black on white, or white on pure black — espresso on ivory.
- NO bento-grid monotony, default 3-column feature cards, decorative
  terminal windows, dot grids, sparkles/stars.
- NO liquid-glass everything, cards inside cards, or rounded corners on
  every single container.
- NO fabricated social proof: no star ratings, anonymous quotes, or
  client logos that are not real and ours.
- NO emoji as UI bullets. Icons only where they clarify an action
  (custom wireframe/iso shapes + the shipped icon set; no Lucide on
  marketing surfaces).
- NO fake screenshots — exhibits are real UI, labeled honestly
  ("illustrative" where synthetic).
- Motion: state transitions and scroll reveals only, 150–320ms; no
  scroll-jacking, no parallax circus, no unnecessary ambient animation.
  Respect `prefers-reduced-motion`.

## 4. Copy rules

- Direct, benefit-focused, workflow-specific. Say what the user's day
  looks like; never "the future of productivity".
- No product names in the hub's capability sections ("What we can
  build for you" sells the visitor's system; "Our Work" is where
  Vega/Atrium/Kozy Care live and are proven).
- Prefer em-dash-free constructions in NEW copy; never the formula
  "not X — Y" twice in a row.
- One primary focal point per section; one CTA voice per page.
- Micro-copy in mono uppercase with wide tracking reads as archival
  labelling — use it, don't abuse it.

## 5. Accessibility floors (non-negotiable)

- Body text ≥ 4.5:1 contrast; large display ≥ 3:1. Claret on ivory and
  lit-claret on espresso are the sanctioned pairs; test anything new.
- Tap targets ≥ 44px; visible keyboard focus rings (claret register);
  roving tab focus on persona/segment tab rows (arrow keys).
- No horizontal overflow at any width ≥ 360px (grid items get `min-w-0`
  when they hold text — the R37 hero lesson).
- Every interactive control is a real `<button>`/`<a>` with an accessible
  name; decorative art is `aria-hidden`.

## 6. How to change this file

Design direction changes come from the owner. When one lands, re-value the
tokens in `src/index.css` (same token names — tests pin class strings,
not values), update this file in the same commit, and append the round to
`worklog.md`.
