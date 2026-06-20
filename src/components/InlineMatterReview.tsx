import React, { useState } from 'react';
import { Matter } from '../types';
import { BellIcon, BellPlusIcon, TrashIcon, CheckCircleIcon } from '../constants';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';

interface InlineMatterReviewProps {
    matter: Matter;
}

const InlineMatterReview: React.FC<InlineMatterReviewProps> = ({ matter }) => {
    const { updateItem } = useDataActions();
    const [isOpen, setIsOpen] = useState(false);
    const [showCustomDate, setShowCustomDate] = useState(false);
    const [customDateValue, setCustomDateValue] = useState('');

    const reminder = matter.reviewReminder;

    const getDaysUntil = (isoString: string): number => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const target = new Date(isoString);
        target.setHours(0, 0, 0, 0);
        return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    };

    const daysUntil = reminder && !reminder.dismissed ? getDaysUntil(reminder.remindAt) : null;
    const isDue = daysUntil !== null && daysUntil <= 0;
    const isSoon = daysUntil !== null && daysUntil > 0 && daysUntil <= 3;

    const updateMatter = (updatedMatter: Matter) => {
        updateItem('matters', updatedMatter, updatedMatter.title);
        setIsOpen(false);
        setShowCustomDate(false);
        setCustomDateValue('');
    };

    const setReminder = (days: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const date = new Date();
        date.setDate(date.getDate() + days);
        updateMatter({
            ...matter,
            reviewReminder: { remindAt: date.toISOString(), dismissed: false }
        });
    };

    const handleCustomDateSubmit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!customDateValue) return;
        updateMatter({
            ...matter,
            reviewReminder: { remindAt: new Date(customDateValue).toISOString(), dismissed: false }
        });
    };

    const clearReminder = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateMatter({ ...matter, reviewReminder: undefined });
    };

    const dismissReminder = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (reminder) {
            updateMatter({ ...matter, reviewReminder: { ...reminder, dismissed: true } });
        }
    };

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleDateString("en-GB", { month: 'short', day: 'numeric' });
    };

    if (reminder && !reminder.dismissed) {
        return (
            <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm transition-all group ${
                isDue ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                isSoon ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            }`} onClick={(e) => e.stopPropagation()}>
                <BellIcon className="w-3 h-3 flex-shrink-0" />
                <span className="whitespace-nowrap">
                    {isDue ? 'Review overdue' : isSoon ? `Review in ${daysUntil} day${daysUntil === 1 ? '' : 's'}` : `Review ${formatDate(reminder.remindAt)}`}
                </span>
                
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-1">
                    {isDue && (
                        <button onClick={dismissReminder} title="Mark Done" className="hover:text-green-600 bg-white/50 dark:bg-black/20 rounded p-0.5">
                            <CheckCircleIcon className="w-3 h-3" />
                        </button>
                    )}
                    <button onClick={clearReminder} title="Clear Reminder" className="hover:text-red-500 bg-white/50 dark:bg-black/20 rounded p-0.5">
                        <TrashIcon className="w-3 h-3" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative group inline-block" onClick={(e) => e.stopPropagation()}>
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all shadow-sm sm:shadow-none"
                title="Set Review Reminder"
            >
                <BellPlusIcon className="w-3.5 h-3.5" />
            </button>
            {isOpen && (
                <div className="absolute top-100 mt-1 right-0 z-50 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl p-2 w-40 animate-fade-in-up">
                    {!showCustomDate ? (
                        <>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Review Matter In:</div>
                            <div className="flex flex-col gap-0.5">
                                <button onClick={(e) => setReminder(1, e)} className="text-left px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-700 rounded text-slate-700 dark:text-zinc-200 transition-colors">1 day</button>
                                <button onClick={(e) => setReminder(7, e)} className="text-left px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-700 rounded text-slate-700 dark:text-zinc-200 transition-colors">1 week</button>
                                <button onClick={(e) => setReminder(30, e)} className="text-left px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-700 rounded text-slate-700 dark:text-zinc-200 transition-colors">1 month</button>
                                <div className="h-px bg-slate-100 dark:bg-zinc-700 my-0.5" />
                                <button onClick={(e) => { e.stopPropagation(); setShowCustomDate(true); }} className="text-left px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-700 rounded text-slate-700 dark:text-zinc-200 transition-colors">Custom...</button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1">Select Date:</div>
                            <input autoComplete="off" data-lpignore="true"  
                                type="date" 
                                value={customDateValue}
                                onChange={e => setCustomDateValue(e.target.value)}
                                className="w-full text-xs px-2 py-1 rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200"
                            />
                            <div className="flex items-center gap-1 mt-1">
                                <button onClick={(e) => { e.stopPropagation(); setShowCustomDate(false); }} className="flex-1 py-1 text-[10px] font-bold rounded bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">Back</button>
                                <button onClick={handleCustomDateSubmit} disabled={!customDateValue} className="flex-1 py-1 text-[10px] font-bold rounded bg-primary-600 text-white disabled:opacity-50">Set</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default InlineMatterReview;
