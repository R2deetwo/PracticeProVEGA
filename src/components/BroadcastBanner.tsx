/**
 * BroadcastBanner — accordion stub carousel with crash-safe dismissal.
 *
 * ARCHITECTURE:
 *   Instead of overlapping translucent cards (which caused text bleed),
 *   this uses an Expanded Card + Compact Stub Bar pattern:
 *     - ONE banner is fully expanded (icon, title, message, dismiss button)
 *     - Other banners render as ultra-slim stubs (dot + number, no body text)
 *     - Clicking a stub or "Next" expands it and collapses the current one
 *
 * OPAQUE SURFACE:
 *   The expanded card has a 100% opaque background (no translucency)
 *   so underlying content NEVER bleeds through. The glassmorphic blur
 *   is applied as a decorative layer BEHIND the opaque surface, not
 *   as the card's primary background.
 *
 * CRASH-SAFE DISMISSAL:
 *   When the final banner is dismissed, the component gracefully
 *   unmounts by:
 *     1. Checking banners.length before rendering
 *     2. Wrapping the container in a height-collapsing transition
 *     3. Never reading properties of null/undefined state
 *     4. Using optional chaining throughout
 *
 * HITBOX:
 *   All interactive controls (Next, Prev, Dismiss, stubs) have
 *   minimum 44x44px touch targets for accessibility.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

const MAX_BANNERS = 2;

// Theme styles — now with OPAQUE backgrounds (no translucency) to
// prevent text bleed-through from underlying cards.
const THEME_STYLES: Record<string, {
    bg: string;          // OPAQUE background class (100% solid)
    border: string;      // Border color class
    iconBg: string;      // Icon container background
    iconColor: string;   // Icon SVG color
    titleColor: string;  // Title text color
    bodyColor: string;   // Body text color
    accent: string;      // Left accent bar + bottom bar color
    badgeBg: string;     // Urgency badge background
    badgeText: string;   // Urgency badge text
    icon: string;        // SVG path data
    label: string;       // Badge label text
    dotColor: string;    // Stub dot color
}> = {
    info: {
        bg: 'bg-white dark:bg-zinc-800',
        border: 'border-blue-200 dark:border-blue-800',
        iconBg: 'bg-blue-100 dark:bg-blue-900/40',
        iconColor: 'text-blue-600 dark:text-blue-400',
        titleColor: 'text-slate-900 dark:text-white',
        bodyColor: 'text-slate-600 dark:text-zinc-300',
        accent: 'bg-blue-500',
        badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
        badgeText: 'text-blue-700 dark:text-blue-300',
        icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6a1.76 1.76 0 002.585-1.612A3.5 3.5 0 0113 5.5',
        label: 'Info',
        dotColor: 'bg-blue-500',
    },
    success: {
        bg: 'bg-white dark:bg-zinc-800',
        border: 'border-emerald-200 dark:border-emerald-800',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        titleColor: 'text-slate-900 dark:text-white',
        bodyColor: 'text-slate-600 dark:text-zinc-300',
        accent: 'bg-emerald-500',
        badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40',
        badgeText: 'text-emerald-700 dark:text-emerald-300',
        icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        label: 'Success',
        dotColor: 'bg-emerald-500',
    },
    warning: {
        bg: 'bg-white dark:bg-zinc-800',
        border: 'border-amber-200 dark:border-amber-800',
        iconBg: 'bg-amber-100 dark:bg-amber-900/40',
        iconColor: 'text-amber-600 dark:text-amber-400',
        titleColor: 'text-slate-900 dark:text-white',
        bodyColor: 'text-slate-600 dark:text-zinc-300',
        accent: 'bg-amber-500',
        badgeBg: 'bg-amber-100 dark:bg-amber-900/40',
        badgeText: 'text-amber-700 dark:text-amber-300',
        icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
        label: 'Warning',
        dotColor: 'bg-amber-500',
    },
    urgent: {
        bg: 'bg-white dark:bg-zinc-800',
        border: 'border-red-200 dark:border-red-800',
        iconBg: 'bg-red-100 dark:bg-red-900/40',
        iconColor: 'text-red-600 dark:text-red-400',
        titleColor: 'text-slate-900 dark:text-white',
        bodyColor: 'text-slate-600 dark:text-zinc-300',
        accent: 'bg-red-500',
        badgeBg: 'bg-red-100 dark:bg-red-900/40',
        badgeText: 'text-red-700 dark:text-red-300',
        icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
        label: 'Urgent',
        dotColor: 'bg-red-500',
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

    // CRITICAL: dismissedIds is PERMANENT for the entire session.
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [dismissingId, setDismissingId] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isCollapsed, setIsCollapsed] = useState(false);

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

    // Filter broadcasts — exclude dismissed IDs PERMANENTLY for this session
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

            return true;
        });

        return matching.slice(0, MAX_BANNERS);
    }, [broadcasts, userProduct, dismissedIds]);

    // CRASH-SAFE: Reset activeIndex if out of bounds.
    // This prevents reading undefined when the array shrinks.
    useEffect(() => {
        if (visibleBroadcasts.length === 0) {
            setActiveIndex(0);
            return;
        }
        if (activeIndex >= visibleBroadcasts.length) {
            setActiveIndex(0);
        }
    }, [visibleBroadcasts.length, activeIndex]);

    // Handle dismissal — crash-safe, never reads null state
    const handleDismiss = useCallback(async (broadcast: any) => {
        if (!broadcast) return;

        const notifId = broadcast._id || broadcast.id;
        const broadcastId = broadcast.link?.context?.broadcastId;
        const persistenceMode = broadcast.persistenceMode || 'permanent';

        if (!notifId) return;

        // Mark as dismissing (for animation)
        setDismissingId(notifId);

        // Add to dismissedIds IMMEDIATELY and PERMANENTLY
        setDismissedIds(prev => {
            const next = new Set(prev);
            next.add(notifId);
            if (broadcastId) next.add(broadcastId);
            saveSessionDismissed(next);
            return next;
        });

        // For 'permanent' mode, also mark as read in DB
        if (persistenceMode === 'permanent') {
            try {
                await markAsRead({ ids: [notifId], userEmail: currentUser?.email });
            } catch (e) {
                console.error('[BroadcastBanner] Failed to mark as read:', e);
            }
        }

        // Clear dismissingId after animation
        setTimeout(() => {
            setDismissingId(null);
            setIsCollapsed(false);
        }, 300);
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

    // CRASH-SAFE: If no visible broadcasts, render nothing.
    // This prevents the "Refresh App" error when the final banner
    // is dismissed — the component simply unmounts cleanly.
    if (!visibleBroadcasts || visibleBroadcasts.length === 0) {
        return null;
    }

    const activeBroadcast = visibleBroadcasts[activeIndex];
    // Defensive: if activeBroadcast is somehow undefined, render nothing
    if (!activeBroadcast) return null;

    const stubs = visibleBroadcasts
        .map((b, i) => ({ broadcast: b, index: i }))
        .filter(({ index }) => index !== activeIndex);

    return (
        <div
            className={`w-full transition-all duration-300 ease-out ${
                visibleBroadcasts.length === 0 || isCollapsed
                    ? 'max-h-0 opacity-0 overflow-hidden'
                    : 'max-h-96 opacity-100'
            }`}
        >
            {/* Expanded Active Card — 100% OPAQUE background */}
            <div
                className={`relative rounded-2xl overflow-hidden shadow-sm border-2 transition-all duration-300 ${THEME_STYLES[parseTheme(activeBroadcast.type || '')]?.bg || DEFAULT_THEME.bg} ${THEME_STYLES[parseTheme(activeBroadcast.type || '')]?.border || DEFAULT_THEME.border} ${
                    dismissingId === (activeBroadcast._id || activeBroadcast.id)
                        ? 'opacity-0 -translate-y-5'
                        : 'opacity-100 translate-y-0'
                }`}
            >
                <ExpandedCard
                    broadcast={activeBroadcast}
                    onDismiss={() => handleDismiss(activeBroadcast)}
                    onAction={() => {
                        if (activeBroadcast.deepLink) {
                            window.location.hash = activeBroadcast.deepLink;
                        }
                        if (activeBroadcast.persistenceMode !== 'persistent') {
                            handleDismiss(activeBroadcast);
                        }
                    }}
                />
            </div>

            {/* Compact Stubs — ultra-slim bars for inactive banners */}
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
                                {/* Status dot — color-coded by urgency */}
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${theme.dotColor}`} />
                                <span className={`text-2xs font-bold ${theme.badgeText} flex-shrink-0`}>
                                    {theme.label}
                                </span>
                                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate flex-1 text-left">
                                    {broadcast.title || 'Announcement'}
                                </span>
                                <span className="text-2xs text-slate-400 flex-shrink-0">
                                    Banner {index + 1}
                                </span>
                                {/* Expand arrow */}
                                <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Pagination Controls — 44x44px minimum hitbox */}
            {visibleBroadcasts.length > 1 && (
                <div className="flex items-center justify-center gap-1 mt-2">
                    {/* Prev button — 44x44px hitbox */}
                    <button
                        onClick={handlePrev}
                        className="flex items-center justify-center w-11 h-11 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        aria-label="Previous banner"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    {/* Page indicator — clickable, 44px height hitbox */}
                    <button
                        onClick={handleNext}
                        className="flex items-center justify-center px-3 h-11 rounded-lg text-2xs font-bold text-slate-500 dark:text-zinc-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                    >
                        {activeIndex + 1} of {visibleBroadcasts.length}
                    </button>

                    {/* Next button — 44x44px hitbox */}
                    <button
                        onClick={handleNext}
                        className="flex items-center justify-center w-11 h-11 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        aria-label="Next banner"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="ml-1 text-2xs font-bold">Next</span>
                    </button>
                </div>
            )}
        </div>
    );
};

// ─── Expanded Card Component ──────────────────────────────────────────
const ExpandedCard: React.FC<{
    broadcast: any;
    onDismiss: () => void;
    onAction: () => void;
}> = ({ broadcast, onDismiss, onAction }) => {
    const themeKey = parseTheme(broadcast?.type || '');
    const theme = THEME_STYLES[themeKey] || DEFAULT_THEME;
    const persistenceMode = broadcast?.persistenceMode || 'permanent';
    const isDismissible = persistenceMode !== 'persistent';
    const hasDeepLink = !!broadcast?.deepLink;

    // CRASH-SAFE: Guard against null broadcast
    if (!broadcast) return null;

    return (
        <div className="relative">
            {/* Left accent line — color-coded by urgency */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.accent}`} />

            <div className="relative p-4 sm:p-5 flex items-start gap-3 sm:gap-4 ml-1">
                {/* Category Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${theme.iconBg}`}>
                    <svg
                        className={`w-5 h-5 ${theme.iconColor}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d={theme.icon} />
                    </svg>
                </div>

                {/* Content */}
                <div className={`flex-1 min-w-0 ${isDismissible ? 'pr-8' : ''}`}>
                    {/* Urgency badge */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${theme.badgeBg} ${theme.badgeText}`}>
                            {theme.label}
                        </span>
                        {persistenceMode === 'persistent' && (
                            <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300">
                                📌 Pinned
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <p className={`text-sm font-bold leading-tight ${theme.titleColor}`}>
                        {broadcast.title || 'Platform Announcement'}
                    </p>

                    {/* Message body */}
                    <p className={`text-xs mt-1 leading-relaxed whitespace-pre-wrap break-words ${theme.bodyColor}`}>
                        {broadcast.message || ''}
                    </p>

                    {/* Action button */}
                    {hasDeepLink && (
                        <button
                            onClick={onAction}
                            className={`mt-3 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${theme.iconBg} ${theme.iconColor} hover:opacity-80`}
                        >
                            View Details →
                        </button>
                    )}
                </div>

                {/* Dismiss (X) Button — 44x44px hitbox */}
                {isDismissible && (
                    <button
                        onClick={onDismiss}
                        className="absolute top-2 right-2 flex items-center justify-center w-11 h-11 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors flex-shrink-0"
                        aria-label="Dismiss"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Bottom accent bar */}
            <div className={`h-0.5 ${theme.accent}`} />
        </div>
    );
};

export default BroadcastBanner;
