/**
 * vegaTiersDraftPro tests — pin the R49 pricing-matrix source of truth.
 *
 * The landing pricing band and the in-app subscription page both render
 * VEGA_TIERS; these tests pin the R49 restructure: DraftPro is STANDARD
 * on every Vega plan (the free tier included), and the Regulatory &
 * Compliance Cross-Referencing engine is the Enterprise-tier delineation.
 */
import { describe, it, expect } from 'vitest';
import { VEGA_TIERS, formatTierPrice } from '../../src/constants/tiers';

describe('VEGA_TIERS — DraftPro standard (R49)', () => {
    it('Free tier carries the DraftPro contract analyzer', () => {
        expect(VEGA_TIERS.Core.features.some((f) => /DraftPro/i.test(f))).toBe(true);
    });

    it('Growth and Pro carry the standard analysis + redlining line', () => {
        const line = /DraftPro™ — AI contract analysis & redlining \(standard\)/;
        expect(VEGA_TIERS.Growth.features.some((f) => line.test(f))).toBe(true);
        expect(VEGA_TIERS.Pro.features.some((f) => line.test(f))).toBe(true);
    });

    it('Enterprise carries the Regulatory engine, and only Enterprise does', () => {
        const engine = /Regulatory & Compliance Cross-Referencing engine/;
        expect(VEGA_TIERS.Enterprise.features.some((f) => engine.test(f))).toBe(true);
        expect(VEGA_TIERS.Growth.features.some((f) => engine.test(f))).toBe(false);
        expect(VEGA_TIERS.Pro.features.some((f) => engine.test(f))).toBe(false);
    });

    it('prices render for the matrix without drift', () => {
        expect(formatTierPrice(VEGA_TIERS.Core, 'monthly').price).toBe('Free');
        expect(formatTierPrice(VEGA_TIERS.Growth, 'monthly')).toEqual({ price: '₦45,000', per: '/mo' });
        expect(formatTierPrice(VEGA_TIERS.Pro, 'monthly')).toEqual({ price: '₦80,000', per: '/mo' });
        expect(formatTierPrice(VEGA_TIERS.Enterprise, 'monthly').price).toBe('Custom');
    });
});
