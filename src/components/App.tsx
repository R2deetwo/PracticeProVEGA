import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { View, ModalType, AppState, Task, Document, User, NotePage, HistoryEntry, Invoice, UserRole, Theme, TaskStatus, ClientMessage, Contact, Lead, AppMode, SubscriptionPlan } from '../types';
import { useMatterState } from '../contexts/MatterContext';
import { useFinanceState } from '../contexts/FinanceContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useDocumentState } from '../contexts/DocumentContext';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useOnboarding } from '../contexts/OnboardingProvider';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { OfficeBuildingIcon, Logo } from '../constants';
import { useProduct } from '../contexts/ProductContext';

import Sidebar from './Sidebar';
import Header from './Header';
import Dashboard from './Dashboard';
import ContactsView from './ContactsView';
import { TasksView } from './TasksView';
import { DocumentList } from './DocumentList';
import { CalendarView } from './CalendarView';
import { BillingView } from './BillingView';
import { BillingMonitorView } from './BillingMonitorView';
import ReportingView from './ReportingView';
import ComplianceView from './ComplianceView';
import SettingsView from './settings/SettingsView';
import MessagesView from './MessagesView';
import { WordProcessor } from './documents/WordProcessor';
import ResearchView from './ResearchView';
import { AloaXView } from './indexer/AloaXView';
import TimelineView from './TimelineView';
import CommandPalette from './CommandPalette';
import ContextMenu from './ContextMenu';
import { SplitMasterDetail } from './layout/SplitMasterDetail';
import ErrorBoundary from './ErrorBoundary';
import { FeatureGuard } from './FeatureGuard';
import OnboardingWizard from './modals/OnboardingWizard';
import {
    DashboardSkeleton,
    TasksSkeleton,
    MattersSkeleton,
    ContactsSkeleton,
    DocumentsSkeleton,
    GenericSkeleton
} from './toolkit/Skeleton';
import { NotesView } from './NotesView';
import HelpView from './HelpView';
import ArchiveView from './ArchiveView';
import ModalManager from './modals/ModalManager';
import { DockedModal } from './modals/DockedModal';
import { MatterDetailView } from './details/MatterDetailView';
import { ContactDetailView } from './details/ContactDetailView';
import { DocumentDetailView } from './details/DocumentDetailView';
import { InvoiceDetailView } from './details/InvoiceDetailView';
import { ReceiptDetailView } from './details/ReceiptDetailView';
import LockScreen from './LockScreen';
import SplashScreen from './SplashScreen';
import FloatingTestControls from './FloatingTestControls';
import ToastContainer from './ToastContainer';
import DemoProductSwitcher from './DemoProductSwitcher';

import { LandingPage } from './LandingPage';
import BottomNav from './BottomNav';
import FullScreenSearch from './FullScreenSearch';
import AloaPanel from './aloa/AloaPanel';
import AloaFAB from './aloa/AloaFAB';
import { MatterList } from './MatterList';



import PropertyManagerView from './PropertyManagerView';
import PropertyDetailView from './details/PropertyDetailView';
import OnboardingTour from './OnboardingTour';
import ClientDashboard from './client/ClientDashboard';
import { ClientMatterDetailView } from './client/ClientMatterDetailView';
import { ClientIntakePortal } from './client/ClientIntakePortal';
import TenantPortal from './tenant/TenantPortal';
import { PrivacyPolicy } from './PrivacyPolicy';
import { TermsOfService } from './TermsOfService';
import { PortalTermsOfUse } from './PortalTermsOfUse';
import RevenueEngine from './atrium/RevenueEngine';


import DataProcessingAgreement from './DataProcessingAgreement';
import CookiePolicy from './CookiePolicy';
import NotFoundView from './NotFoundView';
import ClientPortalLogin from './portal/ClientPortalLogin';
import TenantPortalLogin from './portal/TenantPortalLogin';
import SetupPassword from './portal/SetupPassword';
import WhatsNew from './WhatsNew';
import { useBrainAutoIndex } from '../hooks/useBrainAutoIndex';
import CookieConsent from './CookieConsent';
import { useConfirm } from './ui/ConfirmDialog';
import { useContentProtection } from '../hooks/useContentProtection';
import { isNativePlatform } from '../utils/capacitor';
import { useHapticFeedback } from '../hooks/useHapticFeedback';


const IDLE_TIMEOUT = 15 * 60 * 1000;

type FlowState = 'splash' | 'setup' | 'app';

// ViewWrapper now takes full height and acts as the mount point for major views
const ViewWrapper: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => (
    <div className={`animate-fade-in flex flex-col relative w-full h-full ${className || ''}`}>
        <ErrorBoundary>
            {children}
        </ErrorBoundary>
    </div>
);

