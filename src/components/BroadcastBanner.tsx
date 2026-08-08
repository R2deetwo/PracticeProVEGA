/**
 * BroadcastBanner — Tinted Smoky Glass with Horizontal Carousel.
 *
 * DESIGN:
 *   - Tinted smoky glass: rgba(18, 26, 24, 0.75) + backdrop-filter: blur(16px)
 *   - Color tint accent per urgency type (subtle glow matching the badge)
 *   - Crisp 1px translucent border (rgba(255, 255, 255, 0.12))
 *   - Left color accent bar
 *
 * CAROUSEL:
 *   - Active banner in full view
 *   - Inactive banners as sleek horizontal stubs/pills below
 *   - Clicking a stub smoothly transitions to that banner
 *   - "1 of N" indicator with prev/next arrows
 *
 * DISMISSAL:
 *   - Per-broadcast-ID localStorage (isolated, never wipes others)
 *   - Smooth slide-out animation
 *
 * PRODUCT TARGETING FIX:
 *   - Uses multiple signals to resolve the user's product (user.product,
 *     firmDetails.product, subscriptionPlan)
 *   - Handles casing mismatches ('Komplete' vs 'komplete' vs 'unified')
 *   - Falls back gracefully when product field is empty
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { useCoreState } from '../contexts/CoreContext';

const THEME: Record<string, {
    accentBar: string;
    pillBg: string;
    pillText: string;
    label: string;
    tint: string;  // subtle background tint for the smoky glass
}> = {
    info: {
        accentBar: 'bg-blue-500',
        pillBg: 'bg-blue-500/20',
        pillText: 'text-blue-300',
        label: 'Info',
        tint: 'rgba(59, 130, 246, 0.08)',  // soft blue tint
    },
    success: {
        accentBar: 'bg-emerald-500',
        pillBg: 'bg-emerald-500/20',
        pillText: 'text-emerald-300',
        label: 'Success',
        tint: 'rgba(16, 185, 129, 0.08)',  // soft emerald tint
    },
    warning: {
        accentBar: 'bg-amber-500',
        pillBg: 'bg-amber-500/20',
        pillText: 'text-amber-300',
        label: 'Warning',
        tint: 'rgba(245, 158, 11, 0.08)',  // soft amber tint
    },
    urgent: {
        accentBar: 'bg-rose-500',
        pillBg: 'bg-rose-500/20',
        pillText: 'text-rose-300',
        label: 'Urgent',
        tint: 'rgba(244, 63, 94, 0.08)',  // soft rose tint
    },
    announcement: {
        accentBar: 'bg-emerald-500',
        pillBg: 'bg-emerald-500/20',
        pillText: 'text-emerald-300',
        label: 'Announcement',
        tint: 'rgba(16, 185, 129, 0.08)',
    },
    upsell: {
        accentBar: 'bg-violet-500',
        pillBg: 'bg-violet-500/20',
        pillText: 'text-violet-300',
        label: 'Offer',
        tint: 'rgba(139, 92, 246, 0.08)',
    },
};

const DEFAULT_THEME = THEME.info;

function parseTheme(type: string): string {
    if (!type || !type.startsWith('broadcast_')) return 'info';
    const parsed = type.replace('broadcast_', '') || 'info';
    return THEME[parsed] ? parsed : 'info';
}

// CRO AUDIT FIX — PRODUCT TARGETING RESOLUTION.
// Uses MULTIPLE signals to resolve the user's product, because
// currentUser.product can be stale/empty/wrong-cased.
// Signals checked (in priority order):
//   1. firmDetails.product (most reliable — set by the firm creation flow)
//   2. firmDetails.subscriptionPlan (Komplete plan = unified product)
//   3. currentUser.product (set at signup, but can be stale)
// Returns canonical product: 'legal' | 'property' | 'unified'
function resolveUserProduct(currentUser: any, firmDetails: any): string {
    // Collect all signals
    const firmProduct = (firmDetails?.product || '').toLowerCase().trim();
    const firmPlan = (firmDetails?.subscriptionPlan || '').toLowerCase().trim();
    const userProduct = (currentUser?.product || '').toLowerCase().trim();

    // Normalize each signal to canonical form
    const normalize = (p: string): string => {
        if (!p) return '';
        if (p === 'komplete' || p === 'unified') return 'unified';
        if (p === 'vega' || p === 'legal') return 'legal';
        if (p === 'atrium' || p === 'property') return 'property';
        return '';
    };

    // Signal 1: firmDetails.product (most reliable)
    const fromFirm = normalize(firmProduct);
    if (fromFirm) return fromFirm;

    // Signal 2: firm's subscriptionPlan (Komplete plan → unified product)
    if (firmPlan === 'komplete') return 'unified';

    // Signal 3: currentUser.product
    const fromUser = normalize(userProduct);
    if (fromUser) return fromUser;

    // Default: 'unified' (Komplete — safest fallback, shows all broadcasts)
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
    const { coreState } = useCoreState();
    const markAsRead = useMutation(api.myFunctions.markNotificationsAsRead);

    const [dismissingId, setDismissingId] = useState<string | null>(null);
    const [dismissTick, setDismissTick] = useState(0);
    const [activeIndex, setActiveIndex] = useState(0);

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

    // CRO AUDIT FIX — use multi-signal product resolution.
    // This fixes the bug where product-targeted broadcasts didn't render
    // because currentUser.product was stale or wrong-cased.
    const userProduct = useMemo(() =>
        resolveUserProduct(currentUser, coreState?.firmDetails),
        [currentUser, coreState?.firmDetails]
    );

    // DEDUPLICATE + FILTER
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
            // CRO AUDIT FIX — product targeting with normalized comparison.
            // The targetProduct from the backend can be 'all', 'legal',
            // 'property', or 'unified'. The userProduct is resolved via
            // resolveUserProduct() to the same canonical form.
            const targetProduct = (b.targetProduct || 'all').toLowerCase().trim();
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

        return matching;
    }, [broadcasts, userProduct, dismissTick]);

    // Reset activeIndex if it's out of bounds
    useEffect(() => {
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

        setDismissingId(notifId);

        // ISOLATED dismissal — only this broadcastId
        if (persistenceMode === 'session') {
            markSessionDismissed(broadcastId, notifId);
        } else {
            markDismissed(broadcastId, notifId);
        }

        setTimeout(() => {
            setDismissTick(t => t + 1);
            setDismissingId(null);
        }, 300);

        if (persistenceMode === 'permanent') {
            try {
                await markAsRead({ ids: [notifId], userEmail: currentUser?.email });
            } catch (e) {
                console.error('[BroadcastBanner] Failed to mark as read:', e);
            }
        }
    }, [markAsRead, currentUser]);

    const handleStubClick = useCallback((index: number) => {
        setActiveIndex(index);
    }, []);

    const handlePrev = useCallback(() => {
        setActiveIndex(prev => (prev - 1 + visibleBroadcasts.length) % visibleBroadcasts.length);
    }, [visibleBroadcasts.length]);

    const handleNext = useCallback(() => {
        setActiveIndex(prev => (prev + 1) % visibleBroadcasts.length);
    }, [visibleBroadcasts.length]);

    // CRASH-SAFE
    if (!visibleBroadcasts || visibleBroadcasts.length === 0) return null;

    const activeBroadcast = visibleBroadcasts[activeIndex] || visibleBroadcasts[0];
    if (!activeBroadcast) return null;

    const activeTheme = THEME[parseTheme(activeBroadcast.type || '')] || DEFAULT_THEME;
    const persistenceMode = activeBroadcast.persistenceMode || activeBroadcast.link?.context?.persistenceMode || 'permanent';
    const isDismissible = persistenceMode !== 'persistent';
    const isDismissing = dismissingId === String(activeBroadcast._id || activeBroadcast.id);
    const stubs = visibleBroadcasts.map((b, i) => ({ b, i })).filter(({ i }) => i !== activeIndex);

    return (
        <div className="w-full">
            {/* Active Card — Tinted Smoky Glass
                - background: rgba(18, 26, 24, 0.75) base + color tint overlay
                - backdrop-filter: blur(16px)
                - 1px translucent border (rgba(255, 255, 255, 0.12))
                - Left color accent bar
                - Smooth horizontal slide transition */}
            <div
                className={`relative overflow-hidden rounded-xl transition-all duration-300 ease-out ${
                    isDismissing
                        ? 'opacity-0 -translate-x-8 max-h-0'
                        : 'opacity-100 translate-x-0'
                }`}
                style={{
                    background: `linear-gradient(135deg, ${activeTheme.tint}, rgba(18, 26, 24, 0.85))`,
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
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

            {/* Horizontal Carousel Stubs — sleek pills for inactive banners */}
            {visibleBroadcasts.length > 1 && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {/* Prev arrow */}
                    <button
                        onClick={handlePrev}
                        className="flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                        aria-label="Previous banner"
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    {/* Stubs — one per banner, active one is highlighted */}
                    {visibleBroadcasts.map((b, i) => {
                        const theme = THEME[parseTheme(b.type || '')] || DEFAULT_THEME;
                        const isActive = i === activeIndex;
                        return (
                            <button
                                key={String(b._id || b.id || i)}
                                onClick={() => handleStubClick(i)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-bold transition-all ${
                                    isActive
                                        ? `${theme.pillBg} ${theme.pillText} ring-1 ring-white/20`
                                        : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                                }`}
                                title={b.title || `Banner ${i + 1}`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? theme.accentBar : 'bg-slate-500'}`} />
                                {i + 1}
                            </button>
                        );
                    })}

                    {/* Next arrow + counter */}
                    <button
                        onClick={handleNext}
                        className="flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                        aria-label="Next banner"
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    <span className="text-3xs text-slate-500 font-medium ml-1">
                        {activeIndex + 1} of {visibleBroadcasts.length}
                    </span>
                </div>
            )}
        </div>
    );
};

export default BroadcastBanner;
