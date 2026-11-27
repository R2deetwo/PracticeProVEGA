/**
 * ROUND 22 — the upcoming matter date (the briefing's NEXT DATE), now
 * directly editable inline. Read view is the unchanged NextDateCard with one
 * "Edit" affordance in its header row; editing reveals date + time inputs
 * with fresh factual risk chips for the picked date (weekend / public holiday
 * / clash — warnings only, never blocking). One visible Save press moves the
 * real diary event (duration preserved) or the matter's next-adjourned date
 * (when no event exists), writes the firmActivity audit row, and surfaces the
 * server's verbatim rejection on failure (the editor stays open).
 */
import React, { useState } from "react";
import { Button, Input, SectionErrorBoundary } from "../../ui";
import type { CalendarEvent, Matter } from "../../../types";
import { assessNextDate, isRecurringInstanceId } from "../courtModeUtils";
import type { CourtHearing } from "../courtModeUtils";
import { dayKeyOf } from "./format";
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
}

/** "09:30" (Input type="time" value) from a raw date string, or "". */
const hhmmOf = (dateISO: string): string => {
  if (!dateISO.includes("T")) return "";
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
}) => {
  const [editing, setEditing] = useState(false);
  const [dateISO, setDateISO] = useState(dayKeyOf(hearing.date));
  const [timeHHmm, setTimeHHmm] = useState(hhmmOf(hearing.date));
  const { isSaving, saveNextDate } = useCourtInlineEdit();

  const beginEdit = () => {
    setDateISO(dayKeyOf(hearing.date));
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
    if (saved) setEditing(false);
  };

  const attendeeIds =
    (matter.assignedUsers || []).length > 0 ? matter.assignedUsers : [viewerId];

  const readRisks = assessNextDate({
    dateISO: dayKeyOf(hearing.date),
    timeHHmm: hhmmOf(hearing.date) || null,
    matterId: matter.id,
    events,
    matters,
    attendeeIds,
    viewerId,
    userNames,
  });

  const editRisks = assessNextDate({
    dateISO,
    timeHHmm: timeHHmm || null,
    matterId: matter.id,
    events,
    matters,
    attendeeIds,
    viewerId,
    userNames,
  });

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
          <p className="mt-2 text-2xs text-subtle">
            Saving moves the diary date and logs your name, the matter and the time to the firm activity trail.
          </p>
          <Button
            variant="primary"
            size="sm"
            type="button"
            fullWidth
            minTouchTarget
            className="mt-2"
            loading={isSaving}
            disabled={!dateISO}
            onClick={() => void onSave()}
          >
            Save
          </Button>
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
                Edit
              </Button>
            )
          }
        />
      )}
    </SectionErrorBoundary>
  );
};

export default NextDateEditor;
