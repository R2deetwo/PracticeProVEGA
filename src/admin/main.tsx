/**
 * PracticePro Founder — Platform Control Center
 *
 * Separate entry point for the Founder APK. Does NOT use AuthContext
 * — the founder APK has no auth. It renders the admin shell immediately
 * with a hardcoded founder user.
 *
 * The splash screen is driven by a plain <script> in admin.html, so it
 * ALWAYS dismisses (even if React fails to mount).
 *
 * The Convex queries in FounderDashboard etc. use a hardcoded
 * tokenIdentifier. To get real data, change that email to your actual
 * admin email and ensure the user exists in the Convex users table
 * with role='Admin'.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
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
      <UIProvider>
        <AppProvider>
          <AdminApp />
        </AppProvider>
      </UIProvider>
    </ConvexProvider>
  </React.StrictMode>
);
