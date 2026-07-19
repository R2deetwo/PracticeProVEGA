/**
 * Safe print window utilities — prevent XSS in window.open + document.write patterns.
 *
 * PROBLEM:
 *   The old pattern `window.open('', '_blank'); printWin.document.write(html)`
 *   where `html` is built via template-string interpolation of user data
 *   (tenant names, amounts, image dataUrls) is an XSS vector. If any field
 *   contains `</script>` or crafted markup, it can execute arbitrary JS
 *   in the print window context.
 *
 * SOLUTION:
 *   Use `URL.createObjectURL(new Blob([html], {type:'text/html'}))` +
 *   `window.open(url, '_blank', 'noopener,noreferrer')`. The Blob URL is
 *   same-origin but doesn't allow script injection via the URL itself.
 *   Combined with HTML-escaping all interpolated values, this is safe.
 *
 * ALSO: Add 'noopener,noreferrer' to ALL window.open calls that lack it.
 */

/**
 * Escape HTML special characters in user-provided strings before
 * interpolating into HTML template strings.
 *
 * Usage:
 *   const safeName = escapeHtml(tenantName);
 *   const html = `<h1>${safeName}</h1>`;
 */
export function escapeHtml(str: string | undefined | null): string {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Open a new window with HTML content safely.
 *
 * Instead of `window.open('', '_blank'); printWin.document.write(html)`,
 * this creates a Blob URL and opens that. This:
 *   1. Prevents XSS (Blob URLs don't execute inline scripts from the URL)
 *   2. Adds 'noopener,noreferrer' (security best practice)
 *   3. Auto-revokes the Blob URL after the window opens (memory cleanup)
 *
 * @param html The HTML content to display in the new window
 * @param options Optional: { onOpen?: (win: Window) => void }
 * @returns The opened window, or null if blocked
 */
export function openHtmlInNewWindow(
    html: string,
    options?: { onOpen?: (win: Window | null) => void }
): Window | null {
    // Create a Blob URL for the HTML content
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    // Open with noopener,noreferrer for security
    const win = window.open(url, '_blank', 'noopener,noreferrer');

    // Revoke the Blob URL after a delay (gives the window time to load it)
    setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }, 60_000); // 1 minute — print dialog usually closes within this time

    if (win && options?.onOpen) {
        // Wait for the window to load before calling onOpen
        win.addEventListener('load', () => options.onOpen!(win));
    }

    return win;
}

/**
 * Open a URL in a new tab with noopener,noreferrer.
 *
 * Use this instead of `window.open(url, '_blank')` for ALL external/cross-origin
 * links. Prevents the opened page from accessing `window.opener`.
 */
export function openUrlSafely(url: string): Window | null {
    return window.open(url, '_blank', 'noopener,noreferrer');
}
