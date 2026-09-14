import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { useUI } from '../../contexts/UIContext';
import type { Toast } from '../../types';

/**
 * useToastFeedback — typed facade over the app's centralized toast system
 * (UIContext.addToast + components/Toast.tsx: debounce, 3-toast cap,
 * haptics, hover-hold auto-dismiss).
 *
 * The toast SYSTEM is already unified — 54 files just hand-roll the call
 * shape. This hook gives every caller the same one-liner ergonomics so new
 * code never hand-rolls again:
 *
 *   const toast = useToastFeedback();
 *   toast.success('Invoice sent');
 *   toast.error('Payment failed', { duration: 6000 });
 *   toast.info('Syncing…', { link: { text: 'View', onClick: open } });
 */

export interface ToastFeedbackOptions {
  duration?: number;
  link?: Toast['link'];
}

export interface ToastFeedback {
  success: (message: ReactNode, options?: ToastFeedbackOptions) => void;
  error: (message: ReactNode, options?: ToastFeedbackOptions) => void;
  warning: (message: ReactNode, options?: ToastFeedbackOptions) => void;
  info: (message: ReactNode, options?: ToastFeedbackOptions) => void;
}

export function useToastFeedback(): ToastFeedback {
  const { addToast } = useUI();
  const success = useCallback(
    (message: ReactNode, options?: ToastFeedbackOptions) =>
      addToast(message, { type: 'success', ...options }),
    [addToast]
  );
  const error = useCallback(
    (message: ReactNode, options?: ToastFeedbackOptions) =>
      addToast(message, { type: 'error', ...options }),
    [addToast]
  );
  const warning = useCallback(
    (message: ReactNode, options?: ToastFeedbackOptions) =>
      addToast(message, { type: 'warning', ...options }),
    [addToast]
  );
  const info = useCallback(
    (message: ReactNode, options?: ToastFeedbackOptions) =>
      addToast(message, { type: 'info', ...options }),
    [addToast]
  );
  return { success, error, warning, info };
}
