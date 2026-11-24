import { useRef, useCallback, useEffect } from 'react';

/**
 * Shared cross-tab activity timestamp (localStorage). Every tab writes it
 * (throttled) on user activity; every tab's idle timer reads it, so the
 * IDLE decision is "no activity in ANY tab" — not "no activity in the tab
 * that happened to time out". A lawyer reading a matter in tab A keeps
 * tab B alive; a truly abandoned browser locks every tab together.
 */
const GLOBAL_ACTIVITY_KEY = 'practicepro_global_activity_ts';
/** Minimum gap between writes — writing on every mousemove floods storage events. */
const WRITE_THROTTLE_MS = 5000;

export const readGlobalActivity = (): number => {
    try {
        const v = Number(localStorage.getItem(GLOBAL_ACTIVITY_KEY));
        return Number.isFinite(v) && v > 0 ? v : Date.now();
    } catch {
        return Date.now();
    }
};

const writeGlobalActivity = () => {
    try {
        localStorage.setItem(GLOBAL_ACTIVITY_KEY, String(Date.now()));
    } catch { /* storage unavailable — fall back to per-tab timing */ }
};

/** Mark "the user is active" without resetting any particular tab's timer
 *  (the storage event + timestamp handle that). Long-running non-pointer
 *  interactions — a Vox dictation in progress, a document being read aloud
 *  — call this so the session lock doesn't fire mid-speech. */
export const markUserActivity = () => writeGlobalActivity();

/** Configurable session lock (owner brief 2026-11-24): timeoutMs = null
 * means auto-lock is DISABLED (Settings → Security → Never / Off) — the
 * hook installs nothing and fires nothing. */
export const useIdleTimer = (onIdle: () => void, timeoutMs: number | null) => {
    const timeoutId = useRef<number | undefined>(undefined);
    const onIdleRef = useRef(onIdle);
    onIdleRef.current = onIdle;

    const resetTimer = useCallback(() => {
        if (timeoutMs == null) return; // auto-lock disabled — nothing to schedule
        if (timeoutId.current != null) {
            window.clearTimeout(timeoutId.current);
        }
        // 2026-11-22 (session hardening): before firing, re-check the
        // GLOBAL last-activity timestamp — another tab may have been active
        // after this tab's own events stopped. If so, reschedule for the
        // remaining window instead of locking a browser that is in use.
        timeoutId.current = window.setTimeout(() => {
            const idleFor = Date.now() - readGlobalActivity();
            if (idleFor >= timeoutMs) {
                onIdleRef.current();
            } else {
                timeoutId.current = window.setTimeout(() => onIdleRef.current(), Math.max(timeoutMs - idleFor, 1000));
            }
        }, timeoutMs);
    }, [timeoutMs]);

    useEffect(() => {
        if (timeoutMs == null) return; // disabled — no listeners, no timer
        const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
        let lastWrite = 0;

        // Local activity: reset this tab's timer immediately, and (throttled)
        // publish the timestamp so OTHER tabs reset theirs via the storage event.
        const onActivity = () => {
            const now = Date.now();
            if (now - lastWrite >= WRITE_THROTTLE_MS) {
                lastWrite = now;
                writeGlobalActivity();
            }
            resetTimer();
        };

        // Remote activity (another tab wrote the key): reset this tab's timer.
        // The timestamp itself is the truth; the storage event is just the nudge.
        const onStorage = (e: StorageEvent) => {
            if (e.key === GLOBAL_ACTIVITY_KEY) resetTimer();
        };

        events.forEach(event => window.addEventListener(event, onActivity, { passive: true }));
        window.addEventListener('storage', onStorage);
        writeGlobalActivity();
        resetTimer();

        return () => {
            events.forEach(event => window.removeEventListener(event, onActivity));
            window.removeEventListener('storage', onStorage);
            if (timeoutId.current != null) {
                window.clearTimeout(timeoutId.current);
            }
        };
    }, [resetTimer]);

    // Backgrounded apps (Android/Capacitor, hidden browser tabs) must not
    // burn the countdown while invisible — a user who backgrounded the app
    // for 20 minutes to answer a call has NOT abandoned the session. Pause
    // the countdown on hidden, resume it on visible (2026-11-24 configurable
    // session lock brief: "pause/handle cleanly when the app is backgrounded
    // or resumed").
    useEffect(() => {
        if (timeoutMs == null) return;
        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                resetTimer();
            } else if (timeoutId.current != null) {
                window.clearTimeout(timeoutId.current);
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [resetTimer, timeoutMs]);

    return resetTimer;
};
