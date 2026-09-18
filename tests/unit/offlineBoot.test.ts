/**
 * Offline-first APK experience (Task 62) — contract suite.
 *
 * The user report: "the APKs do not open without internet". Root cause: every
 * offline fallback keyed on `navigator.onLine`, which stays TRUE on
 * "connected but dead" networks (exhausted data plans, dead cell zones) —
 * exactly the mobile reality this app ships into. On those networks the auth
 * layer ran 20s → retry → 15s → SESSION WIPE → login screen.
 *
 * These tests pin the contracts that fix it:
 *
 *   1. HELPERS — offlineBoot.ts reads/validates the cached user and cached
 *      appState, demotes Admin/Founder in the offline fallback (never trust
 *      a stale role cache), and strips volatile collections from the
 *      appState snapshot.
 *   2. BOOT GRACE — AuthContext engages the offline cache when the server
 *      stays silent past the grace window, and NEVER wipes the session on
 *      that path (the wipe now only happens for cache-less devices).
 *   3. DATA — DataProvider hydrates from the cached appState when the auth
 *      layer is serving the offline cache, and routes generic CRUD (incl.
 *      notes/notebooks) into the offline queue with optimistic UI + a
 *      write-through cache.
 *   4. QUEUE SAFETY — the offline queue is single-flight across ALL mounted
 *      hook instances (double-replay = double mutations = accounting bugs)
 *      and merges back items queued during a replay instead of dropping them.
 *   5. SHELL PURITY — index.html / admin.html load ZERO remote scripts,
 *      styles, or fonts; the app renders pixel-identical with no network.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Unit-under-test (pure helpers) ────────────────────────────────────────
import {
    bootGraceMs,
    BOOT_GRACE_MS_NATIVE,
    BOOT_GRACE_MS_WEB,
    CACHED_USER_KEY,
    CACHED_APPSTATE_KEY,
    readCachedUserRecord,
    buildOfflineFallbackUser,
    readCachedAppState,
    writeAppStateCache,
} from '../../src/utils/offlineBoot';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/myFunctions.ts'))
    ? resolve(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

// ─── localStorage stub (vitest runs in the node environment) ───────────────
function installLocalStorageStub() {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => store.set(k, String(v)),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() { return store.size; },
    };
    return store;
}

// ─── 1. offlineBoot helpers ────────────────────────────────────────────────
describe('offlineBoot helpers', () => {
    let store: Map<string, string>;
    beforeEach(() => { store = installLocalStorageStub(); });

    it('boot grace: native is faster than web, both bounded', () => {
        expect(BOOT_GRACE_MS_NATIVE).toBe(8000);
        expect(BOOT_GRACE_MS_WEB).toBe(14000);
        // Node test env = not native → web grace. The constants above are
        // pinned so neither window can silently grow back toward the old
        // 20s/15s wipe chain.
        expect([BOOT_GRACE_MS_NATIVE, BOOT_GRACE_MS_WEB]).toContain(bootGraceMs());
    });

    it('readCachedUserRecord: returns the record only for the matching token', () => {
        store.set(CACHED_USER_KEY, JSON.stringify({
            token: 'ada@example.com',
            user: { id: 'u1', email: 'ada@example.com', role: 'Lawyer' },
            cachedAt: 1_700_000_000_000,
        }));
        expect(readCachedUserRecord('ada@example.com')?.user.id).toBe('u1');
        // A different session (another account on the same device) must
        // never be served this cache.
        expect(readCachedUserRecord('grace@example.com')).toBeNull();
        expect(readCachedUserRecord(null)).toBeNull();
    });

    it('readCachedUserRecord: malformed cache is inert, not fatal', () => {
        store.set(CACHED_USER_KEY, '{not json');
        expect(readCachedUserRecord('ada@example.com')).toBeNull();
        store.set(CACHED_USER_KEY, JSON.stringify({ token: 'ada@example.com' /* no user */ }));
        expect(readCachedUserRecord('ada@example.com')).toBeNull();
    });

    it('buildOfflineFallbackUser: Admin/Founder are demoted, flag is set, others preserved', () => {
        store.set(CACHED_USER_KEY, JSON.stringify({
            token: 'a@example.com',
            user: { id: 'u1', role: 'Admin' },
        }));
        expect(buildOfflineFallbackUser('a@example.com')!.role).toBe('Lawyer');
        expect(buildOfflineFallbackUser('a@example.com')!.isOfflineCache).toBe(true);

        store.set(CACHED_USER_KEY, JSON.stringify({
            token: 'f@example.com',
            user: { id: 'u2', role: 'Founder' },
        }));
        expect(buildOfflineFallbackUser('f@example.com')!.role).toBe('Lawyer');

        store.set(CACHED_USER_KEY, JSON.stringify({
            token: 'p@example.com',
            user: { id: 'u3', role: 'Paralegal' },
        }));
        const paralegal = buildOfflineFallbackUser('p@example.com')!;
        expect(paralegal.role).toBe('Paralegal'); // non-admin roles pass through
        expect(paralegal.isOfflineCache).toBe(true);

        expect(buildOfflineFallbackUser('nobody@example.com')).toBeNull();
    });

    it('readCachedAppState: firmId must match, malformed must be inert', () => {
        store.set(CACHED_APPSTATE_KEY, JSON.stringify({
            firmId: 'firm_1',
            state: { matters: [{ id: 'm1' }] },
            cachedAt: 123,
        }));
        expect(readCachedAppState('firm_1')?.state.matters).toHaveLength(1);
        expect(readCachedAppState('firm_2')).toBeNull(); // cross-firm leak guard
        expect(readCachedAppState(null)).toBeNull();

        store.set(CACHED_APPSTATE_KEY, 'not json at all');
        expect(readCachedAppState('firm_1')).toBeNull();
    });

    it('writeAppStateCache: strips volatile collections and round-trips', () => {
        writeAppStateCache({
            matters: [{ id: 'm1' }],
            chatMessages: [{ id: 'c1' }],   // huge — must never be cached
            firmActivity: [{ id: 'f1' }],   // volatile — must never be cached
        }, 'firm_1');
        const cached = readCachedAppState('firm_1')!;
        expect(cached.state.matters).toHaveLength(1);
        expect(cached.state.chatMessages).toBeUndefined();
        expect(cached.state.firmActivity).toBeUndefined();
        expect(cached.firmId).toBe('firm_1');
        expect(typeof cached.cachedAt).toBe('number');
    });

    it('writeAppStateCache: a full localStorage never throws', () => {
        (globalThis as any).localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
        expect(() => writeAppStateCache({ matters: [] }, 'firm_1')).not.toThrow();
    });
});

