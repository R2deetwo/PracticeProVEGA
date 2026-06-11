
import * as React from 'react';
import { ModalType, SelectedId, Theme, View, HistoryEntry, Toast, TaskStatus, FontSize, AloaFormInteractionState, EditorState, ViewState, ContextMenuState, MatterStatus } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from "convex/react";


import { api } from "../../convex/_generated/api";
import { useAuth } from './AuthContext';

export interface UIContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    fontSize: FontSize;
    setFontSize: (size: FontSize) => void;
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    closeSidebar: () => void;
    isSidebarRetracted: boolean;
    toggleSidebarRetraction: () => void;
    modal: ModalType | null;
    modalContext: any;
    editingId: SelectedId;
    openModal: (modalType: ModalType, id?: string | null, context?: any) => void;
    closeModal: (idToClose?: string) => void;
    getModalTitle: (modalType: ModalType) => string;
    setModalContext: React.Dispatch<React.SetStateAction<any>>;
    history: HistoryEntry[];
    setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
    historyIndex: number;
    setHistoryIndex: React.Dispatch<React.SetStateAction<number>>;
    currentHistoryEntry: HistoryEntry;
    view: View;
    selectedId: SelectedId;
    canGoBack: boolean;
    canGoForward: boolean;
    navigateTo: (newView: View, newSelectedId?: SelectedId, context?: any) => void;
    goBack: () => void;
    goForward: () => void;
    updateCurrentHistoryEntry: (updates: Partial<HistoryEntry>) => void;
    settingsTargetId: string | null;
    setSettingsTargetId: React.Dispatch<React.SetStateAction<string | null>>;
    searchQuery: string | null;
    setSearchQuery: React.Dispatch<React.SetStateAction<string | null>>;
    toasts: Toast[];
    addToast: (message: React.ReactNode, options?: { type?: Toast['type']; link?: Toast['link'] }) => void;
    removeToast: (id: number) => void;
    taskStatusFilter: TaskStatus | null;
    setTaskStatusFilter: React.Dispatch<React.SetStateAction<TaskStatus | null>>;
    highlightTarget: { view: View; filter: any; color?: 'red' | 'orange' | 'blue' | 'shimmer' } | null;
    setHighlightTarget: React.Dispatch<React.SetStateAction<UIContextType['highlightTarget']>>;
    isMobileSearchOpen: boolean;
    setMobileSearchOpen: (isOpen: boolean) => void;
    dockedModalType: ModalType | null;
    setDockedModalType: React.Dispatch<React.SetStateAction<ModalType | null>>;

    // Form Interaction & Persistence
    formInteractionState: AloaFormInteractionState;
    setFormInteractionState: React.Dispatch<React.SetStateAction<AloaFormInteractionState>>;
    activeFormSnapshot: any; // Persist form data even when closed
    setActiveFormSnapshot: React.Dispatch<React.SetStateAction<any>>;

    editorState: EditorState;
    openEditor: (documentId?: string | null, context?: any) => void;
    closeEditor: () => void;

    isCommandPaletteOpen: boolean;
    toggleCommandPalette: () => void;
    setCommandPaletteOpen: (isOpen: boolean) => void;

    contextMenu: ContextMenuState;
    setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState>>;
    closeContextMenu: () => void;

    viewState: ViewState;
    setViewState: React.Dispatch<React.SetStateAction<ViewState>>;

    activePeers: string[];
    isOnline: boolean;

    // Lock Screen Management
    isSessionLocked: boolean;
    setIsSessionLocked: (locked: boolean) => void;
}

export const UIContext = React.createContext<UIContextType | undefined>(undefined);

export const useUI = () => {
    const context = React.useContext(UIContext);
    if (context === undefined) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};

