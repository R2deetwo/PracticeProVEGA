/**
 * splashEndCard — the splash end-card resolver (Brand Clarity Pass, Phase 1).
 *
 * Owner direction (2026-11-18): the PracticePro splash "is very nice. I like
 * that, but it should end with the actual logo of the thing that we are
 * doing or working on."
 *
 * Owner brief 2026-11-25 (Splash Sequence & Product-Specific Finale): the
 * company splash sequence keeps its choreography (black → amber → green);
 * Stage 2 then fades through black and reveals ONLY the single product
 * mark being opened:
 *
 *   firm product 'vega'     → the Vega mark (the Seal, navy)
 *   firm product 'atrium'   → the Atrium mark (the Stepped Stack, yellow)
 *   firm product 'unified' → the Komplete mark (the Twin Coins)
 *   unknown / logged-out   → the company card — Stage 1 completes straight
 *                             into login; the post-login reveal (App.tsx
 *                             ProductReveal) plays Stage 2 once the plan
 *                             resolves.
 *
 * The multi-icon lockup row ("Vega · Atrium · Komplete") is RETIRED (owner
 * brief 2026-11-25: "Remove Multi-Icon Strip … show only the user's active
 * product icon") — the company card carries no lockup anymore.
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
     * on the splash's black ground (#000000): Vega's navy tile would
     * vanish at text scale, so its accent is the star's indigo-lit corner.
     */
    readyColor: string;
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
            };
        case 'atrium':
            return {
                mark: 'atrium',
                name: 'Atrium',
                attribution: COMPANY_ATTRIBUTION,
                readyColor: '#EAB308',
            };
        case 'komplete':
            return {
                mark: 'komplete',
                name: 'Komplete',
                attribution: COMPANY_ATTRIBUTION,
                readyColor: '#A5B4FC',
            };
        default:
            return {
                mark: 'practicepro',
                name: null,
                attribution: null,
                readyColor: COMPANY_READY_COLOR,
            };
    }
}
