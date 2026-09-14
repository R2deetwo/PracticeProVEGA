# ADR-0001: Convex as the backend platform

**Status:** Accepted (project founding decision; reaffirmed every deploy)
**Date:** 2026-06 (retroactively recorded 2026-09-14)

## Context

PracticePro needs a backend for a two-product SaaS (Vega legal, Atrium property) with: real-time data sync to a React SPA and Capacitor Android apps, file storage, scheduled jobs (rent/service-charge reminders, dunning, wallet auto-deduct), third-party webhooks (Paystack, Sentry, WhatsApp gateway), and server-side secrets (Paystack, Brevo, Chakra, Gemini, FCM service account). The team is tiny and ships daily; ops burden must be near zero. An earlier iteration of the product line used Prisma + a conventional SQL database (`prisma/schema.prisma` still exists as a vestige).

## Decision

Use **Convex** (convex.dev) as the sole backend: typed TypeScript functions (`convex/` directory), its document database, `internalQuery`/`internalMutation` for server-only paths, scheduler + crons for jobs, actions with `"use node"` for anything needing Node APIs (FCM JWT signing, PDF work), file storage, and environment variables for secrets. The Vercel/Cloudflare frontends call Convex directly from the client via `convex/react`.

## Consequences

- **Real-time for free** — every list/detail view is a live query; the push-notification and messaging features lean on this.
- **One language, one deploy** — `npx convex deploy` runs from CI; the `tests.yml` gate runs `tsc -p convex --noEmit` because a Convex type error freezes backend deploys (it once did for weeks — Round 6).
- **Transactions are real** — all-or-nothing message+notification writes and the automation dispatch ledger rely on Convex transactional mutations.
- **Constraints accepted:** no raw SQL (aggregations are hand-rolled), table-scanned cleanup jobs, and generated-code regeneration needs a deployment link (CI regenerates on deploy).
- Prisma remains unused and can be removed in a later cleanup.

## Alternatives considered

- **Prisma + Postgres + an API server**: more conventional, but doubles the surface to build, host, and secure; real-time would need extra plumbing (websockets/SSE).
- **Supabase/Firebase**: closer fit, but weaker typed-server-function ergonomics and worse fit for the "mutations as the only write path" security posture this codebase enforces (Round 8/16 identity hardening).
