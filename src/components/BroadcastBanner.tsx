/**
 * BroadcastBanner — simplified accordion stub carousel.
 *
 * UI: Clean, light, un-cluttered. No heavy icon boxes or redundant badges.
 * Layout: Short category badge + Title + Short Message + (X) Dismiss.
 *
 * DISMISSAL STACK DRAIN FIX:
 *   When a user dismisses a banner, we record the dismissal by BOTH
 *   the broadcastId AND a "message family" key (title+message). This
 *   suppresses ALL historical test instances of the same message —
 *   so dismissing "Broadcast Test #8" hides all copies of it, not
 *   just the one visible banner.
 *
 * CRASH-SAFE: Returns null when no visible broadcasts. Never reads
 * null state. Auto-resets activeIndex when array shrinks.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

const MAX_BANNERS = 2;

// Simplified theme styles — no heavy icon boxes, just colors for badges
const THEME_STYLES: Record<string, {
    bg: string;
    border: string;
    accent: string;      // Left accent bar
    badgeBg: string;     // Small category badge
    badgeText: string;
    titleColor: string;
    bodyColor: string;
    dotColor: string;    // Stub dot
    label: string;
}> = {
    info: {
        bg: 'bg-white dark:bg-zinc-800',
        border: 'border-blue-200 dark:border-blue-800',
        accent: 'bg-blue-500',
        badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
        badgeText: 'text-blue-700 dark:text-blue-300',
        titleColor: 'text-slate-900 dark:text-white',
        bodyColor: 'text-slate-600 dark:text-zinc-300',
        dotColor: 'bg-blue-500',
        label: 'Info',
    },
    success: {
        bg: 'bg-white dark:bg-zinc-800',
        border: 'border-emerald-200 dark:border-emerald-800',
        accent: 'bg-emerald-500',
        badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40',
        badgeText: 'text-emerald-700 dark:text-emerald-300',
        titleColor: 'text-slate-900 dark:text-white',
        bodyColor: 'text-slate-600 dark:text-zinc-300',
        dotColor: 'bg-emerald-500',
        label: 'Success',
    },
    warning: {
        bg: 'bg-white dark:bg-zinc-800',
        border: 'border-amber-200 dark:border-amber-800',
        accent: 'bg-amber-500',
        badgeBg: 'bg-amber-100 dark:bg-amber-900/40',
        badgeText: 'text-amber-700 dark:text-amber-300',
        titleColor: 'text-slate-900 dark:text-white',
        bodyColor: 'text-slate-600 dark:text-zinc-300',
        dotColor: 'bg-amber-500',
        label: 'Warning',
    },
    urgent: {
        bg: 'bg-white dark:bg-zinc-800',
        border: 'border-red-200 dark:border-red-800',
        accent: 'bg-red-500',
        badgeBg: 'bg-red-100 dark:bg-red-900/40',
        badgeText: 'text-red-700 dark:text-red-300',
        titleColor: 'text-slate-900 dark:text-white',
        bodyColor: 'text-slate-600 dark:text-zinc-300',
        dotColor: 'bg-red-500',
        label: 'Urgent',
    },
};

const DEFAULT_THEME = THEME_STYLES.info;

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

    // Filter broadcasts — exclude dismissed IDs AND dismissed message families
    const visibleBroadcasts = useMemo((): any[] => {
        if (!broadcasts || !Array.isArray(broadcasts)) return [];

        const matching = broadcasts.filter((b: any) => {
            if (!b) return false;
            const targetProduct = b.targetProduct || 'all';
            if (targetProduct !== 'all' && targetProduct !== userProduct) return false;

            const broadcastId = b.link?.context?.broadcastId || b._id;
            const notifId = b._id || b.id;

            // Check if this specific notification is dismissed
            if (dismissedIds.has(broadcastId)) return false;
            if (dismissedIds.has(notifId)) return false;

            // STACK DRAIN FIX: Also check if the "message family" is dismissed.
            // When a user dismisses "Broadcast Test #8", ALL notifications with
            // the same title+message are suppressed — not just the one visible
            // banner. This prevents dozens of historical test instances from
            // appearing one by one as the user dismisses each.
            const messageFamilyKey = `family|||${b.title || ''}|||${b.message || ''}`;
            if (dismissedIds.has(messageFamilyKey)) return false;

            return true;
        });

        return matching.slice(0, MAX_BANNERS);
    }, [broadcasts, userProduct, dismissedIds]);

    // CRASH-SAFE: Reset activeIndex if out of bounds
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

        // STACK DRAIN FIX: Add to dismissedIds by notifId, broadcastId,
        // AND the message family key. This suppresses ALL historical
        // test instances of the same message.
        setDismissedIds(prev => {
            const next = new Set(prev);
            next.add(notifId);
            if (broadcastId) next.add(broadcastId);
            // Add the message family key to suppress all copies
            const familyKey = `family|||${broadcast.title || ''}|||${broadcast.message || ''}`;
            next.add(familyKey);
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

        setTimeout(() => setDismissingId(null), 300);
    }, [markAsRead, currentUser]);

    const handleNext = useCallback(() => {
        if (visibleBroadcasts.length < 2) return;
        setActiveIndex(prev => (prev + 1) % visibleBroadcasts.length);
    }, [visibleBroadcasts.length]);

    const handlePrev = useCallback(() => {
        if (visibleBroadcasts.length < 2) return;
        setActiveIndex(prev => (prev - 1 + visibleBroadcasts.length) % visibleBroadcasts.length);
    }, [visibleBroadcasts.length]);

    const handleStubClick = useCallback((index: number) => {
        setActiveIndex(index);
    }, []);

    // CRASH-SAFE: If no visible broadcasts, render nothing
    if (!visibleBroadcasts || visibleBroadcasts.length === 0) return null;

    const activeBroadcast = visibleBroadcasts[activeIndex];
    if (!activeBroadcast) return null;

    const stubs = visibleBroadcasts
        .map((b, i) => ({ broadcast: b, index: i }))
        .filter(({ index }) => index !== activeIndex);

    return (
        <div className="w-full transition-all duration-300 ease-out">
            {/* Expanded Active Card — 100% OPAQUE, simplified layout */}
            <div
                className={`relative rounded-2xl overflow-hidden shadow-sm border-2 transition-all duration-300 ${THEME_STYLES[parseTheme(activeBroadcast.type || '')]?.bg || DEFAULT_THEME.bg} ${THEME_STYLES[parseTheme(activeBroadcast.type || '')]?.border || DEFAULT_THEME.border} ${
                    dismissingId === (activeBroadcast._id || activeBroadcast.id)
                        ? 'opacity-0 -translate-y-5'
                        : 'opacity-100 translate-y-0'
                }`}
            >
                {/* Left accent line */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${THEME_STYLES[parseTheme(activeBroadcast.type || '')]?.accent || DEFAULT_THEME.accent}`} />

                <div className="relative p-4 pl-5">
                    {/* Top row: badge + dismiss */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* Small category badge — no heavy icon box */}
                            <span className={`px-2 py-0.5 rounded text-3xs font-bold flex-shrink-0 ${THEME_STYLES[parseTheme(activeBroadcast.type || '')]?.badgeBg || DEFAULT_THEME.badgeBg} ${THEME_STYLES[parseTheme(activeBroadcast.type || '')]?.badgeText || DEFAULT_THEME.badgeText}`}>
                                {THEME_STYLES[parseTheme(activeBroadcast.type || '')]?.label || DEFAULT_THEME.label}
                            </span>
                            {activeBroadcast.persistenceMode === 'persistent' && (
                                <span className="px-2 py-0.5 rounded text-3xs font-bold bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300 flex-shrink-0">
                                    📌 Pinned
                                </span>
                            )}
                            {/* Title */}
                            <p className={`text-sm font-bold truncate ${THEME_STYLES[parseTheme(activeBroadcast.type || '')]?.titleColor || DEFAULT_THEME.titleColor}`}>
                                {activeBroadcast.title || 'Platform Announcement'}
                            </p>
                        </div>

                        {/* Dismiss (X) — 44x44px hitbox */}
                        {activeBroadcast.persistenceMode !== 'persistent' && (
                            <button
                                onClick={() => handleDismiss(activeBroadcast)}
                                className="flex items-center justify-center w-11 h-11 -mt-2 -mr-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors flex-shrink-0"
                                aria-label="Dismiss"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Message body */}
                    <p className={`text-xs leading-relaxed ${THEME_STYLES[parseTheme(activeBroadcast.type || '')]?.bodyColor || DEFAULT_THEME.bodyColor}`}>
                        {activeBroadcast.message || ''}
                    </p>

                    {/* Action button */}
                    {activeBroadcast.deepLink && (
                        <button
                            onClick={() => {
                                if (activeBroadcast.deepLink) {
                                    window.location.hash = activeBroadcast.deepLink;
                                }
                                if (activeBroadcast.persistenceMode !== 'persistent') {
                                    handleDismiss(activeBroadcast);
                                }
                            }}
                            className={`mt-2 px-3 py-1 rounded-lg text-2xs font-bold ${THEME_STYLES[parseTheme(activeBroadcast.type || '')]?.badgeBg || DEFAULT_THEME.badgeBg} ${THEME_STYLES[parseTheme(activeBroadcast.type || '')]?.badgeText || DEFAULT_THEME.badgeText} hover:opacity-80`}
                        >
                            View Details →
                        </button>
                    )}
                </div>
            </div>

            {/* Compact Stubs — ultra-slim bars */}
            {stubs.length > 0 && (
                <div className="mt-1.5 space-y-1">
                    {stubs.map(({ broadcast, index }) => {
                        const theme = THEME_STYLES[parseTheme(broadcast.type || '')] || DEFAULT_THEME;
                        return (
                            <button
                                key={broadcast._id || broadcast.id || index}
                                onClick={() => handleStubClick(index)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg ${theme.bg} ${theme.border} border hover:shadow-sm transition-all cursor-pointer min-h-[44px]`}
                            >
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${theme.dotColor}`} />
                                <span className={`text-2xs font-bold ${theme.badgeText} flex-shrink-0`}>{theme.label}</span>
                                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate flex-1 text-left">
                                    {broadcast.title || 'Announcement'}
                                </span>
                                <span className="text-2xs text-slate-400 flex-shrink-0">Banner {index + 1}</span>
                                <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Pagination — 44x44px hitbox */}
            {visibleBroadcasts.length > 1 && (
                <div className="flex items-center justify-center gap-1 mt-2">
                    <button
                        onClick={handlePrev}
                        className="flex items-center justify-center w-11 h-11 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        aria-label="Previous banner"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={handleNext}
                        className="flex items-center justify-center px-3 h-11 rounded-lg text-2xs font-bold text-slate-500 dark:text-zinc-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                    >
                        {activeIndex + 1} of {visibleBroadcasts.length}
                    </button>
                    <button
                        onClick={handleNext}
                        className="flex items-center justify-center gap-1 w-11 h-11 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        aria-label="Next banner"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default BroadcastBanner;
