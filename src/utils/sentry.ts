/**
 * Sentry Crash Reporting Initialization
 * ─────────────────────────────────────────────────────────────────────────────
 * Captures production crashes and errors so the development team can see
 * what's breaking for real users. In development mode, Sentry is disabled
 * (errors show in the browser console instead).
 *
 * SETUP:
 * 1. Create a free account at https://sentry.io
 * 2. Create a new project → select "React" → get the DSN
 * 3. Set the DSN as a Vercel/env variable: SENTRY_DSN
 *    (or hardcode it below if you prefer — DSNs are safe to expose)
 * 4. Errors will now flow to your Sentry dashboard automatically
 *
 * The GlobalErrorBoundary will also report to Sentry automatically via
 * the componentDidCatch lifecycle (wired below in ErrorBoundary integration).
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

const isProduction = import.meta.env.PROD;

export function initSentry() {
    if (!SENTRY_DSN) {
        console.info('[Sentry] No DSN configured — crash reporting disabled.');
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        enabled: isProduction,
        environment: import.meta.env.MODE,
        // Performance monitoring — samples 10% of transactions to keep costs low
        tracesSampleRate: 0.1,
        // Session replay — disabled to protect user privacy (legal/financial data)
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        // Ignore common non-actionable errors
        ignoreErrors: [
            // Browser extension noise
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications',
            // Network blips that users can't act on
            'Network request failed',
            'Failed to fetch',
            // Convex auth reconnection (not a real crash)
            'Unauthenticated',
        ],
        integrations: [
            Sentry.browserTracingIntegration(),
        ],
    });

    console.info('[Sentry] Crash reporting initialized.');
}

/**
 * Manually capture an error — use in catch blocks where you want to
 * report the error to Sentry even if it doesn't crash the app.
 *
 * Usage:
 *   import { captureError } from './utils/sentry';
 *   catch (err) {
 *       captureError(err, { context: 'createMatter', userId: currentUser.id });
 *       addToast('Something went wrong.', { type: 'error' });
 *   }
 */
export function captureError(err: any, context?: Record<string, any>) {
    if (!SENTRY_DSN || !isProduction) return;
    Sentry.captureException(err, {
        extra: context,
    });
}

/**
 * Set the current user context so Sentry shows who experienced the crash.
 * Call this after login.
 */
export function setSentryUser(user: { id: string; email?: string; name?: string }) {
    if (!SENTRY_DSN || !isProduction) return;
    Sentry.setUser(user);
}

/**
 * Clear the user context on logout.
 */
export function clearSentryUser() {
    if (!SENTRY_DSN || !isProduction) return;
    Sentry.setUser(null);
}
