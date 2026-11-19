/**
 * QuickCaptureView — the lightweight, mobile-first capture surface.
 *
 * Owner addendum (2026-11-18, "startup default, ALOA placement & one-tap
 * launch preference"):
 *   - The app boots into the FULL OFFICE for everyone; Quick Capture is
 *     never forced. A header toggle — "Start in Quick Capture on mobile",
 *     OFF by default — lets each user opt their phone into landing here.
 *   - A persistent "Full Office" button stays in the top corner (1 tap
 *     back to the dashboard).
 *   - The same surface renders EMBEDDED inside the ALOA panel (props:
 *     `embedded`, `onBackToChat`, `onExitEmbedded`) so voice, dictation
 *     and AI workflows share one unified home.
 *
 * Two complementary workflows:
 *   A. SPEAK FIRST, ROUTE LATER (walkie-talkie) — search/ask bar on top,
 *      one big record button, smart post-capture triage.
 *   B. HYBRID LEGAL PAD — toggle for consultations / witness interviews /
 *      field evidence.
 *
 * Deleting captures is a first-class action (owner report 2026-11-18: "how
 * do we delete a quick capture? it is not obvious"): every Recent voice
 * note row carries a trash button (two-tap confirm), and the triage card
 * has a Discard action. Deleting removes the capture row + archived audio;
 * notes already saved to a matter are separate records and stay.
 *
 * Design principles: light-mode, uncluttered, large tap targets, one-handed
 * use. Never force forms before capture — capture first, organize in one
 * tap afterwards.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import {
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardIcon,
  CogIcon,
  DocumentTextIcon,
  MicrophoneIcon,
  SparklesIcon,
  StopIcon,
  TrashIcon,
  XMarkIcon,
} from "../../constants";
import { useUI } from "../../contexts/UIContext";
import { useAuth } from "../../contexts/AuthContext";
import { useCoreState } from "../../contexts/CoreContext";
import { useMatterState } from "../../contexts/MatterContext";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useQuickCapture } from "../../hooks/useQuickCapture";
import { MATTERS_NOTEBOOK_ID } from "../../constants";
import {
  quickAsk,
  listRecentCaptures,
  deleteCapture,
  editSelection as editSelectionService,
  type CaptureProjection,
  type QuickAskResult,
} from "../../services/voice/voiceCaptureService";
import { voiceSync } from "../../services/voice/audioQueue";
import {
  getStartupViewPreference,
  setStartupViewPreference,
} from "../../utils/startupViewPreference";
import { extractNewClipText, joinDraftText } from "../../services/voice/draftUtils";
import { VoiceTipsPanel } from "./VoiceTipsPanel";
import { TriageCard } from "./TriageCard";
import { QuickAskActions } from "./QuickAskActions";
import { LegalPadView } from "./LegalPadView";

const formatMs = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const INTENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  case_note: DocumentTextIcon,
  schedule: CalendarIcon,
  question: SparklesIcon,
  share: ClipboardIcon,
};

type CaptureMode = "speak" | "pad";

/** Which transcript tier the editable draft follows. "clean" now seeds
 *  from the FORMATTED tier (triageMeta.caseNoteText — destination-formatted,
 *  meta-speech stripped) and falls back to Smart Clean, then verbatim. */
type DraftSource = "clean" | "verbatim";

/** The preferred formatted text for a capture: the analysis' formatted case
 *  note body when present, else Smart Clean, else verbatim (pure helper). */
function formattedTierText(capture: CaptureProjection | null): string {
  if (!capture) return "";
  return (
    capture.triageMeta?.caseNoteText ||
    capture.smartCleanText ||
    capture.verbatimText ||
    ""
  );
}

/** Whisper Mode persistence (owner spec 2026-11-19 §5) — local preference. */
const WHISPER_PREF_KEY = "practicepro_whisper_mode";
function readWhisperPref(): boolean {
  try {
    return localStorage.getItem(WHISPER_PREF_KEY) === "1";
  } catch {
    return false;
  }
}
function writeWhisperPref(on: boolean): void {
  try {
    localStorage.setItem(WHISPER_PREF_KEY, on ? "1" : "0");
  } catch { /* private mode etc. */ }
}

