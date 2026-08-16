# PracticePro — Complete Business & Product Context Document
## For AI-Assisted Launch Readiness Audit (Atrium + Platform)

---

## 1. COMPANY OVERVIEW

**Company:** PracticePro Systems Limited
**Location:** Lagos, Nigeria
**Contact:** practiceprosystems@gmail.com | founder@practicepro.ng
**Mission:** Professional practice management, precisely managed — for Nigerian law firms and property managers.

**What we do:** PracticePro is a dual-product SaaS platform serving Nigerian professional service firms:
1. **Vega** — Legal practice management (case management, AI drafting, billing)
2. **Atrium** — Property management (rent collection, resident portals, maintenance)
3. **Komplete** — Unified platform combining both (for diversified firms)

**Founder:** Single founder, building with AI assistance. The platform is in active beta with real users.

---

## 2. PRODUCT ARCHITECTURE

### Technology Stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Convex (serverless database with real-time WebSocket subscriptions)
- **Mobile:** Capacitor 8 (wraps the web app into native Android APKs)
- **AI:** Google Gemini (ALOA/ARIA AI copilot, DraftPro document generation)
- **Payments:** Paystack (Nigerian payment gateway) + Manual Bank Transfer
- **Push Notifications:** Firebase Cloud Messaging (FCM) via Capacitor
- **Email:** Brevo (transactional emails)
- **Hosting:** Vercel (frontend) + Convex Cloud (backend) + Cloudflare Pages (alt frontend)
- **Code:** GitHub (R2deetwo/PracticeProVEGA)

### Two APKs
1. **User APK** (com.practicepro.app) — The main app for law firms and property managers
2. **Founder APK** (com.practicepro.admin) — Admin dashboard for the PracticePro founder (manages firms, subscriptions, sales leads, feedback)

### Convex Deployment
- **Active deployment:** `gregarious-malamute-537.convex.cloud` (production)
- **Old deployment:** `keen-jaguar-204.convex.cloud` (deprecated — was used during development)

---

## 3. PRICING & TIERS

### Vega (Legal) — Monthly or Annual
| Tier | Monthly | Annual | Users | Active Matters | Storage |
|------|---------|--------|-------|----------------|---------|
| Core (Free) | ₦0 | ₦0 | 1 | 10 | 1GB |
| Growth | ₦45,000 | ₦432,000 | 5 | Unlimited | 20GB |
| Pro | ₦75,000 | ₦720,000 | Unlimited | Unlimited | 100GB |
| Enterprise | Custom | Custom | Unlimited | Unlimited | Unlimited |

### Atrium (Property) — Annual Only
| Tier | Annual | Units | Tenants | WhatsApp Messages |
|------|--------|-------|---------|-------------------|
| Core | ₦150,000 | 10 | 15 | 100/mo |
| Growth | ₦350,000 | 25 | 40 | 500/mo |
| Pro | ₦2,100,000 | Unlimited | Unlimited | Unlimited |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited |

### Komplete (Unified)
| Tier | Annual | Users | Features |
|------|--------|-------|----------|
| Komplete | ₦2,500,000 | 1 account, 10 seats | All Vega + Atrium features |

### Add-Ons
1. **Extra 5 Seats** — ₦20,000/mo
2. **Extra 10 Seats** — ₦36,000/mo
3. **Extra 50 GB Storage** — ₦8,000/mo
4. **Custom Integration Setup** — ₦250,000 (one-time)
5. **Sentry Pass (VMS)** — ₦15,000/mo (14-day free trial)

---

## 4. ATRIUM (Property Management) — Feature Breakdown

### Core Features
- **Property Portfolio Management** — Residential, commercial, mixed-use. Track occupancy, photos, tenancy records.
- **Resident Management** — Complete resident profiles with KYC, lease agreements, communication history.
- **Residents' Portal** — Self-service portal where residents view payment status, download receipts, log maintenance tickets, generate visitor access codes.
- **Revenue Monitor** — Real-time defaulter dashboard, rent collection tracking, portfolio-level financial analytics.

