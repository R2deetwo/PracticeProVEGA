/**
 * Shared legal document opener — used across the app for Terms of Service,
 * Privacy Policy, Data Processing Agreement, etc.
 *
 * - On web: opens the document in a NEW browser tab (preserves SPA state)
 * - On APK: opens in the device's external default browser
 *
 * Previously, each component that linked to legal docs used SPA navigation
 * (navigateTo), which:
 *   1. Lost form state (e.g., Signup form data was wiped)
 *   2. On APK, opened inside the WebView instead of the external browser
 *
 * This utility ensures consistent behavior everywhere.
 */

import { Capacitor } from '@capacitor/core';

const PRODUCTION_URL = 'https://practice-pro-vega.vercel.app';

export type LegalDoc = 'terms' | 'privacy' | 'dpa' | 'cookies' | 'usage';

const DOC_PATHS: Record<LegalDoc, string> = {
    terms: '/terms-of-service',
    privacy: '/privacy-policy',
    dpa: '/data-processing-agreement',
    cookies: '/cookie-policy',
    usage: '/usage-policy',
};

export function openLegalDocument(doc: LegalDoc) {
    const path = DOC_PATHS[doc] || '/terms-of-service';
    if (Capacitor.isNativePlatform()) {
        // On APK, open the production URL in the device's external browser
        window.open(`${PRODUCTION_URL}${path}`, '_blank', 'noopener,noreferrer');
    } else {
        // On web, open in a new tab so the user can review while the app stays open
        window.open(path, '_blank', 'noopener,noreferrer');
    }
}
