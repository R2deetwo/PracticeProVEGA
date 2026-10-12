import { useEffect } from 'react';

/**
 * useProductBranding — per-product document identity (owner direction:
 * "this applies to the logos, favicons, icons, etc").
 *
 * The app is a single SPA with ONE index.html, so by default every route
 * shares the PracticePro company favicon + title. This hook swaps the
 * document's identity while a PRODUCT page is active — favicon (SVG for
 * modern browsers, PNG for Safari), apple-touch-icon, <title>,
 * apple-mobile-web-app-title, theme-color and the og:/twitter: card —
 * and restores the PracticePro company identity on the hub page and on
 * unmount. The company brand always returns; the product brand is an
 * overlay, never a takeover.
 *
 * og:/twitter: metas and the stock title/theme-color tags are edited
 * IN PLACE (a duplicate og:title would be ignored by some scrapers —
 * the first node in the document wins), with their original contents
 * captured on first edit and restored afterwards. Product favicon links
 * are APPENDED after the company favicon (browsers use the last icon
 * they support) and removed again when the visitor returns to the
 * company page, leaving the original PracticePro favicon untouched.
 */

type ProductBrand = {
    /** <title> + og:title / twitter:title */
    title: string;
    /** meta description + og:description / twitter:description */
    description: string;
    /** Absolute URL of the product page (og:url). */
    url: string;
    /** SVG favicon (Chrome / Edge / Firefox). */
    faviconSvg: string;
    /** PNG favicon fallback (Safari does not use SVG favicons). */
    faviconPng: string;
    /** 180x180 apple-touch-icon. */
    appleTouch: string;
    /** apple-mobile-web-app-title. */
    appleTitle: string;
    /** Browser chrome colour (light scheme). */
    themeColor: string;
    /** 1200x630 social card. */
    ogImage: string;
    ogImageAlt: string;
};

export const PRODUCT_BRANDS: Record<'vega' | 'atrium', ProductBrand> = {
    vega: {
        title: 'Vega — Legal Practice OS for Nigerian Law Firms | PracticePro',
        description:
            'Case management, AI-assisted drafting with ALOA, court-rule-aware calendaring and billing for Nigerian law firms — from intake to judgment, in one workspace. A PracticePro product.',
        url: 'https://practicepro.ng/vega',
        faviconSvg: '/brand/vega/favicon.svg',
        faviconPng: '/brand/vega/favicon-48.png',
        appleTouch: '/brand/vega/apple-touch-icon.png',
        appleTitle: 'Vega',
        themeColor: '#0B1220',
        ogImage: '/assets/landing/og-vega.png',
        ogImageAlt: 'PracticePro Vega — the legal practice OS for Nigerian law firms',
    },
    atrium: {
        title: 'Atrium — Property Management OS for Nigerian Portfolios | PracticePro',
        description:
            "Rent and service-charge collection, residents' portal, maintenance workflows and revenue intelligence for property portfolios — applying the tenancy law of all 36 states and the FCT. A PracticePro product.",
        url: 'https://practicepro.ng/atrium',
        faviconSvg: '/brand/atrium/favicon.svg',
        faviconPng: '/brand/atrium/favicon-48.png',
        appleTouch: '/brand/atrium/apple-touch-icon.png',
        appleTitle: 'Atrium',
        themeColor: '#059669',
        ogImage: '/assets/landing/og-atrium.png',
        ogImageAlt: 'PracticePro Atrium — the property management OS for Nigerian portfolios',
    },
};

/** The stock index.html values, captured on first edit and restored on
 *  cleanup. Keyed by a stable selector. */
const ORIGINALS = new Map<string, string>();

const MANAGED_ATTR = 'data-pp-brand';

/** Metas edited in place (selector → brand key). */
const META_TARGETS: Array<{ find: string; attr: 'content' }> = [
    { find: 'meta[name="description"]', attr: 'content' },
    { find: 'meta[property="og:title"]', attr: 'content' },
    { find: 'meta[property="og:description"]', attr: 'content' },
    { find: 'meta[property="og:image"]', attr: 'content' },
    { find: 'meta[property="og:image:alt"]', attr: 'content' },
    { find: 'meta[name="twitter:title"]', attr: 'content' },
    { find: 'meta[name="twitter:description"]', attr: 'content' },
    { find: 'meta[name="twitter:image"]', attr: 'content' },
    { find: 'meta[name="twitter:image:alt"]', attr: 'content' },
    { find: 'meta[name="apple-mobile-web-app-title"]', attr: 'content' },
    { find: 'meta[name="theme-color"][media="(prefers-color-scheme: light)"]', attr: 'content' },
];

