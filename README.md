# PracticePro

**The AI-Powered Operating System for Nigerian Legal Practice & Property Management.**

PracticePro is a dual-product SaaS platform serving two professional verticals from a single unified codebase:

- **Vega OS** — Legal Practice Management for Nigerian law firms
- **Atrium OS** — Property & Estate Management for property managers and gated estates
- **Komplete** — Unified firms running both legal and property operations

Built for the Nigerian jurisdiction, PracticePro combines practice management, financial operations, document intelligence, AI automation, and visitor management into one cohesive platform.

---

## 🏗️ Architecture Overview

### Tech Stack
- **Frontend:** React 18 + Vite 5 + TypeScript + Tailwind CSS
- **Backend:** Convex (serverless database + real-time sync)
- **AI:** Google Gemini (ALOA/ARIA AI assistant, document analysis, legal research)
- **Mobile:** Capacitor 8 (Android APK)
- **Deployment:** Vercel (primary) + Cloudflare Workers (secondary)
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **Payments:** Paystack integration

### Product Architecture
```
PracticePro (Parent Company)
├── Vega OS (Legal)
│   ├── Matter Management & Workflow Automation
│   ├── ALDIA Document Intelligence (risk analysis, PII scanning)
│   ├── DraftPro AI Document Editor
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
- Legal firms → Vega mode (ALOA, matters, courts)
- Property firms → Atrium mode (ARIA, properties, residents)
- Unified firms → Komplete mode (both)

Product context affects: AI assistant identity, terminology (matter vs property, client vs resident), available features, and tier gating.

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js 20+ (see `.nvmrc`)
- npm 10+
- A Convex account (free tier works)
- A Google Gemini API key

### Installation
```bash
# Clone the repository
git clone https://github.com/R2deetwo/PracticeProVEGA.git
cd PracticeProVEGA

# Install dependencies
npm ci

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values (see below)
```

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONVEX_URL` | ✅ | Convex deployment URL (found in Convex dashboard) |
| `VITE_GEMINI_API_KEY` | Optional | Google Gemini API key for AI features |
| `CONVEX_DEPLOY_KEY` | Optional | For CI/CD Convex deploys |
| `FCM_SERVER_KEY` | Optional | Firebase Cloud Messaging server key for push notifications |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Optional | Firebase service account JSON for FCM (recommended) |

### Running the Dev Server
```bash
npm run dev
# App runs on http://localhost:5173
```

### Demo Mode
Visit `http://localhost:5173/?impersonate=demo@practicepro.ng` to bypass login and explore the app with demo data. Set `sessionStorage.setItem('practicepro_demo_product', 'atrium')` before navigating for Atrium demo data.

---

## 📦 Building & Deploying

### Build
```bash
npm run build
# Output: dist/ (production bundle)
```

### Deploy to Vercel
Vercel auto-deploys on push to `main` via GitHub integration.
- **URL:** https://practice-pro-vega.vercel.app
- **Build command:** `npm run build`
- **Output directory:** `dist`

### Deploy to Cloudflare Workers
```bash
# Manual deploy (requires Cloudflare API token)
CLOUDFLARE_API_TOKEN=your_token npx wrangler deploy

# Or via GitHub Actions (auto-deploys on push to main)
# Requires secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, VITE_CONVEX_URL
```
- **URL:** https://practice-pro-vega.prototypechigo.workers.dev
- **Config:** `wrangler.jsonc` (SPA mode with cache headers)

### Deploy Convex Backend
```bash
# Set up Convex deploy key (found in Convex dashboard → Settings → API)
CONVEX_DEPLOY_KEY=your_key npx convex deploy
```

