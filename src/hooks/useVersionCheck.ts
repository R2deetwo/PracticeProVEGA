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

    // ─── LOCAL STORAGE IS NO LONGER WIPED (2026-09-14) ─────────────────
    // The old refresh() deleted every localStorage key except an
    // allow-list. That allow-list whack-a-mole caused recurring,
    // user-visible data loss on EVERY deploy ("refresh to update"):
    //   • practicepro_checklist_dismissed_<firmId> was wiped → the
    //     Getting Started checklist re-armed → the "🎉 You're all set!"
    //     celebration toast fired on every single update (GATE 2's ref
    //     starts false on each mount, so an all-done checklist always
    //     looked like a fresh transition).
    //   • practicepro_custom_gemini_key was wiped → users had to re-enter
    //     their Gemini API key after every deploy ("the AI resets and
    //     asks for consent like it's the first time").
    //   • practicepro:aloa:session:* was wiped → ALOA conversations
    //     restarted from scratch.
    // None of that deletion ever helped serve the new bundle — the
    // Cache API clear + cache-busting URL param below do that. User
    // preferences, dismissals, keys and sessions now ALL survive update
    // refreshes. Anything genuinely version-sensitive belongs on the
    // server (Convex), not in a wipe list here.

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
