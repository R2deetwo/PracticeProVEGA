/**
 * AdminApp — the shell for the PracticePro Founder APK.
 *
 * NO AUTH REQUIRED — ALWAYS RENDERS:
 *   The founder APK does NOT depend on AuthContext or Convex to render
 *   the app shell. It uses a hardcoded founder user object and renders
 *   the sidebar + content area IMMEDIATELY on mount.
 *
 *   This fixes the "stuck on splash" bug where the app rendered nothing
 *   (null) while waiting for AuthContext to resolve the demo user from
 *   Convex — which never happened because the demo email wasn't in the
 *   users table.
 *
 *   Now, the app shell renders instantly. Individual views (FounderDashboard,
 *   FounderSignals, etc.) handle their own Convex query loading/error states.
 *   If the Convex queries fail (because the demo user isn't an admin in
 *   the DB), the views show a friendly message instead of crashing.
 *
 * SPLASH SCREEN:
 *   The splash timeline is driven by a plain <script> in admin.html —
 *   NOT React. This guarantees the splash ALWAYS dismisses, even if
 *   React completely fails to mount.
 */

import React, { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { FounderDashboard } from '../components/FounderDashboard';
import { FirmManagement } from './views/FirmManagement';
import { UserManagement } from './views/UserManagement';
import { AuditLogs } from './views/AuditLogs';
import { FounderSignals } from './views/FounderSignals';

export type AdminView = 'dashboard' | 'signals' | 'firms' | 'users' | 'audit' | 'settings';

/**
 * Hardcoded founder user. This is used for the sidebar display and
 * passed as tokenIdentifier to Convex queries.
 *
 * To use a real admin account, change this email to your actual admin
 * email and ensure that user exists in the Convex users table with
 * role='Admin'. The server-side requireAdmin() check will verify it.
 */
const FOUNDER_USER = {
    name: 'Founder',
    email: 'founder@practicepro.ng',
    role: 'Admin' as const,
    tokenIdentifier: 'founder@practicepro.ng',
};

export const AdminApp: React.FC = () => {
    const [activeView, setActiveView] = useState<AdminView>('dashboard');

    // ALWAYS render the app shell. Never return null.
    // The splash is dismissed by a plain <script> in admin.html,
    // so we don't need to coordinate with it here.
    return (
        <div className="h-[100dvh] flex bg-slate-50 dark:bg-zinc-900 overflow-hidden">
            <AdminSidebar activeView={activeView} setActiveView={setActiveView} />
            <main className="flex-1 overflow-hidden min-w-0">
                {activeView === 'dashboard' && <FounderDashboard />}
                {activeView === 'signals' && <FounderSignals />}
                {activeView === 'firms' && <FirmManagement />}
                {activeView === 'users' && <UserManagement />}
                {activeView === 'audit' && <AuditLogs />}
                {activeView === 'settings' && (
                    <div className="h-full flex items-center justify-center text-slate-400 p-8">
                        <p className="text-sm">Platform settings coming soon.</p>
                    </div>
                )}
            </main>
        </div>
    );
};
