
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Task, User, Matter, TaskStatus, AppMode, TaskStatusValues } from '../types';
import { getInitials, getUserColor, getDueDateColor, formatDueDate } from '../utils/colorUtils';
import { ChevronDownIcon } from '../constants';
import Tooltip from './Tooltip';
import { useDataActions } from '../contexts/DataContext';
import EmptyState from './EmptyState';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import PriorityPopover from './PriorityPopover';

type SortableKey = 'title' | 'matter' | 'dueDate' | 'priority' | 'status';
type SortDirection = 'asc' | 'desc';

const PlayIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>;
const CheckIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
const EmptyTaskIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
const PencilIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.038-2.038A4.5 4.5 0 0114.5 9.5H3v3h3.5a8.96 8.96 0 003.536-2.038L18 7m-2.768-2.768a2.5 2.5 0 11-3.536 3.536L6.5 14.5 5 19l4.5-1.5 4.232-4.232z" /></svg>;
const TrashIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

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

// Friendly display labels for status values — used for section headers and pills.
const STATUS_LABELS: Record<TaskStatus, string> = {
    [TaskStatus.Todo]: 'To Do',
    [TaskStatus.InProgress]: 'In Progress',
    [TaskStatus.PendingVerification]: 'Pending Verification',
    [TaskStatus.Done]: 'Done',
};

// Canonical ordering for status-grouped sections (matches Kanban column order).
const STATUS_ORDER: TaskStatus[] = [
    TaskStatus.Todo,
    TaskStatus.InProgress,
    TaskStatus.PendingVerification,
    TaskStatus.Done,
];

// Width of the revealed action strip (edit + delete) when a card is swiped left.
// Two 64px buttons = 128px reveal.
const ACTION_REVEAL_WIDTH = 128;

