# PracticePro — SaaS Hardening Plan (Rounds 10–17)

> Created after the 9-round simplification audit closed (see worklog.md
> Task IDs 5–12). This is the follow-up program: close the SaaS-grade
> gaps in identity, testing, revenue, environments, and operations.
>
> **Protocol for every round** (non-negotiable, stronger than the audit
> rounds): `npx tsc -p convex --noEmit` = 0 errors → root `tsc --noEmit`
> ≤ 126 baseline → **full test suite green** → push → CI green →
> **direct live probe** (never trust the deploy step) → worklog entry.
> Every round ships its own tests and a documented rollback path.
>
> **Standing rule from Round 6:** the Convex deploy step is
> `continue-on-error` — production is probed directly after every
> `convex/` change. Round 10 removes the `continue-on-error` itself.

## Why this order

1. **Tests first** — everything after is protected by them. The
   round-9 bug class (silent save failure) gets a regression test on
   day one.
2. **Staging second** — Paystack test cards and the auth cutover both
   need a safe place to fail.
3. **Payments third** — the webhook is HMAC-signature-verified (safe
   independent of session auth), manual revenue is today's business
   pain, and it's days of work, not weeks.
4. **Identity last and longest** — the deepest change runs with the
   maximum safety net under it.
5. **Closeout** — defense-in-depth leftovers, then ops maturity.

---

## Phase 0 — Foundation

### Round 10: Test suite + honest CI pipeline
**Problem:** zero automated tests (1 orphan test file, not wired into
any workflow). CI builds and deploys but never tests. The deploy-freeze
(round 6) and the firm-settings save failure (round 9) were both found
by hand-probing production because nothing else could catch them.
**Problem:** the Convex backend deploys from the Android APK workflow
with `continue-on-error: true` — the most critical step hides in the
least related workflow; green CI proves nothing.

**Work:**
- Add Vitest + `convex-test`. Move the 18 unit-resolver tests INTO the
  repo (they lived only in the sandbox and were lost to resets twice).
- Regression tests that lock in what rounds 8–9 fixed:
  callerAuth guard behaviors (auth rejection, cross-firm rejection,
  portal-role rules), `updateItem('firms')` by the firm admin succeeds
  (the round-9 bug), ownership checks on self-referential tables.
- New `tests.yml` workflow: runs the suite on every push + PR, before
  any deploy.
- New `convex-deploy.yml`: Convex deploy moves OUT of the APK workflow
  into its own workflow — explicit `npx tsc -p convex --noEmit` gate,
  **no `continue-on-error`**, runs only after tests are green.
- APK workflow loses the Convex deploy step entirely.

**Done when:** a deliberately failing test blocks the deploy path
(verified in a scratch branch), all workflows green on main, suite
green locally, live sha updated.
**Rollback:** revert the workflow files only; app code untouched.

---

## Phase 1 — Safety net

### Round 11: Staging environment
**Problem:** one live deployment; production IS the test environment.
The firm-settings bug silently broke saves for weeks because there was
nowhere else for it to fail.

**Work:**
- Second Convex deployment (staging project) + staging frontend URL.
- Deploy model changes: push to `main` auto-deploys **staging**;
  production is promoted deliberately (manual workflow trigger after
  live verification — I run that verification as part of the round).
- Seed staging with test data; Paystack TEST keys on staging only.
- `SITE_URL` and portal callback env vars split per deployment.

**Done when:** staging serves current main; prod serves the verified
promoted commit; both report healthy; a scratch commit on a branch
deploys to staging only and never touches prod.
**Rollback:** staging is disposable by design.

---

## Phase 2 — Revenue

### Round 12: Paystack live + subscription lifecycle
**Problem:** `isPaystackActive = false` (verified live this session).
Subscriptions run on manual payment-proof upload + admin approval —
no checkout, no automatic tier enforcement, no failed-payment dunning.

**Work:**
- **User-side (blocking):** Paystack business account; provide TEST
  and LIVE secret/public keys; register the webhook URL in the
  Paystack dashboard. Exact steps will be provided at round start.
- Audit webhook event coverage: `charge.success` →
  `activateFirmSubscription` (handler + HMAC-SHA512 signature check
  already exist in `convex/paystack.ts` — verify event completeness:
  subscription renewals, failures, refunds).
- Dunning + grace: failed renewal → reminder emails via existing
  Brevo integration → grace period → **soft** downgrade (read-only
  mode — never data deletion).
- Tier enforcement audit: feature gates vs `tiers.ts` canonical
  pricing; make gates consistent.
- End-to-end loop on staging with Paystack test cards BEFORE live
  keys; then first live transaction verified.

**Done when:** staging payment loop green (pay → webhook → tier
flip); live keys set; first real transaction verified; expiry path
tested on staging.
**Rollback:** unset `PAYSTACK_ENABLED` — manual flow still exists
underneath; nothing is deleted.

---

## Phase 3 — Identity (the flagship, 3 rounds)

### Round 13: Convex Auth foundation, zero password resets
**Problem:** the "session" is a plain email string in localStorage;
every backend call passes `userEmail` as an argument; the backend
verifies the email EXISTS, never that the caller IS that person. The
Convex URL is public in the JS bundle → anyone who knows a staff
email can call the API as them. Also: accounts with no password set
accept ANY password on first login ("trust on first use").

