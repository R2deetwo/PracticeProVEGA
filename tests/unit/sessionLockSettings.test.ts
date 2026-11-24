// @vitest-environment jsdom
/**
 * sessionLockSettings — the configurable auto-lock policy (owner brief
 * 2026-11-24). Locks: default 15 min, parse-then-validate on malformed
 * payloads, resolveIdleTimeoutMs semantics (Never/Off → null), persistence
 * round-trip.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    parseSessionLockSettings,
    loadSessionLockSettings,
    saveSessionLockSettings,
    resolveIdleTimeoutMs,
    SESSION_LOCK_TIMEOUT_OPTIONS,
    DEFAULT_SESSION_LOCK_SETTINGS,
    SESSION_LOCK_SETTINGS_KEY,
} from '../../src/utils/sessionLockSettings';

describe('sessionLockSettings', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('defaults to the historical 15-minute policy', () => {
        expect(DEFAULT_SESSION_LOCK_SETTINGS).toEqual({ enabled: true, timeoutMinutes: 15 });
        expect(parseSessionLockSettings(null)).toEqual(DEFAULT_SESSION_LOCK_SETTINGS);
        expect(parseSessionLockSettings('')).toEqual(DEFAULT_SESSION_LOCK_SETTINGS);
    });

    it('rejects malformed JSON without poisoning the policy', () => {
        expect(parseSessionLockSettings('{{{nope')).toEqual(DEFAULT_SESSION_LOCK_SETTINGS);
    });

    it('rejects partial/invalid payloads field-by-field', () => {
        expect(parseSessionLockSettings(JSON.stringify({ enabled: false }))).toEqual({ enabled: false, timeoutMinutes: 15 });
        // An out-of-list timeout falls back to the default 15.
        expect(parseSessionLockSettings(JSON.stringify({ enabled: true, timeoutMinutes: 45 }))).toEqual({ enabled: true, timeoutMinutes: 15 });
        // Junk types fall back too.
        expect(parseSessionLockSettings(JSON.stringify({ enabled: 'yes', timeoutMinutes: { x: 1 } }))).toEqual(DEFAULT_SESSION_LOCK_SETTINGS);
        // Non-object payloads fall back whole.
        expect(parseSessionLockSettings(JSON.stringify([1, 2, 3]))).toEqual(DEFAULT_SESSION_LOCK_SETTINGS);
    });

    it('accepts every offered timeout including never', () => {
        for (const t of SESSION_LOCK_TIMEOUT_OPTIONS) {
            const s = { enabled: true, timeoutMinutes: t };
            expect(parseSessionLockSettings(JSON.stringify(s))).toEqual(s);
        }
    });

    it('resolveIdleTimeoutMs: minutes → ms; Never/off → null', () => {
        expect(resolveIdleTimeoutMs({ enabled: true, timeoutMinutes: 1 })).toBe(60_000);
        expect(resolveIdleTimeoutMs({ enabled: true, timeoutMinutes: 60 })).toBe(3_600_000);
        expect(resolveIdleTimeoutMs({ enabled: true, timeoutMinutes: 'never' })).toBeNull();
        expect(resolveIdleTimeoutMs({ enabled: false, timeoutMinutes: 15 })).toBeNull();
    });

    it('persists and reloads through localStorage', () => {
        const custom = { enabled: true, timeoutMinutes: 30 as const };
        saveSessionLockSettings(custom);
        expect(localStorage.getItem(SESSION_LOCK_SETTINGS_KEY)).toBe(JSON.stringify(custom));
        expect(loadSessionLockSettings()).toEqual(custom);
    });

    it('a private-mode storage failure degrades to defaults, never throws', () => {
        const boom = () => { throw new Error('QuotaExceeded'); };
        const getter = localStorage.getItem;
        (localStorage as any).getItem = boom;
        (localStorage as any).setItem = boom;
        try {
            expect(loadSessionLockSettings()).toEqual(DEFAULT_SESSION_LOCK_SETTINGS);
            expect(() => saveSessionLockSettings({ enabled: false, timeoutMinutes: 5 })).not.toThrow();
        } finally {
            (localStorage as any).getItem = getter;
        }
    });
});
