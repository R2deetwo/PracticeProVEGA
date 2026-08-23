/**
 * ModalShell — Standardized modal wrapper for ALL modals in PracticePro.
 *
 * This is the new source of truth for modal presentation. It mirrors the
 * existing `<Modal>` component's accessibility/keyboard behavior (focus trap,
 * ESC close, body scroll lock, brand accent bar) and adds:
 *   - `position: 'center' | 'right' | 'left'` for docked variants
 *   - `presentation: 'center' | 'fullscreen'` for full-screen overlays
 *   - Z_TIERS reference instead of hardcoded z-[3000]
 *
 * The legacy `<Modal>` component still exists for backward compat — new
 * modals should use `<ModalShell>` and add themselves to modalRegistry.tsx.
 *
 * Usage:
 *   <ModalShell isOpen={true} onClose={close} title="Edit Matter" size="lg">
 *     <MatterForm ... />
 *   </ModalShell>
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { XIcon } from '../../constants';
import { Z_TIERS } from '../constants';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type ModalPosition = 'center' | 'right' | 'left';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  hideHeader?: boolean;
  position?: ModalPosition;
  /** When true, the modal fills the viewport (no backdrop, no rounded card). Used for full-screen overlays like MatterIngestionWizard. */
  fullscreen?: boolean;
  /** Render without the gradient accent bar at the top. */
  hideAccentBar?: boolean;
  children: React.ReactNode;
  /** Optional element to render in the header's right side (next to the close button). */
  headerActions?: React.ReactNode;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'sm:max-w-lg',
  md: 'sm:max-w-2xl',
  lg: 'sm:max-w-4xl',
  xl: 'sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl',
  full: 'sm:max-w-[95vw]',
};

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  hideHeader = false,
  position = 'center',
  fullscreen = false,
  hideAccentBar = false,
  children,
  headerActions,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap (Tab/Shift+Tab cycles inside the modal, ESC closes)
  useFocusTrap(modalRef, isOpen && isMounted);

  // Lock body scroll when open (preserve scrollbar width to prevent layout shift)
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  // ESC key closes (also handled by useFocusTrap, but this covers the case
  // where the focus trap hasn't kicked in yet during the animation)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Mount/unmount with animation
  useEffect(() => {
    let unmountTimer: number;
    if (isOpen) {
      setIsMounted(true);
      requestAnimationFrame(() => setIsAnimatingIn(true));
    } else {
      setIsAnimatingIn(false);
      unmountTimer = window.setTimeout(() => setIsMounted(false), 200);
    }
    return () => window.clearTimeout(unmountTimer);
  }, [isOpen]);

  // ─── Keyboard-aware resizing (mobile) ────────────────────────────────
  // On Android/iOS WebView, the soft keyboard shrinks visualViewport.
  // We track its height and cap the modal's maxHeight so it stays visible
  // above the keyboard. This is the most reliable cross-device approach —
  // it works even when CSS dvh units don't update (a known Android bug).
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setKeyboardHeight(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const potentialKeyboard = window.innerHeight - vv.height;
      setKeyboardHeight(potentialKeyboard > 150 ? potentialKeyboard : 0);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [isOpen]);

  if (!isMounted) return null;

  // ─── Position classes ────────────────────────────────────────────────
  const wrapperClasses = fullscreen
    ? 'fixed inset-0'
    : position === 'center'
      ? 'fixed inset-0 flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto overscroll-contain'
      : position === 'right'
        ? 'fixed inset-0 flex items-stretch justify-end'
        : 'fixed inset-0 flex items-stretch justify-start';

  const cardClasses = fullscreen
    ? 'w-full h-full bg-white dark:bg-zinc-900 flex flex-col overflow-hidden'
    : position === 'center'
      ? `relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden border border-slate-200 dark:border-zinc-700 w-full ${SIZE_CLASSES[size]} h-full sm:h-auto sm:max-h-[90vh]`
      : `relative bg-white dark:bg-zinc-900 shadow-xl flex flex-col overflow-hidden h-full w-full max-w-md border-l border-slate-200 dark:border-zinc-700`;

  const enterAnim =
    position === 'center' && !fullscreen
      ? isAnimatingIn
        ? 'opacity-100 translate-y-0 scale-100'
        : 'opacity-0 translate-y-4 scale-[0.99]'
      : position === 'right'
        ? isAnimatingIn
          ? 'translate-x-0'
          : 'translate-x-full'
        : position === 'left'
          ? isAnimatingIn
            ? 'translate-x-0'
            : '-translate-x-full'
          : 'opacity-100';

  const transitionClass =
    position === 'center' && !fullscreen
      ? 'transition-all duration-150 ease-out'
      : 'transition-transform duration-200 ease-out';

  return (
    <div
      className={wrapperClasses}
      style={{ zIndex: Z_TIERS.modal }}
      aria-labelledby={title ? 'modal-title' : undefined}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop — hidden for fullscreen modals (they ARE the viewport) */}
      {!fullscreen && (
        <div
          className={`fixed inset-0 bg-slate-900/60 sm:backdrop-blur-sm transition-opacity duration-150 ease-out ${
            isAnimatingIn ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      <div
        ref={modalRef}
        tabIndex={-1}
        className={`${cardClasses} ${enterAnim} ${transitionClass}`}
        onClick={e => e.stopPropagation()}
        style={
          keyboardHeight > 0 && !fullscreen
            ? {
                maxHeight: `calc(100% - ${keyboardHeight}px)`,
                paddingBottom: `${Math.min(keyboardHeight, 40)}px`,
              }
            : undefined
        }
      >
        {/* Brand Accent Bar */}
        {!hideAccentBar && (
          <div className="h-1 sm:h-1.5 w-full bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-600 flex-shrink-0" />
        )}

        {!hideHeader && (
          <div className="flex-shrink-0 flex justify-between items-center px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 sm:backdrop-blur-md z-10">
            <div className="flex flex-col min-w-0">
              {title && (
                <h2
                  id="modal-title"
                  className="text-base sm:text-lg font-black text-slate-800 dark:text-zinc-100 tracking-tight leading-tight truncate pr-4"
                >
                  {title}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {headerActions}
              <button
                onClick={onClose}
                className="active-press touch-target group flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all flex-shrink-0"
                aria-label="Close modal"
              >
                <XIcon className="h-5 w-5 transition-transform group-hover:rotate-90 duration-300" />
              </button>
            </div>
          </div>
        )}

        <div
          className={`flex-1 overflow-y-auto custom-scrollbar overscroll-contain no-nav-pad ${
            size === 'xl' || fullscreen ? 'p-0' : 'px-3 py-3 sm:px-6 sm:py-5'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default ModalShell;
