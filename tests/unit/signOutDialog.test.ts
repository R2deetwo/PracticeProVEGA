/**
 * signOutDialog.test.ts — Task-74 regression pin: the phantom "Leave site?"
 * dialog on sign-out.
 *
 * OWNER REPORT (2026-11-22): "when I try to sign out of Big A or Complete
 * or Atrium, it actually leaves the site… but then it asks… whether you
 * want to leave the site, but it's already been left… I always end up
 * clicking yes and then it shows the landing page, which was already there
 * in the background."
 *
 * ROOT CAUSE (proven live, scripts/signout-dialog-probe.cjs): the Convex
 * client's DEFAULT `unsavedChangesWarning` listener — `beforeunload` →
 * `if (requestManager.hasIncompleteRequests()) preventDefault()` → the
 * browser's native "Leave site? / Changes you made may not be saved"
 * dialog. logout() fires revokeSessionMutation + the User Logout tracking
 * mutation and hard-navigates 200ms later, so on a real (non-demo) session
 * the mutations are ALWAYS in flight at navigation time → the dialog on
 * every sign-out, rendered over the landing view React had already
 * painted during the 200ms window (AuthContext clears state, App.tsx
 * re-renders unauthenticated). Our own suppression — the
 * __suppressBeforeUnload flag + removeAllBeforeUnloadGuards() — cannot
 * reach this listener: it is Convex's, registered at construction, outside
 * the app's registry.
 *
 * THE FIX: construct both app clients with
 * `{ unsavedChangesWarning: false }`. The dialog protected nothing on the
 * sign-out path (the in-flight mutations are abandoned by the navigation
 * regardless; the session revoke is guaranteed by logout()'s sendBeacon
 * fallback), and the app's REAL unsaved-changes surface — a dirty DraftPro
 * document — keeps its own guard (installBeforeUnloadGuard).
 *
 * These pins hold the fix in place from both ends:
 *   1. BEHAVIOR (jsdom): the option actually suppresses the client's
 *      beforeunload registration — and default options really do register
 *      one (documents the trap we escaped).
 *   2. SOURCE: both entry points pass the option.
 */
// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/** Hermetic stand-in for the global WebSocket — never connects, so the
 *  constructed client makes no network calls from the test. */
class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = 0;
    constructor(_url: string, _protocols?: string | string[]) {}
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
}

describe('Task 74 — no phantom "Leave site?" dialog on sign-out', () => {
    it('the Convex client registers a beforeunload warning by default (the trap)', () => {
        // Documents WHY the explicit option matters: without it the client
        // installs the native-dialog listener at construction. If Convex ever
        // changes this default, this pin tells the next engineer to re-check
        // the sign-out flow, not to delete the option.
        const { ConvexReactClient } = require('convex/react');
        const spy = vi.spyOn(window, 'addEventListener');
        let client: any;
        try {
            client = new ConvexReactClient('https://example.convex.cloud', {
                webSocketConstructor: FakeWebSocket as any,
            });
            // The React client constructs the underlying BaseConvexClient
            // lazily (get sync) — touch it the way the first subscription
            // does, via a public accessor.
            client.connectionState();
            const bu = spy.mock.calls.filter(([t]: any) => t === 'beforeunload');
            expect(bu.length).toBeGreaterThanOrEqual(1);
        } finally {
            spy.mockRestore();
            // Best effort — jsdom's WebSocket never connects to the fake URL.
            client?.close?.().catch?.(() => {});
        }
    });

    it('unsavedChangesWarning: false installs NO beforeunload listener', async () => {
        const { ConvexReactClient } = require('convex/react');
        const spy = vi.spyOn(window, 'addEventListener');
        let client: any;
        try {
            client = new ConvexReactClient('https://example.convex.cloud', {
                unsavedChangesWarning: false,
                webSocketConstructor: FakeWebSocket as any,
            });
            client.connectionState();
            const bu = spy.mock.calls.filter(([t]: any) => t === 'beforeunload');
            expect(bu).toHaveLength(0);
        } finally {
            spy.mockRestore();
            // Fire-and-forget: with the fake WebSocket there is no close
            // handshake, so close()'s promise never resolves — same as the
            // trap test above.
            client?.close?.().catch?.(() => {});
        }
    });

    it('the consumer app client passes unsavedChangesWarning: false (src/main.tsx)', () => {
        const src = read('src/main.tsx');
        expect(src).toContain('new ConvexReactClient(CONVEX_URL, { unsavedChangesWarning: false })');
    });

    it('the founder console client passes unsavedChangesWarning: false (src/admin/main.tsx)', () => {
        const src = read('src/admin/main.tsx');
        expect(src).toContain('new ConvexReactClient(CONVEX_URL, { unsavedChangesWarning: false })');
    });

    it('the app keeps its OWN unsaved-changes guard for dirty documents (DraftPro)', () => {
        // The fix must not neuter the real protection: DraftPro's dirty-state
        // guard still registers through installBeforeUnloadGuard, honors the
        // logout suppress flag, and logout still clears the registry + the
        // DOM0 handler before navigating.
        const tabNav = read('src/utils/tabNavigation.ts');
        expect(tabNav).toContain('export function installBeforeUnloadGuard');
        expect(tabNav).toContain('__suppressBeforeUnload');
        expect(tabNav).toContain('export function removeAllBeforeUnloadGuards');
        const auth = read('src/contexts/AuthContext.tsx');
        expect(auth).toContain('removeAllBeforeUnloadGuards()');
        expect(auth).toContain('window.onbeforeunload = null');
        expect(auth).toContain("navigator.sendBeacon");
    });
});
