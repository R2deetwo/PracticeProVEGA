/**
 * roundV4DocumentEngine.test.ts — V4: DOCUMENT ENGINEERING, part 2
 * (client-side engines: the DOCX export rewrite, the shared A4 page
 * contract, letterheads, draft-session persistence, the save-content rule,
 * version snapshots, and the shared-document message format).
 *
 * jsdom environment: the DOCX converter and exportBlob paths need a DOM.
 * ─────────────────────────────────────────────────────────────────────────
 * Findings under test (V0 audit → V4 brief):
 *   V-DOC-11 US-Letter DOCX with paragraph-per-formatting-boundary runs
 *            and literal "• " lists → A4 + real <w:r> runs + real
 *            numbering with per-list numIds.
 *   V-DOC-12 empty letterhead divs in print output → the real letterhead
 *            renders from the firm's headerConfig.
 *   V-DOC-4  draftHtml silently discarded on save; the draft session
 *            cleared before commit → the session survives until a real
 *            save; the persisted content keeps its formatting.
 *   V-DOC-13 versions with nothing to restore → snapshots carry the prior
 *            title/content/file.
 *   V-DOC-18 shared documents arriving as raw markdown → parseable,
 *            renderable references.
 */
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { convertHtmlToOoxml, exportHtmlToDocxBlob } from '../../src/utils/docxExport';
import { A4, PAGE_MARGIN, PAGE_CSS_PRINT, ooxmlSectionProperties } from '../../src/utils/pageFormat';
import { letterheadToStaticHtml, hasLetterhead } from '../../src/utils/letterhead';
import { buildVersionSnapshot, capVersions, summarizeChanges, restoreFromVersion, chronologicalVersions } from '../../src/utils/documentVersions';
import { saveDraft, loadDraft, clearDraft, pruneStaleDrafts } from '../../src/utils/draftSession';
import { resolvePersistedContent } from '../../src/utils/draftContentPersistence';
import { parseSharedDocumentMessage, stripSharedDocumentMarker, buildSharedDocumentMarker } from '../../src/utils/sharedDocumentMessage';
import JSZip from 'jszip';

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE SHARED A4 PAGE CONTRACT (V-DOC-11)
// ═══════════════════════════════════════════════════════════════════════════
describe('V4 — pageFormat: one A4 contract (V-DOC-11)', () => {
    it('A4 in twips is A4 (11906×16838), not the pre-V4 US Letter (12240×15840)', () => {
        expect(A4.widthTwips).toBe(11906);
        expect(A4.heightTwips).toBe(16838);
        expect(A4.widthTwips).not.toBe(12240);
        expect(A4.heightTwips).not.toBe(15840);
    });

    it('25mm margins in twips', () => {
        expect(PAGE_MARGIN.twips).toBe(1417);
        expect(PAGE_MARGIN.mm).toBe(25);
    });

    it('the OOXML section properties carry A4 + 25mm', () => {
        const sect = ooxmlSectionProperties();
        expect(sect).toContain('w:w="11906"');
        expect(sect).toContain('w:h="16838"');
        expect(sect).toContain(`w:top="${PAGE_MARGIN.twips}"`);
        expect(sect).toContain(`w:left="${PAGE_MARGIN.twips}"`);
    });

    it('the shared print CSS pins A4, the letterhead block, page breaks and typography', () => {
        expect(PAGE_CSS_PRINT).toContain('size: A4');
        expect(PAGE_CSS_PRINT).toContain('margin: 25mm 25mm 25mm 25mm');
        expect(PAGE_CSS_PRINT).toContain('.letterhead');
        expect(PAGE_CSS_PRINT).toContain('.page-break');
        expect(PAGE_CSS_PRINT).toContain(`font-size: ${12}pt`);
        expect(PAGE_CSS_PRINT).toContain("'Times New Roman', serif");
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. LETTERHEADS IN PRINT OUTPUT (V-DOC-12)
// ═══════════════════════════════════════════════════════════════════════════
describe('V4 — letterheadToStaticHtml (V-DOC-12)', () => {
    const config: any = {
        logo: { url: 'https://firm.example/logo.png', x: 10, y: 10, height: 80 },
        firmName: { text: 'Avery & Jarvis', fontSize: 24, fontWeight: 'bold', color: '#000000', alignment: 'left', x: 100, y: 20 },
        address: { text: '14 Marina Road, Lagos', fontSize: 12, alignment: 'left', x: 100, y: 60 },
    };

    it('renders the REAL letterhead (logo, firm name, address) as standalone HTML', () => {
        const html = letterheadToStaticHtml(config);
        expect(html).toContain('class="letterhead"');
        expect(html).toContain(config.logo.url);
        expect(html).toContain('Avery &amp; Jarvis');
        expect(html).toContain('14 Marina Road, Lagos');
        expect(hasLetterhead(config)).toBe(true);
    });

    it('no configuration renders NOTHING (no fake empty letterhead block)', () => {
        expect(letterheadToStaticHtml(undefined)).toBe('');
        expect(letterheadToStaticHtml(null)).toBe('');
        expect(letterheadToStaticHtml({} as any)).toBe('');
        expect(hasLetterhead({} as any)).toBe(false);
    });

    it('escapes hostile text', () => {
        const html = letterheadToStaticHtml({ ...config, firmName: { ...config.firmName, text: '<script>alert(1)</script>' } } as any);
        expect(html).toContain('&lt;script&gt;');
        expect(html).not.toContain('<script>');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. THE DOCX EXPORT REWRITE (V-DOC-11)
// ═══════════════════════════════════════════════════════════════════════════
describe('V4 — convertHtmlToOoxml: run splitting (V-DOC-11)', () => {
    it('a bold word mid-sentence stays in ONE paragraph with multiple runs', () => {
        const { paragraphs } = convertHtmlToOoxml('<p>start <b>bold</b> end</p>');
        expect(paragraphs).toHaveLength(1);
        const p = paragraphs[0];
        // Three runs: plain / bold / plain.
        expect((p.match(/<w:r>/g) || []).length).toBe(3);
        expect(p).toContain('<w:b/>');
        expect(p).not.toContain('<w:p><w:p><w:p>');
    });

    it('italic + underline stack into the same run properties', () => {
        const { paragraphs } = convertHtmlToOoxml('<p><i><u>both</u></i></p>');
        expect(paragraphs).toHaveLength(1);
        expect(paragraphs[0]).toContain('<w:i/>');
        expect(paragraphs[0]).toContain('<w:u w:val="single"/>');
    });
});

describe('V4 — convertHtmlToOoxml: headings (V-DOC-11)', () => {
    it('headings map to pStyle and never leak bold state to following text', () => {
        const { paragraphs } = convertHtmlToOoxml('<h1>Heading One</h1><p>plain body after the heading</p>');
        expect(paragraphs).toHaveLength(2);
        expect(paragraphs[0]).toContain('<w:pStyle w:val="Heading1"/>');
        // The pre-V4 bug: everything after an <h1> exported bold (isBold latched).
        expect(paragraphs[1]).not.toContain('<w:b/>');
    });
});

describe('V4 — convertHtmlToOoxml: lists (V-DOC-11)', () => {
    it('lists use REAL numbering, not literal "• " text', () => {
        const { paragraphs, lists } = convertHtmlToOoxml('<ul><li>first</li><li>second</li></ul>');
        expect(lists).toHaveLength(1);
        expect(lists[0].kind).toBe('ul');
        expect(paragraphs.join('')).toContain('<w:numPr>');
        expect(paragraphs.join('')).not.toContain('• first');
    });

    it('two separate ordered lists get DIFFERENT numIds (the second restarts at 1)', () => {
        const { lists } = convertHtmlToOoxml('<ol><li>a</li></ol><p>between</p><ol><li>b</li></ol>');
        expect(lists).toHaveLength(2);
        expect(lists[0].kind).toBe('ol');
        expect(lists[1].kind).toBe('ol');
        expect(lists[0].numId).not.toBe(lists[1].numId);
    });

    it('nested lists map to deeper ilvl', () => {
        const { paragraphs } = convertHtmlToOoxml('<ul><li>outer<ul><li>inner</li></ul></li></ul>');
        const joined = paragraphs.join('');
        expect(joined).toContain('<w:ilvl w:val="0"');
        expect(joined).toContain('<w:ilvl w:val="1"');
    });
});

describe('V4 — convertHtmlToOoxml: page breaks, placeholders, tables (V-DOC-11)', () => {
    it('page-break nodes export as real page breaks', () => {
        const { paragraphs } = convertHtmlToOoxml('<p>page one</p><div data-type="page-break" class="page-break-node"></div><p>page two</p>');
        expect(paragraphs.join('')).toContain('<w:br w:type="page"/>');
    });

    it('legal-placeholder chips export as bracketed [LABEL] text, not invisible spans', () => {
        const { paragraphs } = convertHtmlToOoxml('<p>Name: <span data-type="legal-placeholder" data-label="FULL_NAME"></span></p>');
        expect(paragraphs[0]).toContain('[FULL_NAME]');
    });

    it('tables export as real w:tbl structures', () => {
        const { paragraphs } = convertHtmlToOoxml('<table><tr><th>Col A</th><th>Col B</th></tr><tr><td>1</td><td>2</td></tr></table>');
        const joined = paragraphs.join('');
        expect(joined).toContain('<w:tbl>');
        expect(joined).toContain('<w:gridCol');
    });
});

describe('V4 — exportHtmlToDocxBlob: the real OOXML package (V-DOC-11)', () => {
    it('produces a ZIP Word can open, with A4 page size and numbering parts', async () => {
        const blob = await exportHtmlToDocxBlob(
            '<h1>Title</h1><p>Body with <b>bold</b>.</p><ol><li>first</li><li>second</li></ol>',
            { title: 'Contract', author: 'Ada', firmName: 'Avery & Jarvis' }
        );
        expect(blob).toBeTruthy();
        const zip = await JSZip.loadAsync(blob);
        const docXml = await zip.file('word/document.xml')!.async('string');
        expect(docXml).toContain('w:w="11906"');          // A4, not US Letter
        expect(docXml).toContain('w:h="16838"');
        expect(docXml).toContain('<w:pStyle w:val="Heading1"/>');
        expect(docXml).toContain('<w:numPr>');
        // The pre-V4 export wrote raw XML with a .docx extension — this is
        // a genuine ZIP: [Content_Types].xml is present.
        const ct = await zip.file('[Content_Types].xml')!.async('string');
        expect(ct).toContain('numbering+xml');
        const numbering = await zip.file('word/numbering.xml')!.async('string');
        expect(numbering).toContain('<w:abstractNum');
        const styles = await zip.file('word/styles.xml')!.async('string');
        expect(styles).toContain('w:styleId="Heading3"');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. DRAFT-SESSION PERSISTENCE + THE SAVE-CONTENT RULE (V-DOC-4)
// ═══════════════════════════════════════════════════════════════════════════
describe('V4 — draftSession: unsaved work survives refresh and navigation (V-DOC-4)', () => {
    const firm = 'firm-1';
    const key = 'draft:doc:abc';

    it('save → load round-trips content, prompt, matter and citations', () => {
        saveDraft(key, {
            title: 'Tenancy Agreement',
            content: '<p><b>Formatted</b> draft body.</p>',
            draftPrompt: 'draft a tenancy agreement',
            matterId: 'm-1',
            documentId: 'doc-abc',
            citations: [{ number: 1, text: 'Lagos tenancy law' }],
            updatedAt: new Date().toISOString(),
            savedAt: Date.now(),
        }, firm);
        const loaded = loadDraft(key, firm);
        expect(loaded).not.toBeNull();
        expect(loaded!.content).toContain('<b>Formatted</b>');
        expect(loaded!.draftPrompt).toBe('draft a tenancy agreement');
        expect(loaded!.citations).toHaveLength(1);
    });

    it('clear removes the session; a cancelled save dialog leaves it INTACT', () => {
        saveDraft(key, { title: 'T', content: '<p>work in flight</p>', updatedAt: '', savedAt: Date.now() }, firm);
        // Cancel path: the session is never cleared — recoverable after the
        // dialog closes without committing.
        expect(loadDraft(key, firm)?.content).toBe('<p>work in flight</p>');
        clearDraft(key, firm);
        expect(loadDraft(key, firm)).toBeNull();
    });

    it('pruneStaleDrafts removes only sessions older than 7 days', () => {
        // saveDraft always stamps savedAt=now, so an ANCIENT session is written
        // directly — exactly what a real 8-day-old localStorage row looks like.
        const oldKey = 'draft:general:ancient';
        localStorage.setItem(
            `draftpro:${firm}:${oldKey}`,
            JSON.stringify({ title: 'Old', content: '<p>x</p>', updatedAt: '', savedAt: Date.now() - 8 * 24 * 3600 * 1000 }),
        );
        saveDraft(key, { title: 'Fresh', content: '<p>y</p>', updatedAt: '', savedAt: Date.now() }, firm);
        const pruned = pruneStaleDrafts(firm);
        expect(pruned).toBe(1);
        expect(loadDraft(oldKey, firm)).toBeNull();
        expect(loadDraft(key, firm)).not.toBeNull();
        clearDraft(key, firm);
    });
});

describe('V4 — resolvePersistedContent: the reliable-commit content rule (V-DOC-4)', () => {
    const html = '<p>Formatted <b>bold</b> body.</p>';
    const plain = 'Formatted bold body.';

    it('an UNTOUCHED textarea persists the draftHtml (formatting survives the save)', () => {
        expect(resolvePersistedContent({ content: plain, plainPrefill: plain, draftHtml: html })).toBe(html);
    });

    it('a user edit persists THEIR words (honesty over formatting)', () => {
        expect(resolvePersistedContent({ content: 'Formatted bold body, edited by hand', plainPrefill: plain, draftHtml: html }))
            .toBe('Formatted bold body, edited by hand');
    });

    it('no draftHtml (ordinary upload flow) persists the textarea content as-is', () => {
        expect(resolvePersistedContent({ content: plain, plainPrefill: plain, draftHtml: null })).toBe(plain);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. VERSION SNAPSHOTS (V-DOC-13)
// ═══════════════════════════════════════════════════════════════════════════
describe('V4 — documentVersions (V-DOC-13)', () => {
    const prior: any = {
        title: 'Deed of Assignment',
        content: '<p>OLD body text</p>',
        file: { name: 'deed.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 100, filePath: '', storageId: 'kh52_deed' },
        categoryId: 'cat_court',
        matter: { id: 'm-1', title: 'Matter' },
    };

    it('the snapshot captures the PRIOR state, the actor, and a real change summary', () => {
        const snap = buildVersionSnapshot(prior, { title: 'Deed (amended)', content: '<p>NEW body</p>', file: prior.file, categoryId: 'cat_corp', matter: prior.matter }, 'u-lawyer', '2026-04-04T00:00:00Z');
        expect(snap.title).toBe('Deed of Assignment');
        expect(snap.content).toBe('<p>OLD body text</p>');
        expect(snap.uploadedBy).toBe('u-lawyer');
        expect(snap.changesSummary).toContain('title');
        expect(snap.changesSummary).toContain('content');
        expect(snap.changesSummary).toContain('folder');
    });

    it('no material change gets an honest summary', () => {
        const snap = buildVersionSnapshot(prior, prior, 'u-lawyer', '2026-04-04T00:00:00Z');
        expect(snap.changesSummary).toBe('No material change');
    });

    it('capVersions bounds the history (newest-first input keeps the 20 newest); chronological gives oldest-first', () => {
        // newest-first, as every writer stores it: v24 … v0.
        const many = Array.from({ length: 25 }, (_, i) => ({ id: `v${24 - i}`, uploadedBy: 'u', uploadedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z` }));
        const capped = capVersions(many);
        expect(capped).toHaveLength(20);
        // The five OLDEST (v0..v4) are the ones dropped.
        expect(capped[0].id).toBe('v24');
        expect(capped.some((v: any) => ['v0', 'v4'].includes(v.id))).toBe(false);
        const chrono = chronologicalVersions(capped);
        expect(chrono[0].id).toBe('v5');
        expect(chrono[chrono.length - 1].id).toBe('v24');
    });

    it('restoring a version recovers what it carried, without blanking the rest', () => {
        const version: any = { id: 'v1', title: 'Deed of Assignment', content: '<p>OLD body text</p>', file: prior.file, uploadedBy: 'u', uploadedAt: '2026-04-04T00:00:00Z' };
        const restored = restoreFromVersion(version, 'u-admin', '2026-05-05T00:00:00Z');
        expect(restored.title).toBe('Deed of Assignment');
        expect(restored.content).toBe('<p>OLD body text</p>');
        expect(restored.file?.storageId).toBe('kh52_deed');
        // A version with no content (pre-V4 snapshot) restores undefined, not
        // an empty string that would blank the document.
        const legacyVersion: any = { id: 'v0', uploadedBy: 'u', uploadedAt: '2026-04-01T00:00:00Z', file: prior.file };
        expect(restoreFromVersion(legacyVersion, 'u', 'x').content).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. THE SHARED-DOCUMENT MESSAGE FORMAT (V-DOC-18)
// ═══════════════════════════════════════════════════════════════════════════
describe('V4 — sharedDocumentMessage (V-DOC-18)', () => {
    it('parses a realistic share message (accompanying text + sentinel anywhere in it)', () => {
        const content = 'Please review this before Friday.' + buildSharedDocumentMarker('Writ of Summons', 'cust-d-9');
        const parsed = parseSharedDocumentMessage(content);
        expect(parsed).toEqual({ title: 'Writ of Summons', documentId: 'cust-d-9' });
    });

    it('strips the marker for clean display text', () => {
        const content = 'FYI.' + buildSharedDocumentMarker('NDA', 'cust-d-10');
        expect(stripSharedDocumentMarker(content)).toBe('FYI.');
    });

    it('ordinary messages parse to null (no false chips)', () => {
        expect(parseSharedDocumentMessage('plain hello')).toBeNull();
        expect(parseSharedDocumentMessage(null)).toBeNull();
        expect(parseSharedDocumentMessage('[FILE: broken')).toBeNull();
    });
});
