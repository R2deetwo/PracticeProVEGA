#!/usr/bin/env python3
"""
PracticePro (VEGA + Atrium) — Zero-Failure Launch Audit Report
Generates a professional PDF with all audit findings.
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, CondPageBreak, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ━━ Color Palette ━━
ACCENT       = HexColor('#db2d4a')
TEXT_PRIMARY  = HexColor('#262523')
TEXT_MUTED    = HexColor('#8b867f')
BG_SURFACE   = HexColor('#dfdbd3')
BG_PAGE      = HexColor('#f2f1ef')

TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = BG_SURFACE

# Semantic colors for severity
SEV_CRITICAL = HexColor('#dc2626')
SEV_HIGH     = HexColor('#ea580c')
SEV_MEDIUM   = HexColor('#d97706')
SEV_LOW      = HexColor('#65a30d')

# ━━ Font Registration ━━
pdfmetrics.registerFont(TTFont('LiberationSerif', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif-Bold', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSans', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSans-Bold', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('LiberationSerif', normal='LiberationSerif', bold='LiberationSerif-Bold')
registerFontFamily('LiberationSans', normal='LiberationSans', bold='LiberationSans-Bold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ━━ Page dimensions ━━
PAGE_W, PAGE_H = A4
MARGIN = 0.85 * inch
CONTENT_W = PAGE_W - 2 * MARGIN

# ━━ Styles ━━
title_style = ParagraphStyle(
    'ReportTitle', fontName='LiberationSerif', fontSize=26, leading=32,
    textColor=ACCENT, spaceBefore=0, spaceAfter=6, alignment=TA_LEFT
)
subtitle_style = ParagraphStyle(
    'ReportSubtitle', fontName='LiberationSerif', fontSize=13, leading=18,
    textColor=TEXT_MUTED, spaceBefore=0, spaceAfter=18, alignment=TA_LEFT
)
h1_style = ParagraphStyle(
    'H1', fontName='LiberationSerif', fontSize=18, leading=24,
    textColor=ACCENT, spaceBefore=18, spaceAfter=8
)
h2_style = ParagraphStyle(
    'H2', fontName='LiberationSerif', fontSize=14, leading=20,
    textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=6
)
h3_style = ParagraphStyle(
    'H3', fontName='LiberationSerif', fontSize=12, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=4
)
body_style = ParagraphStyle(
    'Body', fontName='LiberationSerif', fontSize=10, leading=15,
    textColor=TEXT_PRIMARY, spaceBefore=2, spaceAfter=4, alignment=TA_JUSTIFY
)
body_left_style = ParagraphStyle(
    'BodyLeft', fontName='LiberationSerif', fontSize=10, leading=15,
    textColor=TEXT_PRIMARY, spaceBefore=2, spaceAfter=4, alignment=TA_LEFT
)
bullet_style = ParagraphStyle(
    'Bullet', fontName='LiberationSerif', fontSize=10, leading=15,
    textColor=TEXT_PRIMARY, spaceBefore=1, spaceAfter=2,
    leftIndent=18, bulletIndent=6, alignment=TA_LEFT
)
caption_style = ParagraphStyle(
    'Caption', fontName='LiberationSerif', fontSize=9, leading=12,
    textColor=TEXT_MUTED, spaceBefore=3, spaceAfter=6, alignment=TA_CENTER
)
th_style = ParagraphStyle(
    'TH', fontName='LiberationSerif', fontSize=9, leading=12,
    textColor=TABLE_HEADER_TEXT, alignment=TA_CENTER
)
td_style = ParagraphStyle(
    'TD', fontName='LiberationSerif', fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT
)
td_center = ParagraphStyle(
    'TDC', fontName='LiberationSerif', fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER
)
td_wrap = ParagraphStyle(
    'TDW', fontName='LiberationSerif', fontSize=8.5, leading=11,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT
)
callout_style = ParagraphStyle(
    'Callout', fontName='LiberationSerif', fontSize=10, leading=15,
    textColor=SEV_CRITICAL, spaceBefore=6, spaceAfter=6,
    leftIndent=12, borderPadding=6, alignment=TA_LEFT
)

# ━━ Helpers ━━
def P(text, style=body_style):
    return Paragraph(text, style)

def H1(text):
    return Paragraph(f'<b>{text}</b>', h1_style)

def H2(text):
    return Paragraph(f'<b>{text}</b>', h2_style)

def H3(text):
    return Paragraph(f'<b>{text}</b>', h3_style)

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet>{text}', bullet_style)

def severity_badge(sev):
    sev_map = {
        'CRITICAL': SEV_CRITICAL,
        'HIGH': SEV_HIGH,
        'MEDIUM': SEV_MEDIUM,
        'LOW': SEV_LOW,
    }
    c = sev_map.get(sev.upper(), TEXT_MUTED)
    return f'<font color="{c.hexval()}"><b>[{sev.upper()}]</b></font>'

def make_table(headers, rows, col_ratios=None):
    """Build a styled table with header + data rows."""
    n = len(headers)
    if col_ratios is None:
        col_ratios = [1.0 / n] * n
    col_widths = [r * CONTENT_W for r in col_ratios]

    data = [[Paragraph(f'<b>{h}</b>', th_style) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), td_wrap) if not isinstance(c, Paragraph) else c for c in row])

    tbl = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.4, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_ODD if i % 2 == 0 else TABLE_ROW_EVEN
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    tbl.setStyle(TableStyle(style_cmds))
    return tbl

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=TEXT_MUTED, spaceBefore=6, spaceAfter=6)

# ━━ Page numbering ━━
def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont('LiberationSerif', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 30,
                           f"PracticePro Zero-Failure Audit  |  Page {doc.page}")
    canvas.restoreState()

# ━━ Build Document ━━
OUTPUT = '/home/z/my-project/download/PracticePro_Launch_Readiness_Audit.pdf'

doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=MARGIN, bottomMargin=MARGIN
)

story = []

# ═══════════════════════════════════════════════════════════════
# COVER / TITLE PAGE
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 60))
story.append(HRFlowable(width="100%", thickness=3, color=ACCENT, spaceBefore=0, spaceAfter=12))
story.append(P('<b>PracticePro</b>', ParagraphStyle('Brand', fontName='LiberationSerif', fontSize=14, textColor=TEXT_MUTED)))
story.append(Spacer(1, 16))
story.append(P('<b>Zero-Failure Launch Audit</b>', title_style))
story.append(P('VEGA (Legal) + Atrium (Property)  |  Codebase vs. Marketing Claims Reconciliation', subtitle_style))
story.append(Spacer(1, 12))
story.append(HRFlowable(width="100%", thickness=1, color=BG_SURFACE, spaceBefore=0, spaceAfter=18))
story.append(P('<b>Date:</b> 14 May 2026', body_style))
story.append(P('<b>Scope:</b> Full codebase audit across 4 dimensions', body_style))
story.append(P('<b>Codebase:</b> React + Convex full-stack application', body_style))
story.append(Spacer(1, 24))

# Executive summary box
exec_data = [
    [Paragraph('<b>Audit Summary</b>', th_style)],
    [Paragraph(
        'This audit compared every marketing claim on the PracticePro landing page against the actual Convex backend functions, '
        'App.tsx routes, and component implementations. The findings reveal <b>4 Ghost Features</b> (marketed but non-existent), '
        '<b>13 Partial Features</b> (UI exists but key functionality missing), <b>7 Critical security vulnerabilities</b>, '
        'and <b>3 hardcoded API keys</b> exposed in the client bundle. Additionally, <b>rent payments are invisible in financial reports</b> '
        'due to a dual-system data inconsistency, and the core CRUD mutations have <b>zero authentication</b>.',
        ParagraphStyle('ExecBody', fontName='LiberationSerif', fontSize=10, leading=14, textColor=TEXT_PRIMARY)
    )],
]
exec_tbl = Table(exec_data, colWidths=[CONTENT_W], hAlign='CENTER')
exec_tbl.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (0, 0), ACCENT),
    ('BACKGROUND', (0, 1), (0, 1), HexColor('#fef2f2')),
    ('GRID', (0, 0), (-1, -1), 0.5, ACCENT),
    ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ('TOPPADDING', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
]))
story.append(exec_tbl)

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ═══════════════════════════════════════════════════════════════
story.append(P('<b>Table of Contents</b>', h1_style))
story.append(Spacer(1, 8))
toc_items = [
    ('1', 'Feature Traceability Matrix'),
    ('2', 'Ghost and Partial Feature Details'),
    ('3', 'End-to-End Functional Testing'),
    ('4', 'State Integrity: Matter Lifecycle'),
    ('5', 'State Integrity: Property Lifecycle'),
    ('6', 'Edge Case Analysis'),
    ('7', 'Performance Audit'),
    ('8', 'Nigeria-Specific Feature Gaps'),
    ('9', 'Technical Debt Report'),
    ('10', 'Pre-Launch Blockers'),
    ('11', 'Launch Readiness Checklist'),
]
for num, title in toc_items:
    story.append(P(f'<b>{num}.</b>  {title}', body_left_style))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# 1. FEATURE TRACEABILITY MATRIX
# ═══════════════════════════════════════════════════════════════
story.append(H1('1. Feature Traceability Matrix'))
story.append(P(
    'The following matrix compares every feature claim on the PracticePro landing page against actual code implementation. '
    'Each feature is traced through three layers: the App.tsx route, Convex backend functions, and React component code. '
    'Features are classified as LIVE (fully functional), PARTIAL (UI exists but incomplete), GHOST (marketed but no code), '
    'or WIRING_ONLY (backend exists but no user-facing UI). This analysis covers both VEGA (legal) and ATRIUM (property) product modes.',
    body_style
))
story.append(Spacer(1, 10))

story.append(H2('1.1 VEGA (Legal) Features'))
vega_features = [
    ['Case Management', 'matters, matterDetail', 'getFirmData, getMatterDetails', 'MatterList (Kanban), MatterDetailView', 'LIVE'],
    ['ALOA AI Copilot', 'Floating panel', 'generateContent, saveAloaMessage', 'AloaPanel, AloaChat', 'PARTIAL'],
    ['Procedural Intelligence', 'research, indexer', 'None for judgments DB', 'MatterIntakeWizard, proceduralRules.ts', 'PARTIAL'],
    ['Enterprise Jurisdiction Intake', 'matterIngestion modal', 'None specific', 'MatterIntakeWizard, SmartMatterModal', 'PARTIAL'],
    ['Legacy Intelligence Activation', 'NONE', 'NONE', 'Landing page BentoCard only', 'GHOST'],
]
story.append(make_table(
    ['Feature', 'Route', 'Convex Functions', 'Components', 'Status'],
    vega_features,
    [0.20, 0.16, 0.22, 0.26, 0.10]
))
story.append(Spacer(1, 6))
story.append(P('Table 1: VEGA Feature Traceability', caption_style))
story.append(Spacer(1, 10))

story.append(H2('1.2 ATRIUM (Property) Features'))
atrium_features = [
    ['Portfolio Dashboard', 'dashboard, atriumEngine', 'getCashFlowSummary', 'Dashboard, RevenueEngine', 'LIVE'],
    ['Automated Rent Collection', 'atriumEngine', 'addLedgerEntry, getCashFlowSummary', 'LedgerManager, CollectRentModal', 'PARTIAL'],
    ['Lease Management', 'properties, propertyDetail', 'getPropertyDetails', 'PropertyManagerView, PropertyDetailView', 'PARTIAL'],
    ['Maintenance Tracking', 'propertyDetail (tab)', 'Stored inline on property', 'PropertyTrackingView', 'LIVE'],
    ['Secure & NDPA Compliant', 'Cross-cutting', 'verifyLogin, requireFirmUser', 'SecuritySettings, FeatureGuard', 'PARTIAL'],
]
story.append(make_table(
    ['Feature', 'Route', 'Convex Functions', 'Components', 'Status'],
    atrium_features,
    [0.20, 0.16, 0.22, 0.26, 0.10]
))
story.append(Spacer(1, 6))
story.append(P('Table 2: ATRIUM Feature Traceability', caption_style))
story.append(Spacer(1, 10))

story.append(H2('1.3 Pricing Tier Feature Claims'))
pricing_features = [
    ['Revenue Ledger', 'atriumEngine', 'addLedgerEntry, getLedgerByFirm', 'LedgerManager', 'LIVE'],
    ['WhatsApp Reminders', 'atriumEngine', 'sendWhatsApp, incrementWhatsAppQuota', 'AutomationCenter, ComposeModal', 'PARTIAL'],
    ['Service Charge Tracking', 'atriumEngine', 'upsertServiceCharge, getDefaulters', 'ServiceChargeMonitor', 'LIVE'],
    ['Legal Document Generation', 'propertyDetail', 'generateRentDemand', 'Integrated into property detail', 'PARTIAL'],
    ['Tenant Vetting System', 'atriumEngine pipeline', 'addLeadToPipeline', 'VacancyPipeline (manual score only)', 'GHOST'],
    ['WhatsApp Automation Engine', 'atriumEngine', 'runDailyAutomation (simulated)', 'AutomationCenter', 'PARTIAL'],
    ['Live Defaulter Dashboard', 'atriumEngine', 'getDefaulters, flagOverdueCharges', 'ServiceChargeMonitor', 'LIVE'],
    ['Audit Logs & SSO', 'settings', 'getFirmActivity', 'AuditLogViewer (partial)', 'PARTIAL'],
    ['Dedicated Account Manager', 'NONE', 'NONE', 'NONE', 'GHOST'],
    ['Custom SLA', 'NONE', 'NONE', 'NONE', 'GHOST'],
]
story.append(make_table(
    ['Feature', 'Tier Route', 'Convex Functions', 'Components', 'Status'],
    pricing_features,
    [0.20, 0.16, 0.22, 0.26, 0.10]
))
story.append(Spacer(1, 6))
story.append(P('Table 3: Pricing Tier Feature Claims vs. Reality', caption_style))

# ═══════════════════════════════════════════════════════════════
# 2. GHOST AND PARTIAL FEATURE DETAILS
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(H1('2. Ghost and Partial Feature Details'))

story.append(H2('2.1 Ghost Features (Marketed but Non-Existent)'))

story.append(H3('Legacy Intelligence Activation (VEGA)'))
story.append(P(
    'The landing page dedicates an entire full-width section with animated visuals to this feature, describing physical document '
    'digitization, OCR pipelines, and R.A.G. (Retrieval-Augmented Generation) against digitized archives. In reality, there is no '
    'code anywhere in the codebase for document digitization. The brainService has a search method that indexes digital content, '
    'not physical archives. This is the most elaborate marketing section with zero implementation, representing a serious credibility risk '
    'when enterprise clients evaluate the platform during procurement.',
    body_style
))

story.append(H3('Tenant Vetting System (ATRIUM Pro Tier)'))
story.append(P(
    'Listed as an "Exclusive" Pro-tier feature at 420,000 Naira per year, the "Tenant Vetting System" consists solely of a manually '
    'entered 0-100 score field on the VacancyPipeline lead cards. There is no background check integration, no identity verification, '
    'no employment or income validation, no reference checking, and no automated scoring algorithm. The PropertyManagementAgent.ts AI '
    'prompt mentions tenant vetting as a capability, but this only influences ALOA chat responses and does not power an actual vetting '
    'system. A user paying for this exclusive feature receives only a number input field. Under Nigerian consumer protection law, selling '
    'a feature that does not exist could constitute misrepresentation.',
    body_style
))

story.append(H3('Dedicated Account Manager & Custom SLA (Enterprise)'))
story.append(P(
    'These are purely contractual and service-oriented features with no software implementation. There is no CRM, assignment system, '
    'or even a contact field for an account manager in the schema. While these are service-level commitments rather than software features, '
    'listing them alongside functional features on the pricing page creates the impression of a complete product. An enterprise customer '
    'evaluating the platform will discover this immediately in a security review, potentially destroying trust in the entire platform.',
    body_style
))

story.append(H2('2.2 Critical Partial Features'))

story.append(H3('ALOA search_legal_repo Returns Empty'))
story.append(P(
    'The ALOA AI Copilot has a search_legal_repo tool that is stubbed to return an empty array. The backend legal repository query '
    'referenced in the code (api.legalRepo.searchLegalRepo) does not exist as a Convex function. When a lawyer asks ALOA to research '
    'case law, the tool silently returns zero results. The landing page claims "40+ years of Supreme Court judgments" and badges this '
    'as "Live," but the system has procedural rules (timeframes, court jurisdictions) rather than a judgment database. A lawyer missing '
    'a precedent because they trusted this claim could face malpractice exposure, and PracticePro could face liability for the misleading '
    '"Live" badge.',
    body_style
))

story.append(H3('SSO Sold as Enterprise Feature but Zero Implementation'))
story.append(P(
    'The pricing page bundles "Audit Logs & SSO" as a single Enterprise feature. Audit Logs have a partial implementation (a viewer '
    'exists behind a paywall), but SSO has absolutely no code. There is no SAML, no OIDC, and no identity provider configuration anywhere '
    'in the codebase. An enterprise customer evaluating the platform will discover this immediately during a security review. The bundled '
    'promise implies both work, which constitutes a false claim.',
    body_style
))

story.append(H3('"Automated" Rent Collection is Manual'))
story.append(P(
    'The landing page claims "Automated Rent Collection" including the ability to "track payments, generate invoices, and reconcile '
    'accounts automatically." There is no payment gateway integration (no Paystack, Flutterwave, or bank API). Rent is not collected '
    'automatically; it is manually recorded. Invoice generation exists but is basic. Account reconciliation is a manual status change '
    '(pending to cleared to defaulted). The word "Automated" is misleading for a product targeting property managers who expect actual '
    'payment automation.',
    body_style
))

story.append(H3('WhatsApp Automation Engine is Simulated'))
story.append(P(
    'The Pro-tier promises a "WhatsApp Automation Engine" with "Unlimited WhatsApp Reminders." The runDailyAutomation cron job in '
    'sentry.ts is simulated. The "How Automations Work" section in the UI describes trigger rules (T-7 reminder, T+1 late notice) that '
    'do not actually execute. A property manager expecting automatic rent reminders will find they must manually trigger bulk sends. '
    'The feature should be renamed to "WhatsApp Notification Center" or "WhatsApp Composer" until actual event-driven automation exists.',
    body_style
))

# ═══════════════════════════════════════════════════════════════
# 3. END-TO-END FUNCTIONAL TESTING
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(H1('3. End-to-End Functional Testing'))
story.append(P(
    'This section traces the full lifecycle of a Matter (VEGA/Legal) and a Property (ATRIUM/Property) through the DataProvider and '
    'domain hooks to verify data persistence across all mutations. Each lifecycle stage is examined for race conditions, rollback '
    'correctness, and data integrity.',
    body_style
))

# 4. MATTER LIFECYCLE
story.append(H2('4. State Integrity: Matter Lifecycle'))

story.append(H3('Create: Race Condition on Client Co-creation'))
story.append(P(
    'When a new client is created alongside a matter, onAddMatter calls addItem for contacts then addItem for matters sequentially. '
    'If the contact addItem succeeds but the matter addItem fails, the contact is already persisted to Convex with no rollback. '
    'The error handler in addItem only rolls back the specific table item, not related side effects. Additionally, after matter '
    'creation, handleUpdateProperty is called to link the property but is NOT awaited in a try/catch. If the property link update '
    'fails, the matter is created but the property is not linked, resulting in silent data inconsistency.',
    body_style
))

story.append(H3('Read: Phase B Overwrite Risk'))
story.append(P(
    'The two-phase hydration pattern is well-conceived: Phase A (metadata) loads core list fields in under 500ms, and Phase B '
    '(full data) merges the remaining tables. However, Phase B does a blanket state merge that replaces entire table arrays with '
    'server data. Any items created optimistically between Phase A and Phase B arrival (typically a 1-3 second window) are silently '
    'lost from state. During the initial app load, any matter or property created in the first few seconds after login will disappear '
    'from the UI when Phase B data arrives, even though it was successfully persisted to Convex. The data only reappears on the next '
    'full query refresh.',
    body_style
))

story.append(H3('Update: Stale Closure in Optimistic Rollback'))
story.append(P(
    'The updateItem function captures const prevState = appState before the optimistic update. However, appState is a React state '
    'variable in a closure. If two rapid updates occur (e.g., dragging a matter across stages, or bulk property updates), the second '
    'update prevState reflects the FIRST update optimistic state, not the true pre-mutation state. On mutation failure, rollback '
    'restores the wrong state, potentially corrupting the entire appState for that table. Additionally, there is no version conflict '
    'detection; two users editing the same matter simultaneously will silently overwrite each other with last-write-wins semantics.',
    body_style
))

story.append(H3('Delete: Cascade Delete Never Called from UI'))
story.append(P(
    'The handleDeleteMatter hook calls actions.deleteItem which only deletes the matter record itself. A dedicated deleteMatterCascade '
    'Convex mutation exists that would also remove associated tasks, documents, notes, time entries, expenses, and invoices, but this '
    'mutation is NEVER invoked from the UI. The result is that deleting a matter leaves orphaned child records that permanently consume '
    'storage and may leak into other views that query by firmId. The archive operation is also non-atomic: if the archive addItem '
    'succeeds but the deleteItem fails, the matter exists in both the archive and the matters table simultaneously.',
    body_style
))

# 5. PROPERTY LIFECYCLE
story.append(H2('5. State Integrity: Property Lifecycle'))

story.append(H3('CRITICAL: Rent Payments Not Written to ledger_entries'))
story.append(P(
    'This is the single most dangerous data integrity issue in the application. The CollectRentModal writes rent payments to '
    'property.rentPaymentHistory (an embedded array on the property record) and to the invoices table, but does NOT create a '
    'ledger_entries record. The getCashFlowSummary query in sentry.ts, which powers the dashboard revenue metrics and cash flow '
    'analytics, reads exclusively from ledger_entries. This means ALL rent collection revenue is invisible in financial reports. '
    'During high-volume rent season (quarterly collections), potentially millions of Naira in collected rent are missing from the '
    'firm revenue dashboard and cash flow analytics. These two data sources can also diverge, showing different totals for the same '
    'period.',
    body_style
))

story.append(H3('Receipt Broken for Rent Payments'))
story.append(P(
    'The CollectRentModal generates receipts with client: { id: "tenant", name: tenantName }, using a hardcoded "tenant" string '
    'as the client ID rather than the actual tenant contact ID. When ReceiptDetailView tries to look up the client by this ID, '
    'it fails and shows an error alert instead of the receipt. Additionally, receipt numbers are generated with '
    'REC-${Math.floor(100000 + Math.random() * 900000)}, which is non-deterministic and can produce duplicate numbers under '
    'high volume. When no linked matter exists, a dummy matter with id "firm-general" is used for invoice creation, creating '
    'reference integrity issues.',
    body_style
))

story.append(H3('Caution Deposit Dual-Write Inconsistency'))
story.append(P(
    'When saving a property with a caution deposit, the deposit is routed to ledger_entries via addLedgerEntry in sentry.ts. If this '
    'secondary mutation fails, it is caught with console.warn but the property is still saved. The result is that the deposit is '
    'recorded in the property but NOT in the ledger. Multi-unit creation is also non-transactional: units are persisted in a for loop '
    'with await, and if unit 3 of 5 fails, units 1-2 are persisted while units 3-5 are lost with no rollback.',
    body_style
))

# ═══════════════════════════════════════════════════════════════
# 6. EDGE CASE ANALYSIS
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(H1('6. Edge Case Analysis'))

story.append(H2('6.1 Empty Catch Blocks'))
empty_catches = [
    ['convex/myFunctions.ts', 'deleteAccount', 'Firm deletion failure silently ignored', 'CRITICAL'],
    ['convex/myFunctions.ts', 'deleteFirm', 'Firm record deletion failure silently ignored', 'CRITICAL'],
    ['convex/myFunctions.ts', 'deleteMatterCascade', 'Property lookup failure silently ignored', 'HIGH'],
    ['src/components/forms/SaveToNoteForm.tsx', 'Note saving', 'Error in note saving silently swallowed', 'HIGH'],
    ['convex/myFunctions.ts', 'getJoinedFirms', 'Error when fetching joined firms silently swallowed', 'MEDIUM'],
]
story.append(make_table(
    ['File', 'Function', 'Issue', 'Severity'],
    empty_catches,
    [0.30, 0.20, 0.35, 0.12]
))
story.append(Spacer(1, 6))
story.append(P('Table 4: Empty Catch Blocks That Could Cause Silent Failures', caption_style))

story.append(Spacer(1, 10))
story.append(H2('6.2 Sensitive Console.log Statements'))
console_logs = [
    ['src/contexts/AuthContext.tsx', 'Leaks firm ID on repair success', 'HIGH'],
    ['src/contexts/UIContext.tsx', 'Leaks user IDs on user change', 'HIGH'],
    ['src/hooks/useBrainAutoIndex.ts', 'Leaks firm ID during background indexing', 'HIGH'],
    ['convex/myFunctions.ts', 'Leaks email address on Brevo send', 'HIGH'],
    ['src/services/indexer/GeminiStructurer.ts', 'Leaks AI processing data', 'MEDIUM'],
    ['convex/myFunctions.ts', 'Logs firm data loading in Convex', 'MEDIUM'],
]
story.append(make_table(
    ['File', 'Issue', 'Severity'],
    console_logs,
    [0.40, 0.45, 0.12]
))
story.append(Spacer(1, 6))
story.append(P('Table 5: Console.log Statements Leaking Sensitive Data', caption_style))

story.append(Spacer(1, 10))
story.append(H2('6.3 Hardcoded IDs and Test Data'))
hardcoded_ids = [
    ['CollectRentModal.tsx', '{ id: "firm-general" }', 'Dummy matter ID for invoices', 'CRITICAL'],
    ['CollectRentModal.tsx', 'client: { id: "tenant" }', 'Breaks ReceiptDetailView', 'CRITICAL'],
    ['AuthContext.tsx', '"atrium-demo-firm-id"', 'Demo IDs could collide with real data', 'MEDIUM'],
    ['myFunctions.ts', '"demo_firm_id"', 'Hardcoded demo check in production query', 'MEDIUM'],
]
story.append(make_table(
    ['File', 'Hardcoded Value', 'Impact', 'Severity'],
    hardcoded_ids,
    [0.25, 0.25, 0.35, 0.12]
))
story.append(Spacer(1, 6))
story.append(P('Table 6: Hardcoded IDs That Must Be Removed Before Launch', caption_style))

# ═══════════════════════════════════════════════════════════════
# 7. PERFORMANCE AUDIT
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(H1('7. Performance Audit'))
story.append(P(
    'The recent "Mega-Query" refactor introduced a two-phase hydration pattern that significantly improves initial load time. '
    'Phase A (metadata) unlocks the UI in under 500ms, while Phase B (full data) merges silently. However, several significant '
    'performance bottlenecks remain that will cause unacceptable lag as data volume grows.',
    body_style
))

perf_issues = [
    ['MatterList O(n2) per-card filtering', '1-2s render with 100 matters', 'CRITICAL'],
    ['getFirmData 65 DB queries per load', '1.3-2s server time for Phase B', 'CRITICAL'],
    ['getCashFlowSummary unbounded collect', 'Timeout with 10K+ entries', 'CRITICAL'],
    ['MatterList no pagination', '500ms-1s for 100 matters, DOM bloat', 'CRITICAL'],
    ['Phase B atomic state merge', '200ms JS block freezing main thread', 'MEDIUM'],
    ['contextActions not memoized', 'Re-renders all DataActionsContext consumers', 'MEDIUM'],
    ['12 nested providers cascade re-renders', 'Cascading re-renders on any mutation', 'HIGH'],
    ['Dashboard unmemoized stats', '100ms per re-render with 50 properties', 'MEDIUM'],
    ['RevenueEngine inline ledger filters', '50ms per render with 1000 entries', 'MEDIUM'],
    ['PropertyManagerView no pagination', 'DOM bloat with 50+ properties', 'MEDIUM'],
    ['handleBulkUpdateProperties N parallel mutations', '50 HTTP requests for 50 property edits', 'MEDIUM'],
    ['ReportingView synchronous report generation', '500ms-2s UI freeze during generation', 'MEDIUM'],
]
story.append(make_table(
    ['Module / Issue', 'Estimated Impact', 'Severity'],
    perf_issues,
    [0.50, 0.30, 0.12]
))
story.append(Spacer(1, 6))
story.append(P('Table 7: Performance Bottleneck Summary', caption_style))

story.append(Spacer(1, 8))
story.append(H3('Estimated Total Load Time at Scale'))
story.append(P(
    'With 100 matters, 50 properties (500 units), and 1,000 ledger entries, the estimated total time to fully interactive is '
    '3-5 seconds. Phase B (1.5-2.5s server time) and MatterList rendering (500ms-1.5s due to O(n2) per-card filtering) are '
    'the worst offenders. The Phase A metadata projection is well-optimized at 400-600ms. The primary fix should target the '
    'MatterList per-card filtering pattern: pre-building Map of matterId to Task/Document arrays would reduce render from 1.5s '
    'to approximately 50ms.',
    body_style
))

# ═══════════════════════════════════════════════════════════════
# 8. NIGERIA-SPECIFIC FEATURE GAPS
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(H1('8. Nigeria-Specific Feature Gaps'))
story.append(P(
    'Based on the current codebase analysis and the Nigerian property management market, the following critical "last-mile" features '
    'are missing. Each gap is classified by its impact on the Nigerian market and the current implementation status.',
    body_style
))

nigeria_gaps = [
    ['WHT on Rent (10%)', 'Mandatory under PITA for corporate landlords', 'PARTIAL: VEGA only, not in Atrium', 'P0'],
    ['VAT on Service Charges (7.5%)', 'Required by VAT Act 2007', 'PARTIAL: Invoice forms only, not service charges', 'P0'],
    ['Quit Notice Automation', 'Lagos Tenancy Law 2011 requires statutory notices', 'CRITICAL MISSING', 'P0'],
    ['Tenancy Agreement Generation', 'Every tenancy requires written agreement', 'CRITICAL MISSING', 'P0'],
    ['PDF Receipt Generation', 'Tenants expect formal receipts for tax documentation', 'PARTIAL: Bare HTML print only', 'P1'],
    ['Auto-Penalty for Late Rent', 'Late rent is endemic in Nigeria', 'PARTIAL: Manual 5% click-to-apply only', 'P1'],
    ['Land Use Charge Compliance', 'Mandatory for Lagos State property owners', 'CRITICAL MISSING', 'P1'],
    ['CAM Allocation Engine', 'Multi-tenant buildings need fair charge splitting', 'CRITICAL MISSING', 'P2'],
    ['Bank Reconciliation', 'Multiple payment channels need reconciliation', 'CRITICAL MISSING', 'P2'],
    ['Multi-Currency Support', 'Ikoyi/VI/Maitama properties charge in USD', 'CRITICAL MISSING', 'P2'],
]
story.append(make_table(
    ['Feature', 'Nigeria Market Need', 'Current Status', 'Priority'],
    nigeria_gaps,
    [0.22, 0.30, 0.32, 0.08]
))
story.append(Spacer(1, 6))
story.append(P('Table 8: Nigeria-Specific Feature Gap Analysis', caption_style))

story.append(Spacer(1, 8))
story.append(P(
    'The most critical gap is the absence of Withholding Tax (WHT) and Value Added Tax (VAT) tracking on Atrium property collections. '
    'Every single rent payment and service charge in Nigeria has tax implications. WHT at 10% on rent to corporate landlords is mandatory '
    'under PITA, and VAT at 7.5% on service charges is required by the VAT Act 2007 as amended in 2020. Current Atrium has zero tax '
    'tracking on property collections, which means firms using the platform cannot generate compliant tax reports for FIRS filing. '
    'The Quit Notice Automation gap is equally dangerous: missing a quit notice deadline means you cannot legally recover possession, '
    'and the case will be dismissed in court. The AI agent already knows the law; it just needs execution capability.',
    body_style
))

# ═══════════════════════════════════════════════════════════════
# 9. TECHNICAL DEBT REPORT
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(H1('9. Technical Debt Report'))

story.append(H2('9.1 Code Quality Regression'))

story.append(H3('Dual Payment Systems'))
story.append(P(
    'Properties track rentPaymentHistory (an array on each property record) while Atrium separately tracks ledger_entries (a dedicated '
    'table). No synchronization mechanism exists. A rent payment recorded via CollectRentModal updates rentPaymentHistory but does NOT '
    'create a ledgerEntry. These are two independent financial records with no single source of truth, creating a scenario where tenants '
    'could appear paid in one system but overdue in another.',
    body_style
))

story.append(H3('Auth Pattern Duplication'))
story.append(P(
    'Three separate auth mechanisms exist: (1) withFirmAuth, an HOC wrapper that looks up users by firmId but never calls '
    'getUserIdentity(); (2) authUtils.ts with PBKDF2 password hashing for login only; (3) authHelpers.ts with requireFirmUser() that '
    'does call getUserIdentity() and is the correct pattern. Worse, withFirmAuth is not used by any mutation (zero references in '
    'myFunctions.ts) and withFirmAuth allows a "skip" string to bypass auth entirely. The withFirmAuth function gives a false sense '
    'of security because it does not verify WHO is calling, only that some user exists with the given firmId.',
    body_style
))

story.append(H3('Type Safety: The "any" Epidemic'))
story.append(P(
    'The codebase contains approximately 680 instances of "any" type usage across 90+ files. The Convex schema has 86 instances of '
    'v.any() validation bypass, with 66 in schema.ts alone. The three generic CRUD mutations (createItem, updateItem, deleteItem) '
    'accept data: v.any(), meaning any data shape can be written to any table with zero validation. Key fields like rentalDetails, '
    'disputeDetails, saleDetails, specialtyData, parties, bankAccounts, rentPaymentHistory, and metadata are all v.any(). This '
    'compromises database integrity and eliminates any migration path for schema changes since there is no schema to evolve.',
    body_style
))

story.append(H3('Context State Overlap'))
story.append(P(
    'Five domain contexts (CoreContext, MatterContext, FinanceContext, DocumentContext, ExecutionContext) are pure passthroughs that '
    'each destructure appState from DataContext, re-slice it, and re-expose the same updateItem/deleteItem from DataContext. This adds '
    '5 provider layers with zero added logic. The DataContext itself has an ExtendedDataActions interface with 70+ methods, composing '
    '8 domain hooks into one giant contextActions object. Any change to any hook triggers re-evaluation of the entire context value.',
    body_style
))

# 10. PRE-LAUNCH BLOCKERS
story.append(H2('10. Pre-Launch Blockers'))

story.append(H3('10.1 Hardcoded API Keys in Client Bundle'))
story.append(P(
    'Three unique Gemini API keys are hardcoded in client-side code. The key AIzaSyAjPumBNTGi8Lzg457yKm4dD0jFAzefXo0 appears in '
    'aiUtils.ts (line 163), AloaChat.tsx (line 464), and geminiService.ts (lines 246, 379, 460, 544). A second key '
    'AIzaSyDd5ib2A1562gO2PY1FQElSVzwyIaeBAN8 also appears in geminiService.ts. Additionally, the embedding API URL in aiUtils.ts '
    'appends the key as a query parameter (?key=${apiKey}), which means API keys are logged by proxies, CDNs, and browsers. All AI '
    'calls must be routed through Convex actions (server-side) where keys remain secret.',
    body_style
))

story.append(H3('10.2 Zero Authentication on CRUD Mutations'))
story.append(P(
    'The three most critical mutations, createItem, updateItem, and deleteItem, have zero authentication. No getUserIdentity(), '
    'no withFirmAuth, no requireFirmUser. Any client can call deleteItem({ table: "users", id: "..." }) and delete any record. '
    'This is the single highest-risk security issue in the application and must be fixed before any paying user logs in.',
    body_style
))

story.append(H3('10.3 Offline Admin Bypass'))
story.append(P(
    'When Convex is unreachable, the app creates a mock offlineUser with role: "Admin", firmId: "offline_firm", and isVerified: true. '
    'This means anyone can get admin access by simply disconnecting from the network. This must be replaced with cached JWT '
    'verification or limited to read-only mode.',
    body_style
))

story.append(H3('10.4 Demo/Mock Code Not Gated'))
story.append(P(
    'The demo@practicepro.ng bypass, VEGA_DEMO_APP_STATE, ATRIUM_DEMO_APP_STATE, and FloatingTestControls are present in '
    'production code. The demo user gets free AI usage, bypassed auth, and special UI treatment. The isDemo check is scattered '
    'across 13+ files. All demo code must be gated behind import.meta.env.DEV or a backend-controlled feature flag to ensure '
    'it is excluded from production builds.',
    body_style
))

# ═══════════════════════════════════════════════════════════════
# 11. LAUNCH READINESS CHECKLIST
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 12))
story.append(H1('11. Launch Readiness Checklist'))
story.append(P(
    'The following checklist consolidates all findings into three priority categories. Items marked [Must Fix] will cause data loss, '
    'security breaches, or legal liability if not addressed before the first paying user. Items marked [Remove for V1] should be '
    'hidden or stripped from the product to avoid misleading customers. Items marked [Optional for V1] are recommended improvements '
    'that enhance the product but do not block launch.',
    body_style
))

story.append(H2('MUST FIX Before V1'))

must_fix = [
    ['Wire requireFirmUser() into createItem/updateItem/deleteItem mutations', 'Security', '8h'],
    ['Remove all 3 hardcoded Gemini API keys; route AI calls through Convex actions', 'Security', '6h'],
    ['Kill offline Admin bypass in AuthContext.tsx; replace with cached JWT or read-only mode', 'Security', '4h'],
    ['Remove "skip" auth bypass string from withAuth.ts', 'Security', '1h'],
    ['Gate all demo/mock code behind import.meta.env.DEV', 'Security', '8h'],
    ['Fix rent collection: write to ledger_entries alongside rentPaymentHistory', 'Data Integrity', '4h'],
    ['Fix ReceiptDetailView for rent receipts (client.id = "tenant" breaks lookup)', 'Data Integrity', '3h'],
    ['Wire deleteMatterCascade from UI instead of simple deleteItem', 'Data Integrity', '2h'],
    ['Fix Phase B hydration overwrite of optimistic creates', 'Data Integrity', '4h'],
    ['Fix stale closure in updateItem rollback (use ref-based snapshot)', 'Data Integrity', '3h'],
    ['Change "Tenant Vetting System" from Exclusive Pro-tier claim (it is just a manual score input)', 'Legal/Marketing', '1h'],
    ['Remove "40+ years of Supreme Court judgments" claim; change "Live" badge to "Beta"', 'Legal/Marketing', '1h'],
    ['Split "Audit Logs & SSO" into separate line items; mark SSO as "Coming Soon"', 'Legal/Marketing', '1h'],
    ['Remove "Legacy Intelligence Activation" section from landing page', 'Legal/Marketing', '1h'],
    ['Rename "WhatsApp Automation Engine" to "WhatsApp Notification Center"', 'Legal/Marketing', '1h'],
    ['Remove "Automated" from "Automated Rent Collection"', 'Legal/Marketing', '1h'],
    ['Add per-route ErrorBoundary wrapping for all detail views', 'Reliability', '6h'],
    ['Fix empty catch blocks in deleteAccount, deleteFirm, deleteMatterCascade', 'Reliability', '2h'],
    ['Remove sensitive console.log statements (firm IDs, user IDs, emails)', 'Security', '2h'],
    ['Remove FloatingTestControls from production build', 'Security', '1h'],
]
story.append(make_table(
    ['Item', 'Category', 'Est. Effort'],
    must_fix,
    [0.65, 0.15, 0.10]
))
story.append(Spacer(1, 6))
story.append(P('Table 9: Must Fix Before V1 (20 items)', caption_style))

story.append(Spacer(1, 10))
story.append(H2('REMOVE For V1'))

remove_v1 = [
    ['Legacy Intelligence Activation landing page section (entire block)', 'Ghost Feature'],
    ['"Dedicated Account Manager" from Enterprise pricing cards', 'Ghost Feature'],
    ['"Custom SLA Guarantee" from Enterprise pricing cards', 'Ghost Feature'],
    ['"Tenant Vetting System" as Pro-tier exclusive (or rename to "Applicant Pipeline")', 'Ghost Feature'],
    ['ALOA search_legal_repo tool (returns empty results silently)', 'Broken Feature'],
    ['"Bank-grade encryption" and "AES-256 at Rest" claims (add asterisk: provided by Convex)', 'Misleading'],
    ['Trust badge "ISO 27001 Aligned" without supporting documentation', 'Misleading'],
    ['VacancyPipeline vetting score field (replace with proper vetting workflow or remove)', 'Incomplete'],
]
story.append(make_table(
    ['Item to Remove or Relabel', 'Reason'],
    remove_v1,
    [0.70, 0.20]
))
story.append(Spacer(1, 6))
story.append(P('Table 10: Remove or Relabel for V1 (8 items)', caption_style))

story.append(Spacer(1, 10))
story.append(H2('OPTIONAL For V1'))

optional_v1 = [
    ['MatterList O(n2) performance fix (pre-build Map, pagination)', 'Performance', '1w'],
    ['Dashboard and RevenueEngine useMemo wrapping', 'Performance', '2d'],
    ['Replace v.any() on critical schema fields with typed validators', 'Type Safety', '2w'],
    ['Consolidate 5 passthrough contexts into direct DataContext access', 'Architecture', '1w'],
    ['Extract shared form abstraction (ALOA listener, firmId resolution)', 'Code Quality', '3d'],
    ['Add WHT/VAT fields to Atrium ledger_entries and service_charges', 'Nigeria Compliance', '1.5w'],
    ['Add quit notice automation with Lagos Tenancy Law 2011 compliance', 'Nigeria Compliance', '2w'],
    ['Build tenancy agreement document generation', 'Nigeria Compliance', '3w'],
    ['Proper PDF receipt generation with firm branding and tax breakdown', 'User Experience', '1.5w'],
    ['Auto-penalty logic for late rent payments', 'Nigeria Compliance', '1w'],
    ['Land Use Charge tracking for Lagos properties', 'Nigeria Compliance', '1.5w'],
    ['CAM allocation engine for multi-tenant buildings', 'Nigeria Compliance', '2w'],
    ['Bank statement reconciliation engine', 'Nigeria Compliance', '3w'],
    ['Multi-currency support (USD rent)', 'Nigeria Compliance', '2w'],
]
story.append(make_table(
    ['Item', 'Category', 'Est. Effort'],
    optional_v1,
    [0.60, 0.18, 0.10]
))
story.append(Spacer(1, 6))
story.append(P('Table 11: Optional for V1 (14 items)', caption_style))

# ═══════════════════════════════════════════════════════════════
# SUMMARY STATISTICS
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 18))
story.append(H2('Audit Summary Statistics'))

stats_data = [
    ['Ghost Features (marketed, no code)', '4'],
    ['Partial Features (UI exists, incomplete)', '13'],
    ['Live Features (fully functional)', '7'],
    ['Critical Security Vulnerabilities', '7'],
    ['Hardcoded API Keys in Client Bundle', '3 (appearing ~10 times)'],
    ['Empty Catch Blocks (silent failures)', '7'],
    ['Console.log Leaking Sensitive Data', '9'],
    ['Hardcoded IDs in Production Code', '4'],
    ['Total "any" Type Usages', '~680 across 90+ files'],
    ['Total v.any() in Convex Schema', '86 (66 in schema.ts)'],
    ['Mutations Without Authentication', '3 critical (createItem, updateItem, deleteItem)'],
    ['Context Providers in React Tree', '12'],
    ['Must Fix Items', '20'],
    ['Remove for V1 Items', '8'],
    ['Optional for V1 Items', '14'],
]
story.append(make_table(
    ['Metric', 'Count'],
    stats_data,
    [0.60, 0.30]
))
story.append(Spacer(1, 6))
story.append(P('Table 12: Audit Summary Statistics', caption_style))

# ━━ Build ━━
doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
print(f"PDF generated: {OUTPUT}")
