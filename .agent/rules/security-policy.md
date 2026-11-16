---
scope: ["**"]
layer: 3
kind: hard-rule
---

# security-policy.md — the security spine

1. **Identity is server-side.** No public Convex function trusts
   caller-supplied identity — enforced by `scripts/audit-identity.py` in CI.
2. **Secrets never transit code, URLs, or the client.** Deployment keys are
   GitHub secrets; keys seen in chat are rotated after the engagement.
3. **State machines are server-enforced.** Lifecycle transitions (matter
   status, tenancy notices, refunds, refunds approval) validate in the
   mutation — the client only requests.
4. **Audit everything consequential.** Append-only audit entries
   (`convex/aiAudit.ts` + mutation-level audit trails) record timestamp,
   actor, rule outputs and payload hash. NIST AU-12 spirit.
5. **Human-in-the-loop for the irreversible.** Filing, statutory notices,
   rent-ledger alteration and refunds pause for an authenticated approver
   before execution. A structured review card shows the proposed action,
   the deterministic rationale, and the diff.
6. **Ephemeral context is burnable.** Unfiled draft buffers live in volatile
   session state; on session end they are deleted transactionally
   (retryable), never left in KV cache or logs.
