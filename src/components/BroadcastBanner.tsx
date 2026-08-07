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
 * ACCORDION STUBS:
 *   Inactive banners show as a single-line stub below the active card:
 *   [dot] [label] [title] ... [Banner N] [>]
 *
 * CRASH-SAFE: Returns null when no visible broadcasts.
 * DISMISSAL: Message-family suppression prevents stack drain.
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
};

const DEFAULT_THEME = THEME.info;

function parseTheme(type: string): string {
    if (!type || !type.startsWith('broadcast_')) return 'info';
    return type.replace('broadcast_', '') || 'info';
}

function getUserProduct(user: any): string {
    const product = (user?.product || '').toLowerCase();
    if (product === 'komplete' || product === 'unified') return 'unified';
    if (product === 'vega' || product === 'legal') return 'legal';
    if (product === 'atrium' || product === 'property') return 'property';
    return 'unified';
}

function getSessionDismissed(): Set<string> {
    try {
        const raw = sessionStorage.getItem('dismissed_broadcasts_v2');
        if (!raw) return new Set();
        return new Set(JSON.parse(raw));
    } catch {
        return new Set();
    }
}

function saveSessionDismissed(ids: Set<string>) {
    try {
        sessionStorage.setItem('dismissed_broadcasts_v2', JSON.stringify([...ids]));
    } catch {}
}

export const BroadcastBanner: React.FC = () => {
    const { currentUser, isAuthenticated } = useAuth();
    const markAsRead = useMutation(api.myFunctions.markNotificationsAsRead);

    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [dismissingId, setDismissingId] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const userId = currentUser?._id || (currentUser as any)?.id || '';
    const userIdStr = String(userId);
    const userEmail = currentUser?.email || '';

    const broadcasts = useQuery(api.broadcasts.getActiveBroadcasts,
        isAuthenticated && (userIdStr || userEmail)
            ? { userId: userIdStr, email: userEmail }
            : "skip");

    const userProduct = getUserProduct(currentUser);

    useEffect(() => {
        setDismissedIds(getSessionDismissed());
    }, []);

    const visibleBroadcasts = useMemo((): any[] => {
        if (!broadcasts || !Array.isArray(broadcasts)) return [];
        const matching = broadcasts.filter((b: any) => {
            if (!b) return false;
            const targetProduct = b.targetProduct || 'all';
            if (targetProduct !== 'all' && targetProduct !== userProduct) return false;
            const broadcastId = b.link?.context?.broadcastId || b._id;
            const notifId = b._id || b.id;
            if (dismissedIds.has(broadcastId)) return false;
            if (dismissedIds.has(notifId)) return false;
            const messageFamilyKey = `family|||${b.title || ''}|||${b.message || ''}`;
            if (dismissedIds.has(messageFamilyKey)) return false;
            return true;
        });
        return matching.slice(0, MAX_BANNERS);
    }, [broadcasts, userProduct, dismissedIds]);

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
        const notifId = broadcast._id || broadcast.id;
        const broadcastId = broadcast.link?.context?.broadcastId;
        const persistenceMode = broadcast.persistenceMode || 'permanent';
        if (!notifId) return;

        setDismissingId(notifId);
        setDismissedIds(prev => {
            const next = new Set(prev);
            next.add(notifId);
            if (broadcastId) next.add(broadcastId);
            next.add(`family|||${broadcast.title || ''}|||${broadcast.message || ''}`);
            saveSessionDismissed(next);
            return next;
        });

        if (persistenceMode === 'permanent') {
            try {
                await markAsRead({ ids: [notifId], userEmail: currentUser?.email });
            } catch (e) {
                console.error('[BroadcastBanner] Failed to mark as read:', e);
            }
        }
        setTimeout(() => setDismissingId(null), 250);
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
    const isDismissible = activeBroadcast.persistenceMode !== 'persistent';
    const stubs = visibleBroadcasts.map((b, i) => ({ b, i })).filter(({ i }) => i !== activeIndex);

    return (
        <div className="w-full">
            {/* Active Card — clean, minimal, 100% opaque */}
            <div
                className={`relative bg-white dark:bg-zinc-800 rounded-xl border ${activeTheme.border} shadow-sm overflow-hidden transition-all duration-250 ${
                    dismissingId === (activeBroadcast._id || activeBroadcast.id)
                        ? 'opacity-0 -translate-y-3'
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
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-bold ${activeTheme.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${activeTheme.dot}`} />
                                {activeTheme.label}
                            </span>
                            {activeBroadcast.persistenceMode === 'persistent' && (
                                <span className="text-3xs font-bold text-slate-400">📌 Pinned</span>
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
                                key={b._id || b.id || i}
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
