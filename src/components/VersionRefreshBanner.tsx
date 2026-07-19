/**
 * VersionRefreshBanner — non-intrusive banner shown at the bottom of the
 * screen when useVersionCheck detects that a new deploy has shipped.
 *
 * Animation lifecycle:
 *   Entrance:  slides UP from below the viewport (pop-up)
 *   Dismissal: slides DOWN out of the viewport (pop-down)
 *
 * The banner will re-appear after the next poll interval (60s) if the
 * user dismisses it, because the running bundle is still stale.
 *
 * IMPORTANT: This is a MANUAL prompt — the user chooses when to refresh.
 * An earlier version auto-refreshed immediately, which caused data loss
 * when users were in the middle of editing (the browser's "leave/stay"
 * dialog would fire, and unsaved work would disappear). The user
 * explicitly asked for this floater back so they control the timing.
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
  // Track whether the banner is actively visible (for exit animation).
  // When updateAvailable becomes true → show with entrance animation.
  // When user dismisses (or updateAvailable goes false) → play exit
  // animation, then unmount after the transition completes.
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (updateAvailable) {
      setExiting(false);
      // Defer the visibility flip by one frame so the entrance transition
      // (from translate-y-full/opacity-0 → translate-y-0/opacity-100) plays.
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
    } else if (visible) {
      // Update no longer available (e.g. after refresh) — animate out.
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
    // Give the exit animation a moment, then trigger the hard refresh.
    setTimeout(() => refresh(), 200);
  };

  if (!visible && !exiting) return null;

  // Animation classes:
  //   Entrance (visible=true, exiting=false):  slide UP into view
  //   Exit     (exiting=true):                 slide DOWN out of view
  const animationClass = exiting
    ? 'translate-y-[120%] opacity-0'
    : visible
      ? 'translate-y-0 opacity-100'
      : 'translate-y-[120%] opacity-0';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100vw-2rem)] max-w-md transition-all duration-300 ease-out ${animationClass}`}
    >
      <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-2xl shadow-2xl border border-emerald-500/30 overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <RefreshIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">A new version is available.</p>
            <p className="text-2xs text-emerald-100 leading-tight mt-0.5">
              Refresh to get the latest updates.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex-shrink-0 bg-white text-emerald-700 font-bold text-xs px-3 py-2 rounded-lg hover:bg-emerald-50 active:bg-emerald-100 transition-colors shadow-md"
          >
            Refresh
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
