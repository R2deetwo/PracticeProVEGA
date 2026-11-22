/**
 * vegaTiers tests — pin the pricing-matrix source of truth.
 *
 * The landing pricing band and the in-app subscription page both render
 * VEGA_TIERS; these tests pin the 2026-11-23 restructure (owner direction):
 * the NO-REPETITION model — every tier above Free carries the tier below
 * it wholesale via `baseLine` ("Everything in Growth, plus:") and lists
 * ONLY what it adds, so no feature line is repeated across cards; and
 * ALOA Vox™ is a PRO feature ("It should be in Pro, not in Growth
 * anymore") — it appears in exactly one Vega tier list.
 *
 * The R49 substance survives: DraftPro is STANDARD on every Vega plan
 * (the Free tier lists it; Growth/Pro/Enterprise inherit it through
 * their baseLine chains), and the Regulatory & Compliance
 * Cross-Referencing engine is the Enterprise-tier delineation.
 */
import { describe, it, expect } from 'vitest';
import { VEGA_TIERS, ATRIUM_TIERS, formatTierPrice } from '../../src/constants/tiers';

const VOX = /ALOA Vox™/;

describe('VEGA_TIERS — the no-repetition model (2026-11-23)', () => {
    it('every tier above Free carries the tier below via baseLine; Free lists its own', () => {
        expect(VEGA_TIERS.Core.baseLine).toBeUndefined();
        expect(VEGA_TIERS.Growth.baseLine).toBe('Everything in Free, plus:');
        expect(VEGA_TIERS.Pro.baseLine).toBe('Everything in Growth, plus:');
        expect(VEGA_TIERS.Enterprise.baseLine).toBe('Everything in Pro, plus:');
        // Atrium follows the same model
        expect(ATRIUM_TIERS.Core.baseLine).toBeUndefined();
        expect(ATRIUM_TIERS.Growth.baseLine).toBe('Everything in Starter, plus:');
        expect(ATRIUM_TIERS.Pro.baseLine).toBe('Everything in Growth, plus:');
        expect(ATRIUM_TIERS.Enterprise.baseLine).toBe('Everything in Pro, plus:');
    });

    it('no feature line is repeated across tier lists (each tier lists only what it adds)', () => {
        const lists = [
            VEGA_TIERS.Core.features,
            VEGA_TIERS.Growth.features,
            VEGA_TIERS.Pro.features,
            VEGA_TIERS.Enterprise.features,
        ];
        const seen = new Set<string>();
        for (const list of lists) {
            for (const f of list) {
                expect(seen.has(f), `duplicated feature line across Vega tier lists: "${f}"`).toBe(false);
                seen.add(f);
            }
        }
    });

    it('ALOA Vox™ is a PRO feature — in exactly one Vega tier list, and it is Pro', () => {
        expect(VEGA_TIERS.Pro.features.some((f) => VOX.test(f))).toBe(true);
        expect(VEGA_TIERS.Growth.features.some((f) => VOX.test(f))).toBe(false);
        expect(VEGA_TIERS.Core.features.some((f) => VOX.test(f))).toBe(false);
        expect(VEGA_TIERS.Enterprise.features.some((f) => VOX.test(f))).toBe(false); // inherited via "Everything in Pro"
    });

    it('Free tier carries the DraftPro contract analyzer (standard on every plan via the baseLine chain)', () => {
        expect(VEGA_TIERS.Core.features.some((f) => /DraftPro/i.test(f))).toBe(true);
        // Growth and Pro do NOT repeat the DraftPro line — they inherit it
        expect(VEGA_TIERS.Growth.features.some((f) => /DraftPro/i.test(f))).toBe(false);
        expect(VEGA_TIERS.Pro.features.some((f) => /DraftPro/i.test(f))).toBe(false);
    });

    it('Enterprise carries the Regulatory engine, and only Enterprise does', () => {
        const engine = /Regulatory & Compliance Cross-Referencing engine/;
        expect(VEGA_TIERS.Enterprise.features.some((f) => engine.test(f))).toBe(true);
        expect(VEGA_TIERS.Growth.features.some((f) => engine.test(f))).toBe(false);
        expect(VEGA_TIERS.Pro.features.some((f) => engine.test(f))).toBe(false);
    });

    it('Growth keeps the Growth-tier delineations (court rules, portal cap, reminders)', () => {
        expect(VEGA_TIERS.Growth.features).toContain('Court rules & procedural intelligence');
        expect(VEGA_TIERS.Growth.features).toContain('Client Portal — milestone tracking, document vault, KYC uploads (up to 20 clients)');
        expect(VEGA_TIERS.Growth.features).toContain('Court Date Reminders — automated alerts 7/3/1 days before hearings (WhatsApp)');
        // …and Pro does not repeat them
        expect(VEGA_TIERS.Pro.features).not.toContain('Court rules & procedural intelligence');
        expect(VEGA_TIERS.Pro.features).not.toContain('Court Date Reminders — automated alerts 7/3/1 days before hearings (WhatsApp)');
    });

    it('prices render for the matrix without drift', () => {
        expect(formatTierPrice(VEGA_TIERS.Core, 'monthly').price).toBe('Free');
        expect(formatTierPrice(VEGA_TIERS.Growth, 'monthly')).toEqual({ price: '₦45,000', per: '/mo' });
        expect(formatTierPrice(VEGA_TIERS.Pro, 'monthly')).toEqual({ price: '₦80,000', per: '/mo' });
        expect(formatTierPrice(VEGA_TIERS.Enterprise, 'monthly').price).toBe('Custom');
    });

    it('Atrium lists follow the same no-repetition rule', () => {
        const lists = [
            ATRIUM_TIERS.Core.features,
            ATRIUM_TIERS.Growth.features,
            ATRIUM_TIERS.Pro.features,
            ATRIUM_TIERS.Enterprise.features,
        ];
        const seen = new Set<string>();
        for (const list of lists) {
            for (const f of list) {
                expect(seen.has(f), `duplicated feature line across Atrium tier lists: "${f}"`).toBe(false);
                seen.add(f);
            }
        }
    });
});
