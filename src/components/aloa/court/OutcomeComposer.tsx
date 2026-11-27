/**
 * Round 19/23 — the record-outcome composer (full-height view, not a modal):
 * type or dictate the endorsement, detect the next date from the text
 * (debounced 500ms; never overwriting a manual date), factual risk chips,
 * the toggles and the single Save press (useOutcomeSave.ts).
 * ROUND 23: the `Endorsement | Note` split toggle is GONE — the drawer
 * records a clean ENDORSEMENT directly (the jacket), with the endorsement
 * text and the adjourned/next date directly editable.
 * ROUND 25 (ALOA Vox intelligence overhaul, owner bug report 2026-11-28):
 * REVIEW WORKFLOW — Raw Transcript → Cleaned Draft (editable) → Save (the
 * LLM cleanup pass status + the raw transcript render in
 * DictationReviewPanel; "Clean up with AI" re-runs on demand); ACTIONABLE
 * EXTRACTION — one-tap items auto-associated with the active matter
 * (DetectedActionsList + useCourtroomActions), the detected NEXT DATE
 * surfacing through the one-tap banner (ComposerNextDate); DIARY JUMP — a
 * confirmed/picked date reports up via `onNextDateFocused` so the Court
 * Mode diary calendar switches to that month/date and selects it.
 */
import React, { useEffect, useRef, useState } from "react";
import { Button, SectionErrorBoundary, Textarea } from "../../ui";
import type { CalendarEvent, Matter } from "../../../types";
import type { StoredCourtDraft } from "./courtDrafts";
import { useOutcomeSave } from "./useOutcomeSave";
import { useCourtroomActions } from "./useCourtroomActions";
import { ComposerNextDate } from "./ComposerNextDate";
import { DictationBar } from "./DictationBar";
import { DictationReviewPanel } from "./DictationReviewPanel";
import { DetectedActionsList } from "./DetectedActionsList";
import { extractCourtroomActions } from "../../../services/voice/courtroomExtraction";
import type { EndorsementCleanupPhase } from "./useCourtDictation";

export interface DictationBarState {
  phase: "idle" | "recording" | "processing" | "queued" | "triage" | "error";
  elapsedMs: number;
  transcriptSoFar: string;
  error: string | null;
  supported: boolean;
}

interface OutcomeComposerProps {
  matter: Matter;
  events: CalendarEvent[];
  matters: Matter[];
  viewerId: string;
  viewerName: string;
  eventTypeNames: string[];
  userNames: Record<string, string>;
  draft: StoredCourtDraft | null;
  /** Short label of the matter's next hearing day (null when none). */
  nextHearingDayLabel: string | null;
  onTextChange: (text: string) => void;
  onNextDateChange: (nextDate: StoredCourtDraft["nextDate"]) => void;
  dictation: DictationBarState;
  canUseVox: boolean;
  captureError: string | null;
  onStartDictation: () => void;
  onStopDictation: () => void;
  onDiscardAndLeave: () => void;
  onUnlockVox: () => void;
  /** ROUND 25: the LLM cleanup pass status + on-demand re-run. */
  cleanupPhase: EndorsementCleanupPhase;
  onRunCleanup: () => void;
  /** ROUND 25: reports a confirmed/picked next date so the Court Mode diary
   *  calendar jumps to that month/date and highlights it. */
  onNextDateFocused: (dayKey: string) => void;
  onSaved: () => void;
  headingRef: React.RefObject<HTMLHeadingElement>;
}

