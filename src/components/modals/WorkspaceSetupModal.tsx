

import React, { useState } from 'react';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { OfficeBuildingIcon, CheckCircleIcon, LockClosedIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';
import { SubscriptionPlan } from '../../types';

interface WorkspaceSetupModalProps {
 onSuccess?: () => void;
 pendingAction?: string;
 onClose: () => void;
}

const WorkspaceSetupModal: React.FC<WorkspaceSetupModalProps> = ({ onSuccess, pendingAction, onClose }) => {
 const { createFirm } = useDataActions();
 const { addToast } = useUI();
 const [firmName, setFirmName] = useState('');
 const [product, setProduct] = useState<'legal' | 'property' | 'unified'>('legal');
 const [status, setStatus] = useState<'idle' | 'processing' | 'completed'>('idle');

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!firmName.trim()) return;

  setStatus('processing');

  try {
    // Create the firm — no fake delays
    await createFirm(firmName.trim(), 'Address Pending', SubscriptionPlan.Core, undefined, product);
    
    setStatus('completed');
    addToast("Workspace activated successfully!", { type: 'success' });
    
    // Brief delay to show the success state before closing
    setTimeout(() => {
      if (onSuccess) onSuccess();
      onClose();
    }, 600);

  } catch (error) {
    console.error("Failed to setup workspace:", error);
    addToast("Failed to create workspace. Please try again.", { type: 'error' });
    setStatus('idle');
  }
 };

 return (
  <div className="space-y-6">
    <div className="flex flex-col items-center text-center p-4 pb-0">
       <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
        <LockClosedIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
       </div>
       <h3 className="text-xl font-bold text-slate-900 dark:text-white">Activate Your Workspace</h3>
       <p className="text-sm text-slate-500 mt-2 max-w-sm">
         You are currently in <strong>Guest Mode</strong>. To {pendingAction ? pendingAction.toLowerCase() : 'save data'}, we need to initialize a secure workspace for you.
       </p>
    </div>

    {status === 'idle' && (
      <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
        <div>
          <label htmlFor="firmName" className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
            What is your {product === 'property' ? "Portfolio" : "Firm's"} Name?
          </label>
          <div className="relative">
            <OfficeBuildingIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input autoComplete="off" data-lpignore="true"
              type="text"
              id="firmName"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm text-slate-900 dark:text-white"
              placeholder={product === 'property' ? "e.g. Horizon Properties" : "e.g. Adeyemi & Co."}
              required
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">
            What will you use PracticePro for?
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setProduct('legal')} className={`p-3 text-center border rounded-lg transition-all ${product === 'legal' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-500' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`}>
              <div className="font-bold text-xs text-slate-900 dark:text-white">Vega (Legal)</div>
            </button>
            <button type="button" onClick={() => setProduct('property')} className={`p-3 text-center border rounded-lg transition-all ${product === 'property' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-500' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`}>
              <div className="font-bold text-xs text-slate-900 dark:text-white">Atrium (Property)</div>
            </button>
            <button type="button" onClick={() => setProduct('unified')} className={`p-3 text-center border rounded-lg transition-all ${product === 'unified' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`}>
              <div className="font-bold text-xs text-slate-900 dark:text-white">Unified</div>
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2.5 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 rounded-lg font-bold text-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={!firmName.trim() || !product}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-bold text-sm hover:bg-primary-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Activate Workspace
          </button>
        </div>
      </form>
    )}

    {status === 'processing' && (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-10 h-10 border-4 border-slate-200 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">Creating your workspace...</p>
      </div>
    )}

    {status === 'completed' && (
      <div className="flex flex-col items-center justify-center py-6 animate-fade-in">
        <div className="text-emerald-500 mb-3">
          <CheckCircleIcon className="w-12 h-12" />
        </div>
        <p className="text-lg font-black text-slate-800 dark:text-zinc-100">You're all set!</p>
        <p className="text-sm text-slate-500">Saving your {pendingAction?.toLowerCase() || 'item'} now...</p>
      </div>
    )}
  </div>
 );
};

export default WorkspaceSetupModal;
