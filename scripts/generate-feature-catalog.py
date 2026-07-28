#!/usr/bin/env python3
"""
Generate a comprehensive feature catalog PDF for PracticePro.
Lists every workflow and feature, categorized by module.
"""
import os
import sys

# Try to use reportlab
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm, cm
    from reportlab.lib.colors import HexColor, white, black
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    # Register fonts
    try:
        pdfmetrics.registerFont(TTFont('Inter', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('Inter-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
        FONT = 'Inter'
        FONT_BOLD = 'Inter-Bold'
    except:
        FONT = 'Helvetica'
        FONT_BOLD = 'Helvetica-Bold'

except ImportError:
    print("reportlab not available, using fpdf2")
    from fpdf import FPDF

# Colors
PRIMARY = HexColor('#16A34A')
DARK = HexColor('#0F172A')
SLATE = HexColor('#475569')
LIGHT_BG = HexColor('#F8FAFC')
BORDER = HexColor('#E2E8F0')

OUTPUT = '/home/z/my-project/download/PracticePro_Feature_Catalog.pdf'

# Feature data
MODULES = [
    {
        'name': 'Legal Practice Management (Vega)',
        'color': '#16A34A',
        'features': [
            ('Matter Management', 'Create, track, and close legal matters with customizable workflow stages. Each matter type has its own stage pipeline (e.g., Intake → Drafting → Review → Execution → Closed). Matters can be linked to clients, courts, and documents.'),
            ('Matter Stage Tracking', 'Visual stage tracker on the matter detail page shows progress through workflow stages. Click any stage to advance. Stage changes are timestamped and logged.'),
            ('ALOA AI Assistant', 'AI-powered legal assistant that can draft documents, create workflows, analyze documents, research case law, and navigate the app. Supports file uploads and live web querying.'),
            ('DraftPro Editor', 'Full-featured document editor with AI drafting, watermarks (DRAFT, CONFIDENTIAL), page numbering, focus mode, DOCX export, and print preview. Opens in dedicated tabs on desktop.'),
            ('Court Date Reminders (Pro)', 'Automatic WhatsApp reminders 7, 3, and 1 days before court dates for Vega Pro firms. Duplicate-prevention guard prevents spam on rescheduled matters.'),
            ('Retainer Auto-Billing', 'Automated retainer billing with configurable frequency (Weekly, Monthly, Quarterly, Bi-Annually, Annually). Draft invoices auto-stage in the Billing Monitor for review.'),
            ('Billing Monitor', 'Dashboard for reviewing staged retainer invoices. Approve & Send, Pause to Edit, Skip Cycle, or Retry Failed sends. Premium-gated (Vega Growth+).'),
            ('Time & Expense Tracking', 'Log billable hours and expenses against matters. Items appear in invoice generation when unbilled. Supports hourly, fixed-fee, and retainer billing models.'),
            ('Invoice Generation', 'Create invoices from unbilled time entries and expenses. PDF generation with firm letterhead. Payment tracking with Paystack-ready integration.'),
            ('Compliance (Coming to Settings)', 'NDPA 2023 compliance tracking, PIA assessments, and data protection workflow. Being moved from standalone page to Settings.'),
        ]
    },
    {
        'name': 'Property Management (Atrium)',
        'color': '#059669',
        'features': [
            ('Property & Unit Management', 'Create properties with embedded units. Track occupancy status, rent amounts, service charges, and tenant information. Multi-unit buildings supported via embedded units array.'),
            ('Rent Collection', 'Collect rent with automated receipt generation. Track payment status (Paid, Pending, Overdue). Ledger entries automatically created for each transaction.'),
            ('Service Charge Tracking', 'Track service charges per property/unit. Generate service charge invoices. Monitor outstanding balances.'),
            ('Eviction Workflow', 'Statutory eviction tracking: Quit Notice → 7-Day Notice of Owner\'s Intention to Recover Premises. Auto-calculated notice periods based on tenancy frequency. DraftPro integration for generating legal documents.'),
            ('Visitor Management', 'Gated estate residents generate 6-digit visitor access codes. Gatekeepers verify at the gate. Dual WhatsApp delivery, offline fallback, grace periods.'),
            ('Defaulter Dashboard', 'Live dashboard showing tenants with outstanding rent. Automated WhatsApp demand notices. Late fee calculation.'),
            ('SCE Calculator', 'Service Charge Equivalent calculator on the landing page. Models portfolio economics to show if Atrium makes financial sense for a given property portfolio.'),
        ]
    },
    {
        'name': 'Unified Messaging Hub',
        'color': '#7C3AED',
        'features': [
            ('Unified Conversations Inbox', 'All conversation types in one list: Team chat, Portal messages, Maintenance tickets, Service requests, Inbound WhatsApp/Email. Color-coded badges (Team=indigo, Portal=emerald, Ticket=amber, Request=rose).'),
            ('Team Chat', 'Direct messages between team members with server-side atomic notification dispatch. Message context menu (Copy, Edit, Delete on own messages). File attachments via Convex storage.'),
            ('Portal Conversations', 'Two-way chat with clients and residents via their portal. Inline ticket controls (status pills, assign-to-team-member). Sub-threading per ticket.'),
            ('Notice Board', 'Post notices visible to residents/clients on their portal. Property-scoped or global. Email notifications dispatched server-side. Archive/restore workflow.'),
            ('Scheduled Messages', 'Schedule WhatsApp/Email messages for future delivery. View pending and sent scheduled messages in the Scheduled tab.'),
            ('Smart Presence', 'Team member avatars show 3 states: Active (green), Inactive (amber), Offline (grey). 10-second grace period before offline avatars fade out. "Last seen Xm ago" on hover.'),
        ]
    },
    {
        'name': 'Task Intelligence',
        'color': '#DC2626',
        'features': [
            ('Task Segmentation', 'Tasks are segmented: Internal Team, Client, or Resident. Color-coded badges on Kanban cards (indigo=team, violet=client, amber=resident). Mandatory assignee — cannot create a task without at least one.'),
            ('Kanban Board', 'Drag-and-drop task board with 4 columns: To Do, In Progress, Pending Review, Done. Overdue tasks highlighted in red. Priority indicators, checklist progress, assignee avatars.'),
            ('Multi-Channel Notifications', 'Internal team: in-app notification only. External (client/resident): in-app + Email (default) + WhatsApp (if opted in). WhatsApp failure falls back to Email.'),
            ('Task Verification Workflow', 'External stakeholders mark tasks as "Done" → routes to "Pending Verification" → team member reviews → moves to "Done". Prevents premature closure.'),
            ('Halfway Reminders', 'Automated reminder at the midpoint between task creation and due date. Guardrail: if <2h total duration, schedules 30-min final reminder instead. Snooze/acknowledge support.'),
            ('Overdue Automation', 'Tasks past their due date get red highlight on cards. Creator receives "Task Overdue" notification automatically.'),
        ]
    },
    {
        'name': 'Portal & External Access',
        'color': '#0891B2',
        'features': [
            ('Client Portal (Vega)', 'Clients log in to view their matters, documents, messages, service requests, and financials. Can submit service requests with file attachments. Card-based dashboard.'),
            ('Residents\' Portal (Atrium)', 'Residents log in to view notices, visitors, ledger, receipts, maintenance tickets, messages, payments, and documents. Can submit maintenance tickets with photos/videos.'),
            ('Portal Invite System', 'Admins generate portal invites for clients/residents. Unique access tokens. Pending invites tracked. Invite acceptance flow with password setup.'),
            ('Multi-Tenant Onboarding', 'Firms invite team members with role-based access (Admin, Lawyer, Paralegal, Manager). Pending users show in a dedicated queue until an admin grants access.'),
        ]
    },
    {
        'name': 'AI & Research',
        'color': '#9333EA',
        'features': [
            ('ALOA/ARIA Chat', 'AI assistant with 4 modes: Auto, Flash, Pro, Research. Supports file uploads (PDF, DOCX, images), live web querying, and document analysis. PII shield with visible badge.'),
            ('Research Studio', 'Dedicated research environment with notebooks, sources, and AI-powered analysis. Push web results from ALOA to Research Studio. Strategy studio for case strategy development.'),
            ('ALDIA Document Analysis', 'Deep semantic document analysis with risk scoring, metadata extraction, and PII detection. Integrated with ALOA for context-aware analysis.'),
            ('Legal Intelligence Modules', 'Lagos HC Rules, FHC Rules, NWLR. Hosted natively in Convex for fast, bandwidth-efficient research. Procedural awareness for Nigerian court rules.'),
        ]
    },
    {
        'name': 'Billing & Subscription',
        'color': '#CA8A04',
        'features': [
            ('3-Tier + Enterprise Pricing (Atrium)', 'Core: ₦490K/yr (10 units, ₦2,700/unit/mo overage). Growth: ₦965K/yr (25 units, ₦2,100/unit/mo). Pro: ₦2.1M/yr (100 units, ₦1,600/unit/mo). Enterprise: Custom (400+ units).'),
            ('Paystack-Ready Billing', 'Provider abstraction layer with manual provider (default) and Paystack provider (dormant, ready to activate). Webhook routing with idempotency keys.'),
            ('Invoice Management', 'Create, send, track invoices. PDF generation with letterhead. Payment status tracking. Paystack payment integration (one-shot invoice payment).'),
            ('Subscription Management', 'Tier-based feature gating. WhatsApp quota enforcement. Plan upgrades with capacity re-sync.'),
        ]
    },
    {
        'name': 'System & Platform',
        'color': '#64748B',
        'features': [
            ('Dark Mode (Complete)', 'Every modal (36 files), every page, every component has proper dark mode variants. Shared Modal primitive is dark-mode aware.'),
            ('Auto-Expanding Chat Input', 'Gemini Mobile-style input that expands line-by-line up to 3 lines, then scrolls. Consistent across team chat, ALOA, research, and portal replies.'),
            ('Version Check & Auto-Refresh', 'Detects new deploys via version.json polling (every 60s). Prompts user to refresh. 3-layer protection: manifest status + CI smoke test + client gate. Never prompts to refresh into a broken build.'),
            ('APK Update Notifications', 'Android users see a banner when a new APK is available. Version manifest exposes build SHA and health status.'),
            ('Dynamic Policy Versioning', 'Terms acceptance banner only shows when legal docs version changes. Semantic versioning (LEGAL_DOCS_VERSION). Standard reloads don\'t trigger the banner.'),
            ('Layout-Aware Onboarding Tour', 'Mobile: bottom-sheet anchored above nav bar. Desktop: side-anchored tooltip with arrow. Viewport changes mid-tour handled gracefully.'),
            ('Comprehensive Usage Policy', '15-section policy covering acceptable use, account security, AI features, portal access, communication, payments, IP, compliance (NDPA 2023), and Nigerian governing law.'),
        ]
    },
]

# Build PDF
styles = getSampleStyleSheet()

title_style = ParagraphStyle('CustomTitle', parent=styles['Title'],
    fontName=FONT_BOLD, fontSize=28, textColor=PRIMARY, spaceAfter=6, alignment=TA_LEFT)
subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'],
    fontName=FONT, fontSize=12, textColor=SLATE, spaceAfter=20, alignment=TA_LEFT)
module_header_style = ParagraphStyle('ModuleHeader', parent=styles['Heading1'],
    fontName=FONT_BOLD, fontSize=16, textColor=DARK, spaceBefore=20, spaceAfter=10)
feature_title_style = ParagraphStyle('FeatureTitle', parent=styles['Heading2'],
    fontName=FONT_BOLD, fontSize=11, textColor=PRIMARY, spaceBefore=12, spaceAfter=4)
feature_desc_style = ParagraphStyle('FeatureDesc', parent=styles['Normal'],
    fontName=FONT, fontSize=9.5, textColor=SLATE, spaceAfter=8, alignment=TA_JUSTIFY, leading=14)
footer_style = ParagraphStyle('Footer', parent=styles['Normal'],
    fontName=FONT, fontSize=8, textColor=SLATE, alignment=TA_CENTER)

doc = SimpleDocTemplate(OUTPUT, pagesize=A4,
    leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm,
    title='PracticePro — Feature Catalog',
    author='PracticePro Systems Limited',
    subject='Complete list of features and workflows')

story = []

# Title page
story.append(Spacer(1, 60*mm))
story.append(Paragraph('PracticePro', title_style))
story.append(Paragraph('Complete Feature &amp; Workflow Catalog', subtitle_style))
story.append(Spacer(1, 10*mm))
story.append(Paragraph('A comprehensive reference of every feature, workflow, and capability across the PracticePro platform — Vega (Legal), Atrium (Property), and Komplete (Unified).', ParagraphStyle('Intro', parent=styles['Normal'], fontName=FONT, fontSize=10, textColor=SLATE, alignment=TA_JUSTIFY, leading=16)))
story.append(Spacer(1, 20*mm))
story.append(Paragraph(f'Version 1.19.0 &nbsp;|&nbsp; July 2026 &nbsp;|&nbsp; PracticePro Systems Limited', ParagraphStyle('Version', parent=styles['Normal'], fontName=FONT, fontSize=9, textColor=SLATE, alignment=TA_CENTER)))
story.append(PageBreak())

# Table of contents
story.append(Paragraph('Table of Contents', module_header_style))
story.append(Spacer(1, 10))
toc_data = []
for i, module in enumerate(MODULES):
    toc_data.append([
        Paragraph(f'<b>{i+1}. {module["name"]}</b>', ParagraphStyle('TOC', parent=styles['Normal'], fontName=FONT_BOLD, fontSize=10, textColor=DARK)),
        Paragraph(f'{len(module["features"])} features', ParagraphStyle('TOCCount', parent=styles['Normal'], fontName=FONT, fontSize=9, textColor=SLATE, alignment=TA_LEFT))
    ])
toc_table = Table(toc_data, colWidths=[140*mm, 30*mm])
toc_table.setStyle(TableStyle([
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('LINEBELOW', (0, 0), (-1, -2), 0.5, BORDER),
]))
story.append(toc_table)
story.append(PageBreak())

# Feature sections
total_features = 0
for i, module in enumerate(MODULES):
    story.append(Paragraph(f'{i+1}. {module["name"]}', module_header_style))
    # Color bar
    bar = Table([['']], colWidths=[170*mm], rowHeights=[3])
    bar.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), HexColor(module['color']))]))
    story.append(bar)
    story.append(Spacer(1, 8))

    for feature_name, feature_desc in module['features']:
        story.append(Paragraph(feature_name, feature_title_style))
        story.append(Paragraph(feature_desc, feature_desc_style))
        total_features += 1

    if i < len(MODULES) - 1:
        story.append(Spacer(1, 10))

# Summary
story.append(PageBreak())
story.append(Paragraph('Summary', module_header_style))
story.append(Spacer(1, 10))
story.append(Paragraph(f'Total modules: <b>{len(MODULES)}</b><br/>Total features: <b>{total_features}</b>', ParagraphStyle('Summary', parent=styles['Normal'], fontName=FONT, fontSize=11, textColor=DARK, leading=20)))
story.append(Spacer(1, 20))
story.append(Paragraph('PracticePro is a comprehensive practice management platform for Nigerian law firms and property managers. It combines legal practice management (Vega), property management (Atrium), and a unified product (Komplete) that includes both.', ParagraphStyle('SummaryText', parent=styles['Normal'], fontName=FONT, fontSize=10, textColor=SLATE, alignment=TA_JUSTIFY, leading=16)))
story.append(Spacer(1, 20))
story.append(Paragraph('For questions or feature requests, contact support@practicepro.ng', footer_style))

doc.build(story)
print(f"PDF generated: {OUTPUT}")
print(f"Modules: {len(MODULES)}, Features: {total_features}")
