/**
 * AdminApp — the shell for the PracticePro Founder APK.
 *
 * MOBILE-OPTIMIZED LAYOUT:
 *   - Bottom nav with 4 primary items + More menu
 *   - Safe area insets for phone notches/status bars
 *   - ErrorBoundary wrapping all views to prevent total app crashes
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

// Lightweight inline ErrorBoundary for admin views
class ViewErrorBoundary extends React.Component<
    { children: React.ReactNode; viewName: string },
    { hasError: boolean; error: any }
> {
    state = { hasError: false, error: null };
    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }
    componentDidCatch(error: any) {
        console.error(`[ViewErrorBoundary:${this.props.viewName}]`, error);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-900 p-8 text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">View Error</h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-xs mb-4">
                        {this.props.viewName} encountered an error. Try navigating away and back.
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700"
                    >
                        Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export type AdminView = 'dashboard' | 'signals' | 'organizations' | 'feedback' | 'broadcast' | 'audit' | 'settings';

export const AdminApp: React.FC = () => {
    const { currentUser, isAuthenticated, isLoadingSession } = useAuth();
    const [activeView, setActiveView] = useState<AdminView>('dashboard');
    const [splashDone, setSplashDone] = useState(false);

    const isFounder = currentUser?.role === UserRole.Founder;
    useFounderSignals({ enabled: isFounder });

    const showSplash = !splashDone || isLoadingSession;

    if (showSplash) {
        return (
            <FounderSplashScreen
                isVisible={true}
                onComplete={() => setSplashDone(true)}
            />
        );
    }

    if (!isAuthenticated || !currentUser) {
        return <AdminLogin />;
    }

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
                    (<span className="text-white font-bold">{currentUser?.email}</span>) is registered as
                    a <span className="text-amber-400 font-bold">{currentUser?.role}</span> account, not a Founder account.
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

    const renderView = () => {
        switch (activeView) {
            case 'dashboard':
                return <ViewErrorBoundary viewName="Dashboard"><FounderDashboard /></ViewErrorBoundary>;
            case 'signals':
                return <ViewErrorBoundary viewName="Signals"><FounderSignals /></ViewErrorBoundary>;
            case 'organizations':
                return <ViewErrorBoundary viewName="Organizations"><OrganizationsCenter /></ViewErrorBoundary>;
            case 'feedback':
                return <ViewErrorBoundary viewName="Feedback"><FeedbackInbox /></ViewErrorBoundary>;
            case 'broadcast':
                return <ViewErrorBoundary viewName="Broadcast"><BroadcastConsole /></ViewErrorBoundary>;
            case 'audit':
                return <ViewErrorBoundary viewName="Audit"><AuditLogs /></ViewErrorBoundary>;
            case 'settings':
                return <ViewErrorBoundary viewName="Settings"><Settings /></ViewErrorBoundary>;
            default:
                return null;
        }
    };

    return (
        <div className="h-[100dvh] flex flex-col bg-slate-50 dark:bg-zinc-900 overflow-hidden">
            <main className="flex-1 overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
                {renderView()}
            </main>
            <FounderBottomNav activeView={activeView} setActiveView={setActiveView} />
        </div>
    );
};
