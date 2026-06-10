
import { useCallback } from 'react';
import { TaskStatus, AppState } from '../types';
import { useUI } from '../contexts/UIContext';

/**
 * Hook for managing tasks and checklists.
 */
export const useTasks = (appState: AppState, actions: any) => {
    const { addToast } = useUI();

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

    const handleDeleteAllDoneTasks = useCallback(async () => {
        const doneTasks = appState.tasks.filter(t => t.status === TaskStatus.Done);
        await handleBulkDeleteTasks(doneTasks.map(t => t.id));
    }, [appState.tasks, handleBulkDeleteTasks]);

    const handleApplyStageChecklist = useCallback(async (matterId: string, stage: string, templateId: string, shareWithClient: boolean) => {
        const template = appState.checklistTemplates.find(t => t.id === templateId);
        if (!template) return;
        const promises = template.items.map((item: any) => actions.addItem('tasks', {
            title: item.text, status: 'Pending', matterId, stage, 
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            isSharedWithClient: shareWithClient, createdAt: new Date().toISOString()
        }, 'Task'));
        await Promise.all(promises);
        addToast(`Applied checklist to ${stage}`, { type: 'success' });
    }, [appState.checklistTemplates, actions, addToast]);

    return {
        handleUpdateTaskStatus,
        handleUpdateTaskPriority,
        handleBulkUpdateTaskStatus,
        handleBulkDeleteTasks,
        handleDeleteAllDoneTasks,
        handleAddTask: (t: any) => actions.addItem('tasks', t, 'Task'),
        handleApplyStageChecklist,
    };
};

