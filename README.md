# PracticePro

**The AI-Powered Operating System for Nigerian Legal Practice & Property Management.**

PracticePro is a dual-product SaaS platform serving two professional verticals from a single unified codebase:

- **Vega OS** — Legal Practice Management for Nigerian law firms
- **Atrium OS** — Property & Estate Management for property managers and gated estates
- **Komplete** — Unified firms running both legal and property operations

Built for the Nigerian jurisdiction, PracticePro combines practice management, financial operations, document intelligence, AI automation, and visitor management into one cohesive platform.

---

## Architecture Overview

### Tech Stack
- **Frontend:** React 18 + Vite 5 + TypeScript + Tailwind CSS
- **Backend:** Convex (serverless database + real-time sync)
- **AI:** Google Gemini (ALOA/ARIA AI assistant, document analysis, legal research)
- **Mobile:** Capacitor 8 (Android APK)
- **Deployment:** Vercel (primary) + Cloudflare Workers (secondary)
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **Payments:** Paystack integration (bank transfer live, card/USSD activating)

### Product Architecture
```
PracticePro (Parent Company)
├── Vega OS (Legal)
│   ├── Matter Management & Workflow Automation
│   ├── ALDIA Document Intelligence (risk analysis, PII scanning)
│   ├── DraftPro AI Document Editor (A4 pagination, Nigerian legal fonts)
│   ├── Research Studio (chronology, legal matrix, gap analysis)
│   ├── Scale of Charges Compliance Engine
│   └── ALOA AI Assistant (Legal)
├── Atrium OS (Property)
│   ├── Property & Unit Management
│   ├── Visitor Management System (VMS) with gatehouse verification
│   ├── Service Charge & Minimum Vend Tracking
│   ├── Rent Collection & Receipt Automation
│   ├── ARIA AI Assistant (Property)
│   └── Resident Portal (ledger, payments, maintenance, visitors)
└── Komplete (Unified)
    └── All features from both Vega + Atrium
```

### Multi-Product Routing
The app uses a `useProduct()` hook that determines which product context is active:
- Legal firms see Vega mode (ALOA, matters, courts)
- Property firms see Atrium mode (ARIA, properties, residents)
- Unified firms see Komplete mode (both)

Product context affects: AI assistant identity, terminology (matter vs property, client vs resident), available features, and tier gating.

---

## Local Development Setup

### Prerequisites
- Node.js 20+ (see `.nvmrc`)
- npm 10+
- A Convex account (free tier works)
- A Google Gemini API key

### Installation
```bash
git clone https://github.com/R2deetwo/PracticeProVEGA.git
cd PracticeProVEGA
npm ci
cp .env.example .env.local
# Edit .env.local with your values
```

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONVEX_URL` | Yes | Convex deployment URL |
| `VITE_GEMINI_API_KEY` | Optional | Google Gemini API key for AI features |
| `VITE_POSTHOG_KEY` | Optional | PostHog analytics key (visitor tracking, funnels) |
| `CONVEX_DEPLOY_KEY` | Optional | For CI/CD Convex deploys |
| `FCM_SERVER_KEY` | Optional | Firebase Cloud Messaging server key |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Optional | Firebase service account JSON for FCM |
| `VERCEL_TOKEN` | Optional | For direct Vercel API deploys via scripts/vercel-deploy.cjs |

### Running the Dev Server
```bash
npm run dev
# App runs on http://localhost:5173
```

### Demo Mode
Visit `http://localhost:5173/?impersonateToken=<token>` (tokens issued via founder-only mutation). The legacy `?impersonate=demo@practicepro.ng` still works but logs a deprecation warning.

---

## Building & Deploying

### Build
```bash
npm run build
# Output: dist/ (production bundle)
```

### Deploy to Vercel
Vercel auto-deploys on push to `master` via GitHub integration.
- **URL:** https://practice-pro-vega.vercel.app
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Production branch:** `master`

If the GitHub webhook breaks, you can deploy directly:
```bash
npx vercel login
npx vercel --prod
```

### Deploy to Cloudflare Workers
```bash
CLOUDFLARE_API_TOKEN=your_token npx wrangler deploy
```
- **URL:** https://practice-pro-vega.prototypechigo.workers.dev
- **Config:** `wrangler.jsonc` (SPA mode with cache headers)

### Deploy Convex Backend
```bash
npx convex deploy
```

### Build Android APK
```bash
npm run cap:sync
cd android && ./gradlew assembleRelease
```

