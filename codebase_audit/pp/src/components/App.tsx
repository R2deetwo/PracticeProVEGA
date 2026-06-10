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
import { useOnboarding } from '../contexts/OnboardingProvider';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { OfficeBuildingIcon } from '../constants';
import { useProduct } from '../contexts/ProductContext';

import Sidebar from './Sidebar';
import Header from './Header';
import Dashboard from './Dashboard';
import ContactsView from './ContactsView';
import { TasksView } from './TasksView';
import { DocumentList } from './DocumentList';
import { CalendarView } from './CalendarView';
import { BillingView } from './BillingView';
import ReportingView from './ReportingView';
import ComplianceView from './ComplianceView';
import SettingsView from './settings/SettingsView';
import MessagingView from './MessagingView';
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
import FeedbackButton from './FeedbackButton';
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
import { PrivacyPolicy } from './PrivacyPolicy';
import { TermsOfService } from './TermsOfService';
import RevenueEngine from './atrium/RevenueEngine';


import DataProcessingAgreement from './DataProcessingAgreement';
import WhatsNew from './WhatsNew';
import { useBrainAutoIndex } from '../hooks/useBrainAutoIndex';
import CookieConsent from './CookieConsent';


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
    const { currentUser, appMode, updateCurrentUser } = useAuth();
    const ui = useUI();
    const { view, selectedId, currentHistoryEntry, isSidebarRetracted, openModal, closeModal, navigateTo, theme, goBack } = ui;
    const { product } = useProduct();

    useBrainAutoIndex();

    const hasData = matterState.matters.length > 0 || matterState.contacts.length > 0 || executionState.tasks.length > 0;
    const showSkeleton = !isDataLoaded && !hasData;
    const isClient = currentUser?.role === UserRole.Client;

    console.log("[App/MainContent] Rendering...", { flowState, isDataLoaded, hasData, showSkeleton, isClient, view });


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
        if (showSkeleton) {
            switch (view) {
                case 'dashboard': return <DashboardSkeleton />;
                case 'tasks': return <TasksSkeleton />;
                case 'matters': return <MattersSkeleton />;
                case 'contacts': return <ContactsSkeleton />;
                case 'documents': return <DocumentsSkeleton />;
                default: return <GenericSkeleton />;
            }
        }

        if (isClient) {
            if (view === 'matterDetail' && selectedId) {
                return <ViewWrapper><ClientMatterDetailView /></ViewWrapper>;
            }


            if (view === 'intake' && selectedId) {
                return <ViewWrapper><ClientIntakePortal /></ViewWrapper>;
            }
            return <ViewWrapper><ClientDashboard /></ViewWrapper>;
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

            case 'calendar': return <ViewWrapper><CalendarView /></ViewWrapper>;
            case 'timeline': return <ViewWrapper><TimelineView /></ViewWrapper>;
            case 'billing': return <ViewWrapper><BillingView /></ViewWrapper>;
            case 'reporting': return <ViewWrapper><ReportingView /></ViewWrapper>;
            case 'settings': return <ViewWrapper><SettingsView /></ViewWrapper>;

            case 'messaging': return <ViewWrapper><MessagingView /></ViewWrapper>;
            case 'notes': return <ViewWrapper><NotesView /></ViewWrapper>;
            case 'help': return <ViewWrapper><HelpView /></ViewWrapper>;
            case 'archive': return <ViewWrapper><ArchiveView /></ViewWrapper>;

            case 'editor': return <WordProcessor />;
            case 'research': return <ViewWrapper><FeatureGuard requiredProduct="legal"><ResearchView /></FeatureGuard></ViewWrapper>;
            case 'indexer': return null;
            case 'invoiceDetail': return <ViewWrapper><InvoiceDetailView /></ViewWrapper>;
            case 'receiptDetail': return <ViewWrapper><ReceiptDetailView /></ViewWrapper>;

            case 'privacyPolicy': return <PrivacyPolicy onBack={goBack} />;
            case 'termsOfService': return <TermsOfService onBack={goBack} activeProduct={product === 'property' ? 'atrium' : product === 'legal' ? 'vega' : undefined} />;
            case 'dataProcessingAgreement': return <DataProcessingAgreement onBack={goBack} />;
            default: return <div>View not found.</div>;
        }
    };

    const isEditorMode = view === 'editor';

    if (isEditorMode) {
        return (
            <main className="w-full h-[100dvh] overflow-hidden bg-slate-50 dark:bg-zinc-900">
                {currentUser ? renderView() : <div>Loading...</div>}
            </main>
        );
    }

    return (
        <div className="flex h-[100dvh] bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-white overflow-hidden transition-colors duration-500">
            {currentUser && <Sidebar currentView={view} setView={navigateTo} currentUser={currentUser} appMode={appMode} />}
            <div className={`flex-1 flex flex-col transition-all duration-300 relative ${currentUser ? (isSidebarRetracted ? 'md:ml-20' : 'md:ml-64') : ''} min-w-0 h-full`}>
                {currentUser && <Header />}
                <main className="flex-1 relative h-full overflow-hidden pb-0">
                    {currentUser ? (
                        <div key={product} className="flex-1 h-full w-full relative animate-fade-in flex flex-col isolate">
                            {renderView()}
                            {view === 'indexer' && (
                                <ViewWrapper>
                                    <AloaXView />
                                </ViewWrapper>
                            )}
                        </div>
                    ) : <DashboardSkeleton />}
                </main>
                {currentUser && <BottomNav currentView={view} setView={navigateTo} />}
                <DemoProductSwitcher />
            </div>
            {currentUser && flowState === 'app' && (
                <>
                    <ContextMenu />
                    <DockedModal />
                    <AloaFAB />
                    <AloaPanel />
                    <CommandPalette />
                    <FullScreenSearch />
                    {view === 'settings' && <FeedbackButton />}
                </>
            )}
        </div>
    );
});

