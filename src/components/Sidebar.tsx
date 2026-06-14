
import React, { useState, useEffect } from 'react';
import { useMatterState } from '../contexts/MatterContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useCoreState } from '../contexts/CoreContext';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useProduct } from '../contexts/ProductContext';
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
    DashboardIcon, MattersIcon, TasksIcon, DocumentsIcon, CalendarIcon,
    ContactsIcon, BillingIcon, ReportingIcon, MessagingIcon, CogIcon,
    ResearchIcon, OfficeBuildingIcon, ChevronDownIcon, CheckCircleIcon, PlusIcon,
    ShieldCheckIcon, LockClosedIcon
} from '../constants';

// ARIA-X inline icon
const IndexerIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3L3 9l9 6 9-6-9-6z" />
        <path d="M3 15l9 6 9-6" />
        <path d="M3 12l9 6 9-6" />
    </svg>
);
import { View, SubscriptionPlan } from '../types';
import { useFeatures } from '../hooks/useFeatures';

interface SidebarProps {
    currentView: View;
    setView: (view: View, targetId?: string | null, context?: any) => void;
    currentUser: any;
}

const NavSection: React.FC<{ title?: string; children: React.ReactNode; isRetracted?: boolean }> = ({ title, children, isRetracted }) => (
    <div className={`mb-2 ${isRetracted ? 'px-1' : 'px-3'}`}>
        {title && (
            <h4 className={`
                px-1 mb-2 text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mt-2 transition-all duration-300
                ${isRetracted ? 'text-center opacity-40' : 'px-3'}
            `}>
                {isRetracted ? (title === 'OPERATIONS' ? 'OPS' : 'MENU') : title}
            </h4>
        )}
        <div className="space-y-0.5">
            {children}
        </div>
    </div>
);

const NavItemLink: React.FC<{
    item: any;
    setView: any;
    currentView: any;
    isSidebarRetracted: boolean;
    counts: any;
    id?: string;
    locked?: boolean;
    onLockedClick?: () => void;
}> = ({ item, setView, currentView, isSidebarRetracted, counts, id, locked, onLockedClick }) => {
    const isActive = currentView === item.view || (item.view === 'matters' && currentView === 'matterDetail') || (item.view === 'contacts' && currentView === 'contactDetail');

    // Badge Logic
    let badgeCount = 0;
    let badgeColor = 'bg-green-600'; // Default Brand Green

    if (item.view === 'matters') badgeCount = counts.updatedMatters;
    if (item.view === 'messaging') {
        badgeCount = counts.messages;
        badgeColor = 'bg-red-500';
    }
    if (item.view === 'tasks') {
        badgeCount = counts.tasks;
        badgeColor = 'bg-zinc-500';
    }

    return (
        <button
            id={id}
            onClick={() => {
                if (locked && onLockedClick) {
                    onLockedClick();
                    return;
                }
                if (locked) return; // Guard: locked items without handler should not navigate
                setView(item.view, null);
            }}
            data-tour-id={`nav-${item.view}`}
            aria-disabled={locked ? 'true' : undefined}
            className={`
                group flex items-center ${isSidebarRetracted ? 'justify-center p-2.5' : 'px-3 py-2.5'} w-full rounded-xl transition-all duration-200 relative
                ${locked ? 'opacity-60 cursor-not-allowed' : ''}
                ${isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-md shadow-slate-900/10 dark:shadow-white/10'
                    : locked
                    ? 'text-slate-400 dark:text-zinc-500'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100/50 dark:hover:bg-zinc-800/50'
                }
            `}
            title={item.text}
        >
            <div className={`flex-shrink-0 ${isSidebarRetracted ? '' : 'mr-3'} ${isActive ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300'}`}>
                {React.cloneElement(item.icon, {
                    className: `w-5 h-5`
                })}
            </div>

            {!isSidebarRetracted && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="text-sm truncate flex items-center gap-1.5">{item.text}{locked && <LockClosedIcon className="w-3 h-3 text-slate-400 dark:text-zinc-500" />}</span>
                    {badgeCount > 0 && (
                        <span className={`ml-2 ${badgeColor} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm relative z-10`}>
                            {badgeCount}
                        </span>
                    )}
                </div>
            )}
            {item.view === 'indexer' && (
                <span className="aloax-nav-badge absolute right-2 top-2 w-2.5 h-2.5 bg-indigo-500 rounded-full border border-white dark:border-zinc-900 animate-pulse hidden" />
            )}
        </button>
    );
};


const RevenueEngineShieldIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
    </svg>
);

const RevenueEngineNavItem: React.FC<{ setView: any; currentView: any; isSidebarRetracted: boolean; firmId: string }> = ({ setView, currentView, isSidebarRetracted, firmId }) => {
    const isActive = currentView === 'atriumEngine';
    const defaulters = useQuery(api.sentry.getDefaulters, firmId ? { firmId } : 'skip');
    const criticalCount = (defaulters || []).filter((d: any) => (d.daysOverdue ?? 0) > 14).length;

    return (
        <button
            onClick={() => setView('atriumEngine', null)}
            className={`
                group flex items-center ${isSidebarRetracted ? 'justify-center p-2.5' : 'px-3 py-2.5'} w-full rounded-xl transition-all duration-200 relative
                ${isActive
                    ? 'bg-slate-900 text-white font-bold shadow-md shadow-slate-900/10'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100/50 dark:hover:bg-zinc-800/50'
                }
            `}
            title="Revenue Monitor"
        >
            <div className={`flex-shrink-0 ${isSidebarRetracted ? '' : 'mr-3'} ${isActive ? 'text-emerald-500' : 'text-slate-400 dark:text-zinc-500 group-hover:text-emerald-500'}`}>
                <RevenueEngineShieldIcon className="w-5 h-5" />
            </div>
            {!isSidebarRetracted && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="text-sm truncate">Revenue Monitor</span>
                    {criticalCount > 0 && (
                        <span className="ml-2 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                            {criticalCount}
                        </span>
                    )}
                </div>
            )}
            {isSidebarRetracted && criticalCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white dark:border-zinc-900 animate-pulse" />
            )}
        </button>
    );
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, currentUser }) => {
    const { matterState } = useMatterState();
    const { executionState } = useExecutionState();
    const { coreState, isDataLoaded } = useCoreState();
    const { isSidebarRetracted, openModal } = useUI();
    const { isLegal, isProperty, isUnified, product } = useProduct();
    const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

    // Data fetching for workspaces
    const diagnoseMutation = useMutation(api.myFunctions.diagnoseConnectivity);
    const repairMutation = useMutation(api.myFunctions.repairAccountConnection);
    const [availableWorkspaces, setAvailableWorkspaces] = useState<any[]>([]);
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);

    // Fetch inbound resident messages for unified badge count
    const sidebarFirmId = coreState.firmDetails?.id || currentUser?.firmId || '';
    const inboundMessages = useQuery(api.sentry.getInboundMessages, sidebarFirmId ? { firmId: sidebarFirmId } : 'skip') || [];
    const inboundUnread = (inboundMessages as any[]).filter((m: any) => !m.isRead).length;

    // Fetch portal messages for unified badge count
    const portalMsgs = useQuery(api.portals.getPortalMessagesByFirm, sidebarFirmId ? { firmId: sidebarFirmId } : 'skip') || [];
    const portalUnread = (portalMsgs as any[]).filter((m: any) => m.status === 'unread').length;

    const chatNotificationCount = (coreState.notifications || []).filter(n => n.userId === currentUser.id && !n.isRead && n.link?.view === 'messaging').length;

    const counts = {
        updatedMatters: (matterState.clientMessages || []).filter(m => !m.isRead && m.authorId !== currentUser.id).length,
        tasks: (executionState.tasks || []).filter(t => t && t.assignedUsers && t.assignedUsers.includes(currentUser.id) && t.status !== 'done').length,
        messages: chatNotificationCount + (isProperty ? inboundUnread + portalUnread : 0),
    };

    const currentPlan = coreState.firmDetails.subscriptionPlan || SubscriptionPlan.Core;
    const isHighTier = currentPlan === SubscriptionPlan.Enterprise || currentPlan === SubscriptionPlan.Komplete;
    const features = useFeatures();
    // Allow all users to access the firm switcher to find their other offices or switch back to original offices 
    const canUseMultiFirm = true;

    // Sidebar ARIA-X Toggle Visibility
    const [showAloaX, setShowAloaX] = useState(() => localStorage.getItem('aloax_sidebar_enabled') === 'true');
    useEffect(() => {
        const handleToggle = () => setShowAloaX(localStorage.getItem('aloax_sidebar_enabled') === 'true');
        window.addEventListener('aloa_x_toggled', handleToggle);
        return () => window.removeEventListener('aloa_x_toggled', handleToggle);
    }, []);

    // Logo / Initials Logic
    const firmName = coreState.firmDetails.name || 'My Firm';
    const firmInitials = firmName.substring(0, 2).toUpperCase();
    const logoUrl = coreState.firmDetails.logoUrl;

    // Fetch available workspaces when dropdown opens
    useEffect(() => {
        if (isWorkspaceOpen && currentUser?.email && canUseMultiFirm) {
            setIsLoadingWorkspaces(true);
            diagnoseMutation({ email: currentUser.email })
                .then((result) => {
                    if (result.availableFirms) {
                        setAvailableWorkspaces(result.availableFirms);
                    }
                })
                .catch(() => {
                    setAvailableWorkspaces([]);
                })
                .finally(() => setIsLoadingWorkspaces(false));
        }
    }, [isWorkspaceOpen, currentUser?.email, diagnoseMutation, canUseMultiFirm]);

    const handleSwitchWorkspace = async (targetFirmId: string) => {
        if (targetFirmId === coreState.firmDetails.id) return;

        try {
            await repairMutation({ email: currentUser.email, targetFirmId });
            window.location.reload();
        } catch (e) {
            // Error handled silently — user stays on current workspace
        }
    };

    return (
        <aside className={`
            fixed inset-y-0 left-0 z-50 
            glass
            border-r border-slate-200/50 dark:border-zinc-800/50 
            transition-all duration-300 flex flex-col 
            hidden md:flex 
            ${isSidebarRetracted ? 'w-20' : 'w-64'}
        `}>
            {/* Firm Header with Dropdown */}
            <div className="relative">
                <button
                    onClick={() => !isSidebarRetracted && canUseMultiFirm && setIsWorkspaceOpen(!isWorkspaceOpen)}
                    className={`
                        w-full h-14 flex items-center ${isSidebarRetracted ? 'justify-center' : 'px-4'}
                        border-b border-slate-200 dark:border-zinc-800 
                        ${!isSidebarRetracted && canUseMultiFirm ? 'hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer' : 'cursor-default'} 
                        transition-colors focus:outline-none 
                    `}
                >
                    {!isSidebarRetracted ? (
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0 shadow-sm">
                                {logoUrl ? (
                                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    firmInitials
                                )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <h1 className="font-bold text-sm text-slate-800 dark:text-zinc-100 truncate leading-tight flex items-center gap-1.5">
                                    <span className="truncate">{firmName}</span>
                                    {canUseMultiFirm && (
                                        <ChevronDownIcon className={`w-3.5 h-3.5 flex-shrink-0 text-slate-400 dark:text-zinc-500 transition-transform duration-200 ${isWorkspaceOpen ? 'rotate-180' : ''}`} />
                                    )}
                                </h1>
                                <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-medium uppercase tracking-wider mt-0.5">{isUnified ? 'Komplete ● Unified' : isProperty ? 'Atrium OS' : 'Vega OS'}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="mx-auto w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold overflow-hidden shadow-sm">
                            {logoUrl ? (
                                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                firmInitials
                            )}
                        </div>
                    )}
                </button>

                {/* Workspace Dropdown */}
                {isWorkspaceOpen && !isSidebarRetracted && canUseMultiFirm && (
                    <div className="absolute top-full left-2 right-2 mt-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-xl rounded-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-1 space-y-0.5">
                            <p className="px-3 py-2 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Switch Workspace</p>

                            {isLoadingWorkspaces ? (
                                <div className="px-3 py-2 text-xs text-slate-500 dark:text-zinc-400">Loading...</div>
                            ) : availableWorkspaces.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-slate-500 dark:text-zinc-400">No other workspaces found.</p>
                            ) : (
                                availableWorkspaces.map((firm: any) => {
                                    const isActive = firm.id === coreState.firmDetails.id;
                                    return (
                                        <button
                                            key={firm.id}
                                            onClick={() => handleSwitchWorkspace(firm.id)}
                                            className={`
                                                w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors 
                                                ${isActive
                                                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                                    : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700'
                                                }
                                            `}
                                        >
                                            <span className="truncate">{firm.name}</span>
                                            {isActive && <CheckCircleIcon className="w-3.5 h-3.5" />}
                                        </button>
                                    );
                                })
                            )}

                            <div className="h-px bg-slate-100 dark:bg-zinc-700 my-1 mx-2"></div>

                            {canUseMultiFirm && (
                                <button
                                    onClick={() => { setIsWorkspaceOpen(false); openModal('joinFirm'); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                                >
                                    <PlusIcon className="w-3.5 h-3.5" /> Connect New Workspace
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Nav List */}
            <div key={product} className="flex-1 overflow-y-auto py-4 custom-scrollbar scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent animate-fade-in-up">

                {/* Main Menu */}
                <NavSection title="MAIN MENU" isRetracted={isSidebarRetracted}>
                    <NavItemLink
                        item={{ view: 'dashboard', text: 'Home', icon: <DashboardIcon /> }}
                        setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} counts={counts}
                    />
                    {/* Property-First Navigation for Atrium Users */}
                    {isProperty && (
                        <>
                            <NavItemLink
                                item={{ view: 'properties', text: 'Properties', icon: <OfficeBuildingIcon /> }}
                                setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} counts={counts}
                            />
                            <RevenueEngineNavItem setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} firmId={coreState.firmDetails?.id || ''} />
                        </>
                    )}
                    {isLegal && (
                        <NavItemLink
                            item={{ view: 'matters', text: 'Matters', icon: <MattersIcon /> }}
                            setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} counts={counts}
                        />
                    )}
                    <NavItemLink
                        item={{ view: 'tasks', text: 'Tasks', icon: <TasksIcon /> }}
                        setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} counts={counts}
                    />
                    {isLegal && (
                        <NavItemLink
                            item={{ view: 'documents', text: 'Documents', icon: <DocumentsIcon /> }}
                            setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} counts={counts}
                        />
                    )}
                    <NavItemLink
                        item={{ view: 'messaging', text: 'Messages', icon: <MessagingIcon /> }}
                        setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} counts={counts}
                    />
                    {isLegal && (
                        <NavItemLink
                            item={{ view: 'research', text: 'Research', icon: <ResearchIcon /> }}
                            setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} counts={counts}
                            locked={!features.canUseResearchStudio}
                            onLockedClick={() => openModal('upgradePlan')}
                        />
                    )}
                    {isHighTier && showAloaX && (
                        <NavItemLink
                            item={{ view: 'indexer', text: 'ARIA-X', icon: <IndexerIcon /> }}
                            setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} counts={counts}
                        />
                    )}
                    <NavItemLink
                        item={{ view: 'calendar', text: 'Calendar', icon: <CalendarIcon /> }}
                        setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} counts={counts}
                    />
                    <NavItemLink
                        item={{ view: 'contacts', text: 'Contacts', icon: <ContactsIcon /> }}
                        setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} counts={counts}
                    />
                </NavSection>

                {/* Operations (Finance, Analytics, Settings) */}
                <div className="my-4 border-t border-slate-100 dark:border-zinc-800 mx-6"></div>

                <NavSection title="OPERATIONS" isRetracted={isSidebarRetracted}>
                    <NavItemLink
                        item={{ view: 'billing', text: 'Financials', icon: <BillingIcon /> }}
                        setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} counts={counts}
                        locked={!features.canUseAdvancedBilling}
                        onLockedClick={() => openModal('upgradePlan')}
                    />
                    <NavItemLink
                        item={{ view: 'reporting', text: 'Analytics', icon: <ReportingIcon /> }}
                        setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} counts={counts}
                        locked={!features.canUseReportGenerator}
                        onLockedClick={() => openModal('upgradePlan')}
                    />
                    {isLegal && (
                        <NavItemLink
                            item={{ view: 'compliance', text: 'Compliance', icon: <ShieldCheckIcon /> }}
                            setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} counts={counts}
                        />
                    )}
                    <NavItemLink
                        id="nav-settings-sidebar"
                        item={{ view: 'settings', text: 'Settings', icon: <CogIcon /> }}
                        setView={setView} currentView={currentView} isSidebarRetracted={isSidebarRetracted} counts={counts}
                    />
                </NavSection>

            </div>
        </aside>
    );
};

export default Sidebar;
