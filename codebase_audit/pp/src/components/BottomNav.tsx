
import React, { useState, useMemo } from 'react';
import { View } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useCoreState } from '../contexts/CoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useProduct } from '../contexts/ProductContext';
import { 
    DashboardIcon, MattersIcon, TasksIcon, CalendarIcon, ContactsIcon,
    DocumentsIcon, BillingIcon, ReportingIcon, MessagingIcon, ArchiveIcon, HelpIcon, CogIcon, ResearchIcon, ShieldCheckIcon, OfficeBuildingIcon
} from '../constants';

interface NavItemDef {
    view: View;
    text: string;
    icon: React.ReactElement<any>;
    permission: (p: ReturnType<typeof usePermissions>) => boolean;
}

// Replaced with a standard Ellipsis icon
const MoreIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
);

const RevenueEngineShieldIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
    </svg>
);

const navItemsList: NavItemDef[] = [
    { view: 'dashboard', text: 'Home', icon: <DashboardIcon />, permission: () => true },
    { view: 'matters', text: 'Matters', icon: <MattersIcon />, permission: () => true },
    { view: 'tasks', text: 'Tasks', icon: <TasksIcon />, permission: () => true },
    { view: 'atriumEngine', text: 'Revenue', icon: <RevenueEngineShieldIcon />, permission: () => true },
    { view: 'research', text: 'Research', icon: <ResearchIcon />, permission: () => true },
    { view: 'calendar', text: 'Calendar', icon: <CalendarIcon />, permission: () => true },
    { view: 'contacts', text: 'Contacts', icon: <ContactsIcon />, permission: () => true },
    { view: 'documents', text: 'Docs', icon: <DocumentsIcon />, permission: () => true },
    { view: 'billing', text: 'Finance', icon: <BillingIcon />, permission: (p) => p.canViewBilling },
    { view: 'reporting', text: 'Analytics', icon: <ReportingIcon />, permission: (p) => p.canViewBilling },
    { view: 'properties', text: 'Properties', icon: <OfficeBuildingIcon />, permission: () => true },
    { view: 'compliance', text: 'Compliance', icon: <ShieldCheckIcon />, permission: () => true },
    { view: 'messaging', text: 'Messages', icon: <MessagingIcon />, permission: (p) => p.canViewMessaging },
    { view: 'archive', text: 'Archive', icon: <ArchiveIcon />, permission: (p) => p.canViewArchive },
    { view: 'help', text: 'Help', icon: <HelpIcon />, permission: () => true },
    { view: 'settings', text: 'Settings', icon: <CogIcon />, permission: () => true },
];

const detailViewMap: Record<string, View> = {
    matterDetail: 'matters',
    contactDetail: 'contacts',
    documentDetail: 'documents',
    invoiceDetail: 'billing',
    receiptDetail: 'billing',
};

const NavItem: React.FC<{
    text: string;
    icon: React.ReactElement<any>;
    isActive: boolean;
    onClick: (e: React.MouseEvent) => void;
    view: View;
    badgeCount?: number;
}> = ({ text, icon, isActive, onClick, view, badgeCount }) => {
    return (
        <button
            onClick={onClick}
            data-tour-id={`nav-${view}`}
            className={`relative flex flex-col items-center justify-center flex-1 pt-2 pb-1 h-16 transition-colors duration-200 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-zinc-400 hover:text-primary-500'}`}
            aria-current={isActive ? 'page' : undefined}
            aria-label={text}
        >
            <div className="relative">
                {React.cloneElement(icon, { className: 'w-6 h-6 mb-1' })}
                {badgeCount !== undefined && badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold ring-2 ring-white dark:ring-zinc-900 shadow-sm z-10 animate-pulse">
                        {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                )}
            </div>
            <span className="text-[10px] font-medium">{text}</span>
        </button>
    );
};

