/**
 * AdminApp — the shell for the PracticePro Admin APK.
 *
 * Shows a login screen if not authenticated, then renders the admin
 * sidebar + content area with admin-only views.
 *
 * Only Admin role users can access this app. Non-admin users see an
 * "Access Denied" screen.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { AdminSidebar } from './AdminSidebar';
import { FounderDashboard } from '../components/FounderDashboard';
import { FirmManagement } from './views/FirmManagement';
import { UserManagement } from './views/UserManagement';
import { AuditLogs } from './views/AuditLogs';
import { FounderSignals } from './views/FounderSignals';
import { AdminLogin } from './AdminLogin';
import { useFounderSignals } from './useFounderSignals';

export type AdminView = 'dashboard' | 'signals' | 'firms' | 'users' | 'audit' | 'settings';

/**
 * dismissFounderSplash
 * Fades out the #founder-splash overlay that lives in admin.html.
 * Safe to call multiple times — once the splash is gone, this is a no-op.
 * The splash lives in admin.html ONLY — the consumer app (index.html) is
 * untouched and shows its normal loading screen.
 */
function dismissFounderSplash() {
    try {
        const splash = document.getElementById('founder-splash');
        if (!splash || splash.classList.contains('hidden')) return;
        splash.classList.add('hidden');
        // Remove from DOM after the fade-out transition so it can't intercept touches
        window.setTimeout(() => { try { splash.remove(); } catch {} }, 500);
    } catch {}
}

export const AdminApp: React.FC = () => {
    const { currentUser, isAuthenticated, isLoadingSession } = useAuth();
    const [activeView, setActiveView] = useState<AdminView>('dashboard');

    // ─── Founder signals (new users / churn / scaling / per-product) ───
    // Polls the backend every 5 min and fires LOCAL notifications when
    // there's something new the founder should know about. Only admins
    // get these — non-admins see the Access Denied screen below.
    const isFounder = currentUser?.role === 'Admin';
    useFounderSignals({ enabled: isFounder });

    // Dismiss the splash as soon as we KNOW what to render — whether
    // that's the login screen, access-denied, or the dashboard. This
    // guarantees the splash is gone before any interactive UI shows.
    useEffect(() => {
        if (!isLoadingSession) dismissFounderSplash();
    }, [isLoadingSession]);

    // Safety net: if the auth check drags on (rare), still drop the splash
    // after 4s so the founder is never stuck staring at the black screen.
    useEffect(() => {
        const t = window.setTimeout(dismissFounderSplash, 4000);
        return () => window.clearTimeout(t);
    }, []);

    // Show loading spinner while session is being restored
    if (isLoadingSession) {
        return (
            <div className="h-[100dvh] flex items-center justify-center bg-black">
                <div className="w-10 h-10 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    // Show login screen if not authenticated
    if (!isAuthenticated || !currentUser) {
        return <AdminLogin />;
    }

    // Block non-admin users
    if (currentUser.role !== 'Admin') {
        return (
            <div className="h-[100dvh] flex flex-col items-center justify-center bg-black text-white p-8 text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h1 className="text-xl font-bold mb-2">Access Denied</h1>
                <p className="text-sm text-zinc-400 max-w-sm">This is the PracticePro Founder console. You need founder privileges to access this app. Please log in with a founder account.</p>
                <button
                    onClick={() => { try { localStorage.removeItem('practicepro_user_session'); } catch {} window.location.reload(); }}
                    className="mt-6 px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-zinc-200 transition-colors"
                >
                    Log Out
                </button>
            </div>
        );
    }

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
