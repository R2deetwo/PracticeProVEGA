# PracticePro — Complete App Documentation

> **Purpose:** This document gives a new AI assistant full context about the PracticePro codebase, products, business model, architecture, and user flows. Share this document in your first message to the new AI so it has everything it needs.

---

## 1. Company Overview

**Company:** PracticePro Systems Limited
**Location:** Lagos, Nigeria
**Founded:** 2026
**Contact:** practiceprosystems@gmail.com
**Convex Project:** `gregarious-malamute-537.convex.cloud`

**Mission:** PracticePro builds dedicated operating systems for the organizations that run modern Africa. Two specialized products on one platform: **Vega** for Nigerian law firms, **Atrium** for Nigerian property managers, and **Komplete** combining both.

---

## 2. Products

### Vega — Legal Practice Management
- **Target:** Nigerian law firms (solo to enterprise)
- **AI Copilot:** ALOA™ (Advanced Legal Office Assistant)
- **Key Features:**
  - Matter management (case types, court jurisdictions, parties)
  - DraftPro AI document editor (A4 pagination, Nigerian legal fonts, placeholder guardrails)
  - ALDIA document intelligence (AI summary, risk analysis, metadata extraction)
  - Research Studio (jurisdiction-specific modules, statute lookup, AI case analysis)
  - Scale of Charges compliance engine
  - Client Portal (milestone tracking, document vault, KYC uploads)
  - Court Date Reminders (WhatsApp alerts 7/3/1 days before hearings)
  - Automated Retainer Billing & Client Auto-Invoicing
  - Billing Monitor (pending queue, lawyer override controls)
  - Trust Accounting

### Atrium — Property Management
- **Target:** Nigerian property managers, estate managers, gated estates
- **AI Copilot:** ARIA® (Asset & Revenue Intelligence Assistant)
- **Key Features:**
  - Property & Unit Management (multi-unit properties, unit-level tenant tracking)
  - Revenue Monitor (live defaulter dashboard, ledger entries)
  - Service Charge & Minimum Vend (MV) tracking with period management
  - Rent Collection & Receipt Automation (auto-issue receipts to resident portal)
  - Resident Portal (SC/MV status, payment ledgers, automated receipts, maintenance tickets)
  - Sentry Pass VMS (visitor access codes, gatehouse verification, offline cache)
  - Estate Administration document generation (notices & demands)
  - WhatsApp rent/demand notices (unlimited, fair use applies)
  - Lease tracking & maintenance log

### Komplete — Unified Platform
- **Target:** Diversified firms running both legal and property operations
- **AI Copilot:** Both ALOA + ARIA (Uncapped Priority)
- **Key Features:** Everything from Vega Pro + Atrium Pro + Sentry Pass included + 500 GB shared storage + dedicated account manager + priority support + custom integrations

---

## 3. Complete Pricing Matrix

### Vega (Legal) — 4 Tiers

| Tier | Monthly | Annual | Users | Matters | Storage |
|------|---------|--------|-------|---------|---------|
| Core (Free) | ₦0 | ₦0 | 1 | 10 | 1 GB |
| Growth | ₦45,000 | ₦432,000 | 5 | Unlimited | 20 GB |
| Pro ⭐ | ₦80,000 | ₦768,000 | Unlimited | Unlimited | 100 GB |
| Enterprise | Custom | Custom | Unlimited | Unlimited | Custom |

**Growth features:** Court rules, Client Portal (20 clients), ALOA Standard, Retainer billing, Court Date Reminders (WhatsApp)
**Pro adds:** Advanced billing, Uncapped Client Portal, ALOA Priority, Billing Monitor

### Atrium (Property) — 4 Tiers

| Tier | Monthly | Annual | Units | Overage | Forced Upgrade |
|------|---------|--------|-------|---------|----------------|
| Starter | ₦49,000 | ₦490,000 | 10 | ₦2,700/unit/mo | 25 units |
| Growth | ₦96,500 | ₦965,000 | 25 | ₦2,100/unit/mo | 70 units |
| Pro ⭐ | ₦210,000 | ₦2,100,000 | 100 | ₦1,600/unit/mo | 400 units |
| Enterprise | Custom | Custom | Unlimited | N/A | N/A |

**WhatsApp:** Unlimited on ALL tiers (fair use applies). Sophistication per tier:
- Starter: template-based rent & demand notices
- Growth: adds automated triggers (auto-receipts, service charge notices)
- Pro: AI-personalized notices, live-triggered by defaulter dashboard events
- Enterprise: custom automation flows via API

**SCE (Service Charge Equivalent):** `annualPrice ÷ 12 ÷ units`. For Pro, SCE decreases as portfolio grows (₦1,750/unit/mo at 100u → ₦1,637.50 at 400u).

