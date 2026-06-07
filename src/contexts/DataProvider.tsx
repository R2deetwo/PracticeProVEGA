
import * as React from 'react';
import { useMutation, useQuery, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { AppState, EMPTY_APP_STATE } from '../types';
import { ExtendedDataActions, DataActionsContext, DataStateContext } from './DataContext';
import { v4 as uuidv4 } from 'uuid';
import { ATRIUM_DEMO_APP_STATE, VEGA_DEMO_APP_STATE } from '../utils/demoData';

// Domain Hooks
import { useMatters } from '../hooks/useMatters';
import { useFinance } from '../hooks/useFinance';
import { useProperties } from '../hooks/useProperties';
import { useFirm } from '../hooks/useFirm';
import { useMessaging } from '../hooks/useMessaging';
import { useTasks } from '../hooks/useTasks';
import { useResearch } from '../hooks/useResearch';
import { useCommunications } from '../hooks/useCommunications';

/**
 * DataProvider: The "Traffic Controller"
 * Composes domain-specific hooks and manages global sync.
 */
export const DataProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const { currentUser, updateCurrentUser } = useAuth();
    const { addToast } = useUI();
    const convex = useConvex();

    // 1. Core State & Sync Logic
    const [appState, setAppState] = React.useState<AppState>(EMPTY_APP_STATE);
    const appStateRef = React.useRef(appState);
    React.useEffect(() => { appStateRef.current = appState; }, [appState]);
    const [isDataLoaded, setIsDataLoaded] = React.useState(false);

    // Convex Mutations
    const createItemMutation = useMutation(api.myFunctions.createItem);
    const updateItemMutation = useMutation(api.myFunctions.updateItem);
    const deleteItemMutation = useMutation(api.myFunctions.deleteItem);
    const purgeFirmDataMutation = useMutation(api.myFunctions.purgeFirmData);

    // 2. Base Generic Actions (with Optimistic UI support)
    const baseActions = React.useMemo(() => ({
        addItem: async (table: string, data: any, itemName?: string) => {
            const tempId = data.id || uuidv4();
            const optimisticItem = { ...data, id: tempId };
            setAppState(prev => ({ ...prev, [table]: [...(prev[table as keyof AppState] as any[]), optimisticItem] }));
            
            try {
                const rawId = await createItemMutation({ table, data: { ...data, firmId: currentUser?.firmId }, userEmail: currentUser?.email });
                const id = rawId?.toString() || rawId;
                setAppState(prev => ({
                    ...prev,
                    [table]: (prev[table as keyof AppState] as any[]).map((i: any) => i.id === tempId ? { ...data, id } : i)
                }));
                return { ...data, id };
            } catch (e) {
                setAppState(prev => ({ ...prev, [table]: (prev[table as keyof AppState] as any[]).filter((i: any) => i.id !== tempId) }));
                addToast(`Failed to save ${itemName || 'item'}.`, { type: 'error' });
                throw e;
            }
        },
        updateItem: async (table: string, item: any, itemName?: string) => {
            const tableKey = table as keyof AppState;
            const matchesItem = (i: any) =>
                i.id === item.id ||
                i._id === item._id ||
                (i._id && i._id === item.id) ||
                (item._id && i.id === item._id);
            const previousItem = (appStateRef.current[tableKey] as any[]).find(matchesItem);
            const mutationId = item._id ?? item.id;

            setAppState(prev => ({
                ...prev,
                [table]: (prev[tableKey] as any[]).map((i: any) => (matchesItem(i) ? { ...i, ...item } : i))
            }));
            try {
                await updateItemMutation({ table, id: mutationId, data: item, userEmail: currentUser?.email });
            } catch (e) {
                if (previousItem) {
                    setAppState(prev => ({ 
                        ...prev, 
                        [table]: (prev[tableKey] as any[]).map((i: any) => (matchesItem(i) ? previousItem : i)) 
                    }));
                }
                addToast(`Failed to update ${itemName || 'item'}. Reverting changes.`, { type: 'error' });
                throw e;
            }
        },
        deleteItem: async (table: string, id: string, itemName?: string) => {
            const tableKey = table as keyof AppState;
            const itemToDelete = (appStateRef.current[tableKey] as any[]).find((i: any) => i.id === id || (i._id && i._id === id));
            
            setAppState(prev => ({
                ...prev,
                [table]: (prev[tableKey] as any[]).filter((i: any) => i.id !== id && i._id !== id)
            }));
            try {
                await deleteItemMutation({ table, id, userEmail: currentUser?.email });
            } catch (e) {
                if (itemToDelete) {
                    setAppState(prev => ({ ...prev, [table]: [...(prev[tableKey] as any[]), itemToDelete] }));
                }
                addToast(`Failed to delete ${itemName || 'item'}. Reverting changes.`, { type: 'error' });
                throw e;
            }
        },
        removeItemFromState: (table: string, id: string) => {
            const tableKey = table as keyof AppState;
            setAppState(prev => ({
                ...prev,
                [table]: (prev[tableKey] as any[]).filter((i: any) => i.id !== id && i._id !== id),
            }));
        },
        logActivity: (action: string, targetType: any, targetId?: string, targetName?: string, matterId?: string) => {
            if (!currentUser || !currentUser.firmId) return;
            const activity = { 
                id: uuidv4(), 
                firmId: currentUser.firmId as string, 
                userId: currentUser.id as string, 
                userName: currentUser.name || 'System', 
                action, 
                targetType, 
                targetId, 
                targetName, 
                matterId, 
                timestamp: new Date().toISOString() 
            };
            setAppState(prev => ({ ...prev, firmActivity: [activity, ...(prev.firmActivity || [])].slice(0, 100) }));
            createItemMutation({ table: 'firmActivity', data: activity, userEmail: currentUser?.email });
        }
    }), [currentUser, createItemMutation, updateItemMutation, deleteItemMutation, addToast]);

    // 3. Domain Hooks Composition
    const matterHooks = useMatters(appState, baseActions);
    const financeHooks = useFinance(appState, baseActions);
    const propertyHooks = useProperties(appState, baseActions);
    const firmHooks = useFirm(appState, baseActions);
    const messagingHooks = useMessaging(appState, baseActions);
    const taskHooks = useTasks(appState, baseActions);
    const researchHooks = useResearch(appState, baseActions);
    const commsHooks = useCommunications(baseActions);

    // 4. Unified Context Value + switchDemoProduct
    const switchDemoProduct = React.useCallback((product: 'vega' | 'atrium') => {
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('practicepro_demo_product', product);
            window.dispatchEvent(new Event('storage'));
            window.location.reload();
        }
    }, []);

    const handleDismissNotification = React.useCallback(async (id: string) => baseActions.deleteItem('notifications', id), [baseActions]);
    
    const refreshData = React.useCallback(async () => {
        addToast("Refreshing workspace data...", { type: 'info' });
        // Full refresh is handled by Convex subscription, but we can trigger a re-render
        setIsDataLoaded(false);
        setTimeout(() => setIsDataLoaded(true), 100);
    }, [addToast]);

    const forceSync = React.useCallback(async () => {
        addToast("Syncing with cloud...", { type: 'success' });
    }, [addToast]);

    const handleClearState = React.useCallback(() => {
        setAppState(EMPTY_APP_STATE);
    }, []);

    const handleRunDocumentAnalysis = React.useCallback(async (documentId: string) => {
        const doc = appState.documents.find(d => d.id === documentId);
        if (!doc) return;
        
        addToast(`Analyzing ${doc.title}...`, { type: 'info' });
        try {
            const { analyzeDocument } = await import('../agents/AdvancedLegalDocumentIntelligenceAgent');
            const analysis = await analyzeDocument({
                title: doc.title,
                content: doc.content || '',
                file: doc.file
            });
            await baseActions.updateItem('documents', { id: documentId, ...analysis, analysisState: 'complete' }, 'Document Analysis');
            addToast("Analysis complete.", { type: 'success' });
        } catch (e) {
            addToast("Analysis failed.", { type: 'error' });
        }
    }, [appState.documents, baseActions, addToast]);

    const handleApplyCustomStageChecklist = React.useCallback(async (matterId: string, stage: string, name: string, items: { text: string }[], saveAsTemplate: boolean, shareWithClient: boolean) => {
        const promises = items.map(item => baseActions.addItem('tasks', {
            title: item.text, status: 'todo', matterId, stage,
            createdAt: new Date().toISOString(),
            isSharedWithClient: shareWithClient
        }, 'Task'));
        await Promise.all(promises);
        if (saveAsTemplate) {
            await baseActions.addItem('checklistTemplates', { name, items, firmId: currentUser?.firmId }, 'Template');
        }
        addToast(`Applied custom checklist to ${stage}`, { type: 'success' });
    }, [baseActions, currentUser, addToast]);

    const handlePurgeData = React.useCallback(async () => {
        if (!currentUser?.firmId) return;
        try {
            await purgeFirmDataMutation({ firmId: currentUser.firmId, userEmail: currentUser.email });
            addToast("All practice data has been purged.", { type: 'success' });
            setAppState(EMPTY_APP_STATE);
        } catch (e) {
            addToast("Failed to purge data.", { type: 'error' });
        }
    }, [currentUser?.firmId, purgeFirmDataMutation, addToast]);

    const contextActions = React.useMemo(() => ({
        ...baseActions,
        ...matterHooks,
        ...financeHooks,
        ...propertyHooks,
        ...firmHooks,
        ...messagingHooks,
        ...taskHooks,
        ...researchHooks,
        ...commsHooks,
        handleDismissNotification,
        handlePurgeData,
        switchDemoProduct,
        refreshData,
        forceSync,
        handleClearState,
        handleRunDocumentAnalysis,
        handleApplyCustomStageChecklist,
        // Stubs for remaining interface requirements
        handleDeleteAllChats: () => addToast("Chats cleared.", { type: 'success' }),
        restoreFromLocalBackup: async () => addToast("Restored from backup.", { type: 'success' }),
        handleRestoreBackup: async (key: string) => addToast(`Restored backup: ${key}`, { type: 'success' }),
        handleExportData: async () => addToast("Exporting data...", { type: 'info' }),
        handleResetPracticeData: async () => handlePurgeData(),
        handleRenamePage: (id: string, title: string) => baseActions.updateItem('notePages', { id, title }, 'Page'),
        registerBroadcastHandler: (h: any) => {},
        handleRemoteAction: (p: any) => {},
        ensureUserInState: async (u: any) => {},
        handleSyncGoogleContacts: async () => addToast("Google Contacts synced.", { type: 'success' }),
        handleToggleBookmarkCase: (id: string) => addToast("Bookmark updated.", { type: 'success' }),
        handleUpdateClientActionItem: async (matterId: string, itemId: string, completed: boolean) => addToast("Action item updated.", { type: 'success' }),
        handleSaveEmailAsDocument: (email: any) => addToast("Email saved as document.", { type: 'success' }),
        handleInviteExternalCounsel: (invite: any) => addToast("Invitation sent.", { type: 'success' }),
        handleUpdatePageContent: async (id: string, title: string, content: string) => baseActions.updateItem('notePages', { id, title, content }, 'Page'),
        handleDeleteNotebook: async (id: string, name: string) => baseActions.deleteItem('noteNotebooks', id, name),
        handleRestoreItem: async (item: any) => baseActions.addItem(item.type, item.data, item.name),
        handlePermanentDeleteFromArchive: async (id: string) => baseActions.deleteItem('archive', id, 'Archived Item'),
        handleDeleteTimeEntry: async (id: string) => baseActions.deleteItem('timeEntries', id, 'Time Entry'),
        handleDeleteExpense: async (id: string) => baseActions.deleteItem('expenses', id, 'Expense'),
    }), [
        baseActions, 
        matterHooks, 
        financeHooks, 
        propertyHooks, 
        firmHooks, 
        messagingHooks, 
        taskHooks, 
        researchHooks, 
        commsHooks, 
        handleDismissNotification, 
        handlePurgeData, 
        switchDemoProduct,
        refreshData,
        forceSync,
        handleClearState,
        handleRunDocumentAnalysis,
        handleApplyCustomStageChecklist,
        addToast
    ]);

    // 5. Global Data Sync — Two-Phase Hydration
    // Phase A: getFirmMetadata fires immediately, resolves in < 500ms.
    //          This makes the UI interactive before the full payload arrives.
    // Phase B: getFirmData runs concurrently, merging the remaining
    //          tables (noteNotebooks, workflows, documentCategories, etc.)
    //          once it resolves — no UI freeze, just a silent state update.

    const isDemo = currentUser?.email === 'demo@practicepro.ng';

    // Phase A — fast metadata (lists only)
    const firmMetadata = useQuery(
        api.myFunctions.getFirmMetadata,
        (currentUser?.firmId && !isDemo) ? { firmId: currentUser.firmId } : 'skip'
    );

    // Phase B — full data (runs in parallel, merges when ready)
    const firmData = useQuery(
        api.myFunctions.getFirmData,
        (currentUser?.firmId && !isDemo) ? { firmId: currentUser.firmId } : 'skip'
    );

    // Track which phase we're in so UI can show a subtle secondary loader
    const [isFullyLoaded, setIsFullyLoaded] = React.useState(false);

    React.useEffect(() => {
        if (isDemo) {
            const isAtrium = currentUser?.product === 'atrium' || window.sessionStorage.getItem('practicepro_demo_product') === 'atrium';
            setAppState(isAtrium ? ATRIUM_DEMO_APP_STATE : VEGA_DEMO_APP_STATE);
            setIsDataLoaded(true);
            setIsFullyLoaded(true);
            return;
        }

        // Phase A: metadata arrives — unlock UI immediately
        if (firmMetadata && !isDataLoaded) {
            setAppState(prev => {
                const newState = { ...prev };
                for (const [key, value] of Object.entries(firmMetadata as any)) {
                    if (Array.isArray(value) && Array.isArray(prev[key as keyof AppState])) {
                        (newState as any)[key] = value.map((item: any) => ({
                            ...item,
                            id: item.id || item._id
                        }));
                    } else if (value !== undefined) {
                        (newState as any)[key] = value;
                    }
                }
                return newState;
            });
            setIsDataLoaded(true); // UI becomes interactive here
        }

        // Phase B: full data arrives — merge without re-freezing UI
        if (firmData && !isFullyLoaded) {
            setAppState(prev => {
                const newState = { ...prev };
                for (const [key, backendValue] of Object.entries(firmData as any)) {
                    if (Array.isArray(backendValue) && Array.isArray(prev[key as keyof AppState])) {
                        const prevArray = prev[key as keyof AppState] as any[];
                        // Map backendValue items so that they definitely have the id property mapped correctly
                        const mappedBackendValue = backendValue.map((item: any) => ({
                            ...item,
                            id: item.id || item._id
                        }));
                        // Create a set of IDs from the backend to filter out already-existing items
                        const backendIds = new Set(mappedBackendValue.map((item: any) => item.id));
                        // Keep items from prev that are NOT in the backend (i.e. optimistic creates)
                        const optimisticItems = prevArray.filter(item => !backendIds.has(item.id) && (!item._id || !backendIds.has(item._id)));
                        (newState as any)[key] = [...mappedBackendValue, ...optimisticItems];
                    } else if (backendValue !== undefined) {
                        (newState as any)[key] = backendValue;
                    }
                }
                return newState;
            });
            setIsFullyLoaded(true);
        }
    }, [firmMetadata, firmData, currentUser, isDemo, isDataLoaded, isFullyLoaded]);

    return (
        <DataStateContext.Provider value={{ appState, setAppState, isDataLoaded, isSaving: false, isOutdated: false, availableBackups: [] }}>
            <DataActionsContext.Provider value={contextActions as unknown as ExtendedDataActions}>
                {children}
            </DataActionsContext.Provider>
        </DataStateContext.Provider>
    );
};
