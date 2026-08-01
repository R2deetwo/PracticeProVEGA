import React, { useState, useEffect, useMemo } from 'react';
import { Task, Matter, User, TaskStatus, ChecklistTemplate, Checklist, AppMode, Document, TaskPriority } from '../../types';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import { TasksIcon, CalendarIcon, OfficeBuildingIcon, PlusIcon, XIcon, SaveIcon, UserCircleIcon, ShieldCheckIcon } from '../../constants';
import { inputModern } from '../../utils/formStyles';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
// AloaTaskCoach import removed — the ARIA Smart Assistant panel was removed
// from the New Task modal per user request.
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<Set<string>>(new Set());
  const [matterId, setMatterId] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.Medium);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.Todo);
  const [assigneeType, setAssigneeType] = useState<'team' | 'client' | 'tenant'>('team');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!title.trim()) {
      addToast('Task title is required.', { type: 'info' });
      return;
    }
    // MANDATORY ASSIGNMENT — at least one assignee required
    const finalAssignees = appMode === 'solo' ? [currentUser.id] : Array.from(assignedUsers);
    if (finalAssignees.length === 0) {
      addToast('At least one assignee is required. Please select a team member or external stakeholder.', { type: 'error' });
      return;
    }

    const taskData: Omit<Task, 'id' | 'createdAt' | 'creatorId'> = {
      firmId: coreState.firmDetails.id,
      title,
      description,
      status: status,
      dueDate: dueDate || null,
      assignedUsers: finalAssignees,
      assigneeType,
      isSharedWithPortal: assigneeType !== 'team',
      matterId,
      priority,
    };

    setIsSubmitting(true);
    try {
      if (isEditing && onUpdateTask && taskToEdit) {
        await onUpdateTask({ ...taskToEdit, ...taskData });
      } else if (onAddTask) {
        await onAddTask(taskData);
      }
      onClose();
    } catch (e: any) {
      addToast(e?.message || 'Failed to save task.', { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
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
  const labelClass = "block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 ml-0.5";
  const gridClass = isCompact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2";

  const uniqueUsers = useMemo(() => {
    const map = new Map();
    users.forEach(u => map.set(u.id, u));
    return Array.from(map.values());
  }, [users]);

  // Segmented assignee lists — Internal Team vs External Stakeholders
  const internalTeamMembers = uniqueUsers.filter(u =>
    u.role !== 'Client' && u.role !== 'Tenant' && u.role !== 'External Counsel' && u.role !== 'Pending'
  );
  const externalClients = uniqueUsers.filter(u => u.role === 'Client');
  const externalResidents = uniqueUsers.filter(u => u.role === 'Tenant');

  // The assignable list depends on the selected assigneeType
  const assignableUsers = assigneeType === 'team' ? internalTeamMembers
    : assigneeType === 'client' ? externalClients
    : assigneeType === 'tenant' ? externalResidents
    : internalTeamMembers;

  const selectedUsers = uniqueUsers.filter(u => assignedUsers.has(u.id));

  // Notification dispatch preview — shown when external stakeholder is selected
  const notificationPreviewText = (() => {
    if (assigneeType === 'team' || selectedUsers.length === 0) return null;
    const names = selectedUsers.map(u => u.name).join(', ');
    const channels = ['Email'];
    // Check if any selected user has WhatsApp opt-in (we can't know for sure client-side,
    // so we show it as a possibility if they have a phone number)
    const hasPhone = selectedUsers.some(u => (u as any).phone || (u as any).whatsappNumber);
    if (hasPhone) channels.push('WhatsApp (if opted in)');
    return `Notification will be sent to ${names} via ${channels.join(' & ')}`;
  })();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 -m-2">
      <div className="space-y-2 sm:space-y-3 pb-4">
        {/* Task Objective Section */}
        <div className="p-3 sm:p-4 bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-2 sm:space-y-3">
          <div className="flex items-center gap-4 mb-2 px-1">
            <div className="p-1.5 bg-primary-600 text-white rounded-lg shadow-sm ring-2 ring-primary-500/10">
            <TasksIcon className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Details</h3>
          </div>

          <div className="space-y-2 group">
            <label htmlFor="taskTitle" className={labelClass}>Task Title</label>
            <input autoComplete="off" data-lpignore="true"  type="text" id="taskTitle" value={title} onChange={e => setTitle(e.target.value)} className={commonInputClass} placeholder={isProperty ? 'e.g. Conduct Property Inspection' : 'e.g. Finalize Case Brief for High Court'} required autoFocus />
          </div>

          <div className="space-y-2 group">
            <label htmlFor="taskDescription" className={labelClass}>Description</label>
            <textarea id="taskDescription" value={description} onChange={e => setDescription(e.target.value)} rows={4} className={`${commonInputClass} resize-none`} placeholder="Add task details here..." />
          </div>
        </div>

        {/* Priority & Matter association */}
        <div className="p-3 sm:p-4 bg-slate-50/50 dark:bg-zinc-800/30 rounded-xl border border-slate-100 dark:border-zinc-700/50 shadow-sm space-y-2 sm:space-y-3">
          <div className="flex items-center gap-4 px-1">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm ring-2 ring-indigo-500/10">
              <CalendarIcon className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Schedule & priority</h3>
          </div>

          <div className={`grid ${gridClass} gap-3 sm:gap-4`}>
            <div className="space-y-2 group">
              <label htmlFor="taskDueDate" className={labelClass}>Due Date</label>
              <input autoComplete="off" data-lpignore="true"  type="date" id="taskDueDate" value={dueDate || ''} onChange={e => setDueDate(e.target.value || null)} className={commonInputClass} />
            </div>
            <div className="space-y-2 group">
              <label htmlFor="taskPriority" className={labelClass}>Priority Level</label>
              <div className="flex flex-wrap gap-1.5 bg-white dark:bg-zinc-900 dark:bg-zinc-800 p-1 rounded-xl ring-1 ring-slate-200 dark:ring-zinc-700/50 shadow-sm">
                {Object.values(TaskPriority).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`px-3 py-1.5 text-3xs font-black uppercase tracking-widest rounded-lg transition-all ${priority === p ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
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
                  <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg shadow-sm">
                      <UserCircleIcon className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Assignment</h3>
              </div>

              {/* ASSIGNEE TYPE SEGMENTATION — Internal Team vs External Stakeholders */}
              <div className="flex gap-2 py-1">
                <button
                  type="button"
                  onClick={() => { setAssigneeType('team'); setAssignedUsers(new Set()); }}
                  className={`flex-1 px-3 py-2 rounded-lg text-2xs font-bold uppercase tracking-wider transition-all ${assigneeType === 'team' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'}`}
                >
                  Team
                </button>
                <button
                  type="button"
                  onClick={() => { setAssigneeType('client'); setAssignedUsers(new Set()); }}
                  className={`flex-1 px-3 py-2 rounded-lg text-2xs font-bold uppercase tracking-wider transition-all ${assigneeType === 'client' ? 'bg-violet-600 text-white shadow-sm' : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'}`}
                >
                  Client
                </button>
                <button
                  type="button"
                  onClick={() => { setAssigneeType('tenant'); setAssignedUsers(new Set()); }}
                  className={`flex-1 px-3 py-2 rounded-lg text-2xs font-bold uppercase tracking-wider transition-all ${assigneeType === 'tenant' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'}`}
                >
                  Resident
                </button>
              </div>

              {/* NOTIFICATION DISPATCH PREVIEW — shown when external stakeholder is selected.
                  Placed ABOVE the chips so it's never cropped by the footer. */}
              {notificationPreviewText && (
                <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-lg">
                  <svg className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-2xs text-blue-700 dark:text-blue-300 font-medium">{notificationPreviewText}</p>
                </div>
              )}

              {/* Empty state messages per type */}
              {assignableUsers.length === 0 && (
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest px-1 opacity-60 italic py-2">
                  {assigneeType === 'team' ? 'No team members available' : assigneeType === 'client' ? 'No clients available' : 'No residents available'}
                </p>
              )}

              <div className="flex flex-wrap gap-3 py-2">
                {selectedUsers.length === 0 && assignableUsers.length > 0 && <p className="text-xs text-slate-400 font-bold uppercase tracking-widest px-1 opacity-60 italic">No one assigned yet — at least one assignee is required</p>}
                {selectedUsers.map(user => (
                  <div key={user.id} className="flex items-center gap-3 bg-white dark:bg-zinc-900 shadow-sm border border-slate-100 dark:border-zinc-800 rounded-2xl pl-2 pr-4 py-2 text-xs font-bold animate-in zoom-in-95 duration-200 group/user">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-white text-2xs font-black shadow-sm ${getUserColor(user.name || 'User')} `}>
                      {getInitials(user.name || 'U')}
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="text-slate-800 dark:text-zinc-200 leading-none">{user.name || 'Unknown'}</span>
                        <span className="text-3xs text-slate-400 uppercase tracking-tight">{user.role || 'Member'}</span>
                    </div>
                    <button type="button" onClick={() => handleUserToggle(user.id)} className="ml-2 text-slate-300 hover:text-rose-500 transition-colors bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-800 p-1.5 rounded-lg opacity-0 group-hover/user:opacity-100 transform translate-x-1 group-hover/user:translate-x-0 transition-all">
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="relative group/delegate">
                <select onChange={e => { handleUserToggle(e.target.value); e.target.value = ''; }} className="w-full pl-4 pr-12 py-4 text-2xs font-black uppercase tracking-[0.1em] bg-white dark:bg-zinc-900 border-none ring-1 ring-slate-200 dark:ring-zinc-700/50 rounded-2xl outline-none appearance-none cursor-pointer hover:ring-primary-600 hover:shadow-sm hover:shadow-primary-500/10 transition-all shadow-sm text-slate-800 dark:text-zinc-100" value="">
                  <option value="" disabled>+ Assign {assigneeType === 'team' ? 'Team Member' : assigneeType === 'client' ? 'Client' : 'Resident'}</option>
                  {assignableUsers.filter(u => !assignedUsers.has(u.id)).map(user => (
                    <option key={user.id} value={user.id}>{user.name || 'Unknown User'} ({user.role})</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 rounded-xl pointer-events-none group-hover/delegate:scale-110 transition-transform">
                    <PlusIcon className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 sm:pt-6 pb-safe-extra bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-2 sm:gap-3 z-20">
          <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 sm:px-10 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-semibold rounded-xl sm:rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
              <XIcon className="w-4 h-4" /> Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none px-8 sm:px-12 py-2.5 bg-primary-600 text-white text-xs font-semibold rounded-xl sm:rounded-2xl shadow-2xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              <SaveIcon className="w-4 h-4" /> {isEditing ? 'Save Changes' : 'Create Task'}
          </button>
      </div>
    </form>
  );
};

export default TaskForm;
