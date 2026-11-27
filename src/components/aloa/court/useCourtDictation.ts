/**
 * Round 19 — Court Mode dictation machinery.
 *
 * The Vox capture hook itself is UNCHANGED (useQuickCapture verbatim); this
 * wrapper preserves the pinned live-merge rules exactly (mergeLiveTranscriptDraft
 * with baseDraft / previousTranscript / manualEdits), the leave guard
 * (recording → stop and stay; queued/processing → blocked until the
 * transcript lands or the capture is discarded), the "Discard dictation and
 * leave" path and the Vox entitlement gate (canUseVox + VoxUpsellModal).
 *
 * ROUND 25 (ALOA Vox intelligence overhaul, owner bug report 2026-11-28): the
 * Whisper-Flow-style LLM CLEANUP PASS — the moment the dictated transcript
 * lands (capture → triage), the verbatim words pass through the SHARED
 * formatEndorsement engine (context "court_hearing"): legal homophone repair
 * ("hearing of emotion" → "hearing of motion", "council" → "counsel"),
 * stutter/false-start removal, formal register, and the standard courtroom
 * endorsement sequence — BEFORE the lawyer reviews and saves. The raw
 * transcript is preserved on the draft (rawTranscript) and stays accessible
 * in the composer; if the pass fails or the lawyer edits mid-flight, the
 * verbatim text is never lost. `runCleanup` re-runs it on demand.
 */
import { useEffect, useRef, useState } from "react";
import { Matter } from "../../../types";
import { useUI } from "../../../contexts/UIContext";
import { useFeatures } from "../../../hooks/useFeatures";
import { useQuickCapture } from "../../../hooks/useQuickCapture";
import { stampVoxUsedAt } from "../../../utils/voxUsageTracking";
import { mergeLiveTranscriptDraft, stripDictationFiller } from "../courtModeUtils";
import { StoredCourtDraft } from "./courtDrafts";
import { formatEndorsement } from "../../../services/voice/voiceCaptureService";

interface UseCourtDictationArgs {
  matter: Matter | null;
  drafts: Record<string, StoredCourtDraft>;
  setDraft: (matterId: string, draft: StoredCourtDraft | null) => void;
}

/** ROUND 25: the cleanup pass lifecycle surfaced to the composer. */
export type EndorsementCleanupPhase = "idle" | "cleaning" | "done" | "skipped" | "failed";

