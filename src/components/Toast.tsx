
import React, { useState } from 'react';
import { Toast as ToastType } from '../types';

interface ToastProps {
  toast: ToastType;
  onRemove: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  // CRO AUDIT FIX — removed the local setTimeout auto-dismiss.
  // UIContext.tsx already handles auto-removal with the caller-specified
  // duration (default 5000ms, but callers can pass duration: 7000 for
  // important errors). The local setTimeout was hardcoded to 5000ms and
  // raced with UIContext's timer, causing toasts to always vanish at 5s
  // regardless of the caller's duration preference.

  const handleManualClose = () => {
    if (isExiting) return; // Prevent double-close
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const handleLinkClick = () => {
    if (toast.link) {
      toast.link.onClick();
      handleManualClose();
    }
  };

  const config = {
    success: {
      icon: <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      border: 'border-green-500',
    },
    error: {
      icon: <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      border: 'border-red-500',
    },
    info: {
      icon: <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      border: 'border-blue-500',
    },
    warning: {
      icon: <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
      border: 'border-amber-500',
    },
  };

  const style = config[toast.type] || config.info;

  return (
    <div
      className={`
        group relative w-full max-w-sm bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md
        shadow-xl rounded-lg pointer-events-auto overflow-hidden border-l-4 ${style.border}
        transition-all duration-300 ease-in-out transform
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
    >
      <div className="p-3.5">
        <div className="flex items-start">
          <div className="flex-shrink-0">{style.icon}</div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <div className="text-sm font-medium text-gray-900 dark:text-white">{toast.message}</div>
            {toast.link && (
              <p className="mt-1 text-sm">
                <button onClick={handleLinkClick} className="font-medium text-primary-600 hover:text-primary-500 focus:outline-none focus:underline">
                  {toast.link.text}
                </button>
              </p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={handleManualClose}
              className="bg-transparent rounded-md inline-flex text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 focus:outline-none transition-colors"
            >
              <span className="sr-only">Close</span>
              {/* Clean X icon — two crossed lines */}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;
