/**
 * VersionRefreshBanner — brief "refreshing now" indicator shown for the
 * split second between detecting a new deploy and the auto-refresh
 * kicking in.
 *
 * The useVersionCheck hook now AUTO-REFRESHES immediately when a new
 * healthy deploy is detected — no user action required. This banner is
 * just a visible indicator so the user knows what's happening if they
 * happen to be looking at the screen when the refresh fires.
 */
import React, { useState, useEffect } from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const VersionRefreshBanner: React.FC = () => {
  const { updateAvailable } = useVersionCheck();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (updateAvailable) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [updateAvailable]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100vw-2rem)] max-w-md transition-opacity duration-200"
    >
      <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-2xl shadow-2xl border border-emerald-500/30 overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <RefreshIcon className="w-5 h-5 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">Updating…</p>
            <p className="text-[11px] text-emerald-100 leading-tight mt-0.5">
              New version detected — refreshing automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionRefreshBanner;
