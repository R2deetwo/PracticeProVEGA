# CONTEXT.md — Workspace Routing (Layer 1)

> Where do I go for this task? Map task type → destination. Keep under
> ~300 tokens; details live one level down.

| Task type | Go to | Notes |
| --- | --- | --- |
| Legal-engine rule change (jurisdiction, limitation, notices, compliance) | `stages/01_intake_and_rules/` | Edit the typed tables, never the prose. |
| Corpus / citation / RAG work | `stages/02_synthesis_and_draft/` + `convex/legalCorpus.ts` | Ingestion bridge + verification harness live here. |
| Drafting, revision, document assembly | `stages/02_synthesis_and_draft/` | DraftPro + model ladder. |
| Verification, audit, export, human approval | `stages/03_validation_and_export/` | LePhantomCite audit is the last gate before render. |
| Landing-site copy / assistant panel | `src/sites/` | Assistant = product pages only (Vega/Atrium). |
| Convex schema / mutations | `convex/` | Server-enforced RBAC + state machines. |
| Styling / UI primitives | `src/components/ui/`, `src/index.css` | Ratchets: `scripts/check-*.mjs`. |
| Tests | `tests/unit/` | One file per round; keep 100% green. |
| Build/deploy plumbing | `.github/workflows/`, `scripts/` | Promote is pinned-SHA, human-dispatched. |
| Naming/branding of any user-visible surface | `docs/brand-architecture.md` | PracticePro = the company; Vega/Atrium = the products. Enforced by `tests/unit/brandClarity.test.ts`. |

## Stage flow

```
01_intake_and_rules ──▶ 02_synthesis_and_draft ──▶ 03_validation_and_export
   (deterministic)          (retrieval + LLM)           (audit + human + export)
```

Each stage consumes the previous stage's `output/` as its input. Outputs are
plain Markdown/JSON — a human can edit any intermediate artifact between
stages.

## Update tiers (zero retraining)

- **Tier A** — routing/inputs change → edit `stages/0N_*/CONTEXT.md`.
- **Tier B** — business/legal constraints change → edit `_config/` or
  `stages/0N_*/references/`.
- **Tier C** — path/boundary rules change → edit `.agent/rules/*.md`.

All three take effect on the next run — no build, no model retraining.
