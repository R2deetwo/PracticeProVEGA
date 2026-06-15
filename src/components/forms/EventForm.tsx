import React, { useState, useEffect } from 'react';
import { CalendarEvent, Matter, CustomEventType, EventTypeString, View, User, CourtType, EventStatus, AppMode } from '../../types';
import { SettingsIcon, CalendarIcon, ClockIcon, MapPinIcon, OfficeBuildingIcon, PlusIcon, XIcon, SaveIcon, UserCircleIcon, BellIcon, RepeatIcon, GavelIconLarge, InfoIcon, UserIcon } from '../../constants';
import { inputModern } from '../../utils/formStyles';
import Tooltip from '../Tooltip';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { UserAssignment } from './UserAssignment';

const commonInputClass = inputModern;

interface EventFormProps {
    matters: Matter[];
    users: User[];
    appMode: AppMode;
    eventTypes: CustomEventType[];
    onSave: (eventData: Omit<CalendarEvent, 'id'>) => void;
    onUpdateEvent?: (updatedEvent: CalendarEvent) => void;
    onClose: () => void;
    onNavigate?: (view: View, targetId?: string | null, context?: any) => void;
    currentUser: User;
    eventToEdit?: CalendarEvent;
    initialContext?: { matterId?: string; fromNoteContent?: string; date?: Date; title?: string; type?: EventTypeString, openedFrom?: string; addMeetLink?: boolean };
    isCompact?: boolean;
}

