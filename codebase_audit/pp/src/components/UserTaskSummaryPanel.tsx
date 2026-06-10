
import React from 'react';
import { Task, User } from '../types';
import { getInitials, getUserColor } from '../utils/colorUtils';
import ScrollArrows from './ScrollArrows';

interface UserTaskSummaryPanelProps {
    allTasks: Task[];
    users: User[];
    currentUser: User;
    activeFilter: string;
    onFilterChange: (filter: string) => void;
}

const FilterPill: React.FC<{
    label: string;
    avatar: React.ReactNode;
    activeCount: number;
    overdueCount: number;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, avatar, activeCount, overdueCount, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            aria-label={`Filter tasks for ${label}`}
            className={`
                flex-shrink-0 flex items-center gap-2 p-1.5 pr-3 rounded-full transition-all duration-200 border
                ${isActive 
                    ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800 shadow-sm' 
                    : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:border-primary-300 dark:hover:border-zinc-600'
                }
            `}
        >
            {avatar}
            <div className="flex flex-col items-start min-w-[80px]">
                <span className={`text-xs font-semibold truncate max-w-[100px] ${isActive ? 'text-primary-800 dark:text-primary-200' : 'text-slate-700 dark:text-zinc-300'}`}>
                    {label}
                </span>
                <div className="flex gap-2 text-[9px] leading-none">
                    <span className="text-slate-500 dark:text-zinc-400 font-medium">{activeCount} Active</span>
                    {overdueCount > 0 && (
                        <span className="text-red-500 font-bold">{overdueCount} Late</span>
                    )}
                </div>
            </div>
        </button>
    );
};


const UserTaskSummaryPanel: React.FC<UserTaskSummaryPanelProps> = ({ allTasks, users, currentUser, activeFilter, onFilterChange }) => {
    const teamMembers = users;

    const getTaskCounts = (userId?: string) => {
        const tasksToFilter = userId ? allTasks.filter(t => t.assignedUsers.includes(userId)) : allTasks;
        const activeTasks = tasksToFilter.filter(t => t.status !== 'done');
        const overdue = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length;
        return { overdue, total: activeTasks.length };
    };

    const allFirmTasks = getTaskCounts();

    return (
        <div className="mb-4">
             <ScrollArrows>
                <div className="flex gap-2 pb-1">
                    {currentUser.role === 'Admin' && (
                        <FilterPill
                            key="__all_pill__"
                            label="All Users"
                            avatar={<div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-200 dark:bg-zinc-700 flex-shrink-0 text-[10px] font-bold text-slate-600 dark:text-zinc-300">ALL</div>}
                            activeCount={allFirmTasks.total}
                            overdueCount={allFirmTasks.overdue}
                            isActive={activeFilter === '__all__'}
                            onClick={() => onFilterChange('__all__')}
                        />
                    )}
                    {teamMembers.map(user => {
                        const { overdue, total } = getTaskCounts(user.id);
                        return (
                            <FilterPill
                                key={user.id}
                                label={user.id === currentUser.id ? 'My Tasks' : user.name.split(' ')[0]}
                                avatar={<div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0 ${getUserColor(user.id)}`}>{getInitials(user.name)}</div>}
                                activeCount={total}
                                overdueCount={overdue}
                                isActive={activeFilter === (user.id === currentUser.id ? '__currentUser__' : user.id)}
                                onClick={() => onFilterChange(user.id === currentUser.id ? '__currentUser__' : user.id)}
                            />
                        );
                    })}
                </div>
            </ScrollArrows>
        </div>
    );
};

export default UserTaskSummaryPanel;
