# PracticePro

**The AI-Powered Operating System for Nigerian Legal Practice & Property Management.**

PracticePro is a dual-product SaaS platform that serves two professional verticals from a single, unified codebase:

- **Vega OS** — Legal Practice Management for Nigerian law firms
- **Atrium OS** — Property & Estate Management for property managers and gated estates
- **Komplete** — Unified firms that run both legal and property operations

Built specifically for the Nigerian jurisdiction, PracticePro combines practice management, financial operations, document intelligence, and AI automation into one cohesive platform.

---

## 🏛️ Vega OS — Legal Practice Management

### Smart Matter Management
- **Jurisdiction Intelligence:** AI-suggests the appropriate court (Federal High Court vs. State High Court) based on matter type and Section 251 of the 1999 Constitution.
- **Workflow Automation:** Kanban-style boards with customizable stages for Civil Litigation, Corporate Secretarial, and Real Estate workflows.
- **Matter Intake AI:** Upload case files (PDF/Word) and the Ingestion Agent extracts matter title, area of law, suit number, and opposing parties automatically.
- **External Access:** Securely invite Co-Counsel or Watching Briefs to view specific matters.

### DraftPro™ Editor
A purpose-built legal word processor integrated directly into the browser.
- **Context-Aware:** Automatically pulls Client Name, Suit Number, and Court details into templates.
- **Magic Rewrite:** Uses AI to rewrite casual text into formal legalese.
- **Letterhead Engine:** Overlays the firm's official letterhead on documents for accurate PDF previews and printing.
- **Legal Extensions:** Custom TipTap extensions for legal parties, placeholders, and page breaks.

### Legal Financial Engine
- **Retainer Billing:** Automated recurring retainer invoicing with a staged outbox system (Staged → Queued → Sent → Failed).
- **Billing Monitor:** Real-time outbox tracking with retry and failure management.
- **Tax Compliance:** AI-powered expense deductibility analysis (VAT 7.5%, Withholding Tax 5/10%).
- **Multi-Plan Gating:** Financials locked to Pro+ for legal firms.

### Research Studio
- **Law Reports Terminal:** Searchable database of Nigerian case law with AI-generated ratios and summaries. Available as a subscription add-on.
- **Strategy Studio:** AI-assisted legal strategy development.
- **Vector Notebooks:** Upload case files to a private notebook and ask questions like *"What is the date of the offer letter?"* to extract specific facts across thousands of pages.

### Compliance Module
- **Professional Standards:** Track Annual Practicing Fees and CPD hours.
- **Legal Intelligence Hub:** Manage court rules modules, firm licenses, and usage logs.
- **RPC Guardian:** AI reviews document summaries for ethical compliance with Rules of Professional Conduct (Rule 1.4, 5.1).

### Client Portal
- **Secure Intake:** Public-facing forms where prospective clients can record voice notes or upload documents.
- **Client Dashboard:** Clients log in to view case status, pay invoices, upload documents, and submit service requests.
- **Threaded Messaging:** Portal conversations with file attachments that auto-link to matters.
- **Service Requests:** Admin-configurable request types (Document Review, Meeting Request, Billing Inquiry).

---

## 🏢 Atrium OS — Property & Estate Management

### Property Portfolio Management
- **Multi-Unit Properties:** Track individual units within buildings — rent amounts, tenant details, lease terms, amenity tracking.
- **Lease Lifecycle:** Lease expiry tracking with urgency alerts (≤90 days warning, expired flagging).
- **Vacancy Pipeline:** Lead management from Inquiry → Vetted → Lease Generated → Closed, with vetting scores.
- **Bulk Operations:** Bulk edit properties, bulk rent collection, and rent review notice PDF generation.
- **Property Tracking:** Maintenance history, rent payment history, tracking timeline, and image galleries per property.

### Revenue Engine
Atrium's financial hub — accessible as tabs within the Financials page:
- **Service Charge Monitor:** Track service charges (Diesel, Security, Cleaning, Water, Other) with defaulter detection, 5% penalty rate, per-unit mute, and cycle presets (Monthly/Quarterly/Annually).
- **Payments & Receipts Ledger:** Full ledger with entry types (rent, service_charge, penalty, deposit) and statuses (cleared, pending, defaulted).
- **Reminder Rules:** Automated WhatsApp/Email/SMS reminder rules with customizable templates (rent reminders, late notices, payment receipts, service charge alerts, access restrictions, penalty notices, lease renewals, welcome notes, and more).
- **Available Units:** Vacancy tracking integrated with the lead pipeline.

### Resident (Tenant) Portal
Feature-gated to Atrium Growth+ plans.
- **Dashboard:** Personal financial summary, outstanding balance, quick actions.
- **Ledger:** Complete financial ledger with rent receipts, service charge status, and payment history.
- **Maintenance:** Submit maintenance tickets with image/video attachments; admin-configurable request types.
- **Messages:** Direct messaging with property management (if enabled).
- **Payments:** Upload payment proofs (receipts, transfer slips) for admin verification.
- **Notice Board:** Pinned notices, priority alerts, property/unit-scoped announcements.
- **Documents:** Secure document sharing between management and residents.
- **Visitor Management:** Generate 6-digit access codes for visitors (see VMS below).
- **Accessibility:** Font size controls, theme isolation (light/dark only), mobile-optimized layout.

