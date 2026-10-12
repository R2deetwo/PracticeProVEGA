# PracticePro Systems — Brand Rationale

> Status: **Active standard** (Phase 1 of the brand overhaul engagement, 2026-10-12)
> Applies to: every public surface (practicepro.ng hub, /vega, /atrium, auth), the product UI (Vega, Atrium), both Android APKs, OG/social cards, email.
> Sits above: `docs/brand-architecture.md` (naming), `docs/design/TOKENS.md` (token inventory), `docs/adr/ADR-0004-ui-primitives.md` (primitives).
> This document is the *why*. The others are the *what*.

---

## 1. Positioning (one paragraph)

PracticePro Systems builds software for Nigerian professionals whose practices have outgrown
chat threads and spreadsheets — the law firm where every matter lives in a WhatsApp thread,
the property manager tracking dozens of tenancies by memory, the clinic, pharmacy and school
doubling in customers while their admin systems stay manual. What they fear is not technology;
it is **chaos compounding**: missed limitation dates, lost tenancy files, money leaking through
untracked invoices, a reputation cracking under scale. PracticePro's promise is not a tool they
must figure out — it is **"we design, build and run the operating system your practice scales on."**
The company takes responsibility for the system working (it runs what it builds), which is why
every claim on the site must be checkable against shipped behaviour. The visitor is not buying
software features; they are buying the end of operational chaos.

## 2. Brand adjectives

**Must feel:** **Engineered** (systems, structure, precision — things built to keep running),
**Assured** (calm confidence, plain speech, no hype), **Local** (built in Lagos, fluent in
Nigerian practice — tenancy law per state, NDPA, WhatsApp-first commerce).

**Must never feel:** **Trendy** (crypto glows, startup superlatives, novelty gradients),
**Loud** (amber splashed on the hub, ALL-CAPS urgency, exclamation marks), **Generic**
(template SaaS look, interchangeable with any foreign product, stock-photo Nigeria).

## 3. The one thing (5 seconds on the homepage)

> **"This company builds serious systems that will still be running my practice in five years."**

Not curiosity about features. Not admiration of visuals. *Trust in the engineering and its
longevity.* Every design decision below is judged against whether it builds or erodes that belief.

---

## 4. The brand module

### 4.1 Colour — the Green Ramp carries the promise

| Role | Token | Value | Rules |
|---|---|---|---|
| **The Green Ramp** (the promise) | `--ramp-mint` | `#6EE7B7` | Gradient stops for the scaling-promise headline and the primary CTA fill. Nowhere else. |
| | `--ramp-emerald` | `#34D399` | |
| | `--ramp-green` | `#4ADE80` | |
| **Brand primary** (moss / favicon) | `primary-500` | `#16A34A` | Interactive green: buttons, links, focus, active states. |
| **Deep ink** | `--ink-deep` | `#070D18` | Hero base and the darkest stage surfaces. Depth = engineering. |
| **Paper / sage** | `--color-paper` / `--color-sage` | `#FBFBF9` / `#EEF2EB` | Light landing surfaces. Warm, not clinical white. |
| **Vega identity** | `--color-amber` | `#D97706` | **Product surface only** (Vega pages, Vega in-app accents). Never hub decoration. Enforced by `websiteRepositioning` pins. |
| **Atrium identity** | `--color-emerald` | `#059669` | Product surface only (Atrium). |

**Gradient sanction:** exactly two gradients exist in the brand. (1) The all-green ramp on the
scaling-promise headline ("scale your [noun]", W17/W18). (2) The primary CTA's ramp fill.
Everything else is flat colour. No purple/blue, no decorative fades, no gradient borders.

**Shadow sanction:** elevation is **neutral and dark-only** — the four `elevation-*` levels.
**Coloured shadows are banned** (the current green CTA glow is retired by this document).

### 4.2 Type — the engineered voice, the human hand, the ledger

Three faces, three registers:

