
import React from 'react';
import { Task, User, Matter, Document, UserRole } from '../../types';
import { getInitials, getUserColor, getDueDateColor } from '../../utils/colorUtils';
import { CalendarIcon, TasksIcon, TrashIcon, EditIcon, PlusIcon, WarningIcon } from '../../constants';

interface TaskDetailModalProps {
 task: Task;
 users: User[];
 matters: Matter[];
 documents: Document[];
 onEdit: () => void;
 onDelete: () => void;
 onUpdateTask: (updatedTask: Task) => void;
 onViewInTasks: (taskId: string, color: 'red' | 'orange' | 'blue') => void;
 currentUser: User;
 onNavigateToMatter?: (matterId: string, taskId: string) => void;
 onNavigateToCalendar?: (date: string, taskId: string) => void;
 openedFrom?: 'calendar' | 'matterDetail' | 'tasks';
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = (props) => {
  const { task, users, matters, onEdit, onDelete, onViewInTasks, currentUser, onNavigateToMatter, onNavigateToCalendar, openedFrom } = props;
  const matter = matters.find(m => m.id === task.matterId);
  const assignedUsers = (task.assignedUsers || []).map(id => users.find(u => u.id === id)).filter(Boolean) as User[];
  
  // Permission check: Admin or Creator or Assigned User can edit/delete
  const canManage = currentUser.role === UserRole.Admin || task.creatorId === currentUser.id || task.assignedUsers.includes(currentUser.id);
  
  const showViewInTasksButton = openedFrom !== 'tasks';
  const isOverdue = task.status !== 'done' && task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div className="space-y-6 pb-2">
      {isOverdue && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 text-red-800 rounded-r-xl animate-fade-in shadow-sm">
          <p className="font-black text-xs uppercase tracking-widest flex items-center gap-1.5"><WarningIcon className="w-4 h-4" /> Task Overdue</p>
          <p className="text-sm mt-1 opacity-90">This task was due on {new Date(task.dueDate!).toLocaleDateString('en-GB')}. Immediate attention required.</p>
        </div>
      )}

      <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-zinc-800 pb-4">
         <div className="flex items-center gap-2 mb-1">
          <span className={`px-2 py-0.5 text-2xs font-black uppercase tracking-widest rounded-md ${task.status === 'done' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'}`}>
            {task.status.replace('_', ' ')}
          </span>
          <span className={`px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-2xs font-black uppercase tracking-widest rounded-md`}>
            {task.priority} Priority
          </span>
         </div>
         <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100 tracking-tight leading-tight">
          {task.title}
         </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800">
         <div className="flex items-start gap-3">
          <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg shadow-sm text-primary-600 dark:text-primary-300">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xs font-black text-slate-400 uppercase tracking-wide-label mb-0.5">DUE DATE</p>
            <p className={`text-sm font-bold ${getDueDateColor(task.dueDate)}`}>
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'No deadline'}
            </p>
          </div>
         </div>
         <div className="flex items-start gap-3">
          <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg shadow-sm text-primary-600 dark:text-primary-300">
            <TasksIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xs font-black text-slate-400 uppercase tracking-wide-label mb-0.5">TASK CATEGORY</p>
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">Legal Task</p>
          </div>
         </div>
      </div>

      {task.description && (
        <div className="space-y-2">
          <p className="text-2xs font-black text-slate-400 uppercase tracking-wide-label px-1">SPECIFICATIONS</p>
          <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl text-sm text-slate-700 dark:text-zinc-300 shadow-sm leading-relaxed italic">
            {task.description}
          </div>
        </div>
      )}

      {matter && (
        <div className="p-4 glass-premium rounded-2xl flex items-center justify-between border-l-4 border-l-primary-500">
          <div className="min-w-0">
            <p className="text-2xs font-black text-slate-400 uppercase tracking-wide-label mb-1">ASSOCIATED MATTER</p>
            <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate pr-4">{matter.title}</p>
          </div>
          {openedFrom !== 'matterDetail' && onNavigateToMatter && (
             <button type="button" onClick={() => onNavigateToMatter(matter.id, task.id)} className="px-3 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-lg text-3xs font-black uppercase tracking-widest hover:bg-primary-600 hover:text-white transition-all">
              OPEN
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        <p className="text-2xs font-black text-slate-400 uppercase tracking-wide-label px-1">ASSIGNED TEAM</p>
        <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl flex items-center justify-between">
          {assignedUsers.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center -space-x-2">
                {assignedUsers.slice(0, 5).map(user => (
                  <div key={user.id} title={user.name} className={`h-8 w-8 rounded-full ring-4 ring-white flex items-center justify-center text-white font-bold text-xs shadow-sm ${getUserColor(user.id)}`}>
                    {getInitials(user.name)}
                  </div>
                ))}
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                {assignedUsers.length === 1 ? '1 Owner assigned' : `${assignedUsers.length} Owners assigned`}
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Unassigned</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {showViewInTasksButton && (
           <button type="button" onClick={() => onViewInTasks(task.id, 'blue')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-lg text-3xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
            <TasksIcon className="w-3.5 h-3.5" /> LOCATE
          </button>
        )}
        {task.dueDate && openedFrom !== 'calendar' && onNavigateToCalendar && (
          <button type="button" onClick={() => onNavigateToCalendar(new Date(task.dueDate!).toISOString().split('T')[0], task.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-lg text-3xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
            <CalendarIcon className="w-3.5 h-3.5" /> CALENDAR
          </button>
        )}
      </div>
      
      <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center gap-3">
        {canManage && (
          <>
            <button type="button" onClick={onDelete} className="px-6 py-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg font-black text-2xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center gap-2">
              <TrashIcon className="w-3.5 h-3.5" /> Delete
            </button>
            <button type="button" onClick={onEdit} className="flex-grow py-2.5 bg-primary-600 text-white rounded-lg font-black text-2xs uppercase tracking-widest hover:bg-primary-700 transition-all shadow-lg hover:shadow-primary-500/20 active:scale-[0.98] flex items-center justify-center gap-2">
              <EditIcon className="w-3.5 h-3.5" /> Modify Task Details
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TaskDetailModal;
