# Stage 03 — Validation & Export (Layer 2 contract)

> The last gate before anything leaves the building: citation audit,
> compliance re-check, human approval for the irreversible, then export.

## Inputs

| Input | Source |
| --- | --- |
| `output/draft-sections/` + `draft-manifest.json` | Stage 02 |

## Process

1. **Citation audit** — the citation-verification skill
   (`.agent/skills/citation-verification/SKILL.md`): parse → classify →
   sequential harness → LePhantomCite 5-point audit. `HALLUCINATED` items
   are removed before render; `UNVERIFIABLE` items render labeled.
2. **Compliance re-check** — `complianceGate.ts` over the FINAL text
   (frontloading bundle complete, signature block carries NBA seal & stamp
   and practitioner details).
3. **Human interrupt-and-resume** — irreversible actions (filing, statutory
   notice service, ledger changes) freeze as
   `SUSPENDED_WAITING_FOR_APPROVAL` and present a review card: proposed
   action, deterministic rationale (rule outputs, engine citations), and
   the section diff. Only authenticated approval resumes
   (`RESUMED_EXECUTING`).
4. **Audit record** — append-only: timestamp, actor, rule outputs,
   verification trace, approver, payload hash.
5. **Export** — render the process (court headings, numbered paragraphs,
   relief clauses, signature block) to the requested channel.

## Outputs

| Output | Consumer |
| --- | --- |
| `output/validation-report.json` (audit results, approvals, hashes) + rendered process | filing desk / client / archive |

## Exit criteria

- Zero unremoved `HALLUCINATED` citations; all `UNVERIFIABLE` labeled.
- Compliance findings addressed or waived by the responsible lawyer.
- Approval signatures present for every irreversible step.
