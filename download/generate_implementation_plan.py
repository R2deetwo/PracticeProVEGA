#!/usr/bin/env python3
"""
Implementation Plan - PDF Generator
AntiGravity Handoff Document for Legal Tech App (Atrium/PracticePro)
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, CondPageBreak, Flowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import SimpleDocTemplate
import hashlib

# ━━ Color Palette ━━
ACCENT       = colors.HexColor('#1e94bc')
TEXT_PRIMARY  = colors.HexColor('#1c1d1f')
TEXT_MUTED    = colors.HexColor('#7e848b')
BG_SURFACE   = colors.HexColor('#d5dae1')
BG_PAGE      = colors.HexColor('#eff0f2')
CRITICAL_RED = colors.HexColor('#dc2626')
HIGH_ORANGE  = colors.HexColor('#ea580c')
MEDIUM_YELLOW = colors.HexColor('#ca8a04')
LOW_GREEN    = colors.HexColor('#16a34a')
PHASE_1_COLOR = colors.HexColor('#dc2626')
PHASE_2_COLOR = colors.HexColor('#ea580c')
PHASE_3_COLOR = colors.HexColor('#1e94bc')
PHASE_4_COLOR = colors.HexColor('#7c3aed')
PHASE_5_COLOR = colors.HexColor('#16a34a')

TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = BG_SURFACE

# ━━ Font Registration ━━
pdfmetrics.registerFont(TTFont('Serif', '/usr/share/fonts/truetype/chinese/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Sans', '/usr/share/fonts/truetype/chinese/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Mono', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('MonoBold', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansBold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
registerFontFamily('Serif', normal='Serif', bold='Serif')
registerFontFamily('Sans', normal='Sans', bold='Sans')
registerFontFamily('Mono', normal='Mono', bold='MonoBold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSansBold')

# ━━ Page Setup ━━
PAGE_W, PAGE_H = A4
LEFT_MARGIN = 1.0 * inch
RIGHT_MARGIN = 1.0 * inch
TOP_MARGIN = 0.8 * inch
BOTTOM_MARGIN = 0.8 * inch
CONTENT_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

# ━━ Styles ━━
styles = getSampleStyleSheet()

cover_title = ParagraphStyle(
    'CoverTitle', fontName='Serif', fontSize=34,
    leading=42, alignment=TA_LEFT, textColor=TEXT_PRIMARY,
    spaceAfter=10
)
cover_subtitle = ParagraphStyle(
    'CoverSubtitle', fontName='Serif', fontSize=17,
    leading=24, alignment=TA_LEFT, textColor=ACCENT,
    spaceAfter=8
)
cover_meta = ParagraphStyle(
    'CoverMeta', fontName='Serif', fontSize=11.5,
    leading=17, alignment=TA_LEFT, textColor=TEXT_MUTED,
    spaceAfter=6
)
h1_style = ParagraphStyle(
    'H1', fontName='Serif', fontSize=19,
    leading=26, alignment=TA_LEFT, textColor=TEXT_PRIMARY,
    spaceBefore=16, spaceAfter=8
)
h2_style = ParagraphStyle(
    'H2', fontName='Serif', fontSize=15,
    leading=21, alignment=TA_LEFT, textColor=ACCENT,
    spaceBefore=12, spaceAfter=6
)
h3_style = ParagraphStyle(
    'H3', fontName='Serif', fontSize=12.5,
    leading=17, alignment=TA_LEFT, textColor=TEXT_PRIMARY,
    spaceBefore=8, spaceAfter=5
)
body_style = ParagraphStyle(
    'Body', fontName='Serif', fontSize=10.5,
    leading=17, alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY,
    spaceBefore=2, spaceAfter=6
)
body_left = ParagraphStyle(
    'BodyLeft', fontName='Serif', fontSize=10.5,
    leading=17, alignment=TA_LEFT, textColor=TEXT_PRIMARY,
    spaceBefore=2, spaceAfter=6
)
bullet_style = ParagraphStyle(
    'Bullet', fontName='Serif', fontSize=10.5,
    leading=17, alignment=TA_LEFT, textColor=TEXT_PRIMARY,
    leftIndent=18, bulletIndent=6, spaceBefore=2, spaceAfter=4
)
sub_bullet = ParagraphStyle(
    'SubBullet', fontName='Serif', fontSize=10,
    leading=16, alignment=TA_LEFT, textColor=TEXT_MUTED,
    leftIndent=36, bulletIndent=22, spaceBefore=1, spaceAfter=3
)
callout_style = ParagraphStyle(
    'Callout', fontName='Serif', fontSize=10.5,
    leading=17, alignment=TA_LEFT, textColor=TEXT_PRIMARY,
    leftIndent=24, borderPadding=8, spaceBefore=6, spaceAfter=6,
    backColor=colors.HexColor('#f0f7fa'), borderColor=ACCENT, borderRadius=2
)
warning_style = ParagraphStyle(
    'Warning', fontName='Serif', fontSize=10.5,
    leading=17, alignment=TA_LEFT, textColor=colors.HexColor('#92400e'),
    leftIndent=24, borderPadding=8, spaceBefore=6, spaceAfter=6,
    backColor=colors.HexColor('#fef3c7'), borderColor=MEDIUM_YELLOW, borderRadius=2
)
caption_style = ParagraphStyle(
    'Caption', fontName='Serif', fontSize=9,
    leading=13, alignment=TA_CENTER, textColor=TEXT_MUTED,
    spaceBefore=3, spaceAfter=6
)
phase_header = ParagraphStyle(
    'PhaseHeader', fontName='DejaVuSans', fontSize=13,
    leading=18, alignment=TA_LEFT, textColor=colors.white,
    spaceBefore=0, spaceAfter=0
)
task_style = ParagraphStyle(
    'Task', fontName='Serif', fontSize=10,
    leading=15, alignment=TA_LEFT, textColor=TEXT_PRIMARY,
    leftIndent=6, spaceBefore=2, spaceAfter=2
)
task_detail = ParagraphStyle(
    'TaskDetail', fontName='Serif', fontSize=9.5,
    leading=14, alignment=TA_LEFT, textColor=TEXT_MUTED,
    leftIndent=6, spaceBefore=0, spaceAfter=2
)

# Table cell styles
header_cell = ParagraphStyle(
    'HeaderCell', fontName='DejaVuSans', fontSize=9.5,
    textColor=colors.white, alignment=TA_CENTER, leading=13,
    spaceBefore=0, spaceAfter=0
)
cell_style = ParagraphStyle(
    'CellStyle', fontName='Serif', fontSize=9.5,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, leading=14,
    spaceBefore=0, spaceAfter=0
)
cell_center = ParagraphStyle(
    'CellCenter', fontName='Serif', fontSize=9.5,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER, leading=14,
    spaceBefore=0, spaceAfter=0
)
toc_h1 = ParagraphStyle(
    'TOCH1', fontName='Serif', fontSize=12.5,
    leftIndent=20, spaceBefore=4, spaceAfter=2
)
toc_h2 = ParagraphStyle(
    'TOCH2', fontName='Serif', fontSize=10.5,
    leftIndent=40, spaceBefore=2, spaceAfter=2
)


# ━━ Custom Flowables ━━
class HRLine(Flowable):
    def __init__(self, width=None, color=ACCENT, thickness=0.5):
        Flowable.__init__(self)
        self.width = width or CONTENT_W
        self.color = color
        self.thickness = thickness
        self.height = 2

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 1, self.width, 1)


class PhaseBanner(Flowable):
    """A colored banner for phase headers."""
    def __init__(self, text, bg_color, width=None, height=28):
        Flowable.__init__(self)
        self.text = text
        self.bg_color = bg_color
        self.width = width or CONTENT_W
        self.height = height

    def draw(self):
        self.canv.setFillColor(self.bg_color)
        self.canv.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=0)
        self.canv.setFillColor(colors.white)
        self.canv.setFont('DejaVuSans', 11)
        self.canv.drawString(12, 8, self.text)


# ━━ TOC DocTemplate ━━
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))


def add_heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/>%s' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p


def make_table(data_rows, col_widths=None, caption=None):
    if col_widths is None:
        col_widths = [CONTENT_W / len(data_rows[0])] * len(data_rows[0])
    t = Table(data_rows, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
    ]
    for i in range(1, len(data_rows)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    elements = [Spacer(1, 12), t]
    if caption:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(caption, caption_style))
    elements.append(Spacer(1, 12))
    return elements


def sev(text, color):
    return Paragraph('<font color="%s"><b>%s</b></font>' % (color, text), cell_center)


def bp(text):
    return Paragraph(text, bullet_style, bulletText='\u2022')


def sbp(text):
    return Paragraph(text, sub_bullet, bulletText='\u2013')


def ppara(text):
    return Paragraph(text, body_style)


def task_item(title, detail, file_ref):
    """Format a task with title, detail, and file reference."""
    return [
        Paragraph('<b>%s</b>' % title, task_style),
        Paragraph(detail, task_detail),
        Paragraph('<font color="#1e94bc"><i>Files: %s</i></font>' % file_ref, task_detail),
    ]


# ━━ BUILD THE REPORT ━━
output_path = '/home/z/my-project/download/Implementation_Plan.pdf'

doc = TocDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=LEFT_MARGIN,
    rightMargin=RIGHT_MARGIN,
    topMargin=TOP_MARGIN,
    bottomMargin=BOTTOM_MARGIN,
)

story = []

# ═══════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════
story.append(Spacer(1, 2.0 * inch))
story.append(HRLine(color=ACCENT, thickness=2))
story.append(Spacer(1, 12))
story.append(Paragraph('<b>Implementation Plan</b>', cover_title))
story.append(Spacer(1, 6))
story.append(Paragraph('Phased Fix Strategy for Property Management Module', cover_subtitle))
story.append(Spacer(1, 20))
story.append(HRLine(color=ACCENT, thickness=1))
story.append(Spacer(1, 14))
story.append(Paragraph('AntiGravity Development Handoff Document', cover_meta))
story.append(Paragraph('Legal Tech Application (Atrium / PracticePro)', cover_meta))
story.append(Paragraph('Date: May 13, 2026', cover_meta))
story.append(Paragraph('Prepared by: Z.ai Audit System', cover_meta))
story.append(Spacer(1, 28))
story.append(Paragraph(
    'This document provides a structured, phased implementation plan for addressing the issues '
    'identified in the Comprehensive Codebase Audit Report. It is designed as a direct handoff to '
    'the AntiGravity development team, with each phase containing specific tasks, file references, '
    'acceptance criteria, and dependency mappings. The plan prioritizes security and data integrity '
    'first, then core user workflows, then architectural improvements, and finally polish. Each phase '
    'is designed to deliver a usable increment that can be verified independently before proceeding.',
    ParagraphStyle('CoverSummary', fontName='Serif', fontSize=10.5, leading=17,
                   textColor=TEXT_MUTED, alignment=TA_JUSTIFY, leftIndent=12, rightIndent=12)
))
story.append(PageBreak())

# ═══════════════════════════════════════════
# TABLE OF CONTENTS
# ═══════════════════════════════════════════
story.append(Paragraph('<b>Table of Contents</b>', h1_style))
story.append(Spacer(1, 8))
toc = TableOfContents()
toc.levelStyles = [toc_h1, toc_h2]
story.append(toc)
story.append(PageBreak())

# ═══════════════════════════════════════════
# SECTION 1: OVERVIEW
# ═══════════════════════════════════════════
story.append(add_heading('<b>1. Plan Overview</b>', h1_style, level=0))
story.append(ppara(
    'This implementation plan is organized into five phases, ordered by urgency and dependency. '
    'Each phase delivers a self-contained improvement that can be tested and validated before the '
    'next phase begins. The plan is designed so that AntiGravity can work through it iteratively, '
    'shipping each phase to production (or staging) and verifying that nothing has regressed before '
    'moving forward. The total estimated effort is 5-7 weeks for a single developer, or 3-4 weeks '
    'with two developers working in parallel where dependencies allow.'
))
story.append(ppara(
    'The phases are structured around a core principle: fix what blocks users first, fix what risks '
    'data second, fix what slows the app third, and then improve what delights users last. This means '
    'security vulnerabilities and broken core workflows are addressed before performance optimizations '
    'and before new features. The property management module is the primary focus, as it is the newest '
    'and most actively evolving section of the application.'
))

# Phase overview table
phase_overview = [
    [Paragraph('<b>Phase</b>', header_cell),
     Paragraph('<b>Focus</b>', header_cell),
     Paragraph('<b>Timeline</b>', header_cell),
     Paragraph('<b>Key Deliverables</b>', header_cell)],
    [Paragraph('Phase 1', cell_center),
     Paragraph('Emergency Security Fixes', cell_style),
     Paragraph('Week 1', cell_center),
     Paragraph('Remove exposed API keys; fix Convex auth; close XSS vectors', cell_style)],
    [Paragraph('Phase 2', cell_center),
     Paragraph('Core Property Workflows', cell_style),
     Paragraph('Weeks 2-3', cell_center),
     Paragraph('Wire up tracking; fix receipt flow; add unit edit; unify payments', cell_style)],
    [Paragraph('Phase 3', cell_center),
     Paragraph('Financial Integration', cell_style),
     Paragraph('Week 4', cell_center),
     Paragraph('Property-Finance bridge; management fee disbursement; auto-calculations', cell_style)],
    [Paragraph('Phase 4', cell_center),
     Paragraph('Architecture Hardening', cell_style),
     Paragraph('Week 5', cell_center),
     Paragraph('Memoize context; fix dead state; implement missing handlers; type safety', cell_style)],
    [Paragraph('Phase 5', cell_center),
     Paragraph('Polish and Discovery', cell_style),
     Paragraph('Weeks 6-7', cell_center),
     Paragraph('Quick Actions expansion; UX improvements; further feature discovery', cell_style)],
]
col_w_phase = [CONTENT_W * 0.10, CONTENT_W * 0.20, CONTENT_W * 0.14, CONTENT_W * 0.56]
story.extend(make_table(phase_overview, col_w_phase, 'Table 1: Implementation Phases Overview'))

# Dependency map
story.append(add_heading('<b>1.1 Phase Dependencies</b>', h2_style, level=1))
story.append(ppara(
    'Phase 1 (Security) has no dependencies and should begin immediately. Phase 2 (Core Workflows) '
    'can begin in parallel with Phase 1 but the receipt fixes depend on Phase 1 being complete for '
    'testing. Phase 3 (Financial Integration) depends on Phase 2 being complete because it extends '
    'the unified payment system. Phase 4 (Architecture) can begin as soon as Phase 2 is stable. '
    'Phase 5 (Polish) depends on all prior phases being complete and stable. Within each phase, tasks '
    'are listed in dependency order where applicable.'
))

dep_data = [
    [Paragraph('<b>Phase</b>', header_cell),
     Paragraph('<b>Depends On</b>', header_cell),
     Paragraph('<b>Can Parallel With</b>', header_cell),
     Paragraph('<b>Blocks</b>', header_cell)],
    [Paragraph('Phase 1', cell_center), Paragraph('None', cell_style), Paragraph('Phase 2 (partial)', cell_style), Paragraph('Phase 2 receipt testing', cell_style)],
    [Paragraph('Phase 2', cell_center), Paragraph('Phase 1 (for testing)', cell_style), Paragraph('Phase 1', cell_style), Paragraph('Phase 3', cell_style)],
    [Paragraph('Phase 3', cell_center), Paragraph('Phase 2', cell_style), Paragraph('Phase 4 (partial)', cell_style), Paragraph('Phase 5', cell_style)],
    [Paragraph('Phase 4', cell_center), Paragraph('Phase 2 stable', cell_style), Paragraph('Phase 3', cell_style), Paragraph('Phase 5', cell_style)],
    [Paragraph('Phase 5', cell_center), Paragraph('All prior phases', cell_style), Paragraph('None', cell_style), Paragraph('None', cell_style)],
]
col_w_dep = [CONTENT_W * 0.12, CONTENT_W * 0.24, CONTENT_W * 0.28, CONTENT_W * 0.36]
story.extend(make_table(dep_data, col_w_dep, 'Table 2: Phase Dependency Map'))

# ═══════════════════════════════════════════
# SECTION 2: PHASE 1 - EMERGENCY SECURITY
# ═══════════════════════════════════════════
story.append(add_heading('<b>2. Phase 1: Emergency Security Fixes</b>', h1_style, level=0))
story.append(PhaseBanner('PHASE 1  |  EMERGENCY SECURITY  |  WEEK 1', PHASE_1_COLOR))
story.append(Spacer(1, 8))
story.append(ppara(
    'This phase addresses the most critical security vulnerabilities in the application. These issues '
    'represent immediate risk: exposed API keys allow unauthorized usage at the project owner\'s expense, '
    'and absent server-side authentication means any client with a firmId can access or destroy any firm\'s '
    'data. These fixes must be deployed before any further feature work or public-facing testing.'
))

# Task 1.1
story.append(add_heading('<b>2.1 Remove Exposed Gemini API Keys</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> Critical  |  <b>Effort:</b> 2-3 hours  |  <b>Risk:</b> Low', body_left))
story.append(ppara(
    'Two live Google Gemini API keys are embedded directly in the source code and are fully visible in '
    'the browser bundle. These keys can be scraped automatically from the deployed site, allowing unauthorized '
    'API usage at the project owner\'s expense. Additionally, API keys are passed in URL query strings which '
    'are logged by proxies, CDNs, and browser history.'
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('Remove the hardcoded API keys from <font color="#1e94bc">src/utils/aiUtils.ts</font> (line 163), <font color="#1e94bc">src/services/geminiService.ts</font> (lines 246, 379, 460, 464, 544), and <font color="#1e94bc">src/components/aloa/AloaChat.tsx</font>'))
story.append(bp('Create a new Convex action (<font color="#1e94bc">convex/ai.ts</font> or extend existing) that proxies all Gemini API calls server-side. The action should read the API key from Convex environment variables (not the client bundle) and forward requests to the Gemini API.'))
story.append(bp('Update all client-side AI calls to use the Convex action instead of calling Gemini directly. This includes the embedding generation, chat completions, and document structuring flows.'))
story.append(bp('Move API key to Convex environment variables via <font color="#1e94bc">npx convex env set GEMINI_API_KEY your_key_here</font>. The VITE_GEMINI_API_KEY environment variable should be removed entirely.'))
story.append(bp('Rotate both compromised keys immediately after deploying the fix. Old keys must be revoked in the Google Cloud Console.'))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('No API key strings appear anywhere in the browser bundle (verify with a production build search)'))
story.append(bp('All AI features (Aloa chat, document structuring, embedding generation) continue to work through the server-side proxy'))
story.append(bp('The Gemini API key is only accessible via Convex environment variables, never exposed to the client'))

# Task 1.2
story.append(add_heading('<b>2.2 Fix Convex Server-Side Authentication</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> Critical  |  <b>Effort:</b> 6-8 hours  |  <b>Risk:</b> Medium (requires thorough testing)', body_left))
story.append(ppara(
    'The withFirmAuth middleware in convex/lib/withAuth.ts does not actually verify the caller\'s identity. '
    'It never calls ctx.auth.getUserIdentity(), proceeds even when no user is found, and uses an inefficient '
    'full-table scan. This means that 50+ Convex functions are effectively unauthenticated. Any client '
    'that knows a firmId can read, create, update, or delete any firm\'s data.'
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('Rewrite <font color="#1e94bc">convex/lib/withAuth.ts</font> to call ctx.auth.getUserIdentity() as the first step. If the identity is null, throw a Convex error immediately rather than proceeding in read-only mode.'))
story.append(bp('Replace the full-table scan (take(500)) with a proper indexed query using the user\'s tokenIdentifier from getUserIdentity(). Create an index on the users table by tokenIdentifier if one does not exist.'))
story.append(bp('Add the withFirmAuth wrapper to all currently unprotected Convex functions. Start with the highest-risk ones: getFirmData, purgeFirmData, adminDeleteUser, adminForceVerify, dumpAll.'))
story.append(bp('For admin functions (adminDeleteUser, adminForceVerify, getAllFirmsForAdmin, getAllLicenses), add a role check that verifies the caller has an admin role before proceeding.'))
story.append(bp('Add checkResourceOwnership to all item-level mutations (createItem, updateItem, deleteItem) to ensure the item belongs to the caller\'s firm.'))
story.append(bp('Remove or gate debug functions: checkEnv (exposes env variables), testInsertUndefined, dumpAll. These should not exist in production.'))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('All Convex queries and mutations verify the caller\'s identity via getUserIdentity() before executing'))
story.append(bp('Unauthenticated requests are rejected with a clear error message, not silently allowed'))
story.append(bp('Admin-only functions require an admin role check'))
story.append(bp('Debug functions (checkEnv, dumpAll) are removed or gated behind admin-only access'))
story.append(bp('All existing functionality continues to work with authenticated requests (run full regression)'))

# Task 1.3
story.append(add_heading('<b>2.3 Close XSS Vectors</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> High  |  <b>Effort:</b> 1-2 hours  |  <b>Risk:</b> Low', body_left))
story.append(ppara(
    'Four components use dangerouslySetInnerHTML with parseAloaMarkdown() output without passing '
    'through the existing sanitize() function. If any of this content comes from AI output or other '
    'users, it represents an XSS attack vector.'
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('<font color="#1e94bc">src/components/aloa/NoteDetails.tsx</font> (line 34): Wrap parseAloaMarkdown(note.content) with sanitize()'))
story.append(bp('<font color="#1e94bc">src/components/aloa/MiniAloa.tsx</font> (line 380): Wrap parseAloaMarkdown(msg.content) with sanitize()'))
story.append(bp('<font color="#1e94bc">src/components/aloa/AloaChat.tsx</font> (line 1027): Wrap parseAloaMarkdown(msg.content) with sanitize()'))
story.append(bp('<font color="#1e94bc">src/components/MessagingView.tsx</font> (lines 270, 859): Wrap parseAloaMarkdown(content) and parseAloaMarkdown(item.adminReply) with sanitize()'))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('All dangerouslySetInnerHTML usages pass through sanitize() before rendering'))
story.append(bp('Aloa chat messages, notes, and messaging content render correctly with sanitization (no visual regression)'))

# Task 1.4
story.append(add_heading('<b>2.4 Remove MFA Debug Code from Production</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> High  |  <b>Effort:</b> 15 minutes  |  <b>Risk:</b> None', body_left))
story.append(ppara(
    'Login.tsx line 110 logs the actual MFA verification code to the browser console, even in production '
    'builds. This allows anyone with access to browser dev tools to bypass MFA entirely.'
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('<font color="#1e94bc">src/components/auth/Login.tsx</font> (line 110): Wrap the console.log in a DEV mode check: <font color="#1e94bc">if (import.meta.env.DEV) console.log(...)</font>'))
story.append(bp('Additionally, audit all console.log statements across the codebase and gate non-error logs behind import.meta.env.DEV'))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('MFA codes do not appear in the browser console in production builds'))
story.append(bp('Debug console.log statements are suppressed in production; error-level logs remain'))

# ═══════════════════════════════════════════
# SECTION 3: PHASE 2 - CORE PROPERTY WORKFLOWS
# ═══════════════════════════════════════════
story.append(add_heading('<b>3. Phase 2: Core Property Workflows</b>', h1_style, level=0))
story.append(PhaseBanner('PHASE 2  |  CORE PROPERTY WORKFLOWS  |  WEEKS 2-3', PHASE_2_COLOR))
story.append(Spacer(1, 8))
story.append(ppara(
    'This phase fixes the broken core workflows that users encounter daily. The PropertyTrackingView '
    'component, which contains the full unit-level tracking experience, is imported but never rendered. '
    'The receipt issuance flow discards unit-specific context. Maintenance logging is a stub. These '
    'issues collectively make the property management module confusing rather than efficient, which is '
    'the opposite of the intended user experience.'
))

# Task 2.1
story.append(add_heading('<b>3.1 Integrate PropertyTrackingView into Active UI</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> Critical  |  <b>Effort:</b> 4-6 hours  |  <b>Risk:</b> Medium (UI integration)', body_left))
story.append(ppara(
    'PropertyTrackingView contains a fully built timeline, rent history table, maintenance Kanban board, '
    'lease setup form, manual event addition, and receipt download. It is imported in PropertyDetailView '
    'but never rendered. The "Add Payment" and "Save Record" buttons that the user reported as not working '
    'are part of this orphaned component. Integrating it into the active UI is the single highest-impact '
    'fix for the property module.'
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('In <font color="#1e94bc">src/components/details/PropertyDetailView.tsx</font>, replace the current inline unit tracking stubs in the Units tab with the PropertyTrackingView component. Each unit card should either expand to show PropertyTrackingView inline, or clicking a unit should navigate to a dedicated tracking view.'))
story.append(bp('Wire the <font color="#1e94bc">onUpdate</font> callback of PropertyTrackingView to the data persistence layer. The callback should call <font color="#1e94bc">updateItem("properties", updated)</font> to persist changes to Convex. Currently, onUpdate is a no-op because the parent does not pass it.'))
story.append(bp('Ensure the rent payment recording within PropertyTrackingView also writes to the Convex ledger_entries table (in addition to property.rentPaymentHistory) to maintain consistency with the RecordRentPaymentModalWrapper flow. This is a stepping stone to the unified payment system in Phase 3.'))
story.append(bp('Add the PropertyTrackingView to the Summary tab as well, so that single-tenant properties can see their tracking timeline without navigating to a unit.'))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('Clicking "Add Payment" inside a unit shows the payment form, and clicking "Save Record" persists the payment to both property.rentPaymentHistory and Convex ledger_entries'))
story.append(bp('The Activity Timeline shows events and auto-populates when rent is collected or maintenance is logged'))
story.append(bp('The Maintenance Kanban board displays maintenance records and allows status transitions (reported, in progress, escalated, fulfilled)'))
story.append(bp('Lease setup form allows editing lease terms and they persist after page refresh'))

# Task 2.2
story.append(add_heading('<b>3.2 Fix Receipt Issuance for Unit-Level Context</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> Critical  |  <b>Effort:</b> 3-4 hours  |  <b>Risk:</b> Low', body_left))
story.append(ppara(
    'When a user clicks "Issue Receipt" from a unit cog menu, the ModalManager discards the modalContext '
    'containing unit-specific data (unitName, tenantName, rentAmount) and passes only the parent property '
    'to CollectRentModal. This results in receipts with incorrect tenant names and rent amounts for '
    'multi-unit properties. Additionally, the ReceiptDetailView shows the landlord name instead of the '
    'tenant name in the "Received From" field.'
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('In <font color="#1e94bc">src/components/modals/ModalManager.tsx</font> (lines 323-330), pass modalContext as a prop to CollectRentModal. Follow the pattern already used by RecordRentPaymentModalWrapper (lines 138-148) which correctly receives and uses modalContext.'))
story.append(bp('Modify <font color="#1e94bc">src/components/modals/CollectRentModal.tsx</font> to accept an optional modalContext prop. When modalContext is provided (unit-level receipt), use modalContext.tenantName instead of the property-level tenant, and modalContext.rentAmount instead of property.rentalDetails.rentAmount. Pre-fill the rent amount field from this value rather than requiring the user to enter it.'))
story.append(bp('In <font color="#1e94bc">src/components/details/ReceiptDetailView.tsx</font> (lines 40-46), fix the "Received From" field. For property rent receipts, the payer is the tenant, not the client/landlord. Add logic to detect when a receipt is for a property payment and show the tenant name accordingly.'))
story.append(bp('Remove the valuations dialogue for properties that are not listed for sale. In <font color="#1e94bc">PropertyForm.tsx</font> (line 560) and <font color="#1e94bc">PropertyDetailView.tsx</font> (line 504), gate the valuation field behind a "category === For Sale" condition. For rental and management properties, the valuation field is irrelevant and creates confusion.'))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('Issuing a receipt from a unit cog menu shows the correct unit tenant name and rent amount'))
story.append(bp('The rent amount field is pre-populated from the unit\'s agreed rent amount'))
story.append(bp('Receipts show the tenant name as "Received From", not the landlord name'))
story.append(bp('Valuation field is hidden for non-sale properties'))

# Task 2.3
story.append(add_heading('<b>3.3 Add Unit-Level Edit Button</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> High  |  <b>Effort:</b> 2-3 hours  |  <b>Risk:</b> Low', body_left))
story.append(ppara(
    'Currently, the only way to edit individual units is through the ExpandablePropertyGroup sidebar '
    'component. The Units tab in PropertyDetailView has no edit button on unit cards. The main Edit '
    'button in the header opens the full property form, which is confusing when the user wants to edit '
    'a specific unit. The user requested a per-unit edit button placed below the main Edit button and '
    'beside the units list, with scrollable support for many units.'
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('In <font color="#1e94bc">src/components/details/PropertyDetailView.tsx</font>, add an "Edit Unit" button to each unit card in the Units tab. This should be placed below the main property Edit button in the header, or as a button beside each unit card.'))
story.append(bp('When clicked, open a PropertyForm modal pre-populated with the unit\'s data. Use the existing openModal("editProperty", unit.id, { contactId }) flow, but ensure the PropertyForm detects it is editing a unit (not a standalone property) and adjusts the form fields accordingly.'))
story.append(bp('Ensure the units list container has <font color="#1e94bc">overflow-y: auto</font> with a <font color="#1e94bc">max-height</font> constraint so that it scrolls when there are many units. Verify that the edit button and other UI elements do not overlap with the scrollable area.'))
story.append(bp('Test with 10+ units to verify scrolling behavior and button placement.'))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('Each unit card has an "Edit" button that opens a pre-populated edit form for that specific unit'))
story.append(bp('The main "Edit" button in the header continues to edit the parent property'))
story.append(bp('The units list scrolls properly when there are many units'))
story.append(bp('No UI elements overlap, regardless of the number of units'))

# Task 2.4
story.append(add_heading('<b>3.4 Replace Maintenance Logging Stub</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> High  |  <b>Effort:</b> 3-4 hours  |  <b>Risk:</b> Low', body_left))
story.append(ppara(
    'The "Log Maintenance" option in the unit cog menu only toggles the unit status to "Maintenance". '
    'It does not create a MaintenanceRecord with issue details, priority, vendor info, or estimated cost. '
    'The PropertyTrackingView already has a full maintenance form (addType === "maintenance" in handleSave), '
    'but since that component is orphaned, this form is inaccessible.'
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('Replace the inline stub in <font color="#1e94bc">PropertyDetailView.tsx</font> (lines 845, 879) with a proper maintenance logging modal or inline form. Extract the maintenance form logic from PropertyTrackingView\'s handleSave into a reusable MaintenanceForm component.'))
story.append(bp('The form should capture: issue description, priority (low/medium/high/critical), category (plumbing/electrical/structural/other), estimated cost, vendor/contractor (optional), and expected completion date.'))
story.append(bp('On submission, create a MaintenanceRecord in the property.maintenanceHistory array AND log a timeline event. Persist via updateItem to Convex.'))
story.append(bp('The maintenance record should appear in the PropertyTrackingView maintenance Kanban once that component is integrated (Task 3.1).'))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('Clicking "Log Maintenance" opens a form, not just a status toggle'))
story.append(bp('Maintenance records persist to the database and survive page refresh'))
story.append(bp('Maintenance records appear in the Kanban board (once integrated)'))

# Task 2.5
story.append(add_heading('<b>3.5 Fix BulkEditPropertyModal Enum Mismatch</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> Medium  |  <b>Effort:</b> 1 hour  |  <b>Risk:</b> Low', body_left))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('In <font color="#1e94bc">src/components/modals/BulkEditPropertyModal.tsx</font>, align the status dropdown options with the PropertyStatus enum used throughout the app (Occupied, Vacant, Listed). Remove the incorrect values (Available, Leased, For Sale, Maintenance, Under Renovation).'))
story.append(bp('Similarly align the category dropdown with the app\'s category enum (Tenanted Property, Property For Sale, etc.) instead of the generic (Residential, Commercial).'))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('Bulk edit sets status and category values that are recognized by the app\'s filtering and display logic'))

# ═══════════════════════════════════════════
# SECTION 4: PHASE 3 - FINANCIAL INTEGRATION
# ═══════════════════════════════════════════
story.append(add_heading('<b>4. Phase 3: Financial Integration</b>', h1_style, level=0))
story.append(PhaseBanner('PHASE 3  |  FINANCIAL INTEGRATION  |  WEEK 4', PHASE_3_COLOR))
story.append(Spacer(1, 8))
story.append(ppara(
    'This phase addresses the fundamental disconnect between the property management module and the '
    'finance context. Currently, property earnings (rent) and expenses (maintenance) are not integrated '
    'with the FinanceContext, meaning the finance page does not reflect property financial activity. '
    'Additionally, the dual payment recording systems (ledger_entries vs rentPaymentHistory) must be '
    'unified, and the management fee disbursement workflow needs to be built out to support the user\'s '
    'stated business model where the property owner collects rent directly and disburses the management fee.'
))

# Task 3.1
story.append(add_heading('<b>4.1 Unify Payment Recording Systems</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> Critical  |  <b>Effort:</b> 5-6 hours  |  <b>Risk:</b> High (data migration)', body_left))
story.append(Paragraph(
    '<b>Warning:</b> This task involves data model changes and requires a migration strategy. Ensure '
    'a backup of the Convex database is taken before proceeding.',
    warning_style
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('Design a unified payment record model that satisfies both the property tracking needs '
    '(rent history, receipt generation) and the financial reporting needs (ledger entries, service charges). '
    'The Convex ledger_entries table should be the single source of truth for all financial transactions.'))
story.append(bp('Modify <font color="#1e94bc">CollectRentModal.tsx</font> to write to ledger_entries (via api.sentry.addLedgerEntry) in addition to property.rentPaymentHistory. The rentPaymentHistory array can be derived from ledger_entries at read time, or kept as a denormalized cache that is always written in sync with the ledger.'))
story.append(bp('Modify <font color="#1e94bc">PropertyTrackingView</font> (once integrated) to write to ledger_entries when recording rent payments, rather than only updating the local property object.'))
story.append(bp('Add a "sync" utility that backfills any existing rentPaymentHistory entries into ledger_entries for properties that were created before this fix. This should run as a Convex migration.'))
story.append(bp('Update the property financial reports (<font color="#1e94bc">PropertyReports.tsx</font>) to pull data from ledger_entries rather than computing from rentPaymentHistory arrays.'))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('Recording a rent payment (via any path) creates a single consistent record visible in both the property rent history and the financial ledger'))
story.append(bp('The property\'s total income in RevenueEngine matches the sum of individual unit receipts'))
story.append(bp('No duplicate entries appear in either the rent history or the ledger'))
story.append(bp('Historical data is preserved through the migration utility'))

# Task 3.2
story.append(add_heading('<b>4.2 Build Management Fee Disbursement Workflow</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> High  |  <b>Effort:</b> 4-5 hours  |  <b>Risk:</b> Medium', body_left))
story.append(ppara(
    'The user has stated that as a property manager, they do not collect rent to themselves directly. '
    'The property owner receives the rent, and then disburses the management fee to the property manager. '
    'This is not the only possible model (some managers collect and remit), so the system must support both. '
    'The current CollectRentModal only generates a fee invoice; it does not track the disbursement lifecycle.'
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('Add a "collection model" field to the property schema and form: "Manager Collects" (manager receives rent, remits net to owner) or "Owner Collects" (owner receives rent, disburses fee to manager). Default to "Owner Collects" based on the user\'s stated preference.'))
story.append(bp('When collection model is "Owner Collects", the receipt flow should: (a) issue receipt to tenant for full rent amount, (b) create a payable entry for the management fee (visible to the owner), and (c) track the disbursement status (pending, disbursed, overdue).'))
story.append(bp('Add a "Disbursements" tab or section in the property financial view that shows pending management fee disbursements. The property owner should be able to mark fees as disbursed, which updates the financial records and creates a receipt for the manager.'))
story.append(bp('Link the disbursement workflow to the Finance page. Property management fee income should appear as earnings in the finance context (tagged as "Property Management Fee"), and property expenses should appear as expenses (tagged as "Property Maintenance").'))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('Property form includes a "collection model" field (Manager Collects / Owner Collects)'))
story.append(bp('In "Owner Collects" mode, receipts are issued to tenants for the full rent amount, and management fees appear as payables'))
story.append(bp('Disbursements can be tracked, marked as paid, and generate receipts for the manager'))
story.append(bp('Property earnings and expenses are visible in the Finance page with appropriate tagging'))

# Task 3.3
story.append(add_heading('<b>4.3 Create Property-Finance Context Bridge</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> High  |  <b>Effort:</b> 4-5 hours  |  <b>Risk:</b> Medium', body_left))
story.append(ppara(
    'The FinanceContext currently provides invoices, timeEntries, and expenses, but these are legal '
    'billing constructs with no property financial awareness. Property earnings (rent) and expenses '
    '(maintenance) are not aggregated into any finance context. The RevenueEngine must manually traverse '
    'coreState.properties to compute financials. This task creates a proper integration layer.'
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('Create a <font color="#1e94bc">src/contexts/PropertyFinanceContext.tsx</font> that aggregates property financial data from ledger entries, service charges, and maintenance costs. This context should provide computed values such as: totalPropertyIncome, totalPropertyExpenses, netPropertyIncome, occupancyRate, arrearsTotal, and managementFeesOwed.'))
story.append(bp('Integrate this context into the existing provider hierarchy. It should sit between FinanceProvider and DocumentProvider, reading from CoreContext for raw property data and from FinanceContext for existing financial records.'))
story.append(bp('Add a visual indicator on the Finance page that distinguishes property-sourced earnings from legal-service earnings. This could be a badge, a different color, or a separate section. Allow users to filter or aggregate these categories as needed.'))
story.append(bp('Wire the PropertyFinanceContext into the RevenueEngine and PropertyReports components, replacing their current manual computation logic with the context\'s computed values.'))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('Finance page shows property earnings separately from legal service earnings, with a clear visual distinction'))
story.append(bp('Users can filter the Finance view to show only property income, only legal income, or both'))
story.append(bp('RevenueEngine and PropertyReports use the PropertyFinanceContext for computed values'))

# Task 3.4
story.append(add_heading('<b>4.4 Move "Issue Receipt" to Quick Actions</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> Medium  |  <b>Effort:</b> 2-3 hours  |  <b>Risk:</b> Low', body_left))
story.append(ppara(
    'The user has requested that issuing a receipt should fall under Quick Actions and should actually '
    'be quick: at this stage, the user should be able to confirm or edit the contents of the receipt and '
    'have it appear with a consistent style and standard for all tenants. Currently, Quick Actions only '
    'appear for non-leased, single-unit properties. Multi-unit properties are excluded from the Quick '
    'Actions section entirely.'
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('In <font color="#1e94bc">PropertyDetailView.tsx</font> (lines 585-635), extend the Quick Actions section to appear for all property types, including multi-unit properties. For multi-unit properties, Quick Actions should include a per-unit "Issue Receipt" option.'))
story.append(bp('The "Issue Receipt" Quick Action should open a streamlined receipt confirmation view (not the full CollectRentModal). This view should pre-populate with the tenant name, rent amount, and payment period, and allow the user to confirm or edit before generating the receipt.'))
story.append(bp('Receipts generated through Quick Actions should use the same PDF template and styling as receipts generated through other paths, ensuring a consistent standard for all tenants.'))
story.append(bp('After issuing a receipt through Quick Actions, provide immediate visual confirmation (a toast and a preview of the receipt) rather than just closing the modal.'))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('"Issue Receipt" appears as a Quick Action for all property types'))
story.append(bp('The receipt flow is quick: pre-populated, confirm or edit, generate, done'))
story.append(bp('All receipts have consistent styling regardless of how they were initiated'))

# ═══════════════════════════════════════════
# SECTION 5: PHASE 4 - ARCHITECTURE HARDENING
# ═══════════════════════════════════════════
story.append(add_heading('<b>5. Phase 4: Architecture Hardening</b>', h1_style, level=0))
story.append(PhaseBanner('PHASE 4  |  ARCHITECTURE HARDENING  |  WEEK 5', PHASE_4_COLOR))
story.append(Spacer(1, 8))
story.append(ppara(
    'This phase addresses the architectural issues that cause performance problems, runtime crashes, '
    'and type safety gaps. While these issues do not directly cause user-visible bugs in the same way '
    'as Phase 2 issues, they create a fragile foundation that will make future development increasingly '
    'difficult. Addressing them now prevents compounding technical debt.'
))

# Task 4.1
story.append(add_heading('<b>5.1 Memoize Context Actions and Fix God Object</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> High  |  <b>Effort:</b> 3-4 hours  |  <b>Risk:</b> Medium', body_left))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('In <font color="#1e94bc">src/contexts/DataProvider.tsx</font> (line 127), wrap the contextActions object in useMemo, keyed on the baseActions object and all hook return values. This prevents the cascade re-render problem where any state change triggers re-renders across all 8 domain contexts.'))
story.append(bp('Type the contextActions object properly instead of using "any". Use the ExtendedDataActions type that is already defined but not enforced. This will catch missing handlers at compile time.'))
story.append(bp('Consider splitting the monolithic AppState into domain-specific slices (e.g., PropertyState, FinanceState, MatterState) with independent update paths. This is a larger refactor that can be deferred, but the memoization fix should be applied immediately.'))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('Changing one property does not cause re-renders in the billing or matter views'))
story.append(bp('TypeScript catches missing handlers at compile time (no more "actions.X is not a function" at runtime)'))

# Task 4.2
story.append(add_heading('<b>5.2 Implement Missing Context Handlers</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> High  |  <b>Effort:</b> 3-4 hours  |  <b>Risk:</b> Low', body_left))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('Implement <font color="#1e94bc">handleBulkArchiveTasks</font> and <font color="#1e94bc">handleArchiveAllDoneTasks</font> in useTasks hook. These should update task status to "Archived" for the selected tasks.'))
story.append(bp('Implement <font color="#1e94bc">handleUpdateWorkflow</font> in the execution hook. This should update the workflow definition in the workflows array.'))
story.append(bp('Implement <font color="#1e94bc">handleRenamePage</font> and <font color="#1e94bc">handleDeleteNotebook</font> in the document hook. These should update the notePages and notebooks arrays respectively.'))
story.append(bp('For any remaining declared-but-not-implemented handlers (handleUpdateChecklistItem, handleUpdatePageContent), either implement them or remove them from the context type definition to avoid confusion.'))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('TasksView bulk archive does not crash; tasks are moved to archived state'))
story.append(bp('NotesView page rename does not crash; page names update and persist'))
story.append(bp('No "actions.X is not a function" errors in the console for any declared handler'))

# Task 4.3
story.append(add_heading('<b>5.3 Clean Up Dead State and Duplicate Definitions</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> Medium  |  <b>Effort:</b> 2-3 hours  |  <b>Risk:</b> Low', body_left))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('Remove dead state fields from DataStateContext: isSaving (always false), isOutdated (always false), availableBackups (always []). Either implement these features or remove the declarations to avoid misleading API surface.'))
story.append(bp('Consolidate the duplicate <font color="#1e94bc">EMPTY_APP_STATE</font> definitions. Keep only the one in <font color="#1e94bc">src/types.ts</font> and remove the duplicate in <font color="#1e94bc">src/utils/mockData.ts</font>. Update all imports.'))
story.append(bp('Remove the hardcoded <font color="#1e94bc">appMode: AppMode.Multi</font> in AuthContext. Either implement Solo mode switching or remove the AppMode.Solo enum and associated dead code paths.'))
story.append(bp('Remove the hardcoded production Convex URL fallback in <font color="#1e94bc">src/main.tsx</font> (line 14). The application should fail with a clear error message if VITE_CONVEX_URL is not set, not silently connect to a hardcoded production instance.'))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('No misleading dead state fields in context API'))
story.append(bp('Single EMPTY_APP_STATE definition imported consistently'))
story.append(bp('Application fails clearly if required environment variables are missing'))

# Task 4.4
story.append(add_heading('<b>5.4 Incremental Type Safety Improvements</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> Medium  |  <b>Effort:</b> Ongoing  |  <b>Risk:</b> Low', body_left))
story.append(ppara(
    'The codebase contains 100+ "as any" type assertions, concentrated in PropertyDetailView (12+), '
    'DataProvider (10+), and demoData.ts (20+). While fixing all of these at once is impractical, '
    'a systematic approach can gradually restore type safety.'
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('Start with the highest-risk "as any" usages: those in PropertyDetailView that access property._id, property.units, and property.name on loosely-typed objects. Define proper TypeScript interfaces for Property, Unit, and Tenant, and use them consistently.'))
story.append(bp('Fix the DataProvider contextActions typing from "any" to the proper ExtendedDataActions type (addressed in Task 5.1).'))
story.append(bp('For demoData.ts, define a proper DemoData type and cast once at the module boundary, rather than using "as any" on individual fields.'))
story.append(bp('Replace Math.random()-based receipt/invoice number generation with a deterministic sequence. Use a Convex mutation that atomically increments a counter, or use a date-based format like INV-YYYYMMDD-NNNN.'))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('No new "as any" assertions are introduced (enforce via lint rule)'))
story.append(bp('Property domain types are properly defined and used in PropertyDetailView'))
story.append(bp('Receipt and invoice numbers are deterministic and unique'))

# ═══════════════════════════════════════════
# SECTION 6: PHASE 5 - POLISH AND DISCOVERY
# ═══════════════════════════════════════════
story.append(add_heading('<b>6. Phase 5: Polish and Discovery</b>', h1_style, level=0))
story.append(PhaseBanner('PHASE 5  |  POLISH AND DISCOVERY  |  WEEKS 6-7', PHASE_5_COLOR))
story.append(Spacer(1, 8))
story.append(ppara(
    'This phase focuses on user experience polish and discovering what else needs to be built. Once '
    'the core workflows are functional and the architecture is sound, the team should conduct a thorough '
    'end-to-end review of the property management module to identify gaps that were not visible in the '
    'code audit. This phase is intentionally open-ended to accommodate findings from user testing.'
))

# Task 5.1
story.append(add_heading('<b>6.1 Hydrate Missing Convex Tables</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> Medium  |  <b>Effort:</b> 4-6 hours  |  <b>Risk:</b> Low', body_left))
story.append(ppara(
    'Several Convex tables (tenancies, atrium_inbound_messages) exist in the schema but are never '
    'fetched into appState. The Atrium components work around this by querying Convex directly, but '
    'this creates inconsistency. This task brings all property-related data into the unified data loading '
    'pipeline.'
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('Add Convex queries for tenancies, ledger_entries, service_charges, leads_pipeline, and automation_logs to the DataProvider\'s data loading pipeline, so that they flow through the context system rather than requiring direct useConvex() calls.'))
story.append(bp('Wire the tenancies table into the PropertyDetailView and PropertyForm for proper tenant management, replacing the current embedded tenant data in property objects.'))
story.append(bp('Wire atrium_inbound_messages into the AtriumInbox component.'))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('All Convex tables are loaded through the standard DataProvider pipeline'))
story.append(bp('Atrium components can use context hooks instead of direct Convex queries for data access'))

# Task 5.2
story.append(add_heading('<b>6.2 Receipt Template Standardization</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> Medium  |  <b>Effort:</b> 3-4 hours  |  <b>Risk:</b> Low', body_left))
story.append(ppara(
    'Receipts are currently generated in two different ways: CollectRentModal uses reportGenerator.ts '
    'to create a PDF download, while LedgerManager opens a new window with raw HTML. Both approaches '
    'produce receipts with different layouts and styling. The user has requested that all receipts have '
    'the exact same style and standard for all tenants.'
))
story.append(Paragraph('<b>Required Changes:</b>', body_left))
story.append(bp('Create a unified receipt template in <font color="#1e94bc">src/services/reportGenerator.ts</font> that produces consistent output regardless of whether the receipt is for a tenant payment, a management fee disbursement, or a legal invoice payment.'))
story.append(bp('Replace the LedgerManager\'s raw HTML receipt generation (window.open + print) with the unified template.'))
story.append(bp('Store generated receipt PDFs as documents in Convex (or a file storage service) rather than generating them on-the-fly each time. This allows users to re-download past receipts without regenerating them.'))
story.append(Paragraph('<b>Acceptance Criteria:</b>', body_left))
story.append(bp('All receipts have identical formatting, typography, and layout'))
story.append(bp('Past receipts can be re-downloaded without regeneration'))

# Task 5.3
story.append(add_heading('<b>6.3 End-to-End User Testing and Gap Discovery</b>', h2_style, level=1))
story.append(Paragraph('<b>Priority:</b> High  |  <b>Effort:</b> Ongoing  |  <b>Risk:</b> N/A', body_left))
story.append(ppara(
    'Once Phases 1-4 are complete, conduct a thorough end-to-end user test of the property management '
    'module. Walk through the following scenarios and document any issues, confusion points, or missing '
    'features that were not caught by the code audit:'
))
story.append(bp('<b>Single-tenant property</b>: Add property, set rent, issue receipt, record payment, log maintenance, view timeline, edit property, view financial reports.'))
story.append(bp('<b>Multi-unit property</b>: Add property with 5+ units, set per-unit rent and tenants, issue receipts per unit, record payments per unit, log maintenance per unit, view aggregated financial reports, edit individual units, scroll through many units.'))
story.append(bp('<b>Owner collects model</b>: Set property to "Owner Collects" mode, issue tenant receipts, track management fee disbursements, mark fees as paid, verify financial reporting.'))
story.append(bp('<b>Manager collects model</b>: Set property to "Manager Collects" mode, collect rent, remit net to owner, generate owner statements.'))
story.append(bp('<b>Quick Actions flow</b>: Use Quick Actions for all common tasks (issue receipt, rent demand, notice to quit, log maintenance) and verify each action completes in 2-3 clicks.'))
story.append(bp('<b>Finance integration</b>: Verify property earnings appear in Finance page, can be filtered, and aggregate correctly with legal service earnings.'))
story.append(Spacer(1, 6))
story.append(ppara(
    'Document all findings from the end-to-end test and create a follow-up issue list. This list will '
    'form the basis for the next iteration of development and may include new features, UX improvements, '
    'or edge cases that the code audit could not identify.'
))

# ═══════════════════════════════════════════
# SECTION 7: TESTING STRATEGY
# ═══════════════════════════════════════════
story.append(add_heading('<b>7. Testing and Verification Strategy</b>', h1_style, level=0))
story.append(ppara(
    'Each phase should be verified before moving to the next. The following testing strategy ensures '
    'that fixes do not introduce regressions and that the property management module works correctly '
    'end-to-end.'
))

story.append(add_heading('<b>7.1 Per-Phase Verification Checklist</b>', h2_style, level=1))
test_data = [
    [Paragraph('<b>Phase</b>', header_cell),
     Paragraph('<b>Verification Method</b>', header_cell),
     Paragraph('<b>Rollback Plan</b>', header_cell)],
    [Paragraph('Phase 1 (Security)', cell_style),
     Paragraph('1) Search production bundle for API keys (must find zero). 2) Attempt unauthenticated Convex calls from a fresh client (must be rejected). 3) Test XSS payload in Aloa chat messages (must be sanitized). 4) Check browser console for MFA codes in production build (must not appear).', cell_style),
     Paragraph('Revert the Convex deployment if auth breaks existing flows. API key removal can be hot-patched.', cell_style)],
    [Paragraph('Phase 2 (Core Workflows)', cell_style),
     Paragraph('1) Add payment in a unit and verify it persists after page refresh. 2) Issue receipt from unit cog menu and verify correct tenant/amount. 3) Log maintenance and verify record creation. 4) Edit a unit and verify changes persist. 5) Verify single-tenant property Quick Actions work.', cell_style),
     Paragraph('Keep PropertyTrackingView behind a feature flag so it can be disabled if integration causes issues.', cell_style)],
    [Paragraph('Phase 3 (Financial)', cell_style),
     Paragraph('1) Record rent payment and verify it appears in both rent history and ledger. 2) Test "Owner Collects" disbursement flow. 3) Verify Finance page shows property earnings with correct tagging. 4) Compare RevenueEngine totals with individual unit receipts (must match).', cell_style),
     Paragraph('Financial data changes require a Convex database backup. Run migration on a staging environment first.', cell_style)],
    [Paragraph('Phase 4 (Architecture)', cell_style),
     Paragraph('1) Profile React render counts before and after memoization (must decrease). 2) Test all previously crashing handlers (archive tasks, rename pages, update workflows). 3) Verify TypeScript compilation with no new errors after removing "as any" assertions.', cell_style),
     Paragraph('Low risk. Revert individual type changes if they cause compilation issues.', cell_style)],
    [Paragraph('Phase 5 (Polish)', cell_style),
     Paragraph('1) Compare receipt PDFs from all generation paths (must be identical). 2) Full end-to-end user test per Section 6.3. 3) Performance audit with large datasets (50+ properties, 200+ units).', cell_style),
     Paragraph('N/A - polish phase.', cell_style)],
]
col_w_test = [CONTENT_W * 0.16, CONTENT_W * 0.48, CONTENT_W * 0.36]
story.extend(make_table(test_data, col_w_test, 'Table 3: Per-Phase Verification Strategy'))

# ═══════════════════════════════════════════
# SECTION 8: ANTI GRAVITY HANDOFF NOTES
# ═══════════════════════════════════════════
story.append(add_heading('<b>8. AntiGravity Handoff Notes</b>', h1_style, level=0))
story.append(ppara(
    'This section provides guidance specific to the AntiGravity development team for implementing '
    'this plan. It covers coding conventions, architecture constraints, and integration points '
    'that should be followed to maintain consistency with the existing codebase.'
))

story.append(add_heading('<b>8.1 Architecture Constraints</b>', h2_style, level=1))
story.append(bp('<b>Context Protocol:</b> All new state must flow through the existing context system. Do not create standalone state stores or bypass the DataProvider. New data arrays should be added to AppState, new actions should be added to the appropriate hook, and new context values should be exposed through the existing domain contexts.'))
story.append(bp('<b>Convex-First Data:</b> All persistent data must be stored in Convex and loaded through the standard query pipeline. Avoid creating new localStorage-based state or client-only data stores.'))
story.append(bp('<b>Hook Pattern:</b> New hooks must follow the established pattern: accept (appState, actions) as parameters, use try/catch with addToast for error handling, and return named handler functions. Do not introduce hooks with different signatures.'))
story.append(bp('<b>Modal Pattern:</b> New modals must be registered in ModalManager.tsx with a corresponding ModalType enum entry. Modal-specific data must be passed through the modalContext parameter, not through global state or URL parameters.'))
story.append(bp('<b>Component Pattern:</b> New components should use the toolkit components (src/components/toolkit/) for buttons, inputs, and selects. Avoid introducing new UI primitives that duplicate existing ones.'))

story.append(add_heading('<b>8.2 Key Files Reference</b>', h2_style, level=1))
files_ref = [
    [Paragraph('<b>File</b>', header_cell),
     Paragraph('<b>Purpose</b>', header_cell),
     Paragraph('<b>Modified In</b>', header_cell)],
    [Paragraph('convex/lib/withAuth.ts', cell_style), Paragraph('Auth middleware (fix immediately)', cell_style), Paragraph('Phase 1', cell_center)],
    [Paragraph('convex/myFunctions.ts', cell_style), Paragraph('Core CRUD + admin functions', cell_style), Paragraph('Phase 1, 4', cell_center)],
    [Paragraph('src/contexts/DataProvider.tsx', cell_style), Paragraph('Central state + contextActions', cell_style), Paragraph('Phase 4', cell_center)],
    [Paragraph('src/components/details/PropertyDetailView.tsx', cell_style), Paragraph('Main property detail page', cell_style), Paragraph('Phase 2, 3', cell_center)],
    [Paragraph('src/components/details/PropertyTrackingView.tsx', cell_style), Paragraph('Unit tracking (integrate this)', cell_style), Paragraph('Phase 2', cell_center)],
    [Paragraph('src/components/modals/ModalManager.tsx', cell_style), Paragraph('Modal routing + context passing', cell_style), Paragraph('Phase 2', cell_center)],
    [Paragraph('src/components/modals/CollectRentModal.tsx', cell_style), Paragraph('Rent collection + receipt generation', cell_style), Paragraph('Phase 2, 3', cell_center)],
    [Paragraph('src/components/modals/BulkEditPropertyModal.tsx', cell_style), Paragraph('Bulk property editing', cell_style), Paragraph('Phase 2', cell_center)],
    [Paragraph('src/components/forms/PropertyForm.tsx', cell_style), Paragraph('Property/unit creation + editing', cell_style), Paragraph('Phase 2, 3', cell_center)],
    [Paragraph('src/components/details/ReceiptDetailView.tsx', cell_style), Paragraph('Receipt display + PDF', cell_style), Paragraph('Phase 2', cell_center)],
    [Paragraph('src/contexts/FinanceContext.tsx', cell_style), Paragraph('Finance state (extend for property)', cell_style), Paragraph('Phase 3', cell_center)],
    [Paragraph('convex/schema.ts', cell_style), Paragraph('Database schema (add collection model)', cell_style), Paragraph('Phase 3', cell_center)],
    [Paragraph('src/hooks/useProperties.ts', cell_style), Paragraph('Property CRUD hooks', cell_style), Paragraph('Phase 2, 3', cell_center)],
    [Paragraph('src/hooks/useFinance.ts', cell_style), Paragraph('Finance hooks (extend for property)', cell_style), Paragraph('Phase 3', cell_center)],
]
col_w_files = [CONTENT_W * 0.40, CONTENT_W * 0.36, CONTENT_W * 0.24]
story.extend(make_table(files_ref, col_w_files, 'Table 4: Key Files Reference for AntiGravity'))

story.append(add_heading('<b>8.3 Communication Protocol</b>', h2_style, level=1))
story.append(ppara(
    'For each phase, the AntiGravity team should follow this communication protocol to ensure '
    'alignment and prevent integration issues:'
))
story.append(bp('<b>Before starting a phase:</b> Confirm understanding of all tasks and acceptance criteria. Flag any ambiguities or concerns before writing code.'))
story.append(bp('<b>During a phase:</b> Report blockers immediately. If a task requires a larger refactor than estimated, communicate the scope change before proceeding.'))
story.append(bp('<b>After completing a phase:</b> Provide a summary of what was changed, any deviations from the plan, and confirmation that all acceptance criteria pass. Include screenshots or screen recordings of the fixed workflows.'))
story.append(bp('<b>After each phase deployment:</b> Conduct a brief regression test across the full property management flow (add property, add units, record payments, issue receipts, log maintenance, view reports) to catch any unintended side effects.'))

# ═══════════════════════════════════════════
# SECTION 9: RISK REGISTER
# ═══════════════════════════════════════════
story.append(add_heading('<b>9. Risk Register</b>', h1_style, level=0))
story.append(ppara(
    'The following risks have been identified for this implementation plan. Each risk includes '
    'a mitigation strategy and a contingency plan if the risk materializes.'
))

risk_data = [
    [Paragraph('<b>Risk</b>', header_cell),
     Paragraph('<b>Likelihood</b>', header_cell),
     Paragraph('<b>Impact</b>', header_cell),
     Paragraph('<b>Mitigation</b>', header_cell)],
    [Paragraph('Convex auth changes break existing flows', cell_style),
     sev('Medium', MEDIUM_YELLOW), sev('High', HIGH_ORANGE),
     Paragraph('Deploy auth changes to staging first; test all existing user flows before production', cell_style)],
    [Paragraph('Payment unification causes data loss or duplication', cell_style),
     sev('Medium', MEDIUM_YELLOW), sev('Critical', CRITICAL_RED),
     Paragraph('Backup Convex database before migration; run migration on staging first; add deduplication logic', cell_style)],
    [Paragraph('PropertyTrackingView integration causes UI regressions', cell_style),
     sev('Low', LOW_GREEN), sev('Medium', MEDIUM_YELLOW),
     Paragraph('Feature flag the integration; test with both single and multi-unit properties', cell_style)],
    [Paragraph('Context memoization changes cause stale data reads', cell_style),
     sev('Medium', MEDIUM_YELLOW), sev('Medium', MEDIUM_YELLOW),
     Paragraph('Add React DevTools profiler before/after comparison; test all CRUD operations', cell_style)],
    [Paragraph('Receipt template changes break existing PDF generation', cell_style),
     sev('Low', LOW_GREEN), sev('Low', LOW_GREEN),
     Paragraph('Keep old generation path as fallback; A/B test with sample receipts', cell_style)],
    [Paragraph('Scope creep from Phase 5 discovery', cell_style),
     sev('High', HIGH_ORANGE), sev('Low', LOW_GREEN),
     Paragraph('Time-box Phase 5 to 2 weeks; prioritize findings into a separate backlog', cell_style)],
]
col_w_risk = [CONTENT_W * 0.26, CONTENT_W * 0.12, CONTENT_W * 0.12, CONTENT_W * 0.50]
story.extend(make_table(risk_data, col_w_risk, 'Table 5: Risk Register'))

# ═══════════════════════════════════════════
# SECTION 10: NEXT ITERATION
# ═══════════════════════════════════════════
story.append(add_heading('<b>10. What Comes After: Next Iteration Planning</b>', h1_style, level=0))
story.append(ppara(
    'Once all five phases are complete, the property management module will have a solid foundation. '
    'However, the audit identified several areas that are beyond the scope of this plan but should be '
    'addressed in subsequent iterations. These represent opportunities for continued improvement and '
    'should be prioritized based on user feedback from Phase 5\'s end-to-end testing.'
))
story.append(bp('<b>Real Payment Gateway Integration:</b> Replace the simulated PaymentGatewayModal with an actual payment processor (Paystack or Flutterwave for the Nigerian market). This is a significant feature that requires its own planning cycle.'))
story.append(bp('<b>Professional Valuation Module:</b> Build a proper valuation workflow with history tracking, professional valuation report generation, date tracking, and the ability to compare valuations over time. This should only appear for properties categorized as "For Sale".'))
story.append(bp('<b>Tenant Self-Service Portal:</b> Allow tenants to view their payment history, download receipts, and submit maintenance requests without going through the property manager. This extends the existing client portal architecture.'))
story.append(bp('<b>Automated Rent Reminders:</b> The AutomationCenter already supports automation rules. Build pre-configured automation templates for rent reminders, lease expiry notices, and maintenance scheduling.'))
story.append(bp('<b>Property Analytics Dashboard:</b> Expand the PropertyReports component into a full analytics dashboard with trend charts, occupancy projections, and ROI calculations.'))
story.append(bp('<b>Multi-Currency Support:</b> While the Naira is currently hardcoded, future expansion may require multi-currency support. The tier constants and NairaSymbol component should be refactored to support configurable currencies.'))
story.append(bp('<b>Offline Mode:</b> The current architecture requires a constant internet connection. Consider adding offline-first capabilities for property inspections and maintenance logging in the field.'))
story.append(Spacer(1, 10))
story.append(ppara(
    'The key principle for the next iteration is the same one guiding this plan: keep things neat '
    'and simple. Each new feature should integrate cleanly with the existing architecture, follow the '
    'established hook protocol, and deliver a clear efficiency improvement without adding confusion. '
    'The property management module is close to an architecture that will serve as the foundation going '
    'forward. The fixes in this plan are designed to close the remaining gaps and deliver on that promise.'
))

# ━━ BUILD ━━
doc.multiBuild(story)
print(f"PDF generated: {output_path}")
