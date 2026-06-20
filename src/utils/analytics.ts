/**
 * PostHog Product Analytics
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks user behavior so you can see which features are used, where users
 * drop off, and what conversion paths lead to signups. In development,
 * analytics is disabled (no data sent).
 *
 * SETUP:
 * 1. Create a free account at https://posthog.com (or self-host)
 * 2. Create a new project → get the API key
 * 3. Set the key as an env variable: VITE_POSTHOG_KEY
 *    (and optionally VITE_POSTHOG_HOST if self-hosting)
 * 4. Events will now flow to your PostHog dashboard automatically
 *
 * The app already has a Convex trackEvent mutation — PostHog complements
 * that with client-side session tracking, funnels, and retention charts.
 */

import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
const isProduction = import.meta.env.PROD;

let initialized = false;

export function initPostHog() {
    if (!POSTHOG_KEY) {
        console.info('[PostHog] No API key configured — analytics disabled.');
        return;
    }

    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        enabled: isProduction,
        // Respect Do Not Track
        opt_out_capturing_by_default: false,
        // Don't capture personal data that could be sensitive
        sanitize_properties: (props) => {
            // Strip any accidentally-included PII from event properties
            const sanitized = { ...props };
            delete sanitized.password;
            delete sanitized.token;
            delete sanitized.apiKey;
            return sanitized;
        },
        // Autocapture is OFF — we only track explicit events to protect
        // legal/financial data privacy. Turn on if you want click tracking.
        autocapture: false,
        // Session recording OFF — protects user privacy (legal documents)
        disable_session_recording: true,
    });

    initialized = true;
    console.info('[PostHog] Analytics initialized.');
}

/**
 * Track an explicit event.
 *
 * Usage:
 *   import { trackEvent } from '../utils/analytics';
 *   trackEvent('matter_created', { type: 'Civil Litigation', billingModel: 'Retainer' });
 */
export function trackEvent(event: string, properties?: Record<string, any>) {
    if (!initialized || !isProduction) return;
    try {
        posthog.capture(event, properties);
    } catch (e) {
        // Never let analytics crash the app
        console.warn('[PostHog] Failed to track event:', e);
    }
}

/**
 * Identify the current user so events are attributed to them.
 * Call after login.
 */
export function identifyUser(userId: string, properties?: { email?: string; name?: string; role?: string }) {
    if (!initialized || !isProduction) return;
    try {
        posthog.identify(userId, properties);
    } catch (e) {
        console.warn('[PostHog] Failed to identify user:', e);
    }
}

/**
 * Reset the user identity on logout.
 */
export function resetUser() {
    if (!initialized || !isProduction) return;
    try {
        posthog.reset();
    } catch (e) {
        console.warn('[PostHog] Failed to reset user:', e);
    }
}