/** Values applied per brand, aligned with META_TARGETS order. */
function metaValues(b: ProductBrand): string[] {
    return [
        b.description,
        b.title,
        b.description,
        b.ogImage,
        b.ogImageAlt,
        b.title,
        b.description,
        b.ogImage,
        b.ogImageAlt,
        b.appleTitle,
        b.themeColor,
    ];
}

const ORIGINAL_TITLE = 'PracticePro Systems — Build Systems That Help Scale Your Business';

function captureOriginal(el: Element, key: string) {
    if (!ORIGINALS.has(key)) {
        ORIGINALS.set(key, el.getAttribute('content') || '');
    }
}

function applyProductIdentity(b: ProductBrand) {
    document.title = b.title;
    // In-place metas.
    const values = metaValues(b);
    META_TARGETS.forEach((target, i) => {
        const el = document.head.querySelector(target.find);
        if (!el) return;
        captureOriginal(el, target.find);
        el.setAttribute('content', values[i]);
    });
    // og:url is product-only — create it if the stock head lacks one.
    let ogUrl = document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (!ogUrl) {
        ogUrl = document.createElement('meta');
        ogUrl.setAttribute('property', 'og:url');
        document.head.appendChild(ogUrl);
    }
    if (!ORIGINALS.has('og:url')) ORIGINALS.set('og:url', ogUrl.getAttribute('content') || '');
    ogUrl.setAttribute('content', b.url);
    // Favicon: PNG first, then SVG — appended AFTER the company favicon
    // so engines that support SVG take it and Safari falls back to PNG.
    const png = ensureLink('icon', 'image/png');
    png.setAttribute('sizes', '48x48');
    png.setAttribute('href', b.faviconPng);
    const svg = ensureLink('icon', 'image/svg+xml');
    svg.setAttribute('href', b.faviconSvg);
    const apple = ensureLink('apple-touch-icon');
    apple.setAttribute('sizes', '180x180');
    apple.setAttribute('href', b.appleTouch);
}

function applyCompanyIdentity() {
    // Product favicon links leave the document entirely.
    document.head.querySelectorAll(`link[${MANAGED_ATTR}]`).forEach((el) => el.remove());
    document.title = ORIGINAL_TITLE;
    META_TARGETS.forEach((target) => {
        const el = document.head.querySelector(target.find);
        const original = ORIGINALS.get(target.find);
        if (el && original !== undefined) el.setAttribute('content', original);
    });
    const ogUrl = document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    const originalUrl = ORIGINALS.get('og:url');
    if (ogUrl) {
        if (originalUrl) ogUrl.setAttribute('content', originalUrl);
        else ogUrl.remove();
    }
}

function ensureLink(rel: string, type?: string): HTMLLinkElement {
    // Match on rel AND type — the PNG and SVG favicon links both carry
    // rel="icon" and must stay two separate nodes (matching on rel alone
    // made the SVG pass overwrite the PNG's href).
    const sel = `link[rel="${rel}"]${type ? `[type="${type}"]` : ''}[${MANAGED_ATTR}]`;
    let el = document.head.querySelector<HTMLLinkElement>(sel);
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        if (type) el.setAttribute('type', type);
        el.setAttribute(MANAGED_ATTR, 'true');
        document.head.appendChild(el);
    }
    return el;
}

/**
 * @param activeProduct the page's product ('vega' | 'atrium')
 * @param productChosen false on the company hub → company identity.
 */
export function useProductBranding(activeProduct: 'vega' | 'atrium', productChosen: boolean) {
    useEffect(() => {
        if (productChosen) {
            applyProductIdentity(PRODUCT_BRANDS[activeProduct]);
        } else {
            applyCompanyIdentity();
        }
        // On unmount, always hand the document back to the company brand.
        return () => applyCompanyIdentity();
    }, [activeProduct, productChosen]);
}
