/**
 * vegaSiteConfig — the independence seam for the Vega product surface
 * (P2 B6). Every route OUT of /vega reads from here; when Vega gets its
 * standalone domain, this is the one file that changes.
 *
 *   - productDomain stays null until the standalone domain exists; today
 *     Vega lives at practicepro.ng/vega and the hub is the parent page.
 *   - signupPath/loginPath are the STANDALONE paths (the seam). Today's
 *     flows open the app's signup/login modals — no route change here
 *     alters that until the standalone site lands.
 */
export interface VegaSiteConfig {
    name: 'Vega';
    productDomain: string | null;   // null until the standalone domain exists
    hubUrl: string;                 // PracticePro company site, used by "ALL PRODUCTS" and "By PracticePro"
    signupPath: string;
    loginPath: string;
    resourcesPath: string;
    legal: { privacy: string; terms: string; cookies: string; usage: string };
    contact: { whatsapp: string; email: string };
    /** Extension: Vega's client portal (a real route today). */
    portal: { client: string };
}

export const vegaSiteConfig: VegaSiteConfig = {
    name: 'Vega',
    productDomain: null,
    hubUrl: '/',
    signupPath: '/signup',
    loginPath: '/login',
    // R32: resources live IN the product page — /vega/resources carries the
    // Vega-themed set (the hub-level /resources stays as the company index).
    resourcesPath: '/vega/resources',
    legal: {
        privacy: '/privacy-policy',
        terms: '/terms-of-service',
        cookies: '/cookie-policy',
        usage: '/usage-policy',
    },
    contact: {
        whatsapp: '',
        email: 'dpo@practicepro.ng',
    },
    portal: {
        client: '/portal/client/login',
    },
};