**Work:**
- Install `@convex-dev/auth`. Custom password provider that verifies
  against the existing PBKDF2-SHA512 `users.password` hashes (the
  100k→600k iteration re-hash migration logic already exists in
  `authUtils.ts`). Users keep their passwords.
  NOTE: `users.tokenIdentifier` + `by_token` index already exist in
  the schema — it was prepared for this.
- `callerAuth.resolveCaller` upgraded: real session fully trusted;
  legacy email path still works during the window but is logged.
- Web login swapped to Convex Auth (AuthContext); legacy login kept
  as fallback.
- Verify session cookies work in the Android APK WebView (real
  technical risk — test on the APK build).

### Round 14: Full coverage
- Portal users (tenant/client — same PBKDF2 format via `portals.ts`)
  migrated to the same auth system.
- MFA (email-code flow) preserved inside the new login sequence.
- Admin Founder app + login on the new system.
- Impersonation feature reworked: founder-only, fully audited
  (audit log rows, not just local state).

### Round 15: Cutover
- Sweep all ~165 `userEmail` call sites across ~60 files to session
  identity.
- **Strict mode on:** server rejects email-only identity — verified
  by a live probe attempting a spoofed call (must fail).
- Delete the legacy `verifyLogin` path; close the "trust on first
  use" hole (force password set at first login).

**Done when (phase):** spoofed-call probe fails live on all
categories (staff, portal, admin); real logins work on web + APK;
strict flag documented; rollback = flag off (instant).
**Rollback:** every sub-step reverts via the strict flag or the
legacy fallback path.

---

## Phase 4 — Defense closeout

### Round 16: remaining round-8 flagged gaps
- Feedback module admin functions: retrofit `callerAuth` guards.
- Firm-scoped READS that trust caller-supplied firmId
  (`getLicensesForFirm`, `brainIngestion.getSourcesForIndexing` + full
  sweep): derive firmId from the verified session instead.
- Rate limiting: public lead/contact forms + login (table-backed
  limiter keyed by IP from `http.ts` headers; per-account lockout
  already exists — add per-IP).
- 8 unlinked service-charge rows: user enters tenant names in-app
  (UI already flags them with the amber chip) — data task, verified
  after.
- Add a repo audit script that fails CI if any public function trusts
  caller-supplied identity — makes the class impossible to reintroduce.

**Done when:** audit script reports zero violations; rate limiter
verified by rapid-fire test on staging; guard tests cover every
retrofit.

---

## Phase 5 — Ops maturity

### Round 17: observability, runbook, backup
**Problem:** backend is silent (Sentry covers frontend only — the
round-9 bug produced one symptom for weeks); no runbook; bus factor
1; no documented backup/restore.

**Work:**
- Sentry wrapper on Convex actions + scheduled jobs (backend errors
  finally visible + alerting).
- Alerts: deploy failure, health-endpoint downtime (version.json
  watchdog), webhook failures.
- `RUNBOOK.md`: deploy procedure, rollback (git revert + redeploy;
  Convex function rollback), env-var inventory, incident steps.
- Backup story: documented Convex export cadence + a **restore drill
  executed on staging**, with RPO/RTO stated.
- `ARCHITECTURE.md`: concise system map (bus-factor fix).

**Done when:** alert fires on a simulated failure; restore drill
passes on staging; both docs reviewed into the repo.

---

## Summary table

| Round | Theme | Risk if skipped | User-blocking? |
|---|---|---|---|
| 10 | Tests + honest CI | regressions ship silently | no |
| 11 | Staging environment | prod is the test env | no |
| 12 | Paystack live + lifecycle | revenue stays manual | **Paystack keys** |
| 13 | Convex Auth foundation | identity spoofing | no |
| 14 | Auth coverage (portals, MFA, admin) | same | no |
| 15 | Auth cutover + strict mode | same | no |
| 16 | Defense closeout (guards, rate limits) | residual attack surface | tenant names (data) |
| 17 | Observability + runbook + backup | silent failures, bus factor 1 | no |

**Current status:** Round 10 CLOSED (8b61ca4d — 54-test suite gating all
deploys; Convex deploy in its own Tests-gated workflow; gate-blocking
PROVEN on a live branch). Round 11 SHIPPED: push→main auto-deploys
STAGING (Vercel preview + stable alias + a SEPARATE Convex staging
deployment); production deploys ONLY via manual promotion
(production-deploy.yml, full gate on the pinned commit + live sha
verification + direct Convex probe; older-SHA input = instant rollback).
CLOUDFLARE MIRROR RETIRED: the redundant workers.dev frontend copy
required an API token that expired (red X on every push) — workflow +
wrangler.jsonc deleted; Vercel is the sole production frontend; the old
workers.dev URL serves the Sep 2 build until the worker is optionally
deleted in the Cloudflare dashboard (nothing depends on it, no token
ever needed again). ONE-TIME setup pending for staging: create the
staging Convex project → paste CONVEX_STAGING_DEPLOY_KEY +
CONVEX_STAGING_URL secrets (the staging workflow reports the exact
steps until then, and never deploys a frontend pointed at prod data).
Next: Round 12 (Paystack live + subscription lifecycle). This file is the
authoritative tracker; each round's detailed record goes to
worklog.md as before.