### Komplete (Unified) — Single Tier

| Annual | Seats | Storage |
|--------|-------|---------|
| ₦2,500,000/yr | Unlimited | 500 GB |

Annual-only. Includes everything from Vega Pro + Atrium Pro + Sentry Pass (₦7.5K/mo value) + Estate Community + dedicated account manager.

### Add-Ons
- Extra 5 Seats: ₦20,000/mo
- Extra 10 Seats: ₦36,000/mo
- Extra 50 GB Storage: ₦8,000/mo
- Custom Integration Setup: ₦250,000 one-time
- Sentry Pass (VMS): ₦7,500/mo (free with Komplete; was ₦15,000 — repriced Aug 2026 after audit found 3× overpricing vs. competitor benchmarks ₦5K-8K and 95% margin)
- Estate Community Features: ₦5,000/mo (free with Pro/Enterprise/Komplete; 30-day trial available)
- **Bundle:** Sentry Pass + Estate Community together: ₦10,000/mo (saves ₦2,500)

### Trial System
- 30-day free trial on all paid tiers (no credit card required)
- Firm at Core billing but granted trial plan entitlements
- After 30 days: reverts to Core (data preserved, soft-lock)

---

## 4. Tech Stack

- **Frontend:** React 18 + Vite 5 + TypeScript 5 + TailwindCSS 3.4
- **Backend:** Convex 1.32 (serverless DB + real-time + functions)
- **Mobile:** Capacitor 8.4 (2 APKs: main + founder admin)
- **Auth:** Custom email/password with PBKDF2-SHA512 (600K iterations)
- **AI:** Google Gemini (via @google/genai)
- **Payments:** Paystack (dormant, behind flag) — manual bank transfer is live
- **Email:** Brevo (Sendinblue)
- **WhatsApp:** ChakraHQ integration
- **Push:** Firebase Cloud Messaging
- **Deploy:** Vercel (primary) + Cloudflare Workers (mirror) + GitHub Actions APKs

---

## 5. Codebase Structure

- ~411 TypeScript/TSX files in `src/`
- 348 component files across 24 subdirectories
- 14 React context providers
- 26 custom hooks
- 11 specialized AI agents
- 53 utility files
- Backend: 42 Convex files, 27,545 LOC, 457 exports
- Database: 86 tables, 235 indexes
- 20 cron jobs

### Key Files
| File | Purpose |
|------|---------|
| `src/constants/tiers.ts` | All pricing, features, limits (single source of truth) |
| `src/hooks/useFeatures.ts` | Feature gate logic |
| `convex/schema.ts` | Database schema (86 tables) |
| `convex/myFunctions.ts` | Main backend (116 exports) |
| `convex/portals.ts` | Portal system (111 exports) |
| `convex/crons.ts` | All scheduled tasks |
| `src/contexts/UIContext.tsx` | Theme, font size, toasts, modals, navigation |
| `src/contexts/AuthContext.tsx` | Login, signup, session, MFA |

---

## 6. Feature Gates

| Feature | Gate |
|---------|------|
| AI Copilot (ALOA/ARIA) | Growth+ |
| Advanced Reporting | Pro+ |
| Property Manager | Atrium firm OR Vega Pro+ OR Komplete |
| Client Portal | Growth+ |
| Residents' Portal | Growth+ AND Atrium firm |
| Court Intelligence | Growth+ AND Legal firm |
| Advanced Billing | Pro+ |
| Retainer Auto-Billing | Legal firm AND Growth+ |
| Research Studio | Legal firm AND Growth+ |
| Add Users | Growth+ |
| Audit Logs | Enterprise+ |
| Court Date Reminders | Growth+ |
| Sentry Pass (VMS) | Add-on ₦7,500/mo (free with Komplete/Enterprise) |
| Estate Community Features | Atrium firm AND (Pro+ OR Estate Community add-on ₦5,000/mo active/trial) |

---

## 7. AI Agents (11)

| Agent | Purpose |
|-------|---------|
| ALOA™ | Legal AI copilot — voice chat, daily briefings, function calling |
| ARIA® | Property AI — revenue intelligence, demand notices, portfolio analysis |
| ALDIA | Document intelligence — summary, risk analysis, metadata extraction |
| Data Protection Agent | PII Shield — scans for NIN, BVN; NDPA 2023 compliance |
| RPC Guidance Agent | Reviews AI output for ethical issues |
| Jurisdiction Agent | Auto-suggests court jurisdiction |
| Court Rules Agent | Calculates filing deadlines |
| Scale of Charges Agent | Legal fee schedule compliance |
| Tax Compliance Agent | FIRS, TAT, TCC processing |
| Drafting Agent | AI document drafting |
| Property Management Agent | Property operations |

