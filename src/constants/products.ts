/**
 * Product Brand Colors — Single Source of Truth
 *
 * Defines the canonical brand color for each PracticePro product.
 * All components must reference this file instead of hardcoding colors.
 *
 * This replaces the three competing sources:
 *   - index.css:18-23 (Vega=amber, Atrium=emerald, brand=moss)
 *   - AnalyticsView.tsx:40-44 (Vega=blue, Atrium=sky, Komplete=violet)
 *   - LandingPage.tsx:172,268 (Vega=amber, Atrium/Komplete=violet)
 */

export type ProductId = 'legal' | 'vega' | 'property' | 'atrium' | 'unified' | 'komplete';

export interface ProductBrand {
    /** Canonical product ID */
    id: 'vega' | 'atrium' | 'komplete';
    /** Display name */
    label: string;
    /** Tailwind color family name (e.g. 'amber', 'emerald', 'violet') */
    colorFamily: string;
    /** Literal hex color for inline styles / SVG */
    hex: string;
    /** Tailwind bg class (e.g. 'bg-amber-500') */
    bgClass: string;
    /** Tailwind text class (e.g. 'text-amber-500') */
    textClass: string;
    /** Tailwind border class (e.g. 'border-amber-500') */
    borderClass: string;
    /** Light bg class (e.g. 'bg-amber-50') */
    bgLightClass: string;
    /** Light text class (e.g. 'text-amber-700') */
    textDarkClass: string;
}

export const PRODUCT_BRANDS: Record<string, ProductBrand> = {
    vega: {
        id: 'vega',
        label: 'Vega',
        colorFamily: 'amber',
        hex: '#D97706',
        bgClass: 'bg-amber-500',
        textClass: 'text-amber-500',
        borderClass: 'border-amber-500',
        bgLightClass: 'bg-amber-50',
        textDarkClass: 'text-amber-700',
    },
    atrium: {
        id: 'atrium',
        label: 'Atrium',
        colorFamily: 'emerald',
        hex: '#059669',
        bgClass: 'bg-emerald-500',
        textClass: 'text-emerald-500',
        borderClass: 'border-emerald-500',
        bgLightClass: 'bg-emerald-50',
        textDarkClass: 'text-emerald-700',
    },
    komplete: {
        id: 'komplete',
        label: 'Komplete',
        colorFamily: 'violet',
        hex: '#7C3AED',
        bgClass: 'bg-violet-500',
        textClass: 'text-violet-500',
        borderClass: 'border-violet-500',
        bgLightClass: 'bg-violet-50',
        textDarkClass: 'text-violet-700',
    },
};

/**
 * Get the product brand for a given product string.
 * Handles all aliases: 'legal' → vega, 'property' → atrium, 'unified' → komplete.
 */
export function getProductBrand(product?: string | null): ProductBrand {
    if (!product) return PRODUCT_BRANDS.komplete;
    const p = product.toLowerCase().trim();
    if (p === 'vega' || p === 'legal') return PRODUCT_BRANDS.vega;
    if (p === 'atrium' || p === 'property') return PRODUCT_BRANDS.atrium;
    if (p === 'komplete' || p === 'unified') return PRODUCT_BRANDS.komplete;
    return PRODUCT_BRANDS.komplete;
}

/**
 * Get a Tailwind bg class for a product (e.g. 'bg-amber-500' for Vega).
 */
export function getProductBgClass(product?: string | null): string {
    return getProductBrand(product).bgClass;
}

/**
 * Get a Tailwind text class for a product (e.g. 'text-amber-500' for Vega).
 */
export function getProductTextClass(product?: string | null): string {
    return getProductBrand(product).textClass;
}

/**
 * Product label for display (e.g. 'Vega', 'Atrium', 'Komplete').
 */
export function getProductLabel(product?: string | null): string {
    return getProductBrand(product).label;
}
