
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

// --- HELPER COMPONENTS ---

const TimeSlot: React.FC<{ time: string, hourHeight: number }> = ({ time, hourHeight }) => (
    <div className="relative flex items-start -mt-[1px]" style={{ height: `${hourHeight}px` }}>
        <div className="text-[10px] sm:text-xs text-right w-10 sm:w-12 pr-1 sm:pr-2 text-slate-400 dark:text-zinc-500 select-none font-medium pt-1">{time}</div>
        <div className="flex-1 border-t border-slate-100 dark:border-zinc-800 z-0"></div>
    </div>
);

// Helper to ensure dates are formatted as YYYY-MM-DD in LOCAL time, ignoring UTC offsets
const toLocalISOString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Algorithm to detect and position overlapping events in the time grid
const organizeEventsWithOverlaps = (dayEvents: CalendarEvent[]) => {
    if (dayEvents.length === 0) return [];

    // 1. Sort by start pool
    const sorted = [...dayEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const results: { event: CalendarEvent; columnCount: number; columnIndex: number; hasConflict: boolean }[] = [];
    const clusters: CalendarEvent[][] = [];

    // Group events into "clusters" that overlap in any way (connected components)
    sorted.forEach(event => {
        const start = new Date(event.date).getTime();
        // Assume 1 hour if end date is missing for overlap calculation purposes
        const end = event.endDate ? new Date(event.endDate).getTime() : start + 3600000;

        // Find if this event belongs to an existing cluster
        let foundClusterIndex = -1;
        for (let i = 0; i < clusters.length; i++) {
            const overlaps = clusters[i].some(ce => {
                const cs = new Date(ce.date).getTime();
                const ce_end = ce.endDate ? new Date(ce.endDate).getTime() : cs + 3600000;
                return start < ce_end && end > cs;
            });
            if (overlaps) {
                foundClusterIndex = i;
                break;
            }
        }

        if (foundClusterIndex !== -1) {
            clusters[foundClusterIndex].push(event);
        } else {
            clusters.push([event]);
        }
    });

    // For each cluster, assign columns (simple greedy pack)
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

            if (colIndex === -1) {
                columns.push([event]);
                colIndex = columns.length - 1;
            } else {
                columns[colIndex].push(event);
            }

            // Conflict detection: does any other event in this cluster share an assigned user AND overlap?
            const hasConflict = cluster.some(other => {
                if (other.id === event.id) return false;
                const os = new Date(other.date).getTime();
                const oe = other.endDate ? new Date(other.endDate).getTime() : os + 3600000;
                const overlaps = start < oe && end > os;
                if (!overlaps) return false;

                // Check common users
                const users1 = event.assignedUsers || [];
                const users2 = other.assignedUsers || [];
                return users1.some(u => users2.includes(u));
            });

            clusterResults.push({
                event,
                columnIndex: colIndex,
                hasConflict
            });
        });

        // Update columnCount for all events in this cluster based on max columns used
        clusterResults.forEach(res => {
            results.push({
                ...res,
                columnCount: columns.length
            });
        });
    });

    return results;
};

