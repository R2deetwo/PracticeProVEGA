/**
 * splashEndCard — the splash end-card resolver (Brand Clarity Pass, Phase 1).
 *
 * Owner direction (2026-11-18): the PracticePro splash "is very nice. I like
 * that, but it should end with the actual logo of the thing that we are
 * doing or working on."
 *
 * The company splash sequence keeps its choreography (black → amber → green);
 * only the FINAL settle frame resolves to the product being opened:
 *
 *   firm product 'vega'     → the Vega mark (the Seal, navy)
 *   firm product 'atrium'   → the Atrium mark (the Stepped Stack, yellow)
 *   firm product 'unified'  → the Komplete mark (the Twin Coins)
 *   unknown / logged-out    → the company mark + the product lockup row
 *                             ("Vega · Atrium · Komplete") — Gate A, option
 *                             (b): the neutral card teaches the two-products
 *                             -plus-bundle model instead of reading as
 *                             "PracticePro is the legal app".
 *
 * The product always resolves from the same source of truth as the app skins
 * (the firm/user record via ProductContext — APP_UI_SEPARATION.md §2); this
 * module only canonicalizes and derives presentation. Pure by design: no
 * React, no Capacitor, no CSS imports — unit-testable in isolation
 * (tests/unit/brandClarity.test.ts).
 */

/** Which app the splash is settling into. 'practicepro' = the company card. */
export type SplashProduct = 'practicepro' | 'vega' | 'atrium' | 'komplete';

export interface SplashEndCard {
    /** The mark the settle frame heroes. 'practicepro' = company mark. */
    mark: SplashProduct;
    /** Display name under the product mark; null on the company card. */
    name: string | null;
    /** The product→company attribution line; null on the company card. */
    attribution: string | null;
    /**
     * The hue for the "Ready" text + end-card accent. Chosen for legibility
     * on the splash's dark zinc ground (#0e0e11): Vega's navy tile would
     * vanish at text scale, so its accent is the star's indigo-lit corner.
     */
    readyColor: string;
    /** Whether the "Vega · Atrium · Komplete" lockup row renders (company card). */
    lockup: boolean;
}

/** The company green — the existing splash final-phase colour. */
export const COMPANY_READY_COLOR = 'rgb(22, 163, 74)';

/** The attribution line every product card carries (standard §3, rule 1). */
export const COMPANY_ATTRIBUTION = 'by PracticePro Systems';

/**
 * Canonicalize any product identifier the app produces into a
 * SplashProduct. Accepts the ProductContext canonical values
 * ('vega' | 'atrium' | 'unified'), the legacy/alias values ('legal',
 * 'property', 'komplete'), and degrades gracefully to the company card.
 *
 * This is the fix for the App.tsx S2 defect (Brand Consistency Audit): the
 * old inline mapping compared against 'property', which is impossible after
 * ProductContext aliasing — so Atrium firms resolved to 'vega'.
 */
export function normalizeSplashProduct(raw?: string | null): SplashProduct {
    switch (raw) {
        case 'vega':
        case 'legal':
            return 'vega';
        case 'atrium':
        case 'property':
            return 'atrium';
        case 'unified':
        case 'komplete':
            return 'komplete';
        default:
            return 'practicepro';
    }
}

/** Resolve the end-card for a splash product (pure; memo-friendly). */
export function resolveSplashEndCard(product?: SplashProduct): SplashEndCard {
    switch (product) {
        case 'vega':
            return {
                mark: 'vega',
                name: 'Vega',
                attribution: COMPANY_ATTRIBUTION,
                readyColor: '#C7D2FE',
                lockup: false,
            };
        case 'atrium':
            return {
                mark: 'atrium',
                name: 'Atrium',
                attribution: COMPANY_ATTRIBUTION,
                readyColor: '#EAB308',
                lockup: false,
            };
        case 'komplete':
            return {
                mark: 'komplete',
                name: 'Komplete',
                attribution: COMPANY_ATTRIBUTION,
                readyColor: '#A5B4FC',
                lockup: false,
            };
        default:
            return {
                mark: 'practicepro',
                name: null,
                attribution: null,
                readyColor: COMPANY_READY_COLOR,
                lockup: true,
            };
    }
}
