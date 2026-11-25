import { Matter, MatterStatus, MatterType, CalendarEvent } from "../../types";
import { extractNewClipText, joinDraftText } from "../../services/voice/draftUtils";

export interface CourtHearing {
  id: string;
  date: string;
  title: string;
  court?: string;
  judicialDivision?: string;
}

export interface CourtMatter {
  matter: Matter;
  hearings: CourtHearing[];
  previousHearing: CourtHearing | null;
  upcomingHearings: CourtHearing[];
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKey(value?: string | null): string | null {
  if (!value) return null;
  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly && !value.includes("T")) return dateOnly;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : localDateKey(date);
}

function isCourtEvent(event: CalendarEvent): boolean {
  return /court|hearing|mention|trial|sitting|adjourn|appearance/i.test(
    `${event.type} ${event.title} ${event.court || ""} ${event.judicialDivision || ""}`,
  );
}

export function getCourtHearings(
  matter: Matter,
  events: CalendarEvent[],
  today = localDateKey(new Date()),
): CourtMatter {
  const hearings: CourtHearing[] = events
    .filter((event) => event.matterId === matter.id && event.status !== "Cancelled" && isCourtEvent(event))
    .map((event) => ({
      id: event.id,
      date: event.date,
      title: event.title,
      court: event.court,
      judicialDivision: event.judicialDivision,
    }))
    .filter((hearing) => dateKey(hearing.date) !== null);

  const nextDate = dateKey(matter.nextAdjournedDate);
  if (matter.nextAdjournedDate && nextDate && !hearings.some((hearing) => dateKey(hearing.date) === nextDate)) {
    hearings.push({
      id: `matter-next-hearing-${matter.id}`,
      date: matter.nextAdjournedDate,
      title: "Next adjourned date",
      court: matter.court,
      judicialDivision: matter.judicialDivision,
    });
  }

  hearings.sort((left, right) => (dateKey(left.date) || "").localeCompare(dateKey(right.date) || ""));
  const previous = hearings.filter((hearing) => (dateKey(hearing.date) || "") < today);
  const upcoming = hearings.filter((hearing) => (dateKey(hearing.date) || "") >= today);

  return {
    matter,
    hearings,
    previousHearing: previous[previous.length - 1] || null,
    upcomingHearings: upcoming,
  };
}

export function getCourtModeMatters(
  matters: Matter[],
  events: CalendarEvent[],
  today = localDateKey(new Date()),
): CourtMatter[] {
  return matters
    .filter((matter) => matter.status === MatterStatus.Active)
    .map((matter) => getCourtHearings(matter, events, today))
    .filter(({ matter, hearings }) =>
      matter.type === MatterType.CivilLitigation ||
      matter.type === MatterType.CriminalDefense ||
      Boolean(matter.suitNumber?.trim()) ||
      Boolean(matter.court?.trim()) ||
      hearings.length > 0,
    )
    .sort((left, right) => {
      const leftNext = dateKey(left.upcomingHearings[0]?.date);
      const rightNext = dateKey(right.upcomingHearings[0]?.date);
      if (leftNext && rightNext && leftNext !== rightNext) return leftNext.localeCompare(rightNext);
      if (leftNext) return -1;
      if (rightNext) return 1;
      return left.matter.title.localeCompare(right.matter.title);
    });
}

export interface LiveTranscriptDraft {
  draft: string;
  previousTranscript: string;
}

export function mergeLiveTranscriptDraft(
  currentDraft: string,
  baseDraft: string,
  previousTranscript: string,
  nextTranscript: string,
  hasManualEdits: boolean,
): LiveTranscriptDraft {
  const next = nextTranscript.trim();
  if (!next) return { draft: currentDraft, previousTranscript };

  if (!hasManualEdits) {
    return {
      draft: joinDraftText(baseDraft, next),
      previousTranscript: next,
    };
  }

  const addition = extractNewClipText(next, previousTranscript);
  return {
    draft: addition ? joinDraftText(currentDraft, addition) : currentDraft,
    previousTranscript: next,
  };
}
