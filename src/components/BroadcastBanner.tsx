/**
 * BroadcastBanner — Opaque Smoky Glass design with sequential queue.
 *
 * DESIGN:
 *   - Deep, high-density dark smoky glass background (100% opaque to
 *     underlying text — no ghosting/bleed-through)
 *   - backdrop-filter: blur(16px) for the glass effect
 *   - Thin colored left accent line per urgency type
 *   - Clean row: category pill + bold title + body + dismiss (X)
 *
 * QUEUE LOGIC:
 *   - Deduplicates by broadcastId (client-side, defense-in-depth)
 *   - Renders ONLY the primary (latest) banner at a time
 *   - When dismissed, the next banner slides up smoothly
 *
 * DISMISSAL ISOLATION:
 *   - Dismissing one banner ONLY affects that specific broadcastId
 *   - NEVER wipes other active banners from the queue
 *   - Per-broadcast-ID localStorage key (not message-family)
 *
 * CRASH-SAFE: Returns null when no visible broadcasts.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

const THEME: Record<string, {
    accentBar: string;
    pillBg: string;
    pillText: string;
    label: string;
}> = {
    info: {
        accentBar: 'bg-blue-500',
        pillBg: 'bg-blue-500/20',
        pillText: 'text-blue-300',
        label: 'Info',
    },
    success: {
        accentBar: 'bg-emerald-500',
        pillBg: 'bg-emerald-500/20',
        pillText: 'text-emerald-300',
        label: 'Success',
    },
    warning: {
        accentBar: 'bg-amber-500',
        pillBg: 'bg-amber-500/20',
        pillText: 'text-amber-300',
        label: 'Warning',
    },
    urgent: {
        accentBar: 'bg-rose-500',
        pillBg: 'bg-rose-500/20',
        pillText: 'text-rose-300',
        label: 'Urgent',
    },
    announcement: {
        accentBar: 'bg-emerald-500',
        pillBg: 'bg-emerald-500/20',
        pillText: 'text-emerald-300',
        label: 'Announcement',
    },
    upsell: {
        accentBar: 'bg-violet-500',
        pillBg: 'bg-violet-500/20',
        pillText: 'text-violet-300',
        label: 'Offer',
    },
};

const DEFAULT_THEME = THEME.info;

function parseTheme(type: string): string {
    if (!type || !type.startsWith('broadcast_')) return 'info';
    const parsed = type.replace('broadcast_', '') || 'info';
    return THEME[parsed] ? parsed : 'info';
}

function getUserProduct(user: any): string {
    const product = (user?.product || '').toLowerCase();
    if (product === 'komplete' || product === 'unified') return 'unified';
    if (product === 'vega' || product === 'legal') return 'legal';
    if (product === 'atrium' || product === 'property') return 'property';
    return 'unified';
}

// Per-broadcast-ID dismissal via localStorage.
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
    const [dismissTick, setDismissTick] = useState(0);

    // One-time cleanup of OLD dismissal state (message-family keys).
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

    // CRO AUDIT FIX — DEDUPLICATE + FILTER in a single memo.
    // 1. Deduplicate by broadcastId (client-side defense-in-depth, even
    //    though the backend now deduplicates too)
    // 2. Filter by product targeting
    // 3. Filter by dismissal state (per-broadcast-ID, NOT message-family)
    const visibleBroadcasts = useMemo((): any[] => {
        if (!broadcasts || !Array.isArray(broadcasts)) return [];

        // Step 1: Deduplicate by broadcastId (keep first = most recent)
        const seenBroadcastIds = new Set<string>();
        const deduped = broadcasts.filter((b: any) => {
            if (!b) return false;
            const bid = b.broadcastId || b.link?.context?.broadcastId || '';
            if (bid) {
                if (seenBroadcastIds.has(bid)) return false;
                seenBroadcastIds.add(bid);
            }
            return true;
        });

        // Step 2 + 3: Filter by product + dismissal
        const matching = deduped.filter((b: any) => {
            const targetProduct = b.targetProduct || 'all';
            if (targetProduct !== 'all' && targetProduct !== userProduct) return false;

            const broadcastId = b.broadcastId || b.link?.context?.broadcastId || '';
            const notifId = String(b._id || b.id || '');
            const persistenceMode = b.persistenceMode || b.link?.context?.persistenceMode || 'permanent';

            if (persistenceMode === 'session') {
                if (isSessionDismissed(broadcastId, notifId)) return false;
            } else {
                if (isDismissed(broadcastId, notifId)) return false;
            }
            return true;
        });

        // Return ALL visible (not just MAX_BANNERS) — the queue logic below
        // handles showing one at a time with smooth transitions.
        return matching;
    }, [broadcasts, userProduct, dismissTick]);

    // CRO AUDIT FIX — SEQUENTIAL QUEUE LOGIC.
    // The active banner is always visibleBroadcasts[0] (the latest/most recent).
    // When dismissed, it's removed from visibleBroadcasts via the dismissal
    // state, and visibleBroadcasts[1] automatically becomes the new [0].
    const activeBroadcast = visibleBroadcasts[0] || null;
    const queueCount = visibleBroadcasts.length;

    const handleDismiss = useCallback(async (broadcast: any) => {
        if (!broadcast) return;
        const notifId = String(broadcast._id || broadcast.id || '');
        const broadcastId = broadcast.broadcastId || broadcast.link?.context?.broadcastId || '';
        const persistenceMode = broadcast.persistenceMode || broadcast.link?.context?.persistenceMode || 'permanent';
        if (!notifId) return;

        // Animate out
        setDismissingId(notifId);

        // CRO AUDIT FIX — ISOLATED dismissal. Only store dismissal for THIS
        // specific broadcastId + notifId. NEVER touch other banners' state.
        if (persistenceMode === 'session') {
            markSessionDismissed(broadcastId, notifId);
        } else {
            markDismissed(broadcastId, notifId);
        }

        // Force re-render after animation completes. The dismissed banner
        // is removed from visibleBroadcasts, and the next one slides up.
        setTimeout(() => {
            setDismissTick(t => t + 1);
            setDismissingId(null);
        }, 300);

        // Mark as read in backend (for 'permanent' mode only).
        // CRO AUDIT FIX — only pass THIS ONE notifId, never multiple.
        if (persistenceMode === 'permanent') {
            try {
                await markAsRead({ ids: [notifId], userEmail: currentUser?.email });
            } catch (e) {
                console.error('[BroadcastBanner] Failed to mark as read:', e);
            }
        }
    }, [markAsRead, currentUser]);

    // CRASH-SAFE
    if (!activeBroadcast) return null;

    const activeTheme = THEME[parseTheme(activeBroadcast.type || '')] || DEFAULT_THEME;
    const persistenceMode = activeBroadcast.persistenceMode || activeBroadcast.link?.context?.persistenceMode || 'permanent';
    const isDismissible = persistenceMode !== 'persistent';
    const isDismissing = dismissingId === String(activeBroadcast._id || activeBroadcast.id);

    return (
        <div className="w-full">
            {/* Active Card — Opaque Smoky Glass
                - background: rgba(18, 24, 22, 0.92) in dark mode (100% opaque to underlying text)
                - backdrop-filter: blur(16px) for the glass effect
                - Thin colored left accent line per urgency type
                - Smooth slide-down fade-in when a banner arrives
                - Smooth slide-up fade-out when dismissed */}
            <div
                className={`relative overflow-hidden rounded-xl border border-white/10 transition-all duration-300 ease-out ${
                    isDismissing
                        ? 'opacity-0 -translate-y-4 max-h-0 mt-0 mb-0'
                        : 'opacity-100 translate-y-0'
                }`}
                style={{
                    background: 'rgba(18, 24, 22, 0.92)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                }}
            >
                {/* Thin colored left accent bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${activeTheme.accentBar}`} />

                <div className="p-4 pl-5">
                    {/* Top row: pill + title + dismiss */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            {/* Category pill */}
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-bold ${activeTheme.pillBg} ${activeTheme.pillText} flex-shrink-0`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${activeTheme.accentBar}`} />
                                {activeTheme.label}
                            </span>
                            {persistenceMode === 'persistent' && (
                                <span className="text-3xs font-bold text-slate-400 flex-shrink-0">📌 Pinned</span>
                            )}
                            {/* Title */}
                            <p className="text-sm font-bold text-white truncate">
                                {activeBroadcast.title || 'Announcement'}
                            </p>
                        </div>

                        {/* Dismiss button */}
                        {isDismissible && (
                            <button
                                onClick={() => handleDismiss(activeBroadcast)}
                                className="flex items-center justify-center w-8 h-8 -mt-1 -mr-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                                aria-label="Dismiss"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Message body */}
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
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
                            className="mt-2 text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
                        >
                            View Details →
                        </button>
                    )}
                </div>
            </div>

            {/* Queue indicator — shows how many more banners are waiting */}
            {queueCount > 1 && !isDismissing && (
                <div className="flex items-center justify-center gap-1.5 mt-2">
                    <span className="text-3xs text-slate-400 font-medium">
                        +{queueCount - 1} more {queueCount - 1 === 1 ? 'banner' : 'banners'} in queue
                    </span>
                </div>
            )}
        </div>
    );
};

export default BroadcastBanner;
