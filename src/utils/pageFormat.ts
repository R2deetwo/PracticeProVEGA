/**
 * pageFormat — ONE canonical A4 page contract for every Vega document
 * surface (V4, V-DOC-11).
 *
 * Before V4 the product paginated the "same" document with four
 * disagreeing engines:
 *   - the DraftPro canvas / print pipeline: A4 @ 96 dpi, 25mm margins
 *   - HtmlPagePreview sheets: A4 with its own character-count approximation
 *   - PrintPreviewDrawer: A4 @page CSS (a third copy of the same rules)
 *   - the DOCX export: US LETTER (12240×15840 twips) — a different sheet
 *     entirely, so a "saved" DOCX printed with different margins and line
 *     breaks than the on-screen A4 original.
 *
 * Every surface now derives its numbers from the constants here, so
 * "what you see in DraftPro" is "what prints" is "what exports".
 *
 * This module is intentionally dependency-free and DOM-free so it can be
 * unit-tested in the node vitest environment and imported from Convex-
 * adjacent code paths without pulling React or jsdom.
 */

// ─── Physical page: A4 portrait ─────────────────────────────────────────────
export const A4 = {
    /** millimetres — the ISO 216 A4 sheet */
    widthMm: 210,
    heightMm: 297,
    /** twips (1/1440 inch) — the OOXML <w:pgSz> unit. 11906×16838 is A4;
     * the previous export wrote 12240×15840, which is US Letter. */
    widthTwips: 11906,
    heightTwips: 16838,
} as const;

// ─── Margins: 25mm on all sides ─────────────────────────────────────────────
export const PAGE_MARGIN = {
    mm: 25,
    /** 25mm in twips (25 / 25.4 * 1440, rounded) */
    twips: 1417,
    /** 25mm in CSS px at 96dpi (25 / 25.4 * 96) */
    px: 944.88,
} as const;

/** A4 content box at 96 dpi with 25mm margins — the DraftPro canvas math. */
export const A4_CONTENT_PX = {
    width: Math.round((A4.widthMm - 2 * PAGE_MARGIN.mm) / 25.4 * 96),   // ≈ 607
    height: Math.round((A4.heightMm - 2 * PAGE_MARGIN.mm) / 25.4 * 96), // ≈ 933
} as const;

/** Full A4 sheet in CSS px at 96 dpi (the editor page-sheet dimensions). */
export const A4_SHEET_PX = {
    width: Math.round(A4.widthMm / 25.4 * 96),   // ≈ 794
    height: Math.round(A4.heightMm / 25.4 * 96), // ≈ 1123
} as const;

// ─── Typography ─────────────────────────────────────────────────────────────
/** The Vega pleading contract: 12pt Times New Roman, 1.5 line height. */
export const PAGE_TYPOGRAPHY = {
    fontFamily: "'Times New Roman', serif",
    fontSizePt: 12,
    lineHeight: 1.5,
    color: '#1a1a1a',
} as const;

// ─── Shared CSS blocks ──────────────────────────────────────────────────────

/**
 * The @page rule + base element styling for print/PDF output.
 * Used verbatim by the DraftPro print pipeline (iframe) and the
 * PrintPreviewDrawer preview document, so the preview IS the print.
 */
export const PAGE_CSS_PRINT = `
  @page { size: A4; margin: ${PAGE_MARGIN.mm}mm ${PAGE_MARGIN.mm}mm ${PAGE_MARGIN.mm}mm ${PAGE_MARGIN.mm}mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ${PAGE_TYPOGRAPHY.fontFamily};
    font-size: ${PAGE_TYPOGRAPHY.fontSizePt}pt;
    line-height: ${PAGE_TYPOGRAPHY.lineHeight};
    color: ${PAGE_TYPOGRAPHY.color};
  }
  .letterhead { margin-bottom: 16pt; text-align: center; }
  h1 { font-size: 16pt; font-weight: bold; margin: 16pt 0 8pt; break-after: avoid; break-inside: avoid; }
  h2 { font-size: 14pt; font-weight: bold; margin: 14pt 0 6pt; break-after: avoid; break-inside: avoid; }
  h3 { font-size: 12pt; font-weight: bold; margin: 12pt 0 4pt; break-after: avoid; break-inside: avoid; }
  h1 + p, h2 + p, h3 + p { break-before: avoid; }
  p { margin: 0 0 8pt; text-align: justify; orphans: 2; widows: 2; page-break-inside: avoid; }
  ul, ol { margin: 0 0 8pt; padding-left: 20pt; }
  li { margin-bottom: 4pt; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0; break-inside: avoid; }
  td, th { border: 1px solid #ccc; padding: 4pt 8pt; text-align: left; }
  th { background: #f5f5f5; font-weight: bold; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  sup { font-size: 0.7em; vertical-align: super; }
  sub { font-size: 0.7em; vertical-align: sub; }
  .page-break { page-break-after: always; break-after: page; }
  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 120px; font-weight: 900;
    color: rgba(220, 38, 38, 0.08);
    white-space: nowrap; pointer-events: none; z-index: 0;
  }
`;

/**
 * On-screen page-sheet CSS (preview panes: HtmlPagePreview-class surfaces).
 * Same typography and margins as print; adds the sheet chrome (white
 * background) that only exists on a screen.
 */
export const PAGE_CSS_SHEET = `
  .page-sheet, .page-sheet * { box-sizing: border-box; }
  .page-sheet {
    width: ${A4.widthMm}mm;
    min-height: ${A4.heightMm}mm;
    padding: ${PAGE_MARGIN.mm}mm;
    background: white;
    font-family: ${PAGE_TYPOGRAPHY.fontFamily};
    font-size: ${PAGE_TYPOGRAPHY.fontSizePt}pt;
    line-height: ${PAGE_TYPOGRAPHY.lineHeight};
    color: ${PAGE_TYPOGRAPHY.color};
    word-wrap: break-word;
  }
  .page-sheet h1 { font-size: 16pt; font-weight: bold; margin: 16pt 0 8pt; }
  .page-sheet h2 { font-size: 14pt; font-weight: bold; margin: 14pt 0 6pt; }
  .page-sheet h3 { font-size: 12pt; font-weight: bold; margin: 12pt 0 4pt; }
  .page-sheet p { margin: 0 0 8pt; text-align: justify; }
  .page-sheet ul, .page-sheet ol { margin: 0 0 8pt; padding-left: 20pt; }
  .page-sheet li { margin-bottom: 4pt; }
  .page-break { page-break-after: always; break-after: page; }
`;

// ─── OOXML fragments (DOCX export) ──────────────────────────────────────────

/** A4 portrait + 25mm margins in the <w:sectPr> of word/document.xml. */
export function ooxmlSectionProperties(): string {
    return `<w:sectPr>
      <w:pgSz w:w="${A4.widthTwips}" w:h="${A4.heightTwips}"/>
      <w:pgMar w:top="${PAGE_MARGIN.twips}" w:right="${PAGE_MARGIN.twips}" w:bottom="${PAGE_MARGIN.twips}" w:left="${PAGE_MARGIN.twips}" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>`;
}
