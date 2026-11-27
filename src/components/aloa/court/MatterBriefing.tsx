/**
 * Round 19/21/22 — Court Mode matter briefing: title + copyable suit number,
 * court line, responsible lawyers, the NEXT DATE card (Round 22: directly
 * editable inline with factual risk chips + an audit trail — NextDateEditor),
 * the matter-scoped mini-calendar (Round 22: My diary | Firm diary dots), the
 * saved endorsement at the bottom (Round 22: directly editable inline with an
 * audit trail — EndorsementEditor), accordions, and the sticky Record outcome
 * dock. Empty fields are HIDDEN. ROUND 25: the shared strict date resolver
 * (`safeDayKeyOf`) replaces the local lenient copy, and the mini-calendar
 * gets a `calendarFocusDayKey` that jumps it to that month/date and selects
 * it (the diary auto-jump for confirmed dictation dates).
 */
import React, { useMemo, useState } from "react";
import { Badge, Button, SectionErrorBoundary } from "../../ui";
import type { CalendarEvent, Document, Matter, NotePage } from "../../../types";
import type { CourtMatter } from "../courtModeUtils";
import { endorsementOrderMs, isCourtCalendarEvent, SYNTHESIZED_HEARING_ID_PREFIX } from "../courtModeUtils";
import { copyToClipboard } from "../../../utils/clipboard";
import { useUI } from "../../../contexts/UIContext";
import { formatDayKeyLong, safeDayKeyOf, timeLabelOf } from "./format";
import { NextDateEditor } from "./NextDateEditor";
import { EndorsementEditor } from "./EndorsementEditor";
import { BriefingAccordions } from "./BriefingAccordions";
import { MiniCalendar } from "./MiniCalendar";

interface MatterBriefingProps {
  matter: Matter;
  courtMatter: CourtMatter;
  notes: NotePage[];
  documents: Document[];
  events: CalendarEvent[];
  matters: Matter[];
  nonCourtEvents: CalendarEvent[];
  viewerId: string;
  userNames: Record<string, string>;
  today: string;
  captureBusy: boolean;
  headingRef: React.RefObject<HTMLHeadingElement>;
  onOpenCompose: () => void;
  onOpenDocument: (documentId: string) => void;
  onViewAllNotes: () => void;
  onAddCourtDetails: () => void;
  onUseDate: (dateISO: string) => void;
  /** ROUND 25: the diary calendar jumps to this month/date and selects it
   *  (set when a dictated date is confirmed or a NEXT DATE edit commits). */
  calendarFocusDayKey?: string | null;
  /** ROUND 25: bubble a committed NEXT DATE edit up to the diary focus. */
  onCalendarFocus?: (dayKey: string) => void;
}

