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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    if (isEditing && userToEdit) {
      onUpdateUser({ ...userToEdit, ...userData });
    } else {
      onAddUser(userData as Omit<User, 'id'>);
    }
    onClose();
  };

    const commonInputClass = inputModern;
  const labelClass = "block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-1.5 ml-1";

  if (!isEditing) {
    return (
      <div className="flex flex-col gap-4 -m-2">
        <div className="space-y-3 pb-6">
          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30 text-center space-y-3">
            <div className="w-14 h-14 bg-white dark:bg-zinc-900 rounded-xl shadow-sm flex items-center justify-center mx-auto ring-2 ring-indigo-500/10">
              <ShieldCheckIcon className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-indigo-600/70 uppercase tracking-widest leading-none mb-1.5">Security Protocol</p>
              <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Onboarding Authorization</h3>
              <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-sm mx-auto">
                PracticePro utilizes a secure, zero-trust invitation system. Distributed entities must authenticate using your exclusive {isProperty ? 'portfolio' : 'firm'} credential.
              </p>
            </div>
            
            <div className="p-4 bg-white dark:bg-zinc-800 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 shadow-2xl space-y-3 group transition-all hover:scale-[1.02]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Invite Code</p>
              <div className="text-3xl font-black tracking-[0.3em] text-primary-600 font-mono">
                {inviteCode || 'CODE_PENDING'}
              </div>
            </div>
          </div>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 py-1 bg-white dark:bg-zinc-900 text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] rounded-full border border-slate-100 dark:border-zinc-800">Alternative Path</span>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-3">
            <div className="flex items-center gap-4 px-1">
              <div className="p-3 bg-slate-100 dark:bg-zinc-900 text-slate-400 dark:text-zinc-600 rounded-2xl shadow-sm">
                <UserCircleIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Manual Definition</p>
                <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight leading-tight">Create Identity Placeholder</h3>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-2 group">
                <label htmlFor="name" className={labelClass}>Resource Label (Name)</label>
                <input autoComplete="off" data-lpignore="true"  type="text" id="name" value={name} onChange={e => setName(e.target.value)} className={commonInputClass} placeholder={isProperty ? "e.g. Property Manager..." : "e.g. Associate Counsel..."} required />
              </div>
              <div className="space-y-2 group">
                <label htmlFor="email" className={labelClass}>Communications URI (Email)</label>
                <input autoComplete="off" data-lpignore="true"  type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className={commonInputClass} placeholder={isProperty ? "placeholder@portfolio.com" : "placeholder@firm.com"} required />
              </div>
            </form>
          </div>
        </div>

        <div className="sticky bottom-0 left-0 right-0 pt-8 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-3 z-50">
          <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-10 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
            <XIcon className="w-4 h-4" /> Cancel
          </button>
          <button onClick={handleSubmit} type="button" className="flex-1 sm:flex-none px-12 py-2.5 bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <SaveIcon className="w-4 h-4" /> Initialize Placeholder
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 -m-2">
      <div className="space-y-3 pb-6">
        <div className="p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-3">
          <div className="flex items-center gap-4 mb-2 px-1">
            <div className="p-1.5 bg-primary-600 text-white rounded-lg shadow-sm ring-2 ring-primary-500/10">
              <UserCircleIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-primary-600/70 uppercase tracking-widest leading-none mb-0.5">Profile Modification</p>
              <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Identity & Role</h3>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2 group">
              <label htmlFor="name" className={labelClass}>Entity Legal Name</label>
              <input autoComplete="off" data-lpignore="true"  type="text" id="name" value={name} onChange={e => setName(e.target.value)} className={commonInputClass} required />
            </div>
            <div className="space-y-2 group">
              <label htmlFor="email" className={labelClass}>Electronic Communications Address</label>
              <input autoComplete="off" data-lpignore="true"  type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className={commonInputClass} required />
            </div>
            <div className="space-y-2 group">
              <label htmlFor="role" className={labelClass}>System Access Level (Role)</label>
              <div className="relative">
                <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select id="role" value={role} onChange={e => setRole(e.target.value as UserRole)} className={`${commonInputClass} pl-11 appearance-none`} required>
                  <option value={UserRole.Lawyer}>{isProperty ? 'Manager' : 'Lawyer'} (Full Privileges)</option>
                  <option value={UserRole.Paralegal}>{isProperty ? 'Staff' : 'Paralegal'} (Support)</option>
                  <option value={UserRole.Admin}>{isProperty ? 'Portfolio Administrator' : 'Firm Administrator'}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 pt-8 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-3 z-50">
        <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-10 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
          <XIcon className="w-4 h-4" /> Cancel
        </button>
        <button type="submit" className="flex-1 sm:flex-none px-12 py-2.5 bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
          <SaveIcon className="w-4 h-4" /> Sync Changes
        </button>
      </div>
    </form>
  );
};
export default UserForm;
