import React, { useEffect, useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);

  useEffect(() => {
    let animateTimer: number;
    let unmountTimer: number;

    if (isOpen) {
      setIsMounted(true);
      animateTimer = window.setTimeout(() => {
        setIsAnimatingIn(true);
      }, 20); // Short delay to allow mounting before animating
    } else {
      setIsAnimatingIn(false);
      unmountTimer = window.setTimeout(() => {
        setIsMounted(false);
      }, 300); // Must match CSS transition duration for fade-out
    }

    return () => {
      clearTimeout(animateTimer);
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
  
  const isAuthModal = title === 'Sign In' || title === 'Create Account';
  const modalWidthClass = isAuthModal ? 'max-w-md' : 'max-w-lg sm:max-w-2xl';
  
  const modalAnimation = isAnimatingIn
    ? 'opacity-100 translate-y-0 scale-100'
    : 'opacity-0 -translate-y-4 scale-95';

  return (
    <div 
      className={`fixed inset-0 z-[110] flex items-center justify-center p-4`}
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className={`fixed inset-0 bg-black transition-opacity duration-300 ${isAnimatingIn ? 'bg-opacity-75' : 'bg-opacity-0'}`} aria-hidden="true" />
      <div
        className={`relative bg-white dark:bg-zinc-800 rounded-lg shadow-xl transform transition-all duration-300 ease-out m-0 w-full flex flex-col max-h-[90vh] ${modalWidthClass} ${modalAnimation}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 id="modal-title" className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
            aria-label="Close modal"
          >
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
