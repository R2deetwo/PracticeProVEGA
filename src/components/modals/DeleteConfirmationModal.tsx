
import React, { useState, useEffect, useRef } from 'react';
import { DownloadIcon } from '../../constants';

interface ConfirmationModalProps {
  title: string;
  message: React.ReactNode;
  onConfirm: (inputValue?: string) => void | Promise<void>;
  onCancel: () => void;
  confirmText?: string;
  confirmButtonClass?: string;
  onConfirmArchive?: () => void;
  archiveText?: string;
  verificationText?: string;
  requiresPassword?: boolean;
  isDoubleWarning?: boolean;
  onExport?: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Delete Permanently',
  confirmButtonClass = 'bg-red-600 hover:bg-red-700',
  onConfirmArchive,
  archiveText = 'Archive',
  verificationText,
  requiresPassword,
  isDoubleWarning,
  onExport
}) => {
  const [inputValue, setInputValue] = useState('');
  const [step, setStep] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const isConfirmed = (!verificationText || (inputValue.trim() === verificationText)) && (!requiresPassword || inputValue.length > 0);

  useEffect(() => {
    if ((verificationText || requiresPassword) && inputRef.current) {
        inputRef.current.focus();
    }
  }, [verificationText, requiresPassword]);

  const handlePrimaryAction = () => {
      if (!isConfirmed) return;
      
      if (isDoubleWarning && step === 1) {
          setStep(2);
      } else {
          onConfirm(inputValue);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          handlePrimaryAction();
      }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
      
      {step === 1 ? (
          <div className="text-gray-600 dark:text-gray-300 space-y-2">
            {message}
             {/* Export Option inside deletion flow */}
            {onExport && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200">Save your data first?</h4>
                        <p className="text-xs text-blue-600 dark:text-blue-300">You can download a complete archive before deleting.</p>
                    </div>
                    <button 
                        type="button"
                        onClick={onExport}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-xs font-bold rounded shadow-sm hover:bg-blue-50 dark:hover:bg-zinc-700"
                    >
                        <DownloadIcon className="w-3 h-3" /> Export
                    </button>
                </div>
            )}
          </div>
      ) : (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded-r-lg animate-fade-in">
              <h4 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2">Advisory Notice</h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  It is strongly advised that you inform the firm administrator of these changes after you have made them.
              </p>
              <p className="text-sm font-semibold mt-2">Do you still want to proceed?</p>
          </div>
      )}
      
      {verificationText && step === 1 && !requiresPassword && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
            <label className="block text-sm font-semibold text-red-800 dark:text-red-200 mb-2 select-none">
                To confirm, type <span className="font-mono bg-white dark:bg-black/20 px-1 py-0.5 rounded border border-red-200 dark:border-red-800 select-all">{verificationText}</span> below:
            </label>
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-2.5 text-sm border border-red-300 dark:border-red-800 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white placeholder-red-200 dark:placeholder-red-900/50"
                placeholder={verificationText}
                autoComplete="off"
            />
        </div>
      )}

      {requiresPassword && step === 1 && (
        <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">Your Password</label>
            <input
                ref={inputRef}
                type="password"
                placeholder="Enter your password to confirm..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-2.5 text-sm border border-slate-300 dark:border-zinc-600 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                autoComplete="off"
            />
        </div>
      )}

      <div className="pt-6 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-slate-100 dark:border-zinc-800 mt-4">
        <button type="button" onClick={() => onCancel()} className="w-full sm:w-auto px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
          Cancel
        </button>
        {onConfirmArchive && step === 1 && (
             <button type="button" onClick={() => onConfirmArchive()} className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 transition-colors shadow-md">
                {archiveText}
            </button>
        )}
        <button 
            type="button" 
            onClick={handlePrimaryAction} 
            disabled={!isConfirmed}
            className={`w-full sm:w-auto px-4 py-2 text-white rounded-lg font-semibold transition-all shadow-sm flex items-center justify-center ${confirmButtonClass} ${!isConfirmed ? 'opacity-50 cursor-not-allowed grayscale' : 'opacity-100 hover:shadow-md'}`}
        >
          {step === 1 ? (isDoubleWarning ? "I Understand, Continue" : confirmText) : "Yes, Delete It"}
        </button>
      </div>
    </div>
  );
};

export default ConfirmationModal;
