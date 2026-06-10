
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
    const { currentUser, logout, originalUser, revertToOriginalUser } = useAuth();
    const { coreState, isDataLoaded } = useCoreState();
    const { matterState } = useMatterState();
    const actions = useDataActions();
    const { handleMarkNotificationsRead, handleClearAllNotifications } = actions;
    const { notifications } = coreState;
    const { clientMessages } = matterState;
    const chatMessages: any[] = []; // chat messages loaded per-conversation in MessagingView
    const permissions = usePermissions();

    const [isNotificationsOpen, setNotificationsOpen] = useState(false);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const [isUserMenuOpen, setUserMenuOpen] = React.useState(false);
    const userMenuRef = React.useRef<HTMLDivElement>(null);
    const seenIdsRef = useRef<Set<string>>(new Set());
    const [demoProduct, setDemoProduct] = useState<'vega' | 'atrium'>(
        () => (sessionStorage.getItem('practicepro_demo_product') as 'vega' | 'atrium') || 'vega'
    );
    const { isProperty } = useProduct();

    const rawUserName = currentUser?.name || currentUser?.email?.split('@')[0] || 'User';
    const displayUserName = isProperty ? rawUserName.replace(/Lawyer/g, 'Manager').replace(/Attorney/g, 'Agent') : rawUserName;

    // --- AGGREGATE NOTIFICATIONS ---
    const aggregatedNotifications = useMemo(() => {
        if (!currentUser) return [];

        const systemNotes = notifications.filter(n => n.userId === currentUser.id).map(n => ({
            ...n,
            type: n.message.includes('joined') ? 'success' : (n.message.toLowerCase().includes('message') ? 'message' : 'info'),
            timestampStr: n.timestamp
        }));

        // 2. Unread Chat Messages (Direct & Channels)
        // Group by conversation to avoid clutter
        const unreadChats = chatMessages.filter(m => !m.isDeleted && m.authorId !== currentUser.id); // Simple filter, real "unread" logic would check a read status per user
        // Assuming we rely on a simplified "unread count" or just latest ones for now since individual read status tracking might be complex without a read_receipts table.
        // Actually, let's use the local storage 'last_viewed' logic logic or similar if available, otherwise just show recent ones.
        // For this implementation, we will mock "unread" status for chat messages based on a simple "isRead" flag if it existed, or just recent ones.
        // BUT wait, coreState.notifications tracks some things. 
        // Let's assume for this specific request, we want to SEE the messages in the list.

        // Better approach: Use the "unreadMessagesCount" logic from Sidebar to flag which conversations have activity.
        // Since we don't have per-message read status in the schema for group chats easily, we'll stick to system notifications for now,
        // BUT we will inject Client Messages as they are critical.

        const unreadClientMessages = clientMessages.filter(m => !m.isRead && m.authorId !== currentUser.id).map(m => ({
            id: m.id,
            userId: currentUser.id,
            message: `New message from Client in matter`, // Simplified, could look up matter title
            link: { view: 'matterDetail', id: m.matterId, context: { initialTab: 'messages' } },
            isRead: false,
            timestamp: m.timestamp,
            type: 'message',
            timestampStr: m.timestamp
        }));

        // Combine and Sort
        return [...systemNotes, ...unreadClientMessages].sort((a, b) => new Date(b.timestampStr).getTime() - new Date(a.timestampStr).getTime());

    }, [notifications, clientMessages, currentUser]);

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
                    addToast(n.message, {
                        type: n.type === 'success' ? 'success' : 'info',
                        link: n.link ? {
                            text: 'View',
                            onClick: () => navigateTo(n.link?.view as any, n.link?.id, n.link?.context)
                        } : undefined
                    });
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
        <header className="z-40 flex-shrink-0 glass border-b border-slate-200/50 dark:border-zinc-700/50 h-14 flex items-center justify-between px-4 sticky top-0">
            {originalUser && (
                <div className="absolute top-full left-0 right-0 bg-yellow-400 text-black text-center py-1 text-xs font-semibold z-50 flex items-center justify-center gap-4 shadow-sm">
                    <span>Viewing as <strong>{displayUserName}</strong> ({currentUser.role}).</span>
                    <button onClick={revertToOriginalUser} className="flex items-center gap-1 underline font-bold hover:text-white">
                        <RevertIcon className="w-3 h-3" /> Return
                    </button>
                </div>
            )}

            <div className="flex items-center">
                <div className="md:hidden mr-2">
                    <Logo className="h-8 w-8 text-primary-500" />
                </div>

                <div className="hidden md:flex items-center space-x-1">
                    <button onClick={toggleSidebarRetraction} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
                    </button>
                    <button onClick={goBack} disabled={!canGoBack} className="p-2 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <button onClick={goForward} disabled={!canGoForward} className="p-2 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500">
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
                        <kbd className="hidden sm:inline-block px-1.5 text-[10px] font-semibold bg-slate-200 dark:bg-zinc-600 rounded">⌘K</kbd>
                    </button>
                </div>

                <div className="relative hidden sm:block lg:hidden">
                    <button onClick={() => setMobileSearchOpen(true)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500">
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

                <button onClick={handleThemeCycle} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500">
                    <ThemeIcon />
                </button>

                <div className="relative" ref={notificationsRef}>
                    <button onClick={() => setNotificationsOpen(!isNotificationsOpen)} className="relative p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 transition-colors">
                        <BellIcon className="w-5 h-5" />
                        {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-zinc-800 animate-pulse"></span>}
                    </button>
                    {isNotificationsOpen && (
                        <div className="fixed top-16 right-4 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-fade-in-up">
                            <div className="p-4 border-b border-slate-100 dark:border-zinc-700 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-900/50 backdrop-blur-sm">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-sm text-slate-800 dark:text-white">Notifications</h3>
                                    {unreadCount > 0 && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount} new</span>}
                                </div>
                                <div className="flex gap-3 items-center">
                                    <button onClick={() => handleMarkNotificationsRead(aggregatedNotifications.filter(n => !n.isRead).map(n => n.id))} className="text-[10px] font-bold text-primary-600 hover:underline">Mark all read</button>
                                    <button onClick={() => setNotificationsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>
                            <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                                {aggregatedNotifications.length > 0 ? (
                                    <div className="divide-y divide-slate-100 dark:divide-zinc-700">
                                        {aggregatedNotifications.map((notification: any) => {
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
                                                            if (!notification.isRead) handleMarkNotificationsRead([notification.id]);
                                                        }}
                                                    >
                                                        <p className={`text-sm leading-snug mb-1 ${!notification.isRead ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-zinc-300'}`}>{notification.message}</p>
                                                        <p className="text-[10px] font-medium text-slate-400">{timeAgo(notification.timestampStr)}</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            actions.handleDismissNotification(notification.id);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition-all"
                                                        title="Dismiss"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                    <BellIcon className="w-12 h-12 mb-3 opacity-20" />
                                    <p className="text-sm">No notifications yet</p>
                                </div>}
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
                <div className="flex items-center">
                    <PresenceAvatars activePeers={activePeers} currentUser={currentUser} />
                </div>

                <div className="relative flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-zinc-700" ref={userMenuRef}>
                    <div className="hidden lg:block text-right">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{displayUserName}</p>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase">{currentUser.role}</p>
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
                                <button onClick={() => { navigateTo('settings', null, { settingsTargetId: 'my-profile' }); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700">My Profile</button>
                                <button onClick={() => { navigateTo('settings'); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700">Settings</button>
                                {currentUser.email === 'demo@practicepro.ng' ? (
                                    <button onClick={() => { openModal('signup'); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center gap-2 font-bold">
                                        <svg className="w-3.5 h-3.5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg> Sign Up (Exit Demo)
                                    </button>
                                ) : (
                                    <button onClick={() => { setIsSessionLocked(true); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 flex items-center gap-2">
                                        <LockClosedIcon className="w-3.5 h-3.5 text-slate-400" /> Lock Workspace
                                    </button>
                                )}
                            </div>
                            <div className="border-t border-slate-100 dark:border-zinc-700 py-1">
                                <button onClick={() => { logout(); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                                    <LogoutIcon className="w-3.5 h-3.5" /> {currentUser.email === 'demo@practicepro.ng' ? 'Exit Demo' : 'Sign out'}
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
