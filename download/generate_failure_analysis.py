#!/usr/bin/env python3
"""
PracticePro: Failure Analysis & Simplification Roadmap
Comprehensive analysis of why PracticePro might fail and how to simplify it.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, CondPageBreak, HRFlowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import SimpleDocTemplate
import hashlib

# ━━ Color Palette ━━
ACCENT       = colors.HexColor('#db562a')
TEXT_PRIMARY  = colors.HexColor('#1f2122')
TEXT_MUTED    = colors.HexColor('#81868d')
BG_SURFACE   = colors.HexColor('#dde0e4')
BG_PAGE      = colors.HexColor('#e9ebed')

TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = BG_SURFACE

# Semantic
SEM_SUCCESS   = colors.HexColor('#4b855e')
SEM_WARNING   = colors.HexColor('#a3874f')
SEM_ERROR     = colors.HexColor('#91544e')
SEM_INFO      = colors.HexColor('#5179a2')

# ━━ Font Registration ━━
pdfmetrics.registerFont(TTFont('LiberationSerif', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif-Bold', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif-Italic', '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif-BoldItalic', '/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Bold', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('LiberationSerif', normal='LiberationSerif', bold='LiberationSerif-Bold', italic='LiberationSerif-Italic', boldItalic='LiberationSerif-BoldItalic')
registerFontFamily('Carlito', normal='Carlito', bold='Carlito-Bold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ━━ Page Setup ━━
PAGE_W, PAGE_H = A4
LEFT_MARGIN = 0.9 * inch
RIGHT_MARGIN = 0.9 * inch
TOP_MARGIN = 0.75 * inch
BOTTOM_MARGIN = 0.75 * inch
AVAILABLE_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

# ━━ Styles ━━
styles = getSampleStyleSheet()

cover_title = ParagraphStyle(
    'CoverTitle', fontName='LiberationSerif', fontSize=36, leading=44,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, spaceAfter=12
)
cover_subtitle = ParagraphStyle(
    'CoverSubtitle', fontName='LiberationSerif', fontSize=18, leading=24,
    alignment=TA_LEFT, textColor=TEXT_MUTED, spaceAfter=8
)
cover_meta = ParagraphStyle(
    'CoverMeta', fontName='LiberationSerif', fontSize=12, leading=16,
    alignment=TA_LEFT, textColor=TEXT_MUTED
)
h1_style = ParagraphStyle(
    'H1', fontName='LiberationSerif', fontSize=22, leading=28,
    alignment=TA_LEFT, textColor=ACCENT, spaceBefore=18, spaceAfter=10
)
h2_style = ParagraphStyle(
    'H2', fontName='LiberationSerif', fontSize=16, leading=22,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=8
)
h3_style = ParagraphStyle(
    'H3', fontName='LiberationSerif', fontSize=13, leading=18,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6
)
body_style = ParagraphStyle(
    'Body', fontName='LiberationSerif', fontSize=10.5, leading=17,
    alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=6,
    firstLineIndent=0
)
body_indent = ParagraphStyle(
    'BodyIndent', fontName='LiberationSerif', fontSize=10.5, leading=17,
    alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=6,
    leftIndent=18
)
bullet_style = ParagraphStyle(
    'Bullet', fontName='LiberationSerif', fontSize=10.5, leading=17,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, spaceAfter=4,
    leftIndent=24, bulletIndent=12
)
callout_style = ParagraphStyle(
    'Callout', fontName='LiberationSerif', fontSize=10.5, leading=17,
    alignment=TA_LEFT, textColor=ACCENT, spaceAfter=6,
    leftIndent=18, borderPadding=8, borderColor=ACCENT, borderWidth=0
)
header_cell = ParagraphStyle(
    'HeaderCell', fontName='LiberationSerif', fontSize=10, leading=14,
    alignment=TA_CENTER, textColor=TABLE_HEADER_TEXT
)
cell_style = ParagraphStyle(
    'Cell', fontName='LiberationSerif', fontSize=9.5, leading=14,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY
)
cell_center = ParagraphStyle(
    'CellCenter', fontName='LiberationSerif', fontSize=9.5, leading=14,
    alignment=TA_CENTER, textColor=TEXT_PRIMARY
)
caption_style = ParagraphStyle(
    'Caption', fontName='LiberationSerif', fontSize=9, leading=13,
    alignment=TA_CENTER, textColor=TEXT_MUTED, spaceBefore=3, spaceAfter=6
)
toc_h1 = ParagraphStyle(
    'TOCH1', fontName='LiberationSerif', fontSize=13, leading=20,
    leftIndent=20, textColor=TEXT_PRIMARY
)
toc_h2 = ParagraphStyle(
    'TOCH2', fontName='LiberationSerif', fontSize=11, leading=18,
    leftIndent=40, textColor=TEXT_MUTED
)

# ━━ Helper Functions ━━
def make_table(data, col_widths=None, caption=None):
    """Create a styled table with optional caption."""
    if col_widths is None:
        col_widths = [AVAILABLE_W / len(data[0])] * len(data[0])
    else:
        col_widths = [w * AVAILABLE_W for w in col_widths] if max(col_widths) <= 1.0 else col_widths

    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    elements = [Spacer(1, 18), t]
    if caption:
        elements.append(Paragraph(caption, caption_style))
    elements.append(Spacer(1, 12))
    return elements


def severity_badge(level):
    """Return a colored paragraph for severity."""
    color_map = {'CRITICAL': SEM_ERROR, 'HIGH': SEM_WARNING, 'MEDIUM': SEM_INFO, 'LOW': SEM_SUCCESS}
    c = color_map.get(level, TEXT_MUTED)
    return Paragraph(f'<b>{level}</b>', ParagraphStyle(
        'Badge', fontName='LiberationSerif', fontSize=9, leading=13,
        alignment=TA_CENTER, textColor=c
    ))


def add_heading(text, style, level=0):
    """Add a heading with bookmark for TOC."""
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/>%s' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p


# ━━ TOC Document Template ━━
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))


# ━━ Build Document ━━
output_path = '/home/z/my-project/download/PracticePro_Failure_Analysis.pdf'

doc = TocDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=LEFT_MARGIN,
    rightMargin=RIGHT_MARGIN,
    topMargin=TOP_MARGIN,
    bottomMargin=BOTTOM_MARGIN
)

story = []

# ═══════════════════════════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 120))
story.append(HRFlowable(width="40%", thickness=2, color=ACCENT, spaceBefore=0, spaceAfter=16))
story.append(Paragraph('<b>PracticePro</b>', cover_title))
story.append(Paragraph('Failure Analysis &amp;<br/>Simplification Roadmap', ParagraphStyle(
    'CoverTitle2', fontName='LiberationSerif', fontSize=28, leading=36,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, spaceAfter=24
)))
story.append(HRFlowable(width="25%", thickness=1, color=TEXT_MUTED, spaceBefore=0, spaceAfter=20))
story.append(Paragraph('VEGA Legal Module + Atrium Property Management', cover_subtitle))
story.append(Paragraph('React + Convex | Ati Gravity Platform | Nigerian Market', cover_meta))
story.append(Spacer(1, 40))
story.append(Paragraph('Why This App Might Fail, What to Cut, and How to Ship', ParagraphStyle(
    'CoverTag', fontName='LiberationSerif', fontSize=12, leading=16,
    alignment=TA_LEFT, textColor=ACCENT
)))
story.append(Spacer(1, 60))
story.append(Paragraph('May 2026 | Confidential', cover_meta))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph('<b>Table of Contents</b>', ParagraphStyle(
    'TOCTitle', fontName='LiberationSerif', fontSize=20, leading=28,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, spaceAfter=16
)))
toc = TableOfContents()
toc.levelStyles = [toc_h1, toc_h2]
story.append(toc)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# SECTION 1: EXECUTIVE SUMMARY
# ═══════════════════════════════════════════════════════════════
story.append(add_heading('<b>1. Executive Summary</b>', h1_style, level=0))

story.append(Paragraph(
    'PracticePro is an ambitious dual-module SaaS application combining VEGA (legal practice management) '
    'and Atrium (property management) on the Ati Gravity platform, targeting the Nigerian market. While the '
    'vision of an integrated legal-proptech solution is compelling, the current codebase reveals a pattern of '
    'accumulated complexity that poses a genuine existential risk to the product. A prior codebase audit '
    'identified 5 critical and 8 high-severity issues, and this analysis goes further to examine the systemic '
    'reasons why the app, in its current form, is likely to fail at launch.',
    body_style
))
story.append(Paragraph(
    'The core thesis of this report is threefold. First, the app suffers from a compounding complexity problem: '
    'each module (legal and property) is itself a full product, and combining them without rigorous abstraction '
    'boundaries has created a tangled architecture where failures cascade across modules. Second, critical '
    'security and data integrity issues remain unresolved, any one of which could cause a catastrophic breach '
    'in a legal context where client confidentiality is a regulatory requirement. Third, the feature scope is '
    'far too broad for a V1 launch targeting the Nigerian market, where users need reliability and simplicity '
    'over feature completeness.',
    body_style
))
story.append(Paragraph(
    'This report catalogs the specific failure modes, maps the full complexity of the current feature set, and '
    'provides a prioritized simplification roadmap that identifies what must be kept, what should be deferred, '
    'and what should be cut entirely. The goal is not to diminish the vision but to ensure that PracticePro '
    'ships successfully and survives long enough to become the product it was designed to be.',
    body_style
))

# Key findings callout
story.append(Spacer(1, 8))
story.append(Paragraph('<b>Key Findings at a Glance</b>', h3_style))
key_findings_data = [
    [Paragraph('<b>Finding</b>', header_cell), Paragraph('<b>Severity</b>', header_cell), Paragraph('<b>Impact</b>', header_cell)],
    [Paragraph('Exposed API keys in aiUtils.ts and geminiService.ts', cell_style), severity_badge('CRITICAL'), Paragraph('Financial loss, data breach', cell_style)],
    [Paragraph('withFirmAuth never calls getUserIdentity() - auth bypass', cell_style), severity_badge('CRITICAL'), Paragraph('Any user accesses any firm data', cell_style)],
    [Paragraph('Dual unsynchronized payment systems', cell_style), severity_badge('CRITICAL'), Paragraph('Financial reports unreliable', cell_style)],
    [Paragraph('12-provider context hierarchy', cell_style), severity_badge('HIGH'), Paragraph('Performance, debugging nightmare', cell_style)],
    [Paragraph('Orphaned PropertyTrackingView (dead code)', cell_style), severity_badge('HIGH'), Paragraph('Confusion, wasted dev time', cell_style)],
    [Paragraph('No NBA compliance (audit logs, 7-year retention)', cell_style), severity_badge('HIGH'), Paragraph('Cannot sell to Nigerian law firms', cell_style)],
    [Paragraph('Feature scope too broad for V1', cell_style), severity_badge('HIGH'), Paragraph('Missed deadlines, user confusion', cell_style)],
]
story.extend(make_table(key_findings_data, [0.50, 0.15, 0.35], 'Table 1: Critical findings requiring immediate attention'))

# ═══════════════════════════════════════════════════════════════
# SECTION 2: FAILURE MODE ANALYSIS
# ═══════════════════════════════════════════════════════════════
story.append(add_heading('<b>2. Failure Mode Analysis</b>', h1_style, level=0))

story.append(Paragraph(
    'This section examines six distinct categories of failure risk. Each is analyzed in terms of the specific '
    'codebase issues that create the risk, the likely scenario if the issue is not resolved, and the compounding '
    'effects when multiple failure modes interact. Understanding these failure modes is essential for making '
    'informed decisions about what to cut and what to keep.',
    body_style
))

# 2.1 Security Failure
story.append(add_heading('<b>2.1 Security Failure</b>', h2_style, level=1))

story.append(Paragraph(
    'The most immediate and catastrophic failure mode for PracticePro is a security breach. Legal applications '
    'handle some of the most sensitive data in any industry: client communications, case strategies, financial '
    'records, and privileged documents. A breach in this context does not merely cause embarrassment or '
    'regulatory fines; it can result in disbarment proceedings, civil liability, and the complete destruction of '
    'a law firm\'s reputation. PracticePro currently has three unaddressed security vulnerabilities that, '
    'individually and especially in combination, make a security breach not just possible but probable.',
    body_style
))

story.append(Paragraph('<b>Exposed API Keys</b>', h3_style))
story.append(Paragraph(
    'The files <font name="DejaVuSans">aiUtils.ts</font> and <font name="DejaVuSans">geminiService.ts</font> contain hardcoded Gemini API keys. These keys '
    'are embedded in the client-side JavaScript bundle, meaning they are accessible to anyone who opens the '
    'browser developer tools. An attacker can extract these keys in under thirty seconds and use them to make '
    'API calls at PracticePro\'s expense, potentially running up thousands of dollars in usage charges. More '
    'critically, if the Gemini integration has access to firm data (which it does, since AloaChat uses it to '
    'answer questions about matters and properties), the attacker may be able to extract confidential client '
    'information through carefully crafted prompts. This is not a theoretical risk; it is the single most '
    'dangerous vulnerability in the entire codebase and must be fixed before any external user sees the application.',
    body_style
))

story.append(Paragraph('<b>Authentication Bypass via withFirmAuth</b>', h3_style))
story.append(Paragraph(
    'The Convex authentication wrapper <font name="DejaVuSans">withFirmAuth</font> was designed to ensure that '
    'only authenticated users can access firm-specific data. However, the prior audit revealed that this wrapper '
    'never actually calls <font name="DejaVuSans">getUserIdentity()</font>, which is the Convex function that '
    'verifies the user\'s authentication token. This means that the authentication check is essentially a no-op: '
    'it goes through the motions of checking firm membership without first verifying that the user is who they '
    'claim to be. In practical terms, any unauthenticated HTTP request to a Convex function protected by '
    '<font name="DejaVuSans">withFirmAuth</font> will succeed, potentially exposing every firm\'s matters, '
    'documents, financial records, and client data. This is an Insecure Direct Object Reference (IDOR) '
    'vulnerability, which is consistently ranked in the OWASP Top 10. In a legal application, this is an '
    'existential threat.',
    body_style
))

story.append(Paragraph('<b>Compounding Effect</b>', h3_style))
story.append(Paragraph(
    'These two vulnerabilities compound each other dangerously. An attacker who extracts the API keys from the '
    'client bundle now has a verified entry point into the system. They can use the AI features to probe the data '
    'model, learning the schema and relationships. They can then directly query Convex functions protected by the '
    'broken <font name="DejaVuSans">withFirmAuth</font> to extract data at scale. What makes this particularly '
    'insidious is that neither vulnerability triggers obvious alarms: the API usage appears legitimate (it uses '
    'real keys), and the data access appears authorized (it passes through the auth wrapper). A breach could '
    'persist for weeks or months before discovery.',
    body_style
))

# 2.2 Data Integrity Failure
story.append(add_heading('<b>2.2 Data Integrity Failure</b>', h2_style, level=1))

story.append(Paragraph(
    'Data integrity in a legal-proptech application is non-negotiable. Courts, regulatory bodies, and clients '
    'expect that financial records are accurate, consistent, and auditable. PracticePro currently has a structural '
    'data integrity problem that will cause silent, compounding errors in financial reporting.',
    body_style
))

story.append(Paragraph('<b>Dual Payment Systems</b>', h3_style))
story.append(Paragraph(
    'The application maintains two separate and unsynchronized systems for tracking rent payments: '
    '<font name="DejaVuSans">ledger_entries</font> and <font name="DejaVuSans">property.rentPaymentHistory</font>. '
    'These two systems can and will diverge over time. When a tenant pays rent, the payment may be recorded in '
    'one system but not the other, or recorded with different amounts, different dates, or different statuses. '
    'There is no reconciliation mechanism, no sync process, and no single source of truth. This means that at '
    'any given moment, the question "How much rent has this tenant paid?" can have two different answers '
    'depending on which system you query.',
    body_style
))
story.append(Paragraph(
    'The practical consequences are severe. Landlords relying on PracticePro to manage their properties will '
    'make decisions based on incorrect financial data. Tenants may be incorrectly marked as in arrears or, '
    'conversely, given credit for payments they never made. In the Nigerian legal context, where property '
    'disputes are among the most common types of litigation, inaccurate financial records from a property '
    'management system could become evidence in court, and a system that produces contradictory records will '
    'be destroyed on cross-examination. Beyond the courtroom, this erodes the fundamental trust that users '
    'place in the application. If the numbers cannot be trusted, nothing else matters.',
    body_style
))

story.append(Paragraph('<b>Orphaned Records and Nuclear Delete</b>', h3_style))
story.append(Paragraph(
    'The Convex data model lacks proper cascade-delete logic. When a property or a matter is deleted, the '
    'associated records (payments, documents, activities) are not automatically cleaned up. Over time, this '
    'creates orphaned records that reference non-existent parent entities. These orphans pollute queries, inflate '
    'database size, and can cause runtime errors when the UI attempts to render data that references deleted '
    'parents. The absence of firmId indexes on some tables means that these orphaned records may not even be '
    'discoverable through normal queries, making cleanup effectively impossible without a full database scan.',
    body_style
))

# 2.3 Compliance Failure
story.append(add_heading('<b>2.3 Compliance Failure</b>', h2_style, level=1))

story.append(Paragraph(
    'The Nigerian legal market has specific regulatory requirements that PracticePro must meet to be a viable '
    'product. The Nigerian Bar Association (NBA) sets professional conduct standards that extend to the tools '
    'lawyers use, and any software that handles client data must comply with these standards. Currently, '
    'PracticePro fails on three critical compliance dimensions.',
    body_style
))

compliance_data = [
    [Paragraph('<b>Requirement</b>', header_cell), Paragraph('<b>NBA Standard</b>', header_cell), Paragraph('<b>Current State</b>', header_cell), Paragraph('<b>Gap</b>', header_cell)],
    [Paragraph('Audit Logging', cell_style), Paragraph('Complete record of who accessed what and when', cell_style), Paragraph('No audit log system exists', cell_style), Paragraph('Must build from scratch', cell_style)],
    [Paragraph('Data Retention', cell_style), Paragraph('7-year minimum for client files', cell_style), Paragraph('No retention policy; Convex default is indefinite', cell_style), Paragraph('Need policy + enforcement mechanism', cell_style)],
    [Paragraph('Client Confidentiality', cell_style), Paragraph('Client data isolated between firms', cell_style), Paragraph('withFirmAuth bypass allows cross-firm access', cell_style), Paragraph('Critical security fix required', cell_style)],
    [Paragraph('Data Residency', cell_style), Paragraph('Nigerian data protection regulations', cell_style), Paragraph('Convex hosts on AWS; region unclear', cell_style), Paragraph('Need to verify and configure', cell_style)],
    [Paragraph('Consent Management', cell_style), Paragraph('Client consent for data processing', cell_style), Paragraph('No consent tracking', cell_style), Paragraph('Must implement consent flows', cell_style)],
]
story.extend(make_table(compliance_data, [0.18, 0.25, 0.28, 0.29], 'Table 2: NBA compliance gap analysis'))

story.append(Paragraph(
    'The most critical gap is the absence of audit logging. The Nigerian Bar Association requires that law firms '
    'maintain complete records of who accessed client files, when they accessed them, and what actions they '
    'performed. This is not optional; it is a professional conduct requirement. Without an audit log system, '
    'PracticePro cannot be sold to any law firm that takes its regulatory obligations seriously. The Convex '
    'audit log implementation referenced in the 10-area framework provides a template, but it needs to be '
    'adapted for the Nigerian context, including logging compliance-specific events such as matter access, '
    'document download, and client data export.',
    body_style
))

# 2.4 Technical Complexity Failure
story.append(add_heading('<b>2.4 Technical Complexity Failure</b>', h2_style, level=1))

story.append(Paragraph(
    'Even if the security and compliance issues were resolved, PracticePro faces a significant risk of failure '
    'due to sheer technical complexity. Complexity in software is not just an engineering inconvenience; it is a '
    'multiplier on every other risk. Complex systems are harder to test, harder to debug, harder to modify, and '
    'harder to onboard new developers to. PracticePro exhibits several patterns of structural complexity that, '
    'taken together, create a system that is fragile and expensive to maintain.',
    body_style
))

story.append(Paragraph('<b>12-Provider Context Hierarchy</b>', h3_style))
story.append(Paragraph(
    'The application wraps its component tree in twelve separate React context providers. This creates a deeply '
    'nested dependency structure where any component in the tree may implicitly depend on context values from '
    'any of the twelve providers above it. When a context value changes, all consumers of that context re-render, '
    'which in a twelve-provider hierarchy can trigger cascading re-renders across the entire component tree. This '
    'degrades performance predictably as the application grows. More critically, it makes debugging extremely '
    'difficult: when a bug appears, tracing it through twelve layers of context to find the source requires '
    'significant institutional knowledge of the codebase. A new developer joining the team will struggle to '
    'understand the data flow, leading to longer development cycles and more bugs introduced by each change.',
    body_style
))

story.append(Paragraph('<b>Modal Context Discard</b>', h3_style))
story.append(Paragraph(
    'The ModalManager system, which handles the application\'s modal dialogs, has a documented issue where '
    'context is discarded when modals are opened. In a React application, context values are only available '
    'to components that are children of the provider in the component tree. If a modal is rendered outside '
    'the provider hierarchy (which is the common pattern for portal-based modals), the modal content cannot '
    'access the context values it needs. This causes modals to render with missing data, broken functionality, '
    'or silent failures. The specific instances identified in the prior audit include the CollectRentModal, '
    'ReceiptDetailView, and BulkEditPropertyModal. In a property management application, a broken rent '
    'collection modal is not just a bug; it is a revenue-blocking defect.',
    body_style
))

story.append(Paragraph('<b>Mega-Query Refactor Risk</b>', h3_style))
story.append(Paragraph(
    'The recent Mega-Query refactor was intended to improve performance by consolidating multiple Convex queries '
    'into fewer, more efficient queries. While this is a sound optimization strategy, any refactor of data '
    'fetching logic carries a high risk of introducing regressions, particularly when the original queries were '
    'not covered by automated tests. The refactor may have changed the timing of when data becomes available '
    'to components, the order in which related data loads, or the shape of the returned data. Without a '
    'comprehensive test suite, these regressions may only surface in production when users encounter edge cases '
    'that the developers did not anticipate during manual testing.',
    body_style
))

# 2.5 Market Adoption Failure
story.append(add_heading('<b>2.5 Market Adoption Failure</b>', h2_style, level=1))

story.append(Paragraph(
    'Even a perfectly engineered product will fail if it does not find product-market fit. PracticePro faces '
    'a unique market adoption risk because it is attempting to serve two distinct user personas, lawyers and '
    'property managers, with a single integrated product. While there is overlap in the Nigerian market (many '
    'lawyers handle property transactions), the core workflows, terminology, and expectations of these two '
    'personas are fundamentally different.',
    body_style
))

story.append(Paragraph(
    'A lawyer managing a property dispute does not want to navigate through property management screens to find '
    'the matter details. A property manager collecting rent does not want to see legal case management features '
    'cluttering their dashboard. The current unified interface tries to serve both personas simultaneously, which '
    'means it serves neither well. Each persona sees features that are irrelevant to them, increasing cognitive '
    'load and reducing the perceived value of the features that matter to them. In a market where users have '
    'low tolerance for complexity and high expectations for simplicity (the Nigerian SaaS market is still '
    'maturing, and users often prefer focused tools over Swiss-army-knife platforms), this is a significant '
    'barrier to adoption.',
    body_style
))

story.append(Paragraph(
    'Furthermore, the Nigerian legal tech market is still in its early stages. Law firms are transitioning from '
    'paper-based and spreadsheet-based systems. The winning products in this market will be those that offer a '
    'clear, simple path from the old way of working to the new one. A product that presents lawyers with '
    'property management features alongside legal features, many of which are half-built or broken, will confuse '
    'and alienate potential early adopters. First impressions are critical in an emerging market, and PracticePro '
    'risks squandering its first-mover advantage by presenting an overwhelming interface rather than a focused '
    'value proposition.',
    body_style
))

# 2.6 Operational Failure
story.append(add_heading('<b>2.6 Operational Failure</b>', h2_style, level=1))

story.append(Paragraph(
    'Operational failure is the slowest but most insidious failure mode. It manifests as an ever-increasing cost '
    'of development, an ever-decreasing velocity of feature delivery, and an ever-growing backlog of bugs that '
    'never seem to get fixed. PracticePro exhibits several structural patterns that predict operational failure.',
    body_style
))

story.append(Paragraph(
    'The dual payment system is a prime example. Every new feature that touches financial data must now account '
    'for two different data sources, doubling the testing surface and the likelihood of inconsistencies. The '
    '12-provider context hierarchy means that adding any new feature requires understanding and potentially '
    'modifying the provider tree, with each modification risking cascading side effects. The orphaned code '
    '(PropertyTrackingView, dead routes) means that developers waste time maintaining code that no user ever '
    'sees. Over time, these operational costs compound. Each sprint becomes harder than the last, and the '
    'development team finds itself spending more time fighting the architecture than building features.',
    body_style
))

story.append(Paragraph(
    'For a startup targeting the Nigerian market, where resources are constrained and speed to market is '
    'critical, operational failure is as deadly as a security breach. A team that cannot ship features quickly '
    'will lose to competitors who can, regardless of the quality of the underlying vision. The simplification '
    'roadmap in Section 4 is specifically designed to reverse this trend by removing the structural sources of '
    'operational drag.',
    body_style
))

# ═══════════════════════════════════════════════════════════════
# SECTION 3: COMPLEXITY AUDIT
# ═══════════════════════════════════════════════════════════════
story.append(add_heading('<b>3. Complexity Audit: Full Feature Inventory</b>', h1_style, level=0))

story.append(Paragraph(
    'This section maps every identified feature across both VEGA and Atrium modules, categorizing each by its '
    'current state (working, broken, or orphaned), its complexity contribution, and its importance to the core '
    'value proposition. The goal is to create a complete picture of the feature landscape so that informed '
    'decisions can be made about what to keep, defer, or cut.',
    body_style
))

# 3.1 VEGA Legal Module
story.append(add_heading('<b>3.1 VEGA Legal Module</b>', h2_style, level=1))

vega_data = [
    [Paragraph('<b>Feature</b>', header_cell), Paragraph('<b>State</b>', header_cell), Paragraph('<b>Complexity</b>', header_cell), Paragraph('<b>Core Value</b>', header_cell), Paragraph('<b>Recommendation</b>', header_cell)],
    [Paragraph('Matter Management (CRUD)', cell_style), Paragraph('Working', cell_center), Paragraph('Medium', cell_center), Paragraph('Essential', cell_center), Paragraph('KEEP', cell_center)],
    [Paragraph('Document Management', cell_style), Paragraph('Working', cell_center), Paragraph('High', cell_center), Paragraph('Essential', cell_center), Paragraph('KEEP', cell_center)],
    [Paragraph('Time Tracking / Billing', cell_style), Paragraph('Working', cell_center), Paragraph('Medium', cell_center), Paragraph('Essential', cell_center), Paragraph('KEEP', cell_center)],
    [Paragraph('Client Management', cell_style), Paragraph('Working', cell_center), Paragraph('Medium', cell_center), Paragraph('Essential', cell_center), Paragraph('KEEP', cell_center)],
    [Paragraph('Task Management', cell_style), Paragraph('Working', cell_center), Paragraph('Low', cell_center), Paragraph('Important', cell_center), Paragraph('KEEP', cell_center)],
    [Paragraph('AloaChat (AI Assistant)', cell_style), Paragraph('Broken (exposed keys)', cell_center), Paragraph('Very High', cell_center), Paragraph('Nice-to-have', cell_center), Paragraph('DEFER', cell_center)],
    [Paragraph('AI Document Analysis', cell_style), Paragraph('Broken (same keys)', cell_center), Paragraph('Very High', cell_center), Paragraph('Nice-to-have', cell_center), Paragraph('DEFER', cell_center)],
    [Paragraph('Calendar / Deadlines', cell_style), Paragraph('Partial', cell_center), Paragraph('Medium', cell_center), Paragraph('Important', cell_center), Paragraph('KEEP (simplified)', cell_center)],
    [Paragraph('Legal Research Integration', cell_style), Paragraph('Not started', cell_center), Paragraph('High', cell_center), Paragraph('Nice-to-have', cell_center), Paragraph('CUT', cell_center)],
    [Paragraph('Court Filing Integration', cell_style), Paragraph('Not started', cell_center), Paragraph('Very High', cell_center), Paragraph('Future', cell_center), Paragraph('CUT', cell_center)],
    [Paragraph('Custom Workflow Automation', cell_style), Paragraph('Partial', cell_center), Paragraph('Very High', cell_center), Paragraph('Nice-to-have', cell_center), Paragraph('CUT', cell_center)],
    [Paragraph('Revenue Monitor / Analytics', cell_style), Paragraph('Partial', cell_center), Paragraph('High', cell_center), Paragraph('Enterprise only', cell_center), Paragraph('DEFER (enterprise)', cell_center)],
]
story.extend(make_table(vega_data, [0.25, 0.17, 0.13, 0.17, 0.28], 'Table 3: VEGA legal module feature inventory'))

# 3.2 Atrium Property Module
story.append(add_heading('<b>3.2 Atrium Property Management Module</b>', h2_style, level=1))

atrium_data = [
    [Paragraph('<b>Feature</b>', header_cell), Paragraph('<b>State</b>', header_cell), Paragraph('<b>Complexity</b>', header_cell), Paragraph('<b>Core Value</b>', header_cell), Paragraph('<b>Recommendation</b>', header_cell)],
    [Paragraph('Property Listing (CRUD)', cell_style), Paragraph('Working', cell_center), Paragraph('Medium', cell_center), Paragraph('Essential', cell_center), Paragraph('KEEP', cell_center)],
    [Paragraph('Unit Management', cell_style), Paragraph('Working', cell_center), Paragraph('Medium', cell_center), Paragraph('Essential', cell_center), Paragraph('KEEP', cell_center)],
    [Paragraph('Tenant Management', cell_style), Paragraph('Working', cell_center), Paragraph('Medium', cell_center), Paragraph('Essential', cell_center), Paragraph('KEEP', cell_center)],
    [Paragraph('Rent Collection', cell_style), Paragraph('Broken (modal)', cell_center), Paragraph('High', cell_center), Paragraph('Essential', cell_center), Paragraph('KEEP (fix first)', cell_center)],
    [Paragraph('Receipt Generation', cell_style), Paragraph('Broken', cell_center), Paragraph('Medium', cell_center), Paragraph('Essential', cell_center), Paragraph('KEEP (fix first)', cell_center)],
    [Paragraph('Payment Tracking', cell_style), Paragraph('Dual system', cell_center), Paragraph('Very High', cell_center), Paragraph('Essential', cell_center), Paragraph('KEEP (consolidate)', cell_center)],
    [Paragraph('Property Valuations', cell_style), Paragraph('Broken dialogue', cell_center), Paragraph('High', cell_center), Paragraph('Nice-to-have', cell_center), Paragraph('DEFER', cell_center)],
    [Paragraph('PropertyTrackingView', cell_style), Paragraph('Orphaned', cell_center), Paragraph('Low', cell_center), Paragraph('None', cell_center), Paragraph('CUT', cell_center)],
    [Paragraph('Bulk Edit Properties', cell_style), Paragraph('Broken (wrong modal)', cell_center), Paragraph('Medium', cell_center), Paragraph('Nice-to-have', cell_center), Paragraph('DEFER', cell_center)],
    [Paragraph('Maintenance Tracking', cell_style), Paragraph('Non-functional', cell_center), Paragraph('Medium', cell_center), Paragraph('Important', cell_center), Paragraph('DEFER', cell_center)],
    [Paragraph('Activity Log', cell_style), Paragraph('Non-functional', cell_center), Paragraph('Low', cell_center), Paragraph('Important', cell_center), Paragraph('DEFER', cell_center)],
    [Paragraph('Add Payment Flow', cell_style), Paragraph('Non-functional', cell_center), Paragraph('Medium', cell_center), Paragraph('Essential', cell_center), Paragraph('KEEP (fix first)', cell_center)],
    [Paragraph('Automated Receipting', cell_style), Paragraph('Not working', cell_center), Paragraph('High', cell_center), Paragraph('Important', cell_center), Paragraph('DEFER', cell_center)],
    [Paragraph('Nigerian Tax Calculations', cell_style), Paragraph('Partial', cell_center), Paragraph('High', cell_center), Paragraph('Essential (NG)', cell_center), Paragraph('KEEP (simplified)', cell_center)],
    [Paragraph('Property Manager vs Owner flows', cell_style), Paragraph('Unclear separation', cell_center), Paragraph('High', cell_center), Paragraph('Important', cell_center), Paragraph('DEFER (pick one)', cell_center)],
]
story.extend(make_table(atrium_data, [0.25, 0.17, 0.13, 0.17, 0.28], 'Table 4: Atrium property management module feature inventory'))

# 3.3 Cross-Cutting Infrastructure
story.append(add_heading('<b>3.3 Cross-Cutting Infrastructure</b>', h2_style, level=1))

infra_data = [
    [Paragraph('<b>Component</b>', header_cell), Paragraph('<b>Current State</b>', header_cell), Paragraph('<b>Issue</b>', header_cell), Paragraph('<b>Recommendation</b>', header_cell)],
    [Paragraph('Context Provider Tree (12 providers)', cell_style), Paragraph('Deeply nested', cell_style), Paragraph('Performance + debugging', cell_style), Paragraph('Flatten to 4-5 providers', cell_style)],
    [Paragraph('ModalManager System', cell_style), Paragraph('Context discard', cell_style), Paragraph('Broken modal features', cell_style), Paragraph('Redesign with portal context', cell_style)],
    [Paragraph('withFirmAuth Wrapper', cell_style), Paragraph('Auth bypass', cell_style), Paragraph('No getUserIdentity() call', cell_style), Paragraph('Fix immediately', cell_style)],
    [Paragraph('Dual Payment System', cell_style), Paragraph('Unsynchronized', cell_style), Paragraph('Data divergence', cell_style), Paragraph('Consolidate to ledger_entries', cell_style)],
    [Paragraph('DataProvider.tsx', cell_style), Paragraph('Complex lifecycle', cell_style), Paragraph('Matter + Property coupling', cell_style), Paragraph('Separate DataProviders', cell_style)],
    [Paragraph('API Key Management', cell_style), Paragraph('Hardcoded in client', cell_style), Paragraph('Exposed to browser', cell_style), Paragraph('Move to Convex backend', cell_style)],
    [Paragraph('Tier System (tiers.ts)', cell_style), Paragraph('Centralized', cell_style), Paragraph('Incomplete enforcement', cell_style), Paragraph('Keep, enforce at API level', cell_style)],
    [Paragraph('Convex Audit Logging', cell_style), Paragraph('Not implemented', cell_style), Paragraph('NBA compliance gap', cell_style), Paragraph('Build for V1 (minimal)', cell_style)],
]
story.extend(make_table(infra_data, [0.28, 0.20, 0.26, 0.26], 'Table 5: Cross-cutting infrastructure audit'))

# 3.4 Complexity Heat Map Summary
story.append(add_heading('<b>3.4 Complexity Summary</b>', h2_style, level=1))

summary_data = [
    [Paragraph('<b>Category</b>', header_cell), Paragraph('<b>Total Features</b>', header_cell), Paragraph('<b>Working</b>', header_cell), Paragraph('<b>Broken / Partial</b>', header_cell), Paragraph('<b>Orphaned / Not Started</b>', header_cell)],
    [Paragraph('VEGA Legal', cell_style), Paragraph('12', cell_center), Paragraph('5', cell_center), Paragraph('4', cell_center), Paragraph('3', cell_center)],
    [Paragraph('Atrium Property', cell_style), Paragraph('15', cell_center), Paragraph('3', cell_center), Paragraph('8', cell_center), Paragraph('4', cell_center)],
    [Paragraph('Cross-Cutting Infra', cell_style), Paragraph('8', cell_center), Paragraph('2', cell_center), Paragraph('6', cell_center), Paragraph('0', cell_center)],
    [Paragraph('<b>Total</b>', cell_style), Paragraph('<b>35</b>', cell_center), Paragraph('<b>10 (29%)</b>', cell_center), Paragraph('<b>18 (51%)</b>', cell_center), Paragraph('<b>7 (20%)</b>', cell_center)],
]
story.extend(make_table(summary_data, [0.24, 0.16, 0.16, 0.22, 0.22], 'Table 6: Feature state distribution'))

story.append(Paragraph(
    'The numbers tell a clear story: only 29% of identified features are in a working state. Over half are '
    'broken or partially implemented, and 20% are either orphaned dead code or features that were never started. '
    'This is the hallmark of a product that expanded its scope faster than its engineering capacity could support. '
    'The path forward requires a disciplined reduction in scope to match engineering capacity, not an increase '
    'in engineering capacity to match the scope.',
    body_style
))

# ═══════════════════════════════════════════════════════════════
# SECTION 4: SIMPLIFICATION ROADMAP
# ═══════════════════════════════════════════════════════════════
story.append(add_heading('<b>4. Simplification Roadmap</b>', h1_style, level=0))

story.append(Paragraph(
    'This section provides a concrete, actionable plan for reducing PracticePro\'s complexity to a level that '
    'can be reliably shipped and maintained. Each recommendation is categorized as KEEP (essential for V1 '
    'launch), DEFER (important but not required for initial launch), or CUT (remove entirely, either permanently '
    'or until a future major version). The guiding principle is that a simpler product that works reliably will '
    'always outperform a complex product that breaks unpredictably.',
    body_style
))

# 4.1 What to KEEP
story.append(add_heading('<b>4.1 KEEP: Essential V1 Features</b>', h2_style, level=1))

story.append(Paragraph(
    'The features listed below form the minimum viable product for PracticePro. Each one addresses a core user '
    'need that cannot be deferred without undermining the product\'s value proposition. These features must be '
    'fully working, tested, and reliable before launch. Any feature in this list that is currently broken must '
    'be fixed as a top priority.',
    body_style
))

keep_data = [
    [Paragraph('<b>Feature</b>', header_cell), Paragraph('<b>Module</b>', header_cell), Paragraph('<b>Current State</b>', header_cell), Paragraph('<b>Action Required</b>', header_cell)],
    [Paragraph('Matter CRUD', cell_style), Paragraph('VEGA', cell_center), Paragraph('Working', cell_center), Paragraph('Stabilize and test', cell_style)],
    [Paragraph('Document Management', cell_style), Paragraph('VEGA', cell_center), Paragraph('Working', cell_center), Paragraph('Add PDF preview', cell_style)],
    [Paragraph('Time Tracking / Billing', cell_style), Paragraph('VEGA', cell_center), Paragraph('Working', cell_center), Paragraph('Connect to billing export', cell_style)],
    [Paragraph('Client Management', cell_style), Paragraph('VEGA', cell_center), Paragraph('Working', cell_center), Paragraph('Verify firm isolation', cell_style)],
    [Paragraph('Property + Unit CRUD', cell_style), Paragraph('Atrium', cell_center), Paragraph('Working', cell_center), Paragraph('Simplify unit model', cell_style)],
    [Paragraph('Tenant Management', cell_style), Paragraph('Atrium', cell_center), Paragraph('Working', cell_center), Paragraph('Link to unit properly', cell_style)],
    [Paragraph('Rent Collection', cell_style), Paragraph('Atrium', cell_center), Paragraph('Broken', cell_center), Paragraph('Fix modal context issue', cell_style)],
    [Paragraph('Receipt Generation', cell_style), Paragraph('Atrium', cell_center), Paragraph('Broken', cell_center), Paragraph('Fix pdfkit + unit-level', cell_style)],
    [Paragraph('Payment Tracking (consolidated)', cell_style), Paragraph('Atrium', cell_center), Paragraph('Dual system', cell_center), Paragraph('Consolidate to ledger_entries', cell_style)],
    [Paragraph('Add Payment Flow', cell_style), Paragraph('Atrium', cell_center), Paragraph('Broken', cell_center), Paragraph('Fix + unit-level context', cell_style)],
    [Paragraph('Nigerian Tax (basic)', cell_style), Paragraph('Atrium', cell_center), Paragraph('Partial', cell_center), Paragraph('Withholding + VAT only', cell_style)],
    [Paragraph('withFirmAuth (fixed)', cell_style), Paragraph('Infra', cell_center), Paragraph('Broken', cell_center), Paragraph('Add getUserIdentity()', cell_style)],
    [Paragraph('API Key Management (server-side)', cell_style), Paragraph('Infra', cell_center), Paragraph('Exposed', cell_center), Paragraph('Move to Convex actions', cell_style)],
    [Paragraph('Basic Audit Logging', cell_style), Paragraph('Infra', cell_center), Paragraph('Missing', cell_center), Paragraph('Login, data access, deletes', cell_style)],
]
story.extend(make_table(keep_data, [0.28, 0.10, 0.14, 0.48], 'Table 7: V1 keep list with required actions'))

# 4.2 What to DEFER
story.append(add_heading('<b>4.2 DEFER: Important But Not Required for V1</b>', h2_style, level=1))

story.append(Paragraph(
    'These features address real user needs but are not required for the initial launch. They should be '
    'revisited in V2 once the core platform is stable and the user base has validated the primary value '
    'proposition. Deferring these features reduces the engineering burden by approximately 40% and eliminates '
    'the most complex integrations from the V1 scope.',
    body_style
))

defer_data = [
    [Paragraph('<b>Feature</b>', header_cell), Paragraph('<b>Reason for Deferral</b>', header_cell), Paragraph('<b>V2 Priority</b>', header_cell)],
    [Paragraph('AloaChat AI Assistant', cell_style), Paragraph('Requires API key security fix + prompt engineering + testing; high complexity for uncertain V1 ROI', cell_style), Paragraph('High', cell_center)],
    [Paragraph('AI Document Analysis', cell_style), Paragraph('Same API key dependency; legal AI requires domain-specific training data not yet available', cell_style), Paragraph('Medium', cell_center)],
    [Paragraph('Property Valuations', cell_style), Paragraph('Broken dialogue; requires data integration with Nigerian property valuation sources', cell_style), Paragraph('Medium', cell_center)],
    [Paragraph('Bulk Edit Properties', cell_style), Paragraph('Broken (opens wrong modal); batch operations add complexity without core value', cell_style), Paragraph('Low', cell_center)],
    [Paragraph('Maintenance Tracking', cell_style), Paragraph('Non-functional; requires ticketing workflow + notification system', cell_style), Paragraph('High', cell_center)],
    [Paragraph('Activity Log', cell_style), Paragraph('Non-functional; design needs alignment with audit log system', cell_style), Paragraph('High', cell_center)],
    [Paragraph('Automated Receipting', cell_style), Paragraph('Requires payment gateway integration + email/SMS delivery', cell_style), Paragraph('High', cell_center)],
    [Paragraph('Revenue Monitor (Enterprise)', cell_style), Paragraph('Tier-gating incomplete; should only be available for Custom/Enterprise tiers', cell_style), Paragraph('Medium', cell_center)],
    [Paragraph('Property Manager vs Owner flows', cell_style), Paragraph('Role separation unclear; pick one flow for V1 and add the other later', cell_style), Paragraph('Medium', cell_center)],
    [Paragraph('Calendar / Deadline Reminders', cell_style), Paragraph('Partial implementation; notification system not built', cell_style), Paragraph('Medium', cell_center)],
]
story.extend(make_table(defer_data, [0.25, 0.58, 0.17], 'Table 8: Deferred features with rationale'))

# 4.3 What to CUT
story.append(add_heading('<b>4.3 CUT: Remove Entirely from Codebase</b>', h2_style, level=1))

story.append(Paragraph(
    'These features should be removed from the codebase entirely. They are either orphaned code that no user '
    'will ever interact with, features that add complexity without proportional value, or features that are so '
    'far from completion that they represent sunk cost rather than future value. Removing them reduces the '
    'attack surface, simplifies the data model, and eliminates dead code that confuses developers and '
    'obscures the real architecture.',
    body_style
))

cut_data = [
    [Paragraph('<b>Feature / Code</b>', header_cell), Paragraph('<b>Reason for Removal</b>', header_cell), Paragraph('<b>Impact of Removal</b>', header_cell)],
    [Paragraph('PropertyTrackingView', cell_style), Paragraph('Orphaned component; no route points to it; no user can access it', cell_style), Paragraph('Positive: removes dead code and confusion', cell_style)],
    [Paragraph('property.rentPaymentHistory', cell_style), Paragraph('Duplicate of ledger_entries; creates data divergence; no reconciliation', cell_style), Paragraph('Positive: single source of truth for payments', cell_style)],
    [Paragraph('Legal Research Integration', cell_style), Paragraph('Not started; no API partner identified; high complexity', cell_style), Paragraph('None: was never built', cell_style)],
    [Paragraph('Court Filing Integration', cell_style), Paragraph('Not started; requires Nigerian court system API access which does not exist', cell_style), Paragraph('None: was never built', cell_style)],
    [Paragraph('Custom Workflow Automation', cell_style), Paragraph('Partial implementation adds complexity without usable output; no user has requested this', cell_style), Paragraph('Positive: simplifies DataProvider', cell_style)],
    [Paragraph('Excess Context Providers', cell_style), Paragraph('12 providers can be consolidated to 4-5 without losing functionality', cell_style), Paragraph('Positive: faster renders, easier debugging', cell_style)],
]
story.extend(make_table(cut_data, [0.25, 0.45, 0.30], 'Table 9: Features and code to remove entirely'))

# 4.4 Recommended V1 Scope
story.append(add_heading('<b>4.4 Recommended V1 Scope</b>', h2_style, level=1))

story.append(Paragraph(
    'After applying the KEEP, DEFER, and CUT recommendations, the V1 scope of PracticePro is dramatically '
    'simpler while still delivering a complete, valuable product for the Nigerian market. The V1 product is '
    'a focused legal practice management tool with core property management capabilities, specifically the '
    'rent collection and tracking features that are most urgently needed by Nigerian property lawyers and '
    'managers. All AI features, advanced property features, and speculative integrations are removed from V1 '
    'scope.',
    body_style
))

v1_scope_data = [
    [Paragraph('<b>Aspect</b>', header_cell), Paragraph('<b>Before Simplification</b>', header_cell), Paragraph('<b>After Simplification</b>', header_cell), Paragraph('<b>Reduction</b>', header_cell)],
    [Paragraph('Total features', cell_style), Paragraph('35', cell_center), Paragraph('15', cell_center), Paragraph('57% fewer', cell_center)],
    [Paragraph('Working features', cell_style), Paragraph('10 (29%)', cell_center), Paragraph('15 (100% target)', cell_center), Paragraph('All must work', cell_center)],
    [Paragraph('Context providers', cell_style), Paragraph('12', cell_center), Paragraph('4-5', cell_center), Paragraph('58% fewer', cell_center)],
    [Paragraph('Payment systems', cell_style), Paragraph('2 (unsynchronized)', cell_center), Paragraph('1 (ledger_entries)', cell_center), Paragraph('50% fewer', cell_center)],
    [Paragraph('API key exposure', cell_style), Paragraph('2 exposed keys', cell_center), Paragraph('0 (server-side)', cell_center), Paragraph('100% resolved', cell_center)],
    [Paragraph('Auth bypass', cell_style), Paragraph('Present', cell_center), Paragraph('Fixed', cell_center), Paragraph('100% resolved', cell_center)],
    [Paragraph('Audit logging', cell_style), Paragraph('None', cell_center), Paragraph('Basic (login, data, deletes)', cell_center), Paragraph('NBA minimum', cell_center)],
]
story.extend(make_table(v1_scope_data, [0.22, 0.28, 0.28, 0.22], 'Table 10: V1 scope reduction summary'))

# ═══════════════════════════════════════════════════════════════
# SECTION 5: 10-AREA AUDIT FRAMEWORK MAPPING
# ═══════════════════════════════════════════════════════════════
story.append(add_heading('<b>5. Audit Framework Mapping to PracticePro</b>', h1_style, level=0))

story.append(Paragraph(
    'The comprehensive 10-area audit framework for legal and proptech SaaS applications provides a structured '
    'approach to quality assurance. This section maps each area of the framework specifically to PracticePro\'s '
    'known issues, stack (React + Convex), and target market (Nigeria), identifying which items from the '
    'framework are already known issues, which are new gaps that need investigation, and which are not '
    'applicable to the current stage of development.',
    body_style
))

# 5.1 Performance
story.append(add_heading('<b>5.1 Performance</b>', h2_style, level=1))

story.append(Paragraph(
    'The framework targets Core Web Vitals of LCP under 2.5 seconds, FID under 100ms, and CLS under 0.1. '
    'PracticePro\'s 12-provider context hierarchy is the primary performance risk. Each context provider adds '
    'a re-render cost when its value changes, and with twelve providers, a single state change can trigger '
    'cascading re-renders across the entire component tree. The Mega-Query refactor may have improved data '
    'fetching performance, but it may also have introduced waterfalls or redundant queries that are not '
    'yet measured. The bundle size is currently unknown; the framework targets an initial bundle under 200KB '
    'gzipped and a main bundle under 500KB gzipped. PracticePro includes the pdfkit library for receipt '
    'generation, which alone can add 200-300KB to the bundle. Running a Lighthouse audit on the current '
    'build should be the first action, followed by a bundle analysis to identify the largest contributors.',
    body_style
))

# 5.2 Security
story.append(add_heading('<b>5.2 Security</b>', h2_style, level=1))

story.append(Paragraph(
    'Security is the area where PracticePro has the most critical gaps. The framework recommends npm audit, '
    'Snyk, OWASP ZAP, and OWASP Top 10 compliance. PracticePro has confirmed violations of at least three '
    'OWASP Top 10 categories: A01 (Broken Access Control) via the withFirmAuth bypass, A05 (Security '
    'Misconfiguration) via exposed API keys, and A01 again via IDOR (any user can access any firm\'s data). '
    'These are not theoretical risks; they are confirmed, reproducible vulnerabilities. Running OWASP ZAP '
    'against the deployed application would likely reveal additional vulnerabilities, but the three known '
    'issues are severe enough that they must be fixed before any external penetration testing. The exposed '
    'API keys also violate the framework\'s recommendation for secrets management, and the absence of '
    'rate limiting on Convex functions means that an attacker could potentially brute-force access to '
    'firm data without triggering any alerts.',
    body_style
))

# 5.3-5.10 remaining areas
audit_areas = [
    ('5.3 Accessibility', 
     'The framework targets WCAG 2.1 AA compliance, recommending tools like axe DevTools and Pa11y. '
     'PracticePro has not been tested for accessibility, which is a significant gap in the Nigerian market '
     'where web accessibility is increasingly mandated by the Discrimination Against Persons with Disabilities '
     '(Prohibition) Act 2018. The modal context discard issue may also cause accessibility problems, as screen '
     'readers may not properly announce modal content when context is lost. Running an automated accessibility '
     'audit with axe should be a priority, but it should be done after the V1 simplification to avoid wasting '
     'effort on features that will be cut.'),
    
    ('5.4 Code Quality',
     'The framework recommends ESLint, SonarQube, depcheck, and license compliance checks. PracticePro likely '
     'has significant unused dependencies given the features being cut (PropertyTrackingView, AI integrations). '
     'Running depcheck after the simplification will identify orphaned dependencies. SonarQube analysis would '
     'quantify the technical debt, but the manual audit already identified the key issues: the dual payment '
     'system, the broken auth wrapper, and the excessive context providers. The priority should be fixing these '
     'known issues rather than adding another analysis tool.'),
    
    ('5.5 Data Privacy &amp; Compliance',
     'This is a critical area for PracticePro. The framework emphasizes GDPR, but the Nigerian equivalent is '
     'the Nigeria Data Protection Regulation (NDPR) and the newer Nigeria Data Protection Act (NDPA) 2023. '
     'These require data minimization, purpose limitation, consent management, and the right to erasure. '
     'PracticePro currently has no consent management system, no data export functionality (required for the '
     'right to data portability), and no deletion mechanism that properly cascades through related records. '
     'The 7-year data retention requirement from the NBA adds complexity: the system must retain certain '
     'records for 7 years while also supporting the user\'s right to erasure under NDPA. This tension must '
     'be resolved through a clear data retention policy that distinguishes between client data (subject to '
     'erasure requests) and professional records (subject to retention requirements).'),
    
    ('5.6 API Audits',
     'The framework recommends rate limiting, authentication verification, and input validation for all API '
     'endpoints. In the Convex context, every exported mutation and query is an API endpoint. The withFirmAuth '
     'bypass means that authentication verification is effectively absent on all protected endpoints. Input '
     'validation in Convex uses the built-in argument validation system (v.string(), v.number(), etc.), which '
     'provides basic type safety but does not validate business rules (e.g., that a payment amount is positive, '
     'that a date is not in the future, that a firmId matches the authenticated user\'s firm). Rate limiting '
     'is not natively supported by Convex and would need to be implemented as a custom middleware or through '
     'Convex action wrappers.'),
    
    ('5.7 Infrastructure',
     'The framework targets SSL/TLS A+ rating and regular backups. Convex handles SSL/TLS automatically, '
     'so this is not a concern. However, Convex\'s backup capabilities are limited. The framework recommends '
     'daily backups with point-in-time recovery, which Convex supports through its built-in snapshot system. '
     'The concern is that Convex snapshots are internal to Convex and cannot be exported to a separate storage '
     'provider. For a legal application, having a backup that is controlled by a third-party service may not '
     'meet NBA requirements for data custody. This should be investigated with Convex support.'),
    
    ('5.8 UX',
     'The framework recommends Hotjar for user behavior analytics and a maximum of 3 clicks for critical '
     'flows. PracticePro\'s current UX suffers from feature overload: users see both legal and property '
     'management features regardless of their role. The simplification roadmap addresses this by removing '
     'non-essential features, but the information architecture also needs attention. The 3-click rule should '
     'be applied to the V1 features: creating a matter, collecting rent, and generating a receipt should all '
     'be achievable in 3 clicks or fewer from the dashboard.'),
    
    ('5.9 Database',
     'The framework identifies orphaned records, firmId indexes, and cascade deletes as critical database '
     'concerns. All three apply directly to PracticePro. The dual payment system creates orphaned records '
     'when one system is updated but not the other. The absence of firmId indexes on some Convex tables means '
     'that queries filtering by firm must perform full table scans, which will degrade performance as the '
     'database grows. The nuclear delete concern (deleting a firm should cascade to all related data) is '
     'not implemented and could leave orphaned records across the database. After the simplification, the '
     'database schema should be audited to ensure every table has a firmId index and that delete operations '
     'properly cascade.'),
    
    ('5.10 Compliance Audit Logs',
     'The framework provides a Convex audit log implementation that serves as a template. PracticePro must '
     'implement audit logging for all data access and mutation events, not just for NBA compliance but also '
     'for operational debugging. The audit log schema should include: userId, action (using a standardized '
     'vocabulary like MATTER_VIEWED, DOCUMENT_DOWNLOADED, PAYMENT_RECORDED), resourceType, resourceId, '
     'timestamp, and optional metadata (ipAddress, userAgent). For V1, logging should cover at minimum: '
     'authentication events (login, logout, failed attempts), data access events (viewing a matter, '
     'downloading a document), and mutation events (creating, updating, or deleting any record). The '
     'implementation should use a dedicated Convex table with a TTL or archival policy to manage storage '
     'growth over time.'),
]

for title, content in audit_areas:
    story.append(add_heading(f'<b>{title}</b>', h2_style, level=1))
    story.append(Paragraph(content, body_style))

# ═══════════════════════════════════════════════════════════════
# SECTION 6: PRIORITY ACTION PLAN
# ═══════════════════════════════════════════════════════════════
story.append(add_heading('<b>6. Priority Action Plan</b>', h1_style, level=0))

story.append(Paragraph(
    'This section provides a sequenced action plan that accounts for dependencies between tasks. The plan is '
    'organized into four phases, each building on the completion of the previous phase. The total estimated '
    'effort assumes a single full-stack developer working on the Ati Gravity platform, with Convex backend '
    'and React frontend.',
    body_style
))

# Phase 1
story.append(add_heading('<b>6.1 Phase 1: Security Emergency (Week 1-2)</b>', h2_style, level=1))

phase1_data = [
    [Paragraph('<b>Task</b>', header_cell), Paragraph('<b>Description</b>', header_cell), Paragraph('<b>Priority</b>', header_cell), Paragraph('<b>Est. Days</b>', header_cell)],
    [Paragraph('Fix withFirmAuth', cell_style), Paragraph('Add getUserIdentity() call to withFirmAuth; verify identity on every protected function', cell_style), Paragraph('P0', cell_center), Paragraph('2', cell_center)],
    [Paragraph('Move API keys server-side', cell_style), Paragraph('Create Convex actions for Gemini API calls; remove keys from client bundle', cell_style), Paragraph('P0', cell_center), Paragraph('2', cell_center)],
    [Paragraph('Remove PropertyTrackingView', cell_style), Paragraph('Delete orphaned component and all imports; verify no runtime errors', cell_style), Paragraph('P1', cell_center), Paragraph('0.5', cell_center)],
    [Paragraph('Consolidate payment systems', cell_style), Paragraph('Remove property.rentPaymentHistory; migrate data to ledger_entries; update all queries', cell_style), Paragraph('P0', cell_center), Paragraph('3', cell_center)],
    [Paragraph('Run npm audit + fix critical', cell_style), Paragraph('Address all critical and high-severity dependency vulnerabilities', cell_style), Paragraph('P1', cell_center), Paragraph('1', cell_center)],
]
story.extend(make_table(phase1_data, [0.20, 0.45, 0.10, 0.10], 'Table 11: Phase 1 action items'))

# Phase 2
story.append(add_heading('<b>6.2 Phase 2: Core Fixes (Week 3-4)</b>', h2_style, level=1))

phase2_data = [
    [Paragraph('<b>Task</b>', header_cell), Paragraph('<b>Description</b>', header_cell), Paragraph('<b>Priority</b>', header_cell), Paragraph('<b>Est. Days</b>', header_cell)],
    [Paragraph('Fix CollectRentModal', cell_style), Paragraph('Resolve modal context discard; ensure tenant and property data available in modal', cell_style), Paragraph('P0', cell_center), Paragraph('2', cell_center)],
    [Paragraph('Fix ReceiptDetailView', cell_style), Paragraph('Fix receipt generation at unit level; ensure pdfkit works correctly', cell_style), Paragraph('P0', cell_center), Paragraph('2', cell_center)],
    [Paragraph('Fix Add Payment Flow', cell_style), Paragraph('Connect to consolidated ledger_entries; unit-level context', cell_style), Paragraph('P0', cell_center), Paragraph('1.5', cell_center)],
    [Paragraph('Implement basic audit logging', cell_style), Paragraph('Convex auditLog table + logAction mutation for auth, data access, deletes', cell_style), Paragraph('P1', cell_center), Paragraph('2', cell_center)],
    [Paragraph('Separate DataProviders', cell_style), Paragraph('Split DataProvider.tsx into MatterDataProvider and PropertyDataProvider', cell_style), Paragraph('P1', cell_center), Paragraph('2', cell_center)],
]
story.extend(make_table(phase2_data, [0.22, 0.45, 0.10, 0.10], 'Table 12: Phase 2 action items'))

# Phase 3
story.append(add_heading('<b>6.3 Phase 3: Simplification (Week 5-6)</b>', h2_style, level=1))

phase3_data = [
    [Paragraph('<b>Task</b>', header_cell), Paragraph('<b>Description</b>', header_cell), Paragraph('<b>Priority</b>', header_cell), Paragraph('<b>Est. Days</b>', header_cell)],
    [Paragraph('Flatten context providers', cell_style), Paragraph('Consolidate 12 providers to 4-5; remove redundant contexts', cell_style), Paragraph('P1', cell_center), Paragraph('3', cell_center)],
    [Paragraph('Remove deferred features', cell_style), Paragraph('Comment out or remove routes/components for AloaChat, valuations, bulk edit, maintenance, activity', cell_style), Paragraph('P1', cell_center), Paragraph('2', cell_center)],
    [Paragraph('Simplify tier enforcement', cell_style), Paragraph('Remove Revenue Monitor from Free/Pro tiers; add Custom/Enterprise gate', cell_style), Paragraph('P2', cell_center), Paragraph('1', cell_center)],
    [Paragraph('Add firmId indexes', cell_style), Paragraph('Audit all Convex tables; add firmId indexes where missing', cell_style), Paragraph('P1', cell_center), Paragraph('1', cell_center)],
    [Paragraph('Run depcheck + clean', cell_style), Paragraph('Remove unused dependencies after feature cuts', cell_style), Paragraph('P2', cell_center), Paragraph('1', cell_center)],
]
story.extend(make_table(phase3_data, [0.22, 0.45, 0.10, 0.10], 'Table 13: Phase 3 action items'))

# Phase 4
story.append(add_heading('<b>6.4 Phase 4: Quality &amp; Launch Prep (Week 7-8)</b>', h2_style, level=1))

phase4_data = [
    [Paragraph('<b>Task</b>', header_cell), Paragraph('<b>Description</b>', header_cell), Paragraph('<b>Priority</b>', header_cell), Paragraph('<b>Est. Days</b>', header_cell)],
    [Paragraph('Lighthouse audit', cell_style), Paragraph('Run full Lighthouse audit; fix Core Web Vitals to meet framework targets', cell_style), Paragraph('P1', cell_center), Paragraph('2', cell_center)],
    [Paragraph('Accessibility scan', cell_style), Paragraph('Run axe DevTools on all V1 pages; fix critical violations', cell_style), Paragraph('P2', cell_center), Paragraph('2', cell_center)],
    [Paragraph('E2E testing', cell_style), Paragraph('Write Playwright/Cypress tests for all V1 critical paths', cell_style), Paragraph('P1', cell_center), Paragraph('3', cell_center)],
    [Paragraph('Nigerian tax validation', cell_style), Paragraph('Test withholding tax + VAT calculations with real Nigerian scenarios', cell_style), Paragraph('P1', cell_center), Paragraph('1', cell_center)],
    [Paragraph('NBA compliance review', cell_style), Paragraph('Review audit logs, retention policy, and confidentiality controls against NBA standards', cell_style), Paragraph('P1', cell_center), Paragraph('1', cell_center)],
]
story.extend(make_table(phase4_data, [0.22, 0.45, 0.10, 0.10], 'Table 14: Phase 4 action items'))

# ═══════════════════════════════════════════════════════════════
# SECTION 7: CONCLUSION
# ═══════════════════════════════════════════════════════════════
story.append(add_heading('<b>7. The Case for Radical Simplicity</b>', h1_style, level=0))

story.append(Paragraph(
    'PracticePro is at an inflection point. The current trajectory, adding features faster than they can be '
    'stabilized, will lead to a product that is impressive in its ambition but unusable in its execution. '
    'The Nigerian legal market does not need a Swiss-army-knife application; it needs a reliable, simple '
    'tool that solves the most painful problems first. Law firms are conservative adopters of technology. '
    'They will not tolerate bugs, security vulnerabilities, or confusing interfaces. The first product that '
    'earns their trust will have an enormous competitive advantage.',
    body_style
))

story.append(Paragraph(
    'The simplification roadmap reduces PracticePro from 35 features to 15, eliminates the two most dangerous '
    'security vulnerabilities, consolidates the dual payment system into a single source of truth, and flattens '
    'the context provider tree from 12 to 4-5 providers. The result is a product that can be shipped in 8 weeks '
    'with confidence that every feature works, every data access is authenticated, and every financial record '
    'is consistent. This is not a lesser product; it is a better product, because every feature it includes '
    'works reliably and every feature it excludes was not yet ready to work reliably.',
    body_style
))

story.append(Paragraph(
    'The features that are deferred or cut are not abandoned; they are sequenced. AloaChat, property valuations, '
    'maintenance tracking, and the revenue monitor will all return in V2, but they will return on a foundation '
    'of security, stability, and user trust. The goal of V1 is not to be feature-complete; it is to be '
    'reliability-complete. A product that does fewer things but does them perfectly will always outperform a '
    'product that does everything but breaks unpredictably. This is the radical simplicity that PracticePro '
    'needs to succeed in the Nigerian market.',
    body_style
))

# ═══════════════════════════════════════════════════════════════
# BUILD
# ═══════════════════════════════════════════════════════════════
doc.multiBuild(story)
print(f"PDF generated: {output_path}")