const toDatetimeLocalString = (date: Date): string => {
    if (!date || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const EventForm: React.FC<EventFormProps> = ({ matters, users, appMode, eventTypes, onSave, onUpdateEvent, onClose, onNavigate, currentUser, eventToEdit, initialContext, isCompact }) => {
    const { coreState, isDataLoaded } = useCoreState();
    const { addToast } = useUI();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [matterId, setMatterId] = useState<string>('');
    const [type, setType] = useState<EventTypeString>(eventTypes[0]?.name || '');

    const [date, setDate] = useState(() => {
        const d = new Date();
        d.setSeconds(0, 0);
        return d;
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setHours(d.getHours() + 1);
        d.setSeconds(0, 0);
        return d;
    });

    const [addMeetLink, setAddMeetLink] = useState(false);
    const [assignedUsers, setAssignedUsers] = useState<Set<string>>(new Set());

    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [reminderValue, setReminderValue] = useState(30);
    const [reminderUnit, setReminderUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');

    const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
    const [recurrenceFrequency, setRecurrenceFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
    const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');

    const [court, setCourt] = useState<CourtType | undefined>(undefined);
    const [judicialDivision, setJudicialDivision] = useState('');

    const isEditing = !!eventToEdit;
    const isCourtEventType = type === 'Court Hearing' || type === 'Mention';

    useEffect(() => {
        if (isEditing && eventToEdit) {
            setTitle(eventToEdit.title);
            setDescription(eventToEdit.description || '');
            setMatterId(eventToEdit.matterId || '');
            setType(eventToEdit.type);
            setDate(new Date(eventToEdit.date));
            setEndDate(eventToEdit.endDate ? new Date(eventToEdit.endDate) : new Date(new Date(eventToEdit.date).getTime() + 60 * 60 * 1000));
            setCourt(eventToEdit.court as CourtType);
            setJudicialDivision(eventToEdit.judicialDivision || '');
            setAssignedUsers(new Set(eventToEdit.assignedUsers || []));
            setReminderEnabled(!!eventToEdit.reminder);
            setReminderValue(eventToEdit.reminder?.value || 30);
            setReminderUnit(eventToEdit.reminder?.unit || 'minutes');
            setRecurrenceEnabled(!!eventToEdit.recurrence);
            setRecurrenceFrequency(eventToEdit.recurrence?.frequency || 'weekly');
            setRecurrenceEndDate(eventToEdit.recurrence?.endDate?.split('T')[0] || '');
        } else if (initialContext) {
            const context = initialContext;
            if (context.matterId) setMatterId(context.matterId || '');
            if (context.fromNoteContent) setDescription(context.fromNoteContent.replace(/<[^>]*>/g, ''));
            if (context.title) setTitle(context.title);
            if (context.type) setType(context.type);
            if (context.addMeetLink) setAddMeetLink(true);

            const inputDate = context.date || (context as any).startDate || (context as any).when;
            if (inputDate) {
                const selectedDay = new Date(inputDate);
                if (!isNaN(selectedDay.getTime())) {
                    const isMidnight = selectedDay.getHours() === 0 && selectedDay.getMinutes() === 0;
                    if (isMidnight) selectedDay.setHours(9, 0, 0, 0);
                    setDate(selectedDay);
                    const end = new Date(selectedDay);
                    end.setHours(selectedDay.getHours() + 1);
                    setEndDate(end);
                }
            }
        } else {
            // Check for saved draft in localStorage
            const savedDraft = localStorage.getItem('draft_newEvent');
            if (savedDraft) {
                try {
                    const draft = JSON.parse(savedDraft);
                    if (draft.title) setTitle(draft.title);
                    if (draft.description) setDescription(draft.description);
                    if (draft.matterId) setMatterId(draft.matterId);
                    if (draft.type) setType(draft.type);
                    if (draft.date) setDate(new Date(draft.date));
                    if (draft.endDate) setEndDate(new Date(draft.endDate));
                } catch (e) {
                    console.error("Failed to parse event draft", e);
                }
            } else {
                setMatterId(matters[0]?.id || '');
            }
        }
    }, [isEditing, eventToEdit, initialContext, matters]);

    // --- EFFECT: Save Draft ---
    useEffect(() => {
        if (!isEditing && title) {
            const draft = {
                title, description, matterId, type,
                date: date.toISOString(),
                endDate: endDate.toISOString(),
                lastSaved: new Date().toISOString()
            };
            localStorage.setItem('draft_newEvent', JSON.stringify(draft));
        }
    }, [title, description, matterId, type, date, endDate, isEditing]);

    useEffect(() => {
        if (!isEditing && matterId) {
            const selectedMatter = matters.find(m => m.id === matterId);
            if (selectedMatter) {
                if (isCourtEventType) {
                    setCourt(selectedMatter.court as CourtType);
                    setJudicialDivision(selectedMatter.judicialDivision);
                }
                setAssignedUsers(new Set(selectedMatter.assignedUsers || []));
            }
        }
    }, [matterId, isCourtEventType, isEditing, matters]);

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (!val) return;
        const newDate = new Date(val);
        if (!isNaN(newDate.getTime())) {
            setDate(newDate);
            if (endDate <= newDate) {
                const newEnd = new Date(newDate);
                newEnd.setHours(newDate.getHours() + 1);
                setEndDate(newEnd);
            }
        }
    };

    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (!val) return;
        const newDate = new Date(val);
        if (!isNaN(newDate.getTime())) setEndDate(newDate);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) {
            addToast("Please provide an event title.", { type: 'info' });
            return;
        }
        if (endDate < date) {
            addToast('Event end time cannot be before the start time.', { type: 'info' });
            return;
        }
        const selectedMatter = matters.find(m => m.id === matterId);

        let finalDescription = description;
        if (addMeetLink) {
            finalDescription = `Google Meet Link: https://meet.google.com/lookup/simulated-meet-id\n\n${description}`;
        }

        const eventData: Omit<CalendarEvent, 'id'> = {
            firmId: coreState.firmDetails.id,
            title,
            description: finalDescription,
            matterTitle: selectedMatter?.title,
            type,
            date: date.toISOString(),
            endDate: endDate.toISOString(),
            matterId: selectedMatter?.id,
            status: 'Active',
            court: isCourtEventType ? court : undefined,
            judicialDivision: isCourtEventType ? judicialDivision : undefined,
            assignedUsers: Array.from(assignedUsers),
            reminder: reminderEnabled ? { value: reminderValue, unit: reminderUnit } : undefined,
            recurrence: recurrenceEnabled ? { frequency: recurrenceFrequency, endDate: recurrenceEndDate || undefined } : undefined,
        };

        if (isEditing && onUpdateEvent) {
            onUpdateEvent({ ...eventData, id: eventToEdit!.id } as CalendarEvent);
        } else {
            onSave(eventData);
            localStorage.removeItem('draft_newEvent');
        }
        onClose();
    };

    const commonInputClass = inputModern;
    const labelClass = "block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-1.5 ml-1";
    const gridClass = isCompact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2";

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 -m-2">
            <div className="space-y-2 sm:space-y-3 pb-32">
                {/* Core Event Info */}
                <div className="p-3 sm:p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-2 sm:space-y-3">
                    <div className="flex items-center gap-4 mb-2 px-1">
                        <div className="p-1.5 bg-primary-600 text-white rounded-lg shadow-sm ring-2 ring-primary-500/10">
                            <CalendarIcon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-primary-600/70 uppercase tracking-widest leading-none mb-0.5">Details</p>
                            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Matter Association</h3>
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label htmlFor="title" className={labelClass}>Event Title</label>
                        <input autoComplete="off" data-lpignore="true"  type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} className={commonInputClass} placeholder="e.g. Strategy Meeting with Lead Counsel" required autoFocus />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-2 group">
                            <div className="flex justify-between items-center mb-0.5">
                                <label htmlFor="type" className={labelClass}>Activity Type</label>
                                {onNavigate && (
                                    <button type="button" onClick={() => { onNavigate('settings', null, { settingsTargetId: 'event-type-management' }); onClose(); }} className="text-[9px] font-black text-primary-600 uppercase tracking-widest hover:underline">Customize</button>
                                )}
                            </div>
                            <select id="type" value={type} onChange={e => setType(e.target.value)} className={commonInputClass} required>
                                {eventTypes.map(et => <option key={et.id} value={et.name}>{et.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2 group">
                            <label htmlFor="matterId" className={labelClass}>Case Association</label>
                            <div className="relative">
                                <OfficeBuildingIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select id="matterId" value={matterId} onChange={e => setMatterId(e.target.value)} className={`${commonInputClass} pl-11`}>
                                    <option value="">-- No Matter Association --</option>
                                    {matters.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label htmlFor="description" className={labelClass}>Description</label>
                        <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} className={`${commonInputClass} resize-none`} placeholder="Additional context or meeting agenda..." />
                    </div>
                </div>

                {/* Scheduling Section */}
                <div className="p-3 sm:p-4 bg-slate-50/50 dark:bg-zinc-800/30 rounded-xl border border-slate-100 dark:border-zinc-700/50 shadow-sm space-y-2 sm:space-y-3">
                    <div className="flex items-center gap-4 px-1">
                        <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm ring-2 ring-indigo-500/10">
                            <ClockIcon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-indigo-600/70 uppercase tracking-widest leading-none mb-0.5">Schedule</p>
                            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Time & Dates</h3>
                        </div>
                    </div>

                    <div className={`grid ${gridClass} gap-3 sm:gap-4`}>
                        <div className="space-y-2 group">
                            <label htmlFor="startDate" className={labelClass}>Start</label>
                            <input autoComplete="off" data-lpignore="true"  type="datetime-local" id="startDate" value={toDatetimeLocalString(date)} onChange={handleStartDateChange} className={commonInputClass} required />
                        </div>
                        <div className="space-y-2 group">
                            <label htmlFor="endDate" className={labelClass}>End</label>
                            <input autoComplete="off" data-lpignore="true"  type="datetime-local" id="endDate" value={toDatetimeLocalString(endDate)} onChange={handleEndDateChange} className={commonInputClass} required />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className={`flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-sm transition-all ${reminderEnabled ? 'ring-2 ring-primary-500' : ''}`}>
                             <div className={`p-2 rounded-xl transition-colors ${reminderEnabled ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30' : 'bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600'}`}>
                                <BellIcon className="w-5 h-5" />
                             </div>
                             <div className="flex-grow">
                                <label htmlFor="reminderEnabled" className="text-xs font-black text-slate-700 dark:text-zinc-200 uppercase tracking-widest cursor-pointer block mb-1">Notifications</label>
                                <div className="flex items-center gap-3">
                                    <input autoComplete="off" data-lpignore="true"  type="checkbox" id="reminderEnabled" checked={reminderEnabled} onChange={e => setReminderEnabled(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
                                    {reminderEnabled && (
                                        <div className="flex items-center gap-1.5 animate-in slide-in-from-left-2 duration-300">
                                            <input autoComplete="off" data-lpignore="true"  type="number" min="1" value={reminderValue} onChange={e => setReminderValue(parseInt(e.target.value) || 1)} className="w-12 py-1 text-center text-xs font-black bg-slate-50 dark:bg-zinc-800 ring-1 ring-slate-200 dark:ring-zinc-700 rounded-lg outline-none" />
                                            <select value={reminderUnit} onChange={e => setReminderUnit(e.target.value as any)} className="py-1 px-1.5 text-[9px] font-black uppercase bg-slate-50 dark:bg-zinc-800 ring-1 ring-slate-200 dark:ring-zinc-700 rounded-lg outline-none">
                                                <option value="minutes">Min</option>
                                                <option value="hours">Hrs</option>
                                                <option value="days">D</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                             </div>
                        </div>

                        <div className={`flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-sm transition-all ${recurrenceEnabled ? 'ring-2 ring-indigo-500' : ''}`}>
                             <div className={`p-2 rounded-xl transition-colors ${recurrenceEnabled ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30' : 'bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600'}`}>
                                <RepeatIcon className="w-5 h-5" />
                             </div>
                             <div className="flex-grow">
                                <label htmlFor="recurrenceEnabled" className="text-xs font-black text-slate-700 dark:text-zinc-200 uppercase tracking-widest cursor-pointer block mb-1">Recurrence</label>
                                <div className="flex items-center gap-3">
                                    <input autoComplete="off" data-lpignore="true"  type="checkbox" id="recurrenceEnabled" checked={recurrenceEnabled} onChange={e => setRecurrenceEnabled(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                    {recurrenceEnabled && (
                                        <div className="flex items-center gap-1.5 animate-in slide-in-from-left-2 duration-300">
                                            <select value={recurrenceFrequency} onChange={e => setRecurrenceFrequency(e.target.value as any)} className="py-1 px-2 text-[9px] font-black uppercase bg-slate-50 dark:bg-zinc-800 ring-1 ring-slate-200 dark:ring-zinc-700 rounded-lg outline-none">
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="monthly">Monthly</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                             </div>
                        </div>
                    </div>
                </div>

                {isCourtEventType && (
                    <div className="p-3 sm:p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30 space-y-2 sm:space-y-3">
                        <div className="flex items-center gap-4 px-1">
                            <div className="p-1.5 bg-amber-600 text-white rounded-lg shadow-sm ring-2 ring-amber-500/10">
                                <MapPinIcon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-widest leading-none mb-0.5">Location</p>
                                <h3 className="text-base font-black text-amber-900 dark:text-amber-200 tracking-tight">Court Details</h3>
                            </div>
                        </div>
                        <div className={`grid ${gridClass} gap-3 sm:gap-4`}>
                            <div className="space-y-2 group">
                                <label htmlFor="court" className={labelClass}>Tribunal / Court</label>
                                <select id="court" value={court} onChange={e => setCourt(e.target.value as CourtType)} className={commonInputClass}>
                                    {Object.values(CourtType).map(ct => <option key={ct} value={ct}>{ct}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2 group">
                                <label htmlFor="judicialDivision" className={labelClass}>Division</label>
                                <input autoComplete="off" data-lpignore="true"  type="text" id="judicialDivision" value={judicialDivision} onChange={e => setJudicialDivision(e.target.value)} className={commonInputClass} placeholder="e.g. Lagos Island" />
                            </div>
                        </div>
                    </div>
                )}

                <div className="px-1">
                    <UserAssignment allUsers={users} assignedUserIds={assignedUsers} onToggle={(id) => setAssignedUsers(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; })} appMode={appMode} />
                </div>
            </div>

            <div className="sticky bottom-0 left-0 right-0 pt-4 sm:pt-8 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-2 sm:gap-3 z-20">
                <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 sm:px-10 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl sm:rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
                    <XIcon className="w-4 h-4" /> Cancel
                </button>
                <button type="submit" className="flex-1 sm:flex-none px-8 sm:px-12 py-2.5 bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl sm:rounded-2xl shadow-2xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    <SaveIcon className="w-4 h-4" /> {isEditing ? 'Save Changes' : 'Create Event'}
                </button>
            </div>
        </form>
    );
};