/** Phone-like device? Same heuristic the boot redirect in App.tsx uses. */
function useIsPhoneLike(): boolean {
  const [isPhone, setIsPhone] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.innerWidth < 768 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    );
  });
  useEffect(() => {
    const onResize = () =>
      setIsPhone(
        window.innerWidth < 768 ||
          /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      );
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isPhone;
}

export interface QuickCaptureViewProps {
  /** Render inside the ALOA side panel instead of as a full-screen view. */
  embedded?: boolean;
  /** Embedded only: return to the ALOA chat interface. */
  onBackToChat?: () => void;
  /** Embedded only: leave the panel for the full office (parent closes it). */
  onExitEmbedded?: () => void;
}

export const QuickCaptureView: React.FC<QuickCaptureViewProps> = ({
  embedded = false,
  onBackToChat,
  onExitEmbedded,
}) => {
  const { navigateTo, addToast, setMobileSearchOpen } = useUI();
  const { currentUser } = useAuth();
  const { coreState } = useCoreState();
  const { matterState } = useMatterState();
  const { light, medium } = useHapticFeedback();

  const [mode, setMode] = useState<CaptureMode>("speak");
  const [askText, setAskText] = useState("");
  const [askResult, setAskResult] = useState<QuickAskResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [recent, setRecent] = useState<CaptureProjection[]>([]);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const isPhoneLike = useIsPhoneLike();

  // ── "Start in Quick Capture on mobile" (owner addendum 2026-11-18).
  //    OFF by default — everyone lands on the Full Office dashboard first.
  //    Flipping it ON stores 'capture' for this account (localStorage, same
  //    key Settings → Display uses); future MOBILE launches bypass the
  //    dashboard. Per-account, instant local read, no network round trip.
  const [startInQuickCapture, setStartInQuickCapture] = useState(false);
  useEffect(() => {
    setStartInQuickCapture(
      getStartupViewPreference(currentUser?.id) === "capture"
    );
  }, [currentUser?.id]);
  const handleToggleStartup = useCallback(() => {
    if (!currentUser?.id) {
      addToast("Sign in to remember your launch preference.", { type: "info" });
      return;
    }
    const next = !startInQuickCapture;
    setStartInQuickCapture(next);
    setStartupViewPreference(currentUser.id, next ? "capture" : "office");
    addToast(
      next
        ? "Mobile launches will open straight into Quick Capture."
        : "Mobile launches will open the Full Office dashboard first.",
      { type: "success" }
    );
  }, [currentUser?.id, startInQuickCapture, addToast]);

  // ─── INCREMENTAL DICTATION — the draft lives HERE (the parent) so it ─────
  //    survives the Add More recording round, during which the TriageCard
  //    unmounts and the phase machine passes through recording/processing.
  const [draftText, setDraftText] = useState("");
  const [draftSource, setDraftSource] = useState<DraftSource>("clean");
  const [clipCount, setClipCount] = useState(1);
  /** Verbatim as of the last backend sync — the prefix used to isolate the
   *  newest clip's words when an Add More round finalizes. */
  const lastSyncedVerbatimRef = useRef<string>("");
  /** Set while the user has hand-edited the draft (append keeps their edits). */
  const draftEditedRef = useRef(false);
  /** EDIT SELECTION BY VOICE (owner spec 2026-11-19 §6): when set, the next
   *  finalized clip is treated as a spoken EDIT COMMAND for the passage in
   *  [start, end) of the current draft — rewritten in place via the
   *  editSelection action instead of appended. */
  const pendingSelectionEditRef = useRef<{ start: number; end: number } | null>(null);
  const [selectionEditBusy, setSelectionEditBusy] = useState(false);
  /** WHISPER MODE (§5): persisted local preference, threaded into the
   *  capture hook so the next recording uses quiet-speech constraints. */
  const [whisperMode, setWhisperMode] = useState(readWhisperPref);
  /** Voice Tips panel (Part 3). */
  const [showTips, setShowTips] = useState(false);
  const toastRef = useRef(addToast);
  useEffect(() => {
    toastRef.current = addToast;
  }, [addToast]);

  const eventTypeNames = useMemo(
    () => (coreState.eventTypes || []).map((t) => t.name).filter(Boolean) as string[],
    [coreState.eventTypes]
  );

  const qc = useQuickCapture({
    eventTypeNames,
    whisper: whisperMode,
    onReadyToast: () => {
      addToast("Voice note ready — tap to review it.", { type: "success" });
    },
  });

  const toggleWhisperMode = useCallback(() => {
    setWhisperMode((prev) => {
      const next = !prev;
      writeWhisperPref(next);
      addToast(
        next
          ? "Whisper Mode on — quiet speech is captured cleanly."
          : "Whisper Mode off — standard noise filtering.",
        { type: "success" }
      );
      return next;
    });
  }, [addToast]);

  // ─── Draft syncing: seed on first arrival, append on Add More rounds ──────
  // The verbatim tier is append-only and immutable, so `lastSyncedVerbatim`
  // is always a prefix of the new verbatim — extractNewClipText isolates the
  // newest clip's words. Manual edits are NEVER overwritten: an append onto
  // an edited draft concatenates the new clip after the user's text. A
  // pristine draft in Smart Clean mode adopts the re-polished COMBINED text
  // (the formatting/extraction pass re-ran across everything — diary events
  // and matter matches refresh with it); in Verbatim mode every word from
  // every clip lands in exact chronological sequence.
  const lastCaptureIdRef = useRef<string>("");

  useEffect(() => {
    if (qc.phase !== "triage" || !qc.capture) return;
    const capture = qc.capture;
    const verbatim = capture.verbatimText || "";
    if (capture.clientLocalId !== lastCaptureIdRef.current) {
      // A different capture (first arrival, or a brand-new note after Done):
      // seed a fresh draft from the preferred tier. The "clean" tier now
      // prefers the FORMATTED body (caseNoteText — paragraphs/bullets chosen
      // by content, meta-speech stripped) over plain Smart Clean.
      const formatted = formattedTierText(capture);
      const source: DraftSource = formatted && draftSource === "clean" ? "clean" : "verbatim";
      setDraftText(source === "clean" ? formatted || verbatim : verbatim);
      setDraftSource(source);
      setClipCount(1);
      draftEditedRef.current = false;
      lastCaptureIdRef.current = capture.clientLocalId;
      lastSyncedVerbatimRef.current = verbatim;
      return;
    }
    if (verbatim !== lastSyncedVerbatimRef.current) {
      // An Add More round finalized — merge the new clip into the draft.
      const previous = lastSyncedVerbatimRef.current;
      const newClip = extractNewClipText(verbatim, previous);
      lastSyncedVerbatimRef.current = verbatim;

      // EDIT SELECTION BY VOICE: this round was launched from the "Edit
      // Selection by Voice" button — the clip is a spoken EDIT COMMAND for
      // the highlighted passage, not an addition. Rewrite that passage in
      // place and leave the rest of the draft untouched.
      const pendingEdit = pendingSelectionEditRef.current;
      if (pendingEdit) {
        pendingSelectionEditRef.current = null;
        setSelectionEditBusy(true);
        void (async () => {
          try {
            const before = draftTextRef.current;
            const selected = before.slice(pendingEdit.start, pendingEdit.end);
            if (!selected.trim() || !newClip.trim()) {
              toastRef.current("The selection was empty — nothing to edit.", { type: "info" });
              return;
            }
            const { rewritten } = await editSelectionService({
              selectedText: selected,
              instruction: newClip,
              surroundingText: before.slice(0, 2000),
            });
            setDraftText(
              before.slice(0, pendingEdit.start) + rewritten + before.slice(pendingEdit.end)
            );
            draftEditedRef.current = true;
            toastRef.current("Selection rewritten — check it and save when ready.", {
              type: "success",
            });
          } catch (err: any) {
            toastRef.current(err?.message || "Could not edit the selection by voice.", {
              type: "error",
            });
          } finally {
            setSelectionEditBusy(false);
          }
        })();
        return;
      }

      if (draftEditedRef.current) {
        // Manual edits are sacred: append the new words after them.
        setDraftText((d) => joinDraftText(d, newClip));
      } else if (draftSource === "clean" && formattedTierText(capture)) {
        // Pristine formatted draft: adopt the re-formatted combined text
        // (the formatting/extraction pass re-ran across everything — diary
        // events and matter matches refresh with it).
        setDraftText(formattedTierText(capture));
      } else {
        setDraftText((d) => joinDraftText(d, newClip));
      }
      setClipCount((c) => c + 1);
      if (newClip) {
        toastRef.current("Added to your draft — keep adding, edit, or save when ready.", {
          type: "success",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc.phase, qc.capture]);

  const handleDraftChange = useCallback((text: string) => {
    draftEditedRef.current = true;
    setDraftText(text);
  }, []);

  /** Mirror of draftText for async flows (edit-selection splice) that need
   *  the CURRENT text without re-creating the effect closure. */
  const draftTextRef = useRef("");
  useEffect(() => {
    draftTextRef.current = draftText;
  }, [draftText]);

  const handleEditSelection = useCallback(
    (start: number, end: number) => {
      const capture = qc.capture;
      if (!capture) return;
      medium();
      pendingSelectionEditRef.current = { start, end };
      void qc.appendRecording({
        clientLocalId: capture.clientLocalId,
        existingSegmentCount: capture.nextSegmentIndex ?? capture.segmentCount,
        existingDurationMs: capture.durationMs,
        kind: capture.kind,
        outputMode: capture.outputMode,
      });
    },
    [qc.capture, qc.appendRecording, medium]
  );

  const handleResyncDraft = useCallback(() => {
    if (!qc.capture) return;
    const capture = qc.capture;
    const verbatim = capture.verbatimText || "";
    const text =
      draftSource === "clean" ? formattedTierText(capture) || verbatim : verbatim;
    setDraftText(text);
    draftEditedRef.current = false;
    toastRef.current("Draft re-synced from the transcript.", { type: "info" });
  }, [qc.capture, draftSource]);

  const handleToggleSource = useCallback(() => {
    if (!qc.capture) return;
    const capture = qc.capture;
    const next: DraftSource = draftSource === "clean" ? "verbatim" : "clean";
    if (next === "verbatim" || !formattedTierText(capture)) {
      setDraftSource("verbatim");
      if (!draftEditedRef.current) setDraftText(capture.verbatimText || "");
      else
        toastRef.current(
          "Showing the Verbatim tier needs a re-sync — tap Re-sync to replace your edits.",
          { type: "info" }
        );
      return;
    }
    setDraftSource("clean");
    if (!draftEditedRef.current) setDraftText(formattedTierText(capture));
    else
      toastRef.current(
        "Showing the Formatted tier needs a re-sync — tap Re-sync to replace your edits.",
        { type: "info" }
      );
  }, [qc.capture, draftSource]);

  const handleAddMore = useCallback(() => {
    const capture = qc.capture;
    if (!capture) return;
    medium();
    void qc.appendRecording({
      clientLocalId: capture.clientLocalId,
      // max existing index + 1 — robust even when dead segments left gaps.
      existingSegmentCount: capture.nextSegmentIndex ?? capture.segmentCount,
      existingDurationMs: capture.durationMs,
      kind: capture.kind,
      outputMode: capture.outputMode,
    });
  }, [qc.capture, qc.appendRecording, medium]);

  // Refresh the recent-captures strip.
  const refreshRecent = useCallback(() => {
    listRecentCaptures(10)
      .then((rows) => setRecent(rows))
      .catch(() => undefined);
  }, []);

  const handleDone = useCallback(() => {
    // Done: clear the draft staging area so the next note seeds fresh.
    lastCaptureIdRef.current = "";
    lastSyncedVerbatimRef.current = "";
    draftEditedRef.current = false;
    setDraftText("");
    setClipCount(1);
    qc.reset();
    refreshRecent();
  }, [qc.reset, refreshRecent]);

  // ── Deleting captures (owner report 2026-11-18: "how do we delete a quick
  //    capture? it is not obvious"). Two-tap confirm per row; the triage
  //    card has its own Discard action. Deleting removes the capture row +
  //    archived audio; notes already saved into a matter are separate
  //    records and are NOT touched.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteCapture = useCallback(
    async (row: CaptureProjection) => {
      if (deletingId) return;
      setDeletingId(row.clientLocalId);
      try {
        // 1. Server row + archived audio.
        await deleteCapture(row.clientLocalId);
      } catch (err: any) {
        // A "not found" miss is fine — the row may have been purged server-
        // side already; the local purge below clears anything still queued
        // on this device. Anything else surfaces to the user.
        const msg = String(err?.message || "");
        if (!msg.toLowerCase().includes("not found")) {
          addToast(msg || "Could not delete this voice note.", { type: "error" });
          setDeletingId(null);
          setConfirmDeleteId(null);
          return;
        }
      }
      try {
        // 2. Segments still queued on this device (offline captures).
        await voiceSync.purgeCapture(row.clientLocalId);
      } catch { /* already gone */ }
      // 3. If the open triage card was this capture, clear the staging area.
      if (lastCaptureIdRef.current === row.clientLocalId) {
        lastCaptureIdRef.current = "";
        lastSyncedVerbatimRef.current = "";
        draftEditedRef.current = false;
        setDraftText("");
        setClipCount(1);
        qc.reset();
      }
      setRecent((rows) => rows.filter((r) => r.clientLocalId !== row.clientLocalId));
      setConfirmDeleteId(null);
      setDeletingId(null);
      addToast("Voice note deleted.", { type: "success" });
    },
    [deletingId, addToast, qc, refreshRecent]
  );

  useEffect(() => {
    refreshRecent();
    const onOnline = () => {
      setOnline(true);
      refreshRecent();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshRecent, qc.phase]);

  // Poll while processing so the strip + card update as soon as ready.
  useEffect(() => {
    if (qc.phase !== "processing" && qc.phase !== "queued") return;
    const id = window.setInterval(refreshRecent, 5000);
    return () => window.clearInterval(id);
  }, [qc.phase, refreshRecent]);

  const handleAsk = useCallback(async () => {
    const q = askText.trim();
    if (!q || asking) return;
    if (!navigator.onLine) {
      addToast("You're offline — answers need a connection.", { type: "info" });
      return;
    }
    setAsking(true);
    setAskResult(null);
    try {
      // Action-capable Quick Ask (owner spec §5): it can now create diary
      // entries / save notes on instruction — the notebookId is the
      // fallback home for standalone saved notes.
      const notebookId =
        coreState.noteNotebooks?.find((nb) => nb.id !== MATTERS_NOTEBOOK_ID)?.id ||
        MATTERS_NOTEBOOK_ID;
      const result = await quickAsk(q, { notebookId });
      setAskResult(result);
    } catch (err: any) {
      addToast(err?.message || "Quick Ask failed. Please try again.", { type: "error" });
    } finally {
      setAsking(false);
    }
  }, [askText, asking, addToast, coreState.noteNotebooks]);

  const pendingSegments = qc.queueStats?.pendingSegments ?? 0;

  // Where "Full Office" / "Settings" go when embedded inside the ALOA
  // panel: the parent closes the panel, then the navigation happens.
  const exitToView = useCallback(
    (view: "dashboard" | "settings" | "help") => {
      if (embedded && onExitEmbedded) onExitEmbedded();
      navigateTo(view);
    },
    [embedded, onExitEmbedded, navigateTo]
  );

  // ─── Render ─────────────────────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50">
      {/* Top bar: brand + persistent Full Office button + settings.
          Embedded (inside the ALOA panel): a back-to-chat button leads.
          Owner addendum: "Keep a persistent 'Full Office →' button in the top
          corner of Quick Capture so they can switch back to the main
          dashboard anytime in 1 tap." */}
      <header className="bg-white border-b border-slate-200 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            {embedded && onBackToChat ? (
              <Button
                variant="ghost"
                size="sm"
                icon={ChevronLeftIcon}
                onClick={() => {
                  light();
                  onBackToChat();
                }}
              >
                ALOA
              </Button>
            ) : null}
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 text-white shrink-0">
              <MicrophoneIcon className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-900 leading-tight text-base">
                {embedded ? "ALOA · Quick Capture" : "Quick Capture"}
              </h1>
              <p className="text-2xs text-slate-500 leading-tight truncate">
                {currentUser?.name ? `Capturing for ${coreState.firmDetails?.name || "your firm"}` : "Speak first, route later"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Voice Tips (owner spec 2026-11-19, Part 3): subtle "?" that
                opens the in-place tricks + snippets guide. */}
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={SparklesIcon}
              aria-label="Voice tips"
              title="Voice tips — tricks, snippets & dictionary"
              onClick={() => setShowTips((v) => !v)}
            />
            {/* Whisper Mode (Part 2 §5): quiet-speech capture profile for
                whispered notes in court galleries / shared spaces. */}
            <Button
              variant={whisperMode ? "primary" : "ghost"}
              size="sm"
              aria-pressed={whisperMode}
              title="Whisper Mode — capture quiet speech cleanly"
              onClick={() => {
                light();
                toggleWhisperMode();
              }}
            >
              Whisper
            </Button>
            <Button
              variant="outline"
              size="sm"
              minTouchTarget
              icon={ChevronRightIcon}
              onClick={() => {
                light();
                exitToView("dashboard");
              }}
            >
              Full Office
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={CogIcon}
              aria-label="Settings"
              onClick={() => exitToView("settings")}
            />
          </div>
        </div>
        {/* "Start in Quick Capture on mobile" — the frictionless launch
            preference toggle (owner addendum rule 3). OFF by default;
            visible where the user already is, no Settings trip needed.
            Phone-like devices only — the preference governs mobile boots. */}
        {isPhoneLike ? (
          <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-slate-100 bg-slate-50/80">
            <label
              htmlFor="qc-startup-toggle"
              className="text-xs font-medium text-slate-600 leading-tight"
            >
              Start in Quick Capture on mobile
            </label>
            {/* Switch built on the app's established div/role="switch"
                pattern (see the Toggle in Settings → Display) — there is no
                ui/ switch primitive yet, and growing the raw-button count is
                banned by the ADR-0004 ratchet. tabIndex + keydown keep it
                fully keyboard-operable. */}
            <div
              id="qc-startup-toggle"
              role="switch"
              aria-checked={startInQuickCapture}
              aria-label="Start in Quick Capture on mobile"
              tabIndex={0}
              onClick={() => {
                light();
                handleToggleStartup();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  light();
                  handleToggleStartup();
                }
              }}
              className={`${
                startInQuickCapture ? "bg-emerald-600" : "bg-slate-300"
              } relative inline-flex items-center h-6 rounded-full w-11 transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2`}
            >
              <span
                className={`${
                  startInQuickCapture ? "translate-x-6" : "translate-x-1"
                } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
              />
            </div>
          </div>
        ) : null}
      </header>

      {/* VOICE TIPS (owner spec Part 3): the collapsible in-place guide —
          what you can capture, smart tricks, dictionary + snippets. */}
      {showTips ? (
        <VoiceTipsPanel
          onClose={() => setShowTips(false)}
          onOpenFullGuide={() => exitToView("help")}
        />
      ) : null}

      {mode === "speak" ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Search / ask bar */}
          <div className="px-4 pt-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleAsk();
              }}
            >
              <div className="flex-1 min-w-0">
                <Input
                  aria-label="Ask or search"
                  placeholder="Ask about a case, note or your schedule…"
                  value={askText}
                  onChange={(e) => setAskText((e.target as HTMLInputElement).value)}
                />
              </div>
              <Button type="submit" variant="primary" size="md" minTouchTarget icon={SparklesIcon} loading={asking}>
                Ask
              </Button>
            </form>
            <Button variant="ghost" size="sm" className="!text-xs !text-slate-400" onClick={() => setMobileSearchOpen(true)}>
              or search everything in the office
            </Button>
          </div>

          {/* Quick Ask answer */}
          {asking ? (
            <div className="mx-4 mt-3 rounded-lg border border-slate-200 bg-white p-4 flex items-center gap-2 text-sm text-slate-500">
              <span className="inline-block w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
              Searching your matters, notes and schedule…
            </div>
          ) : askResult ? (
            <div className="mx-4 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-base leading-relaxed text-slate-800 whitespace-pre-wrap">{askResult.answer}</p>
              {/* Action-capable Quick Ask (owner spec §5): confirmation
                  cards for anything it created, each with View / Undo. */}
              {askResult.actions && askResult.actions.length > 0 ? (
                <div className="mt-3">
                  <QuickAskActions
                    actions={askResult.actions}
                    onAllUndone={() => setAskResult(null)}
                  />
                </div>
              ) : null}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {askResult.sources.matters.slice(0, 3).map((s) => (
                  <span key={s.id} className="text-xs px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-600 truncate max-w-[180px]">
                    Matter: {s.title}
                  </span>
                ))}
                {askResult.sources.notes.slice(0, 2).map((s) => (
                  <span key={s.id} className="text-xs px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-600 truncate max-w-[180px]">
                    Note: {s.title}
                  </span>
                ))}
                {askResult.sources.events.slice(0, 3).map((s) => (
                  <span key={s.id} className="text-xs px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-600 truncate max-w-[180px]">
                    Schedule: {s.title}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* The walkie-talkie launcher */}
          <div className="flex flex-col items-center gap-4 px-4 pt-8 pb-4">
            {qc.phase === "triage" && qc.capture ? (
              <div className="w-full max-w-md">
                {qc.error ? (
                  <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {qc.error}
                  </p>
                ) : null}
                <TriageCard
                  capture={qc.capture}
                  matters={matterState.matters}
                  eventTypeNames={eventTypeNames.length ? eventTypeNames : ["Meeting", "Hearing", "Mention", "Deadline", "Consultation"]}
                  onDone={handleDone}
                  onDelete={handleDeleteCapture}
                  onOpenMatter={(matterId) => navigateTo("matterDetail", matterId)}
                  onOpenCalendar={() => navigateTo("calendar")}
                  draftText={draftText}
                  onDraftChange={handleDraftChange}
                  onAddMore={handleAddMore}
                  onResyncDraft={handleResyncDraft}
                  clipCount={clipCount}
                  draftSource={draftSource}
                  onToggleSource={handleToggleSource}
                  onEditSelection={handleEditSelection}
                  addMoreDisabled={selectionEditBusy}
                />
              </div>
            ) : qc.phase === "recording" ? (
              <>
                {/* Energy ring */}
                <div className="relative flex items-center justify-center">
                  <span
                    className="absolute rounded-full bg-rose-400/30 transition-all duration-100"
                    style={{
                      width: `${104 + qc.energy * 56}px`,
                      height: `${104 + qc.energy * 56}px`,
                    }}
                    aria-hidden
                  />
                  <span className="relative flex items-center justify-center w-24 h-24 rounded-full bg-rose-500 text-white shadow-lg">
                    <StopIcon className="w-9 h-9" />
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-900 tabular-nums" aria-live="polite">
                  {formatMs(qc.elapsedMs)}
                </p>
                <p className="text-xs text-slate-500">
                  {qc.appending
                    ? `Adding to your note (${clipCount} clip${clipCount > 1 ? "s" : ""} so far) — speak, then tap Stop`
                    : qc.segmentCount > 0
                      ? `${qc.segmentCount} segment${qc.segmentCount > 1 ? "s" : ""} saved on device — nothing is lost if the signal drops`
                      : "Audio saves to this device first, then uploads"}
                </p>
                <div className="flex gap-3 w-full max-w-xs">
                  <Button variant="outline" size="lg" minTouchTarget fullWidth onClick={() => void qc.cancelRecording()}>
                    {qc.appending ? "Discard addition" : "Cancel"}
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    minTouchTarget
                    fullWidth
                    icon={StopIcon}
                    onClick={() => {
                      medium();
                      void qc.stopRecording();
                    }}
                  >
                    Stop
                  </Button>
                </div>
              </>
            ) : qc.phase === "processing" ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="inline-block w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-emerald-600 animate-spin" />
                <p className="font-semibold text-slate-900">
                  {qc.appending ? "Transcribing your addition…" : "Transcribing…"}
                </p>
                <p className="text-xs text-slate-500 max-w-xs">
                  {qc.appending
                    ? "Whisper is turning the new clip into text and re-checking dates, matters and the best next step across the whole note."
                    : "Whisper is turning your recording into text, polishing it and picking the best next step. This usually takes a few seconds."}
                </p>
              </div>
            ) : qc.phase === "queued" ? (
              <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                <p className="font-semibold text-amber-900">Saved on this device</p>
                <p className="text-sm text-amber-800 mt-1">
                  You're offline. Your recording is safe and will be transcribed automatically the
                  moment you're back on a connection.
                  {pendingSegments > 0 ? ` (${pendingSegments} segment${pendingSegments > 1 ? "s" : ""} waiting.)` : ""}
                </p>
              </div>
            ) : qc.phase === "error" ? (
              <div className="w-full max-w-md flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
                  {qc.error || "Something went wrong."}
                </p>
                <Button variant="outline" size="md" onClick={qc.reset}>
                  Try again
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  className="!w-28 !h-28 !rounded-full !px-0 shadow-lg"
                  aria-label="Start recording"
                  onClick={() => {
                    medium();
                    void qc.startRecording();
                  }}
                  disabled={!qc.supported}
                >
                  <MicrophoneIcon className="w-11 h-11" />
                </Button>
                <p className="text-sm font-semibold text-slate-900">Tap to speak</p>
                <p className="text-xs text-slate-500 text-center max-w-xs">
                  Dictate a note, a task or a question — no forms first. We'll suggest where it
                  should go when you stop.
                </p>
                {!online ? (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                    Offline — recordings save on this device
                  </p>
                ) : null}
                {qc.error && qc.phase === "idle" ? (
                  <p className="text-xs text-rose-600">{qc.error}</p>
                ) : null}
              </>
            )}
          </div>

          {/* Pending queue strip */}
          {pendingSegments > 0 && qc.phase !== "recording" ? (
            <div className="mx-4 mb-2 rounded-lg border border-slate-200 bg-white px-4 py-3 flex items-center gap-2 text-sm text-slate-600">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" aria-hidden />
              {pendingSegments} audio segment{pendingSegments > 1 ? "s" : ""} waiting to upload —
              they'll go out automatically when the signal returns.
            </div>
          ) : null}

          {/* Recent captures */}
          {recent.length > 0 ? (
            <section className="px-4 pb-8" aria-label="Recent voice notes">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Recent voice notes</h2>
              <div className="flex flex-col gap-2">
                {recent.map((r) => {
                  const Icon = INTENT_ICON[r.triageIntent || "share"] || ClipboardIcon;
                  const confirming = confirmDeleteId === r.clientLocalId;
                  const deleting = deletingId === r.clientLocalId;
                  return (
                    <div
                      key={r.captureId}
                      className="flex items-stretch gap-1 rounded-lg border border-slate-200 bg-white overflow-hidden"
                    >
                      <Button
                        variant="bare"
                        className="flex items-center gap-3 flex-1 min-w-0 text-left px-3 py-2.5 active:bg-slate-50"
                        onClick={() => void qc.openCapture(r.clientLocalId)}
                        aria-label={`Open voice note: ${r.triageMeta?.summary || r.snippet?.slice(0, 60) || "Voice note"}`}
                      >
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 shrink-0">
                          <Icon className="w-4 h-4 text-slate-500" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900 truncate">
                            {r.triageMeta?.summary || r.snippet?.slice(0, 60) || "Voice note"}
                          </span>
                          <span className="block text-xs text-slate-400 truncate">
                            {r.kind === "legalpad" ? "Legal Pad" : "Quick note"}
                            {r.status === "ready" ? "" : ` · ${r.status}`}
                            {r.createdAt ? ` · ${new Date(r.createdAt).toLocaleDateString()}` : ""}
                          </span>
                        </span>
                        {!confirming ? (
                          <ChevronRightIcon className="w-4 h-4 text-slate-300 shrink-0" />
                        ) : null}
                      </Button>
                      {/* Delete — a first-class, obvious action (owner report:
                          "how do we delete a quick capture?"). Two-tap
                          confirm: trash → "Delete? ✓ / ✕" inline. */}
                      {confirming ? (
                        <div className="flex items-center gap-1 pr-2 shrink-0 bg-rose-50 border-l border-rose-200">
                          <span className="text-xs font-semibold text-rose-700 whitespace-nowrap">Delete?</span>
                          <Button
                            variant="primary"
                            size="sm"
                            iconOnly
                            icon={CheckIcon}
                            aria-label="Confirm delete"
                            loading={deleting}
                            onClick={() => void handleDeleteCapture(r)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={XMarkIcon}
                            aria-label="Keep this voice note"
                            onClick={() => setConfirmDeleteId(null)}
                          />
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          icon={TrashIcon}
                          aria-label={`Delete voice note: ${r.triageMeta?.summary || "Voice note"}`}
                          className="!text-slate-400 hover:!text-rose-600 shrink-0"
                          onClick={() => {
                            light();
                            setConfirmDeleteId(r.clientLocalId);
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        /* Legal Pad mode takes over the whole surface */
        <LegalPadView onExit={() => setMode("speak")} />
      )}

      {/* Mode toggle — thumb-reachable at the bottom */}
      {mode === "speak" ? (
        <nav
          className="border-t border-slate-200 bg-white px-4 py-2 flex gap-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
          aria-label="Capture mode"
        >
          <Button
            variant="segmented-active"
            size="md"
            minTouchTarget
            fullWidth
            icon={MicrophoneIcon}
            onClick={() => setMode("speak")}
          >
            Speak
          </Button>
          <Button
            variant="segmented"
            size="md"
            minTouchTarget
            fullWidth
            icon={DocumentTextIcon}
            onClick={() => {
              light();
              setMode("pad");
            }}
          >
            Legal Pad
          </Button>
        </nav>
      ) : null}
    </div>
  );
};
