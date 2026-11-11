/**
 * docxExport — client-side DOCX export utility (V4 rewrite).
 *
 * Converts HTML content (from DraftPro or ALOA chat) into a real Office
 * Open XML .docx package (ZIP via JSZip) that Word opens without repair.
 *
 * V4 (V-DOC-11) — what was broken and is fixed here:
 *   RUN SPLITTING: the pre-V4 tokenizer emitted a new <w:p> paragraph at
 *     every formatting boundary, so "a <b>bold</b> word" exported as three
 *     paragraphs. Formatting now emits <w:r> runs INSIDE one paragraph.
 *   LIST SPLITTING: lists exported as literal "• " text (and 'ol' also got
 *     a bullet — both ternary branches were identical). Lists now use real
 *     OOXML numbering (<w:numPr> + numbering.xml), each top-level list gets
 *     a fresh numId so ordered lists restart at 1, and nesting maps to ilvl.
 *   HEADINGS: a heading left `isBold` latched ON for the rest of the
 *     document (everything after an <h1> exported bold). Headings are now
 *     paragraphs with pStyle Heading1-3 and never leak state.
 *   PAGE SIZE: the export wrote US LETTER (12240×15840 twips). It now
 *     derives A4 + 25mm margins from utils/pageFormat.ts, so the DOCX
 *     paginates identically to the DraftPro canvas and the print pipeline.
 *   PLACEHOLDERS: legal-placeholder chips exported as invisible empty
 *     spans; they now export as bracketed [LABEL] text.
 *   PAGE BREAKS: page-break nodes now export as real <w:br w:type="page"/>.
 *
 * Legacy retirements (V-DOC-11 "retire broken legacy export paths"):
 *   - exportHtmlToDocx previously wrote RAW XML with a .docx extension
 *     (not a ZIP — Word could not open it). It is now a thin wrapper over
 *     the real Blob pipeline below.
 *   - exportHtmlToPdfBlob (html2canvas rasterised "PDF" — a screenshot,
 *     no selectable text, gaps at every page seam) is DELETED. PDF output
 *     goes through the browser's vector print engine (DraftPro pipeline).
 *
 * DOM note: parsing uses the browser DOM (document.createElement). In
 * tests, run this module under jsdom (`@vitest-environment jsdom`).
 */

import { ooxmlSectionProperties } from './pageFormat';

export interface DocxExportOptions {
  title?: string;
  author?: string;
  firmName?: string;
}

// ─── XML helpers ────────────────────────────────────────────────────────────

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Run/paragraph model ────────────────────────────────────────────────────

interface RunFlags {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  superscript?: boolean;
  subscript?: boolean;
}

