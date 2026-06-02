

import React, { useState, useEffect } from 'react';
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
  
  // Progress steps for visual feedback
  const [steps, setSteps] = useState({
      nameEntered: false,
      idGenerated: false,
      storageSecure: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmName.trim()) return;

    setStatus('processing');
    setSteps(s => ({ ...s, nameEntered: true }));

    try {
        // Simulate a brief sequence to show the user "work is happening" (Visual feedback)
        await new Promise(r => setTimeout(r, 600));
        setSteps(s => ({ ...s, idGenerated: true }));
        
        await new Promise(r => setTimeout(r, 600));
        setSteps(s => ({ ...s, storageSecure: true }));
        
        await new Promise(r => setTimeout(r, 600));
        
        // Actual Logic
        await createFirm(firmName.trim(), 'Address Pending', SubscriptionPlan.Core, undefined, product);
        
        setStatus('completed');
        addToast("Workspace activated successfully!", { type: 'success' });
        
        // Brief delay before closing to let them see the "Complete" state
        setTimeout(() => {
            if (onSuccess) onSuccess();
            onClose();
        }, 1000);

    } catch (error) {
        console.error("Failed to setup workspace:", error);
        addToast("Failed to create workspace. Please try again.", { type: 'error' });
        setStatus('idle');
        setSteps({ nameEntered: false, idGenerated: false, storageSecure: false });
    }
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col items-center text-center p-4 pb-0">
             <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <LockClosedIcon className="w-8 h-8 text-blue-600" />
             </div>
             <h3 className="text-xl font-bold text-slate-900 dark:text-white">Activate Your Workspace</h3>
             <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 max-w-sm">
                 You are currently in <strong>Guest Mode</strong>. To {pendingAction ? pendingAction.toLowerCase() : 'save data'}, we need to initialize a secure firm database for you.
             </p>
        </div>

        <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-5 border border-slate-200 dark:border-zinc-700">
            <h4 className="text-xs font-bold uppercase text-slate-400 mb-3 tracking-wider">Setup Checklist</h4>
            <ul className="space-y-3">
                <li className={`flex items-center gap-3 text-sm transition-colors ${steps.nameEntered ? 'text-green-600 dark:text-green-400' : 'text-slate-500'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${steps.nameEntered ? 'bg-green-100 border-green-500' : 'border-slate-300'}`}>
                        {steps.nameEntered && <CheckCircleIcon className="w-3.5 h-3.5" />}
                    </div>
                    <span>Register Firm Identity</span>
                </li>
                <li className={`flex items-center gap-3 text-sm transition-colors ${steps.idGenerated ? 'text-green-600 dark:text-green-400' : 'text-slate-500'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${steps.idGenerated ? 'bg-green-100 border-green-500' : 'border-slate-300'}`}>
                        {steps.idGenerated && <CheckCircleIcon className="w-3.5 h-3.5" />}
                    </div>
                    <span>Generate Unique Workspace ID</span>
                </li>
                <li className={`flex items-center gap-3 text-sm transition-colors ${steps.storageSecure ? 'text-green-600 dark:text-green-400' : 'text-slate-500'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${steps.storageSecure ? 'bg-green-100 border-green-500' : 'border-slate-300'}`}>
                        {steps.storageSecure && <CheckCircleIcon className="w-3.5 h-3.5" />}
                    </div>
                    <span>Initialize Secure Storage</span>
                </li>
            </ul>
        </div>

        {status === 'idle' && (
            <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
                <div>
                    <label htmlFor="firmName" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                        What is your Firm's Name?
                    </label>
                    <div className="relative">
                        <OfficeBuildingIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input autoComplete="off" data-lpignore="true" 
                            type="text"
                            id="firmName"
                            value={firmName}
                            onChange={(e) => setFirmName(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-zinc-600 rounded-xl bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-primary-500 shadow-sm"
                            placeholder="e.g. Adeyemi & Co."
                            required
                            autoFocus
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2 mt-4">
                        What will you use PracticePro for?
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button type="button" onClick={() => setProduct('legal')} className={`p-3 text-left border rounded-xl transition-colors ${product === 'legal' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`}>
                            <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">Vega (Legal OS)</div>
                        </button>
                        <button type="button" onClick={() => setProduct('property')} className={`p-3 text-left border rounded-xl transition-colors ${product === 'property' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`}>
                            <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">Atrium (Property OS)</div>
                        </button>
                        <button type="button" onClick={() => setProduct('unified')} className={`p-3 text-left border rounded-xl transition-colors ${product === 'unified' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`}>
                            <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">Unified (Both)</div>
                        </button>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-4 py-2.5 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        disabled={!firmName.trim() || !product}
                        className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Initialize & Continue
                    </button>
                </div>
            </form>
        )}

        {status === 'processing' && (
            <div className="flex flex-col items-center justify-center py-4 animate-pulse">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-2"></div>
                <p className="text-sm font-medium text-slate-600 dark:text-zinc-300">Setting up your workspace...</p>
            </div>
        )}

        {status === 'completed' && (
            <div className="flex flex-col items-center justify-center py-2 animate-scale-in">
                <div className="text-green-500 mb-2">
                    <CheckCircleIcon className="w-12 h-12" />
                </div>
                <p className="text-lg font-bold text-slate-800 dark:text-white">You're all set!</p>
                <p className="text-sm text-slate-500">Saving your {pendingAction?.toLowerCase() || 'item'} now...</p>
            </div>
        )}
    </div>
  );
};

export default WorkspaceSetupModal;