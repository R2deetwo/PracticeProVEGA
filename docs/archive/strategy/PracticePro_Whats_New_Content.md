# PRACTICEPRO — WHAT'S NEW (CHANGELOG CONTENT)
## Ready-to-Use Changelog Entries
## Tagged by Product: Vega | Atrium | Komplete

---

## AUGUST 2026

### Entry 1
- **Version:** v2.4.0
- **Date:** 2026-08-14
- **Products:** vega, atrium
- **Category:** feature
- **Title:** AI Drafting & Resident Portal Payment History
- **Summary:** DraftPro now supports inline citations with source verification. The Resident Portal gets a comprehensive payment history view. Plus 6 bug fixes.
- **Details:** |
    **Vega — DraftPro Enhancements:**
    - Inline citation pills now appear on all AI-generated legal references
    - Click any citation to verify the source in our Citation Registry
    - Placeholder guardrails now catch 40% more formatting errors before export
    - New Nigerian legal fonts added: Times New Roman (Court of Appeal standard), Bookman Old Style

    **Atrium — Resident Portal:**
    - New "Payment History" tab shows 12 months of rent, service charge, and utility payments
    - Filter by payment type, date range, or status
    - Download consolidated PDF statement for any period
    - Export to Excel for personal record-keeping

    **Fixes:**
    - Fixed: Paystack checkout occasionally failing on mobile browsers
    - Fixed: WhatsApp reminders sending duplicate messages for same tenant
    - Fixed: Sentry Pass QR codes not scanning in low light conditions
    - Fixed: Document vault search returning incorrect results for hyphenated names
    - Fixed: Task board not updating in real-time for assigned team members
    - Fixed: Client portal login redirect loop on certain Android devices

---

### Entry 2
- **Version:** v2.3.2
- **Date:** 2026-08-02
- **Products:** atrium
- **Category:** improvement
- **Title:** Sentry Pass Gatehouse Terminal Upgrade
- **Summary:** The gatehouse verification terminal now supports offline mode, bulk code validation, and dark theme for night shifts.
- **Details:** |
    **Sentry Pass Terminal (/gatehouse):**
    - Offline mode: verify codes without internet (syncs when connection returns)
    - Bulk validation: scan multiple QR codes in rapid succession for event entry
    - Dark theme: reduces eye strain for night-shift security personnel
    - New "Expected Visitors" list: residents can pre-register guests for specific time windows
    - Audit trail export: download CSV of all check-ins/check-outs for any date range

    **Improvements:**
    - QR code scanning speed improved by 60%
    - Terminal now works on any tablet or phone browser (no app install needed)
    - Auto-logout after 5 minutes of inactivity for security

---

## JULY 2026

### Entry 3
- **Version:** v2.3.0
- **Date:** 2026-07-22
- **Products:** vega, atrium, komplete
- **Category:** feature
- **Title:** Komplete Unified Dashboard & Cross-Product Search
- **Summary:** Komplete users now get a unified dashboard showing legal and property metrics side by side. Plus: global search across both products.
- **Details:** |
    **Komplete — Unified Dashboard:**
    - Split-view dashboard: left side shows Vega KPIs (matters, billing, court dates), right side shows Atrium KPIs (rent collected, defaulters, occupancy)
    - Cross-product alerts: one notification bell for both legal and property events
    - Unified calendar: court dates and lease renewals in one view
    - Shared storage pool: 500 GB across both products with usage breakdown

    **Global Search:**
    - Search across matters, properties, tenants, clients, and documents from any screen
    - Results grouped by product with clear labels
    - Keyboard shortcut: Cmd/Ctrl + Shift + K

    **Billing:**
    - Single invoice for both products
    - Prorated add-ons apply across the unified account

---

