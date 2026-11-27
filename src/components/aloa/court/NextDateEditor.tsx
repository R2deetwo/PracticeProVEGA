/**
 * ROUND 22 — the upcoming matter date (the briefing's NEXT DATE), now
 * directly editable inline. Read view is the unchanged NextDateCard with one
 * "Edit" affordance in its header row; editing reveals date + time inputs
 * with fresh factual risk chips for the picked date (weekend / public holiday
 * / clash — warnings only, never blocking). One visible Save press moves the
 * real diary event (duration preserved) or the matter's next-adjourned date
 * (when no event exists), writes the firmActivity audit row, and surfaces the
 * server's verbatim rejection on failure (the editor stays open).
 *
 * ROUND 25 (owner bug report 2026-11-28): a MISSING or malformed date is a
 * first-class state, never `undefined NaN` garbage — the card renders the
 * "No next date set" empty state with a subtle "Set date" action, editing an
 * adjourned matter's date is clean, and a matter-level (synthesized) date can
 * be RESET via "Clear date" (the matter drops back to "Needs a new date").
 * `onDateSet` reports every committed date so the Court Mode diary calendar
 * can jump to and highlight that day.
 */
import React, { useState } from "react";
import { Button, Input, SectionErrorBoundary } from "../../ui";
import type { CalendarEvent, Matter } from "../../../types";
import { assessNextDate, isRecurringInstanceId, SYNTHESIZED_HEARING_ID_PREFIX } from "../courtModeUtils";
import type { CourtHearing } from "../courtModeUtils";
import { safeDayKeyOf } from "./format";
import { NextDateCard } from "./NextDateCard";
import { DateRiskChips } from "./DateRiskChips";
import { useCourtInlineEdit } from "./useCourtInlineEdit";

interface NextDateEditorProps {
  matter: Matter;
  hearing: CourtHearing;
  /** The visible diary events (the moved event + the clash surface). */
  events: CalendarEvent[];
  matters: Matter[];
  viewerId: string;
  userNames: Record<string, string>;
  today: string;
  /** Preserved rule: editing is disabled while dictation is busy. */
  captureBusy: boolean;
  /** ROUND 25: fired with the committed day key — the diary calendar jumps
   *  to that month/date and selects it so the lawyer can verify what is on
   *  the diary that day. */
  onDateSet?: (dayKey: string) => void;
}

/** "09:30" (Input type="time" value) from a raw date string, or "". */
const hhmmOf = (dateISO: string): string => {
  if (!dateISO || !dateISO.includes("T")) return "";
  const match = /^(\d{2}):(\d{2})/.exec(dateISO.split("T")[1] || "");
  return match ? `${match[1]}:${match[2]}` : "";
};

export const NextDateEditor: React.FC<NextDateEditorProps> = ({
  matter,
  hearing,
  events,
  matters,
  viewerId,
  userNames,
  today,
  captureBusy,
  onDateSet,
}) => {
  const [editing, setEditing] = useState(false);
  // ROUND 25: a missing/malformed hearing date starts the editor EMPTY —
  // never a NaN string ("undefined NaN undefined NaN" came from formatting
  // an empty date).
  const existingDayKey = safeDayKeyOf(hearing.date);
  const [dateISO, setDateISO] = useState(existingDayKey ?? "");
  const [timeHHmm, setTimeHHmm] = useState(hhmmOf(hearing.date));
  const { isSaving, saveNextDate } = useCourtInlineEdit();

  // ROUND 25: only the matter's own (synthesized) next-adjourned date can be
  // RESET here — a real diary event is moved on the calendar, never deleted
  // from this card.
  const isMatterLevelDate = hearing.id.startsWith(SYNTHESIZED_HEARING_ID_PREFIX);

  const beginEdit = () => {
    setDateISO(existingDayKey ?? "");
    setTimeHHmm(hhmmOf(hearing.date));
    setEditing(true);
  };

  const onSave = async () => {
    const saved = await saveNextDate({
      matter,
      hearing,
      dateISO,
      timeHHmm: timeHHmm || null,
      events,
    });
    if (saved) {
      setEditing(false);
      // ROUND 25: the diary calendar jumps to the committed date.
      if (dateISO) onDateSet?.(dateISO);
    }
  };

  const attendeeIds =
    (matter.assignedUsers || []).length > 0 ? matter.assignedUsers : [viewerId];

  const readRisks = existingDayKey
    ? assessNextDate({
        dateISO: existingDayKey,
        timeHHmm: hhmmOf(hearing.date) || null,
        matterId: matter.id,
        events,
        matters,
        attendeeIds,
        viewerId,
        userNames,
      })
    : [];

  const editRisks = dateISO
    ? assessNextDate({
        dateISO,
        timeHHmm: timeHHmm || null,
        matterId: matter.id,
        events,
        matters,
        attendeeIds,
        viewerId,
        userNames,
      })
    : [];

  return (
    <SectionErrorBoundary sectionName="Next date">
      {editing ? (
        <div className="rounded-md border border-hairline bg-surface-2 p-3 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-subtle">
              Next date
            </p>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={isSaving}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input
              type="date"
              label="Date"
              value={dateISO}
              onChange={(event) => setDateISO(event.target.value)}
            />
            <Input
              type="time"
              label="Time"
              value={timeHHmm}
              onChange={(event) => setTimeHHmm(event.target.value)}
            />
          </div>
          {dateISO && editRisks.length ? <DateRiskChips risks={editRisks} className="mt-2" /> : null}
          {!dateISO ? (
            <p className="mt-2 text-2xs text-subtle">
              {isMatterLevelDate
                ? "Saving with no date clears the matter's next date — it drops back to \u201cNeeds a new date\u201d in the diary."
                : "Pick a date for this diary item, or cancel."}
            </p>
          ) : null}
          <p className="mt-2 text-2xs text-subtle">
            Saving moves the diary date and logs your name, the matter and the time to the firm activity trail.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              type="button"
              minTouchTarget
              className="flex-1"
              loading={isSaving}
              disabled={isMatterLevelDate ? false : !dateISO}
              onClick={() => void onSave()}
            >
              Save
            </Button>
            {isMatterLevelDate ? (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={isSaving || !existingDayKey}
                onClick={() => {
                  /* ROUND 25: the clean reset — clear the matter-level date. */
                  setDateISO("");
                }}
              >
                Clear date
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <NextDateCard
          hearing={hearing}
          risks={readRisks}
          today={today}
          action={
            /* ROUND 23 (parity): a recurring series' occurrence is a
             * virtual instance — moving it here would silently move the
             * whole series' anchor, so the series is edited on the
             * calendar instead (stated plainly, never a dead button). */
            isRecurringInstanceId(hearing.id) ? (
              <p className="text-2xs text-subtle">Recurring diary item — edit the series on the calendar.</p>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={captureBusy}
                title={captureBusy ? "Finish or discard dictation first." : undefined}
                onClick={beginEdit}
              >
                {/* ROUND 25: no valid date on record → the affordance sets
                 * one; an existing date is edited. */}
                {existingDayKey ? "Edit" : "Set date"}
              </Button>
            )
          }
        />
      )}
    </SectionErrorBoundary>
  );
};

export default NextDateEditor;
