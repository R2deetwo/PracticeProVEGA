/**
 * scaleOfCharges + tenancyNoticePeriods — R40 unit tests.
 *
 * R40 (owner direction: "look at every word said on the Vega site — if the
 * app doesn't do it yet, make it able to"): the Scale-of-Charges claim
 * ("fee notes computed on the Remuneration Order 2023") and the quit-notice
 * claim ("applies the law of the state where the property is located") are
 * now deterministic arithmetic. These tests lock the statutory bands and
 * the notice framework to the sources they were encoded from:
 *
 *   · Scale 4 (property transactions), NBA enforcement protocol:
 *       below ₦50m ......... 10% (not negotiable)
 *       ₦50m–₦100m ......... ₦5m for the first ₦50m + 5% of the excess
 *       above ₦100m ........ ₦7.5m for the first ₦100m + 3% of the excess
 *   · Notice-to-quit framework (Recovery of Premises pattern; Lagos
 *     Tenancy Law 2011 follows it by tenancy cycle):
 *       weekly 1 week · monthly 1 month · quarterly 3 months · yearly 6 months
 */
import { describe, it, expect } from 'vitest';
import {
    computeScaleFeeNote,
    scaleAppliesToMatter,
    LAND_DOCUMENTATION_MATTER_TYPES,
} from '../../src/utils/scaleOfCharges';
import { noticeToQuitPeriod, noticeFrameworkTable } from '../../src/utils/tenancyNoticePeriods';
import { Matter, MatterType, MatterStatus } from '../../src/types';

const matter = (type: MatterType): Matter => ({
    id: 'm1', firmId: 'f1', referenceNumber: 'R/1', title: 'T', type,
    status: MatterStatus.Active, createdAt: new Date().toISOString(),
    billingModel: 'Fixed Fee' as any, hourlyRate: 0, assignedUsers: [],
}) as unknown as Matter;

describe('scaleOfCharges — Scale 4, Remuneration Order 2023', () => {
    it('band I: 10% below ₦50m, not negotiable', () => {
        const note = computeScaleFeeNote(30_000_000);
        expect(note.bands).toHaveLength(1);
        expect(note.bands[0].rateLabel).toBe('10%');
        expect(note.total).toBe(3_000_000);
    });

    it('band I boundary: exactly ₦50m stays at 10%', () => {
        const note = computeScaleFeeNote(50_000_000);
        expect(note.total).toBe(5_000_000);
        expect(note.bands).toHaveLength(1);
    });

    it('band II: ₦5m for the first ₦50m + 5% of the excess', () => {
        // ₦65m → 5,000,000 + 5% of 15,000,000 = 5,750,000
        const note = computeScaleFeeNote(65_000_000);
        expect(note.bands).toHaveLength(2);
        expect(note.bands[1].rateLabel).toBe('5%');
        expect(note.total).toBe(5_750_000);
    });

    it('band II/III boundary: ₦100m is continuous (₦7.5m)', () => {
        const note = computeScaleFeeNote(100_000_000);
        expect(note.total).toBe(7_500_000);
    });

    it('band III: ₦7.5m for the first ₦100m + 3% of the excess', () => {
        // ₦150m → 7,500,000 + 3% of 50,000,000 = 9,000,000
        const note = computeScaleFeeNote(150_000_000);
        expect(note.bands).toHaveLength(3);
        expect(note.bands[2].rateLabel).toBe('3%');
        expect(note.total).toBe(9_000_000);
    });

    it('zero and negative values produce an empty note, never a negative fee', () => {
        expect(computeScaleFeeNote(0).total).toBe(0);
        expect(computeScaleFeeNote(-5).total).toBe(0);
        expect(computeScaleFeeNote(0).bands).toHaveLength(0);
    });

    it('the statutory reference and compliance note ride along', () => {
        const note = computeScaleFeeNote(10_000_000);
        expect(note.statutoryRef).toContain('Order 2023');
        expect(note.statutoryRef).toContain('Scale 4');
        expect(note.complianceNote).toContain('professional misconduct');
    });

    it('applicability: land documentation only', () => {
        expect(scaleAppliesToMatter(matter(MatterType.RealEstate))).toBe(true);
        expect(scaleAppliesToMatter(matter(MatterType.CorporateCommercial))).toBe(false);
        expect(scaleAppliesToMatter(matter(MatterType.FamilyLaw))).toBe(false);
        expect(scaleAppliesToMatter(null)).toBe(false);
        expect(LAND_DOCUMENTATION_MATTER_TYPES).toContain(MatterType.RealEstate);
    });
});

describe('tenancyNoticePeriods — the notice-to-quit framework', () => {
    it('the general framework: weekly 1 week, monthly 1 month, quarterly 3, yearly 6', () => {
        expect(noticeToQuitPeriod('Ogun', 'weekly').days).toBe(7);
        expect(noticeToQuitPeriod('Ogun', 'monthly').days).toBe(30);
        expect(noticeToQuitPeriod('Ogun', 'quarterly').days).toBe(91);
        expect(noticeToQuitPeriod('Ogun', 'yearly').days).toBe(182);
        expect(noticeToQuitPeriod('Rivers', 'yearly').label).toContain('six (6) months');
    });

    it('Lagos cites its encoded statute; other states cite the framework and ask for verification', () => {
        const lagos = noticeToQuitPeriod('Lagos', 'monthly');
        const ogun = noticeToQuitPeriod('Ogun', 'monthly');
        expect(lagos.basis).toBe('lagos_tenancy_law_2011');
        expect(lagos.verifyStateStatute).toBe(false);
        expect(ogun.basis).toBe('general framework');
        expect(ogun.verifyStateStatute).toBe(true);
    });

    it('case-insensitive state matching', () => {
        expect(noticeToQuitPeriod('lagos', 'yearly').basis).toBe('lagos_tenancy_law_2011');
        expect(noticeToQuitPeriod('LAGOS', 'yearly').basis).toBe('lagos_tenancy_law_2011');
    });

    it('at-will tenancies ask for the payment interval instead of guessing', () => {
        const r = noticeToQuitPeriod('Kaduna', 'at-will');
        expect(r.days).toBeNull();
        expect(r.label).toContain('payment interval');
        expect(r.verifyStateStatute).toBe(true);
    });

    it('the printable framework table carries all four cycles + the interval rule', () => {
        const table = noticeFrameworkTable();
        expect(table).toContain('one (1) week');
        expect(table).toContain('one (1) month');
        expect(table).toContain('three (3) months');
        expect(table).toContain('six (6) months');
        expect(table).toContain('payment interval');
    });
});
