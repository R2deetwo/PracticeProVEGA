/**
 * PracticePro Admin — Platform Control Center
 *
 * Separate entry point for the admin APK. Shares the same Convex backend
 * and auth system as the main app, but only renders admin/management views.
 *
 * This is the CRM for managing your users/customers (firms, subscriptions,
 * user accounts, billing, audit logs, platform metrics).
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
