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
 *
 * FIX 2: Size-guards the encoded payload. If > 1500 chars of base64,
 * falls back to sessionStorage (keyed by a short UUID) and encodes
 * only `#__ctxRef=<id>` in the URL. This handles large citation arrays
 * that would exceed browser URL limits or btoa's string limit.
 *
 * Also adds an `id` field (UUID) to every context payload for
 * idempotency checks on the receiving side (Fix 1).
 */
const MAX_HASH_CTX_SIZE = 1500; // conservative URL hash limit

export function buildRouteUrlWithHashContext(route: string, context?: Record<string, any>): string {
    const base = route === 'editor' ? '/editor' : `/${route}`;
    if (!context || Object.keys(context).length === 0) return base;

    // Add an id field for idempotency (Fix 1)
    const ctxWithId = { ...context, id: context.id || generateContextId() };

    try {
        const json = JSON.stringify(ctxWithId);
        const bytes = new TextEncoder().encode(json);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        // FIX 2: Size guard — if too large for URL hash, use sessionStorage
        if (b64.length > MAX_HASH_CTX_SIZE) {
            const refId = generateContextId();
            try {
                sessionStorage.setItem(`__ctxRef_${refId}`, json);
                return `${base}#__ctxRef=${refId}`;
            } catch (storageErr) {
                console.error('[buildRouteUrlWithHashContext] sessionStorage write failed:', storageErr);
                // Last resort: truncate sources array to fit
                const truncated = { ...ctxWithId, sources: (ctxWithId.sources || []).slice(0, 3), _truncated: true };
                const truncJson = JSON.stringify(truncated);
                const truncBytes = new TextEncoder().encode(truncJson);
                let truncBin = '';
                for (let i = 0; i < truncBytes.length; i++) truncBin += String.fromCharCode(truncBytes[i]);
                const truncB64 = btoa(truncBin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                return `${base}#__ctx=${truncB64}`;
            }
        }

        return `${base}#__ctx=${b64}`;
    } catch (err) {
        console.error('[buildRouteUrlWithHashContext] Encoding failed:', err, 'Context keys:', Object.keys(context));
        return base;
    }
}

/**
 * Discriminated result type for readHashContext (Fix 3).
 * Callers can distinguish "nothing sent" from "sent but corrupted."
 */
export type ContextResult =
    | { status: 'absent' }
    | { status: 'error'; reason: string }
    | { status: 'ok'; context: Record<string, any> };

/**
 * Decode the `#__ctx=` or `#__ctxRef=` hash fragment back into context.
 *
 * FIX 3: Returns a discriminated ContextResult instead of null.
 * FIX 2: Also handles `#__ctxRef=<id>` by looking up sessionStorage.
 */
export function readHashContext(): ContextResult {
    if (typeof window === 'undefined') return { status: 'absent' };
    try {
        const hash = window.location.hash || '';

        // Check for ctxRef (large payload stored in sessionStorage — Fix 2)
        const refMatch = hash.match(/__ctxRef=([A-Za-z0-9_-]+)/);
        if (refMatch) {
            const refId = refMatch[1];
            const stored = sessionStorage.getItem(`__ctxRef_${refId}`);
            if (stored) {
                try {
                    return { status: 'ok', context: JSON.parse(stored) };
                } catch (parseErr) {
                    return { status: 'error', reason: `Failed to parse ctxRef payload: ${parseErr}` };
                }
            }
            return { status: 'error', reason: `ctxRef ${refId} not found in sessionStorage` };
        }

        // Check for inline ctx (small payload in URL hash)
        const m = hash.match(/__ctx=([A-Za-z0-9_-]+)/);
        if (!m) return { status: 'absent' };
        const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const bin = atob(padded);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const json = new TextDecoder().decode(bytes);
        return { status: 'ok', context: JSON.parse(json) };
    } catch (err: any) {
        return { status: 'error', reason: err?.message || 'Unknown decode error' };
    }
}

/**
 * Backward-compatible wrapper: returns Record<string,any> | null.
 * New code should use readHashContext() directly and handle the discriminated result.
 * This exists so existing call sites don't break during migration.
 */
export function readHashContextLegacy(): Record<string, any> | null {
    const result = readHashContext();
    if (result.status === 'ok') return result.context;
    if (result.status === 'error') {
        console.warn('[readHashContextLegacy] Context decode error:', result.reason);
    }
    return null;
}

/** Generate a short unique ID for context payloads */
function generateContextId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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
        // 2026-09-23 ALOA audit fix: 'noopener,noreferrer' in the features
        // string makes window.open return null BY SPEC — the success check
        // below never passed and every caller fell back to in-app navigation
        // even though the tab HAD opened (double navigation). Open normally,
        // then sever the opener manually — same security, working check.
        const win = window.open(url, '_blank');
        if (win) {
            try { (win as any).opener = null; } catch { /* cross-origin fine */ }
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
 * @returns 'new-tab' | 'existing-tab' | 'in-place' (mobile only) | 'blocked' (desktop popup blocked)
 */
export function openDraftProNewTab(
    draftKey: string,
    title: string,
    prompt?: string,
    context?: Record<string, any>,  // FIX 5b: pass citations + matterId via hash
): 'new-tab' | 'existing-tab' | 'in-place' | 'blocked' {
    if (typeof window === 'undefined') return 'in-place';

    // Mobile: in-place is correct (no tabs on mobile)
    if (isMobileOrNative()) return 'in-place';

    // Build the URL — base params for scalar values
    // 2026-09-24 (Task 69): packet-aware drafting prompts can run to several
    // thousand characters. Browsers cap practical URL length (~2k for some
    // servers/proxies), and an over-long ?prompt= param breaks the open.
    // Long prompts are intentionally OMITTED from the URL — every caller
    // that matters (ALOA start_drafting, packet drafts) persists the full
    // prompt in the localStorage draft session FIRST, and WordProcessor's
    // carrier chain (urlPrompt || ctx.draftPrompt || stored?.draftPrompt)
    // falls back to the stored session when the URL param is absent.
    const MAX_URL_PROMPT_CHARS = 1200;
    const urlSafePrompt = prompt && prompt.length <= MAX_URL_PROMPT_CHARS ? prompt : undefined;
    let url = `/editor?draftKey=${encodeURIComponent(draftKey)}&title=${encodeURIComponent(title)}${urlSafePrompt ? `&prompt=${encodeURIComponent(urlSafePrompt)}` : ''}`;

    // FIX 5b: If context contains citations or matterId, encode them in the hash
    // so the new tab can read them via readHashContext()
    if (context && (context.citations || context.matterId)) {
        url = buildRouteUrlWithHashContext('editor', context);
        // buildRouteUrlWithHashContext returns /editor#__ctx=... — we need to
        // merge the query params back in (urlSafePrompt — see Task 69 note above)
        const hashPart = url.split('#')[1];
        url = `/editor?draftKey=${encodeURIComponent(draftKey)}&title=${encodeURIComponent(title)}${urlSafePrompt ? `&prompt=${encodeURIComponent(urlSafePrompt)}` : ''}#${hashPart}`;
    }

    // Strategy 1: Direct window.open — with a NAMED window.
    //
    // 2026-09-23 ALOA audit fix: the features string used to include
    // 'noopener,noreferrer' — per spec, window.open() then ALWAYS returns
    // null, so the success check below never passed: the tab DID open, the
    // code believed it failed, strategy 2 opened a SECOND tab, and (before
    // the 'blocked' fix) the main tab was navigated in-place as well — three
    // editors at once. The standard pattern is used instead: open normally,
    // then sever the opener reference manually (same security property,
    // but we keep the Window reference for the success check + focus).
    //
    // 2026-09-23 phantom-document follow-up: the window is now NAMED
    // (`draftpro-<key>`) instead of '_blank'. Two reasons:
    //   1. The receiving tab detects "dedicated DraftPro tab" via
    //      window.name.startsWith('draftpro-') — an unnamed '_blank' tab
    //      has window.name === '' and (opener severed) window.opener ===
    //      null, so DraftProEditor's isInNewTab check used to misfire and
    //      show a dead Back button with no Close button.
    //   2. Naming also dedupes: re-opening the same draft focuses the
    //      existing tab instead of spawning a duplicate.
    const tabName = `draftpro-${draftKey.replace(/[^a-z0-9]/gi, '-').slice(0, 80)}`;
    try {
        const win = window.open(url, tabName);
        if (win) {
            try { (win as any).opener = null; } catch { /* cross-origin fine */ }
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

        // Try window.open again with the named window (dedup).
        // Same noopener-via-opener-severing pattern as strategy 1.
        const win2 = window.open(url, tabName);
        if (win2) {
            try { (win2 as any).opener = null; } catch { /* cross-origin fine */ }
            win2.focus?.();
            return 'existing-tab';
        }
    } catch {
        // localStorage or window.open failed
    }

    // Desktop: BOTH strategies failed (popup blocked).
    //
    // 2026-09-23 ALOA audit fix: we NO LONGER navigate in-place here. The
    // in-place fallback hijacked the ALOA chat tab mid-conversation whenever
    // the browser blocked the popup (which is the common case — this code
    // runs after several awaits, so the user's click gesture has usually
    // expired). AloaChat's start_drafting handler has a dedicated 'blocked'
    // branch that keeps the chat intact and tells the user to allow
    // pop-ups. Returning 'blocked' (as this function's own architecture
    // doc above prescribes) routes the UX there instead of destroying the
    // conversation.
    console.warn('[openDraftProNewTab] Both window.open strategies failed — popup likely blocked. Returning "blocked"; caller must surface an in-chat affordance.');
    return 'blocked';
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
 *
 * IMPORTANT: This handler honors the `__suppressBeforeUnload` flag set by
 * AuthContext.logout(). Without this check, signing out would trigger
 * BOTH:
 *   1. Our custom "Are you sure you want to sign out?" confirm dialog
 *   2. The browser's native "Leave site? Changes you made may not be
 *      saved" dialog (because this listener is still registered via
 *      addEventListener — `window.onbeforeunload = null` does NOT clear
 *      addEventListener handlers).
 * The user would have to confirm twice, which is the bug we're fixing.
 */
export function installBeforeUnloadGuard(isDirty: boolean): () => void {
    if (typeof window === 'undefined') return () => {};
    if (!isDirty) return () => {};

    const handler = (e: BeforeUnloadEvent) => {
        // Honor the suppress flag — set by logout() and other intentional
        // navigation paths. Skip the preventDefault so the browser does
        // NOT show the "Leave site?" dialog.
        if ((window as any).__suppressBeforeUnload) {
            return;
        }
        // Per the HTML spec, calling preventDefault + setting returnValue
        // is the standard way to trigger the unload confirmation.
        e.preventDefault();
        e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);

    // Also register in a global set so logout() can remove ALL active
    // beforeunload listeners at once — not just rely on the suppress flag.
    if (!(window as any).__beforeUnloadHandlers) {
        (window as any).__beforeUnloadHandlers = new Set();
    }
    (window as any).__beforeUnloadHandlers.add(handler);

    return () => {
        window.removeEventListener('beforeunload', handler);
        if ((window as any).__beforeUnloadHandlers) {
            (window as any).__beforeUnloadHandlers.delete(handler);
        }
    };
}

/**
 * Remove ALL active beforeunload listeners that were registered via
 * installBeforeUnloadGuard. Called by logout() to ensure the browser
 * never shows "Leave site?" after the user has already confirmed sign-out.
 */
export function removeAllBeforeUnloadGuards(): void {
    if (typeof window === 'undefined') return;
    const handlers = (window as any).__beforeUnloadHandlers as Set<() => void> | undefined;
    if (handlers) {
        handlers.forEach(h => window.removeEventListener('beforeunload', h as any));
        handlers.clear();
    }
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
