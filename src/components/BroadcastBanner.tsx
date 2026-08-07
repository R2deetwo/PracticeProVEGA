/**
 * BroadcastBanner — multi-banner cascading glassmorphic banner system.
 *
 * FEATURES:
 *   - Multi-banner stacking (max 2 banners visible simultaneously)
 *   - Cascading visual stack — primary banner upfront, secondary offset
 *   - Smooth layout height restoration on dismissal (CSS transitions)
 *   - Persistence modes:
 *       'permanent'  — dismiss is saved to DB (isRead=true), never shows again
 *       'session'    — dismiss is saved to sessionStorage, reappears on re-login
 *       'persistent' — no dismiss button, stays until archived by admin
 *   - Per-broadcast dismissal (scoped by broadcastId, not global)
 *   - Real-time subscription via getActiveBroadcasts query
 *   - Glassmorphic styling with backdrop blur
 *
 * PLACEMENT:
 *   Rendered inside the Dashboard's main content container, below the
 *   Overview header, above the stats grid. Never overlaps the left
 *   sidebar or top navigation. Same width as the Overview section.
 *
 * LAYOUT RESTORATION:
 *   When a banner is dismissed, its container smoothly collapses using
 *   CSS max-height + opacity + margin transitions. The lower dashboard
 *   sections shift up seamlessly without layout pop.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

// Maximum number of banners to show simultaneously
const MAX_BANNERS = 2;

// Glassmorphic theme styles
const THEME_STYLES: Record<string, {
    light: { bg: string; border: string; iconBg: string; iconColor: string; titleColor: string; bodyColor: string; accent: string };
    dark: { bg: string; border: string; iconBg: string; iconColor: string; titleColor: string; bodyColor: string; accent: string };
    icon: string;
}> = {
    info: {
        light: { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)', iconBg: 'rgba(59, 130, 246, 0.12)', iconColor: '#2563eb', titleColor: '#1e3a8a', bodyColor: '#1e40af', accent: 'bg-blue-500' },
        dark: { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(96, 165, 250, 0.25)', iconBg: 'rgba(59, 130, 246, 0.2)', iconColor: '#93c5fd', titleColor: '#bfdbfe', bodyColor: '#dbeafe', accent: 'bg-blue-400' },
        icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6a1.76 1.76 0 002.585-1.612A3.5 3.5 0 0113 5.5',
    },
    success: {
        light: { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)', iconBg: 'rgba(16, 185, 129, 0.12)', iconColor: '#059669', titleColor: '#064e3b', bodyColor: '#065f46', accent: 'bg-emerald-500' },
        dark: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(52, 211, 153, 0.25)', iconBg: 'rgba(16, 185, 129, 0.2)', iconColor: '#6ee7b7', titleColor: '#a7f3d0', bodyColor: '#d1fae5', accent: 'bg-emerald-400' },
        icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    warning: {
        light: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', iconBg: 'rgba(245, 158, 11, 0.12)', iconColor: '#d97706', titleColor: '#78350f', bodyColor: '#92400e', accent: 'bg-amber-500' },
        dark: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(251, 191, 36, 0.25)', iconBg: 'rgba(245, 158, 11, 0.2)', iconColor: '#fcd34d', titleColor: '#fde68a', bodyColor: '#fef3c7', accent: 'bg-amber-400' },
        icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
    },
    urgent: {
        light: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', iconBg: 'rgba(239, 68, 68, 0.12)', iconColor: '#dc2626', titleColor: '#7f1d1d', bodyColor: '#991b1b', accent: 'bg-red-500' },
        dark: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(248, 113, 113, 0.25)', iconBg: 'rgba(239, 68, 68, 0.2)', iconColor: '#fca5a5', titleColor: '#fecaca', bodyColor: '#fee2e2', accent: 'bg-red-400' },
        icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
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

/**
 * Get session-dismissed broadcast IDs from sessionStorage.
 * These are broadcasts dismissed with 'session' persistence mode —
 * they reappear on next login (when sessionStorage is cleared).
 */
function getSessionDismissed(): Set<string> {
    try {
        const raw = sessionStorage.getItem('dismissed_broadcasts_session');
        if (!raw) return new Set();
        return new Set(JSON.parse(raw));
    } catch {
        return new Set();
    }
}

function addSessionDismissed(broadcastId: string) {
    try {
        const existing = getSessionDismissed();
        existing.add(broadcastId);
        sessionStorage.setItem('dismissed_broadcasts_session', JSON.stringify([...existing]));
    } catch {}
}

