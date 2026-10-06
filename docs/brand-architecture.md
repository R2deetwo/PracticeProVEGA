# PracticePro Systems — Brand Architecture

> Status: **Active standard** (W0 of the website-repositioning program, 2026-10-07)
> Applies to: practicepro.ng public website, product surfaces, legal documents, email footers, structured data.
> Enforced by: `tests/unit/corporateIdentity.test.ts` (legal docs + email footers) and `tests/unit/websiteRepositioning.test.ts` (website + schema).

## 1. The problem this solves

Until October 2026 the public website used **"PracticePro" as if it were the product**.
Visitors saw "Why firms run on PracticePro", testimonials addressed to "PracticePro",
and a single `SoftwareApplication` schema named "PracticePro" — while the company
operates two distinct products. The founder's 2026-09-14 naming complaint (Privacy
Policy reading "PracticePro (also known as 'PracticePro VEGA')") was the same class
of defect: the company treated as an alias of one of its products.

## 2. The naming model (single source of truth)

| Layer | Name | Notes |
|---|---|---|
| **Company** | **PracticePro Systems Limited** ("PracticePro" short form) | Lagos, Nigeria. The builder. |
| **Products** | **PracticePro Vega** — legal practice OS | Short form "Vega". Amber `#D97706`. |
| | **PracticePro Atrium** — property management OS | Short form "Atrium". Emerald `#059669`. |
| | **Komplete** — the Vega + Atrium bundle | For real-estate attorneys. |
| **AI assistants** | **ALOA™** (Vega only) · **ARIA™** (Atrium only) | Never cross-assign. |
| **Bespoke work** | PracticePro Bespoke Systems | Custom automation engagements. |

## 3. Attribution rules

1. **"Built by PracticePro"** is the product→company attribution mark. It appears:
   - on each product page hero (eyebrow: `VEGA · BY PRACTICEPRO`),
   - in the site footer ("Vega and Atrium are built by PracticePro Systems Limited"),
   - in structured data (`publisher` = PracticePro Systems Limited on every product node).
2. The **hub (practicepro.ng root) speaks as the company**: "PracticePro Systems"
   eyebrow, company sub-copy, products presented as the company's products.
3. **Product surfaces name the product**, not the company: "Why firms run on Vega",
   never "…run on PracticePro". The company answers "who builds it", the product
   answers "what you use".
4. Short form "PracticePro" may stand alone only where the company is meant
   (navbar wordmark, "Built by PracticePro", copyright line).

## 4. Honest-marketing rules (P8 of The PracticePro Standard)

- **No fabricated testimonials.** Named quotes with star ratings must come from
  real, consenting customers. Until real ones exist, the website uses verifiable
  capability statements instead (W3 replaced the six invented personas on
  2026-10-07).
- **No fabricated structured-data ratings.** `aggregateRating` in JSON-LD is only
  permitted when backed by a real review surface. The 4.8/127 figure was removed
  with the W4 schema rewrite.
- Claims on the website must be checkable against shipped product behaviour
  (e.g. "ARIA applies the tenancy law of the state where each property is
  located" — true, see `NigerianLegalJurisdictionAgent`).

## 5. Structured-data shape (W4)

- One **Organization** node: PracticePro Systems Limited, Lagos NG, `practicepro.ng`.
- One **SoftwareApplication** node per product — "PracticePro Vega", "PracticePro
  Atrium" — each with its own NGN offers and `publisher` → the Organization.
- Komplete appears as an offer of Vega ("Komplete — Vega + Atrium bundle").
- FAQPage schema mirrors only factually-true FAQ answers.

## 6. Website change inventory (W1–W5, landed 2026-10-07)

| Stage | Change | Files |
|---|---|---|
| W1 | Hub speaks as the company (eyebrow + sub-copy); footer brand block + Products column | `src/components/LandingPage.tsx` |
| W2 | Product-hero attribution eyebrows; product-named section headers; footer attribution line | `src/components/LandingPage.tsx` |
| W3 | Fabricated testimonials → verifiable capability section ("Built for Nigerian practice") | `src/components/LandingPage.tsx` |
| W4 | Organization + per-product schema; aggregateRating removed; OG/title aligned | `index.html` |
| W5 | Regression pins + gates + ship | `tests/unit/websiteRepositioning.test.ts` |
