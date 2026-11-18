/**
 * QuickCaptureView — the lightweight, mobile-first landing surface.
 *
 * "When a user opens the app on a mobile phone, do NOT force them straight
 * into the heavy multi-column office dashboard. Instead, launch into a
 * clean, high-contrast, thumb-friendly Quick Capture Mode (while keeping a
 * clear Open Full Office button at the top)." (owner spec, 2026-11-18)
 *
 * Two complementary workflows:
 *   A. SPEAK FIRST, ROUTE LATER (walkie-talkie) — search/ask bar on top,
 *      one big record button, smart post-capture triage.
 *   B. HYBRID LEGAL PAD — toggle for consultations / witness interviews /
 *      field evidence.
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
  ChevronRightIcon,
  ClipboardIcon,
  CogIcon,
  DocumentTextIcon,
  MicrophoneIcon,
  SparklesIcon,
  StopIcon,
} from "../../constants";
import { useUI } from "../../contexts/UIContext";
import { useAuth } from "../../contexts/AuthContext";
import { useCoreState } from "../../contexts/CoreContext";
import { useMatterState } from "../../contexts/MatterContext";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useQuickCapture } from "../../hooks/useQuickCapture";
import { quickAsk, listRecentCaptures, type CaptureProjection, type QuickAskResult } from "../../services/voice/voiceCaptureService";
import { extractNewClipText, joinDraftText } from "../../services/voice/draftUtils";
import { TriageCard } from "./TriageCard";
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

/** Which transcript tier the editable draft follows. */
type DraftSource = "clean" | "verbatim";

export const QuickCaptureView: React.FC = () => {
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
    onReadyToast: () => {
      addToast("Voice note ready — tap to review it.", { type: "success" });
    },
  });

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
      // seed a fresh draft from the preferred tier.
      const source: DraftSource =
        capture.smartCleanText && draftSource === "clean" ? "clean" : "verbatim";
      setDraftText(
        source === "clean" ? capture.smartCleanText || verbatim : verbatim
      );
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
      if (draftEditedRef.current) {
        // Manual edits are sacred: append the new words after them.
        setDraftText((d) => joinDraftText(d, newClip));
      } else if (draftSource === "clean" && capture.smartCleanText) {
        // Pristine Smart Clean draft: adopt the re-polished combined text.
        setDraftText(capture.smartCleanText);
      } else {
        setDraftText((d) => joinDraftText(d, newClip));
      }
      setClipCount((c) => c + 1);
      lastSyncedVerbatimRef.current = verbatim;
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

  const handleResyncDraft = useCallback(() => {
    if (!qc.capture) return;
    const capture = qc.capture;
    const verbatim = capture.verbatimText || "";
    const text =
      draftSource === "clean" ? capture.smartCleanText || verbatim : verbatim;
    setDraftText(text);
    draftEditedRef.current = false;
    toastRef.current("Draft re-synced from the transcript.", { type: "info" });
  }, [qc.capture, draftSource]);

  const handleToggleSource = useCallback(() => {
    if (!qc.capture) return;
    const capture = qc.capture;
    const next: DraftSource = draftSource === "clean" ? "verbatim" : "clean";
    if (next === "verbatim" || !capture.smartCleanText) {
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
    if (!draftEditedRef.current) setDraftText(capture.smartCleanText || "");
    else
      toastRef.current(
        "Showing the Smart Clean tier needs a re-sync — tap Re-sync to replace your edits.",
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
      const result = await quickAsk(q);
      setAskResult(result);
    } catch (err: any) {
      addToast(err?.message || "Quick Ask failed. Please try again.", { type: "error" });
    } finally {
      setAsking(false);
    }
  }, [askText, asking, addToast]);

  const pendingSegments = qc.queueStats?.pendingSegments ?? 0;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50">
      {/* Top bar: brand + Open Full Office + settings */}
      <header className="flex items-center justify-between gap-2 px-4 py-3 bg-white border-b border-slate-200 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 text-white shrink-0">
            <MicrophoneIcon className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h1 className="font-bold text-slate-900 leading-tight text-base">Quick Capture</h1>
            <p className="text-2xs text-slate-500 leading-tight truncate">
              {currentUser?.name ? `Capturing for ${coreState.firmDetails?.name || "your firm"}` : "Speak first, route later"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            minTouchTarget
            icon={ChevronRightIcon}
            onClick={() => {
              light();
              navigateTo("dashboard");
            }}
          >
            Open Full Office
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={CogIcon}
            aria-label="Settings"
            onClick={() => navigateTo("settings")}
          />
        </div>
      </header>

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
                  onOpenMatter={(matterId) => navigateTo("matterDetail", matterId)}
                  onOpenCalendar={() => navigateTo("calendar")}
                  draftText={draftText}
                  onDraftChange={handleDraftChange}
                  onAddMore={handleAddMore}
                  onResyncDraft={handleResyncDraft}
                  clipCount={clipCount}
                  draftSource={draftSource}
                  onToggleSource={handleToggleSource}
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
                  return (
                    <Button
                      key={r.captureId}
                      variant="outline"
                      size="md"
                      fullWidth
                      minTouchTarget
                      onClick={() => void qc.openCapture(r.clientLocalId)}
                      className="!justify-start text-left"
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
                      <ChevronRightIcon className="w-4 h-4 text-slate-300 shrink-0" />
                    </Button>
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
