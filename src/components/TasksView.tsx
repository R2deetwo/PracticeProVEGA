
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Task, User, Matter, WorkflowDefinition, AppMode, View, TaskStatus, ModalType } from '../types';
import TaskBoard from './TaskBoard';
import TaskList from './TaskList';
import ViewToggle from './ViewToggle';
import BulkActionBar from './BulkActionBar';
import UserTaskSummaryPanel from './UserTaskSummaryPanel';
import { useUI } from '../contexts/UIContext';
import { useCoreState } from '../contexts/CoreContext';
import { useMatterState } from '../contexts/MatterContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useAuth } from '../contexts/AuthContext';
import { useProduct } from '../contexts/ProductContext';
import { SearchIcon, PlusIcon, TrashIcon } from '../constants';

export const TasksView: React.FC = () => {
    // Domain Hooks
    const { coreState, coreActions } = useCoreState();
    const { matterState } = useMatterState();
    const { executionState, executionActions } = useExecutionState();
    const { currentUser } = useAuth();
    const { openModal, closeModal, navigateTo, currentHistoryEntry, updateCurrentHistoryEntry, highlightTarget } = useUI();
    const { appMode } = useAuth();
    const { isProperty } = useProduct();

    // Data Mapping
    const allTasks = executionState.tasks;
    const users = coreState.users;
    const matters = matterState.matters;

    // Actions
    const onUpdateTaskStatus = executionActions.handleUpdateTaskStatus;
    const onUpdateChecklist = executionActions.handleUpdateChecklistItem;
    const onBulkArchiveTasks = executionActions.handleBulkArchiveTasks;
    const onBulkUpdateTaskStatus = executionActions.handleBulkUpdateTaskStatus;
    const onBulkDeleteTasks = executionActions.handleBulkDeleteTasks;

    const onClearDoneTasks = useCallback(() => {
        openModal('deleteConfirmation', null, {
            title: 'Archive or Delete Done Tasks?',
            message: <p>You can either archive all completed tasks or permanently delete them.</p>,
            onConfirm: () => { executionActions.handleDeleteAllDoneTasks(); closeModal(); },
            onConfirmArchive: () => { executionActions.handleArchiveAllDoneTasks(); closeModal(); }
        });
    }, [openModal, executionActions, closeModal]);

    const onUpdateUser = useCallback((data: Partial<User>) => {
        if (!currentUser) return;
        coreActions.handleUpdateUser(currentUser.id, data);
    }, [coreActions, currentUser]);

    // Local state for immediate switching
    const initialViewMode = currentUser?.defaultViewModes?.tasks || 'board';
    const [localViewMode, setLocalViewMode] = useState<'list' | 'board'>(initialViewMode);

    const handleViewChange = (mode: 'list' | 'board') => {
        setLocalViewMode(mode);
        onUpdateUser({ defaultViewModes: { ...currentUser?.defaultViewModes, tasks: mode } });
    };

    const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);
    const [localFilterText, setLocalFilterText] = useState('');


    const activeUserFilter = useMemo(() => {
        if (currentHistoryEntry.taskUserFilter) {
            return currentHistoryEntry.taskUserFilter;
        }
        return (currentUser?.role || 'User') === 'Admin' ? '__all__' : '__currentUser__';
    }, [currentHistoryEntry.taskUserFilter, currentUser?.role]);

    const isLocked = localViewMode === currentUser?.defaultViewModes?.tasks;

    const handleFilterChange = useCallback((newFilter: string) => {
        updateCurrentHistoryEntry({ taskUserFilter: newFilter });
    }, [updateCurrentHistoryEntry]);

    const filteredTasks = useMemo(() => {
        let tasks = allTasks;
        if (activeUserFilter === '__currentUser__') {
            tasks = tasks.filter(task => task.assignedUsers.includes(currentUser?.id || ''));
        } else if (activeUserFilter !== '__all__') {
            tasks = tasks.filter(task => task.assignedUsers.includes(activeUserFilter));
        }
        if (localFilterText.trim()) {
            const lowerText = localFilterText.toLowerCase();
            tasks = tasks.filter(t => t.title.toLowerCase().includes(lowerText));
        }
        return tasks;
    }, [allTasks, activeUserFilter, currentUser?.id, localFilterText]);

    const handleToggleSelection = (taskId: string) => {
        setSelectedTasks(prev => {
            const newSet = new Set(prev);
            if (taskId === '__ALL_CLEAR__') {
                newSet.clear();
            } else if (taskId.startsWith('__ALL_SELECT__:')) {
                const ids = taskId.split(':')[1].split(',');
                ids.forEach(id => newSet.add(id));
            } else {
                if (newSet.has(taskId)) {
                    newSet.delete(taskId);
                } else {
                    newSet.add(taskId);
                }
            }
            return newSet;
        });
    };

    const handleBulkArchive = () => {
        onBulkArchiveTasks(Array.from(selectedTasks));
        setSelectedTasks(new Set());
    };

    const handleBulkDelete = () => {
        openModal('deleteConfirmation', null, {
            title: `Delete ${selectedTasks.size} Tasks?`,
            message: "Are you sure you want to permanently delete these tasks? This action cannot be undone.",
            onConfirm: () => {
                onBulkDeleteTasks(Array.from(selectedTasks));
                setSelectedTasks(new Set());
                closeModal();
            },
            confirmText: 'Delete',
            confirmButtonClass: 'bg-red-600 hover:bg-red-700'
        });
    };

    const handleBulkStatusUpdate = (status: TaskStatus) => {
        onBulkUpdateTaskStatus(Array.from(selectedTasks), status);
        setSelectedTasks(new Set());
    };

    const handleViewDetails = useCallback((id: string, context?: any) => {
        navigateTo('tasks', id, { ...context, openedFrom: 'tasks' });
    }, [navigateTo]);

    // Check if there are any completed tasks to clear
    const hasCompletedTasks = useMemo(() => allTasks.some(t => t.status === TaskStatus.Done), [allTasks]);


    const [groupBy, setGroupBy] = useState<'none' | 'matter' | 'priority'>('none');

    return (
        <div ref={containerRef} className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-zinc-900">
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-grow">
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Tasks</h2>

                    <div className="relative flex-grow max-w-sm hidden sm:block">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input autoComplete="off" data-lpignore="true" 
                            type="text"
                            placeholder="Filter tasks..."
                            value={localFilterText}
                            onChange={(e) => setLocalFilterText(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-100/50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 transition-shadow"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    {/* Inline Filter for Mobile */}
                    <div className="relative flex-grow sm:hidden">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input autoComplete="off" data-lpignore="true" 
                            type="text"
                            placeholder="Filter..."
                            value={localFilterText}
                            onChange={(e) => setLocalFilterText(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-100/50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 transition-shadow"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Grouping Toggle (List only) */}
                        {localViewMode === 'list' && (
                            <div className="flex items-center bg-slate-200/50 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700 mr-2">
                                <button
                                    onClick={() => setGroupBy('none')}
                                    className={`px-2 py-1 text-3xs font-black uppercase tracking-tighter rounded-lg transition-all ${groupBy === 'none' ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    None
                                </button>
                                <button
                                    onClick={() => setGroupBy('priority')}
                                    className={`px-2 py-1 text-3xs font-black uppercase tracking-tighter rounded-lg transition-all ${groupBy === 'priority' ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Priority
                                </button>
                                <button
                                    onClick={() => setGroupBy('matter')}
                                    className={`px-2 py-1 text-3xs font-black uppercase tracking-tighter rounded-lg transition-all ${groupBy === 'matter' ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {isProperty ? 'Property' : 'Matter'}
                                </button>
                            </div>
                        )}

                        {hasCompletedTasks && (
                            <button
                                onClick={onClearDoneTasks}
                                className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Clear Completed Tasks"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                        <ViewToggle
                            viewMode={localViewMode}
                            onViewModeChange={handleViewChange}
                            isLocked={isLocked}
                            onLock={() => onUpdateUser({ defaultViewModes: { ...(currentUser?.defaultViewModes || {}), tasks: localViewMode } })}
                        />
                        <button
                            onClick={() => openModal('newTask')}
                            className="flex-shrink-0 px-4 py-1.5 bg-primary-600 text-white rounded-lg font-semibold text-sm hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span>New</span>
                        </button>
                    </div>
                </div>
            </div>

            {appMode === 'multi' && (
                <div className="flex-shrink-0 px-4 sm:px-6 pt-4">
                    <UserTaskSummaryPanel
                        allTasks={allTasks}
                        users={users}
                        currentUser={currentUser as User}
                        activeFilter={activeUserFilter}
                        onFilterChange={handleFilterChange}
                    />
                </div>
            )}

            <div className="px-2 pb-2 sm:px-6 sm:pb-6 sm:pt-0 flex flex-col flex-grow min-h-0 overflow-hidden">
                {localViewMode === 'board' ? (
                    <div className="flex-grow overflow-x-auto overflow-y-hidden min-h-0">
                        <TaskBoard
                            tasks={filteredTasks}
                            users={users}
                            matters={matters}
                            onUpdateTaskStatus={onUpdateTaskStatus}
                            onUpdateChecklist={onUpdateChecklist}
                            onViewDetails={handleViewDetails}
                            openModal={openModal}
                            highlighted={!!(highlightTarget?.view === 'tasks' && highlightTarget.filter?.id)}
                            highlightFilter={highlightTarget?.filter}
                            highlightColor={highlightTarget?.color}
                            appMode={appMode}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col flex-grow min-h-0">
                        {/* Added flex-col to allow EmptyState to center vertically if needed */}
                        <TaskList
                            tasks={filteredTasks}
                            users={users}
                            matters={matters}
                            onViewDetails={handleViewDetails}
                            onUpdateTaskStatus={onUpdateTaskStatus}
                            selectedTasks={selectedTasks}
                            onToggleSelection={handleToggleSelection}
                            appMode={appMode}
                            onCreateTask={() => openModal('newTask')}
                            filterText={localFilterText}
                            groupBy={groupBy}
                        />
                    </div>
                )}
            </div>

            {selectedTasks.size > 0 && localViewMode === 'list' && (
                <BulkActionBar
                    selectedCount={selectedTasks.size}
                    onBulkArchive={handleBulkArchive}
                    onBulkDelete={handleBulkDelete}
                    onBulkUpdateStatus={handleBulkStatusUpdate}
                    onClearSelection={() => setSelectedTasks(new Set())}
                />
            )}
        </div>
    );
};
