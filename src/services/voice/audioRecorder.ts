/**
 * audioRecorder — reliable segmented on-device audio capture.
 *
 * The capture half of the Voice Capture Engine (owner spec, 2026-11-18).
 * Design goals, in order:
 *
 *   1. NEVER lose audio. Every recorded slice is emitted as a segment
 *      callback the instant MediaRecorder hands it over — the caller
 *      (audioQueue) persists it to IndexedDB before any network happens.
 *      A page crash mid-consultation costs at most the in-flight slice.
 *   2. No silent failures. Mobile WebViews (Android APK) occasionally
 *      accept a MediaRecorder.start() and then never emit data. The
 *      recorder watches for that and surfaces a distinct error instead of
 *      letting the user dictate into a dead mic.
 *   3. Pause/resume + energy metering for the Hybrid Legal Pad.
 *
 * Segments are wall-clock-offset from session start in RECORDED
 * milliseconds (paused time excluded), so the backend can timestamp the
 * archived audio tiers accurately.
 */

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'paused' | 'stopped' | 'error';

export type RecorderErrorCode =
  | 'not-supported'
  | 'insecure-context'
  | 'denied'
  | 'no-microphone'
  | 'in-use'
  | 'silent-failure'
  | 'encode-failed'
  | 'unknown';

export class VoiceRecorderError extends Error {
  code: RecorderErrorCode;
  userMessage: string;
  constructor(code: RecorderErrorCode, userMessage: string, detail?: string) {
    super(detail || userMessage);
    this.code = code;
    this.userMessage = userMessage;
  }
}

export interface RecorderSegment {
  /** 0-based segment index within the session. */
  index: number;
  /** Raw recorded blob (webm/opus, mp4/aac, or whatever the device supports). */
  blob: Blob;
  /** Recorded-time offsets from session start, pauses excluded. */
  startMs: number;
  endMs: number;
}

export interface VoiceRecorderOptions {
  /** Slice length. 60s keeps each upload well under the backend 4MB cap. */
  segmentMs?: number;
  onSegment?: (segment: RecorderSegment) => void;
  /** Voice energy 0..1 for the waveform visualizer. */
  onEnergy?: (level: number) => void;
  /** Recorded-time ticker for the UI timer (pauses excluded). */
  onTick?: (recordedMs: number) => void;
  onError?: (err: VoiceRecorderError) => void;
  /** Fire when the underlying stream dies unexpectedly (track ended). */
  onStreamEnded?: () => void;
}

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4', // iOS Safari
  'audio/mpeg',
  'audio/ogg;codecs=opus',
];

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const t of PREFERRED_MIME_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch { /* keep probing */ }
  }
  return '';
}

export function recorderSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

export class VoiceRecorder {
  private opts: Required<Pick<VoiceRecorderOptions, 'segmentMs'>> & VoiceRecorderOptions;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private rafId: number | null = null;
  private tickerId: number | null = null;
  private status: RecorderStatus = 'idle';
  private segmentIndex = 0;
  private recordedMs = 0;
  private lastTickAt = 0;
  private segmentStartMs = 0;
  private lastChunkAt = 0;
  private watchdogId: number | null = null;
  private stopping = false;

  constructor(options: VoiceRecorderOptions = {}) {
    this.opts = { segmentMs: 60_000, ...options };
  }

  getStatus(): RecorderStatus {
    return this.status;
  }

  getRecordedMs(): number {
    return this.recordedMs;
  }

  getSegmentCount(): number {
    return this.segmentIndex;
  }

  /** True while a session exists that can still be paused/resumed/stopped. */
  isActive(): boolean {
    return this.status === 'recording' || this.status === 'paused';
  }

  async start(): Promise<void> {
    if (this.isActive()) return;
    if (!recorderSupported()) {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        throw new VoiceRecorderError(
          'insecure-context',
          'Recording needs a secure connection (HTTPS). Open the app over HTTPS and try again.'
        );
      }
      throw new VoiceRecorderError(
        'not-supported',
        'This browser cannot record audio. Please update your browser or use the PracticePro app.'
      );
    }

