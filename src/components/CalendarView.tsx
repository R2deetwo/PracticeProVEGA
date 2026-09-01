
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CalendarEvent, CustomEventType, ModalType, Task, Matter, User, Contact, AppMode } from '../types';
import { getEventTypeBadgeClass, getEventTypeColorClass, getInitials, getUserColor } from '../utils/colorUtils';
import { GridIcon, ListIcon, PlusIcon, CalendarIcon, GavelIconLarge, ContactsIcon, ChevronRightIcon, ClockIcon, LockClosedIcon } from '../constants';
import Tooltip from './Tooltip';
import { parseDateString, expandRecurringEvents, computeAtriumVirtualEvents } from '../utils/calendarUtils';
import { useCoreState } from '../contexts/CoreContext';
import { useUI } from '../contexts/UIContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useMatterState } from '../contexts/MatterContext';
import { useAuth } from '../contexts/AuthContext';
import { useProduct } from '../contexts/ProductContext';

// Helper to ensure dates are formatted as YYYY-MM-DD in LOCAL time
const toLocalISOString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Algorithm to detect and position overlapping events
const organizeEventsWithOverlaps = (dayEvents: CalendarEvent[]) => {
    if (dayEvents.length === 0) return [];
    const sorted = [...dayEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const results: { event: CalendarEvent; columnCount: number; columnIndex: number; hasConflict: boolean }[] = [];
    const clusters: CalendarEvent[][] = [];

    sorted.forEach(event => {
        const start = new Date(event.date).getTime();
        const end = event.endDate ? new Date(event.endDate).getTime() : start + 3600000;
        let foundClusterIndex = -1;
        for (let i = 0; i < clusters.length; i++) {
            const overlaps = clusters[i].some(ce => {
                const cs = new Date(ce.date).getTime();
                const ce_end = ce.endDate ? new Date(ce.endDate).getTime() : cs + 3600000;
                return start < ce_end && end > cs;
            });
            if (overlaps) { foundClusterIndex = i; break; }
        }
        if (foundClusterIndex !== -1) clusters[foundClusterIndex].push(event);
        else clusters.push([event]);
    });

    clusters.forEach(cluster => {
        const columns: CalendarEvent[][] = [];
        const clusterResults: any[] = [];
        cluster.forEach(event => {
            const start = new Date(event.date).getTime();
            const end = event.endDate ? new Date(event.endDate).getTime() : start + 3600000;
            let colIndex = columns.findIndex(col => {
                const lastInCol = col[col.length - 1];
                const lastStart = new Date(lastInCol.date).getTime();
                const lastEnd = lastInCol.endDate ? new Date(lastInCol.endDate).getTime() : lastStart + 3600000;
                return start >= lastEnd;
            });
            if (colIndex === -1) { columns.push([event]); colIndex = columns.length - 1; }
            else columns[colIndex].push(event);
            const hasConflict = cluster.some(other => {
                if (other.id === event.id) return false;
                const os = new Date(other.date).getTime();
                const oe = other.endDate ? new Date(other.endDate).getTime() : os + 3600000;
                const overlaps = start < oe && end > os;
                if (!overlaps) return false;
                const users1 = event.assignedUsers || [];
                const users2 = other.assignedUsers || [];
                return users1.some(u => users2.includes(u));
            });
            clusterResults.push({ event, columnIndex: colIndex, hasConflict });
        });
        clusterResults.forEach(res => results.push({ ...res, columnCount: columns.length }));
    });
    return results;
};

// ─── Premium Month Day Cell ────────────────────────────────────────────
// Soft grid (no harsh borders), pill-shaped event indicators, clean anatomy
const MonthDayCell: React.FC<{
    date: Date;
    events: CalendarEvent[];
    isToday: boolean;
    isCurrentMonth: boolean;
    onDateClick: (dateStr: string) => void;
    onEventClick: (id: string, dateStr: string) => void;
    eventTypes: CustomEventType[];
    highlightedEventId?: string | null;
    highlightColor?: string;
}> = ({ date, events, isToday, isCurrentMonth, onDateClick, onEventClick, eventTypes, highlightedEventId, highlightColor }) => {

    const getHighlightRing = (color?: string) => {
        if (!color) return 'ring-red-500';
        const map: any = { red: 'ring-red-500', blue: 'ring-blue-500', orange: 'ring-orange-500', green: 'ring-emerald-500' };
        return map[color] || 'ring-primary-500';
    };

    // Show first 2 events as pills, then "+N more"
    const DISPLAY_LIMIT = 2;
    const visibleEvents = events.slice(0, DISPLAY_LIMIT);
    const hiddenCount = Math.max(0, events.length - DISPLAY_LIMIT);
    const dateStr = toLocalISOString(date);

    const uniqueColors = Array.from(
        new Map(events.map(e => {
            const et = eventTypes.find(t => t.name === e.type);
            return [et?.color || 'gray', getEventTypeColorClass(et?.color || 'gray')];
        })).values()
    );

    return (
        <div
            onClick={() => onDateClick(dateStr)}
            className={`
                relative p-1.5 flex flex-col min-h-[90px] sm:min-h-[110px] cursor-pointer transition-all duration-200
                ${isCurrentMonth ? 'bg-white dark:bg-zinc-900' : 'bg-slate-50/40 dark:bg-zinc-800/15'}
                hover:bg-emerald-50/40 dark:hover:bg-emerald-900/5 hover:z-10 group
                border-b border-slate-100 dark:border-zinc-800/50
                ${!isCurrentMonth ? 'opacity-50' : ''}
            `}
            style={{ borderRight: '1px solid rgba(148, 163, 184, 0.08)' }}
        >
            {/* Date numeral — top left, clean */}
            <div className="flex justify-between items-center mb-1">
                <span className={`
                    flex items-center justify-center text-xs font-bold rounded-full transition-transform duration-200 group-hover:scale-110
                    ${isToday
                        ? 'bg-primary-600 text-white shadow-md w-7 h-7'
                        : isCurrentMonth
                            ? 'text-slate-700 dark:text-slate-200 w-7 h-7'
                            : 'text-slate-300 dark:text-zinc-600 w-7 h-7'}
                `}>
                    {date.getDate()}
                </span>
                {uniqueColors.length > 0 && (
                    <div className="flex -space-x-1 pr-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        {uniqueColors.slice(0, 3).map((colorClass, idx) => (
                            <div key={idx} className={`w-1.5 h-1.5 rounded-full border border-white dark:border-zinc-800 ${colorClass}`} style={{ zIndex: 5 - idx }} />
                        ))}
                    </div>
                )}
            </div>

            {/* Event pills — sleek, rounded, colored */}
            <div className="flex-1 space-y-0.5 min-w-0">
                {visibleEvents.map(event => {
                    const et = eventTypes.find(t => t.name === event.type);
                    const colorClass = getEventTypeColorClass(et?.color || 'gray');
                    const isHighlighted = highlightedEventId === event.id;
                    return (
                        <div
                            key={event.id}
                            id={`event-month-${event.id}`}
                            onClick={(e) => { e.stopPropagation(); onEventClick(event.id, dateStr); }}
                            className={`px-1.5 py-0.5 rounded-full text-3xs sm:text-2xs font-bold truncate transition-all hover:translate-x-0.5 ${colorClass} bg-opacity-10 ${isHighlighted ? `ring-2 ring-offset-1 dark:ring-offset-zinc-900 ${getHighlightRing(highlightColor)}` : ''}`}
                        >
                            {event.title}
                        </div>
                    );
                })}

                {/* +N more indicator */}
                {hiddenCount > 0 && (
                    <div className="text-3xs text-slate-400 dark:text-zinc-500 font-semibold pl-1.5">
                        +{hiddenCount} more
                    </div>
                )}

                {/* Mobile: dot cluster */}
                {events.length > 0 && (
                    <div className="sm:hidden flex justify-center mt-0.5">
                        <div className="flex -space-x-1">
                            {uniqueColors.slice(0, 4).map((colorClass, i) => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full border border-white dark:border-zinc-900 ${colorClass}`} style={{ zIndex: 4 - i }} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Premium Time Slot — muted, centered typography ────────────────────
const TimeSlot: React.FC<{ time: string; hourHeight: number }> = ({ time, hourHeight }) => (
    <div className="relative flex items-start -mt-[1px]" style={{ height: `${hourHeight}px` }}>
        <div className="text-3xs sm:text-2xs text-right w-10 sm:w-12 pr-1.5 sm:pr-2 text-slate-400 dark:text-zinc-600 select-none font-medium pt-0.5 tracking-wide">{time}</div>
        <div className="flex-1 border-t border-slate-50 dark:border-zinc-800/40 z-0"></div>
    </div>
);

// ─── Premium Diary Event Tile — rounded card with accent border ────────
const DiaryEventTile: React.FC<{
    event: CalendarEvent;
    openModal: (modalType: ModalType, id: string, context: any) => void;
    eventTypes: CustomEventType[];
    columnCount: number;
    columnIndex: number;
    hasConflict: boolean;
    allUsers: User[];
}> = ({ event, openModal, eventTypes, columnCount, columnIndex, hasConflict, allUsers }) => {
    const startDate = parseDateString(event.date);
    const endDate = event.endDate ? parseDateString(event.endDate) : new Date(startDate.getTime() + 60 * 60 * 1000);
    const startHour = startDate.getHours() + (startDate.getMinutes() / 60);
    let endHour = endDate.getHours() + (endDate.getMinutes() / 60);
    if (endHour <= startHour) endHour = startHour + 1;
    const duration = Math.max(0.75, endHour - startHour);
    const top = startHour * 80;
    const height = duration * 80;

    const eventType = eventTypes.find(et => et.name === event.type);
    const color = eventType?.color || 'gray';
    const tileColorClass = getEventTypeBadgeClass(color, 'calendar-tile');

    const widthPercent = 100 / columnCount;
    const leftPercent = (100 / columnCount) * columnIndex;
    const assignedTeamMembers = (event.assignedUsers || [])
        .map(uId => allUsers.find(u => u.id === uId))
        .filter(Boolean) as User[];

    return (
        <div
            id={`event-tile-${event.id}`}
            onClick={(e) => { e.stopPropagation(); openModal('viewEvent', event.id, { openedFrom: 'calendar', instanceDate: event.date }); }}
            className={`
                absolute rounded-lg p-2 shadow-sm cursor-pointer transition-all hover:z-50 hover:scale-[1.02] hover:shadow-lg
                border-l-[3px] ${tileColorClass}
                ${hasConflict ? 'ring-2 ring-red-400/40 ring-offset-1 dark:ring-offset-zinc-900' : ''}
            `}
            style={{
                top: `${top}px`,
                height: `${height}px`,
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                zIndex: 10 + columnIndex,
                borderRadius: '10px',
            }}
            title={`${event.title} (${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()})${hasConflict ? ' - CONFLICT' : ''}`}
        >
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-2xs sm:text-2xs leading-tight truncate flex items-center gap-1">
                        {hasConflict && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse" />}
                        {event.title}
                    </p>
                    <p className="text-3xs sm:text-3xs opacity-60 truncate font-medium mt-0.5">
                        {startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
                </div>
                {assignedTeamMembers.length > 0 && (
                    <div className="mt-auto pt-0.5 flex -space-x-1 overflow-hidden">
                        {assignedTeamMembers.slice(0, 3).map((user, idx) => (
                            <div key={user.id} title={user.name}
                                className={`w-4 h-4 rounded-full border border-white dark:border-zinc-800 flex items-center justify-center text-[6px] font-bold text-white shrink-0 ${getUserColor(user.name)}`}
                                style={{ zIndex: 10 - idx }}>
                                {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" /> : getInitials(user.name)}
                            </div>
                        ))}
                        {assignedTeamMembers.length > 3 && (
                            <div className="w-4 h-4 rounded-full border border-white dark:border-zinc-800 bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-[6px] font-bold text-slate-600 dark:text-zinc-400 shrink-0 z-0">
                                +{assignedTeamMembers.length - 3}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════
// DiaryModeView — chronological daily agenda for lawyers
// ══════════════════════════════════════════════════════════════════════════

interface DiaryModeViewProps {
    selectedDate: Date;
    events: any[];
    tasks: any[];
    openModal: (modal: any, id?: any, context?: any) => void;
    eventTypes: any[];
    users: any[];
}

const DiaryModeView: React.FC<DiaryModeViewProps> = ({ selectedDate, events, tasks, openModal, eventTypes, users }) => {
    // ─── CRITICAL: Use LOCAL date string, NOT UTC ────────────────────
    const dateStr = selectedDate.toLocaleDateString('en-CA');

    const dayEvents = events.filter(e => {
        if (!e.date) return false;
        // TIMEZONE FIX: same local-parse rule as getEventsForDay.
        const eventDate = parseDateString(e.date);
        return eventDate.toLocaleDateString('en-CA') === dateStr;
    });

    const dayTasks = tasks.filter(t => {
        if (!t.dueDate) return false;
        const taskDate = new Date(t.dueDate);
        return taskDate.toLocaleDateString('en-CA') === dateStr;
    });

    // Categorize events
    const courtAppearances = dayEvents.filter(e => {
        const type = (e.type || '').toLowerCase();
        return type.includes('court') || type.includes('hearing') || type.includes('trial') || type.includes('fixture');
    });
    const deadlines = dayTasks.filter(t => {
        const title = (t.title || '').toLowerCase();
        return title.includes('appeal') || title.includes('deadline') || title.includes('statutory') || title.includes('file') || title.includes('submit');
    });
    const officeTasks = dayTasks.filter(t => !deadlines.includes(t));
    const consultations = dayEvents.filter(e => {
        const type = (e.type || '').toLowerCase();
        return type.includes('meeting') || type.includes('consultation') || type.includes('client');
    });

    // ─── Diary layout toggle: Structured vs Dynamic ──────────────────
    const [diaryLayout, setDiaryLayout] = useState<'structured' | 'dynamic'>('structured');

    const formatDateLong = (date: Date) => date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const formatTime = (dateStr: string) => {
        try { return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
        catch { return ''; }
    };

    // Category definitions with colors
    const categories = [
        { id: 'court', title: 'Court Appearances & Fixtures', count: courtAppearances.length, color: 'bg-red-500', items: courtAppearances, type: 'event' },
        { id: 'deadlines', title: 'Statutory Deadlines', count: deadlines.length, color: 'bg-amber-500', items: deadlines, type: 'task' },
        { id: 'office', title: 'Office Tasks & Client Consultations', count: officeTasks.length + consultations.length, color: 'bg-blue-500', items: [...consultations, ...officeTasks], type: 'mixed' },
    ];

    // In dynamic mode, only show categories with items
    const visibleCategories = diaryLayout === 'dynamic'
        ? categories.filter(c => c.count > 0)
        : categories;

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-900">
            <div className="max-w-2xl mx-auto px-6 py-8">
                {/* Date header + layout toggle */}
                <div className="mb-6 pb-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{formatDateLong(selectedDate)}</h2>
                        <p className="text-xs text-slate-400 mt-1">
                            {dayEvents.length + dayTasks.length} item{(dayEvents.length + dayTasks.length) !== 1 ? 's' : ''} scheduled
                        </p>
                    </div>
                    {/* Structured / Dynamic toggle */}
                    <div className="flex bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5">
                        <button
                            onClick={() => setDiaryLayout('structured')}
                            className={`px-2.5 py-1 text-2xs font-bold rounded-md transition-all ${diaryLayout === 'structured' ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400'}`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setDiaryLayout('dynamic')}
                            className={`px-2.5 py-1 text-2xs font-bold rounded-md transition-all ${diaryLayout === 'dynamic' ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400'}`}
                        >
                            Focus
                        </button>
                    </div>
                </div>

                {/* Render visible categories */}
                {visibleCategories.length === 0 && diaryLayout === 'dynamic' && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-zinc-800 flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-slate-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-slate-400 dark:text-zinc-500">Nothing scheduled for this day.</p>
                        <button
                            onClick={() => openModal('newEvent', null, { date: selectedDate, openedFrom: 'calendar' })}
                            className="mt-3 text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                        >
                            + Add Event
                        </button>
                    </div>
                )}

                {visibleCategories.map((cat) => (
                    <div key={cat.id} className="mb-6">
                        {/* Section header */}
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`w-1.5 h-5 rounded-full ${cat.color}`} />
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{cat.title}</h3>
                            <span className="text-xs font-medium text-slate-400">({cat.count})</span>
                        </div>

                        {/* Items or slim empty state */}
                        {cat.count === 0 ? (
                            // ─── Slim empty state (hover to reveal add) ──────
                            <div className="group flex items-center justify-between py-1.5 px-3 rounded-md border-l-2 border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors">
                                <span className="text-xs text-slate-300 dark:text-zinc-600">None scheduled</span>
                                <button
                                    onClick={() => cat.id === 'deadlines'
                                        ? openModal('newTask', null, { dueDate: selectedDate.toISOString(), openedFrom: 'calendar' })
                                        : openModal('newEvent', null, { date: selectedDate, openedFrom: 'calendar' })}
                                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-2xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                                >
                                    + Add
                                </button>
                            </div>
                        ) : (
                            // ─── Items ──────────────────────────────────────
                            <div className="space-y-2">
                                {cat.items.map((item: any) => {
                                    const isCourt = cat.id === 'court';
                                    const isDeadline = cat.id === 'deadlines';
                                    const bgClass = isCourt ? 'bg-[#FCE8E6] dark:bg-[#FCE8E6]/10 border-[#C5221F]/30'
                                        : isDeadline ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30'
                                        : 'bg-[#E8F0FE] dark:bg-[#E8F0FE]/10 border-[#1A73E8]/30';
                                    const textClass = isCourt ? 'text-[#C5221F]'
                                        : isDeadline ? 'text-amber-700 dark:text-amber-400'
                                        : 'text-[#1A73E8]';

                                    return (
                                        <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg ${bgClass} border cursor-pointer hover:shadow-sm transition-all`}
                                            onClick={() => cat.type === 'task' && !item.type ? openModal('editTask', item.id) : openModal('editEvent', item.id)}>
                                            <div className={`flex-shrink-0 text-xs font-mono font-bold ${textClass} w-12`}>
                                                {item.time ? formatTime(item.time) : item.date ? formatTime(item.date) : item.dueDate ? formatTime(item.dueDate) : '—'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold ${textClass} truncate`}>{item.title}</p>
                                                {item.location && <p className="text-xs text-slate-500 mt-0.5">{item.location}</p>}
                                                {item.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>}
                                                {item.assignedUsers && item.assignedUsers.length > 0 && <p className="text-2xs text-slate-400 mt-0.5">Assigned to {item.assignedUsers.length} person{item.assignedUsers.length > 1 ? 's' : ''}</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}

                {/* Quick add */}
                <div className="mt-8 pt-4 border-t border-slate-100 dark:border-zinc-800 flex gap-2">
                    <button
                        onClick={() => openModal('newEvent', null, { date: selectedDate, openedFrom: 'calendar' })}
                        className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-md text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                        + Add Event
                    </button>
                    <button
                        onClick={() => openModal('newTask', null, { dueDate: selectedDate.toISOString(), openedFrom: 'calendar' })}
                        className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-md text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                        + Add Task
                    </button>
                </div>
            </div>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════
// CalendarView — Premium executive planner
// ══════════════════════════════════════════════════════════════════════════
export const CalendarView: React.FC = () => {
    const { executionState } = useExecutionState();
    const { matterState } = useMatterState();
    const { coreState } = useCoreState();
    const { currentUser, updateCurrentUser } = useAuth();
    const { openModal, highlightTarget, currentHistoryEntry, updateCurrentHistoryEntry } = useUI();
    const { isLegal, hasPropertyFeatures } = useProduct();

    const selectedDate = currentHistoryEntry?.calendarDate || toLocalISOString(new Date());
    const propViewMode = currentHistoryEntry?.calendarViewMode || currentUser?.defaultViewModes?.calendar || 'month';
    const onDateSelect = (date: string) => updateCurrentHistoryEntry({ ...currentHistoryEntry, calendarDate: date });
    const onViewModeChange = (mode: 'month' | 'week' | 'diary') => updateCurrentHistoryEntry({ ...currentHistoryEntry, calendarViewMode: mode });

    const standardEvents = executionState.events || [];
    const properties = coreState.properties || [];
    // Use hasPropertyFeatures (true for Atrium AND Komplete) so Komplete firms
    // also see rent due dates and lease expirations on the calendar.
    // Previously used !isLegal which was false for Komplete (isLegal=true for unified).
    const virtualEvents = hasPropertyFeatures ? computeAtriumVirtualEvents(properties) : [];
    const events = [...standardEvents, ...virtualEvents];
    const eventTypes = coreState.eventTypes;
    const users = coreState.users;
    const props = { users };

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [localViewMode, setLocalViewMode] = useState<'month' | 'week' | 'diary'>(propViewMode);

    useEffect(() => { setLocalViewMode(propViewMode); }, [propViewMode]);

    const selectedDateObj = useMemo(() => parseDateString(selectedDate), [selectedDate]);
    const [currentMonthDate, setCurrentMonthDate] = useState(new Date(selectedDateObj));

    useEffect(() => { setCurrentMonthDate(new Date(selectedDateObj)); }, [selectedDate]);

    const daysInMonth = useMemo(() => {
        const year = currentMonthDate.getFullYear();
        const month = currentMonthDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const startGrid = new Date(firstDay);
        const dayOfWeek = startGrid.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startGrid.setDate(startGrid.getDate() - diff);
        const days = [];
        const iter = new Date(startGrid);
        for (let i = 0; i < 42; i++) { days.push(new Date(iter)); iter.setDate(iter.getDate() + 1); }
        return days;
    }, [currentMonthDate]);

    const expandedEvents = useMemo(() => {
        if (!daysInMonth || daysInMonth.length === 0) return [];
        const startExpansion = daysInMonth[0];
        const endExpansion = new Date(daysInMonth[daysInMonth.length - 1]);
        endExpansion.setHours(23, 59, 59, 999);
        return expandRecurringEvents(events, startExpansion, endExpansion);
    }, [events, daysInMonth]);

    useEffect(() => {
        if (highlightTarget?.filter?.id && scrollContainerRef.current) {
            const eventId = highlightTarget.filter.id;
            setTimeout(() => {
                const elementId = localViewMode === 'month' ? `event-month-${eventId}` : `event-tile-${eventId}`;
                const element = document.getElementById(elementId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (localViewMode !== 'month') {
                        const ringClass = highlightTarget.color === 'red' ? 'ring-red-500' : 'ring-primary-500';
                        element.classList.add('ring-2', 'ring-offset-2', ringClass, 'transition-all', 'duration-500');
                        setTimeout(() => element.classList.remove('ring-2', 'ring-offset-2', ringClass), 2000);
                    }
                }
            }, 300);
        }
    }, [localViewMode, highlightTarget, selectedDate]);

    const handleNav = (direction: 'prev' | 'next' | 'today') => {
        const todayStr = toLocalISOString(new Date());
        if (localViewMode === 'month') {
            if (direction === 'today') { setCurrentMonthDate(new Date()); onDateSelect(todayStr); }
            else { const newDate = new Date(currentMonthDate); newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1)); setCurrentMonthDate(newDate); }
        } else if (localViewMode === 'week') {
            if (direction === 'today') onDateSelect(todayStr);
            else { const newDate = new Date(selectedDateObj); newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7)); onDateSelect(toLocalISOString(newDate)); }
        } else {
            if (direction === 'today') onDateSelect(todayStr);
            else { const newDate = new Date(selectedDateObj); newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1)); onDateSelect(toLocalISOString(newDate)); }
        }
    };

    const handleViewSwitch = (mode: 'month' | 'week' | 'diary') => { setLocalViewMode(mode); onViewModeChange(mode); };
    const isLocked = localViewMode === currentUser?.defaultViewModes?.calendar;

    const weekDays = useMemo(() => {
        if (localViewMode !== 'week') return [selectedDateObj];
        const current = new Date(selectedDateObj);
        const day = current.getDay();
        const diff = current.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(current.setDate(diff));
        const days = [];
        for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(monday.getDate() + i); days.push(d); }
        return days;
    }, [selectedDateObj, localViewMode]);

    const today = new Date();
    const isToday = (d: Date) => d.toDateString() === today.toDateString();

    const getEventsForDay = (date: Date) => {
        const targetDateStr = date.toLocaleDateString('en-CA');
        return expandedEvents.filter(e => {
            if (!e.date) return false;
            // TIMEZONE FIX: parseDateString parses 'YYYY-MM-DD' as a LOCAL
            // date (new Date() treated it as UTC midnight — events showed a
            // day early west of Greenwich). Matches DiaryEventTile's parser.
            const eventDate = parseDateString(e.date);
            return eventDate.toLocaleDateString('en-CA') === targetDateStr;
        });
    };

    // Current time indicator position
    const currentTimeTop = (new Date().getHours() * 80) + (new Date().getMinutes() / 60 * 80) + 40;
    const currentTimeLabel = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 overflow-hidden">
            {/* ─── Header Toolbar — static, golden-ratio spacing ─────────── */}
            <div className="sticky top-0 z-30 glass flex-shrink-0 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-slate-100 dark:border-zinc-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-safe">
                {/* Date title + nav — aligned on center axis */}
                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex-1 min-w-0 truncate">
                        {localViewMode === 'month'
                            ? currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })
                            : localViewMode === 'week'
                                ? `${weekDays[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                : selectedDateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                        }
                    </h2>
                    <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-lg p-1 flex-shrink-0">
                        <button onClick={() => handleNav('prev')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors text-slate-500">
                            <ChevronRightIcon className="w-4 h-4 rotate-180" />
                        </button>
                        <button onClick={() => handleNav('today')} className="px-2 sm:px-3 py-1 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors">
                            Today
                        </button>
                        <button onClick={() => handleNav('next')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors text-slate-500">
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                {/* View switcher + new event */}
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
                        <button onClick={() => handleViewSwitch('month')} className={`p-1.5 rounded-lg transition-all ${localViewMode === 'month' ? 'bg-white dark:bg-zinc-700 shadow-sm text-primary-600' : 'text-slate-400'}`} aria-label="Month" title="Month">
                            <GridIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleViewSwitch('week')} className={`p-1.5 rounded-lg transition-all ${localViewMode === 'week' ? 'bg-white dark:bg-zinc-700 shadow-sm text-primary-600' : 'text-slate-400'}`} aria-label="Week" title="Week">
                            <ClockIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleViewSwitch('diary')} className={`p-1.5 rounded-lg transition-all ${localViewMode === 'diary' ? 'bg-white dark:bg-zinc-700 shadow-sm text-primary-600' : 'text-slate-400'}`} aria-label="Day" title="Day">
                            <ListIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <button onClick={() => openModal('newEvent', null, { date: selectedDateObj, openedFrom: 'calendar' })} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg font-bold text-sm hover:bg-primary-700 shadow-sm transition-all flex-shrink-0">
                        <PlusIcon className="w-4 h-4" /> <span className="hidden sm:inline">New</span>
                    </button>
                </div>
            </div>

            {/* ─── Main Content — seamless view swap ─────────────────────── */}
            <div className="flex-1 relative bg-white dark:bg-zinc-900 overflow-hidden flex flex-col">
                {localViewMode === 'month' ? (
                    /* ═══ MONTH VIEW — soft grid, pill indicators ═══ */
                    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pb-14 md:pb-0">
                        {/* Weekday headers — muted, premium */}
                        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 sticky top-0 z-20">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} className="py-2.5 text-center text-3xs sm:text-2xs font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-eyebrow select-none">
                                    {day}
                                </div>
                            ))}
                        </div>
                        {/* Calendar grid — no harsh vertical borders, subtle row separators */}
                        <div className="grid grid-cols-7 grid-rows-[repeat(6,1fr)] flex-1 min-h-0">
                            {daysInMonth.map((date) => {
                                const dayEvents = getEventsForDay(date);
                                const isCurrentMonth = date.getMonth() === currentMonthDate.getMonth();
                                return (
                                    <MonthDayCell
                                        key={date.toISOString()}
                                        date={date}
                                        events={dayEvents}
                                        isToday={isToday(date)}
                                        isCurrentMonth={isCurrentMonth}
                                        onDateClick={(dateStr) => { onDateSelect(dateStr); handleViewSwitch('diary'); }}
                                        onEventClick={(id, dateStr) => openModal('viewEvent', id, { openedFrom: 'calendar', instanceDate: dateStr })}
                                        eventTypes={eventTypes}
                                        highlightedEventId={highlightTarget?.view === 'calendar' ? highlightTarget.filter?.id : null}
                                        highlightColor={highlightTarget?.color}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ) : localViewMode === 'diary' ? (
                    /* ═══ DIARY MODE — chronological daily agenda for lawyers ═══
                       A clean, vertical chronological daily agenda view mimicking
                       a physical legal diary. Organized into sections:
                       1. Court Appearances & Fixtures
                       2. Statutory Deadlines
                       3. Office Tasks & Client Consultations */
                    <DiaryModeView
                        selectedDate={selectedDateObj}
                        events={events}
                        tasks={executionState.tasks || []}
                        openModal={openModal}
                        eventTypes={eventTypes}
                        users={props.users}
                    />
                ) : (
                    /* ═══ WEEK / DAY VIEW — timeline architecture ═══ */
                    <div ref={scrollContainerRef} className="flex-1 overflow-auto custom-scrollbar relative overscroll-contain pb-14 md:pb-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                        <div className="min-h-[1920px] flex w-full">
                            {/* Time sidebar — muted typography, centered */}
                            <div className="sticky left-0 w-10 sm:w-14 flex-shrink-0 border-r border-slate-50 dark:border-zinc-800/40 bg-white dark:bg-zinc-900 z-30">
                                <div className="h-10 border-b border-slate-50 dark:border-zinc-800/40 bg-white dark:bg-zinc-900/95 backdrop-blur-sm sticky top-0 z-40"></div>
                                {Array.from({ length: 24 }).map((_, i) => (
                                    <TimeSlot key={i} time={`${i === 0 ? 12 : i > 12 ? i - 12 : i}${i < 12 ? 'AM' : 'PM'}`} hourHeight={80} />
                                ))}
                            </div>

                            {/* Day columns */}
                            <div className="flex-1 relative min-h-full flex min-w-0 overflow-x-auto">
                                {weekDays.map((dayDate) => {
                                    const eventsForDay = getEventsForDay(dayDate);
                                    const isDayToday = isToday(dayDate);
                                    return (
                                        <div key={dayDate.toISOString()} className="flex-1 min-w-[100px] sm:min-w-[120px] relative border-r border-slate-50 dark:border-zinc-800/30 last:border-r-0 min-h-full">
                                            {/* Column header */}
                                            <div className="sticky top-0 z-20 h-10 bg-white dark:bg-zinc-900/95 border-b border-slate-50 dark:border-zinc-800/40 flex flex-col items-center justify-center backdrop-blur-sm">
                                                <span className={`text-3xs uppercase font-bold ${isDayToday ? 'text-primary-600' : 'text-slate-400 dark:text-zinc-500'}`}>
                                                    {dayDate.toLocaleDateString('en-GB', { weekday: 'short' })}
                                                </span>
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold ${isDayToday ? 'bg-primary-600 text-white' : 'text-slate-700 dark:text-zinc-300'}`}>
                                                    {dayDate.getDate()}
                                                </div>
                                            </div>

                                            {/* Grid lines — ultra subtle */}
                                            {Array.from({ length: 24 }).map((_, i) => (
                                                <div key={i} className="absolute w-full border-t border-slate-50 dark:border-zinc-800/20 pointer-events-none" style={{ top: (i * 80) + 40 }} />
                                            ))}

                                            {/* Current time indicator — pulsing dot + timestamp badge */}
                                            {isDayToday && (
                                                <div className="absolute w-full z-10 pointer-events-none" style={{ top: currentTimeTop }}>
                                                    <div className="absolute w-full border-t border-primary-500/60 top-0 left-0"></div>
                                                    <div className="absolute flex items-center gap-1 -left-1 -top-1.5">
                                                        <div className="w-2.5 h-2.5 bg-primary-500 rounded-full shadow-sm animate-pulse"></div>
                                                        <span className="text-3xs font-bold text-primary-600 bg-white dark:bg-zinc-900 px-1 rounded shadow-sm">{currentTimeLabel}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Events */}
                                            <div className="relative mt-10 h-full">
                                                {organizeEventsWithOverlaps(eventsForDay).map(({ event, columnIndex, columnCount, hasConflict }) => (
                                                    <DiaryEventTile
                                                        key={event.id}
                                                        event={event}
                                                        openModal={openModal}
                                                        eventTypes={eventTypes}
                                                        columnCount={columnCount}
                                                        columnIndex={columnIndex}
                                                        hasConflict={hasConflict}
                                                        allUsers={props.users}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CalendarView;
