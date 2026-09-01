
import React from 'react';
import { Task, User, View, Matter } from '../../types';
import { formatDueDate, getHighlightColorForTask } from '../../utils/colorUtils';
import { TasksIcon } from '../../constants';
import { parseDateString } from '../../utils/calendarUtils';
import { Skeleton } from '../toolkit/Skeleton';
import { useProduct } from '../../contexts/ProductContext';


interface TasksWidgetProps {
  tasks: Task[];
  matters: Matter[];
  currentUser: User;
  onNavigateAndHighlight: (view: View, filter: any, context?: any, color?: 'red' | 'orange' | 'blue') => void;
  openModal: (modal: any, id?: any, context?: any) => void;
  isLoading?: boolean;
}

const MAX_TASKS_PER_CATEGORY = 3;
const INITIAL_MATTERS_TO_SHOW = 3;

const TasksWidget: React.FC<TasksWidgetProps> = ({ tasks, matters, currentUser, onNavigateAndHighlight, openModal, isLoading = false }) => {
  const { isProperty } = useProduct();
  const [viewType, setViewType] = React.useState<'due' | 'matter'>('due');
  const [showAllMatters, setShowAllMatters] = React.useState(false);

  const userTasks = React.useMemo(() => {
    if (isLoading) return { overdue: [], upcoming: [], byMatter: [], total: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isAdmin = currentUser.role === 'Admin';
    const tasksToConsider = (tasks || []).filter(t => {
      if (!t || !t.id) return false;
      return isAdmin || (t.assignedUsers && t.assignedUsers.includes(currentUser.id));
    });

    const activeTasks = tasksToConsider
      .filter(t => t.status !== 'done')
      .sort((a, b) => (a.dueDate ? parseDateString(a.dueDate).getTime() : Infinity) - (b.dueDate ? parseDateString(b.dueDate).getTime() : Infinity));

    // Enrich tasks with matter titles for simplicity
    const enrichedTasks = activeTasks.map(t => ({
        ...t,
        matterTitle: t.matterId ? (matters.find(m => m.id === t.matterId)?.title || 'Matter Not Found') : 'Generic Task'
    }));

    if (viewType === 'matter') {
        const grouped: Record<string, { title: string, tasks: any[] }> = {};
        enrichedTasks.forEach(t => {
            const mld = t.matterId || 'no-matter';
            if (!grouped[mld]) grouped[mld] = { title: t.matterTitle, tasks: [] };
            grouped[mld].tasks.push(t);
        });
        return {
            overdue: [],
            upcoming: [],
            byMatter: Object.entries(grouped).map(([id, data]) => ({ id, title: data.title, tasks: data.tasks })),
            total: enrichedTasks.length
        };
    }

    const overdue = enrichedTasks.filter(t => {
      if (!t.dueDate) return false;
      const dueDate = parseDateString(t.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    });

    const upcoming = enrichedTasks.filter(t => {
      if (!t.dueDate) return true;
      const dueDate = parseDateString(t.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today;
    });

    return {
      overdue: overdue.slice(0, MAX_TASKS_PER_CATEGORY),
      upcoming: upcoming.slice(0, MAX_TASKS_PER_CATEGORY + 2),
      byMatter: [],
      total: enrichedTasks.length
    };
  }, [tasks, matters, currentUser, isLoading, viewType]);

  const handleTaskClick = (task: Task) => {
    openModal('editTask', task.id, { openedFrom: 'dashboard' });
  };

  const widgetTitle = currentUser.role === 'Admin' ? (isProperty ? 'Tasks' : 'Firm Tasks') : 'My Tasks';

  const hasTasks = userTasks.total > 0;

  const visibleMatters = showAllMatters ? userTasks.byMatter : userTasks.byMatter.slice(0, INITIAL_MATTERS_TO_SHOW);
  const hiddenMattersCount = userTasks.byMatter.length - INITIAL_MATTERS_TO_SHOW;

  return (
    <div className="card-premium flex flex-col h-full overflow-hidden halo-hover border-slate-200/60 dark:border-zinc-800/60 shadow-xl">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 dark:border-zinc-800/50 bg-slate-50/50 dark:bg-zinc-900/50 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary-600/10 text-primary-600 dark:text-primary-400 flex-shrink-0">
            <TasksIcon className="w-4 h-4" />
          </div>
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white leading-none truncate">{widgetTitle}</h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex bg-slate-200/50 dark:bg-zinc-800/50 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-700">
            <button 
                onClick={() => setViewType('due')}
                className={`active-press px-2 py-0.5 text-3xs font-black uppercase tracking-tight rounded-md transition-all ${viewType === 'due' ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400'}`}
            >
                Due
            </button>
            <button 
                onClick={() => setViewType('matter')}
                className={`active-press px-2 py-0.5 text-3xs font-black uppercase tracking-tight rounded-md transition-all ${viewType === 'matter' ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400'}`}
            >
                Matter
            </button>
          </div>
          <button onClick={() => onNavigateAndHighlight('tasks', {})} className="active-press touch-target flex items-center gap-1 text-2xs font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest px-1">
              {/* SIMPLIFY FIX: label was hidden on mobile, leaving a bare number */}
              {userTasks.total} <span className="opacity-40">View All</span>
          </button>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-950/20">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton height={20} width="60%" />
            <Skeleton height={40} width="100%" />
            <Skeleton height={40} width="100%" />
          </div>
        ) : !hasTasks ? (
          <div className="flex flex-col items-center justify-center text-center p-8 h-full opacity-40">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
              <TasksIcon className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest leading-loose">
              Zero pending tasks<br/>Peace acquired
            </p>
          </div>
        ) : viewType === 'due' ? (
          <div className="divide-y divide-slate-50 dark:divide-zinc-900/50">
            {userTasks.overdue.map(task => (
              <div key={task.id} onClick={() => handleTaskClick(task)} className="active-press px-4 sm:px-5 py-3.5 cursor-pointer hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition-all border-l-2 border-rose-500 group">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-slate-800 dark:text-rose-200 truncate group-hover:text-rose-700 dark:group-hover:text-rose-300 transition-colors">{task.title}</p>
                    <p className="text-3xs font-bold text-slate-400 uppercase tracking-tight mt-0.5 truncate">{task.matterTitle || 'No Matter Assigned'}</p>
                  </div>
                  <p className="text-3xs font-black text-rose-600 dark:text-rose-400 bg-rose-100/50 dark:bg-rose-900/30 px-2 py-0.5 rounded-full uppercase border border-rose-200/50 shrink-0 shadow-sm">{formatDueDate(task.dueDate || '')}</p>
                </div>
              </div>
            ))}
            {userTasks.upcoming.map(task => (
              <div key={task.id} onClick={() => handleTaskClick(task)} className="active-press px-4 sm:px-5 py-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-all border-l-2 border-transparent group">
                <div className="flex justify-between items-start gap-3">
                   <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-slate-700 dark:text-zinc-300 truncate group-hover:text-primary-600 transition-colors">{task.title}</p>
                    <p className="text-3xs font-bold text-slate-400 uppercase tracking-tight mt-0.5 truncate">{task.matterTitle || 'Internal'}</p>
                  </div>
                  <p className="text-3xs font-bold text-slate-400 dark:text-zinc-500 bg-slate-100/30 dark:bg-zinc-800/50 px-2 py-0.5 rounded-full border border-slate-200/20 shrink-0">{formatDueDate(task.dueDate || '')}</p>
                </div>
              </div>
            ))}
          </div>
                ) : (
            <div className="divide-y divide-slate-50 dark:divide-zinc-900/40">
                {visibleMatters.map(matterGroup => (
                    <div key={matterGroup.id} className="px-5 py-3 group/matter">
                        <div className="flex items-center gap-2 mb-1.5 opacity-60 group-hover/matter:opacity-100 transition-opacity">
                            <div className="h-2.5 w-0.5 bg-primary-500 rounded-full" />
                            <h4 className="text-3xs font-black uppercase tracking-eyebrow text-slate-500 dark:text-zinc-400 line-clamp-1">{matterGroup.title}</h4>
                        </div>
                        <div className="space-y-0.5">
                          {matterGroup.tasks.slice(0, 3).map(task => (
                              <div 
                                  key={task.id} 
                                  onClick={() => handleTaskClick(task)}
                                  className="py-1.5 flex justify-between items-center group/item cursor-pointer"
                              >
                                  <span className="text-2xs font-bold text-slate-700 dark:text-zinc-300 truncate group-hover/item:text-primary-600 dark:group-hover/item:text-primary-400 transition-colors uppercase tracking-tight">{task.title}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-3xs font-black uppercase tracking-tight px-1.5 py-0.5 rounded ${task.priority === 'High' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'}`}>
                                      {task.priority || 'Medium'}
                                    </span>
                                  </div>
                              </div>
                          ))}
                          {matterGroup.tasks.length > 3 && (
                            <button
                              onClick={() => onNavigateAndHighlight('tasks', {})}
                              className="pt-0.5 text-3xs font-black uppercase tracking-widest text-primary-500/70 hover:text-primary-500 text-left w-full transition-colors"
                            >
                               + {matterGroup.tasks.length - 3} more in matter
                            </button>
                          )}
                        </div>
                    </div>
                ))}
                
                {hiddenMattersCount > 0 && (
                    <div className="px-5 py-3">
                        <button 
                            onClick={() => setShowAllMatters(!showAllMatters)}
                            className="w-full py-1.5 bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-200/50 dark:border-zinc-800/50 rounded-lg text-3xs font-black uppercase tracking-widest text-slate-400 hover:text-primary-600 hover:border-primary-200 transition-all"
                        >
                            {showAllMatters ? 'Show Less' : `Show ${hiddenMattersCount} Other Matters`}
                        </button>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default TasksWidget;
