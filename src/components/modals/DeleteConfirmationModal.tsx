
import React, { useState, useEffect, useRef } from 'react';
import { DownloadIcon } from '../../constants';
import { AlertTriangle, X } from 'lucide-react';

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
  confirmText = 'Delete',
  confirmButtonClass = 'bg-rose-600 hover:bg-rose-700',
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

  // TASK 19: Restyled to match the ConfirmDialog component (messages style).
  // Same icon (AlertTriangle in a colored circle), same layout (header with
  // icon + title + message, body with context, footer with Cancel/Delete
  // buttons). The advanced features (verification text, password, archive,
  // export) are kept but styled to match.
  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header with icon — matches ConfirmDialog */}
      <div className="p-5 sm:p-6 flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {title}
          </h2>
          <div className="mt-1 text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
            {message}
          </div>
        </div>
        <button
          onClick={onCancel}
          className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body — advanced features (verification, password, export, double-warning) */}
      {step === 1 ? (
          <div className="px-5 sm:px-6 pb-2 space-y-3">
            {/* Export Option inside deletion flow */}
            {onExport && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
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
          <div className="mx-5 sm:mx-6 mb-2 p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-r-lg animate-fade-in">
              <h4 className="font-bold text-amber-800 dark:text-amber-200 mb-2">Advisory Notice</h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                  It is strongly advised that you inform the firm administrator of these changes after you have made them.
              </p>
              <p className="text-sm font-semibold mt-2">Do you still want to proceed?</p>
          </div>
      )}
      
      {verificationText && step === 1 && !requiresPassword && (
        <div className="mx-5 sm:mx-6 mb-2 p-4 bg-rose-50 dark:bg-rose-900/10 rounded-lg border border-rose-100 dark:border-rose-900/30">
            <label className="block text-sm font-semibold text-rose-800 dark:text-rose-200 mb-2 select-none">
                To confirm, type <span className="font-mono bg-white dark:bg-black/20 px-1 py-0.5 rounded border border-rose-200 dark:border-rose-800 select-all">{verificationText}</span> below:
            </label>
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-2.5 text-sm border border-rose-300 dark:border-rose-800 rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white placeholder-rose-200 dark:placeholder-rose-900/50"
                placeholder={verificationText}
                autoComplete="off"
            />
        </div>
      )}

      {requiresPassword && step === 1 && (
        <div className="mx-5 sm:mx-6 mb-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">Your Password</label>
            <input
                ref={inputRef}
                type="password"
                placeholder="Enter your password to confirm..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-2.5 text-sm border border-slate-300 dark:border-zinc-600 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                autoComplete="off"
            />
        </div>
      )}

      {/* Footer — matches ConfirmDialog button styling */}
      <div className="px-5 sm:px-6 py-4 bg-slate-50 dark:bg-zinc-950/50 border-t border-slate-200 dark:border-zinc-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-auto">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors active:scale-[0.98]"
        >
          Cancel
        </button>
        {onConfirmArchive && step === 1 && (
             <button
                type="button"
                onClick={() => onConfirmArchive()}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-colors active:scale-[0.98]"
            >
                {archiveText}
            </button>
        )}
        <button 
            type="button" 
            onClick={handlePrimaryAction} 
            disabled={!isConfirmed}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors active:scale-[0.98] shadow-lg ${confirmButtonClass} ${!isConfirmed ? 'opacity-50 cursor-not-allowed grayscale' : 'shadow-rose-600/20'}`}
        >
          {step === 1 ? (isDoubleWarning ? "I Understand, Continue" : confirmText) : "Yes, Delete It"}
        </button>
      </div>
    </div>
  );
};

export default ConfirmationModal;
