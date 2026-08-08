
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { XIcon } from '../../constants';

interface ModalProps {
 isOpen: boolean;
 onClose: () => void;
 title: string;
 children: React.ReactNode;
 size?: 'sm' | 'md' | 'lg' | 'xl';
 hideHeader?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', hideHeader = false }) => {
 const [isMounted, setIsMounted] = useState(false);
 const [isAnimatingIn, setIsAnimatingIn] = useState(false);
 const modalRef = useRef<HTMLDivElement>(null);
 const previousFocusRef = useRef<HTMLElement | null>(null);

 // Lock body scroll when modal is open
 useEffect(() => {
  if (isOpen) {
   // Save the currently focused element so we can restore it later
   previousFocusRef.current = document.activeElement as HTMLElement;
   // Prevent background scrolling
   const originalOverflow = document.body.style.overflow;
   const originalPaddingRight = document.body.style.paddingRight;
   const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
   document.body.style.overflow = 'hidden';
   // Compensate for scrollbar disappearing to prevent layout shift
   if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
   }
   return () => {
    document.body.style.overflow = originalOverflow;
    document.body.style.paddingRight = originalPaddingRight;
    // Restore focus to the element that had it before the modal opened
    if (previousFocusRef.current && previousFocusRef.current.focus) {
     try { previousFocusRef.current.focus(); } catch { /* element may have been unmounted */ }
    }
   };
  }
 }, [isOpen]);

 // Auto-focus the first focusable element inside the modal
 useEffect(() => {
  if (isOpen && isMounted && modalRef.current) {
   // Small delay to let animation start and content render
   const timer = setTimeout(() => {
    if (!modalRef.current) return;
    // Look for the first input, select, textarea, or button that isn't the close button
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
     'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) {
     focusable[0].focus();
    }
   }, 100);
   return () => clearTimeout(timer);
  }
 }, [isOpen, isMounted]);

 // Focus trap: keep Tab navigation inside the modal
 const handleKeyDown = useCallback((event: KeyboardEvent) => {
  if (event.key === 'Escape') {
   onClose();
   return;
  }

  if (event.key === 'Tab' && modalRef.current) {
   const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
   );
   if (focusableElements.length === 0) return;

   const firstFocusable = focusableElements[0];
   const lastFocusable = focusableElements[focusableElements.length - 1];

   if (event.shiftKey) {
    // Shift+Tab: if focus is on first element, wrap to last
    if (document.activeElement === firstFocusable) {
     event.preventDefault();
     lastFocusable.focus();
    }
   } else {
    // Tab: if focus is on last element, wrap to first
    if (document.activeElement === lastFocusable) {
     event.preventDefault();
     firstFocusable.focus();
    }
   }
  }
 }, [onClose]);

 useEffect(() => {
  if (isOpen) {
   window.addEventListener('keydown', handleKeyDown);
  }
  return () => {
   window.removeEventListener('keydown', handleKeyDown);
  };
 }, [isOpen, handleKeyDown]);

 // Mount/unmount with animation
 useEffect(() => {
  let unmountTimer: number;

  if (isOpen) {
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

 // ─── Keyboard-aware resizing (APK / mobile web) ───────────────────────
 // When the soft keyboard opens on Android/iOS, the visualViewport
 // shrinks. We track its height and apply it as a max-height to the
 // modal panel so the modal never gets clipped behind the keyboard.
 // This is the most reliable cross-device approach — it works even when
 // CSS dvh units don't update (a known Android WebView bug).
 const [keyboardHeight, setKeyboardHeight] = useState(0);

 useEffect(() => {
  if (!isOpen) {
   setKeyboardHeight(0);
   return;
  }

  const vv = window.visualViewport;
  if (!vv) return;

  const updateKeyboardHeight = () => {
   // The keyboard height = layout viewport - visual viewport height
   // (but only if the visual viewport is significantly smaller, indicating
   // the keyboard is actually open, not just a URL bar resize)
   const layoutHeight = window.innerHeight;
   const visualHeight = vv.height;
   const potentialKeyboard = layoutHeight - visualHeight;
   // Only count as keyboard if >150px (avoids false positives from URL bar)
   setKeyboardHeight(potentialKeyboard > 150 ? potentialKeyboard : 0);
  };

  updateKeyboardHeight();
  vv.addEventListener('resize', updateKeyboardHeight);
  vv.addEventListener('scroll', updateKeyboardHeight);

  return () => {
   vv.removeEventListener('resize', updateKeyboardHeight);
   vv.removeEventListener('scroll', updateKeyboardHeight);
  };
 }, [isOpen]);

 if (!isMounted) return null;

 let sizeClass = 'sm:max-w-2xl'; // default md
 if (size === 'sm') sizeClass = 'sm:max-w-lg';
 if (size === 'md') sizeClass = 'sm:max-w-2xl';
 if (size === 'lg') sizeClass = 'sm:max-w-4xl';
 if (size === 'xl') sizeClass = 'sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl';

 const modalWidthClass = `w-full ${sizeClass} h-full sm:h-auto sm:max-h-[90vh]`;

 const modalAnimation = isAnimatingIn
  ? 'opacity-100 translate-y-0 scale-100'
  : 'opacity-0 translate-y-4 scale-[0.99]';

 return (
  <div
   className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto overscroll-contain"
   aria-labelledby="modal-title"
   role="dialog"
   aria-modal="true"
  >
   <div
    className={`fixed inset-0 bg-slate-900/60 sm:backdrop-blur-sm transition-opacity duration-150 ease-out ${isAnimatingIn ? 'opacity-100' : 'opacity-0'}`}
    aria-hidden="true"
    onClick={() => onClose()}
   />
   
   <div
    ref={modalRef}
    className={`relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-xl transform transition-all duration-150 ease-out flex flex-col overflow-hidden border border-slate-200 dark:border-zinc-700 ${modalWidthClass} ${modalAnimation}`}
    onClick={(e) => e.stopPropagation()}
    style={keyboardHeight > 0 ? {
     // When keyboard is open on mobile, cap the modal height so it stays
     // visible above the keyboard. paddingBottom ensures the bottom of
     // the modal (where inputs typically are) isn't hidden behind the
     // keyboard.
     maxHeight: `calc(100% - ${keyboardHeight}px)`,
     paddingBottom: `${Math.min(keyboardHeight, 40)}px`,
    } : undefined}
   >
    {/* Brand Accent Bar */}
    <div className="h-1 sm:h-1.5 w-full bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-600"></div>

    {!hideHeader && (
    <div className="flex-shrink-0 flex justify-between items-center px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 sm:backdrop-blur-md z-10">
     <div className="flex flex-col min-w-0">
      <h2 id="modal-title" className="text-base sm:text-lg font-black text-slate-800 dark:text-zinc-100 tracking-tight leading-tight truncate pr-4">{title}</h2>
     </div>
     <button
      onClick={() => onClose()}
      className="active-press touch-target group flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all flex-shrink-0"
      aria-label="Close modal"
     >
      <XIcon className="h-5 w-5 transition-transform group-hover:rotate-90 duration-300" />
     </button>
    </div>
    )}

    <div className={`flex-1 overflow-y-auto custom-scrollbar overscroll-contain no-nav-pad ${size === 'xl' ? 'p-0' : 'px-3 py-3 sm:px-6 sm:py-5'}`}>
     {children}
    </div>
   </div>
  </div>
 );
};
