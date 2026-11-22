/**
 * useVoxSession — the Legal Session Capture state machine (Mode B of the
 * dual-mode Vox, owner spec 2026-11-22).
 *
 * Setup (title / matter / session type) → recording (segmented recorder,
 * offline-first queue) → processing (upload + diarized transcription +
 * finalize: speaker reconcile + file note / action items / issue map) →
 * the ready session view. An UPLOADED audio file flows through the same
 * pipeline (sliced client-side into 60 s WAV segments).
 *
 * The recording machinery mirrors useLegalPadSession (same recorder, same
 * IndexedDB queue, same never-lose-a-recording guarantee) but finalizes
 * through the voxSessions backend and surfaces the full session view
 * (transcript turns + outputs) instead of a triage card.
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
  getVoxSession,
  deleteVoxSession,
  type VoxSessionType,
  type VoxSessionView,
} from "../services/voice/voxSessionService";
import { sliceAudioFileToSegments } from "../services/voice/audioSlicer";

export type VoxSessionPhase =
  | "setup" // the pre-capture sheet (context tagging)
  | "recording" // mic live
  | "uploading" // a file upload is being sliced + enqueued
  | "paused" // mic paused mid-session
  | "processing" // uploading + transcribing + synthesizing
  | "queued" // stopped offline — saved on device, will process on reconnect
  | "ready" // the full session view (transcript + outputs)
  | "error";

export interface VoxSessionContext {
  title: string;
  sessionType: VoxSessionType;
  matterId: string;
  retentionDays: number;
}

export interface VoxSessionState {
  phase: VoxSessionPhase;
  elapsedMs: number;
  energy: number;
  error: string | null;
  session: VoxSessionView | null;
  clientLocalId: string | null;
  segmentCount: number;
  /** Live transcript text so far (accumulates as segments upload). */
  transcriptSoFar: string;
}