function runXml(text: string, flags: RunFlags): string {
  const props: string[] = [];
  if (flags.bold) props.push('<w:b/>');
  if (flags.italic) props.push('<w:i/>');
  if (flags.underline) props.push('<w:u w:val="single"/>');
  if (flags.superscript) props.push('<w:vertAlign w:val="superscript"/>');
  if (flags.subscript) props.push('<w:vertAlign w:val="subscript"/>');
  const rPr = props.length > 0 ? `<w:rPr>${props.join('')}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

interface ParaOptions {
  style?: string;         // pStyle id (Heading1…)
  numbering?: number;     // numId allocated for this list
  ilvl?: number;          // list nesting level (0-3)
  indentLeft?: number;    // twips
  quote?: boolean;
  pageBreakBefore?: boolean;
}

function paraXml(runs: string[], opts: ParaOptions = {}): string {
  const pPrParts: string[] = [];
  if (opts.pageBreakBefore) pPrParts.push('<w:pageBreakBefore/>');
  if (opts.style) pPrParts.push(`<w:pStyle w:val="${opts.style}"/>`);
  if (opts.numbering !== undefined) {
    pPrParts.push(`<w:numPr><w:ilvl w:val="${opts.ilvl ?? 0}"/><w:numId w:val="${opts.numbering}"/></w:numPr>`);
  }
  if (opts.indentLeft || opts.quote) {
    pPrParts.push(`<w:ind w:left="${opts.indentLeft ?? 720}" w:hanging="0"/>`);
  }
  if (opts.quote) pPrParts.push('<w:i/>');
  const pPr = pPrParts.length > 0 ? `<w:pPr>${pPrParts.join('')}</w:pPr>` : '';
  const body = runs.length > 0 ? runs.join('') : '';
  return `<w:p>${pPr}${body}</w:p>`;
}

// ─── List registry (each top-level list gets a fresh numId) ─────────────────

interface ListKind { kind: 'ul' | 'ol'; numId: number }

// ─── Conversion ─────────────────────────────────────────────────────────────

interface ConvertState {
  paragraphs: string[];
  lists: ListKind[];      // numbering.xml is generated from this at the end
}

const MAX_LIST_DEPTH = 4;

/**
 * Convert the children of a DOM node into OOXML paragraphs appended to
 * state.paragraphs. Block elements recurse; inline content accumulates
 * into the current paragraph via a ParaAccumulator.
 */
function convertChildren(parent: Node, flags: RunFlags, state: ConvertState, listCtx: { numId?: number; ilvl: number } = { ilvl: 0 }): void {
  parent.childNodes.forEach((node) => convertNode(node, flags, state, listCtx));
}

function convertNode(node: Node, flags: RunFlags, state: ConvertState, listCtx: { numId?: number; ilvl: number }): void {
  if (node.nodeType === Node.TEXT_NODE) {
    // Top-level bare text: wrap into a paragraph (loose text between blocks).
    const text = node.textContent ?? '';
    if (!text.trim()) return;
    state.paragraphs.push(paraXml([runXml(text, flags)]));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'p':
    case 'div': {
      if (isPageBreak(el)) { emitPageBreak(state); return; }
      // divs with block children recurse; plain divs act as paragraphs.
      if (hasBlockChild(el)) { convertChildren(el, flags, state, listCtx); return; }
      emitSimpleParagraph(el, flags, state, {});
      return;
    }
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = Number(tag[1]);
      const style = level <= 1 ? 'Heading1' : level === 2 ? 'Heading2' : 'Heading3';
      const runs = collectInline(el, { ...flags, bold: true });
      state.paragraphs.push(paraXml(runs, { style }));
      return;
    }
    case 'ul':
    case 'ol': {
      const numId = allocateList(state, tag as 'ul' | 'ol');
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toLowerCase() === 'li') {
          convertListItem(child as HTMLElement, flags, state, numId, 0);
        }
      });
      return;
    }
    case 'li': {
      // Loose li outside a list: treat as a bullet paragraph.
      const numId = listCtx.numId ?? allocateList(state, 'ul');
      convertListItem(el, flags, state, numId, listCtx.ilvl);
      return;
    }
    case 'table':
      state.paragraphs.push(tableXml(el, flags));
      return;
    case 'blockquote': {
      const runs = collectInline(el, { ...flags, italic: true });
      state.paragraphs.push(paraXml(runs.length ? runs : [runXml('', {})], { quote: true, indentLeft: 720 }));
      return;
    }
    case 'hr':
      state.paragraphs.push(paraXml([runXml('', {})], {}));
      return;
    case 'br':
      emitPageBreak(state); // only reached for a stray top-level <br>
      return;
    default:
      // Inline or unknown element at block position: if it contains block
      // children, recurse as a block container; otherwise emit a paragraph.
      if (hasBlockChild(el)) { convertChildren(el, flags, state, listCtx); return; }
      emitSimpleParagraph(el, flags, state, {});
      return;
  }
}

function convertListItem(li: HTMLElement, flags: RunFlags, state: ConvertState, numId: number, ilvl: number): void {
  const boundedIlvl = Math.min(ilvl, MAX_LIST_DEPTH - 1);
  const runs: string[] = [];
  const nested: HTMLElement[] = [];

  li.childNodes.forEach((child) => {
    if (child.nodeType !== Node.ELEMENT_NODE) {
      const text = child.textContent ?? '';
      if (text) runs.push(...splitRunsText(text, flags));
      return;
    }
    const cel = child as HTMLElement;
    const ctag = cel.tagName.toLowerCase();
    if (ctag === 'ul' || ctag === 'ol') { nested.push(cel); return; }
    if (ctag === 'p' || ctag === 'div') {
      if (isPageBreak(cel)) { emitPageBreak(state); return; }
      // A paragraph inside a list item: merge its inline content into this
      // item's text (single w:p per item keeps Word's list behaviour sane).
      runs.push(...collectInline(cel, flags));
      return;
    }
    runs.push(...collectInline(cel, flags));
  });

  state.paragraphs.push(paraXml(runs, { numbering: numId, ilvl: boundedIlvl }));

  nested.forEach((cel) => {
    const ctag = cel.tagName.toLowerCase();
    const nestedNumId = allocateList(state, ctag as 'ul' | 'ol');
    cel.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toLowerCase() === 'li') {
        convertListItem(child as HTMLElement, flags, state, nestedNumId, boundedIlvl + 1);
      }
    });
  });
}

/** Inline content of an element as runs (no paragraph emission). */
function collectInline(parent: Node, flags: RunFlags): string[] {
  const runs: string[] = [];
  const walk = (node: Node, current: RunFlags) => {
    if (node.nodeType === Node.TEXT_NODE) {
      runs.push(...splitRunsText(node.textContent ?? '', current));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const next: RunFlags = { ...current };
    switch (tag) {
      case 'b': case 'strong': next.bold = true; break;
      case 'i': case 'em': next.italic = true; break;
      case 'u': next.underline = true; break;
      case 'sup': next.superscript = true; break;
      case 'sub': next.subscript = true; break;
      case 'br':
        runs.push('<w:r><w:br/></w:r>');
        return;
      case 'a':
        next.underline = true; // link text kept as underlined plain text
        break;
      case 'span': {
        if (isLegalPlaceholder(el)) {
          const label = el.getAttribute('data-label') || 'PLACEHOLDER';
          runs.push(runXml(`[${label}]`, { ...next, bold: true }));
          return;
        }
        break; // plain span: transparent
      }
      case 'img':
        // Images: DOCX image embedding needs media parts + rels; emit an
        // honest bracketed note instead of silently dropping the image.
        runs.push(runXml('[image]', next));
        return;
      default:
        if (isPageBreak(el)) { runs.push('<w:r><w:br w:type="page"/></w:r>'); return; }
        break;
    }
    el.childNodes.forEach((child) => walk(child, next));
  };
  walk(parent, flags);
  return runs;
}

/** A plain paragraph (p / text-only div): one w:p with inline runs. */
function emitSimpleParagraph(el: HTMLElement, flags: RunFlags, state: ConvertState, opts: ParaOptions): void {
  if (isPageBreak(el)) { emitPageBreak(state); return; }
  const runs = collectInline(el, flags);
  state.paragraphs.push(paraXml(runs, opts));
}

function emitPageBreak(state: ConvertState): void {
  state.paragraphs.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
}

function isPageBreak(el: HTMLElement): boolean {
  if (el.getAttribute('data-type') === 'page-break') return true;
  const cls = el.getAttribute('class') || '';
  return /(^|\s)(page-break|page-break-node)(\s|$)/.test(cls);
}

function isLegalPlaceholder(el: HTMLElement): boolean {
  return el.getAttribute('data-type') === 'legal-placeholder';
}

function hasBlockChild(el: HTMLElement): boolean {
  return Array.from(el.children).some((child) =>
    BLOCK_TAGS.has(child.tagName.toLowerCase()) || isPageBreak(child as HTMLElement)
  );
}

const BLOCK_TAGS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'table', 'blockquote', 'hr', 'section', 'article', 'header', 'footer', 'pre',
]);

/** Long text is split into ≤4000-char runs (Word's practical w:t limit safety). */
function splitRunsText(text: string, flags: RunFlags): string[] {
  if (!text) return [];
  const out: string[] = [];
  let rest = text;
  while (rest.length > 4000) {
    out.push(runXml(rest.slice(0, 4000), flags));
    rest = rest.slice(4000);
  }
  if (rest) out.push(runXml(rest, flags));
  return out;
}

function allocateList(state: ConvertState, kind: 'ul' | 'ol'): number {
  const numId = 100 + state.lists.length; // numIds start past fixed ones
  state.lists.push({ kind, numId });
  return numId;
}

// ─── Tables ─────────────────────────────────────────────────────────────────

function tableXml(table: HTMLElement, flags: RunFlags): string {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length === 0) return paraXml([runXml('', {})], {});

  const colCount = Math.max(...rows.map((r) => r.querySelectorAll('td,th').length), 1);
  const gridCols = Array.from({ length: colCount }, () => '<w:gridCol w:w="' + Math.floor(9026 / colCount) + '"/>').join('');

  const seen = new Set<HTMLElement>();
  const bodyRows: string[] = [];
  for (const row of rows) {
    seen.add(row as HTMLElement);
    const cells = Array.from((row as HTMLElement).querySelectorAll('td,th'));
    const rowXml = cells.map((cell, idx) => {
      const isHeader = cell.tagName.toLowerCase() === 'th' || idx === 0;
      const runs = collectInline(cell, { ...flags, bold: isHeader });
      return `<w:tc><w:tcPr><w:tcW w:w="${Math.floor(9026 / colCount)}" w:type="dxa"/></w:tcPr><w:p>${runs.join('') || ''}</w:p></w:tc>`;
    }).join('');
    bodyRows.push(`<w:tr>${rowXml}</w:tr>`);
  }

  return [
    '<w:tbl>',
    '<w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>',
    '<w:top w:val="single" w:sz="4" w:color="cccccc"/><w:left w:val="single" w:sz="4" w:color="cccccc"/>',
    '<w:bottom w:val="single" w:sz="4" w:color="cccccc"/><w:right w:val="single" w:sz="4" w:color="cccccc"/>',
    '<w:insideH w:val="single" w:sz="4" w:color="cccccc"/><w:insideV w:val="single" w:sz="4" w:color="cccccc"/>',
    '</w:tblBorders></w:tblPr>',
    `<w:tblGrid>${gridCols}</w:tblGrid>`,
    bodyRows.join(''),
    '</w:tbl>',
    paraXml([runXml('', {})], {}), // spacer paragraph after the table (Word requirement)
  ].join('');
}

// ─── numbering.xml ──────────────────────────────────────────────────────────

function numberingXml(lists: ListKind[]): string {
  if (lists.length === 0) return '';
  const levels = (kind: 'ul' | 'ol'): string => {
    const fmt: string[] = [];
    for (let lvl = 0; lvl < MAX_LIST_DEPTH; lvl++) {
      const left = 720 * (lvl + 1);
      const text = kind === 'ul' ? '•' : `%${lvl + 1}.`;
      const numFmt = kind === 'ul' ? 'bullet' : 'decimal';
      fmt.push(
        `<w:lvl w:ilvl="${lvl}"><w:start w:val="1"/><w:numFmt w:val="${numFmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/>` +
        `<w:pPr><w:ind w:left="${left}" w:hanging="360"/></w:pPr></w:lvl>`
      );
    }
    return fmt.join('');
  };
  const abstracts =
    `<w:abstractNum w:abstractNumId="0">${levels('ul')}</w:abstractNum>` +
    `<w:abstractNum w:abstractNumId="1">${levels('ol')}</w:abstractNum>`;
  const nums = lists
    .map((l) => `<w:num w:numId="${l.numId}"><w:abstractNumId w:val="${l.kind === 'ul' ? 0 : 1}"/></w:num>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
${abstracts}
${nums}
</w:numbering>`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a DOCX Blob from HTML. Creates a valid OOXML ZIP package:
 * [Content_Types].xml, _rels/.rels, word/document.xml (+ numbering.xml
 * when lists are present), word/_rels/document.xml.rels, word/styles.xml,
 * docProps/core.xml, docProps/app.xml.
 */

/**
 * Convert HTML to the raw OOXML paragraph stream + list registry (V4).
 * Exported for tests: the DOCX engine's conversion rules (run splitting,
 * list numbering allocation, heading styles, page breaks, placeholders)
 * are assertable without building a ZIP.
 */
export function convertHtmlToOoxml(html: string): { paragraphs: string[]; lists: { kind: 'ul' | 'ol'; numId: number }[] } {
  // Parse into a detached container so conversion never touches the live DOM.
  const container = document.createElement('div');
  container.innerHTML = html;
  const state: ConvertState = { paragraphs: [], lists: [] };
  convertChildren(container, {}, state);
  return state;
}
export async function exportHtmlToDocxBlob(html: string, options: DocxExportOptions = {}): Promise<Blob> {
  const { title = 'Document', author = 'PracticePro', firmName = '' } = options;

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // V4: conversion is extracted (convertHtmlToOoxml) so the DOCX engine is
  // unit-testable without building a ZIP.
  const state = convertHtmlToOoxml(html);

  const bodyContent = state.paragraphs.join('\n    ') || '<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>';
  const numbering = numberingXml(state.lists);
  const hasNumbering = numbering !== '';

  // ─── [Content_Types].xml ──────────────────────────────────────────
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>${hasNumbering ? `
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>` : ''}
</Types>`;
  zip.file('[Content_Types].xml', contentTypes);

  // ─── _rels/.rels ──────────────────────────────────────────────────
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  zip.folder('_rels')!.file('.rels', rels);

  // ─── word/document.xml ────────────────────────────────────────────
  // A4 + 25mm margins from the shared page contract (was US Letter).
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyContent}
    ${ooxmlSectionProperties()}
  </w:body>
</w:document>`;
  zip.folder('word')!.file('document.xml', documentXml);

  // ─── word/_rels/document.xml.rels ─────────────────────────────────
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${hasNumbering ? `
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>` : ''}
</Relationships>`;
  zip.folder('word/_rels')!.file('document.xml.rels', docRels);

  if (hasNumbering) {
    zip.folder('word')!.file('numbering.xml', numbering);
  }

  // ─── word/styles.xml — Times New Roman 12pt base + Heading1-3 ─────
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="160" w:line="259" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="240" w:after="60"/>
      <w:outlineLvl w:val="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
      <w:b/>
      <w:sz w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="200" w:after="40"/>
      <w:outlineLvl w:val="1"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
      <w:b/>
      <w:sz w:val="28"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="160" w:after="40"/>
      <w:outlineLvl w:val="2"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
      <w:b/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>`;
  zip.folder('word')!.file('styles.xml', styles);

  // ─── docProps/core.xml + app.xml ──────────────────────────────────
  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>${escapeXml(author)}</dc:creator>
  <cp:lastModifiedBy>${escapeXml(author)}</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`;
  zip.folder('docProps')!.file('core.xml', coreXml);

  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>PracticePro DraftPro</Application>
  <Company>${escapeXml(firmName || 'PracticePro')}</Company>
</Properties>`;
  zip.folder('docProps')!.file('app.xml', appXml);

  const relsCore = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
  zip.folder('_rels')!.file('.rels', relsCore);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * Generate a .docx file from HTML content and trigger a download.
 * V4: delegates to exportHtmlToDocxBlob — the download is now a real
 * OOXML ZIP (the pre-V4 version wrote raw XML that Word could not open).
 */
export async function exportHtmlToDocx(html: string, filename: string, options: DocxExportOptions = {}): Promise<void> {
  const blob = await exportHtmlToDocxBlob(html, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export plain text to a .docx file.
 */
export async function exportTextToDocx(text: string, filename: string, options: DocxExportOptions = {}): Promise<void> {
  const html = text
    .split('\n')
    .map((line) => (line.trim() ? `<p>${line}</p>` : '<p></p>'))
    .join('');
  await exportHtmlToDocx(html, filename, options);
}
