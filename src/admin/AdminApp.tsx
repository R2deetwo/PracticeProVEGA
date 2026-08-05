/**
 * AdminApp — the shell for the PracticePro Founder APK.
 *
 * MOBILE-OPTIMIZED LAYOUT:
 *   The founder APK uses a BOTTOM NAV (like the consumer app) instead of
 *   a sidebar. This is optimized for portrait mode on phones.
 *
 *   - No sidebar (saves screen space)
 *   - Bottom nav with 6 items: Dashboard, Signals, Firms, Users, Audit, Settings
 *   - Main content fills the full screen with bottom padding for the nav
 *
 * AUTH FLOW:
 *   1. If session is loading → show splash (stays visible)
 *   2. After splash + session resolves:
 *      a. Not authenticated → show AdminLogin
 *      b. Authenticated but role ≠ 'Founder' → show Access Denied
 *      c. Authenticated as Founder → show dashboard with bottom nav
 *
 * ROLE SEPARATION:
 *   - role='Admin'  = firm-level admin (lawyer). Uses the consumer app.
 *   - role='Founder' = platform-level founder. Uses this APK.
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FounderDashboard } from '../components/FounderDashboard';
import { OrganizationsCenter } from './views/OrganizationsCenter';
import { AuditLogs } from './views/AuditLogs';
import { FounderSignals } from './views/FounderSignals';
import { FeedbackInbox } from './views/FeedbackInbox';
import { BroadcastConsole } from './views/BroadcastConsole';
import { AdminLogin } from './AdminLogin';
import { useFounderSignals } from './useFounderSignals';
import FounderSplashScreen from './FounderSplashScreen';
import { FounderBottomNav } from './FounderBottomNav';
import { Settings } from './views/Settings';
import { UserRole } from '../types';

export type AdminView = 'dashboard' | 'signals' | 'organizations' | 'feedback' | 'broadcast' | 'audit' | 'settings';

export const AdminApp: React.FC = () => {
    const { currentUser, isAuthenticated, isLoadingSession } = useAuth();
    const [activeView, setActiveView] = useState<AdminView>('dashboard');
    const [splashDone, setSplashDone] = useState(false);

    // Founder signals (notifications) — only for authenticated Founders
    const isFounder = currentUser?.role === UserRole.Founder;
    useFounderSignals({ enabled: isFounder });

    // The splash stays visible until BOTH:
    //   1. The splash animation has finished playing (splashDone)
    //   2. The auth session has resolved (!isLoadingSession)
    const showSplash = !splashDone || isLoadingSession;

    if (showSplash) {
        return (
            <FounderSplashScreen
                isVisible={true}
                onComplete={() => setSplashDone(true)}
            />
        );
    }

    // Not authenticated → show login/signup
    if (!isAuthenticated || !currentUser) {
        return <AdminLogin />;
    }

    // Authenticated but NOT a Founder → Access Denied
    if (currentUser.role !== UserRole.Founder) {
        return (
            <div className="h-[100dvh] flex flex-col items-center justify-center bg-black text-white p-8 text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h1 className="text-xl font-bold mb-2">Access Denied</h1>
                <p className="text-sm text-zinc-400 max-w-sm mb-1">
                    This is the PracticePro Founder console. Your account
                    (<span className="text-white font-bold">{currentUser.email}</span>) is registered as
                    a <span className="text-amber-400 font-bold">{currentUser.role}</span> account, not a Founder account.
                </p>
                <p className="text-sm text-zinc-500 max-w-sm mt-2">
                    Firm administrators should use the consumer PracticePro app, not the Founder APK.
                </p>
                <button
                    onClick={() => {
                        try { localStorage.removeItem('practicepro_user_session'); } catch {}
                        try { sessionStorage.removeItem('practicepro_user_session'); } catch {}
                        window.location.reload();
                    }}
                    className="mt-6 px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-zinc-200 transition-colors"
                >
                    Log Out
                </button>
            </div>
        );
    }

    // Authenticated as Founder → show dashboard with bottom nav
    return (
        <div className="h-[100dvh] flex flex-col bg-slate-50 dark:bg-zinc-900 overflow-hidden">
            {/* Main content — fills the screen. Views have their own pb-20
                to clear the fixed bottom nav (56px + safe area). */}
            <main className="flex-1 overflow-hidden">
                {activeView === 'dashboard' && <FounderDashboard />}
                {activeView === 'signals' && <FounderSignals />}
                {activeView === 'organizations' && <OrganizationsCenter />}
                {activeView === 'feedback' && <FeedbackInbox />}
                {activeView === 'broadcast' && <BroadcastConsole />}
                {activeView === 'audit' && <AuditLogs />}
                {activeView === 'settings' && <Settings />}
            </main>

            {/* Bottom navigation — fixed at the bottom */}
            <FounderBottomNav activeView={activeView} setActiveView={setActiveView} />
        </div>
    );
};