// Simplified Day Cell for Month View (Visual Block Logic)
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

    // Helper for highlight color
    const getHighlightRing = (color?: string) => {
        if (!color) return 'ring-red-500';
        const map: any = { red: 'ring-red-500', blue: 'ring-blue-500', orange: 'ring-orange-500', green: 'ring-emerald-500' };
        return map[color] || 'ring-primary-500';
    };

    // Limit displayed events to prevent overflow
    const DISPLAY_LIMIT = 3;
    const visibleEvents = events.slice(0, DISPLAY_LIMIT);
    const hiddenCount = Math.max(0, events.length - DISPLAY_LIMIT);
    const dateStr = toLocalISOString(date);

    // Get unique event type colors for the dot cluster
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
                relative p-1 border-r border-b border-slate-200 dark:border-zinc-800 flex flex-col min-h-[100px] sm:min-h-[120px] cursor-pointer transition-all duration-300
                ${isCurrentMonth ? 'bg-white dark:bg-zinc-900' : 'bg-slate-50/50 dark:bg-zinc-800/20'}
                hover:bg-primary-50/30 dark:hover:bg-primary-900/10 hover:z-10 group
            `}
        >
            <div className="flex justify-between items-center mb-1">
                <span className={`
                    flex items-center justify-center w-7 h-7 text-xs font-bold rounded-full transition-transform duration-300 group-hover:scale-110
                    ${isToday 
                        ? 'bg-primary-600 text-white shadow-lg' 
                        : isCurrentMonth 
                            ? 'text-slate-700 dark:text-slate-200' 
                            : 'text-slate-300 dark:text-zinc-600'}
                `}>
                    {date.getDate()}
                </span>
                
                {uniqueColors.length > 0 && (
                    <div className="flex -space-x-1.5 pr-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {uniqueColors.slice(0, 3).map((colorClass, idx) => (
                            <div key={idx} className={`w-2 h-2 rounded-full border border-white dark:border-zinc-800 shadow-sm ${colorClass}`} style={{ zIndex: 5 - idx }}></div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-1 space-y-1 min-w-0 pr-1">
                {visibleEvents.map(event => {
                    const et = eventTypes.find(t => t.name === event.type);
                    const colorClass = getEventTypeColorClass(et?.color || 'gray');
                    const isHighlighted = highlightedEventId === event.id;
                    return (
                        <div
                            key={event.id}
                            id={`event-month-${event.id}`}
                            onClick={(e) => { e.stopPropagation(); onEventClick(event.id, dateStr); }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold truncate transition-all hover:translate-x-0.5 shadow-sm active:scale-95 ${colorClass} bg-opacity-10 border-l-2 ${isHighlighted ? `ring-2 ring-offset-1 dark:ring-offset-zinc-900 ${getHighlightRing(highlightColor)} animate-pulse` : ''}`}
                        >
                            {event.title}
                        </div>
                    );
                })}

                {/* Mobile: clustered overlapping dots by event type */}
                {events.length > 0 && (
                    <div className="sm:hidden flex justify-center mt-0.5">
                        <div className="flex -space-x-1">
                            {uniqueColors.slice(0, 4).map((colorClass, i) => (
                                <div
                                    key={i}
                                    className={`w-2 h-2 rounded-full border border-white dark:border-zinc-900 ${colorClass}`}
                                    style={{ zIndex: 4 - i }}
                                />
                            ))}
                            {events.length > 4 && (
                                <div className="w-2 h-2 rounded-full border border-white dark:border-zinc-900 bg-slate-400 flex items-center justify-center" style={{ zIndex: 0 }}>
                                </div>
                            )}
                        </div>
                        {events.length > 1 && (
                            <span className="ml-1 text-[8px] font-bold text-slate-400 self-center">{events.length}</span>
                        )}
                    </div>
                )}

                {hiddenCount > 0 && (
                    <div className="text-[10px] text-slate-400 font-medium pl-1 hidden sm:block">
                        +{hiddenCount} more
                    </div>
                )}
            </div>
        </div >
    );
};

