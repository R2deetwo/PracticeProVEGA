# ADR-0005: Product identity directions — one design system, three voices

**Status:** Accepted (2026-11-12 — decided by owner delegation after the Phase 0 audit; implementation remains gated on roadmap Phase 3 approval)
**Context:** The Phase 0 UI/UX audit (docs/audits/2026-11-12-phase0-ux-audit.md; report §9, Tables 4–6) found that the three products differ visually only by the primary colour ramp — Vega navy #1E3A8A/indigo, Atrium emerald #059669/jade #0C7A57, Komplete borrowing the hub green #16A34A with no skin class of its own (utils/accentTheme.ts:51-70; index.css:342-381) — while fonts, radius, density and shadows are identical across products. The audit proposed three personality directions and correctly left the choice to the owner. On 2026-11-12 the owner delegated the choice ("you choose for me the three identity directions").

## Decision

Adopt all three proposed directions as the **decided** identity directions. All three ride the ONE existing skin-class token mechanism (`accentTheme` → `app-skin-vega` / `app-skin-atrium` / new `app-skin-komplete`); no second design system, no forked components, no changes to shared spacing, type, a11y or interaction standards. Identity is expressed only through skin-class token values: accent ramp, display face, radius band, surface treatment.

### Vega — "Chambers" (professional, precise, refined, authoritative)

- Navy/indigo ramp stays the structural spine; ink surfaces deepen slightly for authority.
- Gilt accent (existing marketing token, index.css vega triplets) reserved for authority moments only — deadlines, seals, compliance marks — never as a fill.
- Fraunces (`--font-vega-display`, already compiled but marketing-only today) promoted to major screen titles; body stays Figtree at the 12px floor; tabular figures for all money.
- Denser, calmer dashboards: hairline-border KPI cards (the existing edge token), subdued colour except status, FocusMatterWidget as the anchor.
- Sharper radius band (rounded-md/lg — the 20px lg reads casual for an authoritative product); 2px navy left-rule active nav; sidebar group labels 11px uppercase with wider tracking (fixes the 8px slate-400 fail).
- **Vega never uses emerald.** Assistant stays ALOA.

### Atrium — "Estate Office" (calm, contemporary, clear, operational)

- Emerald/jade reserved for positive and actionable states; the existing warm cream/clay marketing tokens (index.css:156-171) become surface colours; every surface light/dark-aware — this is what retires the four hard-dark Financials tabs (UX-08).
- Figtree only; body at the 12px floor; sentence case everywhere (no uppercase group labels); larger type on operational tiles than Vega uses.
- Emerald active pill in navigation; status-first dashboards — occupancy, arrears and service-charge tiles with quick actions attached, OutstandingCard RENT as the anchor; explicit empty/loading states (UX-11/30).
- Warmer radius band (lg); a single soft shadow token (UX-45); status chips with a leading dot; receipts converge on one component and one numbering regime (UX-37).
- **Atrium never uses navy.** Assistant stays ARIA.

### Komplete — "Fusion Desk" (integrated, intelligent, modern, cohesive)

- New `app-skin-komplete` class + a new enum value on the existing `accentTheme` mechanism (today Komplete has neither — it borrows the hub green as the unstyled default).
- Neutral graphite workspace base with dual-accent inheritance: legal surfaces inherit Vega navy, property surfaces inherit Atrium emerald, and unified/cross-product actions (search, scope toggle, unified dashboard, combined KPIs) carry a distinct teal register that sits between the two parents. The company green stays on the hub only.
- Space Grotesk display (the existing app display register) with Figtree body; no serif; money tabular.
- Navigation group labels carry product chips (legal marker, property marker) so both service lines are legible in one sidebar; origin-labelled money everywhere (the V6 invoice origin partitioning is the model); the Financials scope toggle becomes the template for any business-line-scoped control; a combined dashboard view is added (today the toggle shows INV or RENT only, while Financials shows combined — two mental models).
- **Komplete never introduces a third unrelated hue family** — only inherited parent accents plus the teal unified register. Assistant naming follows the active surface (ALOA by default, HelpView.tsx:93 already forks correctly).

## What this decision does NOT authorize

- No implementation now: Phase 0 was investigation-only and this round changes documentation only — no styling, component, navigation or behaviour changes.
- Implementation vehicle: roadmap Phase 3 ("Identity implementation"), which depends on Phase 2 (design-system consolidation) — in particular UX-02 semantic status tokens, which all three directions route status colour through.
- No second design system, no parallel token layer, no product-forked components; every identity expression must land as skin-class token values on the shared component set.

## Consequences

- Phase 3 scope is now unambiguous and estimable: per-product skin extensions (Vega serif titles, Atrium cream surfaces, Komplete skin class) plus the dark-tab re-skins (UX-08/UX-52).
- A decided hue discipline applies to all NEW screens from now: Vega never emerald, Atrium never navy, Komplete only inherited accents + teal unified marks.
- The Fraunces font (already self-hosted and compiled in `.theme-vega`) gains an in-app role instead of remaining marketing-only.
- Komplete stops being the byte-identical unstyled default; it becomes the one surface where both parent accents legitimately coexist, resolving the audit's "no skin class of its own" ambiguity.
- Reversal path is a single ADR reversal; visual tokens only — no data, schema or API impact.
