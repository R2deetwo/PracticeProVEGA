import React from 'react';
// FIX: Corrected relative import path for types.
import { CalendarEvent, CustomEventType, Matter, User } from '../../types';
import { getEventTypeBadgeClass, getInitials, getUserColor } from '../../utils/colorUtils';
import { PlusIcon, CalendarIcon, ClockIcon, WarningIcon } from '../../constants';

interface EventDetailModalProps {
  event: CalendarEvent;
  matters: Matter[];
  users: User[];
  eventTypes: CustomEventType[];
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
  onNavigateToMatter?: (matterId: string, eventId: string) => void;
  onNavigateToCalendar?: (date: string, eventId: string) => void;
  openedFrom?: 'calendar' | 'matterDetail';
  hasConflict?: boolean;
}

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-1 text-md text-gray-900 dark:text-white">{value}</div>
    </div>
);

const formatRecurrence = (recurrence?: CalendarEvent['recurrence']) => {
  if (!recurrence) return 'None';
  let text = `Repeats ${recurrence.frequency}`;
  if (recurrence.endDate) {
    text += ` until ${new Date(recurrence.endDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  }
  return text;
};

const formatReminder = (reminder?: CalendarEvent['reminder']) => {
  if (!reminder) return 'None';
  return `${reminder.value} ${reminder.unit} before`;
};

const safeFormatDate = (date: string | Date, options: Intl.DateTimeFormatOptions) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Invalid Date";
    return d.toLocaleDateString('en-GB', options);
};

const safeFormatTime = (date: string | Date, options: Intl.DateTimeFormatOptions) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Invalid Time";
    return d.toLocaleTimeString('en-US', options);
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, matters, users, eventTypes, onEdit, onDelete, onAssign, onNavigateToMatter, onNavigateToCalendar, openedFrom, hasConflict }) => {
    
  const getColorForEventType = (typeName: string) => {
    return eventTypes.find(et => et.name === typeName)?.color || 'gray';
  };

  const eventTypeColor = getColorForEventType(event.type);
  const isCourtEvent = event.type === 'Court Hearing' || event.type === 'Mention';
  
  const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const startTime = safeFormatTime(event.date, timeOptions);
  const endTime = event.endDate ? safeFormatTime(event.endDate, timeOptions) : '';
  const timeString = endTime && startTime !== endTime ? `${startTime} - ${endTime}` : startTime;
  
  const assignedUsers = React.useMemo(() => {
    let userIds = event.assignedUsers || [];
    if (userIds.length === 0 && event.matterId) {
        const matter = matters.find(m => m.id === event.matterId);
        userIds = matter?.assignedUsers || [];
    }
    return userIds.map(id => users.find(u => u.id === id)).filter(Boolean) as User[];
  }, [event, users, matters]);
    
  return (
    <div className="space-y-6 pb-2">
        {hasConflict && (
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 text-orange-800 dark:text-orange-200 rounded-r-xl animate-fade-in shadow-sm">
                <p className="font-black text-xs uppercase tracking-widest flex items-center gap-1.5"><WarningIcon className="w-4 h-4" /> Scheduling Conflict Detected</p>
                <p className="text-sm mt-1 opacity-90">This event overlaps with another scheduled item for at least one team member. Consider rescheduling.</p>
            </div>
        )}

        <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-zinc-700/50 pb-4">
             <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 text-2xs font-black uppercase tracking-widest rounded-md ${getEventTypeBadgeClass(eventTypeColor)}`}>
                    {event.type}
                </span>
                {event.recurrence && (
                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-2xs font-black uppercase tracking-widest rounded-md">
                        RECURRING
                    </span>
                )}
             </div>
             <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight leading-tight">
                {event.title}
             </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-zinc-800/20 p-4 rounded-2xl border border-slate-100 dark:border-zinc-700/30">
             <div className="flex items-start gap-3">
                <div className="p-2 bg-white dark:bg-zinc-700 rounded-lg shadow-sm text-primary-600">
                    <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                   <p className="text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-0.5">DATE</p>
                   <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {safeFormatDate(event.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                   </p>
                </div>
             </div>
             <div className="flex items-start gap-3">
                <div className="p-2 bg-white dark:bg-zinc-700 rounded-lg shadow-sm text-primary-600">
                    <ClockIcon className="w-5 h-5" />
                </div>
                <div>
                   <p className="text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-0.5">TIME</p>
                   <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{timeString}</p>
                </div>
             </div>
        </div>

        {event.description && (
            <div className="space-y-2">
                <p className="text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] px-1">NOTES</p>
                <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl text-sm text-slate-700 dark:text-slate-300 shadow-sm leading-relaxed italic">
                    {event.description}
                </div>
            </div>
        )}

        {event.matterTitle && (
            <div className="p-4 glass-premium rounded-2xl flex items-center justify-between border-l-4 border-l-primary-500">
                <div className="min-w-0">
                    <p className="text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-1">ASSOCIATED MATTER</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate pr-4">{event.matterTitle}</p>
                </div>
                {openedFrom === 'calendar' && event.matterId && onNavigateToMatter && (
                     <button type="button" onClick={() => onNavigateToMatter(event.matterId!, event.id)} className="px-3 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-lg text-3xs font-black uppercase tracking-widest hover:bg-primary-600 hover:text-white transition-all">
                        OPEN
                    </button>
                )}
            </div>
        )}

        <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
                <p className="text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em]">ASSIGNED TEAM</p>
                <button onClick={onAssign} className="text-2xs font-black text-primary-600 hover:underline uppercase tracking-widest">ASSIGN NEW</button>
            </div>
            <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl flex items-center justify-between">
                {assignedUsers.length > 0 ? (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center -space-x-2">
                            {assignedUsers.slice(0, 5).map(user => (
                                <div key={user.id} title={user.name} className={`h-8 w-8 rounded-full ring-4 ring-white dark:ring-zinc-900 flex items-center justify-center text-white font-bold text-xs shadow-sm ${getUserColor(user.name)}`}>
                                    {getInitials(user.name)}
                                </div>
                            ))}
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                            {assignedUsers.length === 1 ? '1 Lead assigned' : `${assignedUsers.length} Members assigned`}
                        </span>
                    </div>
                ) : (
                    <p className="text-xs text-slate-400 italic">No team members assigned yet.</p>
                )}
            </div>
        </div>

        {isCourtEvent && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50/50 dark:bg-zinc-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-700">
                <div>
                     <p className="text-3xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">COURT</p>
                     <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{event.court || 'N/A'}</p>
                </div>
                <div>
                     <p className="text-3xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">DIVISION</p>
                     <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{event.judicialDivision || 'N/A'}</p>
                </div>
            </div>
        )}

        <div className="flex justify-between items-center py-2 px-1">
            <div className="flex gap-4">
               <div>
                  <p className="text-3xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">REMINDER</p>
                  <p className="text-2xs font-bold text-slate-600 dark:text-zinc-400">{formatReminder(event.reminder)}</p>
               </div>
               <div>
                  <p className="text-3xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">RECURRENCE</p>
                  <p className="text-2xs font-bold text-slate-600 dark:text-zinc-400 capitalize">{event.recurrence ? `${event.recurrence.frequency} pattern` : 'Single instance'}</p>
               </div>
            </div>
        </div>
       
        <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap sm:flex-nowrap justify-between gap-3">
            <button type="button" onClick={onDelete} className="px-6 py-2.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg font-black text-2xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm">Delete</button>
            <div className="flex flex-1 justify-end items-center gap-2 w-full sm:w-auto">
                {event.date && openedFrom !== 'calendar' && onNavigateToCalendar && (
                    <button type="button" onClick={() => onNavigateToCalendar(new Date(event.date).toISOString().split('T')[0], event.id)} className="px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 rounded-lg font-black text-2xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all shadow-sm whitespace-nowrap">
                        View in Calendar
                    </button>
                )}
                <button type="button" onClick={onEdit} className="px-6 py-2.5 flex-1 sm:flex-none bg-primary-600 text-white rounded-lg font-black text-2xs uppercase tracking-widest hover:bg-primary-700 transition-all shadow-lg hover:shadow-primary-500/20 active:scale-[0.98]">Edit Event Details</button>
            </div>
        </div>
    </div>
  );
};
