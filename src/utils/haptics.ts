/**
 * HapticFeedback — centralized haptic feedback for the PracticePro app.
 *
 * WHY THIS EXISTS:
 *   Haptic feedback (the tiny vibration you feel when you tap a button on
 *   a phone) is one of those small polish details that makes an app feel
 *   native and premium instead of like a website. The user noticed it was
 *   missing — buttons felt "dead" on mobile.
 *
 * HOW IT WORKS:
 *   Uses @capacitor/haptics which calls the native Android/iOS haptic
 *   engine. On web (no native bridge), it's a no-op — silently does
 *   nothing so the same code works everywhere.
 *
 * WHEN TO USE:
 *   - light()    → tab changes, list item taps, toggle switches
 *   - medium()   → button presses that trigger an action
 *   - heavy()    → destructive actions (delete confirm)
 *   - success()  → after a successful form submit, payment, etc.
 *   - warning()  → validation errors, "are you sure?" moments
 *   - error()    → failed operations, network errors
 *
 * USAGE:
 *   import { haptics } from '../utils/haptics';
 *   haptics.light();    // on tab change
 *   haptics.success();  // after invoice paid
 *
 * USER PREFERENCE:
 *   Respects a 'practicepro_haptics_enabled' localStorage flag (default
 *   true). Users who hate haptics can turn them off in settings.
 */

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const HAPTICS_KEY = 'practicepro_haptics_enabled';

function isHapticsEnabled(): boolean {
    try {
        const v = localStorage.getItem(HAPTICS_KEY);
        // Default to enabled on native platforms, disabled on web
        if (v === null) return Capacitor.isNativePlatform();
        return v === '1';
    } catch {
        return Capacitor.isNativePlatform();
    }
}

export function setHapticsEnabled(enabled: boolean) {
    try { localStorage.setItem(HAPTICS_KEY, enabled ? '1' : '0'); } catch {}
}

async function impact(style: ImpactStyle) {
    if (!isHapticsEnabled()) return;
    if (!Capacitor.isNativePlatform()) return; // no-op on web
    try {
        await Haptics.impact({ style });
    } catch {
        // Silently fail — haptics are a nice-to-have, never break the app
    }
}

async function notification(type: NotificationType) {
    if (!isHapticsEnabled()) return;
    if (!Capacitor.isNativePlatform()) return;
    try {
        await Haptics.notification({ type });
    } catch {}
}

export const haptics = {
    /** Light tap — tab changes, list item selection, toggles */
    light: () => impact(ImpactStyle.Light),

    /** Medium tap — button presses, action confirmations */
    medium: () => impact(ImpactStyle.Medium),

    /** Heavy thud — destructive actions, long-press */
    heavy: () => impact(ImpactStyle.Heavy),

    /** Success pattern (two quick rising taps) — form submitted, payment sent */
    success: () => notification(NotificationType.Success),

    /** Warning pattern — validation error, "are you sure?" */
    warning: () => notification(NotificationType.Warning),

    /** Error pattern (single strong buzz) — failed operation */
    error: () => notification(NotificationType.Error),

    /** Check if haptics are currently enabled (respects user preference) */
    isEnabled: () => isHapticsEnabled(),

    /** Toggle haptics on/off (persists to localStorage) */
    setEnabled: setHapticsEnabled,
};

export default haptics;
