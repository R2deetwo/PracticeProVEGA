/**
 * micStream — the ONE owner of the microphone on this platform.
 *
 * WHY THIS EXISTS (2026-11-18, founder-reported Android bug):
 *   Five separate features each called getUserMedia() directly with their
 *   own stream lifecycle. On the Android WebView this is guaranteed to
 *   break:
 *
 *   1. The permission-grant race: the first-ever getUserMedia shows the
 *      native RECORD_AUDIO dialog; granting it can make that very request
 *      reject with NotReadableError ("mic in use") — and the WebView then
 *      HOLDS the AudioRecord, so every retry from the caller's error path
 *      fails the same way until the app is restarted. The user sees
 *      "microphone is in use by another app" right after tapping Allow.
 *   2. The release race: stopping tracks releases the native AudioRecord
 *      asynchronously; an immediate re-open (stop → record again) collides
 *      with the in-flight release and fails with NotReadableError.
 *   3. Cross-feature collisions: a stream left open by one feature makes
 *      every other feature's open fail.
 *
 * THE CONTRACT:
 *   - ONE shared MediaStream per session. Acquire it through
 *     acquireMicStream(); NEVER call getUserMedia yourself.
 *   - Opening retries automatically (constrained → plain → plain) because
 *     the Android races are transient — only permission errors surface
 *     immediately.
 *   - Concurrent acquires share a single in-flight open (no double-dialog,
 *     no double-tap races).
 *   - releaseMicStream() drops a claim but the stream stays warm for
 *     IDLE_RELEASE_MS (walkie-talkie stop → record-again cycles reuse it
 *     with zero open latency and zero release races).
 *   - The mic is force-released the moment the app is backgrounded or the
 *     page is hidden (privacy: no green mic dot while the user is away,
 *     and other apps may use the mic).
 */

const IDLE_RELEASE_MS = 15_000;

let shared: MediaStream | null = null;
let refCount = 0;
let inFlight: Promise<MediaStream> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function isLive(s: MediaStream | null): boolean {
  return !!s && s.getAudioTracks().some((t) => t.readyState === 'live');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cancelIdleRelease(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/**
 * Open the mic with the retry ladder. Attempt 1 uses the quality
 * constraints (AEC/NS/AGC); attempts 2-3 fall back to plain audio, which
 * survives WebViews whose audio-effects chain fails to build. Only
 * transient open failures (NotReadableError / AbortError / unknown) are
 * retried — permission and "no device" errors must surface at once.
 */
async function openWithRetry(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } },
    { audio: true },
    { audio: true },
  ];
  const delays = [0, 400, 1000];
  let lastErr: unknown;
  for (let i = 0; i < attempts.length; i++) {
    if (delays[i] > 0) await sleep(delays[i]);
    try {
      return await navigator.mediaDevices.getUserMedia(attempts[i]);
    } catch (err) {
      lastErr = err;
      const name = (err as { name?: string })?.name || '';
      if (
        name === 'NotAllowedError' ||
        name === 'SecurityError' ||
        name === 'NotFoundError' ||
        name === 'OverconstrainedError'
      ) {
        throw err;
      }
      // NotReadableError / AbortError / anything else → transient WebView
      // race; the next attempt (after the backoff) usually succeeds.
    }
  }
  throw lastErr;
}

/**
 * Acquire the shared microphone stream. Safe to call concurrently and
 * repeatedly; the mic is only opened once. Rejects (without side effects
 * on the refcount) if the open ultimately fails.
 */
export async function acquireMicStream(): Promise<MediaStream> {
  if (shared && isLive(shared)) {
    refCount++;
    cancelIdleRelease();
    return shared;
  }
  const pending = (inFlight ??= (async () => {
    try {
      const stream = await openWithRetry();
      // The user may have backgrounded the app while the (slow) first
      // open + permission dialog was in flight — don't resurrect a live
      // mic into a backgrounded app.
      if (typeof document !== 'undefined' && document.hidden) {
        try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
        throw new DOMException(
          'The app moved to the background while opening the microphone.',
          'AbortError'
        );
      }
      shared = stream;
      return stream;
    } finally {
      inFlight = null;
    }
  })());
  const stream = await pending; // throws propagate WITHOUT touching refCount
  refCount++;
  cancelIdleRelease();
  return stream;
}

/**
 * Drop one claim on the shared stream. The stream stays warm for
 * IDLE_RELEASE_MS so rapid stop → start cycles never re-race the native
 * AudioRecord release; after the window it is stopped for real.
 *
 * Only call this once per SUCCESSFUL acquireMicStream().
 */
export function releaseMicStream(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && isLive(shared)) {
    if (idleTimer === null) {
      idleTimer = setTimeout(() => {
        idleTimer = null;
        if (refCount === 0 && shared) {
          try { shared.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
          shared = null;
        }
      }, IDLE_RELEASE_MS);
    }
  }
}

/** True when the shared stream exists and is live (diagnostics only). */
export function isMicStreamWarm(): boolean {
  return isLive(shared);
}

// ─── Lifecycle wiring (once per page) ──────────────────────────────────────
function forceRelease(): void {
  cancelIdleRelease();
  refCount = 0;
  if (shared) {
    try { shared.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    shared = null;
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' || document.hidden) {
      forceRelease();
    }
  });
  window.addEventListener('pagehide', forceRelease);
}