// Diary View Tile (Time-based positioning)
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

    // Fallback if end time is missing or invalid (same as start time)
    if (endHour <= startHour) {
        endHour = startHour + 1; // Default 1 hour duration visually
    }

    const duration = Math.max(0.75, endHour - startHour); // Minimum 45 mins visual for monikers

    const top = startHour * 80; // 80px per hour
    const height = duration * 80;

    const eventType = eventTypes.find(et => et.name === event.type);
    const color = eventType?.color || 'gray';
    const tileColorClass = getEventTypeBadgeClass(color, 'calendar-tile');

    // Width logic for Week View vs Day View
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
                absolute rounded-lg p-2 border-l-4 shadow-sm cursor-pointer transition-all hover:z-50 hover:scale-[1.01] hover:shadow-lg
                ${tileColorClass}
                ${hasConflict ? 'ring-2 ring-red-400/50 ring-offset-1 dark:ring-offset-zinc-900 border-dashed border-red-500 animate-pulsate-subtle' : ''}
            `}
            style={{
                top: `${top}px`,
                height: `${height}px`,
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                zIndex: 10 + columnIndex // Ensure later overlaps are slightly above by default but hover wins
            }}
            title={`${event.title} (${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()})${hasConflict ? ' - CONFLICT: Overlapping schedule for team member' : ''}`}
        >
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-[11px] leading-tight truncate flex items-center gap-1">
                        {hasConflict && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse" />}
                        {event.title}
                    </p>
                    <p className="text-[9px] opacity-70 truncate font-medium mt-0.5">
                        {startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
                </div>

                {/* Team Monikers at bottom */}
                {assignedTeamMembers.length > 0 && (
                    <div className="mt-auto pt-1 flex -space-x-1.5 overflow-hidden">
                        {assignedTeamMembers.slice(0, 4).map((user, idx) => (
                            <div
                                key={user.id}
                                title={user.name}
                                className={`
                                    w-5 h-5 rounded-full border-2 border-white dark:border-zinc-800 flex items-center justify-center text-[7px] font-bold text-white shrink-0 shadow-sm
                                    ${getUserColor(user.name)}
                                `}
                                style={{ zIndex: 10 - idx }}
                            >
                                {user.avatarUrl ? (
                                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    getInitials(user.name)
                                )}
                            </div>
                        ))}
                        {assignedTeamMembers.length > 4 && (
                            <div className="w-5 h-5 rounded-full border-2 border-white dark:border-zinc-800 bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-[7px] font-bold text-slate-600 dark:text-zinc-400 shrink-0 z-0">
                                +{assignedTeamMembers.length - 4}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


export const CalendarView: React.FC = () => {
    const { executionState } = useExecutionState();
    const { matterState } = useMatterState();
    const { coreState } = useCoreState();
    const { currentUser, updateCurrentUser } = useAuth();
    const { openModal, highlightTarget, currentHistoryEntry, updateCurrentHistoryEntry } = useUI();
    const { isLegal } = useProduct();
    
    const selectedDate = currentHistoryEntry?.calendarDate || toLocalISOString(new Date());
    const propViewMode = currentHistoryEntry?.calendarViewMode || currentUser?.defaultViewModes?.calendar || 'month';
    const onDateSelect = (date: string) => updateCurrentHistoryEntry({ ...currentHistoryEntry, calendarDate: date });
    const onViewModeChange = (mode: 'month' | 'week' | 'diary') => updateCurrentHistoryEntry({ ...currentHistoryEntry, calendarViewMode: mode });

    const standardEvents = executionState.events || [];
    const properties = coreState.properties || [];
    const virtualEvents = !isLegal ? computeAtriumVirtualEvents(properties) : [];
    const events = [...standardEvents, ...virtualEvents];
    
    const eventTypes = coreState.eventTypes;
    const users = coreState.users;
    const props = { users }; // For DiaryEventTile which needs props.users 

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Internal state to manage view switching immediately
    const [localViewMode, setLocalViewMode] = useState<'month' | 'week' | 'diary'>(propViewMode);

    // If prop changes (e.g. from sidebar), sync local state
    useEffect(() => {
        setLocalViewMode(propViewMode);
    }, [propViewMode]);

    const selectedDateObj = useMemo(() => parseDateString(selectedDate), [selectedDate]);
    const [currentMonthDate, setCurrentMonthDate] = useState(new Date(selectedDateObj));

    // Ensure calendar matches selected date on load
    useEffect(() => {
        setCurrentMonthDate(new Date(selectedDateObj));
    }, [selectedDate]);

    // --- MONTH VIEW DATA PREP ---
    const daysInMonth = useMemo(() => {
        const year = currentMonthDate.getFullYear();
        const month = currentMonthDate.getMonth();
        const firstDay = new Date(year, month, 1);

        // Calculate start of grid (previous month padding)
        const startGrid = new Date(firstDay);
        const dayOfWeek = startGrid.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon=0
        startGrid.setDate(startGrid.getDate() - diff);

        const days = [];
        const iter = new Date(startGrid);

        // Generate 42 days (6 weeks) to cover any month layout
        for (let i = 0; i < 42; i++) {
            days.push(new Date(iter));
            iter.setDate(iter.getDate() + 1);
        }
        return days;
    }, [currentMonthDate]);

    // EXPAND RECURRING EVENTS FOR THE CURRENT VIEW
    const expandedEvents = useMemo(() => {
        if (!daysInMonth || daysInMonth.length === 0) return [];
        // Define expansion range based on the visible grid
        const startExpansion = daysInMonth[0];
        const endExpansion = new Date(daysInMonth[daysInMonth.length - 1]);
        endExpansion.setHours(23, 59, 59, 999);

        return expandRecurringEvents(events, startExpansion, endExpansion);
    }, [events, daysInMonth]);

    // Handle Scrolling to Highlighted Event (e.g. from Dashboard)
    useEffect(() => {
        if (highlightTarget?.filter?.id && scrollContainerRef.current) {
            const eventId = highlightTarget.filter.id;
            // Delay slightly to ensure render
            setTimeout(() => {
                // Determine ID prefix based on view mode
                const elementId = localViewMode === 'month' ? `event-month-${eventId}` : `event-tile-${eventId}`;
                const element = document.getElementById(elementId);
                
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Month view handles its own highlight classes via React state
                    if (localViewMode !== 'month') {
                        const ringClass = highlightTarget.color === 'red' ? 'ring-red-500' : 'ring-primary-500';
                        element.classList.add('ring-2', 'ring-offset-2', ringClass, 'transition-all', 'duration-500');
                        setTimeout(() => element.classList.remove('ring-2', 'ring-offset-2', ringClass), 2000);
                    }
                }
            }, 300);
        }
    }, [localViewMode, highlightTarget, selectedDate]);

    // --- NAVIGATION LOGIC ---
    const handleNav = (direction: 'prev' | 'next' | 'today') => {
        const todayStr = toLocalISOString(new Date());

        if (localViewMode === 'month') {
            if (direction === 'today') {
                setCurrentMonthDate(new Date());
                onDateSelect(todayStr);
            } else {
                const newDate = new Date(currentMonthDate);
                newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
                setCurrentMonthDate(newDate);
            }
        } else if (localViewMode === 'week') {
            if (direction === 'today') {
                onDateSelect(todayStr);
            } else {
                const newDate = new Date(selectedDateObj);
                newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
                onDateSelect(toLocalISOString(newDate));
            }
        } else {
            // Diary View (Day navigation)
            if (direction === 'today') {
                onDateSelect(todayStr);
            } else {
                const newDate = new Date(selectedDateObj);
                newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
                onDateSelect(toLocalISOString(newDate));
            }
        }
    };

    const handleViewSwitch = (mode: 'month' | 'week' | 'diary') => {
        setLocalViewMode(mode);
        onViewModeChange(mode);
    };

    const isLocked = localViewMode === currentUser?.defaultViewModes?.calendar;

    // --- WEEK VIEW DATA PREP ---
    const weekDays = useMemo(() => {
        if (localViewMode !== 'week') return [selectedDateObj]; // If day view, just today

        const current = new Date(selectedDateObj);
        const day = current.getDay();
        const diff = current.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday

        const monday = new Date(current.setDate(diff));
        const days = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            days.push(d);
        }
        return days;
    }, [selectedDateObj, localViewMode]);

    // --- RENDER ---
    const today = new Date();
    const isToday = (d: Date) => d.toDateString() === today.toDateString();

    // Robust Filter: String-based Comparison to avoid Timezone slips
    const getEventsForDay = (date: Date) => {
        const targetDateStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD local
        return expandedEvents.filter(e => {
            if (!e.date) return false;
            // Parse event date string to local YYYY-MM-DD
            const eventDate = new Date(e.date);
            const eventDateStr = eventDate.toLocaleDateString('en-CA');
            return eventDateStr === targetDateStr;
        });
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 overflow-hidden">
            {/* Header Toolbar - Fixed at the top */}
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-3 sm:py-4 px-3 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-safe">
                {/* Date Navigation */}
                <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                    <h2 className="text-base sm:text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex-1 min-w-0 truncate">
                        {localViewMode === 'month'
                            ? currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })
                            : localViewMode === 'week'
                                ? `${weekDays[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${weekDays[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                : selectedDateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                        }
                    </h2>
                    <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-lg p-1 border border-slate-200 dark:border-zinc-700 flex-shrink-0">
                        <button onClick={() => handleNav('prev')} className="active-press touch-target p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-colors text-slate-500">
                            <ChevronRightIcon className="w-5 h-5 rotate-180" />
                        </button>
                        <button onClick={() => handleNav('today')} className="active-press px-2 sm:px-3 py-1 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-colors">
                            Today
                        </button>
                        <button onClick={() => handleNav('next')} className="active-press touch-target p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-colors text-slate-500">
                            <ChevronRightIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* View Switcher & Action */}
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg border border-slate-200 dark:border-zinc-700">
                        <button
                            onClick={() => handleViewSwitch('month')}
                            className={`active-press touch-target p-2 rounded-md transition-all ${localViewMode === 'month' ? 'bg-white dark:bg-zinc-700 shadow text-primary-600' : 'text-slate-400'}`}
                            title="Month View"
                        >
                            <GridIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleViewSwitch('week')}
                            className={`active-press touch-target p-2 rounded-md transition-all ${localViewMode === 'week' ? 'bg-white dark:bg-zinc-700 shadow text-primary-600' : 'text-slate-400'}`}
                            title="Week View"
                        >
                            <ClockIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleViewSwitch('diary')}
                            className={`active-press touch-target p-2 rounded-md transition-all ${localViewMode === 'diary' ? 'bg-white dark:bg-zinc-700 shadow text-primary-600' : 'text-slate-400'}`}
                            title="Day View"
                        >
                            <ListIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        onClick={() => openModal('newEvent', null, { date: selectedDateObj, openedFrom: 'calendar' })}
                        className="active-press-lg flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg font-bold text-sm hover:bg-primary-700 shadow-md transition-all flex-shrink-0"
                    >
                        <PlusIcon className="w-4 h-4" /> <span className="hidden sm:inline">New</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area - Scrollable */}
            <div className="flex-1 relative bg-white dark:bg-zinc-900 overflow-hidden flex flex-col">
                {localViewMode === 'month' ? (
                    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
                        {/* Weekday Headers */}
                        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-20 shadow-sm">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} className="py-3 text-center text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] select-none">
                                    {day}
                                </div>
                            ))}
                        </div>
                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 grid-rows-[repeat(6,1fr)] flex-1 min-h-0 border-l border-slate-200 dark:border-zinc-800">
                            {daysInMonth.map((date, index) => {
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
                ) : (
                    <div ref={scrollContainerRef} className="flex-1 overflow-auto custom-scrollbar relative overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                        {/* Diary / Week View (Time Grid) — mobile: horizontal scroll for week, single column for day */}
                        <div className="min-h-[1920px] flex w-full">

                            {/* Time Sidebar - Sticky Left */}
                            <div className="sticky left-0 w-12 sm:w-16 flex-shrink-0 border-r border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-30">
                                <div className="h-10 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/90 backdrop-blur-sm sticky top-0 z-40"></div>
                                {Array.from({ length: 24 }).map((_, i) => (
                                    <TimeSlot key={i} time={`${i === 0 ? 12 : i > 12 ? i - 12 : i}${i < 12 ? 'AM' : 'PM'}`} hourHeight={80} />
                                ))}
                            </div>

                            {/* Days Columns — on mobile, allow horizontal scroll for week view */}
                            <div className="flex-1 relative min-h-full flex min-w-0 overflow-x-auto">
                                {weekDays.map((dayDate, index) => {
                                    const eventsForDay = getEventsForDay(dayDate);
                                    const isDayToday = isToday(dayDate);

                                    return (
                                        <div key={dayDate.toISOString()} className="flex-1 min-w-[100px] sm:min-w-[120px] relative border-r border-slate-100 dark:border-zinc-800 last:border-r-0 min-h-full">

                                            {/* Column Header */}
                                            <div className="sticky top-0 z-20 h-10 bg-slate-50 dark:bg-zinc-900/90 border-b border-slate-200 dark:border-zinc-800 flex flex-col items-center justify-center backdrop-blur-sm">
                                                <span className={`text-[10px] uppercase font-bold ${isDayToday ? 'text-primary-600' : 'text-slate-500'}`}>
                                                    {dayDate.toLocaleDateString('en-GB', { weekday: 'short' })}
                                                </span>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDayToday ? 'bg-primary-600 text-white' : 'text-slate-800 dark:text-white'}`}>
                                                    {dayDate.getDate()}
                                                </div>
                                            </div>

                                            {/* Grid Lines per column */}
                                            {Array.from({ length: 24 }).map((_, i) => (
                                                <div key={i} className="absolute w-full border-t border-slate-100 dark:border-zinc-800/50 pointer-events-none" style={{ top: (i * 80) + 40 }}></div> // +40 for header
                                            ))}

                                            {/* Current Time Indicator (Only if today) */}
                                            {isDayToday && (
                                                <div
                                                    className="absolute w-full z-10 pointer-events-none"
                                                    style={{ top: ((new Date().getHours() * 80) + (new Date().getMinutes() / 60 * 80)) + 40 }}
                                                >
                                                    <div className="absolute w-full border-t-2 border-red-500 top-0 left-0"></div>
                                                    <div className="absolute w-2 h-2 bg-red-500 rounded-full -ml-1 -top-1 shadow-sm left-0"></div>
                                                </div>
                                            )}

                                            {/* Events Container (Offset by Header) */}
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
        </div >
    );
};
