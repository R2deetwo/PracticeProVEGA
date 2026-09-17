/**
 * leaseConfigRedesign.test.ts — regression guards for Tasks 58 + 59
 * (user directive 2026-09-17).
 *
 * TASK 58 CONTRACT (property description):
 *   Typing a property description mid-creation and pressing Enter must
 *   never (a) submit/flip the form or (b) overwrite the description with
 *   the unit name. The property description is building-level and must
 *   stay fully independent of rentalDetails.unitDescription. Legacy rows
 *   saved with mangled descriptions ("Unit 1", "Complex (Unit 1)") are
 *   healed on load.
 *
 * TASK 59 CONTRACT (lease & rent configuration):
 *   The form speaks property management, not "tenancy package":
 *   - No lump-sum card that adds rent + service charge + one-time fees +
 *     refundable deposits together.
 *   - Service charge is captured ONCE as the amount per billing cycle;
 *     the legacy monthly rate is derived for every downstream reader.
 *   - The only "total service charge" concept is the months-in-advance
 *     requirement some estates enforce at move-in.
 *   - Charges are grouped by category (recurring / one-time / refundable)
 *     with plain-language explanations.
 *   - Service charge config respects the per-property Core Services toggle.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildPropertyRecord,
    deriveBuildingDescription,
    loadServiceChargeCycle,
    monthlyServiceChargeRate,
    normalizeUnitRental,
    scCycleMonths,
    type UnitRentalInput,
} from '../../src/utils/propertyPayload';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/schema.ts'))
    ? resolve(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

const baseUnit = (over: Partial<UnitRentalInput> = {}): UnitRentalInput => ({
    id: 'unit-1',
    unitName: 'Unit 1',
    unitDescription: '',
    rentAmount: 1_400_000,
    rentFrequency: 'Annually',
    leaseStart: '2026-01-01',
    leaseEnd: '2026-12-31',
    tenantName: 'Adaeze Okafor',
    tenantPhone: '+2348012345678',
    nextRentReview: '',
    isPeriodicReviewEnabled: false,
    status: 'Occupied',
    ...over,
});

describe('Task 58 — property description is never clobbered by unit fields', () => {
    it('buildPropertyRecord keeps the manager-typed description verbatim', () => {
        const pd = buildPropertyRecord(
            baseUnit({ unitName: 'Unit 1', unitDescription: '' }),
            { description: '8-Unit Luxury Complex with Pool' },
            'p1',
        );
        expect(pd.description).toBe('8-Unit Luxury Complex with Pool');
    });

    it('an empty description stays empty — no silent "Unit 1" fallback (the reported data loss)', () => {
        const pd = buildPropertyRecord(
            baseUnit({ unitName: 'Unit 1' }),
            { description: '' },
            'p1',
        );
        expect(pd.description).toBe('');
    });

    it('unit description stays in rentalDetails — fully independent of the building description', () => {
        const pd = buildPropertyRecord(
            baseUnit({ unitDescription: 'Penthouse with private terrace' }),
            { description: 'Luxury Complex' },
            'p1',
        );
        expect(pd.rentalDetails?.unitDescription).toBe('Penthouse with private terrace');
        expect(pd.description).toBe('Luxury Complex');
    });

    it('deriveBuildingDescription heals legacy mangled rows', () => {
        // Old writer appended "(Unit N)" when a property description existed…
        expect(deriveBuildingDescription('Luxury Complex (Unit 3)', 'Unit 3')).toBe('Luxury Complex');
        // …and wrote ONLY the unit name when it did not.
        expect(deriveBuildingDescription('Unit 1', 'Unit 1')).toBe('');
        expect(deriveBuildingDescription('Unit 12', 'Flat A')).toBe('');
        // Untouched descriptions pass through.
        expect(deriveBuildingDescription('Luxury Complex', 'Unit 1')).toBe('Luxury Complex');
        expect(deriveBuildingDescription(undefined, 'Unit 1')).toBe('');
        // A parenthetical that is NOT a unit tag is legitimate content.
        expect(deriveBuildingDescription('Block B (formerly Ocean Wing)', 'Unit 1')).toBe('Block B (formerly Ocean Wing)');
    });

    it('the form loads its description through the healing helper', () => {
        const src = read('src/components/forms/PropertyForm.tsx');
        expect(src).toMatch(
            /deriveBuildingDescription\(propertyToEdit\?\.description, propertyToEdit\?\.rentalDetails\?\.unitName\)/,
        );
    });

    it('form-level Enter guard — Enter inside a text input never submits the form', () => {
        const src = read('src/components/forms/PropertyForm.tsx');
        expect(src).toMatch(
            /onKeyDown=\{\(e\) => \{[\s\S]*?e\.key === 'Enter'[\s\S]*?tagName === 'INPUT'[\s\S]*?e\.preventDefault\(\)/,
        );
    });
});

describe('Task 59 — service charge is one per-cycle figure; the monthly rate is derived', () => {
    it('scCycleMonths maps frequency labels to cycle lengths', () => {
        expect(scCycleMonths('Monthly')).toBe(1);
        expect(scCycleMonths('Quarterly')).toBe(3);
        expect(scCycleMonths('Bi-Annually')).toBe(6);
        expect(scCycleMonths('Annually')).toBe(12);
        expect(scCycleMonths(undefined)).toBe(1);
        expect(scCycleMonths('')).toBe(1);
    });

    it('monthly cadence loads the monthly rate first — legacy monthly figures keep their meaning', () => {
        // A legacy row with rate 50k and a stray 600k "total": the timeline
        // always billed 50k monthly; the form must show 50k, not 600k.
        expect(loadServiceChargeCycle({ serviceCharge: 50_000, serviceChargeAmount: 600_000 })).toBe(50_000);
        expect(loadServiceChargeCycle({ serviceCharge: 0, serviceChargeAmount: 75_000 })).toBe(75_000);
        expect(loadServiceChargeCycle({})).toBe(0);
    });

    it('longer cadences load the per-cycle total first (reader parity with resolveCadence)', () => {
        expect(loadServiceChargeCycle({ serviceCharge: 50_000, serviceChargeAmount: 600_000, serviceChargeFrequency: 'Annually' })).toBe(600_000);
        // No stored total on an explicit cadence — the rate is the best available figure.
        expect(loadServiceChargeCycle({ serviceCharge: 25_000, serviceChargeFrequency: 'Quarterly' })).toBe(25_000);
    });

    it('monthlyServiceChargeRate derives the monthly rate from cycle + frequency', () => {
        expect(monthlyServiceChargeRate(600_000, 'Annually')).toBe(50_000);
        expect(monthlyServiceChargeRate(75_000, 'Quarterly')).toBe(25_000);
        expect(monthlyServiceChargeRate(500_000, 'Bi-Annually')).toBe(83_333.33);
        expect(monthlyServiceChargeRate(50_000, 'Monthly')).toBe(50_000);
        expect(monthlyServiceChargeRate(0, 'Annually')).toBe(0);
    });

    it('normalizeUnitRental clamps advance months into 0..24', () => {
        expect(normalizeUnitRental(baseUnit({ serviceChargeMonthsInAdvance: 6 })).serviceChargeMonthsInAdvance).toBe(6);
        expect(normalizeUnitRental(baseUnit({ serviceChargeMonthsInAdvance: 99 } as any)).serviceChargeMonthsInAdvance).toBe(24);
        expect(normalizeUnitRental(baseUnit({ serviceChargeMonthsInAdvance: -3 } as any)).serviceChargeMonthsInAdvance).toBe(0);
        expect(normalizeUnitRental(baseUnit()).serviceChargeMonthsInAdvance).toBe(0);
    });

    it('the form derives the monthly rate when the cycle amount or frequency changes', () => {
        const src = read('src/components/forms/PropertyForm.tsx');
        expect(src).toMatch(/field === 'serviceChargeAmount'[\s\S]{0,200}monthlyServiceChargeRate/);
        expect(src).toMatch(/field === 'serviceChargeFrequency'[\s\S]{0,200}monthlyServiceChargeRate/);
    });
});

describe('Task 59 — the form speaks property management, not "tenancy package"', () => {
    const src = () => read('src/components/forms/PropertyForm.tsx');

    it('the lump-sum package card and its phrase are gone', () => {
        expect(src()).not.toContain('Total Tenancy Package');
        expect(src()).not.toContain('tenancyPackage');
        // The old summing computation is gone too.
        expect(src()).not.toMatch(/const totalPayable/);
    });

    it('the manual "Total Service Charge Due" input is gone', () => {
        expect(src()).not.toContain('Total Service Charge Due');
    });

    it('charges are grouped with plain-language category cards', () => {
        const s = src();
        expect(s).toContain('Move-in Cost Summary');
        expect(s).toContain('Move-in Fees');
        expect(s).toContain('One-time professional fees charged when a new resident signs');
        expect(s).toContain('Held against damage beyond fair wear and tear');
        expect(s).toContain('Recurring estate charge for shared services');
    });

    it('the months-in-advance enforcement field exists and is clamped', () => {
        const s = src();
        expect(s).toContain("updateUnit(activeUnitIndex, 'serviceChargeMonthsInAdvance'");
        expect(s).toMatch(/Math\.min\(24,/);
    });

    it('service charge config hides when the service is off for the property', () => {
        expect(src()).toMatch(/\{coreServices\.serviceCharge \? \(/);
    });

    it('the summary never sums across categories — no aggregate figure is rendered', () => {
        // The summary card renders per-row amounts only; any expression that
        // adds rent + service charge + fees + deposit is banned.
        expect(src()).not.toMatch(/rentAmount[\s\S]{0,120}serviceChargeAmount\)[\s\S]{0,120}\+/);
    });
});
