# PracticePro

**PracticePro Systems Limited is the company; Vega, Atrium and Komplete are its products.** This monorepo contains the whole platform — one React + Convex codebase serving three product surfaces, their marketing sites, customer portals, and Android APKs — built for the Nigerian legal and property-management market.

| Product | What it is | AI assistant |
| --- | --- | --- |
| **PracticePro Vega** | Legal-practice OS for Nigerian law firms — matters, court rules, DraftPro drafting, retainer billing, trust ledger | ALOA |
| **PracticePro Atrium** | Property & estate OS — rent roll, tenancies, service charge, maintenance, visitor management ("Sentry Pass") | ARIA |
| **Komplete** | The Vega + Atrium bundle for firms running both sides | Both |
| **Hub** (`src/sites/hub/`) | Corporate marketing site (no AI assistant) | — |

Orientation for contributors: [`AGENTS.md`](AGENTS.md) → [`CONTEXT.md`](CONTEXT.md) → [`ARCHITECTURE.md`](ARCHITECTURE.md). Naming rules (PracticePro = company, never a product): [`docs/brand-architecture.md`](docs/brand-architecture.md).

---

## Tech stack

- **Frontend:** React 18 + Vite 5 + TypeScript + Tailwind CSS — one SPA; a product context switches between Vega / Atrium / Komplete surfaces
- **Backend:** Convex — schema, functions, cron jobs, HTTP routes (`convex/`)
- **AI:** Google Gemini (`@google/genai`)
- **Mobile:** Capacitor 8 → Android APKs
- **Push notifications:** Firebase Cloud Messaging (`firebase-admin`)
- **Integrations:** Paystack (payments — dormant until `PAYSTACK_ENABLED=true` + `PAYSTACK_SECRET_KEY` are set on the Convex deployment; a manual provider is used otherwise), Chakra (WhatsApp), Brevo (email)
- **Hosting:** Vercel (production + staging) and Convex (separate production and staging deployments); a Cloudflare Workers mirror is deployed best-effort
- **Observability:** Sentry + PostHog (optional, env-gated), the ALOA X watchdog (`convex/alox.ts`), and the `health-watchdog.yml` GitHub workflow

Full system map: [ARCHITECTURE.md](ARCHITECTURE.md). Operations guide: [RUNBOOK.md](RUNBOOK.md).

---

## Local development

### Prerequisites

- Node.js 20+ (`.nvmrc` pins 20; CI runs 22) and npm
- A Convex account (the free tier works)
- A Google Gemini API key (optional — AI features degrade gracefully without it)

### Setup

```bash
git clone https://github.com/R2deetwo/PracticeProVEGA.git
cd PracticeProVEGA
npm ci
cp .env.example .env.local   # then edit .env.local
npx convex dev               # start a dev Convex deployment + codegen; prints its URL
npm run dev                  # Vite dev server on http://localhost:5173
```

> **Point `VITE_CONVEX_URL` at your own dev deployment before signing in.** If unset, the app falls back to the *production* Convex backend (`src/main.tsx`) — fine for browsing the landing pages, but never create data there.

### Environment variables (`.env.local`, from `.env.example`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_CONVEX_URL` | Yes (dev) | Convex deployment the build talks to; falls back to production if unset |
| `VITE_GEMINI_API_KEY` | Optional | Gemini key for AI features (users can also bring their own key in-app; keys are held in memory, not persisted) |
| `VITE_POSTHOG_KEY` | Optional | PostHog product analytics |
| `VITE_SENTRY_DSN` | Optional | Sentry crash reporting (session replay intentionally disabled) |
| `CONVEX_DEPLOY_KEY` | CI only | Convex deploys from GitHub Actions |
| `CONVEX_STAGING_DEPLOY_KEY` / `CONVEX_STAGING_URL` | CI only | The staging Convex deployment (auto-deploy target for `main`) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | For push | FCM service account — set it on the Convex deployment via `npx convex env set`; see [PUSH_NOTIFICATIONS_SETUP.md](PUSH_NOTIFICATIONS_SETUP.md) |
| `VERCEL_TOKEN` | CI only | Vercel deploys from GitHub Actions |
| `RELEASE_STORE_FILE` / `RELEASE_KEY_ALIAS` / `RELEASE_KEY_PASSWORD` | Release APKs | Android signing — alias `practicepro-app` for the user APK, `practicepro-admin` for the founder APK |
| `DATABASE_URL` | Optional | Local sandbox DB used by some dev tooling (not the app database) |

