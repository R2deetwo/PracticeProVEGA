
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Task, TaskStatus, User, Matter, TaskStatusValues, AppMode } from '../types';
import { getInitials, getUserColor, formatDueDate, getDueDateColor } from '../utils/colorUtils';
import { PriorityIcon, PlusIcon } from '../constants';
import Tooltip from './Tooltip';
import ScrollArrows from './ScrollArrows';
import { useHighlight } from '../hooks/useHighlight';
import PriorityPopover from './PriorityPopover';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';

// Note: @hello-pangea/dnd works natively with React 18 StrictMode.
// The old StrictModeDroppable workaround is no longer needed — we use
// Droppable directly now. This fixes the glitchy drag-and-drop behavior
// (stuck borders, jarring screen-edge hanging, lag between columns).

// Helper to get robust background color classes for date badges that work in dark mode
const getDateBadgeClass = (dueDateString: string | null): string => {
    if (!dueDateString) return 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400';
    const dueDate = new Date(dueDateString);
    if (isNaN(dueDate.getTime())) return 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400';
    const today = new Date();
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200';
    if (diffDays <= 3) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200';
    return 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400';
};

const TaskCard: React.FC<{ task: Task; index: number; users: User[]; matters: Matter[]; onViewDetails: (id: string, context: any) => void; onPriorityClick: (e: React.MouseEvent, task: Task) => void; onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void; appMode: AppMode; }> = React.memo(({ task, index, users, matters, onViewDetails, onPriorityClick, onUpdateTaskStatus, appMode }) => {
    // Re-filter users on every render to ensure new assignments show up instantly
    const assigned = users.filter(u => task.assignedUsers.includes(u.id));
    const matter = matters.find(m => m.id === task.matterId);

    const completedItems = task.checklist?.items.filter(i => i.completed).length || 0;
    const totalItems = task.checklist?.items.length || 0;
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const handleCardClick = (e: React.MouseEvent) => {
        if (e.defaultPrevented) return;
        e.stopPropagation();
        onViewDetails(task.id, {});
    };

    // Check if task is overdue (due date passed and not done)
    const isOverdue = task.dueDate && task.status !== 'done' && task.status !== 'pending_verification' &&
        new Date(task.dueDate).getTime() < Date.now();

    return (
        <Draggable draggableId={task.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={handleCardClick}
                    data-item-id={task.id}
                    data-context-type="task"
                    className={`
                        group bg-white dark:bg-zinc-800 p-3 rounded-lg mb-2 transition-all duration-200 cursor-grab relative select-none
                        ${isOverdue ? 'ring-1 ring-red-300 dark:ring-red-800 bg-red-50/30 dark:bg-red-900/10' : ''}
                        ${snapshot.isDragging ? 'shadow-2xl scale-105 ring-2 ring-primary-500 rotate-2 z-50' : 'shadow-sm border border-slate-200 dark:border-zinc-700 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600'}
                    `}
                    style={provided.draggableProps.style}
                >
                    <div className="flex justify-between items-start gap-2 mb-2">
                        <p className="font-bold text-xs sm:text-sm text-slate-800 dark:text-zinc-100 flex-grow leading-tight line-clamp-2">{task.title}</p>
                        <div className="flex-shrink-0 relative top-0 right-0">
                            <Tooltip text={`Priority: ${task.priority || 'Medium'}`}>
                                <button onClick={(e) => { e.stopPropagation(); onPriorityClick(e, task); }} className="p-0.5 rounded-full bg-slate-50 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-100 dark:border-zinc-600">
                                    <PriorityIcon priority={task.priority} />
                                </button>
                            </Tooltip>
                        </div>
                    </div>

                    {matter && (
                        <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-bold uppercase tracking-wide bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 max-w-full truncate">
                                {matter.title}
                            </span>
                        </div>
                    )}

                    {/* ASSIGNEE TYPE BADGE — color-coded: indigo=team, violet=client, amber=resident */}
                    {(task as any).assigneeType && (task as any).assigneeType !== 'team' && (
                        <div className="mb-2">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-bold uppercase tracking-wide ${
                                (task as any).assigneeType === 'client'
                                    ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            }`}>
                                {(task as any).assigneeType === 'client' ? 'Client Task' : 'Resident Task'}
                            </span>
                        </div>
                    )}
                    {(task as any).assigneeType === 'team' || !(task as any).assigneeType ? (
                        <div className="mb-2">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                Internal
                            </span>
                        </div>
                    ) : null}

                    {totalItems > 0 && (
                        <div className="mb-2 flex items-center gap-1.5">
                            <div className="flex-grow h-1 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                            </div>
                            <span className="text-3xs text-slate-400 font-medium">{completedItems}/{totalItems}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-slate-50 dark:border-zinc-700/50">
                        <div className="flex items-center -space-x-1.5 pl-1 relative z-10">
                            {appMode === 'multi' && assigned.length > 0 ? assigned.slice(0, 3).map(user => (
                                <Tooltip key={user.id} text={user.name || 'User'}>
                                    <div className={`h-5 w-5 rounded-full ring-1 ring-white dark:ring-zinc-800 flex items-center justify-center text-white font-bold text-3xs ${getUserColor(user.name)}`}>
                                        {getInitials(user.name)}
                                    </div>
                                </Tooltip>
                            )) : (
                                <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-zinc-700 flex items-center justify-center text-slate-400">
                                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                                </div>
                            )}
                            {assigned.length > 3 && (
                                <span className="ml-1 text-3xs font-bold text-slate-400">+{assigned.length - 3}</span>
                            )}
                        </div>

                        {task.dueDate && (
                            <span className={`text-3xs font-bold px-1.5 py-0.5 rounded ${getDateBadgeClass(task.dueDate)}`}>
                                {formatDueDate(task.dueDate)}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </Draggable>
    );
});

const TaskColumn: React.FC<{
    status: TaskStatus;
    tasks: Task[];
    users: User[];
    matters: Matter[];
    onViewDetails: (id: string, context: any) => void;
    onPriorityClick: (e: React.MouseEvent, task: Task) => void;
    onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
    openModal: (modalType: 'newTask', id?: string, context?: any) => void;
    appMode: AppMode;
    isPulsing?: boolean;
}> = ({ status, tasks, users, matters, onViewDetails, onPriorityClick, onUpdateTaskStatus, openModal, appMode, isPulsing }) => {
    const title = status === 'pending_verification' ? 'Pending Review' : status.replace('_', ' ');

    return (
        <div className={`flex flex-col w-[85vw] sm:w-72 flex-shrink-0 h-full rounded-xl bg-slate-100/50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 snap-center transition-all duration-500 ${isPulsing ? 'ring-2 ring-primary-400 ring-offset-2 ring-offset-transparent scale-[1.02] shadow-lg' : ''}`}>
            {/* Column Header */}
            <div className="flex items-center justify-between p-2 border-b border-slate-200 dark:border-zinc-700/50">
                <h4 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${status === 'todo' ? 'bg-slate-400' : status === 'in_progress' ? 'bg-blue-500' : status === 'pending_verification' ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                    {title}
                    <span className="bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 px-1.5 py-0.5 rounded text-2xs">{tasks.length}</span>
                </h4>
                <button onClick={() => openModal('newTask', undefined, { status })} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-500">
                    <PlusIcon className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Column Body */}
            <div className="flex-grow flex flex-col min-h-0">
                <Droppable droppableId={status}>
                    {(provided: any, snapshot: any) => (
                        <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`
                                flex-grow overflow-y-auto px-1.5 pt-2 pb-10 custom-scrollbar transition-colors
                                ${snapshot.isDraggingOver ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}
                            `}
                        >
                            {tasks.map((task, index) => (
                                <TaskCard key={task.id} task={task} index={index} users={users} matters={matters} onViewDetails={onViewDetails} onPriorityClick={onPriorityClick} onUpdateTaskStatus={onUpdateTaskStatus} appMode={appMode} />
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </div>
        </div>
    );
};

interface TaskBoardProps {
    tasks: Task[];
    users: User[];
    matters: Matter[];
    onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
    onUpdateChecklist: (taskId: string, itemId: string, completed: boolean) => void;
    onViewDetails: (id: string, context: any) => void;
    openModal: (modalType: 'newTask', id?: string, context?: any) => void;
    highlighted: boolean;
    highlightFilter: any;
    highlightColor?: 'red' | 'orange' | 'blue' | 'shimmer';
    appMode: AppMode;
}

const TaskBoard: React.FC<TaskBoardProps> = ({ tasks, users, matters, onUpdateTaskStatus, onViewDetails, appMode, openModal }) => {
    const { handleUpdateTaskPriority } = useDataActions();
    const containerRef = useRef<HTMLDivElement>(null);
    useHighlight(containerRef, 'tasks');
    const [popoverState, setPopoverState] = useState<{ task: Task | null; anchorEl: HTMLElement | null }>({ task: null, anchorEl: null });

    const handlePriorityClick = (e: React.MouseEvent, task: Task) => {
        e.stopPropagation();
        setPopoverState({ task, anchorEl: e.currentTarget as HTMLElement });
    };

    const onDragStart = () => {
        document.body.classList.add('dragging-active');
    };

    // Track which column received a drop for pulse animation
    const [pulsingColumn, setPulsingColumn] = useState<string | null>(null);

    const onDragEnd = (result: DropResult) => {
        document.body.classList.remove('dragging-active');
        const { source, destination, draggableId } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        // Trigger pulse animation on the destination column
        setPulsingColumn(destination.droppableId);
        setTimeout(() => setPulsingColumn(null), 600);

        // Update task status (async — the UI already moved the card via DnD)
        onUpdateTaskStatus(draggableId, destination.droppableId as TaskStatus);
    };

    const tasksByStatus: Record<string, Task[]> = (() => {
        // ─── Deduplicate tasks by _id (and fall back to id) ───────────────
        // In rare cases (legacy data, race conditions between optimistic
        // updates and Convex reactive pushes), the same task can appear
        // twice in the `tasks` array — once with the original UUID `id`
        // and once with the Convex `_id` as `id`. Without dedup, BOTH
        // cards render in the same column, and dragging one leaves the
        // other behind — making the task look like it "disappeared" or
        // "jumped back". This pass keeps only the first occurrence of
        // each task (preferring the version that has `_id` set, since
        // that's the backend-confirmed copy).
        const seen = new Set<string>();
        const deduped: Task[] = [];
        // Sort so that items with _id come first (backend-confirmed copies win)
        const sorted = [...tasks].sort((a, b) => {
            if (a._id && !b._id) return -1;
            if (!a._id && b._id) return 1;
            return 0;
        });
        for (const t of sorted) {
            const key = String(t._id || t.id);
            if (seen.has(key)) continue;
            seen.add(key);
            // Also track the id field in case another copy uses id instead of _id
            if (t.id) seen.add(String(t.id));
            deduped.push(t);
        }

        // Normalize: any task with a non-standard status (e.g. 'Pending' from
        // checklist-applied tasks, undefined, or legacy values) is shown in
        // the 'todo' column so it never disappears.
        return {
            todo: deduped.filter(t => !t.status || t.status === 'todo' || (t.status !== 'in_progress' && t.status !== 'done' && t.status !== 'pending_verification')),
            in_progress: deduped.filter(t => t.status === 'in_progress'),
            pending_verification: deduped.filter(t => t.status === 'pending_verification'),
            done: deduped.filter(t => t.status === 'done'),
        };
    })();

    return (
        <div ref={containerRef} className="flex flex-col h-full w-full">
            <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
                <div className="flex gap-4 pb-4 h-full overflow-x-auto snap-x snap-mandatory px-4 sm:px-0">
                    {TaskStatusValues.map(status => (
                        <TaskColumn
                            key={status}
                            status={status}
                            tasks={tasksByStatus[status]}
                            users={users}
                            matters={matters}
                            onViewDetails={onViewDetails}
                            onPriorityClick={handlePriorityClick}
                            onUpdateTaskStatus={onUpdateTaskStatus}
                            openModal={openModal}
                            appMode={appMode}
                            isPulsing={pulsingColumn === status}
                        />
                    ))}
                    {/* Spacer for horizontal scroll on mobile */}
                    <div className="w-4 shrink-0 sm:hidden"></div>
                </div>
            </DragDropContext>
            {popoverState.task && (
                <PriorityPopover
                    task={popoverState.task}
                    anchorEl={popoverState.anchorEl}
                    onUpdate={handleUpdateTaskPriority}
                    onClose={() => setPopoverState({ task: null, anchorEl: null })}
                />
            )}
        </div>
    );
};

export default TaskBoard;
