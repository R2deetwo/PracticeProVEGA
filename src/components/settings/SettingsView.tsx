
import React, { useEffect, useState, useRef } from 'react';
import { Theme, WorkflowDefinition, CustomEventType, ModalType, ContactCategory, DocumentCategory, User, UserRole, ChecklistTemplate, FirmDetails, AppMode, DocumentTemplate, DocumentTemplateCategory, View, HistoryEntry, SubscriptionPlan } from '../../types';
import { UserCircleIcon, OfficeBuildingIcon, ClipboardListIcon, TagIcon, DesktopComputerIcon, HelpCircleIcon, ZapIcon, FormIcon, ShieldCheckIcon, LockClosedIcon, TrashIcon, MessagingIcon, BellIcon } from '../../constants';

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
import { HelpSettings } from './HelpSettings';
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
    'notification-settings': { main: 'profile' },
    'automation-settings': { main: 'templates', sub: 'automations' },
    'help-and-support': { main: 'help' },
    'data-management': { main: 'data' },
    'account-recovery': { main: 'recovery' },
    'portal-access': { main: 'portal' }
};

const NavItem: React.FC<{
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
    id?: string;
}> = ({ label, icon, isActive, onClick, id }) => (
    <button
        id={id}
        onClick={onClick}
        className={`flex items-center p-2 sm:p-3 rounded-lg transition-all duration-200 text-left whitespace-nowrap lg:w-full lg:mb-1 flex-shrink-0 ${isActive
            ? 'bg-white dark:bg-zinc-700 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-zinc-600 lg:border-none lg:border-l-4 lg:border-primary-500'
            : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700/50 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
    >
        <div className={`w-5 h-5 mr-1.5 sm:mr-2 lg:mr-3 flex-shrink-0 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-zinc-500'}`}>
            {icon}
        </div>
        <span className="font-medium text-xs sm:text-sm">{label}</span>
    </button>
);

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

export const SettingsView: React.FC = () => {
    const { coreState } = useCoreState();
    const { theme, setTheme, settingsTargetId, navigateTo, currentHistoryEntry, openModal } = useUI();
    const { executionState } = useExecutionState();
    const { currentUser } = useAuth();
    const { handleUpdateUser, deleteItem, handleUpdateWorkflow, handleUpdateFirmDetails } = useDataActions();
    const { canUseAuditLogs, canUseAI, canUseAutomation } = useFeatures();

    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
    const [activeSubTab, setActiveSubTab] = useState<TemplateSubTab | CategorySubTab | 'automations' | null>(null);
    const processedTargetIdRef = useRef<string | null>(null);
    const permissions = usePermissions();

    const isDemo = currentUser?.email === 'demo@practicepro.ng';
    const { isLegal, isProperty, isUnified } = useProduct();
    const selectedWorkflowId = currentHistoryEntry.context?.selectedWorkflowId;
    const selectedSubCategory = currentHistoryEntry.context?.selectedSubCategory;

    const onTargetProcessed = () => {}; // Handled in UI context or locally

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
        appMode: currentUser?.id ? 'app' : 'setup', // Fallback
        onNavigate: navigateTo,
        currentHistoryEntry,
        onEnableDevMode: () => console.log("Dev mode not supported here.")
    };

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

    useEffect(() => {
        const scrollContainer = document.getElementById('settings-content-scroll');
        if (scrollContainer) {
            scrollContainer.scrollTop = 0;
        }
    }, [activeTab, activeSubTab]);

    const renderContent = () => {
        const demoGate = (title: string, desc: string) => (
            <LockedDemoPanel 
                title={title} 
                description={desc} 
                onSignup={() => openModal('signup')} 
            />
        );

        switch (activeTab) {
            case 'profile': return <ProfileSettings {...props} theme={props.theme} setTheme={props.setTheme} />;
            case 'firm': return <FirmSettings {...props} onEnableDevMode={props.onEnableDevMode} />;
            case 'subscription': 
                return isDemo 
                    ? demoGate("Subscription Management", "View and manage your firm's billing and plans after you create an account.") 
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
            case 'help': return <HelpSettings />;
            case 'changelog': return <ChangelogSettings />;
            case 'legalIntel': return <LegalIntelligenceHub firmId={props.firmDetails?.id || ''} />;
            case 'recovery': return <AccountRecoverySettings />;
            case 'communications': return <IntegrationSettings />;
            case 'notifications': return <NotificationSettings />;
            case 'portal': return <PortalAccessSettings />;
            default: return null;

        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-900 overflow-hidden">
            <header className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-0">
                <div>
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h2>
                    <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-1">
                        {isProperty ? 'Manage your portfolio preferences and workspace configurations.' : 'Manage your firm preferences and system configurations.'}
                    </p>
                </div>
            </header>

            <div className="flex-grow flex flex-col lg:flex-row gap-6 min-h-0 p-4 sm:p-6 lg:p-8">
                <nav className="
                    flex-shrink-0 
                    flex lg:flex-col gap-2 lg:gap-0
                    overflow-x-auto lg:overflow-y-auto custom-scrollbar scrollbar-none
                    bg-slate-50 dark:bg-zinc-800/50 
                    p-2 lg:p-4 
                    rounded-xl border border-slate-200 dark:border-zinc-700 
                    lg:w-64 lg:h-full
                ">

                    {/* Account Section */}
                    <div className="flex lg:flex-col gap-2 lg:gap-1 lg:mb-6">
                        <p className="hidden lg:block px-3 pb-2 text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Account</p>
                        <NavItem label="My Profile" icon={<UserCircleIcon />} isActive={activeTab === 'profile'} onClick={() => handleNavClick('profile')} />
                    </div>

                    {/* Practice/Workspace Config Section */}
                    <div className="flex lg:flex-col gap-2 lg:gap-1 lg:mb-6">
                        <p className="hidden lg:block px-3 pb-2 text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                            {isProperty ? 'Workspace Configuration' : 'Practice Configuration'}
                        </p>

                        {/* AI Settings accessible to ALL users for Personal Key */}
                        {canUseAI && <NavItem label="AI Settings" icon={<ZapIcon />} isActive={activeTab === 'agents'} onClick={() => handleNavClick('agents')} />}

                        {isProperty && !useProduct().isUnified && (
                            <NavItem 
                                label="Revenue Protection Guide" 
                                icon={<ShieldCheckIcon className="text-emerald-500" />} 
                                isActive={false} 
                                onClick={() => navigateTo('help', null, { activeSection: 'revenue-engine' })} 
                            />
                        )}

                        {(permissions.canManageFirmDetails || permissions.canManageTemplates) && (
                            <>
                                {permissions.canManageFirmDetails &&
                                    <NavItem
                                        label={isProperty ? 'Portfolio Details' : 'Firm Details'}
                                        icon={<OfficeBuildingIcon />}
                                        id="settings-nav-firm"
                                        isActive={activeTab === 'firm'}
                                        onClick={() => handleNavClick('firm')}
                                    />
                                }
                                <NavItem label="Billing & Plans" icon={<div className="font-serif font-bold px-1">₦</div>} isActive={activeTab === 'subscription'} onClick={() => handleNavClick('subscription')} />
                                <NavItem label="Communications" icon={<MessagingIcon />} isActive={activeTab === 'communications'} onClick={() => handleNavClick('communications')} />
                                <NavItem label="Notifications" icon={<BellIcon />} isActive={activeTab === 'notifications'} onClick={() => handleNavClick('notifications')} />
                                <NavItem label={isUnified ? 'Portal Access' : isProperty ? "Residents' Portal" : 'Client Portal'} icon={<ShieldCheckIcon className="text-primary-500" />} id="portal-access" isActive={activeTab === 'portal'} onClick={() => handleNavClick('portal')} />
                                {permissions.canManageTemplates && <NavItem label={isProperty ? 'Portfolio Configuration' : 'Firm Configuration'} icon={<ClipboardListIcon />} isActive={activeTab === 'templates'} onClick={() => handleNavClick('templates')} />}


                                {/* Legal Intelligence Hub — Enterprise + Legal only */}
                                {isLegal && props.firmDetails?.subscriptionPlan === SubscriptionPlan.Enterprise && (
                                    <NavItem
                                        label="Legal Intelligence"
                                        icon={<ShieldCheckIcon />}
                                        isActive={activeTab === 'legalIntel'}
                                        onClick={() => handleNavClick('legalIntel')}
                                    />
                                )}
                            </>
                        )}
                    </div>

                    {/* System Section */}
                    <div className="flex lg:flex-col gap-2 lg:gap-1">
                        <p className="hidden lg:block px-3 pb-2 text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">System</p>
                        <NavItem label="Data & Export" icon={<TrashIcon />} isActive={activeTab === 'data'} onClick={() => handleNavClick('data')} />
                        <NavItem label="Security" icon={canUseAuditLogs ? <ShieldCheckIcon /> : <LockClosedIcon />} isActive={activeTab === 'security'} onClick={() => handleNavClick('security')} />
                        {currentUser?.role === UserRole.Admin && (
                            <NavItem label="Account Recovery" icon={<ShieldCheckIcon className="text-indigo-500" />} isActive={activeTab === 'recovery'} onClick={() => handleNavClick('recovery')} />
                        )}
                        <NavItem label="Help" icon={<HelpCircleIcon />} isActive={activeTab === 'help'} onClick={() => handleNavClick('help')} />
                        <NavItem
                            label="What's New"
                            icon={
                                <span className="relative flex items-center justify-center w-5 h-5">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-500 rounded-full" />
                                </span>
                            }
                            isActive={activeTab === 'changelog'}
                            onClick={() => handleNavClick('changelog')}
                        />
                    </div>
                </nav>

                {/* Content Area */}
                <div id="settings-content-scroll" className="flex-1 min-w-0 bg-white dark:bg-zinc-900/50 rounded-xl p-1 lg:p-4 overflow-y-auto lg:border lg:border-slate-200 lg:dark:border-zinc-800 custom-scrollbar">
                    <div className="max-w-4xl mx-auto space-y-8 pb-28 lg:pb-8">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};
export default SettingsView;
