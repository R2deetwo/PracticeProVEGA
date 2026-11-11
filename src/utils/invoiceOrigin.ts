/**
 * invoiceOrigin — which business operation an invoice belongs to
 * (K-4, KOMPLETE unified-product integrity).
 *
 * DEFECT: invoices had NO product attribution. Property invoices
 * (management fees billed to landlords, rent demands issued as invoices)
 * piggybacked on matter snapshots — `matter.id` holds a PROPERTY id for
 * property-created invoices — so every invoice surface mixed legal and
 * property money in one list, and the unified Financials "scope" toggle
 * filtered TABS but never the invoice rows themselves.
 *
 * THE FIX, in two layers:
 *   1. NEW invoices carry an explicit `product` field ('legal' |
 *      'property') set at creation (useFinance.handleGenerateInvoice;
 *      CollectRentModal passes 'property' for the management-fee invoice).
 *   2. LEGACY invoices (no product field) are classified AT READ TIME by
 *      evidence — never guessed and never backfilled:
 *        - the linked matter (matterId / matter.id both conventions)
 *          resolves to a matter whose specialtyData.realEstate.propertyId
 *          is set → 'property' (a real-estate matter);
 *        - the matter reference matches a known PROPERTY id → 'property'
 *          (the property pseudo-matter CollectRentModal writes);
 *        - anything else → 'legal' (the default: the standard
 *          generate-invoice flow is legal billing).
 *
 * The classification is pure and deterministic so the same invoice always
 * lands on the same side in every surface (list filters, KPI figures,
 * origin badges).
 */

export type InvoiceBusinessOrigin = 'legal' | 'property';

export interface InvoiceLike {
    id?: string;
    /** Explicit attribution (new rows). */
    product?: string | null;
    /** Declarative matter link (custom matter id — app-forms convention). */
    matterId?: string | null;
    /** Legacy matter snapshot { id, title }. */
    matter?: { id?: string | null; title?: string | null } | null;
    [key: string]: any;
}

export interface MatterLike {
    id?: string;
    specialtyData?: { realEstate?: { propertyId?: string | null } | null } | null;
    [key: string]: any;
}

export interface PropertyLike {
    id?: string;
    [key: string]: any;
}

export interface OriginEvidence {
    /** The firm's matters (for the realEstate.propertyId check). */
    matters?: MatterLike[];
    /** The firm's properties (for the property pseudo-matter check). */
    properties?: PropertyLike[];
}

/**
 * The one classifier. Explicit field first; evidence second; 'legal' as
 * the documented default (the standard invoice flow is legal billing).
 */
export function invoiceBusinessOrigin(
    invoice: InvoiceLike,
    evidence: OriginEvidence = {}
): InvoiceBusinessOrigin {
    // Defensive: a null/undefined row can only be a non-property row —
    // the documented default is legal billing, never a crash.
    if (!invoice) return 'legal';

    // 1. Explicit attribution on the row itself.
    const explicit = String(invoice.product || '').toLowerCase().trim();
    if (explicit === 'property') return 'property';
    if (explicit === 'legal') return 'legal';

    // 2. The linked matter is a real-estate matter (either id convention).
    const matterRef = invoice.matterId || invoice.matter?.id || null;
    if (matterRef && evidence.matters) {
        const linked = evidence.matters.find((m) => String(m.id) === String(matterRef));
        if (linked?.specialtyData?.realEstate?.propertyId) return 'property';
    }

    // 3. The matter reference IS a property id (CollectRentModal's
    //    property pseudo-matter: matter.id holds the property's id).
    if (matterRef && evidence.properties) {
        const asProperty = evidence.properties.find(
            (p) => String(p.id) === String(matterRef)
        );
        if (asProperty) return 'property';
    }

    // 4. Documented default: standard legal billing.
    return 'legal';
}

/** Partition a firm's invoices by origin (one pass, both conventions). */
export function partitionInvoicesByOrigin<T extends InvoiceLike>(
    invoices: T[],
    evidence: OriginEvidence = {}
): { legal: T[]; property: T[] } {
    const legal: T[] = [];
    const property: T[] = [];
    for (const inv of invoices || []) {
        (invoiceBusinessOrigin(inv, evidence) === 'property' ? property : legal).push(inv);
    }
    return { legal, property };
}

/** Display metadata for the origin badge (color + label). */
export function invoiceOriginBadge(origin: InvoiceBusinessOrigin): {
    label: string;
    className: string;
} {
    return origin === 'property'
        ? {
              label: 'Property',
              className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
          }
        : {
              label: 'Legal',
              className: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
          };
}
