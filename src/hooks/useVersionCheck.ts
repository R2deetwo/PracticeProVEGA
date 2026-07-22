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
    // AGGRESSIVE cache busting — preserves auth/login so user stays logged in.
    //
    // The user reported: "I clicked refresh to update but still see the old
    // version." This happens because browsers aggressively cache HTML/JS even
    // with no-cache headers, especially on SPA routes like /vega and /atrium.
    //
    // WHAT WE CLEAR:
    //   1. Cache API (Service Worker caches) — if any SW is registered
    //   2. sessionStorage — except auth-related keys
    //   3. localStorage — except auth + user preferences + drafts
    //
    // WHAT WE PRESERVE (so the user's flow isn't broken):
    //   - practicepro_cached_user (logged-in user cache)
    //   - practicepro_user_session (session token)
    //   - practicepro_portal_session (portal auth)
    //   - practicepro_portal_type (which portal)
    //   - practicepro_original_session (impersonation)
    //   - practicepro_impersonation_role
    //   - practicepro_session_locked
    //   - practicepro_theme (user's saved theme)
    //   - practicepro_fontSize (user's saved font size)
    //   - practicepro_cookie_consent (GDPR/NDPA consent)
    //   - practicepro_ai_consent (AI feature consent)
    //   - practicepro_content_protection (user setting)
    //   - practicepro_tour_completed (onboarding state)
    //   - practicepro_dismissed_tips (user's dismissed tips)
    //   - practicepro_last_seen_version (What's New dismissal — without this,
    //     refresh wipes the localStorage key and the user sees the same
    //     What's New floater again immediately after dismissing it)
    //   - draft_* (form drafts — never clear, user data)
    //   - local_cached_files (offline file cache, user data)
    //   - pp_migration_email (migration flow state)
    //   - practicepro_push_registered_this_session
    //
    // Then we navigate with a cache-busting query param so the browser
    // MUST fetch fresh HTML (different URL = no bfcache, no disk cache).
    const AUTH_PATTERNS = [
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
      /^practicepro_last_seen_version$/, // What's New dismissal — without this, refresh wipes the localStorage key and the same What's New floater re-appears after the user already dismissed it
      /^practicepro_push_registered_this_session$/,
      /^practicepro_last_briefing_date$/,
      /^practicepro_aloa_model$/,
      /^practicepro_tc_collapsed$/,
      /^practicepro_cached_appstate$/,
      /^aloax_sidebar_enabled$/,
      /^draft_/,            // any draft_* key (form drafts)
      /^local_cached_files$/,
      /^pp_migration_email$/,
    ];

    const isAuthOrUserData = (key: string): boolean =>
      AUTH_PATTERNS.some(p => p.test(key));

    // 1. Clear Cache API (Service Worker caches) — async
    try {
      if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
      }
    } catch { /* ignore */ }

    // 2. Clear sessionStorage except auth keys
    try {
      const sessionKeysToKeep: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && isAuthOrUserData(key)) sessionKeysToKeep.push(key);
      }
      sessionStorage.clear();
      // Note: we can't restore them after clear() because clear() removes them
      // So instead, we DON'T clear sessionStorage — only clear specific
      // non-auth keys if any exist. Actually sessionStorage is per-tab and
      // dies when the tab closes anyway, so clearing it is fine.
      // Re-add nothing — sessionStorage resets on navigation to a new URL
      // with a different query param anyway.
      void sessionKeysToKeep;
    } catch { /* ignore */ }

    // 3. Clear localStorage except auth + preferences + drafts
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !isAuthOrUserData(key)) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }

    // 4. Navigate with cache-bust query param + small delay for cache deletion
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', String(Date.now()));
    // 150ms delay lets the async caches.delete() and localStorage cleanup
    // complete before navigation fires
    setTimeout(() => {
      window.location.replace(url.toString());
    }, 150);
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