### Entry 4
- **Version:** v2.2.5
- **Date:** 2026-07-10
- **Products:** atrium
- **Category:** feature
- **Title:** Service Charge Bulk Billing & Electricity Sub-Metering
- **Summary:** Property managers can now bill service charges to all units in bulk and track electricity usage per unit with sub-meter readings.
- **Details:** |
    **Service Charge Bulk Billing:**
    - Create one SC invoice and distribute across all units automatically
    - Prorate by unit size or occupancy
    - Auto-calculate arrears and apply to next billing cycle
    - Tenants see itemized SC breakdown in their portal

    **Electricity Sub-Metering:**
    - Log meter readings per unit per month
    - Auto-calculate consumption and cost
    - Compare usage across units to identify anomalies
    - Export readings to Excel for utility company reconciliation

    **Core Services Toggle:**
    - New toggle for "Electricity" in property settings
    - Enable/disable per property (not all estates manage electricity)

---

### Entry 5
- **Version:** v2.2.0
- **Date:** 2026-07-01
- **Products:** vega
- **Category:** feature
- **Title:** ALOA Research Mode & Opposing Counsel Analysis
- **Summary:** ALOA AI Copilot gets a new "Research" mode for deep legal research. Plus: analyze opposing counsel's case history and win rates.
- **Details:** |
    **ALOA Research Mode:**
    - 4th mode added to Auto, Flash, and Pro: "Research" for comprehensive legal research
    - Searches Nigerian case law, statutes, and legal commentaries
    - Generates annotated briefs with full citations
    - Export research as PDF or Word document

    **Opposing Counsel Analysis:**
    - Upload opposing counsel's name and jurisdiction
    - ALOA retrieves public case history (where available)
    - Win/loss rate analysis by case type
    - Suggested counter-strategies based on historical patterns

    **Privacy Note:**
    - All research queries run through PII Shield
    - No client data is included in AI prompts
    - Research history is firm-isolated (not shared across workspaces)

---

## JUNE 2026

### Entry 6
- **Version:** v2.1.0
- **Date:** 2026-06-18
- **Products:** vega, atrium
- **Category:** feature
- **Title:** WhatsApp Demand Notices & Retainer Auto-Billing
- **Summary:** Atrium now sends formal demand notices via WhatsApp. Vega automates retainer billing with recurring invoices.
- **Details:** |
    **Atrium — WhatsApp Demand Notices:**
    - Generate legally formatted demand notices from the Revenue Monitor
    - Send via WhatsApp with delivery confirmation
    - Auto-schedule follow-up notices at 7, 14, and 30 days
    - Track which tenants have read the notice
    - Export notice history for legal proceedings

    **Vega — Retainer Auto-Billing:**
    - Set up recurring retainer invoices (monthly, quarterly, annually)
    - Auto-deduct from client trust account
    - Alert when retainer balance falls below threshold
    - Generate utilization reports showing hours vs. retainer burn
    - Integrates with matter time tracking

---

### Entry 7
- **Version:** v2.0.5
- **Date:** 2026-06-05
- **Products:** atrium
- **Category:** improvement
- **Title:** Revenue Monitor 2.0 & Defaulter Predictions
- **Summary:** The Revenue Monitor dashboard gets a full redesign with predictive analytics. See which tenants are likely to default before they do.
- **Details:** |
    **Revenue Monitor 2.0:**
    - New card-based layout: Outstanding Rent, Collected This Month, Defaulter Count, Occupancy Rate
    - Trend charts: 6-month rent collection curves
    - Property comparison: side-by-side financial performance
    - Export full portfolio report to PDF

    **Defaulter Predictions:**
    - AI-powered risk scoring for each tenant
    - Factors: payment history, lease age, maintenance ticket frequency, portal login recency
    - Risk levels: Low (green), Medium (amber), High (red)
    - Proactive alert: "3 tenants flagged as high default risk this month"
    - Suggested actions per tenant (payment plan, guarantor follow-up, etc.)

---

## MAY 2026

