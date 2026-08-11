/**
 * useVersionCheck — BULLETPROOF version detection.
 *
 * HOW IT WORKS
 * ------------
 * 1. At build time, a `buildTimestamp` (Unix ms) is written to version.json
 *    AND baked into the JS bundle via `VITE_BUILD_TIMESTAMP`.
 * 2. At runtime, this hook fetches `/version.json` (with cache-busting) and
 *    compares the remote `buildTimestamp` against the baked-in local one.
 * 3. If they differ → a new deploy has shipped → show the refresh prompt.
 *
 * WHY TIMESTAMP INSTEAD OF SHA
 * ----------------------------
 * SHA comparison was fragile — Vercel/Cloudflare build environments don't
 * always have git context, causing SHA to fall back to 'unknown'. A build
 * timestamp is ALWAYS available (just `Date.now()` at build time) and is
 * guaranteed to be unique per build.
 *
 * TRIGGERS
 * --------
 * - Every 30 seconds while the page is visible (aggressive)
 * - Immediately when the tab/window regains focus
 * - Immediately when the browser comes back online
 * - 3 seconds after mount (fast initial check)
 *
 * NO SKIPS — This hook ALWAYS runs in production. No isDev/isNative skips.
 * Even native APKs can benefit from knowing a web deploy shipped (for
 * portal users accessing via in-app browser).
 */
import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds — aggressive

export interface VersionCheckState {
  /** True when a new deploy has been detected. */
  updateAvailable: boolean;
  /** The build timestamp of the new deploy (for display). */
  remoteTimestamp?: number;
  /** The build timestamp baked into this running bundle. */
  localTimestamp?: number;
  /** Force a hard refresh now. */
  refresh: () => void;
  /** Dismiss the prompt for now (will re-appear on next poll). */
  dismiss: () => void;
  /** Manually trigger a check (e.g. from a Settings button). */
  checkNow: () => void;
  /** Whether a check is currently in progress. */
  isChecking: boolean;
}

// Get the baked-in build timestamp. This is defined by Vite at build time.
// Fallback to 0 if not set (which means "always show update" on first load
// if version.json has a real timestamp — safe default).
const LOCAL_BUILD_TIMESTAMP = (import.meta as any).env?.VITE_BUILD_TIMESTAMP
  ? Number((import.meta as any).env.VITE_BUILD_TIMESTAMP)
  : 0;

export function useVersionCheck(): VersionCheckState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteTimestamp, setRemoteTimestamp] = useState<number | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const localTimestampRef = useRef<number>(LOCAL_BUILD_TIMESTAMP);
  const checkRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      setIsChecking(true);
      try {
        // Cache-bust via query string with BOTH timestamp AND random
        // to defeat even the most aggressive CDN caching.
        const url = `/version.json?_t=${Date.now()}&_r=${Math.random().toString(36).slice(2)}`;
        const res = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        if (!res.ok) {
          console.error('[useVersionCheck] fetch failed:', res.status, res.statusText);
          return;
        }
        const data = await res.json();
        if (cancelled || !data) return;

        const remoteBuild = Number(data.buildTimestamp) || 0;
        const remoteSha = data.sha || 'unknown';
        const localBuild = localTimestampRef.current;
        const localSha = (import.meta as any).env?.VITE_BUILD_SHA || 'unknown';

        // AGGRESSIVE LOGGING — use console.error so it's visible in production
        console.error('[useVersionCheck] COMPARISON:', {
          localBuild,
          remoteBuild,
          localSha: localSha?.slice(0, 12),
          remoteSha: remoteSha?.slice(0, 12),
          status: data.status,
          match: localBuild === remoteBuild,
        });

        // Check 1: Build timestamp mismatch (PRIMARY — most reliable)
        if (localBuild > 0 && remoteBuild > 0 && localBuild !== remoteBuild) {
          console.error('[useVersionCheck] UPDATE AVAILABLE (timestamp mismatch)');
          setRemoteTimestamp(remoteBuild);
          setUpdateAvailable(true);
          setDismissed(false);
          return;
        }

        // Check 2: SHA mismatch (SECONDARY — fallback)
        if (localSha && localSha !== 'unknown' && remoteSha && remoteSha !== 'unknown' && localSha !== remoteSha) {
          console.error('[useVersionCheck] UPDATE AVAILABLE (SHA mismatch)');
          setRemoteTimestamp(remoteBuild);
          setUpdateAvailable(true);
          setDismissed(false);
          return;
        }

        // Either both match or we can't compare — no update
        setUpdateAvailable(false);
      } catch (err) {
        console.error('[useVersionCheck] check error:', err);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    // Store check function for manual triggering
    checkRef.current = check;

    // Initial check after 3 seconds (fast — let the app settle briefly)
    const initialTimer = setTimeout(check, 3_000);
    const interval = setInterval(check, POLL_INTERVAL_MS);

    // Check on focus and online events
    const onFocus = () => { check(); };
    const onOnline = () => { check(); };
    // Check on visibility change (tab switch)
    const onVisibility = () => { if (!document.hidden) check(); };
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
    // AGGRESSIVE cache busting — clear all caches then navigate with
    // cache-busting query param so the browser MUST fetch fresh HTML.
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
      /^practicepro_last_seen_version$/,
      /^practicepro_push_registered_this_session$/,
      /^practicepro_last_briefing_date$/,
      /^practicepro_aloa_model$/,
      /^practicepro_tc_collapsed$/,
      /^practicepro_cached_appstate$/,
      /^aloax_sidebar_enabled$/,
      /^draft_/,
      /^local_cached_files$/,
      /^pp_migration_email$/,
      /^founder_screen_capture$/,
    ];

    const isAuthOrUserData = (key: string): boolean =>
      AUTH_PATTERNS.some(p => p.test(key));

    // 1. Clear Cache API (Service Worker caches)
    try {
      if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
      }
    } catch {}

    // 2. Clear localStorage except auth + preferences + drafts
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !isAuthOrUserData(key)) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}

    // 3. Navigate with cache-bust query param
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', String(Date.now()));
    setTimeout(() => {
      window.location.replace(url.toString());
    }, 150);
  };

  const dismiss = () => {
    setDismissed(true);
  };

  const checkNow = () => {
    if (checkRef.current) {
      setDismissed(false);
      checkRef.current();
    }
  };

  return {
    updateAvailable: updateAvailable && !dismissed,
    remoteTimestamp,
    localTimestamp: localTimestampRef.current,
    refresh,
    dismiss,
    checkNow,
    isChecking,
  };
}
