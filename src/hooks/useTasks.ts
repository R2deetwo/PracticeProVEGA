
import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { TaskStatus, AppState } from '../types';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineQueue } from './useOfflineQueue';

/**
 * Hook for managing tasks and checklists.
 *
 * TASK MUTATION STRATEGY (Aug 2026):
 * ALL task operations now use dedicated mutations (createTask, updateTask,
 * updateTaskStatus, deleteTask) instead of the generic updateItem/deleteItem
 * path. The generic path fails silently when tasks don't have a custom `id`
 * field — which was the root cause of the drag-drop bug, priority changes not
 * sticking, bulk actions doing nothing, and deletes not actually deleting.
 *
 * The dedicated mutations use a 3-strategy lookup:
 *   1. Try as Convex _id (fast path for server-created tasks)
 *   2. Look up by custom `id` field (for tasks with the UUID assigned)
 *   3. Scan all firm tasks matching by id or _id (fallback)
 *
 * The createTask mutation now assigns the UUID to the `id` field at insert
 * time (was dead code before), so all NEW tasks have a reliable custom id.
 * Existing tasks (created before this fix) are handled by strategy 1 or 3.
 */
export const useTasks = (appState: AppState, actions: any) => {
    const { addToast } = useUI();
    const { currentUser, bearerToken } = useAuth();
    const createTaskMutation = useMutation(api.myFunctions.createTask);
    const updateTaskStatusMutation = useMutation(api.myFunctions.updateTaskStatus);
    const updateTaskMutation = useMutation(api.myFunctions.updateTask);
    const deleteTaskMutation = useMutation(api.myFunctions.deleteTask);
    const { queueMutation, isOnline } = useOfflineQueue();

    const handleUpdateTaskStatus = useCallback(async (id: string, status: any) => {
        // OFFLINE PATH — task status changes (Kanban drag, "Mark Done" button)
        // are common mobile field-use actions. Queue when offline so the
        // user's intent is preserved; status will sync when they reconnect.
        if (!isOnline) {
            queueMutation({
                mutationName: 'updateTaskStatus',
                args: {
                    taskId: id,
                    status,
                    userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
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
                userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
            });
        } catch (e: any) {
            console.error('[handleUpdateTaskStatus] Failed:', e);
            addToast(e?.message || 'Failed to update task status.', { type: 'error' });
            throw e;
        }
    }, [updateTaskStatusMutation, currentUser, addToast, isOnline, queueMutation]);

    // FIX (Aug 2026): Use dedicated updateTask mutation instead of generic
    // updateItem. The generic path fails silently when the task has no
    // custom `id` field — same root cause as the drag-drop bug.
    const handleUpdateTaskPriority = useCallback(async (id: string, priority: any) => {
        try {
            await updateTaskMutation({
                taskId: id,
                patch: { priority },
                userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
            });
        } catch (e: any) {
            console.error('[handleUpdateTaskPriority] Failed:', e);
            addToast(e?.message || 'Failed to update task priority.', { type: 'error' });
        }
    }, [updateTaskMutation, currentUser, addToast]);

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
                    userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
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
                userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
            });
        } catch (e: any) {
            console.error('[handleUpdateTask] Failed:', e);
            addToast(e?.message || 'Failed to update task.', { type: 'error' });
            throw e;
        }
    }, [updateTaskMutation, currentUser, addToast, isOnline, queueMutation]);

    // FIX (Aug 2026): Use dedicated updateTaskStatus mutation instead of
    // generic updateItem. Same root cause as the drag-drop bug.
    const handleBulkUpdateTaskStatus = useCallback(async (ids: string[], status: any) => {
        // Reuse the existing reliable updateTaskStatus mutation in a loop
        // instead of the generic updateItem which fails silently.
        const promises = ids.map(id => updateTaskStatusMutation({
            taskId: id,
            status,
            userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
        }));
        try {
            await Promise.all(promises);
            addToast(`Updated ${ids.length} tasks`, { type: 'success' });
        } catch (e: any) {
            console.error('[handleBulkUpdateTaskStatus] Some tasks failed:', e);
            addToast(`Some tasks may not have updated: ${e?.message || 'Unknown error'}`, { type: 'warning' });
        }
    }, [updateTaskStatusMutation, currentUser, addToast]);

    // FIX (Aug 2026): Use dedicated deleteTask mutation instead of
    // generic deleteItem. Same root cause as the drag-drop bug.
    const handleBulkDeleteTasks = useCallback(async (ids: string[]) => {
        const promises = ids.map(id => deleteTaskMutation({
            taskId: id,
            userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
        }));
        try {
            await Promise.all(promises);
            addToast(`Deleted ${ids.length} tasks`, { type: 'success' });
        } catch (e: any) {
            console.error('[handleBulkDeleteTasks] Some tasks failed to delete:', e);
            addToast(`Some tasks may not have deleted: ${e?.message || 'Unknown error'}`, { type: 'warning' });
        }
    }, [deleteTaskMutation, currentUser, addToast]);

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
        // CRITICAL: Strip undefined values — the Convex client throws
        // "undefined is not a valid Convex value" if any arg is undefined.
        const args: Record<string, any> = {
            title: t.title,
            description: t.description || '',
            status: t.status || 'todo',
            assignedUsers: t.assignedUsers || [],
            assigneeType: t.assigneeType || 'team',
            isSharedWithPortal: t.isSharedWithPortal || false,
            priority: t.priority || 'medium',
        };
        if (t.dueDate) args.dueDate = t.dueDate;
        if (t.matterId) args.matterId = t.matterId;
        if (currentUser?.id) args.creatorId = currentUser.id;
        if (currentUser?.name) args.creatorName = currentUser.name;
        if (currentUser?.email) args.userEmail = currentUser.email;

        // OFFLINE PATH — queue task creation.
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
            await createTaskMutation(args as any);
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
        // Expose the raw deleteTask mutation for callers that need to
        // delete a single task (e.g. TaskDetailModal's onDelete handler).
        deleteTask: deleteTaskMutation,
    };
};
