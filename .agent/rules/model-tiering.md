---
scope: ["src/services/**", "convex/ai.ts", "convex/aiModels.ts", "convex/conversationMemory.ts"]
layer: 3
kind: policy
---

# model-tiering.md — cost/latency ladder (smart routing)

The provider ladder already exists (`src/services/aiProvider.ts`:
purpose → model, fast → strong; `convex/aiModels.ts`: `BACKGROUND_MODEL =
"gemini-3.8-flash"`). New AI surfaces MUST pick a rung deliberately:

| Purpose | Rung | Examples |
| --- | --- | --- |
| Classification, extraction, schema mapping, summarisation | **light/flash** | intent classification, corpus chunk tagging, conversation compression |
| Chat assistance, mid-complexity drafting | **mid** | ALOA/ARIA chat, section redrafts |
| Complex legal drafting, ratio synthesis, final verification gates | **frontier / pro-first** | DraftPro full drafts, verification reasoning |

Rules:

1. Frontier models are reserved for synthesis and final gates. If a step's
   output is a label, a JSON object, or a routing decision — it belongs on
   flash. This is the #1 cost lever for multi-step agent flows.
2. Drafting purposes run **pro-first**; background/scheduled surfaces run
   `BACKGROUND_MODEL`.
3. Never upgrade a rung to "make it smarter" without a measured failure —
   upgrade the prompt or the deterministic table first.
