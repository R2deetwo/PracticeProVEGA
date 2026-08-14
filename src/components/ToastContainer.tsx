/**
 * ToastContainer — renders all active toasts in a fixed viewport.
 *
 * STACKING RULES:
 * - Max 3 toasts visible simultaneously (enforced in UIContext.addToast)
 * - New toasts appear at the bottom (flex-col-reverse) so older ones
 *   are pushed up — newest is always closest to the user's thumb on mobile
 * - Smooth Y-axis translation on enter/exit (handled in Toast.tsx)
 *
 * MOBILE OPTIMIZATION:
 * - Toasts lock to the bottom safe-area inset
 * - Width: calc(100% - 32px) with 16px margins on mobile
 * - max-w-sm on desktop (384px)
 * - Does NOT overlap the mobile bottom tab bar (padding-bottom accounts for it)
 * - Does NOT overlap the messaging text-input field (toasts are above the dock)
 *
 * Z-INDEX:
 * - Standard toasts: z-[9999]
 * - Refresh toast (ToastRefreshNotification): z-[9998] (below standard toasts)
 * - Critical modals/dialogs: z-[10000]+ (above all toasts)
 */
import React from 'react';
import { useUI } from '../contexts/UIContext';
import Toast from './Toast';

const ToastContainer: React.FC = () => {
    const { toasts, removeToast } = useUI();

    return (
        <div
            aria-live="assertive"
            className="fixed inset-x-0 bottom-0 flex flex-col-reverse items-center justify-end px-4 pointer-events-none sm:items-end sm:px-6 z-[9999] gap-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] sm:pb-6"
        >
            {/* Render in reverse order so newest is at the bottom.
                flex-col-reverse handles the visual stacking. */}
            {toasts.slice().reverse().map((toast) => (
                <div key={toast.id} className="w-full sm:max-w-sm pointer-events-auto">
                    <Toast toast={toast} onRemove={removeToast} />
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
