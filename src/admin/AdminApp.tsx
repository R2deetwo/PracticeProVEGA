/**
 * AdminApp — the shell for the PracticePro Founder APK.
 *
 * AUTH FLOW:
 *   1. If session is loading → render nothing (splash is still visible,
 *      driven by plain <script> in admin.html)
 *   2. If not authenticated → show AdminLogin (login/signup)
 *   3. If authenticated but role !== 'Founder' → show "Access Denied"
 *      (prevents firm-level Admins from seeing platform data)
 *   4. If authenticated and role === 'Founder' → show dashboard
 *
 * ROLE SEPARATION:
 *   - role='Admin'  = firm-level admin (lawyer). Uses the consumer app.
 *   - role='Founder' = platform-level founder. Uses this APK.
 *   A firm admin who downloads this APK gets "Access Denied".
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AdminSidebar } from './AdminSidebar';
import { FounderDashboard } from '../components/FounderDashboard';
import { FirmManagement } from './views/FirmManagement';
import { UserManagement } from './views/UserManagement';
import { AuditLogs } from './views/AuditLogs';
import { FounderSignals } from './views/FounderSignals';
import { AdminLogin } from './AdminLogin';
import { UserRole } from '../types';

export type AdminView = 'dashboard' | 'signals' | 'firms' | 'users' | 'audit' | 'settings';

export const AdminApp: React.FC = () => {
    const { currentUser, isAuthenticated, isLoadingSession } = useAuth();
    const [activeView, setActiveView] = useState<AdminView>('dashboard');

    // While session is loading, render nothing — the HTML splash is
    // still visible (driven by plain <script> in admin.html).
    if (isLoadingSession) {
        return null;
    }

    // Not authenticated → show login/signup
    if (!isAuthenticated || !currentUser) {
        return <AdminLogin />;
    }

    // Authenticated but NOT a Founder → Access Denied
    // This prevents firm-level Admins (lawyers) from accessing platform data
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

    // Authenticated as Founder → show the dashboard
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