export const App: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, currentUser, isLoadingSession, loginAsDemoUser, appMode, logout } = useAuth();
    const { theme, fontSize, openModal, modal, view, closeModal, navigateTo } = useUI();
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
            const saved = localStorage.getItem('practicepro_user_session');
            return !!saved;
        } catch {
            return false;
        }
    }, []);

    const [flowState, setFlowState] = useState<FlowState>(hasSavedSession ? 'splash' : 'app');
    const { product } = useProduct();
    const [forceEntry, setForceEntry] = useState(false);
    const [hasInitialized, setHasInitialized] = useState(false);
    const [visualsComplete, setVisualsComplete] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("Initializing System...");
    const [sessionLoadTimedOut, setSessionLoadTimedOut] = useState(false);
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


    useIdleTimer(() => { if (isAuthenticated && !isSessionLocked) setIsSessionLocked(true); }, IDLE_TIMEOUT);
    const [isToolkitOpen, setIsToolkitOpen] = useState(false);

    console.log("[App] Rendering App...", { flowState, isSessionLocked, currentUser: currentUser?.email });

    // Safety valve: if the session has been loading for 6 seconds and the user has no
    // stored session, abandon the splash and show the landing page immediately.
    // #4 — Redirect unauthenticated users away from protected routes to keep URL clean
    useEffect(() => {
        const publicPaths = ['/', '/privacy-policy', '/terms-of-service', '/data-processing-agreement'];
        if (!isLoadingSession && !currentUser && !publicPaths.includes(location.pathname)) {
            console.log("[App] Redirecting unauthenticated user from protected path:", location.pathname);
            navigate('/', { replace: true });
        }
    }, [isLoadingSession, currentUser, location.pathname, navigate]);

    useEffect(() => {
        if (isLoadingSession && !hasSavedSession) {
            const t = setTimeout(() => setSessionLoadTimedOut(true), 6000);
            return () => clearTimeout(t);
        }
    }, [isLoadingSession, hasSavedSession]);

    const handleReset = () => {
        if (window.confirm("Reset local data? This will clear all local data and reload. This cannot be undone.")) {
            localStorage.clear();
            window.location.reload();
        }
    };

    const handleForceEnter = () => {
        setForceEntry(true);
    };

    useEffect(() => {
        if (currentUser && !hasInitialized) {
            setFlowState('splash');
            setVisualsComplete(false);
            setLoadingMessage("Welcome back");
            const timerId = window.setTimeout(() => setVisualsComplete(true), 800);
            return () => window.clearTimeout(timerId);
        } else if (!currentUser) {
            setHasInitialized(false);
        }
    }, [currentUser, hasInitialized]);

    const safetyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (currentUser && visualsComplete && !isDataLoaded && !forceEntry) {
            if (!safetyTimeoutRef.current) {
                safetyTimeoutRef.current = setTimeout(() => {
                    console.warn("[App] Data load timeout - forcing entry.");
                    setForceEntry(true);
                    safetyTimeoutRef.current = null;
                }, 12000);
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
            if (isDataLoaded || forceEntry) {
                setLoadingMessage("Ready");
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
                }, 500);
                return () => clearTimeout(t);
            } else {
                setLoadingMessage("Finalizing Data Synchronization...");
            }
        }
    }, [currentUser, visualsComplete, isDataLoaded, forceEntry, modal, closeModal]);

    useEffect(() => {
        if (flowState === 'app' && currentUser) {
            if (forceEntry && !isDataLoaded) return;
            const hasCompletedTour = localStorage.getItem('practicepro_tour_completed');
            if (hasCompletedTour !== 'true') setTimeout(() => startTour(), 500);
        }
    }, [flowState, currentUser, startTour]);

    const renderAppContent = () => {
        if (!currentUser && !isLoadingSession) {
            if (view === 'termsOfService') return <TermsOfService onBack={() => navigateTo('dashboard')} activeProduct={product === 'property' ? 'atrium' : product === 'legal' ? 'vega' : undefined} />;
            if (view === 'privacyPolicy') return <PrivacyPolicy onBack={() => navigateTo('dashboard')} />;
            if (view === 'dataProcessingAgreement') return <DataProcessingAgreement onBack={() => navigateTo('dashboard')} />;
            return <LandingPage onDemo={(product) => openModal('leadCapture', null, { demoProduct: product })} />;
        }

        // New User Flow: Go straight to setup if no firm exists
        if (currentUser && !currentUser.firmId) {
            return <OnboardingWizard onComplete={() => setFlowState('app')} />;
        }

        // Only block on SplashScreen if the user has a saved session being restored.
        // New/unauthenticated visitors must NEVER see the splash — they go straight to the Landing Page.
        if (isLoadingSession) {
            return null; // Top-level SplashScreen handles the branding
        }

        if (currentUser?.role === 'Pending') {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-zinc-950 w-full p-8 text-center font-sans">
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
                        <FloatingTestControls isOpen={isToolkitOpen} onClose={() => setIsToolkitOpen(false)} />
                    </>
                )}
            </>
        );
    };

    const [hasInitialSplashFinished, setHasInitialSplashFinished] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setHasInitialSplashFinished(true);
        }, 7000); 
        return () => clearTimeout(timer);
    }, []);

    const shouldShowFeedbackButton = currentUser && view === 'settings' && flowState === 'app';

    return (
        <div className={`app-container font-sans text-base ${theme} h-[100dvh] bg-[rgb(var(--bg-main))] text-[rgb(var(--text-main))]`}>
            <SplashScreen 
                isVisible={!hasInitialSplashFinished && (hasSavedSession || flowState === 'splash')} 
                statusMessage={loadingMessage} 
                onReset={handleReset} 
                onForceEnter={() => { setForceEntry(true); setHasInitialSplashFinished(true); }} 
                product={(!isDataLoaded || !currentUser?.firmId) ? 'practicepro' : (product === 'property' ? 'atrium' : 'vega')} 
            />
            {isSessionLocked ? (
                <LockScreen onUnlock={() => setIsSessionLocked(false)} />
            ) : (
                renderAppContent()
            )}
            {((!currentUser && hasInitialSplashFinished) || (currentUser && flowState !== 'splash')) && (
                <>
                    <ModalManager />
                    <ToastContainer />
                </>
            )}
            {shouldShowFeedbackButton && <FeedbackButton />}
            <OnboardingTour />
            {flowState === 'app' && currentUser && <WhatsNew />}
            <CookieConsent />
        </div>
    );
};

export default App;
