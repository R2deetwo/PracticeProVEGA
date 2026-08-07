/**
 * BroadcastBanner — glassmorphic in-content banner for platform broadcasts.
 *
 * PLACEMENT:
 *   This banner is rendered INSIDE the main content canvas (not fixed
 *   at the top of the viewport). It sits below the Overview header
 *   and above the operational grid (Active Matters, Managed Units, etc).
 *   It NEVER overlaps the left sidebar or top navigation.
 *
 * VISUAL STYLE:
 *   Modern glassmorphic design — translucent backdrop with subtle tint
 *   matching the message urgency level, backdrop-blur, ultra-thin border,
 *   and soft ambient shadow. Styled like a refined contextual tip card.
 *
 * BEHAVIOR:
 *   - Stays visible until the user dismisses it (marks as read)
 *   - Color-coded by theme (info=blue, success=green, warning=amber, urgent=red)
 *   - Shows title + message + optional deep-link button
 *   - Dismiss (X) button in top-right corner
 *   - Fades out smoothly on dismiss; lower content shifts up naturally
 *   - Dynamic height — multi-line text pushes down content below
 *
 * PRODUCT TARGETING:
 *   The banner checks the notification's link.context.targetProduct
 *   against the current user's product. A broadcast sent to 'all' shows
 *   for everyone; a broadcast sent to 'unified' (Komplete) shows only
 *   for Komplete users.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { useCoreState } from '../contexts/CoreContext';

// Glassmorphic theme styles — translucent tints with backdrop blur.
// Each theme has a light-mode and dark-mode tint.
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

/**
 * Resolve the user's product from their record.
 * Normalizes: 'komplete' → 'unified', 'vega' → 'legal', 'atrium' → 'property'
 */
function getUserProduct(user: any): string {
    const product = (user?.product || '').toLowerCase();
    if (product === 'komplete' || product === 'unified') return 'unified';
    if (product === 'vega' || product === 'legal') return 'legal';
    if (product === 'atrium' || product === 'property') return 'property';
    return 'unified'; // default
}