export const BroadcastBanner: React.FC = () => {
    const { currentUser, isAuthenticated } = useAuth();
    const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
    const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(new Set());

    const markAsRead = useMutation(api.myFunctions.markNotificationsAsRead);

    const userId = currentUser?._id || (currentUser as any)?.id || '';
    const userIdStr = String(userId);
    const userEmail = currentUser?.email || '';

    // Real-time subscription
    const broadcasts = useQuery(api.broadcasts.getActiveBroadcasts,
        isAuthenticated && (userIdStr || userEmail)
            ? { userId: userIdStr, email: userEmail }
            : "skip");

    const userProduct = getUserProduct(currentUser);

    // Load session-dismissed IDs on mount
    useEffect(() => {
        setSessionDismissed(getSessionDismissed());
    }, []);

    // Filter and sort broadcasts — max 2 visible
    const visibleBroadcasts = useMemo((): any[] => {
        if (!broadcasts || !Array.isArray(broadcasts)) return [];

        const matching = broadcasts.filter((b: any) => {
            // Product targeting
            const targetProduct = b.targetProduct || 'all';
            if (targetProduct !== 'all' && targetProduct !== userProduct) return false;

            // Check persistence mode for dismissal logic
            const persistenceMode = b.persistenceMode || 'permanent';
            const broadcastId = b.link?.context?.broadcastId || b._id;

            // Session-dismissed: skip if dismissed this session
            if (persistenceMode === 'session' && sessionDismissed.has(broadcastId)) return false;

            // Permanent-dismissed: handled by isRead in the query (already filtered)
            // Persistent mode: never dismissible, always shows

            // Currently dismissing (animation in progress)
            if (dismissingIds.has(b._id || b.id)) return false;

            return true;
        });

        // Already sorted by timestamp desc — take top MAX_BANNERS
        return matching.slice(0, MAX_BANNERS);
    }, [broadcasts, userProduct, sessionDismissed, dismissingIds]);

    if (visibleBroadcasts.length === 0) return null;

    return (
        <div className="w-full space-y-2">
            {visibleBroadcasts.map((broadcast, index) => {
                const isPrimary = index === 0;
                return (
                    <SingleBanner
                        key={broadcast._id || broadcast.id}
                        broadcast={broadcast}
                        isPrimary={isPrimary}
                        isDismissing={dismissingIds.has(broadcast._id || broadcast.id)}
                        onDismiss={async () => {
                            const notifId = broadcast._id || broadcast.id;
                            const persistenceMode = broadcast.persistenceMode || 'permanent';
                            const broadcastId = broadcast.link?.context?.broadcastId;

                            // Mark as dismissing (for animation)
                            setDismissingIds(prev => new Set(prev).add(notifId));

                            // Handle dismissal based on persistence mode
                            if (persistenceMode === 'session') {
                                // Session dismissal — save to sessionStorage only
                                if (broadcastId) addSessionDismissed(broadcastId);
                                setSessionDismissed(prev => new Set(prev).add(broadcastId || notifId));
                                // Remove from dismissing after animation
                                setTimeout(() => {
                                    setDismissingIds(prev => {
                                        const next = new Set(prev);
                                        next.delete(notifId);
                                        return next;
                                    });
                                }, 300);
                            } else if (persistenceMode === 'permanent') {
                                // Permanent dismissal — mark as read in DB
                                try {
                                    await markAsRead({ ids: [notifId], userEmail: currentUser?.email });
                                } catch (e) {
                                    console.error('[BroadcastBanner] Failed to mark as read:', e);
                                }
                                setTimeout(() => {
                                    setDismissingIds(prev => {
                                        const next = new Set(prev);
                                        next.delete(notifId);
                                        return next;
                                    });
                                }, 300);
                            }
                            // 'persistent' mode: no dismiss button shown, so this won't be called
                        }}
                        currentUser={currentUser}
                    />
                );
            })}
        </div>
    );
};

