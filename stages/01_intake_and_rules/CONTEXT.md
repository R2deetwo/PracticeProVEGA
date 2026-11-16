# Stage 01 — Intake & Rules (Layer 2 contract)

> What am I supposed to do here? Deterministic intake: classify the matter,
> run the rule engines, and emit a matter profile the next stages can trust.

## Inputs

| Input | Source | Shape |
| --- | --- | --- |
| Matter brief | intake form / client message | free text + structured fields |
| Jurisdiction facts | matter fields | state, subject matter, parties |
| Cause-of-action date | matter fields | ISO date |

## Process (all deterministic — no LLM in this stage)

1. `jurisdictionMatrix.ts` → forum routing (FHC / NICN / State HC) or
   `NEEDS_REVIEW`. Unclassifiable is a valid answer; never guess.
2. `limitationEngine.ts` → period from the typed table, deadline from
   accrual, `SAFE_STOP` if time-barred (equitable exceptions surfaced).
3. `tenancyNoticePeriods.ts` (property matters) → notice period + basis +
   verify-state-statute flag (encoded Lagos; framework elsewhere).
4. `complianceGate.ts` → frontloading bundle checklist + signature block
   (NBA seal & stamp, practitioner details) advisory findings.
5. Assemble everything into `output/matter-profile.json`.

## Outputs

| Output | Consumer | Editable? |
| --- | --- | --- |
| `output/matter-profile.json` — forum, limitation status, notice basis, compliance findings | Stage 02 | yes — a lawyer may correct classification before drafting |

## Exit criteria

- Forum resolved or explicitly `NEEDS_REVIEW`.
- Limitation computed with cited basis (or SAFE_STOP raised).
- No stage-02 work begins on a matter whose profile is empty.

## References

- `references/engine-map.md` — where each rule lives and how to add a row.
- `_config/system_rules.md` — the non-negotiables.