---

## 8. Onboarding Flow

1. **Signup:** Product selection (Vega/Atrium/Komplete) → Create account form → Email verification
2. **OnboardingWizard:** Workspace name → Plan selection (tier cards, billing toggle, DPA, payment/trial) → Communication channels → Team invite → Review
3. **Team-invite intent persisted:** Choosing "Yes — invite my team" records `settings.teamInviteIntent = 'invited'` so the checklist item ticks off immediately. Choosing "Just me for now" records `'solo'` → item shows dashed "skipped" state, counts toward 100% completion.
4. **Dashboard:** Getting Started checklist appears in sidebar (6 product-specific items)
5. **Onboarding Tour:** 7-step product tour auto-starts 5s after Dashboard mount
6. **CompleteSetupBanner:** Dashboard banner showing next incomplete checklist item

---

## 8.5. Estate Community Features (Atrium only)

Three admin-controllable community modules for residential estates:

| Module | Purpose | Storage |
|--------|---------|---------|
| Amenity Booking | Residents book shared amenities (gym, pool, clubhouse) | `estate_amenities`, `estate_amenity_bookings` |
| Estate Bulletin | Community announcements (events, meetings) — distinct from operational `portal_notices` | `estate_bulletins` |
| Service Provider Directory | Admin-curated vendor list (plumbers, electricians, cleaners) — residents browse and contact directly | `estate_service_providers` |

