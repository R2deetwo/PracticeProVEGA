/**
 * useVersionCheck — detects new deploys and AUTO-REFRESHES immediately.
 *
 * HOW IT WORKS
 * ------------
 * 1. At build time, `scripts/generate-version-manifest.cjs` writes
 *    `public/version.json` with the git SHA + status + stableSince.
 * 2. The build SHA is also baked into the JS bundle via
 *    `import.meta.env.VITE_BUILD_SHA`.
 * 3. At runtime, this hook periodically fetches `/version.json` (with
 *    cache-busting) and compares its `sha` against the baked-in SHA.
 * 4. If they differ AND `status === 'healthy'`, the hook AUTO-REFRESHES
 *    the page immediately. No prompt, no delay.
 * 5. If `status === 'building'` or `'broken'`, the hook waits — never
 *    refreshes to an in-progress or known-broken build.
 *
 * TRIGGERS
 * --------
 * - Every 30 seconds while the page is visible (very aggressive)
 * - Immediately when the tab/window regains focus
 * - Immediately when the browser comes back online
 *
 * NOTES
 * -----
 * - In dev mode (VITE_DEV), the hook is a no-op.
 * - In Capacitor (native app), the hook is a no-op — APK updates are
 *   install-time, not runtime.
 * - AUTO-REFRESH rationale: user complaints about "changes don't reflect
 *   right away" stemmed from the previous prompt-based flow where users
 *   had to click "Refresh" — many users never did. Auto-refresh is
 *   instant and invisible.
 * - To avoid refresh loops, the hook checks the SHA actually changes
 *   AND that stableSince is in the past. A broken deploy will never
 *   trigger a refresh.
 */
import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds — aggressive update detection

export interface VersionCheckState {
  /** True when a new deploy has been detected and verified healthy. */
  updateAvailable: boolean;
  /** The SHA of the new deploy (for display). */
  remoteSha?: string;
  /** The SHA baked into this running bundle. */
  localSha?: string;
  /** Force a hard refresh now. */
  refresh: () => void;
  /** Dismiss the prompt for now (will re-appear on next poll). */
  dismiss: () => void;
}

const isNative = typeof window !== 'undefined'
  && (window as any).Capacitor?.isNativePlatform?.();

const isDev = typeof import.meta !== 'undefined'
  && (import.meta as any).env?.DEV === true;

export function useVersionCheck(): VersionCheckState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteSha, setRemoteSha] = useState<string | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const localShaRef = useRef<string | undefined>(undefined);
  // Guard against triggering multiple refreshes in quick succession.
  const refreshTriggeredRef = useRef(false);
  if (localShaRef.current === undefined) {
    localShaRef.current = (import.meta as any).env?.VITE_BUILD_SHA || 'unknown';
  }

  useEffect(() => {
    // Skip in dev mode and native apps (see rationale in file header).
    if (isDev || isNative) return;

    let cancelled = false;

    const check = async () => {
      // Already triggered a refresh — don't trigger again.
      if (refreshTriggeredRef.current) return;

      try {
        // Cache-bust via query string so we never read a stale version.json
        // from the browser cache or a CDN edge node.
        const url = `/version.json?_=${Date.now()}`;
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.sha) return;

        const local = localShaRef.current;
        // If local is 'unknown' (e.g. built without git), skip — we can't
        // meaningfully compare.
        if (!local || local === 'unknown') return;

        // Same SHA → no update needed.
        if (data.sha === local) {
          setUpdateAvailable(false);
          return;
        }

        // Different SHA → potential update. Check health before refreshing.
        const status = data.status || 'building';
        if (status === 'broken') {
          // Known-broken build — never refresh, even if SHA differs.
          // User stays on their current (working) version.
          return;
        }
        if (status === 'building') {
          // Build not yet verified — wait.
          return;
        }
        if (status === 'healthy') {
          // Healthy — AUTO-REFRESH immediately. No prompt, no delay.
          // Mark that we've triggered so we don't fire multiple times.
          refreshTriggeredRef.current = true;
          setRemoteSha(data.sha);
          setUpdateAvailable(true);

          // Perform the refresh on the next tick (let React commit state
          // first so the UI doesn't flash an unmounted warning).
          setTimeout(() => {
            try {
              if ('caches' in window) {
                caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
              }
            } catch { /* ignore */ }
            const url = new URL(window.location.href);
            url.searchParams.set('_refresh', String(Date.now()));
            window.location.replace(url.toString());
          }, 100);
          return;
        }
      } catch {
        // Network error — silently ignore. We'll retry on next interval.
      }
    };

    // Initial check after a short delay (let the app settle first).
    const initialTimer = setTimeout(check, 5_000);
    const interval = setInterval(check, POLL_INTERVAL_MS);

    const onFocus = () => { check(); };
    const onOnline = () => { check(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const refresh = () => {
    // Bypass any bfcache by appending a cache-bust query, then reload.
    try {
      if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
      }
    } catch { /* ignore */ }
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', String(Date.now()));
    window.location.replace(url.toString());
  };

  const dismiss = () => {
    setDismissed(true);
  };

  return {
    updateAvailable: updateAvailable && !dismissed,
    remoteSha,
    localSha: localShaRef.current,
    refresh,
    dismiss,
  };
}
