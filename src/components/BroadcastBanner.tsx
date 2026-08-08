/**
 * BroadcastBanner — clean, minimal, polished.
 *
 * DESIGN PHILOSOPHY:
 *   Less is more. No heavy icon boxes, no clutter. Just:
 *   - A thin colored left border (urgency indicator)
 *   - A tiny dot + label badge (Info/Success/Warning/Urgent)
 *   - Title in bold
 *   - Message in muted text
 *   - Dismiss (X) in the top-right
 *
 *   The card is 100% opaque (solid white/zinc-800) with a subtle border
 *   and soft shadow. No glassmorphism, no translucency — just clean.
 *
 * DISMISSAL (CRO AUDIT FIX):
 *   Per-broadcast-ID dismissal using localStorage. When a NEW broadcast
 *   arrives with a new ID, it MUST render regardless of whether previous
 *   banners were dismissed. The old message-family suppression
 *   (`family|||${title}|||${message}`) could accidentally hide new
 *   broadcasts if the founder re-sent the same title+message — that's
 *   now removed.
 *
 * CRASH-SAFE: Returns null when no visible broadcasts.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

const MAX_BANNERS = 2;

const THEME: Record<string, {
    border: string;       // Card border color
    accentBar: string;    // Left accent bar
    dot: string;          // Status dot
    badge: string;        // Badge background + text
    label: string;
}> = {
    info: {
        border: 'border-slate-200 dark:border-zinc-700',
        accentBar: 'bg-blue-500',
        dot: 'bg-blue-500',
        badge: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        label: 'Info',
    },
    success: {
        border: 'border-slate-200 dark:border-zinc-700',
        accentBar: 'bg-emerald-500',
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        label: 'Success',
    },
    warning: {
        border: 'border-slate-200 dark:border-zinc-700',
        accentBar: 'bg-amber-500',
        dot: 'bg-amber-500',
        badge: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
        label: 'Warning',
    },
    urgent: {
        border: 'border-red-200 dark:border-red-800',
        accentBar: 'bg-red-500',
        dot: 'bg-red-500',
        badge: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
        label: 'Urgent',
    },
    // CRO AUDIT FIX — support 'announcement' and 'upsell' themes
    // (mentioned in the user's prompt as valid broadcast types)
    announcement: {
        border: 'border-emerald-200 dark:border-emerald-800',
        accentBar: 'bg-emerald-500',
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        label: 'Announcement',
    },
    upsell: {
        border: 'border-violet-200 dark:border-violet-800',
        accentBar: 'bg-violet-500',
        dot: 'bg-violet-500',
        badge: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
        label: 'Offer',
    },
};

const DEFAULT_THEME = THEME.info;

function parseTheme(type: string): string {
    if (!type || !type.startsWith('broadcast_')) return 'info';
    const parsed = type.replace('broadcast_', '') || 'info';
    // Map to a known theme, fallback to 'info' for unknown themes
    return THEME[parsed] ? parsed : 'info';
}

function getUserProduct(user: any): string {
    const product = (user?.product || '').toLowerCase();
    if (product === 'komplete' || product === 'unified') return 'unified';
    if (product === 'vega' || product === 'legal') return 'legal';
    if (product === 'atrium' || product === 'property') return 'property';
    return 'unified';
}

// CRO AUDIT FIX — per-broadcast-ID dismissal via localStorage.
// Keyed strictly to the specific broadcast ID (NOT title+message family).
// When a NEW broadcast arrives with a new ID, it MUST render regardless
// of whether previous banners were dismissed.
function isDismissed(broadcastId: string, notifId: string): boolean {
    try {
        if (broadcastId && localStorage.getItem(`dismissed_banner_${broadcastId}`) === 'true') return true;
        if (notifId && localStorage.getItem(`dismissed_banner_${notifId}`) === 'true') return true;
    } catch {}
    return false;
}

function markDismissed(broadcastId: string, notifId: string) {
    try {
        if (broadcastId) localStorage.setItem(`dismissed_banner_${broadcastId}`, 'true');
        if (notifId) localStorage.setItem(`dismissed_banner_${notifId}`, 'true');
    } catch {}
}

// Session-level dismissal (for 'session' persistence mode — dismissed
// for the current browser session only, not persisted across refreshes)
function isSessionDismissed(broadcastId: string, notifId: string): boolean {
    try {
        if (broadcastId && sessionStorage.getItem(`dismissed_banner_${broadcastId}`) === 'true') return true;
        if (notifId && sessionStorage.getItem(`dismissed_banner_${notifId}`) === 'true') return true;
    } catch {}
    return false;
}

function markSessionDismissed(broadcastId: string, notifId: string) {
    try {
        if (broadcastId) sessionStorage.setItem(`dismissed_banner_${broadcastId}`, 'true');
        if (notifId) sessionStorage.setItem(`dismissed_banner_${notifId}`, 'true');
    } catch {}
}

export const BroadcastBanner: React.FC = () => {
    const { currentUser, isAuthenticated } = useAuth();
    const markAsRead = useMutation(api.myFunctions.markNotificationsAsRead);

    const [dismissingId, setDismissingId] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    // CRO AUDIT FIX — tick state to force re-render when dismissal changes
    const [dismissTick, setDismissTick] = useState(0);

    // CRO AUDIT FIX — one-time cleanup of OLD dismissal state.
    // The old code used `dismissed_broadcasts_v2` in sessionStorage which
    // stored message-family keys (`family|||title|||message`). These could
    // accidentally hide new broadcasts with the same title+message. We
    // clear that old key on mount so new banners always render.
    useEffect(() => {
        try {
            sessionStorage.removeItem('dismissed_broadcasts_v2');
        } catch {}
    }, []);

    const userId = currentUser?._id || (currentUser as any)?.id || '';
    const userIdStr = String(userId);
    const userEmail = currentUser?.email || '';

    const broadcasts = useQuery(api.broadcasts.getActiveBroadcasts,
        isAuthenticated && (userIdStr || userEmail)
            ? { userId: userIdStr, email: userEmail }
            : "skip");

    const userProduct = getUserProduct(currentUser);

    const visibleBroadcasts = useMemo((): any[] => {
        if (!broadcasts || !Array.isArray(broadcasts)) return [];
        const matching = broadcasts.filter((b: any) => {
            if (!b) return false;
            // Product targeting
            const targetProduct = b.targetProduct || 'all';
            if (targetProduct !== 'all' && targetProduct !== userProduct) return false;

            // CRO AUDIT FIX — per-broadcast-ID dismissal (NOT message-family).
            // A new broadcast with a new ID MUST render even if old ones were dismissed.
            const broadcastId = b.broadcastId || b.link?.context?.broadcastId || '';
            const notifId = String(b._id || b.id || '');
            const persistenceMode = b.persistenceMode || b.link?.context?.persistenceMode || 'permanent';

            if (persistenceMode === 'session') {
                // Session-only dismissal
                if (isSessionDismissed(broadcastId, notifId)) return false;
            } else {
                // Permanent dismissal (localStorage persists across refreshes)
                if (isDismissed(broadcastId, notifId)) return false;
            }
            return true;
        });
        return matching.slice(0, MAX_BANNERS);
        // CRO AUDIT FIX — include dismissTick in deps so re-render happens on dismissal
    }, [broadcasts, userProduct, dismissTick]);

    useEffect(() => {
        if (visibleBroadcasts.length === 0) {
            setActiveIndex(0);
            return;
        }
        if (activeIndex >= visibleBroadcasts.length) {
            setActiveIndex(0);
        }
    }, [visibleBroadcasts.length, activeIndex]);

    const handleDismiss = useCallback(async (broadcast: any) => {
        if (!broadcast) return;
        const notifId = String(broadcast._id || broadcast.id || '');
        const broadcastId = broadcast.broadcastId || broadcast.link?.context?.broadcastId || '';
        const persistenceMode = broadcast.persistenceMode || broadcast.link?.context?.persistenceMode || 'permanent';
        if (!notifId) return;

        // Animate out
        setDismissingId(notifId);

        // CRO AUDIT FIX — store dismissal per-broadcast-ID (NOT message-family)
        if (persistenceMode === 'session') {
            markSessionDismissed(broadcastId, notifId);
        } else {
            markDismissed(broadcastId, notifId);
        }

        // Force re-render to update visibleBroadcasts
        setTimeout(() => {
            setDismissTick(t => t + 1);
            setDismissingId(null);
        }, 250);

        // Mark as read in backend (for 'permanent' mode only — 'persistent' can't be dismissed)
        if (persistenceMode === 'permanent') {
            try {
                await markAsRead({ ids: [notifId], userEmail: currentUser?.email });
            } catch (e) {
                console.error('[BroadcastBanner] Failed to mark as read:', e);
            }
        }
    }, [markAsRead, currentUser]);

    const handleNext = useCallback(() => {
        if (visibleBroadcasts.length < 2) return;
        setActiveIndex(prev => (prev + 1) % visibleBroadcasts.length);
    }, [visibleBroadcasts.length]);

    const handleStubClick = useCallback((index: number) => {
        setActiveIndex(index);
    }, []);

    // CRASH-SAFE
    if (!visibleBroadcasts || visibleBroadcasts.length === 0) return null;
    const activeBroadcast = visibleBroadcasts[activeIndex];
    if (!activeBroadcast) return null;

    const activeTheme = THEME[parseTheme(activeBroadcast.type || '')] || DEFAULT_THEME;
    const persistenceMode = activeBroadcast.persistenceMode || activeBroadcast.link?.context?.persistenceMode || 'permanent';
    // CRO AUDIT FIX — 'persistent' mode means the banner CANNOT be dismissed
    // (it stays until the founder archives it). 'permanent' and 'session' can be dismissed.
    const isDismissible = persistenceMode !== 'persistent';
    const stubs = visibleBroadcasts.map((b, i) => ({ b, i })).filter(({ i }) => i !== activeIndex);

    return (
        <div className="w-full">
            {/* Active Card — clean, minimal, 100% opaque.
                CRO AUDIT FIX — smooth animation via CSS transition.
                Removed framer-motion dependency (was causing issues); using
                Tailwind's transition-all + opacity/translate instead. */}
            <div
                className={`relative bg-white dark:bg-zinc-800 rounded-xl border ${activeTheme.border} shadow-sm overflow-hidden transition-all duration-300 ease-out ${
                    dismissingId === String(activeBroadcast._id || activeBroadcast.id)
                        ? 'opacity-0 -translate-y-3 max-h-0'
                        : 'opacity-100 translate-y-0'
                }`}
            >
                {/* Thin left accent bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${activeTheme.accentBar}`} />

                <div className="p-4 pl-5">
                    {/* Top row: badge + title + dismiss */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* Tiny dot + label badge */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-bold ${activeTheme.badge} flex-shrink-0`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${activeTheme.dot}`} />
                                {activeTheme.label}
                            </span>
                            {persistenceMode === 'persistent' && (
                                <span className="text-3xs font-bold text-slate-400 flex-shrink-0">📌 Pinned</span>
                            )}
                            {/* Title */}
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {activeBroadcast.title || 'Announcement'}
                            </p>
                        </div>

                        {/* Dismiss — 44px hitbox, minimal */}
                        {isDismissible && (
                            <button
                                onClick={() => handleDismiss(activeBroadcast)}
                                className="flex items-center justify-center w-8 h-8 -mt-1 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors flex-shrink-0"
                                aria-label="Dismiss"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Message */}
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                        {activeBroadcast.message || ''}
                    </p>

                    {/* Action link */}
                    {activeBroadcast.deepLink && (
                        <button
                            onClick={() => {
                                if (activeBroadcast.deepLink) {
                                    window.location.hash = activeBroadcast.deepLink;
                                }
                                if (isDismissible) handleDismiss(activeBroadcast);
                            }}
                            className="mt-2 text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                        >
                            View Details →
                        </button>
                    )}
                </div>
            </div>

            {/* Compact stubs — single line each */}
            {stubs.length > 0 && (
                <div className="mt-1.5">
                    {stubs.map(({ b, i }) => {
                        const theme = THEME[parseTheme(b.type || '')] || DEFAULT_THEME;
                        return (
                            <button
                                key={String(b._id || b.id || i)}
                                onClick={() => handleStubClick(i)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border ${theme.border} hover:shadow-sm transition-all cursor-pointer`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme.dot}`} />
                                <span className={`text-3xs font-bold ${theme.badge.split(' ').slice(1).join(' ')} flex-shrink-0`}>
                                    {theme.label}
                                </span>
                                <span className="text-xs font-medium text-slate-600 dark:text-zinc-300 truncate flex-1 text-left">
                                    {b.title || 'Announcement'}
                                </span>
                                <span className="text-3xs text-slate-400 flex-shrink-0">{i + 1}</span>
                                <svg className="w-3 h-3 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Pagination — minimal, large hitbox */}
            {visibleBroadcasts.length > 1 && (
                <div className="flex items-center justify-center gap-2 mt-2">
                    <button
                        onClick={() => setActiveIndex(prev => (prev - 1 + visibleBroadcasts.length) % visibleBroadcasts.length)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        aria-label="Previous"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={handleNext}
                        className="flex items-center justify-center px-3 h-8 rounded-lg text-2xs font-bold text-slate-500 dark:text-zinc-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                    >
                        {activeIndex + 1} / {visibleBroadcasts.length}
                    </button>
                    <button
                        onClick={handleNext}
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        aria-label="Next"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default BroadcastBanner;
