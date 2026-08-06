/**
 * AdminApp — the shell for the PracticePro Founder APK.
 *
 * SELF-CONTAINED: Does NOT use the consumer app's AuthProvider,
 * UIProvider, or AppProvider. Those providers require firmId,
 * react-router navigation, sidebar state, and other consumer-app
 * concepts that crash for Founder users (who have no firm).
 *
 * Instead, this app has its own lightweight auth + toast system
 * that works independently.
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
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
import { FirmHealth } from './views/FirmHealth';
import { SystemStatus } from './views/SystemStatus';
import { ExportCenter } from './views/ExportCenter';

// ─── Lightweight Auth Context (no firmId dependency) ─────────────────
interface FounderUser {
    id: string;
    _id?: string;
    email: string;
    name: string;
    role: string;
    tokenIdentifier: string;
}

interface FounderAuthContextType {
    currentUser: FounderUser | null;
    isAuthenticated: boolean;
    isLoadingSession: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    logout: () => void;
}

const FounderAuthContext = createContext<FounderAuthContextType>({
    currentUser: null,
    isAuthenticated: false,
    isLoadingSession: true,
    login: async () => ({ success: false }),
    logout: () => {},
});

export const useFounderAuth = () => useContext(FounderAuthContext);

// ─── Lightweight Toast Context ──────────────────────────────────────
interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

const ToastContext = createContext<{ addToast: (msg: string, opts?: { type?: Toast['type'] }) => void }>({
    addToast: () => {},
});

export const useFounderToast = () => useContext(ToastContext);

// ─── View Error Boundary ────────────────────────────────────────────
class ViewErrorBoundary extends React.Component<
    { children: React.ReactNode; viewName: string },
    { hasError: boolean }
> {
    state = { hasError: false };
    static getDerivedStateFromError() { return { hasError: true }; }
    componentDidCatch(error: any) { console.error(`[ViewErrorBoundary:${this.props.viewName}]`, error); }
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
                    <button onClick={() => this.setState({ hasError: false })} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700">Retry</button>
                </div>
            );
        }
        return this.props.children;
    }
}

export type AdminView = 'dashboard' | 'signals' | 'organizations' | 'feedback' | 'broadcast' | 'audit' | 'settings' | 'health' | 'system' | 'export';

const FounderApp: React.FC = () => {
    const [activeView, setActiveView] = useState<AdminView>('dashboard');
    const [splashDone, setSplashDone] = useState(false);
    const { currentUser, isAuthenticated, isLoadingSession } = useFounderAuth();

    const isFounder = currentUser?.role === 'Founder';
    useFounderSignals({ enabled: isFounder });

    const showSplash = !splashDone || isLoadingSession;

    if (showSplash) {
        return <FounderSplashScreen isVisible={true} onComplete={() => setSplashDone(true)} />;
    }

    if (!isAuthenticated || !currentUser) {
        return <AdminLogin />;
    }

    if (currentUser.role !== 'Founder') {
        return (
            <div className="h-[100dvh] flex flex-col items-center justify-center bg-black text-white p-8 text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h1 className="text-xl font-bold mb-2">Access Denied</h1>
                <p className="text-sm text-zinc-400 max-w-sm mb-1">
                    Your account (<span className="text-white font-bold">{currentUser.email}</span>) is registered as
                    a <span className="text-amber-400 font-bold">{currentUser.role}</span> account, not a Founder account.
                </p>
                <p className="text-sm text-zinc-500 max-w-sm mt-2">
                    Firm administrators should use the consumer PracticePro app.
                </p>
                <button
                    onClick={() => {
                        try { localStorage.removeItem('practicepro_user_session'); } catch {}
                        try { sessionStorage.removeItem('practicepro_user_session'); } catch {}
                        window.location.reload();
                    }}
                    className="mt-6 px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-zinc-200 transition-colors"
                >Log Out</button>
            </div>
        );
    }

    const renderView = () => {
        switch (activeView) {
            case 'dashboard': return <ViewErrorBoundary viewName="Dashboard"><FounderDashboard /></ViewErrorBoundary>;
            case 'signals': return <ViewErrorBoundary viewName="Signals"><FounderSignals /></ViewErrorBoundary>;
            case 'organizations': return <ViewErrorBoundary viewName="Organizations"><OrganizationsCenter /></ViewErrorBoundary>;
            case 'feedback': return <ViewErrorBoundary viewName="Feedback"><FeedbackInbox /></ViewErrorBoundary>;
            case 'broadcast': return <ViewErrorBoundary viewName="Broadcast"><BroadcastConsole /></ViewErrorBoundary>;
            case 'audit': return <ViewErrorBoundary viewName="Audit"><AuditLogs /></ViewErrorBoundary>;
            case 'settings': return <ViewErrorBoundary viewName="Settings"><Settings /></ViewErrorBoundary>;
            case 'health': return <ViewErrorBoundary viewName="Health"><FirmHealth /></ViewErrorBoundary>;
            case 'system': return <ViewErrorBoundary viewName="System"><SystemStatus /></ViewErrorBoundary>;
            case 'export': return <ViewErrorBoundary viewName="Export"><ExportCenter /></ViewErrorBoundary>;
            default: return null;
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

// ─── Auth Provider (lightweight, no firmId) ─────────────────────────
const FounderAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const convexClient = useConvex();
    const [sessionToken, setSessionToken] = useState<string | null>(() => {
        try {
            const stored = localStorage.getItem('practicepro_user_session');
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.token || null;
            }
            return sessionStorage.getItem('practicepro_user_session')
                ? JSON.parse(sessionStorage.getItem('practicepro_user_session')!).token
                : null;
        } catch { return null; }
    });

    const userData = useQuery(api.myFunctions.getUser,
        sessionToken ? { tokenIdentifier: sessionToken } : "skip");

    const currentUser: FounderUser | null = React.useMemo(() => {
        if (!userData) return null;
        return {
            id: (userData as any)._id || (userData as any).id || '',
            _id: (userData as any)._id,
            email: (userData as any).email || sessionToken || '',
            name: (userData as any).name || 'Founder',
            role: (userData as any).role || 'Unknown',
            tokenIdentifier: sessionToken || '',
        };
    }, [userData, sessionToken]);

    const login = useCallback(async (email: string, password: string) => {
        try {
            // Use the existing Convex client from the provider
            const result: any = await convexClient.action(api.myFunctions.verifyLogin, {
                email: email.toLowerCase().trim(),
                passwordHash: "",
                rawPassword: password,
            });

            if (!result || !result.success) {
                return { success: false, message: result?.message || 'Invalid email or password.' };
            }

            // Set session
            const token = email.toLowerCase().trim();
            const sessionData = JSON.stringify({ token });
            try { localStorage.setItem('practicepro_user_session', sessionData); } catch {}
            try { sessionStorage.setItem('practicepro_user_session', sessionData); } catch {}
            setSessionToken(token);
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e?.message || 'Login failed. Please try again.' };
        }
    }, [convexClient]);

    const logout = useCallback(() => {
        try { localStorage.removeItem('practicepro_user_session'); } catch {}
        try { sessionStorage.removeItem('practicepro_user_session'); } catch {}
        setSessionToken(null);
    }, []);

    return (
        <FounderAuthContext.Provider value={{
            currentUser,
            isAuthenticated: !!currentUser,
            isLoadingSession: sessionToken && !userData ? true : false,
            login,
            logout,
        }}>
            {children}
        </FounderAuthContext.Provider>
    );
};

// ─── Toast Provider ─────────────────────────────────────────────────
const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, opts?: { type?: Toast['type'] }) => {
        const id = Date.now() + Math.random();
        const type = opts?.type || 'info';
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            {/* Toast container */}
            <div className="fixed top-4 right-4 z-[9999] space-y-2" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
                {toasts.map(t => (
                    <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm font-bold animate-slide-in-up ${
                        t.type === 'success' ? 'bg-emerald-600 text-white' :
                        t.type === 'error' ? 'bg-red-600 text-white' :
                        'bg-slate-800 text-white'
                    }`}>
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

// ─── Main Export ────────────────────────────────────────────────────
export const AdminApp: React.FC = () => {
    return (
        <FounderAuthProvider>
            <ToastProvider>
                <FounderApp />
            </ToastProvider>
        </FounderAuthProvider>
    );
};
