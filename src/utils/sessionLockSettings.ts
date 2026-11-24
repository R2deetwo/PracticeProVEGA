/**
 * sessionLockSettings — configurable staff session auto-lock (owner brief
 * 2026-11-24: "Replace any rigid/hardcoded lock rule with user-configurable
 * session lock settings").
 *
 * Before this module the idle timeout was the hardcoded IDLE_TIMEOUT_DEFAULT
 * (15 min) in App.tsx — every staff session locked on that one number with
 * no way to opt out. The policy now lives in localStorage so it survives
 * reloads and applies per device (the timeout you want on a phone and on a
 * shared chambers desktop legitimately differ):
 *
 *   { enabled: boolean, timeoutMinutes: 1 | 5 | 15 | 30 | 60 | 'never' }
 *
 * 'never' (or enabled:false) disables auto-lock entirely — the user stays
 * in control of manual lock. Default remains 15 minutes so behaviour is
 * unchanged for existing users until they visit Settings → Security.
 *
 * Storage failures (private mode, node test env) fall back to the default
 * policy rather than throwing — a broken localStorage must never become a
 * lock-out or a crash.
 */
import { useEffect, useState } from 'react';

export type SessionLockTimeout = 1 | 5 | 15 | 30 | 60 | 'never';

export interface SessionLockSettings {
    /** Master switch: false = no auto-lock at all (equivalent to Never). */
    enabled: boolean;
    /** Minutes of inactivity before the session locks. 'never' = no timeout. */
    timeoutMinutes: SessionLockTimeout;
}

export const SESSION_LOCK_TIMEOUT_OPTIONS: SessionLockTimeout[] = [1, 5, 15, 30, 60, 'never'];

export const SESSION_LOCK_SETTINGS_KEY = 'practicepro_session_lock_settings_v1';

export const DEFAULT_SESSION_LOCK_SETTINGS: SessionLockSettings = {
    enabled: true,
    timeoutMinutes: 15,
};

/** Parse-then-validate: anything malformed or partial falls back to the
 *  default instead of poisoning the lock policy. */
export function parseSessionLockSettings(raw: string | null): SessionLockSettings {
    if (!raw) return DEFAULT_SESSION_LOCK_SETTINGS;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            const enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_SESSION_LOCK_SETTINGS.enabled;
            const t = parsed.timeoutMinutes;
            const timeoutMinutes: SessionLockTimeout =
                SESSION_LOCK_TIMEOUT_OPTIONS.includes(t) ? t : DEFAULT_SESSION_LOCK_SETTINGS.timeoutMinutes;
            return { enabled, timeoutMinutes };
        }
    } catch { /* malformed JSON — default */ }
    return DEFAULT_SESSION_LOCK_SETTINGS;
}

export function loadSessionLockSettings(): SessionLockSettings {
    try {
        return parseSessionLockSettings(localStorage.getItem(SESSION_LOCK_SETTINGS_KEY));
    } catch {
        return DEFAULT_SESSION_LOCK_SETTINGS;
    }
}

export function saveSessionLockSettings(settings: SessionLockSettings): void {
    try {
        localStorage.setItem(SESSION_LOCK_SETTINGS_KEY, JSON.stringify(settings));
        // Same-tab re-render is driven by the React hook below; the storage
        // event nudges OTHER tabs so a lock-policy change applies everywhere.
    } catch { /* storage unavailable — settings stay for this session only */ }
}

/** The effective idle timeout in ms, or null when auto-lock is off. */
export function resolveIdleTimeoutMs(settings: SessionLockSettings): number | null {
    if (!settings.enabled || settings.timeoutMinutes === 'never') return null;
    return settings.timeoutMinutes * 60 * 1000;
}

/** subscribeSessionLockSettings(cb) → unsubscribe. Fires on any change to
 *  the settings key in ANY tab (storage event) or this one (direct call). */
export function subscribeSessionLockSettings(cb: (settings: SessionLockSettings) => void): () => void {
    const onStorage = (e: StorageEvent) => {
        if (e.key === SESSION_LOCK_SETTINGS_KEY) cb(loadSessionLockSettings());
    };
    try {
        window.addEventListener('storage', onStorage);
    } catch { /* no window (tests) */ }
    return () => {
        try {
            window.removeEventListener('storage', onStorage);
        } catch { /* ignore */ }
    };
}

/** React binding: live settings + updater that persists and re-renders. */
export function useSessionLockSettings(): [SessionLockSettings, (next: SessionLockSettings) => void] {
    const [settings, setSettings] = useState<SessionLockSettings>(() => loadSessionLockSettings());

    useEffect(() => {
        const unsubscribe = subscribeSessionLockSettings((next) => setSettings(next));
        return unsubscribe;
    }, []);

    const update = (next: SessionLockSettings) => {
        saveSessionLockSettings(next);
        setSettings(next);
    };

    return [settings, update];
}
