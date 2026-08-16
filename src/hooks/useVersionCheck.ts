/**
 * useVersionCheck — version detection with dedup to prevent repeat toasts.
 *
 * HOW IT WORKS
 * ------------
 * 1. At build time, a `buildTimestamp` (Unix ms) is written to version.json
 *    AND baked into the JS bundle via `VITE_BUILD_TIMESTAMP`.
 * 2. At runtime, this hook fetches `/version.json` (with cache-busting) and
 *    compares the remote `buildTimestamp` against the baked-in local one.
 * 3. If they differ → a new deploy has shipped → show the refresh prompt.
 *
 * DEDUP LOGIC (prevents toast from appearing twice for the same version):
 * - When a new remote version is detected, its timestamp is stored in
 *   sessionStorage as `practicepro_last_notified_version`.
 * - On every subsequent check, if the remote timestamp matches the stored
 *   value, the toast is NOT shown again.
 * - The stored value is only cleared when the local and remote timestamps
 *   MATCH (meaning the user has successfully loaded the new version).
 * - This survives page reloads (sessionStorage is per-tab, persists across
 *   navigation within the same tab).
 *
 * TRIGGERS
 * --------
 * - Every 60 seconds while the page is visible
 * - 10 seconds after mount (delayed to reduce false positives after refresh)
 */
import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds (was 30 — less aggressive)
const INITIAL_DELAY_MS = 10_000; // 10 seconds (was 5 — more settling time)
const STORAGE_KEY = 'practicepro_last_notified_version';

export interface VersionCheckState {
  updateAvailable: boolean;
  remoteTimestamp?: number;
  localTimestamp?: number;
  refresh: () => void;
  dismiss: () => void;
}

const LOCAL_BUILD_TIMESTAMP = (import.meta as any).env?.VITE_BUILD_TIMESTAMP
  ? Number((import.meta as any).env.VITE_BUILD_TIMESTAMP)
  : 0;

export function useVersionCheck(): VersionCheckState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteTimestamp, setRemoteTimestamp] = useState<number | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const localTimestampRef = useRef<number>(LOCAL_BUILD_TIMESTAMP);

  useEffect(() => {
    let cancelled = false;

    const getNotifiedVersion = (): number | null => {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        return stored ? Number(stored) : null;
      } catch {
        return null;
      }
    };

    const setNotifiedVersion = (ts: number) => {
      try { sessionStorage.setItem(STORAGE_KEY, String(ts)); } catch {}
    };

    const clearNotifiedVersion = () => {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    };

    const check = async () => {
      try {
        const url = `/version.json?_t=${Date.now()}&_r=${Math.random().toString(36).slice(2)}`;
        const res = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data) return;

        const remoteBuild = Number(data.buildTimestamp) || 0;
        const localBuild = localTimestampRef.current;

        if (localBuild > 0 && remoteBuild > 0 && localBuild !== remoteBuild) {
          // Version mismatch — but have we already notified about THIS remote version?
          const alreadyNotified = getNotifiedVersion();
          if (alreadyNotified === remoteBuild) {
            // Already notified for this exact version — do NOT show toast again.
            // This is the key dedup: even after refresh(), the new page checks
            // sessionStorage and finds the same remoteBuild, so it skips.
            return;
          }

          // New version (or different from what we notified before) — show toast.
          // Store IMMEDIATELY (not in refresh()) so it survives even if the
          // user clicks Refresh Now before the next state update cycle.
          setNotifiedVersion(remoteBuild);
          setRemoteTimestamp(remoteBuild);
          setUpdateAvailable(true);
          setDismissed(false);
          return;
        }

        // Versions match — the user is on the latest version.
        // Clear the notified flag so the NEXT deploy will trigger a toast.
        if (getNotifiedVersion() !== null) {
          clearNotifiedVersion();
        }
        setUpdateAvailable(false);
      } catch {
        // Silent — network errors are expected, don't spam console
      }
    };

    const initialTimer = setTimeout(check, INITIAL_DELAY_MS);
    const interval = setInterval(check, POLL_INTERVAL_MS);

    // On focus/online/visibility: only check if we haven't already notified.
    // If we have notified, the 60s interval will handle re-checking.
    const alreadyNotified = () => getNotifiedVersion() !== null;
    const onFocus = () => { if (!alreadyNotified()) check(); };
    const onOnline = () => { if (!alreadyNotified()) check(); };
    const onVisibility = () => { if (!document.hidden && !alreadyNotified()) check(); };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const refresh = () => {
    // The remote timestamp was already stored in sessionStorage at detection
    // time (in the check() function above). We don't need to store it again
    // here. This was the bug: previously, refresh() tried to read
    // remoteTimestamp from React state, which could be undefined if the
    // state hadn't propagated yet. Now it's always in sessionStorage.

    // Clear all caches so the new JS bundle is fetched fresh.
    try { if ('caches' in window) caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {}); } catch {}

    // Clear localStorage (except auth/session keys) so stale data doesn't
    // interfere with the new version.
    const PRESERVE_PATTERNS = [
      /^practicepro_cached_user$/,
      /^practicepro_user_session$/,
      /^practicepro_portal_session$/,
      /^practicepro_portal_type$/,
      /^practicepro_original_session$/,
      /^practicepro_impersonation_role$/,
      /^practicepro_session_locked$/,
      /^practicepro_theme$/,
      /^practicepro_fontSize$/,
      /^practicepro_cookie_consent$/,
      /^practicepro_ai_consent$/,
      /^practicepro_content_protection$/,
      /^practicepro_tour_completed$/,
      /^practicepro_dismissed_tips$/,
      /^practicepro_last_seen_version$/,
      /^practicepro_push_registered_this_session$/,
      /^practicepro_last_notified_version$/, // Preserve in localStorage too (belt-and-suspenders)
      /^draft_/,
      /^local_cached_files$/,
    ];
    const shouldPreserve = (key: string) => PRESERVE_PATTERNS.some(p => p.test(key));

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !shouldPreserve(key)) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}

    // Reload with cache-busting parameter
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', String(Date.now()));
    setTimeout(() => window.location.replace(url.toString()), 150);
  };

  const dismiss = () => setDismissed(true);

  return {
    updateAvailable: updateAvailable && !dismissed,
    remoteTimestamp,
    localTimestamp: localTimestampRef.current,
    refresh,
    dismiss,
  };
}
