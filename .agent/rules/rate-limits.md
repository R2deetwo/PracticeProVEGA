---
scope: ["convex/http.ts", "convex/legalCorpus.ts", "scripts/**"]
layer: 3
kind: policy
---

# rate-limits.md — upstream 429 normalization

External legal data sources (CourtListener, licensed reporters, CAC/SEC
portals) enforce rate limits. Normalize before any retry decision:

1. **Parse once, standardize everywhere.** Convert every upstream response
   into `ratelimit-limit`, `ratelimit-remaining`, `ratelimit-reset` headers
   (or the equivalent fields in the job record) at the boundary layer —
   jobs and UIs consume only the normalized shape.
2. **Two retry policies.**
   - *Background sync / ingestion jobs*: exponential backoff keyed to
     `ratelimit-reset`; jobs are resumable and idempotent (dedup by
     sourceUrl/citation hash).
   - *Real-time user queries*: **fail fast** with actionable UI messaging
     ("quota exhausted, retry at HH:MM") — never queue a human wait behind
     a backoff loop.
3. **Reflexion, not blind retry.** A failed step logs a structured
   reflection (`"lookup failed: missing pincite; falling back to open web
   search"`) and retries with the reflection in context, max 3 attempts —
   then surfaces the failure honestly.
4. **Circuit breaker.** Three consecutive 5xx/429 from one upstream parks
   that source for the job's remainder and marks the job degraded, not
   failed.
