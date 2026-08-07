/**
 * BroadcastBanner — horizontal depth stack with carousel + smooth dismissal.
 *
 * CRITICAL FIX — Dismissal Persistence:
 *   Previously, dismissed banners reappeared because the dismissingIds
 *   state was cleared after 300ms (for animation), and the real-time
 *   query immediately re-fetched the still-unread notification.
 *
 *   FIX: Dismissed IDs are now kept in a permanent Set for the entire
 *   session. They are NEVER removed (until logout clears sessionStorage).
 *   This prevents the banner from reappearing regardless of how many
 *   times the Convex query refreshes.
 *
 *   - 'permanent' mode: ID added to dismissedIds (local) + markAsRead (DB)
 *   - 'session' mode: ID added to dismissedIds (local) + sessionStorage
 *   - 'persistent' mode: no dismiss button shown
 *
 * HORIZONTAL DEPTH STACK:
 *   Instead of vertical stacking, banners are layered horizontally:
 *   - Front card: full-width, primary banner
 *   - Back card: offset translateX(12px) scale(0.97), slightly exposed
 *
 *   A "Next >" / "1 of 2" toggle lets the user cycle between banners.
 *   Clicking Next animates the front card sliding out as the back card
 *   scales up to the front.
 *
 * UPWARD EXIT DISMISSAL:
 *   When dismissed, the banner floats upward (translateY(-20px)) and
 *   fades out. The next banner expands forward to take the primary
 *   position. If it was the last banner, the layout height collapses.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

const MAX_BANNERS = 2;

const THEME_STYLES: Record<string, {
    light: { bg: string; border: string; iconBg: string; iconColor: string; titleColor: string; bodyColor: string; accent: string };
    dark: { bg: string; border: string; iconBg: string; iconColor: string; titleColor: string; bodyColor: string; accent: string };
    icon: string;
    label: string;
    badgeBg: string;
    badgeText: string;
}> = {
    info: {
        light: { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)', iconBg: 'rgba(59, 130, 246, 0.12)', iconColor: '#2563eb', titleColor: '#1e3a8a', bodyColor: '#1e40af', accent: 'bg-blue-500' },
        dark: { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(96, 165, 250, 0.25)', iconBg: 'rgba(59, 130, 246, 0.2)', iconColor: '#93c5fd', titleColor: '#bfdbfe', bodyColor: '#dbeafe', accent: 'bg-blue-400' },
        icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6a1.76 1.76 0 002.585-1.612A3.5 3.5 0 0113 5.5',
        label: 'Info',
        badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
        badgeText: 'text-blue-700 dark:text-blue-300',
    },
    success: {
        light: { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)', iconBg: 'rgba(16, 185, 129, 0.12)', iconColor: '#059669', titleColor: '#064e3b', bodyColor: '#065f46', accent: 'bg-emerald-500' },
        dark: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(52, 211, 153, 0.25)', iconBg: 'rgba(16, 185, 129, 0.2)', iconColor: '#6ee7b7', titleColor: '#a7f3d0', bodyColor: '#d1fae5', accent: 'bg-emerald-400' },
        icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        label: 'Success',
        badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40',
        badgeText: 'text-emerald-700 dark:text-emerald-300',
    },
    warning: {
        light: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', iconBg: 'rgba(245, 158, 11, 0.12)', iconColor: '#d97706', titleColor: '#78350f', bodyColor: '#92400e', accent: 'bg-amber-500' },
        dark: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(251, 191, 36, 0.25)', iconBg: 'rgba(245, 158, 11, 0.2)', iconColor: '#fcd34d', titleColor: '#fde68a', bodyColor: '#fef3c7', accent: 'bg-amber-400' },
        icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
        label: 'Warning',
        badgeBg: 'bg-amber-100 dark:bg-amber-900/40',
        badgeText: 'text-amber-700 dark:text-amber-300',
    },
    urgent: {
        light: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', iconBg: 'rgba(239, 68, 68, 0.12)', iconColor: '#dc2626', titleColor: '#7f1d1d', bodyColor: '#991b1b', accent: 'bg-red-500' },
        dark: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(248, 113, 113, 0.25)', iconBg: 'rgba(239, 68, 68, 0.2)', iconColor: '#fca5a5', titleColor: '#fecaca', bodyColor: '#fee2e2', accent: 'bg-red-400' },
        icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
        label: 'Urgent',
        badgeBg: 'bg-red-100 dark:bg-red-900/40',
        badgeText: 'text-red-700 dark:text-red-300',
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

// Session storage helpers — persists dismissed broadcast IDs for the
// current session. Cleared on logout (sessionStorage is per-tab/session).
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

    // CRITICAL: dismissedIds is a PERMANENT set for the entire session.
    // IDs are NEVER removed from this set (until logout). This prevents
    // the banner from reappearing when the Convex query refreshes.
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    // dismissingId tracks the currently-animating-out banner (for CSS)
    const [dismissingId, setDismissingId] = useState<string | null>(null);
    // Which banner is in front (index 0 = front, 1 = back)
    const [frontIndex, setFrontIndex] = useState(0);

    const userId = currentUser?._id || (currentUser as any)?.id || '';
    const userIdStr = String(userId);
    const userEmail = currentUser?.email || '';

    const broadcasts = useQuery(api.broadcasts.getActiveBroadcasts,
        isAuthenticated && (userIdStr || userEmail)
            ? { userId: userIdStr, email: userEmail }
            : "skip");

    const userProduct = getUserProduct(currentUser);

    // Load session-dismissed IDs on mount — restores any dismissals
    // from earlier in this session (e.g., after page navigation)
    useEffect(() => {
        setDismissedIds(getSessionDismissed());
    }, []);

    // Filter broadcasts — exclude dismissed IDs PERMANENTLY for this session
    const visibleBroadcasts = useMemo((): any[] => {
        if (!broadcasts || !Array.isArray(broadcasts)) return [];

        const matching = broadcasts.filter((b: any) => {
            // Product targeting
            const targetProduct = b.targetProduct || 'all';
            if (targetProduct !== 'all' && targetProduct !== userProduct) return false;

            // Get the broadcastId (group ID) and notifId (individual row ID)
            const broadcastId = b.link?.context?.broadcastId || b._id;
            const notifId = b._id || b.id;

            // EXCLUDE if this broadcast was dismissed this session.
            // Check BOTH the broadcastId (group) and the notifId (row).
            // This is the critical fix — once dismissed, NEVER show again
            // in this session, even if the query refreshes.
            if (dismissedIds.has(broadcastId)) return false;
            if (dismissedIds.has(notifId)) return false;

            return true;
        });

        return matching.slice(0, MAX_BANNERS);
    }, [broadcasts, userProduct, dismissedIds]);

    // Reset frontIndex if it's out of bounds
    useEffect(() => {
        if (frontIndex >= visibleBroadcasts.length) {
            setFrontIndex(0);
        }
    }, [visibleBroadcasts.length, frontIndex]);

    const handleDismiss = useCallback(async (broadcast: any) => {
        const notifId = broadcast._id || broadcast.id;
        const broadcastId = broadcast.link?.context?.broadcastId;
        const persistenceMode = broadcast.persistenceMode || 'permanent';

        // Mark as dismissing (for upward float animation)
        setDismissingId(notifId);

        // CRITICAL: Add to dismissedIds IMMEDIATELY and PERMANENTLY.
        // This prevents the banner from reappearing when the query refreshes.
        // The ID stays in this set for the entire session.
        setDismissedIds(prev => {
            const next = new Set(prev);
            next.add(notifId);
            if (broadcastId) next.add(broadcastId);
            saveSessionDismissed(next);
            return next;
        });

        // For 'permanent' mode, also mark as read in the DB so it
        // doesn't reappear on next login. For 'session' mode, the
        // sessionStorage entry handles it (cleared on logout).
        if (persistenceMode === 'permanent') {
            try {
                await markAsRead({ ids: [notifId], userEmail: currentUser?.email });
            } catch (e) {
                console.error('[BroadcastBanner] Failed to mark as read:', e);
                // Even if the DB mutation fails, the local dismissedIds
                // set still prevents the banner from showing this session.
            }
        }

        // Clear dismissingId after animation completes
        setTimeout(() => setDismissingId(null), 400);
    }, [markAsRead, currentUser]);

    const handleCycle = useCallback(() => {
        if (visibleBroadcasts.length < 2) return;
        setFrontIndex(prev => (prev + 1) % visibleBroadcasts.length);
    }, [visibleBroadcasts.length]);

    if (visibleBroadcasts.length === 0) return null;

    const frontBroadcast = visibleBroadcasts[frontIndex];
    const backBroadcast = visibleBroadcasts.length > 1
        ? visibleBroadcasts[(frontIndex + 1) % visibleBroadcasts.length]
        : null;

    return (
        <div className="w-full relative" style={{ minHeight: backBroadcast ? '88px' : 'auto' }}>
            {/* Back card — offset behind the front card */}
            {backBroadcast && (
                <div
                    className="absolute inset-0 transition-all duration-300 ease-out"
                    style={{
                        transform: 'translateX(12px) scale(0.97)',
                        opacity: 0.6,
                        zIndex: 1,
                    }}
                >
                    <BannerCard
                        broadcast={backBroadcast}
                        isDismissing={false}
                        onDismiss={() => handleDismiss(backBroadcast)}
                        onAction={() => {}}
                        variant="back"
                    />
                </div>
            )}

            {/* Front card — primary banner */}
            <div
                className={`relative transition-all duration-400 ease-out ${
                    dismissingId === (frontBroadcast._id || frontBroadcast.id)
                        ? 'opacity-0 -translate-y-5'
                        : 'opacity-100 translate-y-0'
                }`}
                style={{ zIndex: 2 }}
            >
                <BannerCard
                    broadcast={frontBroadcast}
                    isDismissing={dismissingId === (frontBroadcast._id || frontBroadcast.id)}
                    onDismiss={() => handleDismiss(frontBroadcast)}
                    onAction={() => {
                        if (frontBroadcast.deepLink) {
                            window.location.hash = frontBroadcast.deepLink;
                        }
                        if (frontBroadcast.persistenceMode !== 'persistent') {
                            handleDismiss(frontBroadcast);
                        }
                    }}
                    variant="front"
                />
            </div>

            {/* Carousel toggle — "1 of 2" + Next button */}
            {visibleBroadcasts.length > 1 && (
                <div className="flex items-center justify-center gap-3 mt-2">
                    <span className="text-2xs font-bold text-slate-400">
                        {frontIndex + 1} of {visibleBroadcasts.length}
                    </span>
                    <button
                        onClick={handleCycle}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    >
                        Next
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
};

// ─── Banner Card Component ────────────────────────────────────────────
const BannerCard: React.FC<{
    broadcast: any;
    isDismissing: boolean;
    onDismiss: () => void;
    onAction: () => void;
    variant: 'front' | 'back';
}> = ({ broadcast, isDismissing, onDismiss, onAction, variant }) => {
    const themeKey = parseTheme(broadcast.type || '');
    const theme = THEME_STYLES[themeKey] || DEFAULT_THEME;
    const persistenceMode = broadcast.persistenceMode || 'permanent';
    const isDismissible = persistenceMode !== 'persistent' && variant === 'front';
    const hasDeepLink = !!broadcast.deepLink;

    return (
        <div
            className={`relative rounded-2xl overflow-hidden shadow-sm border ${variant === 'back' ? 'pointer-events-none' : ''}`}
            style={{
                background: theme.light.bg,
                borderColor: theme.light.border,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
            }}
        >
            <style>{`
                @media (prefers-color-scheme: dark) {
                    .banner-glass-${themeKey}-${variant} {
                        background: ${theme.dark.bg} !important;
                        border-color: ${theme.dark.border} !important;
                    }
                    .banner-glass-${themeKey}-${variant} .icon-wrap { background: ${theme.dark.iconBg} !important; }
                    .banner-glass-${themeKey}-${variant} .icon-svg { color: ${theme.dark.iconColor} !important; }
                    .banner-glass-${themeKey}-${variant} .title-text { color: ${theme.dark.titleColor} !important; }
                    .banner-glass-${themeKey}-${variant} .body-text { color: ${theme.dark.bodyColor} !important; }
                    .banner-glass-${themeKey}-${variant} .action-btn {
                        background: rgba(255,255,255,0.15) !important;
                        color: ${theme.dark.titleColor} !important;
                    }
                    .banner-glass-${themeKey}-${variant} .dismiss-btn { color: ${theme.dark.iconColor} !important; }
                    .banner-glass-${themeKey}-${variant} .dismiss-btn:hover { background: rgba(255,255,255,0.15) !important; }
                }
            `}</style>

            <div className={`banner-glass-${themeKey}-${variant} relative p-4 sm:p-5 flex items-start gap-3 sm:gap-4`}>
                {/* Left accent line — color-coded by urgency */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.light.accent}`} />

                {/* Category Icon */}
                <div
                    className="icon-wrap flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ml-1"
                    style={{ background: theme.light.iconBg }}
                >
                    <svg
                        className="icon-svg w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        style={{ color: theme.light.iconColor }}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d={theme.icon} />
                    </svg>
                </div>

                {/* Content */}
                <div className={`flex-1 min-w-0 ${isDismissible ? 'pr-6' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                        {/* Color-coded urgency badge */}
                        <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${theme.badgeBg} ${theme.badgeText}`}>
                            {theme.label}
                        </span>
                        {persistenceMode === 'persistent' && (
                            <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300">
                                📌 Pinned
                            </span>
                        )}
                    </div>
                    <p
                        className="title-text text-sm font-bold leading-tight"
                        style={{ color: theme.light.titleColor }}
                    >
                        {broadcast.title || 'Platform Announcement'}
                    </p>
                    <p
                        className="body-text text-xs mt-1 leading-relaxed whitespace-pre-wrap break-words"
                        style={{ color: theme.light.bodyColor }}
                    >
                        {broadcast.message || ''}
                    </p>
                    {hasDeepLink && variant === 'front' && (
                        <button
                            onClick={onAction}
                            className="action-btn mt-3 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                            style={{
                                background: 'rgba(0,0,0,0.06)',
                                color: theme.light.titleColor,
                            }}
                        >
                            View Details →
                        </button>
                    )}
                </div>

                {/* Dismiss (X) Button — only for front dismissible banners */}
                {isDismissible && (
                    <button
                        onClick={onDismiss}
                        className="dismiss-btn absolute top-3 right-3 p-1.5 rounded-lg transition-colors flex-shrink-0"
                        style={{ color: theme.light.iconColor }}
                        aria-label="Dismiss"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
};

export default BroadcastBanner;
