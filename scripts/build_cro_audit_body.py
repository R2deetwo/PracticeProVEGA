#!/usr/bin/env python3
"""
PracticePro CRO & PLG Audit - Body PDF Generator (ReportLab)

Generates the body of a strategic audit document covering:
1. Executive Summary
2. High-Friction Audit & CRO
3. Sales & Revenue Funnel Optimization
4. Product-Specific Positioning Strategy
5. Payment Gateway Status Report
6. Onboarding Refactor Plan (3 tracks)
7. Implementation Roadmap
8. Appendix: File-level findings
"""

import os
import sys
import hashlib
import platform

# ── Skill path setup ──
PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"
_scripts = os.path.join(PDF_SKILL_DIR, "scripts")
if _scripts not in sys.path:
    sys.path.insert(0, _scripts)

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, Flowable, HRFlowable, ListFlowable, ListItem
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus.tableofcontents import TableOfContents

# ── Font registration ──
_IS_MAC = platform.system() == 'Darwin'
FONT_DIR = os.path.expanduser('~/.openclaw/workspace/fonts') if _IS_MAC else '/usr/share/fonts'

pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                   italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# Install font fallback for mixed CJK/Latin (safe to call even on English-only docs)
try:
    from pdf import install_font_fallback
    install_font_fallback()
except Exception:
    pass

# ── Cascade palette (auto-generated, minimal mode) ──
PAGE_BG       = colors.HexColor('#f7f7f6')
SECTION_BG    = colors.HexColor('#eaeae8')
CARD_BG       = colors.HexColor('#efeeeb')
TABLE_STRIPE  = colors.HexColor('#f0efed')
HEADER_FILL   = colors.HexColor('#584f35')
COVER_BLOCK   = colors.HexColor('#766f5a')
BORDER        = colors.HexColor('#c7c3b8')
ICON          = colors.HexColor('#a29059')
ACCENT        = colors.HexColor('#8f7422')
ACCENT_2      = colors.HexColor('#7359c0')
TEXT_PRIMARY  = colors.HexColor('#22211f')
TEXT_MUTED    = colors.HexColor('#87857d')
SEM_SUCCESS   = colors.HexColor('#509266')
SEM_WARNING   = colors.HexColor('#997a3b')
SEM_ERROR     = colors.HexColor('#8b4741')
SEM_INFO      = colors.HexColor('#527191')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ── Styles ──
BODY_FONT = 'FreeSerif'
BOLD_FONT = 'FreeSerif-Bold'
ITALIC_FONT = 'FreeSerif-Italic'

styles = getSampleStyleSheet()

H1 = ParagraphStyle('H1', parent=styles['Normal'], fontName=BOLD_FONT,
                    fontSize=20, leading=26, textColor=TEXT_PRIMARY,
                    spaceBefore=18, spaceAfter=10, alignment=TA_LEFT)

H2 = ParagraphStyle('H2', parent=styles['Normal'], fontName=BOLD_FONT,
                    fontSize=15, leading=20, textColor=HEADER_FILL,
                    spaceBefore=16, spaceAfter=8, alignment=TA_LEFT)

H3 = ParagraphStyle('H3', parent=styles['Normal'], fontName=BOLD_FONT,
                    fontSize=12, leading=16, textColor=TEXT_PRIMARY,
                    spaceBefore=12, spaceAfter=6, alignment=TA_LEFT)

BODY = ParagraphStyle('Body', parent=styles['Normal'], fontName=BODY_FONT,
                      fontSize=10.5, leading=16, textColor=TEXT_PRIMARY,
                      alignment=TA_JUSTIFY, spaceAfter=8)

BODY_LEFT = ParagraphStyle('BodyLeft', parent=BODY, alignment=TA_LEFT)

BULLET = ParagraphStyle('Bullet', parent=BODY, alignment=TA_LEFT,
                        leftIndent=14, bulletIndent=2, spaceAfter=4)

CALLOUT = ParagraphStyle('Callout', parent=BODY, fontSize=10.5, leading=16,
                         textColor=TEXT_PRIMARY, alignment=TA_LEFT,
                         leftIndent=10, rightIndent=10,
                         spaceBefore=6, spaceAfter=6,
                         backColor=CARD_BG, borderColor=ACCENT,
                         borderWidth=0, borderPadding=8)

CALLOUT_CRITICAL = ParagraphStyle('CalloutCritical', parent=CALLOUT,
                                  backColor=colors.HexColor('#fbe9e7'),
                                  borderColor=SEM_ERROR,
                                  borderWidth=0, borderPadding=8)

CALLOUT_INFO = ParagraphStyle('CalloutInfo', parent=CALLOUT,
                              backColor=colors.HexColor('#e8f0f8'),
                              borderColor=SEM_INFO)

CALLOUT_SUCCESS = ParagraphStyle('CalloutSuccess', parent=CALLOUT,
                                 backColor=colors.HexColor('#e8f5ee'),
                                 borderColor=SEM_SUCCESS)

QUOTE = ParagraphStyle('Quote', parent=BODY, fontName=ITALIC_FONT,
                       fontSize=10.5, leading=16, textColor=TEXT_MUTED,
                       alignment=TA_LEFT, leftIndent=18, rightIndent=18,
                       spaceBefore=8, spaceAfter=8)

CODE = ParagraphStyle('Code', parent=BODY, fontName='DejaVuSans',
                      fontSize=8.5, leading=12, textColor=TEXT_PRIMARY,
                      alignment=TA_LEFT, leftIndent=10, rightIndent=10,
                      backColor=colors.HexColor('#f5f4f3'),
                      borderColor=BORDER, borderWidth=0.5, borderPadding=6,
                      spaceBefore=6, spaceAfter=10)

TOC_LEVEL0 = ParagraphStyle('TOC0', fontName=BOLD_FONT, fontSize=11,
                            leading=18, textColor=TEXT_PRIMARY,
                            leftIndent=0, spaceBefore=4, spaceAfter=2)
TOC_LEVEL1 = ParagraphStyle('TOC1', fontName=BODY_FONT, fontSize=10,
                            leading=15, textColor=TEXT_MUTED,
                            leftIndent=18, spaceBefore=2, spaceAfter=2)

TABLE_HEADER_STYLE = ParagraphStyle('TableHeader', fontName=BOLD_FONT,
                                    fontSize=10, leading=13,
                                    textColor=colors.white, alignment=TA_LEFT)
TABLE_HEADER_CENTER = ParagraphStyle('TableHeaderC', parent=TABLE_HEADER_STYLE,
                                     alignment=TA_CENTER)
TABLE_CELL = ParagraphStyle('TableCell', fontName=BODY_FONT, fontSize=9,
                            leading=12, textColor=TEXT_PRIMARY, alignment=TA_LEFT)
TABLE_CELL_CENTER = ParagraphStyle('TableCellC', parent=TABLE_CELL, alignment=TA_CENTER)
TABLE_CELL_BOLD = ParagraphStyle('TableCellB', parent=TABLE_CELL, fontName=BOLD_FONT)

CAPTION = ParagraphStyle('Caption', parent=BODY, fontSize=9, leading=12,
                         textColor=TEXT_MUTED, alignment=TA_CENTER,
                         spaceBefore=3, spaceAfter=8)

PAGE_TITLE_STYLE = ParagraphStyle('PageTitle', fontName=BOLD_FONT,
                                  fontSize=22, leading=28, textColor=HEADER_FILL,
                                  alignment=TA_LEFT, spaceBefore=0, spaceAfter=14)

# ── TocDocTemplate ──
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))


def add_heading(text, style, level=0):
    """Add a heading with TOC bookmark."""
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p


# ── Header / footer ──
def header_footer(canvas, doc):
    canvas.saveState()
    page_w, page_h = A4
    # Top: thin rule
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, page_h - 14*mm, page_w - 20*mm, page_h - 14*mm)
    # Top-left: report title
    canvas.setFont('FreeSerif', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(20*mm, page_h - 11*mm, 'PracticePro Systems  |  CRO & PLG Audit')
    # Top-right: section label
    canvas.drawRightString(page_w - 20*mm, page_h - 11*mm, 'Confidential')
    # Bottom: rule
    canvas.line(20*mm, 14*mm, page_w - 20*mm, 14*mm)
    # Bottom-left: brand
    canvas.setFont('FreeSerif-Italic', 8)
    canvas.drawString(20*mm, 10*mm, 'Prepared for PracticePro Founder Office')
    # Bottom-right: page number
    canvas.setFont(BOLD_FONT, 9)
    canvas.setFillColor(HEADER_FILL)
    canvas.drawRightString(page_w - 20*mm, 10*mm, f'{doc.page}')
    canvas.restoreState()


# ── Helpers ──
def p(text, style=BODY):
    return Paragraph(text, style)

def h1(text):
    return add_heading(text, H1, level=0)

def h2(text):
    return add_heading(text, H2, level=1)

def h3(text):
    return Paragraph(text, H3)

def callout(text, kind='info'):
    if kind == 'critical':
        return Paragraph(text, CALLOUT_CRITICAL)
    elif kind == 'success':
        return Paragraph(text, CALLOUT_SUCCESS)
    elif kind == 'info':
        return Paragraph(text, CALLOUT_INFO)
    return Paragraph(text, CALLOUT)

def code_block(text):
    # Escape HTML special chars
    safe = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    safe = safe.replace('\n', '<br/>')
    safe = safe.replace(' ', '&nbsp;')
    return Paragraph(safe, CODE)

def quote(text):
    return Paragraph(f'&ldquo;{text}&rdquo;', QUOTE)

def make_table(data_rows, col_widths, header_centered=True):
    """Build a styled table. data_rows[0] is the header row."""
    hdr_style = TABLE_HEADER_CENTER if header_centered else TABLE_HEADER_STYLE
    table_data = []
    for i, row in enumerate(data_rows):
        if i == 0:
            table_data.append([Paragraph(f'<b>{c}</b>', hdr_style) for c in row])
        else:
            table_data.append([Paragraph(c, TABLE_CELL) for c in row])
    t = Table(table_data, colWidths=col_widths, hAlign='CENTER', repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
    ]
    # Alternating row colors
    for i in range(1, len(table_data)):
        if i % 2 == 1:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_ROW_EVEN))
        else:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_ROW_ODD))
    t.setStyle(TableStyle(style_cmds))
    return t

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER,
                      spaceBefore=8, spaceAfter=8)

def section_break():
    return Spacer(1, 14)


# ── Content Width ──
CONTENT_WIDTH = A4[0] - 40*mm  # 20mm margins on each side

# ── Build Story ──
story = []

# ═══════════════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ═══════════════════════════════════════════════════════════════
toc_title = ParagraphStyle('TocTitle', fontName=BOLD_FONT, fontSize=22,
                           leading=28, textColor=HEADER_FILL,
                           alignment=TA_LEFT, spaceAfter=18)
story.append(Paragraph('Table of Contents', toc_title))
story.append(HRFlowable(width="100%", thickness=1.5, color=ACCENT,
                        spaceBefore=0, spaceAfter=18))

toc = TableOfContents()
toc.levelStyles = [TOC_LEVEL0, TOC_LEVEL1]
story.append(toc)
story.append(PageBreak())


# ═══════════════════════════════════════════════════════════════
# SECTION 1 — EXECUTIVE SUMMARY
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph('Section 01', ParagraphStyle(
    'SectionLabel', fontName=BOLD_FONT, fontSize=10, leading=14,
    textColor=ACCENT, alignment=TA_LEFT, spaceAfter=2)))
story.append(h1('Executive Summary'))

story.append(p(
    'This audit was commissioned to evaluate the PracticePro user-acquisition pipeline end-to-end across the three product lines &mdash; Atrium (Property OS), Vega (Legal), and Komplete (Unified) &mdash; from three concurrent perspectives: marketing, behavioral psychology, and sales engineering. The findings below are not abstract benchmarks. They are grounded in a line-by-line review of the live Convex backend mutations, the React/TypeScript onboarding components, the schema definitions, the cron jobs, and the payment-gateway integrations that ship in the current production build.'
))

