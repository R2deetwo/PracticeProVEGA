/**
 * VersionRefreshBanner — non-intrusive banner shown at the bottom of the
 * screen when useVersionCheck detects that a new deploy has shipped.
 *
 * The banner is intentionally small and stays out of the way: it slides
 * up from the bottom, offers a single "Refresh now" button, and a tiny
 * dismiss link for users who want to finish what they're doing first.
 *
 * The banner will re-appear after the next poll interval (5 min) if the
 * user dismisses it, because the running bundle is still stale.
 */
import React from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const VersionRefreshBanner: React.FC = () => {
  const { updateAvailable, remoteSha, localSha, refresh, dismiss } = useVersionCheck();

  if (!updateAvailable) return null;

  const shortRemote = remoteSha ? remoteSha.slice(0, 7) : 'unknown';
  const shortLocal = localSha && localSha !== 'unknown' ? localSha.slice(0, 7) : 'unknown';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100vw-2rem)] max-w-md animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-2xl shadow-2xl border border-emerald-500/30 overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <RefreshIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">A new version is available</p>
            <p className="text-[11px] text-emerald-100 leading-tight mt-0.5 truncate">
              Refresh to get the latest updates ({shortLocal} → {shortRemote})
            </p>
          </div>
          <button
            onClick={refresh}
            className="flex-shrink-0 bg-white text-emerald-700 font-bold text-xs px-3 py-2 rounded-lg hover:bg-emerald-50 active:bg-emerald-100 transition-colors shadow-md"
          >
            Refresh
          </button>
          <button
            onClick={dismiss}
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
