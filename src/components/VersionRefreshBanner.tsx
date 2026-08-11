/**
 * VersionRefreshBanner — BULLETPROOF, impossible-to-miss update prompt.
 *
 * Renders as a FULL-WIDTH banner at the TOP of the screen when a new deploy
 * is detected. Cannot be hidden by z-index issues or overlapping elements.
 *
 * The banner will re-appear after the next poll interval (30s) if the
 * user dismisses it, because the running bundle is still stale.
 *
 * IMPORTANT: This is a MANUAL prompt — the user chooses when to refresh.
 */
import React, { useState, useEffect } from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const VersionRefreshBanner: React.FC = () => {
  const { updateAvailable, refresh, dismiss } = useVersionCheck();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (updateAvailable) {
      setExiting(false);
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
    } else if (visible) {
      setExiting(true);
      const t = setTimeout(() => { setVisible(false); setExiting(false); }, 350);
      return () => clearTimeout(t);
    }
  }, [updateAvailable]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => { setVisible(false); setExiting(false); dismiss(); }, 350);
  };

  const handleRefresh = () => {
    setExiting(true);
    setTimeout(() => refresh(), 200);
  };

  if (!visible && !exiting) return null;

  // FULL-WIDTH banner at the TOP — z-[10000] ensures it's above everything
  const animationClass = exiting
    ? '-translate-y-full opacity-0'
    : visible
      ? 'translate-y-0 opacity-100'
      : '-translate-y-full opacity-0';

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`fixed top-0 left-0 right-0 z-[10000] transition-all duration-300 ease-out ${animationClass}`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-2xl border-b-2 border-emerald-400/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <RefreshIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">A new version is available!</p>
            <p className="text-xs text-emerald-100 leading-tight mt-0.5">
              Refresh to get the latest updates and features.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex-shrink-0 bg-white text-emerald-700 font-bold text-sm px-4 py-2 rounded-lg hover:bg-emerald-50 active:bg-emerald-100 transition-colors shadow-md"
          >
            Refresh Now
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="flex-shrink-0 text-emerald-100 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Not now"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VersionRefreshBanner;
