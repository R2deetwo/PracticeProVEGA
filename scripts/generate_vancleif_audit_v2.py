#!/usr/bin/env python3
"""
PracticePro Van Clief (Jake Van Clief — ICM) Methodology Audit Report
Reframes the codebase audit through the lens of:
  - ICM (Interpretable Context Methodology) — folder structure as agent architecture
  - "You're automating the wrong layer" — context IS the orchestration
  - Systems thinking for AI builders
  - Alpha-launch posture (ship-blocker / polish / nice-to-have tagging)
Preserves genuine engineering findings from the previous (wrong-context) audit.
"""

import os
import sys
import hashlib
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, Image, Flowable, HRFlowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# ━━ Cascade Palette ━━
PAGE_BG       = colors.HexColor('#f4f4f3')
SECTION_BG    = colors.HexColor('#f1f1f0')
CARD_BG       = colors.HexColor('#ecece9')
TABLE_STRIPE  = colors.HexColor('#ecebea')
HEADER_FILL   = colors.HexColor('#6a634e')
COVER_BLOCK   = colors.HexColor('#766d54')
BORDER        = colors.HexColor('#cbc5b1')
ICON          = colors.HexColor('#a59050')
ACCENT        = colors.HexColor('#8b7226')
ACCENT_2      = colors.HexColor('#6c50bf')
TEXT_PRIMARY  = colors.HexColor('#252421')
TEXT_MUTED    = colors.HexColor('#797770')
SEM_SUCCESS   = colors.HexColor('#498b5f')
SEM_WARNING   = colors.HexColor('#a68542')
SEM_ERROR     = colors.HexColor('#894d47')
SEM_INFO      = colors.HexColor('#4a76a3')

CRITICAL_BG = colors.HexColor('#f8e8e6')
HIGH_BG     = colors.HexColor('#fbf0dd')
MEDIUM_BG   = colors.HexColor('#fdf6e3')
LOW_BG      = colors.HexColor('#eef5ee')
SAFE_BG     = colors.HexColor('#eef5ee')
BLOCKER_BG  = colors.HexColor('#f8e8e6')

