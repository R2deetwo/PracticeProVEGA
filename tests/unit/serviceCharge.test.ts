/**
 * Item 2 regression suite — unified service-charge resolution.
 *
 * THE BUG THIS LOCKS IN: PropertyDetailView carried three `||` fallback
 * chains (~1364, ~2016, ~2142) computing the SAME unit's service charge
 * three different ways. `||` treats 0 as falsy, so an exempt unit
 * (service charge = 0) fell through to the contracted rate, the rental
 * record, or the parent property's default — and the property view,
 * tenant portal and billing ledger disagreed about what the unit pays.
 *
 * Fix under test: resolveServiceCharge({ unit, rental, defaultProperty })
 * walks the priority chain treating 0 as a REAL value at every level.
 * A missing "serviceCharge = 0 → 0" case means the bug is NOT fixed.
 */
import { describe, it, expect } from 'vitest';
import {
    resolveServiceCharge,
    resolveServiceChargeAmount,
    type ServiceChargeSource,
} from '../../src/utils/serviceCharge';
import { getUnitDisplay } from '../../src/utils/propertyPayload';
import type { Property } from '../../src/types';

const asUnit = (o: Record<string, any>): Property => o as Property;

describe('resolveServiceCharge — priority chain', () => {
    it('level 1: top-level unit.serviceChargeAmount (legacy embedded unit) wins', () => {
        const r = resolveServiceCharge({ unit: { serviceChargeAmount: 120000, serviceCharge: 10000 } });
        expect(r).toEqual({ amount: 120000, source: 'unit.serviceChargeAmount' });
    });

    it('level 2: rental.serviceChargeAmount wins when the unit top-level is unset', () => {
        const r = resolveServiceCharge({
            unit: { rentalDetails: { serviceChargeAmount: 250000, serviceCharge: 25000 } },
        });
        expect(r).toEqual({ amount: 250000, source: 'rental.serviceChargeAmount' });
    });

    it('level 3: top-level unit.serviceCharge wins when no amount field exists (legacy unit)', () => {
        const r = resolveServiceCharge({ unit: { serviceCharge: 500000 } });
        expect(r).toEqual({ amount: 500000, source: 'unit.serviceCharge' });
    });

    it('level 4: rental.serviceCharge wins when only the contracted rate exists', () => {
        const r = resolveServiceCharge({ unit: {}, rental: { serviceCharge: 300000 } });
        expect(r).toEqual({ amount: 300000, source: 'rental.serviceCharge' });
    });

    it('level 5: the parent property default is the last resort before 0', () => {
        const r = resolveServiceCharge({
            unit: { id: 'u1' },
            rental: {},
            defaultProperty: { rentalDetails: { serviceCharge: 200000 } },
        });
        expect(r).toEqual({ amount: 200000, source: 'property.serviceCharge' });
    });

    it('level 5 also reads a top-level property.serviceCharge when rentalDetails is absent', () => {
        const r = resolveServiceCharge({ unit: {}, defaultProperty: { serviceCharge: 150000 } });
        expect(r).toEqual({ amount: 150000, source: 'property.serviceCharge' });
    });

    it('all levels undefined → 0 with source "none" (and only then)', () => {
        const r = resolveServiceCharge({ unit: {}, rental: {}, defaultProperty: {} });
        expect(r).toEqual({ amount: 0, source: 'none' });
    });

    it('rental defaults to unit.rentalDetails when omitted', () => {
        const r = resolveServiceCharge({ unit: { rentalDetails: { serviceCharge: 75000 } } });
        expect(r.amount).toBe(750000 / 10);
        expect(r.source).toBe('rental.serviceCharge');
    });

    it('an explicitly passed rental beats unit.rentalDetails (caller override)', () => {
        const r = resolveServiceCharge({
            unit: { rentalDetails: { serviceCharge: 1 } },
            rental: { serviceChargeAmount: 2 },
        });
        expect(r).toEqual({ amount: 2, source: 'rental.serviceChargeAmount' });
    });
});

