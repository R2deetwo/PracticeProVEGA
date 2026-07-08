/**
 * useVersionCheck — detects new deploys and prompts the user to refresh,
 * WITH BUILD-HEALTH PROTECTION.
 *
 * HOW IT WORKS
 * ------------
 * 1. At build time, `scripts/generate-version-manifest.cjs` writes
 *    `public/version.json` with the git SHA + status + stableSince.
 * 2. The build SHA is also baked into the JS bundle via
 *    `import.meta.env.VITE_BUILD_SHA`.
 * 3. At runtime, this hook periodically fetches `/version.json` (with
 *    cache-busting) and compares its `sha` against the baked-in SHA.
 * 4. If they differ, the hook checks:
 *      a. `status === 'healthy'`  — build passed smoke test
 *      b. `stableSince` is > 5 minutes ago  — stable delay
 *    Only if BOTH are true does it prompt the user to refresh.
 * 5. If `status === 'broken'`, the hook NEVER prompts — this lets us
 *    roll back a bad build by updating version.json on the server.
 *
 * BUILD HEALTH STATES
 * ------------------
 *   'building' → build in progress or not yet verified — don't prompt
 *   'healthy'  → build verified, prompt after 5-min stable delay
 *   'broken'   → build known to be broken — never prompt
 *
 * TRIGGERS
 * --------
 * - Every 5 minutes while the page is visible
 * - Immediately when the tab/window regains focus
 * - Immediately when the browser comes back online
 *
 * NOTES
 * -----
 * - In dev mode (VITE_DEV), the hook is a no-op.
 * - In Capacitor (native app), the hook is a no-op — APK updates are
 *   install-time, not runtime.
 */
import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STABLE_DELAY_MS = 5 * 60 * 1000;  // 5 minutes after stableSince

export interface VersionCheckState {
  /** True when a new deploy has been detected, verified healthy, AND stable for 5 min. */
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

        // Different SHA → potential update. Check health before prompting.
        // ── BUILD HEALTH GATE ──────────────────────────────────────────
        // Only prompt if the remote build is marked 'healthy' AND has been
        // stable for at least 5 minutes. This prevents:
        //   - Prompting to a build that's still being verified
        //   - Prompting to a build that was just deployed and may have
        //     runtime issues not yet detected
        //   - Prompting to a known-broken build (status === 'broken')
        const status = data.status || 'building';
        if (status === 'broken') {
          // Known-broken build — never prompt, even if SHA differs.
          // User stays on their current (working) version.
          return;
        }
        if (status === 'building') {
          // Build not yet verified — wait.
          return;
        }
        if (status === 'healthy') {
          // Healthy — but wait for the stable delay to elapse.
          const stableSince = data.stableSince ? new Date(data.stableSince).getTime() : 0;
          const elapsed = Date.now() - stableSince;
          if (elapsed < STABLE_DELAY_MS) {
            // Build is healthy but too fresh — wait for the delay.
            // (Will be re-checked on next poll.)
            return;
          }
        }

        // All gates passed — safe to prompt.
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
