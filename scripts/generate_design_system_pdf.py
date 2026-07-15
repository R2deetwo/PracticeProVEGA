#!/usr/bin/env python3
"""Generate the PracticePro Design System PDF from the STYLE_GUIDE.md content."""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Preformatted, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.lib.enums import TA_LEFT, TA_CENTER

# ─── Font Registration ──────────────────────────────────────────────
FONT_DIR = '/usr/share/fonts'

# Use Tinos (serif, metric-compatible with Times New Roman) for body
# and Carlito (sans-serif, metric-compatible with Calibri) for headings
try:
    pdfmetrics.registerFont(TTFont('Tinos', f'{FONT_DIR}/truetype/english/Tinos-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('Tinos-Bold', f'{FONT_DIR}/truetype/english/Tinos-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('Tinos-Italic', f'{FONT_DIR}/truetype/english/Tinos-Italic.ttf'))
    pdfmetrics.registerFont(TTFont('Tinos-BoldItalic', f'{FONT_DIR}/truetype/english/Tinos-BoldItalic.ttf'))
    registerFontFamily('Tinos', normal='Tinos', bold='Tinos-Bold', italic='Tinos-Italic', boldItalic='Tinos-BoldItalic')
    BODY_FONT = 'Tinos'
    BOLD_FONT = 'Tinos-Bold'
    ITALIC_FONT = 'Tinos-Italic'
except:
    BODY_FONT = 'Times-Roman'
    BOLD_FONT = 'Times-Bold'
    ITALIC_FONT = 'Times-Italic'

try:
    pdfmetrics.registerFont(TTFont('Carlito', f'{FONT_DIR}/truetype/english/Carlito-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('Carlito-Bold', f'{FONT_DIR}/truetype/english/Carlito-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('Carlito-Italic', f'{FONT_DIR}/truetype/english/Carlito-Italic.ttf'))
    registerFontFamily('Carlito', normal='Carlito', bold='Carlito-Bold', italic='Carlito-Italic')
    SANS_FONT = 'Carlito'
    SANS_BOLD = 'Carlito-Bold'
except:
    SANS_FONT = 'Helvetica'
    SANS_BOLD = 'Helvetica-Bold'

# Monospace
try:
    pdfmetrics.registerFont(TTFont('LiberationMono', f'{FONT_DIR}/truetype/liberation/LiberationMono-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('LiberationMono-Bold', f'{FONT_DIR}/truetype/liberation/LiberationMono-Bold.ttf'))
    registerFontFamily('LiberationMono', normal='LiberationMono', bold='LiberationMono-Bold')
    MONO_FONT = 'LiberationMono'
except:
    MONO_FONT = 'Courier'

# ─── Brand Colors ───────────────────────────────────────────────────
BRAND_GREEN = HexColor('#4A694C')
BRAND_GREEN_LIGHT = HexColor('#E8F0EA')
SLATE_900 = HexColor('#1F2937')
SLATE_700 = HexColor('#374151')
SLATE_500 = HexColor('#6B7280')
SLATE_300 = HexColor('#D1D5DB')
SLATE_100 = HexColor('#F3F4F6')
RED_BG = HexColor('#FCE8E6')
RED_TEXT = HexColor('#C5221F')
MINT_BG = HexColor('#E6F4EA')
MINT_TEXT = HexColor('#137333')
BLUE_BG = HexColor('#E8F0FE')
BLUE_TEXT = HexColor('#1A73E8')

# ─── Styles ─────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

style_title = ParagraphStyle(
    'CustomTitle', parent=styles['Title'],
    fontName=SANS_BOLD, fontSize=28, leading=34,
    textColor=BRAND_GREEN, alignment=TA_LEFT,
    spaceAfter=6,
)

style_subtitle = ParagraphStyle(
    'CustomSubtitle', parent=styles['Normal'],
    fontName=SANS_FONT, fontSize=12, leading=16,
    textColor=SLATE_500, alignment=TA_LEFT,
    spaceAfter=24,
)

style_h1 = ParagraphStyle(
    'CustomH1', parent=styles['Heading1'],
    fontName=SANS_BOLD, fontSize=18, leading=24,
    textColor=BRAND_GREEN, alignment=TA_LEFT,
    spaceBefore=24, spaceAfter=10,
)

style_h2 = ParagraphStyle(
    'CustomH2', parent=styles['Heading2'],
    fontName=SANS_BOLD, fontSize=14, leading=18,
    textColor=SLATE_900, alignment=TA_LEFT,
    spaceBefore=14, spaceAfter=6,
)

style_h3 = ParagraphStyle(
    'CustomH3', parent=styles['Heading3'],
    fontName=SANS_BOLD, fontSize=12, leading=16,
    textColor=SLATE_700, alignment=TA_LEFT,
    spaceBefore=10, spaceAfter=4,
)

style_body = ParagraphStyle(
    'CustomBody', parent=styles['Normal'],
    fontName=BODY_FONT, fontSize=10.5, leading=15,
    textColor=SLATE_900, alignment=TA_LEFT,
    spaceAfter=6,
)

style_bullet = ParagraphStyle(
    'CustomBullet', parent=style_body,
    leftIndent=18, bulletIndent=6, spaceAfter=3,
)

style_code = ParagraphStyle(
    'CustomCode', parent=styles['Code'],
    fontName=MONO_FONT, fontSize=8.5, leading=12,
    textColor=SLATE_700, backColor=SLATE_100,
    leftIndent=8, rightIndent=8, spaceBefore=4, spaceAfter=8,
    borderColor=SLATE_300, borderWidth=0.5, borderPadding=6,
)

style_note = ParagraphStyle(
    'CustomNote', parent=style_body,
    fontName=ITALIC_FONT, fontSize=9.5, leading=13,
    textColor=SLATE_500, spaceAfter=8,
)

# ─── Page Template ──────────────────────────────────────────────────
def add_page_decoration(canvas, doc):
    """Add a subtle brand color bar at the top of each page."""
    canvas.saveState()
    # Top brand bar
    canvas.setFillColor(BRAND_GREEN)
    canvas.rect(0, A4[1] - 4*mm, A4[0], 4*mm, fill=1, stroke=0)
    # Footer
    canvas.setFont(SANS_FONT, 8)
    canvas.setFillColor(SLATE_500)
    canvas.drawString(20*mm, 12*mm, "PracticePro Design System")
    canvas.drawRightString(A4[0] - 20*mm, 12*mm, f"Page {doc.page}")
    canvas.restoreState()

# ─── Build Content ──────────────────────────────────────────────────
def build_story():
    story = []

    # ─── Cover ───
    story.append(Spacer(1, 40*mm))
    story.append(Paragraph("PracticePro", style_title))
    story.append(Paragraph("Brand UI &amp; Style Guide", ParagraphStyle(
        'CoverSubtitle', parent=style_title, fontSize=22, textColor=SLATE_900, spaceAfter=10,
    )))
    story.append(Paragraph(
        "Visual identity, spacing scales, and layout rules for PracticePro, Vega, Atrium, and Komplete — "
        "maintaining UI consistency across all modules.",
        style_subtitle
    ))
    story.append(Spacer(1, 10*mm))
    story.append(HRFlowable(width="100%", thickness=2, color=BRAND_GREEN, spaceBefore=4, spaceAfter=4))
    story.append(Spacer(1, 2*mm))

    # Color swatches
    sw_style = ParagraphStyle('sw', parent=style_body, fontSize=9, alignment=TA_CENTER)
    swatch_data = [[
        Paragraph("<b>Dark Moss Green</b><br/>#4A694C", ParagraphStyle('sw1', parent=sw_style, textColor=HexColor('#FFFFFF'))),
        Paragraph("<b>White</b><br/>#FFFFFF", ParagraphStyle('sw2', parent=sw_style, textColor=SLATE_900)),
        Paragraph("<b>Off-White</b><br/>#F9FAFB", ParagraphStyle('sw3', parent=sw_style, textColor=SLATE_900)),
        Paragraph("<b>Charcoal</b><br/>#1F2937", ParagraphStyle('sw4', parent=sw_style, textColor=HexColor('#FFFFFF'))),
    ]]
    swatch_table = Table(swatch_data, colWidths=[42*mm]*4, rowHeights=[28*mm])
    swatch_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), BRAND_GREEN),
        ('BACKGROUND', (1,0), (1,0), HexColor('#FFFFFF')),
        ('BACKGROUND', (2,0), (2,0), HexColor('#F9FAFB')),
        ('BACKGROUND', (3,0), (3,0), SLATE_900),
        ('BOX', (0,0), (-1,-1), 0.5, SLATE_300),
        ('INNERGRID', (0,0), (-1,-1), 0.5, SLATE_300),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(swatch_table)
    story.append(PageBreak())

    # ─── Section 1: Brand & Semantic Colors ───
    story.append(Paragraph("1. Brand &amp; Semantic Color System", style_h1))

    story.append(Paragraph("Primary Corporate Palette", style_h2))
    story.append(Paragraph("• <b>Dark Moss Green:</b> <font color='#4A694C'><b>#4A694C</b></font> (RGB 74, 105, 76) — Used for main brand accents, headers, and primary actions.", style_bullet))
    story.append(Paragraph("• <b>Backgrounds:</b> Clean White (<b>#FFFFFF</b>) or Off-white (<b>#F9FAFB</b>).", style_bullet))
    story.append(Paragraph("• <b>Text &amp; Accents:</b> True Black (<b>#000000</b>) and Deep Slate/Charcoal (<b>#1F2937</b>).", style_bullet))

    story.append(Spacer(1, 8))
    story.append(Paragraph("ALOA / ARIA Semantic State Colors", style_h2))
    story.append(Paragraph("To prevent brand confusion with Dark Moss Green, use these desaturated, soft semantic background and text pairings for warning and alert states:", style_body))

    # Semantic color table
    sem_data = [
        [Paragraph("<b>State</b>", ParagraphStyle('th', parent=style_body, fontName=SANS_BOLD, fontSize=9, textColor=HexColor('#FFFFFF'))),
         Paragraph("<b>Background</b>", ParagraphStyle('th', parent=style_body, fontName=SANS_BOLD, fontSize=9, textColor=HexColor('#FFFFFF'))),
         Paragraph("<b>Text</b>", ParagraphStyle('th', parent=style_body, fontName=SANS_BOLD, fontSize=9, textColor=HexColor('#FFFFFF'))),
         Paragraph("<b>Usage</b>", ParagraphStyle('th', parent=style_body, fontName=SANS_BOLD, fontSize=9, textColor=HexColor('#FFFFFF')))],
        [Paragraph("High Priority / Alerts", style_body),
         Paragraph("#FCE8E6", style_body),
         Paragraph("#C5221F", style_body),
         Paragraph("Critical warnings, errors", style_body)],
        [Paragraph("Standard Reviews / Status", style_body),
         Paragraph("#E6F4EA", style_body),
         Paragraph("#137333", style_body),
         Paragraph("Success, completed items", style_body)],
        [Paragraph("Informational / Research", style_body),
         Paragraph("#E8F0FE", style_body),
         Paragraph("#1A73E8", style_body),
         Paragraph("Info, tips, research", style_body)],
    ]
    sem_table = Table(sem_data, colWidths=[45*mm, 30*mm, 30*mm, 55*mm])
    sem_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BRAND_GREEN),
        ('TEXTCOLOR', (0,0), (-1,0), HexColor('#FFFFFF')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#FFFFFF'), HexColor('#F9FAFB')]),
        ('GRID', (0,0), (-1,-1), 0.5, SLATE_300),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(sem_table)

    # ─── Section 2: Border-Radius Scale ───
    story.append(Paragraph("2. Border-Radius Scale (Strictly Enforced)", style_h1))
    story.append(Paragraph("All components must strictly adhere to this 3-tier scale to prevent visual drift:", style_body))

    radius_data = [
        [Paragraph("<b>Class</b>", ParagraphStyle('th', parent=style_body, fontName=SANS_BOLD, fontSize=9, textColor=HexColor('#FFFFFF'))),
         Paragraph("<b>Size</b>", ParagraphStyle('th', parent=style_body, fontName=SANS_BOLD, fontSize=9, textColor=HexColor('#FFFFFF'))),
         Paragraph("<b>Used For</b>", ParagraphStyle('th', parent=style_body, fontName=SANS_BOLD, fontSize=9, textColor=HexColor('#FFFFFF')))],
        [Paragraph("<font face='LiberationMono'>rounded-md</font>", style_body),
         Paragraph("8px", style_body),
         Paragraph("Form inputs, action buttons, small utility chips", style_body)],
        [Paragraph("<font face='LiberationMono'>rounded-lg</font>", style_body),
         Paragraph("12px", style_body),
         Paragraph("Information cards, list items, navigation dropdowns, popovers", style_body)],
        [Paragraph("<font face='LiberationMono'>rounded-2xl</font>", style_body),
         Paragraph("16px", style_body),
         Paragraph("Dashboard widgets, modal containers, hero blocks, layout wrappers", style_body)],
    ]
    radius_table = Table(radius_data, colWidths=[35*mm, 20*mm, 105*mm])
    radius_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BRAND_GREEN),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#FFFFFF'), HexColor('#F9FAFB')]),
        ('GRID', (0,0), (-1,-1), 0.5, SLATE_300),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(radius_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("Note: <font face='LiberationMono'>rounded-xl</font> (14px) is deprecated — migrate existing uses to <font face='LiberationMono'>rounded-lg</font> or <font face='LiberationMono'>rounded-2xl</font> based on context.", style_note))

    # ─── Section 3: Shadows & Spacing ───
    story.append(Paragraph("3. Shadows &amp; Spacing Scales", style_h1))

    story.append(Paragraph("Golden Ratio Spacing", style_h2))
    story.append(Paragraph("All padding, margin, gaps, and layouts should align to the Golden Ratio proportional spacing system. In practice, use Tailwind's default spacing scale (which is close to this) and avoid arbitrary values unless specifically needed:", style_body))
    story.append(Paragraph("• <b>Tiny:</b> 8px (<font face='LiberationMono'>space-2 / p-2</font>)", style_bullet))
    story.append(Paragraph("• <b>Small:</b> 12px (<font face='LiberationMono'>space-3 / p-3</font>)", style_bullet))
    story.append(Paragraph("• <b>Medium:</b> 20px (<font face='LiberationMono'>space-5 / p-5</font>)", style_bullet))
    story.append(Paragraph("• <b>Large:</b> 32px (<font face='LiberationMono'>space-8 / p-8</font>)", style_bullet))
    story.append(Paragraph("• <b>Extra Large:</b> 48px (<font face='LiberationMono'>space-12 / p-12</font>)", style_bullet))

    story.append(Paragraph("Elevation Shadows", style_h2))
    story.append(Paragraph("• <font face='LiberationMono'>shadow-sm</font>: Default flat card elevation.", style_bullet))
    story.append(Paragraph("• <font face='LiberationMono'>shadow-md</font>: Interactive hover states.", style_bullet))
    story.append(Paragraph("• <font face='LiberationMono'>shadow-xl</font>: Layered modal overlays and floating drop-downs.", style_bullet))

    # ─── Section 4: Page Transitions ───
    story.append(Paragraph("4. Page Transitions", style_h1))
    story.append(Paragraph("Transitions should be smooth and professional — inspired by Google Workspace, not jarring or flashy. For a legal practice management app, the goal is <b>calm confidence</b>.", style_body))

    story.append(Paragraph("Transition Principles", style_h2))
    story.append(Paragraph("• <b>Duration:</b> 200-300ms for most transitions. Never faster than 150ms (feels abrupt) or slower than 400ms (feels sluggish).", style_bullet))
    story.append(Paragraph("• <b>Easing:</b> Use <font face='LiberationMono'>ease-out</font> for elements entering the viewport, <font face='LiberationMono'>ease-in</font> for elements leaving. <font face='LiberationMono'>ease-in-out</font> for state toggles.", style_bullet))
    story.append(Paragraph("• <b>Opacity + Transform:</b> Combine <font face='LiberationMono'>opacity</font> with <font face='LiberationMono'>translateY(4px)</font> for a subtle \"lift\" effect on page changes. Avoid scale transforms on full pages (feels zoomy/unprofessional).", style_bullet))
    story.append(Paragraph("• <b>No bounce/spring:</b> This is a legal tool, not a consumer app. Avoid <font face='LiberationMono'>cubic-bezier</font> overshoot curves.", style_bullet))

    story.append(Paragraph("Implementation", style_h2))
    story.append(Paragraph("Use CSS transitions on the main content wrapper:", style_body))
    story.append(Preformatted(""".app-content {
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}
.app-content.entering {
  opacity: 0;
  transform: translateY(4px);
}""", style_code))
    story.append(Paragraph("Or with Tailwind:", style_body))
    story.append(Preformatted("""<div className="transition-all duration-200 ease-out">
  {children}
</div>""", style_code))

    story.append(Paragraph("What NOT to do", style_h2))
    story.append(Paragraph("• Full-page slide animations (left/right) — feels like a mobile app, not a desktop tool", style_bullet))
    story.append(Paragraph("• Scale/zoom transitions — feels disorienting", style_bullet))
    story.append(Paragraph("• Bounce or spring physics — too playful for a legal context", style_bullet))
    story.append(Paragraph("• Long fade durations (>400ms) — feels broken/slow", style_bullet))

    # ─── Section 5: Typography ───
    story.append(Paragraph("5. Typography", style_h1))
    story.append(Paragraph("• <b>Primary Font:</b> Inter (sans-serif) — for UI, navigation, and body text", style_bullet))
    story.append(Paragraph("• <b>Document Font:</b> Times New Roman (serif) — for DraftPro/editor content", style_bullet))
    story.append(Paragraph("• <b>Monospace:</b> For code blocks and data tables", style_bullet))
    story.append(Paragraph("• <b>Heading Scale:</b> 10px → 12px → 14px → 16px → 20px → 24px → 32px", style_bullet))
    story.append(Paragraph("• <b>Body Text:</b> 14px (text-sm) for most UI, 13px (text-xs) for secondary/metadata", style_bullet))
    story.append(Paragraph("• <b>Line Height:</b> 1.5 for body text, 1.25 for headings", style_bullet))

    # ─── Section 6: Component Patterns ───
    story.append(Paragraph("6. Component Patterns", style_h1))

    story.append(Paragraph("Buttons", style_h2))
    story.append(Paragraph("<b>Primary:</b>", style_body))
    story.append(Preformatted("bg-primary-600 text-white rounded-md px-4 py-2 text-sm font-bold\nhover:bg-primary-700 transition-colors shadow-sm", style_code))
    story.append(Paragraph("<b>Secondary:</b>", style_body))
    story.append(Preformatted("bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300\nrounded-md px-4 py-2 text-sm font-bold\nhover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors", style_code))
    story.append(Paragraph("<b>Danger:</b>", style_body))
    story.append(Preformatted("bg-red-600 text-white rounded-md px-4 py-2 text-sm font-bold\nhover:bg-red-700 transition-colors shadow-sm", style_code))

    story.append(Paragraph("Input Fields", style_h2))
    story.append(Preformatted("rounded-md border border-slate-200 dark:border-zinc-700\npx-3 py-2 text-sm focus:ring-2 focus:ring-primary-500\nfocus:border-primary-500 outline-none transition-all", style_code))

    story.append(Paragraph("Cards", style_h2))
    story.append(Preformatted("bg-white dark:bg-zinc-800 rounded-lg shadow-sm\nborder border-slate-100 dark:border-zinc-700 p-4", style_code))

    story.append(Paragraph("Modals", style_h2))
    story.append(Paragraph("• <b>Container:</b> <font face='LiberationMono'>bg-white dark:bg-zinc-800 rounded-2xl shadow-xl</font>", style_bullet))
    story.append(Paragraph("• <b>Header:</b> <font face='LiberationMono'>px-6 py-4 border-b border-slate-100 dark:border-zinc-700</font>", style_bullet))
    story.append(Paragraph("• <b>Body:</b> <font face='LiberationMono'>px-6 py-4</font>", style_bullet))
    story.append(Paragraph("• <b>Footer:</b> <font face='LiberationMono'>px-6 py-4 border-t border-slate-100 dark:border-zinc-700 flex justify-end gap-2</font>", style_bullet))

    return story

# ─── Generate ───────────────────────────────────────────────────────
OUTPUT_PATH = '/home/z/my-project/download/PracticePro_Design_System.pdf'

doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=20*mm, rightMargin=20*mm,
    topMargin=20*mm, bottomMargin=20*mm,
    title='PracticePro Design System',
    author='PracticePro',
    subject='Brand UI & Style Guide',
    creator='PracticePro',
)

story = build_story()
doc.build(story, onFirstPage=add_page_decoration, onLaterPages=add_page_decoration)

# Report
file_size = os.path.getsize(OUTPUT_PATH)
print(f"✅ PDF generated: {OUTPUT_PATH}")
print(f"   Size: {file_size / 1024:.1f} KB")
