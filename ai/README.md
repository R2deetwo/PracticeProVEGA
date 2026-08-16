# AI Agent Architecture — PracticePro
## Van Clief ICM-Inspired Structure

This directory contains the AI agent configuration for PracticePro's AI copilots (ALOA for legal, ARIA for property management).

## Philosophy

Inspired by Jake Van Clief's Interpretable Context Methodology (ICM):
- **Folder structure IS the architecture** — numbered files represent workflow stages
- **Markdown carries the prompts** — editable without code deploys
- **Context IS the orchestration** — no heavy framework code needed

## File Structure

```
ai/
├── README.md                          ← This file
└── prompts/
    ├── 01-aloa-legal-identity.md      ← ALOA system identity (Vega)
    ├── 02-aria-property-identity.md   ← ARIA system identity (Atrium)
    ├── 03-identity-guardrail.md       ← Primary defense against LLM identity drift
    ├── 04-interactive-form-protocol.md ← Anti-interrogation structured data collection
    └── 05-precision-protocol.md       ← Drafting quality standards
```

## How It Works

The numbered files represent the order in which context is injected into the AI system prompt:

1. **Identity Guardrail** (03) — injected FIRST, anchors the AI's identity
2. **Agent Identity** (01 or 02) — ALOA or ARIA depending on product context
3. **Precision Protocol** (05) — drafting quality standards
4. **Interactive Form Protocol** (04) — appended to both agents
5. **Dynamic Context** — dashboard summary, RAG data, conversation memory (injected at runtime by AgencyHub.ts)

## Editing Prompts

To modify AI behavior:
1. Edit the relevant markdown file in `ai/prompts/`
2. The changes take effect on the next app build
3. No code changes needed — the markdown files are the source of truth

## Source Code Mapping

| Markdown File | Source Code File | Function |
|---------------|-----------------|----------|
| 01-aloa-legal-identity.md | `src/agents/AgencyHub.ts` | `getSystemInstruction()` (legal branch) |
| 02-aria-property-identity.md | `src/agents/PropertyManagementAgent.ts` | `getAtriumSystemInstruction()` |
| 03-identity-guardrail.md | `src/constants/identityGuardrails.ts` | `getIdentityGuardrail()` |
| 04-interactive-form-protocol.md | `src/agents/AgencyHub.ts` | `getInteractiveFormDelegationProtocol()` |
| 05-precision-protocol.md | `src/constants/aloaPrompts.ts` | `getAloaProtocol()` |

## Future: Full ICM Migration

Eventually, the source code files should READ from these markdown files at build time, making the markdown the true source of truth and the TypeScript files thin loaders. This would allow non-developers to edit AI behavior.
