/**
 * ComposerNextDate — ROUND 25 (ALOA Vox intelligence overhaul). The
 * record-outcome composer's NEXT DATE container: the debounced detected-date
 * scan (500ms — never overwriting a manual date), the factual risk chips for
 * the picked date, and the NextDateSection presentation — including the
 * one-tap confirmation banner ("Detected next date: 4 December 2026 —
 * [Set as next date] [Dismiss]"). A confirmed or picked date is reported up
 * via `onNextDateFocused` so the Court Mode diary calendar jumps to that
 * month/date and selects it.
 */
import React, { useEffect, useMemo, useState } from "react";
import { SectionErrorBoundary } from "../../ui";
import type { CalendarEvent, Matter } from "../../../types";
import { assessNextDate, detectNextDate } from "../courtModeUtils";
import type { StoredCourtDraft } from "./courtDrafts";
import { NextDateSection } from "./NextDateSection";

type NextDateValue = NonNullable<StoredCourtDraft["nextDate"]>;

interface ComposerNextDateProps {
  matter: Matter;
  events: CalendarEvent[];
  matters: Matter[];
  viewerId: string;
  userNames: Record<string, string>;
  /** The composer's draft text — the detection input. */
  text: string;
  /** The draft's current next date (null when none chosen). */
  nextDate: NextDateValue | null;
  addToDiary: boolean;
  setAsMatterNextDate: boolean;
  onToggleAddToDiary: () => void;
  onToggleSetAsMatterNextDate: () => void;
  onNextDateChange: (nextDate: StoredCourtDraft["nextDate"]) => void;
  /** Reports a confirmed/picked date up — the diary calendar jumps to it. */
  onNextDateFocused: (dayKey: string) => void;
}

export const ComposerNextDate: React.FC<ComposerNextDateProps> = ({
  matter,
  events,
  matters,
  viewerId,
  userNames,
  text,
  nextDate,
  addToDiary,
  setAsMatterNextDate,
  onToggleAddToDiary,
  onToggleSetAsMatterNextDate,
  onNextDateChange,
  onNextDateFocused,
}) => {
  const [ignoredDetected, setIgnoredDetected] = useState<string | null>(null);
  const [detected, setDetected] = useState<ReturnType<typeof detectNextDate>>(null);

  // Detection, debounced 500ms — never touches a manual date. ROUND 21: a
  // draft nextDate may exist with an EMPTY dateISO (a purpose chosen before
  // the date) — the detected prompt shows until a real date is picked.
  useEffect(() => {
    if (!text.trim()) {
      setDetected(null);
      return;
    }
    const timer = window.setTimeout(() => setDetected(detectNextDate(text)), 500);
    return () => window.clearTimeout(timer);
  }, [text]);

  const showDetected = detected && !nextDate?.dateISO && detected.dateISO !== ignoredDetected;

  const risks = useMemo(() => {
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
            timeHHmm: nextDate?.timeHHmm ?? detected.timeHHmm ?? null,
            purpose: nextDate?.purpose ?? "Hearing",
            purposeOther: nextDate?.purposeOther,
            source: "detected",
          });
          // ROUND 25: the confirmed date jumps the Court Mode diary
          // calendar to that month/date (highlighted) on return.
          onNextDateFocused(detected.dateISO);
        }}
        onIgnoreDetected={() => detected && setIgnoredDetected(detected.dateISO)}
        onNextDateChange={(nextDateValue) => {
          onNextDateChange(nextDateValue);
          // ROUND 25: a picked date jumps the diary calendar too.
          if (nextDateValue?.dateISO) onNextDateFocused(nextDateValue.dateISO);
        }}
        onToggleAddToDiary={onToggleAddToDiary}
        onToggleSetAsMatterNextDate={onToggleSetAsMatterNextDate}
      />
    </SectionErrorBoundary>
  );
};

export default ComposerNextDate;
