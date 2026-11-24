# Production Observability — Sentry Activation Runbook

> Status: **owner action required** (2026-11-25). Everything on the code side
> is wired and gated on the presence of the two DSN variables below; nothing
> else needs to change. The DSNs must come from YOUR Sentry account — the
> engineering rule in this repo is that credentials are never fabricated,
> never requested twice, and never committed.

## Current state (honest)

| Surface | State today | Why |
| --- | --- | --- |
| Backend `error_events` table | **Live** — works with zero configuration | `convex/observability.ts` writes every cron/webhook/action error to the table (30-day retention) and surfaces it in-app |
| Frontend Sentry | **OFF** | `VITE_SENTRY_DSN` is not set in Vercel — the bundle carries no DSN, so `initSentry()` logs `[Sentry] No DSN configured` and exits |
| Backend Sentry envelopes | **OFF** | `SENTRY_BACKEND_DSN` is not set on the Convex deployment — backend errors land only in `error_events` |

Reference: the audit finding "Observability Gap (Sentry Silent)" and
`src/utils/sentry.ts` (setup notes verified 2026-11-23).

## Steps (one-time, ~10 minutes)

### 1. Create the Sentry account and projects
1. Sign up at https://sentry.io (free tier is sufficient).
2. Create a project of type **React** → copy its **DSN** (`https://…@o….ingest.sentry.io/…`).
3. Create (or reuse) a project of type **Node / server** → copy its DSN.
   - DSNs are safe to expose client-side; they are not secrets in the
     classic sense, but they are still yours — keep them out of the repo.

### 2. Frontend (Vercel)
1. Vercel → the production project → Settings → Environment Variables.
2. Add `VITE_SENTRY_DSN` = the React DSN, for **Production** (and Preview if wanted).
3. **Redeploy production.** The value is inlined into the bundle at
   `vite build` time — setting it without a rebuild changes nothing.
4. Verify: browser console on the deployed app should now log
   `[Sentry] Crash reporting initialized.` instead of the no-DSN line.

### 3. Backend (Convex)
1. `npx convex env set SENTRY_BACKEND_DSN <node-dsn>` against the production
   deployment (`gregarious-malamute-537`).
2. No redeploy needed — `convex/observability.ts` reads it at runtime and
   starts POSTing error envelopes (best-effort; the `error_events` table
   remains the source of truth either way).

### 4. Verify end to end
1. Frontend: reproduce any error (e.g. a failed network call) → it appears
   under the React project in Sentry within a minute.
2. Backend: check the `error_events` table via the Convex dashboard — rows
   there plus matching Sentry envelopes confirm both legs.
3. `GlobalErrorBoundary` render crashes and the AuthContext user context
   (`setSentryUser` on login / `clearSentryUser` on logout) report
   automatically once the frontend DSN is live.

## What stays the same
- Session replay stays **disabled** on purpose (privacy of legal/financial data).
- Traces sample at 10%; noisy browser/Convex errors are pre-filtered in
  `src/utils/sentry.ts`.
- If either DSN is removed later, the app degrades gracefully to the
  no-DSN state — no code change needed.

## Related owner-only items
- Licensed law-reporting vendor for LawReportsView (NigeriaLII / LawPavilion)
  — a vendor decision, then code wiring.
- Meta's review verdicts on the 10 PENDING WhatsApp templates — Meta's
  reviewers decide; the per-template inspect (`createVegaTemplates`
  `inspect:true`) and the update path are ready either way.