| Face | Token | Register | Used for |
|---|---|---|---|
| **Space Grotesk** | `--font-display` | The engineer's voice — squared, deliberate | Headlines, section titles, stat numerals on public surfaces |
| **Figtree** | `--font-sans` | The human hand — warm, open, highly legible | All body copy, app UI, forms, tables (replaces Inter; Inter reads "default", which is the enemy) |
| **IBM Plex Mono** | `--font-mono` | The ledger — records, references, receipts | Eyebrow kickers, IDs, codes, prices, timestamps, data readouts |
| *Dancing Script* | — | Signature rendering **utility** | Only where a human signature must render (SignDocumentModal). Not brand typography; never on marketing surfaces. |

Modular scale: the enforced 8-step scale in `tailwind.config.ts` (8/10/12/14/16/18/20/24/30px)
stays. Body copy is never below `sm` (14px). Display tracking tightens as size grows
(-0.01em at 18px → -0.03em at 30px); labels kickers track *wide* (+0.05-0.3em) and render in
mono uppercase. The hero H1's exact ramp (2.25rem → 5rem) is locked by the W17/W18
measuring-slot machinery and is not part of redesignable surface.

### 4.3 Shape — drawn, not inflated

Three radii, already enforced: **6px** interactive (buttons, inputs, badges), **12px** containers
(cards, modals, banners), **20px** stage surfaces (hero/landing cards); 24px reserved for hero
cards only. Justification: Nigerian professional software must feel precise and durable —
machined corners, not inflated bubbles. Nothing above 24px. No fully-rounded "pill everything".

### 4.4 Elevation & depth

Four neutral levels (`elevation-1` buttons at rest → `elevation-4` floating layers), never
coloured. On dark stages, depth comes from the ink ladder (#070D18 → surfaces at 4-8% white
overlays), not from shadows.

### 4.5 Motion — purposeful, staggered by hierarchy

Two sanctioned signature motions: the **cycling noun** (380ms blur/slide exchange in the hero)
and the **living lattice** (WebGL scene, one slow settle on entry). Section entrances stagger
by hierarchy (kicker → headline → body → CTA), never a uniform fade-up on everything. All
motion respects `prefers-reduced-motion`. Durations live on the existing `--duration-*` tokens.

### 4.6 Voice — plain, assured, Nigerian-fluent

- Verifiable claims only (the P8 honest-marketing rule: no fabricated testimonials or ratings).
- Plain sentences over superlatives: "the system that takes over", never "revolutionary AI-powered platform".
- Practice-fluent nouns: tenancy, limitation date, tenancy law of the state where each property is located, receipts, invoices.
- No emoji in UI copy. No exclamation marks in marketing copy.

## 5. Deliberate exceptions to the engagement's anti-pattern list

1. **Gradient text is kept — sanctioned by this module** (§4.1) for the scaling-promise
   headline and CTA fill only. It is the brand's single visual signature, refined over
   W16-W18, and the engagement brief permits gradients the brand module explicitly calls for.
2. **The centered hero is kept.** It is not the default pattern the anti-pattern warns about:
   it was shaped by owner direction across W14 (product links removed from hero), W17
   (gliding noun slot, line-count locked) and W18 (per-span gradients). The eyebrow is a
   mono kicker, not a pill badge; the two CTAs are owner-specified actions. Layout parity
   with shipped, owner-approved work outranks pattern-book conformity.
3. **Inter is replaced by Figtree** app-wide (§4.2) — the anti-pattern is honoured.

## 6. What this means for each surface (priority order)

1. **Hub landing** — the company's handshake: ink stage, ramp promise, mono kickers, neutral
   elevation. The engineering-credibility surface.
2. **Product pages (/vega, /atrium)** — product identity accents (amber / emerald) live here
   and only here, inside the same structural system.
3. **Auth** — the first moment of trust: calm, minimal, the system already feels built.
4. **App surfaces (Vega / Atrium UI)** — carried first by the token layer (fonts, semantic
   colours, elevation), then refined surface-by-surface in later passes.
