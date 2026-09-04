/**
 * ToastAutoDismiss — unit tests for the Round 15 hover-hold semantics.
 *
 * USER SPEC: "the time it stays on is fine but it would be better if the
 * user can put the mouse cursor on it to keep it there and when they
 * remove the mouse and the normal time has already expired, [it should]
 * remove gracefully."
 *
 * All timing is injected (fake timers as a controllable queue) — no real
 * clocks, deterministic ordering.
 */
import { describe, it, expect } from 'vitest';
import { ToastAutoDismiss } from '../../src/utils/toastAutoDismiss';

/** Minimal deterministic scheduler: enqueue callbacks, fire them manually. */
function makeFakeClock() {
  let seq = 0;
  const queue: Array<{ id: number; fire: () => void; cancelled: boolean }> = [];
  return {
    set: (cb: () => void, _ms: number) => {
      const entry = { id: ++seq, fire: cb, cancelled: false };
      queue.push(entry);
      return entry.id;
    },
    clear: (id: unknown) => {
      const entry = queue.find(e => e.id === id);
      if (entry) entry.cancelled = true;
    },
    /** Advance: fire the oldest live timer (FIFO = time order). */
    tick: () => {
      while (queue.length > 0) {
        const entry = queue.shift()!;
        if (!entry.cancelled) {
          entry.fire();
          return true;
        }
      }
      return false;
    },
    pending: () => queue.filter(e => !e.cancelled).length,
  };
}

function setup(duration = 3500) {
  const clock = makeFakeClock();
  const dismissed: number[] = [];
  const c = new ToastAutoDismiss(
    duration,
    () => dismissed.push(1),
    clock.set,
    clock.clear,
  );
  return { c, clock, dismissed };
}

describe('ToastAutoDismiss — normal (no hover) behavior unchanged', () => {
  it('dismisses exactly once after the duration elapses', () => {
    const { c, clock, dismissed } = setup();
    c.start();
    expect(dismissed).toHaveLength(0);
    clock.tick();
    expect(dismissed).toHaveLength(1);
  });

  it('does not dismiss before the timer fires', () => {
    const { c, dismissed } = setup();
    c.start();
    c.mouseEnter();
    c.mouseLeave(); // leave before expiry — must not dismiss
    expect(dismissed).toHaveLength(0);
  });

  it('start() is idempotent — no double timers', () => {
    const { c, clock, dismissed } = setup();
    c.start();
    c.start();
    expect(clock.pending()).toBe(1);
    clock.tick();
    expect(clock.pending()).toBe(0);
    expect(dismissed).toHaveLength(1);
  });

  it('dismiss() ([X] button) fires immediately and cancels the timer', () => {
    const { c, clock, dismissed } = setup();
    c.start();
    c.dismiss();
    expect(dismissed).toHaveLength(1);
    expect(clock.pending()).toBe(0);
    clock.tick(); // would have been the auto-expiry — must NOT double-fire
    expect(dismissed).toHaveLength(1);
  });

  it('dismiss() is once-only', () => {
    const { c, dismissed } = setup();
    c.start();
    c.dismiss();
    c.dismiss();
    expect(dismissed).toHaveLength(1);
  });

  it('destroy() (unmount) cancels without firing', () => {
    const { c, clock, dismissed } = setup();
    c.start();
    c.destroy();
    expect(clock.tick()).toBe(false); // nothing live left to fire
    expect(dismissed).toHaveLength(0);
  });
});

describe('ToastAutoDismiss — hover-hold (user spec)', () => {
  it('hover AT expiry holds the toast; mouse-leave after expiry removes it gracefully', () => {
    const { c, clock, dismissed } = setup();
    c.start();
    c.mouseEnter();      // cursor on the toast
    clock.tick();        // normal time expires while hovered
    expect(dismissed).toHaveLength(0); // held
    expect(c.state.expired).toBe(true);
    c.mouseLeave();      // cursor leaves — time already expired
    expect(dismissed).toHaveLength(1); // graceful removal
  });

  it('toast stays held indefinitely while the cursor remains on it', () => {
    const { c, clock, dismissed } = setup();
    c.start();
    c.mouseEnter();
    clock.tick();
    clock.tick(); // any further (defensive) ticks — still nothing
    expect(dismissed).toHaveLength(0);
  });

  it('mouse-leave BEFORE expiry does not dismiss (pending timer owns it)', () => {
    const { c, clock, dismissed } = setup();
    c.start();
    c.mouseEnter();
    c.mouseLeave(); // leaves with time remaining
    expect(dismissed).toHaveLength(0);
    expect(c.state.expired).toBe(false);
    clock.tick(); // the original timer fires later → normal dismissal
    expect(dismissed).toHaveLength(1);
  });

  it('expiry with NO hover dismisses immediately (normal path)', () => {
    const { c, clock, dismissed } = setup();
    c.start();
    clock.tick();
    expect(dismissed).toHaveLength(1);
  });

  it('multiple enter/leave cycles before expiry behave like never hovering', () => {
    const { c, clock, dismissed } = setup();
    c.start();
    c.mouseEnter();
    c.mouseLeave();
    c.mouseEnter();
    c.mouseLeave();
    clock.tick();
    expect(dismissed).toHaveLength(1);
  });

  it('hover after a held expiry: leave→enter→leave still removes once', () => {
    const { c, clock, dismissed } = setup();
    c.start();
    c.mouseEnter();
    clock.tick();        // expired, held
    c.mouseLeave();      // → dismiss
    c.mouseEnter();      // stray late events must not double-fire
    c.mouseLeave();
    expect(dismissed).toHaveLength(1);
  });

  it('mouseLeave never resurrects a manually-dismissed toast', () => {
    const { c, dismissed } = setup();
    c.start();
    c.mouseEnter();
    c.dismiss();
    c.mouseLeave();
    expect(dismissed).toHaveLength(1);
  });
});

describe('ToastAutoDismiss — degenerate durations', () => {
  it('zero duration expires immediately but is still hover-holdable in the same tick', () => {
    // Defensive: a duration of 0 degenerates to instant expiry. If the
    // cursor is already on the toast, it is held (consistent semantics).
    const { c, dismissed } = setup(0);
    c.mouseEnter();
    c.start();
    expect(c.state.expired).toBe(true);
    expect(dismissed).toHaveLength(0);
    c.mouseLeave();
    expect(dismissed).toHaveLength(1);
  });
});
