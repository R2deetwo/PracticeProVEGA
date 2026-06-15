import React, { useState, useEffect, useMemo } from 'react';
import { Task, Matter, User, TaskStatus, ChecklistTemplate, Checklist, AppMode, Document, TaskPriority } from '../../types';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import { TasksIcon, CalendarIcon, OfficeBuildingIcon, PlusIcon, XIcon, SaveIcon, UserCircleIcon, ShieldCheckIcon } from '../../constants';
import { inputModern } from '../../utils/formStyles';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { AloaTaskCoach } from './AloaTaskCoach';
import { useProduct } from '../../contexts/ProductContext';

interface TaskFormProps {
  matters: Matter[];
  tasks: Task[];
  users: User[];
  documents: Document[];
  checklistTemplates: ChecklistTemplate[];
  onAddTask?: (newTask: Omit<Task, 'id' | 'createdAt' | 'creatorId'>) => void;
  onUpdateTask?: (updatedTask: Task) => void;
  onClose: () => void;
  taskToEdit?: Task;
  initialContext?: any;
  currentUser: User;
  appMode: AppMode;
  isEditable?: boolean;
  isCompact?: boolean,
  openModal?: (modal: any, id?: any, context?: any) => void;
  onNavigate?: (view: any, id?: any, context?: any) => void;

}

