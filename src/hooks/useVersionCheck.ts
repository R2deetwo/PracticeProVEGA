/**
 * useVersionCheck — detects new deploys and prompts the user to refresh.
 *
 * HOW IT WORKS
 * ------------
 * 1. At build time, `scripts/generate-version-manifest.js` writes
 *    `public/version.json` with the git SHA of the build. Vite then
 *    copies it to `dist/version.json` and Vercel serves it as a static
 *    asset.
 * 2. The build SHA is also baked into the JS bundle via the
 *    `import.meta.env.VITE_BUILD_SHA` define in vite.config.ts.
 * 3. At runtime, this hook periodically fetches `/version.json` (with
 *    cache-busting) and compares its `sha` against the baked-in SHA.
 * 4. If they differ, a non-dismissable toast is shown prompting the
 *    user to refresh. The user can refresh immediately or defer.
 *
 * TRIGGERS
 * --------
 * - Every 5 minutes while the page is visible
 * - Immediately when the tab/window regains focus
 * - Immediately when the browser comes back online
 *
 * NOTES
 * -----
 * - In dev mode (VITE_DEV), the hook is a no-op — version.json is
 *   stale/non-existent during `vite dev` and would constantly fire.
 * - In Capacitor (native app), the hook is a no-op — the APK bundle
 *   is updated only when the user installs a new APK, so a runtime
 *   version check would always mismatch the baked-in SHA against the
 *   server's latest deploy.
 */
import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface VersionCheckState {
  /** True when a new deploy has been detected and the user hasn't refreshed yet. */
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
  // Stash the baked-in SHA once. Reading import.meta.env at module load is
  // fine because Vite inlines it as a string constant at build time.
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

        if (data.sha !== local) {
          setRemoteSha(data.sha);
          setUpdateAvailable(true);
          setDismissed(false);
        }
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
    // Bypass any bfcache by appending a cache-bust query, then reload.
    // Most modern browsers honor `location.reload()` with a fresh fetch
    // when cache-control headers say no-cache — but to be safe we force
    // it with `true` (legacy arg, ignored by some browsers but harmless).
    try {
      // Clear any cached service-worker-like state.
      if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
      }
    } catch { /* ignore */ }
    // Hard reload: navigate to the same URL with a fresh query param so
    // even cached HTML is bypassed.
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
