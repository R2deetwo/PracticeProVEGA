
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Matter, CalendarEvent, Contact } from '../types';
import { parseDateString } from '../utils/calendarUtils';
import { SearchIcon, InfoIcon, DismissIcon, TimeTravelIcon, CalendarIcon } from '../constants';
import Tooltip from './Tooltip';
import EmptyState from './EmptyState';
import { useUI } from '../contexts/UIContext';
import { useMatterState } from '../contexts/MatterContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useCoreState } from '../contexts/CoreContext';

const PIXELS_PER_DAY = 30; 
const MONTH_HEADER_HEIGHT = 40;
const SIDEBAR_WIDTH = 256; // w-64

const TimelineView: React.FC = () => {
    const { matterState } = useMatterState();
    const { executionState } = useExecutionState();
    const { coreState } = useCoreState();
    const { openModal, navigateTo } = useUI();

    const matters = matterState.matters;
    const events = executionState.events || [];
    const contacts = matterState.contacts;
    const onNavigateToMatter = (id: string) => navigateTo('matterDetail', id);

    const [searchTerm, setSearchTerm] = useState('');
    const [showInfo, setShowInfo] = useState(true);

    const scrollRef = useRef<HTMLDivElement>(null);

    // 1. Define Timeline Range (Current Month - 1 to + 6)
    const { startDate, endDate, totalDays, months } = useMemo(() => {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1); // 1st of last month
        const end = new Date(today.getFullYear(), today.getMonth() + 6, 0);   // Last day of +5 months
        
        const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        
        const monthList = [];
        const iter = new Date(start);
        while (iter <= end) {
            monthList.push(new Date(iter));
            iter.setMonth(iter.getMonth() + 1);
        }

        return { startDate: start, endDate: end, totalDays: dayCount, months: monthList };
    }, []);

    // 2. Helper: Get X Position for a Date
    const getXPosition = (date: string | Date) => {
        const d = parseDateString(date);
        if (isNaN(d.getTime())) return 0;
        // Clamp date to range
        const effectiveDate = d < startDate ? startDate : (d > endDate ? endDate : d);
        const diffTime = effectiveDate.getTime() - startDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays * PIXELS_PER_DAY;
    };

    // 3. Filter & Group Matters
    const groupedMatters = useMemo(() => {
        const activeMatters = matters.filter(m => m.status === 'Active');
        
        // FIX: optional chaining on referenceNumber — a single legacy record
        // without it crashed the whole Timeline view (MatterList guards the
        // same field; this view didn't).
        const filtered = activeMatters.filter(m => 
            searchTerm === '' || 
            m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (m.referenceNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        const groups: Record<string, Matter[]> = {};
        filtered.forEach(m => {
            const type = m.type || 'Uncategorized';
            if (!groups[type]) groups[type] = [];
            groups[type].push(m);
        });
        return groups;
    }, [matters, searchTerm]);

    const hasMatters = Object.keys(groupedMatters).length > 0;
    const todayX = getXPosition(new Date());

    // Scroll to Today on Mount
    useEffect(() => {
        if (scrollRef.current) {
            // Center "Today"
            const containerWidth = scrollRef.current.clientWidth;
            scrollRef.current.scrollLeft = todayX - (containerWidth / 2) + (SIDEBAR_WIDTH / 2);
        }
    }, [todayX]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 overflow-hidden">
            <header className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                     <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Case Timeline</h2>
                     <div className="relative w-64">
                         <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                             <SearchIcon className="h-4 w-4" />
                         </div>
                         <input autoComplete="off" data-lpignore="true" 
                             type="text"
                             placeholder="Filter timeline..."
                             value={searchTerm}
                             onChange={(e) => setSearchTerm(e.target.value)}
                             className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all"
                         />
                     </div>
                </div>
                <div className="hidden lg:flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-zinc-400">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Today</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-2.5 bg-blue-200 dark:bg-blue-900/50 border border-blue-400 rounded-sm"></div> Active Phase</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-blue-500 rotate-45 transform"></div> Hearing</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-orange-500 rotate-45 transform"></div> Deadline</div>
                </div>
            </header>

            {/* Info Banner */}
            {showInfo && hasMatters && (
                <div className="flex-shrink-0 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 p-2 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-blue-800 dark:text-blue-200">
                        <InfoIcon className="w-4 h-4" />
                        <span><strong>Roadmap View:</strong> Bars represent the duration of the current stage. Diamonds mark critical dates.</span>
                    </div>
                    <button onClick={() => setShowInfo(false)} className="text-blue-500 hover:text-blue-700"><DismissIcon className="w-4 h-4" /></button>
                </div>
            )}

            {/* Main Content */}
            {!hasMatters ? (
                <div className="flex-grow p-8">
                     <EmptyState 
                        title={searchTerm ? "No Matches Found" : "No Active Matters"}
                        description={searchTerm ? `No active matters match "${searchTerm}".` : "Your timeline is empty because you don't have any active matters. Create a matter to see your roadmap."}
                        icon={<TimeTravelIcon />}
                        actionLabel={searchTerm ? "Clear Search" : "Create Matter"}
                        onAction={searchTerm ? () => setSearchTerm('') : () => openModal('newMatter')}
                    />
                </div>
            ) : (
                <div className="flex-grow flex overflow-hidden relative">
                    
                    {/* Sticky Sidebar (Matters List) */}
                    <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-20 overflow-y-hidden flex flex-col shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                        {/* Spacer for Timeline Header */}
                        <div style={{ height: MONTH_HEADER_HEIGHT }} className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex items-center px-4 font-bold text-xs text-slate-500 uppercase tracking-wider">
                            Matters
                        </div>
                        
                        {/* Matter List Container - syncs vertical scroll via main container if needed, but here we just list them */}
                        {/* Actually, better to let the main area scroll and just position these absolutely? No, simpler to just have a single scroll container for both if possible, but sticky headers are tricky. 
                            Strategy: Use a single container for everything, with sticky positioning for the sidebar.
                        */}
                    </div>

                    {/* Timeline Canvas (Horizontal Scroll) */}
                    <div 
                        ref={scrollRef}
                        className="flex-grow overflow-auto bg-slate-50/50 dark:bg-black/20 relative"
                    >
                         <div style={{ minWidth: totalDays * PIXELS_PER_DAY + SIDEBAR_WIDTH, position: 'relative' }}>
                            
                            {/* 1. Calendar Header (Sticky Top) */}
                            <div className="sticky top-0 z-10 flex bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800" style={{ height: MONTH_HEADER_HEIGHT, paddingLeft: SIDEBAR_WIDTH }}>
                                {months.map(month => {
                                    // Calculate width of this month in pixels
                                    const nextMonth = new Date(month);
                                    nextMonth.setMonth(month.getMonth() + 1);
                                    const daysInMonth = (nextMonth.getTime() - month.getTime()) / (1000 * 60 * 60 * 24);
                                    const width = daysInMonth * PIXELS_PER_DAY;
                                    
                                    return (
                                        <div 
                                            key={month.toISOString()} 
                                            style={{ width }} 
                                            className="flex-shrink-0 border-r border-slate-100 dark:border-zinc-800 px-2 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider truncate"
                                        >
                                            {month.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 2. Today Marker (Vertical Line) */}
                            <div 
                                className="absolute top-0 bottom-0 w-px bg-red-500 z-0 pointer-events-none"
                                style={{ left: SIDEBAR_WIDTH + todayX }}
                            >
                                <div className="sticky top-10 z-20 -ml-1.5 mt-1">
                                    <div className="w-3 h-3 bg-red-500 rounded-full shadow-sm ring-2 ring-white dark:ring-zinc-900" title="Today" />
                                </div>
                            </div>

                            {/* 3. Content Rows */}
                            <div className="relative">
                                {Object.entries(groupedMatters).map(([type, typeMatters]: [string, Matter[]]) => (
                                    <React.Fragment key={type}>
                                        {/* Group Header Row */}
                                        <div className="sticky left-0 z-10 w-full flex bg-slate-100/80 dark:bg-zinc-800/90 border-b border-slate-200 dark:border-zinc-800 backdrop-blur-sm">
                                            <div style={{ width: SIDEBAR_WIDTH }} className="px-4 py-1.5 text-2xs font-bold text-slate-500 uppercase tracking-wider truncate border-r border-slate-200 dark:border-zinc-800">
                                                {type} ({typeMatters.length})
                                            </div>
                                            <div className="flex-grow"></div> {/* Filler for timeline part */}
                                        </div>

                                        {/* Matter Rows */}
                                        {typeMatters.map(matter => {
                                            // Calculate visual range for the bar
                                            let stageDate = new Date(matter.stageLastUpdated);
                                            if (isNaN(stageDate.getTime())) stageDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Fallback
                                            
                                            // If stage update is BEFORE timeline start, cap it at start. If AFTER, use it.
                                            const barStart = stageDate < startDate ? startDate : stageDate;
                                            const barStartX = getXPosition(barStart);
                                            const barEndX = todayX; // Extends to today
                                            const barWidth = Math.max(4, barEndX - barStartX);
                                            
                                            const clientName = contacts.find(c => c.id === matter.clientId)?.name || 'Unknown';
                                            const matterEvents = events.filter(e => e.matterId === matter.id && e.status === 'Active');

                                            return (
                                                <div key={matter.id} className="flex h-14 border-b border-slate-100 dark:border-zinc-800/50 hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors group">
                                                    
                                                    {/* Sidebar Item (Sticky Left) */}
                                                    <div 
                                                        className="sticky left-0 z-10 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 flex-shrink-0 px-4 flex flex-col justify-center cursor-pointer group-hover:bg-slate-50 dark:group-hover:bg-zinc-800 transition-colors"
                                                        style={{ width: SIDEBAR_WIDTH }}
                                                        onClick={() => onNavigateToMatter(matter.id)}
                                                    >
                                                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate group-hover:text-primary-600 transition-colors">{matter.title}</div>
                                                        <div className="flex justify-between items-center mt-0.5">
                                                            <div className="text-2xs text-slate-400 truncate max-w-[60%]">{clientName}</div>
                                                            <div className="text-3xs px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded text-slate-500 dark:text-zinc-500">{matter.stage}</div>
                                                        </div>
                                                    </div>

                                                    {/* Timeline Track */}
                                                    <div className="flex-grow relative">
                                                        {/* Grid Lines Overlay */}
                                                        <div className="absolute inset-0 flex pointer-events-none">
                                                             {months.map(m => (
                                                                 <div key={m.toISOString()} style={{ width: (new Date(m.getFullYear(), m.getMonth()+1, 0).getDate()) * PIXELS_PER_DAY }} className="border-r border-slate-50 dark:border-zinc-800/50 h-full"></div>
                                                             ))}
                                                        </div>

                                                        {/* Stage Bar */}
                                                        <div 
                                                            className="absolute top-1/2 -translate-y-1/2 h-5 rounded bg-blue-200/60 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-800/50 flex items-center px-2 overflow-hidden transition-all hover:h-6 hover:bg-blue-300/60"
                                                            style={{ left: barStartX, width: barWidth }}
                                                        >
                                                            <span className="text-3xs font-bold text-blue-800 dark:text-blue-200 whitespace-nowrap opacity-75">{matter.stage}</span>
                                                        </div>

                                                        {/* Event Markers */}
                                                        {matterEvents.map(event => {
                                                            const eventX = getXPosition(event.date);
                                                            if (eventX < 0 || eventX > (totalDays * PIXELS_PER_DAY)) return null;
                                                            
                                                            const isHearing = event.type === 'Court Hearing' || event.type === 'Mention';
                                                            const colorClass = isHearing ? 'bg-blue-500 border-blue-600' : 'bg-orange-500 border-orange-600';

                                                            return (
                                                                <Tooltip key={event.id} text={`${event.type}: ${event.title} (${new Date(event.date).toLocaleDateString('en-GB')})`}>
                                                                    <div 
                                                                        className={`absolute top-1/2 -translate-y-1/2 -ml-1.5 w-3 h-3 rotate-45 ${colorClass} border shadow-sm cursor-pointer hover:scale-150 hover:z-50 transition-transform z-10 ring-2 ring-white dark:ring-zinc-900`}
                                                                        style={{ left: eventX }}
                                                                        onClick={() => openModal('viewEvent', event.id, { openedFrom: 'timeline' })}
                                                                    />
                                                                </Tooltip>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>

                         </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimelineView;