interface BottomNavProps {
    currentView: View;
    setView: (view: View) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentView, setView }) => {
    const permissions = usePermissions();
    const { coreState, isDataLoaded } = useCoreState();
    const { currentUser } = useAuth();
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

    // Unified Badge Logic: Strictly filters for the current user and maps notifications to their respective tabs.
    const getBadgeCountForView = React.useCallback((view: View) => {
        if (!currentUser) return 0;
        
        // We filter notifications that:
        // 1. Belong to this user
        // 2. Are unread
        // 3. Match the target view (or related view context)
        return coreState.notifications.filter(n => {
            if (n.userId !== currentUser.id || n.isRead || !n.link) return false;
            
            // Views can have aliases or sub-views (e.g. matterDetail is nested under matters)
            const targetView = n.link.view;
            if (!targetView) return false;
            
            if (targetView === view) return true;
            
            // Alias groups
            if (view === 'matters' && targetView === 'matterDetail') return true;
            if (view === 'billing' && (targetView === 'invoiceDetail' || targetView === 'receiptDetail')) return true;
            
            return false;
        }).length;
    }, [coreState.notifications, currentUser]);

    const { isProperty, isUnified } = useProduct();


    const filteredNavItems = navItemsList.filter(item => {
        // Revenue monitor: only show for property product
        if (item.view === 'atriumEngine' && !isProperty) return false;
        // Matters: only show for legal product users
        if (item.view === 'matters' && isProperty && !isUnified) return false;
        // Research: only show for legal product users  
        if (item.view === 'research' && isProperty && !isUnified) return false;
        return item.permission(permissions);
    });

    // Product-aware primary nav: property users get Properties + Revenue front-and-center
    const primaryViews: View[] = isProperty && !isUnified
        ? ['dashboard', 'properties', 'atriumEngine', 'tasks']
        : ['dashboard', 'matters', 'tasks', 'research'];
    
    const primaryItems = useMemo(() => {
        return primaryViews
            .map(view => filteredNavItems.find(item => item.view === view))
            .filter(Boolean) as NavItemDef[];
    }, [filteredNavItems, isProperty]);

    const secondaryItems = useMemo(() => {
        const primarySet = new Set(primaryViews);
        return filteredNavItems.filter(item => !primarySet.has(item.view));
    }, [filteredNavItems, isProperty]);

    const parentView = detailViewMap[currentView] || currentView;
    const isMoreActive = useMemo(() => secondaryItems.some(item => item.view === parentView), [secondaryItems, parentView]);
    
    // Check if ANY item in the "More" menu has a notification
    const moreMenuBadgeCount = useMemo(() => {
        return secondaryItems.reduce((acc, item) => acc + getBadgeCountForView(item.view), 0);
    }, [secondaryItems, getBadgeCountForView]);

    const handleMoreItemClick = (e: React.MouseEvent, view: View) => {
        e.preventDefault();
        e.stopPropagation();
        setView(view);
        setIsMoreMenuOpen(false);
    };
    
    const handleToggleMore = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsMoreMenuOpen(prev => !prev);
    };

    return (
        <>
            <nav id="bottom-nav" className="fixed bottom-0 left-0 right-0 z-[1000] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-zinc-700 md:hidden pb-safe">
                <div className="flex items-start">
                    {primaryItems.map(item => {
                        return (
                            <NavItem
                                key={item.view}
                                text={item.text}
                                icon={item.icon}
                                isActive={parentView === item.view}
                                view={item.view}
                                badgeCount={getBadgeCountForView(item.view)}
                                onClick={(e) => {
                                    e.preventDefault();
                                    setView(item.view);
                                    setIsMoreMenuOpen(false); 
                                }}
                            />
                        );
                    })}
                    <NavItem
                        text="More"
                        icon={<MoreIcon />}
                        view="settings" // Fallback view mostly, or use unique ID for More
                        isActive={isMoreActive || isMoreMenuOpen}
                        badgeCount={moreMenuBadgeCount}
                        onClick={handleToggleMore}
                    />
                </div>
            </nav>
            {isMoreMenuOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-[1001] bg-black/40 backdrop-blur-[2px] md:hidden" 
                        onClick={() => setIsMoreMenuOpen(false)} 
                    />
                    
                    <div className="fixed bottom-24 left-4 right-4 z-[1002] md:hidden outline-none animate-slide-in-up origin-bottom">
                        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-zinc-700/50 p-4">
                            <div className="flex justify-between items-center mb-4 px-2">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">More Options</h3>
                                <button onClick={() => setIsMoreMenuOpen(false)} className="p-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                {secondaryItems.map(item => {
                                    const count = getBadgeCountForView(item.view);
                                    return (
                                        <button
                                            key={item.view}
                                            data-tour-id={`nav-${item.view}`}
                                            onClick={(e) => handleMoreItemClick(e, item.view)}
                                            className="flex flex-col items-center gap-2 group relative"
                                        >
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-sm ${parentView === item.view ? 'bg-primary-600 text-white shadow-primary-500/30' : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 group-active:scale-95'}`}>
                                                {React.cloneElement(item.icon, { className: "w-6 h-6" })}
                                            </div>
                                            {count > 0 && (
                                                <span className="absolute top-0 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-600 text-white text-[9px] font-bold rounded-full border-2 border-white dark:border-zinc-900 z-10 animate-pulse">
                                                    {count > 9 ? '9+' : count}
                                                </span>
                                            )}
                                            <span className={`text-[10px] font-medium text-center leading-tight line-clamp-1 ${parentView === item.view ? 'text-primary-700 dark:text-primary-400' : 'text-slate-600 dark:text-zinc-400'}`}>{item.text}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default BottomNav;
