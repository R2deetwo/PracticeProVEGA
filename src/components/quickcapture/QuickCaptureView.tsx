/**
 * QuickCaptureView — the lightweight, mobile-first capture surface.
 *
 * Owner addendum (2026-11-18, "startup default, ALOA placement & one-tap
 *   launch preference"):
 *   - The app boots into the FULL OFFICE for everyone; Quick Capture is
 *     never forced. A preference — "Start in Quick Capture on mobile",
 *     OFF by default — lets each user opt their phone into landing here
 *     (folded into the ⚙ menu on phones so the screen stays clean).
 *   - A persistent "Full Office" button stays in the top corner (1 tap
 *     back to the dashboard).
 *   - The same surface renders EMBEDDED inside the ALOA panel (props:
 *     `embedded`, `onBackToChat`, `onExitEmbedded`) so voice, dictation
 *     and AI workflows share one unified home.
 *
 * Mobile header (owner directive 2026-11-19): a strict three-slot bar —
 *   `< ALOA` back | one-line compact title ("QC" on phones) | Full
 *   Office + ⚙. Quiet Mode, the startup preference and the voice-tips
 *   guide live in the gear popover; the giant mic button is the single
 *   voice focal point. Vega/Komplete workspaces wear the Vega deep-blue
 *   register (#1D4ED8 / #1E3A8A) on the mic circle, Ask button and active
 *   Speak tab; green is reserved for Atrium and the admin console.
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
  LockClosedIcon,
  MicrophoneIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  StopIcon,
  TrashIcon,
  UsersIcon,
  XMarkIcon,
} from "../../constants";
import { useUI } from "../../contexts/UIContext";
import { useAuth } from "../../contexts/AuthContext";
import { useCoreState } from "../../contexts/CoreContext";
import { useMatterState } from "../../contexts/MatterContext";
import { useAloa } from "../../contexts/AloaProvider";
import { useFeatures } from "../../hooks/useFeatures";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useQuickCapture } from "../../hooks/useQuickCapture";
import { MATTERS_NOTEBOOK_ID } from "../../constants";
import { Z_CLASS } from "../../overlays/constants";
import {
  quickAsk,
  listRecentCaptures,
  deleteCapture,
  editSelection as editSelectionService,
  type CaptureProjection,
  type QuickAskResult,
} from "../../services/voice/voiceCaptureService";
import { voiceSync } from "../../services/voice/audioQueue";
// 7-day Vox-card rule: an actual recording = "used Aloa Vox" — stamps
// the usage timestamp so the Overview prompt card stays hidden for a week.
import { stampVoxUsedAt } from "../../utils/voxUsageTracking";
// Keeps the session-lock countdown alive while the user dictates (taps
// stop during a take; the global activity heartbeat must not).
import { markUserActivity } from "../../hooks/useIdleTimer";
import {
  getStartupViewPreference,
  setStartupViewPreference,
} from "../../utils/startupViewPreference";
import { extractNewClipText, joinDraftText, composeSpeakerDraft, defaultSpeakerLabels, isMultiSpeakerSet } from "../../services/voice/draftUtils";
import { VoiceTipsPanel } from "./VoiceTipsPanel";
import { TriageCard } from "./TriageCard";
import { QuickAskActions } from "./QuickAskActions";
import { LegalPadView } from "./LegalPadView";
import { VoxUpsellModal } from "./VoxUpsellModal";
// Session Capture (Mode B of the dual-mode Vox, owner spec 2026-11-22): the
// Plaud-style session workspace — record/upload a full legal session, get
// the speaker-labelled transcript + file note + action items + issue map
// + Ask Vox cross-session recall.
import { SessionCaptureView } from "./SessionCaptureView";

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

type CaptureMode = "speak" | "pad" | "session";

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

/** Quiet Mode persistence (owner spec 2026-11-19 §5) — local preference.
 *  User-facing name is "Quiet Mode" (brand hygiene, 2026-11-19: no
 *  third-party names in the UI); the storage key keeps its legacy
 *  "whisper" spelling so existing on-device preferences survive. */
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

/** CONVERSATION MODE persistence (owner spec 2026-11-20) — local
 *  preference, same pattern as Quiet Mode. OFF by default: solo
 *  dictation stays the zero-friction default. */
