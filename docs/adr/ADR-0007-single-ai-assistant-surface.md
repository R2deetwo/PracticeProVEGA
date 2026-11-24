# ADR-0007: ALOA is the single user-facing AI assistant

**Status:** Accepted (2026-11-25 — owner decision in product review; implementation phased, not yet scheduled)

**Context:** The product currently presents several AI faces to a user in the same session:

- The **ALOA copilot** — `AloaFAB` → `AloaPanel` (`chat` | `capture` modes) → `AloaChat`, with the `start_drafting` tool, per-message "Send to Research Studio", and the "use voice instead" hand-off.
- The **Research view's own chat** — `ResearchChat` (the AI Notes tab) is a second conversation surface with its own generic blue-dot branding, not Aloa-branded, running its own prompt/identity.
- **ALOA Vox** — already Aloa-branded and mostly Aloa-routed: the Header mic opens the Aloa panel in capture mode (`openAloaPanel('capture')`, Header.tsx), the panel has a capture mode, AloaChat hands off to it; the ONE standalone entry is the bottom-nav `quickCapture` tab (owner addendum 2026-11-18, "the explicit way IN"), which is also the Free-tier `VoxUpsellModal` monetization surface.
- **ALOA-X** — the indexer surface, sidebar-gated for high tiers.

Much of the intended end-state already exists: DraftPro's canonical entry is Aloa's `start_drafting` (every other path routes through `openDraftProNewTab`); Research is reachable from Aloa; Vox's non-nav entries all go through the Aloa panel. The two real gaps:

1. `AloaFAB` **hides itself in `research` and `messaging`** (AloaFAB.tsx) — the one assistant door disappears exactly where Research's own AI chat lives, so the user meets the second face instead.
2. `ResearchChat` presents a **second assistant conversation** with its own identity — the user cannot tell it is the same assistant doing research, and it does not share Aloa's identity lock/guardrails presentation.

## Decision

Owner direction (2026-11-25): **Aloa is the only user-facing AI assistant.** Research, DraftPro, and Vox remain available as actions inside Aloa — one place to start, no capability lost. On Atrium surfaces the assistant remains ARIA per ADR-0005's product naming discipline (ADR-0005: "Assistant stays ALOA" for Vega; "Assistant stays ARIA" for Atrium).

Concretely:

- No surface other than Aloa/ARIA presents an assistant persona, chat identity, or name. Research's AI Notes chat is presented as **Aloa doing research** (Aloa identity, identity guardrails, consent gate) — a mode of the one assistant, not a second assistant.
- DraftPro, Research, Vox, and ALOA-X remain **destination surfaces** (editor, workspace, capture, library). The decision governs the assistant layer and entry discipline — it does not collapse workspaces into the chat.
- Every view where a user might "start with AI" shows exactly one assistant door: the FAB (and its desktop equivalents) is reachable in `research` and `messaging` too.

### Phasing (implementation TBD — next scheduled task)

- **Phase 1 — one door:** un-hide the FAB in `research`/`messaging`; converge ResearchChat's presentation onto the Aloa identity (name, icon, guardrail-visible behaviors); naming sweep so ALOA-X reads as an Aloa capability.
- **Phase 2 — action legibility:** the three capabilities appear as explicit, visible affordances inside Aloa (Research / DraftPro / Vox), formalizing what already exists as tools (`start_drafting`, send-to-research, capture mode) so users can see the actions, not just discover them by conversation.
- **Phase 3 — entry discipline (owner calls required before work):** the fate of the standalone bottom-nav `quickCapture` tab — it is simultaneously (a) the explicit Vox entry the owner directed on 2026-11-18 and (b) the Free-tier Vox upsell surface, so removal/re-routing is a monetization decision, not an engineering one; and Research's sidebar/nav wording under the converged identity.

## What this decision does NOT authorize

- No removal of the Research workspace, DraftPro editor, Vox capture surface, or ALOA-X — they are destinations, not assistant personas.
- No change to the Free-tier Vox upsell, AI plan gating, or the bottom-nav Vox tab without an explicit owner call (Phase 3).
- No second assistant identity, name, avatar, or persona in any product; no new chat surface may be added anywhere.

## Consequences

- One assistant identity to maintain: one identity lock (`identityGuardrails`), one consent gate (`aiConsent`), one memory story — instead of Aloa and a parallel research chat with divergent behavior.
- The assistant is reachable from Research and Messaging (FAB no longer self-hides there), which is where legal work most needs it.
- ADR-0005's naming discipline is reinforced rather than changed: the assistant layer is ALOA (Vega/legal, Komplete default) / ARIA (Atrium/property) everywhere it appears.
- Users get a single mental model: start with Aloa → it drafts (DraftPro), researches (Research), or captures (Vox). The destinations stay deep tools; the front door is one.
- Reversal path: a single ADR reversal; UI/branding/entry-layer only — no data, schema, or API impact.
