
import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { TaskStatus, AppState } from '../types';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook for managing tasks and checklists.
 */
export const useTasks = (appState: AppState, actions: any) => {
    const { addToast } = useUI();
    const { currentUser } = useAuth();
    const createTaskMutation = useMutation(api.myFunctions.createTask);

    const handleUpdateTaskStatus = useCallback((id: string, status: any) => 
        actions.updateItem('tasks', { id, status }, 'Task Status'), [actions]);

    const handleUpdateTaskPriority = useCallback((id: string, priority: any) => 
        actions.updateItem('tasks', { id, priority }, 'Task Priority'), [actions]);

    const handleBulkUpdateTaskStatus = useCallback(async (ids: string[], status: any) => {
        const promises = ids.map(id => actions.updateItem('tasks', { id, status }, 'Task'));
        await Promise.all(promises);
        addToast(`Updated ${ids.length} tasks`, { type: 'success' });
    }, [actions, addToast]);

    const handleBulkDeleteTasks = useCallback(async (ids: string[]) => {
        const promises = ids.map(id => actions.deleteItem('tasks', id, 'Task'));
        await Promise.all(promises);
        addToast(`Deleted ${ids.length} tasks`, { type: 'success' });
    }, [actions, addToast]);

    const handleBulkArchiveTasks = useCallback(async (ids: string[]) => {
        // Archive each task with the CORRECT field names so it can be restored.
        // Previously this used { originalId, type, archivedAt } but the restore
        // function in DataProvider reads { itemType, itemId, itemName, originalData }.
        // Archived tasks were permanently lost — unrestorable.
        const tasksToArchive = appState.tasks.filter(t => ids.includes(t.id));
        const promises = tasksToArchive.map(task => actions.addItem('archive', {
            itemType: 'tasks',
            itemId: task.id,
            itemName: task.title || 'Task',
            archivedAt: new Date().toISOString(),
            originalData: task,
        }, 'Task Archive'));
        await Promise.all(promises);
        await handleBulkDeleteTasks(ids);
        addToast(`Archived ${ids.length} tasks`, { type: 'success' });
    }, [actions, handleBulkDeleteTasks, addToast, appState.tasks]);

    const handleArchiveAllDoneTasks = useCallback(async () => {
        const doneTasks = appState.tasks.filter(t => t.status === TaskStatus.Done);
        await handleBulkArchiveTasks(doneTasks.map(t => t.id));
    }, [appState.tasks, handleBulkArchiveTasks]);

    const handleApplyStageChecklist = useCallback(async (matterId: string, stage: string, templateId: string, shareWithClient: boolean) => {
        const template = appState.checklistTemplates.find(t => t.id === templateId);
        if (!template) return;
        const promises = template.items.map((item: any) => actions.addItem('tasks', {
            title: item.text, status: 'todo', matterId, stage,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            isSharedWithClient: shareWithClient, createdAt: new Date().toISOString()
        }, 'Task'));
        await Promise.all(promises);
        addToast(`Applied checklist to ${stage}`, { type: 'success' });
    }, [appState.checklistTemplates, actions, addToast]);

    const handleDeleteAllDoneTasks = useCallback(async () => {
        const doneTasks = appState.tasks.filter(t => t.status === TaskStatus.Done);
        await handleBulkDeleteTasks(doneTasks.map(t => t.id));
    }, [appState.tasks, handleBulkDeleteTasks]);

    const handleAddTask = useCallback(async (t: any) => {
        // Use the dedicated createTask mutation (not generic createItem) so
        // that assignee validation runs AND notifications are dispatched to
        // all assignees (in-app + email + WhatsApp for external stakeholders).
        // Previously this called actions.addItem('tasks', t) which bypassed
        // all notification logic — assignees never got bell badges or emails.
        try {
            // CRITICAL: Strip undefined values — the Convex client throws
            // "undefined is not a valid Convex value" if any arg is undefined.
            // This was the root cause of "Failed to save task" for client tasks:
            // when dueDate or matterId was null/empty, `null || undefined` = undefined,
            // and Convex rejected the entire mutation before it reached the server.
            const args: Record<string, any> = {
                title: t.title,
                description: t.description || '',
                status: t.status || 'todo',
                assignedUsers: t.assignedUsers || [],
                assigneeType: t.assigneeType || 'team',
                isSharedWithPortal: t.isSharedWithPortal || false,
                priority: t.priority || 'medium',
            };
            // Only include optional fields if they have actual values
            if (t.dueDate) args.dueDate = t.dueDate;
            if (t.matterId) args.matterId = t.matterId;
            if (currentUser?.id) args.creatorId = currentUser.id;
            if (currentUser?.name) args.creatorName = currentUser.name;
            if (currentUser?.email) args.userEmail = currentUser.email;

            await createTaskMutation(args);
            addToast('Task created.', { type: 'success' });
        } catch (e: any) {
            console.error('[handleAddTask] createTask failed:', e);
            const errMsg = e?.message || e?.data?.message || 'Failed to save task.';
            addToast(errMsg, { type: 'error' });
            throw e;
        }
    }, [createTaskMutation, currentUser, addToast]);

    return {
        handleUpdateTaskStatus,
        handleUpdateTaskPriority,
        handleBulkUpdateTaskStatus,
        handleBulkDeleteTasks,
        handleDeleteAllDoneTasks,
        handleAddTask,
        handleApplyStageChecklist,
        handleBulkArchiveTasks,
        handleArchiveAllDoneTasks,
    };
};

