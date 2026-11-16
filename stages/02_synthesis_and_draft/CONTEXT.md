# Stage 02 — Synthesis & Draft (Layer 2 contract)

> Retrieve grounded sources, draft on the model ladder, and keep the draft
> section-addressable so revisions stay surgical.

## Inputs

| Input | Source |
| --- | --- |
| `output/matter-profile.json` | Stage 01 |
| Corpus records | `convex/legalCorpus.ts` (status-aware: in_force / repealed / superseded / monitor) |
| Lawyer feedback | DraftPro edits |

## Process

1. **Grounded retrieval** — corpus search filtered by jurisdiction and
   `status`; tombstoned (repealed/superseded) records excluded unless
   historical analysis is requested. Cause-of-action date respected:
   2022 events query 2022 law; 2026 filings enforce 2026 practice.
2. **Model ladder** — drafting runs pro-first; classification/summarisation
   runs flash (`.agent/rules/model-tiering.md`).
3. **Sectioned drafting** — documents assemble as a tree of section IDs
   (Phase 1 issue spotting → Phase 2 precedent retrieval → Phase 3
   structured assembly: headings, numbered paragraphs, reliefs, signature
   block).
4. **Pointwise revision** — lawyer feedback parses into
   `{ sectionId, instruction }`; re-orchestration touches ONLY the affected
   section. Never regenerate an entire brief for a local edit — token
   divergence is how hallucinations re-enter verified text.
5. Emit `output/draft-sections/` (one Markdown file per section).

## Outputs

| Output | Consumer |
| --- | --- |
| `output/draft-sections/*.md` + `output/draft-manifest.json` (section IDs, sources consulted, tombstone exclusions) | Stage 03 |

## Exit criteria

- Every section lists its consulted sources; no section cites a tombstoned
  authority without an explicit historical flag.
- Revisions are section-scoped; the manifest records which sections changed.