story.append(p(
    'The headline conclusion is uncomfortable. PracticePro currently has a strategically designed onboarding surface that promises a 14-day Enterprise trial, a working bank-transfer payment flow, and a Paystack card option &mdash; but none of those promises is backed by working backend code. The 14-day trial button is purely cosmetic. The bank-transfer flow accepts the user&rsquo;s click but writes nothing to the database, then immediately flips the firm&rsquo;s tier client-side with zero verification. The Paystack integration is fully coded but dormant by environment flag, and even if activated it would not work end-to-end because of a missing transaction-reference persistence step. The cumulative effect is a revenue leak that lets any user self-upgrade to any paid tier without paying, and a trust leak that promises features the system cannot enforce.'
))

story.append(p(
    'On the onboarding side, the situation is better but still significantly suboptimal. The wizard has been compressed to a healthy 2-step flow, but Time-to-Value still sits at roughly 9 clicks across 7 screens, the dashboard provides no first-run welcome, the plan-selection language is misnamed (Step 1 promises &ldquo;Confirm Plan&rdquo; but Step 2 says &ldquo;Pay Now&rdquo;), and the &ldquo;stuck on Creating&rdquo; bug that has been reported anecdotally is real and traceable to a missing timeout on the <font name="DejaVuSans" size="9">createFirm</font> Convex mutation. None of these issues are catastrophic individually, but together they erode conversion at exactly the moment when the user has the highest intent.'
))

story.append(h3('Top-Line Findings'))

findings_data = [
    ['#', 'Finding', 'Severity', 'Status'],
    ['1', 'Paystack is dormant by env flag, and even when activated it cannot match a webhook to an invoice (no providerReference persistence).', 'Critical', 'Broken end-to-end'],
    ['2', 'Manual bank transfer "Report Payment" writes nothing to the DB; for subscription upgrades it instantly flips the firm tier with no verification.', 'Critical', 'Revenue + security leak'],
    ['3', '"Start 14-Day Free Trial" button is cosmetic. No schema fields, no cron, no enforcement, no expiry.', 'Critical', 'Vapor feature'],
    ['4', 'SubscriptionSettings.processUpgrade lets any firm member self-upgrade by clicking "Report Payment Transferred".', 'Critical', 'Authorization bypass'],
    ['5', 'updateItem mutation accepts client-supplied subscriptionPlan and uses requireFirmUser (not requireAdmin).', 'High', 'Privilege escalation risk'],
    ['6', '"Stuck on Creating" bug: createFirm mutation has no timeout; if Convex/WebSocket hangs, button stays at "Creating..." forever.', 'High', 'Reproducible'],
    ['7', 'Onboarding "Pay Now" path shows a stub modal with no bank details and no amount. The real PaymentGatewayModal.tsx is unused.', 'High', 'Trust leak'],
    ['8', 'DPA agreement checkbox is buried below the plan cards; both CTAs disabled until checked &mdash; friction at the highest-intent moment.', 'Medium', 'Fixable'],
    ['9', 'showAllPlans defaults to false and preselected tier is hardcoded Pro. Users see only one plan unless they click "Compare".', 'Medium', 'Dark pattern'],
    ['10', 'Dashboard has no first-run welcome. Recent Properties widget has no CTA. Empty state on Atrium is weaker than on Vega.', 'Medium', 'Missed Aha! moment'],
    ['11', 'Tier choice has no portfolio-size anchor. Users guess between Core/Growth/Pro with no visual recommendation heuristic.', 'Medium', 'Conversion drag'],
    ['12', 'setupFeePaid defaults to true on firm creation for non-Enterprise tiers, regardless of payment status.', 'Medium', 'False "active" status'],
    ['13', 'adminStatus field is patched by founder dashboard but is not in the schema and is never enforced anywhere.', 'Low', 'Cosmetic feature'],
    ['14', 'Hard-coded fallback Gemini API key in convex/http.ts line 39 (security issue, unrelated to billing).', 'Low', 'Security debt'],
]
story.append(make_table(findings_data, [22, CONTENT_WIDTH-22-65-75, 65, 75]))
story.append(Paragraph('Table 1.1 &mdash; Top-line audit findings, ranked by severity.', CAPTION))

story.append(section_break())

story.append(h3('Payment Gateway Verdict'))

story.append(callout(
    '<b>Direct answer to "Are the payment gateways working fine?":</b> No. Of the four intended gateways &mdash; Paystack, Flutterwave, Stripe, and manual bank transfer &mdash; <b>zero are working end-to-end</b>. Paystack is fully coded but dormant by environment flag and has a critical bug that would break it even if activated. Flutterwave and Stripe have no implementation code whatsoever &mdash; they appear only in legal documents and the Content-Security-Policy header. The manual bank-transfer modal renders correct Providus Bank details but writes no record to the database, and for subscription upgrades it immediately flips the firm tier with no verification, which is simultaneously a revenue leak and an authorization-bypass security issue.',
    'critical'
))

story.append(p(
    'The deeper issue is that the team has been shipping UI for payment flows that the backend cannot honor. The OnboardingWizard&rsquo;s &ldquo;Pay Now&rdquo; path shows a stub modal that says &ldquo;Payment Reported&rdquo; with no bank account details, no amount, and no transaction reference. The real <font name="DejaVuSans" size="9">PaymentGatewayModal.tsx</font> component &mdash; which does render the Providus Bank account, the Paystack card flow, and the amount &mdash; exists in the codebase but is never invoked during onboarding. The user is therefore asked to pay without being told where to send money, how much to send, or what reference to use.'
))

story.append(h3('Recommended Action Posture'))

story.append(p(
    'The remediation work falls into three concurrent tracks. <b>Track A &mdash; Revenue Protection</b> must ship first: plug the self-upgrade leak, gate the <font name="DejaVuSans" size="9">updateItem</font> mutation against tier changes, and replace the stub payment modal with the real <font name="DejaVuSans" size="9">PaymentGatewayModal.tsx</font> so users see actual bank details. <b>Track B &mdash; Trial System</b> implements the actual 14-day trial: schema fields, a <font name="DejaVuSans" size="9">createFirm</font> flag, a daily expiry cron, and a feature gate that consults trial status. <b>Track C &mdash; Onboarding Polish</b> addresses the friction, copy, and Time-to-Value issues identified in this audit. The three tracks can be developed in parallel, but Track A must reach production before any further marketing spend drives traffic into a leaky funnel.'
))

story.append(PageBreak())


# ═══════════════════════════════════════════════════════════════
# SECTION 2 — HIGH-FRICTION AUDIT & CRO
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph('Section 02', ParagraphStyle(
    'SectionLabel', fontName=BOLD_FONT, fontSize=10, leading=14,
    textColor=ACCENT, alignment=TA_LEFT, spaceAfter=2)))
story.append(h1('High-Friction Audit & Conversion Rate Optimization'))

story.append(p(
    'This section evaluates the onboarding sequence for conversion drop-off points, cognitive overload, and friction that exceeds the qualification value it produces. The analysis is grounded in the actual component code &mdash; <font name="DejaVuSans" size="9">Signup.tsx</font>, <font name="DejaVuSans" size="9">OnboardingWizard.tsx</font>, <font name="DejaVuSans" size="9">AuthContext.tsx</font>, <font name="DejaVuSans" size="9">Dashboard.tsx</font>, and the per-product empty states &mdash; rather than heuristics or industry benchmarks.'
))

# ── 2.1 TTV ──
story.append(h2('2.1 Time-to-Value (TTV) Assessment'))

story.append(p(
    'Time-to-Value is the single most predictive metric for SaaS trial-to-paid conversion. The benchmark for B2B SaaS is to deliver the user&rsquo;s first &ldquo;Aha!&rdquo; moment &mdash; the first time they experience the core product value &mdash; within 5 minutes of completing sign-up. PracticePro currently misses this benchmark badly. A newly registered user must traverse a minimum of 7 distinct screens and execute roughly 9 discrete clicks before they can create their first matter (Vega/Komplete) or property (Atrium/Komplete). Two of those screens are blocking waits with no perceived progress: the email-verification step and the post-onboarding Convex reactive sync.'
))

story.append(p(
    'The flow in detail: (1) Land on a product page, (2) click <i>Get Started Free</i>, (3) pick a product (Vega/Atrium/Komplete), (4) fill 3 fields plus 2 checkboxes and click <i>Create Account</i>, (5) wait for an email, type a 6-digit code, click <i>Verify &amp; Login</i>, (6) Wizard Step 1: type firm name, click <i>Next: Confirm Plan</i>, (7) Wizard Step 2: check DPA, click <i>Start 14-Day Free Trial</i> or <i>Pay Now</i>, (8) wait for <font name="DejaVuSans" size="9">handleCreate</font> and the Convex sync, (9) click <i>Matters</i> or <i>Properties</i> in the sidebar, then click <i>New Matter</i> or <i>+ Add Property</i>. That is nine clicks and two blocking waits. Industry leaders like Linear, Notion, and Vercel deliver first value in 3 clicks and zero blocking waits.'
))

story.append(h3('Where Time Is Lost'))

ttv_data = [
    ['Stage', 'Time Cost', 'Deferrable?', 'Recommendation'],
    ['Product selection (3 cards)', '~15s', 'No', 'Keep &mdash; this is the user\'s first commitment.'],
    ['Sign-up form (3 fields + 2 checkboxes)', '~45s', 'Partial', 'Drop Terms + Privacy checkboxes; bind by click-through, surface links in footer.'],
    ['Email verification (6-digit code)', '~60-180s', 'No, but accelerable', 'Reduce from 6 to 4 digits; offer "resend in 10s" with visible countdown.'],
    ['Wizard Step 1 (firm name)', '~20s', 'No', 'Autosuggest firm name from email domain (e.g. "@adeyemi.co" &rarr; "Adeyemi").'],
    ['Wizard Step 2 (plan + DPA)', '~30s', 'Yes &mdash; for trial path', 'On trial path, skip Step 2 entirely; create firm at Core, surface upgrade later.'],
    ['handleCreate + Convex sync', '~3-12s', 'No', 'Add 30s timeout with retry affordance; show optimistic progress.'],
    ['Dashboard land &rarr; first create click', '~10-30s', 'No, but guided', 'Auto-open the create modal on first dashboard load if no records exist.'],
]
story.append(make_table(ttv_data, [115, 60, 70, CONTENT_WIDTH-115-60-70]))
story.append(Paragraph('Table 2.1 &mdash; TTV breakdown by stage, with deferral recommendations.', CAPTION))

story.append(h3('Deferring Non-Essential Setup'))

story.append(p(
    'The single biggest TTV win available is to defer the plan-selection step entirely for users who choose the trial path. Today, every new firm &mdash; even those picking &ldquo;Start 14-Day Free Trial&rdquo; &mdash; is forced through Step 2, where they must check a DPA checkbox and click either Pay Now or Start Trial. This is friction at exactly the wrong moment: the user has just committed their email and verified it, their intent is at peak, and we are showing them a billing decision before they have seen a single feature work.'
))

story.append(p(
    'The recommended pattern is borrowed from Slack and Notion: create the firm at the free Core tier immediately after email verification, route the user straight to the dashboard, and surface the plan upgrade as a soft gate the first time they hit a tier limit (e.g. attempting to add an 11th matter on Core). At that moment the user has experienced value, the upgrade is contextual, and the conversion rate is materially higher than at the cold onboarding step. The bank-transfer flow and trial offer then become in-context upgrades tied to a specific value the user is trying to unlock, rather than abstract billing decisions made blind.'
))

# ── 2.2 Form Length ──
story.append(h2('2.2 Form Length & Cognitive Load'))

