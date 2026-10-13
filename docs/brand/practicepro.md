# PracticePro — Brand Source of Truth

> The company behind the products. This file is the canonical brand record
> for the PracticePro corporate hub (`/`). Where older docs disagree, this
> file wins. `STYLE_GUIDE.md` and `COLOR_SCHEME.md` colour sections are
> retired in favour of `docs/brand/` (see the pointers there).

## Concept

PracticePro Systems Limited is a Lagos systems studio. It builds and runs
business software: two products of its own — **Vega** for law firms and
**Atrium** for property managers — plus custom systems for clients (Kozy
Care, Woosh). The hub speaks as the COMPANY: it sells the builder, never a
product catalogue, and never looks like a SaaS product page.

- Status: **TARGET (Prompt 1)** — the tokens below are the owner's decided
  direction for the hub redesign. Until Prompt 1 lands, the hub ships the
  current look (Space Grotesk display, brand green, fluid seams).
- Product pages: Vega and Atrium carry their own identities
  (`docs/brand/vega.md`, `docs/brand/atrium.md`) — the hub never borrows them.

## Palette

| Token | Hex | Role |
|---|---|---|
| `--hub-paper` | `#F3F0E8` | Page ground |
| `--hub-ink` | `#14171A` | Text; dark bands |
| `--hub-rule` | `#D8D3C6` | Hairlines, 1px |
| `--hub-mute` | `#5C6258` | Secondary text (must hold 4.5:1 on paper) |
| `--hub-signal` | `#16A34A` | Logo, links, ONE primary CTA per viewport — at most 5% of surface |

## Typography

| Role | Face | Notes |
|---|---|---|
| Display | Archivo Variable | wdth 112–125, weight 700–800 |
| Body | Figtree | |
| Mono | IBM Plex Mono | Labels, section numbers, spec lines |

Self-hosted fonts only (`@fontsource-variable/*`) — no Google Fonts
(the Android APK must render offline; see the comment in `index.html`).

## Radius scale

2px everywhere. No box-shadow except a 1px ink offset on the primary
button hover.

## Motion rules

- One animation max per section; every animation disabled under
  `prefers-reduced-motion`.
- Scroll reveals: plain 200ms opacity fade at most.

## Banned patterns

- Product-page registers on the hub (Vega night/gilt, Atrium emerald).
- Glass cards, `backdrop-blur` surfaces, isometric shape clusters.
- Invented testimonials, ratings or metrics (honest marketing,
  `docs/brand-architecture.md` §4). Every number traces to the repo or is
  labelled "illustrative".
- Google Fonts or any runtime font CDN.

## Logo usage

- The PracticePro `Logo` mark + "Practice**Pro**" wordmark (green accent on
  "Pro") appears in the hub nav and footer.
- Product pages carry the PRODUCT mark in the header (mark + wordmark
  only — no "BY PRACTICEPRO" line, owner R24); the "BY PRACTICEPRO"
  attribution lives in the footer brand column — PracticePro stays the
  parent, never the co-brand on a product page.
