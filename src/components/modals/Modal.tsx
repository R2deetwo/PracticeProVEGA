
import React, { useEffect, useState } from 'react';
import { XIcon } from '../../constants';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);

  useEffect(() => {
    let unmountTimer: number;

    if (isOpen) {
      // Mount immediately and start animation in the same render cycle
      // Using a single rAF to ensure the DOM has painted the initial state
      // before triggering the transition — this feels instant to the user
      setIsMounted(true);
      requestAnimationFrame(() => {
        setIsAnimatingIn(true);
      });
    } else {
      setIsAnimatingIn(false);
      unmountTimer = window.setTimeout(() => {
        setIsMounted(false);
      }, 200);
    }

    return () => {
      clearTimeout(unmountTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isMounted) return null;

  let sizeClass = 'sm:max-w-2xl'; // default md
  if (size === 'sm') sizeClass = 'sm:max-w-lg';
  if (size === 'md') sizeClass = 'sm:max-w-2xl';
  if (size === 'lg') sizeClass = 'sm:max-w-4xl';
  if (size === 'xl') sizeClass = 'sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl';

  const modalWidthClass = `w-full ${sizeClass} h-[100dvh] sm:h-auto sm:max-h-[90vh]`;

  const modalAnimation = isAnimatingIn
    ? 'opacity-100 translate-y-0 scale-100'
    : 'opacity-0 translate-y-4 scale-[0.99]';

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center sm:p-4 overflow-hidden"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-150 ease-out ${isAnimatingIn ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
        onClick={() => onClose()}
      />
      
      <div
        className={`relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-xl transform transition-all duration-150 ease-out flex flex-col overflow-hidden border border-white/20 dark:border-zinc-800/50 ${modalWidthClass} ${modalAnimation}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-600"></div>

        <div className="flex-shrink-0 flex justify-between items-center px-5 py-4 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md z-10">
          <div className="flex flex-col">
            <h2 id="modal-title" className="text-lg font-black text-slate-800 dark:text-white tracking-tight leading-tight truncate pr-4">{title}</h2>
          </div>
          <button
            onClick={() => onClose()}
            className="group p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all active:scale-95"
            aria-label="Close modal"
          >
            <XIcon className="h-4 w-4 transition-transform group-hover:rotate-90 duration-300" />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto custom-scrollbar ${size === 'xl' ? 'p-0' : 'px-4 py-4 sm:px-6 sm:py-5'}`}>
          {children}
        </div>
      </div>
    </div>
  );
};