story.append(p(
    'The sign-up form collects three mandatory fields (Full Name, Work Email, Password) plus two mandatory checkboxes (Terms of Service, Privacy Policy). Password requirements are strict: 8+ characters with at least one uppercase, one lowercase, one digit, and one special character. The requirements are only displayed after the user types an invalid password and blurs the field &mdash; there is no live strength meter or visible requirement checklist. This is a classic pattern that produces high form-abandonment: the user types a password they consider reasonable, hits submit, sees an error, has to invent a new password, and either succeeds or gives up.'
))

story.append(p(
    'Two of the five mandatory inputs can be removed without losing qualification value. The Terms of Service and Privacy Policy checkboxes can be replaced with click-through binding language (&ldquo;By creating an account you agree to our Terms and Privacy Policy&rdquo;) with the documents linked inline. This is legally sufficient in Nigeria under the NDPA 2023 and is the dominant pattern across modern SaaS. Removing two checkboxes shaves roughly 8&ndash;12 seconds off the form and removes two decision points at the highest-intent moment.'
))

story.append(p(
    'Auto-population opportunities are also underused. The firm name is collected separately in Wizard Step 1, but it can be inferred from the email domain when the user signs up with a work email (e.g. <font name="DejaVuSans" size="9">jide@adeyemi-co.ng</font> &rarr; suggested firm name &ldquo;Adeyemi &amp; Co&rdquo;). The user can confirm or override, but the field is pre-populated. Currency can be defaulted to NGN based on the request IP geolocation (the platform is Nigeria-first by positioning). Time zone can be defaulted to Africa/Lagos. None of these are collected today, and each one is a friction point the user will hit later.'
))

story.append(h3('Field-by-Field Audit'))

field_audit = [
    ['Field', 'Where', 'Mandatory?', 'Action'],
    ['Full Name', 'Signup.tsx step=form', 'Yes', 'Keep. Split into first/last on backend, single input on frontend.'],
    ['Work Email', 'Signup.tsx step=form', 'Yes', 'Keep. Block disposable domains (mailinator, etc.).'],
    ['Password', 'Signup.tsx step=form', 'Yes', 'Add live checklist; relax to 8+ chars + 1 special (drop the upper/lower/digit split requirement).'],
    ['Terms checkbox', 'Signup.tsx step=form', 'Yes', 'Remove; replace with click-through binding language.'],
    ['Privacy checkbox', 'Signup.tsx step=form', 'Yes', 'Remove; replace with click-through binding language.'],
    ['6-digit code', 'Signup.tsx step=verify', 'Yes', 'Reduce to 4 digits; auto-advance on last digit.'],
    ['Product choice', 'Signup.tsx step=product_selection', 'Yes', 'Keep &mdash; this is the user\'s first commitment.'],
    ['Firm name', 'OnboardingWizard step=1', 'Yes', 'Autosuggest from email domain; user can override.'],
    ['Plan choice', 'OnboardingWizard step=2', 'Yes (today)', 'Defer for trial path; only ask on hard paywall.'],
    ['DPA checkbox', 'OnboardingWizard step=2', 'Yes (today)', 'Move to click-through; surface in app settings.'],
    ['Billing cycle', 'OnboardingWizard step=2', 'Yes for non-Atrium', 'Default to annual with "Save 20%" anchor; one-click switch.'],
    ['Managed Data Migration', 'OnboardingWizard step=2', 'Optional (Atrium)', 'Defer to post-onboarding; show as upsell after first property.'],
]
story.append(make_table(field_audit, [115, 110, 65, CONTENT_WIDTH-115-110-65]))
story.append(Paragraph('Table 2.2 &mdash; Field-by-field audit of every mandatory input in the onboarding sequence.', CAPTION))

# ── 2.3 Friction vs Qualification ──
story.append(h2('2.3 Friction vs Qualification Balance'))

story.append(p(
    'The gating logic in <font name="DejaVuSans" size="9">OnboardingWizard.tsx</font> currently creates friction too early. Every new firm &mdash; including those picking &ldquo;Start 14-Day Free Trial&rdquo; &mdash; must traverse the full Step 2 plan selection and check the DPA agreement before they can create their workspace. This is the wrong moment to ask. The user has just verified their email; their intent is high but their commitment is fragile. Asking for a billing decision (even a no-cost trial decision) at this point produces measurable drop-off, and the data we collect (which plan they picked) is low-value because most trial users will pick the highest available tier regardless of need.'
))

story.append(p(
    'The recommended alternative is <b>progressive profiling</b>: collect only the minimum required to deliver first value, then ask for qualification details at the moment they become relevant. Organization team size becomes relevant only when the user attempts to invite a second teammate (which exceeds the Core tier&rsquo;s 1-seat cap). Billing details become relevant only when the user hits a tier limit or chooses to upgrade. Firm specialty (real estate, litigation, corporate, etc.) becomes relevant only when the user creates their first matter and we want to suggest relevant document templates. Each of these is a contextual ask tied to a specific user action, not a cold onboarding question.'
))

story.append(p(
    'The trial prompt itself should be deferred to a contextual moment. Instead of asking &ldquo;Pay Now or Start 14-Day Free Trial&rdquo; at onboarding, the user should land on the dashboard at Core, hit the first soft gate (e.g. &ldquo;You&rsquo;ve reached the 10-matter limit on Core. Upgrade to Growth for unlimited matters, or start a 14-day Pro trial&rdquo;), and make the decision with full context. This is the pattern used by Linear, Vercel, Notion, and Cal.com, and it consistently outperforms cold onboarding paywalls by 2&ndash;3x in trial-to-paid conversion.'
))

story.append(callout(
    '<b>Recommendation 2.3 &mdash; Defer the trial decision.</b> Move the &ldquo;Start 14-Day Free Trial&rdquo; button out of the onboarding wizard entirely. Create every new firm at Core, route to dashboard, and surface trial as a soft-gate upgrade prompt the first time the user hits a tier limit. This reduces onboarding friction by ~30s and aligns the trial decision with the moment of highest contextual value.',
    'success'
))

story.append(PageBreak())


# ═══════════════════════════════════════════════════════════════
# SECTION 3 — SALES & REVENUE FUNNEL OPTIMIZATION
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph('Section 03', ParagraphStyle(
    'SectionLabel', fontName=BOLD_FONT, fontSize=10, leading=14,
    textColor=ACCENT, alignment=TA_LEFT, spaceAfter=2)))
story.append(h1('Sales & Revenue Funnel Optimization'))

story.append(p(
    'This section examines how the current onboarding flow transforms free-trial users into paying subscribers. It covers tier choice and value communication, the manual bank-transfer conversion mechanics, and the design of an automated trial-to-paid nudge engine. The findings draw on the actual code in <font name="DejaVuSans" size="9">tiers.ts</font>, <font name="DejaVuSans" size="9">OnboardingWizard.tsx</font>, <font name="DejaVuSans" size="9">PaymentGatewayModal.tsx</font>, and <font name="DejaVuSans" size="9">SubscriptionSettings.tsx</font>, plus the schema and mutation surface that backs them.'
))

# ── 3.1 Tier Choice & Value Communication ──
story.append(h2('3.1 Tier Choice & Value Communication'))

story.append(p(
    'The tier matrix in <font name="DejaVuSans" size="9">src/constants/tiers.ts</font> is well-structured for pricing and unit limits. Three product matrices are defined: <b>VEGA_TIERS</b> (4 tiers, monthly+annual, ₦0&ndash;₦80k/mo), <b>ATRIUM_TIERS</b> (4 tiers, annual-only, ₦490k&ndash;₦2.1M/yr), and a single flat <b>KOMPLETE_TIER</b> (₦130k/mo or ₦1.248M/yr, 10 seats, unlimited everything). Komplete is correctly rebranded as &ldquo;Enterprise&rdquo; in display via <font name="DejaVuSans" size="9">getDisplayPlan()</font>. The pricing structure is sound; the problem is how that structure is communicated at the moment of choice.'
))

story.append(p(
    'In <font name="DejaVuSans" size="9">OnboardingWizard.tsx</font> Step 2, the user sees only the preselected tier (hardcoded to <i>Pro</i> at line 105) by default. To see the other tiers, they must click &ldquo;Compare with other plans&rdquo;. This is a dark pattern in two directions simultaneously. First, it pushes users toward Pro regardless of their actual need &mdash; a solo practitioner with 5 matters would be fine on Core but is steered toward ₦768k/yr. Second, it hides the comparison context that would help an informed user self-select. The pattern is borrowed from SaaS leaders like Slack and Notion, but those tools use it to <i>recommend</i> a specific tier based on team-size signals, not to push the highest-margin option blind.'
))

story.append(h3('Missing Visual Anchors'))

story.append(p(
    'The most impactful single change is to add <b>portfolio-size anchors</b> to each tier card. Today, the user sees &ldquo;Core &mdash; ₦0/mo &mdash; 10 matters, 1 seat&rdquo; and &ldquo;Growth &mdash; ₦45k/mo &mdash; unlimited matters, 5 seats&rdquo; and must do mental arithmetic to figure out which fits their practice. The fix is to add a one-line contextual anchor above the price: &ldquo;Recommended for solo practitioners and small firms up to 3 lawyers&rdquo; for Growth, &ldquo;Recommended for mid-size firms with active litigation pipelines&rdquo; for Pro, etc. This collapses the decision from a feature-comparison task to a self-identification task, which is cognitively far cheaper and converts better.'
))

anchor_data = [
    ['Tier', 'Current Anchor', 'Recommended Anchor (Nigeria-contextual)'],
    ['Vega Core', '&ldquo;Free&rdquo;', '&ldquo;For solo practitioners getting started&rdquo;'],
    ['Vega Growth', '&ldquo;Most Popular&rdquo;', '&ldquo;For small teams of 2&ndash;5 lawyers&rdquo;'],
    ['Vega Pro', '&ldquo;Recommended&rdquo; (no context)', '&ldquo;For firms with active litigation pipelines&rdquo;'],
    ['Vega Enterprise', '&ldquo;Custom&rdquo;', '&ldquo;For multi-branch firms with 50+ matters/month&rdquo;'],
    ['Atrium Core', '(no anchor)', '&ldquo;For portfolios up to 10 units&rdquo;'],
    ['Atrium Growth', '(no anchor)', '&ldquo;For portfolios of 10&ndash;25 units&rdquo;'],
    ['Atrium Pro', '&ldquo;Recommended&rdquo;', '&ldquo;For portfolios of 25&ndash;100 units; most estate surveyors&rdquo;'],
    ['Atrium Enterprise', '&ldquo;Custom&rdquo;', '&ldquo;For developers and PMs with 100+ units&rdquo;'],
    ['Komplete', '&ldquo;10 Seats&rdquo;', '&ldquo;Unified property + legal; for diversified firms&rdquo;'],
]
story.append(make_table(anchor_data, [85, 130, CONTENT_WIDTH-85-130]))
story.append(Paragraph('Table 3.1 &mdash; Recommended portfolio-size anchors per tier, written for the Nigerian market.', CAPTION))

story.append(p(
    'The &ldquo;Most Popular&rdquo; badge on Vega Growth and the &ldquo;Recommended&rdquo; badge on Vega Pro are also misaligned with actual user economics. For a Nigerian legal practice, the modal firm size is 1&ndash;3 lawyers, which fits Vega Growth (5 seats) &mdash; so the &ldquo;Most Popular&rdquo; label is correct. But for Atrium, the modal property portfolio is 5&ndash;25 units, which fits Atrium Growth, not Atrium Pro &mdash; so the &ldquo;Recommended&rdquo; badge on Atrium Pro is steering users upmarket. We recommend moving the &ldquo;Recommended&rdquo; badge to Atrium Growth and reserving the Pro badge for &ldquo;For larger portfolios&rdquo;.'
))

# ── 3.2 Manual Bank Transfer ──
story.append(h2('3.2 Manual Bank Transfer Conversion Mechanics'))

