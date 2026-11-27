/**
 * Round 19/23 — the record-outcome composer (full-height view, not a modal):
 * type or dictate the endorsement, detect the next date from the text
 * (debounced 500ms; never overwriting a manual date), factual risk chips,
 * the toggles and the single Save press (useOutcomeSave.ts).
 * ROUND 23 (owner spec): the redundant `Endorsement | Note` split toggle is
 * GONE — the drawer records a clean ENDORSEMENT directly (the jacket), with
 * the endorsement text and the adjourned/next date directly editable.
 */
import React, { useEffect, useRef, useState } from "react";
import { Button, SectionErrorBoundary, Textarea } from "../../ui";
import type { CalendarEvent, Matter } from "../../../types";
import { assessNextDate, detectNextDate } from "../courtModeUtils";
import type { StoredCourtDraft } from "./courtDrafts";
import { useOutcomeSave } from "./useOutcomeSave";
import { NextDateSection } from "./NextDateSection";
import { DictationBar } from "./DictationBar";

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
  onSaved: () => void;
  headingRef: React.RefObject<HTMLHeadingElement>;
}

export const OutcomeComposer: React.FC<OutcomeComposerProps> = ({
  matter,
  events,
  matters,
  viewerId,
  viewerName,
  eventTypeNames,
  userNames,
  draft,
  nextHearingDayLabel,
  onTextChange,
  onNextDateChange,
  dictation,
  canUseVox,
  captureError,
  onStartDictation,
  onStopDictation,
  onDiscardAndLeave,
  onUnlockVox,
  onSaved,
  headingRef,
}) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [ignoredDetected, setIgnoredDetected] = useState<string | null>(null);
  const [addToDiary, setAddToDiary] = useState(true);
  const [setAsMatterNextDate, setSetAsMatterNextDate] = useState(true);
  const [detected, setDetected] = useState<ReturnType<typeof detectNextDate>>(null);

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

  // Detection, debounced 500ms — never touches a manual date.
  useEffect(() => {
    if (!text.trim()) {
      setDetected(null);
      return;
    }
    const timer = window.setTimeout(() => setDetected(detectNextDate(text)), 500);
    return () => window.clearTimeout(timer);
  }, [text]);

  // ROUND 21: a draft nextDate may exist with an EMPTY dateISO (a purpose
  // chosen before the date) — the detected prompt shows until a real date.
  const showDetected = detected && !nextDate?.dateISO && detected.dateISO !== ignoredDetected;

  const risks = React.useMemo(() => {
    if (!nextDate?.dateISO) return [];
    return assessNextDate({
      dateISO: nextDate.dateISO,
      timeHHmm: nextDate.timeHHmm,
      matterId: matter.id,
      events,
      matters,
      attendeeIds: (matter.assignedUsers || []).length > 0 ? matter.assignedUsers : [viewerId],
      viewerId,
      userNames,
    });
  }, [nextDate?.dateISO, nextDate?.timeHHmm, matter, events, matters, viewerId, userNames]);

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

        <SectionErrorBoundary sectionName="Next date">
          <NextDateSection
            nextDate={nextDate}
            detected={detected}
            risks={risks}
            showDetected={Boolean(showDetected)}
            addToDiary={addToDiary}
            setAsMatterNextDate={setAsMatterNextDate}
            onUseDetected={() => {
              if (!detected) return;
              onNextDateChange({
                dateISO: detected.dateISO,
                timeHHmm: nextDate?.timeHHmm ?? null,
                purpose: nextDate?.purpose ?? "Hearing",
                purposeOther: nextDate?.purposeOther,
                source: "detected",
              });
            }}
            onIgnoreDetected={() => detected && setIgnoredDetected(detected.dateISO)}
            onNextDateChange={onNextDateChange}
            onToggleAddToDiary={() => setAddToDiary((value) => !value)}
            onToggleSetAsMatterNextDate={() => setSetAsMatterNextDate((value) => !value)}
          />
        </SectionErrorBoundary>
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
