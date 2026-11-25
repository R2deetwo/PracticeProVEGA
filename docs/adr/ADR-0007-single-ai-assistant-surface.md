# ADR-0007: ALOA is the single user-facing AI assistant

**Status:** Accepted (2026-11-25 — owner decision in product review). Phases 1–2 and the Phase 3 product calls implemented 2026-11-25 under the owner's delegation ("go ahead with what you think is best from a product point of view"). Follow-up (same day, owner report): desktop lacked the APK's prominent recording place — the ALOA Vox pill returned to the Sidebar as its own control above the main menu (same entitlement ladder as the bottom-nav tab), and the capture family was dark-mode-uniformized; see Task 92 in the worklog.

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

### Phasing (implemented 2026-11-25 under owner delegation)

- **Phase 1 — one door: DONE.** `AloaFAB` no longer self-hides in `research`/`messaging` (the hide rule is removed); `ResearchChat` presents the one assistant — AloaIcon avatar in the product accent, "`{ALOA|ARIA}` — Research" empty state, and the same identity lock prepended to the research system prompt (`useResearch` → `getIdentityGuardrail`), so the notebook chat answers as the one assistant in research mode, never as a generic second AI.
- **Phase 2 — action legibility: DONE.** All three capabilities are now visible affordances inside Aloa: Vox (header mic → capture mode), DraftPro ("Draft in DraftPro" chip on AI answers + the `start_drafting` tool), and Research — the per-message **Research** chip now shows on EVERY user message (attachments become sources; a plain message seeds the notebook with its own text as a source, capped at 4,000 chars). The hardcoded "ALOA Research —" notebook title now derives from the naming authority.
- **Phase 3 — entry discipline (owner delegated the calls, 2026-11-25):**
  - **The bottom-nav "ALOA Vox" tab stays.** Product judgment: it is Aloa-branded (an entry INTO an Aloa capability, not a second assistant persona), it is the owner-directed explicit way into full-screen capture (2026-11-18), and it is the Free-tier Vox upsell surface — removal would cost flagship-feature discoverability and the monetization funnel for no one-assistant gain.
  - **Research keeps its name** as the destination (workspace name, not an assistant name); the AI chat inside it presents as the assistant in research mode (Phase 1 identity convergence).

## What this decision does NOT authorize

- No removal of the Research workspace, DraftPro editor, Vox capture surface, or ALOA-X — they are destinations, not assistant personas.
- No change to the Free-tier Vox upsell, AI plan gating, or the bottom-nav Vox tab (the delegated Phase 3 call KEEPS it).
- No second assistant identity, name, avatar, or persona in any product; no new chat surface may be added anywhere.

## Consequences

- One assistant identity to maintain: one identity lock (`identityGuardrails`), one consent gate (`aiConsent`), one memory story — instead of Aloa and a parallel research chat with divergent behavior.
- The assistant is reachable from Research and Messaging (FAB no longer self-hides there), which is where legal work most needs it.
- ADR-0005's naming discipline is reinforced rather than changed: the assistant layer is ALOA (Vega/legal, Komplete default) / ARIA (Atrium/property) everywhere it appears.
- Users get a single mental model: start with Aloa → it drafts (DraftPro), researches (Research), or captures (Vox). The destinations stay deep tools; the front door is one.
- Reversal path: a single ADR reversal; UI/branding/entry-layer only — no data, schema, or API impact.
