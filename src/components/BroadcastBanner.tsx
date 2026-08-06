/**
 * BroadcastBanner — persistent banner for platform-wide broadcasts.
 *
 * WHEN SHOWN:
 *   When the founder sends a broadcast via the admin APK, a notification
 *   with type `broadcast_<theme>` is created for every matching user.
 *   This component watches for UNREAD broadcast notifications and shows
 *   the most recent one as a persistent banner at the top of the screen.
 *
 * BEHAVIOR:
 *   - Stays visible until the user dismisses it (marks as read)
 *   - Color-coded by theme (info=blue, success=green, warning=amber, urgent=red)
 *   - Shows title + message + optional deep-link button
 *   - Only one banner at a time (most recent unread)
 *   - Does NOT show on landing page or login (only when authenticated)
 *   - Animates in from the top with a slide-down effect
 *
 * WHY A BANNER (not a toast):
 *   The existing toast system auto-dismisses after 5 seconds. Broadcasts
 *   are important announcements that should stay visible until the user
 *   acknowledges them. A persistent banner is the standard pattern for
 *   this (cf. Slack #announce banners, GitHub org-wide announcements).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { useCoreState } from '../contexts/CoreContext';

// Theme styles — mirrors BroadcastConsole.tsx in the admin app
const THEME_STYLES: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    info:    { bg: 'bg-blue-600',     border: 'border-blue-700',     text: 'text-white',  icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6a1.76 1.76 0 002.585-1.612A3.5 3.5 0 0113 5.5' },
    success: { bg: 'bg-emerald-600',  border: 'border-emerald-700',  text: 'text-white',  icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    warning: { bg: 'bg-amber-600',    border: 'border-amber-700',    text: 'text-white',  icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' },
    urgent:  { bg: 'bg-red-600',      border: 'border-red-700',      text: 'text-white',  icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z' },
};

const DEFAULT_THEME = { bg: 'bg-slate-800', border: 'border-slate-900', text: 'text-white', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6' };

// Parse the broadcast theme from the notification type.
// Backend stores type as `broadcast_<theme>` (e.g., `broadcast_urgent`).
function parseTheme(type: string): string {
    if (!type || !type.startsWith('broadcast_')) return 'info';
    return type.replace('broadcast_', '') || 'info';
}

export const BroadcastBanner: React.FC = () => {
    const { currentUser, isAuthenticated } = useAuth();
    const { coreState } = useCoreState();
    const [isVisible, setIsVisible] = useState(false);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    // Mutation to mark notification as read (dismiss)
    const markAsRead = useMutation(api.myFunctions.markNotificationsAsRead);

    const notifications: any[] = (coreState?.notifications as any[]) || [];

    // Find the most recent unread broadcast notification for this user
    const broadcastNotif = useMemo((): any | null => {
        if (!isAuthenticated || !currentUser) return null;
        const userId = currentUser._id || (currentUser as any).id || '';
        const userIdStr = String(userId);
        const broadcasts = notifications.filter((n: any) => {
            const isBroadcast = (n.type || '').startsWith('broadcast_');
            if (!isBroadcast) return false;
            if (n.isRead) return false;
            if (dismissedIds.has(n._id || n.id)) return false;
            // Broadcast notifications are for ALL users in the firm
            // (the backend creates one per user). Match by userId OR
            // include if it has no specific userId (legacy format).
            const nUserId = String(n.userId || '');
            return nUserId === userIdStr || nUserId === '' || nUserId === 'undefined';
        });
        if (broadcasts.length === 0) return null;
        // Sort by timestamp descending (most recent first)
        broadcasts.sort((a: any, b: any) => {
            const tsA = new Date(a.timestamp || a._creationTime || 0).getTime();
            const tsB = new Date(b.timestamp || b._creationTime || 0).getTime();
            return tsB - tsA;
        });
        return broadcasts[0];
    }, [notifications, isAuthenticated, currentUser, dismissedIds]);

    // Animate in when a broadcast appears
    useEffect(() => {
        if (broadcastNotif) {
            const timer = setTimeout(() => setIsVisible(true), 100);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [broadcastNotif]);

    if (!broadcastNotif) return null;

    const themeKey = parseTheme(broadcastNotif.type || '');
    const theme = THEME_STYLES[themeKey] || DEFAULT_THEME;
    const notifId = broadcastNotif._id || broadcastNotif.id;

    const handleDismiss = async () => {
        // Optimistically hide the banner
        setIsVisible(false);
        // Add to dismissed set so it doesn't reappear before the mutation completes
        setDismissedIds(prev => new Set(prev).add(notifId));
        // Mark as read in the backend
        try {
            await markAsRead({ ids: [notifId], userEmail: currentUser?.email });
        } catch (e) {
            console.error('[BroadcastBanner] Failed to mark as read:', e);
        }
    };

    const handleAction = () => {
        // If there's a deep link, navigate to it
        const link = (broadcastNotif as any).link;
        if (link?.context?.deepLink) {
            window.location.hash = link.context.deepLink;
        }
        handleDismiss();
    };

    const hasDeepLink = !!(broadcastNotif as any).link?.context?.deepLink;

    return (
        <div
            className={`fixed top-0 left-0 right-0 z-[9998] transition-transform duration-300 ease-out ${
                isVisible ? 'translate-y-0' : '-translate-y-full'
            }`}
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
            <div className={`${theme.bg} ${theme.border} border-b shadow-lg`}>
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                        <svg className={`w-5 h-5 ${theme.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={theme.icon} />
                        </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${theme.text}`}>
                            {broadcastNotif.title || 'Platform Announcement'}
                        </p>
                        <p className={`text-xs ${theme.text} opacity-90 mt-0.5 line-clamp-2`}>
                            {broadcastNotif.message || ''}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {hasDeepLink && (
                            <button
                                onClick={handleAction}
                                className={`px-3 py-1 rounded-lg text-xs font-bold ${theme.text} bg-white/20 hover:bg-white/30 transition-colors`}
                            >
                                View
                            </button>
                        )}
                        <button
                            onClick={handleDismiss}
                            className={`p-1 rounded-lg ${theme.text} hover:bg-white/20 transition-colors`}
                            aria-label="Dismiss"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BroadcastBanner;