### Build Founder/Admin APK
```bash
npm run cap:sync:admin
cd android && ./gradlew assembleRelease
```

---

## Repository Structure

```
├── ai/                        # ICM prompt architecture (Van Clief methodology)
│   ├── README.md              # ICM philosophy + file mapping
│   └── prompts/               # Numbered markdown prompt files
│       ├── 01-aloa-legal-identity.md       # ALOA system instruction (Vega)
│       ├── 02-aria-property-identity.md    # ARIA system instruction (Atrium)
│       ├── 03a-aloa-identity-guardrail.md  # ALOA identity lock
│       ├── 03b-aria-identity-guardrail.md  # ARIA identity lock
│       └── 04-interactive-form-protocol.md # Anti-interrogation form schema
├── convex/                    # Backend (Convex functions + schema)
│   ├── schema.ts              # Database schema (65+ tables)
│   ├── myFunctions.ts         # Core CRUD + auth + business logic (6,300 LOC)
│   ├── portals.ts             # Resident/Client portal backend (6,000 LOC)
│   ├── founderMetrics.ts      # Founder app analytics + admin queries
│   ├── impersonation.ts       # Server-verified impersonation tokens (B1 fix)
│   ├── proactive.ts           # AI morning briefing + deadline scanner
│   ├── retainerBilling.ts     # Automated retainer billing engine
│   ├── conversationMemory.ts  # Cross-session AI conversation memory
│   ├── visitorManagement.ts   # VMS (access codes, gatehouse)
│   ├── feedback.ts            # User feedback + admin replies + idempotency
│   ├── tierLimits.ts          # Pricing tier limits (mirrors src/constants/tiers.ts)
│   └── http.ts                # HTTP routes (webhooks, AI streaming)
├── src/
│   ├── components/
│   │   ├── admin/             # Founder APK views
│   │   ├── aloa/              # ALOA/ARIA AI chat interface
│   │   ├── atrium/            # Property management components
│   │   ├── client/            # Client portal (Vega)
│   │   ├── tenant/            # Resident portal (Atrium)
│   │   ├── marketing/         # ContactSalesDrawer, landing page components
│   │   └── ...
│   ├── agents/                # AI agent modules
│   │   ├── AgencyHub.ts       # ALOA/ARIA identity + system prompt builder
│   │   ├── PropertyManagementAgent.ts  # ARIA property system instruction
│   │   └── ...
│   ├── constants/
│   │   ├── tiers.ts           # Pricing tiers (source of truth)
│   │   ├── identityGuardrails.ts  # AI identity lock (ICM-sourced)
│   │   ├── loadPrompts.ts     # ICM loader (Vite ?raw imports)
│   │   └── addons.ts          # Add-on catalog
│   ├── contexts/              # React contexts (Auth, Data, Core, UI, Product)
│   ├── hooks/                 # useFeatures, useVersionCheck, usePermissions
│   ├── utils/                 # Analytics, haptics, formatting, PII stripping
│   └── raw-imports.d.ts       # Type declarations for ?raw imports
├── android/                   # Capacitor Android project
├── scripts/                   # Build + audit scripts
│   ├── landing-page-audit.cjs # Playwright landing page crawler
│   ├── product-page-audit.cjs # Playwright product page crawler
│   ├── generate-version-manifest.cjs
│   ├── mark-healthy.cjs
│   └── vercel-deploy.cjs
├── public/                    # Static assets + version.json
├── .github/workflows/         # CI/CD (APK builds)
├── wrangler.jsonc             # Cloudflare Workers config
├── vercel.json                # Vercel deploy config
└── tailwind.config.js         # Tailwind theme
```

---

## Pricing

### Vega (Legal) — Monthly or Annual
| Tier | Price | Users | Matters | Storage |
|------|-------|-------|---------|---------|
| Free | N0 | 1 | 10 | 1 GB |
| Growth | N45,000/mo or N432,000/yr | 5 | Unlimited | 20 GB |
| Pro | N80,000/mo or N768,000/yr | Unlimited | Unlimited | 100 GB |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited |

### Atrium (Property) — Monthly or Annual
| Tier | Price | Units | Tenants | WhatsApp/mo |
|------|-------|-------|---------|-------------|
| Starter | N49,000/mo or N490,000/yr | 10 | 15 | 250 |
| Growth | N96,500/mo or N965,000/yr | 25 | 40 | 500 |
| Pro | N200,000/mo or N2,100,000/yr | 100 | Unlimited | Unlimited |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited |

