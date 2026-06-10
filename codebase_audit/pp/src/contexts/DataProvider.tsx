
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
    const [isDataLoaded, setIsDataLoaded] = React.useState(false);

    // Convex Mutations
    const createItemMutation = useMutation(api.myFunctions.createItem);
    const updateItemMutation = useMutation(api.myFunctions.updateItem);
    const deleteItemMutation = useMutation(api.myFunctions.deleteItem);
    const purgeFirmDataMutation = useMutation(api.myFunctions.purgeFirmData);

    // 2. Base Generic Actions (with Optimistic UI support)
    const baseActions = {
        addItem: async (table: string, data: any, itemName?: string) => {
            const tempId = data.id || uuidv4();
            const optimisticItem = { ...data, id: tempId };
            setAppState(prev => ({ ...prev, [table]: [...(prev[table as keyof AppState] as any[]), optimisticItem] }));
            
            try {
                const rawId = await createItemMutation({ table, data: { ...data, firmId: currentUser?.firmId } });
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
            const prevState = appState;
            setAppState(prev => ({
                ...prev,
                [table]: (prev[table as keyof AppState] as any[]).map((i: any) => i.id === item.id ? { ...i, ...item } : i)
            }));
            try {
                await updateItemMutation({ table, id: item.id, data: item });
            } catch (e) {
                setAppState(prevState);
                addToast(`Failed to update ${itemName || 'item'}.`, { type: 'error' });
            }
        },
        deleteItem: async (table: string, id: string, itemName?: string) => {
            const prevState = appState;
            setAppState(prev => ({
                ...prev,
                [table]: (prev[table as keyof AppState] as any[]).filter((i: any) => i.id !== id)
            }));
            try {
                await deleteItemMutation({ table, id });
            } catch (e) {
                setAppState(prevState);
                addToast(`Failed to delete ${itemName || 'item'}.`, { type: 'error' });
            }
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
            createItemMutation({ table: 'firmActivity', data: activity });
        }

    };

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

    const contextActions: any = {
        ...baseActions,
        ...matterHooks,
        ...financeHooks,
        ...propertyHooks,
        ...firmHooks,
        ...messagingHooks,
        ...taskHooks,
        ...researchHooks,
        ...commsHooks,
        handleDismissNotification: async (id: string) => baseActions.deleteItem('notifications', id),
        handlePurgeData: async () => {
            if (!currentUser?.firmId) return;
            try {
                await purgeFirmDataMutation({ firmId: currentUser.firmId });
                addToast("All practice data has been purged.", { type: 'success' });
                setAppState(EMPTY_APP_STATE);
            } catch (e) {
                addToast("Failed to purge data.", { type: 'error' });
            }
        },
        switchDemoProduct,
    };

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
            setAppState(prev => ({
                ...prev,
                matters: (firmMetadata as any).matters || prev.matters,
                contacts: (firmMetadata as any).contacts || prev.contacts,
                properties: (firmMetadata as any).properties || prev.properties,
                tasks: (firmMetadata as any).tasks || prev.tasks,
                events: (firmMetadata as any).events || prev.events,
                invoices: (firmMetadata as any).invoices || prev.invoices,
            }));
            setIsDataLoaded(true); // UI becomes interactive here
        }

        // Phase B: full data arrives — merge without re-freezing UI
        if (firmData && !isFullyLoaded) {
            setAppState(prev => ({ ...prev, ...(firmData as any) }));
            setIsFullyLoaded(true);
        }
    }, [firmMetadata, firmData, currentUser, isDemo, isDataLoaded, isFullyLoaded]);

    return (
        <DataStateContext.Provider value={{ appState, setAppState, isDataLoaded, isSaving: false, isOutdated: false, availableBackups: [] }}>
            <DataActionsContext.Provider value={contextActions as ExtendedDataActions}>
                {children}
            </DataActionsContext.Provider>
        </DataStateContext.Provider>
    );
};
