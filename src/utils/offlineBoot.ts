/**
 * offlineBoot — shared helpers for the offline-first APK experience (Task 62).
 *
 * WHY THIS EXISTS
 * The APKs were reported as "not opening without internet". The app already
 * had an offline path (cached user + cached appState in localStorage), but it
 * only engaged when `navigator.onLine === false`. That flag reflects network
 * INTERFACES, not reachability — on an exhausted data plan or a dead cell
 * zone the Android WebView still reports "online" while every Convex query
 * hangs forever. In that state the auth layer ran its full 20s → retry → 15s
 * safety chain, WIPED the session, and bounced the user to the login screen.
 * Result: ~35 seconds of splash, then a login page they couldn't use —
 * indistinguishable from "the app does not open".
 *
 * THE FIX (three layers, all in this module's callers):
 *   1. AuthContext — BOOT GRACE: if the server hasn't produced user data
 *      within `bootGraceMs()` AND a cached user exists for this session,
 *      engage the offline cache and KEEP the session (never wipe).
 *   2. DataProvider — when the auth layer is serving the offline cache
 *      (`currentUser.isOfflineCache === true`), hydrate appState from the
 *      cached snapshot instead of waiting for queries that will never land.
 *   3. DataProvider write path — generic CRUD (addItem/updateItem/deleteItem,
 *      which is also how notes and notebooks save) is queued to the existing
 *      offline mutation queue with optimistic UI, and every state change is
 *      written through to the cache so offline edits survive app restarts.
 *
 * SECURITY (unchanged from the original inline implementation)
 * The cached user object is NEVER trusted for privileged access: Admin and
 * Founder roles are demoted to Lawyer in `buildOfflineFallbackUser`, and the
 * server-side session validation still retires dead bearers the moment
 * connectivity returns.
 */

import { isNativePlatform } from './capacitor';

// ─── Boot grace ────────────────────────────────────────────────────────────
// How long we hold the splash for the server before engaging the offline
// cache on "connected but dead" networks. Native gets the shorter window:
// the APK experience is the priority, and Convex answers in well under a
// second on any working connection.
export const BOOT_GRACE_MS_NATIVE = 8000;
export const BOOT_GRACE_MS_WEB = 14000;

export function bootGraceMs(): number {
    return isNativePlatform() ? BOOT_GRACE_MS_NATIVE : BOOT_GRACE_MS_WEB;
}

// ─── Storage keys (single source of truth) ─────────────────────────────────
export const CACHED_USER_KEY = 'practicepro_cached_user';
export const CACHED_APPSTATE_KEY = 'practicepro_cached_appstate';

// ─── Cached user ───────────────────────────────────────────────────────────

export interface OfflineCachedUserRecord {
    token: string;
    user: any;
    cachedAt: number;
}

/**
 * Read and validate the cached-user record for a session token.
 * Returns null for: missing token, no cache, malformed JSON, or a token
 * mismatch (a different account's cache must never be served).
 */
export function readCachedUserRecord(token: string | null | undefined): OfflineCachedUserRecord | null {
    if (!token) return null;
    try {
        const raw = localStorage.getItem(CACHED_USER_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.token !== token || !parsed.user) return null;
        return parsed as OfflineCachedUserRecord;
    } catch {
        return null;
    }
}

/**
 * Build the fallback user object served while offline. Admin/Founder roles
 * are demoted to Lawyer — the cached role is never trusted for admin access
 * (the server re-asserts the real role the moment connectivity returns).
 * The result is flagged `isOfflineCache: true` so the rest of the app can
 * surface the offline state (banner, queue-aware saves).
 */
export function buildOfflineFallbackUser(token: string | null | undefined): any | null {
    const record = readCachedUserRecord(token);
    if (!record) return null;
    const cachedUser = { ...record.user };
    if (cachedUser.role === 'Admin' || cachedUser.role === 'Founder') {
        cachedUser.role = 'Lawyer';
    }
    cachedUser.isOfflineCache = true;
    return cachedUser;
}

// ─── Cached appState ───────────────────────────────────────────────────────

export interface OfflineCachedAppState {
    firmId: string | null;
    state: any;
    cachedAt: number;
}

/**
 * Read and validate the cached appState snapshot for a firm.
 * Returns null unless the snapshot exists, parses, and belongs to the same
 * firm as the current user (a mismatched firm snapshot is never served).
 */
export function readCachedAppState(firmId: string | null | undefined): OfflineCachedAppState | null {
    if (!firmId) return null;
    try {
        const raw = localStorage.getItem(CACHED_APPSTATE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.firmId !== firmId || !parsed.state) return null;
        return parsed as OfflineCachedAppState;
    } catch {
        return null;
    }
}

/**
 * Persist a snapshot of appState for offline boots. Large/volatile
 * collections are stripped to keep localStorage usage bounded — the same
 * policy the original inline DataProvider cache write used.
 */
export function writeAppStateCache(state: any, firmId: string | null | undefined): void {
    try {
        const toCache = { ...state };
        delete (toCache as any).chatMessages;
        delete (toCache as any).firmActivity;
        localStorage.setItem(CACHED_APPSTATE_KEY, JSON.stringify({
            firmId: firmId ?? null,
            state: toCache,
            cachedAt: Date.now(),
        }));
    } catch {
        // localStorage might be full or unavailable — non-critical.
    }
}