// ─── 2. AuthContext boot grace ─────────────────────────────────────────────
describe('AuthContext — boot grace (source pins)', () => {
    const src = read('src/contexts/AuthContext.tsx');

    it('engages the offline cache when the server stays silent past the grace', () => {
        expect(src).toContain('offlineCacheEngaged');
        expect(src).toContain('bootGraceMs()');
        expect(src).toContain("readCachedUserRecord(sessionToken)");
    });

    it('the currentUser memo serves the cache on fake-online networks too', () => {
        // The memo must not require !navigator.onLine — that flag lies on
        // connected-but-dead networks.
        expect(src).toContain('offlineCacheEngaged || (typeof navigator');
    });

    it('NEVER wipes the session while the offline cache is engaged', () => {
        // The safety-timeout effect must stand down when hasTimedOut was set
        // by the boot grace (session preserved), and only re-arm once real
        // data arrives.
        expect(src).toContain('never toggle the session token and');
        expect(src).toMatch(/if \(hasTimedOut\) \{[\s\S]*?setHasTimedOut\(false\);[\s\S]*?setRetryCount\(0\);[\s\S]*?\}/);
    });

    it('still shares the same privilege-demotion contract (no cached Admin)', () => {
        expect(src).toContain('buildOfflineFallbackUser(sessionToken)');
    });
});