Backend feature flags (`PAYSTACK_ENABLED`, `PAYSTACK_SECRET_KEY`, `GEMINI_API_KEY`, `GEMINI_DEMO_KEY`, `SITE_URL`, `OPENAI_API_KEY` for Whisper transcription) live on the Convex deployment (`npx convex env set …`), not in `.env.local`.

### Everyday commands

```bash
npm run dev            # dev server on http://localhost:5173
npm test               # Vitest unit suite (the same suite CI gates on)
npm run lint           # ESLint + UI-primitives ratchet
npm run build          # production build → dist/ (+ version manifest)
npx playwright test    # E2E smoke suite (tests/e2e)
```

The CI quality gates — run them locally before pushing, CI rejects otherwise:

```bash
npx tsc -p convex --noEmit        # MUST be 0 errors (the real Convex deploy gate)
npx tsc --noEmit                  # MUST be 0 errors
python3 scripts/audit-identity.py # no public function may trust caller-supplied identity
node scripts/check-design-tokens.mjs
node scripts/check-ui-primitives.mjs
npx vitest run
```

Optional QA crawlers:

```bash
node scripts/landing-page-audit.cjs                       # crawls the live landing page (production by default)
AUDIT_PRODUCT=vega node scripts/product-page-audit.cjs    # product-page QA (vega | atrium); targets a local preview server by default (override with AUDIT_URL)
npm run audit:all                                         # master audit suite
```

### Building APKs locally

```bash
npm run apk:release          # universal user APK
npm run apk:admin:release    # founder/admin APK
npm run apk:vega:release     # per-product wrappers — also :atrium and :komplete
```

Debug variants: `apk:debug`, `apk:admin:debug`, `apk:vega:debug`, … Release builds require the signing variables above; without them they fall back to debug signing.

### Demo / impersonation

Founder-issued, short-lived, single-use tokens: `http://localhost:5173/?impersonateToken=<token>` (see `convex/impersonation.ts`). The legacy `?impersonate=<email>` parameter is deprecated.

---

## CI/CD and releases

Deploy model: **a push to `main` auto-deploys staging; production changes are promoted deliberately.**

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `tests.yml` | every push + PRs to `main` | Quality gate: Convex typecheck (0 errors), root typecheck (0 errors), identity audit, design-token + UI-primitives ratchets, Vitest |
| `staging-deploy.yml` | push to `main` | Quality gate → deploy the staging Convex backend + Vercel staging frontend (stable alias `https://staging-practice-pro-vega.vercel.app`); verifies the bundle points at the staging backend, never production |
| `e2e-smoke.yml` | push + PRs to `main` | Playwright smoke: public hub landing + ALOA panel against production; signup + login-gating smoke against staging (the `STAGING_URL` secret, set 2026-11-23 — the staging suite pins its own baseURL to the staging origin and refuses to run if the secret points at production) |
| `codeql.yml` | push + PRs, weekly Monday | CodeQL static analysis (javascript-typescript) |
| `build-apk.yml` | push to `main` | Quality gate → bump patch version → build and release-sign the universal Android APK → GitHub Releases (tag `build-N`) + `version.json` update |
| `build-admin-apk.yml` | push to `main` (admin paths changed) | Founder/admin APK — artifacts are login-gated, never a public release asset |
| `production-deploy.yml` | **manual (promote)** | Sha-pinned production promote: full quality gate + healthy-staging gate → Convex production + Vercel production + Cloudflare mirror (best-effort) → live probes (version.json sha match + direct Convex query) |
| `vercel-production-deploy.yml` | manual | Targeted production **frontend** deploy with the same quality gate (backend untouched) |
| `convex-production-deploy.yml` | manual | Targeted production **backend** deploy with the same quality gate (frontends untouched) |
| `build-product-apks.yml` | manual | Per-product APK wrappers (Vega / Atrium / Komplete) |
| `staging-seed.yml` | manual | Seed demo data into the staging Convex deployment |

