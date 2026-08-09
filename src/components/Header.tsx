
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Theme, Notification, UserRole } from '../types';
import { SearchIcon, SunIcon, MoonIcon, BellIcon, LogoutIcon, PracticeProLogoWithText, DesktopComputerIcon, Logo, RevertIcon, ChatAltIcon, PencilSquareIcon, LockClosedIcon } from '../constants';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useCoreState } from '../contexts/CoreContext';
import { useMatterState } from '../contexts/MatterContext';
import { useDataActions } from '../contexts/DataContext';
import { getInitials, getUserColor, timeAgo } from '../utils/colorUtils';
import { usePermissions } from '../hooks/usePermissions';
import ConnectionStatus from './auth/ConnectionStatus';
import { PresenceAvatars } from './toolkit/PresenceAvatars';
import { useProduct } from '../contexts/ProductContext';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface HeaderProps {
    onToggleToolkit: () => void;
}

const getNotificationStyle = (type: string = 'info') => {
    switch (type) {
        case 'success': return { icon: <div className="w-2 h-2 bg-green-500 rounded-full" />, color: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' };
        case 'alert': return { icon: <div className="w-2 h-2 bg-red-500 rounded-full" />, color: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800' };
        case 'message': return { icon: <ChatAltIcon className="w-3 h-3 text-blue-500" />, color: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' };
        default: return { icon: <div className="w-2 h-2 bg-blue-500 rounded-full" />, color: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' };
    }
};

const Header: React.FC = React.memo(() => {
    const { theme, setTheme, navigateTo, goBack, goForward, canGoBack, canGoForward, setMobileSearchOpen, openModal, toggleCommandPalette, toggleSidebarRetraction, activePeers, addToast, setIsSessionLocked } = useUI();
    const { currentUser, logout, isImpersonating, revertToOriginalUser } = useAuth();
    const { coreState, isDataLoaded } = useCoreState();
    const { matterState } = useMatterState();
    const actions = useDataActions();
    const { handleMarkNotificationsRead, handleClearAllNotifications } = actions;
    const { notifications } = coreState;
    const { clientMessages } = matterState;
    const permissions = usePermissions();
    const { isProperty, hasPropertyFeatures } = useProduct();

    const [isNotificationsOpen, setNotificationsOpen] = useState(false);
    const [notifTab, setNotifTab] = useState<'platform' | 'firm'>('platform');
    const notificationsRef = useRef<HTMLDivElement>(null);
    const [isUserMenuOpen, setUserMenuOpen] = React.useState(false);
    const userMenuRef = React.useRef<HTMLDivElement>(null);
    const seenIdsRef = useRef<Set<string>>(new Set());
    const [demoProduct, setDemoProduct] = useState<'vega' | 'atrium'>(
        () => (sessionStorage.getItem('practicepro_demo_product') as 'vega' | 'atrium') || 'vega'
    );

    // Fetch inbound tenant messages for notification bell.
    // IMPORTANT: Use hasPropertyFeatures (not isProperty) so Komplete firms
    // also get resident messages. isProperty is only for the assistant name.
    const headerFirmId = coreState.firmDetails?.id || currentUser?.firmId || '';
    const inboundTenantMessages = useQuery(api.sentry.getInboundMessages, hasPropertyFeatures && headerFirmId ? { firmId: headerFirmId } : 'skip') || [];

    const rawUserName = currentUser?.name || currentUser?.email?.split('@')[0] || 'User';
    const displayUserName = isProperty ? rawUserName.replace(/Lawyer/g, 'Manager').replace(/Attorney/g, 'Agent') : rawUserName;

    // --- AGGREGATE NOTIFICATIONS ---
    const aggregatedNotifications = useMemo(() => {
        if (!currentUser) return [];

        // Cast notifications to any[] — the Notification type doesn't
        // declare `type` and `title` fields, but the backend includes them.
        const rawNotes = notifications as any[];

        // Split notifications into broadcasts and non-broadcasts.
        // Broadcasts are deduplicated by title+message so a user never
        // sees the same announcement multiple times (e.g., if they had
        // duplicate user records and received N copies of the same broadcast).
        // Broadcasts are EXCLUDED from the toast system — they're handled
        // by the persistent BroadcastBanner component in the Dashboard.
        const broadcastNotes = rawNotes
            .filter(n => (n.type || '').startsWith('broadcast_'))
            .map(n => ({
                ...n,
                _isBroadcast: true,  // flag for toast logic to skip
                type: 'info' as const,
                timestampStr: n.timestamp,
            }));

        const seenBroadcast = new Set<string>();
        const uniqueBroadcasts = broadcastNotes.filter(n => {
            const key = `${n.title || ''}|||${n.message || ''}`;
            if (seenBroadcast.has(key)) return false;
            seenBroadcast.add(key);
            return true;
        });

        // Non-broadcast system notes (keep original behavior)
        const nonBroadcastNotes = rawNotes.filter(n =>
            !(n.type || '').startsWith('broadcast_') && (
                n.userId === currentUser.id ||
                n.userId === currentUser._id ||
                n.userId === String(currentUser._id || '')
            )
        ).map(n => ({
            ...n,
            _isBroadcast: false,
            type: n.message.includes('joined') ? 'success' as const :
                  (n.message.toLowerCase().includes('message') ? 'message' as const : 'info' as const),
            timestampStr: n.timestamp
        }));

        // Unread Client Messages (Vega/legal)
        const unreadClientMessages = clientMessages.filter(m => !m.isRead && m.authorId !== currentUser.id).map(m => ({
            id: m.id,
            userId: currentUser.id,
            message: `New message from Client in matter`,
            link: { view: 'matterDetail', id: m.matterId, context: { initialTab: 'messages' } },
            isRead: false,
            timestamp: m.timestamp,
            type: 'message',
            timestampStr: m.timestamp
        }));

        // Inbound Tenant Messages (Atrium/property) — shown in notification bell
        const unreadTenantMessages = (inboundTenantMessages as any[])
            .filter((m: any) => !m.isRead)
            .slice(0, 10)
            .map((m: any) => ({
                id: m._id,
                userId: currentUser.id,
                message: `${m.senderName || m.senderContact}: ${m.content?.substring(0, 60) || 'New message'}`,
                link: { view: 'messaging' as View, id: null, context: { initialTab: 'inbox', selectedInboxId: m._id } },
                isRead: false,
                timestamp: m.receivedAt ? new Date(m.receivedAt).toISOString() : new Date().toISOString(),
                type: 'message',
                timestampStr: m.receivedAt ? new Date(m.receivedAt).toISOString() : new Date().toISOString(),
            }));

        // Combine and Sort
        return [...uniqueBroadcasts, ...nonBroadcastNotes, ...unreadClientMessages, ...unreadTenantMessages].sort((a, b) => new Date(b.timestampStr).getTime() - new Date(a.timestampStr).getTime());

    }, [notifications, clientMessages, currentUser, inboundTenantMessages]);

    const unreadCount = aggregatedNotifications.filter(n => !n.isRead).length;

    // --- Toast Alert Logic (Only for non-message system alerts) ---
    useEffect(() => {
        if (!isDataLoaded || !currentUser) return;

        // Initial load shouldn't trigger toasts
        if (seenIdsRef.current.size === 0 && aggregatedNotifications.length > 0) {
            aggregatedNotifications.forEach(n => seenIdsRef.current.add(n.id));
            return;
        }

        aggregatedNotifications.forEach(n => {
            if (!seenIdsRef.current.has(n.id)) {
                seenIdsRef.current.add(n.id);
                if (!n.isRead) {
                    // SKIP TOAST for broadcast notifications — these are now
                    // handled by the persistent BroadcastBanner component in
                    // the Dashboard. Showing a toast too would be redundant
                    // spam (user sees the banner AND a 5-second toast).
                    if ((n as any)._isBroadcast) return;

                    // In-app toast (always shown for non-broadcast notifications)
                    addToast(n.message, {
                        type: n.type === 'success' ? 'success' : 'info',
                        link: n.link ? {
                            text: 'View',
                            onClick: () => navigateTo(n.link?.view as any, n.link?.id, n.link?.context)
                        } : undefined
                    });
                    // Native push notification (mobile only) — shows in the
                    // phone's notification shade if the app is backgrounded.
                    // Also triggers haptic feedback + sound via the notification manager.
                    try {
                        import('../utils/notifications').then(({ showLocalNotification }) => {
                            showLocalNotification({
                                title: n.title || 'PracticePro',
                                body: n.message || 'You have a new notification',
                                type: n.type,
                                extraData: n.link,
                            });
                        });
                    } catch {}
                }
            }
        });
    }, [aggregatedNotifications, isDataLoaded, addToast, navigateTo, currentUser]);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setNotificationsOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleThemeCycle = () => {
        const themes: Theme[] = ['system', 'light', 'dark'];
        const nextIndex = (themes.indexOf(theme) + 1) % themes.length;
        setTheme(themes[nextIndex]);
    };

    // Long-press the theme toggle → open Settings → Theme preference dropdown.
    // Lets users access the full theme picker (midnight, oled, neon-cyber, etc.)
    // instead of just cycling through system/light/dark.
    const themeLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const themeLongPressFired = useRef(false);

    const handleThemeTouchStart = () => {
        themeLongPressFired.current = false;
        themeLongPressTimer.current = setTimeout(() => {
            themeLongPressFired.current = true;
            // Navigate to settings with a context hint so DisplaySettings
            // can auto-open the theme dropdown
            navigateTo('settings', null, { settingsTargetId: 'theme-preference' });
        }, 500); // 500ms = long press
    };

    const handleThemeTouchEnd = () => {
        if (themeLongPressTimer.current) {
            clearTimeout(themeLongPressTimer.current);
            themeLongPressTimer.current = null;
        }
    };

    const handleThemeClick = () => {
        // If the long-press already fired, don't also cycle the theme
        if (themeLongPressFired.current) {
            themeLongPressFired.current = false;
            return;
        }
        handleThemeCycle();
    };

    const toggleUserMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        setUserMenuOpen(prev => !prev);
    };

    const ThemeIcon = () => {
        if (theme === 'light') return <SunIcon className="w-5 h-5 text-slate-500" />;
        if (theme === 'dark') return <MoonIcon className="w-5 h-5 text-slate-500" />;
        return <DesktopComputerIcon className="w-5 h-5 text-slate-500" />;
    };

    if (!currentUser) return null;

    return (
        <header className="z-40 flex-shrink-0 glass border-b border-slate-200/50 dark:border-zinc-700/50 h-16 flex items-center justify-between px-4 sticky top-0 pt-safe">
            {/* Impersonation Banner — uses isImpersonating (synchronous) rather than
                originalUser (async query) so the banner is always visible during
                impersonation, even if the admin's DB record is still loading or
                has a missing role. */}
            {isImpersonating && (
                <div className="absolute top-full left-0 right-0 bg-yellow-400 text-black text-center py-1 text-xs font-semibold z-50 flex items-center justify-center gap-4 shadow-sm">
                    <span>Viewing as <strong>{displayUserName}</strong> ({currentUser.role}).</span>
                    <button onClick={revertToOriginalUser} className="flex items-center gap-1 underline font-bold hover:text-white">
                        <RevertIcon className="w-3 h-3" /> Return
                    </button>
                </div>
            )}

            <div className="flex items-center">
                {/* Mobile: Back/Forward navigation buttons */}
                <div className="md:hidden flex items-center -ml-1">
                    {/* SPEC COMPLIANCE — Icon Button Hover Centering:
                        strict flex-center container, p-0, explicit w-9 h-9.
                        Previous `touch-target p-2` left the icon off-center
                        inside the 44px min-size box because padding pushed
                        it leftward without a centering flex. */}
                    <button
                        onClick={goBack}
                        disabled={!canGoBack}
                        className={`flex items-center justify-center w-9 h-9 p-0 rounded-lg transition-colors ${canGoBack ? 'hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 active:bg-slate-200 dark:active:bg-zinc-600' : 'text-slate-300 dark:text-zinc-600'}`}
                        aria-label="Go back"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button
                        onClick={goForward}
                        disabled={!canGoForward}
                        className={`flex items-center justify-center w-9 h-9 p-0 rounded-lg transition-colors ${canGoForward ? 'hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 active:bg-slate-200 dark:active:bg-zinc-600' : 'text-slate-300 dark:text-zinc-600'}`}
                        aria-label="Go forward"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>

                <div className="md:hidden mr-2">
                    <Logo className="h-8 w-8 text-primary-500" />
                </div>

                <div className="hidden md:flex items-center space-x-1">
                    <button onClick={toggleSidebarRetraction} aria-label="Toggle sidebar" className="flex items-center justify-center w-9 h-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
                    </button>
                    <button onClick={goBack} disabled={!canGoBack} aria-label="Go back" className="flex items-center justify-center w-9 h-9 p-0 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <button onClick={goForward} disabled={!canGoForward} aria-label="Go forward" className="flex items-center justify-center w-9 h-9 p-0 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative hidden lg:block mr-2">
                    <button
                        onClick={toggleCommandPalette}
                        className="flex items-center w-56 pl-3 pr-2 py-1.5 text-xs bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 border border-transparent rounded-md hover:border-primary-500 transition-all focus:outline-none"
                    >
                        <SearchIcon className="w-3.5 h-3.5 mr-2" />
                        <span className="flex-grow text-left">Search...</span>
                        <kbd className="hidden sm:inline-block px-1.5 text-2xs font-semibold bg-slate-200 dark:bg-zinc-600 rounded">⌘K</kbd>
                    </button>
                </div>

                <div className="relative hidden sm:block lg:hidden">
                    <button onClick={() => setMobileSearchOpen(true)} aria-label="Search" className="flex items-center justify-center w-9 h-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 transition-colors">
                        <SearchIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Demo Switcher */}
                {currentUser.email === 'demo@practicepro.ng' && (
                    <div className="hidden lg:flex items-center bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-slate-200 dark:border-zinc-700 mr-1">
                        <button
                            onClick={() => { actions.switchDemoProduct('vega'); setDemoProduct('vega'); }}
                            className={`px-3 py-1 text-xs uppercase tracking-wider font-bold rounded-md transition-all ${
                                demoProduct !== 'atrium'
                                    ? 'bg-white dark:bg-zinc-600 text-primary-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
                            }`}
                        >
                            Vega
                        </button>
                        <button
                            onClick={() => { actions.switchDemoProduct('atrium'); setDemoProduct('atrium'); }}
                            className={`px-3 py-1 text-xs uppercase tracking-wider font-bold rounded-md transition-all ${
                                demoProduct === 'atrium'
                                    ? 'bg-white dark:bg-zinc-600 text-emerald-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
                            }`}
                        >
                            Atrium
                        </button>
                    </div>
                )}

                {/* DB Connection Status */}
                <ConnectionStatus />

                <button
                    onClick={handleThemeClick}
                    onContextMenu={(e) => {
                        // Right-click also opens the full theme picker (desktop equivalent of long-press)
                        e.preventDefault();
                        navigateTo('settings', null, { settingsTargetId: 'theme-preference' });
                    }}
                    onTouchStart={handleThemeTouchStart}
                    onTouchEnd={handleThemeTouchEnd}
                    onTouchMove={handleThemeTouchEnd}
                    onMouseDown={handleThemeTouchStart}
                    onMouseUp={handleThemeTouchEnd}
                    onMouseLeave={handleThemeTouchEnd}
                    className="flex items-center justify-center w-9 h-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 select-none transition-colors"
                    title="Click to cycle (System → Light → Dark). Long-press or right-click for full theme picker."
                    aria-label="Theme toggle — long-press for more options"
                >
                    <ThemeIcon />
                </button>

                <div className="relative" ref={notificationsRef}>
                    <button onClick={() => setNotificationsOpen(!isNotificationsOpen)} aria-label="Notifications" className="relative flex items-center justify-center w-9 h-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 transition-colors">
                        <BellIcon className="w-5 h-5" />
                        {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-zinc-800 animate-pulse"></span>}
                    </button>
                    {isNotificationsOpen && (
                        <div className="fixed top-16 right-4 w-96 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] flex flex-col bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl z-[3000] overflow-hidden animate-fade-in-up">
                            <div className="p-4 border-b border-slate-100 dark:border-zinc-700 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-900/50 backdrop-blur-sm">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-sm text-slate-800 dark:text-white">Notifications</h3>
                                    {unreadCount > 0 && <span className="bg-red-100 text-red-600 text-2xs font-bold px-1.5 py-0.5 rounded-full">{unreadCount} new</span>}
                                </div>
                                <div className="flex gap-3 items-center">
                                    {notifTab === 'platform' && aggregatedNotifications.filter(n => (n as any)._isBroadcast).length > 0 && (
                                        <button onClick={() => handleMarkNotificationsRead(aggregatedNotifications.filter(n => (n as any)._isBroadcast && !n.isRead).map(n => String(n._id || n.id || '')))} className="text-2xs font-bold text-primary-600 hover:underline">Mark all read</button>
                                    )}
                                    {notifTab === 'firm' && aggregatedNotifications.filter(n => !(n as any)._isBroadcast).length > 0 && (
                                        <button onClick={() => handleMarkNotificationsRead(aggregatedNotifications.filter(n => !(n as any)._isBroadcast && !n.isRead).map(n => String(n._id || n.id || '')))} className="text-2xs font-bold text-primary-600 hover:underline">Mark all read</button>
                                    )}
                                    <button onClick={() => setNotificationsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>

                            {/* Tab switcher — Platform Notices vs Firm Notices */}
                            <div className="flex border-b border-slate-100 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900">
                                <button
                                    onClick={() => setNotifTab('platform')}
                                    className={`flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                                        notifTab === 'platform'
                                            ? 'text-primary-600 dark:text-primary-400 border-primary-500'
                                            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 border-transparent'
                                    }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84a3 3 0 100-5.68 3 3 0 000 5.68zM7.51 7.34a6 6 0 018.98 0M4.66 4.49a10 10 0 0114.69 0M2.81 1.64a15 15 0 0118.38 0" />
                                    </svg>
                                    Platform Notices
                                    {aggregatedNotifications.filter(n => (n as any)._isBroadcast && !n.isRead).length > 0 && (
                                        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setNotifTab('firm')}
                                    className={`flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                                        notifTab === 'firm'
                                            ? 'text-primary-600 dark:text-primary-400 border-primary-500'
                                            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 border-transparent'
                                    }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                    Firm Notices
                                    {aggregatedNotifications.filter(n => !(n as any)._isBroadcast && !n.isRead).length > 0 && (
                                        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                    )}
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {(() => {
                                    // Filter notifications by the selected tab
                                    const tabNotifications = notifTab === 'platform'
                                        ? aggregatedNotifications.filter(n => (n as any)._isBroadcast)
                                        : aggregatedNotifications.filter(n => !(n as any)._isBroadcast);

                                    if (tabNotifications.length === 0) {
                                        return (
                                            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                                <BellIcon className="w-12 h-12 mb-3 opacity-20" />
                                                <p className="text-sm">
                                                    {notifTab === 'platform'
                                                        ? 'No platform notices yet'
                                                        : 'No firm notices yet'}
                                                </p>
                                                <p className="text-2xs mt-1 text-slate-400">
                                                    {notifTab === 'platform'
                                                        ? 'Announcements from PracticePro appear here'
                                                        : 'Client/tenant messages appear here'}
                                                </p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="divide-y divide-slate-100 dark:divide-zinc-700">
                                            {tabNotifications.map((notification: any) => {
                                                const style = getNotificationStyle(notification.type);
                                                return (
                                                    <div
                                                        key={notification.id}
                                                        className={`group relative p-4 hover:bg-slate-50 dark:hover:bg-zinc-700/50 flex gap-4 transition-colors ${!notification.isRead ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}
                                                    >
                                                        <div className="mt-1 flex-shrink-0">{style.icon}</div>
                                                        <div
                                                            className="flex-grow cursor-pointer"
                                                            onClick={() => {
                                                                if (notification.link) {
                                                                    navigateTo(notification.link.view, notification.link.id, notification.link.context);
                                                                }
                                                                setNotificationsOpen(false);
                                                                if (!notification.isRead) handleMarkNotificationsRead([String(notification._id || notification.id || '')]);
                                                            }}
                                                        >
                                                            <p className={`text-sm leading-snug mb-1 ${!notification.isRead ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-zinc-300'}`}>
                                                                {notification.title ? `${notification.title}: ` : ''}{notification.message}
                                                            </p>
                                                            <p className="text-2xs font-medium text-slate-400">{timeAgo(notification.timestampStr)}</p>
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // FIX: Virtual notifications (client messages, tenant messages)
                                                                // don't have a real notification table row — their id is a
                                                                // ChatMessage ID or AtriumInbound ID. Calling
                                                                // handleDismissNotification on them silently no-ops because
                                                                // the deleteItem mutation can't find them in the notifications
                                                                // table. For virtual notifications, we mark the underlying
                                                                // message as read instead. For real notifications, we delete.
                                                                const notifId = String(notification._id || notification.id || '');
                                                                const isVirtual = !(notification as any)._id && (
                                                                    (notification as any).type === 'message' ||
                                                                    // Virtual notifications from unreadClientMessages have id = m.id (ChatMessage ID)
                                                                    // Virtual notifications from unreadTenantMessages have id = m._id (AtriumInbound ID)
                                                                    // They don't have a _id field (only real notifications do)
                                                                    !notification._id
                                                                );
                                                                if (isVirtual && notification.link?.context) {
                                                                    // For tenant messages, mark as read via the inbox
                                                                    if (notification.link.context.selectedInboxId) {
                                                                        // This will be handled when the user navigates to the message
                                                                        // For now, just remove it from the local state
                                                                        actions.handleDismissNotification(notifId);
                                                                    } else {
                                                                        actions.handleDismissNotification(notifId);
                                                                    }
                                                                } else {
                                                                    actions.handleDismissNotification(notifId);
                                                                }
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition-all"
                                                            title="Delete"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                            {aggregatedNotifications.length > 0 && (
                                <div className="p-2 border-t border-slate-100 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-center">
                                    <button onClick={handleClearAllNotifications} className="text-xs font-bold text-slate-500 hover:text-red-600 transition-colors py-1">Clear all notifications</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Active Peers Display - MOVED HERE */}
                <div className="flex items-center px-1">
                    <PresenceAvatars activePeers={activePeers} currentUser={currentUser} />
                </div>

                <div className="relative flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 ml-1 border-l border-slate-200 dark:border-zinc-700" ref={userMenuRef}>
                    <div className="hidden lg:block text-right">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{displayUserName}</p>
                        <p className="text-2xs text-slate-500 dark:text-zinc-500 uppercase">{currentUser.role}</p>
                    </div>
                    <button
                        onClick={toggleUserMenu}
                        className="relative focus:outline-none"
                        aria-label="User menu"
                    >
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm ${getUserColor(displayUserName)} ring-2 ring-transparent hover:ring-slate-200 dark:hover:ring-zinc-600 transition-all`}>
                            {getInitials(displayUserName)}
                        </div>
                    </button>

                    {isUserMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-slate-200 dark:border-zinc-700 z-[60] overflow-hidden animate-fade-in-up">
                            <div className="py-1">
                                {/* CRO AUDIT FIX — all menu items now have matching icons
                                    for visual consistency. Previously only Lock Workspace
                                    and Sign out had icons; My Profile and Settings had none. */}
                                <button onClick={() => { navigateTo('settings', null, { settingsTargetId: 'my-profile' }); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 flex items-center gap-2.5">
                                    <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                    My Profile
                                </button>
                                <button onClick={() => { navigateTo('settings'); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 flex items-center gap-2.5">
                                    <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.241.437-.613.43-.992a7.723 7.723 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Settings
                                </button>
                                {currentUser.email === 'demo@practicepro.ng' ? (
                                    <button onClick={() => { openModal('signup'); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center gap-2.5 font-bold">
                                        <svg className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                        </svg>
                                        Sign Up (Exit Demo)
                                    </button>
                                ) : (
                                    <button onClick={() => { setIsSessionLocked(true); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 flex items-center gap-2.5">
                                        <LockClosedIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> Lock Workspace
                                    </button>
                                )}
                            </div>
                            <div className="border-t border-slate-100 dark:border-zinc-700 py-1">
                                <button onClick={() => {
                                    // Sign out directly — no browser confirm dialog.
                                    // The user menu already provides context (Sign Out button).
                                    logout();
                                    setUserMenuOpen(false);
                                }} className="w-full text-left px-4 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2.5">
                                    <LogoutIcon className="w-3.5 h-3.5 flex-shrink-0" /> {currentUser.email === 'demo@practicepro.ng' ? 'Exit Demo' : 'Sign out'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
});

export default Header;
