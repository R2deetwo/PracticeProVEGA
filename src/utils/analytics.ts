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

// ── ROUND QA (§2 bundle size): posthog-js is ~206 KB minified and was a
// STATIC import of the eager entry chunk — paid by every visitor on every
// first paint, even though analytics is DISABLED unless VITE_POSTHOG_KEY is
// configured (it currently is not). The SDK is now loaded lazily, and only
// when a key actually exists. All exported functions keep their signatures.
let posthogModule: typeof import('posthog-js')['default'] | null = null;

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
const isProduction = import.meta.env.PROD;

let initialized = false;

export function initPostHog() {
    if (!POSTHOG_KEY) {
        console.info('[PostHog] No API key configured — analytics disabled.');
        return;
    }

    // Lazy: the SDK loads off the critical path; events fired before it
    // resolves are simply dropped (analytics must never block the app).
    import('posthog-js')
        .then((mod) => {
            const posthog = mod.default;
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
                loaded: () => {
                    posthogModule = posthog;
                    initialized = true;
                    console.info('[PostHog] Analytics initialized.');
                },
            });
            // Fallback in case `loaded` never fires (older SDK versions).
            posthogModule = posthog;
            initialized = true;
        })
        .catch((e) => {
            console.warn('[PostHog] SDK failed to load — analytics stays disabled.', e);
        });
}

/**
 * Track an explicit event.
 *
 * Usage:
 *   import { trackEvent } from '../utils/analytics';
 *   trackEvent('matter_created', { type: 'Civil Litigation', billingModel: 'Retainer' });
 */
export function trackEvent(event: string, properties?: Record<string, any>) {
    if (!initialized || !isProduction || !posthogModule) return;
    try {
        posthogModule.capture(event, properties);
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
    if (!initialized || !isProduction || !posthogModule) return;
    try {
        posthogModule.identify(userId, properties);
    } catch (e) {
        console.warn('[PostHog] Failed to identify user:', e);
    }
}

/**
 * Reset the user identity on logout.
 */
export function resetUser() {
    if (!initialized || !isProduction || !posthogModule) return;
    try {
        posthogModule.reset();
    } catch (e) {
        console.warn('[PostHog] Failed to reset user:', e);
    }
}
