/**
 * PracticePro Founder — Platform Control Center
 *
 * Separate entry point for the Founder APK. Uses the same Convex backend
 * and auth system as the consumer app, but only renders founder/management
 * views.
 *
 * CRITICAL: UIContext uses useNavigate() and useLocation() from
 * react-router-dom, which requires a <BrowserRouter> ancestor. Without
 * it, the entire app crashes on mount and nothing renders.
 *
 * AUTH FLOW:
 *   1. User opens the founder APK
 *   2. Splash plays (green → orange → black → FOUNDER) — React component
 *   3. If not logged in → show login/signup screen
 *   4. User logs in (or signs up) → AuthContext resolves their role
 *   5. If role='Founder' → show dashboard with real data
 *   6. If role !== 'Founder' → show "Access Denied"
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { UIProvider } from '../contexts/UIContext';
import { AppProvider } from '../contexts/AppProvider';
import GlobalErrorBoundary from '../components/GlobalErrorBoundary';
import ConvexErrorBoundary from '../components/ConvexErrorBoundary';
import { AdminApp } from './AdminApp';
import '../index.css';

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "https://gregarious-malamute-537.convex.cloud";
const convex = new ConvexReactClient(CONVEX_URL);

// ─── Global unhandled promise rejection handler ─────────────────────
// Prevents "Application Error" crashes from unhandled promise rejections.
window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason);
    event.preventDefault();
});

const container = document.getElementById('admin-root');
if (!container) {
    throw new Error("Could not find #admin-root element to mount to");
}
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <ConvexProvider client={convex}>
        <ConvexErrorBoundary>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
              <UIProvider>
                <AppProvider>
                  <AdminApp />
                </AppProvider>
              </UIProvider>
            </AuthProvider>
          </BrowserRouter>
        </ConvexErrorBoundary>
      </ConvexProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
