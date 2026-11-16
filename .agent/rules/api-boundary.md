---
scope: ["convex/**", "src/services/**", "src/legal/**"]
layer: 3
kind: hard-rule
---

# api-boundary.md — AI transport and corpus access rules

1. **Session-gated AI.** Every `/ai/*` route and `ai.*` Convex action must
   resolve an authenticated caller (`convex/callerAuth.ts`). The platform
   Gemini key never funds anonymous traffic (H18). The public website
   assistant is scripted guidance + human handoff — not a live model call.
2. **Keys ride headers, never URLs.** `x-goog-api-key` transport only
   (Round S2). Any new external API integration must follow the same rule.
3. **Firm isolation.** AI features resolve the caller's firm server-side and
   scope every query/mutation to it. `organizationId`-style filtering is
   applied in the Convex layer, not by client-supplied parameters.
4. **Corpus honesty.** Nothing may be presented as authority-verified until a
   licensed corpus backend is connected to
   `src/legal/citations/verificationHarness.ts`. Until then the honest result
   is `UNVERIFIABLE` with an explanation — that is a feature, not a failure.
5. **No direct LLM mutations.** Generative output is data for a deterministic
   gate to validate; state changes happen only in hardened Convex mutations
   after validation passes (and after human approval where irreversible).
