/**
 * Round 19 — Court Mode dictation machinery.
 *
 * The Vox capture hook itself is UNCHANGED (useQuickCapture verbatim); this
 * wrapper preserves the pinned live-merge rules exactly (mergeLiveTranscriptDraft
 * with baseDraft / previousTranscript / manualEdits), the leave guard
 * (recording → stop and stay; queued/processing → blocked until the
 * transcript lands or the capture is discarded), the "Discard dictation and
 * leave" path and the Vox entitlement gate (canUseVox + VoxUpsellModal).
 */
import { useEffect, useRef, useState } from "react";
import { Matter } from "../../../types";
import { useUI } from "../../../contexts/UIContext";
import { useFeatures } from "../../../hooks/useFeatures";
import { useQuickCapture } from "../../../hooks/useQuickCapture";
import { stampVoxUsedAt } from "../../../utils/voxUsageTracking";
import { mergeLiveTranscriptDraft, stripDictationFiller } from "../courtModeUtils";
import { StoredCourtDraft } from "./courtDrafts";

interface UseCourtDictationArgs {
  matter: Matter | null;
  drafts: Record<string, StoredCourtDraft>;
  setDraft: (matterId: string, draft: StoredCourtDraft | null) => void;
}

export function useCourtDictation({ matter, drafts, setDraft }: UseCourtDictationArgs) {
  const { addToast } = useUI();
  const { canUseVox } = useFeatures();
  const capture = useQuickCapture({ outputMode: "verbatim" });
  const [showVoxUpsell, setShowVoxUpsell] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const baseDraftRef = useRef("");
  const previousTranscriptRef = useRef("");
  const manualEditsRef = useRef(false);
  const recordingMatterIdRef = useRef("");

  // Live transcript merge — the pinned rules, now landing in the persisted
  // per-matter draft (kept exactly as the previous monolith ran it).
  // ROUND 23 (owner spec §3): the dictated words lose only unambiguous
  // spoken filler ("uh", "um", "um, so…") as they land, so the lawyer reviews
  // a clean endorsement in the composer; every fact stays exactly as spoken.
  // The pinned merge rules themselves are UNCHANGED (the strip is applied
  // outside mergeLiveTranscriptDraft, after the merge).
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
    baseDraftRef.current = drafts[matter.id]?.text || "";
    previousTranscriptRef.current = "";
    manualEditsRef.current = false;
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
  };
}