story.append(p(
    'Manual bank transfer is the primary payment rail for Nigerian B2B SaaS, and PracticePro&rsquo;s positioning (Providus Bank, account 1203984572, PracticePro Systems Ltd) is correct for the market. The problem is the conversion mechanics around the modal. Today, when a user clicks &ldquo;Pay Now&rdquo; in the onboarding wizard, they see a stub modal that says &ldquo;Payment Reported&rdquo; with the message &ldquo;PracticePro will verify your bank transfer and update your organization invoice status within 24 hours&rdquo; and a button &ldquo;Continue to Workspace&rdquo;. The modal shows no bank account details, no payment amount, no transaction reference, and no proof-of-payment upload field. The user is being asked to trust that they will figure out where to send money, with no information, and then click through to access the product anyway.'
))

story.append(p(
    'The real <font name="DejaVuSans" size="9">PaymentGatewayModal.tsx</font> component does render the bank details correctly (Providus Bank, 1203984572, PracticePro Systems Ltd) and includes the amount and an optional Paystack card flow. But this component is not invoked from the onboarding wizard &mdash; it is only invoked from <font name="DejaVuSans" size="9">SubscriptionSettings.tsx</font> for in-app plan upgrades. Worse, even when it is invoked, the &ldquo;Report Payment Transferred&rdquo; button calls <font name="DejaVuSans" size="9">handleConfirmPayment</font> which only flips local React state and writes nothing to the database. There is no audit trail of who reported what payment when, no transaction reference, no proof-of-payment upload, and no admin notification.'
))

story.append(h3('Trust Signal Inventory'))

trust_data = [
    ['Trust Signal', 'Present Today?', 'Recommended Fix'],
    ['Bank name displayed', 'Partial (in real modal, not onboarding stub)', 'Wire PaymentGatewayModal.tsx into onboarding'],
    ['Account number displayed', 'Partial (same as above)', 'Same &mdash; use real modal'],
    ['Account name displayed', 'Partial (same as above)', 'Same &mdash; use real modal'],
    ['Payment amount displayed', 'No (onboarding stub omits)', 'Pass amount to modal; display prominently'],
    ['Transaction reference generated', 'No &mdash; uses "manual-${Date.now()}"', 'Generate server-side ref like PP-${firmId}-${timestamp}; store on invoice'],
    ['Proof-of-payment upload field', 'No', 'Add file upload; write to payment_proofs table with type=subscription'],
    ['Status tracking after report', 'No &mdash; firm is instantly marked active', 'Insert pending row; firm stays "pending" until admin/webhook confirms'],
    ['Admin notification on report', 'No', 'Push notification to founder dashboard; surface in OrganizationsHub'],
    ['Auto-expiry of pending reports', 'No', 'Auto-revert to prior tier after 72h if no confirmation'],
    ['Paystack card option', 'Coded but dormant', 'Activate Paystack env vars; fix providerReference persistence'],
    ['Currency indicator', 'Implicit (NGN)', 'Show &#8358; symbol explicitly; clarify "Nigerian Naira" for international users'],
]
story.append(make_table(trust_data, [125, 95, CONTENT_WIDTH-125-95]))
story.append(Paragraph('Table 3.2 &mdash; Trust signal inventory for the bank-transfer flow.', CAPTION))

story.append(h3('User Psychological State at the Modal'))

story.append(p(
    'The moment a user sees the bank-transfer modal is the highest-anxiety moment in the funnel. They have committed to paying real money, they have just been told to send it to an account they have never used before, and they have no immediate confirmation that the payment will be acknowledged. This is the moment where trust signals matter most. The current stub modal actively damages trust by hiding the bank details and providing no proof-of-payment mechanism. The user is left to screenshot their transfer receipt, hope they remember which firm it was for, and trust that someone at PracticePro will manually reconcile it within 24 hours.'
))

story.append(p(
    'The fix is to make the modal feel like a payment confirmation step, not a &ldquo;Continue to Workspace&rdquo; dismissal. Recommended layout: prominent bank account block at the top (Providus Bank, 1203984572, PracticePro Systems Ltd) with a copy-to-clipboard button on each field. Below that, the payment amount in large type (&ldquo;<b>&#8358;80,000.00</b> &mdash; Pro Annual&rdquo;) with a transaction reference (auto-generated, displayed, copyable). Below that, a proof-of-payment upload field (drag-and-drop, accepts PDF/JPG/PNG, max 5MB). Below that, a &ldquo;I have transferred &#8358;80,000 to the account above&rdquo; button that writes a pending row to the database and surfaces a success state: &ldquo;Payment reported. Your reference is PP-XXXX. We will confirm within 24 hours. You can continue using Pro features in the meantime.&rdquo;'
))

story.append(callout(
    '<b>Recommendation 3.2 &mdash; Bank-transfer modal redesign.</b> Replace the onboarding stub modal with the real <font name="DejaVuSans" size="9">PaymentGatewayModal.tsx</font>. Generate a server-side transaction reference (PP-{firmId}-{timestamp}). Add a proof-of-payment upload field that writes to the existing <font name="DejaVuSans" size="9">payment_proofs</font> table with a new <font name="DejaVuSans" size="9">type: "subscription"</font> discriminator. Write a pending row to the firm&rsquo;s record. Allow continued product access at the target tier during the verification window (24&ndash;72h), then auto-revert if no confirmation.',
    'success'
))

# ── 3.3 Trial-to-Paid Nudge Engine ──
story.append(h2('3.3 Trial-to-Paid Nudge Engine'))

story.append(p(
    'A 14-day trial is only as good as the nudge engine that drives engagement during the trial window. Today, PracticePro has no nudge engine whatsoever. The trial is not even real &mdash; clicking &ldquo;Start 14-Day Free Trial&rdquo; creates the firm at the selected paid plan with no expiration timestamp, no schema field, no cron, and no enforcement. Even if we ship the trial system, without an active nudge engine most trials will expire unused, and the conversion rate will be a fraction of its potential.'
))

story.append(p(
    'The recommended nudge engine maps automated, value-driven in-app milestones across the 14-day trial window. Each milestone is tied to a specific value moment the user should have experienced by that day, with a contextual call-to-action that reinforces the trial&rsquo;s value rather than nagging about expiration. The milestones below are tuned for Atrium (property) but adapt cleanly to Vega (legal) by swapping &ldquo;property&rdquo; for &ldquo;matter&rdquo;.'
))

nudge_data = [
    ['Day', 'Milestone', 'Channel', 'Message'],
    ['Day 0', 'Welcome + first setup', 'In-app banner', '&ldquo;Welcome to Atrium. Add your first property in 60 seconds to get started.&rdquo;'],
    ['Day 1', 'First property added', 'In-app toast', '&ldquo;Great &mdash; you\'ve added your first property. Try recording a tenant and a lease next.&rdquo;'],
    ['Day 3', 'First rent recorded', 'In-app + email', '&ldquo;You\'ve recorded your first rent payment. See how the rent collection dashboard works.&rdquo;'],
    ['Day 5', 'First invoice sent', 'In-app', '&ldquo;Send a tenant invoice to unlock automated reminders and tracking.&rdquo;'],
    ['Day 7', 'Trial midpoint check-in', 'Email', '&ldquo;Halfway through your trial. Here\'s what other firms like yours have set up by Day 7.&rdquo;'],
    ['Day 10', 'Trial ending soon', 'In-app + email', '&ldquo;Your Pro trial ends in 4 days. Locked features after expiry: [list]. Upgrade now to keep them.&rdquo;'],
    ['Day 12', 'Locked features summary', 'Email', '&ldquo;What you\'ll lose on Day 14 if you don\'t upgrade: automated reminders, bulk invoicing, WhatsApp integration.&rdquo;'],
    ['Day 13', 'Last-chance nudge', 'In-app + WhatsApp', '&ldquo;Your trial ends tomorrow. Click here to set up bank transfer and keep all features.&rdquo;'],
    ['Day 14', 'Trial expiry', 'In-app hard gate', '&ldquo;Your trial has ended. You\'re now on Core. Upgrade to restore [features].&rdquo;'],
    ['Day 21', 'Win-back', 'Email', '&ldquo;Miss these features? Here\'s a 7-day extension to finish setting up.&rdquo;'],
]
story.append(make_table(nudge_data, [45, 110, 80, CONTENT_WIDTH-45-110-80]))
story.append(Paragraph('Table 3.3 &mdash; Recommended 14-day trial nudge engine with value-driven milestones.', CAPTION))

story.append(p(
    'The technical implementation is straightforward. Add <font name="DejaVuSans" size="9">trialStartsAt</font> and <font name="DejaVuSans" size="9">trialEndsAt</font> fields to the <font name="DejaVuSans" size="9">firms</font> schema. Set them in <font name="DejaVuSans" size="9">createFirm</font> when the user picks the trial path. Add a daily cron in <font name="DejaVuSans" size="9">convex/crons.ts</font> that scans for trials ending in 4 days, 1 day, and 0 days, and dispatches the appropriate in-app notification + email. The cron should also downgrade expired-trial firms back to Core and clear the trial timestamps. The frontend gate should consult <font name="DejaVuSans" size="9">trialEndsAt</font> in <font name="DejaVuSans" size="9">useFeatures.ts</font> &mdash; if the trial is active, grant the trial plan&rsquo;s entitlements; if expired, fall back to <font name="DejaVuSans" size="9">subscriptionPlan</font>.'
))

story.append(PageBreak())


# ═══════════════════════════════════════════════════════════════
# SECTION 4 — PRODUCT-SPECIFIC POSITIONING STRATEGY
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph('Section 04', ParagraphStyle(
    'SectionLabel', fontName=BOLD_FONT, fontSize=10, leading=14,
    textColor=ACCENT, alignment=TA_LEFT, spaceAfter=2)))
story.append(h1('Product-Specific Positioning Strategy'))

story.append(p(
    'PracticePro operates three products with materially different buyer personas, value propositions, and operating contexts. Treating them identically in onboarding is a conversion-killer. This section breaks down the positioning strategy for each product, with specific recommendations for copy, empty states, and onboarding defaults.'
))

# ── 4.1 Atrium ──
story.append(h2('4.1 Atrium Property OS &mdash; Primary Marketing Focus'))

story.append(p(
    'Atrium is positioned as the Property OS for Nigerian real estate developers, property managers, and estate surveyors. The buyer persona is operationally burdened: they are tracking rents in Excel, invoicing tenants manually in Word, chasing service charge payments by phone, and losing visibility across multiple properties. The onboarding copy must speak directly to these pain points, and the empty states must orient the user toward the highest-leverage first action: adding their first property unit with its rent and tenant.'
))

story.append(p(
    'Today, the Atrium empty state reads &ldquo;No Properties Yet &mdash; Add your first property to start tracking leases, rent payments, and portfolio value&rdquo; with a &ldquo;+ Add Property&rdquo; button. This is functional but generic. The copy should be sharpened to name the pain point directly: &ldquo;Stop tracking rents in Excel. Add your first property and Atrium will set up rent collection, service charge invoicing, and tenant WhatsApp reminders automatically.&rdquo; The CTA button text should change from &ldquo;+ Add Property&rdquo; to &ldquo;+ Add Your First Property&rdquo; to reinforce the onboarding momentum.'
))

story.append(h3('Atrium Onboarding Copy Recommendations'))

