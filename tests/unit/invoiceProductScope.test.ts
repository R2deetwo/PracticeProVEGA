/**
 * invoiceProductScope.test.ts — the K-4 invoice attribution contract.
 *
 * Covers required test 8 (invoice product attribution). Invoices now
 * carry their originating business operation:
 *   - new rows: an explicit `product` field set at creation;
 *   - legacy rows: classified AT READ TIME by evidence (real-estate
 *     matter link, or the property pseudo-matter CollectRentModal
 *     writes), never guessed and never backfilled;
 *   - the unified Financials scope toggle now filters the LIST and the
 *     KPIs by origin, so legal and property money are never mixed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    invoiceBusinessOrigin,
    partitionInvoicesByOrigin,
    invoiceOriginBadge,
} from '../../src/utils/invoiceOrigin';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolvePath(here, '../..');
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

const matters = [
    { id: 'm-legal', title: 'Recovery suit' },
    { id: 'm-realestate', title: 'Lekki conveyance', specialtyData: { realEstate: { propertyId: 'p1' } } },
];
const properties = [
    { id: 'p1', address: '12 Admiralty Way' },
    { id: 'p2', address: '4 Oba Akran Avenue' },
];
const evidence = { matters, properties };

describe('explicit attribution (new rows)', () => {
    it("'legal' and 'property' are honored as written", () => {
        expect(invoiceBusinessOrigin({ product: 'legal', matter: { id: 'm-legal' } }, evidence)).toBe('legal');
        expect(invoiceBusinessOrigin({ product: 'property', matter: { id: 'm-legal' } }, evidence)).toBe('property');
        // Case/whitespace tolerant
        expect(invoiceBusinessOrigin({ product: ' Property ' })).toBe('property');
    });

    it('explicit attribution wins over conflicting evidence', () => {
        expect(invoiceBusinessOrigin({ product: 'legal', matterId: 'm-realestate' }, evidence)).toBe('legal');
    });
});

describe('legacy classification (rows without the product field)', () => {
    it('a real-estate matter link (matterId convention) classifies as property', () => {
        expect(invoiceBusinessOrigin({ matterId: 'm-realestate' }, evidence)).toBe('property');
    });

    it('a real-estate matter link (legacy matter.id snapshot) classifies as property', () => {
        expect(invoiceBusinessOrigin({ matter: { id: 'm-realestate', title: 'Lekki conveyance' } }, evidence)).toBe('property');
    });

    it('the property pseudo-matter (matter.id IS a property id) classifies as property', () => {
        // CollectRentModal's management-fee invoice: matter.id holds the PROPERTY id
        expect(invoiceBusinessOrigin({ matter: { id: 'p2', title: 'Property Management — 4 Oba Akran' } }, evidence)).toBe('property');
    });

    it('a normal legal matter classifies as legal (the documented default)', () => {
        expect(invoiceBusinessOrigin({ matter: { id: 'm-legal', title: 'Recovery suit' } }, evidence)).toBe('legal');
    });

    it("a 'general' matter and no evidence classify as legal — never a guess", () => {
        expect(invoiceBusinessOrigin({ matter: { id: 'general', title: 'General Management' } }, evidence)).toBe('legal');
        expect(invoiceBusinessOrigin({}, {})).toBe('legal');
        expect(invoiceBusinessOrigin(undefined as any, undefined)).toBe('legal');
    });

    it('classification is deterministic (same input, same side, every render)', () => {
        const inv = { matter: { id: 'p1' } };
        for (let i = 0; i < 5; i++) {
            expect(invoiceBusinessOrigin(inv, evidence)).toBe('property');
        }
    });
});

describe('partitionInvoicesByOrigin — the unified Financials scope filter', () => {
    const invoices = [
        { id: 'i1', product: 'legal', matter: { id: 'm-legal' } },
        { id: 'i2', matter: { id: 'm-realestate' } },               // legacy property
        { id: 'i3', product: 'property', matter: { id: 'p2' } },    // explicit property
        { id: 'i4', matter: { id: 'general' } },                     // legacy legal
    ];

    it('partitions every row exactly once (no double counting)', () => {
        const { legal, property } = partitionInvoicesByOrigin(invoices, evidence);
        expect(legal.map((i) => i.id)).toEqual(['i1', 'i4']);
        expect(property.map((i) => i.id)).toEqual(['i2', 'i3']);
        expect(legal.length + property.length).toBe(invoices.length);
    });

    it('preserves row identity (generic pass-through)', () => {
        const { legal } = partitionInvoicesByOrigin(invoices, evidence);
        expect(legal[0]).toBe(invoices[0]); // same object reference
    });

    it('empty and null inputs partition to empties', () => {
        expect(partitionInvoicesByOrigin([], evidence)).toEqual({ legal: [], property: [] });
        expect(partitionInvoicesByOrigin(undefined as any, evidence)).toEqual({ legal: [], property: [] });
    });
});

describe('origin badge metadata', () => {
    it('labels and colors the two origins distinctly', () => {
        const legal = invoiceOriginBadge('legal');
        const property = invoiceOriginBadge('property');
        expect(legal.label).toBe('Legal');
        expect(property.label).toBe('Property');
        expect(legal.className).not.toBe(property.className);
    });
});

describe('creation paths stamp the field (source contract)', () => {
    it('useFinance.handleGenerateInvoice stamps the origin (default legal, source override)', () => {
        const src = read('src/hooks/useFinance.ts');
        expect(src).toContain("source?: { product?: 'legal' | 'property' }");
        expect(src).toMatch(/product: source\?\.product === 'property'/);
    });

    it('CollectRentModal passes { product: "property" } for the management-fee invoice', () => {
        const src = read('src/components/modals/CollectRentModal.tsx');
        expect(src).toContain("{ product: 'property' }");
    });

    it('InvoiceForm stamps the origin from the selected matter', () => {
        const src = read('src/components/forms/InvoiceForm.tsx');
        // UX-38 part 3 extended the line: property-first mode stamps
        // 'property' by construction; the standard composer still stamps
        // from the selected matter (specialtyData realEstate link).
        expect(src).toContain("product: propertyMode ? 'property' : ((matter as any)!.specialtyData?.realEstate?.propertyId ? 'property' : 'legal')");
    });

    it('the schema carries the additive field + index', () => {
        const src = read('convex/schema.ts');
        expect(src).toContain("product: v.optional(v.string()),       // 'legal' | 'property'");
        expect(src).toContain('.index("by_product", ["product"])');
    });

    it('BillingView scope-filters the invoice LIST and origin-scopes the KPIs', () => {
        const src = read('src/components/BillingView.tsx');
        expect(src).toContain('partitionInvoicesByOrigin(active, originEvidence)');
        expect(src).toContain('showOriginBadges={isUnified}');
        // Property KPIs include property-origin invoices; legal KPIs exclude them
        expect(src).toContain('propertyInvoiceOutstanding');
        expect(src).toContain('computeClientFinancialSummary(legalInvoices as any)');
    });
});
