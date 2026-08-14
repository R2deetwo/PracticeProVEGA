/**
 * FounderBottomNav — 4 primary items + More menu.
 * Settings, Audit, Broadcast are in the More menu.
 *
 * CRO AUDIT Track A — added Subscriptions view to More menu with a live
 * pending-count badge so the founder can see at a glance when there are
 * upgrade requests waiting for approval.
 *
 * DEFENSIVE QUERY PATTERN: the pending-count badge uses useConvex() +
 * useEffect + try/catch instead of useQuery(). This is critical because
 * the new founderMetrics mutations (getSubscriptionRequestStats) require
 * a Convex deploy to exist on the backend. Until the deploy runs, useQuery
 * would throw synchronously and crash the ENTIRE founder app (black screen).
 * With the defensive pattern, the badge simply stays at 0 until the backend
 * is deployed — the nav bar always renders.
 */

import React, { useState, useEffect } from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useFounderAuth } from './FounderContexts';
import type { AdminView } from './AdminApp';

interface NavItem {
    view: AdminView;
    label: string;
    icon: React.ReactElement;
}

const NAV_ITEMS: NavItem[] = [
    {
        view: 'dashboard',
        label: 'Dashboard',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        view: 'organizations',
        label: 'Orgs',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        ),
    },
    {
        view: 'feedback',
        label: 'Feedback',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
        ),
    },
    {
        view: 'notifications',
        label: 'Alerts',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
        ),
    },
];

const MORE_ITEMS: NavItem[] = [
    {
        view: 'subscriptions',
        label: 'Subscriptions',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
        ),
    },
    {
        view: 'financials',
        label: 'Financials',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V14.25m1.5 0v-.375c0-.621.504-1.125 1.125-1.125H21a.75.75 0 01.75.75v.375m0 0V9.75M3.75 14.25V9.75" />
            </svg>
        ),
    },
    {
        view: 'sales',
        label: 'Sales',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" />
            </svg>
        ),
    },
    {
        view: 'broadcast',
        label: 'Broadcast',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84a3 3 0 100-5.68 3 3 0 000 5.68zM7.51 7.34a6 6 0 018.98 0M4.66 4.49a10 10 0 0114.69 0M2.81 1.64a15 15 0 0118.38 0" />
            </svg>
        ),
    },
    {
        view: 'audit',
        label: 'Audit Logs',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        ),
    },
    {
        view: 'system',
        label: 'System Status',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
        ),
    },
    {
        view: 'export',
        label: 'Export CSV',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
        ),
    },
    {
        view: 'analytics',
        label: 'Analytics',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
        ),
    },
    {
        view: 'settings',
        label: 'Settings',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
    {
        view: 'security',
        label: 'Security',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
        ),
    },
    {
        view: 'aloaUsage',
        label: 'AI Usage',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
        ),
    },
];

const MoreIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
);

interface FounderBottomNavProps {
    activeView: AdminView;
    setActiveView: (v: AdminView) => void;
}