### Entry 8
- **Version:** v2.0.0
- **Date:** 2026-05-20
- **Products:** vega, atrium, komplete
- **Category:** feature
- **Title:** PracticePro 2.0 — New Design, Faster Performance, Mobile App
- **Summary:** Complete platform redesign with a modern UI, 3x faster load times, and native Android apps for both user and founder dashboards.
- **Details:** |
    **New Design:**
    - Complete visual refresh: cleaner cards, better typography, improved contrast
    - Dark mode support (system preference or manual toggle)
    - Improved navigation: collapsible sidebar, breadcrumb trails
    - Accessibility: WCAG 2.1 AA compliant (keyboard navigation, screen reader support)

    **Performance:**
    - 3x faster initial load time (code splitting, lazy loading)
    - Real-time sync optimized: 50% less WebSocket traffic
    - Image optimization: auto WebP conversion, responsive sizing
    - Offline support: cache critical data for 24 hours

    **Mobile Apps:**
    - User APK (com.practicepro.app): full Vega + Atrium functionality
    - Founder APK (com.practicepro.admin): admin dashboard on mobile
    - Push notifications via Firebase Cloud Messaging
    - Biometric login (fingerprint/face unlock)
    - FLAG_SECURE enabled (prevents screenshots on Android)

---

### Entry 9
- **Version:** v1.9.0
- **Date:** 2026-05-08
- **Products:** vega
- **Category:** feature
- **Title:** Research Studio & Statute Lookup
- **Summary:** New Research Studio workspace for deep legal research. Search Nigerian statutes by jurisdiction, year, and keyword.
- **Details:** |
    **Research Studio:**
    - Dedicated workspace for legal research (separate from matter files)
    - Jurisdiction-specific modules: Federal, Lagos State, Abuja FCT, etc.
    - Save research sessions and resume later
    - Share research notes with team members
    - Link research findings directly to matters

    **Statute Lookup:**
    - Search Nigerian laws by title, section number, or keyword
    - Browse by category: Criminal, Civil, Commercial, Property, Constitutional
    - See amendment history and current status
    - AI-assisted interpretation: "What does Section 47 mean for tenancy agreements?"

---

## APRIL 2026

### Entry 10
- **Version:** v1.8.5
- **Date:** 2026-04-25
- **Products:** atrium
- **Category:** feature
- **Title:** Maintenance Ticket System & Vendor Management
- **Summary:** Residents can now log maintenance tickets with photos. Property managers can assign vendors and track resolution.
- **Details:** |
    **Maintenance Tickets:**
    - Residents log issues via portal: plumbing, electrical, structural, HVAC, etc.
    - Attach photos and videos (up to 5 per ticket)
    - Priority levels: Low, Medium, High, Emergency
    - Auto-assign to property manager or specific staff member
    - Status tracking: Open → In Progress → Awaiting Parts → Resolved → Closed

    **Vendor Management:**
    - Create vendor profiles (plumber, electrician, etc.)
    - Assign vendors to tickets and track response times
    - Log vendor costs per ticket for expense tracking
    - Vendor rating system: rate completed jobs 1–5 stars
    - Preferred vendor list per property

---

### Entry 11
- **Version:** v1.8.0
- **Date:** 2026-04-12
- **Products:** vega, atrium
- **Category:** security
- **Title:** 2FA, Recovery Codes & Security Center
- **Summary:** Optional two-factor authentication now available for all accounts. Founder App gets a new Security Center with live session monitoring.
- **Details:** |
    **Two-Factor Authentication:**
    - Enable 2FA in account settings
    - TOTP-based (Google Authenticator, Authy, Microsoft Authenticator)
    - Generate 10 recovery codes for account recovery
    - Enforce 2FA for all team members (admin setting)
    - 2FA required for sensitive actions: password change, bank detail updates, data export

    **Security Center (Founder App):**
    - Live session feed: see all active logins across all firms
    - Security alerts: unusual login locations, multiple failed attempts, disposable email signups
    - Force logout: terminate any session remotely
    - Audit trail: all admin actions logged with timestamp and IP

---

## MARCH 2026

