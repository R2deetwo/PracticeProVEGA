/**
 * useQuickCapture — the "Speak First, Route Later" state machine.
 *
 * Walkie-talkie launcher flow (owner spec, 2026-11-18): one big record
 * button, no forms before speaking; on stop, the cleaned transcript is
 * analyzed and the single best next action is suggested on a confirmation
 * card (case note / diary / quick ask / share), with one-tap pills to
 * switch destinations.
 *
 * INCREMENTAL DICTATION (owner addendum, same day): a completed capture is
 * NOT a dead end. `appendRecording` re-opens the SAME capture (same
 * clientLocalId) and records another clip whose segments carry indexes
 * that continue after the existing ones — the backend's (clientLocalId,
 * segmentIndex) idempotency and index-ordered verbatim assembly mean the
 * new words append cleanly onto the transcript, and the next finalize
 * re-runs Smart Clean + triage across the COMBINED text. Cancel during an
 * append round discards only the new clip, never the original capture.
 *
 * Offline-first: the moment recording stops, audio already sits in the
 * IndexedDB queue; the VoiceSyncManager uploads + finalizes when a
 * connection returns, and this hook surfaces the triage card whenever the
 * 'ready' event fires — even if that happens hours later, on another
 * screen visit.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  VoiceRecorder,
  VoiceRecorderError,
  recorderSupported,
  type RecorderSegment,
} from "../services/voice/audioRecorder";
import { voiceSync, type VoiceQueueStats } from "../services/voice/audioQueue";
import {
  getCaptureByLocalId,
  type CaptureKind,
  type CaptureProjection,
  type OutputMode,
} from "../services/voice/voiceCaptureService";

export type QuickCapturePhase =
  | "idle" // nothing happening; big record button
  | "recording" // mic live
  | "processing" // uploading + transcribing + polishing + triaging
  | "queued" // stopped offline — saved on device, will process on reconnect
  | "triage" // confirmation card with suggested action
  | "error"; // recorder-level failure

export interface QuickCaptureState {
  phase: QuickCapturePhase;
  elapsedMs: number;
  energy: number;
  error: string | null;
  /** Set once the backend capture is ready (the triage card source). */
  capture: CaptureProjection | null;
  /** Live queue badge info. */
  queueStats: VoiceQueueStats | null;
  clientLocalId: string | null;
  segmentCount: number;
  /** True while this recording is an "Add More" round on an existing capture. */
  appending: boolean;
}

export interface UseQuickCaptureOptions {
  eventTypeNames?: string[];
  outputMode?: OutputMode;
  onReadyToast?: (capture: CaptureProjection) => void;
  /** WHISPER MODE (owner spec 2026-11-19 §5): quiet-speech capture profile
   *  for whispered court-gallery notes. Read live via ref so toggling
   *  mid-session applies on the next recording without remounting. */
  whisper?: boolean;
}

