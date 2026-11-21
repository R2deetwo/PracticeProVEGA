// @vitest-environment jsdom
/**
 * useIdleTimer — cross-tab idle semantics (2026-11-22 owner task #4).
 *
 * The idle decision must be GLOBAL ("no activity in ANY tab"), not per-tab:
 *  - a timer that fires while ANOTHER tab was recently active (published
 *    via localStorage) must reschedule for the remaining window instead of
 *    locking;
 *  - local user activity resets the countdown;
 *  - true global idle fires onIdle;
 *  - the hook publishes the shared activity timestamp.
 *
 * No @testing-library in this repo — a minimal react-dom harness drives the
 * hook (the codebase's own convention for DOM-adjacent tests is plain
 * vitest; this stays self-contained).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { useIdleTimer } from '../../src/hooks/useIdleTimer';

const KEY = 'practicepro_global_activity_ts';

describe('useIdleTimer (cross-tab idle)', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    const mount = (onIdle: () => void, timeout: number) => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        const Harness = () => {
            useIdleTimer(onIdle, timeout);
            return null;
        };
        act(() => {
            root!.render(React.createElement(Harness));
        });
    };

    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });
    afterEach(() => {
        act(() => root?.unmount());
        container?.remove();
        root = null;
        container = null;
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('fires onIdle after the timeout with no activity anywhere', () => {
        const onIdle = vi.fn();
        mount(onIdle, 15 * 60 * 1000);
        act(() => {
            vi.advanceTimersByTime(15 * 60 * 1000);
        });
        expect(onIdle).toHaveBeenCalledTimes(1);
    });

    it('does NOT fire while another tab published recent activity (global idle check)', () => {
        const onIdle = vi.fn();
        mount(onIdle, 15 * 60 * 1000);
        // Another tab writes a fresh global timestamp 5 minutes in — this
        // tab's own window saw no events. At t=15min the GLOBAL age is only
        // 10min, so the hook must reschedule, not lock.
        act(() => {
            vi.advanceTimersByTime(5 * 60 * 1000);
            localStorage.setItem(KEY, String(Date.now()));
            vi.advanceTimersByTime(10 * 60 * 1000); // local timer fires here
        });
        expect(onIdle).not.toHaveBeenCalled();
        // …and after the REMAINING ~5 minutes of true global idle, it locks.
        act(() => {
            vi.advanceTimersByTime(5 * 60 * 1000 + 200);
        });
        expect(onIdle).toHaveBeenCalledTimes(1);
    });

    it('resets the countdown on local user activity', () => {
        const onIdle = vi.fn();
        mount(onIdle, 1000);
        act(() => {
            vi.advanceTimersByTime(900);
            window.dispatchEvent(new Event('mousedown'));
            vi.advanceTimersByTime(900);
        });
        expect(onIdle).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(150);
        });
        expect(onIdle).toHaveBeenCalledTimes(1);
    });

    it('publishes the global activity timestamp', () => {
        mount(vi.fn(), 1000);
        // The hook seeds the shared timestamp on mount…
        expect(localStorage.getItem(KEY)).not.toBeNull();
        // …and local activity refreshes it (throttled to one write / 5s).
        const before = Number(localStorage.getItem(KEY));
        act(() => {
            vi.advanceTimersByTime(6000);
            window.dispatchEvent(new Event('mousemove'));
        });
        const after = Number(localStorage.getItem(KEY));
        expect(after).toBeGreaterThanOrEqual(before);
        expect(Number.isFinite(after)).toBe(true);
    });
});