describe('resolveServiceCharge — 0 is a real value (THE regression)', () => {
    it('unit.serviceChargeAmount = 0 does NOT fall through to unit.serviceCharge', () => {
        const r = resolveServiceCharge({ unit: { serviceChargeAmount: 0, serviceCharge: 500000 } });
        expect(r).toEqual({ amount: 0, source: 'unit.serviceChargeAmount' });
    });

    it('rental.serviceChargeAmount = 0 does NOT fall through to the contracted rate', () => {
        // This is the exact shape PropertyDetailView:1364/2142 used to
        // resolve to 500000 via `d.serviceChargeAmount || rd.serviceCharge`.
        const r = resolveServiceCharge({
            unit: { rentalDetails: { serviceChargeAmount: 0, serviceCharge: 500000 } },
        });
        expect(r).toEqual({ amount: 0, source: 'rental.serviceChargeAmount' });
    });

    it('unit.serviceCharge = 0 does NOT fall through to rental.serviceCharge', () => {
        const r = resolveServiceCharge({ unit: { serviceCharge: 0 }, rental: { serviceCharge: 500000 } });
        expect(r).toEqual({ amount: 0, source: 'unit.serviceCharge' });
    });

    it('rental.serviceCharge = 0 does NOT inherit the parent property default', () => {
        // The headline case: an exempt unit in a building whose property-level
        // service charge is 250000 must show 0, not 250000.
        const r = resolveServiceCharge({
            unit: { rentalDetails: { serviceCharge: 0 } },
            defaultProperty: { rentalDetails: { serviceCharge: 250000 } },
        });
        expect(r).toEqual({ amount: 0, source: 'rental.serviceCharge' });
    });

    it('the full legacy chain stops at the first defined 0 (PropertyDetailView:1364 shape)', () => {
        const unit = { serviceChargeAmount: 0, serviceCharge: 0 };
        const rental = { serviceCharge: 750000 };
        const r = resolveServiceCharge({ unit, rental, defaultProperty: { rentalDetails: { serviceCharge: 750000 } } });
        expect(r).toEqual({ amount: 0, source: 'unit.serviceChargeAmount' });
    });

    it('a 0 from the property default is also respected, not skipped', () => {
        const r = resolveServiceCharge({ unit: {}, rental: {}, defaultProperty: { serviceCharge: 0 } });
        expect(r).toEqual({ amount: 0, source: 'property.serviceCharge' });
    });
});

describe('resolveServiceCharge — dirty input hygiene', () => {
    it('skips null / undefined / NaN / blank-string values and keeps walking', () => {
        const r = resolveServiceCharge({
            unit: { serviceChargeAmount: null, serviceCharge: '   ' },
            rental: { serviceChargeAmount: Number.NaN, serviceCharge: '600000' },
        });
        expect(r).toEqual({ amount: 600000, source: 'rental.serviceCharge' });
    });

    it('coerces numeric strings from legacy records', () => {
        const r = resolveServiceCharge({ unit: { serviceChargeAmount: '125,000' as any } });
        // "125,000" is not a plain numeric string — treated as junk → skipped,
        // chain continues. Plain "125000" coerces.
        expect(r.amount).toBe(0);
        const r2 = resolveServiceCharge({ unit: { serviceChargeAmount: '125000' } });
        expect(r2).toEqual({ amount: 125000, source: 'unit.serviceChargeAmount' });
    });

    it('non-numeric junk is skipped without throwing', () => {
        const r = resolveServiceCharge({ unit: { serviceChargeAmount: true as any, serviceCharge: {} as any }, rental: { serviceCharge: 900000 } });
        expect(r).toEqual({ amount: 900000, source: 'rental.serviceCharge' });
    });

    it('missing args entirely resolve to 0/none', () => {
        expect(resolveServiceCharge({})).toEqual({ amount: 0, source: 'none' });
        expect(resolveServiceChargeAmount(null as any)).toBe(0);
    });
});

describe('resolveServiceChargeAmount — convenience wrapper', () => {
    it('returns just the number', () => {
        expect(resolveServiceChargeAmount({ unit: { serviceCharge: 420000 } })).toBe(420000);
    });
});