### Komplete (Unified) — Annual Only
| Tier | Price | Seats | Features |
|------|-------|-------|----------|
| Komplete | N2,200,000/yr | Unlimited | All Vega + Atrium + Sentry Pass + 500GB + Dedicated AM |

All plans include a **30-day free trial**. Annual plans include a **30-day money-back guarantee**.

---

## AI Agents

| Agent | Purpose | Product |
|-------|---------|---------|
| **ALOA** (Vega) / **ARIA** (Atrium) | AI assistant for chat, drafting, task management | Both |
| **ALDIA** | Document intelligence (risk scoring, PII scanning) | Vega |
| **Research Agent** | Legal research (chronology, gap analysis, adversarial brief) | Vega |
| **Scale of Charges** | Legal billing compliance (Remuneration Order 2023) | Vega |
| **Jurisdiction Agent** | Court routing (Federal vs State High Court) | Vega |
| **Ingestion Agent** | Bulk document auto-titling and metadata extraction | Vega |
| **Data Protection** | NDPA PII scanner with redaction | Both |
| **RPC Guidance** | Professional conduct review for AI outputs | Vega |
| **Tax Compliance** | WENR tax deductibility analysis | Both |

### ICM (Interpretable Context Methodology)
All 5 primary AI prompts are sourced from versioned markdown files in `/ai/prompts/` via Vite `?raw` imports. This allows prompt editing without code deploys. The loader (`src/constants/loadPrompts.ts`) provides `renderAloaIdentity()`, `renderAriaIdentity()`, `renderIdentityGuardrail()`, and `renderFormProtocol()` functions.

---

## Security & Compliance

- **NDPA 2023 Compliant** — Nigerian Data Protection Act
- **Row-Level Security** — `requireFirmUser()` enforces per-firm data isolation on all mutations
- **Server-Verified Impersonation** — Replaced unsigned `?impersonate=email` URL param with short-lived, single-use, founder-only tokens (`convex/impersonation.ts`)
- **API Key Security** — Gemini API key held in-memory only, never persisted to localStorage
- **Notification Auth** — `markNotificationRead` verifies caller ownership before patching
- **Portal User Isolation** — Tenant/Client roles blocked from firm-level operations
- **Disposable Email Blocking** — 32+ disposable email domains blocked at signup
- **Idempotency Keys** — 5 critical tables support dedup on double-submit
- **Soft Delete** — Audit trail preserved via `deletedAt`/`deletedBy` fields
- **Content Protection** — FLAG_SECURE on Android, screenshot prevention
- **Audit Trail** — All admin actions and security events logged

---

## Trial System

- **30-day free trial** on all paid tiers (Vega + Atrium)
- **30-day VMS add-on trial** for Sentry Pass
- Trial milestones (in-app nudges):
  - Day 0: Welcome + setup
  - Day 1: First payment recorded
  - Day 3: First invoice sent
  - Day 7: Try WhatsApp messaging
  - Day 14: Midpoint check-in
  - Day 23: Trial ending soon (7 days)
  - Day 29: Last-chance nudge
- Backend cron sends "trial ending" notifications at 7 days and 1 day before expiry

---

## Routing

The app uses React Router v6 (`BrowserRouter`) with URL-based navigation:
- Public routes: `/`, `/vega`, `/atrium`, `/komplet`, `/resources`, `/privacy-policy`, `/terms-of-service`, `/data-processing-agreement`, `/cookie-policy`, `/usage-policy`
- Portal routes: `/portal/tenant/:token`, `/portal/client/:token`, `/gatehouse`
- Authenticated routes: `/matters`, `/properties`, `/billing`, `/settings`, `/messaging`, etc.

All public routes are in the `publicPaths` array and accessible without authentication.

---

## Audit & Testing

### Playwright Crawlers
```bash
# Landing page audit (all sections, mobile nav, JSON-LD, pricing)
node scripts/landing-page-audit.cjs

# Product page audit (Vega or Atrium, full section verification)
AUDIT_PRODUCT=vega node scripts/product-page-audit.cjs
AUDIT_PRODUCT=atrium node scripts/product-page-audit.cjs

# Master audit suite
npm run audit:all

# Development report
npm run dev-report
```

### Audit Results
Reports saved to `./audit-results/`:
- `landing-report.json` — Landing page section checks
- `product-vega-report.json` / `product-atrium-report.json` — Product page checks
- `master-report.json` — Full 10-domain audit
- `screenshots/` — Visual captures

---

## License

Proprietary — PracticePro Systems Limited, Lagos, Nigeria.