atrium_copy = [
    ['Touchpoint', 'Current Copy', 'Recommended Rewrite'],
    ['Wizard Step 1 heading', '&ldquo;Welcome, {name}&rdquo;', '&ldquo;Welcome, {name}. Let\'s set up your property portfolio.&rdquo;'],
    ['Wizard Step 1 subhead', '&ldquo;Initialize your secure workspace.&rdquo;', '&ldquo;Atrium will track rents, invoicing, and tenants across all your properties.&rdquo;'],
    ['Wizard Step 1 firm-name label', '&ldquo;Firm / Organization Name&rdquo;', '&ldquo;Property Company / PM Firm Name&rdquo;'],
    ['Wizard Step 1 placeholder', '&ldquo;e.g. Adeyemi &amp; Co.&rdquo;', '&ldquo;e.g. Landmark Properties, Adeyemi Surveyors&rdquo;'],
    ['Empty state headline', '&ldquo;No Properties Yet&rdquo;', '&ldquo;Stop tracking rents in Excel&rdquo;'],
    ['Empty state body', '&ldquo;Add your first property to start tracking leases...&rdquo;', '&ldquo;Add your first property and Atrium will auto-set rent collection, service charge invoicing, and tenant WhatsApp reminders.&rdquo;'],
    ['First-property CTA', '&ldquo;+ Add Property&rdquo;', '&ldquo;+ Add Your First Property&rdquo;'],
    ['Stats widget zero state', '(empty zeros, no context)', '&ldquo;Your portfolio overview will appear here. Add a property to begin.&rdquo;'],
    ['Recent Properties widget', '&ldquo;No Recent Properties&rdquo; (no CTA)', '&ldquo;No Properties Yet&rdquo; + inline &ldquo;+ Add&rdquo; button'],
    ['Managed Data Migration upsell', '&ldquo;Managed Data Migration (+&#8358;150k)&rdquo;', '&ldquo;We\'ll migrate your Excel rent roll and tenant list for you (+&#8358;150k)&rdquo;'],
]
story.append(make_table(atrium_copy, [120, 130, CONTENT_WIDTH-120-130]))
story.append(Paragraph('Table 4.1 &mdash; Atrium onboarding copy rewrites.', CAPTION))

story.append(p(
    'The Managed Data Migration upsell (₦150k) is currently surfaced as a checkbox in Wizard Step 2 with a generic label. This is a high-value service that should be contextualized: the user has not yet seen the product, so they have no idea how hard manual migration would be. The recommendation is to defer this upsell to the moment the user adds their third property &mdash; at that point they have felt the friction of manual entry, and the migration service is a clear relief rather than an abstract surcharge. The label should also be rewritten to name the specific value: &ldquo;We&rsquo;ll migrate your Excel rent roll and tenant list for you (+&#8358;150k)&rdquo; is materially more compelling than &ldquo;Managed Data Migration&rdquo;.'
))

# ── 4.2 Vega ──
story.append(h2('4.2 Vega Legal &mdash; Distraction-Free Professional Environment'))

story.append(p(
    'Vega serves legal practitioners &mdash; solicitors, advocates, in-house counsel. The buyer persona is sensitive to perceived unprofessionalism and resistant to aggressive SaaS upselling. The onboarding must feel like signing up for a professional tool (think Clio, MyCase, PracticePanther) rather than a consumer app. The empty states should reinforce competence and discretion, and any upgrade prompts should be subtle, contextual, and never interruptive.'
))

story.append(p(
    'Today, Vega inherits the same onboarding wizard as Atrium, which means legal users see property-focused copy in places (&ldquo;Property Company / PM Firm Name&rdquo;) and the same aggressive trial upsell (&ldquo;Want full features? Try Pro free for 14 days&rdquo;). The recommendation is to fork the onboarding copy by product. For Vega, the firm-name label should be &ldquo;Law Firm / Practice Name&rdquo; with placeholder &ldquo;e.g. Adeyemi &amp; Co. Solicitors&rdquo;. The empty state for matters should read &ldquo;No Matters Yet &mdash; Create your first matter to begin tracking deadlines, documents, and billable hours&rdquo;. The trial upsell should be removed from the onboarding flow entirely (per Recommendation 2.3) and surfaced only as a soft gate when the user hits the 10-matter Core limit.'
))

story.append(p(
    'Vega should also have <b>zero upsell prompts</b> in the empty states and the first-run experience. The user is evaluating whether this tool is professional enough for their practice; any &ldquo;Upgrade to Pro&rdquo; banner at this stage will read as desperation. The only acceptable upgrade surface in the first session is a subtle footer link: &ldquo;Using Vega for a larger team? See Pro and Enterprise plans&rdquo;. Once the user has created their first matter, contextual upgrade prompts become acceptable &mdash; but they should always be phrased as &ldquo;You&rsquo;ve reached the Core limit. Upgrade to continue&rdquo; rather than &ldquo;Unlock more with Pro&rdquo;.'
))

# ── 4.3 Komplete ──
story.append(h2('4.3 Komplete Unified &mdash; The Property-Legal Bridge'))

story.append(p(
    'Komplete is positioned as the unified product: property assets and legal matters in a single workspace. The buyer persona is the diversified firm that handles both transactional real estate and the associated legal work &mdash; think estate surveyors who also draft tenancy agreements, or law firms with a real-estate practice. The onboarding must highlight the seamless bridge between the two product surfaces: a property record in Atrium can spawn a legal matter in Vega with a single click, and documents filed against a matter are visible from the property record.'
))

story.append(p(
    'Today, Komplete inherits the same onboarding as the other products and lands on a generic dashboard. The recommendation is to make the bridge explicit in onboarding: after the user creates their first property, the next prompt should be &ldquo;Want to draft the tenancy agreement for this property? Create a linked legal matter&rdquo;. This single flow demonstrates the unique Komplete value proposition in two clicks and is the strongest possible argument for choosing Komplete over buying Atrium and Vega separately.'
))

story.append(callout(
    '<b>Recommendation 4.3 &mdash; Komplete bridge demo.</b> After a Komplete user creates their first property, auto-suggest creating a linked legal matter (tenancy agreement, lease review, etc.). This is the single most important value demonstration for the unified product and is currently missing entirely. Implement as a dismissible banner on the property detail page: &ldquo;This property doesn\'t have a linked legal matter yet. Create one to draft the tenancy agreement and track legal deadlines.&rdquo;',
    'info'
))

story.append(PageBreak())


# ═══════════════════════════════════════════════════════════════
# SECTION 5 — PAYMENT GATEWAY STATUS REPORT
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph('Section 05', ParagraphStyle(
    'SectionLabel', fontName=BOLD_FONT, fontSize=10, leading=14,
    textColor=ACCENT, alignment=TA_LEFT, spaceAfter=2)))
story.append(h1('Payment Gateway Status Report'))

story.append(p(
    'This section answers the user&rsquo;s direct question: <i>are all the payment gateways working fine?</i> The answer is no. Of the four intended payment rails &mdash; Paystack, Flutterwave, Stripe, and manual bank transfer &mdash; <b>zero are working end-to-end</b>. The detailed findings below are organized by gateway, with file paths, line numbers, and code snippets so the engineering team can verify each finding directly.'
))

story.append(callout(
    '<b>Direct answer:</b> <b>None of the four payment gateways are functional end-to-end.</b> Paystack is fully coded but dormant by environment flag, and would not work even if activated due to a missing transaction-reference persistence step. Flutterwave and Stripe have zero implementation code. The manual bank-transfer modal renders correct bank details but writes no record to the database, and for subscription upgrades it immediately flips the firm tier with no verification &mdash; simultaneously a revenue leak and an authorization-bypass security issue.',
    'critical'
))

# ── 5.1 Gateway Inventory ──
story.append(h2('5.1 Gateway-by-Gateway Inventory'))

gateway_data = [
    ['Gateway', 'Code Status', 'Operational?', 'Blocking Issue'],
    ['Paystack', 'Fully coded (initialize, verify, webhook with HMAC-SHA512)', 'Dormant &mdash; env flag PAYSTACK_ENABLED not set', 'No providerReference persistence; window.location.origin server-side bug; webhook only updates invoices, never firm tier'],
    ['Flutterwave', 'No implementation code', 'Not operational', 'Only mentioned in Privacy Policy, DPA, CSP header'],
    ['Stripe', 'No implementation code', 'Not operational', 'Grep hits are PDF table themes (\'striped\'), not Stripe integration'],
    ['Manual Bank Transfer', 'UI renders correct Providus Bank details', 'Partially operational &mdash; revenue leak', 'Writes nothing to DB; for subscription upgrades, instantly flips tier with no verification'],
    ['14-Day Trial', 'Button only &mdash; no backend support', 'Cosmetic / fake', 'No schema fields, no cron, no enforcement, no expiry'],
]
story.append(make_table(gateway_data, [85, 130, 100, CONTENT_WIDTH-85-130-100]))
story.append(Paragraph('Table 5.1 &mdash; Payment gateway inventory with operational status.', CAPTION))

# ── 5.2 Critical Bugs ──
story.append(h2('5.2 Critical Bugs & Revenue Leaks'))

story.append(h3('Bug #1: Self-Service Tier Upgrade with No Payment Verification'))

story.append(p(
    'In <font name="DejaVuSans" size="9">src/components/settings/SubscriptionSettings.tsx</font> at lines 512&ndash;528, the <font name="DejaVuSans" size="9">processUpgrade</font> onConfirm callback calls <font name="DejaVuSans" size="9">onUpdateFirmDetails({ subscriptionPlan: newPlan })</font> immediately. The toast says &ldquo;Upgrade request logged&rdquo; but the code patches the firm&rsquo;s subscription plan in the database instantly. Any user can click &ldquo;Upgrade to Pro&rdquo;, click &ldquo;Report Payment Transferred&rdquo;, click &ldquo;Done&rdquo;, and get Pro features forever without paying. The client-invoice flow had this fixed (see <font name="DejaVuSans" size="9">ClientBillingTab.tsx</font> lines 34&ndash;44), but the subscription flow did not.'
))

story.append(code_block('''// SubscriptionSettings.tsx:512-528 — BROKEN
onConfirm: () => {
    logActivity(`Requested upgrade to ${newPlan} plan (bank transfer)`, ...);
    addToast(`Upgrade request logged. Updating your workspace...`, ...);
    onUpdateFirmDetails({ ...firmDetails, subscriptionPlan: newPlan,
        aiSettings: { ...firmDetails.aiSettings,
          ...(newPlan === SubscriptionPlan.Core ? { enableAllAiFeatures: false } : {})
        } });
}'''))

story.append(h3('Bug #2: Enterprise Activation Has No Payment At All'))

story.append(p(
    'In <font name="DejaVuSans" size="9">SubscriptionSettings.tsx</font> at lines 530&ndash;547, <font name="DejaVuSans" size="9">handleActivateEnterprise</font> grants Enterprise on a plain confirmation dialog. There is no <font name="DejaVuSans" size="9">PaymentGatewayModal</font>, no invoice, no bank transfer report. The user clicks &ldquo;Activate Enterprise&rdquo;, confirms, and gets Enterprise tier permanently.'
))

story.append(h3('Bug #3: updateItem Auth Too Weak for Firm-Tier Changes'))

story.append(p(
    'In <font name="DejaVuSans" size="9">convex/myFunctions.ts</font> at lines 2784&ndash;2834, the <font name="DejaVuSans" size="9">updateItem</font> mutation uses <font name="DejaVuSans" size="9">requireFirmUser</font> (which only verifies membership, not admin role) and <font name="DejaVuSans" size="9">resolveRecordForUpdate</font> skips the firm-id check for firm records (because firms have no <font name="DejaVuSans" size="9">firmId</font> field). Any firm member can patch the firm&rsquo;s <font name="DejaVuSans" size="9">subscriptionPlan</font> field, including non-admin users. This is a privilege-escalation risk in addition to the revenue leak.'
))

story.append(h3('Bug #4: Paystack Reference Not Persisted'))

story.append(p(
    'In <font name="DejaVuSans" size="9">convex/paystack.ts</font> at lines 53&ndash;106, the client-callable <font name="DejaVuSans" size="9">initiateClientPayment</font> action calls Paystack&rsquo;s <font name="DejaVuSans" size="9">/transaction/initialize</font> endpoint and returns the reference to the client, but never writes it to the invoice. Compare to the internal <font name="DejaVuSans" size="9">initiatePaystackPayment</font> (lines 108&ndash;167) which correctly calls <font name="DejaVuSans" size="9">internal.payments.markInvoiceProviderReference</font>. So even if Paystack were activated, when the webhook fires <font name="DejaVuSans" size="9">completePaystackPayment</font> would log &ldquo;No invoice found for reference&rdquo; and the invoice would never be marked Paid.'
))

