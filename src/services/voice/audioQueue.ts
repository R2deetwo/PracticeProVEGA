/**
 * audioQueue — the offline-first audio pipeline (owner spec, 2026-11-18).
 *
 * "Save recordings locally on the device first so that if the user is in a
 * courtroom, basement, or area with weak internet signal, the audio is never
 * lost and automatically uploads once connection returns."
 *
 * How it delivers that:
 *   - Every segment the recorder emits is written to IndexedDB (WAV blobs
 *     survive page reloads — localStorage is far too small) BEFORE any
 *     network attempt.
 *   - A singleton VoiceSyncManager drains the queue: segments upload in
 *     order per capture, with exponential backoff on network hiccups,
 *     automatically when the 'online' event fires, every 30s, and whenever
 *     the app returns to the foreground.
 *   - (clientLocalId, segmentIndex) idempotency on the backend means a
 *     reconnect replay can never double-book a capture.
 *   - When the last segment of a CLOSED capture lands, the manager runs
 *     finalizeCapture (Smart Clean + triage / Legal Pad merge) and emits
 *     'ready' so the UI can surface the result — even if the recording
 *     happened an hour ago offline.
 *
 * Permanent failures (auth lost, payload rejected) dead-letter the single
 * segment, never the whole capture — the remaining audio still transcribes.
 */

import {
  uploadSegment,
  finalizeCapture,
  isRetryableError,
  type CaptureKind,
  type OutputMode,
} from "./voiceCaptureService";

// ─── IndexedDB schema ──────────────────────────────────────────────────────

const DB_NAME = "practicepro_voice";
const DB_VERSION = 1;
const SEGMENT_STORE = "segments";
const CAPTURE_STORE = "captures";

export interface QueuedSegment {
  key: string; // `${clientLocalId}:${segmentIndex}`
  clientLocalId: string;
  segmentIndex: number;
  blob: Blob; // raw recorded blob (converted to WAV at upload time)
  startMs: number;
  endMs: number;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  status: "pending" | "dead";
  lastError?: string;
}