// ... (getModalTitle helper remains same)
const getModalTitle = (modalType: ModalType): string => {
    switch (modalType) {
        case 'login': return 'Sign In';
        case 'signup': return 'Create Account';
        case 'newMatter': return 'New Matter';
        case 'editMatter': return 'Edit Matter';
        case 'closeMatter': return 'Close Matter';
        case 'archiveMatter': return 'Archive Matter';
        case 'newContact': return 'New Contact';
        case 'editContact': return 'Edit Contact';
        case 'newDocument': return 'Upload Document';
        case 'editDocument': return 'Edit Document';
        case 'shareDocument': return 'Share Document';
        case 'signDocument': return 'Sign Document';
        case 'newEvent': return 'New Event';
        case 'editEvent': return 'Edit Event';
        case 'viewEvent': return 'Event Details';
        case 'newInvoice': return 'New Invoice';
        case 'editInvoice': return 'Edit Invoice';
        case 'viewInvoice': return 'Invoice Details';
        case 'generateInvoice': return 'Generate Invoice';
        case 'newUser': return 'Invite User';
        case 'editUser': return 'Edit User';
        case 'newTimeEntry': return 'Log Time';
        case 'editTimeEntry': return 'Edit Time Entry';
        case 'newExpense': return 'Log Expense';
        case 'editExpense': return 'Edit Expense';
        case 'deleteConfirmation': return 'Confirm Delete';
        case 'newWorkflow': return 'Create Workflow';
        case 'editWorkflow': return 'Edit Workflow';
        case 'newEventType': return 'New Event Type';
        case 'editEventType': return 'Edit Event Type';
        case 'newContactCategory': return 'New Contact Category';
        case 'mergeContact': return 'Merge Contact Record';
        case 'editContactCategory': return 'Edit Contact Category';
        case 'newChecklistTemplate': return 'New Checklist Template';
        case 'editChecklistTemplate': return 'Edit Checklist Template';
        case 'editFirmDetails': return 'Firm Details';
        case 'newTemplate': return 'New Document Template';
        case 'editTemplate': return 'Edit Document Template';
        case 'newTemplateCategory': return 'New Template Category';
        case 'editTemplateCategory': return 'Edit Template Category';
        case 'googleDrivePicker': return 'Select from Google Drive';
        case 'noTeamMembers': return 'Add Team Members';
        case 'folderPermissions': return 'Folder Permissions';
        case 'assignUsers': return 'Assign Users';
        case 'viewTask': return 'Task Details';
        case 'newTask': return 'New Task';
        case 'stageChecklist': return 'Stage Checklist';
        case 'newChannel': return 'New Channel';
        case 'newDirectMessage': return 'New Message';
        case 'externalCounsel': return 'External Counsel Access';
        case 'newExternalCounsel': return 'Invite External Counsel';
        case 'aloaHelp': return 'ALOA Help';
        case 'feedback': return 'Send Feedback';
        case 'newBankAccount': return 'Add Bank Account';
        case 'editBankAccount': return 'Edit Bank Account';
        case 'newNotebook': return 'New Notebook';
        case 'editNotebook': return 'Edit Notebook';
        case 'newPage': return 'New Page';
        case 'copyPage': return 'Copy Page';
        case 'newLead': return 'New Lead';
        case 'activateLead': return 'Activate Lead';
        case 'sendIntakeLink': return 'Send Intake Link';
        case 'sendPostActivationEmail': return 'Send Welcome Email';
        case 'requestFinancialDocument': return 'Request Document';
        case 'linkContactToMatter': return 'Link Contacts';
        case 'newProperty': return 'Add Property';
        case 'editProperty': return 'Edit Property';
        case 'newDocumentCategory': return 'New Folder';
        case 'editDocumentCategory': return 'Edit Folder';
        case 'newResearchNotebook': return 'New Research Notebook';
        case 'addResearchSource': return 'Add Source';
        case 'addCaseToNotebook': return 'Add Case to Notebook';
        case 'keyboardShortcuts': return 'Keyboard Shortcuts';
        case 'quickLook': return 'Quick Look';
        case 'requestTrustDeposit': return 'Request Trust Deposit';
        case 'compareDocuments': return 'Compare Documents';
        case 'composeEmail': return 'Compose Email';
        case 'paymentGateway': return 'Complete Payment';
        case 'upgradePlan': return 'Upgrade Plan';
        case 'onboarding': return 'Setup Your Firm';

        case 'saveToNote': return 'Save to Note';
        case 'matterIngestion': return 'Smart Matter Ingestion';
        case 'leadCapture': return 'Demo Access';
        case 'collectRent': return 'Collect Rent';
        case 'bulkEditProperty': return 'Bulk Edit Properties';
        case 'editTask': return 'Edit Task';
        case 'newDraft': return 'New Draft';
        case 'linkMatterToContact': return 'Link Matter to Contact';
        case 'batchUpload': return 'Upload Files';
        case 'joinFirm': return 'Join Firm';
        case 'aiConsent': return 'AI Assistant Consent';
        case 'recordRentPayment': return 'Record Payment';
        case 'create_matter': return 'Create Matter';
        case 'create_contact': return 'Create Contact';
        case 'create_task': return 'Create Task';
        default: return 'Modal';
    }
};