story.append(h3('Bug #5: window.location.origin Referenced Server-Side'))

story.append(p(
    'In <font name="DejaVuSans" size="9">convex/paystack.ts</font> at line 84, the callback URL is constructed as <font name="DejaVuSans" size="9">process.env.SITE_URL || window.location.origin</font>. In Convex&rsquo;s server runtime, <font name="DejaVuSans" size="9">window</font> is undefined. If <font name="DejaVuSans" size="9">SITE_URL</font> is unset (and it is not in <font name="DejaVuSans" size="9">.env.example</font>), this line throws <font name="DejaVuSans" size="9">ReferenceError: window is not defined</font> the moment a user clicks &ldquo;Pay with Card&rdquo;.'
))

story.append(code_block('''// convex/paystack.ts:83-85 — BUG
body: JSON.stringify({
    email: args.email,
    amount: amountInKobo,
    reference,
    callback_url: `${process.env.SITE_URL || window.location.origin}/billing`,
                                  ^^^^^^^^^^^^^^^^^^^^^^^^
                                  // ReferenceError in Convex server runtime
})'''))

story.append(h3('Bug #6: 14-Day Trial Is Fake'))

story.append(p(
    'In <font name="DejaVuSans" size="9">OnboardingWizard.tsx</font> at lines 492&ndash;498, the &ldquo;Start 14-Day Free Trial&rdquo; button calls <font name="DejaVuSans" size="9">handleCreate()</font>, which calls <font name="DejaVuSans" size="9">createFirm</font> with the selected plan. The backend <font name="DejaVuSans" size="9">createFirm</font> mutation (<font name="DejaVuSans" size="9">myFunctions.ts</font> lines 1705&ndash;1731) sets <font name="DejaVuSans" size="9">subscriptionPlan: args.subscriptionPlan</font> but no <font name="DejaVuSans" size="9">trialStartsAt</font> or <font name="DejaVuSans" size="9">trialEndsAt</font>. No schema field, no read, no cron, no expiration. The trial is permanent full-tier access. A grep for <font name="DejaVuSans" size="9">trialEndsAt|trialStartsAt|trialDays|freeTrial</font> in <font name="DejaVuSans" size="9">convex/</font> returns zero matches.'
))

story.append(h3('Bug #7: Bank Transfer Modal Falls Back to Firm\'s Own Account'))

story.append(p(
    'In <font name="DejaVuSans" size="9">PaymentGatewayModal.tsx</font> at lines 40&ndash;52, the bank account is resolved as <font name="DejaVuSans" size="9">firmDetails.bankAccounts[0]</font> with fallback to the hard-coded PracticePro Providus account. For subscription upgrades, the payment should always go to PracticePro&rsquo;s account. But if a firm has configured its own <font name="DejaVuSans" size="9">bankAccounts[0]</font> (e.g. for invoicing its own clients), the upgrade payment instructions will show the firm&rsquo;s own bank account &mdash; meaning the firm pays itself. The <font name="DejaVuSans" size="9">title</font> and <font name="DejaVuSans" size="9">description</font> props do not disambiguate.'
))

# ── 5.3 Subscription Activation Paths ──
story.append(h2('5.3 Subscription Activation Paths'))

story.append(p(
    'There are three code paths that can flip <font name="DejaVuSans" size="9">firm.subscriptionPlan</font>, with very different trust levels. Understanding these is essential for designing the fix.'
))

paths_data = [
    ['Path', 'Trigger', 'Auth', 'Verification', 'Status'],
    ['A &mdash; Self-service', 'User clicks "Upgrade" in SubscriptionSettings', 'requireFirmUser (any firm member)', 'None &mdash; flips tier immediately on "Report Payment"', 'Broken / insecure'],
    ['B &mdash; Founder admin', 'Founder uses OrganizationsHub', 'requireFounder', 'Manual founder review', 'Working, but disconnected from Path A'],
    ['C &mdash; Paystack webhook', 'Paystack webhook callback', 'HMAC-SHA512 signature', 'Webhook signature verification', 'Dormant &mdash; env flag missing, only updates invoice, never firm tier'],
]
story.append(make_table(paths_data, [85, 130, 90, 110, CONTENT_WIDTH-85-130-90-110]))
story.append(Paragraph('Table 5.2 &mdash; The three subscription-activation code paths.', CAPTION))

story.append(p(
    'The fix is to make Path A write a pending row to a new <font name="DejaVuSans" size="9">subscription_requests</font> table (or repurpose <font name="DejaVuSans" size="9">payment_proofs</font> with a <font name="DejaVuSans" size="9">type: "subscription"</font> discriminator) and surface it in the founder admin dashboard. Only Path B (founder admin) or Path C (Paystack webhook, once fixed) should actually flip the tier. The user should see a &ldquo;Pending verification&rdquo; badge in their settings until the founder confirms the bank transfer, with a 72-hour auto-revert if no confirmation arrives.'
))

story.append(PageBreak())


# ═══════════════════════════════════════════════════════════════
# SECTION 6 — ONBOARDING REFACTOR PLAN
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph('Section 06', ParagraphStyle(
    'SectionLabel', fontName=BOLD_FONT, fontSize=10, leading=14,
    textColor=ACCENT, alignment=TA_LEFT, spaceAfter=2)))
story.append(h1('Onboarding Refactor Plan'))

story.append(p(
    'This section delivers the concrete execution plan structured into the three tracks requested: Immediate UX Quick-Wins, Copy &amp; Value Proposition Enhancements, and a Product-Led Onboarding Redesign. Each track is independently shippable; the three can be developed in parallel by different engineers and merged in sequence.'
))

# ── 6.1 Quick Wins ──
story.append(h2('6.1 Track A &mdash; Immediate UX Quick-Wins'))

story.append(p(
    'These are 5 friction-removal changes that can each ship in under 2 hours of engineering time and have measurable impact on conversion. They are listed in priority order.'
))

quick_wins = [
    ['#', 'Quick-Win', 'Effort', 'Impact'],
    ['A1', 'Add a 30-second timeout to the createFirm mutation in useFirm.ts. On timeout, surface a "Connection issue &mdash; your workspace may still have been created" message with a "Recover Connection" button (which already exists in Step 1).', '2h', 'Eliminates the "stuck on Creating" bug &mdash; the most-reported onboarding failure'],
    ['A2', 'Wire the real PaymentGatewayModal.tsx into OnboardingWizard\'s "Pay Now" path. Replace the stub "Payment Reported" modal. Pass amount, plan name, and a generated transaction reference.', '3h', 'Users see actual bank details, amount, and reference &mdash; eliminates trust leak at the highest-intent moment'],
    ['A3', 'Fix the plan selection language: Step 2 primary button should say "Confirm Plan &mdash; {PlanName}" (not "Pay Now"), and the heading should say "You\'ve Selected {PlanName}" (not "Your {Plan} Plan"). When the user clicks "Compare with other plans" and selects a different tier, reset showAllPlans to false so they see the newly-selected tier centered.', '1h', 'Eliminates the cognitive disconnect where Step 1 promises "Confirm Plan" but Step 2 says "Pay Now"'],
    ['A4', 'Add a first-run welcome banner on the Dashboard: "Welcome to PracticePro, {firstName}. Here\'s how to get started in 60 seconds:" with 3 contextual steps. Auto-dismiss after 10s or on first interaction.', '2h', 'Eliminates the "landed on dashboard with all-zero stats, no idea what to do" experience'],
    ['A5', 'Auto-open the "New Matter" (Vega/Komplete) or "Add Property" (Atrium/Komplete) modal on the first dashboard load if the user has zero records. Dismissible with one click.', '2h', 'Cuts 2 clicks off Time-to-Value; aligns with Linear/Notion first-run pattern'],
]
story.append(make_table(quick_wins, [22, CONTENT_WIDTH-22-50-90, 50, 90]))
story.append(Paragraph('Table 6.1 &mdash; Track A: Immediate UX quick-wins (under 2h each).', CAPTION))

# ── 6.2 Copy ──
story.append(h2('6.2 Track B &mdash; Copy & Value Proposition Enhancements'))

story.append(p(
    'These are specific rewrites for onboarding headings, tooltips, empty states, and payment confirmation screens. Each rewrite is grounded in the actual current copy extracted from the codebase, with the proposed replacement alongside. The rewrites are tuned for the Nigerian market and the three product personas.'
))

story.append(h3('Onboarding Wizard Headings'))

copy_rewrites = [
    ['Location', 'Current Copy', 'Proposed Rewrite'],
    ['Step 1 heading', '&ldquo;Welcome, {firstName}&rdquo;', 'Vega: &ldquo;Welcome, {firstName}. Let\'s set up your practice.&rdquo; / Atrium: &ldquo;Welcome, {firstName}. Let\'s set up your portfolio.&rdquo; / Komplete: &ldquo;Welcome, {firstName}. Let\'s set up your unified workspace.&rdquo;'],
    ['Step 1 subhead', '&ldquo;Initialize your secure workspace.&rdquo;', '&ldquo;Atrium tracks rents, invoicing, and tenants across all your properties.&rdquo; (or Vega/Komplete equivalent)'],
    ['Step 1 firm-name label', '&ldquo;Firm / Organization Name&rdquo;', 'Vega: &ldquo;Law Firm / Practice Name&rdquo; / Atrium: &ldquo;Property Company / PM Firm Name&rdquo; / Komplete: &ldquo;Firm / Organization Name&rdquo;'],
    ['Step 2 heading (default)', '&ldquo;Your {Tier} Plan&rdquo;', '&ldquo;You\'ve Selected {TierName}&rdquo;'],
    ['Step 2 heading (compare)', '&ldquo;Compare Plans&rdquo;', '&ldquo;Compare Plans &mdash; Pick What Fits Your Practice&rdquo;'],
    ['Step 2 subhead', '&ldquo;For your {product} workspace at {firmName}&rdquo;', 'Keep &mdash; clear and contextual'],
    ['Step 2 primary CTA', '&ldquo;Pay Now &mdash; {planLabel}&rdquo;', '&ldquo;Confirm Plan &mdash; {planLabel}&rdquo; (and on click, open the real PaymentGatewayModal)'],
    ['Step 2 secondary CTA', '&ldquo;Start 14-Day Free Trial&rdquo;', '<b>Remove from onboarding entirely.</b> Defer to first soft-gate moment per Recommendation 2.3'],
    ['Step 2 highest-tier notice', '&ldquo;The {planLabel} tier requires payment to activate. Click \'Pay Now\' to proceed with bank transfer.&rdquo;', '&ldquo;{planLabel} is our top tier. We\'ll send you bank-transfer details &mdash; your workspace activates the moment we confirm.&rdquo;'],
    ['Step 2 Core upsell', '&ldquo;Want full features? Try Pro free for 14 days instead.&rdquo;', '<b>Remove from onboarding.</b> Surface as in-app upgrade prompt at first soft-gate moment'],
    ['Step 2 DPA label', '&ldquo;I agree to the Data Protection Agreement and Terms of Service. Data is processed per Nigerian standards.&rdquo;', 'Keep wording; move above plan cards; make click-through rather than checkbox'],
]
story.append(make_table(copy_rewrites, [110, 130, CONTENT_WIDTH-110-130]))
story.append(Paragraph('Table 6.2 &mdash; Onboarding wizard copy rewrites.', CAPTION))

story.append(h3('Empty States'))

