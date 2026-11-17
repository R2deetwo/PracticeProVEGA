/**
 * useLegalPadSession — the Hybrid Legal Pad (consultation & evidence mode).
 *
 * A distraction-free notepad where the lawyer types shorthand while audio
 * records continuously in the background (pause/resume supported, segments
 * flushed to IndexedDB as they close so long recordings never crash into
 * data loss). Two-tier storage: the original timestamped audio segments are
 * archived server-side alongside the word-for-word VERBATIM transcript; the
 * polished tier for this mode is the merged summary that weaves the typed
 * shorthand with the spoken record.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  VoiceRecorder,
  VoiceRecorderError,
  recorderSupported,
  type RecorderSegment,
} from "../services/voice/audioRecorder";
import { voiceSync } from "../services/voice/audioQueue";
import {
  getCaptureByLocalId,
  saveShorthand,
  type CaptureProjection,
} from "../services/voice/voiceCaptureService";

export type LegalPadPhase =
  | "idle"
  | "recording"
  | "paused"
  | "processing" // stopped; uploading + finalizing (merge)
  | "queued" // stopped offline — saved on device
  | "result" // merged summary ready
  | "error";

export interface LegalPadState {
  phase: LegalPadPhase;
  elapsedMs: number;
  energy: number;
  error: string | null;
  capture: CaptureProjection | null;
  clientLocalId: string | null;
  segmentCount: number;
  verbatimSoFar: string;
}

const SHORTHAND_KEY_PREFIX = "practicepro_legalpad_shorthand_";

export function useLegalPadSession() {
  const [state, setState] = useState<LegalPadState>({
    phase: "idle",
    elapsedMs: 0,
    energy: 0,
    error: null,
    capture: null,
    clientLocalId: null,
    segmentCount: 0,
    verbatimSoFar: "",
  });
  const [shorthand, setShorthandState] = useState("");

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const pendingEnqueues = useRef<Set<Promise<void>>>(new Set());
  const activeIdRef = useRef<string | null>(null);
  const shorthandSaveTimer = useRef<number | null>(null);
  const mutationSaveTimer = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  // ─── Sync events: live verbatim + completion ────────────────────────────
  useEffect(() => {
    void voiceSync.start();
    const unsub = voiceSync.subscribe((e) => {
      if (!e.clientLocalId || e.clientLocalId !== activeIdRef.current) return;
      if (e.type === "segment-uploaded" && e.verbatimSoFar) {
        setState((s) => ({ ...s, verbatimSoFar: e.verbatimSoFar || s.verbatimSoFar }));
      }
      if (e.type === "ready") {
        getCaptureByLocalId(e.clientLocalId)
          .then((capture) => {
            if (!capture) return;
            activeIdRef.current = null;
            setState((s) => ({ ...s, phase: "result", capture, error: null }));
          })
          .catch(() => undefined);
      }
      if (e.type === "finalize-error") {
        setState((s) => ({ ...s, error: e.error || "Processing failed — will retry automatically." }));
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    return () => {
      recorderRef.current?.destroy();
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (shorthandSaveTimer.current) window.clearTimeout(shorthandSaveTimer.current);
      if (mutationSaveTimer.current) window.clearTimeout(mutationSaveTimer.current);
    };
  }, []);

  // ─── Shorthand autosave (localStorage always; server when online) ───────
  const setShorthand = useCallback((text: string) => {
    setShorthandState(text);
    const id = activeIdRef.current;
    if (!id) return;
    // Crash safety: local copy within 500ms.
    if (shorthandSaveTimer.current) window.clearTimeout(shorthandSaveTimer.current);
    shorthandSaveTimer.current = window.setTimeout(() => {
      try { localStorage.setItem(SHORTHAND_KEY_PREFIX + id, text); } catch { /* quota */ }
      void voiceSync.updateShorthand(id, text).catch(() => undefined);
    }, 500);
    // Server copy (debounced 5s) so the offline finalize carries it too —
    // the queue's capture record also gets it via updateShorthand above.
    if (mutationSaveTimer.current) window.clearTimeout(mutationSaveTimer.current);
    mutationSaveTimer.current = window.setTimeout(() => {
      if (typeof navigator === "undefined" || !navigator.onLine) return;
      saveShorthand(id, text).catch(() => undefined);
    }, 5000);
  }, []);

  // ─── Recorder plumbing ──────────────────────────────────────────────────

  const handleSegment = useCallback((seg: RecorderSegment) => {
    const id = activeIdRef.current;
    if (!id) return;
    const p = voiceSync
      .enqueueSegment({
        clientLocalId: id,
        segmentIndex: seg.index,
        blob: seg.blob,
        startMs: seg.startMs,
        endMs: seg.endMs,
      })
      .catch(() => undefined);
    pendingEnqueues.current.add(p);
    p.finally(() => pendingEnqueues.current.delete(p));
    setState((s) => ({ ...s, segmentCount: seg.index + 1 }));
  }, []);

  const stop = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    setState((s) => ({ ...s, phase: "processing" }));
    await rec.stop();
    await Promise.all(Array.from(pendingEnqueues.current));
    const id = activeIdRef.current;
    if (!id) return;
    const finalShorthand = shorthand;
    await voiceSync.closeCapture({
      clientLocalId: id,
      segmentCount: Math.max(rec.getSegmentCount(), 1),
      totalDurationMs: Math.max(rec.getRecordedMs(), 500),
      shorthandText: finalShorthand,
    });
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState((s) => ({ ...s, phase: "queued", energy: 0 }));
    } else {
      pollRef.current = window.setInterval(() => {
        const cid = activeIdRef.current;
        if (!cid) return;
        getCaptureByLocalId(cid)
          .then((capture) => {
            if (capture?.status === "ready") {
              if (pollRef.current) window.clearInterval(pollRef.current);
              pollRef.current = null;
              activeIdRef.current = null;
              setState((s) => ({ ...s, phase: "result", capture }));
            }
          })
          .catch(() => undefined);
      }, 4000);
    }
  }, [shorthand]);

  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const makeRecorder = useCallback((): VoiceRecorder => {
    return new VoiceRecorder({
      segmentMs: 60_000,
      onSegment: handleSegment,
      onEnergy: (level) => setState((s) => ({ ...s, energy: level })),
      onTick: (ms) => setState((s) => ({ ...s, elapsedMs: ms })),
      onError: (err: VoiceRecorderError) => {
        const hadSegments = recorderRef.current?.getSegmentCount() ?? 0;
        setState((s) => ({
          ...s,
          error: err.userMessage,
        }));
        if (hadSegments > 0) {
          // Something was captured — save + finalize it rather than losing
          // the whole consultation to a mid-session mic failure.
          void stopRef.current();
        } else {
          // Nothing usable — purge the orphaned capture row.
          const cid = activeIdRef.current;
          activeIdRef.current = null;
          setState((s) => ({ ...s, phase: "error" }));
          if (cid) void voiceSync.purgeCapture(cid).catch(() => undefined);
        }
      },
      onStreamEnded: () => {
        void stopRef.current();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSegment]);

  // Auto-pause when the page is hidden mid-session: mobile browsers freeze
  // timers and sometimes kill the recorder silently in the background —
  // pausing (with segments already safe) is strictly better than dead air.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && recorderRef.current?.getStatus() === "recording") {
        recorderRef.current.pause();
        setState((s) => (s.phase === "recording" ? { ...s, phase: "paused" } : s));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // ─── Public API ─────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (!recorderSupported()) {
      setState((s) => ({
        ...s,
        phase: "error",
        error: "This browser cannot record audio. Use the PracticePro app or a modern browser over HTTPS.",
      }));
      return;
    }
    const clientLocalId = uuidv4();
    activeIdRef.current = clientLocalId;
    pendingEnqueues.current.clear();
    await voiceSync.ensureCapture({
      clientLocalId,
      kind: "legalpad",
      outputMode: "verbatim", // evidentiary tier stays word-for-word; the merge is the polish tier
      startedAt: Date.now(),
    });
    const rec = makeRecorder();
    recorderRef.current = rec;
    try {
      await rec.start();
      setShorthandState("");
      setState({
        phase: "recording",
        elapsedMs: 0,
        energy: 0,
        error: null,
        capture: null,
        clientLocalId,
        segmentCount: 0,
        verbatimSoFar: "",
      });
    } catch (err: any) {
      recorderRef.current = null;
      activeIdRef.current = null;
      await voiceSync.purgeCapture(clientLocalId).catch(() => undefined);
      setState((s) => ({ ...s, phase: "error", error: err?.userMessage || "Could not start recording." }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makeRecorder]);

  const pause = useCallback(() => {
    recorderRef.current?.pause();
    setState((s) => (s.phase === "recording" ? { ...s, phase: "paused" } : s));
  }, []);

  const resume = useCallback(() => {
    recorderRef.current?.resume();
    setState((s) => (s.phase === "paused" ? { ...s, phase: "recording" } : s));
  }, []);

  const discard = useCallback(async () => {
    const rec = recorderRef.current;
    const id = activeIdRef.current;
    if (rec) rec.cancel();
    recorderRef.current = null;
    activeIdRef.current = null;
    if (id) {
      await voiceSync.purgeCapture(id).catch(() => undefined);
      try { localStorage.removeItem(SHORTHAND_KEY_PREFIX + id); } catch { /* ignore */ }
    }
    if (pollRef.current) window.clearInterval(pollRef.current);
    setShorthandState("");
    setState({
      phase: "idle",
      elapsedMs: 0,
      energy: 0,
      error: null,
      capture: null,
      clientLocalId: null,
      segmentCount: 0,
      verbatimSoFar: "",
    });
  }, []);

  const reset = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    activeIdRef.current = null;
    setState((s) => ({ ...s, phase: "idle", capture: null, clientLocalId: null }));
  }, []);

  return {
    ...state,
    shorthand,
    setShorthand,
    supported: recorderSupported(),
    start,
    pause,
    resume,
    stop,
    discard,
    reset,
  };
}
