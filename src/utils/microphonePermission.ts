/**
 * microphonePermission — handles microphone permission requests across
 * web and native (Capacitor/Android) platforms.
 *
 * PROBLEM:
 *   On Android APK, navigator.mediaDevices.getUserMedia() goes through
 *   the WebView's permission flow, which may not trigger the native
 *   Android permission dialog. Even if RECORD_AUDIO is declared in
 *   AndroidManifest.xml, the user may see "permission denied" without
 *   ever being asked.
 *
 * SOLUTION:
 *   On native (Capacitor), we check if we can access the microphone via
 *   getUserMedia. If it fails with NotAllowedError, we show a native-app-
 *   themed error message guiding the user to Settings → Apps → PracticePro
 *   → Permissions → Microphone.
 *
 *   On web, getUserMedia triggers the browser permission prompt directly.
 */

import { Capacitor } from '@capacitor/core';
import { acquireMicStream, releaseMicStream } from '../services/voice/micStream';

export type MicPermissionResult = 'granted' | 'denied' | 'prompt' | 'unavailable';

/**
 * Request microphone permission by acquiring the SHARED mic stream
 * (micStream.ts). On native (APK), this triggers the WebView permission
 * flow which in turn requests the Android RECORD_AUDIO permission.
 * On web, this triggers the browser's permission prompt.
 *
 * The stream is returned to the manager's warm pool on success (not
 * stopped) — the caller's subsequent engine start reuses it instantly
 * instead of racing a second getUserMedia against the first one's
 * release, which is what produced "microphone is in use by another app"
 * right after the user tapped Allow (Android WebView, 2026-11-18).
 *
 * Returns true if permission was granted, false otherwise.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
    try {
        await acquireMicStream();
        releaseMicStream(); // drop the claim; the stream stays warm briefly
        return true;
    } catch (err: any) {
        // If denied, return false — the caller will show an appropriate error
        return false;
    }
}

/**
 * Check if microphone permission is already granted (without triggering a prompt).
 * Uses the Web Permissions API if available.
 */
export async function checkMicrophonePermission(): Promise<MicPermissionResult> {
    if (typeof navigator !== 'undefined' && navigator.permissions) {
        try {
            const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            if (result.state === 'granted') return 'granted';
            if (result.state === 'denied') return 'denied';
            return 'prompt';
        } catch {
            // Permissions API not supported — fall through to 'prompt'
        }
    }
    return 'prompt';
}

/**
 * Get a user-friendly error message for a microphone access failure.
 * Returns app-native messaging (not browser-themed) for the APK.
 */
export function getMicrophoneErrorMessage(err: any): string {
    const isNative = Capacitor.isNativePlatform();

    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        return isNative
            ? "Microphone access denied. Open Settings → Apps → PracticePro → Permissions → Microphone → Allow."
            : "Microphone access denied. Enable it in your browser settings and try again.";
    }
    if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        return "No microphone found. Please connect a microphone and try again.";
    }
    if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        return "The microphone did not open. If you just granted permission, fully close and reopen the app once (Android occasionally locks the mic right after the permission prompt), then try again. Also check there is no active call or voice recorder.";
    }
    if (err?.name === 'OverconstrainedError') {
        return "Microphone doesn't meet the required constraints. Try a different device.";
    }
    if (err?.name === 'SecurityError') {
        return isNative
            ? "Microphone access blocked. Please grant permission in Settings → Apps → PracticePro → Permissions."
            : "Microphone access blocked for security. Ensure you're on HTTPS and the site has permission.";
    }
    return "Could not access microphone: " + (err?.message || "Unknown error");
}
