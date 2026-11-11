/**
 * unitCounts.test.ts — the K-5/K-6 KPI contract: every count states its
 * own calculation, "units" means ONE thing everywhere, incomparable
 * quantities are never summed, and shared records are never
 * double-counted.
 *
 * Covers required tests 10 (unit-count consistency) and 11 (shared
 * contact relationships), including the zero / one / multiple /
 * archived-record scenarios the brief demands.
 */
import { describe, it, expect } from 'vitest';
import {
    activeMattersCount,
    overdueTasksCount,
    outstandingLegalRevenue,
    portfolioUnitTotals,
    outstandingRentLedger,
} from '../../src/utils/dashboardKpis';
import { resolveOwnUnitCount, unitCountBase } from '../../src/utils/propertyUnitCount';
import { invoiceBusinessOrigin, partitionInvoicesByOrigin } from '../../src/utils/invoiceOrigin';

const NOW = new Date('2026-11-11T12:00:00Z').getTime();
const YESTERDAY = NOW - 86_400_000;
const TOMORROW = NOW + 86_400_000;

describe('10. portfolioUnitTotals — one unit semantics, zero/one/multiple/archived', () => {
    it('ZERO properties: everything is zero, no division by zero', () => {
        const t = portfolioUnitTotals([]);
        expect(t).toEqual({ propertyCount: 0, managedUnits: 0, occupiedProperties: 0, occupancyRate: 0 });
        expect(portfolioUnitTotals([] as any)).toEqual(portfolioUnitTotals([null as any, undefined as any].filter(Boolean) as any));
    });

    it('ONE single-occupancy property (no declared, no embedded units) = 1 unit', () => {
        const t = portfolioUnitTotals([{ id: 'p1', status: 'Occupied' }]);
        expect(t.propertyCount).toBe(1);
        expect(t.managedUnits).toBe(1);
        expect(t.occupiedProperties).toBe(1);
        expect(t.occupancyRate).toBe(100);
    });

    it('ONE multi-unit estate = its declared inventory (a 24-unit estate is 24, not 1)', () => {
        // The old "Managed Units" card displayed propertyCount (rows) —
        // this estate counted as 1.
        const t = portfolioUnitTotals([{ id: 'p1', status: 'Occupied', numberOfUnits: 24 }]);
        expect(t.managedUnits).toBe(24);
        expect(t.propertyCount).toBe(1);
        expect(t.occupancyRate).toBe(100);
    });

    it('embedded units are the fallback when none are declared (Parkview shape)', () => {
        const t = portfolioUnitTotals([{ id: 'p1', status: 'Vacant', units: [{}, {}, {}, {}, {}, {}, {}, {}] }]);
        expect(t.managedUnits).toBe(8);
        expect(t.occupiedProperties).toBe(0);
        expect(t.occupancyRate).toBe(0);
    });

    it('MULTIPLE properties: units add across the portfolio', () => {
        const t = portfolioUnitTotals([
            { id: 'p1', status: 'Occupied', numberOfUnits: 24 }, // estate
            { id: 'p2', status: 'Occupied', units: [{}, {}] },    // 2 flats
            { id: 'p3', status: 'Vacant' },                       // single-occupancy row
        ]);
        expect(t.propertyCount).toBe(3);
        expect(t.managedUnits).toBe(24 + 2 + 1);
        expect(t.occupiedProperties).toBe(2);
        expect(t.occupancyRate).toBe(67); // 2/3 rounded
    });

    it('archived/soft-deleted variants: voided lifecycle annotations and test rows never enter KPIs', () => {
        // Properties are hard-deleted (no recordStatus), but the LEDGER
        // (the property money system) carries voided/test annotations —
        // those must not count as outstanding rent.
        const rent = outstandingRentLedger([
            { propertyId: 'p1', status: 'pending', amount: 500_000 },
            { propertyId: 'p1', status: 'pending', amount: 250_000, recordStatus: 'voided' },
            { propertyId: 'p1', status: 'pending', amount: 100_000, recordStatus: 'test' },
            { propertyId: 'p1', status: 'cleared', amount: 700_000 },
            { propertyId: 'p1', status: 'defaulted', amount: 300_000 },
        ], ['p1']);
        expect(rent).toBe(500_000 + 300_000); // pending + defaulted, voided/test/cleared excluded
    });

    it('the same semantics everywhere: resolveOwnUnitCount/unitCountBase agree with the KPI', () => {
        const p = { numberOfUnits: 12, units: [{}, {}] };
        expect(resolveOwnUnitCount(p)).toBe(12); // declared wins
        expect(portfolioUnitTotals([p]).managedUnits).toBe(12);
        expect(portfolioUnitTotals([{}]).managedUnits).toBe(1); // bare row = one occupancy
        expect(unitCountBase({})).toBe(1);
    });
});

describe('10. activeMattersCount / overdueTasksCount — zero/one/multiple/archived', () => {
    it('active matters count only Active, non-archived rows with real content', () => {
        expect(activeMattersCount([])).toBe(0);
        expect(activeMattersCount([
            { id: 'm1', title: 'Recovery suit', status: 'Active' },
            { id: 'm2', title: 'Conveyance', status: 'Closed' },
            { id: 'm3', title: '', status: 'Active' },                 // ghost row
            { id: 'm4', title: 'Archived suit', status: 'Active', archivedAt: '2026-01-01' }, // archived
        ])).toBe(1);
        expect(activeMattersCount([
            { id: 'm1', title: 'A', status: 'Active' },
            { id: 'm2', title: 'B', status: 'Active' },
            { id: 'm3', title: 'C', status: 'Active' },
        ])).toBe(3);
    });

    it('overdue tasks count non-done tasks due in the past — done, future and undated never count', () => {
        expect(overdueTasksCount([], NOW)).toBe(0);
        expect(overdueTasksCount([
            { id: 't1', status: 'open', dueDate: YESTERDAY },
            { id: 't2', status: 'done', dueDate: YESTERDAY },
            { id: 't3', status: 'open', dueDate: TOMORROW },
            { id: 't4', status: 'open' },
        ], NOW)).toBe(1);
        expect(overdueTasksCount([
            { id: 't1', status: 'open', dueDate: YESTERDAY },
            { id: 't2', status: 'in-progress', dueDate: YESTERDAY },
        ], NOW)).toBe(2);
    });
});