### Rent & Collections
- **Rent Collection** — Naira rent collection with payment reminders, receipt generation, payment tracking.
- **Service Charge Tracking** — Itemized SC (Service Charge) and MV (Minimum Vend) tracking per unit.
- **WhatsApp Notifications** — Rent reminders and demand notices via WhatsApp (tiered volume limits).
- **Lease Management** — Lease expiry alerts, calendar integration, renewal notices.
- **Payment Pipeline** — Paystack (cards/bank/USSD) + Manual Bank Transfer with proof upload. Dynamic bank details from Founder Financial Hub.

### Maintenance & Operations
- **Maintenance Tickets** — Residents log issues via portal. Categorize by plumbing, electrical, structural, etc.
- **Expense Tracking** — Log maintenance costs, service charges, utility bills per property.
- **Estate Administration Documents** — Generate standard estate management documents.
- **Core Services Toggles** — Property managers can toggle Service Charge, Electricity, Internet, Waste Management as Active/Inactive per property.

### Sentry Pass (Visitor Management System)
- **6-digit visitor access codes** — Residents generate codes for guests, contractors, delivery personnel.
- **QR Code** — Each pass includes a scannable QR code for gate verification.
- **Sentry Pass Terminal** — Gatekeepers verify codes at a public web terminal (/gatehouse?firmId=xxx).
- **Audit Trail** — Full check-in/check-out timestamps. Codes expire automatically.
- **Standardized Pass Message** — Structured SMS/WhatsApp format with host name, destination, validity.
- **14-day free trial** → ₦15,000/month add-on.
- **Billing gate** — Code generation blocked if trial expired or subscription inactive.

### Resident Portal Features
- **Hero Header** — Resident name, Unit identifier, full property address.
- **Quick Services Grid** — Pay Rent, Service Charge, Electricity, Internet, Waste Mgmt, Maintenance, Messages, Receipts, Documents.
- **Management-Only mode** — Properties marked "Management Only" hide Pay Rent and suppress Lease Agreement.
- **Payment Pipeline** — Paystack + Bank Transfer with dynamic company bank details.
- **Ledger** — Comprehensive financial ledger (rent, service charge, electricity, etc.).
- **Documents** — Tiered storage: Billing (invoices/receipts), Legal (lease agreements), User Uploads (proof of payment), Shared/Notices.
- **Contact Property Manager** — Deep links: mailto: for email, tel: for phone, internal message thread.
- **Help Section** — Accordion-style FAQ with categories: Payments & Billing, Maintenance, Visitor Access, Utilities, General Info.

---

## 5. VEGA (Legal Practice Management) — Feature Breakdown

### Core Features
- **Matter Management** — Organize cases by court, jurisdiction, matter type. Link documents, parties, deadlines.
- **Court Date Reminders** — Automated WhatsApp reminders 7, 3, and 1 day(s) before hearings (Pro plan).
- **Task Board** — Kanban-style task management with assignments, due dates, priority levels.
- **Client Portal** — Self-service portal for clients to view milestones, upload documents, submit KYC.
- **Contacts & Parties** — Structured contact management with party grouping, witness tracking, counsel records.

### Legal Drafting
- **DraftPro Editor** — Rich-text editor with A4 pagination, Nigerian legal fonts, placeholder guardrails.
- **ALOA AI Copilot** — Legal intelligence: case summaries, opposing counsel analysis, precedent research.
- **Document Vault** — Secure storage linked to matters. Version history, access controls, full-text search.
- **Research Studio** — Legal research workspace with jurisdiction-specific modules, statute lookup, AI-assisted case analysis.
- **Inline Draft Pills** — Hover-reveal "Draft in DraftPro" action on AI-generated list items (context-aware document generation).