const TaskForm: React.FC<TaskFormProps> = ({
  matters,
  tasks,
  users,
  documents,
  checklistTemplates,
  onAddTask,
  onUpdateTask,
  onClose,
  taskToEdit,
  initialContext,
  currentUser,
  appMode,
  isEditable,
  isCompact,
  openModal,
  onNavigate
}) => {
  const { coreState, isDataLoaded } = useCoreState();
    const { addToast } = useUI();
  const { isProperty } = useProduct();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<Set<string>>(new Set());
  const [matterId, setMatterId] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.Medium);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.Todo);

  const isEditing = !!taskToEdit;

    // --- EFFECT: ALOA Form Update Listener ---
    useEffect(() => {
        const handleAloaUpdate = (e: any) => {
            const data = e.detail;
            if (!data) return;

            if (data.title !== undefined) setTitle(data.title);
            if (data.description !== undefined) setDescription(data.description);
            if (data.dueDate !== undefined) setDueDate(data.dueDate);
            if (data.priority !== undefined) setPriority(data.priority);
            if (data.matterId !== undefined) setMatterId(data.matterId);
            
            addToast("ALOA updated the task details.", { type: 'info' });
        };

        window.addEventListener('aloa_update_form', handleAloaUpdate);
        return () => window.removeEventListener('aloa_update_form', handleAloaUpdate);
    }, [addToast]);

  useEffect(() => {
    if (isEditing && taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setDueDate(taskToEdit.dueDate ?? null);
      setAssignedUsers(new Set(taskToEdit.assignedUsers));
      setMatterId(taskToEdit.matterId);
      setPriority(taskToEdit.priority || TaskPriority.Medium);
      setStatus(taskToEdit.status);
    } else if (initialContext) {
      const context = initialContext.fields || initialContext;
      if (context.title) setTitle(context.title);
      if (context.description) setDescription(context.description);
      if (context.dueDate) setDueDate(context.dueDate);
      if (context.matterId) setMatterId(context.matterId);
      if (context.status) setStatus(context.status);

      if (context.priority) {
        const p = context.priority.toString().toLowerCase();
        if (p.includes('high')) setPriority(TaskPriority.High);
        else if (p.includes('low')) setPriority(TaskPriority.Low);
        else setPriority(TaskPriority.Medium);
      }

      if (context.assignedUsers) {
        setAssignedUsers(new Set(context.assignedUsers));
      } else if (appMode === 'multi' && currentUser) {
        setAssignedUsers(new Set([currentUser.id]));
      }
    } else {
      if (appMode === 'multi' && currentUser) {
        setAssignedUsers(new Set([currentUser.id]));
      }
    }
  }, [isEditing, taskToEdit, initialContext, currentUser.id, appMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      addToast('Task title is required.', { type: 'info' });
      return;
    }

    const taskData: Omit<Task, 'id' | 'createdAt' | 'creatorId'> = {
      firmId: coreState.firmDetails.id,
      title,
      description,
      status: status,
      dueDate: dueDate || null,
      assignedUsers: appMode === 'solo' ? [currentUser.id] : Array.from(assignedUsers),
      matterId,
      priority,
    };

    if (isEditing && onUpdateTask && taskToEdit) {
      onUpdateTask({ ...taskToEdit, ...taskData });
    } else if (onAddTask) {
      onAddTask(taskData);
    }
    onClose();
  };

  const handleUserToggle = (userId: string) => {
    setAssignedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) newSet.delete(userId);
      else newSet.add(userId);
      return newSet;
    });
  };

    const commonInputClass = inputModern;
  const labelClass = "block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-1.5 ml-1";
  const gridClass = isCompact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2";

  const uniqueUsers = useMemo(() => {
    const map = new Map();
    users.forEach(u => map.set(u.id, u));
    return Array.from(map.values());
  }, [users]);

  const assignableUsers = uniqueUsers.filter(u => u.role !== 'Client' && u.role !== 'External Counsel');
  const selectedUsers = uniqueUsers.filter(u => assignedUsers.has(u.id));

  const handleCoachAction = (type: 'draft' | 'research' | 'template', context?: any) => {
    if (type === 'draft') {
      if (openModal) {
        openModal('newDraft', null, { 
          draftTitle: context?.title || title, 
          matterId,
          isCourtProcess: true,
          openedFromTask: true
        });
      }
    } else if (type === 'research') {
      if (onNavigate) {
        onNavigate('research', null, { query: context?.query || title });
        onClose();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 -m-2">
      <div className="space-y-2 sm:space-y-3 pb-32">
        {/* Task Objective Section */}
        <div className="p-3 sm:p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-2 sm:space-y-3">
          <div className="flex items-center gap-4 mb-2 px-1">
            <div className="p-1.5 bg-primary-600 text-white rounded-lg shadow-sm ring-2 ring-primary-500/10">
            <TasksIcon className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-primary-600/70 uppercase tracking-widest leading-none mb-0.5">Task Detail</p>
              <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Information</h3>
            </div>
          </div>

          <div className="space-y-2 group">
            <label htmlFor="taskTitle" className={labelClass}>Task Title</label>
            <input autoComplete="off" data-lpignore="true"  type="text" id="taskTitle" value={title} onChange={e => setTitle(e.target.value)} className={commonInputClass} placeholder={isProperty ? 'e.g. Conduct Property Inspection' : 'e.g. Finalize Case Brief for High Court'} required autoFocus />
          </div>

          <div className="space-y-2 group">
            <label htmlFor="taskDescription" className={labelClass}>Description</label>
            <textarea id="taskDescription" value={description} onChange={e => setDescription(e.target.value)} rows={4} className={`${commonInputClass} resize-none`} placeholder="Add task details here..." />
          </div>

          {/* AI ASSISTANT PANEL */}
          <AloaTaskCoach 
            taskTitle={title} 
            description={description} 
            matter={matters.find(m => m.id === matterId)}
            allTasks={tasks}
            allDocuments={documents}
            onAction={handleCoachAction}
          />
        </div>

        {/* Priority & Matter association */}
        <div className="p-3 sm:p-4 bg-slate-50/50 dark:bg-zinc-800/30 rounded-xl border border-slate-100 dark:border-zinc-700/50 shadow-sm space-y-2 sm:space-y-3">
          <div className="flex items-center gap-4 px-1">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm ring-2 ring-indigo-500/10">
              <CalendarIcon className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-indigo-600/70 uppercase tracking-widest leading-none mb-0.5">Timeline</p>
              <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Schedule & Priority</h3>
            </div>
          </div>

          <div className={`grid ${gridClass} gap-3 sm:gap-4`}>
            <div className="space-y-2 group">
              <label htmlFor="taskDueDate" className={labelClass}>Due Date</label>
              <input autoComplete="off" data-lpignore="true"  type="date" id="taskDueDate" value={dueDate || ''} onChange={e => setDueDate(e.target.value || null)} className={commonInputClass} />
            </div>
            <div className="space-y-2 group">
              <label htmlFor="taskPriority" className={labelClass}>Priority Level</label>
              <div className="flex flex-wrap gap-1.5 bg-white dark:bg-zinc-800 p-1 rounded-xl ring-1 ring-slate-200 dark:ring-zinc-700/50 shadow-sm">
                {Object.values(TaskPriority).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${priority === p ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 items-end">
            <div className="space-y-2 group">
              <label htmlFor="taskMatter" className={labelClass}>Matter Association</label>
              <div className="relative">
                  <OfficeBuildingIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select id="taskMatter" value={matterId || ''} onChange={e => setMatterId(e.target.value || undefined)} className={`${commonInputClass} pl-11`}>
                    <option value="">-- Independent Task --</option>
                    {matters.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
              </div>
            </div>
            {isEditing && (
              <div className="space-y-2 group">
                <label htmlFor="taskStatus" className={labelClass}>Status</label>
                <select id="taskStatus" value={status} onChange={e => setStatus(e.target.value as TaskStatus)} className={commonInputClass}>
                  <option value={TaskStatus.Todo}>To Do</option>
                  <option value={TaskStatus.InProgress}>In Progress</option>
                  <option value={TaskStatus.Done}>Completed</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {appMode === 'multi' && (
          <div className="px-1">
            <div className="bg-slate-50/50 dark:bg-zinc-800/30 p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-zinc-700/50 space-y-2 sm:space-y-3 text-left">
              <div className="flex items-center gap-4">
                  <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg shadow-sm">
                      <UserCircleIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest leading-none mb-0.5">Personnel</p>
                    <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Team Assignment</h3>
                  </div>
              </div>
              
              <div className="flex flex-wrap gap-3 py-2">
                {selectedUsers.length === 0 && <p className="text-xs text-slate-400 font-bold uppercase tracking-widest px-1 opacity-60 italic">No personnel assigned yet</p>}
                {selectedUsers.map(user => (
                  <div key={user.id} className="flex items-center gap-3 bg-white dark:bg-zinc-900 shadow-sm border border-slate-100 dark:border-zinc-800 rounded-2xl pl-2 pr-4 py-2 text-xs font-bold animate-in zoom-in-95 duration-200 group/user">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-white text-[11px] font-black shadow-sm ${getUserColor(user.name || 'User')} `}>
                      {getInitials(user.name || 'U')}
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="text-slate-800 dark:text-zinc-200 leading-none">{user.name || 'Unknown'}</span>
                        <span className="text-[9px] text-slate-400 uppercase tracking-tight">{user.role || 'Member'}</span>
                    </div>
                    <button type="button" onClick={() => handleUserToggle(user.id)} className="ml-2 text-slate-300 hover:text-rose-500 transition-colors bg-slate-50 dark:bg-zinc-800 p-1.5 rounded-lg opacity-0 group-hover/user:opacity-100 transform translate-x-1 group-hover/user:translate-x-0 transition-all">
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="relative group/delegate">
                <select onChange={e => handleUserToggle(e.target.value)} className="w-full pl-4 pr-12 py-4 text-[10px] font-black uppercase tracking-[0.1em] bg-white dark:bg-zinc-900 border-none ring-1 ring-slate-200 dark:ring-zinc-700/50 rounded-2xl outline-none appearance-none cursor-pointer hover:ring-primary-600 hover:shadow-sm hover:shadow-primary-500/10 transition-all shadow-sm text-slate-800 dark:text-zinc-100" value="">
                  <option value="" disabled>+ Delegate to Personnel</option>
                  {assignableUsers.filter(u => !assignedUsers.has(u.id)).map(user => (
                    <option key={user.id} value={user.id}>{user.name || 'Unknown User'} ({user.role})</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-xl pointer-events-none group-hover/delegate:scale-110 transition-transform">
                    <PlusIcon className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 left-0 right-0 pt-4 sm:pt-8 pb-safe-extra bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-2 sm:gap-3 z-20">
          <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 sm:px-10 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl sm:rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
              <XIcon className="w-4 h-4" /> Cancel
          </button>
          <button type="submit" className="flex-1 sm:flex-none px-8 sm:px-12 py-2.5 bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl sm:rounded-2xl shadow-2xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <SaveIcon className="w-4 h-4" /> {isEditing ? 'Save Changes' : 'Create Task'}
          </button>
      </div>
    </form>
  );
};

export default TaskForm;
