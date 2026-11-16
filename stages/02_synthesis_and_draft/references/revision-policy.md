# revision-policy.md — pointwise revision agent (Stage 02 reference)

## The rule

A revision request NEVER triggers full-document regeneration.

1. **Parse** the lawyer's feedback into `{ sectionId, instruction }[]`.
2. **Re-orchestrate** only the affected sections with the same retrieval
   scope (same matter profile, same corpus filter) so the rewrite stays
   anchored to what was verified.
3. **Diff-preserve** — untouched sections carry over byte-identical; the
   manifest lists changed section IDs.
4. **Escalation guard** — a revision that would touch >30% of sections is
   proposed as a re-draft (new run of Phase 1-3), and requires explicit
   lawyer confirmation.

## Why (the failure mode this prevents)

Regenerating 100+ pages for a paragraph edit re-rolls token probability
across already-verified text: pincites drift, quotes subtly mutate, and the
Stage 03 audit then fails on text the lawyer never asked to change.
