/**
 * phaseRoundE.test.ts — UX-37 (one receipt issuer) + UX-23 (one upload
 * flow) source contracts, Phase 0 audit roadmap.
 *
 * UX-37: the same money event used to produce three visually different
 *   receipts depending on the entry path (rent-collection PDF, Service
 *   Charge drawer email/PDF, ledger print window). All three now render
 *   from ONE receipt-document contract (services/receiptDocument):
 *   one heading, one "Receipt No" presentation, one row grammar, one
 *   issuer footer. The ledger print window is no longer a monospace
 *   outlier.
 * UX-23: the document-upload duality is unified on the batch uploader —
 *   the vault Upload button, the empty state, the palette action and the
 *   matter DocumentsTab all route through ONE flow, and the batch uploader
 *   requires an EXPLICIT vault category when there is no matter context
 *   (the silent 'cat_clients' default is gone).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECEIPT_HEADING, buildReceiptDocumentHtml, escapeReceiptText, receiptFooterLine } from '../../src/services/receiptDocument';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const src = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

describe('UX-37 — one receipt document contract', () => {
    it('exports the canonical heading/footer and escapes user text', () => {
        expect(RECEIPT_HEADING).toBe('OFFICIAL PAYMENT RECEIPT');
        expect(escapeReceiptText('<script>a&"b"</script>')).toBe('&lt;script&gt;a&amp;&quot;b&quot;&lt;/script&gt;');
        expect(receiptFooterLine('Acme Chambers', 'J. Okafor')).toContain('Acme Chambers via PracticePro');
    });

    it('builds a full HTML receipt with the canonical grammar', () => {
        const html = buildReceiptDocumentHtml({
            firmLegalName: 'Acme & Sons',
            receiptNumber: 'REC-123',
            kindLabel: 'Rent Receipt',
            rows: [['Property', 'Unit 2 <b>Ikoyi</b>'], ['Covers', ''], ['Amount', 'x']],
            amount: 250000,
        });
        expect(html).toContain('OFFICIAL PAYMENT RECEIPT');
        expect(html).toContain('Receipt No: REC-123');
        expect(html).toContain('Rent Receipt');
        expect(html).toContain('Unit 2 &lt;b&gt;Ikoyi&lt;/b&gt;'); // user text escaped
        expect(html).toContain('—'); // empty row value rendered, never blank
        expect(html).toContain('NGN 250,000');
    });

    it('the ledger print window renders from the shared builder (no monospace outlier)', () => {
        const lm = src('src/components/atrium/LedgerManager.tsx');
        expect(lm).toContain("import { buildReceiptDocumentHtml } from '../../services/receiptDocument'");
        expect(lm).toContain('buildReceiptDocumentHtml({');
        expect(lm).toContain("receiptNumber: entry.txHash");
        expect(lm).not.toContain('font-family:monospace');
        expect(lm).not.toContain('TX: ');
    });

    it('the rent-collection PDF presents the receipt number as Receipt No (was Original Invoice)', () => {
        const rg = src('src/services/reportGenerator.ts');
        expect(rg).toContain("`Receipt No: ${invoice.invoiceNumber}`");
        expect(rg).not.toContain('Original Invoice:');
        expect(rg).toContain("'Official Payment Receipt'");
    });

    it('the Service Charge drawer PDF uses the shared heading and footer constants', () => {
        const ed = src('src/utils/emailDelivery.ts');
        expect(ed).toContain("from '../services/receiptDocument'");
        expect(ed).toContain('doc.text(RECEIPT_HEADING');
        expect(ed).toContain('doc.text(receiptFooterLine(legalName)');
    });
});

describe('UX-23 — one upload flow with an explicit category', () => {
    it('every upload entry point routes through the batch uploader', () => {
        const dl = src('src/components/DocumentList.tsx');
        expect(dl).toContain("onClick={() => openModal('batchUpload')}");
        expect(dl).toContain("onAction={searchTerm ? undefined : () => openModal('batchUpload')}");
        expect(dl).not.toContain("openModal('newDocument')");

        const cp = src('src/components/CommandPalette.tsx');
        expect(cp).toContain("action: () => openModal('batchUpload') }");

        const dt = src('src/components/details/DocumentsTab.tsx');
        expect(dt).toContain("openModal('batchUpload', null, { matterId, ...uploadContext, files: droppedFiles })");
        expect(dt).toContain("openModal('batchUpload', null, { matterId, ...uploadContext, files: selectedFiles })");
        expect(dt).not.toContain("openModal('newDocument'");
    });

    it('the batch uploader requires an explicit category when there is no matter context', () => {
        const bm = src('src/components/modals/BatchUploadModal.tsx');
        expect(bm).toContain('const categoryRequired = !context?.categoryId && !context?.matterId;');
        expect(bm).toContain('const gated = categoryRequired && !chosenCategoryId;');
        expect(bm).toContain("categoryId: context?.categoryId || (context?.matterId ? 'cat_clients' : chosenCategoryId)");
        // the silent default that misfiled matter-less uploads is gone
        expect(bm).not.toContain("categoryId: context?.categoryId || 'cat_clients'");
        // the picker is rendered and feeds the same state the queue gates on
        expect(bm).toContain('value={chosenCategoryId}');
        expect(bm).toContain('coreState.documentCategories');
    });
});
