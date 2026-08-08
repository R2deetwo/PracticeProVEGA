
import React, { useMemo } from 'react';
import { Task } from '../../types';
import { parseDateString } from '../../utils/calendarUtils';
import { calculateDaysRemaining } from '../../utils/courtCalculator';
import { EyeIcon, DismissIcon } from '../../constants';
import { useCoreState } from '../../contexts/CoreContext';
import { useTipManager } from '../../hooks/useTipManager';

const DeadlineIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
    </svg>
);

interface FilingDeadlineNoticeProps {
    tasks: Task[];
    onViewTask: (taskId: string) => void;
}

const FilingDeadlineNotice: React.FC<FilingDeadlineNoticeProps> = ({ tasks, onViewTask }) => {
    const { coreState, isDataLoaded } = useCoreState();
    const { isTipVisible, dismissTip } = useTipManager();
    
    const mostUrgentDeadline = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingDeadlines = tasks
            .filter(t => t.dueDate && parseDateString(t.dueDate) >= today && t.status !== 'done')
            .sort((a, b) => parseDateString(a.dueDate!).getTime() - parseDateString(b.dueDate!).getTime());
        
        return upcomingDeadlines[0] || null;
    }, [tasks]);

    if (!mostUrgentDeadline) {
        return null;
    }
    
    const tipId = `filing_notice_${mostUrgentDeadline.id}`;
    if (!isTipVisible(tipId, 'Workflow')) return null;

    const dueDate = parseDateString(mostUrgentDeadline.dueDate!);
    const customHolidays = coreState.firmDetails.customHolidays || [];
    
    const { days } = calculateDaysRemaining(dueDate, customHolidays);
    
    // Explicit border-l-4 for the "tab" look
    let urgencyClasses = 'bg-blue-50 dark:bg-blue-900/50 border-l-4 border-blue-500 text-blue-800 dark:text-blue-200';
    let iconColor = 'text-blue-600 dark:text-blue-300';
    
    if (days <= 7) {
        urgencyClasses = 'bg-yellow-50 dark:bg-yellow-900/50 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200';
        iconColor = 'text-yellow-600 dark:text-yellow-300';
    }
    if (days <= 2) {
        urgencyClasses = 'bg-red-50 dark:bg-red-900/50 border-l-4 border-red-500 text-red-800 dark:text-red-200';
        iconColor = 'text-red-600 dark:text-red-300';
    }

    const dayText = days === 1 ? 'day' : 'days';
    
    // Logic to distinguish between formal filing deadlines (auto-generated) and general task deadlines
    const isOfficialFiling = mostUrgentDeadline.title.includes('[FILING DEADLINE]');
    const noticeLabel = isOfficialFiling ? "Upcoming Filing Deadline" : "Next Deadline";
    const displayTitle = isOfficialFiling ? mostUrgentDeadline.title.replace('[FILING DEADLINE] ', '') : mostUrgentDeadline.title;

    return (
        <div className={`mb-6 p-4 rounded-lg shadow-sm relative group overflow-hidden ${urgencyClasses}`}>
             <button 
                onClick={(e) => { e.stopPropagation(); dismissTip(tipId); }}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                aria-label="Dismiss notice"
            >
                <DismissIcon className="w-4 h-4" />
            </button>
            
            <div className="flex items-start gap-3 w-full pr-8">
                <div className="p-2 bg-white/50 dark:bg-black/20 rounded-full flex-shrink-0 mt-1 lg:mt-0">
                    <DeadlineIcon className={`w-6 h-6 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs uppercase tracking-wide opacity-80 flex items-center gap-2 flex-wrap">
                        {noticeLabel}
                    </p>
                    <p className="text-base font-medium mt-1 break-words leading-snug w-full">
                        <span className="font-bold">"{displayTitle}"</span>
                        <span className="inline-block ml-1">
                            is due in {days === 0 ? 'today' : <strong>{days} {dayText}</strong>} on {dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.
                        </span>
                    </p>
                </div>
            </div>
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    onViewTask(mostUrgentDeadline.id);
                }}
                className="mt-3 sm:mt-0 sm:absolute sm:bottom-4 sm:right-12 px-4 py-2 bg-white/90 dark:bg-black/30 hover:bg-white dark:hover:bg-black/50 text-inherit rounded-lg font-bold text-sm shadow-sm flex items-center gap-2 transition-all whitespace-nowrap"
            >
                <EyeIcon className="w-4 h-4" />
                View Task
            </button>
        </div>
    );
};

export default FilingDeadlineNotice;