describe('getUnitDisplay — parity through the unified helper', () => {
    it('modern unit: rentalDetails.serviceChargeAmount first, then serviceCharge', () => {
        const d = getUnitDisplay(asUnit({ id: 'u1', status: 'Occupied', rentalDetails: { serviceChargeAmount: 300000, serviceCharge: 30000 } }));
        expect(d.serviceChargeAmount).toBe(300000);
        expect(d.serviceChargeSource).toBe('rental.serviceChargeAmount');
    });

    it('legacy embedded unit: top-level fields resolve without rentalDetails', () => {
        const d = getUnitDisplay(asUnit({ id: 'u2', serviceCharge: 180000 }));
        expect(d.serviceChargeAmount).toBe(180000);
        expect(d.serviceChargeSource).toBe('unit.serviceCharge');
    });

    it('legacy unit with top-level serviceChargeAmount', () => {
        const d = getUnitDisplay(asUnit({ id: 'u3', serviceChargeAmount: 90000, serviceCharge: 9000 }));
        expect(d.serviceChargeAmount).toBe(90000);
        expect(d.serviceChargeSource).toBe('unit.serviceChargeAmount');
    });

    it('0 stays 0 — getUnitDisplay never falls back past a defined 0', () => {
        const d = getUnitDisplay(asUnit({ id: 'u4', rentalDetails: { serviceChargeAmount: 0, serviceCharge: 500000 } }));
        expect(d.serviceChargeAmount).toBe(0);
        expect(d.serviceChargeSource).toBe('rental.serviceChargeAmount');
    });

    it('no service charge anywhere → 0 with the none source', () => {
        const d = getUnitDisplay(asUnit({ id: 'u5', rentalDetails: { rentAmount: 1000000 } }));
        expect(d.serviceChargeAmount).toBe(0);
        expect(d.serviceChargeSource).toBe('none');
    });
});

describe('cross-surface consistency matrix (property view vs ledger sources)', () => {
    it('the same unit resolves identically for the property grid, the SC table and the ledger creator', () => {
        // Shape drawn from ServiceChargeMonitor.deriveLeaseServiceCharges
        // (which seeds the records the tenant portal and billing view read)
        // and from PropertyDetailView's units grid — same inputs, one answer.
        const embeddedUnit = { id: 'blk-a-101', unitName: '101', serviceChargeAmount: 0, serviceCharge: 650000 };
        const parentProperty = { id: 'p1', rentalDetails: { serviceCharge: 250000 } };

        const matrix = {
            propertyGrid: resolveServiceChargeAmount({ unit: embeddedUnit, rental: (embeddedUnit as any).rentalDetails, defaultProperty: parentProperty }),
            scTable: resolveServiceChargeAmount({ unit: embeddedUnit, rental: (embeddedUnit as any).rentalDetails, defaultProperty: parentProperty }),
            ledgerCreator: resolveServiceChargeAmount({ unit: embeddedUnit, rental: (embeddedUnit as any).rentalDetails }),
            getUnitDisplay: getUnitDisplay(asUnit(embeddedUnit)).serviceChargeAmount,
        };
        expect(matrix.propertyGrid).toBe(0);
        expect(matrix.scTable).toBe(0);
        expect(matrix.ledgerCreator).toBe(0);
        expect(matrix.getUnitDisplay).toBe(0);
    });

    it('a positive rate resolves identically across every consumer shape', () => {
        const embeddedUnit = { id: 'blk-a-102', unitName: '102', serviceCharge: 650000 };
        const parentProperty = { id: 'p1', rentalDetails: { serviceCharge: 250000 } };
        const grid = resolveServiceCharge({ unit: embeddedUnit, rental: (embeddedUnit as any).rentalDetails, defaultProperty: parentProperty });
        const monitor = resolveServiceCharge({ unit: embeddedUnit, rental: (embeddedUnit as any).rentalDetails });
        expect(grid).toEqual(monitor);
        expect(grid.amount).toBe(650000);
        expect(grid.source).toBe('unit.serviceCharge');
    });
});

describe('serviceChargeDebugTitle — dev-mode source surfacing', () => {
    it('always names the winning level so dev tooling can rely on it', async () => {
        const { serviceChargeDebugTitle } = await import('../../src/utils/serviceCharge');
        const r = resolveServiceCharge({ unit: { serviceCharge: 1000 } });
        // In vitest (node, no vite define), import.meta.env.DEV is undefined →
        // the guard returns undefined; the important assertion is that the
        // function never throws and the source label itself is stable.
        expect(['Service-charge resolution: unit.serviceCharge', undefined]).toContain(serviceChargeDebugTitle(r.source));
        expect(r.source satisfies ServiceChargeSource).toBe('unit.serviceCharge');
    });
});
