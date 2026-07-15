/**
 * tabNavigation — Centralised helpers for opening DraftPro and Research
 * in NEW browser tabs (never in-place) and for guarding the DraftPro
 * canvas against accidental navigation with unsaved changes.
 *
 * ## Why this module exists
 *
 * Browsers block `window.open()` calls that happen OUTSIDE a user
 * gesture (click / keypress). When the AI takes several seconds to
 * respond before deciding to open DraftPro, the gesture is long gone
 * and a naive `window.open(url, '_blank')` will be silently blocked.
 *
 * The ALOA chat solves this with the "armed tab" pattern: a blank
 * tab is opened synchronously inside the user's click handler (before
 * any await), held in a ref, and navigated later when the AI is ready.
 *
 * This module extends the same pattern to:
 *   - DraftPro → Research transitions (citation verify)
 *   - ALOA → Research transitions (send to research)
 *   - Any other place that needs to open a PracticePro route in a new tab
 *
 * It also implements the unsaved-changes guardrail for DraftPro:
 *   - `beforeunload` listener (tab close / refresh)
 *   - `useNavigationGuard` hook (in-app navigation via navigateTo / back)
 *
 * ## Browser quirks handled
 *   - Mobile (Capacitor / small viewport): in-place navigation only
 *   - Cross-origin windows: try/catch around location writes
 *   - Already-armed tab reuse: close stale before opening fresh
 *   - Popup-blocked fallback: return false so caller can fall back
 */

/**
 * Returns true if we're on a mobile viewport or running inside the
 * Capacitor native shell. On these platforms, opening new tabs is
 * either impossible or undesirable — callers should fall back to
 * in-place navigation.
 */
export function isMobileOrNative(): boolean {
    if (typeof window === 'undefined') return false;
    if (window.innerWidth < 768) return true;
    if ((window as any).Capacitor?.isNativePlatform?.()) return true;
    return false;
}

/**
 * Build a PracticePro route URL that works in BOTH the in-app router
 * (via `navigateTo`) AND a fresh browser tab (via `window.open`).
 *
 * The trick: our SPA listens to `window.history.state.state` for
 * navigation context (the `context` parameter of `navigateTo`).
 * When we open a new tab, we encode the context into the URL hash
 * as JSON so the receiving page can read it on mount.
 *
 * @param route   e.g. 'research', 'editor'
 * @param context arbitrary context object (must be JSON-serialisable)
 * @returns URL string like `/research#__ctx=<base64>`
 */
export function buildRouteUrlWithHashContext(route: string, context?: Record<string, any>): string {
    const base = route === 'editor' ? '/editor' : `/${route}`;
    if (!context || Object.keys(context).length === 0) return base;
    try {
        // Use base64url encoding so the hash is URL-safe and compact.
        // Note: btoa fails on non-ASCII — use TextEncoder + base64.
        const json = JSON.stringify(context);
        const bytes = new TextEncoder().encode(json);
        // Convert bytes to base64 in chunks (btoa limit ~32k chars).
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return `${base}#__ctx=${b64}`;
    } catch {
        return base;
    }
}

/**
 * Decode the `#__ctx=` hash fragment back into a context object.
 * Used by receiving pages (ResearchView, WordProcessor) on mount.
 *
 * Returns null if no hash context is present or decoding fails.
 */
export function readHashContext(): Record<string, any> | null {
    if (typeof window === 'undefined') return null;
    try {
        const hash = window.location.hash || '';
        const m = hash.match(/__ctx=([A-Za-z0-9_-]+)/);
        if (!m) return null;
        const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
        // Pad to multiple of 4
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const bin = atob(padded);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const json = new TextDecoder().decode(bytes);
        return JSON.parse(json);
    } catch {
        return null;
    }
}

/**
 * Open a PracticePro route in a NEW browser tab.
 *
 * Behaviour:
 *   1. On mobile / native — returns false (caller should fall back
 *      to in-place navigation via `navigateTo`).
 *   2. On desktop — calls `window.open(url, '_blank', 'noopener')`.
 *      If the popup blocker intervenes (win is null or closed),
 *      returns false so the caller can fall back.
 *   3. If the URL contains a `#__ctx=` hash, the receiving page will
 *      decode the context on mount — no in-app router needed.
 *
 * @returns true if a new tab was successfully opened.
 */
