
import React, { useMemo, useState } from 'react';
import { CalendarEvent, CustomEventType, Task } from '../types';
import { expandRecurringEvents, parseDateString } from '../utils/calendarUtils';
import { getEventTypeBadgeClass, getEventTypeColorClass, timeAgo } from '../utils/colorUtils';
import { getIconForEventType } from '../constants';
import { ChevronRightIcon, CalendarIcon, ClockIcon } from '../constants';

interface MiniCalendarProps {
    events: CalendarEvent[];
    eventTypes: CustomEventType[];
    onEventSelect: (eventId: string, date: string) => void;
    onViewFullCalendar?: (date: string) => void;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({ events, eventTypes, onEventSelect, onViewFullCalendar }) => {
    const today = new Date();
    const [currentDate, setCurrentDate] = useState(today);
    const [view, setView] = useState<'month' | 'day'>('month');
    const [activeDate, setActiveDate] = useState<Date | null>(null);
    const [isUpcomingExpanded, setIsUpcomingExpanded] = useState(false);

    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const firstDayGridIndex = (firstDayOfMonth.getDay() + 6) % 7;

    const eventsByDay = useMemo(() => {
        const gridStartDate = new Date(firstDayOfMonth);
        gridStartDate.setDate(gridStartDate.getDate() - firstDayGridIndex);
        const gridEndDate = new Date(gridStartDate);
        gridEndDate.setDate(gridEndDate.getDate() + 41);

        const expanded = expandRecurringEvents(events, gridStartDate, gridEndDate);
        const map = new Map<string, { events: CalendarEvent[], types: CustomEventType[] }>();

        expanded.forEach(event => {
            const dateObj = parseDateString(event.date);
            const dateKey = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
            const eventType = eventTypes.find(et => et.name === event.type);
            if (!map.has(dateKey)) {
                map.set(dateKey, { events: [], types: [] });
            }
            const dayData = map.get(dateKey)!;
            dayData.events.push(event);
            if (eventType && !dayData.types.some(et => et.id === eventType.id)) {
                dayData.types.push(eventType);
            }
        });

        // Sort events within each day
        for (const dayData of map.values()) {
            dayData.events.sort((a, b) => parseDateString(a.date).getTime() - parseDateString(b.date).getTime());
        }

        return map;
    }, [events, eventTypes, firstDayOfMonth, firstDayGridIndex]);

    const handleMonthNav = (direction: 'prev' | 'next') => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
            return newDate;
        });
    };

    const handleDateClick = (date: Date) => {
        setActiveDate(date);
        setView('day');
    };

    const activeDayKey = activeDate ? `${activeDate.getFullYear()}-${(activeDate.getMonth() + 1).toString().padStart(2, '0')}-${activeDate.getDate().toString().padStart(2, '0')}` : '';
    const activeDayEvents = activeDayKey ? eventsByDay.get(activeDayKey)?.events || [] : [];

    // Helper for safe time formatting
    const formatTimeSafe = (dateStr: string) => {
        const date = parseDateString(dateStr);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const renderMonthView = () => {
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const tomorrowKey = `${tomorrow.getFullYear()}-${(tomorrow.getMonth()+1).toString().padStart(2,'0')}-${tomorrow.getDate().toString().padStart(2,'0')}`;
        const tomorrowEvents = eventsByDay.get(tomorrowKey)?.events || [];

        const nextWeekEvents: CalendarEvent[] = [];
        for (let d = 2; d <= 7; d++) {
            const nd = new Date(today); nd.setDate(today.getDate() + d);
            const nk = `${nd.getFullYear()}-${(nd.getMonth()+1).toString().padStart(2,'0')}-${nd.getDate().toString().padStart(2,'0')}`;
            (eventsByDay.get(nk)?.events || []).forEach(e => nextWeekEvents.push(e));
        }

        return (
            <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
            {/* Headers */}
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-700/50 pb-1 mb-1 flex-shrink-0 uppercase tracking-wide">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div key={day} className="py-1">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 flex-shrink-0">
                {Array.from({ length: 42 }).map((_, index) => {
                    const day = index - firstDayGridIndex + 1;
                    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

                    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                    const isToday = date.toDateString() === today.toDateString();
                    const dayEventTypes = eventsByDay.get(dateKey)?.types || [];

                    return (
                        <div key={dateKey} className="py-0.5 flex justify-center items-center h-full">
                            <button
                                onClick={() => handleDateClick(date)}
                                className={`w-8 h-8 flex flex-col items-center justify-center rounded-full text-xs transition-colors relative
                                ${isCurrentMonth ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-700' : 'text-slate-300 dark:text-zinc-600'} 
                                ${isToday ? 'bg-primary-600 text-white font-bold hover:bg-primary-700' : ''}`}
                            >
                                <span>{date.getDate()}</span>
                                {isCurrentMonth && dayEventTypes.length > 0 && (
                                    <div className="flex -space-x-1 absolute bottom-1">
                                        {dayEventTypes.slice(0, 4).map((et, i) => (
                                            <div
                                                key={et.id}
                                                className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border border-white dark:border-zinc-800 shadow-sm ${getEventTypeColorClass(et.color)}`}
                                                style={{ zIndex: 4 - i }}
                                            ></div>
                                        ))}
                                    </div>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Upcoming drawer-like section: Consolidate Tomorrow & Next 7 days */}
            {(tomorrowEvents.length > 0 || nextWeekEvents.length > 0) && (
                <div className="mt-auto pt-3 flex-shrink-0">
                    <div className={`overflow-hidden transition-all duration-300 ${isUpcomingExpanded ? 'max-h-[300px]' : 'max-h-0'}`}>
                        {tomorrowEvents.length > 0 && (
                            <div className="mb-3 bg-slate-50 dark:bg-zinc-800/40 p-2.5 rounded-xl border border-slate-100/50 dark:border-zinc-700/50">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div> Tomorrow
                                </p>
                                {tomorrowEvents.slice(0, 2).map(e => (
                                    <button
                                        key={e.id}
                                        onClick={() => onEventSelect(e.id, e.date)}
                                        className="w-full text-left text-[10px] font-bold text-slate-700 dark:text-zinc-200 truncate px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-all flex items-center gap-2 group/item"
                                    >
                                        <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 transition-colors group-hover/item:bg-primary-500"></div>
                                        {e.title.replace(/⚡/g, '').replace(/CONFLICT: /g, '').trim()}
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        {nextWeekEvents.length > 0 && (
                            <div className="bg-primary-50/30 dark:bg-primary-900/10 p-2.5 rounded-xl border border-primary-100/50 dark:border-primary-900/30 mb-3">
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary-500 mb-1.5">Upcoming Week</p>
                                <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1 thin-scrollbar">
                                    {nextWeekEvents.map(e => (
                                        <button
                                            key={e.id}
                                            onClick={() => onEventSelect(e.id, e.date)}
                                            className="w-full text-left text-[10px] font-bold text-slate-700 dark:text-zinc-200 truncate px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-all border-l-2 border-transparent hover:border-primary-300"
                                        >
                                            · {e.title.replace(/⚡/g, '').replace(/CLASH: /g, '').trim()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={() => setIsUpcomingExpanded(!isUpcomingExpanded)}
                        className={`w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest transition-all px-3 py-2 rounded-xl
                            ${isUpcomingExpanded 
                                ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500' 
                                : 'bg-primary-600 text-white shadow-lg shadow-primary-500/20 active:scale-[0.98]'
                            }
                        `}
                    >
                        <div className="flex items-center gap-2">
                            <ClockIcon className="w-3 h-3" />
                            <span>{isUpcomingExpanded ? 'Overview' : `Upcoming Events (${tomorrowEvents.length + nextWeekEvents.length})`}</span>
                        </div>
                        <div className={`transition-transform duration-300 ${isUpcomingExpanded ? 'rotate-180' : 'rotate-0'}`}>
                            <ChevronRightIcon className="w-3 h-3 rotate-90" />
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
};

    const renderDayView = () => (
        <div className="flex flex-col h-full overflow-hidden animate-slide-in-right">
            {/* Isolated scrollable list — overscroll-contain prevents the parent page from bouncing */}
            <div
                className="overflow-y-auto pr-1 space-y-3 flex-grow custom-scrollbar"
                style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
            >
                {activeDayEvents.length > 0 ? activeDayEvents.map(event => {
                    const eventType = eventTypes.find(et => et.name === event.type);
                    const color = eventType?.color || 'gray';
                    const colorClass = getEventTypeColorClass(color);
                    
                    return (
                        <div 
                            key={event.id} 
                            onClick={() => onEventSelect(event.id, event.date)} 
                            className="group p-3 rounded-xl cursor-pointer bg-slate-50/50 dark:bg-zinc-800/30 border border-transparent hover:border-primary-200 dark:hover:border-primary-900/50 hover:bg-white dark:hover:bg-zinc-800 transition-all duration-300 shadow-sm hover:shadow-md"
                        >
                            <div className="flex items-start gap-4">
                                <div className={`w-1 h-10 rounded-full ${colorClass} shrink-0 opacity-80 group-hover:opacity-100 transition-opacity`}></div>
                                <div className="flex-grow min-w-0">
                                    <p className="font-bold text-sm tracking-tight text-slate-800 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                                        {event.title.replace(/⚡/g, '').replace(/CLASH: /g, '').trim()}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-700 text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                                            <ClockIcon className="w-3 h-3" />
                                            {formatTimeSafe(event.date)}
                                        </div>
                                        {event.matterId && (
                                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 truncate font-medium">
                                                Matter Case Ref
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center">
                                    <ChevronRightIcon className="w-4 h-4 text-primary-500" />
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                        <CalendarIcon className="w-10 h-10 mb-2" />
                        <p className="text-sm font-medium">No events for this day</p>
                    </div>
                )}
                {/* Bottom padding so last item isn't cut off */}
                <div className="h-4 flex-shrink-0" />
            </div>
        </div>
    );

    return (
        <div className="glass-premium p-4 flex flex-col h-full halo-hover rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 dark:border-zinc-700/50 flex-shrink-0">
                <div className="flex items-center gap-3">
                    {view === 'day' ? (
                        <button 
                            onClick={() => {
                                setView('month');
                                setActiveDate(null);
                            }} 
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 transition-colors"
                            title="Back to Month"
                        >
                            <ChevronRightIcon className="w-4 h-4 rotate-180" />
                        </button>
                    ) : (
                        <div className="p-1.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-primary-600">
                             <CalendarIcon className="w-4 h-4" />
                        </div>
                    )}
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                        {view === 'month'
                            ? currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
                            : activeDate?.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                        }
                    </h4>
                </div>

                <div className="flex items-center gap-1">
                    {view === 'month' ? (
                        <>
                            <button onClick={() => handleMonthNav('prev')} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-400 hover:text-slate-600 transition-colors">&lt;</button>
                            <button 
                                onClick={() => setCurrentDate(today)} 
                                className="px-2 py-0.5 text-[10px] font-bold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-md transition-colors"
                            >
                                TODAY
                            </button>
                            <button onClick={() => handleMonthNav('next')} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-400 hover:text-slate-600 transition-colors">&gt;</button>
                        </>
                    ) : (
                        onViewFullCalendar && activeDate && (
                            <button
                                onClick={() => onViewFullCalendar(activeDate.toISOString())}
                                className="px-3 py-1 bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200 rounded-full font-bold text-[10px] hover:bg-primary-200 dark:hover:bg-primary-900/60 transition-colors flex items-center gap-1.5"
                            >
                                <CalendarIcon className="w-3 h-3" />
                                FULL VIEW
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Content Area with simple transition */}
            <div className="flex-grow min-h-0 relative">
                <div key={view} className="h-full w-full animate-fade-in">
                    {view === 'month' ? renderMonthView() : renderDayView()}
                </div>
            </div>
        </div>
    );
};

export default MiniCalendar;