const CONVERSATION_PREF_KEY = "practicepro_conversation_mode";
function readConversationPref(): boolean {
  try {
    return localStorage.getItem(CONVERSATION_PREF_KEY) === "1";
  } catch {
    return false;
  }
}
function writeConversationPref(on: boolean): void {
  try {
    localStorage.setItem(CONVERSATION_PREF_KEY, on ? "1" : "0");
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
  /** ROUND 22: report whether a capture take is live, so the panel's Vox
   *  switcher (Consultation / Note | Court Mode) can lock the other segment
   *  mid-take instead of unmounting a recording. */
  onCaptureBusyChange?: (busy: boolean) => void;
}

export const QuickCaptureView: React.FC<QuickCaptureViewProps> = ({
  embedded = false,
  onBackToChat,
  onExitEmbedded,
  onCaptureBusyChange,
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

  // ── ACCENT NOTE (owner directive, 2026-11-20): "use the blue accent
  //    for Vega and Complete — green only for Atrium. Quick capture is
  //    blue but the full office is green — that makes no sense." The
  //    per-surface hardcoded blues are GONE: every hero element here now
  //    reads the app-wide primary-* ramp, which is the Vega blue
  //    (#1D4ED8 / #1E3A8A) for Vega AND Komplete workspaces and the estate
  //    jade for Atrium — one uniform register everywhere.

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
        ? "Mobile launches will open straight into ALOA Vox."
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
  /** QUIET MODE (§5; user-facing "Quiet Mode", internally the quiet-speech
   *  profile): persisted local preference, threaded into the capture hook
   *  so the next recording uses quiet-speech constraints. */
  const [whisperMode, setWhisperMode] = useState(readWhisperPref);
  /** CONVERSATION MODE (owner spec 2026-11-20): multi-speaker capture —
   *  consultations, witness conferences, settlement meetings, court
   *  hearings. Toggle sits above the mic; the NEXT recording round picks
   *  it up (live-ref, same as Quiet Mode). Persisted locally. */
  const [conversationMode, setConversationMode] = useState(readConversationPref);
  /** Voice Tips panel (Part 3). */
  const [showTips, setShowTips] = useState(false);

  // ── VOX CALLOUT (owner task 2026-11-22): the centered ALOA Vox box in
  //    the compact header shows an expanded first-use card ONCE so users
  //    immediately understand what Vox is; after "Got it" it settles into
  //    the compact resting box (with the subtle pulse) and never nags
  //    again. Re-openable from the box itself (a tap on the resting box
  //    re-shows it) so the explanation is never lost — just out of the
  //    way. Stored per-device (localStorage): every new APK install /
  //    browser profile gets exactly one introduction.
  const VOX_CALLOUT_KEY = "practicepro_vox_callout_dismissed_at";
  const [showVoxCallout, setShowVoxCallout] = useState<boolean>(() => {
    try {
      return localStorage.getItem(VOX_CALLOUT_KEY) === null;
    } catch {
      return true;
    }
  });
  const dismissVoxCallout = useCallback(() => {
    const now = Date.now();
    try {
      localStorage.setItem(VOX_CALLOUT_KEY, String(now));
    } catch { /* storage unavailable — session-only dismissal */ }
    setShowVoxCallout(false);
    light();
  }, [light]);
  /** Outside-tap closes the callout WITHOUT persisting dismissal — the
   *  first-use card comes back next visit until explicitly accepted. */
  const voxBoxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!showVoxCallout) return;
    const onPointerDown = (e: PointerEvent) => {
      if (voxBoxRef.current && !voxBoxRef.current.contains(e.target as Node)) {
        setShowVoxCallout(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowVoxCallout(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showVoxCallout]);
  /** Compact-header settings popover (owner directive 2026-11-19): the
   *  phone header carries only Full Office + ⚙ — Quiet Mode, the startup
   *  preference and the tips guide fold into this menu so the capture
   *  screen stays distraction-free. */
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!showSettingsMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setShowSettingsMenu(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettingsMenu(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showSettingsMenu]);
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
    conversation: conversationMode,
    onReadyToast: () => {
      addToast("Voice note ready — tap to review it.", { type: "success" });
    },
  });

  // Session-lock heartbeat: while a take is live the user is working — they
  // just aren't tapping anything. Publish the global activity timestamp
  // every 30s so a long dictation never trips the idle lock mid-speech.
  useEffect(() => {
    if (qc.phase !== "recording") return;
    markUserActivity();
    const heartbeat = setInterval(markUserActivity, 30_000);
    return () => clearInterval(heartbeat);
  }, [qc.phase]);

  // ROUND 22: keep the panel's Vox switcher informed — a live take locks the
  // Court Mode segment until it is finished (no unmount mid-recording).
  useEffect(() => {
    onCaptureBusyChange?.(
      qc.phase === "recording" || qc.phase === "processing" || qc.phase === "queued"
    );
  }, [qc.phase, onCaptureBusyChange]);

  const toggleWhisperMode = useCallback(() => {
    setWhisperMode((prev) => {
      const next = !prev;
      writeWhisperPref(next);
      addToast(
        next
          ? "Quiet Mode on — quiet speech is captured cleanly."
          : "Quiet Mode off — standard noise filtering.",
        { type: "success" }
      );
      return next;
    });
  }, [addToast]);

  const toggleConversationMode = useCallback(() => {
    setConversationMode((prev) => {
      const next = !prev;
      writeConversationPref(next);
      addToast(
        next
          ? "Conversation mode on — the next recording separates each speaker for labelling."
          : "Conversation mode off — the next recording is a solo dictation.",
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
      // by content, meta-speech stripped) over plain Smart Clean. A
      // DIARIZED conversation (conversation mode, 2+ speakers) seeds the
      // speaker-attributed dialogue instead — bold "**Label:**" blocks the
      // triage card relabels live (owner spec 2026-11-20).
      const diarized = isMultiSpeakerSet(capture.speakerTurns);
      const formatted =
        diarized && draftSource === "clean"
          ? composeSpeakerDraft(capture.speakerTurns!, defaultSpeakerLabels(capture.speakerTurns!))
          : formattedTierText(capture);
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

  // ── VOX ENTITLEMENT (owner spec 2026-11-20, Pro-target since
  //    2026-11-23): Vox is a PRO-AND-ABOVE feature (tierLimits.canUseVox:
  //    Pro | Enterprise | Komplete). Free-tier users still SEE Vox
  //    (discoverability) — with a lock badge on the mic and a tier chip —
  //    but every attempt to record (mic, Conversation mode, Legal Pad,
  //    Add More) opens the dedicated upgrade modal wired to the billing
  //    flow with Pro pre-selected. The backend independently rejects
  //    non-Pro uploads (UPGRADE_REQUIRED_FOR_VOX) — this is the polite
  //    front of that gate.
  const { canUseVox } = useFeatures();
  const [showVoxUpsell, setShowVoxUpsell] = useState(false);
  const guardVox = useCallback(
    (action: () => void) => {
      if (!canUseVox) {
        medium();
        setShowVoxUpsell(true);
        return;
      }
      action();
    },
    [canUseVox, medium]
  );

  const handleAddMore = useCallback(() => {
    const capture = qc.capture;
    if (!capture) return;
    guardVox(() => {
      medium();
      void qc.appendRecording({
        clientLocalId: capture.clientLocalId,
        // max existing index + 1 — robust even when dead segments left gaps.
        existingSegmentCount: capture.nextSegmentIndex ?? capture.segmentCount,
        existingDurationMs: capture.durationMs,
        kind: capture.kind,
        outputMode: capture.outputMode,
      });
    });
  }, [qc.capture, qc.appendRecording, medium, guardVox]);

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

  // ── Compact header (owner directives 2026-11-19 → 2026-11-20):
  //    phone viewports and the narrow ALOA panel column get a strict
  //    three-slot bar — `< ALOA` | Vox | Dashboard + ⚙. The product is VOX
  //    everywhere; "ALOA" renders exactly once (the back affordance).
  //
  //    OWNER UPDATE (2026-11-20, this session):
  //    1. "Full Office" is now "Dashboard" — same destination, the label
  //       the app actually uses everywhere else.
  //    2. The Dashboard button loses its border/box (ghost) so it sits
  //       cleanly beside the ⚙ gear.
  //    3. On DESKTOP, the ALOA-panel-embedded pane carries NO exit button
  //       at all — clicking outside the pane already retracts it; a button
  //       that duplicates that is noise. (Standalone wide view and phones
  //       keep it: there is no pane to click away there.)
  //    4. Standalone phones get a real `< ALOA` back affordance that opens
  //       the ALOA assistant over the office (previously a bare spacer).
  const compactHeader = embedded || isPhoneLike;
  const desktopPane = embedded && !isPhoneLike;
  const { openPanel: openAloaPanel } = useAloa();

  const handleBackToAloa = useCallback(() => {
    light();
    if (embedded && onBackToChat) {
      onBackToChat();
      return;
    }
    // Standalone (mobile APK): Vox is the full surface here — the ALOA
    // panel is unmounted in this view. Go to the office and open ALOA on
    // top of it, so `< ALOA` lands the user back with their assistant.
    navigateTo("dashboard");
    openAloaPanel("chat");
  }, [light, embedded, onBackToChat, navigateTo, openAloaPanel]);

  // ─── Render ─────────────────────────────────────────────────────────────────────────────────────────────

  return (
    /* VOX MOBILE SHELL (owner bug report 2026-11-24): a strict
       full-viewport flex column — header pinned to the top edge, bottom
       tab bar pinned to the bottom edge, stage flex-1 between them.
       overflow-hidden here + on the App-shell wrapper (no
       overflow-y-auto) so the global mobile "bottom nav spacing" CSS
       rule can never lift this shell off the viewport bottom again. */
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-slate-50 dark:bg-zinc-900">
      {/* Top bar — THREE CLEAN SLOTS (owner directive 2026-11-19): back on
          the left, ONE compact title in the centre, Full Office + ⚙ on the
          right. The old header stacked a mic badge, a two-line "ALOA ·
          Quick Capture" title, a tips button and a quiet-mode toggle into
          the same row — on a phone every element collided. The giant mic
          button below is the only voice affordance the eye needs; the gear
          folds Quiet Mode, the startup preference and the tips guide away.

          SAFE AREAS (owner bug report 2026-11-24): the shell-level pt-safe
          is REMOVED for this view (App.tsx) — the header now owns the ONE
          top inset: max(env(safe-area-inset-top), --native-safe-top) so it
          clears the Android status bar both when the WebView resolves env()
          and when it does not (the MainActivity inset bridge sets the
          --native-safe-* vars on the APK). The old code stacked the
          shell inset + calc(0.75rem + env(...)) + inner pt-3 — the giant
          white gap under the status bar. Inner row padding is the compact
          py-2.5. */}
      <header className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 pt-[max(env(safe-area-inset-top,0px),var(--native-safe-top,0px))]">
        <div className="relative flex items-center justify-between gap-2 px-4 py-2.5">
          {/* LEFT SLOT — the single back affordance: `< ALOA`. Embedded
              panes return to the chat; standalone phones open ALOA over the
              office. One line, never truncated, no badge stacking. */}
          {compactHeader ? (
            <Button
              variant="ghost"
              size="sm"
              icon={ChevronLeftIcon}
              className="!px-2 whitespace-nowrap shrink-0"
              onClick={handleBackToAloa}
            >
              ALOA
            </Button>
          ) : (
            <div className="min-w-0">
              {/* ALOA Vox naming (owner task 2026-11-22): the wide header
                  carries the full feature name with the stylized Vox mark. */}
              <h1 className="font-bold text-slate-900 dark:text-zinc-100 leading-tight text-base whitespace-nowrap flex items-baseline gap-1.5">
                <span className="text-xs font-semibold tracking-wide uppercase text-slate-400 dark:text-zinc-500">ALOA</span>
                <span className="bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent font-black">Vox</span>
              </h1>
              <p className="text-2xs text-slate-500 dark:text-zinc-400 leading-tight truncate">
                {currentUser?.name ? `Capturing for ${coreState.firmDetails?.name || "your firm"}` : "Speak first, route later"}
              </p>
            </div>
          )}

          {/* CENTER SLOT — the ALOA VOX box (owner task 2026-11-22):
              absolutely centered on the bar (left-1/2 -translate-x-1/2) so
              it lines up with the top-center camera/notch of a standard
              phone regardless of how wide the left/right slots are — the
              old flex-1 approximation drifted whenever `< ALOA` and
              `Dashboard + ⚙` had different widths. First use shows the
              expanded callout below it; once dismissed the box rests here
              compact with the subtle pulse (animate-vox-rest-pulse). The
              embedded desktop pane (narrow column) drops the "ALOA" prefix
              so the box never crowds. */}
          {compactHeader ? (
            <div
              className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-20"
              ref={voxBoxRef}
            >
              <Button
                variant="bare"
                type="button"
                data-tour-id="vox-header-box"
                aria-label="ALOA Vox — voice capture"
                aria-expanded={showVoxCallout}
                activePress
                onClick={() => {
                  light();
                  setShowVoxCallout((v) => !v);
                }}
                className={`
                  relative flex items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-lg
                  border border-primary-200 dark:border-primary-800/60
                  bg-white dark:bg-zinc-800 shadow-sm
                  transition-all duration-200
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                  ${showVoxCallout ? "ring-2 ring-primary-400/60" : ""}
                  ${!showVoxCallout ? "animate-vox-rest-pulse" : ""}
                `}
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary-600 text-white shrink-0">
                  <MicrophoneIcon className="w-4 h-4" />
                </span>
                <span className="whitespace-nowrap leading-none flex items-baseline gap-1">
                  <span className="text-2xs font-semibold tracking-wide uppercase text-slate-500 dark:text-zinc-400 hidden min-[380px]:inline">
                    ALOA
                  </span>
                  <span
                    className="text-sm font-black bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent"
                    style={{ letterSpacing: "0.01em" }}
                  >
                    Vox
                  </span>
                </span>
              </Button>

              {/* First-use callout — expanded explanation card. Dismissible
                  ("Got it"), never auto-reopens after dismissal; re-opens
                  only when the user taps the resting box. Anchored under
                  the box, centered, clamped to the viewport. */}
              {showVoxCallout && (
                <div
                  role="dialog"
                  aria-label="About ALOA Vox"
                  className={`absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl p-4 ${Z_CLASS.panelMenu}`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-600 text-white shrink-0">
                      <MicrophoneIcon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                        ALOA{" "}
                        <span className="bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
                          Vox
                        </span>
                      </p>
                      <p className="text-2xs text-slate-500 dark:text-zinc-400 leading-tight">
                        Voice-first legal capture
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                    Speak naturally — Vox captures the audio and the words,
                    drafts them into the hybrid Legal Pad, and labels each
                    speaker in consultations. Notes, tasks, questions and new
                    matters, straight from your voice.
                  </p>
                  <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-2 leading-relaxed">
                    Available on Pro and above — the mic below is always
                    one tap away.
                  </p>
                  <div className="flex justify-end gap-2 mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        light();
                        setShowTips(true);
                        dismissVoxCallout();
                      }}
                    >
                      Voice tips
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={dismissVoxCallout}
                    >
                      Got it
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
          {/* RIGHT SLOT — Dashboard + settings gear. Ghost (borderless) so
              it sits cleanly beside the ⚙; the desktop ALOA-pane variant
              carries NO exit button (clicking outside retracts the pane —
              owner 2026-11-20). shrink-0 + gap-2: never wraps, never
              crowds the title. */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!compactHeader ? (
              <>
                {/* Voice Tips (owner spec 2026-11-19, Part 3): subtle "?"
                    that opens the in-place tricks + snippets guide. */}
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={SparklesIcon}
                  aria-label="Voice tips"
                  title="Voice tips — tricks, snippets & dictionary"
                  onClick={() => setShowTips((v) => !v)}
                />
                {/* QUIET MODE (quiet-speech profile): court galleries /
                    shared spaces — noise suppression off so faint speech
                    survives. Kept intact per the owner's explicit "do NOT
                    rebuild or remove Low-Volume / Quiet Mode" directive. */}
                <Button
                  variant={whisperMode ? "primary" : "ghost"}
                  size="sm"
                  aria-pressed={whisperMode}
                  title="Quiet Mode — capture quiet speech cleanly"
                  onClick={() => {
                    light();
                    toggleWhisperMode();
                  }}
                >
                  Quiet Mode
                </Button>
              </>
            ) : null}
            {!desktopPane && (
              <Button
                variant="ghost"
                size="sm"
                minTouchTarget
                className="whitespace-nowrap font-semibold text-slate-600 dark:text-zinc-400"
                onClick={() => {
                  light();
                  exitToView("dashboard");
                }}
              >
                Dashboard
              </Button>
            )}
            {compactHeader ? (
              <div className="relative shrink-0" ref={settingsMenuRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={CogIcon}
                  aria-label="ALOA Vox settings"
                  title="ALOA Vox settings"
                  aria-expanded={showSettingsMenu}
                  aria-haspopup="menu"
                  onClick={() => {
                    light();
                    setShowSettingsMenu((v) => !v);
                  }}
                />
                {showSettingsMenu ? (
                  <div
                    role="menu"
                    aria-label="ALOA Vox settings"
                    className={`absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg p-2 ${Z_CLASS.panelMenu}`}
                  >
                    {/* Quiet Mode — quiet-speech capture profile. */}
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                      <label
                        htmlFor="qc-quiet-mode-toggle"
                        className="text-sm font-semibold text-slate-800 dark:text-zinc-200 leading-tight"
                      >
                        Quiet Mode
                        <span className="block text-2xs font-normal text-slate-400 dark:text-zinc-500 mt-0.5">
                          Court galleries & quiet rooms — faint speech captured cleanly
                        </span>
                      </label>
                      {/* Switch built on the app's established div/role="switch"
                          pattern (see Settings → Display) — no new raw buttons
                          (ADR-0004 ratchet). tabIndex + keydown keep it fully
                          keyboard-operable. */}
                      <div
                        id="qc-quiet-mode-toggle"
                        role="switch"
                        aria-checked={whisperMode}
                        aria-label="Quiet Mode"
                        tabIndex={0}
                        onClick={() => {
                          light();
                          toggleWhisperMode();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            light();
                            toggleWhisperMode();
                          }
                        }}
                        className={`
                          ${whisperMode ? "bg-primary-600" : "bg-slate-300 dark:bg-zinc-700"}
                        } relative inline-flex items-center h-6 rounded-full w-11 transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2`}
                      >
                        <span
                          className={`${
                            whisperMode ? "translate-x-6" : "translate-x-1"
                          } inline-block w-4 h-4 transform bg-white dark:bg-zinc-900 rounded-full transition-transform`}
                        />
                      </div>
                    </div>
                    {/* "Start in Quick Capture on mobile" (owner addendum
                        rule 3) — folded into the gear menu so the capture
                        screen stays distraction-free. Phone-like devices
                        only — the preference governs mobile boots. */}
                    {isPhoneLike ? (
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                        <label
                          htmlFor="qc-startup-toggle"
                          className="text-sm font-semibold text-slate-800 dark:text-zinc-200 leading-tight"
                        >
                          Start in ALOA Vox on mobile
                          <span className="block text-2xs font-normal text-slate-400 dark:text-zinc-500 mt-0.5">
                            Launch straight here instead of the dashboard
                          </span>
                        </label>
                        <div
                          id="qc-startup-toggle"
                          role="switch"
                          aria-checked={startInQuickCapture}
                          aria-label="Start in ALOA Vox on mobile"
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
                          className={`
                            ${startInQuickCapture ? "bg-primary-600" : "bg-slate-300 dark:bg-zinc-700"}
                          } relative inline-flex items-center h-6 rounded-full w-11 transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2`}
                        >
                          <span
                            className={`${
                              startInQuickCapture ? "translate-x-6" : "translate-x-1"
                            } inline-block w-4 h-4 transform bg-white dark:bg-zinc-900 rounded-full transition-transform`}
                          />
                        </div>
                      </div>
                    ) : null}
                    <div className="my-1 border-t border-slate-100 dark:border-zinc-800" role="separator" />
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      className="!justify-start"
                      icon={SparklesIcon}
                      onClick={() => {
                        setShowSettingsMenu(false);
                        setShowTips(true);
                      }}
                    >
                      Voice tips, snippets & dictionary
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      className="!justify-start"
                      icon={CogIcon}
                      onClick={() => {
                        setShowSettingsMenu(false);
                        exitToView("settings");
                      }}
                    >
                      All settings
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={CogIcon}
                aria-label="Settings"
                onClick={() => exitToView("settings")}
              />
            )}
          </div>
        </div>
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
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col">
          {/* Search / ask bar */}
          <div className="px-4 pt-3">
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
                  placeholder={
                    isPhoneLike
                      ? "Ask about a case, note or task…"
                      : "Ask about a case, note or your schedule…"
                  }
                  value={askText}
                  onChange={(e) => setAskText((e.target as HTMLInputElement).value)}
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                minTouchTarget
                icon={SparklesIcon}
                loading={asking}
              >
                Ask
              </Button>
            </form>
            <Button
              variant="ghost"
              size="sm"
              className="!text-xs !text-slate-400 dark:text-zinc-500 mt-1"
              onClick={() => setMobileSearchOpen(true)}
            >
              or search everything in the office
            </Button>
          </div>

          {/* Quick Ask answer */}
          {asking ? (
            <div className="mx-4 mt-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
              <span className="inline-block w-4 h-4 rounded-full border-2 border-slate-300 dark:border-zinc-700 border-t-slate-600 animate-spin" />
              Searching your matters, notes and schedule…
            </div>
          ) : askResult ? (
            <div className="mx-4 mt-3 rounded-lg border border-primary-200 bg-primary-50 p-4">
              <p className="text-base leading-relaxed text-slate-800 dark:text-zinc-200 whitespace-pre-wrap">{askResult.answer}</p>
              {/* Read-only hint (owner bug report 2026-11-19): pure lookup
                  questions never create entries — say so explicitly so the
                  lawyer knows the diary is untouched. */}
              {askResult.mode === "query_only" ? (
                <p className="mt-2 flex items-center gap-1.5 text-2xs font-semibold text-blue-700">
                  <MagnifyingGlassIcon className="w-3.5 h-3.5 shrink-0" />
                  Read-only question — nothing was created or scheduled.
                </p>
              ) : null}
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
                  <span key={s.id} className="text-xs px-2 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 truncate max-w-[180px]">
                    Matter: {s.title}
                  </span>
                ))}
                {askResult.sources.notes.slice(0, 2).map((s) => (
                  <span key={s.id} className="text-xs px-2 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 truncate max-w-[180px]">
                    Note: {s.title}
                  </span>
                ))}
                {askResult.sources.events.slice(0, 3).map((s) => (
                  <span key={s.id} className="text-xs px-2 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 truncate max-w-[180px]">
                    Schedule: {s.title}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* The walkie-talkie launcher — centred in the leftover stage
              space (flex-1 + justify-center): no dead vertical void above
              or below the mic; compact breathing room replaces the old
              pt-10/pb-8 dead bands. */}
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 pt-6 pb-6">
            {/* CONVERSATION MODE (owner spec 2026-11-20): solo dictation vs
                multi-speaker capture. A segmented pair ABOVE the mic — the
                next recording round picks the mode (live-ref, same as Quiet
                Mode). Conversation recordings transcribe with speaker-turn
                separation and stage with tappable speaker pills. Built on
                the ui/Button primitive (ADR-0004 — no raw form elements). */}
            {qc.phase === "idle" || qc.phase === "error" ? (
              <div
                className="inline-flex items-center rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 shadow-sm"
                role="group"
                aria-label="Recording mode"
              >
                <Button
                  variant="bare"
                  size="sm"
                  aria-pressed={!conversationMode}
                  className={`!rounded-full !px-3 !py-1.5 text-xs font-bold transition-colors ${
                    !conversationMode
                      ? "bg-primary-600 text-white hover:bg-primary-700"
                      : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 dark:text-zinc-200"
                  }`}
                  onClick={() => { if (conversationMode) toggleConversationMode(); }}
                >
                  Dictation
                </Button>
                <Button
                  variant="bare"
                  size="sm"
                  aria-pressed={conversationMode}
                  className={`!rounded-full !px-3 !py-1.5 text-xs font-bold transition-colors ${
                    conversationMode
                      ? "bg-primary-600 text-white hover:bg-primary-700"
                      : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 dark:text-zinc-200"
                  }`}
                  onClick={() => { if (!conversationMode) toggleConversationMode(); }}
                >
                  Conversation
                </Button>
              </div>
            ) : null}
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
                <p className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tabular-nums" aria-live="polite">
                  {formatMs(qc.elapsedMs)}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
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
                <span className="inline-block w-8 h-8 rounded-full border-[3px] border-slate-200 dark:border-zinc-800 border-t-primary-600 animate-spin" />
                <p className="font-semibold text-slate-900 dark:text-zinc-100">
                  {qc.appending ? "Transcribing your addition…" : "Transcribing…"}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xs">
                  {qc.appending
                    ? "We're turning the new clip into text and re-checking dates, matters and the best next step across the whole note."
                    : "We're turning your recording into text, polishing it and picking the best next step. This usually takes a few seconds."}
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
                <div className="relative">
                  <Button
                    variant="primary"
                    size="lg"
                    className="!w-28 !h-28 !rounded-full !px-0 shadow-lg"
                    aria-label={canUseVox ? "Start recording" : "Unlock ALOA Vox — available on Pro and above"}
                    onClick={() => {
                      guardVox(() => {
                        medium();
                        stampVoxUsedAt();
                        void qc.startRecording();
                      });
                    }}
                    disabled={!qc.supported}
                  >
                    <MicrophoneIcon className="w-11 h-11" />
                  </Button>
                  {/* Free-tier lock badge (owner spec 2026-11-20): Vox stays
                      discoverable — the mic carries a subtle lock so Free
                      users see what they're missing, and tapping opens the
                      upgrade card instead of failing. */}
                  {!canUseVox && (
                    <span
                      className="absolute -top-1 -right-1 inline-flex items-center gap-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm px-2 py-0.5"
                      aria-hidden
                    >
                      <LockClosedIcon className="w-3 h-3 text-primary-600" />
                      <span className="text-2xs font-bold text-primary-600 uppercase tracking-wide">Pro</span>
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  {conversationMode ? "Tap to record the conversation" : "Tap to speak"}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 text-center max-w-xs">
                  {!canUseVox
                    ? "ALOA Vox — voice capture, speaker labelling and the hybrid Legal Pad — is available on Pro and above."
                    : conversationMode
                      ? "Client consultations, witness conferences, settlement meetings, court hearings — each speaker is separated and labelled for you."
                      : "Dictate a note, a task or a question — no forms first. We'll suggest where it should go when you stop."}
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
            <div className="mx-4 mb-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" aria-hidden />
              {pendingSegments} audio segment{pendingSegments > 1 ? "s" : ""} waiting to upload —
              they'll go out automatically when the signal returns.
            </div>
          ) : null}

          {/* Recent captures */}
          {recent.length > 0 ? (
            <section className="px-4 pb-8" aria-label="Recent voice notes">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mb-2">Recent voice notes</h2>
              <div className="flex flex-col gap-2">
                {recent.map((r) => {
                  const Icon = INTENT_ICON[r.triageIntent || "share"] || ClipboardIcon;
                  const confirming = confirmDeleteId === r.clientLocalId;
                  const deleting = deletingId === r.clientLocalId;
                  return (
                    <div
                      key={r.captureId}
                      className="flex items-stretch gap-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
                    >
                      <Button
                        variant="bare"
                        className="flex items-center gap-3 flex-1 min-w-0 text-left px-3 py-2.5 active:bg-slate-50 dark:bg-zinc-900 dark:active:bg-zinc-800"
                        onClick={() => void qc.openCapture(r.clientLocalId)}
                        aria-label={`Open voice note: ${r.triageMeta?.summary || r.snippet?.slice(0, 60) || "Voice note"}`}
                      >
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 shrink-0">
                          <Icon className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                            {r.triageMeta?.summary || r.snippet?.slice(0, 60) || "Voice note"}
                          </span>
                          <span className="block text-xs text-slate-400 dark:text-zinc-500 truncate">
                            {r.kind === "legalpad" ? "Legal Pad" : "Quick note"}
                            {r.status === "ready" ? "" : ` · ${r.status}`}
                            {r.createdAt ? ` · ${new Date(r.createdAt).toLocaleDateString()}` : ""}
                          </span>
                        </span>
                        {!confirming ? (
                          <ChevronRightIcon className="w-4 h-4 text-slate-300 dark:text-zinc-600 shrink-0" />
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
                          className="!text-slate-400 dark:text-zinc-500 hover:!text-rose-600 shrink-0"
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
      ) : mode === "session" ? (
        /* Session Capture takes over the whole surface */
        <SessionCaptureView onExit={() => setMode("speak")} />
      ) : (
        /* Legal Pad mode takes over the whole surface */
        <LegalPadView onExit={() => setMode("speak")} />
      )}

      {/* Vox upgrade modal (owner spec 2026-11-20) — Free-tier users
          tapping the locked mic / Legal Pad / Add More land here instead of
          a dead button or a backend error. */}
      {showVoxUpsell ? <VoxUpsellModal onClose={() => setShowVoxUpsell(false)} /> : null}

      {/* Mode toggle — thumb-reachable at the bottom, pinned flush to the
          viewport bottom edge. SAFE AREAS (owner bug report 2026-11-24):
          the ONE bottom inset is here — max(0.5rem + env(safe-area-
          inset-bottom), --native-safe-bottom) — inside the white bar so
          the bar's background extends cleanly down to the screen edge
          while the buttons clear the Android gesture bar. The old
          calc(0.75rem + env(...)) stacked on top of the shell wrapper's
          CSS-injected 56px and floated the whole bar high above the
          gesture bar. Labels never wrap (whitespace-nowrap) — "Legal Pad"
          used to break onto two lines on narrow phones. */}
      {mode === "speak" ? (
        <nav
          className="border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 flex gap-2 pb-[max(calc(0.5rem+env(safe-area-inset-bottom,0px)),var(--native-safe-bottom,0px))]"
          aria-label="Capture mode"
        >
          <Button
            variant="segmented-active"
            size="md"
            minTouchTarget
            fullWidth
            icon={MicrophoneIcon}
            className="whitespace-nowrap"
            onClick={() => setMode("speak")}
          >
            Speak
          </Button>
          <Button
            variant="segmented"
            size="md"
            minTouchTarget
            fullWidth
            icon={!canUseVox ? LockClosedIcon : DocumentTextIcon}
            className="whitespace-nowrap"
            onClick={() => {
              guardVox(() => {
                light();
                setMode("pad");
              });
            }}
          >
            Legal Pad
          </Button>
          <Button
            variant="segmented"
            size="md"
            minTouchTarget
            fullWidth
            icon={!canUseVox ? LockClosedIcon : UsersIcon}
            className="whitespace-nowrap"
            onClick={() => {
              guardVox(() => {
                light();
                setMode("session");
              });
            }}
          >
            Session
          </Button>
        </nav>
      ) : null}
    </div>
  );
};