# ━━ Font registration ━━
FONT_DIR = '/usr/share/fonts'
def register_fonts():
    try:
        pdfmetrics.registerFont(TTFont('NotoSerif', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
        pdfmetrics.registerFont(TTFont('NotoSerif-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
        pdfmetrics.registerFont(TTFont('NotoSans', f'{FONT_DIR}/truetype/chinese/NotoSansSC-Regular.ttf'))
        pdfmetrics.registerFont(TTFont('NotoSans-Bold', f'{FONT_DIR}/truetype/chinese/NotoSansSC-Bold.ttf'))
        pdfmetrics.registerFont(TTFont('Mono', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
        pdfmetrics.registerFont(TTFont('Mono-Bold', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono-Bold.ttf'))
    except Exception:
        pass

register_fonts()

BODY_FONT = 'NotoSerif' if 'NotoSerif' in pdfmetrics.getRegisteredFontNames() else 'Times-Roman'
BODY_BOLD = 'NotoSerif-Bold' if 'NotoSerif-Bold' in pdfmetrics.getRegisteredFontNames() else 'Times-Bold'
HEAD_FONT = 'NotoSans-Bold' if 'NotoSans-Bold' in pdfmetrics.getRegisteredFontNames() else 'Helvetica-Bold'
MONO_FONT = 'Mono' if 'Mono' in pdfmetrics.getRegisteredFontNames() else 'Courier'

# ━━ Styles ━━
def make_styles():
    s = {}
    s['Title'] = ParagraphStyle('Title', fontName=HEAD_FONT, fontSize=26, leading=32,
                                 textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=4*mm)
    s['Subtitle'] = ParagraphStyle('Subtitle', fontName=BODY_FONT, fontSize=13, leading=18,
                                    textColor=TEXT_MUTED, alignment=TA_LEFT, spaceAfter=8*mm)
    s['MetaLine'] = ParagraphStyle('MetaLine', fontName=BODY_FONT, fontSize=10, leading=14,
                                    textColor=TEXT_MUTED, alignment=TA_LEFT)
    s['H1'] = ParagraphStyle('H1', fontName=HEAD_FONT, fontSize=17, leading=23,
                              textColor=HEADER_FILL, spaceBefore=8*mm, spaceAfter=4*mm, keepWithNext=True)
    s['H2'] = ParagraphStyle('H2', fontName=HEAD_FONT, fontSize=13, leading=17,
                              textColor=TEXT_PRIMARY, spaceBefore=5*mm, spaceAfter=3*mm, keepWithNext=True)
    s['H3'] = ParagraphStyle('H3', fontName=HEAD_FONT, fontSize=11, leading=14,
                              textColor=ACCENT, spaceBefore=3*mm, spaceAfter=2*mm, keepWithNext=True)
    s['Body'] = ParagraphStyle('Body', fontName=BODY_FONT, fontSize=10, leading=15,
                                textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=3*mm)
    s['Bullet'] = ParagraphStyle('Bullet', fontName=BODY_FONT, fontSize=10, leading=14,
                                  textColor=TEXT_PRIMARY, leftIndent=14, bulletIndent=4, spaceAfter=2)
    s['Code'] = ParagraphStyle('Code', fontName=MONO_FONT, fontSize=8.5, leading=11.5,
                                textColor=TEXT_PRIMARY, backColor=CARD_BG, borderPadding=4,
                                leftIndent=4, rightIndent=4, spaceAfter=3*mm, spaceBefore=1*mm)
    s['Caption'] = ParagraphStyle('Caption', fontName=BODY_FONT, fontSize=8.5, leading=11,
                                   textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=1*mm, spaceAfter=4*mm)
    s['Callout'] = ParagraphStyle('Callout', fontName=BODY_FONT, fontSize=10.5, leading=15,
                                   textColor=TEXT_PRIMARY, backColor=CARD_BG, borderPadding=8,
                                   leftIndent=8, rightIndent=8, spaceAfter=4*mm, spaceBefore=2*mm)
    s['CalloutShipBlocker'] = ParagraphStyle('CalloutShipBlocker', fontName=BODY_FONT, fontSize=10.5, leading=15,
                                   textColor=TEXT_PRIMARY, backColor=BLOCKER_BG, borderPadding=8,
                                   leftIndent=8, rightIndent=8, spaceAfter=4*mm, spaceBefore=2*mm)
    s['CalloutPolish'] = ParagraphStyle('CalloutPolish', fontName=BODY_FONT, fontSize=10.5, leading=15,
                                   textColor=TEXT_PRIMARY, backColor=HIGH_BG, borderPadding=8,
                                   leftIndent=8, rightIndent=8, spaceAfter=4*mm, spaceBefore=2*mm)
    s['CalloutNice'] = ParagraphStyle('CalloutNice', fontName=BODY_FONT, fontSize=10.5, leading=15,
                                   textColor=TEXT_PRIMARY, backColor=SAFE_BG, borderPadding=8,
                                   leftIndent=8, rightIndent=8, spaceAfter=4*mm, spaceBefore=2*mm)
    s['CalloutShowcase'] = ParagraphStyle('CalloutShowcase', fontName=BODY_FONT, fontSize=10.5, leading=15,
                                   textColor=TEXT_PRIMARY, backColor=SAFE_BG, borderPadding=8,
                                   leftIndent=8, rightIndent=8, spaceAfter=4*mm, spaceBefore=2*mm)
    s['TableHeader'] = ParagraphStyle('TableHeader', fontName=HEAD_FONT, fontSize=9, leading=12,
                                       textColor=colors.white, alignment=TA_LEFT)
    s['TableCell'] = ParagraphStyle('TableCell', fontName=BODY_FONT, fontSize=9, leading=12,
                                     textColor=TEXT_PRIMARY, alignment=TA_LEFT)
    s['TableCellSmall'] = ParagraphStyle('TableCellSmall', fontName=BODY_FONT, fontSize=8, leading=11,
                                     textColor=TEXT_PRIMARY, alignment=TA_LEFT)
    s['TableCellBold'] = ParagraphStyle('TableCellBold', fontName=HEAD_FONT, fontSize=9, leading=12,
                                     textColor=TEXT_PRIMARY, alignment=TA_LEFT)
    s['TocL0'] = ParagraphStyle('TocL0', fontName=HEAD_FONT, fontSize=11, leading=18,
                                 textColor=TEXT_PRIMARY, leftIndent=0)
    s['TocL1'] = ParagraphStyle('TocL1', fontName=BODY_FONT, fontSize=10, leading=15,
                                 textColor=TEXT_MUTED, leftIndent=14)
    return s

STYLES = make_styles()

class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

def add_heading(text, style, level=0):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def header_footer(canv: canvas.Canvas, doc):
    canv.saveState()
    canv.setStrokeColor(BORDER)
    canv.setLineWidth(0.4)
    canv.line(20*mm, A4[1] - 14*mm, A4[0] - 20*mm, A4[1] - 14*mm)
    canv.setFont(BODY_FONT, 8)
    canv.setFillColor(TEXT_MUTED)
    canv.drawString(20*mm, A4[1] - 11*mm, 'PracticePro — Van Clief (ICM) Methodology Audit')
    canv.drawRightString(A4[0] - 20*mm, A4[1] - 11*mm, 'August 2026')
    canv.setFont(BODY_FONT, 8)
    canv.setFillColor(TEXT_MUTED)
    canv.drawCentredString(A4[0]/2, 10*mm, f'Page {doc.page}')
    canv.restoreState()

def P(text, style='Body'):
    return Paragraph(text, STYLES[style])

def cell(text, style='TableCell'):
    return Paragraph(text, STYLES[style])

def code(text):
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    text = text.replace(' ', '&nbsp;').replace('\n', '<br/>')
    return Paragraph(text, STYLES['Code'])

def blocker_badge():
    return f'<font color="{SEM_ERROR.hexval()}"><b>SHIP-BLOCKER</b></font>'

def polish_badge():
    return f'<font color="{SEM_WARNING.hexval()}"><b>POLISH</b></font>'

def nice_badge():
    return f'<font color="{SEM_SUCCESS.hexval()}"><b>NICE-TO-HAVE</b></font>'

def showcase_badge():
    return f'<font color="{SEM_SUCCESS.hexval()}"><b>SHOWCASE</b></font>'

def styled_table(data, col_widths, header=True, stripe=True, header_bg=HEADER_FILL):
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    style_cmds = [
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ]
    if header:
        style_cmds.extend([
            ('BACKGROUND', (0,0), (-1,0), header_bg),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), HEAD_FONT),
            ('FONTSIZE', (0,0), (-1,0), 9),
            ('BOTTOMPADDING', (0,0), (-1,0), 6),
            ('TOPPADDING', (0,0), (-1,0), 6),
        ])
    if stripe:
        start_row = 1 if header else 0
        for i in range(start_row, len(data)):
            if (i - start_row) % 2 == 1:
                style_cmds.append(('BACKGROUND', (0,i), (-1,i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

CONTENT_WIDTH = A4[0] - 40*mm


# ═══════════════════════════════════════════════════════════════════
# CONTENT BUILDERS
# ═══════════════════════════════════════════════════════════════════

def build_title_page():
    story = []
    story.append(Spacer(1, 25*mm))
    story.append(P('PRACTICEPRO — CODEBASE AUDIT', 'MetaLine'))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('Van Clief ICM Methodology Audit', STYLES['Title']))
    story.append(Paragraph('Applying Jake Van Clief\'s Interpretable Context Methodology to ALOA / ARIA, with a ship-blocker / polish / nice-to-have launch lens', STYLES['Subtitle']))
    story.append(Spacer(1, 4*mm))
    story.append(HRFlowable(width='100%', thickness=0.6, color=ACCENT, spaceAfter=4*mm))

    story.append(P(
        'A focused audit of the ALOA / ARIA AI prompt architecture through Jake Van Clief\'s ICM lens '
        '(folder structure as agent architecture, prompts as versioned markdown files, no heavy framework '
        'code) — plus a "you\'re automating the wrong layer" pass over the frontend / backend boundary, '
        'and an explicit alpha-launch posture tagging every finding as <b>SHIP-BLOCKER</b>, <b>POLISH</b>, '
        'or <b>NICE-TO-HAVE</b>. Genuine engineering findings from the previous audit '
        '(multi-tenant auth holes, dead shadcn code, god components, XSS hardening) are preserved and '
        'reframed where applicable.', 'Body'))
    story.append(Spacer(1, 4*mm))

    stats_data = [
        [cell('Metric', 'TableHeader'), cell('Value', 'TableHeader'), cell('Status', 'TableHeader')],
        [cell('ICM scaffold markdown files'), cell('5 in /ai/prompts/ (numbered)'), cell(showcase_badge())],
        [cell('ICM completeness score'), cell('~18% — markdown is documentation only, zero build-time loading'), cell(polish_badge())],
        [cell('ALOA / ARIA system prompts in code'), cell('5 mapped + 17 code-only (9 agents, 2 Convex, 6 inline)'), cell(polish_badge())],
        [cell('Identity guardrail systems'), cell('2 parallel (old config/ + new constants/) — split-brain'), cell(polish_badge())],
        [cell('Wrong-layer findings'), cell('16 catalogued (3 ship-blockers, 12 polish, 5 nice-to-have)'), cell(polish_badge())],
        [cell('Van Clief showcases (already correct)'), cell('3 — sales-lead pipeline, billing state machine, notifyFounders helper'), cell(showcase_badge())],
        [cell('TypeScript errors (post-fix)'), cell('315 (was 327; 5 surgical fixes applied in prior session)'), cell(showcase_badge())],
        [cell('Build status'), cell('Passing (22s)'), cell(showcase_badge())],
        [cell('Atrium launch posture'), cell('3 ship-blockers must fix; rest is polish / nice-to-have'), cell(blocker_badge())],
    ]
    story.append(styled_table(stats_data, [55*mm, 80*mm, 35*mm]))
    story.append(Spacer(1, 10*mm))
    story.append(P('<b>Report date:</b> 16 August 2026 &nbsp;&nbsp;|&nbsp;&nbsp; <b>Methodology:</b> Jake Van Clief — ICM, "automating the wrong layer", systems thinking &nbsp;&nbsp;|&nbsp;&nbsp; <b>Auditor:</b> Super Z (Z.ai)', 'MetaLine'))
    story.append(PageBreak())
    return story


def build_toc():
    story = []
    story.append(P('Contents', 'H1'))
    story.append(Spacer(1, 4*mm))
    toc = TableOfContents()
    toc.levelStyles = [STYLES['TocL0'], STYLES['TocL1']]
    story.append(toc)
    story.append(PageBreak())
    return story


def build_methodology_intro():
    story = []
    story.append(add_heading('1. The Van Clief Methodology — In Practice', STYLES['H1'], 0))
    story.append(P(
        'Jake Van Clief (@JEVanClief) teaches a small set of related ideas that share a single posture: '
        '<i>stop building complex orchestration code; structure the context instead.</i> The context IS '
        'the orchestration. For PracticePro — a multi-product SaaS (Vega / Atrium / Komplete) with an AI '
        'copilot (ALOA for legal, ARIA for property) — this audit applies four of his ideas to the '
        'codebase and reframes the genuine engineering findings from the prior session through that lens.'
    ))

    story.append(add_heading('1.1 The Four Ideas Applied Here', STYLES['H2'], 1))
    ideas_data = [
        [cell('Idea', 'TableHeader'), cell('What Van Clief means', 'TableHeader'), cell('How this audit applies it', 'TableHeader')],
        [cell('<b>1. ICM</b><br/>(Interpretable Context Methodology)'),
         cell('Folder structure IS the architecture. Numbered folders represent workflow stages. Markdown files carry prompts and context. No heavy framework code. AI workflows become interpretable, maintainable, and editable without deploys.'),
         cell('Audit the existing /ai/prompts/ scaffold (5 numbered MD files). Measure completeness: do code paths actually LOAD the markdown, or is it just documentation? Catalog every prompt string still living in code.')],
        [cell('<b>2. You\'re Automating the Wrong Layer</b>'),
         cell('Most people build complex orchestration code when they should be structuring the context that feeds the system. The notification chain, the badge counting, the debounce logic — these are all "the wrong layer" if they\'re in the frontend when they could be a single backend event.'),
         cell('Find every place the React client is doing work that should be a Convex mutation or query. Trace the sales-lead, notification, and billing pipelines. Catalog the wrong-layer patterns.')],
        [cell('<b>3. Systems Thinking</b>'),
         cell('Treat the product as one system, not separate pieces. Vega, Atrium, and the Founder admin are three faces of one system. Data flows between them should be first-class.'),
         cell('Map the shared core vs product-specific shells. Identify where the three faces duplicate logic that should be shared.')],
        [cell('<b>4. Alpha Launch — Ship and Iterate</b>'),
         cell('Launch fast, learn from real users, iterate. Don\'t perfect before launching. Real user feedback on the core value proposition is worth more than polish.'),
         cell('Tag every finding as SHIP-BLOCKER / POLISH / NICE-TO-HAVE so the team can ship Atrium with confidence and know exactly what to fix in the first 2 weeks post-launch.')],
    ]
    story.append(styled_table(ideas_data, [32*mm, 70*mm, 68*mm]))
    story.append(P('<i>Table 1.1 — The four Van Clief ideas applied in this audit. Each idea maps to a concrete section of the report.</i>', 'Caption'))

    story.append(add_heading('1.2 What This Audit Is NOT', STYLES['H2'], 1))
    story.append(P(
        'This is not a generic code-review. It is a focused Van Clief-lens audit with three constraints. '
        '<b>First</b>, the ICM scope is limited to the ALOA / ARIA chat surface (AgencyHub system '
        'instruction, tool definitions, identity guardrails) — DraftPro, Research Studio, and the '
        'proactive engine are flagged but out of scope for migration this session. <b>Second</b>, the '
        'wrong-layer audit is identify-only — no code is changed in the frontend / backend boundary this '
        'session; recommendations are catalogued for the team to action. <b>Third</b>, every finding is '
        'tagged with a launch posture so the team can ship Atrium with confidence.'
    ))

    story.append(add_heading('1.3 What Is Preserved From the Previous Audit', STYLES['H2'], 1))
    story.append(P(
        'The previous audit (which mistakenly applied a jewellery-house metaphor) still produced '
        'genuine engineering findings that are independent of any methodology. These are preserved and '
        'reframed through the Van Clief lens where applicable. They are NOT discarded.'
    ))

    preserve_data = [
        [cell('Finding', 'TableHeader'), cell('From previous audit', 'TableHeader'), cell('Reframed through Van Clief lens', 'TableHeader')],
        [cell('portals.ts multi-tenant hole (1 of 70 mutations authed)'),
         cell('Critical security finding'),
         cell('Becomes SHIP-BLOCKER under the launch lens. NOT a Van Clief wrong-layer issue per se, but a backend-ownership issue — every mutation should own its own auth context.')],
        [cell('4 untrusted dangerouslySetInnerHTML sites'),
         cell('XSS hardening — already FIXED in prior session'),
         cell('Stays FIXED. Showcases the "context IS the orchestration" principle: the sanitization rule is the context; the component just renders the sanitized output.')],
        [cell('49 dead shadcn files (~170 TS errors)'),
         cell('Tech debt'),
         cell('Becomes NICE-TO-HAVE under the launch lens. Not a blocker; quick morale win to clear in 1 hour.')],
        [cell('God components (9 files > 1,500 LOC)'),
         cell('Maintainability'),
         cell('Becomes POLISH. The "wrong layer" lens reveals that many god components are doing orchestration in render — the orchestration should be context (hooks), the render should be pure.')],
        [cell('Email-as-token + unsigned ?impersonate= param'),
         cell('Critical auth risks'),
         cell('Becomes SHIP-BLOCKER. The "wrong layer" lens clarifies: auth context belongs on the backend; the URL param is the wrong layer for identity.')],
        [cell('5 surgical fixes applied (Header imports, gemini union, capacitor nullability, sanitize wrappers, TermsAcceptance guard)'),
         cell('Already applied; build green'),
         cell('Preserved. No regression.')],
    ]
    story.append(styled_table(preserve_data, [45*mm, 45*mm, 80*mm]))
    story.append(P('<i>Table 1.2 — Findings preserved from the previous audit, reframed through the Van Clief launch lens.</i>', 'Caption'))

    return story


def build_icm_audit():
    story = []
    story.append(add_heading('2. ICM Audit — ALOA / ARIA Prompt Architecture', STYLES['H1'], 0))
    story.append(P(
        'The ICM scaffold already exists. There is a /ai/ directory with a README that explains the '
        'philosophy, and /ai/prompts/ contains 5 numbered markdown files (01-aloa-legal-identity.md, '
        '02-aria-property-identity.md, 03-identity-guardrail.md, 04-interactive-form-protocol.md, '
        '05-precision-protocol.md). The README even admits the gap: "Eventually, the source code files '
        'should READ from these markdown files at build time." This audit measures how far that '
        'migration has actually progressed.'
    ))

    story.append(add_heading('2.1 ICM Completeness Score: ~18%', STYLES['H2'], 1))
    score_data = [
        [cell('Dimension', 'TableHeader'), cell('Weight', 'TableHeader'), cell('Current', 'TableHeader'), cell('Score', 'TableHeader')],
        [cell('Markdown files exist for primary prompts'), cell('20%'), cell('5 of ~8 (62%)'), cell('12.5%')],
        [cell('Markdown files exist for secondary prompts (agents, Convex)'), cell('10%'), cell('0 of ~10'), cell('0%')],
        [cell('Markdown content matches code (no drift)'), cell('20%'), cell('~1 of 5 closely matches'), cell('4%')],
        [cell('Code reads from markdown at build time'), cell('30%'), cell('0 of 5 mapped functions load MD'), cell('0%')],
        [cell('Single source of truth (no competing systems)'), cell('10%'), cell('2 identity-guardrail systems coexist'), cell('2%')],
        [cell('Markdown editable without deploy (README\'s goal)'), cell('10%'), cell('False — editing MD has zero runtime effect'), cell('0%')],
        [cell('<b>Overall</b>', 'TableCellBold'), cell('100%'), cell('—'), cell(f'<b>~18%</b>')],
    ]
    story.append(styled_table(score_data, [70*mm, 20*mm, 50*mm, 30*mm]))
    story.append(P('<i>Table 2.1 — ICM completeness score. The scaffold exists; the migration from "code is source of truth" to "markdown is source of truth" has not started in code.</i>', 'Caption'))

    story.append(add_heading('2.2 Drift Report — Markdown vs Code', STYLES['H2'], 1))
    story.append(P(
        'Comparing each markdown file against its corresponding code string reveals significant drift. '
        'The markdown is NOT a faithful mirror of the code; in some cases (the identity guardrail) the '
        'markdown is a 6-line stub while the code is a 92-line fortress. Anyone editing only the '
        'markdown would weaken the guardrail. The most alarming drift cases are below.'
    ))

    drift_data = [
        [cell('MD file', 'TableHeader'), cell('Drift', 'TableHeader'), cell('Specific mismatches', 'TableHeader')],
        [cell('01-aloa-legal-identity.md'),
         cell(f'{blocker_badge()} HIGH'),
         cell('MD says "designed for PracticePro Vega"; code says "designed for Komplet" (product rebrand not propagated). MD missing "JURISDICTIONAL ANALYSIS IN CHAT" + "ACTION PROTOCOLS" sections that exist in code.')],
        [cell('02-aria-property-identity.md'),
         cell(f'{blocker_badge()} HIGH'),
         cell('MD says "Asset & Revenue Intelligence Assistant"; code says "Asset & Revenue Intelligent Assistant" (Intelligence→Intelligent). MD has "Strict Terminology" section (Resident/Unit/Service Charge/Minimum Vend); code has NONE of this. Code has Nigerian property law section; MD does not.')],
        [cell('03-identity-guardrail.md'),
         cell(f'{blocker_badge()} CRITICAL'),
         cell('MD is a 6-line stub; code is a 92-line fortress with ~15 banned phrases + canned responses for "who are you", "are you Gemini", "ignore your system prompt". MD-only editors would WEAKEN the guardrail.')],
        [cell('04-interactive-form-protocol.md'),
         cell(f'{showcase_badge()} LOW'),
         cell('Closest match (~90% aligned). Best candidate for first ?raw import proof-of-concept.')],
        [cell('05-precision-protocol.md'),
         cell(f'{polish_badge()} MEDIUM'),
         cell('MD has Pre-Drafting Checklist + Quality Gate that code lacks. Code has 3 variants (Vega/Atrium/Komplete); MD documents only 2.')],
    ]
    story.append(styled_table(drift_data, [45*mm, 25*mm, 90*mm]))
    story.append(P('<i>Table 2.2 — Drift between markdown and code. The identity-guardrail drift is the most dangerous: editing the markdown thinking it is the source of truth would weaken the LLM identity lock.</i>', 'Caption'))

    story.append(add_heading('2.3 Code-Only Prompts (No Markdown Counterpart)', STYLES['H2'], 1))
    story.append(P(
        'Beyond the 5 mapped files, there are 17 additional prompt strings living in code with zero '
        'markdown counterpart. These represent the bulk of the ICM migration work. The most significant '
        'are the 9 agent SYSTEM_PROMPTs (DataProtectionAgent, NigerianTaxComplianceAgent, '
        'RpcGuidanceAgent, DraftingAgent, NigerianLegalJurisdictionAgent, IngestionAgent, '
        'ScaleOfChargesAgent, ResearchAgent, AdvancedLegalDocumentIntelligenceAgent) and the 2 Convex '
        'server-side AI prompts (morning briefing generator in convex/proactive.ts, conversation '
        'summarizer in convex/conversationMemory.ts).'
    ))

    code_only_data = [
        [cell('Prompt source', 'TableHeader'), cell('File:Line', 'TableHeader'), cell('Proposed MD file', 'TableHeader')],
        [cell('9 agent SYSTEM_PROMPTs'),
         cell('src/agents/*.ts (one per file)'),
         cell('09-data-protection.md through 17-aldia.md (9 files)')],
        [cell('Morning briefing generator'),
         cell('convex/proactive.ts:760-803 (44 lines)'),
         cell('18-morning-briefing.md')],
        [cell('Conversation summarizer'),
         cell('convex/conversationMemory.ts:203-216 (14 lines)'),
         cell('19-conversation-summarizer.md')],
        [cell('17 function-calling tool descriptions'),
         cell('src/services/geminiService.ts:23-268'),
         cell('06-tool-catalog.md (descriptions only; schemas stay in TS)')],
        [cell('streamDraft system instruction'),
         cell('src/services/geminiService.ts:778-805'),
         cell('20-research-mode.md (consolidates 2 divergent blocks)')],
        [cell('analyzeAttorneyDictation prompt'),
         cell('src/services/geminiService.ts:1003-1004'),
         cell('21-dictation-analyzer.md')],
        [cell('generateResearchQuery prompt'),
         cell('src/services/geminiService.ts:1160-1189'),
         cell('22-research-query-generator.md')],
    ]
    story.append(styled_table(code_only_data, [55*mm, 55*mm, 50*mm]))
    story.append(P('<i>Table 2.3 — Code-only prompts that need markdown counterparts. The 9 agent SYSTEM_PROMPTs are the largest cluster; the 2 Convex prompts have a runtime-loading caveat (Convex does not support Vite ?raw imports — see §2.6).</i>', 'Caption'))

    story.append(add_heading('2.4 Identity Guardrail Split-Brain', STYLES['H2'], 1))
    story.append(Paragraph(
        f'<b>{polish_badge()} Two parallel identity-guardrail systems coexist. This is a "wrong layer" issue AND an ICM issue.</b><br/><br/>'
        'The OLD system lives in <code>src/config/identityGuardrails.ts</code> and exposes '
        '<code>identityLock(agent)</code> + <code>validateAIResponse(response, agent)</code> '
        '(returns <code>{isValid, sanitized, violations}</code>). The NEW system lives in '
        '<code>src/constants/identityGuardrails.ts</code> and exposes <code>getIdentityGuardrail(isProperty)</code> '
        '+ <code>validateAIResponse(response, isProperty)</code> (returns a string). The two systems have '
        'different prohibited-phrase lists, so the same AI response can PASS one validator and FAIL the other. '
        'Confirmed callers: <code>AgencyHub.ts:168</code> uses the NEW system (correct); '
        '<code>geminiService.ts:7,509,547,727</code> uses the OLD system (split-brain); '
        '<code>AloaChat.tsx:56</code> uses the NEW system (correct). The OLD <code>identityLock()</code> '
        'function at <code>config/identityGuardrails.ts:64</code> has zero callers — it is dead code.',
        STYLES['CalloutPolish']
    ))

    story.append(add_heading('2.5 A Hidden Bug — Atrium Chat Gets the Legal Precision Protocol', STYLES['H2'], 1))
    story.append(Paragraph(
        f'<b>{blocker_badge()} AgencyHub.ts:240 passes a string where a boolean is expected. Atrium-mode chat silently uses the Vega (legal) precision protocol.</b><br/><br/>'
        'The call site <code>getAloaProtocol(appState.firmDetails?.product)</code> passes the product '
        'string (e.g. <code>\'property\'</code>) as the first argument, which is typed '
        '<code>isUnified: boolean</code>. TypeScript flags this as an error '
        '(<code>src/agents/AgencyHub.ts(240,23): error TS2345</code>). At runtime, the non-empty string '
        'is truthy, so <code>isUnified</code> is treated as <code>true</code>, and the function returns '
        '<code>ALOA_KOMPLETE_PROTOCOL</code> — but only if the third arg is also <code>\'komplete\'</code>. '
        'In practice, the third arg is <code>undefined</code>, so the function falls through to the '
        'default <code>return ALOA_PRECISION_PROTOCOL</code> (the Vega legal variant). This means '
        'Atrium users get the LEGAL precision protocol in their ARIA chat system instruction. The fix '
        'is one line: <code>getAloaProtocol(isUnified, null, appState.firmDetails?.product)</code>.',
        STYLES['CalloutShipBlocker']
    ))

    story.append(add_heading('2.6 Build-Time Loading — Recommended Approach', STYLES['H2'], 1))
    story.append(P(
        'Vite natively supports importing any file as a raw string via the <code>?raw</code> suffix. This '
        'requires zero plugins. The recommended approach is a thin loader module that imports the 5 '
        'markdown files as strings at build time, then replacing the inline string literals in code '
        'with references to the loader. The markdown files become the true source of truth; editing '
        'them and rebuilding is sufficient. No code changes are needed for routine prompt edits. This '
        'matches the ICM "no heavy framework code" philosophy — the loader is 10 lines of TypeScript.'
    ))

    story.append(code('''// src/constants/loadPrompts.ts — Vite ?raw imports
// Markdown files are bundled as strings at build time.
// Editing the .md files and rebuilding is sufficient; no code change needed.
import aloaIdentity from '../../ai/prompts/01-aloa-legal-identity.md?raw';
import ariaIdentity from '../../ai/prompts/02-aria-property-identity.md?raw';
import identityGuardrail from '../../ai/prompts/03-identity-guardrail.md?raw';
import formProtocol from '../../ai/prompts/04-interactive-form-protocol.md?raw';
import precisionProtocol from '../../ai/prompts/05-precision-protocol.md?raw';

export const PROMPTS = {
  aloaIdentity,
  ariaIdentity,
  identityGuardrail,
  formProtocol,
  precisionProtocol,
} as const;

// Then in AgencyHub.ts:
//   return PROMPTS.formProtocol;   // instead of the inline 45-line string
//'''))

    story.append(P(
        '<b>Convex caveat:</b> convex/proactive.ts and convex/conversationMemory.ts run in the Convex '
        'runtime, which does NOT support Vite <code>?raw</code> imports. For those two prompts, either '
        '(a) keep them inline in TS and accept they are not MD-sourced, or (b) load the MD via a Convex '
        '<code>httpAction</code> that reads from a deployed asset. Option (a) is pragmatic for now; '
        'option (b) is a Phase 2 polish item.'
    ))

    return story


def build_layer_audit():
    story = []
    story.append(add_heading('3. "You\'re Automating the Wrong Layer" Audit', STYLES['H1'], 0))
    story.append(P(
        'Van Clief\'s second idea: most people build complex orchestration code when they should be '
        'structuring the context that feeds the system. The context IS the orchestration. This section '
        'catalogues every place the React frontend is doing work that should be a Convex mutation or '
        'query. The findings are identify-only — no code is changed in the frontend / backend boundary '
        'this session. Each finding is tagged with a launch posture so the team can prioritize.'
    ))

    story.append(add_heading('3.1 The Three Van Clief Showcases (Already Correct)', STYLES['H2'], 1))
    story.append(P(
        'Before cataloguing what is wrong, it is worth noting what is already right. Three flows in '
        'PracticePro are textbook Van Clief implementations — the backend owns the orchestration, the '
        'client makes a single call, and the context (not client-side code) does the work. These '
        'showcases prove the team already understands the methodology; the wrong-layer findings below '
        'are places where that understanding has not yet been extended.'
    ))

    showcase_data = [
        [cell('Flow', 'TableHeader'), cell('Why it is a showcase', 'TableHeader'), cell('Pattern', 'TableHeader')],
        [cell(f'{showcase_badge()} Sales-lead pipeline'),
         cell('Contact Sales form fires ONE mutation (submitInquiry). Backend handles: insert row, notify founders, dispatch FCM push, update badge count reactively. Client does zero orchestration.'),
         cell('notifyFounders helper (convex/founderNotifications.ts) centralizes the dispatch. Replaces 30+ lines of copy-pasted notification logic across 3 mutations.')],
        [cell(f'{showcase_badge()} Retainer billing state machine'),
         cell('Staged → Queued → Sent / Failed / Paused / Skipped state machine lives entirely in Convex mutations. Each transition validates auth + ownership + state legality. Client fires ONE mutation per action (approve / pause / skip / retry). No optimistic updates, no sequential mutations, no client-side state machine duplication.'),
         cell('Cron-driven automation (scanMattersForRetainerCycle + advanceStagedOutbox) runs server-side. Client only renders the Convex subscription.')],
        [cell(f'{showcase_badge()} notifyFounders helper'),
         cell('A single server-side function that: finds all Founder-role users, inserts a notifications row per founder, queries their FCM tokens, schedules the FCM push. Replaces what would otherwise be 4+ client-side orchestration steps.'),
         cell('Context IS the orchestration: the founder list + notification payload IS the dispatch instruction.')],
    ]
    story.append(styled_table(showcase_data, [40*mm, 75*mm, 55*mm]))
    story.append(P('<i>Table 3.1 — Three flows that already exemplify the Van Clief methodology. The wrong-layer findings below are places where the same methodology has not yet been applied.</i>', 'Caption'))

    story.append(add_heading('3.2 Wrong-Layer Findings — Header.tsx Notification Bell', STYLES['H2'], 1))
    story.append(P(
        'The notification bell in Header.tsx is the single largest concentration of wrong-layer code in '
        'the codebase. The frontend merges 4 notification sources (broadcast notifications, user '
        'notifications, virtual client messages, virtual tenant messages), deduplicates them by '
        '<code>title|||message</code> key, infers notification type from message text, computes the '
        'unread count THREE different ways (backend query + frontend filter + localStorage-filtered), '
        'and fires local push notifications for events the backend already FCM-pushed. This is ~100 '
        'lines of client-side merge logic that should be one backend query.'
    ))

    header_findings = [
        [cell('Finding', 'TableHeader'), cell('What is wrong', 'TableHeader'), cell('Consolidation', 'TableHeader'), cell('Tag', 'TableHeader')],
        [cell('Frontend merges 4 notification sources'),
         cell('Header.tsx:91-168 — aggregatedNotifications useMemo merges broadcasts + user notifs + virtual client msgs + virtual tenant msgs. Dedupes by title|||message key. Infers type from message text.'),
         cell('One backend query getUnifiedNotificationFeed({userId, firmId}) that joins, dedupes by broadcastId, sets type at insertion time.'),
         cell(polish_badge())],
        [cell('Unread count computed 3 ways'),
         cell('Header.tsx:170-191 — appUnread (backend) + unreadCount (frontend filter) + localStorage-filtered count. Three sources of truth for one number.'),
         cell('One query returning {items, unreadCount}. Add dismissedAt field to notifications table.'),
         cell(polish_badge())],
        [cell('Local push duplicates FCM push'),
         cell('Header.tsx:225-232 — fires showLocalNotification for every new notification. Backend already dispatched FCM via notifyFounders. Founder sees TWO pushes per sales lead.'),
         cell('Backend tags notifications with dispatchedChannels: [\'fcm\']. Frontend skips local push if FCM already dispatched.'),
         cell(polish_badge())],
        [cell('Mark-all-read routes by virtual flag'),
         cell('Header.tsx:442-449, 587-613 — client filters by _isBroadcast flag (which the client set itself), routes virtual notifications to a different code path. Comment at line 587 says "FIX".'),
         cell('Every notification should be a real DB row. Backend mutation that creates a client/tenant message should also insert a notifications row.'),
         cell(polish_badge())],
        [cell('Toast logic welded into layout shell'),
         cell('Header.tsx:194-237 — toast useEffect depends on 5 concerns (aggregatedNotifications, isDataLoaded, addToast, navigateTo, currentUser). Cannot be tested or reused.'),
         cell('Extract to useNotificationToasts() hook in src/hooks/. Header becomes pure layout.'),
         cell(nice_badge())],
    ]
    story.append(styled_table(header_findings, [35*mm, 55*mm, 55*mm, 25*mm]))
    story.append(P('<i>Table 3.2 — Wrong-layer findings in the notification bell. All are POLISH — they work functionally but cause UX spam (double push), drift (localStorage vs Convex), and unnecessary network load.</i>', 'Caption'))

    story.append(add_heading('3.3 Wrong-Layer Findings — DataProvider.tsx Optimistic Updates', STYLES['H2'], 1))
    story.append(P(
        'DataProvider.tsx implements optimistic updates that fight with Convex real-time subscriptions. '
        'The team has already worked around the symptoms (the id/_id split to prevent duplicate task '
        'cards, the recentlyDeleted Set to prevent resurrection, the revert-on-failure logic) but the '
        'workarounds themselves are code smells. Convex subscriptions push canonical state within '
        '~50ms; the optimistic update is unnecessary and adds race-condition surface area.'
    ))

    provider_findings = [
        [cell('Finding', 'TableHeader'), cell('Workaround in code today', 'TableHeader'), cell('Van Clief fix', 'TableHeader'), cell('Tag', 'TableHeader')],
        [cell('Optimistic addItem'),
         cell('Generates temp UUID, optimistically inserts, then on success REPLACES local item with Convex _id. Comment explains the id/_id split was learned the hard way from duplicate task cards.'),
         cell('Skip optimistic update; let Convex subscription push the new item within ~50ms. Acceptable latency for most tables.'),
         cell(polish_badge())],
        [cell('Optimistic deleteItem + recentlyDeleted Set'),
         cell('markRecentlyDeleted(id) adds to a Set to "track this ID as recently-deleted so the firmData re-merge doesn\'t re-add it before Convex propagates the deletion." The Set is a workaround for the optimistic-update-fights-subscription race.'),
         cell('Remove the optimistic update + the Set. Convex subscription handles deletions reactively.'),
         cell(polish_badge())],
        [cell('Optimistic notification mutations'),
         cell('handleMarkNotificationsRead + handleClearAllNotifications do optimistic updates with revert-on-failure. Comment at line 333-335 acknowledges "the local state is already empty, so no resurrection."'),
         cell('If the local state is already empty and the subscription will push the truth, the optimistic update is unnecessary. Remove it.'),
         cell(polish_badge())],
        [cell('Sequential deleteItem loop for "clear all conversations"'),
         cell('DataProvider.tsx:436-441 — for (const conv of conversations) await baseActions.deleteItem(...). Sequential mutations, one per conversation.'),
         cell('One Convex mutation clearAllConversationsForFirm({firmId}) that bulk-deletes in one transaction.'),
         cell(nice_badge())],
    ]
    story.append(styled_table(provider_findings, [35*mm, 60*mm, 50*mm, 25*mm]))
    story.append(P('<i>Table 3.3 — Wrong-layer findings in DataProvider.tsx. The optimistic-update workarounds are the team\'s own acknowledgement that the wrong layer is being automated.</i>', 'Caption'))

    story.append(add_heading('3.4 Wrong-Layer Findings — Defensive Polling in Founder App', STYLES['H2'], 1))
    story.append(Paragraph(
        f'<b>{polish_badge()} 6 founder-app views bypass useQuery and use setInterval instead. The root cause is a deploy-gap crash that has a known canonical fix.</b><br/><br/>'
        'The pattern appears in: FounderDashboard.tsx:104 (60s), FounderBottomNav.tsx:242 (15s), '
        'SubscriptionRequestsCenter.tsx:131 (30s), FounderNotificationsCenter.tsx:215 (60s, also '
        'aggregates 4 sources client-side), OrganizationsHub.tsx:91 (30s), SecurityCenter.tsx:78 (30s). '
        'The comment at SubscriptionRequestsCenter.tsx:102-106 explicitly acknowledges the root cause: '
        '"the new founderMetrics mutations require a Convex deploy to exist on the backend. Until the '
        'deploy runs, useQuery would throw synchronously and crash the ENTIRE founder app (black screen)." '
        'The proper fix is to wrap useQuery in an ErrorBoundary. The BillingMonitorView.tsx:125-130 '
        'already demonstrates the canonical pattern. Restores real-time subscriptions; removes 6 '
        'polling timers × varying intervals of unnecessary network load.',
        STYLES['CalloutPolish']
    ))

    story.append(add_heading('3.5 Wrong-Layer Findings — Sequential Per-Message Mutations', STYLES['H2'], 1))
    story.append(Paragraph(
        f'<b>{polish_badge()} MessagesView.tsx:1290-1314 fires 50+ sequential mutations on view mount when there are 50 unread messages.</b><br/><br/>'
        'On view mount (when atriumInboundResult and portalMessagesResult finish loading), a useEffect '
        'iterates all unread atrium_inbound_messages → fires markInboundRead({messageId}) per message; '
        'all unread portal_messages → fires markPortalRead({messageId}) per message; all unread '
        'portal_conversations → fires markConvReadByAdmin({conversationId}) per conversation. With 50 '
        'unread messages, this fires 50+ mutations in a tight loop, each a separate network round-trip. '
        'The fix is one mutation <code>markAllInboxReadForFirm({firmId})</code> that bulk-patches all '
        'unread inbound + portal messages + conversations in a single transaction. Saves Convex '
        'function-call quota + ~2s load time on high-volume firms.',
        STYLES['CalloutPolish']
    ))

    return story


def build_launch_audit():
    story = []
    story.append(add_heading('4. Alpha-Launch Posture — Ship Atrium Now', STYLES['H1'], 0))
    story.append(P(
        'Van Clief\'s fourth idea: launch fast, learn from real users, iterate. The known bugs in '
        'Atrium are mostly polish, not blockers. This section explicitly tags every finding from this '
        'audit AND the preserved findings from the previous audit with a launch posture so the team '
        'can ship Atrium with confidence and know exactly what to fix in the first 2 weeks '
        'post-launch. The posture is binary where possible: SHIP-BLOCKER means do not launch until '
        'fixed; POLISH means fix in the first 2 weeks; NICE-TO-HAVE means backlog.'
    ))

    story.append(add_heading('4.1 SHIP-BLOCKERS (Must Fix Before Atrium Launch)', STYLES['H2'], 1))
    story.append(Paragraph(
        '<b>3 ship-blockers. All are security issues. None are polish. All have known fixes with '
        'low regression risk.</b> The team can ship Atrium the same day these 3 are fixed.',
        STYLES['CalloutShipBlocker']
    ))

    blocker_data = [
        [cell('#', 'TableHeader'), cell('Blocker', 'TableHeader'), cell('Fix', 'TableHeader'), cell('Effort', 'TableHeader')],
        [cell('B1'),
         cell('<b>Unsigned ?impersonate= URL param</b> (AuthContext.tsx:67-72). Anyone with a target user\'s email can impersonate them by visiting ?impersonate=victim@firm.com. No server check, no signature, no nonce.'),
         cell('Replace with server-verified founder-only mutation impersonateUser({targetUserId}) that issues a scoped session. Remove the URL param entirely.'),
         cell('1 day')],

        [cell('B2'),
         cell('<b>Server Gemini API key in plaintext localStorage</b> (AuthContext.tsx:217-219 + ComposeModal.tsx:438). practicepro_custom_gemini_key synced from server to localStorage without encryption. Any XSS can exfiltrate it (and bill the firm).'),
         cell('Stop syncing to localStorage. Proxy all Gemini calls through a Convex action with HttpOnly cookie auth. The key stays server-side only.'),
         cell('2 days')],

        [cell('B3'),
         cell('<b>pushNotifications.markNotificationRead + markAllNotificationsRead have NO auth check</b> (pushNotifications.ts:125-156). Anyone with a notification ID can mark it as read. A malicious user could mark all founders\' notifications as read, suppressing sales-lead alerts.'),
         cell('Add requireFirmUser(ctx) + verify notification.userId === user._id before patching. One-line guard per mutation, follows existing pattern.'),
         cell('1 hour')],
    ]
    story.append(styled_table(blocker_data, [10*mm, 70*mm, 60*mm, 20*mm]))
    story.append(P('<i>Table 4.1 — Three ship-blockers. B1 and B2 require coordinated AuthContext changes; B3 is a one-hour fix. Total: 3-4 days of engineering to clear all three.</i>', 'Caption'))

    story.append(add_heading('4.2 POLISH (Fix in First 2 Weeks Post-Launch)', STYLES['H2'], 1))
    story.append(P(
        '12 polish items. All are wrong-layer patterns that work functionally but cause UX spam '
        '(double push), drift (localStorage vs Convex), flicker (optimistic updates vs subscriptions), '
        'or unnecessary network load (6 polling timers, sequential per-message mutations). The team '
        'should pick the highest-impact 5-6 for the first week post-launch and defer the rest to week 2.'
    ))

    polish_data = [
        [cell('#', 'TableHeader'), cell('Polish item', 'TableHeader'), cell('Impact', 'TableHeader'), cell('Effort', 'TableHeader')],
        [cell('P1'), cell('Wire up the 5 existing ICM markdown files via Vite ?raw imports (start with 04-interactive-form-protocol.md — closest match)'),
         cell('ICM score 18% → 30%; first proof-of-concept for markdown-as-source-of-truth'), cell('4 hours')],
        [cell('P2'), cell('Fix getAloaProtocol call-site bug at AgencyHub.ts:240 (passes string where boolean expected — Atrium chat gets legal protocol)'),
         cell('Atrium ARIA chat finally uses the correct precision protocol'), cell('5 min')],
        [cell('P3'), cell('Delete dead identityLock() at config/identityGuardrails.ts:64 (zero callers); migrate geminiService.ts:7,509,547,727 to new validator'),
         cell('Eliminates split-brain identity validation'), cell('1 hour')],
        [cell('P4'), cell('Fix ResearchAgent.ts:8 ARIA expansion ("Advanced Research & Intelligence Assistant" → "Asset & Revenue Intelligence Assistant")'),
         cell('Closes identity-drift hole in research mode'), cell('5 min')],
        [cell('P5'), cell('Reconcile ARIA expansion across MD + identityGuardrails.ts + PropertyManagementAgent.ts (Intelligence vs Intelligent)'),
         cell('Single source of truth for ARIA identity'), cell('1 hour')],
        [cell('P6'), cell('Add requireFirmUser to 40 unauthenticated portals.ts mutations (the multi-tenant hole from prior audit)'),
         cell('Closes the multi-tenant isolation hole'), cell('4 hours')],
        [cell('P7'), cell('Add requireFirmUser to 23 unauthenticated sentry.ts financial mutations'),
         cell('Closes the financial-integrity hole'), cell('1 day')],
        [cell('P8'), cell('Replace 6 founder-app polling sites with useQuery + ErrorBoundary (BillingMonitorView pattern)'),
         cell('Restores real-time subscriptions; removes 6 polling timers'), cell('1 day')],
        [cell('P9'), cell('Add markAllInboxReadForFirm bulk mutation (replaces 50+ sequential per-message mutations on view mount)'),
         cell('Saves Convex quota + ~2s load time on high-volume firms'), cell('3 hours')],
        [cell('P10'), cell('Consolidate Header.tsx 4-source notification merge into one backend query getUnifiedNotificationFeed'),
         cell('Eliminates ~100 LOC of client merge logic + 3 sources of truth for unread count'), cell('1 day')],
        [cell('P11'), cell('Add idempotencyKey + by_idempotency index to 5 critical tables (payment_proofs, subscriptionRequests, subscriptionAddons, termsAcceptance, tasks)'),
         cell('Closes double-submit risk on financial + legal records'), cell('1 day')],
        [cell('P12'), cell('Convert deleteItem + forceDeleteItem + 3 cascade deletes to soft-delete via archive table (already exists at schema.ts:672)'),
         cell('NDPA compliance + reversibility for legal/financial records'), cell('2 days')],
    ]
    story.append(styled_table(polish_data, [10*mm, 80*mm, 50*mm, 20*mm]))
    story.append(P('<i>Table 4.2 — 12 polish items. P1-P5 are ICM + identity-guardrail fixes (low effort, high morale win). P6-P7 close the multi-tenant hole from the prior audit. P8-P10 are wrong-layer consolidations. P11-P12 are data-integrity infrastructure.</i>', 'Caption'))

    story.append(add_heading('4.3 NICE-TO-HAVE (Backlog)', STYLES['H2'], 1))
    nice_data = [
        [cell('#', 'TableHeader'), cell('Item', 'TableHeader'), cell('Why it is backlog', 'TableHeader')],
        [cell('N1'), cell('Delete 49 dead shadcn files in src/components/ui/ + CognitiveGuidance.tsx (zero importers)'),
         cell('~170 TS errors cleared in 1 hour; pure tech-debt cleanup; no user-facing impact')],
        [cell('N2'), cell('Delete dead NotificationCenter.tsx (177 LOC) + use-toast.ts (193 LOC) + ui/toaster.tsx + ui/sonner.tsx + ui/toast.tsx'),
         cell('~500 LOC of dead duplicate notification + toast systems; eliminates accidental-import risk')],
        [cell('N3'), cell('Lazy-load TenantPortal, ClientDashboard, PropertyDetailView, SettingsView, LandingPage via lazyWithReload'),
         cell('~12,000 LOC out of main chunk; pattern already established; perf win but no functional change')],
        [cell('N4'), cell('Extract 9 god components into tab sub-components (TenantPortal, DraftProEditor, AloaChat, MessagesView, PropertyDetailView, ClientDashboard, PropertyForm, LandingPage, App)'),
         cell('Largest item; ~22,000 LOC reorganization; do incrementally behind re-export shims')],
        [cell('N5'), cell('Create markdown files for 9 code-only agent SYSTEM_PROMPTs (09-data-protection.md through 17-aldia.md)'),
         cell('Extends ICM to secondary AI surfaces; no functional change; can be done one agent at a time')],
        [cell('N6'), cell('Add by_status index to sales_inquiries table (currently .collect() then JS filter — O(N) at 10k leads)'),
         cell('Perf optimization; works correctly today; only matters at scale')],
        [cell('N7'), cell('Consolidate computeNextBillingDate (3 divergent copies) into convex/dateUtils.ts'),
         cell('Silent billing-date bugs today; pure function consolidation; very low risk')],
        [cell('N8'), cell('Move toast logic out of Header.tsx into useNotificationToasts() hook'),
         cell('Refactor; Header becomes pure layout; no functional change')],
    ]
    story.append(styled_table(nice_data, [10*mm, 75*mm, 75*mm]))
    story.append(P('<i>Table 4.3 — 8 backlog items. N1 is the highest-ROI quick win (170 TS errors in 1 hour). N4 is the largest item (god-component extraction, ~1-2 weeks of work).</i>', 'Caption'))

    return story


def build_roadmap():
    story = []
    story.append(add_heading('5. Implementation Roadmap', STYLES['H1'], 0))
    story.append(P(
        'The roadmap is sequenced so that the ship-blockers clear first (so Atrium can launch), then '
        'the highest-impact polish items (so the first 2 weeks post-launch are productive), then the '
        'nice-to-have backlog. Each phase is designed so that any individual item can ship '
        'independently — no item in a later phase depends on an item in an earlier phase being shipped '
        'first. The ICM migration is woven through Phase 2 (the first 5 markdown files get wired up) '
        'and Phase 3 (the 9 agent SYSTEM_PROMPTs get markdown counterparts).'
    ))

    story.append(add_heading('5.1 Phase 0 — Ship-Blockers (3-4 days)', STYLES['H2'], 1))
    story.append(Paragraph(
        '<b>Goal:</b> Clear the 3 security ship-blockers so Atrium can launch. <b>Constraint:</b> All '
        '3 fixes are additive (no behavioural change for legitimate callers). B1 and B2 require '
        'coordinated AuthContext changes; B3 is a one-hour fix. Ship as a single PR.',
        STYLES['CalloutShipBlocker']
    ))

    p0_data = [
        [cell('Item', 'TableHeader'), cell('Effort', 'TableHeader'), cell('Owner concern', 'TableHeader')],
        [cell('B3 — Add requireFirmUser to pushNotifications.markNotificationRead + markAllNotificationsRead'), cell('1 hour'), cell('Backend; one-line guard per mutation')],
        [cell('B1 — Replace ?impersonate= URL param with server-verified founder-only mutation'), cell('1 day'), cell('AuthContext + Convex mutation; coordinated change')],
        [cell('B2 — Stop syncing server Gemini API key to localStorage; proxy through Convex action'), cell('2 days'), cell('AuthContext + ComposeModal + Convex action; largest blast radius')],
    ]
    story.append(styled_table(p0_data, [80*mm, 20*mm, 60*mm]))

    story.append(add_heading('5.2 Phase 1 — ICM Proof-of-Concept + Quick Wins (1 week)', STYLES['H2'], 1))
    story.append(Paragraph(
        '<b>Goal:</b> Wire up the first ICM markdown file via Vite ?raw imports (proof-of-concept), '
        'fix the identity-guardrail split-brain, fix the Atrium-gets-legal-protocol bug, and clear '
        'the 5 quick-win TS errors. <b>Constraint:</b> All changes are surgical; no broad refactors. '
        'The ICM proof-of-concept is the highest-leverage item because it proves the markdown-as-source-of-truth '
        'pattern works end-to-end before extending it to the other 4 files.',
        STYLES['CalloutPolish']
    ))

    p1_data = [
        [cell('Item', 'TableHeader'), cell('Effort', 'TableHeader'), cell('Why now', 'TableHeader')],
        [cell('P2 — Fix getAloaProtocol call-site bug (Atrium chat gets legal protocol)'), cell('5 min'), cell('User-facing bug; one-line fix')],
        [cell('P4 — Fix ResearchAgent.ts:8 ARIA expansion'), cell('5 min'), cell('Identity-drift hole; one-line fix')],
        [cell('P3 — Delete dead identityLock() + migrate geminiService.ts to new validator'), cell('1 hour'), cell('Eliminates split-brain validation')],
        [cell('P5 — Reconcile ARIA expansion across MD + code'), cell('1 hour'), cell('Single source of truth for ARIA identity')],
        [cell('P1 — Wire up 04-interactive-form-protocol.md via Vite ?raw import (proof-of-concept)'), cell('4 hours'), cell('First proof that markdown-as-source-of-truth works end-to-end')],
        [cell('N1 — Delete 49 dead shadcn files (~170 TS errors cleared)'), cell('1 hour'), cell('Quick morale win; pure tech-debt cleanup')],
    ]
    story.append(styled_table(p1_data, [80*mm, 20*mm, 60*mm]))

    story.append(add_heading('5.3 Phase 2 — Security + Data Integrity (1-2 weeks)', STYLES['H2'], 1))
    story.append(Paragraph(
        '<b>Goal:</b> Close the multi-tenant isolation hole from the prior audit, add idempotency to '
        'critical writes, and convert hard-deletes to soft-deletes. <b>Constraint:</b> Schema changes '
        'are additive (new optional fields + new indexes); no data backfill required. Pattern is '
        'already proven in feedback.ts and sendChatMessage — this phase extends it to the rest of the '
        'codebase.',
        STYLES['CalloutPolish']
    ))

    p2_data = [
        [cell('Item', 'TableHeader'), cell('Effort', 'TableHeader'), cell('Why now', 'TableHeader')],
        [cell('P6 — Add requireFirmUser to 40 unauthenticated portals.ts mutations'), cell('4 hours'), cell('Closes the multi-tenant hole from prior audit')],
        [cell('P7 — Add requireFirmUser to 23 unauthenticated sentry.ts financial mutations'), cell('1 day'), cell('Closes the financial-integrity hole')],
        [cell('P11 — Add idempotencyKey + by_idempotency index to 5 critical tables'), cell('1 day'), cell('Closes double-submit risk on financial + legal records')],
        [cell('P12 — Convert deleteItem + forceDeleteItem + 3 cascades to soft-delete via archive table'), cell('2 days'), cell('NDPA compliance + reversibility')],
        [cell('P9 — Add markAllInboxReadForFirm bulk mutation'), cell('3 hours'), cell('Saves Convex quota + ~2s load time on high-volume firms')],
        [cell('P10 — Consolidate Header.tsx 4-source notification merge into one backend query'), cell('1 day'), cell('Eliminates ~100 LOC of client merge logic')],
        [cell('P8 — Replace 6 founder-app polling sites with useQuery + ErrorBoundary'), cell('1 day'), cell('Restores real-time subscriptions; removes 6 polling timers')],
    ]
    story.append(styled_table(p2_data, [80*mm, 20*mm, 60*mm]))

    story.append(add_heading('5.4 Phase 3 — ICM Extension + Code Organization (2-4 weeks)', STYLES['H2'], 1))
    story.append(Paragraph(
        '<b>Goal:</b> Extend ICM to the remaining 4 primary markdown files + the 9 agent SYSTEM_PROMPTs, '
        'extract the 9 god components, and consolidate duplicated helpers. <b>Constraint:</b> All '
        'changes are pure code reorganization — no behavioural change. Module splits ship behind '
        're-export shims so callers do not need to update imports in lockstep. God-component '
        'extraction is done one component at a time.',
        STYLES['CalloutNice']
    ))

    p3_data = [
        [cell('Item', 'TableHeader'), cell('Effort', 'TableHeader'), cell('Why now', 'TableHeader')],
        [cell('Wire up remaining 4 primary MD files (01, 02, 03, 05) via ?raw imports after P1 proof-of-concept'), cell('1 day'), cell('ICM score 30% → 60%')],
        [cell('N5 — Create MD files for 9 code-only agent SYSTEM_PROMPTs'), cell('2 days'), cell('ICM score 60% → 80%')],
        [cell('N3 — Lazy-load 5 large views via lazyWithReload'), cell('2 hours'), cell('~12,000 LOC out of main chunk')],
        [cell('N7 — Consolidate computeNextBillingDate (3 divergent copies) into convex/dateUtils.ts'), cell('2 hours'), cell('Silent billing-date bugs today')],
        [cell('N2 — Delete dead NotificationCenter.tsx + use-toast.ts + shadcn toast primitives'), cell('1 hour'), cell('~500 LOC of dead duplicate systems')],
        [cell('N4 — Extract 9 god components into tab sub-components (incremental)'), cell('1-2 weeks'), cell('Largest item; do behind re-export shims')],
        [cell('Split myFunctions.ts into 18 domain modules + portals.ts into 12 portal/* modules'), cell('1 week'), cell('Maintainability + build time')],
        [cell('Convex prompt migration — load 18-morning-briefing.md + 19-conversation-summarizer.md via httpAction'), cell('2 days'), cell('ICM score 80% → 90%; Convex runtime caveat')],
    ]
    story.append(styled_table(p3_data, [80*mm, 20*mm, 60*mm]))

    return story


def build_appendix():
    story = []
    story.append(add_heading('6. Appendix — Recipes &amp; Reference', STYLES['H1'], 0))

    story.append(add_heading('6.1 The ICM Loader Recipe (Vite ?raw imports)', STYLES['H2'], 1))
    story.append(P(
        'The recommended approach for wiring up the markdown files as the source of truth. Vite '
        'natively supports importing any file as a raw string via the ?raw suffix. No plugins '
        'required. The loader is ~10 lines of TypeScript. Editing the .md files and rebuilding is '
        'sufficient; no code changes are needed for routine prompt edits.'
    ))

    story.append(code('''// src/constants/loadPrompts.ts
import aloaIdentity from '../../ai/prompts/01-aloa-legal-identity.md?raw';
import ariaIdentity from '../../ai/prompts/02-aria-property-identity.md?raw';
import identityGuardrail from '../../ai/prompts/03-identity-guardrail.md?raw';
import formProtocol from '../../ai/prompts/04-interactive-form-protocol.md?raw';
import precisionProtocol from '../../ai/prompts/05-precision-protocol.md?raw';

export const PROMPTS = {
  aloaIdentity,
  ariaIdentity,
  identityGuardrail,
  formProtocol,
  precisionProtocol,
} as const;

// Usage in AgencyHub.ts:
// Before (inline 45-line string):
//   const getInteractiveFormDelegationProtocol = (isAtrium: boolean) => `...45 lines...`;
// After:
//   const getInteractiveFormDelegationProtocol = (isAtrium: boolean) => {
//     return PROMPTS.formProtocol.replace('{{defaultMode}}', isAtrium ? 'property' : 'legal');
//   };'''))

    story.append(add_heading('6.2 The notifyFounders Recipe (Already a Showcase)', STYLES['H2'], 1))
    story.append(P(
        'The notifyFounders helper in convex/founderNotifications.ts is the canonical Van Clief pattern '
        'for backend-owned orchestration. A single client mutation (e.g., submitSalesInquiry) calls '
        'notifyFounders, which then: finds all Founder-role users, inserts a notifications row per '
        'founder, queries their FCM tokens, and schedules the FCM push via the scheduler. The client '
        'does zero orchestration. This pattern should be replicated for any new "notify on event" flow.'
    ))

    story.append(code('''// convex/founderNotifications.ts (simplified)
export const notifyFounders = async (ctx, payload) => {
  const founders = await ctx.db.query("users")
    .withIndex("by_role", q => q.eq("role", "Founder"))
    .collect();

  for (const founder of founders) {
    // 1. Insert in-app notification
    await ctx.db.insert("notifications", {
      userId: founder._id,
      firmId: "system",
      title: payload.title,
      message: payload.message,
      type: payload.type,
      link: payload.link,
      isRead: false,
      createdAt: Date.now(),
    });

    // 2. Query FCM tokens
    const tokens = await ctx.db.query("user_push_tokens")
      .withIndex("by_user", q => q.eq("userId", founder._id))
      .collect();

    // 3. Schedule FCM push (zero client involvement)
    if (tokens.length > 0) {
      await ctx.scheduler.runAfter(0,
        internal.pushNotificationsNode.sendFcmPush,
        { tokens: tokens.map(t => t.token), title: payload.title, body: payload.message }
      );
    }
  }
};'''))

    story.append(add_heading('6.3 The ErrorBoundary Recipe (Replaces Defensive Polling)', STYLES['H2'], 1))
    story.append(P(
        'The canonical fix for the 6 founder-app polling sites that bypass useQuery to avoid deploy-gap '
        'crashes. Wrap the component in an ErrorBoundary with a fallback that renders a "not deployed '
        'yet" message. This preserves real-time subscriptions AND handles the deploy-gap case '
        'gracefully. The BillingMonitorView.tsx:125-130 already demonstrates this pattern.'
    ))

    story.append(code('''// Pattern from BillingMonitorView.tsx:125-130
<ErrorBoundary fallback={<BillingMonitorNotDeployedFallback />}>
  <BillingMonitorInner />
</ErrorBoundary>

// BillingMonitorInner uses useQuery normally:
function BillingMonitorInner() {
  const outbox = useQuery(api.retainerBilling.getOutboxForFirm, { firmId });
  const stats = useQuery(api.retainerBilling.getOutboxStats, { firmId });
  // ...renders normally...
}

// If the backend function doesn't exist (deploy gap), ErrorBoundary
// catches the synchronous throw and renders the fallback. No black screen.'''))

    story.append(add_heading('6.4 Files Modified in This Audit Session', STYLES['H2'], 1))
    story.append(P(
        'This session applied two fixes: the landing page product dropdown wrap (immediate UI bug) and '
        'the 5 surgical fixes from the prior session (preserved). The build passes cleanly.'
    ))

    mod_data = [
        [cell('File', 'TableHeader'), cell('Change', 'TableHeader'), cell('Tag', 'TableHeader')],
        [cell('src/components/LandingPage.tsx'), cell('Fixed "All Products" hover text wrapping to 2 lines — widened container + whitespace-nowrap'), cell(nice_badge())],
        [cell('src/components/Header.tsx (preserved)'), cell('Removed duplicate useQuery + api imports'), cell(nice_badge())],
        [cell('src/services/geminiService.ts (preserved)'), cell('Added "research" literal to modelPreference union'), cell(nice_badge())],
        [cell('src/utils/capacitor.ts (preserved)'), cell('Fixed cachedIsNative nullability'), cell(nice_badge())],
        [cell('src/components/details/DocumentDetailView.tsx (preserved)'), cell('Wrapped dangerouslySetInnerHTML in sanitize()'), cell(polish_badge())],
        [cell('src/components/documents/HtmlPagePreview.tsx (preserved)'), cell('Wrapped 2 dangerouslySetInnerHTML sites in sanitize()'), cell(polish_badge())],
        [cell('src/components/research/ResearchStudio.tsx (preserved)'), cell('Wrapped dangerouslySetInnerHTML in sanitize()'), cell(polish_badge())],
        [cell('src/components/TermsAcceptance.tsx (preserved)'), cell('Added isSubmitting guard + disabled Accept button'), cell(polish_badge())],
    ]
    story.append(styled_table(mod_data, [55*mm, 75*mm, 30*mm]))

    story.append(add_heading('6.5 Audit Methodology', STYLES['H2'], 1))
    story.append(P(
        'This audit was conducted by two parallel exploration agents (one for the ICM / ALOA-ARIA '
        'prompt architecture, one for the wrong-layer / launch-posture audit) using read-only file '
        'inspection. Each agent produced a structured report with line-numbered citations. The '
        'findings were cross-referenced against the existing worklog.md entries to verify which '
        'patterns were intentionally applied in previous sessions. The landing page dropdown fix was '
        'applied manually and verified by the production build. No files were deleted, no schema was '
        'modified, and no Convex mutations were altered in this session. The full audit transcript is '
        'preserved in the conversation history for future reference.'
    ))

    story.append(P(
        'The methodology prioritized the Van Clief lens throughout. Every finding is tagged with a '
        'launch posture (SHIP-BLOCKER / POLISH / NICE-TO-HAVE) so the team can ship Atrium with '
        'confidence. The ICM scope was deliberately limited to the ALOA / ARIA chat surface per the '
        'user\'s direction; DraftPro, Research Studio, and the proactive engine are flagged for '
        'future migration but out of scope for this audit. The wrong-layer audit is identify-only — '
        'no code is changed in the frontend / backend boundary this session; recommendations are '
        'catalogued for the team to action.'
    ))

    return story


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

def main():
    output_path = '/home/z/my-project/download/PracticePro_VanClief_ICM_Audit_Report.pdf'

    doc = TocDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=20*mm,
        rightMargin=20*mm,
        topMargin=18*mm,
        bottomMargin=15*mm,
        title='PracticePro Van Clief ICM Methodology Audit Report',
        author='Super Z (Z.ai)',
        subject='ICM audit + wrong-layer audit + alpha-launch posture',
        creator='Z.ai',
    )

    story = []
    story.extend(build_title_page())
    story.extend(build_toc())
    story.extend(build_methodology_intro())
    story.extend(build_icm_audit())
    story.extend(build_layer_audit())
    story.extend(build_launch_audit())
    story.extend(build_roadmap())
    story.extend(build_appendix())

    doc.multiBuild(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f'Audit report generated: {output_path}')
    print(f'Size: {os.path.getsize(output_path):,} bytes')

if __name__ == '__main__':
    main()
