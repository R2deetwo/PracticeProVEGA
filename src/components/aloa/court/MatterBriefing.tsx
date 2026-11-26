/**
 * Round 19/21/22 — Court Mode matter briefing: title + copyable suit number,
 * court line, responsible lawyers, the NEXT DATE card (Round 22: directly
 * editable inline with factual risk chips + an audit trail — NextDateEditor),
 * the matter-scoped mini-calendar (Round 22: My diary | Firm diary dots), the
 * saved endorsement at the bottom (Round 22: directly editable inline with an
 * audit trail — EndorsementEditor), accordions, and the sticky Record outcome
 * dock. Empty fields are HIDDEN.
 */
import React, { useMemo } from "react";
import { Badge, Button, SectionErrorBoundary } from "../../ui";
import type { CalendarEvent, Document, Matter, NotePage } from "../../../types";
import type { CourtMatter } from "../courtModeUtils";
import { isCourtCalendarEvent } from "../courtModeUtils";
import { copyToClipboard } from "../../../utils/clipboard";
import { useUI } from "../../../contexts/UIContext";
import { formatDayKeyLong, timeLabelOf } from "./format";
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
}

const dayKeyOf = (dateISO: string): string => {
  const dateOnly = dateISO.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly && !dateISO.includes("T")) return dateOnly;
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return dateISO.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

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
}) => {
  const { addToast } = useUI();

  const handleCopySuit = async (suitNumber: string) => {
    const copied = await copyToClipboard(suitNumber);
    if (copied) addToast("Suit number copied", { type: "success" });
    else addToast("Could not copy the suit number.", { type: "error" });
  };

  const isMine = (matter.assignedUsers || []).includes(viewerId);
  const endorsements = notes
    .filter((note) => note.type === "endorsement" && !note.archivedAt)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const lastOrder = endorsements[0] || null;
  const earlierNotes = notes.filter((note) => note.id !== lastOrder?.id);

  const nextHearing = courtMatter.upcomingHearings[0] || null;
  const responsibleNames = (matter.assignedUsers || []).map((id) => userNames[id] ?? id);
  const courtLine = [matter.court, matter.judicialDivision, matter.courtRoom].filter(Boolean).join(" · ");

  // Round 21 — the mini-calendar's clash surface: every visible court-type
  // diary event, so a tap reveals what a date collides with. Round 22 adds
  // attendeeIds so the My diary | Firm diary toggle can filter the dots.
  const calendarEntries = useMemo(
    () =>
      events
        .filter((event) => event.status !== "Cancelled" && isCourtCalendarEvent(event))
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
          {nextHearing ? (
            <NextDateEditor
              matter={matter}
              hearing={nextHearing}
              events={events}
              matters={matters}
              viewerId={viewerId}
              userNames={userNames}
              today={today}
              captureBusy={captureBusy}
            />
          ) : (
            <div className="rounded-md border border-dashed border-edge bg-surface-2 p-3 text-sm text-body">
              No next date recorded.
            </div>
          )}
          {courtMatter.upcomingHearings.length > 1 ? (
            <div className="mt-2 space-y-1.5">
              <p className="text-2xs font-black uppercase tracking-widest text-subtle">
                Upcoming ({courtMatter.upcomingHearings.length - 1})
              </p>
              {courtMatter.upcomingHearings.slice(1).map((hearing) => (
                <p key={hearing.id} className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold">{formatDayKeyLong(dayKeyOf(hearing.date))}</span>
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
          />
        </SectionErrorBoundary>

        {lastOrder ? (
          <EndorsementEditor note={lastOrder} matter={matter} captureBusy={captureBusy} />
        ) : null}

        <BriefingAccordions
          earlierNotes={earlierNotes}
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
