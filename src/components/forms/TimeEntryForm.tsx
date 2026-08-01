
import React, { useState, useEffect } from 'react';
import { TimeEntry, Matter, UserRole } from '../../types';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import { ClockIcon, CalendarIcon, SaveIcon, XIcon, BillingIcon, OfficeBuildingIcon, TrashIcon } from '../../constants';
import { inputModern } from '../../utils/formStyles';

interface TimeEntryFormProps {
  matter: Matter;
  timeEntryToEdit?: TimeEntry;
  onAddTimeEntry: (entry: Omit<TimeEntry, 'id'>) => void;
  onUpdateTimeEntry: (entry: TimeEntry) => void;
  onDelete?: (id: string) => void; // Added onDelete prop
  onClose: () => void;
}

const TimeEntryForm: React.FC<TimeEntryFormProps> = ({ matter, timeEntryToEdit, onAddTimeEntry, onUpdateTimeEntry, onDelete, onClose }) => {
  const { currentUser } = useAuth();
  const { addToast, openModal } = useUI(); // Added openModal
  const { hasPropertyFeatures } = useProduct();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState(1);
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);

  const isEditing = !!timeEntryToEdit;
  const rate = matter.hourlyRate;

  useEffect(() => {
    if (isEditing && timeEntryToEdit) {
      setDate(timeEntryToEdit.date);
      setDuration(timeEntryToEdit.duration);
      setDescription(timeEntryToEdit.description);
      setBillable(timeEntryToEdit.billable);
    }
  }, [isEditing, timeEntryToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!description.trim() || duration <= 0) {
      addToast("Please provide a valid description and duration.", { type: 'info' });
      return;
    }

    if (!currentUser) return;

    /* Added firmId to satisfy Omit<TimeEntry, "id"> interface */
    const entryData: Omit<TimeEntry, 'id'> = {
      firmId: matter.firmId,
      matterId: matter.id,
      user_id: timeEntryToEdit ? timeEntryToEdit.user_id : currentUser.id,
      date,
      duration,
      rate,
      description,
      billable,
      billedInInvoiceId: timeEntryToEdit?.billedInInvoiceId ?? null,
    };
    setIsSubmitting(true);
    try {
      if (isEditing && timeEntryToEdit) {
        await onUpdateTimeEntry({ ...timeEntryToEdit, ...entryData });
      } else {
        await onAddTimeEntry(entryData);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

    const commonInputClass = inputModern;
    const labelClass = "block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 ml-0.5";

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 -m-2">
            <div className="space-y-2 sm:space-y-3 pb-6">
                {/* Strategic Objective & Matter */}
                <div className="p-3 sm:p-4 bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-3">
                    <div className="flex items-center gap-4 mb-2 px-1">
                        <div className="p-1.5 bg-primary-600 text-white rounded-lg shadow-sm ring-2 ring-primary-500/10">
                            <ClockIcon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <p className="text-2xs font-bold text-primary-600 dark:text-primary-300/70 uppercase tracking-widest leading-none mb-0.5">Time Entry</p>
                            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Activity Details</h3>
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label className={labelClass}>{hasPropertyFeatures ? 'Property' : 'Case'} Association</label>
                        <div className="relative">
                            <OfficeBuildingIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <div className={`${commonInputClass} pl-11 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-900/50 flex items-center`}>
                                {matter.title}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label htmlFor="description" className={labelClass}>Description</label>
                        <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} className={`${commonInputClass} resize-none`} placeholder="What were you working on?" required />
                    </div>
                </div>

                {/* Allocation Parameters */}
                <div className="p-3 sm:p-4 bg-slate-50/50 dark:bg-zinc-800/30 rounded-xl border border-slate-100 dark:border-zinc-700/50 shadow-sm space-y-3">
                    <div className="flex items-center gap-4 px-1">
                        <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm ring-2 ring-indigo-500/10">
                            <BillingIcon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <p className="text-2xs font-bold text-indigo-600 dark:text-indigo-300/70 uppercase tracking-widest leading-none mb-0.5">Finances</p>
                            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Billing Details</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-2 group">
                            <label htmlFor="date" className={labelClass}>Service Date</label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input autoComplete="off" data-lpignore="true"  type="date" id="date" value={date} onChange={e => setDate(e.target.value)} className={`${commonInputClass} pl-11`} required />
                            </div>
                        </div>
                        <div className="space-y-2 group">
                            <label htmlFor="duration" className={labelClass}>Billable Units (Hours)</label>
                            <input autoComplete="off" data-lpignore="true"  type="number" id="duration" value={duration} onChange={e => setDuration(parseFloat(e.target.value))} step="0.1" min="0.1" className={commonInputClass} required />
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-between items-center gap-4 p-3 sm:p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm transition-all group">
                        <label htmlFor="billable" className="flex items-center gap-4 cursor-pointer">
                           <div className={`p-1.5 rounded-lg transition-colors ${billable ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 dark:bg-primary-900/30' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600'}`}>
                                <BillingIcon className="w-3.5 h-3.5" />
                           </div>
                           <div>
                                <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest leading-tight mb-0.5">Billing</p>
                                <div className="flex items-center gap-3">
                                    <input autoComplete="off" data-lpignore="true"  type="checkbox" id="billable" checked={billable} onChange={e => setBillable(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary-600 dark:text-primary-300 focus:ring-primary-500 cursor-pointer" />
                                    <span className="text-sm font-black text-slate-700 dark:text-white tracking-tight uppercase">Billable</span>
                                </div>
                           </div>
                        </label>
                        <div className="text-right">
                          <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Accrued Value</p>
                          <p className="text-2xl font-black text-primary-600 dark:text-primary-300 tracking-tighter leading-none"><NairaSymbol />{formatNaira(duration * rate)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="sticky bottom-0 left-0 right-0 pt-4 sm:pt-8 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-2 sm:gap-3 z-20 pb-safe-extra">
                {isEditing && onDelete && (
                    <button
                        type="button"
                        onClick={() => {
                            openModal('deleteConfirmation', timeEntryToEdit!.id, {
                                title: "Delete Time Entry?",
                                message: "Are you sure you want to delete this time entry? This cannot be undone.",
                                onConfirm: onDelete,
                                confirmText: "Delete Time Entry",
                                confirmButtonClass: 'bg-red-600 hover:bg-red-700'
                            });
                        }}
                        className="mr-auto px-6 py-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-2xl hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                        <TrashIcon className="w-3.5 h-3.5" /> Delete Entry
                    </button>
                )}
                <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 sm:px-10 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-semibold rounded-xl sm:rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
                    <XIcon className="w-4 h-4" /> Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none px-8 sm:px-12 py-2.5 bg-primary-600 text-white text-xs font-semibold rounded-xl sm:rounded-2xl shadow-2xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    <SaveIcon className="w-4 h-4" /> {isEditing ? 'Save Changes' : 'Create Entry'}
                </button>
            </div>
        </form>
    );
};
export default TimeEntryForm;