### Entry 12
- **Version:** v1.7.0
- **Date:** 2026-03-28
- **Products:** atrium
- **Category:** feature
- **Title:** Sentry Pass Visitor Management System
- **Summary:** Introducing Sentry Pass — a complete visitor management system for gated estates and residential properties.
- **Details:** |
    **Sentry Pass Features:**
    - Residents generate 6-digit visitor access codes from their portal
    - Each pass includes a scannable QR code
    - Set validity: single-use, 24 hours, or custom date range
    - Standardized pass message: host name, destination, validity period
    - Gatehouse terminal (/gatehouse?firmId=xxx) for security verification
    - Full audit trail: check-in/check-out timestamps, code used, gatekeeper ID

    **Billing:**
    - 14-day free trial for all Atrium users
    - N15,000/month add-on after trial
    - Code generation blocked if trial expired or subscription inactive

    **Management-Only Properties:**
    - Sentry Pass still works for "Management Only" properties
    - Residents without lease agreements can still generate codes

---

### Entry 13
- **Version:** v1.6.0
- **Date:** 2026-03-15
- **Products:** vega
- **Category:** feature
- **Title:** Client Portal & KYC Document Collection
- **Summary:** New self-service client portal where clients can view case milestones, upload KYC documents, and communicate securely.
- **Details:** |
    **Client Portal:**
    - Branded login page with firm logo and colors
    - Dashboard: active matters, upcoming deadlines, recent documents
    - Milestone tracker: visual progress bar for each case stage
    - Document upload: drag-and-drop KYC, evidence, contracts
    - Secure messaging: threaded conversations with lawyers
    - Mobile-responsive: works on any phone browser

    **KYC Management:**
    - Define required KYC per matter type (ID, proof of address, corporate docs)
    - Auto-remind clients of missing documents
    - Verify document completeness before matter proceeds
    - Store KYC securely with access controls

---

## FEBRUARY 2026

### Entry 14
- **Version:** v1.5.0
- **Date:** 2026-02-20
- **Products:** atrium
- **Category:** feature
- **Title:** Resident Portal & Paystack Integration
- **Summary:** Residents get a self-service portal to pay rent, download receipts, and log issues. Paystack handles card, bank, and USSD payments.
- **Details:** |
    **Resident Portal:**
    - Hero header: resident name, unit identifier, full property address
    - Quick Services Grid: Pay Rent, Service Charge, Electricity, Internet, Waste, Maintenance, Messages, Receipts, Documents
    - Payment Pipeline: Paystack checkout + manual bank transfer with proof upload
    - Ledger: comprehensive financial history (rent, SC, electricity, etc.)
    - Documents: Billing (invoices/receipts), Legal (lease), User Uploads (proof of payment)
    - Contact Property Manager: mailto:, tel:, internal message thread
    - Help Section: accordion FAQ with 5 categories

    **Paystack Integration:**
    - Card payments (Visa, Mastercard, Verve)
    - Bank transfer (instant account number generation)
    - USSD (for non-smartphone users)
    - Dynamic bank details pulled from Founder Financial Hub
    - Auto-reconciliation: matches Paystack webhook to tenant ledger

---

### Entry 15
- **Version:** v1.4.0
- **Date:** 2026-02-08
- **Products:** vega
- **Category:** feature
- **Title:** DraftPro Editor & ALOA AI Copilot
- **Summary:** Introducing DraftPro — a rich-text legal document editor with A4 pagination, Nigerian fonts, and AI-powered drafting via ALOA.
- **Details:** |
    **DraftPro Editor:**
    - Rich-text editing with formatting toolbar
    - A4 pagination with page breaks
    - Nigerian legal fonts: Times New Roman, Bookman Old Style, Garamond
    - Placeholder guardrails: prevents saving documents with unfilled placeholders
    - Export to PDF, Word, or print-ready format
    - Version history: auto-save every 30 seconds

    **ALOA AI Copilot:**
    - 3 modes: Auto (quick suggestions), Flash (fast responses), Pro (detailed analysis)
    - Generate legal documents from templates
    - Summarize case files and evidence
    - Research opposing counsel and precedents
    - PII Shield: strips personal data before AI processing
    - Workspace isolation: RAG filtered by firmId

---

## JANUARY 2026