### Build Android APK
```bash
npm run cap:sync    # Sync web assets to native
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

### Build Founder/Admin APK
```bash
npx vite build --config vite.admin.config.ts
npm run cap:sync:admin
cd android && ./gradlew assembleRelease
```

---

## 📁 Repository Structure

```
├── convex/                    # Backend (Convex functions + schema)
│   ├── schema.ts              # Database schema (70+ tables)
│   ├── myFunctions.ts         # Core CRUD + auth + business logic
│   ├── founderMetrics.ts      # Founder app analytics + admin queries
│   ├── portals.ts             # Resident/Client portal backend
│   ├── visitorManagement.ts   # VMS (access codes, gatehouse)
│   ├── pushNotifications.ts   # Push notification infrastructure
│   ├── pushNotificationsNode.ts # FCM dispatch (Node.js runtime)
│   ├── feedback.ts            # User feedback + admin replies
│   └── http.ts                # HTTP routes (webhooks, AI streaming)
├── src/
│   ├── components/
│   │   ├── admin/             # Founder APK views
│   │   ├── aloa/              # ALOA/ARIA AI chat interface
│   │   ├── atrium/            # Property management components
│   │   ├── client/            # Client portal (Vega)
│   │   ├── details/           # Detail views (matter, property, contact)
│   │   ├── forms/             # Data entry forms
│   │   ├── portal/            # Portal components (login, VMS, gatehouse)
│   │   ├── tenant/            # Resident portal (Atrium)
│   │   └── ...
│   ├── agents/                # AI agent modules
│   │   ├── AgencyHub.ts       # ALOA/ARIA identity + system prompt builder
│   │   ├── AdvancedLegalDocumentIntelligenceAgent.ts  # ALDIA
│   │   ├── ResearchAgent.ts   # Legal research analysis
│   │   ├── ScaleOfChargesAgent.ts  # Legal billing compliance
│   │   └── ...
│   ├── contexts/              # React contexts (Auth, Data, Core, Finance, etc.)
│   ├── hooks/                 # Custom hooks (useFeatures, useVersionCheck, etc.)
│   ├── constants/             # Tier configs, identity guardrails, products
│   └── utils/                 # Utilities (analytics, haptics, formatting, etc.)
├── android/                   # Capacitor Android project
├── scripts/                   # Build + audit scripts
│   ├── generate-version-manifest.cjs  # Version.json generator
│   ├── mark-healthy.cjs       # Post-build health marker
│   ├── vercel-deploy.cjs      # Direct Vercel API deploy
│   ├── agent-audit.ts         # Playwright UI crawler
│   └── audit-master-suite.ts  # 10-domain audit suite
├── public/                    # Static assets
│   ├── _headers               # Cloudflare cache headers
│   ├── _redirects             # Cloudflare SPA routing
│   └── version.json           # Build version manifest
├── .github/workflows/         # CI/CD
│   ├── build-apk.yml          # Android APK build
│   └── build-admin-apk.yml    # Founder APK build
├── wrangler.jsonc             # Cloudflare Workers config
├── vercel.json                # Vercel deploy config
└── tailwind.config.js         # Tailwind theme (custom colors, fonts, sizes)
```

---

## 🤖 AI Agents

| Agent | Purpose | Product |
|-------|---------|---------|
| **ALOA** (Vega) / **ARIA** (Atrium) | AI assistant for chat, drafting, task management | Both |
| **ALDIA** | Document intelligence (risk scoring, PII scanning, metadata extraction) | Vega |
| **Research Agent** | Legal research (chronology, gap analysis, adversarial brief) | Vega |
| **Scale of Charges** | Legal billing compliance (Remuneration Order 2023) | Vega |
| **Jurisdiction Agent** | Court routing (Federal vs State High Court) | Vega |
| **Ingestion Agent** | Bulk document auto-titling and metadata extraction | Vega |
| **Data Protection** | NDPA PII scanner with redaction | Both |
| **RPC Guidance** | Professional conduct review for AI outputs | Vega |
| **Tax Compliance** | WENR tax deductibility analysis | Both |

---

## 🔐 Security & Compliance

- **NDPA 2023 Compliant** — Nigerian Data Protection Act
- **Row-Level Security** — `requireFirmUser()` enforces per-firm data isolation
- **Portal User Isolation** — Tenant/Client roles blocked from firm-level operations
- **Disposable Email Blocking** — 32+ disposable email domains blocked at signup
- **Rate Limiting** — AI request queue prevents API abuse
- **Content Protection** — FLAG_SECURE on Android, screenshot prevention
- **Audit Trail** — All admin actions logged to `securityEvents` table

---

## 📊 Audit & Testing

### Playwright Crawler
```bash
npm run audit:app     # UI crawler (20 routes, screenshots, console errors)
npm run audit:all     # Master suite (10 audit domains, 44 checks)
npm run dev-report    # Generate development report (JSON + Markdown)
```

### Audit Results
Reports saved to `./audit-results/`:
- `master-report.json` — Full 10-domain audit results
- `dev-report.json` — Development metrics for founder app
- `dev-report.md` — Human-readable summary
- `screenshots/` — Visual captures of every route

---

## 📝 License

Proprietary — PracticePro Systems Limited, Lagos, Nigeria.
