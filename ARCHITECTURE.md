# ARCHITECTURE — PracticePro (Vega / Atrium / Komplete)

**Purpose:** the bus-factor fix. One page (and a map) that lets a new
engineer — or the founder at 2am — orient in minutes. Written 2026-09-05
(Round 17). Companion docs: `RUNBOOK.md` (ops), `SAAS_HARDENING_PLAN.md`
(hardening program), `worklog.md` (decision log).

## 1. What this is

PracticePro is a Nigerian legal-services SaaS with three product skins
over ONE codebase and ONE backend:

| Product | Audience | Flagship surface |
|---|---|---|
| **Vega** | Law firms / lawyers | Matters, drafting, retainer billing, intake |
| **Atrium** | Property / estate managers | Properties, tenants, service charges, sentry ledger, VMS |
| **Komplete** | Combined firms | Both module sets, unified dashboard |

Plus public-facing surfaces: tenant/client portals, estate resident
portal, gatehouse (visitor verification), marketing landing pages, and a
founder/admin console. Distribution: web (Vercel) + Android APK
(Capacitor wraps the same SPA).

## 2. System map

```
                      ┌─────────────────────────────────────────┐
   Browser / APK      │  React SPA (Vite build → Vercel)        │
   (same bundle)      │  modules: vega / atrium / komplet       │
                      │  portals: tenant, client, resident,     │
                      │           gatehouse, founder/admin      │
                      │  state: AuthContext (session bearer),   │
                      │         ProductContext, UIContext, ...  │
                      │  crash: ConvexErrorBoundary (bounded     │
                      │         retry per error class),          │
                      │         GlobalErrorBoundary             │
                      └───────────────┬─────────────────────────┘
                                      │ HTTPS (Convex client)
                                      ▼
                      ┌─────────────────────────────────────────┐
                      │  Convex backend (gregarious-malamute-   │
                      │  537) — convex/*.ts, ~40 modules, 70+   │
                      │  tables                                 │
                      │  • functions: queries/mutations/actions │
                      │  • http routes: /paystack/webhook,      │
                      │    /chakra/webhook, /ai/stream,         │
                      │    /api/agent/inspect,                  │
                      │    /api/observability/drill             │
                      │  • crons (~30 jobs: dunning, retainer    │
                      │    billing, wallets, reminders,          │
                      │    backups, session cleanup, R17 error-  │
                      │    event purge)                          │
                      └───────┬─────────────┬───────────────────┘
                              │             │ fetch (actions only)
                              ▼             ▼
                    Paystack / Brevo    Gemini / Chakra (WhatsApp)
                    (payments/email)    (AI / messaging)
```

External copies: nightly DB export → GitHub repo + Telegram; weekly
restore drill in CI. Cloudflare Workers mirror (currently frozen).

## 3. Identity & security model (the load-bearing wall)

1. **Login gateway** (`verifyLogin` action): password (PBKDF2) + optional
   email MFA → mints an opaque 256-bit **session token**; SHA-256 hash
   stored in the `sessions` table (30-day TTL, 10-session cap, revocable).
   TOFU accounts (no password yet) must claim one via emailed code.
2. **Client**: stores the bearer (`practicepro_session_bearer`,
   sessionStorage + localStorage when remember-me) and sends it on every
   guarded call. A boot-time validity gate (`validateSessionToken`
   reactive query) retires dead/legacy sessions to the login screen
   before the app shell renders — the death-loop fix (R17).
3. **Server**: `authHelpers.requireFirmUser` / `callerAuth.resolveCaller`
   accept ONLY the bearer; caller-supplied email is ignored. Firm
   scoping, portal-role blocking, suspension checks all follow.
   `requireFounder` guards founder surfaces. Impersonation = audited
   session minting (admin-guarded, portal-only targets).
4. **Enforcement of the class**: CI identity audit fails the build if a
   public function trusts caller-supplied identity; probes run live
   against production after every promotion (forged email must fail).

## 4. Data model (by area, not exhaustive)

- **Identity:** `users` (dual admin/portal records per email are
  disambiguated at login), `firms`, `sessions`, `securityEvents`,
  `blockedIps`, `impersonation_tokens`
- **Vega:** `matters`, `contacts`, `tasks`, `documents`, `drafts`,
  `invoice_outbox` (retainer billing), `conversations`
- **Atrium:** `properties`, `tenants`/tenancies, `service_charges`,
  `wallets`/`wallet_transactions`, `atrium_inbound_messages`,
  `visitor_tokens`, `automation_logs`
- **Revenue:** `subscriptionRequests`, `payments`, `paystackEvents`,
  dunning state on `firms`
- **Ops (R17):** `error_events` (backend observability), `backup_log`,
  `proactive_insights`, `broadcasts`

## 5. Frontend structure (src/)

- `contexts/` — AuthContext (identity gate + bearer), ProductContext
  (vega/atrium/komplete resolution), DataContext/DataProvider, UIContext
  (toasts w/ hover-hold semantics), OnboardingProvider
- `components/` — feature views (MattersView, MessagesView, AtriumInbox,
  …), portals/, tenant/, admin/, auth/ (Login/Signup/ConnectionStatus)
- `components/ConvexErrorBoundary.tsx` + `GlobalErrorBoundary.tsx` —
  crash containment; retry policies live in `src/utils/errorRecovery.ts`
  (bounded, category-aware — auth errors resolve via clean sign-in)
- `utils/sessionInvalidation.ts` — the single "wipe client auth state"
  implementation
- Versioning: `version.json` (sha + health) generated at build; used by
  the watchdog and the "never trust the deploy step" probes.

## 6. Deploy topology

- **Vercel** — production (auto from promotion pipeline) + preview/staging
  (from push to main, once staging Convex exists)
- **Convex** — one production deployment; functions+indexes+crons deploy
  together in the promotion pipeline (convex tsc = 0 gate)
- **GitHub Actions** — quality gates (tsc, vitest, identity audit),
  staging deploy, production promotion (sha-pinned, live probes),
  APK builds, health watchdog (15 min), backup restore drill (weekly)
- **Cloudflare Workers** — mirror of the frontend (frozen until token
  rotation; see RUNBOOK §9)

## 7. Where things fail (and what catches them)

| Failure | Catch |
|---|---|
| Frontend render crash | ConvexErrorBoundary (bounded retries) → dark screen with actions |
| Session expired/revoked | AuthContext validity gate (boot + reactive) → clean login redirect |
| Strict-mode rejection storm | Same gate — the class that caused the R17 death loop |
| Cron job failure | `withCronReporting` → `error_events` (+Sentry if DSN) + Convex logs |
| Paystack webhook failure | http.ts capture → `error_events`, 500 → Paystack retries |
| Site downtime | `health-watchdog.yml` → email + deduped issue |
| Backup rot | weekly `backup-restore-drill.yml` export + parse verification |
| Bad deploy | sha-pinned promotion; rollback = re-promote older sha |
