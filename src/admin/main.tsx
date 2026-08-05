/**
 * PracticePro Founder — Platform Control Center
 *
 * Separate entry point for the Founder APK. Uses the same Convex backend
 * and auth system as the consumer app, but only renders founder/management
 * views.
 *
 * AUTH FLOW:
 *   1. User opens the founder APK
 *   2. Splash plays (green → orange → black → FOUNDER) — driven by plain
 *      <script> in admin.html, always dismisses
 *   3. If not logged in → show login/signup screen
 *   4. User logs in (or signs up) → AuthContext resolves their role
 *   5. If role='Founder' → show dashboard with real data
 *   6. If role !== 'Founder' → show "Access Denied" (firm admins can't
 *      access platform data)
 *
 * The splash timeline is driven by a plain <script> in admin.html, so it
 * ALWAYS dismisses (even if React fails to mount).
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
