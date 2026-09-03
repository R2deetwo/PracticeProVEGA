#!/usr/bin/env python3
"""
PracticePro Architecture & Context Document
Generates a comprehensive PDF for NotebookLM reference.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, Image
)
from reportlab.pdfgen import canvas
from reportlab.lib import colors

OUTPUT = "/home/z/my-project/download/PracticePro_Architecture_Context.pdf"

# Colors
PRIMARY = HexColor("#0ea5e9")
DARK = HexColor("#0f172a")
SLATE = HexColor("#475569")
LIGHT_BG = HexColor("#f8fafc")
EMERALD = HexColor("#10b981")
AMBER = HexColor("#f59e0b")
RED = HexColor("#ef4444")
BLUE = HexColor("#3b82f6")
VIOLET = HexColor("#8b5cf6")

# Styles
styles = getSampleStyleSheet()

cover_title = ParagraphStyle('CoverTitle', parent=styles['Title'],
    fontSize=32, textColor=DARK, spaceAfter=8, fontName='Helvetica-Bold',
    alignment=TA_CENTER, leading=38)

cover_sub = ParagraphStyle('CoverSub', parent=styles['Normal'],
    fontSize=14, textColor=SLATE, alignment=TA_CENTER, spaceAfter=4, fontName='Helvetica')

cover_tag = ParagraphStyle('CoverTag', parent=styles['Normal'],
    fontSize=10, textColor=PRIMARY, alignment=TA_CENTER, fontName='Helvetica-Bold',
    spaceAfter=2)

h1 = ParagraphStyle('H1', parent=styles['Heading1'],
    fontSize=18, textColor=DARK, spaceAfter=10, spaceBefore=16, fontName='Helvetica-Bold')

h2 = ParagraphStyle('H2', parent=styles['Heading2'],
    fontSize=13, textColor=PRIMARY, spaceAfter=6, spaceBefore=12, fontName='Helvetica-Bold')

body = ParagraphStyle('Body', parent=styles['Normal'],
    fontSize=10, textColor=SLATE, alignment=TA_JUSTIFY, spaceAfter=6, leading=15, fontName='Helvetica')

bullet = ParagraphStyle('Bullet', parent=body,
    leftIndent=18, bulletIndent=6, spaceAfter=3)

code_style = ParagraphStyle('Code', parent=styles['Code'],
    fontSize=8, textColor=DARK, backColor=LIGHT_BG, borderPadding=6,
    leftIndent=8, rightIndent=8, spaceAfter=8, spaceBefore=4, fontName='Courier')

label = ParagraphStyle('Label', parent=body,
    fontSize=9, textColor=SLATE, fontName='Helvetica-Bold', spaceAfter=2)

def cover_page(canvas_obj, doc):
    canvas_obj.saveState()
    # Background
    canvas_obj.setFillColor(HexColor("#f8fafc"))
    canvas_obj.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    # Top accent bar
    canvas_obj.setFillColor(PRIMARY)
    canvas_obj.rect(0, A4[1] - 8*mm, A4[0], 8*mm, fill=1, stroke=0)
    # Bottom accent
    canvas_obj.setFillColor(PRIMARY)
    canvas_obj.rect(0, 0, A4[0], 4*mm, fill=1, stroke=0)
    canvas_obj.restoreState()

def build():
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    doc = SimpleDocTemplate(OUTPUT, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
        title="PracticePro Architecture & Context",
        author="PracticePro Legal Technologies Ltd",
        subject="Platform architecture reference for design improvement")

    story = []

    # ── COVER ──
    story.append(Spacer(1, 80*mm))
    story.append(Paragraph("PracticePro", cover_title))
    story.append(Paragraph("Architecture & Context Reference", cover_sub))
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph("PLATFORM DESIGN DOCUMENT", cover_tag))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("For NotebookLM Design Reference", cover_sub))
    story.append(Spacer(1, 30*mm))
    story.append(Paragraph("PracticePro Legal Technologies Ltd | Lagos, Nigeria", cover_sub))
    story.append(Paragraph("NDPA 2023 Compliant | ISO 27001 Aligned | AES-256 Encrypted", cover_sub))
    story.append(PageBreak())

    # ── 1. PRODUCT OVERVIEW ──
    story.append(Paragraph("1. Product Overview & Architecture", h1))
    story.append(Paragraph(
        "PracticePro is a multi-product SaaS platform serving Nigerian legal and property management professionals. "
        "The platform operates as three distinct products under a unified codebase, each targeting a specific market segment "
        "while sharing common infrastructure, authentication, and data models.", body))

    story.append(Paragraph("Three Products", h2))
    products = [
        ["Product", "Market", "Description"],
        ["Vega", "Legal Practice", "Matter management, document drafting, time tracking, billing, client portal"],
        ["Atrium", "Property Management", "Property/unit management, rent collection, service charge tracking, resident portal, VMS"],
        ["Komplete", "Unified Practice", "Hybrid of Vega + Atrium for firms that serve both legal and property clients"],
    ]
    t = Table(products, colWidths=[35*mm, 40*mm, 95*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Technology Stack", h2))
    story.append(Paragraph("<b>Backend:</b> Convex (serverless, real-time, TypeScript). Schema-defined tables with indexes. "
        "Mutations, queries, actions, cron jobs, HTTP endpoints. Custom auth (email/password, PBKDF2-SHA512, 600k iterations).", body))
    story.append(Paragraph("<b>Frontend:</b> React 18 + TypeScript + Vite. Tailwind CSS 4. Convex React hooks (useQuery, useMutation). "
        "Lucide icons. Custom modal system with portal rendering.", body))
    story.append(Paragraph("<b>Mobile:</b> Capacitor (Android APK). Two separate APKs: consumer app + admin/founder app. "
        "GitHub Actions CI/CD for automated APK builds.", body))
    story.append(Paragraph("<b>Deployment:</b> Vercel (production, practice-pro-vega.vercel.app) with a Vercel preview-alias staging environment. "
        "Convex backend deployed via GitHub Actions (separate staging + production deployments).", body))
    story.append(Paragraph("<b>Integrations:</b> Brevo (transactional email), Chakra Chat API (WhatsApp), "
        "Paystack (payment gateway), Google Drive, Gemini AI (document drafting).", body))
    story.append(PageBreak())

    # ── 2. ADMIN APK ──
    story.append(Paragraph("2. Admin (Founder) APK Structure", h1))
    story.append(Paragraph(
        "The founder app is a separate Capacitor APK with its own Vite build config, entry point (admin.html), "
        "and bottom navigation. It provides platform-level oversight across all firms, with privacy controls "
        "that prevent the founder from seeing individual portal user (resident/client) PII.", body))

    story.append(Paragraph("Views & Navigation", h2))
    admin_views = [
        ["View", "Purpose"],
        ["Dashboard", "KPIs (MRR, total users, firms, active trials), action items, trial funnel"],
        ["Alerts", "Unified notifications center: signups, security events, subscriptions, churn, milestones. Filter tabs, mark-as-read, auto-refresh 60s"],
        ["Organizations", "Firm management table with presence glow (emerald for online firms), master-detail drawer, plan editing, trial badges"],
        ["Feedback", "User feedback submissions inbox"],
        ["Security", "Live session feed (who's online), active firms with emerald tint, security alerts panel (disposable emails, unauthorized access, rate limits)"],
        ["Subscriptions", "Plan upgrade request approval queue with discount slider"],
        ["Broadcast", "Push notification/broadcast console to firms"],
        ["Audit", "Generic audit trail (signups, plan changes, role changes)"],
        ["Settings", "Account, appearance, security toggles, notifications, system, about"],
        ["System", "Runtime error feed (Gemini failures, PDF errors)"],
        ["Export", "CSV data export tools"],
        ["Analytics", "Growth chart, active users, MRR breakdown"],
    ]
    t = Table(admin_views, colWidths=[35*mm, 135*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Badge System", h2))
    story.append(Paragraph("The Alerts nav item shows two badges: <b>red</b> for pending subscription requests, "
        "<b>emerald</b> for new firm team signups (Admin/Lawyer/Paralegal only, not portal users). "
        "Both use formatBadgeCount() which caps at '9+'. The More button shows a red dot when pending requests exist.", body))

    story.append(Paragraph("Presence Engine", h2))
    story.append(Paragraph("The Organizations table polls getAllPresenceForAdmin every 30s. Firms with at least one "
        "online user get: emerald background tint (rgba(16,185,129,0.08)), 4px left border (#10b981), "
        "pulsing emerald dot (animate-pulse). The Security Center shows a live session feed with all online users.", body))
    story.append(PageBreak())

    # ── 3. USER APK ──
    story.append(Paragraph("3. User APK Structure", h1))
    story.append(Paragraph(
        "The consumer app serves firm users (Admin, Lawyer, Paralegal) with role-based feature access. "
        "The app adapts its terminology, navigation, and feature set based on the firm's product (Vega/Atrium/Komplete).", body))

    story.append(Paragraph("Core Views", h2))
    story.append(Paragraph("<b>Properties (Atrium/Komplete):</b> Property list, property detail with 5 tabs "
        "(Summary, Units, Notices, Financials, Activity & Tracking). Unit cards with service charge/minimum vend "
        "progress bars, Quick Payment Drawer, receipt pipeline, resident contact auto-sync.", body))
    story.append(Paragraph("<b>Matters (Vega/Komplete):</b> Matter list/board, matter detail with accordion "
        "(Practice Area, Matter Title, Client, Assigned Team, Billing, Case Details), AI-assisted document drafting (ALOA).", body))
    story.append(Paragraph("<b>Other views:</b> Contacts, Documents, Tasks (with Priority/Status inline dropdowns), "
        "Calendar, Billing (invoices, time entries, expenses, retainer), Messages (team chat + portal conversations + "
        "inbound WhatsApp/Email), Reports, Settings.", body))

    story.append(Paragraph("Property Unit Cards", h2))
    story.append(Paragraph("Each unit card shows: status border, resident name, lease end, service charge status pills "
        "(green=paid on time, orange=paid late, red=outstanding, blue=advance paid). Buttons: Message, Edit, More. "
        "Expanded view shows: SC/MV progress bars with per-period pills, payment history, maintenance tickets, "
        "eviction tracker, statutory timeline milestone.", body))

    story.append(Paragraph("Service Charge Progress System", h2))
    story.append(Paragraph("The ServiceChargeBars component renders per-period status pills computed from "
        "leaseStart + billing frequency. Calendar-month arithmetic (not fixed 30.44 days). SC uses its own "
        "serviceChargeFrequency (defaults to rentFrequency). OnboardUnitLedgerModal provides bulk-settle controls "
        "(Mark All Paid On Time / Paid Late / Reset All). Quick Payment Drawer allows per-period status toggling "
        "with auto-receipt generation (zero-touch: marks paid, creates receipt, publishes to resident portal, "
        "writes activity log, updates ledger — all in one click).", body))
    story.append(PageBreak())

    # ── 4. RESIDENT PORTAL ──
    story.append(Paragraph("4. Resident Portal Experience", h1))
    story.append(Paragraph(
        "The Resident Portal is a separate web experience (not the APK) accessed via browser at "
        "/portal/tenant/. Residents log in with their email + password (set up via the invite flow). "
        "The portal is branded as 'Atrium' for property residents and 'Vega' for legal clients, "
        "regardless of the firm's Komplete status.", body))

    story.append(Paragraph("Portal Invite Flow", h2))
    story.append(Paragraph("1. Admin clicks [Send Portal Invite] on a unit card or in ComposeMessageModal.", body))
    story.append(Paragraph("2. Backend (createPortalInvite action) generates a secure token (7-day expiry), "
        "creates a portal_invites record, and sends a clean invite email via Brevo.", body))
    story.append(Paragraph("3. Email contains ONLY: greeting, portal description, 'Set Up My Password' button, "
        "fallback link, 7-day expiry notice. No admin message in the email.", body))
    story.append(Paragraph("4. Resident clicks button, lands on /setup-password?token=xxx, sees locked email field, "
        "creates password, accepts terms, activates account.", body))
    story.append(Paragraph("5. Admin's message (if any) appears as an in-app portal message AFTER login, not in the email.", body))

    story.append(Paragraph("Portal Tabs", h2))
    portal_tabs = [
        ["Tab", "Features"],
        ["Dashboard", "Overview cards, quick stats, recent activity"],
        ["Notices", "Broadcast notices from property management"],
        ["Ledger", "Payment history, outstanding balances, service charge status"],
        ["Receipts", "Auto-generated PDF receipts for SC/MV payments"],
        ["Documents", "Shared documents (lease agreements, terms, consent records)"],
        ["Messages", "Two-way messaging with property manager (same conversation thread)"],
        ["Maintenance", "Submit maintenance requests with priority levels"],
        ["Visitors", "VMS — generate visitor access codes (if enabled)"],
    ]
    t = Table(portal_tabs, colWidths=[35*mm, 135*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Portal Messaging", h2))
    story.append(Paragraph("PM to resident messages use sendPortalMessage with admin→resident participantId resolution. "
        "The backend resolves the resident's userId from the unitId (property → rentalDetails.tenantEmail → users table). "
        "Sets unreadByParticipant (not unreadByAdmin) so the resident sees a badge. Resident replies use the same "
        "conversationId — no separate threads. Notification badges show on the Messages tab.", body))
    story.append(PageBreak())

    # ── 5. DESIGN SYSTEM ──
    story.append(Paragraph("5. Design System & Patterns", h1))

    story.append(Paragraph("Color Palette", h2))
    colors_table = [
        ["Token", "Hex", "Usage"],
        ["Primary-600", "#0ea5e9", "Primary actions, links, active states, brand accent"],
        ["Emerald-500", "#10b981", "Success, paid on time, online presence, portal active"],
        ["Amber-500", "#f59e0b", "Warnings, paid late, churn risk, pending requests"],
        ["Red-500", "#ef4444", "Errors, outstanding/overdue, security alerts"],
        ["Blue-500", "#3b82f6", "Advance paid, rent collection, information"],
        ["Violet-500", "#8b5cf6", "Assigned team, portal invite, subscriptions"],
        ["Slate-900", "#0f172a", "Dark backgrounds, headings, portal dark theme"],
        ["Slate-50", "#f8fafc", "Light backgrounds, card surfaces"],
    ]
    t = Table(colors_table, colWidths=[35*mm, 30*mm, 105*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Typography", h2))
    story.append(Paragraph("Inter (sans-serif) for all UI text. Font sizes: text-2xs (10px), text-3xs (9px) for labels/badges, "
        "text-xs (12px) for body, text-sm (14px) for emphasized content, text-lg/xl for headings. "
        "Font weights: font-bold (700) for labels, font-black (900) for section headings. "
        "Uppercase tracking-widest for category labels.", body))

    story.append(Paragraph("Component Patterns", h2))
    story.append(Paragraph("<b>AccordionSection:</b> Module-level React.memo component with colored icon badge, "
        "expand/collapse animation, scrollIntoView on expand. Used in PropertyForm (6 sections) and MatterForm (6 sections).", body))
    story.append(Paragraph("<b>StatCard:</b> Uniform height (h-28), watermark icon top-right, marquee text for overflow, "
        "tooltip for full values. Used in PropertyDetailView Financials tab.", body))
    story.append(Paragraph("<b>Modals:</b> Portal-rendered (createPortal to document.body) with bg-black/60 backdrop, "
        "z-[9990]+. Includes: ComposeMessageModal, ReceiptModal, OnboardUnitLedgerModal, QuickPaymentDrawer, "
        "CriticalLeaseBanner, TaskDetailModal, ComposeEmailModal.", body))
    story.append(Paragraph("<b>Progress Pills:</b> Slim h-2 w-7 rounded-full color-only bars (no text). "
        "Portal-rendered tooltips with month/year, amount, status, settled date. Click opens Quick Payment Drawer.", body))
    story.append(Paragraph("<b>Toasts:</b> Max 3 visible, 4s auto-dismiss, positioned bottom-center. "
        "Types: success (emerald), error (red), info (blue).", body))
    story.append(PageBreak())

    # ── 6. SECURITY ──
    story.append(Paragraph("6. Security Infrastructure", h1))

    story.append(Paragraph("Implemented Security Measures", h2))
    security = [
        ["Measure", "Status", "Details"],
        ["Rate Limiting", "Active", "5 signups/email/minute via rateLimits table. Violations logged to securityEvents."],
        ["Disposable Email Blocking", "Active", "32 known disposable domains blocked on signup. Logged as security events."],
        ["RLS Audit Logging", "Active", "requireFirmUser logs unauthorized_access events. Suspended users checked."],
        ["Password Hashing", "Active", "PBKDF2-SHA512, 600k iterations, 16-byte salt. Legacy SHA-256 auto-migration."],
        ["Portal Invite Security", "Active", "7-day token expiry, participantId tied to email, revoke/suspend/delete paths."],
        ["Presence Engine", "Active", "20s heartbeat, 90s online threshold. Presence privacy flag for portal users."],
        ["Admin Actions", "Active", "blockIp, unblockIp, suspendUser, unsuspendUser mutations (founder-gated)."],
        ["Bot Detection", "Planned", "HTTP middleware inspecting user-agent strings"],
        ["Impossible Travel", "Planned", "IP geolocation logging on login"],
        ["FCM/APNs Push", "Planned", "Native push notification engine for mobile"],
    ]
    t = Table(security, colWidths=[40*mm, 25*mm, 105*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Privacy Controls", h2))
    story.append(Paragraph("The founder app filters portal users (Tenant, Client, Resident) from all alerts, badges, "
        "and signup counts. Only firm team members (Admin, Lawyer, Paralegal) appear in founder-facing data. "
        "Portal user activity is tracked at the org/firm level via presence and engagement metrics, but individual "
        "portal user PII (names, emails) is never exposed to the founder.", body))
    story.append(PageBreak())

    # ── 7. GAPS & OPPORTUNITIES ──
    story.append(Paragraph("7. Known Gaps & Improvement Opportunities", h1))

    story.append(Paragraph("High Priority", h2))
    story.append(Paragraph("1. <b>Uniform conversation styling:</b> MessagesView has 5 different card layouts (System Inbox, "
        "Inbound WA/Email, Team DM, Portal, Legacy Client). Need unified structure: avatar + name + type badge + preview.", body))
    story.append(Paragraph("2. <b>FCM/APNs push notifications:</b> No native push engine. Residents don't get push "
        "notifications for new portal messages, receipts, or notices. Requires Firebase Cloud Messaging integration.", body))
    story.append(Paragraph("3. <b>Custom estate fees + itemized receipts:</b> Revenue Breakdown table only supports "
        "Rent, SC, and MV. Need dynamic custom fee categories with per-period tracking and itemized PDF receipts.", body))

    story.append(Paragraph("Medium Priority", h2))
    story.append(Paragraph("4. <b>Headless bot detection:</b> HTTP middleware inspecting user-agent strings for "
        "Puppeteer/Playwright/Selenium/cURL signatures.", body))
    story.append(Paragraph("5. <b>Impossible travel detection:</b> Log IP + geo on login, flag accounts that log in "
        "from vastly different locations within short intervals.", body))
    story.append(Paragraph("6. <b>26 orphaned dead code files:</b> Legacy components that are imported but unused. "
        "Should be cleaned up to reduce bundle size and maintenance burden.", body))
    story.append(Paragraph("7. <b>Founder notifications center improvements:</b> Add broadcast delivery reports, "
        "one-click security actions (Suspend/Block IP buttons), notification preferences.", body))

    story.append(Paragraph("Design Polish", h2))
    story.append(Paragraph("8. <b>Mobile layout optimization:</b> Several views still require scrolling on mobile "
        "(setup-password page fixed, but others may need condensing).", body))
    story.append(Paragraph("9. <b>Onboarding wizard:</b> New firm onboarding could be more guided with progress "
        "indicators and contextual help.", body))
    story.append(Paragraph("10. <b>Dark mode consistency:</b> Some components have incomplete dark mode variants "
        "(zinc-800/zinc-900 classes missing in places).", body))
    story.append(PageBreak())

    # ── 8. RECENT WORK ──
    story.append(Paragraph("8. Recent Work Summary (This Session)", h1))
    story.append(Paragraph(
        "This document was generated after an extensive development session covering UI refactors, "
        "security infrastructure, portal messaging fixes, and admin app enhancements. "
        "Below is a summary of what was built and fixed.", body))

    work_items = [
        ["Area", "What Was Done"],
        ["MatterForm", "Accordion layout (6 sections), pinned footer, keyboard focus auto-expand, assigned team section"],
        ["PropertyForm", "Accordion layout, auto-scroll to rental section, resident email field, save-to-contacts checkbox, decoupled property/unit description"],
        ["Service Charge Bars", "Per-period colored pills (green/orange/red/blue), calendar-month stepping, SC frequency independent from rent, bulk settle, advance pre-paid periods"],
        ["Receipt Pipeline", "Zero-touch auto-receipt on payment: generates receipt, publishes to resident portal, writes activity log, updates ledger"],
        ["Quick Payment Drawer", "Portal-rendered, historical pill strip, 4-state toggle (Paid On Time / Paid Late / Outstanding / Advance Paid), pointer event isolation"],
        ["Portal Invite", "Fixed: now calls createPortalInvite (sends real email via Brevo) instead of sendPortalMessage (just DB row). Clean email template, 7-day expiry, no admin message in email"],
        ["Portal Messaging", "Fixed: admin messages now reach residents (participantId resolved from unitId→tenantEmail→userId). Correct unread counters (unreadByParticipant for admin messages)"],
        ["Resident Portal", "Setup-password page condensed to fit one screen, correct tab title ('Atrium — Residents' Portal')"],
        ["Banner System", "Swipe carousel (touch handlers), per-notification dismissal (notifId-keyed, not broadcastId-keyed)"],
        ["Admin App", "SecurityCenter view, FounderNotificationsCenter, presence glow in OrganizationsHub, signup badge (9+ cap), OrgHub crash fix"],
        ["Security", "Rate limiting (rateLimits table), disposable email blocking (32 domains), RLS audit logging, blockIp/suspendUser mutations, getAllPresenceForAdmin query"],
        ["Terminology", "Tenant → Resident across all UI labels (field names unchanged for data compatibility)"],
        ["Mobile", "Touch handlers (onTouchEnd) on all unit card buttons, safe-area padding on property overview"],
    ]
    t = Table(work_items, colWidths=[35*mm, 135*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t)

    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "This document is intended as a reference source for NotebookLM. When combined with a UI design video, "
        "it should enable the generation of targeted improvement prompts for both the admin and user APKs. "
        "The document covers the current state of the platform, known gaps, and the design system conventions "
        "that should be followed in any future UI work.", body))

    doc.build(story, onFirstPage=cover_page, onLaterPages=cover_page)
    print(f"PDF generated: {OUTPUT}")

if __name__ == '__main__':
    build()
