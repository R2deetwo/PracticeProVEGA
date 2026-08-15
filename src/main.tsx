
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
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "https://keen-jaguar-204.convex.cloud";
if (!CONVEX_URL) {
  throw new Error("[main.tsx] VITE_CONVEX_URL is not set. Add it to your .env file.");
}

// Initialize Client
const convex = new ConvexReactClient(CONVEX_URL);

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


