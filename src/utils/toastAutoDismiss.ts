/**
 * ToastAutoDismiss — auto-dismiss timer with hover-hold semantics.
 *
 * USER SPEC (Round 15, verbatim behavior):
 *   "the time it stays on is fine but it would be better if the user can
 *    put the mouse cursor on it to keep it there and when they remove the
 *    mouse and the normal time has already expired, [it should] remove
 *    gracefully"
 *
 * Semantics implemented:
 * - The countdown is NOT paused by hover — the expiry moment is fixed at
 *   start() + duration, so the on-screen time is unchanged when the user
 *   does not hover (user: "the time it stays on is fine").
 * - If the cursor is over the toast when the timer fires, dismissal is
 *   SUPPRESSED and the toast is held for as long as the cursor stays.
 * - The first mouse-leave AFTER expiry removes the toast gracefully.
 * - mouse-leave BEFORE expiry does nothing (the pending timer continues
 *   to own the dismissal).
 * - dismiss() (the [X] button / link click) fires exactly once and cancels
 *   the pending timer so the toast can never be double-removed.
 * - destroy() cancels the timer without firing (component unmount).
 *
 * Timers are injectable so the state machine is unit-testable without
 * real clocks (tests/unit/toastAutoDismiss.test.ts).
 */
export class ToastAutoDismiss {
  private expired = false;
  private hovered = false;
  private dismissed = false;
  private started = false;
  private timerId: unknown | null = null;

  constructor(
    private readonly durationMs: number,
    private readonly onDismiss: () => void,
    private readonly setTimer: (cb: () => void, ms: number) => unknown = (cb, ms) => setTimeout(cb, ms),
    private readonly clearTimer: (id: unknown) => void = (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  ) {}

  /** Begin the countdown. Idempotent — calling it twice changes nothing. */
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.durationMs > 0) {
      this.timerId = this.setTimer(() => this.handleExpiry(), this.durationMs);
    } else {
      // Zero/negative duration: expire immediately (still hover-holdable in
      // the same tick — degenerate but consistent).
      this.handleExpiry();
    }
  }

  private handleExpiry(): void {
    this.timerId = null;
    this.expired = true;
    if (!this.hovered) {
      this.fire();
    }
  }

  /** Cursor entered the toast — holds it past expiry. */
  mouseEnter(): void {
    this.hovered = true;
  }

  /**
   * Cursor left the toast. If the normal time already expired while it was
   * held, remove gracefully now; otherwise the pending timer keeps owning
   * the dismissal.
   */
  mouseLeave(): void {
    this.hovered = false;
    if (this.expired) {
      this.fire();
    }
  }

  /** Manual dismissal ([X] / link click). Fires onDismiss exactly once. */
  dismiss(): void {
    this.fire();
  }

  /** Cancel without firing (unmount). Safe to call multiple times. */
  destroy(): void {
    this.cancelTimer();
  }

  private fire(): void {
    if (this.dismissed) return;
    this.dismissed = true;
    this.cancelTimer();
    this.onDismiss();
  }

  private cancelTimer(): void {
    if (this.timerId !== null) {
      this.clearTimer(this.timerId);
      this.timerId = null;
    }
  }

  /** Introspection for tests/debug logging. */
  get state(): { started: boolean; expired: boolean; hovered: boolean; dismissed: boolean } {
    return {
      started: this.started,
      expired: this.expired,
      hovered: this.hovered,
      dismissed: this.dismissed,
    };
  }
}
