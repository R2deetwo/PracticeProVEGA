# ALOA / ARIA Identity — Assistant Mark Usage

The AI assistants are **named identities**, not generic "AI" features. Their marks reinforce that identity split, which is a core trust property of the platform (see `ALOAGUIDE.md` — the identity guardrails).

## Identity summary

| Assistant | Product | Personality in copy |
|-----------|---------|---------------------|
| **ALOA** | Vega (legal) | Advanced Legal Office Assistant — precise, cites sources, "your firm's legal intelligence" |
| **ARIA** | Atrium (property) | Always-on property intelligence — portfolio-aware, revenue-minded |

In **Komplete** (unified) contexts both identities may appear, but each keeps its own name and styling — they are never merged into a single generic assistant.

## Mark

The assistant marks use the **initial letter in a rounded container**, set in the brand display face:

- **ALOA:** amber-tinted container (`#D97706` family — the Vega accent) with the letter A; a small spark glyph may accompany it to suggest intelligence
- **ARIA:** emerald-tinted container (`#059669` family — the Atrium accent) with the letter A; same spark treatment

The two marks are intentionally near-identical in geometry — the **color is the product signal**. This mirrors the parent-brand duotone strategy (`COLOR_SCHEME.md`, `PRACTICE_PRO_LOGO.md`): one family, two accents.

## Where the marks appear

- ALOA FAB / chat panel / full-screen AloaX (`src/components/aloa/`)
- Assistant name badges in MessagesView system inbox and matter surfaces
- AIUsageDashboard / AloaUsageCenter (admin analytics — neutral key map, no product color)
- Onboarding and help materials that reference the assistant

## Rules

1. **Name and mark travel together** — never show the mark without the name nearby on first introduction.
2. **Never swap colors** — an amber ARIA or emerald ALOA is a branding defect (this exact class of bug was swept in the Phase-5 audit).
3. **No robot glyphs, no generic "AI" sparks-as-logo** — the identity system deliberately avoids clichéd robot iconography.
4. **Copy rule:** the assistant may describe what it can do, never who it is *not* ("I am not ARIA") unprompted — the guardrail prompts handle identity lock invisibly.
5. **Dark mode:** marks use the same container geometry with adjusted luminance (CSS-variable theming) — no separate asset set needed.

## In code

- Identity logic: `src/agents/AgencyHub.ts` (isAtriumMode branching), `src/utils/assistantIdentity.ts` (`getAssistantName(isProperty)` and related helpers)
- Guardrails: `ai/prompts/03a-aloa-identity-guardrail.md` (ALOA) and `ai/prompts/03b-aria-identity-guardrail.md` (ARIA), loaded via `src/constants/loadPrompts.ts`
- Assistant display names come from the shared helpers — never hardcode "ARIA"/"ALOA" strings in new UI; use the helper so Komplete mode stays correct.
