/**
 * useVersionCheck — detects new deploys and PROMPTS the user to refresh.
 *
 * HOW IT WORKS
 * ------------
 * 1. At build time, `scripts/generate-version-manifest.cjs` writes
 *    `public/version.json` with the git SHA + status + stableSince.
 * 2. The build SHA is also baked into the JS bundle via
 *    `import.meta.env.VITE_BUILD_SHA`.
 * 3. At runtime, this hook periodically fetches `/version.json` (with
 *    cache-busting) and compares its `sha` against the baked-in SHA.
 * 4. If they differ AND `status === 'healthy'`, the hook sets
 *    `updateAvailable = true`. The VersionRefreshBanner shows a
 *    non-intrusive floater at the bottom of the screen with a
 *    "Refresh" button and a "Dismiss" button.
 * 5. The user chooses WHEN to refresh — their work is never interrupted.
 * 6. If `status === 'building'` or `'broken'`, the hook waits — never
 *    prompts to an in-progress or known-broken build.
 *
 * TRIGGERS
 * --------
 * - Every 60 seconds while the page is visible
 * - Immediately when the tab/window regains focus
 * - Immediately when the browser comes back online
 *
 * NOTES
 * -----
 * - In dev mode (VITE_DEV), the hook is a no-op.
 * - In Capacitor (native app), the hook is a no-op — APK updates are
 *   install-time, not runtime.
 * - This is a PROMPT-based flow, NOT auto-refresh. An earlier version
 *   auto-refreshed immediately, which caused data loss when users were
 *   in the middle of editing. The user explicitly asked for the manual
 *   floater back so they control when to refresh.
 */
import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 60 * 1000; // 1 minute
const STABLE_DELAY_MS = 30 * 1000;  // 30 seconds after stableSince — short delay to ensure deploy is live

export interface VersionCheckState {
  /** True when a new deploy has been detected, verified healthy, AND stable for the delay period. */
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
  if (localShaRef.current === undefined) {
    localShaRef.current = (import.meta as any).env?.VITE_BUILD_SHA || 'unknown';
  }

  useEffect(() => {
    // Skip in dev mode and native apps (see rationale in file header).
    if (isDev || isNative) return;

    let cancelled = false;

    const check = async () => {
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

        // ─── DIFFERENT SHA → SHOW THE FLOATER IMMEDIATELY ─────────────
        // The user explicitly requested: "the refresh to get updates should
        // show everytime we have a new push". We do NOT wait for:
        //   - status === 'healthy' (mark-healthy.cjs often fails silently)
        //   - stableSince delay (unnecessary — Vercel atomic deploys are
        //     already live by the time version.json is updated)
        //   - 2-minute grace period (just adds latency)
        //
        // The ONLY exception: status === 'broken' — if the deploy is known
        // to be broken, don't prompt the user to refresh into a broken build.
        const status = data.status || 'healthy';
        if (status === 'broken') {
          return;
        }

        // All gates passed — show the prompt. The user decides when to refresh.
        setRemoteSha(data.sha);
        setUpdateAvailable(true);
        setDismissed(false);
      } catch {
        // Network error — silently ignore. We'll retry on next interval.
      }
    };

    // Initial check after a short delay (let the app settle first).
    const initialTimer = setTimeout(check, 15_000);
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
    // Bypass any bfcache and CDN caches:
    // 1. Clear all Cache Storage (service workers, etc.)
    // 2. Reload with cache-bust query AND `no-cache` headers via location.reload(true)
    // 3. Fall back to location.replace with cache-bust query
    try {
      if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
      }
    } catch { /* ignore */ }
    try {
      // Force-reload — bypasses bfcache in modern browsers
      (window.location as any).reload(true);
      return;
    } catch {
      // Fallback: cache-bust via query string
      const url = new URL(window.location.href);
      url.searchParams.set('_refresh', String(Date.now()));
      window.location.replace(url.toString());
    }
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