### Entry 16
- **Version:** v1.3.0
- **Date:** 2026-01-25
- **Products:** vega, atrium
- **Category:** feature
- **Title:** WhatsApp Notifications & Court Date Reminders
- **Summary:** Automated WhatsApp reminders for court dates (Vega) and rent collection (Atrium). Push notifications via Firebase.
- **Details:** |
    **Vega — Court Date Reminders:**
    - Automated WhatsApp reminders: 7 days, 3 days, 1 day before hearing
    - Available on Pro plan and above
    - Reminder includes: court name, case number, time, location
    - Client and lawyer both notified
    - Confirm attendance via reply to WhatsApp message

    **Atrium — Rent Reminders:**
    - Schedule rent reminders via WhatsApp before due date
    - Demand notices for overdue rent (formal legal language)
    - Service charge and utility bill reminders
    - Tiered volume: Starter 250/mo, Growth 500/mo, Pro 2000/mo, Enterprise unlimited

    **Push Notifications:**
    - Firebase Cloud Messaging via Capacitor
    - 3 channels: Messages (max priority), Tasks (high), General (default)
    - Real-time bell badge with unread count
    - Toast system: glassmorphic, max 3 visible, swipe-to-dismiss

---

### Entry 17
- **Version:** v1.2.0
- **Date:** 2026-01-12
- **Products:** atrium
- **Category:** feature
- **Title:** Revenue Monitor & Property Portfolio Management
- **Summary:** Atrium launches with property portfolio tracking, rent collection monitoring, and a real-time defaulter dashboard.
- **Details:** |
    **Property Portfolio:**
    - Add residential, commercial, and mixed-use properties
    - Track occupancy rate, photos, tenancy records
    - Unit-level management: rent amount, service charge, tenant details
    - Lease management: expiry alerts, renewal notices, calendar integration

    **Revenue Monitor:**
    - Real-time outstanding rent across all properties
    - Defaulter list: name, unit, days overdue, amount
    - Portfolio-level financial analytics
    - Export to PDF or Excel
    - Filter by property, date range, or defaulter status

    **Core Services Toggle:**
    - Enable/disable per property: Service Charge, Electricity, Internet, Waste Management
    - Management-Only mode: hides Pay Rent and suppresses Lease Agreement

---

### Entry 18
- **Version:** v1.1.0
- **Date:** 2026-01-05
- **Products:** vega
- **Category:** feature
- **Title:** Matter Management & Task Board
- **Summary:** Vega launches with matter organization, Kanban task management, and structured contact management.
- **Details:** |
    **Matter Management:**
    - Organize cases by court, jurisdiction, matter type
    - Link documents, parties, and deadlines
    - Court-specific matter types: Civil, Criminal, Commercial, Property, Constitutional
    - Deadline tracking with automated reminders
    - Matter status: Open, Active, Pending, Closed, Archived

    **Task Board:**
    - Kanban-style: To Do, In Progress, Review, Done
    - Assign tasks to team members
    - Due dates and priority levels (Low, Medium, High, Urgent)
    - Drag-and-drop reordering
    - Filter by assignee, matter, or due date

    **Contacts & Parties:**
    - Structured contact management
    - Party grouping: clients, witnesses, opposing counsel, judges
    - Counsel records and firm associations

---

## DECEMBER 2025

### Entry 19
- **Version:** v1.0.0
- **Date:** 2025-12-15
- **Products:** vega, atrium
- **Category:** feature
- **Title:** PracticePro Beta Launch
- **Summary:** PracticePro enters beta with Vega (legal practice management) and Atrium (property management). Built in Lagos for Nigerian professionals.
- **Details:** |
    **Vega Beta:**
    - Custom authentication (not Convex Auth)
    - Multi-tenant data isolation
    - Matter CRUD operations
    - Basic document vault
    - Team chat with real-time notifications

    **Atrium Beta:**
    - Property and unit CRUD
    - Tenant management with KYC
    - Basic rent tracking
    - Manual bank transfer recording

    **Platform:**
    - React 18 + TypeScript + Vite + Tailwind CSS
    - Convex serverless backend with real-time WebSocket
    - Paystack integration (test mode)
    - Brevo transactional emails
    - Vercel hosting

---

*What's New Content v1.0 — PracticePro*
*19 changelog entries covering Dec 2025 – Aug 2026*
*All entries tagged by product for proper filtering*
