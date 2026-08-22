
import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { TaskStatus, AppState } from '../types';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineQueue } from './useOfflineQueue';

/**
 * Hook for managing tasks and checklists.
 */
export const useTasks = (appState: AppState, actions: any) => {
    const { addToast } = useUI();
    const { currentUser } = useAuth();
    const createTaskMutation = useMutation(api.myFunctions.createTask);
    const updateTaskStatusMutation = useMutation(api.myFunctions.updateTaskStatus);
    const updateTaskMutation = useMutation(api.myFunctions.updateTask);
    const { queueMutation, isOnline } = useOfflineQueue();

    const handleUpdateTaskStatus = useCallback(async (id: string, status: any) => {
        // Use the dedicated updateTaskStatus mutation instead of the generic
        // updateItem. This is the PERMANENT FIX for the persistent drag-drop
        // bug where tasks couldn't be moved between Kanban columns.
        //
        // The generic updateItem was failing because:
        // 1. It passed { id, status } as data — the `id` field got patched
        //    onto the document (should only be used for lookup)
        // 2. resolveRecordForUpdate couldn't find tasks without a custom `id`
        //    field (tasks created via createTask don't have one)
        // 3. The error was swallowed by a generic toast
        //
        // The dedicated mutation tries 3 lookup strategies and patches ONLY
        // the status field.
        //
        // OFFLINE PATH — task status changes (Kanban drag, "Mark Done" button)
        // are common mobile field-use actions. Queue when offline so the
        // user's intent is preserved; status will sync when they reconnect.
        if (!isOnline) {
            queueMutation({
                mutationName: 'updateTaskStatus',
                args: {
                    taskId: id,
                    status,
                    userEmail: currentUser?.email,
                },
                label: `Task status → ${status}`,
            });
            addToast(`Task status saved offline. Will sync when you reconnect.`, { type: 'info', duration: 5000 });
            return;
        }
        try {
            await updateTaskStatusMutation({
                taskId: id,
                status,
                userEmail: currentUser?.email,
            });
        } catch (e: any) {
            console.error('[handleUpdateTaskStatus] Failed:', e);
            addToast(e?.message || 'Failed to update task status.', { type: 'error' });
            throw e;
        }
    }, [updateTaskStatusMutation, currentUser, addToast, isOnline, queueMutation]);

    const handleUpdateTaskPriority = useCallback((id: string, priority: any) =>
        actions.updateItem('tasks', { id, priority }, 'Task Priority'), [actions]);

    // Dedicated task update — uses updateTask mutation (not generic updateItem)
    // This prevents duplicate cards caused by ID lookup failures in updateItem.
    // Use this for reassignment, priority changes, and any full-task edit.
    const handleUpdateTask = useCallback(async (task: any) => {
        // OFFLINE PATH — queue task edits (reassignment, priority, etc.).
        // Same field-use scenario as status updates.
        if (!isOnline) {
            const taskId = task._id || task.id;
            const { _id, _creationTime, ...patch } = task;
            queueMutation({
                mutationName: 'updateTask',
                args: {
                    taskId,
                    patch,
                    userEmail: currentUser?.email,
                },
                label: `Task edit — ${task.title || taskId}`,
            });
            addToast(`Task edit saved offline. Will sync when you reconnect.`, { type: 'info', duration: 5000 });
            return;
        }
        try {
            const taskId = task._id || task.id;
            // Strip internal fields before sending
            const { _id, _creationTime, ...patch } = task;
            await updateTaskMutation({
                taskId,
                patch,
                userEmail: currentUser?.email,
            });
        } catch (e: any) {
            console.error('[handleUpdateTask] Failed:', e);
            addToast(e?.message || 'Failed to update task.', { type: 'error' });
            throw e;
        }
    }, [updateTaskMutation, currentUser, addToast, isOnline, queueMutation]);

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

        // OFFLINE PATH — queue task creation. Notifications (bell badge, email,
        // WhatsApp) will fire when the mutation replays online — slightly
        // delayed, but better than losing the task entirely.
        if (!isOnline) {
            queueMutation({
                mutationName: 'createTask',
                args,
                label: `New task — ${t.title || 'Untitled'}`,
            });
            addToast(`Task saved offline. Will sync and notify assignees when you reconnect.`, { type: 'info', duration: 6000 });
            return;
        }

        try {
            await createTaskMutation(args);
            addToast('Task created.', { type: 'success' });
        } catch (e: any) {
            console.error('[handleAddTask] createTask failed:', e);
            const errMsg = e?.message || e?.data?.message || 'Failed to save task.';
            addToast(errMsg, { type: 'error' });
            throw e;
        }
    }, [createTaskMutation, currentUser, addToast, isOnline, queueMutation]);

    return {
        handleUpdateTaskStatus,
        handleUpdateTask,
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

