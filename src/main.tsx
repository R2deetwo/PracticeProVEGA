
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

// ─── Capacitor Android hardware back button ─────────────────────────────
// Without this listener, pressing the Android hardware back button on a
// deep-linked route (e.g., /documents/123 opened via refresh or external
// link) exits the app immediately — because the in-app history array only
// has the current entry, so window.history.back() navigates to whatever
// was before the app (often the home screen or the browser's new-tab page).
//
// This listener:
// 1. Tries to navigate back in the SPA (window.history.back())
// 2. If there's no SPA history to go back to (we're at root), exits the app
//
// Only runs on Capacitor native platforms (Android). iOS doesn't have a
// hardware back button, so this is a no-op there.
(async () => {
    try {
        const isNative = (window as any).Capacitor?.isNativePlatform?.();
        if (!isNative) return;
        const { App: CapacitorApp } = await import('@capacitor/app');
        CapacitorApp.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) {
                window.history.back();
            } else {
                // At root — exit the app
                CapacitorApp.exitApp();
            }
        });
        console.log('[main.tsx] Capacitor backButton listener installed');
    } catch (err) {
        // @capacitor/app not installed or not a native platform — no-op
        console.debug('[main.tsx] Capacitor backButton listener not installed (not native or @capacitor/app missing)');
    }
})();

// --- DATABASE CONNECTION CONFIGURATION ---
// Prefers the environment variable; falls back to the live production instance.
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "https://gregarious-malamute-537.convex.cloud";
if (!CONVEX_URL) {
  throw new Error("[main.tsx] VITE_CONVEX_URL is not set. Add it to your .env file.");
}

// Initialize Client
const convex = new ConvexReactClient(CONVEX_URL);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

console.log("[main.tsx] Starting Root Render...");
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


