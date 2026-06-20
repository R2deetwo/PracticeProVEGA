
import React, { useState } from 'react';
import { Matter } from '../../types';
import { BellIcon, BellPlusIcon, CheckCircleIcon, TrashIcon, ClockIcon } from '../../constants';

const REMINDER_OPTIONS: { label: string; days: number }[] = [
    { label: '1 day', days: 1 },
    { label: '3 days', days: 3 },
    { label: '1 week', days: 7 },
    { label: '2 weeks', days: 14 },
    { label: '1 month', days: 30 },
    { label: '3 months', days: 90 },
    { label: '6 months', days: 180 },
];

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function formatDate(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-GB", { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function getDaysUntil(isoString: string): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(isoString);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

interface MatterReviewReminderProps {
    matter: Matter;
    onUpdate: (updatedMatter: Matter) => void;
}

const MatterReviewReminderPanel: React.FC<MatterReviewReminderProps> = ({ matter, onUpdate }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [noteText, setNoteText] = useState(matter.reviewReminder?.note || '');
    const [customDate, setCustomDate] = useState('');

    const reminder = matter.reviewReminder;
    const daysUntil = reminder && !reminder.dismissed ? getDaysUntil(reminder.remindAt) : null;

    const isDue = daysUntil !== null && daysUntil <= 0;
    const isSoon = daysUntil !== null && daysUntil > 0 && daysUntil <= 3;

    const setReminder = (days: number) => {
        const remindAt = addDays(new Date(), days).toISOString();
        onUpdate({
            ...matter,
            reviewReminder: { remindAt, note: noteText, dismissed: false }
        });
        setIsExpanded(false);
    };

    const setCustomReminder = () => {
        if (!customDate) return;
        onUpdate({
            ...matter,
            reviewReminder: { remindAt: new Date(customDate).toISOString(), note: noteText, dismissed: false }
        });
        setCustomDate('');
        setIsExpanded(false);
    };

    const dismissReminder = () => {
        if (!reminder) return;
        onUpdate({
            ...matter,
            reviewReminder: { ...reminder, dismissed: true }
        });
    };

    const clearReminder = () => {
        onUpdate({ ...matter, reviewReminder: undefined });
    };

    // Active (non-dismissed) reminder banner
    if (reminder && !reminder.dismissed) {
        return (
            <div className={`rounded-xl border p-3 ${
                isDue
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : isSoon
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            }`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                        <div className={`mt-0.5 p-1.5 rounded-lg ${
                            isDue ? 'bg-red-100 dark:bg-red-900/40 text-red-600' :
                            isSoon ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600' :
                            'bg-blue-100 dark:bg-blue-900/40 text-blue-600'
                        }`}>
                            <BellIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <p className={`text-sm font-bold ${
                                isDue ? 'text-red-700 dark:text-red-400' :
                                isSoon ? 'text-amber-700 dark:text-amber-400' :
                                'text-blue-700 dark:text-blue-400'
                            }`}>
                                {isDue
                                    ? `Review overdue${daysUntil! < 0 ? ` (${Math.abs(daysUntil!)}d ago)` : ' (today)'}`
                                    : isSoon
                                    ? `Review due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`
                                    : `Review scheduled in ${daysUntil} days`
                                }
                            </p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                {formatDate(reminder.remindAt)}
                                {reminder.note && <span className="ml-2 italic">"{reminder.note}"</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {isDue && (
                            <button
                                onClick={dismissReminder}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
                            >
                                <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" /> Done
                            </button>
                        )}
                        <button
                            onClick={clearReminder}
                            className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-white/50 dark:hover:bg-zinc-800"
                            title="Remove reminder"
                        >
                            <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // No reminder, or dismissed
    return (
        <div>
            {!isExpanded ? (
                <button
                    onClick={() => setIsExpanded(true)}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors group"
                >
                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
                        <BellPlusIcon className="w-3.5 h-3.5" />
                    </div>
                    {reminder?.dismissed ? 'Set new review reminder' : 'Set review reminder'}
                </button>
            ) : (
                <div className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                            <ClockIcon className="w-3.5 h-3.5" /> Review Reminder
                        </h4>
                        <button onClick={() => setIsExpanded(false)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">Cancel</button>
                    </div>

                    {/* Quick Options */}
                    <div className="flex flex-wrap gap-1.5">
                        {REMINDER_OPTIONS.map(opt => (
                            <button
                                key={opt.days}
                                onClick={() => setReminder(opt.days)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 text-slate-600 dark:text-zinc-200 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Custom date */}
                    <div className="flex items-center gap-2">
                        <input autoComplete="off" data-lpignore="true" 
                            type="date"
                            value={customDate}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={e => setCustomDate(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-primary-400"
                        />
                        <button
                            onClick={setCustomReminder}
                            disabled={!customDate}
                            className="px-3 py-1.5 text-xs font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Custom
                        </button>
                    </div>

                    {/* Optional note */}
                    <input autoComplete="off" data-lpignore="true" 
                        type="text"
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        placeholder="Add a note (optional)…"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                </div>
            )}
        </div>
    );
};

export default MatterReviewReminderPanel;