export const FounderBottomNav: React.FC<FounderBottomNavProps> = ({ activeView, setActiveView }) => {
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const isMoreActive = MORE_ITEMS.some(item => item.view === activeView);

    // CRO AUDIT Track A — fetch pending subscription request count for the
    // badge on the Subscriptions nav item.
    //
    // DEFENSIVE: use useConvex() + useEffect + try/catch (NOT useQuery).
    // The new founderMetrics.getSubscriptionRequestStats mutation requires
    // a Convex deploy to exist on the backend. Until then, useQuery would
    // throw synchronously and crash the entire founder app (black screen).
    // With this pattern, the badge stays at 0 until the backend is deployed.
    const { currentUser } = useFounderAuth();
    const convex = useConvex();
    const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';
    const [pendingCount, setPendingCount] = useState(0);
    const [expiringSoon, setExpiringSoon] = useState(0);
    const [newSignupCount, setNewSignupCount] = useState(0);

    // Shared badge formatter — caps at "9+" for counts > 9
    const formatBadgeCount = (count: number): string | null => {
        if (count <= 0) return null;
        return count > 9 ? '9+' : count.toString();
    };

    useEffect(() => {
        if (!tokenIdentifier || !convex) return;
        let cancelled = false;
        const fetchStats = async () => {
            try {
                const stats = await convex.query(api.founderMetrics.getSubscriptionRequestStats, { tokenIdentifier });
                if (!cancelled) {
                    setPendingCount(stats?.pending || 0);
                    setExpiringSoon(stats?.expiringSoon || 0);
                }
            } catch (e: any) {
                console.warn('[FounderBottomNav] getSubscriptionRequestStats failed (backend may not be deployed yet):', e?.message || e);
            }
            // Also fetch new signup count (users registered in last 24h)
            try {
                const alerts = await convex.query(api.founderMetrics.getFounderAlerts, { tokenIdentifier });
                if (!cancelled) {
                    setNewSignupCount(alerts?.newUsers24hCount || 0);
                }
            } catch (e: any) {
                console.warn('[FounderBottomNav] getFounderAlerts failed:', e?.message || e);
            }
        };
        fetchStats();
        const interval = setInterval(fetchStats, 60_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [tokenIdentifier, convex]);

    return (
        <>
            <nav
                className="fixed bottom-0 left-0 right-0 z-[1000] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-zinc-700 pb-safe pt-1"
            >
                <div className="flex items-start">
                    {NAV_ITEMS.map(item => {
                        const isActive = activeView === item.view;
                        return (
                            <button
                                key={item.view}
                                onClick={() => { setActiveView(item.view); setIsMoreOpen(false); }}
                                className={`active-press touch-target relative flex flex-col items-center justify-center flex-1 pt-1.5 pb-1 h-14 transition-colors duration-200 ${
                                    isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-zinc-400'
                                }`}
                                aria-current={isActive ? 'page' : undefined}
                                aria-label={item.label}
                            >
                                <div className="relative">
                                    {React.cloneElement(item.icon, { className: 'w-5 h-5 mb-0.5' })}
                                    {/* CRO AUDIT Track A — show pending subscription count badge on More */}
                                    {item.view === 'notifications' && pendingCount > 0 && (
                                        <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-red-500 text-white text-2xs font-bold rounded-full flex items-center justify-center">
                                            {formatBadgeCount(pendingCount)}
                                        </span>
                                    )}
                                    {/* New signup badge — shows count of
                                        users who registered in the last 24h. Caps at 9+. */}
                                    {item.view === 'notifications' && newSignupCount > 0 && (
                                        <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-emerald-500 text-white text-2xs font-bold rounded-full flex items-center justify-center">
                                            {formatBadgeCount(newSignupCount)}
                                        </span>
                                    )}
                                </div>
                                <span className="text-2xs font-medium">{item.label}</span>
                            </button>
                        );
                    })}
                    <button
                        onClick={() => setIsMoreOpen(prev => !prev)}
                        className={`active-press touch-target relative flex flex-col items-center justify-center flex-1 pt-1.5 pb-1 h-14 transition-colors duration-200 ${
                            isMoreActive || isMoreOpen ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-zinc-400'
                        }`}
                        aria-label="More"
                    >
                        <div className="relative">
                            <MoreIcon className="w-5 h-5 mb-0.5" />
                            {/* CRO AUDIT Track A — red dot on More when pending requests exist */}
                            {pendingCount > 0 && !isMoreOpen && (
                                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
                            )}
                        </div>
                        <span className="text-2xs font-medium">More</span>
                    </button>
                </div>
            </nav>

            {isMoreOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[1001] bg-black/40 backdrop-blur-[2px]"
                        onClick={() => setIsMoreOpen(false)}
                    />
                    <div className="fixed bottom-20 left-4 right-4 z-[1002] animate-slide-in-up origin-bottom max-h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar">
                        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-zinc-700/50 p-4">
                            <div className="flex justify-between items-center mb-4 px-2">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">More Options</h3>
                                <button onClick={() => setIsMoreOpen(false)} className="p-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300" aria-label="Close menu">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {MORE_ITEMS.map(item => {
                                    const isActive = activeView === item.view;
                                    // CRO AUDIT Track A — show pending count badge on Subscriptions item
                                    const showBadge = item.view === 'subscriptions' && pendingCount > 0;
                                    const isUrgent = item.view === 'subscriptions' && expiringSoon > 0;
                                    return (
                                        <button
                                            key={item.view}
                                            onClick={() => { setActiveView(item.view); setIsMoreOpen(false); }}
                                            className="active-press flex flex-col items-center gap-2 group relative"
                                        >
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-sm relative ${
                                                isActive ? 'bg-primary-600 text-white shadow-primary-500/30' : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 group-active:scale-95'
                                            } ${isUrgent && !isActive ? 'ring-2 ring-red-400' : ''}`}>
                                                {React.cloneElement(item.icon, { className: "w-6 h-6" })}
                                                {showBadge && (
                                                    <span className={`absolute -top-1 -right-1 min-w-[20px] h-5 px-1 ${isUrgent ? 'bg-red-500 animate-pulse' : 'bg-amber-500'} text-white text-2xs font-bold rounded-full flex items-center justify-center`}>
                                                        {formatBadgeCount(pendingCount)}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-2xs font-medium text-center leading-tight line-clamp-1 ${
                                                isActive ? 'text-primary-700 dark:text-primary-400' : 'text-slate-600 dark:text-zinc-400'
                                            }`}>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};