// ─── Desktop table row ─────────────────────────────────────────────────────
// Original implementation preserved. Used for sm: and up viewports.
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
    flatIndex: number;
}> = ({ task, users, matter, onViewDetails, onUpdateTaskStatus, isSelected, isKeyboardSelected, onToggleSelection, onPriorityClick, appMode, flatIndex }) => {
    const assignedUsers = (task.assignedUsers || []).map(id => users.find(u => u.id === id)).filter(Boolean) as User[];

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
            id={`list-item-d-${flatIndex}`}
            data-context-type="task"
            data-item-id={task.id}
            onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button') || target.closest('input') || target.closest('.interactive-cell')) return;
                onViewDetails(task.id, {});
            }}
            className={`cursor-pointer relative overflow-visible transition-colors border-b border-gray-100 dark:border-zinc-800 last:border-0
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
                <button
                    onClick={(e) => { e.stopPropagation(); onPriorityClick(e, task); }}
                    className={`px-2.5 py-1 inline-flex items-center gap-1 text-2xs font-bold tracking-wide uppercase rounded-full cursor-pointer hover:opacity-80 transition-opacity ${getPriorityColorClass(task.priority)}`}
                >
                    {task.priority || 'Medium'}
                    <ChevronDownIcon className="w-3 h-3" />
                </button>
            </td>

            {/* Status with Inline Dropdown */}
            <td className="px-6 py-4 whitespace-nowrap overflow-visible interactive-cell">
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

            {/* Delivery column */}
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

// ─── Mobile task card ───────────────────────────────────────────────────────
// Renders below the sm: breakpoint. Each card shows title, status pill,
// priority pill, assignee avatars, due date — stacked vertically, full
// width, no horizontal scrolling. The same status dropdown and quick-action
// buttons from the desktop row live inside the card (layout change, not
// new state logic).
//
// Swipe gestures (adapted from Toast.tsx):
//   • Swipe right → mark done (calls the existing, reliable handleUpdateTaskStatus)
//   • Swipe left → reveal a small action row (edit / delete), using the
//     already-fixed dedicated mutations — NOT the generic updateItem path.
const TaskCard: React.FC<{
    task: Task;
    users: User[];
    matter?: Matter;
    onViewDetails: (id: string, context: any) => void;
    onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
    isSelected: boolean;
    isKeyboardSelected: boolean;
    onToggleSelection: (id: string) => void;
    onPriorityClick: (e: React.MouseEvent, task: Task) => void;
    onEdit: () => void;
    onDelete: () => void;
    appMode: AppMode;
    flatIndex: number;
}> = ({ task, users, matter, onViewDetails, onUpdateTaskStatus, isSelected, isKeyboardSelected, onToggleSelection, onPriorityClick, onEdit, onDelete, appMode, flatIndex }) => {
    const assignedUsers = (task.assignedUsers || []).map(id => users.find(u => u.id === id)).filter(Boolean) as User[];

    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const statusRef = useRef<HTMLDivElement>(null);

    // Swipe gesture state (adapted from Toast.tsx)
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const startXRef = useRef(0);
    const startTimeRef = useRef(0);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
                setIsStatusOpen(false);
            }
            // If a touch happens outside an already-revealed card, dismiss the reveal.
            // We only do this if the click is NOT inside this card's swipe-content area.
            if (revealed) {
                const cardEl = document.getElementById(`task-card-content-${task.id}`);
                if (cardEl && !cardEl.contains(event.target as Node)) {
                    setRevealed(false);
                    setSwipeOffset(0);
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isStatusOpen, revealed, task.id]);

    const onTouchStart = (e: React.TouchEvent) => {
        // Don't initiate swipe if the user touched an interactive control
        // (status dropdown, priority pill, checkbox, action buttons).
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('.interactive-cell')) {
            setIsSwiping(false);
            return;
        }
        startXRef.current = e.touches[0].clientX;
        startTimeRef.current = Date.now();
        setIsSwiping(true);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!isSwiping) return;
        const deltaX = e.touches[0].clientX - startXRef.current;
        // If already revealed and user is dragging right (positive deltaX),
        // start closing the reveal: the visible offset moves from -ACTION_REVEAL_WIDTH
        // toward 0 as deltaX increases.
        if (revealed && deltaX > 0) {
            setSwipeOffset(Math.min(0, -ACTION_REVEAL_WIDTH + deltaX));
        } else if (!revealed && deltaX < 0) {
            // Not yet revealed, dragging left: clamp to -ACTION_REVEAL_WIDTH max.
            setSwipeOffset(Math.max(-ACTION_REVEAL_WIDTH, deltaX));
        } else if (!revealed && deltaX > 0) {
            // Dragging right (swipe-to-complete gesture): allow free movement.
            setSwipeOffset(deltaX);
        }
    };

    const onTouchEnd = () => {
        if (!isSwiping) return;
        const deltaX = swipeOffset;
        const deltaTime = Date.now() - startTimeRef.current;
        setIsSwiping(false);

        // SWIPE RIGHT → mark done (only if not already done)
        if (deltaX > 80 || (deltaX > 40 && deltaTime < 300)) {
            if (task.status !== TaskStatus.Done) {
                onUpdateTaskStatus(task.id, TaskStatus.Done);
            }
            setSwipeOffset(0);
            setRevealed(false);
            return;
        }

        // SWIPE LEFT → reveal action row (edit / delete)
        if (deltaX < -80 || (deltaX < -40 && deltaTime < 300)) {
            setSwipeOffset(-ACTION_REVEAL_WIDTH);
            setRevealed(true);
            return;
        }

        // Otherwise snap back to current rest state (0 if not revealed, -ACTION_REVEAL_WIDTH if revealed)
        setSwipeOffset(revealed ? -ACTION_REVEAL_WIDTH : 0);
    };

    return (
        <div
            id={`list-item-m-${flatIndex}`}
            className={`relative overflow-hidden bg-white dark:bg-zinc-800 transition-colors
                ${isKeyboardSelected ? 'ring-2 ring-inset ring-primary-400 dark:ring-primary-600' : ''}
                ${isSelected ? 'bg-blue-50 dark:bg-zinc-800' : ''}
            `}
        >
            {/* Action strip — revealed by swipe-left. Positioned absolutely on the right. */}
            <div className="absolute right-0 top-0 bottom-0 flex">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setRevealed(false);
                        setSwipeOffset(0);
                        onEdit();
                    }}
                    className="w-16 flex flex-col items-center justify-center bg-blue-500 text-white active:bg-blue-600"
                    aria-label="Edit task"
                >
                    <PencilIcon className="w-5 h-5 mb-0.5" />
                    <span className="text-3xs font-bold uppercase tracking-wide">Edit</span>
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setRevealed(false);
                        setSwipeOffset(0);
                        onDelete();
                    }}
                    className="w-16 flex flex-col items-center justify-center bg-red-500 text-white active:bg-red-600"
                    aria-label="Delete task"
                >
                    <TrashIcon className="w-5 h-5 mb-0.5" />
                    <span className="text-3xs font-bold uppercase tracking-wide">Delete</span>
                </button>
            </div>

            {/* Card content — translated by swipeOffset */}
            <div
                id={`task-card-content-${task.id}`}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onClick={() => {
                    if (revealed) {
                        // Tap on revealed card → dismiss reveal (don't navigate)
                        setRevealed(false);
                        setSwipeOffset(0);
                        return;
                    }
                    onViewDetails(task.id, {});
                }}
                style={{
                    transform: `translateX(${swipeOffset}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.25s ease-out',
                }}
                className="relative bg-white dark:bg-zinc-800 px-4 py-3 border-b border-slate-100 dark:border-zinc-700/50"
            >
                {/* Top row: checkbox + title */}
                <div className="flex items-start gap-3">
                    <input
                        autoComplete="off"
                        data-lpignore="true"
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => { e.stopPropagation(); onToggleSelection(task.id); }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold ${task.status === 'done' ? 'text-slate-400 dark:text-zinc-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                            {task.title}
                        </div>
                        {task.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{task.description}</div>
                        )}
                    </div>
                </div>

                {/* Bottom row: status pill, priority pill, matter, due date */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {/* Status dropdown — same logic as desktop row */}
                    <div className="relative interactive-cell" ref={statusRef}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsStatusOpen(!isStatusOpen); }}
                            className={`px-2.5 py-1 inline-flex items-center gap-1 text-2xs font-bold uppercase tracking-wide rounded-full cursor-pointer
                            ${task.status === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                        task.status === 'pending_verification' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                            'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'}`}
                        >
                            {task.status.replace('_', ' ')}
                            <ChevronDownIcon className="w-3 h-3" />
                        </button>

                        {isStatusOpen && (
                            <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-slate-200 dark:border-zinc-700 z-[60] py-1 animate-fade-in-up">
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

                    {/* Priority pill — same popover trigger as desktop */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onPriorityClick(e, task); }}
                        className={`px-2.5 py-1 inline-flex items-center gap-1 text-2xs font-bold tracking-wide uppercase rounded-full cursor-pointer ${getPriorityColorClass(task.priority)}`}
                    >
                        {task.priority || 'Medium'}
                        <ChevronDownIcon className="w-3 h-3" />
                    </button>

                    {/* Due date (only if set) */}
                    {task.dueDate && task.status !== 'done' && (
                        <span className={`text-2xs font-semibold ${getDueDateColor(task.dueDate)}`}>
                            {formatDueDate(task.dueDate)}
                        </span>
                    )}

                    {/* Matter badge */}
                    {matter && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-700 rounded text-3xs font-medium truncate max-w-[120px]" title={matter.title}>
                            {matter.title}
                        </span>
                    )}
                </div>

                {/* Assignee avatars + quick action buttons (only show on multi-mode) */}
                {(appMode === 'multi' || task.status === 'todo' || task.status === 'in_progress') && (
                    <div className="mt-2 flex items-center justify-between">
                        {appMode === 'multi' && (
                            assignedUsers.length > 0 ? (
                                <div className="flex items-center -space-x-2">
                                    {assignedUsers.map(user => (
                                        <Tooltip key={user.id} text={user.name}>
                                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-white font-bold text-3xs ring-2 ring-white dark:ring-zinc-800 ${getUserColor(user.name)}`}>
                                                {getInitials(user.name)}
                                            </div>
                                        </Tooltip>
                                    ))}
                                </div>
                            ) : <span className="text-3xs text-gray-400">Unassigned</span>
                        )}

                        {/* Quick action buttons — visible (no opacity hover trick on touch) */}
                        <div className="flex items-center gap-2 ml-auto">
                            {task.status === 'todo' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateTaskStatus(task.id, TaskStatus.InProgress); }}
                                    className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-3xs font-bold uppercase tracking-wide flex items-center gap-1"
                                >
                                    <PlayIcon className="w-3 h-3" />
                                    Start
                                </button>
                            )}
                            {(task.status === 'todo' || task.status === 'in_progress') && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateTaskStatus(task.id, TaskStatus.Done); }}
                                    className="px-2.5 py-1 rounded-md bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-3xs font-bold uppercase tracking-wide flex items-center gap-1"
                                >
                                    <CheckIcon className="w-3 h-3" />
                                    Done
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Hint chip — shows on first render to teach swipe gestures. Auto-hidden after first interaction. */}
                {!revealed && swipeOffset === 0 && (
                    <div className="absolute top-1 right-1 text-3xs text-slate-300 dark:text-zinc-600 pointer-events-none select-none">
                        ← swipe
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Collapsible section header ─────────────────────────────────────────────
const SectionHeader: React.FC<{
    title: string;
    count: number;
    isCollapsed: boolean;
    onToggle: () => void;
    accentColor?: string;
}> = ({ title, count, isCollapsed, onToggle, accentColor = 'bg-primary-500' }) => (
    <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 sm:px-6 py-2 bg-slate-50/80 dark:bg-zinc-900/30 hover:bg-slate-100 dark:hover:bg-zinc-900/50 transition-colors border-b border-slate-200 dark:border-zinc-800"
    >
        <div className="flex items-center gap-2 min-w-0">
            <div className={`h-4 w-1 ${accentColor} rounded-full flex-shrink-0`} />
            <span className="text-2xs font-black uppercase tracking-wide-label text-slate-600 dark:text-zinc-300 truncate">
                {title}
            </span>
            <span className="text-3xs font-bold text-slate-400 ml-1 flex-shrink-0">({count})</span>
        </div>
        <ChevronDownIcon className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
    </button>
);

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
    onEditTask?: (taskId: string) => void;
    onDeleteTask?: (task: Task) => void;
    filterText?: string;
    groupBy?: 'none' | 'status' | 'matter' | 'priority';
    currentUser?: User | null;
}

const TaskList: React.FC<TaskListProps> = ({
    tasks,
    users,
    matters,
    onViewDetails,
    onUpdateTaskStatus,
    selectedTasks,
    onToggleSelection,
    appMode,
    onCreateTask,
    onEditTask,
    onDeleteTask,
    filterText,
    groupBy = 'status',
    currentUser,
}) => {
    const { handleUpdateTaskPriority } = useDataActions();
    const { openModal: openUIModal } = useUI();
    const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: SortDirection } | null>({ key: 'dueDate', direction: 'asc' });
    const [popoverState, setPopoverState] = useState<{ task: Task | null; anchorEl: HTMLElement | null }>({ task: null, anchorEl: null });
    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

    // Persist collapsed-section state per user, keyed by user id (with 'anon'
    // fallback for unauthenticated sessions). Same localStorage pattern as
    // MessagesView's MOVABLE_SECTIONS_KEY — see MessagesView.tsx.
    const COLLAPSED_KEY = `taskList.collapsedSections.${currentUser?.id || 'anon'}`;
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem(COLLAPSED_KEY);
            return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
        } catch {
            return new Set<string>();
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsedSections]));
        } catch {
            // localStorage may be full or unavailable — non-fatal, just skip.
        }
    }, [collapsedSections, COLLAPSED_KEY]);

    const toggleSection = (key: string) => {
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

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

    // Build groups based on groupBy mode.
    // - 'none' → single group with no header (flat list)
    // - 'status' → sections per TaskStatus, ordered to match Kanban column order
    // - 'matter' → sections per Matter title
    // - 'priority' → sections per priority (High → Medium → Low)
    const taskGroups = useMemo(() => {
        if (groupBy === 'none') return [{ title: null as string | null, key: '__all__', tasks: sortedTasks }];

        const groups: Record<string, Task[]> = {};
        sortedTasks.forEach(task => {
            let groupTitle = 'Uncategorized';
            if (groupBy === 'status') {
                groupTitle = STATUS_LABELS[task.status] || task.status.replace('_', ' ');
            } else if (groupBy === 'matter') {
                groupTitle = matters.find(m => m.id === task.matterId)?.title || 'No Matter';
            } else if (groupBy === 'priority') {
                groupTitle = task.priority || 'Medium';
            }
            if (!groups[groupTitle]) groups[groupTitle] = [];
            groups[groupTitle].push(task);
        });

        const keys = Object.keys(groups);
        if (groupBy === 'status') {
            // Sort by canonical Kanban order: To Do → In Progress → Pending → Done
            keys.sort((a, b) => {
                const ai = STATUS_ORDER.findIndex(s => STATUS_LABELS[s] === a);
                const bi = STATUS_ORDER.findIndex(s => STATUS_LABELS[s] === b);
                return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            });
        } else if (groupBy === 'priority') {
            // High → Medium → Low (then anything else)
            const priorityOrder = ['High', 'Medium', 'Low'];
            keys.sort((a, b) => {
                const ai = priorityOrder.indexOf(a);
                const bi = priorityOrder.indexOf(b);
                return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            });
        } else {
            keys.sort();
        }

        return keys.map(key => ({ title: key, key, tasks: groups[key] }));
    }, [sortedTasks, groupBy, matters]);

    // Flatten all tasks across groups for keyboard navigation. With status
    // grouping, the visible order differs from sortedTasks — keyboard nav
    // needs to follow the visible order, jumping across group boundaries.
    const flatTasks = useMemo(() => taskGroups.flatMap(g => g.tasks), [taskGroups]);
    const taskFlatIndex = useMemo(() => {
        const map = new Map<string, number>();
        flatTasks.forEach((t, i) => map.set(t.id, i));
        return map;
    }, [flatTasks]);

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

    // Keyboard Navigation — now supports grouped lists. The hook tracks a
    // single selectedIndex across the flat (group-flattened) list, so arrow
    // keys naturally cross group boundaries. Replaces the previous
    // `isKeyboardSelected={false}` placeholder.
    const { selectedIndex } = useKeyboardNavigation({
        itemCount: flatTasks.length,
        onEnter: (index) => onViewDetails(flatTasks[index].id, {}),
        onSpace: (index) => {
            openUIModal('quickLook', null, { item: flatTasks[index], type: 'Task' });
        }
    });

    // Custom auto-scroll — handles BOTH mobile card and desktop table layouts.
    // The built-in hook only looks up `list-item-N`; we use prefixed IDs
    // (`list-item-m-N` for mobile, `list-item-d-N` for desktop) and pick the
    // one that's currently visible (offsetParent !== null).
    useEffect(() => {
        if (selectedIndex < 0) return;
        const mobileEl = document.getElementById(`list-item-m-${selectedIndex}`);
        const desktopEl = document.getElementById(`list-item-d-${selectedIndex}`);
        const target = (mobileEl && mobileEl.offsetParent !== null) ? mobileEl
                     : (desktopEl && desktopEl.offsetParent !== null) ? desktopEl
                     : null;
        if (target) {
            target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedIndex]);

    const handleEditTask = (taskId: string) => {
        onEditTask?.(taskId);
    };

    const handleDeleteTask = (task: Task) => {
        onDeleteTask?.(task);
    };

    return (
        <div className="flex-grow flex flex-col min-h-0 shadow-sm sm:rounded-lg border-t sm:border border-slate-200 dark:border-zinc-700 overflow-hidden bg-slate-50 sm:bg-white dark:bg-zinc-900 sm:dark:bg-zinc-800">
            {sortedTasks.length > 0 ? (
                <>
                    {/* ─── Mobile card layout (below sm: breakpoint) ─── */}
                    <div className="sm:hidden flex-grow overflow-y-auto overflow-x-hidden custom-scrollbar">
                        {taskGroups.map((group) => {
                            const isCollapsed = group.title !== null && collapsedSections.has(group.key);
                            return (
                                <div key={group.key} className="border-b border-slate-200 dark:border-zinc-800 last:border-0">
                                    {group.title && (
                                        <SectionHeader
                                            title={group.title}
                                            count={group.tasks.length}
                                            isCollapsed={isCollapsed}
                                            onToggle={() => toggleSection(group.key)}
                                        />
                                    )}
                                    {!isCollapsed && group.tasks.map((task) => {
                                        const flatIndex = taskFlatIndex.get(task.id) ?? 0;
                                        return (
                                            <TaskCard
                                                key={task.id}
                                                task={task}
                                                users={users}
                                                matter={matters.find(m => m.id === task.matterId)}
                                                onViewDetails={onViewDetails}
                                                onUpdateTaskStatus={onUpdateTaskStatus}
                                                isSelected={selectedTasks.has(task.id)}
                                                isKeyboardSelected={selectedIndex === flatIndex}
                                                onToggleSelection={onToggleSelection}
                                                onPriorityClick={handlePriorityClick}
                                                onEdit={() => handleEditTask(task.id)}
                                                onDelete={() => handleDeleteTask(task)}
                                                appMode={appMode}
                                                flatIndex={flatIndex}
                                            />
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>

                    {/* ─── Desktop table layout (sm: and up) ─── */}
                    <div className="hidden sm:block flex-grow overflow-auto custom-scrollbar">
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
                                {taskGroups.map((group) => (
                                    <React.Fragment key={group.key}>
                                        {group.title && (
                                            <tr className="bg-slate-50/50 dark:bg-zinc-900/30">
                                                <td colSpan={appMode === 'multi' ? 9 : 8} className="px-6 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-4 w-1 bg-primary-500 rounded-full" />
                                                        <span className="text-2xs font-black uppercase tracking-wide-label text-slate-500 dark:text-zinc-400">
                                                            {group.title}
                                                        </span>
                                                        <span className="text-3xs font-bold text-slate-400 ml-2">({group.tasks.length} items)</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {group.tasks.map((task) => {
                                            const flatIndex = taskFlatIndex.get(task.id) ?? 0;
                                            return (
                                                <TaskRow
                                                    key={task.id}
                                                    task={task}
                                                    users={users}
                                                    matter={matters.find(m => m.id === task.matterId)}
                                                    onViewDetails={onViewDetails}
                                                    onUpdateTaskStatus={onUpdateTaskStatus}
                                                    isSelected={selectedTasks.has(task.id)}
                                                    isKeyboardSelected={selectedIndex === flatIndex}
                                                    onToggleSelection={onToggleSelection}
                                                    onPriorityClick={handlePriorityClick}
                                                    appMode={appMode}
                                                    flatIndex={flatIndex}
                                                />
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
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