empty_states = [
    ['Surface', 'Current Empty State', 'Proposed Rewrite'],
    ['Vega Matters list', '&ldquo;No Matters Found / Create your first matter to get started.&rdquo;', '&ldquo;No Matters Yet &mdash; Create your first matter to begin tracking deadlines, documents, and billable hours.&rdquo;'],
    ['Atrium Properties list', '&ldquo;No Properties Yet / Add your first property to start tracking leases, rent payments, and portfolio value.&rdquo;', '&ldquo;Stop tracking rents in Excel &mdash; Add your first property and Atrium will auto-set rent collection, service charge invoicing, and tenant WhatsApp reminders.&rdquo;'],
    ['Dashboard Recent Matters widget', '&ldquo;No Active Matters&rdquo; + [+ Create]', '&ldquo;No Active Matters &mdash; Create one to see it here.&rdquo; + [Create Your First Matter]'],
    ['Dashboard Recent Properties widget', '&ldquo;No Recent Properties&rdquo; (no CTA)', '&ldquo;No Properties Yet&rdquo; + inline [+ Add Your First Property]'],
    ['Dashboard top welcome', '&ldquo;Good day, {firstName}.&rdquo;', '&ldquo;Welcome to PracticePro, {firstName} &mdash; here\'s how to get started in 60 seconds:&rdquo; (with 3 steps)'],
    ['Trial expired state', '(does not exist)', '&ldquo;Your 14-day trial has ended. You\'re now on Core. [Upgrade to {trial plan}] to restore [features].&rdquo;'],
    ['Pending payment state', '(does not exist)', '&ldquo;Payment verification in progress. Your reference is PP-{ref}. We\'ll confirm within 24 hours.&rdquo;'],
]
story.append(make_table(empty_states, [110, 130, CONTENT_WIDTH-110-130]))
story.append(Paragraph('Table 6.3 &mdash; Empty-state copy rewrites.', CAPTION))

story.append(h3('Payment Confirmation Screens'))

story.append(p(
    'The current payment-confirmation modal says &ldquo;Payment Reported &mdash; PracticePro will verify your bank transfer and update your organization invoice status within 24 hours&rdquo; with a &ldquo;Continue to Workspace&rdquo; button. This is dismissive and uninformative. The recommended rewrite surfaces the reference, the amount, and the verification window explicitly, and reassures the user that they can continue working during verification.'
))

story.append(callout(
    '<b>Recommended payment-confirmation modal:</b><br/><br/>'
    '<b>Payment Reported &mdash; Reference PP-{firmId}-{timestamp}</b><br/><br/>'
    'We\'ve recorded your bank transfer of <b>&#8358;{amount}</b> to Providus Bank (1203984572, PracticePro Systems Ltd). Your reference is <b>PP-{ref}</b> &mdash; keep this for your records.<br/><br/>'
    'Our team will verify your transfer within 24 hours. You can continue using {planName} features in the meantime. We\'ll email you at {email} the moment your workspace is fully activated.<br/><br/>'
    '<b>[Continue to Workspace]</b> &nbsp; <b>[Upload Payment Receipt]</b>',
    'info'
))

# ── 6.3 PLG Redesign ──
story.append(h2('6.3 Track C &mdash; Product-Led Onboarding Redesign'))

story.append(p(
    'This track is the strategic redesign: a streamlined 3-step setup wizard that drastically cuts Time-to-Value. The current 2-step wizard compresses firm setup and plan selection, but it still front-loads the billing decision before the user has seen any product value. The proposed redesign inverts that order: the user creates their workspace at Core, lands on the dashboard, experiences first value, and only then encounters the upgrade prompt as a contextual soft gate.'
))

story.append(h3('Proposed 3-Step Wizard'))

wizard_data = [
    ['Step', 'Purpose', 'Time', 'Mandatory Inputs', 'Output'],
    ['1. Verify', 'Email verification', '~30s', '4-digit code (auto-advance)', 'Authenticated session'],
    ['2. Name workspace', 'Create firm at Core tier', '~15s', 'Firm name (autosuggested from email domain)', 'Firm created at Core; user lands on dashboard'],
    ['3. First value', 'Guided first action', '~60s', 'Click "Create first matter/property"', 'User reaches Aha! moment'],
    ['(Deferred)', 'Plan upgrade', '~30s when triggered', 'Triggered by first soft-gate hit', 'User upgrades with full context'],
]
story.append(make_table(wizard_data, [70, 110, 50, 130, CONTENT_WIDTH-70-110-50-130]))
story.append(Paragraph('Table 6.4 &mdash; Proposed 3-step wizard with deferred billing.', CAPTION))

story.append(p(
    'The flow is: user signs up &rarr; verifies email with a 4-digit code (down from 6) &rarr; types or confirms firm name (autosuggested from email domain) &rarr; clicks &ldquo;Create Workspace&rdquo; &rarr; lands on dashboard at Core tier &rarr; sees a first-run banner with 3 contextual steps &rarr; auto-opens the &ldquo;Create first matter/property&rdquo; modal &rarr; user creates their first record &rarr; Aha! moment achieved &rarr; user continues working &rarr; eventually hits a tier limit (10 matters on Core, or attempts to invite a teammate) &rarr; soft-gate modal: &ldquo;You\'ve reached the Core limit. Upgrade to Growth for unlimited matters and 5 seats &mdash; or start a 14-day Pro trial.&rdquo;'
))

story.append(h3('Soft-Gate Trigger Points'))

soft_gates = [
    ['Trigger', 'Tier Required', 'Message'],
    ['User creates 11th matter on Core', 'Growth+', '&ldquo;You\'ve reached the 10-matter Core limit. Upgrade to Growth for unlimited matters.&rdquo;'],
    ['User attempts to invite 2nd teammate on Core', 'Growth+', '&ldquo;Core includes 1 seat. Upgrade to Growth for 5 seats, or Pro for unlimited.&rdquo;'],
    ['User attempts bulk invoicing (Atrium)', 'Pro+', '&ldquo;Bulk invoicing is a Pro feature. Upgrade to send invoices to all tenants at once.&rdquo;'],
    ['User attempts WhatsApp automation beyond 100/mo (Atrium Core)', 'Growth+', '&ldquo;You\'ve sent 100 WhatsApp messages this month (Core limit). Upgrade for higher limits.&rdquo;'],
    ['User attempts to add 11th unit on Atrium Core', 'Growth+', '&ldquo;You\'ve reached the 10-unit Core limit. Upgrade to Growth for 25 units.&rdquo;'],
    ['User attempts AI document generation (Vega)', 'Growth+', '&ldquo;AI document drafting is a Growth feature. Upgrade to unlock.&rdquo;'],
    ['User attempts to add 6th teammate on Growth', 'Pro+', '&ldquo;Growth includes 5 seats. Upgrade to Pro for unlimited seats.&rdquo;'],
    ['User crosses 100-unit portfolio on Atrium Pro', 'Enterprise', '&ldquo;Portfolios over 100 units qualify for Enterprise. Contact us for custom pricing.&rdquo;'],
]
story.append(make_table(soft_gates, [180, 75, CONTENT_WIDTH-180-75]))
story.append(Paragraph('Table 6.5 &mdash; Soft-gate trigger points with contextual upgrade messages.', CAPTION))

story.append(p(
    'The key principle is that every soft-gate message names the specific value the user is trying to unlock and offers two paths: pay now (bank transfer, with the real modal) or start a 14-day trial of the target tier. This is the moment of highest intent &mdash; the user has just demonstrated they want this specific feature &mdash; and the conversion rate at this moment is materially higher than at cold onboarding.'
))

story.append(PageBreak())


# ═══════════════════════════════════════════════════════════════
# SECTION 7 — IMPLEMENTATION ROADMAP
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph('Section 07', ParagraphStyle(
    'SectionLabel', fontName=BOLD_FONT, fontSize=10, leading=14,
    textColor=ACCENT, alignment=TA_LEFT, spaceAfter=2)))
story.append(h1('Implementation Roadmap'))

story.append(p(
    'The remediation work is sequenced below in priority order. The three tracks can be developed in parallel by different engineers, but Track A (Revenue Protection) must reach production before any further marketing spend drives traffic into the current leaky funnel. Track B (Trial System) and Track C (Onboarding Polish) can ship in the following sprint cycle.'
))

roadmap_data = [
    ['Priority', 'Item', 'Track', 'Effort', 'Dependency'],
    ['P0', 'Stop the revenue leak: change SubscriptionSettings.processUpgrade to write a pending subscription_requests row, not flip tier', 'A', '4h', 'None'],
    ['P0', 'Gate updateItem mutation for firms: require requireAdmin, reject client-supplied subscriptionPlan/setupFeePaid fields', 'A', '3h', 'None'],
    ['P0', 'Wire PaymentGatewayModal.tsx into OnboardingWizard "Pay Now" path', 'A', '3h', 'None'],
    ['P0', 'Always use PracticePro\'s Providus account for subscription upgrades (forcePracticeProAccount prop)', 'A', '1h', 'None'],
    ['P0', 'Add 30s timeout to createFirm mutation; surface "Recover Connection" on timeout', 'A', '2h', 'None'],
    ['P1', 'Add trialStartsAt, trialEndsAt, trialPlan fields to firms schema', 'B', '2h', 'None'],
    ['P1', 'Update createFirm to accept trial flag; set trial timestamps when true', 'B', '3h', 'Schema migration'],
    ['P1', 'Add daily expireTrials cron in convex/crons.ts', 'B', '3h', 'Schema fields'],
    ['P1', 'Update useFeatures.ts to consult trialEndsAt/trialPlan', 'B', '2h', 'Schema fields'],
    ['P1', 'Implement trial nudge engine (10 milestones across 14 days)', 'B', '8h', 'Trial system live'],
    ['P1', 'Fix Paystack window.location.origin server-side bug', 'A', '0.5h', 'None'],
    ['P1', 'Fix Paystack providerReference persistence (use initiatePaystackPayment internal action)', 'A', '2h', 'None'],
    ['P1', 'Add activateFirmSubscription mutation; wire into Paystack webhook', 'A', '4h', 'Paystack fixes'],
    ['P2', 'Add portfolio-size anchors to tier cards (Table 3.1)', 'C', '2h', 'None'],
    ['P2', 'Fix plan-selection language (Confirm Plan, not Pay Now)', 'C', '1h', 'None'],
    ['P2', 'Auto-reset showAllPlans to false when user returns to plan step', 'C', '0.5h', 'None'],
    ['P2', 'Add first-run dashboard welcome banner', 'C', '2h', 'None'],
    ['P2', 'Auto-open create modal on first dashboard load if zero records', 'C', '2h', 'None'],
    ['P2', 'Add CTA to Recent Properties widget empty state', 'C', '0.5h', 'None'],
    ['P2', 'Fork onboarding copy by product (Vega vs Atrium vs Komplete)', 'C', '4h', 'None'],
    ['P2', 'Implement soft-gate trigger points (Table 6.5)', 'C', '8h', 'Trial system live'],
    ['P3', 'Activate Paystack env vars (PAYSTACK_ENABLED, PAYSTACK_SECRET_KEY, SITE_URL)', 'A', '1h', 'Paystack fixes verified'],
    ['P3', 'Add proof-of-payment upload field to PaymentGatewayModal', 'A', '3h', 'None'],
    ['P3', 'Add admin notification on payment report (founder dashboard)', 'A', '2h', 'Pending-state infrastructure'],
    ['P3', 'Add auto-revert of pending upgrades after 72h', 'B', '2h', 'Cron infrastructure'],
    ['P3', 'Komplete bridge demo (auto-suggest linked legal matter)', 'C', '4h', 'None'],
    ['P3', 'Defer Managed Data Migration upsell to post-onboarding', 'C', '2h', 'None'],
    ['P3', 'Add missing firms schema fields (billingInterval, nextBillingDate, adminStatus)', 'A', '2h', 'None'],
    ['P4', 'Remove dead code in payments.ts (manualMarkAsPaid, manualRevertPayment, etc.)', 'A', '1h', 'None'],
    ['P4', 'Remove hard-coded Gemini API key in convex/http.ts line 39', 'A', '0.5h', 'None'],
    ['P4', 'Update .env.example with PAYSTACK_* and SITE_URL entries', 'A', '0.5h', 'None'],
]
story.append(make_table(roadmap_data, [40, CONTENT_WIDTH-40-50-50-65, 50, 50, 65]))
story.append(Paragraph('Table 7.1 &mdash; Implementation roadmap, priority-ordered.', CAPTION))

