import React, { createContext, useContext } from 'react';
import { Task, CalendarEvent, WorkflowDefinition } from '../types';

export interface ExecutionState {
    tasks: Task[];
    events: CalendarEvent[];
    workflows: WorkflowDefinition[];
}

export interface ExecutionActions {
    handleAddTask: (taskData: any) => void;
    updateTask: (task: Partial<Task> & { id: string }) => Promise<void>;
    deleteTask: (id: string, name?: string) => Promise<void>;
    handleUpdateTaskStatus: (taskId: string, status: any) => void;
    handleUpdateWorkflow: (workflow: any) => void;
    handleAddWorkflow: (workflow: any) => Promise<any>;
    handleUpdateChecklistItem: (taskId: string, itemId: string, completed: boolean) => void;
    handleBulkArchiveTasks: (ids: string[]) => void;
    handleBulkUpdateTaskStatus: (ids: string[], status: any) => void;
    handleBulkDeleteTasks: (ids: string[]) => void;
    handleDeleteAllDoneTasks: () => void;
    handleArchiveAllDoneTasks: () => void;
}

import { useDataState, useDataActions } from './DataContext';

const ExecutionContext = createContext<{ executionState: ExecutionState; executionActions: ExecutionActions } | undefined>(undefined);

export const ExecutionProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const { appState } = useDataState();
    const actions = useDataActions();
    
    const executionState: ExecutionState = {
        tasks: appState.tasks,
        events: appState.events,
        workflows: appState.workflows
    };

    const executionActions: ExecutionActions = {
        handleAddTask: actions.handleAddTask,
        updateTask: (item) => actions.updateItem('tasks', item, 'Task'),
        deleteTask: (id, name) => actions.deleteItem('tasks', id, name || 'Task'),
        handleUpdateTaskStatus: (taskId, status) => actions.handleUpdateTaskStatus(taskId, status),
        handleUpdateWorkflow: actions.handleUpdateWorkflow,
        handleAddWorkflow: (item) => actions.addItem('workflows', item, 'Workflow'),
        handleUpdateChecklistItem: actions.handleUpdateChecklistItem,
        handleBulkArchiveTasks: actions.handleBulkArchiveTasks,
        handleBulkUpdateTaskStatus: actions.handleBulkUpdateTaskStatus,
        handleBulkDeleteTasks: actions.handleBulkDeleteTasks,
        handleDeleteAllDoneTasks: actions.handleDeleteAllDoneTasks,
        handleArchiveAllDoneTasks: actions.handleArchiveAllDoneTasks,
    };

    return (
        <ExecutionContext.Provider value={{ executionState, executionActions }}>
            {children}
        </ExecutionContext.Provider>
    );
};


export const useExecutionState = () => {
    const context = useContext(ExecutionContext);
    if (!context) throw new Error('useExecutionState must be used within ExecutionProvider');
    return context;
};
