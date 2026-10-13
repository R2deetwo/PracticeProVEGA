import { useEffect } from 'react';
import { useProductBranding } from '../../components/marketing/brand/useProductBranding';

/**
 * useSiteChrome — the document-level effects every marketing surface needs
 * (moved verbatim from LandingPage.tsx in the P0 split; no styling
 * opinions live here).
 *
 *   1. Force LIGHT MODE on marketing pages — the 'dark'/'theme-*' classes
 *      are stripped from <html> on mount and restored on unmount so the
 *      app (after login) still respects the user's saved theme.
 *   2. Flag the body while a PRODUCT page is active so scoped CSS can
 *      re-tint app-level fixed surfaces (cookie bar, terms gate) that sit
 *      outside the site root — and only there.
 *   3. Per-product document identity (favicon, title, OG card) — restored
 *      to the PracticePro company identity when product is null (hub).
 */
export function useSiteChrome(product: 'vega' | 'atrium' | null) {
    useEffect(() => {
        const html = document.documentElement;
        const savedClasses = html.className;
        html.classList.remove('dark', 'theme-midnight', 'theme-oled', 'theme-neon-cyber', 'theme-sunlight-soft', 'theme-city-lights', 'theme-city-emerald', 'theme-midnight-emerald', 'theme-army-dark', 'theme-army-light');
        html.classList.remove('font-size-sm', 'font-size-lg');
        html.classList.add('font-size-md');
        return () => {
            html.className = savedClasses;
        };
    }, []);

    useEffect(() => {
        const body = document.body;
        body.classList.toggle('on-vega-page', product === 'vega');
        body.classList.toggle('on-atrium-page', product === 'atrium');
        return () => {
            body.classList.remove('on-vega-page');
            body.classList.remove('on-atrium-page');
        };
    }, [product]);

    useProductBranding(product ?? 'vega', product !== null);
}
