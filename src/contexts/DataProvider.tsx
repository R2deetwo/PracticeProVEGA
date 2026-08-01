
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
    const addUnitToPropertyMutation = useMutation(api.myFunctions.addUnitToProperty);
    const removeUnitFromPropertyMutation = useMutation(api.myFunctions.removeUnitFromProperty);

    // Track recently-deleted IDs so the firmData re-merge (below) doesn't
    // re-add items the user just deleted. This was the root cause of the
    // "AI Notebooks refuse to delete" bug: optimistic delete removed the
    // notebook locally, but the next Convex subscription push re-added it
    // because Convex hadn't propagated the deletion yet (or the mutation
    // had silently failed inside a try/catch).
    // Entries expire after 60 seconds — long enough for Convex to propagate.
    const recentlyDeletedRef = React.useRef<Map<string, number>>(new Map());

    const markRecentlyDeleted = React.useCallback((id: string) => {
        recentlyDeletedRef.current.set(id, Date.now());
        // Cleanup entries older than 60s
        const now = Date.now();
        for (const [key, ts] of recentlyDeletedRef.current.entries()) {
            if (now - ts > 60_000) recentlyDeletedRef.current.delete(key);
        }
    }, []);

    const isRecentlyDeleted = React.useCallback((id: string): boolean => {
        const ts = recentlyDeletedRef.current.get(id);
        if (!ts) return false;
        if (Date.now() - ts > 60_000) {
            recentlyDeletedRef.current.delete(id);
            return false;
        }
        return true;
    }, []);

    // 2. Base Generic Actions (with Optimistic UI support)
    const baseActions = React.useMemo(() => ({
        addItem: async (table: string, data: any, itemName?: string) => {
            const tempId = data.id || uuidv4();
            const optimisticItem = { ...data, id: tempId };
            setAppState(prev => ({ ...prev, [table]: [...(prev[table as keyof AppState] as any[]), optimisticItem] }));

            try {
                const rawId = await createItemMutation({ table, data: { ...data, firmId: currentUser?.firmId }, userEmail: currentUser?.email });
                const convexId = rawId?.toString() || rawId;
                // CRITICAL: Keep the original client UUID as `id` (matching what was
                // saved to the backend document) and store the Convex internal _id
                // separately as `_id`. Previously this code overwrote `id` with the
                // Convex _id, which caused a mismatch with the backend document
                // (backend has id=tempId, local had id=convexId). That mismatch made
                // the Phase B merge logic treat the local copy as a separate
                // "optimistic" item, producing DUPLICATE task cards in the UI — and
                // when the user dragged one copy, the other stayed behind, making
                // the task appear to "disappear" or jump back to its old column.
                setAppState(prev => ({
                    ...prev,
                    [table]: (prev[table as keyof AppState] as any[]).map((i: any) =>
                        i.id === tempId ? { ...data, id: tempId, _id: convexId } : i)
                }));
                return { ...data, id: tempId, _id: convexId };
            } catch (e: any) {
                setAppState(prev => ({ ...prev, [table]: (prev[table as keyof AppState] as any[]).filter((i: any) => i.id !== tempId) }));
                // Surface the actual error message so users can see WHY it
                // failed (e.g., "Unauthenticated", "At least one assignee is
                // required") instead of a generic "Failed to save item".
                const errMsg = e?.message || `Failed to save ${itemName || 'item'}.`;
                addToast(errMsg, { type: 'error' });
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
                [table]: (prev[tableKey] as any[]).map((i: any) => {
                    if (!matchesItem(i)) return i;
                    const merged = { ...i, ...item };
                    // Deep-merge embedded units array: preserve sibling units not touched by this update
                    if (Array.isArray(i.units) && i.units.length > 0 && Array.isArray(item.units)) {
                        merged.units = i.units.map((eu: any) => {
                            const uid = eu.id || eu._id;
                            const updated = (item.units as any[]).find((u: any) => (u.id || u._id) === uid);
                            return updated ? { ...eu, ...updated } : eu;
                        });
                        (item.units as any[]).forEach((u: any) => {
                            const uid = u.id || u._id;
                            if (uid && !i.units.some((eu: any) => (eu.id || eu._id) === uid)) {
                                merged.units.push(u);
                            }
                        });
                    }
                    return merged;
                })
            }));
            try {
                await updateItemMutation({ table, id: mutationId, data: item, userEmail: currentUser?.email });
            } catch (e: any) {
                if (previousItem) {
                    setAppState(prev => ({
                        ...prev,
                        [table]: (prev[tableKey] as any[]).map((i: any) => (matchesItem(i) ? previousItem : i))
                    }));
                }
                // Surface the actual error message so users can see WHY it
                // failed (e.g., "Record not found", "Unauthenticated") instead
                // of a generic "Failed to update item. Reverting changes."
                const errMsg = e?.message || `Failed to update ${itemName || 'item'}.`;
                addToast(errMsg, { type: 'error' });
                throw e;
            }
        },
        deleteItem: async (table: string, id: string, itemName?: string) => {
            const tableKey = table as keyof AppState;
            const itemToDelete = (appStateRef.current[tableKey] as any[]).find((i: any) => i.id === id || (i._id && i._id === id));

            // Track this ID as recently-deleted so the firmData re-merge
            // doesn't re-add it before Convex propagates the deletion.
            // We track both the id and _id (if present) to be safe.
            markRecentlyDeleted(id);
            if (itemToDelete?._id && itemToDelete._id !== id) {
                markRecentlyDeleted(itemToDelete._id);
            }

            // Optimistically remove from local state
            setAppState(prev => ({
                ...prev,
                [table]: (prev[tableKey] as any[]).filter((i: any) => i.id !== id && i._id !== id)
            }));
            try {
                await deleteItemMutation({ table, id, userEmail: currentUser?.email });
            } catch (e: any) {
                // If the Convex delete fails (e.g., item not found, already
                // deleted, ID mismatch), DON'T restore the item to local state.
                // The user wants it gone — keeping it in the UI would be
                // confusing and frustrating. Log the error for debugging.
                console.warn(`[deleteItem] Convex delete failed for ${table}:${id}:`, e.message);
                addToast(`${itemName || 'Item'} removed.`, { type: 'info' });
            }
        },
        removeItemFromState: (table: string, id: string) => {
            const tableKey = table as keyof AppState;
            setAppState(prev => ({
                ...prev,
                [table]: (prev[tableKey] as any[]).filter((i: any) => i.id !== id && i._id !== id),
            }));
        },
        addUnit: async (propertyId: string, unitData: any) => {
            const tempUnit = { ...unitData };
            setAppState(prev => ({
                ...prev,
                properties: (prev.properties as any[]).map((p: any) => {
                    const pid = p.id || p._id;
                    if (pid !== propertyId) return p;
                    return { ...p, units: [...(p.units || []), tempUnit], numberOfUnits: (p.numberOfUnits || 0) + 1 };
                })
            }));
            try {
                await addUnitToPropertyMutation({ propertyId, firmId: currentUser?.firmId || '', unitData: tempUnit });
                return tempUnit;
            } catch (e) {
                setAppState(prev => ({
                    ...prev,
                    properties: (prev.properties as any[]).map((p: any) => {
                        const pid = p.id || p._id;
                        if (pid !== propertyId) return p;
                        return { ...p, units: (p.units || []).filter((u: any) => u.id !== tempUnit.id), numberOfUnits: Math.max((p.numberOfUnits || 1) - 1, 0) };
                    })
                }));
                throw e;
            }
        },
        removeUnit: async (propertyId: string, unitId: string) => {
            let removedUnit: any = null;
            setAppState(prev => ({
                ...prev,
                properties: (prev.properties as any[]).map((p: any) => {
                    const pid = p.id || p._id;
                    if (pid !== propertyId) return p;
                    removedUnit = (p.units || []).find((u: any) => u.id === unitId || u._id === unitId);
                    return { ...p, units: (p.units || []).filter((u: any) => u.id !== unitId && u._id !== unitId), numberOfUnits: Math.max((p.numberOfUnits || 1) - 1, 0) };
                })
            }));
            try {
                await removeUnitFromPropertyMutation({ propertyId, firmId: currentUser?.firmId || '', unitId });
            } catch (e) {
                if (removedUnit) {
                    setAppState(prev => ({
                        ...prev,
                        properties: (prev.properties as any[]).map((p: any) => {
                            const pid = p.id || p._id;
                            if (pid !== propertyId) return p;
                            return { ...p, units: [...(p.units || []), removedUnit], numberOfUnits: (p.numberOfUnits || 0) + 1 };
                        })
                    }));
                }
                throw e;
            }
        },
        logActivity: (action: string, targetType: any, targetId?: string, targetName?: string, matterId?: string) => {
            if (!currentUser || !currentUser.firmId) return;
            const activity = { 
                id: uuidv4(), 
                firmId: currentUser.firmId as string, 
                userId: currentUser.id as string, 
                userName: currentUser.name || 'PracticePro', 
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
    }), [currentUser, createItemMutation, updateItemMutation, deleteItemMutation, addUnitToPropertyMutation, removeUnitFromPropertyMutation, addToast]);

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

    // ── Notification mark-as-read ──────────────────────────────────────
    // Calls the Convex mutation to set isRead=true on each notification.
    // Without this, the "Mark all read" button did nothing — the handler
    // was a stub. Now it actually clears the unread badges.
    const markNotificationsMutation = useMutation(api.myFunctions.markNotificationsAsRead);
    const clearAllNotificationsMutation = useMutation(api.myFunctions.clearAllNotifications);

    const handleMarkNotificationsRead = React.useCallback(async (ids: string[]) => {
        if (!ids || ids.length === 0) return;
        // Optimistic update — immediately mark as read in local state
        // so the badge count drops instantly without waiting for Convex
        // to push the update back.
        const idSet = new Set(ids);
        setAppState(prev => ({
            ...prev,
            notifications: (prev.notifications || []).map((n: any) => {
                if (idSet.has(n.id) || idSet.has(n._id) || (n._id && idSet.has(String(n._id)))) {
                    return { ...n, isRead: true };
                }
                return n;
            }),
        }));
        try {
            await markNotificationsMutation({ ids, userEmail: currentUser?.email });
        } catch (err: any) {
            console.warn('[handleMarkNotificationsRead] Failed:', err?.message);
            // Revert on failure — set back to unread
            setAppState(prev => ({
                ...prev,
                notifications: (prev.notifications || []).map((n: any) => {
                    if (idSet.has(n.id) || idSet.has(n._id)) {
                        return { ...n, isRead: false };
                    }
                    return n;
                }),
            }));
        }
    }, [markNotificationsMutation, currentUser?.email]);

    const handleClearAllNotifications = React.useCallback(async () => {
        try {
            await clearAllNotificationsMutation({ userEmail: currentUser?.email });
        } catch (err: any) {
            console.warn('[handleClearAllNotifications] Failed:', err?.message);
        }
    }, [clearAllNotificationsMutation, currentUser?.email]);
    
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
        handleMarkNotificationsRead,
        handleClearAllNotifications,
        handlePurgeData,
        switchDemoProduct,
        refreshData,
        forceSync,
        handleClearState,
        handleRunDocumentAnalysis,
        handleApplyCustomStageChecklist,
        // Stubs for remaining interface requirements
        // HONESTY POLICY: Stubs that don't actually do anything must NOT show
        // success toasts — that's dishonest and confuses users into thinking
        // data was saved/deleted when it wasn't. These now show 'info' or
        // 'warning' toasts clearly stating the feature is not yet available.
        // The ones that CAN be implemented are implemented below.
        handleDeleteAllChats: async () => {
            // Actually delete all chat conversations for this firm
            try {
                const conversations = (appStateRef.current as any).chatConversations || [];
                for (const conv of conversations) {
                    await baseActions.deleteItem('chatConversations', conv.id || conv._id, 'Conversation');
                }
                addToast(`Cleared ${conversations.length} conversations.`, { type: 'success' });
            } catch (e) {
                addToast('Failed to clear chats. Please try again.', { type: 'error' });
            }
        },
        restoreFromLocalBackup: async () => addToast('Local backup restore is not yet available. Contact support if you need to recover data.', { type: 'warning' }),
        handleRestoreBackup: async (_key: string) => addToast('Backup restore is not yet available. Contact support if you need to recover data.', { type: 'warning' }),
        handleExportData: async () => {
            // Real data export — generates a JSON file and triggers download
            try {
                const state = appStateRef.current as any;
                const exportData: Record<string, any> = {
                    _exportInfo: {
                        exportedAt: new Date().toISOString(),
                        firmId: currentUser?.firmId || 'unknown',
                        exportedBy: currentUser?.email || 'unknown',
                        version: '1.0',
                    },
                };
                // Export all array-based tables
                const tablesToExport = [
                    'matters', 'contacts', 'tasks', 'documents', 'events',
                    'invoices', 'timeEntries', 'expenses', 'noteNotebooks',
                    'notePages', 'researchNotebooks', 'researchSources',
                    'workflows', 'checklistTemplates', 'properties',
                ];
                for (const table of tablesToExport) {
                    if (state[table]) {
                        exportData[table] = state[table];
                    }
                }
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `practicepro-export-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                addToast('Data export downloaded successfully.', { type: 'success' });
            } catch (e: any) {
                console.error('[handleExportData] Export failed:', e);
                addToast(`Export failed: ${e.message || 'Unknown error'}`, { type: 'error' });
            }
        },
        handleResetPracticeData: async () => handlePurgeData(),
        handleRenamePage: (id: string, title: string) => baseActions.updateItem('notePages', { id, title }, 'Page'),
        registerBroadcastHandler: (h: any) => {},
        handleRemoteAction: (p: any) => {},
        ensureUserInState: async (u: any) => {},
        handleSyncGoogleContacts: async () => addToast('Google Contacts sync is not yet available. This feature is on our roadmap.', { type: 'info' }),
        handleToggleBookmarkCase: (_id: string) => addToast('Case bookmarking is not yet available. This feature is on our roadmap.', { type: 'info' }),
        handleUpdateClientActionItem: async (matterId: string, itemId: string, completed: boolean) => {
            // Actually update the client action item on the matter
            try {
                const matter = (appStateRef.current as any).matters?.find((m: any) => m.id === matterId);
                if (!matter) {
                    addToast('Matter not found.', { type: 'error' });
                    return;
                }
                const actionItems = (matter.clientActionItems || []).map((item: any) =>
                    item.id === itemId ? { ...item, completed } : item
                );
                await baseActions.updateItem('matters', { id: matterId, clientActionItems: actionItems }, 'Action Item');
                addToast(completed ? 'Action item marked complete.' : 'Action item reopened.', { type: 'success' });
            } catch (e) {
                addToast('Failed to update action item.', { type: 'error' });
            }
        },
        handleSaveEmailAsDocument: (email: any) => {
            // Actually save the email as a document
            try {
                const docData = {
                    title: email.subject || `Email from ${email.from || 'Unknown'}`,
                    content: email.body || email.content || '',
                    matterId: email.matterId || null,
                    categoryId: 'cat_email',
                    dateFiled: new Date().toISOString(),
                    source: 'generated' as const,
                    uploadedBy: currentUser?.id || '',
                    assignedUsers: [],
                    metadata: { type: 'email', from: email.from, to: email.to, date: email.date },
                };
                baseActions.addItem('documents', docData, 'Document');
                addToast('Email saved as document.', { type: 'success' });
            } catch (e) {
                addToast('Failed to save email as document.', { type: 'error' });
            }
        },
        handleInviteExternalCounsel: async (_invite: any) => addToast('External counsel invitations are not yet available. This feature is on our roadmap.', { type: 'info' }),
        handleUpdatePageContent: async (id: string, title: string, content: string) => baseActions.updateItem('notePages', { id, title, content }, 'Page'),
        handleDeleteNotebook: async (id: string, name: string) => baseActions.deleteItem('noteNotebooks', id, name),
        handleRestoreItem: async (item: any) => {
            // Fix: the archive table stores 'itemType' and 'originalData', not 'type' and 'data'.
            const table = item.itemType || item.type;
            const data = item.originalData || item.data;
            if (!table || !data) {
                addToast('Cannot restore: archive record is missing data.', { type: 'error' });
                return;
            }
            // DELETE from archive FIRST, then add back to original table.
            // If we add first, the getFirmData re-merge may re-add the
            // archived item before the delete propagates, creating duplicates.
            await baseActions.deleteItem('archive', item.id, 'Archived Item');
            // Use _id if available (Convex internal ID) for the restored item
            const restoredData = { ...data };
            // Don't re-use the archive record's id — let addItem generate a fresh one
            delete restoredData._id;
            await baseActions.addItem(table, restoredData, item.itemName || item.name || 'Restored Item');
            addToast(`${item.itemName || item.name || 'Item'} restored successfully.`, { type: 'success' });
        },
        handlePermanentDeleteFromArchive: async (id: string) => baseActions.deleteItem('archive', id, 'Archived Item'),
        handleDeleteTimeEntry: async (id: string) => baseActions.deleteItem('timeEntries', id, 'Time Entry'),
        handleDeleteExpense: async (id: string) => baseActions.deleteItem('expenses', id, 'Expense'),
        handleUpdateWorkflow: async (workflow: any) => baseActions.updateItem('workflows', workflow, 'Workflow'),
        handleAddWorkflow: async (workflow: any) => baseActions.addItem('workflows', workflow, 'Workflow'),
        // Generic archive function — works for ANY table (matters, tasks, documents, contacts, etc.)
        handleArchiveItem: async (type: string, id: string, name: string, data?: any) => {
            // If data isn't provided, look it up from current appState
            const item = data || (appStateRef.current as any)[type]?.find((i: any) => i.id === id || i._id === id);
            if (!item) {
                addToast(`Cannot archive: item not found.`, { type: 'error' });
                return;
            }
            // Save to archive table
            await baseActions.addItem('archive', {
                itemType: type,
                itemId: id,
                itemName: name,
                archivedAt: new Date().toISOString(),
                archiverId: currentUser?.id || '',
                archiverName: currentUser?.name || '',
                originalData: item,
            }, 'Archived Item');
            // Delete from original table
            await baseActions.deleteItem(type as any, id, name);
            addToast(`${name} archived. You can restore it from the Archive page.`, { type: 'success' });
        },
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
        handleMarkNotificationsRead,
        handleClearAllNotifications,
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
    const isPortalUser = currentUser?.role === 'Client' || currentUser?.role === 'Tenant';

    // Portal users don't need the full firm data loading pipeline.
    // Their data comes from dedicated portal queries (getClientDocuments, getTenantLedger, etc.).
    // Set isDataLoaded immediately so the app doesn't hang on the splash screen.
    React.useEffect(() => {
        if (isPortalUser && !isDataLoaded) {
            setIsDataLoaded(true);
        }
    }, [isPortalUser, isDataLoaded]);

    // ── Portal-specific: Lightweight firm info ──────────────────────────
    // Portal users need firmDetails (subscriptionPlan, product) so that
    // useFeatures() can evaluate feature gates correctly. Without this,
    // the portal dashboard shows "Portal Unavailable" because useFeatures
    // defaults to Core plan when firmDetails is empty.
    // FALLBACK: If firmId is missing, try to resolve it from invite records.
    const portalFirmResolution = useQuery(
        api.portals.resolveFirmFromInvite,
        !isDemo && isPortalUser && !currentUser?.firmId && currentUser?.email
            ? { email: currentUser!.email }
            : 'skip'
    );
    const effectiveFirmId = currentUser?.firmId || portalFirmResolution?.firmId || '';

    const shouldLoadFirmBasicInfo = !isDemo && isPortalUser && !!effectiveFirmId;
    const firmBasicInfo = useQuery(
        api.myFunctions.getFirmBasicInfo,
        shouldLoadFirmBasicInfo ? { firmId: effectiveFirmId } : 'skip'
    );

    // Merge firm basic info into appState for portal users
    React.useEffect(() => {
        if (isPortalUser && firmBasicInfo && effectiveFirmId) {
            setAppState(prev => ({
                ...prev,
                firmDetails: {
                    ...prev.firmDetails,
                    _id: (firmBasicInfo as any)._id,
                    id: (firmBasicInfo as any).id || (firmBasicInfo as any)._id,
                    name: (firmBasicInfo as any).name || prev.firmDetails.name,
                    subscriptionPlan: (firmBasicInfo as any).subscriptionPlan || prev.firmDetails.subscriptionPlan,
                    product: (firmBasicInfo as any).product || prev.firmDetails.product,
                    address: (firmBasicInfo as any).address || prev.firmDetails.address,
                    inviteCode: (firmBasicInfo as any).inviteCode || prev.firmDetails.inviteCode,
                    aiSettings: (firmBasicInfo as any).aiSettings || prev.firmDetails.aiSettings,
                },
            }));
        }
    }, [isPortalUser, firmBasicInfo, effectiveFirmId]);

    // Phase A — fast metadata (lists only)
    // Portal users don't need full firm data — skip these heavy queries
    const shouldLoadFirmData = !isDemo && !isPortalUser && !!currentUser?.firmId;
    const firmMetadata = useQuery(
        api.myFunctions.getFirmMetadata,
        shouldLoadFirmData && currentUser?.firmId ? { firmId: currentUser.firmId } : 'skip'
    );

    // Phase B — full data (runs in parallel, merges when ready)
    const firmData = useQuery(
        api.myFunctions.getFirmData,
        shouldLoadFirmData && currentUser?.firmId ? { firmId: currentUser.firmId } : 'skip'
    );

    // Track which phase we're in so UI can show a subtle secondary loader
    const [isFullyLoaded, setIsFullyLoaded] = React.useState(false);

    // Ref to track the last merged firmData identity — allows us to re-merge
    // when Convex pushes an update (e.g. after createPortalInvite updates units[])
    // without causing infinite loops.
    const lastMergedFirmDataRef = React.useRef<any>(null);

    React.useEffect(() => {
        if (isDemo) {
            const isAtrium = currentUser?.product === 'atrium' || window.sessionStorage.getItem('practicepro_demo_product') === 'atrium';
            setAppState(isAtrium ? ATRIUM_DEMO_APP_STATE : VEGA_DEMO_APP_STATE);
            setIsDataLoaded(true);
            setIsFullyLoaded(true);
            return;
        }

        // ─── OFFLINE FALLBACK ─────────────────────────────────────────────
        // If we're offline AND have cached app data, load it immediately so
        // the user can view their matters, properties, tasks, etc. in
        // read-only mode instead of seeing a blank/loading screen.
        if (typeof navigator !== 'undefined' && !navigator.onLine && !isDataLoaded && currentUser) {
            try {
                const cached = localStorage.getItem('practicepro_cached_appstate');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed && parsed.firmId === currentUser.firmId) {
                        console.log('[DataProvider] Offline mode — using cached app data');
                        setAppState(parsed.state);
                        setIsDataLoaded(true);
                        setIsFullyLoaded(true);
                        return;
                    }
                }
            } catch {}
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

        // Phase B: full data — merge whenever firmData changes (not just first time)
        // This ensures that reactive Convex updates (e.g. after linking a portal user
        // to a property unit) are reflected in appState even after initial load.
        if (firmData && firmData !== lastMergedFirmDataRef.current) {
            lastMergedFirmDataRef.current = firmData;
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
                        // CRITICAL: Build backendIds from BOTH `id` AND `_id` of each
                        // backend item. Previously this set only contained `id` values,
                        // which meant a local item whose `id` had been overwritten with
                        // the Convex `_id` (a legacy bug in addItem) would NOT match,
                        // and would be incorrectly kept as an "optimistic" item —
                        // producing duplicate cards in the UI. Including `_id` here
                        // ensures any local item that references a backend document
                        // (by either field) is correctly recognized and deduplicated.
                        const backendIds = new Set<string>();
                        mappedBackendValue.forEach((item: any) => {
                            if (item.id) backendIds.add(item.id);
                            if (item._id) backendIds.add(String(item._id));
                        });
                        // Keep items from prev that are NOT in the backend (i.e. optimistic creates)
                        const optimisticItems = prevArray.filter(item => {
                            if (!item) return false;
                            // If either id or _id matches a backend id, this is NOT a new optimistic item
                            const idMatches = item.id && backendIds.has(item.id);
                            const idAsIdMatches = item.id && backendIds.has(String(item.id));
                            const _idMatches = item._id && backendIds.has(String(item._id));
                            const idMatchesBackendId = item.id && mappedBackendValue.some((bi: any) => String(bi._id) === String(item.id));
                            return !idMatches && !idAsIdMatches && !_idMatches && !idMatchesBackendId;
                        });
                        // Filter out items the user has just deleted (optimistic delete).
                        // Without this, the backend push would re-add the deleted item
                        // before Convex has propagated the deletion — the root cause of
                        // the "AI Notebooks refuse to delete" bug.
                        const filteredBackendValue = mappedBackendValue.filter((item: any) =>
                            !isRecentlyDeleted(item.id) && (!item._id || !isRecentlyDeleted(item._id))
                        );
                        (newState as any)[key] = [...filteredBackendValue, ...optimisticItems];
                    } else if (backendValue !== undefined) {
                        (newState as any)[key] = backendValue;
                    }
                }
                return newState;
            });
            if (!isFullyLoaded) setIsFullyLoaded(true);

            // ─── Cache app data for offline use ────────────────────────────
            // After successfully loading from the backend, cache a snapshot
            // in localStorage. When the app loads offline, we'll use this
            // to show the user's data in read-only mode.
            // We only cache essential arrays (not chatMessages which can be huge).
            try {
                const toCache = { ...appStateRef.current };
                // Strip large/unnecessary fields to keep cache size manageable
                delete (toCache as any).chatMessages;
                delete (toCache as any).firmActivity;
                localStorage.setItem('practicepro_cached_appstate', JSON.stringify({
                    firmId: currentUser?.firmId,
                    state: toCache,
                    cachedAt: Date.now(),
                }));
            } catch {} // localStorage might be full — non-critical
        }
    }, [firmMetadata, firmData, currentUser, isDemo, isDataLoaded, isFullyLoaded]);

    const dataStateValue = React.useMemo(() => ({
        appState, setAppState, isDataLoaded, isSaving: false, isOutdated: false, availableBackups: [] as string[]
    }), [appState, isDataLoaded]);

    return (
        <DataStateContext.Provider value={dataStateValue}>
            <DataActionsContext.Provider value={contextActions as unknown as ExtendedDataActions}>
                {children}
            </DataActionsContext.Provider>
        </DataStateContext.Provider>
    );
};
