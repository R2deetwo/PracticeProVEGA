
import * as React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { AppProvider } from './contexts/AppProvider';

import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import ConvexErrorBoundary from './components/ConvexErrorBoundary';
import App from './components/App';
import { initSentry } from './utils/sentry';
import { initPostHog } from './utils/analytics';

// ─── Initialize crash reporting + analytics BEFORE anything else ────────
initSentry();
initPostHog();

// ─── Global unhandled promise rejection handler ─────────────────────────
// Safari/iOS shows "Application Error" and resets the app when a promise
// rejection is unhandled. This catches ALL unhandled rejections and logs
// them silently instead of crashing the app.
window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason);
    event.preventDefault(); // Prevents the "Application Error" crash
});

// --- DATABASE CONNECTION CONFIGURATION ---
// Prefers the environment variable; falls back to the live production instance.
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "https://gregarious-malamute-537.convex.cloud";
if (!CONVEX_URL) {
  throw new Error("[main.tsx] VITE_CONVEX_URL is not set. Add it to your .env file.");
}

// Initialize Client
//
// unsavedChangesWarning: false — Task-74 sign-out "Leave site?" fix (2026-11-22).
// By default the Convex client registers a `beforeunload` listener that
// calls preventDefault (→ the browser's native "Leave site? / Changes you
// may not be saved" dialog) whenever ANY mutation is still in flight.
// logout() fires revokeSessionMutation + the User Logout tracking mutation
// and then hard-navigates 200ms later (window.location.replace) — those
// mutations are still in flight at that moment, so EVERY sign-out showed
// the native dialog over the already-client-side-rendered landing page
// (the "it's already been left" phantom question the owner reported).
// Our own suppression (AuthContext's __suppressBeforeUnload flag +
// removeAllBeforeUnloadGuards) cannot reach this listener — it is Convex's,
// registered at construction, outside our registry.
//
// Disabling it is the documented option for apps that manage their own
// unsaved-changes UX, which this app does: DraftPro's dirty-state guard
// (installBeforeUnloadGuard) still intercepts tab close / refresh with
// unsaved documents, and intentional hard navigations (sign-out, inactivity
// logout, revoked-session redirect, payment-gateway handoff) no longer
// trigger a dialog that protects nothing — the in-flight mutations are
// abandoned by the navigation either way, and the session revoke is
// guaranteed by logout()'s sendBeacon fallback, which survives unload.
const convex = new ConvexReactClient(CONVEX_URL, { unsavedChangesWarning: false });

// ─── Native reply endpoint discovery (WhatsApp-grade push, 2026-09-14) ────
// PushReplyReceiver (Android) POSTs notification-shade replies to
// <convexUrl>/api/push-reply. The native side can't read VITE_CONVEX_URL,
// so we persist it once per boot into @capacitor/preferences (SharedPreferences
// "CapacitorStorage") where the receiver reads it. Web/no-op safe.
try {
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
    import('@capacitor/preferences').then(({ Preferences }) =>
      Preferences.set({ key: 'pp_convex_url', value: CONVEX_URL })
    ).catch(() => {});
  }
} catch { /* never block boot on this */ }

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

import { BrowserRouter } from 'react-router-dom';

root.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <ConvexProvider client={convex}>
        <ConvexErrorBoundary>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppProvider>
              <App />
            </AppProvider>
          </BrowserRouter>
        </ConvexErrorBoundary>
      </ConvexProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);