export const MatterBriefing: React.FC<MatterBriefingProps> = ({
  matter,
  courtMatter,
  notes,
  documents,
  events,
  matters,
  nonCourtEvents,
  viewerId,
  userNames,
  today,
  captureBusy,
  headingRef,
  onOpenCompose,
  onOpenDocument,
  onViewAllNotes,
  onAddCourtDetails,
  onUseDate,
  calendarFocusDayKey,
  onCalendarFocus,
}) => {
  const { addToast } = useUI();
  // ROUND 23: "No next date recorded." opens the SAME inline editor directly
  // — one press, no round-trip through Record outcome.
  const [settingNextDate, setSettingNextDate] = useState(false);

  const handleCopySuit = async (suitNumber: string) => {
    const copied = await copyToClipboard(suitNumber);
    if (copied) addToast("Suit number copied", { type: "success" });
    else addToast("Could not copy the suit number.", { type: "error" });
  };

  const isMine = (matter.assignedUsers || []).includes(viewerId);
  // ROUND 23: chronological by the SITTING date (the jacket's Date line) so a
  // backdated record slots into order; endorsements and plain notes stay
  // DISTINCT lists — never an awkward "and notes" label.
  const endorsements = notes
    .filter((note) => note.type === "endorsement" && !note.archivedAt)
    .sort((left, right) => endorsementOrderMs(right) - endorsementOrderMs(left) || right.id.localeCompare(left.id));
  const lastEndorsement = endorsements[0] || null;
  const previousEndorsements = endorsements.slice(1);
  const plainNotes = notes.filter((note) => note.type !== "endorsement" && !note.archivedAt);

  const nextHearing = courtMatter.upcomingHearings[0] || null;
  const responsibleNames = (matter.assignedUsers || []).map((id) => userNames[id] ?? id);
  const courtLine = [matter.court, matter.judicialDivision, matter.courtRoom].filter(Boolean).join(" · ");

  // Round 21 — the mini-calendar's clash surface: every visible court-type
  // diary event (Round 22 adds attendeeIds for the My|Firm dot filter).
  // ROUND 23 (parity): THIS matter's own diary items show too, so the date
  // picker never disagrees with the main calendar about its own dates.
  const calendarEntries = useMemo(
    () =>
      events
        .filter((event) => event.status !== "Cancelled" && (isCourtCalendarEvent(event) || event.matterId === matter.id))
        .map((event) => {
          const eventMatter = matters.find((candidate) => candidate.id === event.matterId);
          const eventAssignees = event.assignedUsers || [];
          return {
            eventId: event.id,
            matterId: event.matterId || "",
            matterTitle: eventMatter?.title || event.title || "Court item",
            suitNumber: eventMatter?.suitNumber,
            court: eventMatter?.court,
            purpose: event.type || "Hearing",
            date: event.date,
            attendeeIds: eventAssignees.length > 0 ? eventAssignees : (eventMatter?.assignedUsers || []),
          };
        }),
    [events, matters],
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="space-y-4 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <SectionErrorBoundary sectionName="Matter details">
          <div className="rounded-md border border-hairline bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-2">
              <h2 ref={headingRef} tabIndex={-1} className="min-w-0 flex-1 break-words text-base font-extrabold leading-snug text-strong">
                {matter.title}
              </h2>
              {matter.suitNumber ? (
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  className="flex-shrink-0"
                  onClick={() => void handleCopySuit(matter.suitNumber || "")}
                >
                  Copy
                </Button>
              ) : null}
            </div>
            {matter.suitNumber || matter.referenceNumber ? (
              <p className="mt-1 break-words text-sm font-semibold text-body">
                {[matter.suitNumber, matter.referenceNumber ? `Ref ${matter.referenceNumber}` : ""].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {courtLine ? (
              <p className="mt-1 break-words text-sm text-body">{courtLine}</p>
            ) : (
              <Button variant="ghost" size="sm" type="button" className="mt-1 -ml-2" onClick={onAddCourtDetails}>
                Add court details
              </Button>
            )}
            {matter.presidingJudge ? <p className="mt-1 break-words text-sm text-body">{matter.presidingJudge}</p> : null}
            {responsibleNames.length ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <p className="text-sm text-body">Responsible: {responsibleNames.join(", ")}</p>
                {!isMine ? <Badge tone="info">Colleague&apos;s matter</Badge> : null}
              </div>
            ) : null}
            {matter.opposingCounsel ? <p className="mt-1 break-words text-sm text-body">Opposing counsel: {matter.opposingCounsel}</p> : null}
          </div>
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="Next date">
          {nextHearing || settingNextDate ? (
            <NextDateEditor
              matter={matter}
              hearing={nextHearing || { id: `${SYNTHESIZED_HEARING_ID_PREFIX}${matter.id}`, date: "", title: "Next adjourned date" }}
              events={events}
              matters={matters}
              viewerId={viewerId}
              userNames={userNames}
              today={today}
              captureBusy={captureBusy}
              onDateSet={onCalendarFocus}
            />
          ) : (
            /* ROUND 23 (owner spec §5): setting the next date is one direct
             * press from the empty state — no round-trip through Record
             * outcome, no awkward loop when an endorsement already exists. */
            <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-edge bg-surface-2 p-3">
              <p className="text-sm text-body">No next date recorded.</p>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                disabled={captureBusy}
                onClick={() => setSettingNextDate(true)}
              >
                Set next date
              </Button>
            </div>
          )}
          {courtMatter.upcomingHearings.length > 1 ? (
            <div className="mt-2 space-y-1.5">
              <p className="text-2xs font-black uppercase tracking-widest text-subtle">
                Upcoming ({courtMatter.upcomingHearings.length - 1})
              </p>
              {courtMatter.upcomingHearings.slice(1).map((hearing) => (
                <p key={hearing.id} className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold">{formatDayKeyLong(safeDayKeyOf(hearing.date) ?? "")}</span>
                  {timeLabelOf(hearing.date) ? <span className="text-body">{timeLabelOf(hearing.date)}</span> : null}
                </p>
              ))}
            </div>
          ) : null}
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="Check dates">
          <MiniCalendar
            entries={calendarEntries}
            matterId={matter.id}
            today={today}
            onUseDate={onUseDate}
            captureBusy={captureBusy}
            viewerId={viewerId}
            focusDayKey={calendarFocusDayKey}
          />
        </SectionErrorBoundary>

        {lastEndorsement ? (
          <EndorsementEditor note={lastEndorsement} matter={matter} captureBusy={captureBusy} />
        ) : null}

        <BriefingAccordions
          previousEndorsements={previousEndorsements}
          plainNotes={plainNotes}
          documents={documents}
          nonCourtEvents={nonCourtEvents}
          captureBusy={captureBusy}
          onViewAllNotes={onViewAllNotes}
          onOpenDocument={onOpenDocument}
        />
      </div>

      <div className="sticky bottom-0 border-t border-hairline bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-zinc-950">
        <Button variant="primary" size="lg" type="button" fullWidth minTouchTarget onClick={onOpenCompose}>
          Record outcome
        </Button>
      </div>
    </div>
  );
};

export default MatterBriefing;