describe('K-6. outstandingLegalRevenue — origin-scoped money, no double counting', () => {
    const evidence = {
        matters: [{ id: 'm-re', specialtyData: { realEstate: { propertyId: 'p1' } } }],
        properties: [{ id: 'p1' }, { id: 'p2' }],
    };
    const lineItems = (total: number) => [{ total }];

    it('counts ONLY legal-origin Unpaid/Overdue invoices', () => {
        const rev = outstandingLegalRevenue([
            { id: 'i1', status: 'Unpaid', lineItems: lineItems(400_000) },                                        // legal
            { id: 'i2', status: 'Overdue', lineItems: lineItems(600_000) },                                       // legal
            { id: 'i3', status: 'Unpaid', lineItems: lineItems(250_000), matter: { id: 'p2' } },                  // property (pseudo-matter)
            { id: 'i4', status: 'Unpaid', lineItems: lineItems(150_000), matterId: 'm-re' },                      // property (real-estate matter)
            { id: 'i5', status: 'Paid', lineItems: lineItems(700_000) },                                          // legal but paid
            { id: 'i6', status: 'Sent', lineItems: lineItems(100_000) },                                          // legal, not yet due-unpaid
        ] as any, evidence);
        expect(rev).toBe(400_000 + 600_000);
    });

    it('property money and legal money are disjoint systems (origins partition)', () => {
        const invoices = [
            { id: 'i1', status: 'Unpaid', lineItems: lineItems(1_000_000) },
            { id: 'i2', status: 'Unpaid', lineItems: lineItems(250_000), matter: { id: 'p2' } },
        ] as any;
        const { legal, property } = partitionInvoicesByOrigin(invoices, evidence);
        expect(legal).toHaveLength(1);
        expect(property).toHaveLength(1);
        // The INV card (legal) and the property figures never share a row
        expect(outstandingLegalRevenue(invoices, evidence)).toBe(1_000_000);
        expect(outstandingRentLedger([{ propertyId: 'p2', status: 'pending', amount: 250_000 }], ['p2']))
            .toBe(250_000);
    });
});

describe('11. Shared contact relationships — one contact, never counted twice', () => {
    it('a contact who is client on a matter AND landlord of a property contributes to each KPI exactly once (by construction: each KPI counts records of ONE type)', () => {
        const sharedContactId = 'c-shared';
        // The matter references the contact; the property references the
        // same contact as landlord — the KPIs count MATTERS and PROPERTY
        // ROWS respectively, never "contacts involved", so the shared
        // relationship cannot inflate either number.
        const matters = [{ id: 'm1', title: 'Recovery suit for the landlord', status: 'Active', clientId: sharedContactId }];
        const properties = [{ id: 'p1', status: 'Occupied', landlordId: sharedContactId }];

        expect(activeMattersCount(matters as any)).toBe(1);
        expect(portfolioUnitTotals(properties as any).propertyCount).toBe(1);
        expect(portfolioUnitTotals(properties as any).managedUnits).toBe(1);

        // The invoice the matter generated and the ledger the property
        // generated are ALSO disjoint (invoice origin vs ledger) — the
        // combined billing figure sums them without overlap.
        const invoices = [{ id: 'i1', status: 'Unpaid', matter: { id: 'm1' }, lineItems: [{ total: 500_000 }] }];
        expect(outstandingLegalRevenue(invoices as any, {
            matters, properties,
        })).toBe(500_000);
        expect(outstandingRentLedger([{ propertyId: 'p1', status: 'pending', amount: 800_000 }], ['p1'])).toBe(800_000);
        // combined = 1.3M with each naira counted once
        expect(
            outstandingLegalRevenue(invoices as any, { matters, properties }) +
            outstandingRentLedger([{ propertyId: 'p1', status: 'pending', amount: 800_000 }], ['p1'])
        ).toBe(1_300_000);
    });

    it('the same landlord with TWO property invoices still partitions exactly (management fees are property-origin)', () => {
        const evidence = {
            matters: [] as any[],
            properties: [{ id: 'p1' }, { id: 'p2' }],
        };
        const invoices = [
            { id: 'mf1', status: 'Unpaid', matter: { id: 'p1' }, lineItems: [{ total: 120_000 }] },
            { id: 'mf2', status: 'Unpaid', matter: { id: 'p2' }, lineItems: [{ total: 90_000 }] },
            { id: 'legal1', status: 'Unpaid', matter: { id: 'general' }, lineItems: [{ total: 450_000 }] },
        ] as any;
        expect(outstandingLegalRevenue(invoices, evidence)).toBe(450_000);
        const propertySide = invoices.filter((i: any) => invoiceBusinessOrigin(i, evidence) === 'property');
        expect(propertySide).toHaveLength(2);
        expect(propertySide.reduce((s: number, i: any) => s + i.lineItems[0].total, 0)).toBe(210_000);
    });
});