export const UIProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {

    // Theme State - Initialize from LocalStorage to prevent flicker
    const [theme, setTheme] = React.useState<Theme>(() => {
        const stored = localStorage.getItem('practicepro_theme');
        return (stored as Theme) || 'system';
    });

    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const sendHeartbeatMutation = useMutation(api.myFunctions.sendHeartbeat);
    const activePeersQuery = useQuery(api.myFunctions.getActivePeers, currentUser?.firmId ? { firmId: currentUser.firmId } : "skip");

    const [fontSize, setFontSize] = React.useState<FontSize>(() => {
        const stored = localStorage.getItem('practicepro_fontSize');
        return (stored as FontSize) || 'md';
    });
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
    const [isSidebarRetracted, setIsSidebarRetracted] = React.useState(false);

    const [history, setHistory] = React.useState<HistoryEntry[]>([{ view: 'dashboard', selectedId: null }]);
    const [historyIndex, setHistoryIndex] = React.useState(0);
    const [modal, setModal] = React.useState<ModalType | null>(null);
    const [modalContext, setModalContext] = React.useState<any>(null);
    const [editingId, setEditingId] = React.useState<SelectedId>(null);
    const [dockedModalType, setDockedModalType] = React.useState<ModalType | null>(null);
    const [toasts, setToasts] = React.useState<Toast[]>([]);
    const [searchQuery, setSearchQuery] = React.useState<string | null>(null);
    const [settingsTargetId, setSettingsTargetId] = React.useState<string | null>(null);
    const [taskStatusFilter, setTaskStatusFilter] = React.useState<TaskStatus | null>(null);
    const [highlightTarget, setHighlightTarget] = React.useState<{ view: View; filter: any; color?: 'red' | 'orange' | 'blue' | 'shimmer' } | null>(null);
    const [isMobileSearchOpen, setMobileSearchOpen] = React.useState(false);
    const [formInteractionState, setFormInteractionState] = React.useState<AloaFormInteractionState>({ highlightedFieldId: null, isReadyForSubmit: false, fieldValues: {} });
    const [activeFormSnapshot, setActiveFormSnapshot] = React.useState<any>(null);
    const [editorState, setEditorState] = React.useState<EditorState>({ isOpen: false, documentId: null });
    const [isCommandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
    const [contextMenu, setContextMenu] = React.useState<ContextMenuState>({ isOpen: false, x: 0, y: 0, type: null, itemId: null });
    const [isOnline, setIsOnline] = React.useState(navigator.onLine);
    const [viewState, setViewState] = React.useState<ViewState>({
        matters: { statusFilter: MatterStatus.Active, practiceAreaFilter: 'All', assigneeFilter: 'All', searchFilter: '' },
        tasks: { statusFilter: 'All', userFilter: 'All', searchFilter: '' },
        contacts: { categoryFilter: 'All' }
    });

    // session lock persistence logic
    const [isSessionLocked, setIsSessionLocked] = React.useState<boolean>(() => {
        return localStorage.getItem('practicepro_session_locked') === 'true';
    });

    // ── User switch guard: reset history when user changes ───────────────
    const prevUserIdRef = React.useRef<string | null | undefined>(currentUser?.id);
    React.useEffect(() => {
        const prevId = prevUserIdRef.current;
        const nextId = currentUser?.id;
        if (prevId && nextId && prevId !== nextId) {
            console.log(`[UIProvider] User changed. Resetting history.`);
            setHistory([{ view: 'dashboard', selectedId: null }]);
            setHistoryIndex(0);
            setModal(null);
            setDockedModalType(null);
        }
        prevUserIdRef.current = nextId;
    }, [currentUser?.id]);

    React.useEffect(() => {
        localStorage.setItem('practicepro_session_locked', isSessionLocked ? 'true' : 'false');
    }, [isSessionLocked]);

    // Heartbeat Effect
    React.useEffect(() => {
        if (!currentUser || !currentUser.firmId) return;

        const sendPulse = () => {
            sendHeartbeatMutation({
                firmId: currentUser.firmId!,
                userId: currentUser.id,
                userName: currentUser.name
            }).catch(e => console.error("Heartbeat failed", e));
        };

        // Send immediately
        sendPulse();

        // Then every 20s
        const interval = setInterval(sendPulse, 20000);
        return () => clearInterval(interval);
    }, [currentUser?.id, currentUser?.firmId, currentUser?.name]);

    // Theme Effect - Applies class to HTML root
    React.useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(
            'light', 'dark', 
            'theme-midnight', 'theme-oled', 'theme-neon-cyber', 'theme-sunlight-soft', 'theme-city-lights',
            'theme-city-emerald', 'theme-midnight-emerald', 'theme-army-dark', 'theme-army-light'
        );

        let activeTheme = theme;
        if (theme === 'system') {
            activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        if (activeTheme === 'dark') {
            root.classList.add('dark');
        } else if (activeTheme === 'midnight') {
            root.classList.add('dark', 'theme-midnight');
        } else if (activeTheme === 'oled') {
            root.classList.add('dark', 'theme-oled');
        } else if (activeTheme === 'neon-cyber') {
            root.classList.add('dark', 'theme-neon-cyber');
        } else if (activeTheme === 'midnight-emerald') {
            root.classList.add('dark', 'theme-midnight-emerald');
        } else if (activeTheme === 'army-dark') {
            root.classList.add('dark', 'theme-army-dark');
        } else if (activeTheme === 'sunlight-soft') {
            root.classList.add('theme-sunlight-soft');
        } else if (activeTheme === 'city-lights') {
            root.classList.add('theme-city-lights');
        } else if (activeTheme === 'city-emerald') {
            root.classList.add('theme-city-emerald');
        } else if (activeTheme === 'army-light') {
            root.classList.add('theme-army-light');
        } else {
            root.classList.add('light');
        }

        localStorage.setItem('practicepro_theme', theme);
    }, [theme]);
    // Font Size Effect - Applies class to HTML root for global scaling
    React.useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('font-size-sm', 'font-size-md', 'font-size-lg');
        root.classList.add(`font-size-${fontSize}`);
        localStorage.setItem('practicepro_fontSize', fontSize);
    }, [fontSize]);

    // Network Listener
    React.useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const view = React.useMemo(() => {
        const pathParts = location.pathname.split('/').filter(Boolean);
        const currentView = (pathParts[0] || 'dashboard') as View;
        const currentId = pathParts[1] || null;

        let mappedView = currentView;
        if (location.pathname === '/') mappedView = 'dashboard';
        if (location.pathname === '/cookie-policy') mappedView = 'cookiePolicy' as any;
        if (location.pathname === '/privacy-policy') mappedView = 'privacyPolicy' as any;
        if (location.pathname === '/terms-of-service') mappedView = 'termsOfService' as any;
        if (location.pathname === '/data-processing-agreement') mappedView = 'dataProcessingAgreement' as any;
        if (currentView === 'matters' && currentId) mappedView = 'matterDetail';
        if (currentView === 'contacts' && currentId) mappedView = 'contactDetail';
        if (currentView === 'documents' && currentId) mappedView = 'documentDetail';
        if (currentView === 'properties' && currentId) mappedView = 'propertyDetail';
        
        return mappedView;
    }, [location.pathname]);

    const selectedId = React.useMemo(() => {
        const pathParts = location.pathname.split('/').filter(Boolean);
        const id = pathParts[1] || null;
        return id === 'null' ? null : id; // Sanitize string "null"
    }, [location.pathname]);

    const currentHistoryEntry = history[historyIndex] || { view: 'dashboard', selectedId: null };

    const addToast = React.useCallback((message: React.ReactNode, options?: { type?: Toast['type']; link?: Toast['link'] }) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type: options?.type || 'info', link: options?.link }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    React.useEffect(() => {
        const handleExternalToast = (e: any) => {
            const { message, options } = e.detail;
            addToast(message, options);
        };
        window.addEventListener('practicepro-toast', handleExternalToast);

        return () => {
            window.removeEventListener('practicepro-toast', handleExternalToast);
        };
    }, [addToast]);

    const navigateTo = React.useCallback((newView: View, newSelectedId: SelectedId = null, context?: any) => {
        // Sanitize string "null" or undefined IDs
        const safeId = (newSelectedId === 'null' || !newSelectedId) ? '' : newSelectedId;
        
        let path = `/${newView}`;
        
        // Map legacy view names to routes
        if (newView === 'dashboard') path = '/';
        else if (newView === 'cookiePolicy') path = '/cookie-policy';
        else if (newView === 'privacyPolicy') path = '/privacy-policy';
        else if (newView === 'termsOfService') path = '/terms-of-service';
        else if (newView === 'dataProcessingAgreement') path = '/data-processing-agreement';
        else if (newView === 'matterDetail') path = `/matters/${safeId}`;
        else if (newView === 'contactDetail') path = `/contacts/${safeId}`;
        else if (newView === 'documentDetail') path = `/documents/${safeId}`;
        else if (newView === 'propertyDetail') path = `/properties/${safeId}`;
        else if (newView === 'properties') path = `/properties`;
        else if (safeId) {
            path = `/${newView}/${safeId}`;
        }
        
        // Remove trailing slashes resulting from empty IDs
        if (path.endsWith('/')) path = path.slice(0, -1);
        
        navigate(path, { state: context });
        
        // Sync custom history state
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push({ view: newView, selectedId: newSelectedId, context });
            return newHistory;
        });
        setHistoryIndex(prev => prev + 1);

        setMobileSearchOpen(false);
        setModal(null);
    }, [navigate, historyIndex]);

    const goBack = React.useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
            navigate(-1);
        }
    }, [navigate, historyIndex]);

    const goForward = React.useCallback(() => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(prev => prev + 1);
            navigate(1);
        }
    }, [navigate, historyIndex, history.length]);


    const updateCurrentHistoryEntry = React.useCallback((updates: Partial<HistoryEntry>) => {
        setHistory(prev => {
            const newHistory = [...prev];
            newHistory[historyIndex] = { ...newHistory[historyIndex], ...updates };
            return newHistory;
        });
    }, [historyIndex]);

    const openModal = React.useCallback((modalType: ModalType, id: string | null = null, context: any = null) => {
        const isAloaTriggered = context?.openedByAloa === true;

        if (isAloaTriggered) {
            setDockedModalType(modalType);
            setModalContext(context);
            setEditingId(id);
            setModal(null); // Ensure regular modal is closed
        } else {
            // Default behavior: Center Modal
            setModal(modalType);
            setModalContext(context);
            setEditingId(id);
            setDockedModalType(null); // Ensure side modal is closed
        }
    }, []);

    const closeModal = React.useCallback((idToClose?: string) => {
        setModal(null);
        setDockedModalType(null);
        setModalContext(null);
        setEditingId(null);
        setFormInteractionState({ highlightedFieldId: null, isReadyForSubmit: false, fieldValues: {} });
    }, []);

    const removeToast = React.useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toggleSidebar = () => setIsSidebarOpen(p => !p);
    const closeSidebar = () => setIsSidebarOpen(false);
    const toggleSidebarRetraction = () => setIsSidebarRetracted(p => !p);

    const openEditor = React.useCallback((documentId: string | null = null, context: any = null) => {
        if (context) {
            updateCurrentHistoryEntry({ context: { ...currentHistoryEntry.context, ...context } });
        }
        if (documentId) {
            navigateTo('editor', documentId, context);
        } else {
            navigateTo('editor', null, context);
        }
    }, [navigateTo, updateCurrentHistoryEntry, currentHistoryEntry]);

    const closeEditor = React.useCallback(() => {
        goBack();
    }, [goBack]);

    const toggleCommandPalette = () => setCommandPaletteOpen(p => !p);
    const closeContextMenu = () => setContextMenu(prev => ({ ...prev, isOpen: false }));

    const value = {
        theme, setTheme,
        fontSize, setFontSize,
        isSidebarOpen, toggleSidebar, closeSidebar,
        isSidebarRetracted, toggleSidebarRetraction,
        modal, modalContext, editingId, openModal, closeModal, getModalTitle, setModalContext,
        history, setHistory, historyIndex, setHistoryIndex, currentHistoryEntry,
        view, selectedId, canGoBack: historyIndex > 0, canGoForward: historyIndex < history.length - 1,
        navigateTo, goBack, goForward, updateCurrentHistoryEntry,
        settingsTargetId, setSettingsTargetId,
        searchQuery, setSearchQuery,
        toasts, addToast, removeToast,
        taskStatusFilter, setTaskStatusFilter,
        highlightTarget, setHighlightTarget,
        isMobileSearchOpen, setMobileSearchOpen,
        dockedModalType, setDockedModalType,
        formInteractionState, setFormInteractionState,
        activeFormSnapshot, setActiveFormSnapshot,
        editorState, openEditor, closeEditor,
        isCommandPaletteOpen, toggleCommandPalette, setCommandPaletteOpen,
        contextMenu, setContextMenu, closeContextMenu,
        viewState, setViewState,
        activePeers: activePeersQuery || [],
        isOnline,
        isSessionLocked, setIsSessionLocked
    };

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
};
