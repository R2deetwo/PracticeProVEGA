import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import { UserIcon, InfoIcon, XIcon, SaveIcon, UserCircleIcon, ShieldCheckIcon, KeyIcon } from '../../constants';
import { inputModern } from '../../utils/formStyles';

interface UserFormProps {
  userToEdit?: User;
  onAddUser: (user: Omit<User, 'id'>) => void;
  onUpdateUser: (user: User) => void;
  onClose: () => void;
}

const UserForm: React.FC<UserFormProps> = ({ userToEdit, onAddUser, onUpdateUser, onClose }) => {
  const { coreState, isDataLoaded } = useCoreState();
    const { addToast } = useUI();
    const { isProperty } = useProduct();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.Paralegal);
  const [standards, setStandards] = useState({
    lastPracticingFeePaidYear: new Date().getFullYear() - 1,
    nbaStampStatus: 'Pending' as 'Approved' | 'Pending',
    completedCpdHours: 0
  });

  const isEditing = !!userToEdit;
  const inviteCode = coreState.firmDetails.inviteCode;

  useEffect(() => {
    if (isEditing && userToEdit) {
      setName(userToEdit.name);
      setEmail(userToEdit.email);
      setRole(userToEdit.role);
      if (userToEdit.professionalStandards) {
        setStandards(userToEdit.professionalStandards);
      }
    }
  }, [isEditing, userToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!name.trim() || !email.trim()) {
      addToast("Please provide a name and email.", { type: 'info' });
      return;
    }
    const userData = {
      name,
      email,
      role,
      avatarUrl: userToEdit?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
      barNumber: userToEdit?.barNumber || 'N/A',
      showProTips: userToEdit?.showProTips ?? true,
      professionalStandards: role === UserRole.Lawyer ? standards : undefined, // Updated check
    };
    setIsSubmitting(true);
    try {
      if (isEditing && userToEdit) {
        await onUpdateUser({ ...userToEdit, ...userData });
      } else {
        await onAddUser(userData as Omit<User, 'id'>);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

    const commonInputClass = inputModern;
  const labelClass = "block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 ml-0.5";

  if (!isEditing) {
    return (
      <div className="flex flex-col gap-4 -m-2">
        <div className="space-y-2 sm:space-y-3 pb-6">
          <div className="p-3 sm:p-4 bg-indigo-50 dark:bg-indigo-950/40/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30 text-center space-y-3">
            <div className="w-14 h-14 bg-white dark:bg-zinc-900 rounded-xl shadow-sm flex items-center justify-center mx-auto ring-2 ring-indigo-500/10">
              <ShieldCheckIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Invite a Team Member</h3>
              <p className="text-2xs font-medium text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-sm mx-auto">
                Share this invite code so they can join your {isProperty ? 'portfolio' : 'firm'}. They'll authenticate using their email address.
              </p>
            </div>
            
            <div className="p-3 sm:p-4 bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Invite Code</p>
              <div className="text-3xl font-black tracking-[0.3em] text-primary-600 dark:text-primary-300 font-mono">
                {inviteCode || 'CODE_PENDING'}
              </div>
            </div>
          </div>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 py-1 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-500 dark:text-zinc-400 rounded-full border border-slate-100 dark:border-zinc-800">or add manually</span>
            </div>
          </div>

          <div className="p-3 sm:p-4 bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-3">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-2 group">
                <label htmlFor="name" className={labelClass}>Name</label>
                <input autoComplete="off" data-lpignore="true"  type="text" id="name" value={name} onChange={e => setName(e.target.value)} className={commonInputClass} placeholder={isProperty ? "e.g. Property Manager" : "e.g. Associate Counsel"} required />
              </div>
              <div className="space-y-2 group">
                <label htmlFor="email" className={labelClass}>Email</label>
                <input autoComplete="off" data-lpignore="true"  type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className={commonInputClass} placeholder={isProperty ? "name@portfolio.com" : "name@firm.com"} required />
              </div>
            </form>
          </div>
        </div>

        <div className="sticky bottom-0 left-0 right-0 pt-3 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-2 z-50 pb-safe-extra">
          <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-5 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} type="button" disabled={isSubmitting} className="flex-1 sm:flex-none px-5 py-2 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1.5 disabled:opacity-50">
            <SaveIcon className="w-3.5 h-3.5" /> Add User
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 -m-2">
      <div className="space-y-2 sm:space-y-3 pb-6">
        <div className="p-3 sm:p-4 bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-3">
          <div className="space-y-3">
            <div className="space-y-2 group">
              <label htmlFor="name" className={labelClass}>Name</label>
              <input autoComplete="off" data-lpignore="true"  type="text" id="name" value={name} onChange={e => setName(e.target.value)} className={commonInputClass} required />
            </div>
            <div className="space-y-2 group">
              <label htmlFor="email" className={labelClass}>Email</label>
              <input autoComplete="off" data-lpignore="true"  type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className={commonInputClass} required />
            </div>
            <div className="space-y-2 group">
              <label htmlFor="role" className={labelClass}>Role</label>
              <div className="relative">
                <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select id="role" value={role} onChange={e => setRole(e.target.value as UserRole)} className={`${commonInputClass} pl-11 appearance-none`} required>
                  <option value={UserRole.Lawyer}>{isProperty ? 'Manager' : 'Lawyer'}</option>
                  <option value={UserRole.Paralegal}>{isProperty ? 'Staff' : 'Paralegal'}</option>
                  <option value={UserRole.Admin}>{isProperty ? 'Portfolio Administrator' : 'Firm Administrator'}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 pt-3 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-2 z-50 pb-safe-extra">
        <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-5 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none px-5 py-2 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1.5 disabled:opacity-50">
          <SaveIcon className="w-3.5 h-3.5" /> Save
        </button>
      </div>
    </form>
  );
};
export default UserForm;