// ─── 3. DataProvider offline data + write path ────────────────────────────
describe('DataProvider — cached data + queued writes (source pins)', () => {
    const src = read('src/contexts/DataProvider.tsx');

    it('hydrates appState from the cache when auth is serving the offline cache', () => {
        expect(src).toContain('isServingOfflineCache) && !isDataLoaded && currentUser');
        expect(src).toContain('readCachedAppState(currentUser.firmId)');
    });

    it('a PARTIAL cached appState can never leave collections undefined (merged over EMPTY_APP_STATE)', () => {
        // A cache written mid-load (or by an older app version) may lack whole
        // collections. Rendering `.filter`/`.map` over undefined crashed the
        // offline shell to the error boundary before this merge existed.
        expect(src).toContain('{ ...EMPTY_APP_STATE, ...cachedAppState.state }');
    });

    it('generic CRUD is queued offline with optimistic UI kept visible', () => {
        // All three actions must check the effective-offline signal BEFORE
        // firing the mutation at a dead socket.
        const offlineBranches = src.split('effectivelyOfflineRef.current').length - 1;
        expect(offlineBranches).toBeGreaterThanOrEqual(4); // ref init + 3 actions
        expect(src).toMatch(/mutationName: 'createItem'/);
        expect(src).toMatch(/mutationName: 'updateItem'/);
        expect(src).toMatch(/mutationName: 'deleteItem'/);
        expect(src).toContain("Saved offline — ${itemName || 'item'} will sync when you reconnect.");
    });

    it('offline edits are written through to the cache (cold restart keeps them)', () => {
        expect(src).toContain('writeAppStateCache(appStateRef.current, currentUser.firmId)');
    });
});

// ─── 4. Queue safety ───────────────────────────────────────────────────────
describe('useOfflineQueue — single-flight + merge-back (source pins)', () => {
    const src = read('src/hooks/useOfflineQueue.ts');

    it('replay is single-flight across every mounted instance', () => {
        expect(src).toContain('globalReplayLock');
        expect(src).toContain('if (globalReplayLock) return;');
    });

    it('the lock is exception-safe (try/finally release)', () => {
        expect(src).toMatch(/try \{[\s\S]*?\} finally \{[\s\S]*?globalReplayLock = false;/);
    });

    it('items queued DURING a replay survive (merge-back, not overwrite)', () => {
        expect(src).toContain('attemptedIds');
        expect(src).toContain('remainingIds');
        expect(src).toMatch(/writeQueue\(stored\.filter\(/);
    });
});

// ─── 5. Offline banner ────────────────────────────────────────────────────
describe('UIContext — global offline banner (source pins)', () => {
    const src = read('src/contexts/UIContext.tsx');

    it('shows a banner when offline or serving the offline cache, and clears it on recovery', () => {
        expect(src).toContain("b.type === 'offline'");
        expect(src).toContain("isOfflineCache === true");
        expect(src).toContain("prev.filter(b => b.type !== 'offline')");
    });
});

// ─── 6. Shell purity — the APK boots with zero network ────────────────────
describe('Offline shell purity (index.html / admin.html / index.css)', () => {
    const indexHtml = read('index.html');
    const adminHtml = read('admin.html');
    const indexCss = read('src/index.css');

    const REMOTE_REFS = [
        'fonts.googleapis.com',
        'fonts.gstatic.com',
        'cdnjs.cloudflare.com',
        'cdn.quilljs.com',
    ];

    it.each(REMOTE_REFS)('index.html loads nothing from %s', (host) => {
        // CSP meta lines legitimately mention hosts in the allow-list; only
        // actual resource loads (link/script src/href) are forbidden.
        const loadRefs = indexHtml.match(/<(?:script|link)[^>]*(?:src|href)=["'][^"']*["'][^>]*>/g) ?? [];
        const offenders = loadRefs.filter((tag) => tag.includes(host));
        expect(offenders, `index.html still loads ${host}`).toEqual([]);
    });

    it.each(REMOTE_REFS)('admin.html loads nothing from %s', (host) => {
        const loadRefs = adminHtml.match(/<(?:script|link)[^>]*(?:src|href)=["'][^"']*["'][^>]*>/g) ?? [];
        const offenders = loadRefs.filter((tag) => tag.includes(host));
        expect(offenders, `admin.html still loads ${host}`).toEqual([]);
    });

    it('fonts are self-hosted via @fontsource for all three families', () => {
        expect(indexCss).toContain("@fontsource/inter/400.css");
        expect(indexCss).toContain("@fontsource/inter/700.css");
        expect(indexCss).toContain("@fontsource/space-grotesk/400.css");
        expect(indexCss).toContain("@fontsource/space-grotesk/700.css");
        expect(indexCss).toContain("@fontsource/dancing-script/700.css");
        expect(indexCss).not.toContain('fonts.googleapis.com');
    });

    it('legacy Quill snow CSS is self-hosted (not fetched from the CDN)', () => {
        expect(indexHtml).toContain('/vendor/quill.snow-1.3.6.css');
        expect(existsSync(resolve(repoRoot, 'public/vendor/quill.snow-1.3.6.css'))).toBe(true);
    });
});