**Pricing:** Included free with Pro/Enterprise/Komplete. Add-on at ₦5,000/month for Starter/Growth (below Sentry's ₦7,500). 30-day trial available.

**Implementation:**
- Backend: `convex/estateCommunity.ts` (13 mutations + 6 queries, all gated by `requireEstateCommunityAccess`)
- Admin UI: `src/components/settings/EstateCommunitySettings.tsx` (3 toggle switches, shows "Included in Plan" for Pro+ or upgrade CTA for below-Pro)
- Subscription: `EstateCommunityAddonPanel` in SubscriptionSettings (trial/active/expired states, mirrors VMS pattern)
- Resident UI: `src/components/tenant/EstateCommunityResidentView.tsx` (module switcher, renders only admin-enabled modules)
- Resident portal tab: "Community" tab appears only when admin enables at least one module AND the firm has access (Pro+ or active add-on)
- Feature gate: `useFeatures().canUseEstateCommunity` — checked in admin panel (disables toggles if no access) and backend (every query/mutation)

**Key design decision:** All three modules are independently toggleable per-firm. Admin enables only what's relevant to their estate. Commercial-only firms can leave all three disabled — the "Community" tab doesn't appear in their resident portal.

---

## 9. Theme System

12 themes: `system`, `light` (default), `sunlight-soft`, `city-lights`, `city-emerald`, `army-light`, `dark`, `midnight`, `oled`, `neon-cyber`, `midnight-emerald`, `army-dark`

**Key architecture:**
- Applied via `<html>` class in UIContext effect
- Each theme overrides CSS variables (`--color-white`, `--color-black`, `--color-gray-*`, `--bg-main`, `--text-main`)
- Public routes (landing, login, signup) always use `light` theme — user's saved theme NOT applied
- Font size preference also NOT applied on public routes

---

## 10. Deployment

- **Vercel:** `https://practice-pro-vega.vercel.app` (primary)
- **Cloudflare Workers:** `https://practice-pro-vega.prototypechigo.workers.dev` (mirror)
- **Android APK:** GitHub Releases (main + founder admin)
- All deploy on push to `main` via GitHub Actions
- Cache: HTML no-cache, hashed assets immutable 1 year

---

## 11. Known Technical Debt

1. `schemaValidation: false` — strict validation disabled (needs migration pass)
2. `myFunctions.ts` (6,319 LOC) and `portals.ts` (6,091 LOC) are monoliths
3. Dual ID system (client UUID `id` + Convex `_id`) causes dedup bugs
4. `requireFirmUser` anonymous fallback — should require `userEmail` on all calls
5. Paystack dormant (fully built but not activated)
6. `PRICING_STRATEGY.md` is stale (references old pricing)

---

## 12. Business Model

- **Revenue:** B2B SaaS subscription (monthly or annual)
- **Vega:** Seat-based pricing
- **Atrium:** Unit-based pricing with overage + forced upgrade caps
- **Komplete:** Flat-rate annual, unlimited everything
- **Target:** Nigerian law firms + property managers + diversified firms
- **Payment:** Manual bank transfer (live), Paystack (dormant)
- **Setup fees:** Enterprise requires setup fee; Custom Integration = ₦250K
- **Migration services:** "Legacy Intelligence Activation" — ₦250K setup + ₦50K/box
- **Free trial:** 30 days, no credit card, all paid tiers

---

## 17. WhatsApp Architecture (IMPORTANT — Read Before Making Copy Changes)

### How It Actually Works

ChakraHQ is configured at the **PLATFORM LEVEL**, not per-firm. ONE ChakraHQ account serves ALL firms on PracticePro:

1. **Credentials:** Set ONCE as Convex environment variables:
   - `CHAKRA_ACCESS_TOKEN` — Bearer token from Chakra Chat
   - `CHAKRA_PLUGIN_ID` — Found in Chakra Chat → WhatsApp setup → 3-dot menu
   - `CHAKRA_PHONE_NUMBER_ID` — Found in Chakra Chat → WhatsApp setup → gear icon
   - `CHAKRA_WA_API_VERSION` — e.g. "v19.0" (optional, defaults to v19.0)

2. **All firms share** the same WhatsApp Business number and Meta-approved templates. Firms do NOT need their own ChakraHQ account, API keys, or phone number verification.

3. **Firm-level toggle:** In Settings → Integrations, each firm has a simple ON/OFF toggle (`firmDetails.automationSettings.chakra.isActive`). When enabled, messages are sent through the platform-level ChakraHQ credentials.

4. **Meta-approved templates:** The platform admin (you) submits WhatsApp message templates to Meta for approval. Once approved, these templates are used for business-initiated messages outside the 24-hour session window. The sendWhatsApp action supports both template messages and free-form text.

5. **Per-firm fair-use quotas:** The platform tracks `firm.whatsappMessagesSent` and `firm.whatsappLimit`. Currently all tiers are set to `999999` (unlimited sentinel). The `incrementWhatsAppQuota` mutation still runs on every send — it can be used for fair-use anomaly detection without changing the UI.

### How Automated Messages Are Dispatched

The automation pipeline works in two stages:

1. **Cron jobs (internalMutation):**
   - `sendServiceChargeReminders` (daily 6:30 UTC) — scans unpaid service charges, creates `scheduled_messages` rows
   - `runDailyAutomation` (daily 7:00 UTC) — scans T+1 defaulters, creates `scheduled_messages` rows
   - `sendCourtReminders` (daily 6:00 UTC) — scans matters with nextAdjournedDate, creates `scheduled_messages` rows

2. **Dispatch (internalAction):**
   - `processScheduledMessages` (every 5 minutes) — picks up `scheduled_messages` with `status: "scheduled"` and `scheduledFor <= now`, calls the real `sendWhatsApp` action via `ctx.runAction(api.communications.sendWhatsApp)` which makes a real API call to ChakraHQ → Meta Cloud API

### Why Two Stages?

`internalMutation` (cron context) can't call `ctx.runAction` — only `internalAction` can. So the cron creates `scheduled_messages` rows (DB writes), and the `processScheduledMessages` internalAction (which runs every 5 minutes) picks them up and calls the real `sendWhatsApp` action.

### What This Means for Copy

- **"Automated WhatsApp reminders"** is ACCURATE — the cron creates the message, the processScheduledMessages cron dispatches it via the real ChakraHQ API
- Firms do NOT need to "set up integration" or configure API keys — they just toggle WhatsApp ON in Settings → Integrations
- The platform admin (you) just needs to ensure the Convex env vars are set (which you've confirmed they are)
- Meta-approved templates are managed at the platform level — some are approved, some are pending

### Key Files

| File | Purpose |
|------|---------|
| `convex/communications.ts` | `sendWhatsApp` action — real API call to ChakraHQ; `sendWhatsAppInternal` wrapper for internal callers |
| `convex/sentry.ts` | `sendServiceChargeReminders` + `runDailyAutomation` — crons that create scheduled_messages |
| `convex/proactive.ts` | `sendCourtReminders` — cron that creates court date scheduled_messages |
| `convex/portals.ts` | `processScheduledMessages` — internalAction that dispatches scheduled_messages via real sendWhatsApp |
| `src/components/settings/IntegrationSettings.tsx` | Firm-level WhatsApp ON/OFF toggle |
| `convex/sentryWebhook.ts` | ChakraHQ webhook handler (inbound messages from tenants) |

### DO NOT

- Do NOT change copy to say "requires integration setup" — firms just toggle it on
- Do NOT assume each firm needs their own ChakraHQ account — it's platform-level
- Do NOT describe WhatsApp as "simulated" — the dispatch is real once env vars are set
- Do NOT add "Coming Soon" labels — WhatsApp automation IS live

---

*Generated from comprehensive codebase audit on August 22, 2026. All details verified against actual source code.*