### Billing & Finance
- **Legal Billing** — Professional invoices, billable hours, court-aligned rates, retainer billing automation.
- **Financial Dashboard** — Revenue analytics, outstanding balances, payment tracking.
- **Bank Transfer Payments** — Nigerian bank account details on invoices.

---

## 6. CROSS-PLATFORM FEATURES

### AI Infrastructure
- **ALOA (Vega) / ARIA (Atrium)** — AI copilot with 4 modes: Auto, Flash, Pro, Research.
- **PII Shield** — Automatically strips personally identifiable information before AI processing.
- **Citation Registry** — Inline citations with source verification.
- **Workspace Isolation** — RAG/vector search hard-filtered by workspace_id. No cross-firm data leakage.
- **Privacy-safe Analytics** — AI Usage Center shows aggregate counts only (no message content).

### Notification System
- **In-app notifications** — Bell badge with unread count, real-time via Convex WebSocket.
- **FCM Push Notifications** — Native push to Android devices via Capacitor + Firebase.
- **Notification channels** — Messages (max priority), Tasks (high), General (default).
- **Toast system** — Unified glassmorphic toasts (max 3 visible, debounced, swipe-to-dismiss).
- **Refresh toast** — Persistent "Update Available" notification (doesn't auto-dismiss).

### Security
- **Row-level security** — Convex backend enforces firmId isolation on all queries.
- **Disposable email blocking** — 32 known disposable email domains blocked on signup.
- **Rate limiting** — AI request queue with 15-second timeout.
- **Content protection** — FLAG_SECURE (screenshot prevention) on Android.
- **2FA** — Optional two-factor authentication with recovery codes.
- **Audit trail** — All admin actions logged.
- **NDPA 2023 compliance** — Nigerian Data Protection Act compliance (privacy policy, DPA, cookie policy).

### Founder App (Admin Dashboard)
- **Dashboard** — KPIs, growth curves, practice area breakdowns.
- **Organizations Hub** — Multi-criteria filtering, master-detail drawer, firm health metrics.
- **Sales Pipeline** — Inbound sales leads from Contact Sales form. Real-time badge.
- **Feedback Inbox** — User feedback/bug reports with reply + email toggle.
- **Financial Hub** — Corporate bank account management (single source of truth for all checkouts).
- **Broadcast Console** — Send targeted broadcasts to specific firms/user segments.
- **Security Center** — Live session feed, security alerts, disposable email blocks.
- **AI Usage Center** — Privacy-safe aggregate AI usage analytics.
- **Subscription Requests** — Approval queue for plan upgrades and add-on purchases.
- **Push notifications** — FCM push to founder's device for: new feedback, sales leads, add-on requests.

---

## 7. CURRENT STATE & KNOWN ISSUES

### What Works
- ✅ User authentication (custom auth, not Convex Auth)
- ✅ Multi-tenant data isolation
- ✅ Matter/property CRUD
- ✅ AI chat (ALOA/ARIA) with Gemini
- ✅ DraftPro document generation
- ✅ Resident portal with payments
- ✅ Sentry Pass (VMS) with QR codes
- ✅ Team chat with real-time notifications
- ✅ Push notifications (FCM with channelId fix)
- ✅ APK builds (both user + admin)
- ✅ Sales lead pipeline with founder notifications
- ✅ Add-on billing accordion with Paystack integration
- ✅ Legal compliance pages (Privacy Policy, Terms, Cookie Policy, DPA)

### What Needs Work (Launch Blockers for Atrium)
1. **Clients vs Residents separation** — Currently combined in messaging. Need separate accordions.
2. **Delete support channel messages** — No delete button on System Inbox messages.
3. **Task detail view** — Clicking a task opens edit modal instead of a read-only detail card.
4. **"More" tab badge** — Aggregate unread count doesn't surface on the More nav button.
5. **App-scoped What's New** — Changelog not filtered by product (vega/atrium/komplete).
6. **Help section deep search** — FAQ search is shallow.
7. **Paystack production key** — VITE_PAYSTACK_PUBLIC_KEY not set (test key only).
8. **Convex deploy key** — Need the deploy key for `gregarious-malamute-537` (active deployment) to push backend changes.

### What's Deployed
- **Frontend:** Vercel (auto-deploys from GitHub master branch)
- **Backend:** Convex `gregarious-malamute-537` (active, has real user data)
- **APKs:** GitHub Actions builds both user + admin APKs on push to main
- **Cloudflare:** Alternative frontend hosting (manual deploy via `npx wrangler deploy`)

---

## 8. LEGAL & COMPLIANCE

- **Privacy Policy** — 18,337 chars, NDPA 2023 compliant
- **Terms of Service** — 39,093 chars, role-based consent (founder/admin/lawyer/paralegal/portal)
- **Cookie Policy** — Complete (173 lines, covers tracking, local storage, session cookies, consent)
- **Data Processing Agreement** — 13,419 chars
- **Usage Policy** — 15-section policy covering acceptable use, AI features, portal access, payments, IP, compliance
- **Nigerian governing law** — All legal documents specify Nigerian governing law

---

## 9. BUSINESS MODEL

### Revenue Streams
1. **Subscription fees** — Monthly (Vega) or Annual (Atrium, Komplete) per firm
2. **Add-on sales** — Extra seats, storage, custom integrations, Sentry Pass
3. **Enterprise contracts** — Custom pricing for large firms/developers

### Payment Methods
1. **Paystack** — Cards, bank accounts, USSD (Nigerian payment gateway)
2. **Manual Bank Transfer** — Company bank details displayed, proof of payment uploaded
3. **Founder approval** — Bank transfers require founder verification before activation

### Target Market
- **Vega:** Nigerian law firms (solo practitioners to multi-branch firms)
- **Atrium:** Nigerian property managers, estate surveyors, developers with residential/commercial portfolios
- **Komplete:** Diversified firms handling both legal and property matters

### Competitive Advantage
- **Nigeria-first** — Built specifically for Nigerian legal and property management conventions
- **WhatsApp integration** — Rent reminders, demand notices, court date reminders via WhatsApp
- **AI-powered** — Gemini-powered legal drafting, case analysis, property management insights
- **Resident portal** — Self-service portal with payments, maintenance, visitor management
- **Affordable** — Pricing designed for the Nigerian market (starting at ₦150,000/yr for Atrium)

---

## 10. GO-TO-MARKET CHECKLIST FOR ATRIUM LAUNCH

### Pre-Launch
- [ ] Fix Paystack production key (VITE_PAYSTACK_PUBLIC_KEY)
- [ ] Get Convex deploy key for gregarious-malamute-537
- [ ] Deploy latest backend code to gregarious-malamute-537
- [ ] Split Clients and Residents into separate messaging accordions
- [ ] Add delete button for support channel messages
- [ ] Fix task detail view (read-only card instead of edit modal)
- [ ] Add "More" tab aggregate badge
- [ ] Filter What's New by product module
- [ ] Comprehensive help section with deep search
- [ ] Test payment pipeline end-to-end (Paystack + bank transfer)
- [ ] Test Sentry Pass end-to-end (code generation → gatehouse verification → QR scan)
- [ ] Test resident portal on mobile (APK)

### Launch
- [ ] Production Paystack key configured
- [ ] Company bank account details set in Founder Financial Hub
- [ ] All legal pages reviewed and finalized
- [ ] APK distributed to beta property managers
- [ ] Sentry Pass add-on trial available
- [ ] Landing page Atrium section polished
- [ ] Pricing page clear and accurate
- [ ] Onboarding wizard for new Atrium firms
- [ ] Welcome email sequence for new signups

### Post-Launch
- [ ] Monitor sales lead pipeline (Founder App)
- [ ] Monitor feedback inbox for bugs
- [ ] Track AI usage analytics
- [ ] Monitor push notification delivery
- [ ] Gather user feedback on resident portal UX
- [ ] Iterate on pricing based on conversion data
