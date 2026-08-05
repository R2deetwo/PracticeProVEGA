/**
 * AdminSidebar — navigation for the PracticePro Founder APK.
 * Dark-themed, compact sidebar with founder-only navigation items.
 *
 * Uses a hardcoded founder user — does NOT depend on AuthContext.
 * This ensures the sidebar always renders, even if Convex is unreachable.
 */

import React from 'react';
import type { AdminView } from './AdminApp';

interface AdminSidebarProps {
    activeView: AdminView;
    setActiveView: (v: AdminView) => void;
}

// Hardcoded founder user — no AuthContext dependency
const FOUNDER_USER = {
    name: 'Founder',
    email: 'founder@practicepro.ng',
};

const NAV_ITEMS: { id: AdminView; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'signals', label: 'Signals', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
    { id: 'firms', label: 'Firms', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { id: 'users', label: 'Users', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'audit', label: 'Audit Logs', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeView, setActiveView }) => {
    const handleLogout = () => {
        try { localStorage.removeItem('practicepro_user_session'); } catch {}
        window.location.reload();
    };

    return (
        <aside className="w-16 sm:w-60 flex-shrink-0 bg-slate-900 dark:bg-black flex flex-col h-full border-r border-slate-800">
            {/* Logo — black mark is the standard for the Founder App */}
            <div className="flex-shrink-0 p-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white font-black text-sm flex-shrink-0 border border-zinc-700">
                        P
                    </div>
                    <div className="hidden sm:block min-w-0">
                        <p className="text-sm font-black text-white tracking-tight">PracticePro</p>
                        <p className="text-2xs text-zinc-500 font-bold uppercase tracking-widest">Founder</p>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                {NAV_ITEMS.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveView(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                            activeView === item.id
                                ? 'bg-primary-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                        </svg>
                        <span className="hidden sm:block truncate">{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* User */}
            <div className="flex-shrink-0 p-3 border-t border-slate-800">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {FOUNDER_USER.name?.charAt(0) || 'F'}
                    </div>
                    <div className="hidden sm:block min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{FOUNDER_USER.name}</p>
                        <p className="text-2xs text-slate-500 truncate">{FOUNDER_USER.email}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors flex-shrink-0"
                        title="Log out"
                        aria-label="Log out"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                        </svg>
                    </button>
                </div>
            </div>
        </aside>
    );
};