export const OutcomeComposer: React.FC<OutcomeComposerProps> = ({
  matter, events, matters, viewerId, viewerName, eventTypeNames, userNames,
  draft, nextHearingDayLabel, onTextChange, onNextDateChange,
  dictation, canUseVox, captureError,
  onStartDictation, onStopDictation, onDiscardAndLeave, onUnlockVox,
  cleanupPhase, onRunCleanup, onNextDateFocused, onSaved, headingRef,
}) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [addToDiary, setAddToDiary] = useState(true);
  const [setAsMatterNextDate, setSetAsMatterNextDate] = useState(true);
  const [extraction, setExtraction] = useState<ReturnType<typeof extractCourtroomActions> | null>(null);
  const { createdActions, createAction } = useCourtroomActions({ matter, viewerId });

  const text = draft?.text ?? "";
  // ROUND 23: the Endorsement | Note split toggle is gone — this composer
  // records an ENDORSEMENT (the standard jacket, built by the save plan).
  const noteType = "endorsement" as const;
  const nextDate = draft?.nextDate ?? null;
  const isMine = (matter.assignedUsers || []).includes(viewerId);
  const responsibleNames = (matter.assignedUsers || []).map((id) => userNames[id] ?? id);
  const captureBusy = dictation.phase === "recording" || dictation.phase === "processing" || dictation.phase === "queued";

  const saveState = useOutcomeSave({
    matter,
    events,
    viewerId,
    viewerName,
    eventTypeNames,
    nextDate,
    addToDiary,
    setAsMatterNextDate,
    onTextCleared: () => onTextChange(""),
    onNextDateCleared: () => onNextDateChange(null),
    onSaved,
  });

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);
  useEffect(() => {
    const node = textAreaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.max(node.scrollHeight, 132)}px`;
  }, [text]);

  // Detection, debounced 500ms — never touches a manual date. ROUND 25: the
  // same debounce runs the actionable structured extraction (tasks /
  // reminders linked to the active matter); the detected-date scan itself
  // lives in ComposerNextDate (same 500ms cadence).
  useEffect(() => {
    if (!text.trim()) {
      setExtraction(null);
      return;
    }
    const timer = window.setTimeout(() => setExtraction(extractCourtroomActions(text)), 500);
    return () => window.clearTimeout(timer);
  }, [text]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        Record outcome
      </h2>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
        <div>
          <p className="break-words text-sm font-bold text-strong">{matter.title}</p>
          {nextHearingDayLabel ? <p className="text-sm text-body">{nextHearingDayLabel}</p> : null}
        </div>
        {!isMine ? (
          <p className="rounded-sm bg-status-info/10 px-3 py-2 text-xs font-medium text-status-info">
            For {responsibleNames.join(", ")} — endorsement to the matter, next date to their diary.
          </p>
        ) : null}

        <SectionErrorBoundary sectionName="Endorsement text">
          <Textarea
            ref={textAreaRef}
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            rows={6}
            label="Endorsement text"
            placeholder="Type or dictate today's outcome."
            containerClassName="mt-1"
            aria-label="Editable endorsement"
          />
          {text.trim() || nextDate ? <p className="mt-1 text-xs text-subtle">Draft saved on this device</p> : null}
        </SectionErrorBoundary>

        {/* ROUND 25 — the cleanup-pass status, the on-demand re-run and the
            raw transcript kept beside the cleaned, editable draft. */}
        <DictationReviewPanel
          cleanupPhase={cleanupPhase}
          rawTranscript={draft?.rawTranscript}
          onRunCleanup={onRunCleanup}
          canRunCleanup={Boolean(text.trim()) && cleanupPhase !== "cleaning" && !captureBusy}
        />

        {saveState.partialFailure ? (
          <div className="flex items-center justify-between gap-2 rounded-sm border border-status-warning/40 bg-status-warning/10 px-3 py-2">
            <p className="min-w-0 flex-1 text-xs font-semibold text-status-warning">Note saved. Diary not updated.</p>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              loading={saveState.isSaving}
              onClick={() => void saveState.retry(captureBusy)}
            >
              Retry
            </Button>
          </div>
        ) : null}

        {/* ROUND 25 — the NEXT DATE container: the one-tap detected-date
            banner (Set as next date / Dismiss), risk chips, toggles. */}
        <ComposerNextDate
          matter={matter}
          events={events}
          matters={matters}
          viewerId={viewerId}
          userNames={userNames}
          text={text}
          nextDate={nextDate}
          addToDiary={addToDiary}
          setAsMatterNextDate={setAsMatterNextDate}
          onToggleAddToDiary={() => setAddToDiary((value) => !value)}
          onToggleSetAsMatterNextDate={() => setSetAsMatterNextDate((value) => !value)}
          onNextDateChange={onNextDateChange}
          onNextDateFocused={onNextDateFocused}
        />

        {/* ROUND 25 — ACTIONABLE EXTRACTION: separated, one-tap items
            auto-associated with the active matter. */}
        <DetectedActionsList
          tasks={extraction?.tasks ?? []}
          reminders={extraction?.reminders ?? []}
          createdActions={createdActions}
          onCreate={(action) => void createAction(action)}
        />
      </div>

      <div className="flex-shrink-0 space-y-2 border-t border-hairline bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-zinc-950">
        <DictationBar
          phase={dictation.phase}
          elapsedMs={dictation.elapsedMs}
          transcriptSoFar={dictation.transcriptSoFar}
          error={dictation.error ?? captureError}
          supported={dictation.supported}
          canUseVox={canUseVox}
          onStart={onStartDictation}
          onStop={onStopDictation}
          onDiscardAndLeave={onDiscardAndLeave}
          onWriteEndorsement={() => textAreaRef.current?.focus()}
          onUnlockVox={onUnlockVox}
        />
        <Button
          variant="primary"
          size="lg"
          type="button"
          fullWidth
          minTouchTarget
          loading={saveState.isSaving}
          disabled={!text.trim() || captureBusy}
          onClick={() => void saveState.save(noteType, text, captureBusy)}
        >
          Save endorsement
        </Button>
      </div>
    </div>
  );
};

export default OutcomeComposer;