Ops and diagnostics (manual or scheduled): `health-watchdog.yml` (every 15 min), `backup-restore-drill.yml` and `observability-drill.yml` (weekly), plus `alox-diagnostics.yml`, `inspect-login-state.yml`, `inspect-push-state.yml`, `whatsapp-live-test.yml` and the `convex-backfill*.yml` data-fix workflows (dry-run by default).

Live surfaces — production `https://practice-pro-vega.vercel.app` · staging `https://staging-practice-pro-vega.vercel.app` · Cloudflare mirror `https://practice-pro-vega.prototypechigo.workers.dev` (best-effort, may lag). Every frontend serves `version.json` (sha + status) for health checks.

- **Promoting to production:** Actions tab → *Deploy to Production (promote)* → Run workflow. A blank sha promotes the latest `main`; an older `main` sha is a rollback — production redeploys that exact commit.
- **Production has more than one dispatch path.** Besides the full promote there are the two targeted workflows above, and comments in the deploy workflows note that Vercel's native Git integration is also connected to this repo and has auto-deployed `main` at times. Never assume a push to `main` cannot reach production, and never push untested code.
- Local CLI fallbacks (rarely needed; require local auth): `npx convex deploy` (backend), `npx vercel deploy --prod` (frontend).

---

## Pricing and plans

> **The code is the source of truth.** Prices, quotas and feature lists live in [`src/constants/tiers.ts`](src/constants/tiers.ts), mirrored server-side in [`convex/tierLimits.ts`](convex/tierLimits.ts). This section is a convenience copy — update it whenever the code changes.

Tiers use a **no-repetition model**: every tier above the base carries everything in the tier below it ("Everything in Growth, plus:") and lists only what it adds.

### Vega (legal) — monthly or annual (annual = 20% off 12× monthly)

| Tier | Price | Users | Active matters | Case-file storage | Adds |
|------|-------|-------|----------------|-------------------|------|
| Free | ₦0 | 1 | 10 | 1 GB | Legal billing & ledger; DraftPro contract analyzer (standard) |
| Growth | ₦45,000/mo · ₦432,000/yr | 5 | Unlimited | 20 GB | Court rules & procedural intelligence; Client Portal (up to 20 clients); ALOA copilot (Standard); automated retainer billing & client auto-invoicing; court-date reminders (WhatsApp 7/3/1 days before hearings) |
| Pro *(recommended)* | ₦80,000/mo · ₦768,000/yr | Unlimited | Unlimited | 100 GB | ALOA Vox voice capture & hybrid Legal Pad; advanced legal billing & analytics; uncapped Client Portal; ALOA copilot (Uncapped Priority); Billing Monitor |
| Enterprise | Custom (setup fee) | Unlimited | Unlimited | Unlimited | Regulatory & compliance cross-referencing engine (CAMA 2020, Labour Act, FCCPA 2018, Lagos Tenancy Law); custom court document archives; dedicated account manager & custom integrations |

ALOA Vox appears on exactly one tier — Pro; Enterprise inherits it via the base plan.

### Atrium (property) — monthly or annual (annual = 10× monthly)

| Tier | Price | Users | Included units | Tenants | Adds and unit overage |
|------|-------|-------|----------------|---------|----------------------|
| Starter | ₦49,000/mo · ₦490,000/yr | 1 | 10 | 15 | Revenue Monitor (defaulter dashboard & ledger); lease tracking & maintenance log; automated rent/demand notices (email/portal + one-tap WhatsApp share). Beyond 10 units: ₦2,700/unit/mo — forced upgrade at 25 units |
| Growth | ₦96,500/mo · ₦965,000/yr | 5 | 25 | 40 | Service-charge tracking; demand-notice templates; Residents' Portal; automated triggers (auto-receipts, service-charge notices). Beyond 25 units: ₦2,100/unit/mo — forced upgrade at 70 units |
| Pro *(recommended)* | ₦210,000/mo · ₦2,100,000/yr | Unlimited | 100 | Unlimited | Estate document generation; live defaulter dashboard; uncapped Residents' Portal; smart notification batching; AI-personalized WhatsApp notices triggered by defaulter events. Beyond 100 units: ₦1,600/unit/mo — forced upgrade at 400 units |
| Enterprise | Custom (setup fee) | Unlimited | Unlimited | Unlimited | Custom scale (400+ units); custom WhatsApp automation via API; dedicated onboarding, support & custom integrations |

