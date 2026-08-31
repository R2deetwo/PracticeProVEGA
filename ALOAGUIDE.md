# ALOA Guide — The Vega Legal AI Assistant

**ALOA** (Advanced Legal Office Assistant) is the AI copilot for Vega OS. It is the legal twin of **ARIA** (property) — same engine, different identity, different knowledge focus. This guide covers what ALOA does, where to find it, and how it stays safe for legal work.

> For ARIA (the property assistant), the same principles apply — see the identity notes at the end.

---

## Where to find ALOA

- **Floating Action Button (FAB)** — bottom-right chat bubble on any Vega screen
- **ALOA Panel** — slide-in conversation panel for quick questions
- **Full-screen ALOA-X** — deep work sessions (`src/components/indexer/AloaXView.tsx`)
- **Research Mode** — inside Research Studio
- **Header assistant** — the assistant name surfaces in system inbox messages

---

## Core capabilities

| Capability | What it does |
|------------|--------------|
| **Matter Q&A** | Ask questions about your own matters — ALOA queries your matter data and drafts answers with citations to the record |
| **Case summaries** | Instant matter summaries: parties, stage, next deadlines, recent activity |
| **Drafting** | Drafts legal documents into the DraftPro editor (see `PRACTICE_PRO_AND_DRAFTPRO_GUIDE.md`) |
| **Research** | Nigerian precedent research with jurisdiction guardrails (see Research Studio in-app help) |
| **Daily briefing** | Proactive morning briefing: deadlines, court dates, overdue tasks (`convex/proactive.ts`) |
| **Voice dictation** | Notetaker with voice input; dictation runs through the same PII-shielded pipeline |
| **Notes & backlinks** | AI-generated notes link into the bidirectional note graph |

**Research modes:** Auto / Flash / Pro / Research — trading speed for depth. Research mode adds web querying, citation formats (Bluebook/OSCOLA/Nigerian), and reasoning traces.

---

## Identity & guardrails

ALOA never claims to be a lawyer, never gives ungrounded legal advice, and — critically — **never presents itself as ARIA** (or vice versa). Identity locks are enforced in:

- `ai/prompts/01-aloa-legal-identity.md` — the ALOA system instruction (ICM-sourced)
- `ai/prompts/03a-aloa-identity-guardrail.md` — identity lock
- `src/agents/AgencyHub.ts` — builds the system prompt with product-aware branching

**PII Shield:** before any document or note text is sent to the model, the Data Protection agent strips/redacts PII (`src/components/aloa/PIIShieldBadge.tsx` shows the state in the UI). This is NDPA-aligned by design.

**In-memory keys:** the Gemini API key is held in memory only — never persisted to localStorage — so a shared computer cannot leak it.

---

## Conversation memory

ALOA remembers context across sessions per-user (`convex/conversationMemory.ts`). Memory is scoped to the firm and the assistant identity; a Vega user's ALOA memory never bleeds into Atrium contexts.

---

## ARIA (property) differences

| Aspect | ALOA (Vega) | ARIA (Atrium) |
|--------|-------------|---------------|
| Focus | Matters, drafting, precedent, court rules | Properties, rent, defaulters, Nigerian property law |
| Identity prompt | `ai/prompts/01-aloa-legal-identity.md` | `ai/prompts/02-aria-property-identity.md` |
| Guardrail | `03a-aloa-identity-guardrail.md` | `03b-aria-identity-guardrail.md` |
| System prompt builder | `AgencyHub.ts` (isAtriumMode branching) | Same, property branch |

Users on **Komplete** get both assistants with their identities intact — the mode follows the active product context.

---

## Troubleshooting

- **AI features hidden?** `VITE_GEMINI_API_KEY` is unset. Set it and reload.
- **"ARIA" answering in Vega (or vice versa)?** This was a historical branding bug — fixed across all 10 surfaces in the Phase-5 audit sweep. If you see it again, report via Feedback — it is a defect.
- **Web research unavailable?** Research mode's web fetching runs through `convex/webFetch.ts`; connectivity or provider errors surface as a graceful inline notice, never a crash.
