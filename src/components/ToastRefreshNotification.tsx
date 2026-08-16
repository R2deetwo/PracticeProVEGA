/**
 * ToastRefreshNotification — Persistent, non-intrusive update prompt.
 *
 * Replaces the intrusive full-width VersionRefreshBanner with a clean
 * glassmorphic toast in the bottom-right corner.
 *
 * KEY BEHAVIORS:
 * - Persistent: does NOT auto-dismiss. Stays on screen until the user
 *   clicks [Refresh Now] or [X].
 * - Stacking: renders in the same toast viewport as standard toasts but
 *   with a slightly lower z-index, so newer system toasts (success,
 *   warnings) appear ABOVE it.
 * - Non-polluting: never enters the Notification Center or messaging
 *   inbox. This is a strictly transient system-level UI element.
 * - State preservation: clicking [Refresh Now] calls the version check
 *   refresh() which clears caches (but preserves auth/session) and
 *   reloads the page with a cache-busting _refresh param.
 *
 * Z-INDEX HIERARCHY:
 * - Standard toasts: z-[9999] (ToastContainer)
 * - This refresh toast: z-[9998] (just below standard toasts)
 * - Critical modals/dialogs: z-[10000]+ (above all toasts)
 */
import React, { useState, useEffect } from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const ToastRefreshNotification: React.FC = () => {
  const { updateAvailable, refresh, dismiss } = useVersionCheck();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  // Track if the user has explicitly dismissed this update session.
  // The toast won't reappear for the same update unless the user refreshes.
  const [dismissedForSession, setDismissedForSession] = useState(false);

  useEffect(() => {
    if (updateAvailable && !dismissedForSession) {
      setExiting(false);
      // Small delay for smooth fade-in
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
    } else if (visible) {
      setExiting(true);
      const t = setTimeout(() => { setVisible(false); setExiting(false); }, 300);
      return () => clearTimeout(t);
    }
  }, [updateAvailable, dismissedForSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    setExiting(true);
    setDismissedForSession(true);
    setTimeout(() => { setVisible(false); setExiting(false); dismiss(); }, 300);
  };

  const handleRefresh = () => {
    setExiting(true);
    // Call refresh after a short delay for smooth exit animation
    setTimeout(() => refresh(), 200);
  };

  if (!visible && !exiting) return null;

  // Glassmorphic toast — bottom-right corner
  // z-[9998] = just below standard toasts (z-[9999]) so they stack above
  const animationClass = exiting
    ? 'translate-y-4 opacity-0'
    : visible
      ? 'translate-y-0 opacity-100'
      : 'translate-y-4 opacity-0';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 right-0 z-[9998] transition-all duration-300 ease-out pointer-events-none px-4 sm:px-6 pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] sm:pb-6"
      style={{ }}
    >
      <div className="relative w-full max-w-sm pointer-events-auto">
        {/* Glassmorphic background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 to-slate-800/95 dark:from-slate-900/98 dark:to-zinc-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-primary-500/30" />

        {/* Content — NO top-right [X] close icon (per directive).
            The [Dismiss] button at the bottom handles cancellation.
            The pulsing green indicator dot is retained on the outer edge. */}
        <div className="relative p-4">
          {/* Icon + Title */}
          <div className="flex items-start gap-3 mb-4">
            {/* Large rounded-square icon container — matches standard toast style */}
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <RefreshIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">
                Update Available
              </p>
              <p className="text-xs text-slate-300 leading-tight mt-0.5">
                A new version of PracticePro is ready. Refresh to get the latest features and fixes.
              </p>
            </div>
          </div>

          {/* Action buttons — aligned cleanly at the bottom */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs rounded-lg transition-colors shadow-md flex items-center justify-center gap-1.5"
            >
              <RefreshIcon className="w-3.5 h-3.5" />
              Refresh Now
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs rounded-lg transition-colors border border-white/10"
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* Pulsing brand-color indicator dot — retained for the "Update Available" variant.
            Standard toasts do NOT have this dot. Uses primary-500 (brand green) not emerald/teal. */}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full">
          <div className="absolute inset-0 bg-primary-500 rounded-full animate-ping opacity-75" />
        </div>
      </div>
    </div>
  );
};

export default ToastRefreshNotification;