WhatsApp messaging is unlimited on every Atrium tier (the backend keeps a fair-use sentinel); Starter and Growth send notices by email/portal with one-tap WhatsApp share, Pro adds AI-personalized WhatsApp notices.

### Komplete (bundle) — annual only

**₦2,500,000/year.** Unlimited seats, matters, units and tenants; 500 GB shared storage; ALOA Vox; ARIA copilot (Uncapped Priority); the full legal + property suite; automated retainer billing and Billing Monitor; dedicated account manager; priority phone & WhatsApp support; custom integrations included.

**Sentry Pass (visitor management) is never bundled:** it is a separately purchased add-on on any plan, including Komplete.

### Add-ons and trials

- Catalog (defined server-side in [`convex/addonCatalog.ts`](convex/addonCatalog.ts)): Extra 5 Seats ₦20,000/mo · Extra 10 Seats ₦36,000/mo · Extra 50 GB file storage ₦8,000/mo · Custom Integration Setup ₦250,000 (one-time). Seat add-ons do not apply to Komplete — seats are already unlimited there.
- 30-day free trial on signup; the Sentry Pass (VMS) and Estate Community add-ons each have their own 30-day trials.
- Paid activation validates the charged amount against catalog prices **server-side** (Paystack when configured; otherwise a founder-approved request flow).

---

## Repository map

```
ai/                     ICM prompt architecture — versioned markdown prompts, loaded via Vite ?raw imports
android/                Capacitor Android project (universal, founder and per-product APK builds)
convex/                 Backend — schema.ts, functions, crons, http.ts routes; callerAuth.ts (server-enforced
                        auth), tierLimits.ts (pricing mirror), impersonation.ts, alox.ts (ALOA X watchdog)
docs/                   Active documentation — index in docs/README.md (ADRs, design tokens, ops, archive)
prisma/                 Prisma schema for the local dev-tooling sandbox DB (not the app database)
public/                 Static assets + version.json (build/health manifest)
resources/              Brand and icon assets
scripts/                Build, QA/audit and CI helper scripts (identity audit, ratchet gates, version manifest)
src/
  sites/                Marketing/product surfaces: hub (corporate), vega, atrium, shared
  components/           Product UI — matters, properties, portals, admin, DraftPro, indexer, …
  agents/               AI agents — research, jurisdiction, scale of charges, document intelligence,
                        data protection, RPC guidance, tax compliance, ingestion, property management
  constants/            tiers.ts (pricing source of truth), add-on re-exports, ICM prompt loader
  contexts/             Auth, Product, Data and UI contexts
  legal/                Deterministic legal engines (citations, limitation periods, notices)
  overlays/             Named z-layer banner/modal system
stages/                 Three-stage drafting-pipeline contracts (intake → synthesis → validation)
tests/                  tests/unit (Vitest) + tests/e2e (Playwright)
tools/legal_ingester/   Python pipeline that politely crawls and ingests Nigerian legal sources into
                        the Legal KB (see LEGAL_KB.md)
.github/workflows/      CI/CD and ops workflows (see the CI/CD section above)
```

Build configs: `vite.config.ts` (app), `vite.admin.config.ts` (founder app), `capacitor.config.ts` + `capacitor.vega/atrium/komplete/admin.config.ts`, `vercel.json`, `wrangler.jsonc`, `vitest.config.ts`, `playwright.config.ts`, `tailwind.config.ts`.

---

## AI assistants and agents

