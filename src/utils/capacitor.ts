/**
 * Capacitor native platform detection utility.
 *
 * Detects whether the app is running inside a Capacitor native shell
 * (Android APK or iOS app) vs a regular web browser. This is used to:
 *   - Bypass the landing page in the native app (go straight to login)
 *   - Enable native features (haptics, status bar control, etc.)
 *   - Adjust UX patterns (no browser tabs, native back button, etc.)
 */

// Cache the detection result — don't re-run on every render
let cachedIsNative: boolean | null = null;

/**
 * Returns true if the app is running inside a Capacitor native shell.
 * Uses the Capacitor `Capacitor.isNativePlatform()` API if available,
 * with a fallback to user-agent detection.
 */
export function isNativePlatform(): boolean {
    // Return cached result if we've already detected
    if (cachedIsNative !== null) return cachedIsNative;

    try {
        // Try to use the official Capacitor API
        // (available when @capacitor/core is imported)
        if (typeof window !== 'undefined') {
            // Check for Capacitor global object
            const capacitor = (window as any).Capacitor;
            if (capacitor && typeof capacitor.isNativePlatform === 'function') {
                const result = capacitor.isNativePlatform();
                cachedIsNative = result;
                return result;
            }
        }

        // Fallback: check user-agent for Android WebView (not Chrome browser)
        if (typeof navigator !== 'undefined') {
            const ua = navigator.userAgent || '';
            // Android WebView (used by Capacitor) has "wv" in the user agent
            // but NOT "Chrome/" as the primary browser
            const isAndroidWebView = /Android.*; wv\)/.test(ua) || /Android.*Version\/[\d.]+.*Chrome\/[\d.]+.*Mobile Safari\/[\d.]+/.test(ua);
            // Also check for the Capacitor app ID in the user agent (some versions include it)
            const hasCapacitorUA = /Capacitor/.test(ua);
            cachedIsNative = isAndroidWebView || hasCapacitorUA;
            return cachedIsNative as boolean;
        }
    } catch {
        // Silently fail — assume web
    }

    cachedIsNative = false;
    return false;
}

/**
 * Returns the native platform name ('android', 'ios') or 'web'.
 */
export function getPlatform(): 'android' | 'ios' | 'web' {
    try {
        if (typeof window !== 'undefined') {
            const capacitor = (window as any).Capacitor;
            if (capacitor && capacitor.getPlatform) {
                return capacitor.getPlatform();
            }
        }
    } catch {
        // Fall through to UA detection
    }

    if (typeof navigator !== 'undefined') {
        const ua = navigator.userAgent || '';
        if (/Android/i.test(ua)) return 'android';
        if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    }
    return 'web';
}

/**
 * Reset the cached detection (for testing).
 */
export function resetPlatformDetection(): void {
    cachedIsNative = null;
}
