
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

/**
 * ConfirmationModal — Delete confirmation dialog.
 *
 * TASK 19: Restyled to EXACTLY match the ConfirmDialog component used in
 * Messages. Same icon (AlertTriangle in rose circle), same header layout,
 * same button styling, same footer. The advanced features (verification
 * text, password, archive, export, double-warning) are preserved but
 * rendered in the same visual style.
 *
 * This is the standard delete dialog for the entire app. Properties,
 * matters, contacts, etc. all use this via openModal('deleteConfirmation').
 */
const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
 title,
 message,
 onConfirm,
 onCancel,
 confirmText = 'Delete',
 confirmButtonClass,
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
   if (e.key === 'Escape') {
     e.preventDefault();
     onCancel();
   }
 };

 return (
  <div className="flex flex-col h-full animate-fade-in" onKeyDown={handleKeyDown}>
   {/* Header — EXACT match to ConfirmDialog */}
   <div className="p-5 sm:p-6 flex items-start gap-4">
    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-rose-100 text-rose-600">
     <AlertTriangle className="w-5 h-5" />
    </div>
    <div className="flex-1 min-w-0">
     <h2 className="text-base font-bold text-slate-900 dark:text-white">
      {title}
     </h2>
     {step === 1 ? (
      <div className="mt-1 text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
       {message}
      </div>
     ) : (
      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 rounded-r-lg">
       <p className="text-sm text-amber-700 dark:text-amber-300">
         It is strongly advised that you inform the firm administrator of these changes after you have made them.
       </p>
       <p className="text-sm font-semibold mt-2">Do you still want to proceed?</p>
      </div>
     )}
    </div>
    <button
     onClick={onCancel}
     className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-colors"
     aria-label="Close"
    >
     <X className="w-4 h-4" />
    </button>
   </div>

   {/* Body — advanced features (only shown in step 1) */}
   {step === 1 && (
    <div className="px-5 sm:px-6 pb-2 space-y-3">
     {/* Export Option */}
     {onExport && (
      <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-lg flex items-center justify-between">
       <div>
        <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200">Save your data first?</h4>
        <p className="text-xs text-blue-600 dark:text-blue-400">You can download a complete archive before deleting.</p>
       </div>
       <button
        type="button"
        onClick={onExport}
        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold rounded shadow-sm hover:bg-blue-50 dark:hover:bg-blue-950/40"
       >
        <DownloadIcon className="w-3 h-3" /> Export
       </button>
      </div>
     )}

     {/* Verification text input */}
     {verificationText && !requiresPassword && (
      <div className="p-4 bg-rose-50 rounded-lg border border-rose-100">
       <label className="block text-sm font-semibold text-rose-800 mb-2 select-none">
        To confirm, type <span className="font-mono bg-white dark:bg-zinc-900 px-1 py-0.5 rounded border border-rose-200 select-all">{verificationText}</span> below:
       </label>
       <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="w-full p-2.5 text-sm border border-rose-300 dark:border-rose-800 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white"
        placeholder={verificationText}
        autoComplete="off"
       />
      </div>
     )}

     {/* Password input */}
     {requiresPassword && (
      <div>
       <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">Your Password</label>
       <input
        ref={inputRef}
        type="password"
        placeholder="Enter your password to confirm..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="w-full px-4 py-2.5 text-sm border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent"
        autoComplete="off"
       />
      </div>
     )}
    </div>
   )}

   {/* Footer — EXACT match to ConfirmDialog */}
   <div className="px-5 sm:px-6 py-4 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-700 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-auto">
    <button
     type="button"
     onClick={onCancel}
     className="px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors active:scale-[0.98]"
    >
     Cancel
    </button>
    {onConfirmArchive && step === 1 && (
     <button
      type="button"
      onClick={() => onConfirmArchive()}
      className="px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-colors active:scale-[0.98]"
     >
      {archiveText}
     </button>
    )}
    <button
     type="button"
     onClick={handlePrimaryAction}
     disabled={!isConfirmed}
     className={`px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-colors active:scale-[0.98] shadow-lg ${
      confirmButtonClass || 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
     } ${!isConfirmed ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
    >
     {step === 1 ? (isDoubleWarning ? "I Understand, Continue" : confirmText) : "Yes, Delete It"}
    </button>
   </div>
  </div>
 );
};

export default ConfirmationModal;