**ALOA** (Vega) and **ARIA** (Atrium) are the in-app assistants. Their identities and guardrails are versioned markdown prompts in `ai/prompts/` (the ICM system, loaded by `src/constants/loadPrompts.ts`). Specialised agents in `src/agents/` cover legal research, jurisdiction routing, Scale of Charges compliance, document intelligence (ALDIA), NDPA PII scanning, RPC guidance, tax compliance, document ingestion and property management. **ALOA Vox** (Vega Pro) adds voice capture and the hybrid Legal Pad — runbook: [VOICE_CAPTURE.md](VOICE_CAPTURE.md). **ALOA X** (`convex/alox.ts`) is the platform watchdog that sweeps every surface every 15 minutes and pushes alerts to the founder. Capabilities and safety: [ALOAGUIDE.md](ALOAGUIDE.md).

---

## Security and data integrity

Implemented safeguards (verifiable in code; several are CI-enforced):

- **Server-enforced auth** — session-bearer identity via `convex/callerAuth.ts`; the CI identity audit fails any public function that trusts caller-supplied identity
- **Per-firm data isolation** on firm-scoped reads and writes
- **Money is kobo integers** — never floats (`src/utils/` money helpers)
- **Deterministic before generative** — jurisdiction, limitation periods, notices and compliance checks are computed by typed engines in `src/legal/`; unverifiable citations surface as `UNVERIFIABLE`, never as confident prose
- **Server-side price validation** — add-on purchases are charged against catalog prices server-side; client-claimed amounts are rejected
- **In-memory AI keys** — user-supplied Gemini keys are never persisted to localStorage
- **FLAG_SECURE** screenshot prevention on Android; audit trails and error events for founder review

These are engineering safeguards, **not certifications**. No legal or compliance certification (NDPA or otherwise) is claimed; NDPA-*aligned* data handling for operators is documented in [CONFIDENTIALITY_GUIDE.md](CONFIDENTIALITY_GUIDE.md). CodeQL and the test suites are layers of defense, not proof that the app is secure or compliant. Report vulnerabilities through [SECURITY.md](SECURITY.md).

---

## Documentation index

The full, maintained index is [docs/README.md](docs/README.md). Key entry points:

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System map — frontends, backend, integrations |
| [RUNBOOK.md](RUNBOOK.md) | Operations — deploys, CI, environment, incident playbook |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Workflow and quality gates every change must pass |
| [AGENTS.md](AGENTS.md) / [CONTEXT.md](CONTEXT.md) | Orientation for human and AI contributors |
| [DEV_TOOLKIT.md](DEV_TOOLKIT.md) | Developer commands, scripts and conventions |
| [docs/brand-architecture.md](docs/brand-architecture.md) / [docs/glossary.md](docs/glossary.md) | Naming rules; product and domain glossary |
| [docs/adr/](docs/adr) | Architecture Decision Records |
| [PUSH_NOTIFICATIONS_SETUP.md](PUSH_NOTIFICATIONS_SETUP.md) | FCM setup and the push pipeline |
| [ALOAGUIDE.md](ALOAGUIDE.md) / [VOICE_CAPTURE.md](VOICE_CAPTURE.md) | The AI assistants; voice-capture runbook |
| [LEGAL_KB.md](LEGAL_KB.md) | The Legal KB and its ingestion pipeline |
| [INVOICE_GENERATION.md](INVOICE_GENERATION.md) | Billing — invoices, receipts, payments |
| [ESTATE_COMMUNITY.md](ESTATE_COMMUNITY.md) | Atrium estate-community features |
| [VMS_GATEHOUSE_SOPS.md](VMS_GATEHOUSE_SOPS.md) | Sentry Pass gatehouse operating procedures |
| [CONFIDENTIALITY_GUIDE.md](CONFIDENTIALITY_GUIDE.md) / [SECURITY.md](SECURITY.md) | NDPA-aligned data handling; vulnerability reporting |
| [CHANGELOG.md](CHANGELOG.md) / [worklog.md](worklog.md) | User-facing changelog; engineering decision log |

---

## License

Proprietary — PracticePro Systems Limited, Lagos, Nigeria.