const MainContent = React.memo(({ onToggleToolkit, isToolkitOpen, onCloseToolkit, onEnableDevMode, flowState }: { onToggleToolkit: () => void, isToolkitOpen: boolean, onCloseToolkit: () => void, onEnableDevMode: () => void, flowState: FlowState }) => {
    const { matterState } = useMatterState();
    const { financeState } = useFinanceState();
    const { executionState } = useExecutionState();
    const { documentState } = useDocumentState();
    const { coreState, isDataLoaded } = useCoreState();
    const dataHandlers = useDataActions();
    const { currentUser, appMode, updateCurrentUser, originalUser, revertToOriginalUser, isImpersonating } = useAuth();
    const ui = useUI();
    const { view, selectedId, currentHistoryEntry, isSidebarRetracted, openModal, closeModal, navigateTo, theme, goBack } = ui;
    const { product } = useProduct();

    useBrainAutoIndex();

    // TASK 13: Content protection — disables copy/paste, right-click, and
    // shows a black overlay when the window loses focus (screenshot deterrent).
    // Only active when the user is authenticated (not on the landing page).
    // See hooks/useContentProtection.ts for limitations.
    // TASK 19: Also get protectionEnabled so we can conditionally apply the
    // app-protected CSS class. Previously the class was always on the div,
    // which meant user-select:none was always active even when the user
    // toggled protection OFF in Settings.
    const { showOverlay: showScreenshotOverlay, protectionEnabled } = useContentProtection(!!currentUser);

    const hasData = matterState.matters.length > 0 || matterState.contacts.length > 0 || executionState.tasks.length > 0;
    const showSkeleton = !isDataLoaded && !hasData;
    const isClient = currentUser?.role === UserRole.Client;
    const isTenant = currentUser?.role === UserRole.Tenant;
    const isPortalUser = isClient || isTenant;

    if (import.meta.env.DEV) console.log("[App/MainContent] Rendering...", { flowState, isDataLoaded, hasData, showSkeleton, isClient, view });


    const onUpdateUser = React.useCallback((data: Partial<User>) => {
        if (!currentUser) return;
        dataHandlers.handleUpdateUser(currentUser.id, data);
        updateCurrentUser(data);
    }, [dataHandlers, currentUser, updateCurrentUser]);

    const [localPreviewDoc, setLocalPreviewDoc] = useState<Document | null>(null);
    const [mattersViewMode, setMattersViewMode] = useState<'list'|'board'>('list');

    // Sync initial state from user preferences once
    useEffect(() => {
        if (currentUser?.defaultViewModes?.matters) {
            setMattersViewMode(currentUser.defaultViewModes.matters as 'list'|'board');
        }
    }, [currentUser?.id]); // Only run when user changes

    useEffect(() => {
        setLocalPreviewDoc(null);
    }, [view]);

    const renderView = () => {
        // Portal users (Client/Tenant) load data from dedicated portal queries — they
        // must NEVER be blocked by the core-data skeleton, which tracks admin-side data
        // (matters, contacts, tasks) that portal users don't have access to.
        // This was the root cause of "Residents portal stuck on skeleton" — the skeleton
        // gate ran before the portal-user checks, so TenantPortal never rendered.
        if (isClient) {
            if (view === 'matterDetail' && selectedId) {
                return <ViewWrapper><ClientMatterDetailView /></ViewWrapper>;
            }

            if (view === 'intake' && selectedId) {
                return <ViewWrapper><ClientIntakePortal /></ViewWrapper>;
            }
            return <ViewWrapper><ClientDashboard /></ViewWrapper>;
        }

        if (isTenant) {
            return <ViewWrapper><TenantPortal /></ViewWrapper>;
        }

        // For admin/internal users, show skeleton while core data is loading
        if (showSkeleton) {
            switch (view) {
                case 'dashboard': return <DashboardSkeleton />;
                case 'tasks': return <TasksSkeleton />;
                case 'matters':
                case 'matterDetail': return <MattersSkeleton />;
                case 'contacts': return <ContactsSkeleton />;
                case 'documents': return <DocumentsSkeleton />;
                default: return <GenericSkeleton />;
            }
        }

        switch (view) {
            case 'dashboard': return (
                <ViewWrapper>
                    <Dashboard />
                </ViewWrapper>
            );


            case 'matters':
            case 'matterDetail': {
                const isDetailOpen = view === 'matterDetail' && !!selectedId;

                const handleViewModeChange = (mode: 'list' | 'board') => {
                    setMattersViewMode(mode);
                    onUpdateUser({ defaultViewModes: { ...currentUser?.defaultViewModes, matters: mode } });
                    if (mode === 'board' && isDetailOpen) {
                        navigateTo('matters'); // Close detail when switching to board
                    }
                };

                if (mattersViewMode === 'board' && !isDetailOpen) {
                    return (
                        <ViewWrapper>
                            <FeatureGuard requiredProduct="legal">
                                <MatterList
                                    viewMode="board"
                                    onViewModeChange={handleViewModeChange}
                                    onNavigate={navigateTo}
                                    isCompact={false}
                                />
                            </FeatureGuard>
                        </ViewWrapper>
                    );
                }

                return (
                    <ViewWrapper>
                        <FeatureGuard requiredProduct="legal">
                            <SplitMasterDetail
                                title="Matter Details"
                                isDetailVisible={isDetailOpen}
                                onCloseDetail={() => navigateTo('matters')}
                                sidebarContent={
                                    <MatterList
                                        viewMode="list" // Always force list in the sidebar to prevent squishing the board
                                        onViewModeChange={handleViewModeChange}
                                        onNavigate={navigateTo}
                                        isCompact={true}
                                    />
                                }
                                detailContent={
                                    selectedId ? (
                                        <MatterDetailView key={selectedId} />
                                    ) : null
                                }
                            />
                        </FeatureGuard>
                    </ViewWrapper>
                );
            }

            case 'contacts':
            case 'contactDetail':
                return (
                    <ViewWrapper>
                        <SplitMasterDetail
                            title="Contact Profile"
                            isDetailVisible={view === 'contactDetail'}
                            onCloseDetail={() => navigateTo('contacts')}
                            sidebarContent={
                                <ContactsView />
                            }
                            detailContent={
                                selectedId ? (
                                    <ContactDetailView
                                        contactId={selectedId}
                                        onGoBack={() => navigateTo('contacts')}
                                        openModal={openModal}
                                    />
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                                        <p className="text-lg font-medium">Select a contact to view profile</p>
                                    </div>
                                )
                            }
                        />
                    </ViewWrapper>
                );

            case 'tasks': return (
                <ViewWrapper>
                    <TasksView />
                </ViewWrapper>
            );


            case 'documents':
            case 'documentDetail':
                return (
                    <ViewWrapper>
                        <SplitMasterDetail
                            title="Document Preview"
                            isDetailVisible={(view === 'documentDetail' && !!selectedId) || !!localPreviewDoc}
                            onCloseDetail={() => {
                                if (localPreviewDoc) setLocalPreviewDoc(null);
                                else navigateTo('documents');
                            }}
                            sidebarContent={
                                <DocumentList isCompact={true} onPreviewLocalFile={setLocalPreviewDoc} />
                            }
                            detailContent={
                                selectedId ? (
                                    <DocumentDetailView key={selectedId} />
                                ) : null
                            }
                        />
                    </ViewWrapper>
                );

            case 'properties':
            case 'propertyDetail':
                return (
                    <ViewWrapper>
                        <FeatureGuard requiredProduct="property">
                            <SplitMasterDetail
                                title="Property Details"
                                isDetailVisible={view === 'propertyDetail' && !!selectedId}
                                onCloseDetail={() => navigateTo('properties')}
                                sidebarContent={<PropertyManagerView contacts={matterState.contacts} onViewDetails={(id) => navigateTo('propertyDetail', id)} openModal={openModal} isCompact={true} />}
                                detailContent={<PropertyDetailView key={selectedId} />}
                            />
                        </FeatureGuard>
                    </ViewWrapper>
                );


            case 'atriumEngine': return (
                <ViewWrapper>
                    <FeatureGuard requiredProduct="property">
                        <RevenueEngine />
                    </FeatureGuard>
                </ViewWrapper>
            );

            case 'tenantPortal': return (
                <ViewWrapper>
                    <TenantPortal />
                </ViewWrapper>
            );

            case 'calendar': return <ViewWrapper><CalendarView /></ViewWrapper>;
            case 'timeline': return <ViewWrapper><TimelineView /></ViewWrapper>;
            case 'billing': return <ViewWrapper><BillingView /></ViewWrapper>;
            case 'billingMonitor': return <ViewWrapper><BillingMonitorView /></ViewWrapper>;
            case 'reporting': return <ViewWrapper><ReportingView /></ViewWrapper>;
            case 'settings': return <ViewWrapper><SettingsView /></ViewWrapper>;

            case 'messaging': return <ViewWrapper><MessagesView /></ViewWrapper>;
            case 'notes': return <ViewWrapper><NotesView /></ViewWrapper>;
            case 'help': return <ViewWrapper><HelpView /></ViewWrapper>;
            case 'archive': return <ViewWrapper><ArchiveView /></ViewWrapper>;

            case 'editor': return <WordProcessor />;
            case 'research': return <ViewWrapper><FeatureGuard requiredProduct="legal"><ResearchView /></FeatureGuard></ViewWrapper>;
            case 'indexer': return <ViewWrapper><AloaXView /></ViewWrapper>;
            case 'compliance': return <ViewWrapper><FeatureGuard requiredProduct="legal"><ComplianceView /></FeatureGuard></ViewWrapper>;
            case 'invoiceDetail': return <ViewWrapper><InvoiceDetailView /></ViewWrapper>;
            case 'receiptDetail': return <ViewWrapper><ReceiptDetailView /></ViewWrapper>;

            case 'privacyPolicy': return <PrivacyPolicy onBack={goBack} />;
            case 'termsOfService': return <TermsOfService onBack={goBack} activeProduct={product === 'property' ? 'atrium' : product === 'legal' ? 'vega' : undefined} />;
            case 'portalTermsOfUse': return <PortalTermsOfUse onBack={goBack} activeProduct={product === 'property' ? 'atrium' : product === 'legal' ? 'vega' : undefined} />;
            case 'dataProcessingAgreement': return <DataProcessingAgreement onBack={goBack} />;
            case 'cookiePolicy': return <CookiePolicy onBack={goBack} />;
            default: return <NotFoundView />;
        }
    };

    const isEditorMode = view === 'editor';

    if (isEditorMode) {
        return (
            <main className={`${protectionEnabled ? 'app-protected' : ''} w-full h-[100dvh] overflow-hidden bg-slate-50 dark:bg-zinc-900 pt-safe`}>
                {showScreenshotOverlay && (
                    <div className="screenshot-overlay visible">
                        <span>Content protected</span>
                    </div>
                )}
                {currentUser ? renderView() : <div>Loading...</div>}
            </main>
        );
    }

    // ── SECURITY: Failed-impersonation guard ──
    // Fires when an admin is impersonating BUT the target account is not a
    // portal user. With the impersonationRoleOverride fix in AuthContext,
    // this guard should rarely fire — the override ensures currentUser.role
    // is 'Tenant'/'Client' even if the target's DB role has drifted.
    //
    // It still fires in two cases:
    //   1. The override was somehow not set (defensive — should never happen
    //      because loginAsUser always sets it alongside originalSessionToken).
    //   2. The target's DB role is 'Pending' and currentUser became null
    //      (the AuthContext memo rejects Pending roles) — but in that case the
    //      auto-revert effect handles it, and this guard fires for the brief
    //      window before the revert completes.
    //
    // CRITICAL: We use `isImpersonating` (a SYNCHRONOUS flag derived from
    // originalSessionToken) rather than `originalUser` (which requires the
    // originalUserData query to load). Without this, there's a race condition
    // window where currentUser (the impersonated admin) loads before
    // originalUser, and the admin dashboard flashes on screen.
    //
    // NOTE: The previous "Access restricted" guard that fired for ALL portal
    // users (including legitimate tenants and successfully-impersonating
    // admins) has been REMOVED. It was redundant with the route guard at
    // App.tsx:769 and renderView()'s own portal-user checks at lines 158/169,
    // and it blocked legitimate portal users from seeing their portal.
    if (currentUser && isImpersonating && !isPortalUser) {
        const targetEmail = currentUser.email;
        const targetRole = currentUser.role;
        return (
            <main className="w-full h-[100dvh] flex items-center justify-center bg-amber-50 dark:bg-amber-950/30 p-8">
                <div className="text-center max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 border border-amber-200 dark:border-amber-800/50">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                        <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Impersonation failed</h2>
                    <p className="text-sm text-slate-600 dark:text-zinc-300 mb-1">
                        The user you're trying to view (<strong>{targetEmail}</strong>) doesn't have a portal role.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6">
                        Their account role is <span className="font-mono font-bold text-amber-700 dark:text-amber-300">{targetRole}</span>. Only Residents and Clients can be previewed through the portal impersonation feature. Returning to your admin session now.
                    </p>
                    <button
                        onClick={revertToOriginalUser}
                        className="w-full px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition-colors active:scale-[0.98]"
                    >
                        Return to Admin Session
                    </button>
                    {originalUser ? (
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-4">
                            You'll be returned to <strong>{originalUser.email}</strong> ({originalUser.role}).
                        </p>
                    ) : (
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-4">
                            Restoring your admin session… (if this takes more than a few seconds, refresh the page)
                        </p>
                    )}
                </div>
            </main>
        );
    }

    return (
        <div className={`${protectionEnabled ? 'app-protected' : ''} flex h-[100dvh] bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-white overflow-hidden transition-colors duration-500 pt-safe`}>
            {/* Screenshot deterrent overlay — shows a black screen when the
                window loses focus or PrintScreen is pressed. Best-effort only. */}
            {showScreenshotOverlay && (
                <div className="screenshot-overlay visible">
                    <span>Content protected</span>
                </div>
            )}
            {currentUser && !isPortalUser && <Sidebar currentView={view} setView={navigateTo} currentUser={currentUser} />}
            <div className={`flex-1 flex flex-col transition-all duration-300 relative ${currentUser && !isPortalUser ? (isSidebarRetracted ? 'md:ml-20' : 'md:ml-64') : ''} min-w-0 h-full overflow-hidden`}>
                {currentUser && !isPortalUser && <Header />}
                {/* Main content area: on desktop, fills remaining height.
                    On mobile, the BottomNav is position:fixed and overlays
                    the content. We add paddingBottom on mobile to ensure
                    the last items aren't hidden behind the nav. The nav is
                    h-14 (3.5rem = 56px). We use a CSS media query via the
                    'pb-14 md:pb-0' class which applies 56px padding on
                    screens < 768px (md breakpoint) and 0 on desktop. */}
                <main className="flex-1 relative overflow-hidden min-h-0">
                    {currentUser ? (
                        <div key={product} className="flex-1 h-full w-full relative animate-fade-in flex flex-col isolate overflow-y-auto pb-14 md:pb-0 min-h-0">
                            <ErrorBoundary fallback={<div className="h-full flex items-center justify-center text-rose-500 bg-slate-50 dark:bg-zinc-900 p-8"><div className="text-center"><h3 className="font-bold text-lg mb-2">View Error</h3><p className="text-sm opacity-80">Failed to render this view. Please refresh or navigate away.</p></div></div>}>
                                {renderView()}
                            </ErrorBoundary>
                            {view === 'indexer' && (
                                <ViewWrapper>
                                    <AloaXView />
                                </ViewWrapper>
                            )}
                        </div>
                    ) : <DashboardSkeleton />}
                </main>
                {currentUser && !isPortalUser && <BottomNav currentView={view} setView={navigateTo} />}
                {/* DemoProductSwitcher — web only, hidden in native APK */}
                {!isNativePlatform() && <DemoProductSwitcher />}
            </div>
            {currentUser && flowState === 'app' && !isPortalUser && (
                <>
                    <ContextMenu />
                    <DockedModal />
                    <AloaFAB />
                    <AloaPanel />
                    <CommandPalette />
                    <FullScreenSearch />
                </>
            )}
        </div>
    );
});

