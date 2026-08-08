
import React, { useMemo } from 'react';
import { AppState, User } from '../types';
import { useUI } from '../contexts/UIContext';
import { useMatterState } from '../contexts/MatterContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { LightbulbIcon, DismissIcon } from '../constants';
import { useTipManager } from '../hooks/useTipManager';
import { expandRecurringEvents } from '../utils/calendarUtils';

interface DailyFocusViewProps {
    currentUser: User;
}

const DailyFocusView: React.FC<DailyFocusViewProps> = ({ currentUser }) => {
    const { navigateTo, openModal } = useUI();
    const { matterState } = useMatterState();
    const { executionState } = useExecutionState();
    const { isTipVisible, dismissTip } = useTipManager();

    const focusItem = useMemo(() => {
        // 1. Overdue High Priority Tasks
        const userTasks = (executionState.tasks || []).filter(t => t && t.assignedUsers && t.assignedUsers.includes(currentUser.id) && t.status !== 'done');
        const overdueHighPriorityTasks = userTasks
            .filter(t => t.priority === 'High' && t.dueDate && new Date(t.dueDate) < new Date())
            .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

        if (overdueHighPriorityTasks.length > 0) {
            const task = overdueHighPriorityTasks[0];
            const id = `focus_task_${task.id}`;
            if (isTipVisible(id, 'Task Management')) {
                return {
                    id,
                    type: 'urgent_task',
                    label: 'Overdue Task',
                    text: task.title,
                    action: () => openModal('viewTask', task.id)
                };
            }
        }

        // 2. Upcoming Hearings (Today or Tomorrow)
        const userMatters = (matterState.matters || []).filter(m => m && m.assignedUsers && m.assignedUsers.includes(currentUser.id) && m.status === 'Active');
        const userMatterIds = new Set(userMatters.map(m => m.id));
        
        // Expand events for the next 7 days for the focus view
        const expansionStart = new Date();
        const expansionEnd = new Date();
        expansionEnd.setDate(expansionEnd.getDate() + 7);
        const expandedFocusEvents = expandRecurringEvents(executionState.events || [], expansionStart, expansionEnd);

        const urgentEventTypes = ['Court Hearing', 'Mention', 'Trial', 'Judgement', 'Ruling', 'Motion'];
        const upcomingHearings = expandedFocusEvents
            .filter(e => e && e.matterId && userMatterIds.has(e.matterId) && urgentEventTypes.includes(e.type) && new Date(e.date) >= new Date())
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (upcomingHearings.length > 0) {
            const event = upcomingHearings[0];
            const id = `focus_event_${event.id}`;
            if (isTipVisible(id, 'Workflow')) {
                return {
                    id,
                    type: 'hearing',
                    label: 'Upcoming Hearing',
                    text: `${event.title} (${new Date(event.date).toLocaleDateString('en-GB')})`,
                    action: () => navigateTo('matterDetail', event.matterId)
                };
            }
        }


        return null;

    }, [matterState, executionState, currentUser.id, isTipVisible]);

    if (!focusItem) return null;

    const isUrgent = focusItem.type === 'urgent_task';

    return (
        <div className={`
            ${isUrgent ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'}
            border rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm animate-fade-in group transition-all duration-300 hover:shadow-md
        `}>
            <div className="flex items-center gap-4 overflow-hidden flex-grow mr-4">
                <div className={`p-2 rounded-lg shadow-sm flex-shrink-0 animate-bounce-slow ${isUrgent ? 'bg-orange-500 text-white' : 'bg-indigo-600 text-white'}`}>
                    <LightbulbIcon className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className={`text-2xs font-black uppercase tracking-wider ${isUrgent ? 'text-orange-600 dark:text-orange-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                        {focusItem.label}
                    </span>
                    <span
                        className="text-sm font-bold text-slate-800 dark:text-white truncate cursor-pointer hover:underline decoration-2 underline-offset-4"
                        onClick={() => {
                            focusItem.action();
                            dismissTip(focusItem.id);
                        }}
                    >
                        {focusItem.text}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
                <button
                    onClick={() => {
                        focusItem.action();
                        dismissTip(focusItem.id);
                    }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${isUrgent ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                    View
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        dismissTip(focusItem.id);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label="Dismiss"
                >
                    <DismissIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default DailyFocusView;
