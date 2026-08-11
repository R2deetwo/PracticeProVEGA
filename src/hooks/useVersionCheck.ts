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
 * - Every 30 seconds while the page is visible
 * - Immediately when the tab/window regains focus
 * - Immediately when the browser comes back online
 * - 3 seconds after mount (fast initial check)
 */
import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

export interface VersionCheckState {
  updateAvailable: boolean;
  remoteTimestamp?: number;
  localTimestamp?: number;
  refresh: () => void;
  dismiss: () => void;
}

// Get the baked-in build timestamp. Falls back to 0 if not set.
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

        console.log('[useVersionCheck]', { localBuild, remoteBuild, match: localBuild === remoteBuild });

        if (localBuild > 0 && remoteBuild > 0 && localBuild !== remoteBuild) {
          console.log('[useVersionCheck] UPDATE AVAILABLE');
          setRemoteTimestamp(remoteBuild);
          setUpdateAvailable(true);
          setDismissed(false);
          return;
        }

        setUpdateAvailable(false);
      } catch (err) {
        console.error('[useVersionCheck] error:', err);
      }
    };

    const initialTimer = setTimeout(check, 3_000);
    const interval = setInterval(check, POLL_INTERVAL_MS);

    const onFocus = () => check();
    const onOnline = () => check();
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
      /^draft_/,
      /^local_cached_files$/,
    ];
    const isAuthOrUserData = (key: string) => AUTH_PATTERNS.some(p => p.test(key));

    try { if ('caches' in window) caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {}); } catch {}
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !isAuthOrUserData(key)) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}

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