export interface QueuedCapture {
  clientLocalId: string;
  kind: CaptureKind;
  outputMode: OutputMode;
  startedAt: number;
  createdAt: number;
  /** Set when the user stops recording — the manager finalizes closed captures. */
  closed: boolean;
  segmentCount?: number;
  totalDurationMs?: number;
  eventTypeNames?: string[];
  shorthandText?: string;
  /** Conversation mode (multi-speaker diarization, 2026-11-20). */
  multiSpeaker?: boolean;
  finalizeAttempts: number;
  finalizeNextAttemptAt: number;
  status: "pending" | "uploading" | "transcribing" | "ready" | "failed";
  finalizeError?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable — offline voice queue disabled."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SEGMENT_STORE)) {
        const segs = db.createObjectStore(SEGMENT_STORE, { keyPath: "key" });
        segs.createIndex("by_capture", "clientLocalId");
        segs.createIndex("by_created", "createdAt");
      }
      if (!db.objectStoreNames.contains(CAPTURE_STORE)) {
        db.createObjectStore(CAPTURE_STORE, { keyPath: "clientLocalId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open voice queue."));
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function putSegment(seg: QueuedSegment): Promise<IDBValidKey> {
  return tx(SEGMENT_STORE, "readwrite", (s) => s.put(seg));
}

function deleteSegment(key: string): Promise<undefined> {
  return tx(SEGMENT_STORE, "readwrite", (s) => s.delete(key) as unknown as IDBRequest<undefined>);
}

function getSegmentsForCapture(clientLocalId: string): Promise<QueuedSegment[]> {
  return openDb().then(
    (db) =>
      new Promise<QueuedSegment[]>((resolve, reject) => {
        const t = db.transaction(SEGMENT_STORE, "readonly");
        const idx = t.objectStore(SEGMENT_STORE).index("by_capture");
        const req = idx.getAll(clientLocalId);
        req.onsuccess = () =>
          resolve(
            (req.result as QueuedSegment[]).sort((a, b) => a.segmentIndex - b.segmentIndex)
          );
        req.onerror = () => reject(req.error);
      })
  );
}

function getAllSegments(): Promise<QueuedSegment[]> {
  return tx(SEGMENT_STORE, "readonly", (s) => s.getAll() as unknown as IDBRequest<QueuedSegment[]>);
}

function putCapture(cap: QueuedCapture): Promise<IDBValidKey> {
  return tx(CAPTURE_STORE, "readwrite", (s) => s.put(cap));
}

function getCapture(clientLocalId: string): Promise<QueuedCapture | undefined> {
  return tx(CAPTURE_STORE, "readonly", (s) => s.get(clientLocalId) as unknown as IDBRequest<QueuedCapture | undefined>);
}

function getAllCaptures(): Promise<QueuedCapture[]> {
  return tx(CAPTURE_STORE, "readonly", (s) => s.getAll() as unknown as IDBRequest<QueuedCapture[]>);
}

function deleteCaptureRow(clientLocalId: string): Promise<undefined> {
  return tx(CAPTURE_STORE, "readwrite", (s) => s.delete(clientLocalId) as unknown as IDBRequest<undefined>);
}

// ─── Backoff (unit-tested in tests/unit/voiceCapture.test.ts) ──────────────

/** Exponential backoff for retries: 0s → 5s → 30s → 2m → 5m (cap). */
export function backoffDelayMs(attempts: number): number {
  if (attempts <= 0) return 0;
  if (attempts === 1) return 5_000;
  if (attempts === 2) return 30_000;
  if (attempts === 3) return 120_000;
  return 300_000;
}

export function segmentKey(clientLocalId: string, segmentIndex: number): string {
  return `${clientLocalId}:${segmentIndex}`;
}

// ─── Sync events ───────────────────────────────────────────────────────────

export interface VoiceSyncEvent {
  type: "enqueued" | "upload-started" | "segment-uploaded" | "status" | "ready" | "dead" | "finalize-error";
  clientLocalId?: string;
  segmentIndex?: number;
  error?: string;
  stats?: VoiceQueueStats;
  /** Live transcript so far (after this segment uploaded). */
  verbatimSoFar?: string;
}

export interface VoiceQueueStats {
  pendingCaptures: number;
  pendingSegments: number;
  uploading: string | null;
  readyCount: number;
}

type Listener = (e: VoiceSyncEvent) => void;

// ─── The manager ───────────────────────────────────────────────────────────

export class VoiceSyncManager {
  private started = false;
  private draining = false;
  private drainQueued = false;
  private listeners = new Set<Listener>();
  private intervalId: number | null = null;
  private uploadTarget: string | null = null;

  /** Subscribe to queue events. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: VoiceSyncEvent) {
    this.listeners.forEach((l) => {
      try { l(e); } catch { /* listener errors must not break the drain */ }
    });
  }

  async start(): Promise<void> {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    try { await openDb(); } catch { this.started = false; return; }
    window.addEventListener("online", () => this.kick());
    window.addEventListener("offline", () => this.emit({ type: "status" }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.kick();
    });
    // Same cadence as the mutation offline queue: 30s safety tick.
    this.intervalId = window.setInterval(() => this.kick(), 30_000);
    this.kick();
  }

  // ─── enqueue API (called by the capture hooks) ──────────────────────────

  /** Register a new capture session (or refresh its metadata). */
  async ensureCapture(meta: {
    clientLocalId: string;
    kind: CaptureKind;
    outputMode: OutputMode;
    startedAt: number;
    eventTypeNames?: string[];
    /** Conversation mode (multi-speaker diarization, 2026-11-20). */
    multiSpeaker?: boolean;
  }): Promise<void> {
    const existing = await getCapture(meta.clientLocalId).catch(() => undefined);
    await putCapture({
      clientLocalId: meta.clientLocalId,
      kind: meta.kind,
      outputMode: meta.outputMode,
      startedAt: meta.startedAt,
      createdAt: existing?.createdAt ?? Date.now(),
      closed: existing?.closed ?? false,
      segmentCount: existing?.segmentCount,
      totalDurationMs: existing?.totalDurationMs,
      eventTypeNames: meta.eventTypeNames ?? existing?.eventTypeNames,
      shorthandText: existing?.shorthandText ?? "",
      multiSpeaker: meta.multiSpeaker ?? existing?.multiSpeaker,
      finalizeAttempts: existing?.finalizeAttempts ?? 0,
      finalizeNextAttemptAt: existing?.finalizeNextAttemptAt ?? 0,
      status: existing?.status ?? "pending",
    });
    this.emit({ type: "status" });
  }

  /** Persist one recorded segment locally — BEFORE any upload attempt. */
  async enqueueSegment(args: {
    clientLocalId: string;
    segmentIndex: number;
    blob: Blob;
    startMs: number;
    endMs: number;
  }): Promise<void> {
    const existing = await getCapture(args.clientLocalId).catch(() => undefined);
    if (!existing) return; // capture was wiped — don't orphan segments
    await putSegment({
      key: segmentKey(args.clientLocalId, args.segmentIndex),
      clientLocalId: args.clientLocalId,
      segmentIndex: args.segmentIndex,
      blob: args.blob,
      startMs: args.startMs,
      endMs: args.endMs,
      createdAt: Date.now(),
      attempts: 0,
      nextAttemptAt: 0,
      status: "pending",
    });
    this.emit({ type: "enqueued", clientLocalId: args.clientLocalId, segmentIndex: args.segmentIndex });
    this.kick(); // online path: upload immediately, no 30s wait
  }

  /** Mark the capture closed (recording stopped) — eligible for finalize. */
  async closeCapture(args: {
    clientLocalId: string;
    segmentCount: number;
    totalDurationMs: number;
    shorthandText?: string;
  }): Promise<void> {
    const cap = await getCapture(args.clientLocalId).catch(() => undefined);
    if (!cap) return;
    await putCapture({
      ...cap,
      closed: true,
      segmentCount: args.segmentCount,
      totalDurationMs: args.totalDurationMs,
      shorthandText: args.shorthandText ?? cap.shorthandText ?? "",
      status: cap.status === "ready" ? "ready" : "uploading",
    });
    this.emit({ type: "status" });
    this.kick();
  }

  /** Legal Pad autosave — keep the latest shorthand for the offline finalize. */
  async updateShorthand(clientLocalId: string, shorthandText: string): Promise<void> {
    const cap = await getCapture(clientLocalId).catch(() => undefined);
    if (!cap) return;
    await putCapture({ ...cap, shorthandText });
  }

  /** Drop a capture's queue records (e.g., user discards the session). */
  async purgeCapture(clientLocalId: string): Promise<void> {
    const segs = await getSegmentsForCapture(clientLocalId).catch(() => [] as QueuedSegment[]);
    for (const s of segs) await deleteSegment(s.key).catch(() => undefined);
    await deleteCaptureRow(clientLocalId).catch(() => undefined);
    this.emit({ type: "status" });
  }

  /**
   * Cancel an "Add More" (append) round: drop ONLY the segments recorded in
   * this round (segmentIndex >= fromIndex) and the queue row it recreated,
   * leaving the ORIGINAL capture untouched on the backend.
   *
   * The local queue row for an append round is recreated by ensureCapture
   * (the previous round's row is deleted after it finalized), and its only
   * pending segments are the new round's — so once those are dropped the
   * row is safe to delete. Segments that already reached the backend before
   * the cancel cannot be un-sent; they stay dormant on the capture row and
   * surface if a later append round finalizes (audio is never destroyed).
   */
  async cancelAppendRound(clientLocalId: string, fromIndex: number): Promise<void> {
    const segs = await getSegmentsForCapture(clientLocalId).catch(() => [] as QueuedSegment[]);
    for (const s of segs) {
      if (s.segmentIndex >= fromIndex) {
        await deleteSegment(s.key).catch(() => undefined);
      }
    }
    const remaining = await getSegmentsForCapture(clientLocalId).catch(() => [] as QueuedSegment[]);
    if (remaining.every((s) => s.status !== "pending")) {
      await deleteCaptureRow(clientLocalId).catch(() => undefined);
    }
    this.emit({ type: "status" });
  }

  async getStats(): Promise<VoiceQueueStats> {
    const [segs, caps] = await Promise.all([
      getAllSegments().catch(() => [] as QueuedSegment[]),
      getAllCaptures().catch(() => [] as QueuedCapture[]),
    ]);
    return {
      pendingSegments: segs.filter((s) => s.status === "pending").length,
      pendingCaptures: caps.filter((c) => !c.closed || segs.some((s) => s.clientLocalId === c.clientLocalId && s.status === "pending")).length,
      uploading: this.uploadTarget,
      readyCount: caps.filter((c) => c.status === "ready").length,
    };
  }

  /** List captures still carrying work, oldest first (for the pending strip). */
  async getPendingCaptures(): Promise<QueuedCapture[]> {
    const [caps, segs] = await Promise.all([
      getAllCaptures().catch(() => [] as QueuedCapture[]),
      getAllSegments().catch(() => [] as QueuedSegment[]),
    ]);
    return caps
      .filter((c) => segs.some((s) => s.clientLocalId === c.clientLocalId && s.status === "pending") || !c.closed)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  // ─── the drain loop ──────────────────────────────────────────────────────

  /** Wake the drain loop (online event, new segment, visibility, tick). */
  kick(): void {
    if (this.draining) {
      this.drainQueued = true;
      return;
    }
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      const captures = await this.getAllCapturesSafe();
      // Oldest first — a stalled capture must not starve the others.
      captures.sort((a, b) => a.createdAt - b.createdAt);

      for (const cap of captures) {
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        await this.drainCapture(cap);
      }
    } catch { /* drain never throws */ } finally {
      this.draining = false;
      this.uploadTarget = null;
      if (this.drainQueued) {
        this.drainQueued = false;
        this.kick();
      }
    }
  }

  private async getAllCapturesSafe(): Promise<QueuedCapture[]> {
    try {
      return await getAllCaptures();
    } catch {
      return [];
    }
  }

  private async drainCapture(cap: QueuedCapture): Promise<void> {
    const segs = await getSegmentsForCapture(cap.clientLocalId).catch(() => [] as QueuedSegment[]);
    const pending = segs.filter((s) => s.status === "pending");

    for (const seg of pending) {
      if (seg.nextAttemptAt > Date.now()) continue; // backoff not elapsed
      this.uploadTarget = cap.clientLocalId;
      this.emit({ type: "upload-started", clientLocalId: cap.clientLocalId, segmentIndex: seg.segmentIndex });
      try {
        const uploaded = await uploadSegment({
          clientLocalId: cap.clientLocalId,
          kind: cap.kind,
          outputMode: cap.outputMode,
          segmentIndex: seg.segmentIndex,
          segmentCount: cap.segmentCount,
          blob: seg.blob,
          startMs: seg.startMs,
          endMs: seg.endMs,
          startedAt: cap.startedAt,
          multiSpeaker: cap.multiSpeaker,
        });
        await deleteSegment(seg.key).catch(() => undefined);
        this.emit({
          type: "segment-uploaded",
          clientLocalId: cap.clientLocalId,
          segmentIndex: seg.segmentIndex,
          verbatimSoFar: uploaded?.verbatimSoFar,
        });
      } catch (err: any) {
        const msg = String(err?.message || err || "upload failed");
        if (isRetryableError(err)) {
          // Network hiccup / rate limit — back off this segment, stop this
          // capture's drain (order matters), let the tick retry later.
          await putSegment({
            ...seg,
            attempts: seg.attempts + 1,
            nextAttemptAt: Date.now() + backoffDelayMs(seg.attempts + 1),
            lastError: msg,
          }).catch(() => undefined);
          return; // keep ordering — do not skip ahead in this capture
        }
        // Permanent (auth lost / payload rejected): dead-letter THIS segment.
        await putSegment({ ...seg, status: "dead", lastError: msg }).catch(() => undefined);
        this.emit({ type: "dead", clientLocalId: cap.clientLocalId, segmentIndex: seg.segmentIndex, error: msg });
      }
    }

    // Finalize closed captures once every segment is uploaded or dead.
    // (2026-11-18 fix: dead-lettered segments used to keep remaining.length
    // > 0 forever, silently blocking finalize for the whole capture — now
    // only PENDING segments can block it, and dead ones are cleaned up.)
    const remaining = await getSegmentsForCapture(cap.clientLocalId).catch(() => [] as QueuedSegment[]);
    const stillPending = remaining.some((s) => s.status === "pending");
    const expectedCount = cap.segmentCount ?? 0;
    const done = !stillPending && expectedCount > 0;
    if (!stillPending && done && cap.status !== "ready") {
      await this.finalizeCapture(cap);
    }
  }

  private async finalizeCapture(cap: QueuedCapture): Promise<void> {
    if (cap.finalizeNextAttemptAt > Date.now()) return;
    try {
      await putCapture({ ...cap, status: "transcribing" });
      const result = await finalizeCapture({
        clientLocalId: cap.clientLocalId,
        shorthandText: cap.shorthandText || undefined,
        eventTypeNames: cap.eventTypeNames,
        totalDurationMs: cap.totalDurationMs,
        multiSpeaker: cap.multiSpeaker,
      });
      const fresh = (await getCapture(cap.clientLocalId).catch(() => undefined)) ?? cap;
      await putCapture({ ...fresh, status: "ready", finalizeError: undefined });
      this.emit({ type: "ready", clientLocalId: cap.clientLocalId });
      // Queue cleanup: the capture record has served its purpose once the
      // backend holds the full state. Keep recent rows for the pending
      // strip only when something is still pending. Dead-lettered segments
      // (permanent failures) are swept here too — they can never upload.
      const segs = await getSegmentsForCapture(cap.clientLocalId).catch(() => [] as QueuedSegment[]);
      for (const s of segs) {
        if (s.status === "dead") await deleteSegment(s.key).catch(() => undefined);
      }
      const rest = await getSegmentsForCapture(cap.clientLocalId).catch(() => [] as QueuedSegment[]);
      if (rest.length === 0) {
        await deleteCaptureRow(cap.clientLocalId).catch(() => undefined);
      }
      void result;
    } catch (err: any) {
      const msg = String(err?.message || err || "finalize failed");
      const attempts = (cap.finalizeAttempts ?? 0) + 1;
      const fresh = (await getCapture(cap.clientLocalId).catch(() => undefined)) ?? cap;
      await putCapture({
        ...fresh,
        finalizeAttempts: attempts,
        finalizeNextAttemptAt: Date.now() + backoffDelayMs(attempts),
        status: "failed",
        finalizeError: msg,
      }).catch(() => undefined);
      this.emit({ type: "finalize-error", clientLocalId: cap.clientLocalId, error: msg });
    }
  }
}

/** App-wide singleton. */
export const voiceSync = new VoiceSyncManager();