    this.stopping = false;
    this.segmentIndex = 0;
    this.recordedMs = 0;
    this.segmentStartMs = 0;
    this.status = 'starting';

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      throw this.mapGumError(err);
    }
    this.stream = stream;

    // Surface mid-session mic deaths (another app grabbing the mic, BT
    // headset disconnect) instead of recording silence.
    stream.getAudioTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        if (this.isActive() && !this.stopping) {
          this.opts.onStreamEnded?.();
          this.stop().catch(() => { /* flushed by stop */ });
        }
      });
    });

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48_000 })
        : new MediaRecorder(stream);
    } catch {
      this.cleanupStream();
      this.status = 'idle';
      throw new VoiceRecorderError(
        'encode-failed',
        'Could not start the audio encoder on this device. Try again or type your note instead.'
      );
    }
    this.recorder = recorder;

    recorder.ondataavailable = (e: BlobEvent) => {
      this.lastChunkAt = Date.now();
      if (this.watchdogId !== null) {
        clearTimeout(this.watchdogId);
        this.armWatchdog();
      }
      if (!e.data || e.data.size === 0) return;
      const now = this.recordedMs;
      const seg: RecorderSegment = {
        index: this.segmentIndex++,
        blob: e.data,
        startMs: this.segmentStartMs,
        endMs: now,
      };
      this.segmentStartMs = now;
      try {
        this.opts.onSegment?.(seg);
      } catch { /* listener errors must never kill the recorder */ }
    };

    recorder.onerror = () => {
      this.fail(
        new VoiceRecorderError(
          'encode-failed',
          'Recording stopped unexpectedly. Everything captured so far has been saved.'
        )
      );
    };

    // Energy metering.
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new Ctx();
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.sourceNode.connect(this.analyser);
      this.startEnergyLoop();
    } catch { /* visualizer is optional */ }

    recorder.start(this.opts.segmentMs);
    this.status = 'recording';
    this.lastChunkAt = Date.now();
    this.armWatchdog();
    this.startTicker();
  }

  pause(): void {
    if (this.status !== 'recording' || !this.recorder) return;
    try {
      this.recorder.pause();
      this.status = 'paused';
      this.stopTicker();
    } catch { /* already paused */ }
  }

  resume(): void {
    if (this.status !== 'paused' || !this.recorder) return;
    try {
      this.recorder.resume();
      this.status = 'recording';
      this.armWatchdog();
      this.startTicker();
    } catch { /* ignore */ }
  }

  /** Stop and flush the trailing partial segment. Resolves when flushed. */
  async stop(): Promise<void> {
    if (!this.isActive() || !this.recorder) {
      this.cleanup();
      return;
    }
    this.stopping = true;
    if (this.watchdogId !== null) {
      clearTimeout(this.watchdogId);
      this.watchdogId = null;
    }
    this.stopTicker();
    await new Promise<void>((resolve) => {
      const rec = this.recorder!;
      const done = () => {
        rec.onstop = null;
        resolve();
      };
      rec.onstop = done;
      try {
        if (rec.state !== 'inactive') {
          // requestData() forces the final partial chunk out before stop.
          if (rec.state === 'recording') {
            try { rec.requestData(); } catch { /* not supported — stop() still flushes */ }
          }
          rec.stop();
        } else {
          done();
        }
      } catch {
        done();
      }
    });
    this.status = 'stopped';
    this.cleanup();
  }

  /** Discard without emitting the final partial segment. */
  cancel(): void {
    this.stopping = true;
    if (this.watchdogId !== null) {
      clearTimeout(this.watchdogId);
      this.watchdogId = null;
    }
    this.stopTicker();
    try {
      if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    } catch { /* ignore */ }
    this.status = 'idle';
    this.cleanup();
  }

  destroy(): void {
    this.cancel();
  }

  // ─── internals ────────────────────────────────────────────────────────────

  private fail(err: VoiceRecorderError) {
    if (this.status === 'error') return;
    this.status = 'error';
    this.opts.onError?.(err);
    try {
      if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    } catch { /* ignore */ }
    this.cleanup();
  }

  /**
   * Silent-failure watchdog: MediaRecorder on some Android WebViews accepts
   * start() and then never emits a chunk. If no data arrives within
   * 2.5× the slice length (min 8s), we kill the session with a distinct,
   * actionable error instead of recording dead air.
   */
  private armWatchdog() {
    if (this.watchdogId !== null) clearTimeout(this.watchdogId);
    const timeout = Math.max(8_000, this.opts.segmentMs * 2.5);
    this.watchdogId = window.setTimeout(() => {
      if (this.status === 'recording' && Date.now() - this.lastChunkAt >= timeout) {
        this.fail(
          new VoiceRecorderError(
            'silent-failure',
            'The microphone stopped producing audio on this device. Your session was saved up to this point — tap record to try again.',
            `watchdog: no chunk for ${Date.now() - this.lastChunkAt}ms`
          )
        );
      }
    }, timeout + 250);
  }

  private startTicker() {
    this.stopTicker();
    this.lastTickAt = Date.now();
    this.tickerId = window.setInterval(() => {
      const now = Date.now();
      this.recordedMs += now - this.lastTickAt;
      this.lastTickAt = now;
      this.opts.onTick?.(this.recordedMs);
    }, 250);
  }

  private stopTicker() {
    if (this.tickerId !== null) {
      clearInterval(this.tickerId);
      this.tickerId = null;
    }
  }

  private startEnergyLoop() {
    const buf = new Uint8Array(this.analyser ? this.analyser.frequencyBinCount : 0);
    const loop = () => {
      if (!this.analyser) return;
      this.analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      this.opts.onEnergy?.(Math.min(1, rms * 3.2));
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private cleanup() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.stopTicker();
    if (this.watchdogId !== null) {
      clearTimeout(this.watchdogId);
      this.watchdogId = null;
    }
    try { this.sourceNode?.disconnect(); } catch { /* ignore */ }
    this.sourceNode = null;
    this.analyser = null;
    try {
      if (this.audioContext && this.audioContext.state !== 'closed') void this.audioContext.close();
    } catch { /* ignore */ }
    this.audioContext = null;
    this.cleanupStream();
    this.recorder = null;
  }

  private cleanupStream() {
    try { this.stream?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    this.stream = null;
  }

  private mapGumError(err: any): VoiceRecorderError {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return new VoiceRecorderError(
        'denied',
        'Microphone access was blocked. Enable it in Settings → Apps → PracticePro → Permissions → Microphone, then try again.',
        String(err?.message || name)
      );
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return new VoiceRecorderError(
        'no-microphone',
        'No microphone was found on this device.',
        String(err?.message || name)
      );
    }
    if (name === 'NotReadableError' || name === 'AbortError') {
      return new VoiceRecorderError(
        'in-use',
        'The microphone is in use by another app. Close other recording apps (calls, voice notes) and try again.',
        String(err?.message || name)
      );
    }
    return new VoiceRecorderError(
      'unknown',
      'Could not start recording. Please try again.',
      String(err?.message || name)
    );
  }
}
