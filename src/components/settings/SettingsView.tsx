/**
 * SettingsView — redesigned June 2026
 *
 * Goals of the redesign:
 *   1. **Mobile/portrait (web + APK)** — replace the cramped horizontal
 *      scrolling tab bar with a slide-in drawer triggered by a hamburger
 *      button in the header. Drawer slides in from the left with a dimmed
 *      backdrop, full-height, with the same grouped sections as desktop.
 *   2. **Tablet/desktop (lg+)** — proper sticky sidebar with section
 *      headers, generous spacing, tinted icon containers, clear active
 *      state. Sidebar is always visible and content scrolls independently.
 *   3. **Visual hierarchy** — sections ("Account", "Practice", "System")
 *      are clearly grouped with subtle dividers. Each nav item has a
 *      tinted icon container so the icon isn't floating in space.
 *   4. **Smooth transitions** — animated drawer slide-in, animated
 *      content swap on tab change.
 *   5. **Consistent with the rest of the app** — uses the same emerald
 *      brand-primary accent, same dark mode palette, same rounded-xl
 *      cards, same shadow-soft elevation language.
 *
 * The actual settings panels (ProfileSettings, FirmSettings, etc.) are
 * unchanged — only the shell/navigation has been redesigned.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
    Theme, WorkflowDefinition, CustomEventType, ModalType, ContactCategory,
    DocumentCategory, User, UserRole, ChecklistTemplate, FirmDetails, AppMode,
    DocumentTemplate, DocumentTemplateCategory, View, HistoryEntry, SubscriptionPlan
} from '../../types';
import {
    UserCircleIcon, OfficeBuildingIcon, ClipboardListIcon, TagIcon,
    DesktopComputerIcon, HelpCircleIcon, ZapIcon, FormIcon, ShieldCheckIcon,
    LockClosedIcon, TrashIcon, MessagingIcon, BellIcon, ChevronRightIcon,
    XIcon, ArrowLeftIcon
} from '../../constants';
import { Menu as MenuIcon } from 'lucide-react';

import ProTip from '../ProTip';
import { usePermissions } from '../../hooks/usePermissions';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useDataActions } from '../../contexts/DataContext';

import ProfileSettings from './ProfileSettings';
import FirmSettings from './FirmSettings';
import TemplatesSettings, { TemplateSubTab, CategorySubTab } from './TemplatesSettings';
import HelpView from '../HelpView';
import AutomationSettings from './AutomationSettings';
import SubscriptionSettings from './SubscriptionSettings';
import SecuritySettings from './SecuritySettings';
import AgentSettings from './AgentSettings';
import DataManagementSettings from './DataManagementSettings';
import ChangelogSettings from './ChangelogSettings';
import AccountRecoverySettings from './AccountRecoverySettings';
import IntegrationSettings from './IntegrationSettings';
import { PortalAccessSettings } from './PortalAccessSettings';
import { NotificationSettings } from './NotificationSettings';

import { useFeatures } from '../../hooks/useFeatures';
import { LegalIntelligenceHub } from './LegalIntelligenceHub';
import { useProduct } from '../../contexts/ProductContext';

type SettingsTab = 'profile' | 'firm' | 'subscription' | 'security' | 'templates' | 'agents' | 'help' | 'data' | 'changelog' | 'legalIntel' | 'recovery' | 'communications' | 'notifications' | 'portal';

const tabMapping: Record<string, { main: SettingsTab, sub?: TemplateSubTab | CategorySubTab | 'automations' }> = {
    'my-profile': { main: 'profile' },
    'professional-standards': { main: 'profile' },
    'firm-details': { main: 'firm' },
    'firm-switching': { main: 'firm' },
    'settings-nav-firm': { main: 'firm' },
    'user-management': { main: 'firm' },
    'financial-config': { main: 'firm' },
    'subscription-management': { main: 'subscription' },
    'security-logs': { main: 'security' },
    'agent-management': { main: 'agents' },
    'workflow-management': { main: 'templates', sub: 'workflows' },
    'checklist-template-management': { main: 'templates', sub: 'checklists' },
    'document-template-management': { main: 'templates', sub: 'documents' },
    'event-type-management': { main: 'templates', sub: 'events' },
    'contact-category-management': { main: 'templates', sub: 'contacts' },
    'document-category-management': { main: 'templates', sub: 'documents_folders' },
    'display-settings': { main: 'profile' },
    'theme-preference': { main: 'profile' }, // Long-press theme toggle target
    'notification-settings': { main: 'profile' },
    'automation-settings': { main: 'templates', sub: 'automations' },
    'help-and-support': { main: 'help' },
    'data-management': { main: 'data' },
    'account-recovery': { main: 'recovery' },
    'portal-access': { main: 'portal' }
};

// ─── Nav Item ─────────────────────────────────────────────────────────────
// Tinted icon container + label. Active state uses a soft emerald tint
// (no harsh borders) and a left accent bar on desktop.
const NavItem: React.FC<{
    label: string;
    description?: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
    id?: string;
    onCloseDrawer?: () => void;
}> = ({ label, description, icon, isActive, onClick, id, onCloseDrawer }) => {
    const handleClick = () => {
        onClick();
        onCloseDrawer?.();
    };
    return (
        <button
            id={id}
            onClick={handleClick}
            className={`
                group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                transition-all duration-200 text-left
                ${isActive
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 shadow-soft'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-zinc-100'
                }
            `}
        >
            {/* Tinted icon container — gives icons a consistent visual weight
                regardless of the underlying icon's stroke width. */}
            <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                ${isActive
                    ? 'bg-emerald-100 dark:bg-emerald-800/40 text-emerald-600 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 group-hover:bg-slate-200 dark:group-hover:bg-zinc-700'
                }
            `}>
                <div className="w-4 h-4">{icon}</div>
            </div>
            <div className="flex-1 min-w-0">
                <span className="block text-sm font-semibold truncate">{label}</span>
                {description && (
                    <span className="block text-2xs text-slate-400 dark:text-zinc-500 truncate mt-0.5">
                        {description}
                    </span>
                )}
            </div>
            {isActive && (
                <div className="w-1 h-6 rounded-full bg-emerald-500 flex-shrink-0" />
            )}
        </button>
    );
};

// ─── Section Heading (inside the sidebar) ────────────────────────────────
const SectionHeading: React.FC<{ label: string }> = ({ label }) => (
    <div className="px-3 pt-5 pb-2 first:pt-0">
        <p className="text-2xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
            {label}
        </p>
    </div>
);

// ─── Locked Demo Panel (unchanged) ───────────────────────────────────────
const LockedDemoPanel: React.FC<{ title: string, description: string, onSignup: () => void }> = ({ title, description, onSignup }) => (
    <div className="flex flex-col items-center justify-center text-center p-12 bg-white dark:bg-zinc-800 rounded-3xl border border-dashed border-slate-300 dark:border-zinc-700 h-full">
        <div className="p-4 bg-primary-50 dark:bg-zinc-700 rounded-2xl mb-6">
            <LockClosedIcon className="w-12 h-12 text-primary-500" />
        </div>
        <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">{title}</h3>
        <p className="text-slate-500 dark:text-zinc-400 max-w-sm mb-8">{description}</p>
        <button
            onClick={onSignup}
            className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-black transition-all shadow-xl shadow-primary-500/20 active:scale-95"
        >
            Unlock with Your Account
        </button>
    </div>
);

// ─── Sidebar Contents (shared between desktop sidebar and mobile drawer) ─
// Extracted so we don't duplicate the nav structure in two places.
const SidebarContents: React.FC<{
    activeTab: SettingsTab;
    onNavClick: (tab: SettingsTab) => void;
    onCloseDrawer?: () => void;
    permissions: any;
    canUseAI: boolean;
    canUseAuditLogs: boolean;
    isProperty: boolean;
    isUnified: boolean;
    isLegal: boolean;
    isEnterprise: boolean;
    currentUser: any;
    navigateTo: (view: string, id?: any, ctx?: any) => void;
}> = ({ activeTab, onNavClick, onCloseDrawer, permissions, canUseAI, canUseAuditLogs, isProperty, isUnified, isLegal, isEnterprise, currentUser, navigateTo }) => {
    const handleNav = (tab: SettingsTab) => onNavClick(tab);

    return (
        <div className="flex flex-col gap-0 p-3">
            {/* ─── Account Section ─── */}
            <SectionHeading label="Account" />
            <NavItem
                label="My Profile"
                description="Personal info & preferences"
                icon={<UserCircleIcon />}
                isActive={activeTab === 'profile'}
                onClick={() => handleNav('profile')}
                onCloseDrawer={onCloseDrawer}
            />

            {/* ─── Practice / Workspace Section ─── */}
            <SectionHeading label={isProperty ? 'Workspace' : 'Practice'} />

            {canUseAI && (
                <NavItem
                    label="AI Settings"
                    description={isProperty ? "ARIA configuration" : "ALOA configuration"}
                    icon={<ZapIcon />}
                    isActive={activeTab === 'agents'}
                    onClick={() => handleNav('agents')}
                    onCloseDrawer={onCloseDrawer}
                />
            )}

            {isProperty && !isUnified && (
                <NavItem
                    label="Revenue Protection Guide"
                    icon={<ShieldCheckIcon className="text-emerald-500" />}
                    isActive={false}
                    onClick={() => { onCloseDrawer?.(); navigateTo('help', null, { activeSection: 'revenue-engine' }); }}
                />
            )}

            {(permissions.canManageFirmDetails || permissions.canManageTemplates) && (
                <>
                    {permissions.canManageFirmDetails && (
                        <NavItem
                            label={isProperty ? 'Portfolio Details' : 'Firm Details'}
                            description="Identity, branding, integrations"
                            icon={<OfficeBuildingIcon />}
                            id="settings-nav-firm"
                            isActive={activeTab === 'firm'}
                            onClick={() => handleNav('firm')}
                            onCloseDrawer={onCloseDrawer}
                        />
                    )}
                    <NavItem
                        label="Billing & Plans"
                        description="Subscription & add-ons"
                        icon={<div className="font-serif font-bold text-base">₦</div>}
                        isActive={activeTab === 'subscription'}
                        onClick={() => handleNav('subscription')}
                        onCloseDrawer={onCloseDrawer}
                    />
                    <NavItem
                        label="Communications"
                        description="WhatsApp & email gateways"
                        icon={<MessagingIcon />}
                        isActive={activeTab === 'communications'}
                        onClick={() => handleNav('communications')}
                        onCloseDrawer={onCloseDrawer}
                    />
                    <NavItem
                        label="Notifications"
                        description="Email alert preferences"
                        icon={<BellIcon />}
                        isActive={activeTab === 'notifications'}
                        onClick={() => handleNav('notifications')}
                        onCloseDrawer={onCloseDrawer}
                    />
                    <NavItem
                        label={isUnified ? 'Portal Access' : isProperty ? "Residents' Portal" : 'Client Portal'}
                        description="Invitations & service types"
                        icon={<ShieldCheckIcon className="text-primary-500" />}
                        id="portal-access"
                        isActive={activeTab === 'portal'}
                        onClick={() => handleNav('portal')}
                        onCloseDrawer={onCloseDrawer}
                    />
                    {permissions.canManageTemplates && (
                        <NavItem
                            label={isProperty ? 'Portfolio Configuration' : 'Firm Configuration'}
                            description="Workflows, checklists, templates"
                            icon={<ClipboardListIcon />}
                            isActive={activeTab === 'templates'}
                            onClick={() => handleNav('templates')}
                            onCloseDrawer={onCloseDrawer}
                        />
                    )}

                    {isLegal && isEnterprise && (
                        <NavItem
                            label="Legal Intelligence"
                            description="Statute library & research"
                            icon={<ShieldCheckIcon />}
                            isActive={activeTab === 'legalIntel'}
                            onClick={() => handleNav('legalIntel')}
                            onCloseDrawer={onCloseDrawer}
                        />
                    )}
                </>
            )}

            {/* ─── System Section ─── */}
            <SectionHeading label="System" />
            <NavItem
                label="Data & Export"
                description="Backup and cleanup"
                icon={<TrashIcon />}
                isActive={activeTab === 'data'}
                onClick={() => handleNav('data')}
                onCloseDrawer={onCloseDrawer}
            />
            <NavItem
                label="Security"
                description="Audit logs & access"
                icon={canUseAuditLogs ? <ShieldCheckIcon /> : <LockClosedIcon />}
                isActive={activeTab === 'security'}
                onClick={() => handleNav('security')}
                onCloseDrawer={onCloseDrawer}
            />
            {currentUser?.role === UserRole.Admin && (
                <NavItem
                    label="Account Recovery"
                    description="Admin recovery tools"
                    icon={<ShieldCheckIcon className="text-indigo-500" />}
                    isActive={activeTab === 'recovery'}
                    onClick={() => handleNav('recovery')}
                    onCloseDrawer={onCloseDrawer}
                />
            )}
            <NavItem
                label="Help"
                description="Guides & support"
                icon={<HelpCircleIcon />}
                isActive={activeTab === 'help'}
                onClick={() => handleNav('help')}
                onCloseDrawer={onCloseDrawer}
            />
            <NavItem
                label="What's New"
                description="Recent updates"
                icon={
                    <span className="relative flex items-center justify-center w-4 h-4">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full" />
                    </span>
                }
                isActive={activeTab === 'changelog'}
                onClick={() => handleNav('changelog')}
                onCloseDrawer={onCloseDrawer}
            />
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────
export const SettingsView: React.FC = () => {
    const { coreState } = useCoreState();
    const { theme, setTheme, settingsTargetId, navigateTo, currentHistoryEntry, openModal } = useUI();
    const { executionState } = useExecutionState();
    const { currentUser } = useAuth();
    const { handleUpdateUser, deleteItem, handleUpdateWorkflow, handleUpdateFirmDetails } = useDataActions();
    const { canUseAuditLogs, canUseAI, canUseAutomation } = useFeatures();

    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
    const [activeSubTab, setActiveSubTab] = useState<TemplateSubTab | CategorySubTab | 'automations' | null>(null);
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
    const processedTargetIdRef = useRef<string | null>(null);
    const permissions = usePermissions();

    const isDemo = currentUser?.email === 'demo@practicepro.ng';
    const { isLegal, isProperty, isUnified } = useProduct();
    const selectedWorkflowId = currentHistoryEntry.context?.selectedWorkflowId;
    const selectedSubCategory = currentHistoryEntry.context?.selectedSubCategory;

    const onTargetProcessed = () => {};

    // Legacy mapping support for internal components
    const props = {
        theme,
        setTheme,
        currentUser: currentUser!,
        users: coreState.users,
        onUpdateUser: (d: any) => handleUpdateUser(currentUser!.id, d),
        openUserModal: openModal,
        onDeleteUser: (id: string) => deleteItem('users', id, 'User'),
        workflows: executionState.workflows,
        onUpdateWorkflow: handleUpdateWorkflow,
        eventTypes: coreState.eventTypes,
        contactCategories: coreState.contactCategories,
        onDeleteContactCategory: (id: string) => deleteItem('contactCategories', id, 'Category'),
        documentCategories: coreState.documentCategories,
        documentTemplateCategories: coreState.documentTemplateCategories,
        folderPermissions: coreState.folderPermissions,
        onDeleteDocumentCategory: (id: string) => deleteItem('documentCategories', id, 'Folder'),
        checklistTemplates: coreState.checklistTemplates,
        documentTemplates: coreState.documentTemplates,
        onDeleteDocumentTemplate: (id: string, name: string) => deleteItem('documentTemplates', id, name),
        onDeleteDocumentTemplateCategory: (id: string, name: string) => deleteItem('documentTemplateCategories', id, name),
        firmDetails: coreState.firmDetails,
        onUpdateFirmDetails: handleUpdateFirmDetails,
        openModal,
        settingsTargetId,
        onTargetProcessed,
        appMode: currentUser?.id ? 'app' : 'setup',
        onNavigate: navigateTo,
        currentHistoryEntry,
        onEnableDevMode: () => console.log("Dev mode not supported here.")
    };

    // ── Deep-link target handling (e.g. "open Portal Access" from elsewhere) ──
    useEffect(() => {
        const targetId = settingsTargetId || currentHistoryEntry?.context?.settingsTargetId;

        if (targetId && targetId !== processedTargetIdRef.current) {
            const target = tabMapping[targetId];
            if (target) {
                processedTargetIdRef.current = targetId;
                setActiveTab(target.main);
                if (target.sub) setActiveSubTab(target.sub);

                setTimeout(() => {
                    const element = document.getElementById(targetId);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        element.classList.add('ring-2', 'ring-primary-500', 'dark:ring-primary-400', 'ring-offset-2', 'dark:ring-offset-zinc-900', 'transition-all', 'duration-500');

                        setTimeout(() => {
                            element.classList.remove('ring-2', 'ring-primary-500', 'dark:ring-primary-400', 'ring-offset-2', 'dark:ring-offset-zinc-900');
                            onTargetProcessed();
                        }, 2500);
                    } else {
                        onTargetProcessed();
                    }
                }, 300);
            }
        } else if (!targetId) {
            processedTargetIdRef.current = null;
        }
    }, [settingsTargetId, currentHistoryEntry, onTargetProcessed]);

    const handleNavClick = (tab: SettingsTab) => {
        setActiveTab(tab);
        setActiveSubTab(null);
    };

    // Scroll content to top on tab change
    useEffect(() => {
        const scrollContainer = document.getElementById('settings-content-scroll');
        if (scrollContainer) {
            scrollContainer.scrollTop = 0;
        }
    }, [activeTab, activeSubTab]);

    // Close drawer on Escape key
    useEffect(() => {
        if (!isMobileDrawerOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsMobileDrawerOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isMobileDrawerOpen]);

    // Lock body scroll when drawer is open (mobile only)
    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (isMobileDrawerOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isMobileDrawerOpen]);

    const renderContent = () => {
        const demoGate = (title: string, desc: string) => (
            <LockedDemoPanel
                title={title}
                description={desc}
                onSignup={() => openModal('signup')}
            />
        );

        switch (activeTab) {
            case 'profile': return <ProfileSettings {...props} theme={props.theme} setTheme={props.setTheme} initialSubTab={settingsTargetId === 'theme-preference' || settingsTargetId === 'display-settings' ? 'appearance' : undefined} />;
            case 'firm': return <FirmSettings {...props} onEnableDevMode={props.onEnableDevMode} />;
            case 'subscription':
                return isDemo
                    ? demoGate("Billing & Plans", "View and manage your firm's billing and plans after you create an account.")
                    : <SubscriptionSettings firmDetails={props.firmDetails} onUpdateFirmDetails={props.onUpdateFirmDetails} />;
            case 'security': return <SecuritySettings activities={coreState.firmActivity} users={props.users} onEnableDevMode={props.onEnableDevMode} />;
            case 'agents':
                return isDemo
                    ? demoGate(isProperty ? "ARIA Brain" : "ALOA® AI Architecture", isProperty ? "Configure your property AI agents, document parsers, and custom model parameters in your own workspace." : "Configure personalized AI personalities, agency settings, and model parameters in your own workspace.")
                    : <AgentSettings firmDetails={props.firmDetails} onUpdateFirmDetails={props.onUpdateFirmDetails} currentUser={props.currentUser} />;
            case 'data': return <DataManagementSettings onEnableDevMode={props.onEnableDevMode} />;
            case 'templates':
                if (isDemo && (activeSubTab === 'automations' || activeSubTab === 'workflows')) {
                    return demoGate("Process Automation", "Design custom logic flows and automated triggers for your firm.");
                }
                return <TemplatesSettings
                    {...props}
                    activeTab={activeSubTab as any}
                    selectedWorkflowId={selectedWorkflowId}
                    selectedSubCategory={selectedSubCategory}
                    onDeleteContactCategory={props.onDeleteContactCategory}
                    onDeleteDocumentCategory={props.onDeleteDocumentCategory}
                    automationRules={coreState.automationRules}
                />;
            case 'help': return <HelpView />;
            case 'changelog': return <ChangelogSettings />;
            case 'legalIntel': return <LegalIntelligenceHub firmId={props.firmDetails?.id || ''} />;
            case 'recovery': return <AccountRecoverySettings />;
            case 'communications': return <IntegrationSettings />;
            case 'notifications': return <NotificationSettings />;
            case 'portal': return <PortalAccessSettings />;
            default: return null;
        }
    };

    // ── Compute the active tab's display name for the mobile header ──
    const activeTabLabel: Record<SettingsTab, string> = {
        profile: 'My Profile',
        firm: isProperty ? 'Portfolio Details' : 'Firm Details',
        subscription: 'Billing & Plans',
        security: 'Security',
        templates: isProperty ? 'Portfolio Configuration' : 'Firm Configuration',
        agents: 'AI Settings',
        help: 'Help',
        data: 'Data & Export',
        changelog: "What's New",
        legalIntel: 'Legal Intelligence',
        recovery: 'Account Recovery',
        communications: 'Communications',
        notifications: 'Notifications',
        portal: isUnified ? 'Portal Access' : isProperty ? "Residents' Portal" : 'Client Portal',
    };

    return (
        <div className="h-[100dvh] flex flex-col bg-slate-50 dark:bg-zinc-950 overflow-hidden">
            {/* ─── Header (sticky, consistent across breakpoints) ─────────────── */}
            <header className="sticky top-0 z-30 flex-shrink-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-zinc-800">
                <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
                    <div className="flex items-center justify-between gap-3">
                        {/* Mobile: hamburger + active tab name. Desktop: Settings title. */}
                        <div className="flex items-center gap-3 min-w-0">
                            {/* Mobile drawer toggle (hidden on lg+) */}
                            <button
                                onClick={() => setIsMobileDrawerOpen(true)}
                                className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                aria-label="Open settings menu"
                            >
                                <MenuIcon className="w-5 h-5" />
                            </button>
                            <div className="min-w-0">
                                {/* On mobile show the active section name; on desktop show "Settings" */}
                                <h2 className="text-base sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                    <span className="lg:hidden">{activeTabLabel[activeTab]}</span>
                                    <span className="hidden lg:inline">Settings</span>
                                </h2>
                                <p className="hidden sm:block text-xs font-medium text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                                    {isProperty
                                        ? 'Manage your portfolio preferences and workspace configurations.'
                                        : 'Manage your firm preferences and system configurations.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* ─── Mobile Drawer (slide-in from left) ─────────────────────────── */}
            {/* Renders only on screens < lg. Uses transform + transition for smooth slide. */}
            {isMobileDrawerOpen && (
                <div
                    className="lg:hidden fixed inset-0 z-50 flex"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Settings navigation"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
                        onClick={() => setIsMobileDrawerOpen(false)}
                    />
                    {/* Drawer panel */}
                    <div className="relative w-[85%] max-w-xs bg-white dark:bg-zinc-900 shadow-premium flex flex-col h-full animate-[slideInLeft_0.25s_ease-out]">
                        {/* Drawer header */}
                        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-zinc-800 flex-shrink-0">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">Settings</h3>
                                <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                    {isProperty ? 'Portfolio preferences' : 'Firm preferences'}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsMobileDrawerOpen(false)}
                                className="p-2 -mr-2 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                aria-label="Close menu"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        {/* Drawer contents (scrollable) */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <SidebarContents
                                activeTab={activeTab}
                                onNavClick={handleNavClick}
                                onCloseDrawer={() => setIsMobileDrawerOpen(false)}
                                permissions={permissions}
                                canUseAI={canUseAI}
                                canUseAuditLogs={canUseAuditLogs}
                                isProperty={isProperty}
                                isUnified={isUnified}
                                isLegal={isLegal}
                                isEnterprise={props.firmDetails?.subscriptionPlan === SubscriptionPlan.Enterprise}
                                currentUser={currentUser}
                                navigateTo={navigateTo as any}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Body: desktop sidebar + content ────────────────────────────── */}
            <div className="flex-grow flex lg:flex-row min-h-0 p-3 sm:p-4 lg:p-6 gap-3 sm:gap-4 lg:gap-6">
                {/* Desktop sidebar (hidden on mobile — drawer replaces it) */}
                <aside className="hidden lg:flex lg:flex-col lg:w-72 xl:w-80 flex-shrink-0 bg-white dark:bg-zinc-900/50 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                    <div className="px-2 py-4 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
                        <h3 className="px-3 text-sm font-bold text-slate-900 dark:text-white">Navigation</h3>
                        <p className="px-3 text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            Choose a section to configure
                        </p>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <SidebarContents
                            activeTab={activeTab}
                            onNavClick={handleNavClick}
                            permissions={permissions}
                            canUseAI={canUseAI}
                            canUseAuditLogs={canUseAuditLogs}
                            isProperty={isProperty}
                            isUnified={isUnified}
                            isLegal={isLegal}
                            isEnterprise={props.firmDetails?.subscriptionPlan === SubscriptionPlan.Enterprise}
                            currentUser={currentUser}
                            navigateTo={navigateTo as any}
                        />
                    </div>
                </aside>

                {/* Content Area */}
                <main
                    id="settings-content-scroll"
                    className="flex-1 min-w-0 min-h-0 bg-white dark:bg-zinc-900/50 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-y-auto custom-scrollbar"
                >
                    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-12">
                        {/* Mobile: show a small "back to menu" hint at the top of long content */}
                        <div className="lg:hidden -mt-1 mb-4">
                            <button
                                onClick={() => setIsMobileDrawerOpen(true)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                            >
                                <ChevronRightIcon className="w-3.5 h-3.5 rotate-180" />
                                All settings
                            </button>
                        </div>
                        {renderContent()}
                    </div>
                </main>
            </div>

            {/* Inline keyframes for drawer animations */}
            <style>{`
                @keyframes slideInLeft {
                    from { transform: translateX(-100%); opacity: 0.6; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default SettingsView;
