# _config/system_rules.md — persistent system constraints (The Factory)

These apply to every stage; stage-specific rules live in
`stages/0N_*/references/`.

## Deterministic control plane (the non-negotiables)

- Jurisdiction routing: `src/legal/jurisdictionMatrix.ts` (FHC s.251(1),
  NICN s.254C, State residual — typed rows, NEEDS_REVIEW on anything
  unclassifiable).
- Limitation: `src/legal/limitationEngine.ts` (typed table, Lagos + POPA
  seeded, SAFE_STOP on time-barred, state-verification notes elsewhere).
- Tenancy notices: `src/utils/tenancyNoticePeriods.ts` (general framework +
  encoded Lagos statute; single source for drafting AND countdowns).
- Compliance: `src/legal/complianceGate.ts` aggregating
  `frontloadingGate.ts` (originating-process bundle) and
  `signatureCompliance.ts` (NBA seal & stamp, practitioner details).
- Money: kobo integers, server-computed. Trust ledger never floats.

## Generation contract

- Statutory specifics only from encoded frameworks. Everything else is
  process-level guidance with verify flags.
- The model proposes; the gates dispose. No LLM output reaches a filing,
  notice, or ledger without passing its gate (+ human approval when
  irreversible).

## Quality gates (CI-enforced)

- `npx vitest run` all green; new logic ships with new tests.
- Root tsc under the committed baseline; convex tsc at zero.
- `check-design-tokens.mjs` + `check-ui-primitives.mjs` ratchets never grow.
- `audit-identity.py` must pass — no public function trusts caller identity.

## Update discipline

Rule changes land as code/table edits + tests + worklog entry. No model
retraining, no prompt-only "fixes" for what should be a table row.