export function useCourtDictation({ matter, drafts, setDraft }: UseCourtDictationArgs) {
  const { addToast } = useUI();
  const { canUseVox } = useFeatures();
  const capture = useQuickCapture({ outputMode: "verbatim" });
  const [showVoxUpsell, setShowVoxUpsell] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [cleanupPhase, setCleanupPhase] = useState<EndorsementCleanupPhase>("idle");
  // ROUND 25 (FEATURE 6): the matter the current capture was dictated on —
  // the save-time Vox link only tags a capture recorded for THIS matter.
  const [dictatedMatterId, setDictatedMatterId] = useState<string | null>(null);
  const baseDraftRef = useRef("");
  const previousTranscriptRef = useRef("");
  const manualEditsRef = useRef(false);
  const recordingMatterIdRef = useRef("");
  // ROUND 25: one auto-cleanup per landed capture (by capture id, idempotent).
  const autoCleanedForRef = useRef<string | null>(null);
  const cleanupInFlightRef = useRef(false);
  const draftsRef = useRef(drafts);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);
  // Live transcript merge — the pinned rules, now landing in the persisted
  // per-matter draft. ROUND 23 (owner spec §3): only unambiguous spoken
  // filler ("uh", "um", "um, so…") drops as words land — every fact stays
  // exactly as spoken (the merge rules are UNCHANGED; the LLM cleanup pass
  // then runs ONCE on the landed transcript).
  useEffect(() => {
    const matterId = recordingMatterIdRef.current;
    if (!matterId || !capture.transcriptSoFar) return;
    const base = drafts[matterId];
    const merged = mergeLiveTranscriptDraft(
      base?.text || "",
      baseDraftRef.current,
      previousTranscriptRef.current,
      capture.transcriptSoFar,
      manualEditsRef.current,
    );
    previousTranscriptRef.current = merged.previousTranscript;
    setDraft(matterId, {
      text: stripDictationFiller(merged.draft),
      noteType: base?.noteType ?? "endorsement",
      nextDate: base?.nextDate ?? null,
      updatedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture.transcriptSoFar]);

  const recording = capture.phase === "recording";
  const waitingForTranscript = capture.phase === "processing" || capture.phase === "queued";
  const captureBusy = recording || waitingForTranscript;

  /**
   * ROUND 25: the cleanup pass — the shared LLM engine over the dictated
   * text. `snapshot` guards against overwriting fresher manual edits (the
   * result applies only when the draft still holds what was sent). The raw
   * transcript is preserved on the draft either way.
   */
  const runCleanup = async (options: { manual?: boolean } = {}): Promise<void> => {
    const matterId = recordingMatterIdRef.current || matter?.id;
    if (!matterId || cleanupInFlightRef.current) return;
    const current = draftsRef.current[matterId];
    const snapshot = (current?.text || "").trim();
    if (!snapshot) return;
    cleanupInFlightRef.current = true;
    setCleanupPhase("cleaning");
    try {
      const activeMatter = matter?.id === matterId ? matter : null;
      const { formatted } = await formatEndorsement({
        endorsementText: snapshot,
        matterTitle: activeMatter?.title,
        matterSuitNumber: activeMatter?.suitNumber,
        context: "court_hearing",
      });
      const latest = draftsRef.current[matterId];
      const stillCurrent = (latest?.text || "").trim() === snapshot;
      if (stillCurrent && formatted && formatted !== snapshot) {
        setDraft(matterId, {
          text: formatted,
          noteType: latest?.noteType ?? "endorsement",
          nextDate: latest?.nextDate ?? null,
          updatedAt: Date.now(),
          rawTranscript: latest?.rawTranscript ?? snapshot,
        });
        setCleanupPhase("done");
        if (options.manual) addToast("Endorsement cleaned up — review before saving.", { type: "success" });
      } else if (!stillCurrent) {
        // The lawyer's fresher edits win — never clobber them.
        setCleanupPhase("skipped");
      } else {
        // The engine returned the text unchanged — nothing was lost.
        setDraft(matterId, {
          text: latest?.text ?? snapshot,
          noteType: latest?.noteType ?? "endorsement",
          nextDate: latest?.nextDate ?? null,
          updatedAt: Date.now(),
          rawTranscript: latest?.rawTranscript ?? snapshot,
        });
        setCleanupPhase("done");
      }
    } catch (error) {
      console.error("[AloaCourtMode] Endorsement cleanup pass failed:", error);
      setCleanupPhase("failed");
      if (options.manual) addToast("Cleanup failed — your words are unchanged.", { type: "error" });
    } finally {
      cleanupInFlightRef.current = false;
    }
  };

  // AUTO-PASS (ROUND 25): the transcript landed (capture ready) → clean it
  // once. The lawyer still reviews/edits before saving — the raw transcript
  // stays on the draft for the composer's disclosure.
  useEffect(() => {
    if (capture.phase !== "triage" || !capture.transcriptSoFar) return;
    const captureId = capture.capture?.clientLocalId || capture.clientLocalId;
    if (!captureId || autoCleanedForRef.current === captureId) return;
    autoCleanedForRef.current = captureId;
    void runCleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture.phase, capture.transcriptSoFar]);

  const markManualEdits = () => {
    if (captureBusy) manualEditsRef.current = true;
  };

  const startDictation = () => {
    if (!matter) return;
    if (!canUseVox) {
      setShowVoxUpsell(true);
      return;
    }
    stampVoxUsedAt();
    recordingMatterIdRef.current = matter.id;
    setDictatedMatterId(matter.id);
    baseDraftRef.current = drafts[matter.id]?.text || "";
    previousTranscriptRef.current = "";
    manualEditsRef.current = false;
    autoCleanedForRef.current = null;
    setCleanupPhase("idle");
    setCaptureError(null);
    void capture.startRecording().catch((error: unknown) => {
      console.error("[AloaCourtMode] Failed to start Vox dictation:", error);
      setCaptureError("Could not start dictation. Check microphone access and try again.");
    });
  };

  const stopDictation = async (): Promise<boolean> => {
    try {
      await capture.stopRecording();
      setCaptureError(null);
      return true;
    } catch (error) {
      console.error("[AloaCourtMode] Failed to stop Vox dictation:", error);
      setCaptureError("Could not finish dictation. Please try stopping again.");
      return false;
    }
  };

  // Preserved guard: recording → stop and stay; waiting for the transcript →
  // blocked until it lands or is discarded; otherwise leave.
  const leaveGuard = (leave: () => void) => {
    if (recording) {
      void stopDictation().then((stopped) => {
        if (stopped) addToast("Dictation stopped. Review the transcript before leaving Court Mode.", { type: "info" });
      });
      return;
    }
    if (waitingForTranscript) {
      addToast("Wait for transcription to finish before leaving, or discard the queued capture.", { type: "info" });
      return;
    }
    leave();
  };

  const discardDictation = async (after: () => void) => {
    if (capture.phase !== "queued" && capture.phase !== "processing") return;
    try {
      await capture.cancelRecording();
      recordingMatterIdRef.current = "";
      previousTranscriptRef.current = "";
      addToast("Queued dictation discarded.", { type: "info" });
      after();
    } catch (error) {
      console.error("[AloaCourtMode] Failed to discard Vox dictation:", error);
      setCaptureError("Could not discard the queued dictation.");
    }
  };

  return {
    capture,
    captureError,
    captureBusy,
    recording,
    waitingForTranscript,
    canUseVox,
    showVoxUpsell,
    setShowVoxUpsell,
    markManualEdits,
    startDictation,
    stopDictation,
    leaveGuard,
    discardDictation,
    // ROUND 25: the LLM cleanup pass — auto-runs when a transcript lands,
    // re-runnable on demand ("Clean up with AI") — and the matter the current
    // capture was dictated on (guards the save-time Court ↔ Vox link).
    cleanupPhase,
    runCleanup,
    dictatedMatterId,
  };
}
