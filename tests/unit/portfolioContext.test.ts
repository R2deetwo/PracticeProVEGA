import { describe, it, expect } from 'vitest';
import {
    buildPortfolioRoster,
    buildActivePropertyContext,
    searchPortfolio,
    toPropertyToolResult,
    unitTenantName,
} from '../../src/utils/portfolioContext';
import { Property, PropertyStatus, PropertyCategory } from '../../src/types';

const base = (over: Partial<Property> & { units?: any[] }): Property => ({
    id: 'p1',
    firmId: 'f1',
    address: '12 Admiralty Way, Lekki Phase 1',
    category: PropertyCategory.Tenanted,
    status: PropertyStatus.Occupied,
    ...over,
} as Property);

const lekki = base({
    id: 'p1',
    units: [
        {
            id: 'u1', unitName: 'Flat 1', rentAmount: 2500000, rentFrequency: 'Quarterly',
            tenantName: 'Mrs Adaeze Okafor', tenantPhone: '+2348031112233',
            leaseStart: '2025-01-01', leaseEnd: '2025-12-31',
        },
        {
            id: 'u2', unitName: 'Flat 2', rentAmount: 1800000, rentFrequency: 'Quarterly',
            occupantFirstName: 'Chinedu', occupantLastName: 'Eze',
        },
    ],
});

const ikeja = base({
    id: 'p2',
    address: '4 Oba Akran Avenue, Ikeja',
    status: PropertyStatus.Vacant,
    units: [],
    rentalDetails: {
        rentAmount: 5000000,
        rentFrequency: 'Annually',
        serviceCharge: 600000,
        tenantName: 'Acme Ltd (lease ended)',
    } as any,
});

const properties = [lekki, ikeja];

describe('buildPortfolioRoster', () => {
    it('returns empty string for an empty portfolio', () => {
        expect(buildPortfolioRoster([])).toBe('');
        expect(buildPortfolioRoster(undefined)).toBe('');
    });

    it('lists every property with ID, address, status and per-unit tenants', () => {
        const roster = buildPortfolioRoster(properties);
        expect(roster).toContain('[ID: p1]');
        expect(roster).toContain('12 Admiralty Way, Lekki Phase 1');
        expect(roster).toContain('Flat 1: Mrs Adaeze Okafor');
        expect(roster).toContain('Flat 2');
        expect(roster).toContain('Chinedu Eze');
        expect(roster).toContain('2 unit(s)');
        expect(roster).toContain('₦2,500,000 Quarterly');
        expect(roster).toContain('Oba Akran');
    });

    it('carries the aggregate header and the resolution instructions', () => {
        const roster = buildPortfolioRoster(properties);
        expect(roster).toContain('WHAT IS ON RECORD');
        expect(roster).toContain('2 properties');
        expect(roster).toContain('Occupied 1, Vacant 1');
        expect(roster).toContain('NEVER invent properties');
        expect(roster).toContain('ACTIVE PROPERTY');
    });

    it('falls back to property-level rentalDetails for legacy single-unit properties', () => {
        const roster = buildPortfolioRoster([ikeja]);
        expect(roster).toContain('Acme Ltd (lease ended)');
        expect(roster).toContain('SC ₦600,000');
    });

    it('truncates large portfolios with a pointer to the search tool', () => {
        const many = Array.from({ length: 50 }, (_, i) => base({ id: `p${i}`, address: `Addr ${i}` }));
        const roster = buildPortfolioRoster(many, { maxProperties: 40 });
        expect(roster).toContain('+ 10 more properties');
        expect(roster).toContain("category='properties'");
    });
});

describe('buildActivePropertyContext', () => {
    it('identifies the property whose detail page is open', () => {
        const ctx = buildActivePropertyContext(properties, { view: 'propertyDetail', selectedId: 'p1' });
        expect(ctx).toContain('CURRENTLY VIEWING');
        expect(ctx).toContain('12 Admiralty Way');
        expect(ctx).toContain('"this property"');
    });

    it('returns empty for non-detail views, missing ids, or unknown ids', () => {
        expect(buildActivePropertyContext(properties, { view: 'properties' })).toBe('');
        expect(buildActivePropertyContext(properties, { view: 'propertyDetail' })).toBe('');
        expect(buildActivePropertyContext(properties, { view: 'propertyDetail', selectedId: 'nope' })).toBe('');
        expect(buildActivePropertyContext([], { view: 'propertyDetail', selectedId: 'p1' })).toBe('');
    });
});

describe('searchPortfolio', () => {
    it('finds a property by address fragment', () => {
        expect(searchPortfolio(properties, 'lekki').map(p => p.id)).toEqual(['p1']);
    });

    it('finds a property by tenant name', () => {
        expect(searchPortfolio(properties, 'adaeze').map(p => p.id)).toEqual(['p1']);
    });

    it('multi-word queries rank properties matching more tokens first', () => {
        const hits = searchPortfolio(properties, 'lekki flat 2');
        expect(hits[0]?.id).toBe('p1');
        expect(hits).toHaveLength(1);
    });

    it('returns nothing for gibberish', () => {
        expect(searchPortfolio(properties, 'zzzz')).toEqual([]);
        expect(searchPortfolio(properties, '   ')).toEqual([]);
    });

    it('respects the limit', () => {
        const many = Array.from({ length: 10 }, (_, i) => base({ id: `p${i}`, address: `Shared Court ${i}` }));
        expect(searchPortfolio(many, 'shared', { limit: 3 })).toHaveLength(3);
    });
});

describe('toPropertyToolResult', () => {
    it('returns the ID and per-unit billing/contact detail the AI needs', () => {
        const r = toPropertyToolResult(lekki);
        expect(r.id).toBe('p1');
        expect(r.address).toContain('Admiralty');
        expect(r.units).toHaveLength(2);
        expect(r.units[0]).toMatchObject({
            unitName: 'Flat 1',
            tenantName: 'Mrs Adaeze Okafor',
            tenantPhone: '+2348031112233',
            rentAmount: 2500000,
            rentFrequency: 'Quarterly',
            leaseStart: '2025-01-01',
        });
    });

    it('surfaces property-level rentalDetails for legacy single-unit properties', () => {
        const r = toPropertyToolResult(ikeja);
        expect(r.units).toHaveLength(0);
        expect(r.rentalDetails?.serviceCharge).toBe(600000);
    });
});

describe('unitTenantName', () => {
    it('prefers tenantName, then titled occupant, then plain occupant', () => {
        expect(unitTenantName({ tenantName: 'Ada' })).toBe('Ada');
        expect(unitTenantName({ occupantTitle: 'Mr', occupantFirstName: 'John', occupantLastName: 'Doe' })).toBe('Mr John Doe');
        expect(unitTenantName({ occupantFirstName: 'John', occupantLastName: 'Doe' })).toBe('John Doe');
        expect(unitTenantName({})).toBe('');
    });

    it('reads a nested rentalDetails record when present', () => {
        expect(unitTenantName({ rentalDetails: { tenantName: 'Nested Ada' } } as any)).toBe('Nested Ada');
    });
});