export function useVoxSession() {
  const [state, setState] = useState<VoxSessionState>({
    phase: "setup",
    elapsedMs: 0,
    energy: 0,
    error: null,
    session: null,
    clientLocalId: null,
    segmentCount: 0,
    transcriptSoFar: "",
  });
  const [context, setContextState] = useState<VoxSessionContext>({
    title: "",
    sessionType: "intake",
    matterId: "",
    retentionDays: 0,
  });

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const pendingEnqueues = useRef<Set<Promise<void>>>(new Set());
  const activeIdRef = useRef<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const startingRef = useRef(false);
  const contextRef = useRef(context);
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  /** Enter the ready view for an existing session (the sessions list). */
  const loadSession = useCallback(async (clientLocalId: string) => {
    setState((s) => ({ ...s, phase: "processing", session: null, clientLocalId, error: null }));
    try {
      const session = await getVoxSession(clientLocalId);
      if (session && (session.status === "ready" || session.turns?.length)) {
        setState((s) => ({ ...s, phase: "ready", session }));
      } else {
        setState((s) => ({
          ...s,
          phase: session ? "queued" : "error",
          session: null,
          error: session ? null : "That session is no longer on the server.",
        }));
      }
    } catch (err: any) {
      setState((s) => ({ ...s, phase: "error", error: String(err?.message || err) }));
    }
  }, []);

  /** Re-pull the current session (after a rename / toggle / draft). */
  const refresh = useCallback(async () => {
    const id = activeIdRef.current || state.clientLocalId;
    if (!id) return;
    try {
      const session = await getVoxSession(id);
      if (session) setState((s) => ({ ...s, session }));
    } catch { /* keep the stale view */ }
  }, [state.clientLocalId]);

  // ─── Sync events: live transcript + completion ────────────────────────────
  useEffect(() => {
    void voiceSync.start();
    const unsub = voiceSync.subscribe((e) => {
      if (!e.clientLocalId || e.clientLocalId !== activeIdRef.current) return;
      if (e.type === "segment-uploaded") {
        const soFar = (e as any).verbatimSoFar;
        if (typeof soFar === "string" && soFar) {
          setState((s) => ({ ...s, transcriptSoFar: soFar }));
        }
      }
      if (e.type === "ready") {
        void loadSession(e.clientLocalId!);
      }
      if (e.type === "finalize-error") {
        const msg = e.error || "Processing failed — will retry automatically.";
        if (/no speech was detected|session not found/i.test(msg)) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          activeIdRef.current = null;
          setState((s) => ({ ...s, phase: "error", error: msg, clientLocalId: null }));
          return;
        }
        setState((s) =>
          s.phase === "processing" || s.phase === "queued"
            ? { ...s, error: msg }
            : s
        );
      }
    });
    return unsub;
  }, [loadSession]);

  useEffect(() => {
    return () => {
      recorderRef.current?.destroy();
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  // Auto-pause when the page is hidden mid-session (same guard as the pad).
  useEffect(() => {
    const onVisibility = () => {
      if (
        document.visibilityState === "hidden" &&
        recorderRef.current?.getStatus() === "recording"
      ) {
        recorderRef.current.pause();
        setState((s) => (s.phase === "recording" ? { ...s, phase: "paused" } : s));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const setContext = useCallback((patch: Partial<VoxSessionContext>) => {
    setContextState((c) => ({ ...c, ...patch }));
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
    const ctx = contextRef.current;
    await voiceSync.closeCapture({
      clientLocalId: id,
      segmentCount: Math.max(rec.getSegmentCount(), 1),
      totalDurationMs: Math.max(rec.getRecordedMs(), 500),
    });
    void ctx;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState((s) => ({ ...s, phase: "queued", energy: 0 }));
    } else {
      pollRef.current = window.setInterval(() => {
        const cid = activeIdRef.current;
        if (!cid) return;
        getVoxSession(cid)
          .then((session) => {
            if (session?.status === "ready") {
              if (pollRef.current) window.clearInterval(pollRef.current);
              pollRef.current = null;
              activeIdRef.current = null;
              setState((s) => ({ ...s, phase: "ready", session }));
            }
          })
          .catch(() => undefined);
      }, 4000);
    }
  }, []);

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
        setState((s) => ({ ...s, error: err.userMessage }));
        if (hadSegments > 0) {
          void stopRef.current();
        } else {
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

  // ─── Public API ─────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (startingRef.current) return;
    if (!recorderSupported()) {
      setState((s) => ({
        ...s,
        phase: "error",
        error: "This browser cannot record audio. Use the PracticePro app or a modern browser over HTTPS.",
      }));
      return;
    }
    startingRef.current = true;
    const clientLocalId = uuidv4();
    try {
      activeIdRef.current = clientLocalId;
      pendingEnqueues.current.clear();
      const ctx = contextRef.current;
      await voiceSync.ensureCapture({
        clientLocalId,
        kind: "session",
        outputMode: "verbatim", // evidentiary discipline: the transcript is never reworded
        startedAt: Date.now(),
        sessionMeta: {
          title: ctx.title || undefined,
          sessionType: ctx.sessionType,
          matterId: ctx.matterId || undefined,
          captureSource: "mic",
          retentionDays: ctx.retentionDays || undefined,
        },
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
          session: null,
          clientLocalId,
          segmentCount: 0,
          transcriptSoFar: "",
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

  /** Upload an audio FILE as a session (sliced into 60 s segments, then the
   *  same queue + finalize pipeline as a live recording). */
  const uploadFile = useCallback(async (file: Blob) => {
    if (startingRef.current) return;
    startingRef.current = true;
    const clientLocalId = uuidv4();
    try {
      setState((s) => ({ ...s, phase: "uploading", error: null, transcriptSoFar: "" }));
      const sliced = await sliceAudioFileToSegments(file);
      activeIdRef.current = clientLocalId;
      pendingEnqueues.current.clear();
      const ctx = contextRef.current;
      await voiceSync.ensureCapture({
        clientLocalId,
        kind: "session",
        outputMode: "verbatim",
        startedAt: Date.now(),
        sessionMeta: {
          title: ctx.title || undefined,
          sessionType: ctx.sessionType,
          matterId: ctx.matterId || undefined,
          captureSource: "upload",
          retentionDays: ctx.retentionDays || undefined,
        },
      });
      for (let i = 0; i < sliced.segments.length; i++) {
        const seg = sliced.segments[i];
        const p = voiceSync
          .enqueueSegment({
            clientLocalId,
            segmentIndex: i,
            blob: seg.blob,
            startMs: seg.startMs,
            endMs: seg.endMs,
          })
          .catch(() => undefined);
        pendingEnqueues.current.add(p);
        p.finally(() => pendingEnqueues.current.delete(p));
        setState((s) => ({ ...s, segmentCount: i + 1, elapsedMs: seg.endMs }));
      }
      await Promise.all(Array.from(pendingEnqueues.current));
      await voiceSync.closeCapture({
        clientLocalId,
        segmentCount: sliced.segments.length,
        totalDurationMs: sliced.durationMs,
      });
      setState((s) => ({ ...s, phase: "processing", energy: 0 }));
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setState((s) => ({ ...s, phase: "queued" }));
      } else {
        pollRef.current = window.setInterval(() => {
          const cid = activeIdRef.current;
          if (!cid) return;
          getVoxSession(cid)
            .then((session) => {
              if (session?.status === "ready") {
                if (pollRef.current) window.clearInterval(pollRef.current);
                pollRef.current = null;
                activeIdRef.current = null;
                setState((s) => ({ ...s, phase: "ready", session }));
              }
            })
            .catch(() => undefined);
        }, 4000);
      }
    } catch (err: any) {
      const cid = activeIdRef.current;
      activeIdRef.current = null;
      if (cid) void voiceSync.purgeCapture(cid).catch(() => undefined);
      setState((s) => ({
        ...s,
        phase: "error",
        error: err?.message || "Could not process that audio file.",
      }));
    } finally {
      startingRef.current = false;
    }
  }, []);

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
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (id) await voiceSync.purgeCapture(id).catch(() => undefined);
    setState({
      phase: "setup",
      elapsedMs: 0,
      energy: 0,
      error: null,
      session: null,
      clientLocalId: null,
      segmentCount: 0,
      transcriptSoFar: "",
    });
  }, []);

  /** Leave the ready view back to setup (the session stays on the server). */
  const reset = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    activeIdRef.current = null;
    setState((s) => ({ ...s, phase: "setup", session: null, clientLocalId: null }));
  }, []);

  /** Delete the CURRENT session entirely (audio + row + search chunks).
   *  The local queue records go too — an in-flight segment for a deleted
   *  session would otherwise dead-letter with a confusing error. */
  const remove = useCallback(async (clientLocalId: string) => {
    await deleteVoxSession(clientLocalId).catch(() => undefined);
    await voiceSync.purgeCapture(clientLocalId).catch(() => undefined);
    setState((s) => ({
      ...s,
      phase: "setup",
      session: null,
      clientLocalId: null,
      transcriptSoFar: "",
    }));
  }, []);

  return {
    ...state,
    context,
    setContext,
    supported: recorderSupported(),
    startRecording,
    uploadFile,
    pause,
    resume,
    stop,
    discard,
    reset,
    remove,
    loadSession,
    refresh,
  };
}
