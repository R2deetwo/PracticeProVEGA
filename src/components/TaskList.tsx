
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Task, User, Matter, TaskStatus, AppMode, TaskStatusValues } from '../types';
import { getInitials, getUserColor, getDueDateColor, formatDueDate } from '../utils/colorUtils';
import { PriorityIcon, ChevronDownIcon } from '../constants';
import Tooltip from './Tooltip';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import EmptyState from './EmptyState';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useUI } from '../contexts/UIContext';
import PriorityPopover from './PriorityPopover';

type SortableKey = 'title' | 'matter' | 'dueDate' | 'priority' | 'status';
type SortDirection = 'asc' | 'desc';

const PlayIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>;
const CheckIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
const EmptyTaskIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;

const getPriorityValue = (priority?: 'High' | 'Medium' | 'Low'): number => {
    switch (priority) {
        case 'High': return 3;
        case 'Medium': return 2;
        case 'Low': return 1;
        default: return 0;
    }
};

const getPriorityColorClass = (priority?: 'High' | 'Medium' | 'Low'): string => {
    switch (priority) {
        case 'High': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        case 'Medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
        case 'Low': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        default: return 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400';
    }
};


const TaskRow: React.FC<{
    task: Task;
    users: User[];
    matter?: Matter;
    onViewDetails: (id: string, context: any) => void;
    onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
    isSelected: boolean;
    isKeyboardSelected: boolean;
    onToggleSelection: (id: string) => void;
    onPriorityClick: (e: React.MouseEvent, task: Task) => void;
    appMode: AppMode;
    index: number;
}> = ({ task, users, matter, onViewDetails, onUpdateTaskStatus, isSelected, isKeyboardSelected, onToggleSelection, onPriorityClick, appMode, index }) => {
    // Logic to find ALL assigned users
    const assignedUsers = (task.assignedUsers || []).map(id => users.find(u => u.id === id)).filter(Boolean) as User[];

    // Status Dropdown State for this specific row
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const statusRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
                setIsStatusOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isStatusOpen]);


    return (
        <tr
            id={`list-item-${index}`}
            data-context-type="task"
            data-item-id={task.id}
            className={`
                relative overflow-visible transition-colors border-b border-gray-100 dark:border-zinc-800 last:border-0
                ${isKeyboardSelected ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-inset ring-primary-300 dark:ring-primary-700 z-10' : (isSelected ? 'bg-blue-50 dark:bg-zinc-800' : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50')}
            `}
        >
            <td className="px-6 py-4 whitespace-nowrap w-10">
                <div className="flex items-center justify-center">
                    <input autoComplete="off" data-lpignore="true" 
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => { e.stopPropagation(); onToggleSelection(task.id); }}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                </div>
            </td>
            <td className="px-6 py-4 cursor-pointer group" onClick={() => onViewDetails(task.id, {})}>
                <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">{task.title}</div>
                {task.description && <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[300px] mt-0.5">{task.description}</div>}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 cursor-pointer" onClick={() => onViewDetails(task.id, {})}>
                {matter ? (
                    <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-700 rounded text-xs font-medium truncate max-w-[150px] inline-block" title={matter.title}>
                        {matter.title}
                    </span>
                ) : <span className="text-gray-400 italic text-xs">No matter</span>}
            </td>
            {appMode === 'multi' && (
                <td className="px-6 py-4 whitespace-nowrap">
                    {assignedUsers.length > 0 ? (
                        <div className="flex justify-center items-center w-full -space-x-2">
                            {assignedUsers.map(user => (
                                <Tooltip key={user.id} text={user.name}>
                                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-white font-bold text-3xs ring-2 ring-white dark:ring-zinc-800 ${getUserColor(user.name)}`}>
                                        {getInitials(user.name)}
                                    </div>
                                </Tooltip>
                            ))}
                        </div>
                    ) : <div className="flex justify-center items-center w-full"><span className="text-xs text-gray-400">—</span></div>}
                </td>
            )}
            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold cursor-pointer" onClick={() => onViewDetails(task.id, {})}>
                <span className={`${task.status === 'done' ? 'text-slate-400 dark:text-zinc-500' : getDueDateColor(task.dueDate || null)} text-xs`}>
                    {task.status === 'done' ? 'Completed' : (task.dueDate ? formatDueDate(task.dueDate) : '—')}
                </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap overflow-visible">
                {/* Priority Pill - Styled like Status */}
                <button
                    onClick={(e) => { e.stopPropagation(); onPriorityClick(e, task); }}
                    className={`px-2.5 py-1 inline-flex items-center gap-1 text-2xs font-bold uppercase tracking-wide rounded-full cursor-pointer hover:opacity-80 transition-opacity ${getPriorityColorClass(task.priority)}`}
                >
                    {task.priority || 'Medium'}
                    <ChevronDownIcon className="w-3 h-3" />
                </button>
            </td>

            {/* Status with Inline Dropdown */}
            <td className="px-6 py-4 whitespace-nowrap overflow-visible">
                <div className="relative" ref={statusRef}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsStatusOpen(!isStatusOpen); }}
                        className={`px-2.5 py-1 inline-flex items-center gap-1 text-2xs font-bold uppercase tracking-wide rounded-full cursor-pointer hover:opacity-80 transition-opacity
                        ${task.status === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                    'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'}`}
                    >
                        {task.status.replace('_', ' ')}
                        <ChevronDownIcon className="w-3 h-3" />
                    </button>

                    {isStatusOpen && (
                        <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-slate-200 dark:border-zinc-700 z-[50] py-1 animate-fade-in-up">
                            {TaskStatusValues.map(status => (
                                <button
                                    key={status}
                                    onClick={(e) => { e.stopPropagation(); onUpdateTaskStatus(task.id, status); setIsStatusOpen(false); }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 capitalize flex items-center justify-between"
                                >
                                    {status.replace('_', ' ')}
                                    {task.status === status && <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </td>

            {/* DELIVERY column — shows WhatsApp/Email dispatch status.
                CRO AUDIT FIX — new column per user request.
                🟢 Delivered = WhatsApp/Email sent
                🟡 Pending = In-App only / queued
                🔴 Failed = dispatch failed */}
            <td className="px-6 py-4 whitespace-nowrap text-center">
                {(() => {
                    const deliveryStatus = (task as any).deliveryStatus || (task as any).notificationStatus || 'in_app';
                    if (deliveryStatus === 'delivered' || deliveryStatus === 'sent') {
                        return (
                            <Tooltip text="WhatsApp/Email sent successfully">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    Sent
                                </span>
                            </Tooltip>
                        );
                    }
                    if (deliveryStatus === 'failed') {
                        return (
                            <Tooltip text="Delivery failed — click to retry">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Failed
                                </span>
                            </Tooltip>
                        );
                    }
                    return (
                        <Tooltip text="In-app notification only">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                In-App
                            </span>
                        </Tooltip>
                    );
                })()}
            </td>

            <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {task.status === 'todo' && (
                        <Tooltip text="Start Task">
                            <button onClick={(e) => { e.stopPropagation(); onUpdateTaskStatus(task.id, TaskStatus.InProgress); }} className="p-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-colors">
                                <PlayIcon className="w-4 h-4" />
                            </button>
                        </Tooltip>
                    )}
                    {(task.status === 'todo' || task.status === 'in_progress') && (
                        <Tooltip text="Mark as Done">
                            <button onClick={(e) => { e.stopPropagation(); onUpdateTaskStatus(task.id, TaskStatus.Done); }} className="p-1.5 rounded-md bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 transition-colors">
                                <CheckIcon className="w-4 h-4" />
                            </button>
                        </Tooltip>
                    )}
                </div>
            </td>
        </tr>
    );
};

interface TaskListProps {
    tasks: Task[];
    users: User[];
    matters: Matter[];
    onViewDetails: (id: string, context: any) => void;
    onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
    selectedTasks: Set<string>;
    onToggleSelection: (taskId: string) => void;
    appMode: AppMode;
    onCreateTask?: () => void;
    filterText?: string;
    groupBy?: 'none' | 'matter' | 'priority';
}

const TaskList: React.FC<TaskListProps> = ({ tasks, users, matters, onViewDetails, onUpdateTaskStatus, selectedTasks, onToggleSelection, appMode, onCreateTask, filterText, groupBy = 'none' }) => {
    const { handleUpdateTaskPriority } = useDataActions();
    const { openModal: openUIModal } = useUI();
    const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: SortDirection } | null>({ key: 'dueDate', direction: 'asc' });
    const [popoverState, setPopoverState] = useState<{ task: Task | null; anchorEl: HTMLElement | null }>({ task: null, anchorEl: null });
    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

    const handlePriorityClick = (e: React.MouseEvent, task: Task) => {
        e.stopPropagation();
        setPopoverState({ task, anchorEl: e.currentTarget as HTMLElement });
    };

    const sortedTasks = useMemo(() => {
        let sorted = [...tasks];
        if (sortConfig !== null) {
            sorted.sort((a, b) => {
                let aValue: any, bValue: any;
                switch (sortConfig.key) {
                    case 'title':
                        aValue = a.title.toLowerCase();
                        bValue = b.title.toLowerCase();
                        break;
                    case 'matter':
                        aValue = matters.find(m => m.id === a.matterId)?.title || '';
                        bValue = matters.find(m => m.id === b.matterId)?.title || '';
                        break;
                    case 'dueDate':
                        aValue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                        bValue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                        break;
                    case 'priority':
                        aValue = getPriorityValue(a.priority);
                        bValue = getPriorityValue(b.priority);
                        break;
                    case 'status':
                        aValue = a.status;
                        bValue = b.status;
                        break;
                    default:
                        return 0;
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sorted;
    }, [tasks, matters, sortConfig]);

    const taskGroups = useMemo(() => {
        if (groupBy === 'none') return [{ title: null, tasks: sortedTasks }];

        const groups: Record<string, Task[]> = {};
        sortedTasks.forEach(task => {
            let groupTitle = 'Uncategorized';
            if (groupBy === 'matter') {
                groupTitle = matters.find(m => m.id === task.matterId)?.title || 'No Matter';
            } else if (groupBy === 'priority') {
                groupTitle = task.priority || 'Medium';
            }
            if (!groups[groupTitle]) groups[groupTitle] = [];
            groups[groupTitle].push(task);
        });

        // Sort keys for priority to ensure High -> Medium -> Low
        const keys = Object.keys(groups);
        if (groupBy === 'priority') {
            keys.sort((a, b) => getPriorityValue(b as any) - getPriorityValue(a as any));
        } else {
            keys.sort();
        }

        return keys.map(key => ({ title: key, tasks: groups[key] }));
    }, [sortedTasks, groupBy, matters]);

    const requestSort = (key: SortableKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    useEffect(() => {
        if (selectAllCheckboxRef.current) {
            selectAllCheckboxRef.current.indeterminate = selectedTasks.size > 0 && selectedTasks.size < sortedTasks.length;
        }
    }, [selectedTasks, sortedTasks.length]);

    // Keyboard Navigation
    const { selectedIndex } = useKeyboardNavigation({
        itemCount: sortedTasks.length,
        onEnter: (index) => onViewDetails(sortedTasks[index].id, {}),
        onSpace: (index) => {
            openUIModal('quickLook', null, { item: sortedTasks[index], type: 'Task' });
        }
    });

    return (
        <div className="flex-grow flex flex-col min-h-0 shadow-sm sm:rounded-xl border-t sm:border border-slate-200 dark:border-zinc-700 overflow-hidden bg-slate-50 sm:bg-white dark:bg-zinc-900 sm:dark:bg-zinc-800">
            {sortedTasks.length > 0 ? (
                <div className="flex-grow overflow-auto custom-scrollbar">
                    <table className="min-w-[600px] w-full divide-y divide-slate-200 dark:divide-zinc-700">
                        <thead className="bg-slate-50 dark:bg-zinc-800 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left w-10">
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="checkbox"
                                        ref={selectAllCheckboxRef}
                                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                        onChange={(e) => onToggleSelection(e.target.checked ? `__ALL_SELECT__:${sortedTasks.map(t => t.id).join(',')}` : '__ALL_CLEAR__')}
                                        checked={sortedTasks.length > 0 && selectedTasks.size === sortedTasks.length}
                                    />
                                </th>
                                <th scope="col" onClick={() => requestSort('title')} className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-zinc-400 upper tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-zinc-300">Task</th>
                                <th scope="col" onClick={() => requestSort('matter')} className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-zinc-300">Matter</th>
                                {appMode === 'multi' && <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Assigned</th>}
                                <th scope="col" onClick={() => requestSort('dueDate')} className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-zinc-300">Due Date</th>
                                <th scope="col" onClick={() => requestSort('priority')} className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-zinc-300">Priority</th>
                                <th scope="col" onClick={() => requestSort('status')} className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-zinc-300">Status</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Delivery</th>
                                <th scope="col" className="relative px-6 py-3">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-zinc-800 divide-y divide-slate-100 dark:divide-zinc-700/50">
                            {taskGroups.map((group, gIdx) => (
                                <React.Fragment key={group.title || 'none'}>
                                    {group.title && (
                                        <tr className="bg-slate-50/50 dark:bg-zinc-900/30">
                                            <td colSpan={appMode === 'multi' ? 8 : 7} className="px-6 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-4 w-1 bg-primary-500 rounded-full" />
                                                    <span className="text-2xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">
                                                        {groupBy === 'matter' ? 'Matter: ' : 'Priority: '}
                                                        <span className="text-slate-900 dark:text-white">{group.title}</span>
                                                    </span>
                                                    <span className="text-3xs font-bold text-slate-400 ml-2">({group.tasks.length} items)</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {group.tasks.map((task, index) => {
                                        // Absolute index for keyboard navigation if needed, though simpler for now to use local
                                        return (
                                            <TaskRow
                                                key={task.id}
                                                task={task}
                                                users={users}
                                                matter={matters.find(m => m.id === task.matterId)}
                                                onViewDetails={onViewDetails}
                                                onUpdateTaskStatus={onUpdateTaskStatus}
                                                isSelected={selectedTasks.has(task.id)}
                                                isKeyboardSelected={false} // Complex with grouping, skip for now
                                                onToggleSelection={onToggleSelection}
                                                onPriorityClick={handlePriorityClick}
                                                appMode={appMode}
                                                index={index}
                                            />
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center h-full">
                    <EmptyState
                        title={filterText ? "No Matches" : "All Caught Up!"}
                        description={filterText ? `No tasks match "${filterText}".` : "You have no tasks on your list. Enjoy the peace or create a new task."}
                        icon={<EmptyTaskIcon className="text-slate-300 dark:text-zinc-600" />}
                        actionLabel="Create Task"
                        onAction={onCreateTask}
                    />
                </div>
            )}
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

export default TaskList;
