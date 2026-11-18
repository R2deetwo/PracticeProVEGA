// @vitest-environment jsdom
/**
 * micStream.test.ts — pins the shared microphone manager that fixed the
 * founder-reported Android bug (2026-11-18): "I allowed the microphone and
 * it still says it is in use by another app."
 *
 * The pinned contract (see src/services/voice/micStream.ts):
 *   1. ONE open: concurrent acquires share a single in-flight getUserMedia.
 *   2. Reuse: a live stream is returned without a new getUserMedia.
 *   3. Retry ladder: NotReadableError is retried (the Android grant race);
 *      NotAllowedError is NOT (surfaced immediately).
 *   4. Warm idle: release holds the stream for the idle window; a
 *      re-acquire inside it reuses the stream without stopping it.
 *   5. Idle expiry: after the window, the tracks are stopped for real.
 *   6. Backgrounding force-releases the mic (privacy).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** Build a fake MediaStream whose tracks record stop() calls. */
function fakeStream() {
  const track = { readyState: 'live' as 'live' | 'ended', stop: vi.fn(() => { track.readyState = 'ended'; }) };
  return {
    getAudioTracks: () => [track],
    getTracks: () => [track],
    __track: track,
  } as unknown as MediaStream & { __track: { stop: ReturnType<typeof vi.fn>; readyState: string } };
}

function gumError(name: string): DOMException {
  return new DOMException('fake failure', name);
}

/** Deferred getUserMedia mock harness. */
function mockGum() {
  const calls: MediaStreamConstraints[] = [];
  const impl = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async (c: MediaStreamConstraints) => {
        calls.push(c);
        return impl(c, calls.length);
      },
    },
  });
  return { calls, impl };
}

async function loadManager() {
  vi.resetModules();
  const mod = await import('../../src/services/voice/micStream');
  return mod;
}

describe('micStream — the shared microphone manager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens the mic ONCE for concurrent acquires (no double-open race)', async () => {
    const { calls, impl } = mockGum();
    let releaseOpen: (s: MediaStream) => void = () => {};
    impl.mockImplementation(
      () => new Promise<MediaStream>((res) => { releaseOpen = res; })
    );
    const { acquireMicStream } = await loadManager();

    const p1 = acquireMicStream();
    const p2 = acquireMicStream();
    releaseOpen(fakeStream());
    const [s1, s2] = await Promise.all([p1, p2]);

    expect(calls.length).toBe(1);
    expect(s1).toBe(s2);
  });

  it('reuses a live stream without a new getUserMedia', async () => {
    const { calls, impl } = mockGum();
    impl.mockResolvedValue(fakeStream());
    const { acquireMicStream } = await loadManager();

    await acquireMicStream();
    await acquireMicStream();
    await acquireMicStream();
    expect(calls.length).toBe(1);
  });

  it('retries NotReadableError (the Android permission-grant race) and succeeds on a plain {audio: true} fallback', async () => {
    const { calls, impl } = mockGum();
    impl.mockRejectedValueOnce(gumError('NotReadableError'));
    impl.mockResolvedValueOnce(fakeStream());
    const { acquireMicStream } = await loadManager();

    const p = acquireMicStream();
    await vi.advanceTimersByTimeAsync(500); // cross the 400ms retry backoff
    const s = await p;

    expect(impl).toHaveBeenCalledTimes(2);
    // Attempt 1 carries the quality constraints; attempt 2 falls back to plain.
    expect(calls[0]).toEqual({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    expect(calls[1]).toEqual({ audio: true });
    expect(s).toBeTruthy();
  });

  it('exhausts the ladder (4 attempts, incl. the 2.5s stale-AudioRecord backoff) and surfaces the error after the final backoff', async () => {
    const { impl } = mockGum();
    impl.mockRejectedValue(gumError('NotReadableError'));
    const { acquireMicStream } = await loadManager();

    const p = acquireMicStream();
    const assertion = expect(p).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(4_000); // 400ms + 1000ms + 2500ms backoffs
    await assertion;
    expect(impl).toHaveBeenCalledTimes(4);
  });

  it('does NOT retry permission denials — they surface immediately', async () => {
    const { impl } = mockGum();
    impl.mockRejectedValue(gumError('NotAllowedError'));
    const { acquireMicStream } = await loadManager();

    await expect(acquireMicStream()).rejects.toThrow();
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it('keeps the stream warm through the idle window (stop → record again never re-races)', async () => {
    const { calls, impl } = mockGum();
    const s = fakeStream();
    impl.mockResolvedValue(s);
    const { acquireMicStream, releaseMicStream, isMicStreamWarm } = await loadManager();

    await acquireMicStream();
    releaseMicStream(); // walkie-talkie stop
    expect(isMicStreamWarm()).toBe(true);

    await vi.advanceTimersByTimeAsync(10_000); // still inside the 15s window
    expect(isMicStreamWarm()).toBe(true);
    expect(s.__track.stop).not.toHaveBeenCalled();

    const again = await acquireMicStream(); // re-acquire inside the window
    expect(again).toBe(s);
    expect(calls.length).toBe(1); // no re-open
  });

  it('stops the tracks for real after the idle window expires', async () => {
    const { impl } = mockGum();
    const s = fakeStream();
    impl.mockResolvedValue(s);
    const { acquireMicStream, releaseMicStream, isMicStreamWarm } = await loadManager();

    await acquireMicStream();
    releaseMicStream();
    await vi.advanceTimersByTimeAsync(16_000);

    expect(isMicStreamWarm()).toBe(false);
    expect(s.__track.stop).toHaveBeenCalledTimes(1);
  });

  it('force-releases the mic when the app is backgrounded (privacy)', async () => {
    const { impl } = mockGum();
    const s = fakeStream();
    impl.mockResolvedValue(s);
    const { acquireMicStream, isMicStreamWarm } = await loadManager();

    await acquireMicStream();
    expect(isMicStreamWarm()).toBe(true);

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(isMicStreamWarm()).toBe(false);
    expect(s.__track.stop).toHaveBeenCalledTimes(1);
  });
});