export function useQuickCapture(opts: UseQuickCaptureOptions = {}) {
  const [state, setState] = useState<QuickCaptureState>({
    phase: "idle",
    elapsedMs: 0,
    energy: 0,
    error: null,
    capture: null,
    queueStats: null,
    clientLocalId: null,
    segmentCount: 0,
    appending: false,
  });

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const pendingEnqueues = useRef<Set<Promise<void>>>(new Set());
  const activeIdRef = useRef<string | null>(null);
  // Double-tap guard: a second Speak tap while the first is still opening
  // the mic (permission dialog up) used to start a SECOND recorder — the
  // collision that locks the Android mic with "in use by another app".
  const startingRef = useRef(false);
  // Incremental dictation: when appending to an existing capture, every
  // recorder segment index is offset by the number of segments the capture
  // ALREADY holds, so (clientLocalId, segmentIndex) idempotency on the
  // backend is preserved and the new text assembles after the old.
  const appendOffsetRef = useRef(0);
  // Duration the capture already had before this append round (added to
  // this round's recorded time so the card shows the TOTAL).
  const appendBaseDurationMsRef = useRef(0);
  // The capture as it was when the user tapped "Add More" — restored on
  // cancel so the card returns exactly where it was.
  const preAppendCaptureRef = useRef<CaptureProjection | null>(null);
  const outputModeRef = useRef<OutputMode>(opts.outputMode ?? "smart-clean");
  const eventTypeNamesRef = useRef<string[] | undefined>(opts.eventTypeNames);
  const onReadyToastRef = useRef(opts.onReadyToast);
  // Whisper Mode lives in a ref (read at recorder construction) so the UI
  // can toggle it any time; the next recording round picks it up.
  const whisperRef = useRef(!!opts.whisper);
  useEffect(() => {
    whisperRef.current = !!opts.whisper;
  }, [opts.whisper]);
  const pollRef = useRef<number | null>(null);

  // Keep refs fresh without re-binding listeners.
  useEffect(() => {
    eventTypeNamesRef.current = opts.eventTypeNames;
    onReadyToastRef.current = opts.onReadyToast;
  }, [opts.eventTypeNames, opts.onReadyToast]);
  useEffect(() => {
    outputModeRef.current = opts.outputMode ?? "smart-clean";
  }, [opts.outputMode]);

  // ─── Sync manager subscription ─────────────────────────────────────────
  useEffect(() => {
    void voiceSync.start();
    const refreshStats = () => {
      voiceSync.getStats().then((stats) => {
        setState((s) => (s.queueStats === stats ? s : { ...s, queueStats: stats }));
      }).catch(() => undefined);
    };
    const unsub = voiceSync.subscribe((e) => {
      refreshStats();
      if (e.type === "ready" && e.clientLocalId) {
        if (e.clientLocalId === activeIdRef.current) {
          // Our capture finished — pull the full projection for the card.
          getCaptureByLocalId(e.clientLocalId)
            .then((capture) => {
              if (!capture) return;
              const wasAppend = appendOffsetRef.current > 0;
              appendOffsetRef.current = 0;
              appendBaseDurationMsRef.current = 0;
              preAppendCaptureRef.current = null;
              setState((s) => ({ ...s, phase: "triage", capture, error: null, appending: false }));
              // Add More rounds get their own "Added to your draft" toast
              // from the view — don't stack a second "ready" toast on it.
              if (!wasAppend) onReadyToastRef.current?.(capture);
            })
            .catch(() => undefined);
        }
      }
      if (e.type === "finalize-error" && e.clientLocalId === activeIdRef.current) {
        setState((s) =>
          s.phase === "processing" || s.phase === "queued"
            ? { ...s, error: e.error || "Processing failed — will retry automatically." }
            : s
        );
      }
    });
    refreshStats();
    return () => {
      unsub();
    };
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────────────

  const handleSegment = useCallback((seg: RecorderSegment) => {
    const id = activeIdRef.current;
    if (!id) return;
    // Append rounds continue the index sequence after the existing
    // segments so the backend never sees a replayed (idempotent-skip) index.
    const uploadIndex = seg.index + appendOffsetRef.current;
    const p = voiceSync
      .enqueueSegment({
        clientLocalId: id,
        segmentIndex: uploadIndex,
        blob: seg.blob,
        startMs: seg.startMs,
        endMs: seg.endMs,
      })
      .catch(() => undefined);
    pendingEnqueues.current.add(p);
    p.finally(() => pendingEnqueues.current.delete(p));
    setState((s) => ({ ...s, segmentCount: uploadIndex + 1 }));
  }, []);

  const makeRecorder = useCallback((): VoiceRecorder => {
    return new VoiceRecorder({
      segmentMs: 60_000,
      whisper: whisperRef.current,
      onSegment: handleSegment,
      onEnergy: (level) => setState((s) => ({ ...s, energy: level })),
      onTick: (ms) => setState((s) => ({ ...s, elapsedMs: ms })),
      onError: (err: VoiceRecorderError) => {
        const hadSegments = recorderRef.current?.getSegmentCount() ?? 0;
        const cid = activeIdRef.current;
        const appending = appendOffsetRef.current > 0;
        setState((s) => ({ ...s, error: err.userMessage }));
        if (hadSegments > 0 && cid) {
          // Mid-session mic failure: the recorder already flushed its
          // segments to the queue — close + finalize what was captured
          // instead of stranding the whole recording.
          void (async () => {
            await Promise.all(Array.from(pendingEnqueues.current));
            await voiceSync
              .closeCapture({
                clientLocalId: cid,
                segmentCount: Math.max(appendOffsetRef.current + hadSegments, 1),
                totalDurationMs: Math.max(appendBaseDurationMsRef.current + 1000, 1000),
              })
              .catch(() => undefined);
            setState((s) => ({ ...s, phase: navigator.onLine ? "processing" : "queued" }));
          })();
        } else if (appending && cid) {
          // Append round died before capturing anything: drop only this
          // round's queue records and put the card back where it was.
          void voiceSync
            .cancelAppendRound(cid, appendOffsetRef.current)
            .catch(() => undefined)
            .finally(() => {
              activeIdRef.current = null;
              appendOffsetRef.current = 0;
              appendBaseDurationMsRef.current = 0;
              const restore = preAppendCaptureRef.current;
              preAppendCaptureRef.current = null;
              setState((s) => ({
                ...s,
                phase: restore ? "triage" : "idle",
                capture: restore ?? s.capture,
                appending: false,
                clientLocalId: null,
                segmentCount: restore?.segmentCount ?? 0,
                elapsedMs: 0,
                energy: 0,
              }));
            });
        } else {
          if (cid) void voiceSync.purgeCapture(cid).catch(() => undefined);
          activeIdRef.current = null;
          setState((s) => ({ ...s, phase: "error" }));
        }
      },
      onStreamEnded: () => {
        // Mic died mid-session (BT disconnect / another app grabbed it) —
        // the recorder auto-stops and flushes; run the standard stop path.
        void stopRef.current?.();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSegment]);

  const stop = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    const offset = appendOffsetRef.current;
    const baseDuration = appendBaseDurationMsRef.current;
    setState((s) => ({ ...s, phase: "processing" }));
    await rec.stop();
    // Wait for every segment persist (incl. the final flush) before closing.
    await Promise.all(Array.from(pendingEnqueues.current));
    const id = activeIdRef.current;
    if (!id) return;
    const segmentCount = Math.max(offset + rec.getSegmentCount(), 1);
    const totalDurationMs = Math.max(baseDuration + rec.getRecordedMs(), 500);
    await voiceSync.closeCapture({
      clientLocalId: id,
      segmentCount,
      totalDurationMs,
    });
    // Offline? The queue holds everything; the card appears on reconnect.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState((s) => ({ ...s, phase: "queued", energy: 0 }));
    } else {
      // Online: the drain loop will emit 'ready' (typically 3–15s).
      // A poll backs up the event in case it fired during teardown races.
      pollRef.current = window.setInterval(() => {
        const cid = activeIdRef.current;
        if (!cid) return;
        getCaptureByLocalId(cid)
          .then((capture) => {
            if (capture?.status === "ready") {
              if (pollRef.current) window.clearInterval(pollRef.current);
              pollRef.current = null;
              activeIdRef.current = null;
              const wasAppend = appendOffsetRef.current > 0;
              appendOffsetRef.current = 0;
              appendBaseDurationMsRef.current = 0;
              preAppendCaptureRef.current = null;
              setState((s) => ({ ...s, phase: "triage", capture, appending: false }));
              if (!wasAppend) onReadyToastRef.current?.(capture);
            }
          })
          .catch(() => undefined);
      }, 3000);
    }
  }, []);

  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      recorderRef.current?.destroy();
    };
  }, []);

  // ─── Public API ─────────────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (startingRef.current) return; // double-tap guard — see startingRef above
    if (!recorderSupported()) {
      setState((s) => ({
        ...s,
        phase: "error",
        error:
          "This browser cannot record audio. Use the PracticePro app or a modern browser over HTTPS.",
      }));
      return;
    }
    startingRef.current = true;
    const clientLocalId = uuidv4();
    appendOffsetRef.current = 0;
    appendBaseDurationMsRef.current = 0;
    preAppendCaptureRef.current = null;
    try {
    activeIdRef.current = clientLocalId;
    pendingEnqueues.current.clear();
    await voiceSync.ensureCapture({
      clientLocalId,
      kind: "quick",
      outputMode: outputModeRef.current,
      startedAt: Date.now(),
      eventTypeNames: eventTypeNamesRef.current,
    });
    const rec = makeRecorder();
    recorderRef.current = rec;
    try {
      await rec.start();
      setState({
        phase: "recording",
        elapsedMs: 0,
        energy: 0,
        error: null,
        capture: null,
        queueStats: state.queueStats,
        clientLocalId,
        segmentCount: 0,
        appending: false,
      });
    } catch (err: any) {
      recorderRef.current = null;
      activeIdRef.current = null;
      await voiceSync.purgeCapture(clientLocalId).catch(() => undefined);
      setState((s) => ({
        ...s,
        phase: "error",
        error: err?.userMessage || "Could not start recording. Please try again.",
      }));
    }
    } finally {
      startingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makeRecorder]);

  /**
   * appendRecording — INCREMENTAL DICTATION ("Add More").
   *
   * Re-opens an ALREADY-FINALIZED capture (same clientLocalId) and records
   * another clip. The recorder's segment indexes are offset past the
   * capture's existing segments, so the new audio transcribes through the
   * same Whisper pipeline and the next finalize re-runs Smart Clean +
   * triage across the COMBINED verbatim. Unlimited rounds until the user
   * saves or resets.
   */
  const appendRecording = useCallback(
    async (args: {
      clientLocalId: string;
      /** How many segments the capture already holds (index offset). */
      existingSegmentCount: number;
      /** The capture's duration so far, so the card shows a running total. */
      existingDurationMs?: number | null;
      kind?: CaptureKind;
      outputMode?: OutputMode;
    }) => {
      if (startingRef.current) return; // double-tap guard
      if (recorderRef.current?.isActive()) return; // already recording
      if (!recorderSupported()) {
        setState((s) => ({
          ...s,
          phase: "error",
          error:
            "This browser cannot record audio. Use the PracticePro app or a modern browser over HTTPS.",
        }));
        return;
      }
      startingRef.current = true;
      try {
        activeIdRef.current = args.clientLocalId;
        pendingEnqueues.current.clear();
        appendOffsetRef.current = Math.max(0, args.existingSegmentCount);
        appendBaseDurationMsRef.current = Math.max(0, args.existingDurationMs ?? 0);
        preAppendCaptureRef.current = state.capture;
        // Recreates the local queue row (the previous round's row was
        // deleted after it finalized); closed stays false until stop.
        await voiceSync.ensureCapture({
          clientLocalId: args.clientLocalId,
          kind: args.kind ?? "quick",
          outputMode: args.outputMode ?? "smart-clean",
          startedAt: Date.now(),
          eventTypeNames: eventTypeNamesRef.current,
        });
        const rec = makeRecorder();
        recorderRef.current = rec;
        try {
          await rec.start();
          setState((s) => ({
            ...s,
            phase: "recording",
            elapsedMs: 0,
            energy: 0,
            error: null,
            clientLocalId: args.clientLocalId,
            segmentCount: appendOffsetRef.current,
            appending: true,
          }));
        } catch (err: any) {
          recorderRef.current = null;
          activeIdRef.current = null;
          appendOffsetRef.current = 0;
          appendBaseDurationMsRef.current = 0;
          const restore = preAppendCaptureRef.current;
          preAppendCaptureRef.current = null;
          await voiceSync
            .cancelAppendRound(args.clientLocalId, Math.max(0, args.existingSegmentCount))
            .catch(() => undefined);
          setState((s) => ({
            ...s,
            phase: restore ? "triage" : s.phase,
            capture: restore ?? s.capture,
            appending: false,
            error: err?.userMessage || "Could not start recording. Please try again.",
          }));
        }
      } finally {
        startingRef.current = false;
      }
    },
    [makeRecorder, state.capture, state.queueStats]
  );

  const cancelRecording = useCallback(async () => {
    const rec = recorderRef.current;
    const id = activeIdRef.current;
    const appending = appendOffsetRef.current > 0;
    const offset = appendOffsetRef.current;
    const restore = preAppendCaptureRef.current;
    if (rec) rec.cancel();
    recorderRef.current = null;
    activeIdRef.current = null;
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (appending && id) {
      // "Add More" cancel: discard ONLY this round — the original capture
      // and its transcript stay exactly as they were.
      appendOffsetRef.current = 0;
      appendBaseDurationMsRef.current = 0;
      preAppendCaptureRef.current = null;
      await voiceSync.cancelAppendRound(id, offset).catch(() => undefined);
      setState((s) => ({
        ...s,
        phase: restore ? "triage" : "idle",
        capture: restore ?? s.capture,
        appending: false,
        elapsedMs: 0,
        energy: 0,
        error: null,
        clientLocalId: null,
        segmentCount: restore?.segmentCount ?? 0,
      }));
      return;
    }
    appendOffsetRef.current = 0;
    appendBaseDurationMsRef.current = 0;
    preAppendCaptureRef.current = null;
    if (id) await voiceSync.purgeCapture(id).catch(() => undefined);
    setState((s) => ({ ...s, phase: "idle", elapsedMs: 0, energy: 0, error: null, clientLocalId: null, segmentCount: 0, appending: false }));
  }, []);

  const reset = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    activeIdRef.current = null;
    appendOffsetRef.current = 0;
    appendBaseDurationMsRef.current = 0;
    preAppendCaptureRef.current = null;
    setState((s) => ({ ...s, phase: "idle", elapsedMs: 0, energy: 0, error: null, capture: null, clientLocalId: null, segmentCount: 0, appending: false }));
  }, []);

  /** Re-open the triage card for a capture in the recent list. */
  const openCapture = useCallback(async (clientLocalId: string) => {
    appendOffsetRef.current = 0;
    appendBaseDurationMsRef.current = 0;
    preAppendCaptureRef.current = null;
    setState((s) => ({ ...s, phase: "processing", capture: null, clientLocalId, appending: false }));
    activeIdRef.current = clientLocalId;
    try {
      const capture = await getCaptureByLocalId(clientLocalId);
      if (capture?.status === "ready") {
        activeIdRef.current = null;
        setState((s) => ({ ...s, phase: "triage", capture }));
      } else {
        setState((s) => ({
          ...s,
          phase: capture ? "queued" : "idle",
          capture: null,
          error: capture ? null : "That capture is no longer on the server.",
        }));
      }
    } catch (err: any) {
      setState((s) => ({ ...s, phase: "error", error: String(err?.message || err) }));
    }
  }, []);

  return {
    ...state,
    supported: recorderSupported(),
    startRecording,
    appendRecording,
    stopRecording: stop,
    cancelRecording,
    reset,
    openCapture,
  };
}