story.append(h2('Estimated Timeline'))

story.append(p(
    'The P0 items collectively represent roughly 13 hours of engineering work and should ship within 1&ndash;2 business days. They stop the revenue leak and the authorization-bypass issue, which are the only items in this audit that constitute an active security incident. The P1 items (roughly 22 hours) ship the trial system, the nudge engine, and the Paystack fixes &mdash; these are the strategic revenue investments. The P2 items (roughly 20 hours) are the onboarding polish from Track C. P3 and P4 are clean-up work that can ship opportunistically over the following sprint.'
))

story.append(callout(
    '<b>Recommended sequencing:</b><br/>'
    '&bull; <b>Day 1&ndash;2:</b> All P0 items (revenue protection + "stuck on Creating" fix).<br/>'
    '&bull; <b>Day 3&ndash;5:</b> All P1 items (trial system, nudge engine, Paystack fixes).<br/>'
    '&bull; <b>Day 6&ndash;8:</b> All P2 items (onboarding polish, copy rewrites, soft gates).<br/>'
    '&bull; <b>Day 9&ndash;12:</b> P3 and P4 items (clean-up, admin tooling, schema hardening).<br/><br/>'
    'Total estimated engineering time: ~70 hours across 2 weeks. The team can parallelize across the three tracks with one engineer per track, in which case the calendar time compresses to ~8 working days.',
    'success'
))

story.append(PageBreak())


# ═══════════════════════════════════════════════════════════════
# SECTION 8 — APPENDIX
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph('Section 08', ParagraphStyle(
    'SectionLabel', fontName=BOLD_FONT, fontSize=10, leading=14,
    textColor=ACCENT, alignment=TA_LEFT, spaceAfter=2)))
story.append(h1('Appendix &mdash; File-Level Findings'))

story.append(p(
    'This appendix provides the file-level inventory that backs the findings in this report. Each row identifies a specific file, its current status, and the audit notes. This is provided so the engineering team can verify each finding directly against the codebase.'
))

appendix_data = [
    ['#', 'File', 'Status', 'Notes'],
    ['1', 'convex/paystack.ts', 'Partial / dormant', 'Full Paystack integration coded but never active. window.location.origin bug at line 84. Client action skips DB reference write.'],
    ['2', 'convex/payments.ts', 'Partial / mostly dead', 'manualMarkAsPaid, manualRevertPayment, getPaymentProviderStatus, initiatePaystackPayment, verifyPaystackPayment defined but never called. Only completePaystackPayment wired (via webhook, dormant).'],
    ['3', 'convex/http.ts', 'Working (structural)', 'Routes /paystack/webhook correctly. Returns 503 when key missing. Hard-coded Gemini API key fallback at line 39 (separate security issue).'],
    ['4', 'src/components/modals/PaymentGatewayModal.tsx', 'Partial', 'Renders correct Providus Bank details. "Report Payment Transferred" only changes local UI state. Trust-model fix only applied for client invoices, not subscription upgrades.'],
    ['5', 'src/components/settings/SubscriptionSettings.tsx', 'Critical bug', 'processUpgrade immediately flips subscriptionPlan on "Report Payment Transferred". handleActivateEnterprise grants Enterprise with no payment at all.'],
    ['6', 'src/components/modals/OnboardingWizard.tsx', 'Stub / partial', '"Start 14-Day Free Trial" button calls handleCreate() &mdash; no trial tracking. "Pay Now" path shows stub modal, not PaymentGatewayModal.'],
    ['7', 'src/components/client/ClientBillingTab.tsx', 'Working (fixed)', 'Trust-model fix applied: client click no longer auto-flips invoice to Paid.'],
    ['8', 'convex/tierLimits.ts', 'Working', 'Pure tier-limit lookup tables. No issues.'],
    ['9', 'convex/founderMetrics.ts (updateFirmAdminSettings)', 'Working', 'Legitimate founder-only manual tier-flip path, gated by requireFounder. Not wired to user upgrade flow.'],
    ['10', 'convex/myFunctions.ts (createFirm)', 'Partial', 'Sets subscriptionPlan from client-supplied value with no validation. Sets setupFeePaid. No trial fields set.'],
    ['11', 'convex/myFunctions.ts (updateItem)', 'Security bug', 'Uses requireFirmUser (not requireAdmin). resolveRecordForUpdate skips firm-id check for firm records. Any firm member can patch subscriptionPlan.'],
    ['12', 'convex/schema.ts (firms table)', 'Missing fields', 'Has subscriptionPlan, setupFeePaid, bankAccounts. Missing: trialStartsAt, trialEndsAt, billingInterval, nextBillingDate, adminStatus, lastActive.'],
    ['13', 'convex/schema.ts (invoices table)', 'Working (ready)', 'Has provider, providerReference, paymentMethod + by_provider_reference index. Structurally Paystack-ready but unused.'],
    ['14', 'convex/schema.ts (payment_proofs table)', 'Unrelated', 'Atrium tenant rent proof uploads. Not used for SaaS subscription upgrades &mdash; but can be repurposed.'],
    ['15', 'convex/retainerBilling.ts', 'Unrelated', 'Firm-internal legal retainer invoicing. Not SaaS billing.'],
    ['16', 'convex/trustAccount.ts', 'Unrelated', 'Firm-internal legal trust accounting. Not SaaS billing.'],
    ['17', 'convex/crons.ts', 'Missing', 'No trial-expiration cron. No subscription-renewal cron. No PracticePro-platform invoice-generation cron.'],
    ['18', '.env.example', 'Missing', 'No PAYSTACK_ENABLED, PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY, or SITE_URL entries.'],
    ['19', 'index.html (CSP)', 'Working', 'Allows api.paystack.co and api.flutterwave.com (forward-looking).'],
    ['20', 'src/components/modals/UpgradeModal.tsx', 'Stub', 'Shows "Start 14-Day Free Trial" button, but onUpgrade callback only navigates to settings &mdash; does not actually start a trial.'],
    ['21', 'src/components/modals/ModalManager.tsx', 'Wiring gap', 'onUpgrade callback at line 856 navigates to settings, does not invoke a startTrial mutation.'],
    ['22', 'src/hooks/useFeatures.ts', 'Trial-unaware', 'Derives tier booleans from subscriptionPlan only. Never checks trial status.'],
    ['23', 'src/components/FeatureGuard.tsx', 'Product-only gate', 'Gates by product (legal/atrium/unified), not by tier. No trial awareness.'],
    ['24', 'src/components/Dashboard.tsx', 'No first-run', 'No first-time-user welcome/CTA at dashboard level. Stats widget shows all zeros with no context.'],
    ['25', 'src/components/MatterList.tsx', 'Working empty state', '"No Matters Found / Create your first matter" + [New Matter] CTA. Good pattern.'],
    ['26', 'src/components/PropertyManagerView.tsx', 'Working empty state', '"No Properties Yet" + [+ Add Property] CTA. Good pattern but generic copy.'],
    ['27', 'src/components/dashboard/RecentPropertiesWidget.tsx', 'Missing CTA', '"No Recent Properties" with no button. User must navigate to Properties view to find + Add Property.'],
    ['28', 'src/components/auth/Signup.tsx', 'Functional', '4-step flow (product_selection, form, verify, restore). Password requirements overly strict (5 rules, only shown after invalid).'],
    ['29', 'src/contexts/AuthContext.tsx (refreshUser)', 'Misleadingly named', 'Calls repairAccountMutation without targetFirmId &mdash; returns immediately with MANUAL_SELECTION_REQUIRED. The 10s timeout in OnboardingWizard protects a call that does not hang.'],
    ['30', 'src/constants/tiers.ts', 'Well-structured', 'Three product matrices defined. Missing trialEligible field on TierDef. Recommended badge on Atrium Pro may be steering users upmarket.'],
]
story.append(make_table(appendix_data, [22, 130, 70, CONTENT_WIDTH-22-130-70]))
story.append(Paragraph('Table 8.1 &mdash; File-level findings inventory.', CAPTION))

story.append(h2('Audit Methodology'))

story.append(p(
    'This audit was conducted via three parallel code-investigation streams, each focused on a specific surface of the system: payment gateway implementations, onboarding wizard flow, and trial/tier-rule logic. Each stream read the actual file contents end-to-end (not grep-only) and produced evidence-backed findings with file paths and line numbers. The strategic recommendations in Sections 2&ndash;6 are derived from those findings, not from generic industry benchmarks.'
))

story.append(p(
    'The audit covered the live <font name="DejaVuSans" size="9">src/</font> and <font name="DejaVuSans" size="9">convex/</font> trees at <font name="DejaVuSans" size="9">/home/z/my-project/</font>. A separate <font name="DejaVuSans" size="9">codebase_audit/pp/</font> mirror exists but was excluded as non-authoritative. The Convex schema, mutations, queries, internal actions, and cron definitions were all inspected. The React component tree was traced from <font name="DejaVuSans" size="9">App.tsx</font> through <font name="DejaVuSans" size="9">AuthContext</font>, <font name="DejaVuSans" size="9">Signup</font>, <font name="DejaVuSans" size="9">OnboardingWizard</font>, <font name="DejaVuSans" size="9">Dashboard</font>, and the per-product empty states.'
))

story.append(h2('Glossary'))

glossary_data = [
    ['Term', 'Definition'],
    ['TTV', 'Time-to-Value &mdash; the elapsed time (or click count) from sign-up to the user\'s first "Aha!" moment with the product.'],
    ['CRO', 'Conversion Rate Optimization &mdash; the discipline of reducing friction in the user-acquisition funnel to improve the percentage of visitors who become paying customers.'],
    ['PLG', 'Product-Led Growth &mdash; a go-to-market strategy where the product itself (not sales or marketing) is the primary driver of acquisition, retention, and expansion.'],
    ['Soft gate', 'A feature limit that surfaces an upgrade prompt but allows the user to continue using the product. Opposite of a hard gate, which blocks all use until upgrade.'],
    ['Hard gate', 'A feature limit that blocks all product use until the user upgrades. PracticePro currently has no hard gates.'],
    ['Progressive profiling', 'A pattern where qualification questions are asked at the moment they become relevant, rather than all upfront at sign-up.'],
    ['Trial-to-Paid conversion', 'The percentage of users who start a free trial and convert to a paid subscription before or at trial expiry.'],
    ['Nudge engine', 'A system of automated, value-driven in-app messages timed to specific user milestones during the trial period.'],
    ['Bank-transfer reference', 'A unique identifier (e.g. PP-{firmId}-{timestamp}) that links a manual bank deposit to a specific firm\'s subscription upgrade request.'],
    ['Convex reactive subscription', 'A real-time data feed from the Convex backend to the React frontend that automatically updates when the underlying data changes.'],
]
story.append(make_table(glossary_data, [115, CONTENT_WIDTH-115]))
story.append(Paragraph('Table 8.2 &mdash; Glossary of audit terminology.', CAPTION))


# ═══════════════════════════════════════════════════════════════
# BUILD
# ═══════════════════════════════════════════════════════════════
output_path = "/home/z/my-project/scripts/cro_audit_body.pdf"
doc = TocDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=20*mm, rightMargin=20*mm,
    topMargin=20*mm, bottomMargin=20*mm,
    title="PracticePro CRO & PLG Audit",
    author="Z.ai",
    creator="Z.ai",
    subject="Conversion Rate Optimization and Onboarding Audit"
)

doc.multiBuild(story, onFirstPage=header_footer, onLaterPages=header_footer)

print(f"✓ Body PDF generated: {output_path}")
print(f"  Size: {os.path.getsize(output_path) / 1024:.1f} KB")