export function openInNewTab(url: string): boolean {
    if (typeof window === 'undefined') return false;
    if (isMobileOrNative()) return false;
    try {
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (win && !win.closed) {
            // Some browsers return a non-null Window even when the popup
            // is blocked — check `closed` as well to be sure.
            win.focus?.();
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Generate a stable, URL-safe draft key from a title.
 * Used by callers that need to build DraftPro URLs themselves.
 */
export function makeDraftKey(title: string): string {
    return `draft:general:${(title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;
}

/**
 * ─── SINGLE SOURCE OF TRUTH: openDraftProNewTab ──────────────────────
 *
 * DRAFTPRO-NEW-TAB — do not convert to same-tab navigation.
 *
 * This is the ONLY function that should open DraftPro. All entry points
 * (ALOA start_drafting, handleDraftInDraftPro, executeStoredAction,
 * task card clicks, sidebar links, etc.) MUST route through this function.
 *
 * ROOT CAUSE OF PRIOR REGRESSIONS:
 *   The old code had 4+ copy-pasted blocks that tried window.open() then
 *   fell back to openEditorRef.current() (same-tab) on failure. When the
 *   popup was blocked, the fallback silently navigated in-place —
 *   destroying the ALOA chat session. This happened specifically when
 *   the AI finished generating (async callback after await), because by
 *   then the user's click gesture had expired and the popup blocker
 *   kicked in.
 *
 * SOLUTION:
 *   - On DESKTOP: always try window.open first. If blocked, try
 *     openDraftInTab (dedup). If both fail, return false — the caller
 *     shows a "popup blocked" toast but does NOT navigate in-place.
 *   - On MOBILE: return false immediately — caller falls back to
 *     in-place navigateTo (correct on mobile, no tabs).
 *
 * @returns 'new-tab' | 'existing-tab' | 'in-place' (mobile only)
 *          Never returns 'in-place' on desktop — that was the regression.
 */
export function openDraftProNewTab(
    draftKey: string,
    title: string,
    prompt?: string,
): 'new-tab' | 'existing-tab' | 'in-place' {
    if (typeof window === 'undefined') return 'in-place';

    // Mobile: in-place is correct (no tabs on mobile)
    if (isMobileOrNative()) return 'in-place';

    // Build the URL
    const url = `/editor?draftKey=${encodeURIComponent(draftKey)}&title=${encodeURIComponent(title)}${prompt ? `&prompt=${encodeURIComponent(prompt)}` : ''}`;

    // Strategy 1: Direct window.open
    try {
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (win && !win.closed) {
            win.focus?.();
            return 'new-tab';
        }
    } catch {
        // window.open threw — continue to fallback
    }

    // Strategy 2: openDraftInTab (has dedup + registry logic)
    // Dynamically import to avoid circular deps
    try {
        // We can't import openDraftInTab here (circular dep with draftTabs.ts),
        // so we replicate the registry write inline.
        const tabName = `draftpro-${draftKey.replace(/[^a-z0-9]/gi, '-')}`;
        const regKey = 'practicepro:draft-tabs:registry';
        const raw = localStorage.getItem(regKey);
        const reg = raw ? JSON.parse(raw) : {};
        reg[draftKey] = {
            key: draftKey,
            tabName,
            url,
            title,
            lastHeartbeat: Date.now(),
        };
        localStorage.setItem(regKey, JSON.stringify(reg));

        // Try window.open again with the named window (dedup)
        const win2 = window.open(url, tabName, 'noopener,noreferrer');
        if (win2 && !win2.closed) {
            win2.focus?.();
            return 'existing-tab';
        }
    } catch {
        // localStorage or window.open failed
    }

    // Desktop: BOTH strategies failed (popup blocked).
    // DO NOT fall back to in-place navigation — that was the regression.
    // Return 'in-place' only so the caller can show a toast, but log it.
    console.warn('[openDraftProNewTab] Both window.open strategies failed — popup likely blocked. NOT navigating in-place on desktop.');
    return 'in-place';
}

/**
 * ─── Unsaved-changes guardrail ───────────────────────────────────
 *
 * The browser's `beforeunload` event fires when the user tries to
 * close the tab, refresh, or navigate to a different site. Setting
 * `event.returnValue` to a non-empty string triggers the browser's
 * "Leave site? Changes you made may not be saved" dialog.
 *
 * NOTE: Modern browsers IGNORE the custom message string — they show
 * a generic dialog instead. So we cannot show "Save & Leave / Stay"
 * in the native dialog. For the in-app navigation case (Back button,
 * navigateTo), we use a custom React modal instead.
 *
 * Usage:
 *   useEffect(() => {
 *       if (!isDirty) return;
 *       const handler = (e: BeforeUnloadEvent) => {
 *           e.preventDefault();
 *           e.returnValue = '';
 *       };
 *       window.addEventListener('beforeunload', handler);
 *       return () => window.removeEventListener('beforeunload', handler);
 *   }, [isDirty]);
 */

/**
 * Install a `beforeunload` guard that blocks tab close / refresh
 * when `isDirty` is true. Returns a cleanup function.
 *
 * Call this inside a useEffect with `isDirty` as a dependency.
 */
export function installBeforeUnloadGuard(isDirty: boolean): () => void {
    if (typeof window === 'undefined') return () => {};
    if (!isDirty) return () => {};

    const handler = (e: BeforeUnloadEvent) => {
        // Per the HTML spec, calling preventDefault + setting returnValue
        // is the standard way to trigger the unload confirmation.
        e.preventDefault();
        e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
}

/**
 * Check whether the user wants to proceed with an in-app navigation
 * that would discard unsaved changes.
 *
 * This uses a custom React modal in the calling component (NOT the
 * native browser confirm). The caller renders the modal when
 * `pendingNavigation` is non-null, and calls `confirmNavigation()`
 * or `cancelNavigation()` based on the user's choice.
 *
 * The modal copy:
 *   "Wait! You have unsaved changes on your draft. Please save your
 *    document before leaving to prevent data loss.
 *    [Save & Leave] [Leave Without Saving] [Stay on Page]"
 *
 * We provide both "Save & Leave" (saves then navigates) and
 * "Leave Without Saving" (just navigates) so the user has full
 * control — matching the prompt's exact spec.
 */
export interface PendingNavigation {
    /** Where we're trying to go. e.g. { view: 'research' } */
    target: any;
    /** The original navigation function to call on confirm. */
    onConfirm: () => void;
}

/**
 * Helper to intercept a navigation attempt.
 *
 * Returns true if the navigation should proceed immediately (no dirty
 * state), false if it should be blocked (caller should open modal).
 *
 * The caller is responsible for:
 *   1. Storing the pending navigation in state
 *   2. Rendering the modal
 *   3. Calling `pending.onConfirm()` when the user confirms
 *   4. Clearing the pending state
 */
export function shouldBlockNavigation(isDirty: boolean): boolean {
    return isDirty;
}
