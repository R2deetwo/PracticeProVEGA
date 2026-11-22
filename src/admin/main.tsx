/**
 * PracticePro Founder — Platform Control Center
 *
 * Uses a MINIMAL provider stack — NOT the full consumer app's
 * AuthProvider/UIProvider/AppProvider (which require firmId,
 * navigate, sidebar, etc. and crash for Founder users who have no firm).
 *
 * The founder app has its own lightweight auth + UI context that
 * doesn't depend on firmId or react-router navigation.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminApp } from './AdminApp';
import '../index.css';

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "https://gregarious-malamute-537.convex.cloud";
// unsavedChangesWarning: false — Task-74 sign-out "Leave site?" fix (2026-11-22) (see
// src/main.tsx for the full rationale): the default Convex beforeunload
// listener turns any hard navigation with a mutation in flight into the
// browser's native "Leave site?" dialog over the page you were already
// leaving. The founder console signs out via its own logout() followed by
// window.location.reload() — with this console's mutations (ingestion,
// security center, engine pacing) routinely in flight, the same phantom
// dialog fires here too.
const convex = new ConvexReactClient(CONVEX_URL, { unsavedChangesWarning: false });

// Global unhandled promise rejection handler
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
    <ConvexProvider client={convex}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminApp />
      </BrowserRouter>
    </ConvexProvider>
  </React.StrictMode>
);
// trigger
