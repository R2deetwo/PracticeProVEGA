/**
 * PracticePro Founder — Platform Control Center
 *
 * Separate entry point for the Founder APK. Shares the same Convex backend
 * and auth system as the main app, but only renders founder/management views.
 *
 * NO AUTH REQUIRED:
 *   The founder APK auto-logs in as a demo founder user. This is intentional —
 *   the founder is the only person who downloads this APK, so requiring a
 *   login screen is pointless friction. The session token is written to
 *   localStorage BEFORE React mounts, so AuthContext picks it up from
 *   getInitialToken() and skips the login screen entirely.
 *
 *   The real security boundary is server-side: Convex's requireAdmin() checks
 *   the tokenIdentifier against the users table. If the demo email doesn't
 *   exist as an Admin in the DB, founder metrics queries will return an
 *   authorization error (but the app will still load).
 *
 *   To use a real admin account, change FOUNDER_DEMO_EMAIL below to the
 *   actual admin email and ensure that user exists in the Convex users
 *   table with role='Admin'.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { AuthProvider } from '../contexts/AuthContext';
import { UIProvider } from '../contexts/UIContext';
import { AppProvider } from '../contexts/AppProvider';
import { AdminApp } from './AdminApp';
import '../index.css';

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "https://gregarious-malamute-537.convex.cloud";
const convex = new ConvexReactClient(CONVEX_URL);

// ─── AUTO-LOGIN (no auth required) ───────────────────────────────────
// Write the founder demo session to localStorage BEFORE React mounts.
// AuthContext's getInitialToken() will read this and skip the login screen.
//
// Change this email to a real admin email if you want server-side admin
// queries to work (the user must exist in the Convex users table with
// role='Admin').
const FOUNDER_DEMO_EMAIL = 'founder@practicepro.ng';
const SESSION_KEY = 'practicepro_user_session';

try {
    if (!localStorage.getItem(SESSION_KEY) && !sessionStorage.getItem(SESSION_KEY)) {
        const sessionData = JSON.stringify({
            token: FOUNDER_DEMO_EMAIL,
            timestamp: Date.now(),
        });
        localStorage.setItem(SESSION_KEY, sessionData);
        sessionStorage.setItem(SESSION_KEY, sessionData);
    }
} catch (e) {
    console.warn('[Founder APK] Could not set demo session:', e);
}

const container = document.getElementById('admin-root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <AuthProvider>
        <UIProvider>
          <AppProvider>
            <AdminApp />
          </AppProvider>
        </UIProvider>
      </AuthProvider>
    </ConvexProvider>
  </React.StrictMode>
);