### Visitor Management System (VMS)
A gated-estate access control system built into the Resident Portal:
- **Resident Code Generation:** Residents create 6-digit visitor access codes with expiry windows (2h, 6h, 12h, 24h).
- **Dual Delivery:** Share via personal WhatsApp (free, no API cost) or automatic portal delivery via Chakra WhatsApp API.
- **Gatekeeper Interface:** Lightweight verification portal for gate tablets/phones — code entry, instant verification (green/red screens), check-in/check-out logging.
- **Offline Fallback:** Gatekeeper caches last 100 verifications in localStorage for Lagos network downtime.
- **Grace Periods:** Configurable buffer (default 30 min) allows entry slightly before/after the rigid expiry window.
- **Revocation:** Residents can instantly revoke active codes from their dashboard.
- **Admin Configuration:** Toggle VMS on/off, configure gatekeeper/resident notifications, set grace periods and default validity — all in Settings → Portal Access.

### Automated Communications
- **WhatsApp Integration:** ChakraHQ WhatsApp API for automated rent reminders, late notices, and service charge alerts.
- **Email Integration:** Brevo email for formal notices and receipts.
- **Scheduled Messages:** Queue messages for future delivery with a 5-minute cron processor.
- **Automation Templates:** Custom message templates per firm with variable substitution (tenant name, amounts, dates, addresses, Google Maps links).
- **Compose Modal:** Send individual or bulk messages via WhatsApp, Email, or Portal.

### Property Financials
- **Invoices & Demands:** Generate rent demands, service charge invoices, and penalty notices.
- **Always Available:** Unlike Vega (Pro+ gated), Atrium financials are available on all plans — it's the primary revenue hub.
- **Minimum Vend/Estate Fees:** Property-level toggle for minimum vend charges with custom labels and amounts.

---

## 🤖 AI Workforce — ALOA® / ARIA®

PracticePro utilizes a multi-agent AI architecture powered by Google Gemini. The assistant is branded **ALOA®** for legal firms and **ARIA®** for property firms.

### AI Agents (running automatically, no per-agent toggles needed)

| Agent | Function | Product |
| :--- | :--- | :--- |
| **ALOA/ARIA Chat** | Conversational assistant for matters, drafting, finance, and portfolio queries | Both |
| **ALDIA** (Advanced Legal Document Intelligence) | Multi-agent document analysis — summaries, key clauses, risk scores, parties, dates, governing law | Both |
| **RPC Review** | Ethics & accuracy check built into ALDIA | Vega |
| **PII Shield** | Strips NIN, BVN, bank account numbers before AI processing | Both |
| **Brain Memory** | Vector recall over your firm's documents and notes | Both |
| **Research** | Multi-source legal research with citations | Vega |
| **Tax Compliance** | Nigerian tax analysis on expenses | Vega |
| **Ingestion Agent** | AI matter intake from uploaded documents | Vega |
| **Jurisdiction Scout** | Analyzes facts to determine court venue | Vega |
| **Property Management** | Atrium system instruction for property-specific AI responses | Atrium |

### AI Features
- **AI Request Queue:** Deterministic sequential processing — no race conditions or out-of-order responses.
- **15-second timeout:** AbortController prevents UI freezes on mobile networks.
- **API Key Pre-Flight:** Validates key existence before any network call.
- **PII Reporting:** Visible indicator showing what PII was stripped before sending to AI.
- **Proactive Intelligence:** Deadline scanning, anomaly detection, and AI morning briefings via cron jobs.
- **Conversation Memory:** Nightly summarization of conversations for cross-session continuity.
- **Voice Dictation:** Web Speech API integration for notes with punctuation commands.

---

## 🔐 Client & Resident Portals

### Shared Portal Infrastructure
- **Magic-Link Invites:** Secure token-based invitations via email/WhatsApp.
- **Threaded Conversations:** Portal messages with file attachments, sub-threading per ticket, and inline ticket controls.
- **Notice Boards:** Pinned notices, priority levels, property/unit-scoped targeting.
- **Service Request Types:** Admin-configurable catalog per firm per portal type.
- **Portal Settings:** Toggle messaging, payment proof uploads, VMS, and notification preferences per firm.

### Portal Settings (Admin)
Located in **Settings → Portal Access**:
- Client Portal invites and management (Vega)
- Resident Portal invites and management (Atrium)
- Service Request Types configuration
- Visitor Management System settings (Atrium):
  - Enable/disable visitor codes
  - Gatekeeper WhatsApp notifications
  - Resident arrival notifications
  - Grace period configuration (0/15/30/60 min)
  - Default validity window (2/6/12/24 hours)

---

## 📊 Analytics & Reporting

