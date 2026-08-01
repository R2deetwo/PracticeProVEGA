/**
 * AdminApp — the shell for the PracticePro Admin APK.
 *
 * Shows a login screen if not authenticated, then renders the admin
 * sidebar + content area with admin-only views.
 *
 * Only Admin role users can access this app. Non-admin users see an
 * "Access Denied" screen.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { AdminSidebar } from './AdminSidebar';
import { FounderDashboard } from '../components/FounderDashboard';
import { FirmManagement } from './views/FirmManagement';
import { UserManagement } from './views/UserManagement';
import { AuditLogs } from './views/AuditLogs';
import { AdminLogin } from './AdminLogin';

export type AdminView = 'dashboard' | 'firms' | 'users' | 'audit' | 'settings';

export const AdminApp: React.FC = () => {
    const { currentUser, isAuthenticated, isLoadingSession } = useAuth();
    const [activeView, setActiveView] = useState<AdminView>('dashboard');

    // Show loading spinner while session is being restored
    if (isLoadingSession) {
        return (
            <div className="h-[100dvh] flex items-center justify-center bg-slate-900">
                <div className="w-10 h-10 border-2 border-slate-600 border-t-primary-500 rounded-full animate-spin" />
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
            <div className="h-[100dvh] flex flex-col items-center justify-center bg-slate-900 text-white p-8 text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h1 className="text-xl font-bold mb-2">Access Denied</h1>
                <p className="text-sm text-slate-400 max-w-sm">This is the PracticePro Admin console. You need administrator privileges to access this app. Please log in with an admin account.</p>
                <button
                    onClick={() => { try { localStorage.removeItem('practicepro_user_session'); } catch {} window.location.reload(); }}
                    className="mt-6 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-bold hover:bg-slate-600 transition-colors"
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
