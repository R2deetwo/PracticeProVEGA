# ADR-0003: Single-repo, dual-build structure (main app + founder app + Capacitor Android), direct-to-main

**Status:** Accepted (structure from project founding; direct-to-main reaffirmed 2026-09-14)
**Date:** retroactively recorded 2026-09-14

## Context

PracticePro ships **four surfaces** from one product: the main web SPA (Vercel + Cloudflare), the main Android APK (sideloaded with an in-app updater), the Founder/Admin app (a separate branded build of the same codebase, `vite.admin.config.ts` + `capacitor.admin.config.ts`, package `com.practicepro.admin`), and the Convex backend. The team is 1–2 people plus AI agents iterating daily. Two structural questions keep coming back from external reviews: (a) should the founder app be a separate repo? (b) should the team move to branch/PR workflow?

## Decision

**One repository.** `src/` carries the shared React codebase; the founder app is a second Vite entry (`src/admin/`) with its own theme, login, and views (`FounderDashboard`, `SalesPipeline`, `FeedbackInbox`, …) reusing all contexts and Convex functions. Android builds come from the same web build wrapped by Capacitor (`android/`), with `resources/founder-icons/` supplying the admin build's icon set. CI (`build-apk.yml`, `build-admin-apk.yml`) publishes both APKs to GitHub Releases; `version.json` + the in-app updater handle distribution.

**Direct-to-main.** Every commit lands on `main` and is gated by the `tests.yml` quality gate (convex typecheck must be 0, root tsc under a shrinking baseline, identity audit, design-token gate, full vitest suite). Every deploy workflow re-runs the same gate inline — a red suite blocks deploys.

## Consequences

- A fix in shared code (messaging, push, portals) reaches the main app, founder app, web, and both APKs in one commit — this repo's history is full of cross-surface fixes that a split repo would have needed five PRs to land.
- The founder app gets product identity (own icon, splash, package name, Firebase app) without code duplication.
- Direct-to-main works **because** the machine gate is strict; the discipline requirement is "never weaken the gate", not "add process".
- Known costs accepted: `main` is always potentially releasable (no long-lived branches), the root `tsc` baseline (126) is technical debt tracked in CI, and dual Firebase app registration is a manual console step (documented in `PUSH_NOTIFICATIONS_SETUP.md`).

## Alternatives considered

- **Separate founder-app repo**: cleaner boundaries, but every shared fix becomes a coordinated cross-repo release — untenable at this team size.
- **Branch + PR workflow**: better audit trail for larger teams; for this project it would add latency without adding safety the CI gate doesn't already provide. (Flagged as a deliberate decision, revisitable if the team grows.)