### Financial Reports
- Profit & Loss, AR Aging, Timesheet, Utilization, Matter Status, Profitability

### Business Intelligence (Pro+)
- Case Analytics, Client Analytics, Property Analytics

### Property Reports (Atrium)
- Revenue tracking, defaulter reports, vacancy analytics

### Compliance Reports (Vega)
- Professional standards, practicing fees, CPD tracking

---

## 🛠 Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite |
| **Backend** | Convex (real-time database, cron jobs, file storage) |
| **AI Engine** | Google Gemini 2.0 Flash / 2.5 Pro (`@google/genai`) |
| **Mobile** | Capacitor v8 (Android APK) |
| **State** | React Context API (local-first architecture) |
| **Editor** | TipTap (DraftPro) |
| **PDF** | jsPDF + autoTable |
| **WhatsApp** | ChakraHQ API |
| **Email** | Brevo (Sendinblue) |
| **Auth** | Convex Auth with biometric unlock |
| **CI/CD** | GitHub Actions (auto-deploys Convex + builds APK) |

---

## 📂 Project Structure

```
/
├── convex/                    # Backend (Convex)
│   ├── schema.ts              # 60+ database tables
│   ├── portals.ts             # Portal messaging, tickets, invitations
│   ├── visitorManagement.ts   # VMS token generation & verification
│   ├── communications.ts      # WhatsApp (Chakra) & Email (Brevo)
│   ├── retainerBilling.ts     # Automated retainer invoicing
│   ├── backups.ts             # Nightly backup to GitHub + Telegram
│   ├── crons.ts               # Scheduled jobs
│   └── ...
├── src/
│   ├── components/
│   │   ├── aloa/              # AI Chat (ALOA/ARIA) interface
│   │   ├── atrium/            # Atrium-specific (Revenue Engine, VMS, etc.)
│   │   ├── auth/              # Login, biometric unlock
│   │   ├── client/            # Client Portal (Vega)
│   │   ├── tenant/            # Resident Portal (Atrium)
│   │   ├── portal/            # Shared portal components (Visitor, Gatekeeper)
│   │   ├── documents/         # DraftPro Editor (TipTap)
│   │   ├── research/          # Research Studio & Law Reports
│   │   ├── settings/          # 14 settings tabs
│   │   ├── details/           # Matter & Property detail views
│   │   ├── forms/             # Modal forms (Matter, Task, Invoice, etc.)
│   │   └── toolkit/           # Reusable UI primitives
│   ├── agents/                # AI agents (ALDIA, Research, etc.)
│   ├── contexts/              # Global state (Auth, Data, UI, ALOA)
│   ├── services/              # API wrappers (Gemini, Brain)
│   ├── utils/                 # Helpers (PII, AI queue, haptics, etc.)
│   └── constants.tsx          # Icons, types, config
├── android/                   # Capacitor Android project
└── .github/workflows/         # CI/CD (APK build + Convex deploy)
```

---

## ⚡ Getting Started

1. **Install Dependencies:** `npm install`
2. **Configure Environment:** Set `VITE_CONVEX_URL` in `.env`
3. **Set AI Key:** In the app, go to Settings → AI Settings → API Key Configuration and paste your Google Gemini API key (get one free at [Google AI Studio](https://aistudio.google.com/app/apikey))
4. **Run Development Server:** `npm run dev`
5. **Build APK:** Push to `main` — GitHub Actions builds the APK automatically

---

## 📦 Subscription Plans

| Plan | Vega (Legal) | Atrium (Property) |
| :--- | :--- | :--- |
| **Core** | Basic matter management | Basic property tracking |
| **Growth** | + Client Portal, Research, Analytics | + Resident Portal, VMS, Analytics |
| **Pro** | + Financials, Billing Monitor, BI Reports | + All Growth features (financials always included) |
| **Enterprise** | + Audit Logs, Automation Engine, External Counsel | + All Pro features |
| **Komplete** | Unified firm — both Vega + Atrium features | Unified firm — both Vega + Atrium features |

---

## 🔒 Security & Compliance

- **PII Shield:** Automatically strips NIN, BVN, bank account numbers before AI processing.
- **Content Protection:** FLAG_SECURE on Android prevents screenshots (banking-app level).
- **Biometric Unlock:** Fingerprint/face unlock via Capacitor biometric auth.
- **Audit Logs:** Enterprise+ firms get full audit trail of all actions.
- **NDPA Aligned:** Data protection practices aligned with Nigeria Data Protection Act.
- **Portal Security:** Magic-link authentication, role-based access, session isolation.

---

## 🔄 Backup System

PracticePro includes a multi-target cloud backup system (no credit card required):
- **GitHub Private Repo:** Nightly full-database export committed to a private GitHub repository.
- **Telegram Bot Channel:** Same backup also sent to a private Telegram channel via Bot API.
- **30-day rolling retention:** Old backups automatically deleted.
- **Manual trigger:** Run a backup on-demand from the Convex dashboard.

---

&copy; 2024–2026 PracticePro Legal Technologies. All rights reserved.