export const BroadcastBanner: React.FC = () => {
    const { currentUser, isAuthenticated } = useAuth();
    const { coreState } = useCoreState();
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissing, setIsDismissing] = useState(false);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    const markAsRead = useMutation(api.myFunctions.markNotificationsAsRead);

    const notifications: any[] = (coreState?.notifications as any[]) || [];

    const userProduct = getUserProduct(currentUser);

    // Find the most recent unread broadcast notification for this user
    // that matches their product (or was sent to 'all')
    const broadcastNotif = useMemo((): any | null => {
        if (!isAuthenticated || !currentUser) return null;
        const userId = currentUser._id || (currentUser as any).id || '';
        const userIdStr = String(userId);

        const broadcasts = notifications.filter((n: any) => {
            const isBroadcast = (n.type || '').startsWith('broadcast_');
            if (!isBroadcast) return false;
            if (n.isRead) return false;
            if (dismissedIds.has(n._id || n.id)) return false;

            // Match by userId OR include if it has no specific userId
            const nUserId = String(n.userId || '');
            if (nUserId !== userIdStr && nUserId !== '' && nUserId !== 'undefined') {
                return false;
            }

            // PRODUCT TARGETING: Check if this broadcast applies to the
            // current user's product. The targetProduct is stored in
            // link.context.targetProduct. If it's 'all', show to everyone.
            // If it matches the user's product, show it. Otherwise, hide.
            const targetProduct = n.link?.context?.targetProduct || 'all';
            if (targetProduct === 'all') return true;
            return targetProduct === userProduct;
        });

        if (broadcasts.length === 0) return null;

        // Sort by timestamp descending (most recent first)
        broadcasts.sort((a: any, b: any) => {
            const tsA = new Date(a.timestamp || a._creationTime || 0).getTime();
            const tsB = new Date(b.timestamp || b._creationTime || 0).getTime();
            return tsB - tsA;
        });
        return broadcasts[0];
    }, [notifications, isAuthenticated, currentUser, dismissedIds, userProduct]);

    // Animate in when a broadcast appears
    useEffect(() => {
        if (broadcastNotif && !isDismissing) {
            const timer = setTimeout(() => setIsVisible(true), 50);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [broadcastNotif, isDismissing]);

    if (!broadcastNotif) return null;

    const themeKey = parseTheme(broadcastNotif.type || '');
    const theme = THEME_STYLES[themeKey] || DEFAULT_THEME;
    const notifId = broadcastNotif._id || broadcastNotif.id;

    const handleDismiss = async () => {
        // Smooth fade-out animation
        setIsDismissing(true);
        setIsVisible(false);
        // Wait for animation to complete before removing
        setTimeout(() => {
            setDismissedIds(prev => new Set(prev).add(notifId));
            setIsDismissing(false);
        }, 300);

        // Mark as read in the backend
        try {
            await markAsRead({ ids: [notifId], userEmail: currentUser?.email });
        } catch (e) {
            console.error('[BroadcastBanner] Failed to mark as read:', e);
        }
    };

    const handleAction = () => {
        const link = (broadcastNotif as any).link;
        if (link?.context?.deepLink) {
            window.location.hash = link.context.deepLink;
        }
        handleDismiss();
    };

    const hasDeepLink = !!(broadcastNotif as any).link?.context?.deepLink;

    return (
        <div
            className={`w-full transition-all duration-300 ease-out ${
                isVisible && !isDismissing
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 -translate-y-2 pointer-events-none'
            }`}
        >
            <div
                className="relative rounded-2xl overflow-hidden shadow-sm border"
                style={{
                    background: theme.light.bg,
                    borderColor: theme.light.border,
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                }}
            >
                {/* Dark mode styles via class override */}
                <style>{`
                    @media (prefers-color-scheme: dark) {
                        .broadcast-glass-banner {
                            background: ${theme.dark.bg} !important;
                            border-color: ${theme.dark.border} !important;
                        }
                        .broadcast-glass-banner .broadcast-icon-wrap {
                            background: ${theme.dark.iconBg} !important;
                        }
                        .broadcast-glass-banner .broadcast-icon { color: ${theme.dark.iconColor} !important; }
                        .broadcast-glass-banner .broadcast-title { color: ${theme.dark.titleColor} !important; }
                        .broadcast-glass-banner .broadcast-body { color: ${theme.dark.bodyColor} !important; }
                        .broadcast-glass-banner .broadcast-action {
                            background: rgba(255,255,255,0.15) !important;
                            color: ${theme.dark.titleColor} !important;
                        }
                        .broadcast-glass-banner .broadcast-action:hover {
                            background: rgba(255,255,255,0.25) !important;
                        }
                        .broadcast-glass-banner .broadcast-dismiss {
                            color: ${theme.dark.iconColor} !important;
                        }
                        .broadcast-glass-banner .broadcast-dismiss:hover {
                            background: rgba(255,255,255,0.15) !important;
                        }
                    }
                `}</style>

                <div className="broadcast-glass-banner relative p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
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
                    <div className="flex-1 min-w-0 pr-6">
                        <p
                            className="broadcast-title text-sm font-bold leading-tight"
                            style={{ color: theme.light.titleColor }}
                        >
                            {broadcastNotif.title || 'Platform Announcement'}
                        </p>
                        <p
                            className="broadcast-body text-xs mt-1 leading-relaxed whitespace-pre-wrap break-words"
                            style={{ color: theme.light.bodyColor }}
                        >
                            {broadcastNotif.message || ''}
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

                    {/* Right: Dismiss (X) Button */}
                    <button
                        onClick={handleDismiss}
                        className="broadcast-dismiss absolute top-3 right-3 p-1.5 rounded-lg transition-colors flex-shrink-0"
                        style={{ color: theme.light.iconColor }}
                        aria-label="Dismiss"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Accent bar at bottom */}
                <div className={`h-0.5 ${theme.light.accent}`} />
            </div>
        </div>
    );
};

export default BroadcastBanner;
