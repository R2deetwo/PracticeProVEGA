import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Task, CalendarEvent, ModalType, TaskStatus, TaskStatusValues, User, Matter, Document } from '../../types';
import { ChevronDownIcon, CalendarIcon, ListBulletIcon, EditIcon, ClockIcon } from '../../constants';

import { useUI } from '../../contexts/UIContext';
import { expandRecurringEvents } from '../../utils/calendarUtils';
import Tooltip from '../Tooltip';
import { StatutoryTaskTimeline } from './StatutoryTaskTimeline';
import { ENTERPRISE_WORKFLOWS } from '../../utils/enterpriseWorkflows';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const getStatusBadgeClass = (status: TaskStatus) => {
    switch (status) {
        case TaskStatus.Done:
            return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800';
        case TaskStatus.InProgress:
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
        case TaskStatus.Todo:
        default:
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface TasksAndEventsTabProps {
    tasks: Task[];
    events: CalendarEvent[];
    matterId: string;
    matter?: Matter;
    documents: Document[];
    openModal: (type: ModalType, id: string | null, context?: any) => void;
    onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
    lastViewedAt: number;
    currentUser: User;
    navigateTo: (view: any, id?: string | null, context?: any) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const TasksAndEventsTab: React.FC<TasksAndEventsTabProps> = ({
    tasks, events, matterId, matter, documents, openModal, onUpdateTaskStatus, lastViewedAt, currentUser, navigateTo
}) => {
    const { setHighlightTarget } = useUI();
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Detect enterprise workflow
    const hasStatutoryWorkflow = useMemo(() => {
        if (!matter?.type || !matter?.subCategory) return false;
        const wf = ENTERPRISE_WORKFLOWS[matter.type as keyof typeof ENTERPRISE_WORKFLOWS];
        if (!wf) return false;
        return !!(wf.subCategories as any)[matter.subCategory];
    }, [matter?.type, matter?.subCategory]);

    const [subView, setSubView] = useState<'timeline' | 'list' | 'events'>(
        hasStatutoryWorkflow ? 'timeline' : 'list'
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                openDropdownId &&
                dropdownRefs.current[openDropdownId] &&
                !dropdownRefs.current[openDropdownId]!.contains(event.target as Node)
            ) {
                setOpenDropdownId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openDropdownId]);

    const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
        onUpdateTaskStatus(taskId, newStatus);
        setOpenDropdownId(null);
    };

    const isNew = (createdStr?: string, creatorId?: string) => {
        if (!createdStr) return false;
        if (creatorId === currentUser.id) return false;
        return new Date(createdStr).getTime() > lastViewedAt;
    };

    const handleViewInCalendar = (event: CalendarEvent) => {
        setHighlightTarget({ view: 'calendar', filter: { id: event.id }, color: 'blue' });
        navigateTo('calendar', null, {
            date: new Date(event.date).toISOString().split('T')[0],
            calendarViewMode: 'diary',
        });
    };

    const displayEvents = useMemo(() => {
        const start = new Date();
        start.setMonth(start.getMonth() - 3);
        const end = new Date();
        end.setMonth(end.getMonth() + 3);

        const expanded = expandRecurringEvents(events, start, end).sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const groups = new Map<string, CalendarEvent[]>();
        expanded.forEach(ev => {
            const gid = ev.originalId || ev.id;
            if (!groups.has(gid)) groups.set(gid, []);
            groups.get(gid)!.push(ev);
        });

        const now = new Date();
        const collapsed: (CalendarEvent & { occurrenceCount: number })[] = [];
        groups.forEach(instances => {
            const futureInstances = instances.filter(i => new Date(i.date).getTime() >= now.getTime());
            const displayInstance = futureInstances.length > 0
                ? futureInstances[0]
                : instances[instances.length - 1];
            collapsed.push({ ...displayInstance, occurrenceCount: instances.length });
        });

        return collapsed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [events]);

    // ─── Sub-view tab pill ────────────────────────────────────────────────────
    const TabPill: React.FC<{ id: string; label: string; active: boolean; onClick: () => void }> = ({ id, label, active, onClick }) => (
        <button
            key={id}
            onClick={onClick}
            className={`px-3 py-1.5 text-2xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                active
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-700 dark:text-zinc-100'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
            }`}
        >
            {label}
        </button>
    );

    // ─── Task list ────────────────────────────────────────────────────────────
    const TaskListView = () => (
        <div className="flex flex-col">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    Tasks
                    <span className="bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs px-2 py-0.5 rounded-full">{tasks.length}</span>
                </h4>
                <button
                    onClick={() => openModal('newTask', null, { matterId, openedFrom: 'matterDetail' })}
                    className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors"
                >
                    + Add Task
                </button>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden shadow-sm min-h-[200px]">
                {tasks.length > 0 ? (
                    <ul className="overflow-y-auto p-2 space-y-2 custom-scrollbar max-h-[500px]">
                        {tasks.map(task => {
                            const isTaskNew = isNew(task.createdAt, task.creatorId);
                            return (
                                <li key={task.id} className="group p-3 rounded-lg bg-slate-50 dark:bg-zinc-700/30 border border-slate-100 dark:border-zinc-700/50 hover:border-primary-200 dark:hover:border-primary-800 transition-all halo-hover">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {isTaskNew && <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />}
                                            <p
                                                className="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate cursor-pointer hover:text-primary-600 transition-colors"
                                                onClick={() => openModal('viewTask', task.id, { openedFrom: 'matterDetail' })}
                                            >
                                                {task.title}
                                            </p>
                                        </div>
                                        <div className="relative shrink-0" ref={el => { dropdownRefs.current[task.id] = el; }}>
                                            <button
                                                onClick={e => { e.stopPropagation(); setOpenDropdownId(openDropdownId === task.id ? null : task.id); }}
                                                className={`px-2 py-1 text-2xs font-bold uppercase tracking-wider rounded border transition-colors flex items-center gap-1.5 ${getStatusBadgeClass(task.status)}`}
                                            >
                                                {task.status.replace('_', ' ')}
                                                <ChevronDownIcon className="w-2.5 h-2.5" />
                                            </button>
                                            {openDropdownId === task.id && (
                                                <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-slate-200 dark:border-zinc-700 z-[100] overflow-hidden py-1 ring-1 ring-black/5">
                                                    {TaskStatusValues.map(status => (
                                                        <button
                                                            key={status}
                                                            onClick={e => { e.stopPropagation(); handleStatusChange(task.id, status); }}
                                                            className="block w-full text-left px-4 py-2 text-2xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700 hover:text-primary-600 transition-colors"
                                                        >
                                                            {status.replace('_', ' ')}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                        <div className="flex justify-between items-center text-2xs text-slate-500 dark:text-zinc-400 font-medium">
                                        <div className="flex items-center gap-1.5">
                                            <CalendarIcon className="w-3.5 h-3.5" />
                                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB') : 'No due date'}
                                        </div>
                                        <div className="flex gap-1">
                                            <Tooltip text="Edit">
                                                <button onClick={(e) => { e.stopPropagation(); openModal('editTask', task.id); }} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-600 text-slate-400 hover:text-primary-600 transition-colors">
                                                    <EditIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </Tooltip>
                                            <Tooltip text="Delete">
                                                <button onClick={(e) => { e.stopPropagation(); openModal('deleteConfirmation', task.id, { title: `Delete "${task.title}"?`, message: 'This task will be permanently removed.', onConfirm: () => { deleteTask(task.id, task.title); closeModal(); } }); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                                </button>
                                            </Tooltip>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center min-h-[200px]">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-zinc-700/50 rounded-full flex items-center justify-center mb-3">
                            <ListBulletIcon className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-bold text-slate-500 tracking-tight uppercase">Task list empty</p>
                    </div>
                )}
            </div>
        </div>
    );

    // ─── Events list ──────────────────────────────────────────────────────────
    const EventsView = () => (
        <div className="flex flex-col">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    Events
                    <span className="bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs px-2 py-0.5 rounded-full">{displayEvents.length}</span>
                </h4>
                <button
                    data-item-id="checklist-cta-hasCourtDateOnMatter"
                    data-tour-id="new-event-button"
                    onClick={() => openModal('newEvent', null, { matterId })}
                    className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors"
                >
                    + New Event
                </button>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden shadow-sm min-h-[200px]">
                {displayEvents.length > 0 ? (
                    <ul className="overflow-y-auto p-2 space-y-2 custom-scrollbar max-h-[500px]">
                        {displayEvents.map(event => {
                            const isRecurring = !!event.recurrence || event.occurrenceCount > 1;
                            return (
                                <li
                                    key={event.id}
                                    className="group p-3 rounded-lg bg-slate-50 dark:bg-zinc-700/30 border border-slate-100 dark:border-zinc-700/50 hover:border-primary-200 dark:hover:border-primary-800 transition-all cursor-pointer halo-hover"
                                    onClick={() => openModal('viewEvent', event.id)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate">{event.title}</p>
                                            <div className="flex items-center gap-1.5 text-2xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
                                                <CalendarIcon className="w-3.5 h-3.5" />
                                                {new Date(event.date).toLocaleDateString('en-GB')}
                                                {isRecurring && <span className="text-3xs bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 px-1 rounded">RECURRING</span>}
                                            </div>
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); handleViewInCalendar(event); }}
                                            className="text-2xs font-bold text-primary-600 hover:underline"
                                        >
                                            Calendar View
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-center text-2xs text-slate-400 font-medium italic">
                                        <span className="truncate">{event.court || 'No location set'}</span>
                                        <div className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 flex gap-1 transition-opacity">
                                            <Tooltip text="Edit">
                                                <button
                                                    onClick={e => { e.stopPropagation(); openModal('editEvent', event.id); }}
                                                    className="p-1 rounded hover:bg-white dark:hover:bg-zinc-600 text-slate-400 hover:text-primary-600 transition-colors"
                                                >
                                                    <EditIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </Tooltip>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center min-h-[200px]">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-zinc-700/50 rounded-full flex items-center justify-center mb-3">
                            <ClockIcon className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-bold text-slate-500 tracking-tight uppercase">No events scheduled</p>
                    </div>
                )}
            </div>
        </div>
    );

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="py-2 space-y-4">

            {/* Sub-view Tab Pills */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg w-fit">
                {hasStatutoryWorkflow && (
                    <TabPill id="timeline" label="Timeline" active={subView === 'timeline'} onClick={() => setSubView('timeline')} />
                )}
                <TabPill id="list" label="Tasks" active={subView === 'list'} onClick={() => setSubView('list')} />
                <TabPill id="events" label="Events" active={subView === 'events'} onClick={() => setSubView('events')} />
            </div>

            {/* Timeline */}
            {subView === 'timeline' && matter && (
                <StatutoryTaskTimeline
                    tasks={tasks}
                    matterType={matter.type}
                    subCategory={matter.subCategory}
                    matterId={matterId}
                    matter={matter}
                    documents={documents}
                    onUpdateStatus={onUpdateTaskStatus}
                    openModal={openModal as any}
                />
            )}

            {/* Task List */}
            {subView === 'list' && <TaskListView />}

            {/* Events */}
            {subView === 'events' && <EventsView />}

        </div>
    );
};