// ─── Single Banner Component ──────────────────────────────────────────
const SingleBanner: React.FC<{
    broadcast: any;
    isPrimary: boolean;
    isDismissing: boolean;
    onDismiss: () => void;
    currentUser: any;
}> = ({ broadcast, isPrimary, isDismissing, onDismiss, currentUser }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!isDismissing) {
            const timer = setTimeout(() => setIsVisible(true), 50);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [isDismissing]);

    const themeKey = parseTheme(broadcast.type || '');
    const theme = THEME_STYLES[themeKey] || DEFAULT_THEME;
    const persistenceMode = broadcast.persistenceMode || 'permanent';
    const isDismissible = persistenceMode !== 'persistent';
    const hasDeepLink = !!broadcast.deepLink;

    const handleAction = () => {
        if (broadcast.deepLink) {
            window.location.hash = broadcast.deepLink;
        }
        if (persistenceMode !== 'persistent') {
            onDismiss();
        }
    };

    return (
        <div
            className={`w-full transition-all duration-300 ease-out overflow-hidden ${
                isVisible && !isDismissing
                    ? 'opacity-100 max-h-96'
                    : 'opacity-0 max-h-0'
            }`}
            style={{
                marginTop: isDismissing ? '-0.5rem' : '0',
                marginBottom: isDismissing ? '-0.5rem' : '0',
            }}
        >
            <div
                className={`relative rounded-2xl overflow-hidden shadow-sm border ${isPrimary ? '' : 'opacity-90 scale-[0.98]'}`}
                style={{
                    background: theme.light.bg,
                    borderColor: theme.light.border,
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                }}
            >
                <style>{`
                    @media (prefers-color-scheme: dark) {
                        .broadcast-glass-banner-${themeKey} {
                            background: ${theme.dark.bg} !important;
                            border-color: ${theme.dark.border} !important;
                        }
                        .broadcast-glass-banner-${themeKey} .broadcast-icon-wrap {
                            background: ${theme.dark.iconBg} !important;
                        }
                        .broadcast-glass-banner-${themeKey} .broadcast-icon { color: ${theme.dark.iconColor} !important; }
                        .broadcast-glass-banner-${themeKey} .broadcast-title { color: ${theme.dark.titleColor} !important; }
                        .broadcast-glass-banner-${themeKey} .broadcast-body { color: ${theme.dark.bodyColor} !important; }
                        .broadcast-glass-banner-${themeKey} .broadcast-action {
                            background: rgba(255,255,255,0.15) !important;
                            color: ${theme.dark.titleColor} !important;
                        }
                        .broadcast-glass-banner-${themeKey} .broadcast-action:hover {
                            background: rgba(255,255,255,0.25) !important;
                        }
                        .broadcast-glass-banner-${themeKey} .broadcast-dismiss {
                            color: ${theme.dark.iconColor} !important;
                        }
                        .broadcast-glass-banner-${themeKey} .broadcast-dismiss:hover {
                            background: rgba(255,255,255,0.15) !important;
                        }
                    }
                `}</style>

                <div className={`broadcast-glass-banner-${themeKey} relative p-4 sm:p-5 flex items-start gap-3 sm:gap-4`}>
                    {/* Left: Category Icon */}
                    <div
                        className="broadcast-icon-wrap flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: theme.light.iconBg }}
                    >
                        <svg
                            className="broadcast-icon w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            style={{ color: theme.light.iconColor }}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d={theme.icon} />
                        </svg>
                    </div>

                    {/* Center: Content */}
                    <div className={`flex-1 min-w-0 ${isDismissible ? 'pr-6' : ''}`}>
                        <p
                            className="broadcast-title text-sm font-bold leading-tight"
                            style={{ color: theme.light.titleColor }}
                        >
                            {broadcast.title || 'Platform Announcement'}
                        </p>
                        <p
                            className="broadcast-body text-xs mt-1 leading-relaxed whitespace-pre-wrap break-words"
                            style={{ color: theme.light.bodyColor }}
                        >
                            {broadcast.message || ''}
                        </p>
                        {hasDeepLink && (
                            <button
                                onClick={handleAction}
                                className="broadcast-action mt-3 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                style={{
                                    background: 'rgba(0,0,0,0.06)',
                                    color: theme.light.titleColor,
                                }}
                            >
                                View Details →
                            </button>
                        )}
                    </div>

                    {/* Right: Dismiss (X) Button — only for dismissible banners */}
                    {isDismissible && (
                        <button
                            onClick={onDismiss}
                            className="broadcast-dismiss absolute top-3 right-3 p-1.5 rounded-lg transition-colors flex-shrink-0"
                            style={{ color: theme.light.iconColor }}
                            aria-label="Dismiss"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}

                    {/* Persistent badge for non-dismissible banners */}
                    {!isDismissible && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/10 text-2xs font-bold" style={{ color: theme.light.iconColor }}>
                            📌 Pinned
                        </div>
                    )}
                </div>

                {/* Accent bar at bottom */}
                <div className={`h-0.5 ${theme.light.accent}`} />
            </div>
        </div>
    );
};

export default BroadcastBanner;
