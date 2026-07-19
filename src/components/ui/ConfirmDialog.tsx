import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/**
 * ConfirmDialog — reusable in-app confirmation modal.
 *
 * Replaces window.confirm() throughout the app. Why we don't use
 * window.confirm():
 *   1. It's a browser-native dialog that looks out of place in a polished
 *      product UI.
 *   2. It blocks the main thread — the page freezes until the user
 *      responds, which feels janky on slow devices.
 *   3. It can't be styled to match the app's dark/light theme.
 *   4. It can't be dismissed by clicking outside (poor UX).
 *   5. On mobile, it sometimes renders behind the keyboard or other UI.
 *
 * Usage pattern (with the useConfirm hook):
 *
 *   const { confirm, ConfirmDialog } = useConfirm();
 *
 *   const handleDelete = async () => {
 *     const ok = await confirm({
 *       title: 'Delete message?',
 *       message: 'This action cannot be undone.',
 *       confirmLabel: 'Delete',
 *       cancelLabel: 'Cancel',
 *       danger: true,
 *     });
 *     if (!ok) return;
 *     // proceed with delete...
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleDelete}>Delete</button>
 *       {ConfirmDialog}
 *     </>
 *   );
 *
 * The hook returns:
 *   - confirm(opts): Promise<boolean> — resolves true if user confirmed, false otherwise
 *   - ConfirmDialog: React.ReactNode — render this in your component tree
 */

export interface ConfirmOptions {
  /** Title shown at the top of the dialog. Defaults to 'Please confirm'. */
  title?: string;
  /** Body message explaining what will happen. Defaults to 'Are you sure?'. */
  message?: string;
  /** Label for the confirm button. Defaults to 'Confirm'. */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to 'Cancel'. */
  cancelLabel?: string;
  /** If true, the confirm button is red (destructive action). Defaults to false. */
  danger?: boolean;
  /** Optional extra context to show in a muted box (e.g. the name of the item being deleted). */
  context?: string;
}

interface ConfirmDialogState extends ConfirmOptions {
  open: boolean;
  resolve?: (ok: boolean) => void;
}

const DEFAULT_STATE: ConfirmDialogState = {
  open: false,
};

/**
 * Hook that returns a confirm function and the dialog element to render.
 *
 * The dialog is themed to match the app's light/dark mode via Tailwind
 * dark: variants. It animates in with a fade + scale effect.
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmDialogState>(DEFAULT_STATE);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { light, success: hapticSuccess, error: hapticError } = useHapticFeedback();

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    if (state.open && state.resolve) {
      state.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      setState({
        ...opts,
        open: true,
        resolve,
      });
    });
  }, [state.open, state.resolve]);

  const handleClose = useCallback((ok: boolean) => {
    // Haptic feedback: light on cancel, success pattern on confirm, error on danger-cancel
    if (ok) {
      hapticSuccess();
    } else {
      light();
    }
    setState((prev) => {
      if (prev.resolve) prev.resolve(ok);
      return DEFAULT_STATE;
    });
  }, [light, hapticSuccess]);

  // Cleanup any pending timer on unmount
  useEffect(() => {
    return () => {
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    };
  }, []);

  const ConfirmDialog = (
    <ConfirmDialogComponent
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      danger={state.danger}
      context={state.context}
      onConfirm={() => handleClose(true)}
      onCancel={() => handleClose(false)}
    />
  );

  return { confirm, ConfirmDialog };
}

/**
 * Stateless ConfirmDialog component. Can be used directly if you prefer
 * to manage state yourself (e.g. for delete-confirmation patterns where
 * you already have a `deleteTarget` state).
 */
export const ConfirmDialogComponent: React.FC<{
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  context?: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel, cancelLabel, danger, context, onConfirm, onCancel }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  // P0 a11y: Trap focus inside the dialog so keyboard users can't Tab out
  useFocusTrap(dialogRef, open);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-[zoom-in_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 flex items-start gap-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            danger
              ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="confirm-dialog-title" className="text-base font-bold text-slate-900 dark:text-white">
              {title || 'Please confirm'}
            </h2>
            {message && (
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                {message}
              </p>
            )}
            {context && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <p className="text-xs font-mono text-slate-700 dark:text-zinc-300 break-words">
                  {context}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="px-5 sm:px-6 py-4 bg-slate-50 dark:bg-zinc-950/50 border-t border-slate-200 dark:border-zinc-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors active:scale-[0.98]"
          >
            {cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors active:scale-[0.98] ${
              danger
                ? 'bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20'
            }`}
          >
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialogComponent;