export const App: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, currentUser, isLoadingSession, isAccountRevoked, loginAsDemoUser, appMode, logout } = useAuth();
    const convex = useConvex();
    const { theme, fontSize, openModal, modal, view, closeModal, navigateTo } = useUI();
    const { light } = useHapticFeedback();
    const { matterState } = useMatterState();
    const { financeState } = useFinanceState();
    const { executionState } = useExecutionState();
    const { documentState } = useDocumentState();
    const { coreState, isDataLoaded } = useCoreState();
    const { startTour } = useOnboarding();
    const ui = useUI();
    const { isSessionLocked, setIsSessionLocked } = ui;

    const hasSavedSession = React.useMemo(() => {
        try {
            // Check both app session and portal session keys
            // Portal users need the splash screen too when their session is being restored
            const appSession = localStorage.getItem('practicepro_user_session');
            const portalSession = localStorage.getItem('practicepro_portal_session');
            const portalType = localStorage.getItem('practicepro_portal_type');
            return !!(appSession || portalSession || portalType);
        } catch {
            return false;
        }
    }, []);

    const [flowState, setFlowState] = useState<FlowState>(hasSavedSession ? 'splash' : 'app');
    const { confirm: confirmAction, ConfirmDialog: confirmDialogNode } = useConfirm();
    const { product } = useProduct();
    const [forceEntry, setForceEntry] = useState(false);
    const [hasInitialized, setHasInitialized] = useState(false);
    const [visualsComplete, setVisualsComplete] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("Initializing System...");
    const [sessionLoadTimedOut, setSessionLoadTimedOut] = useState(false);
    const [portalRememberTimedOut, setPortalRememberTimedOut] = useState(false);
    const [hasInitialSplashFinished, setHasInitialSplashFinished] = useState(false);
    const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);
    const isEditorMode = view === 'editor';

    // #3 — Auto-open login modal when arriving via a password-reset magic link
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('recoveryCode') && params.get('email') && !isAuthenticated) {
            // Small delay so ModalManager is mounted first
            setTimeout(() => openModal('login'), 300);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // TASK: Native app — the auth buttons on the native launch screen handle
    // opening login/signup modals. No auto-open needed — the user chooses
    // Log In or Sign Up from the permanent buttons on the launch screen.
    // If they dismiss a modal, the buttons are right there to tap again.

    // ── Listen for impersonation-rejected events from AuthContext ──
    // When AuthContext auto-reverts a failed impersonation (target user is not
    // a portal user), it dispatches a 'practicepro:impersonation-rejected'
    // window event. We surface it as a toast so the admin understands why
    // they were returned to their own session instead of seeing the portal.
    React.useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail || {};
            const { addToast } = ui;
            addToast(
                `Could not preview portal: ${detail.targetEmail || 'that user'} is registered as ${detail.targetRole || 'a non-portal user'}, not a Resident/Client. Returning to your admin session.`,
                { type: 'error', duration: 7000 }
            );
        };
        window.addEventListener('practicepro:impersonation-rejected', handler);
        return () => window.removeEventListener('practicepro:impersonation-rejected', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    useIdleTimer(() => {
        if (!isAuthenticated || isSessionLocked) return;
        // Portal users (Tenant/Client) should be logged out on inactivity,
        // not locked — they get a clear message and a fresh login.
        const isPortalUser = currentUser?.role === UserRole.Client || currentUser?.role === UserRole.Tenant;
        if (isPortalUser) {
            // Determine the correct login page and redirect with inactivity flag
            const portalType = sessionStorage.getItem('practicepro_portal_type') || localStorage.getItem('practicepro_portal_type');
            const loginPath = portalType === 'client' || currentUser?.role === 'Client'
                ? '/portal/client/login'
                : '/portal/tenant/login';
            // Clear portal session keys (same logic as logout, but synchronous + redirect)
            sessionStorage.removeItem('practicepro_portal_session');
            localStorage.removeItem('practicepro_portal_session');
            sessionStorage.removeItem('practicepro_portal_type');
            localStorage.removeItem('practicepro_portal_type');
            localStorage.removeItem('practicepro_session_locked');
            // Hard redirect to guarantee clean state
            window.location.href = `${loginPath}?inactivity=1`;
        } else {
            // Admin users: show lock screen (re-enter password to unlock)
            setIsSessionLocked(true);
        }
    }, IDLE_TIMEOUT);
    const [isToolkitOpen, setIsToolkitOpen] = useState(false);

    if (import.meta.env.DEV) console.log("[App] Rendering App...", { flowState, isSessionLocked, currentUser: currentUser?.email });

    // Safety valve: if the session has been loading for 6 seconds and the user has no
    // stored session, abandon the splash and show the landing page immediately.
    // #4 — Redirect unauthenticated users away from protected routes to keep URL clean
    // IMPORTANT: Portal users who have a saved session should NEVER be redirected away
    // during the brief window while auth is loading. We detect this by checking
    // sessionStorage for a stored portal type.
    useEffect(() => {
        const publicPaths = ['/', '/vega', '/atrium', '/komplet', '/privacy-policy', '/terms-of-service', '/data-processing-agreement', '/cookie-policy', '/portal/client/login', '/portal/tenant/login', '/portal/client', '/portal/tenant', '/setup-password'];

        // TASK 15: Redirect authenticated users away from landing-page routes
        // (/vega, /atrium, /komplet) to the dashboard. These routes are for
        // MARKETING/landing pages only — an authenticated user navigating to
        // /vega should see their dashboard, NOT a 404 "Page Not Found" error.
        // This was the root cause of the user's "no page found" bug.
        const landingRoutes = ['/vega', '/atrium', '/komplet'];
        if (!isLoadingSession && currentUser && landingRoutes.includes(location.pathname)) {
            navigate('/', { replace: true });
            return;
        }

        // Check both sessionStorage and localStorage for portal type (Bug 11 fix)
        const hasRememberedPortal = sessionStorage.getItem('practicepro_portal_type') || localStorage.getItem('practicepro_portal_type');
        if (!isLoadingSession && !currentUser && !publicPaths.includes(location.pathname)) {
            // If user has a remembered portal but no currentUser, they might be in a
            // loading state — don't redirect them away from their portal
            if (hasRememberedPortal) return;
            if (import.meta.env.DEV) console.log("[App] Redirecting unauthenticated user from protected path:", location.pathname);
            navigate('/', { replace: true });
        }
    }, [isLoadingSession, currentUser, location.pathname, navigate]);

    // Handle revoked portal accounts: when the backend confirms the user's account
    // has been revoked (isVerified=false + role=Pending), clear their session and
    // redirect to the appropriate portal login page with a clear "access revoked" message.
    //
    // SECURITY: Only clear the PORTAL session — NEVER touch the app user's session.
    // If an admin is logged in on another tab, clearing practicepro_user_session
    // from localStorage would nuke their session too, which can cause cross-session
    // contamination (the portal user could accidentally end up in the admin dashboard).
    useEffect(() => {
        if (!isAccountRevoked) return;
        if (location.pathname === '/portal/client/login' || location.pathname === '/portal/tenant/login') return; // Already on login page

        // Determine which portal they were using
        const portalType = sessionStorage.getItem('practicepro_portal_type') || localStorage.getItem('practicepro_portal_type');
        const loginPath = portalType === 'client' ? '/portal/client/login' : '/portal/tenant/login';

        // SECURITY: Only clear the PORTAL session — NEVER touch the app user's session.
        // Clearing practicepro_user_session from localStorage would also kill the
        // admin's session on any other open tab, which is a security disaster.
        sessionStorage.removeItem('practicepro_portal_session');
        localStorage.removeItem('practicepro_portal_session');
        sessionStorage.removeItem('practicepro_portal_type');
        localStorage.removeItem('practicepro_portal_type');

        // Hard-redirect instead of SPA navigate to guarantee a complete state reset.
        // Using window.location.href ensures all React state is torn down and
        // re-initialized cleanly — no risk of stale session tokens persisting
        // in memory and causing cross-boundary access.
        window.location.href = `${loginPath}?revoked=1`;
    }, [isAccountRevoked, location.pathname]);

    useEffect(() => {
        if (isLoadingSession && !hasSavedSession) {
            const t = setTimeout(() => setSessionLoadTimedOut(true), 6000);
            return () => clearTimeout(t);
        }
    }, [isLoadingSession, hasSavedSession]);

    // ── Push Notification Registration ──────────────────────────────────
    // When the user is authenticated AND on a native platform (Android APK),
    // request notification permission and register for push notifications.
    // This sets pushNotificationEnabled=true on the user record so the
    // backend sends push (and skips email) for this user — smart delivery.
    useEffect(() => {
        if (!currentUser?.id || isLoadingSession) return;
        if (!isNativePlatform()) return; // only on native app
        // Only register once per session — avoid repeated permission prompts
        if (sessionStorage.getItem('practicepro_push_registered_this_session')) return;

        import('../utils/notifications').then(async ({ registerForNotifications }) => {
            const registered = await registerForNotifications();
            if (registered) {
                sessionStorage.setItem('practicepro_push_registered_this_session', '1');
                // Tell the backend this user has push enabled (smart delivery)
                try {
                    await convex.mutation(api.portals.registerForPushNotifications, {
                        userId: currentUser.id,
                    });
                    console.log('[App] Push notifications registered for user', currentUser.id);
                } catch (err) {
                    console.warn('[App] Push registration backend call failed:', err);
                }
            }
        }).catch(() => {/* non-blocking */});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id, isLoadingSession, convex]);

    // TASK 16: Update document title + URL query param to show which product
    // the user is in. This gives clear architecture — looking at the browser
    // tab or URL, you can tell whether you're in Vega or Atrium.
    // - Document title: "Atrium — Messages | PracticePro" (shows in browser tab)
    // - URL query param: /messaging?app=atrium (shows in address bar)
    useEffect(() => {
        if (!currentUser) return;
        const productName = currentUser.product === 'atrium' ? 'Atrium'
            : currentUser.product === 'property' ? 'Atrium'
            : currentUser.product === 'legal' ? 'Vega'
            : 'PracticePro';
        const viewLabel = view ? view.charAt(0).toUpperCase() + view.slice(1) : 'Dashboard';
        document.title = `${productName} — ${viewLabel} | PracticePro`;

        // Update URL with ?app= query param (doesn't trigger navigation)
        const url = new URL(window.location.href);
        const expectedApp = currentUser.product === 'atrium' || currentUser.product === 'property' ? 'atrium' : 'vega';
        if (url.searchParams.get('app') !== expectedApp) {
            url.searchParams.set('app', expectedApp);
            window.history.replaceState({}, '', url.toString());
        }
    }, [currentUser, view]);

    const handleReset = async () => {
        const ok = await confirmAction({
            title: 'Reset local data?',
            message: 'This will clear all local data and reload. This cannot be undone.',
            confirmLabel: 'Reset data',
            cancelLabel: 'Cancel',
            danger: true,
        });
        if (!ok) return;
        localStorage.clear();
        window.location.reload();
    };

    const handleForceEnter = () => {
        setForceEntry(true);
    };

    useEffect(() => {
        if (currentUser && !hasInitialized) {
            // Portal users skip the splash screen entirely — they go straight to their portal view
            const isPortal = currentUser.role === UserRole.Client || currentUser.role === UserRole.Tenant;
            if (isPortal) {
                setFlowState('app');
                setHasInitialized(true);
                setVisualsComplete(true);
                setHasInitialSplashFinished(true);
                return;
            }
            // TASK: Native app — skip the web splash entirely (native splash already played).
            // Web — show splash for a brief moment, then proceed.
            if (isNativePlatform()) {
                setFlowState('app');
                setHasInitialized(true);
                setVisualsComplete(true);
                setHasInitialSplashFinished(true);
                return;
            }
            setFlowState('splash');
            setVisualsComplete(false);
            setLoadingMessage("Welcome back");
            const timerId = window.setTimeout(() => setVisualsComplete(true), 200);
            return () => window.clearTimeout(timerId);
        } else if (!currentUser) {
            setHasInitialized(false);
        }
    }, [currentUser, hasInitialized]);

    const safetyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (currentUser && visualsComplete && !isDataLoaded && !forceEntry) {
            if (!safetyTimeoutRef.current) {
                // TASK: Native app gets a shorter safety timeout (5s) — web keeps 12s
                const timeoutMs = isNativePlatform() ? 5000 : 12000;
                safetyTimeoutRef.current = setTimeout(() => {
                    if (import.meta.env.DEV) console.warn("[App] Data load timeout - forcing entry.");
                    setForceEntry(true);
                    safetyTimeoutRef.current = null;
                }, timeoutMs);
            }
        } else {
            if (safetyTimeoutRef.current) {
                clearTimeout(safetyTimeoutRef.current);
                safetyTimeoutRef.current = null;
            }
        }
        return () => { if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current); };
    }, [currentUser, visualsComplete, isDataLoaded, forceEntry]);

    useEffect(() => {
        if (currentUser && visualsComplete) {
            // Portal users skip the data loading wait — their data comes from dedicated portal queries
            const isPortal = currentUser.role === UserRole.Client || currentUser.role === UserRole.Tenant;
            if (isPortal) {
                setFlowState('app');
                setHasInitialized(true);
                setHasInitialSplashFinished(true);
                return;
            }
            if (isDataLoaded || forceEntry) {
                setLoadingMessage("Ready");
                // TASK: Reduced from 500ms to 100ms — the "Ready" delay was making the
                // app feel sluggish. 100ms is enough for React to batch the state update.
                const t = setTimeout(() => {
                    if (!currentUser.firmId) {
                        setFlowState('setup');
                    } else {
                        setFlowState('app');
                        if (appMode === AppMode.Solo) {
                            setIsToolkitOpen(true);
                        }
                    }
                    setHasInitialized(true);
                    if (!hasInitialized && (modal === 'login' || modal === 'signup')) {
                        closeModal();
                    }
                }, isNativePlatform() ? 100 : 500);
                return () => clearTimeout(t);
            } else {
                setLoadingMessage("Finalizing Data Synchronization...");
            }
        }
    }, [currentUser, visualsComplete, isDataLoaded, forceEntry, modal, closeModal]);

    useEffect(() => {
        if (flowState === 'app' && currentUser) {
            if (forceEntry && !isDataLoaded) return;
            // Don't auto-start the tour for portal users (Client/Tenant)
            const isPortal = currentUser.role === UserRole.Client || currentUser.role === UserRole.Tenant;
            if (isPortal) return;
            const hasCompletedTour = localStorage.getItem('practicepro_tour_completed');
            if (hasCompletedTour !== 'true') {
                const timer = setTimeout(() => startTour(), 800);
                return () => clearTimeout(timer);
            }
        }
    }, [flowState, currentUser, startTour, isDataLoaded, forceEntry]);

    const isPortalUserRole = currentUser?.role === UserRole.Client || currentUser?.role === UserRole.Tenant;

    // Helper: Parse portal routes (supports token-based URLs)
    // /portal/tenant → { type: 'tenant' }
    // /portal/tenant/{token} → { type: 'tenant', token: '{token}' }
    // /portal/client → { type: 'client' }
    // /portal/client/{token} → { type: 'client', token: '{token}' }
    const parsePortalRoute = (pathname: string): { type: 'tenant' | 'client'; token?: string } | null => {
        if (pathname === '/portal/tenant' || pathname.startsWith('/portal/tenant/')) {
            const token = pathname.startsWith('/portal/tenant/') ? pathname.replace('/portal/tenant/', '') : undefined;
            return { type: 'tenant', token };
        }
        if (pathname === '/portal/client' || pathname.startsWith('/portal/client/')) {
            const token = pathname.startsWith('/portal/client/') ? pathname.replace('/portal/client/', '') : undefined;
            return { type: 'client', token };
        }
        return null;
    };

    // Helper: Is this a valid portal dashboard route (not login, not setup-password)?
    const isPortalDashboardRoute = (pathname: string) => {
        return pathname === '/portal/tenant' || pathname === '/portal/client' ||
            /^\/portal\/tenant\/[0-9a-f-]{36}$/.test(pathname) ||
            /^\/portal\/client\/[0-9a-f-]{36}$/.test(pathname);
    };

    const renderAppContent = () => {
        const portalRoute = parsePortalRoute(location.pathname);

        // ── SECURITY: Portal user boundary guard ──
        // If a portal user (Client/Tenant) is authenticated but NOT on a portal route,
        // redirect them immediately. This prevents cross-boundary access where a portal
        // user could end up in the main app's dashboard or any admin-only view.
        if (currentUser && isPortalUserRole) {
            const isOnPortalRoute = location.pathname.startsWith('/portal/');
            if (!isOnPortalRoute) {
                // Use token-based URL if the user has a portalAccessToken
                const token = (currentUser as any).portalAccessToken;
                const portalPath = currentUser.role === UserRole.Client
                    ? (token ? `/portal/client/${token}` : '/portal/client')
                    : (token ? `/portal/tenant/${token}` : '/portal/tenant');
                // Hard redirect to guarantee clean state
                window.location.href = portalPath;
                return null;
            }
            // If on /portal/tenant or /portal/client (no token), redirect to token URL
            if (portalRoute && !portalRoute.token) {
                const token = (currentUser as any).portalAccessToken;
                if (token) {
                    const tokenPath = portalRoute.type === 'client' ? `/portal/client/${token}` : `/portal/tenant/${token}`;
                    navigate(tokenPath, { replace: true });
                    return null;
                }
            }
        }

        // ── SECURITY: Admin user on portal route guard ──
        // If an admin/internal user somehow lands on a portal route, redirect them
        // to the main app. This prevents confusion where an admin sees the portal
        // view instead of their dashboard.
        if (currentUser && !isPortalUserRole) {
            if (isPortalDashboardRoute(location.pathname)) {
                navigate('/', { replace: true });
                return null;
            }
        }

        // ── Portal login routes ──
        // If user is already authenticated as a portal user, redirect them to their dashboard
        // instead of showing the login page again. This handles the case where a portal user
        // navigates to the login page while already logged in.
        if (location.pathname === '/portal/client/login') {
            if (currentUser && currentUser.role === UserRole.Client) {
                const token = (currentUser as any).portalAccessToken;
                navigate(token ? `/portal/client/${token}` : '/portal/client', { replace: true });
                return null;
            }
            return <ClientPortalLogin />;
        }
        if (location.pathname === '/portal/tenant/login') {
            if (currentUser && currentUser.role === UserRole.Tenant) {
                const token = (currentUser as any).portalAccessToken;
                navigate(token ? `/portal/tenant/${token}` : '/portal/tenant', { replace: true });
                return null;
            }
            return <TenantPortalLogin />;
        }
        if (location.pathname === '/setup-password') return <SetupPassword />;

        if (!currentUser && !isLoadingSession) {
            // Check if a portal user session is being restored — if so, show a loading
            // state instead of the LandingPage to prevent the jarring flash
            // Check both sessionStorage and localStorage (Bug 11 fix)
            const hasRememberedPortal = typeof window !== 'undefined' && (
                sessionStorage.getItem('practicepro_portal_type') !== null ||
                localStorage.getItem('practicepro_portal_type') !== null ||
                sessionStorage.getItem('practicepro_portal_session') !== null ||
                localStorage.getItem('practicepro_portal_session') !== null
            );

            // If the user is on a portal route but not authenticated, redirect to
            // the appropriate login page instead of showing the LandingPage.
            // This fixes the "blank screen" when navigating to /portal/tenant or
            // /portal/client without a valid session.
            const isOnPortalRoute = isPortalDashboardRoute(location.pathname);
            if (isOnPortalRoute && !hasRememberedPortal) {
                const loginPath = portalRoute?.type === 'client' ? '/portal/client/login' : '/portal/tenant/login';
                navigate(loginPath, { replace: true });
                return null;
            }

            if (hasRememberedPortal && !portalRememberTimedOut) {
                // Session might still be loading (e.g. slow Convex query). Show the
                // branded splash screen instead of a generic spinner — this provides
                // a polished experience that matches the main app's loading flow.
                // Auto-timeout after 15s: if the session truly isn't valid, clear the
                // remembered portal type and fall through to the login redirect.
                setTimeout(() => {
                    setPortalRememberTimedOut(true);
                    // Clear stale portal type flags so we don't loop back here
                    sessionStorage.removeItem('practicepro_portal_type');
                    localStorage.removeItem('practicepro_portal_type');
                }, 15000);
                // Determine which product splash to show based on portal type
                const rememberedPortalType = sessionStorage.getItem('practicepro_portal_type') || localStorage.getItem('practicepro_portal_type');
                return (
                    <SplashScreen
                        isVisible={true}
                        statusMessage="Loading your portal..."
                        onForceEnter={() => {
                            setPortalRememberTimedOut(true);
                            sessionStorage.removeItem('practicepro_portal_type');
                            localStorage.removeItem('practicepro_portal_type');
                        }}
                        product={rememberedPortalType === 'client' ? 'vega' : 'atrium'}
                    />
                );
            }

            // If we timed out waiting for a portal session, redirect to the login page
            if (isPortalDashboardRoute(location.pathname)) {
                const loginPath = portalRoute?.type === 'client' ? '/portal/client/login' : '/portal/tenant/login';
                navigate(loginPath, { replace: true });
                return null;
            }

            if (view === 'termsOfService') return <TermsOfService onBack={() => navigateTo('dashboard')} activeProduct={product === 'property' ? 'atrium' : product === 'legal' ? 'vega' : undefined} />;
            if (view === 'portalTermsOfUse') return <PortalTermsOfUse onBack={() => navigateTo('dashboard')} activeProduct={product === 'property' ? 'atrium' : product === 'legal' ? 'vega' : undefined} />;
            if (view === 'privacyPolicy') return <PrivacyPolicy onBack={() => navigateTo('dashboard')} />;
            if (view === 'dataProcessingAgreement') return <DataProcessingAgreement onBack={() => navigateTo('dashboard')} />;
            if (view === 'cookiePolicy') return <CookiePolicy onBack={() => navigateTo('dashboard')} />;
            // TASK: Native app behavior — when running inside the Capacitor APK,
            // show a clean auth landing screen with permanent Log In + Sign Up buttons.
            // The user explicitly requested:
            // - Two permanent, prominent action buttons: [Log In] and [Sign Up]
            // - Log In → goes straight to auth fields (no product selection first)
            // - Sign Up → THEN show product selection
            // - If user dismisses the modal, they see the buttons again (not stuck)
            // - Remove "Demo Mode" from the native app
            if (isNativePlatform()) {
                const isAuthModalOpen = modal === 'login' || modal === 'signup';
                return (
                    <div className="h-[100dvh] flex flex-col items-center justify-between bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 px-6 pt-safe pb-safe">
                        {/* Top spacer */}
                        <div className="flex-1" />

                        {/* Logo + Branding */}
                        <div className="flex flex-col items-center gap-4">
                            <Logo className="w-24 h-24 text-emerald-500" />
                            <div className="text-center">
                                <h1 className="text-2xl font-black text-white tracking-tight">PracticePro</h1>
                                <p className="text-sm text-slate-400 mt-1 max-w-xs">
                                    Operating systems for the organizations that run modern Africa.
                                </p>
                            </div>
                        </div>

                        {/* Auth buttons — PERMANENT, never unmounted */}
                        <div className="w-full max-w-sm space-y-3 pb-8">
                            {!isAuthModalOpen && (
                                <>
                                    <button
                                        onClick={() => { light(); openModal('login'); }}
                                        className="active-press-lg w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-2xl shadow-xl shadow-emerald-600/30 transition-all"
                                    >
                                        Log In
                                    </button>
                                    <button
                                        onClick={() => { light(); openModal('signup'); }}
                                        className="active-press-lg w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold text-base rounded-2xl border border-white/20 backdrop-blur-sm transition-all"
                                    >
                                        Sign Up
                                    </button>
                                    {/* Portal login — for tenants and clients */}
                                    <div className="pt-3 border-t border-white/10">
                                        <p className="text-xs text-slate-500 text-center mb-2">Portal User?</p>
                                        <div className="flex gap-2 justify-center">
                                            <button
                                                onClick={() => { light(); window.location.href = '/portal/tenant/login'; }}
                                                className="active-press touch-target flex-1 py-2.5 text-xs font-bold text-emerald-400 rounded-xl bg-emerald-500/10 border border-emerald-500/20 transition-all"
                                            >
                                                Resident Portal
                                            </button>
                                            <button
                                                onClick={() => { light(); window.location.href = '/portal/client/login'; }}
                                                className="active-press touch-target flex-1 py-2.5 text-xs font-bold text-blue-400 rounded-xl bg-blue-500/10 border border-blue-500/20 transition-all"
                                            >
                                                Client Portal
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Bottom spacer */}
                        <div className="flex-1" />
                    </div>
                );
            }

            // TASK 13: Pass the URL-derived product to LandingPage so /vega and
            // /atrium routes show the correct product. The LandingPage uses this
            // to set its initial activeProduct state. When the user is on / (root),
            // no product is passed — the landing page shows its default state and
            // the "Get Started Free" button opens the signup with the product
            // selection step (no product pre-selected).
            const urlProduct: 'vega' | 'atrium' | undefined =
                location.pathname === '/vega' ? 'vega' :
                location.pathname === '/atrium' ? 'atrium' :
                location.pathname === '/komplet' ? 'vega' : undefined; // komplet maps to vega for landing purposes
            return <LandingPage onDemo={(product) => openModal('leadCapture', null, { demoProduct: product })} initialProduct={urlProduct} />;
        }

        // New User Flow: Go straight to setup if no firm exists
        // Portal users (Client/Tenant) should NEVER see the OnboardingWizard —
        // they don't create firms; they're invited to existing ones. If a portal
        // user has no firmId, their portal dashboard will handle the resolution
        // and show a repair UI instead of the unrelated OnboardingWizard.
        if (currentUser && !currentUser.firmId && currentUser.role !== UserRole.Client && currentUser.role !== UserRole.Tenant) {
            return <OnboardingWizard onComplete={() => setFlowState('app')} />;
        }

        // Only block on SplashScreen if the user has a saved session being restored.
        // New/unauthenticated visitors must NEVER see the splash — they go straight to the Landing Page.
        if (isLoadingSession) {
            return null; // Top-level SplashScreen handles the branding
        }

        if (currentUser?.role === 'Pending') {
            return (
                <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-slate-50 dark:bg-zinc-950 w-full p-8 text-center font-sans">
                    <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-10 rounded-[32px] shadow-2xl shadow-slate-200 dark:shadow-black/50 border border-slate-100 dark:border-zinc-800 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-8 ring-8 ring-amber-50/50 dark:ring-amber-900/10">
                            <OfficeBuildingIcon className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">Access Pending</h2>
                        <p className="text-slate-500 dark:text-zinc-400 mb-10 leading-relaxed text-lg">
                            Your request to join <span className="font-bold text-slate-900 dark:text-white">{coreState?.firmDetails?.name || 'this workspace'}</span> is awaiting approval from {product === 'atrium' ? 'the portfolio manager' : 'a firm administrator'}.
                        </p>
                        
                        <div className="flex flex-col gap-4 w-full">
                            <button 
                                onClick={() => window.location.reload()} 
                                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-green-600/20 active:scale-[0.98]"
                            >
                                Check Approval Status
                            </button>
                            <button 
                                onClick={() => logout()} 
                                className="w-full py-3 text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white font-bold text-sm transition-colors"
                            >
                                Sign Out & Switch Account
                            </button>
                        </div>

                        <div className="mt-10 pt-8 border-t border-slate-50 dark:border-zinc-800 w-full">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-widest mb-1">Account Reference</p>
                            <p className="text-xs font-mono text-slate-300 dark:text-zinc-700">{currentUser.id}</p>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <>
                {(flowState === 'app' || flowState === 'splash') && (
                    <>
                        <MainContent
                            onToggleToolkit={() => setIsToolkitOpen(prev => !prev)}
                            isToolkitOpen={isToolkitOpen}
                            onCloseToolkit={() => setIsToolkitOpen(false)}
                            onEnableDevMode={() => setIsToolkitOpen(true)}
                            flowState={flowState}
                        />
                        {import.meta.env.DEV && <FloatingTestControls isOpen={isToolkitOpen} onClose={() => setIsToolkitOpen(false)} />}
                    </>
                )}
            </>
        );
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setHasInitialSplashFinished(true);
        }, 12000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (splashAnimationComplete && isDataLoaded) {
            setHasInitialSplashFinished(true);
        }
    }, [splashAnimationComplete, isDataLoaded]);

    return (
        <div className={`app-container font-sans text-base ${theme} h-[100dvh] bg-[rgb(var(--bg-main))] text-[rgb(var(--text-main))]`}>
            <SplashScreen 
                isVisible={!hasInitialSplashFinished && (hasSavedSession || flowState === 'splash')} 
                statusMessage={loadingMessage} 
                onReset={handleReset} 
                onForceEnter={() => { setForceEntry(true); setHasInitialSplashFinished(true); }} 
                onComplete={() => setSplashAnimationComplete(true)}
                product={(!isDataLoaded || !currentUser?.firmId) ? 'practicepro' : (product === 'property' ? 'atrium' : 'vega')} 
            />
            {isSessionLocked ? (
                <LockScreen onUnlock={() => setIsSessionLocked(false)} />
            ) : (
                renderAppContent()
            )}
            {((!currentUser) || (currentUser && flowState !== 'splash')) && (
                <>
                    <ModalManager />
                    <ToastContainer />
                </>
            )}
            {/* Onboarding Tour only shown for non-portal users; portal users get a simpler experience */}
            {currentUser && currentUser.role !== UserRole.Client && currentUser.role !== UserRole.Tenant && <OnboardingTour />}
            {/* What's New only for admin/firm users, not portal users */}
            {flowState === 'app' && currentUser && currentUser.role !== UserRole.Client && currentUser.role !== UserRole.Tenant && <WhatsNew />}
            <CookieConsent />
            {/* In-app confirmation dialog — replaces browser window.confirm() */}
            {confirmDialogNode}
        </div>
    );
};

export default App;
