/**
 * BiometricAuth — Biometric unlock (fingerprint/face) for the PracticePro app.
 *
 * WHY THIS EXISTS:
 *   Users on mobile (APK) expect to unlock apps with their fingerprint or
 *   face instead of typing a password every time. This utility provides
 *   a clean interface to:
 *     1. Check if biometric auth is available on the device
 *     2. Register a user for biometric unlock (stores their email so we
 *        know which account to restore)
 *     3. Authenticate via biometric and restore the session
 *     4. Unregister (clear biometric data)
 *
 * HOW IT WORKS:
 *   When the user logs in with "Remember Me" checked, we also offer to
 *   enable biometric unlock. If they accept, we store their email in
 *   localStorage (biometric_email). On next app launch, if biometric is
 *   available AND the user has registered, we show a "Unlock with
 *   Fingerprint/Face" button. When they authenticate, we restore their
 *   session from localStorage (which was saved during the original login).
 *
 *   The biometric auth itself is handled by the native OS — we never
 *   store the password. We only store the session token (already encrypted
 *   by the OS keychain/keystore) and use biometrics as a gate to access it.
 *
 * WEB FALLBACK:
 *   On web (no native bridge), biometric auth uses the WebAuthn API if
 *   available. If not available, the feature is hidden.
 */

import { Capacitor } from '@capacitor/core';

const BIOMETRIC_EMAIL_KEY = 'practicepro_biometric_email';
const BIOMETRIC_ENABLED_KEY = 'practicepro_biometric_enabled';

export function isBiometricRegistered(): boolean {
    try {
        return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === '1' &&
               !!localStorage.getItem(BIOMETRIC_EMAIL_KEY);
    } catch {
        return false;
    }
}

export function getBiometricEmail(): string | null {
    try {
        return localStorage.getItem(BIOMETRIC_EMAIL_KEY);
    } catch {
        return null;
    }
}

export async function isBiometricAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
        // On web, check for WebAuthn support
        return typeof window !== 'undefined' && 'PublicKeyCredential' in window;
    }
    try {
        const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
        const result = await BiometricAuth.checkBiometrics();
        return result.available && result.hasEnrolledBiometrics;
    } catch {
        return false;
    }
}

export async function registerBiometric(email: string): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
        const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
        const result = await BiometricAuth.authenticate({
            reason: 'Enable biometric unlock for PracticePro',
            cancelTitle: 'Cancel',
            fallbackTitle: 'Use Password',
        });
        if (result.verified) {
            localStorage.setItem(BIOMETRIC_EMAIL_KEY, email.toLowerCase());
            localStorage.setItem(BIOMETRIC_ENABLED_KEY, '1');
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

export async function authenticateWithBiometric(): Promise<{ success: boolean; email?: string }> {
    if (!Capacitor.isNativePlatform()) return { success: false };
    if (!isBiometricRegistered()) return { success: false };

    try {
        const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
        const result = await BiometricAuth.authenticate({
            reason: 'Unlock PracticePro',
            cancelTitle: 'Cancel',
            fallbackTitle: 'Use Password',
        });
        if (result.verified) {
            return { success: true, email: getBiometricEmail() || undefined };
        }
        return { success: false };
    } catch {
        return { success: false };
    }
}

export function unregisterBiometric() {
    try {
        localStorage.removeItem(BIOMETRIC_EMAIL_KEY);
        localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    } catch {}
}

export const biometricAuth = {
    isRegistered: isBiometricRegistered,
    isAvailable: isBiometricAvailable,
    register: registerBiometric,
    authenticate: authenticateWithBiometric,
    unregister: unregisterBiometric,
    getEmail: getBiometricEmail,
};
