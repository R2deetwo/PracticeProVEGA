/**
 * clipboard — one reliable copy-to-clipboard path for every surface.
 *
 * CONTEXT (owner bug report 2026-11-24): the sidebar Invite Colleague
 * card's COPY button "fails to copy anything". Root cause: the only path
 * was `navigator.clipboard.writeText`, which is unavailable or rejects
 * in several real environments the product actually runs in:
 *   - the Android APK WebView (no permission grant / restricted origin),
 *   - any non-secure context (http://, capacitor:// schemes),
 *   - browsers where the Clipboard API exists but the permission prompt
 *     is declined or the document isn't focused.
 *
 * This util tries the async Clipboard API first (when present and the
 * context is secure) and falls back to the hidden-textarea +
 * `document.execCommand('copy')` dance, which still works in WebViews
 * and older mobile browsers. Empty/whitespace values are refused up
 * front — callers surface the failure instead of silently copying
 * garbage.
 *
 * Pure DOM helper — safe for tests (jsdom) and SSR (guards `window`).
 */

/** Copy `value` to the system clipboard. Resolves true on success. */
export async function copyToClipboard(value: string | null | undefined): Promise<boolean> {
    const text = String(value ?? '');
    if (!text.trim()) return false;

    // Fast path: the async Clipboard API — secure contexts only.
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof window !== 'undefined') {
            const secure = window.isSecureContext !== false;
            if (secure) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        }
    } catch {
        // Fall through to the execCommand path — never fail silently.
    }

    // Fallback: hidden textarea + execCommand('copy') — works in the
    // Android WebView and older mobile browsers where the Clipboard API
    // is restricted. The textarea must be in the DOM and focused for the
    // command to see the selection.
    try {
        if (typeof document === 'undefined') return false;
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        // Out of the layout + screen readers' way; `position:fixed` (not
        // display:none) keeps it focusable/selectable in WebViews.
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.width = '1px';
        ta.style.height = '1px';
        ta.style.opacity = '0';
        ta.style.border = 'none';
        ta.style.padding = '0';
        document.body.appendChild(ta);
        const previouslyFocused = document.activeElement as HTMLElement | null;
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, text.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
            try { previouslyFocused.focus(); } catch { /* best effort */ }
        }
        return ok;
    } catch {
        return false;
    }
}
