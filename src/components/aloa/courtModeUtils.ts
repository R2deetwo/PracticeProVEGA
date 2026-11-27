import { Matter, MatterStatus, MatterType, CalendarEvent, NotePage } from "../../types";
import { extractNewClipText, joinDraftText } from "../../services/voice/draftUtils";
import { extractDatedMention, formatDatedMention, endorsementTitleFrom } from "../../utils/endorsementDateParser";
import { isPublicHoliday, isWeekend } from "../../utils/courtCalculator";
import { expandRecurringEvents, parseDateString } from "../../utils/calendarUtils";

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

// ─────────────────────────────────────────────────────────────────────────────
// Round 19 — Court Mode redesign: the court diary data layer (pure functions,
// no React, no LLM). Built ON TOP of the exports above — the four behaviours
// pinned by tests/unit/aloaCourtMode.test.ts are untouched. Terminology rule:
// a law office keeps a DIARY; the court's published list is a different
// concept and is intentionally NOT modelled here (see DEFERRED).
// ─────────────────────────────────────────────────────────────────────────────

// ROUND 21 (owner directive): the standard Nigerian courtroom endorsement
// purposes — selectable in the composer's Purpose dropdown. "Other" reveals
// a custom text input (draft.nextDate.purposeOther).
export type HearingPurpose =
  | "Mention"
  | "Hearing"
  | "Hearing of Motion"
  | "Adoption of Written Addresses"
  | "Trial / Continuation of Trial"
  | "Ruling"
  | "Judgment"
  | "Report of Settlement"
  | "Other";

/** The composer's Purpose dropdown order (Nigerian practice). */
export const HEARING_PURPOSES: HearingPurpose[] = [
  "Mention",
  "Hearing",
  "Hearing of Motion",
  "Adoption of Written Addresses",
  "Trial / Continuation of Trial",
  "Ruling",
  "Judgment",
  "Report of Settlement",
  "Other",
];

/** Round 21: keyword fallbacks when a purpose has no exact/partial event
 * type on the firm's calendar (keeps the diary event's type meaningful). */
const PURPOSE_EVENT_TYPE_FALLBACKS: Partial<Record<HearingPurpose, string[]>> = {
  "Hearing of Motion": ["Motion", "Hearing"],
  "Adoption of Written Addresses": ["Adoption", "Written Addresses", "Hearing"],
  "Trial / Continuation of Trial": ["Trial", "Hearing"],
  "Report of Settlement": ["Settlement", "Report", "Mention"],
};

export type DiaryScope = "mine" | "firm";

/** Hearing ids synthesized from matter.nextAdjournedDate (getCourtHearings). */
export const SYNTHESIZED_HEARING_ID_PREFIX = "matter-next-hearing-";

/**
 * Privacy defence-in-depth (client side). The server already enforces this in
 * getMatterDetails (private => assignedUsers only), but getFirmMetadata
 * returns every firm matter to any staff caller, including the runtime
 * `isPrivate` flag that the client Matter type deliberately does not carry
 * (hence the `as any` read). A private matter the viewer is not assigned to
 * is invisible in Court Mode — this never WIDENS visibility.
 *
 * `accessibleMatterIds` (schema: users) is plumbed to the client User but is
 * read by NO logic anywhere (server or client) — it is not a restriction
 * list, so it is intentionally NOT applied here (see Phase 0 finding).
 */
export function canSeeMatter(matter: Matter, viewerId: string): boolean {
  const isPrivate = (matter as { isPrivate?: boolean }).isPrivate;
  if (!isPrivate) return true;
  return (matter.assignedUsers || []).some((id) => id === viewerId);
}

export interface DiaryEntry {
  matterId: string;
  matterTitle: string;
  suitNumber?: string;
  referenceNumber?: string;
  court?: string;
  courtRoom?: string;
  presidingJudge?: string;
  /** Who will attend: the hearing event's assignees, else the matter's. */
  assignedUserIds: string[];
  lawyerNames: string[];
  /** viewer in matter.assignedUsers OR in the hearing event's assignedUsers. */
  isMine: boolean;
  hearingId: string;
  date: string;
  /** Local YYYY-MM-DD of `date`. */
  dayKey: string;
  /** "9:00 am" for real events that carry a time; null for date-only or
   *  synthesized next-adjourned dates. */
  timeLabel: string | null;
  title: string;
  /** First ~90 chars of the matter's latest endorsement. */
  lastOrderSnippet: string | null;
}

export interface DiaryGroup {
  key: string;
  label: string;
  entries: DiaryEntry[];
}

export interface CourtDiary {
  /** Next 14 days grouped by day, then one 'Later' group; entries by time
   *  (untimed last), then title. */
  groups: DiaryGroup[];
  /** Visible court matters in scope whose last hearing is past and which
   *  have no upcoming hearing. */
  needsNewDate: CourtMatter[];
  /** Visible court matters in scope with no hearing at all. */
  noDate: CourtMatter[];
}

/** True when the event's date string carries an explicit, non-midnight time. */
function timeLabelFor(dateISO: string): string | null {
  if (!dateISO.includes("T")) return null;
  const match = /^(\d{2}):(\d{2})/.exec(dateISO.split("T")[1] || "");
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours === 0 && minutes === 0) return null;
  const meridiem = hours >= 12 ? "pm" : "am";
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

/** Minutes since local midnight for a timed date string; null when untimed. */
function timeMinutesFor(dateISO: string): number | null {
  if (!dateISO.includes("T")) return null;
  const match = /^(\d{2}):(\d{2})/.exec(dateISO.split("T")[1] || "");
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours === 0 && minutes === 0) return null;
  return hours * 60 + minutes;
}

function endorsementSnippet(content: string): string {
  // ROUND 22: snippet the BODY (a jacket's boilerplate never shows here).
  const collapsed = endorsementBodyOf(content).replace(/\s+/g, " ").trim();
  if (!collapsed) return "";
  return collapsed.length > 90 ? `${collapsed.slice(0, 90).trimEnd()}…` : collapsed;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayKeyToDate(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dayKeyLabel(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  return `${WEEKDAY_SHORT[date.getDay()]} ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}

const DIARY_WINDOW_DAYS = 14;

/** Group upcoming entries into day groups (today..today+13) + 'Later'. */
function groupDiaryEntries(entries: DiaryEntry[], today: string): DiaryGroup[] {
  const byKey = new Map<string, DiaryEntry[]>();
  const later: DiaryEntry[] = [];
  const todayDate = dayKeyToDate(today);
  const todayMs = todayDate.getTime();

  for (const entry of entries) {
    const entryDate = dayKeyToDate(entry.dayKey);
    const dayDiff = Math.round((entryDate.getTime() - todayMs) / (24 * 60 * 60 * 1000));
    if (dayDiff >= 0 && dayDiff < DIARY_WINDOW_DAYS) {
      const bucket = byKey.get(entry.dayKey) || [];
      bucket.push(entry);
      byKey.set(entry.dayKey, bucket);
    } else if (dayDiff >= DIARY_WINDOW_DAYS) {
      later.push(entry);
    }
    // dayDiff < 0 cannot occur: entries are upcoming (dateKey >= today).
  }

  const groups: DiaryGroup[] = Array.from(byKey.keys())
    .sort((left, right) => left.localeCompare(right))
    .map((key) => {
      const dayDiff = Math.round((dayKeyToDate(key).getTime() - todayMs) / (24 * 60 * 60 * 1000));
      const label = dayDiff === 0 ? "Today" : dayDiff === 1 ? "Tomorrow" : dayKeyLabel(key);
      const sorted = (byKey.get(key) || []).slice().sort((left, right) => {
        const leftTime = timeMinutesFor(left.date) ?? Number.POSITIVE_INFINITY;
        const rightTime = timeMinutesFor(right.date) ?? Number.POSITIVE_INFINITY;
        if (leftTime !== rightTime) return leftTime - rightTime;
        return left.title.localeCompare(right.title);
      });
      return { key, label, entries: sorted };
    });

  if (later.length) {
    later.sort((left, right) => {
      const leftTime = timeMinutesFor(left.date) ?? Number.POSITIVE_INFINITY;
      const rightTime = timeMinutesFor(right.date) ?? Number.POSITIVE_INFINITY;
      if (leftTime !== rightTime) return leftTime - rightTime;
      return left.title.localeCompare(right.title);
    });
    groups.push({ key: "later", label: "Later", entries: later });
  }
  return groups;
}

/**
 * Build the court diary. `canSeeMatter` is applied first in BOTH scopes.
 * Scope 'mine': only matters/hearings where isMine (the viewer is on the
 * matter, or is an assignee of that hearing event — the "holding brief"
 * case). Scope 'firm': all visible court matters.
 */
export function getCourtDiary(
  matters: Matter[],
  events: CalendarEvent[],
  notes: NotePage[],
  ctx: { viewerId: string; scope: DiaryScope; userNames: Record<string, string>; today?: string },
): CourtDiary {
  const today = ctx.today ?? localDateKey(new Date());
  const visible = matters.filter((matter) => canSeeMatter(matter, ctx.viewerId));
  const courtMatters = getCourtModeMatters(visible, events, today);

  const entries: DiaryEntry[] = [];
  const needsNewDate: CourtMatter[] = [];
  const noDate: CourtMatter[] = [];

  for (const courtMatter of courtMatters) {
    const matter = courtMatter.matter;
    const matterEvents = events.filter((event) => event.matterId === matter.id);
    const eventById = new Map(matterEvents.map((event) => [event.id, event]));
    const lastOrder = pickLastEndorsement(notes, matter.id);
    const snippet = lastOrder ? endorsementSnippet(lastOrder.content) : null;
    const matterIsMine = (matter.assignedUsers || []).includes(ctx.viewerId);
    const anyHearingMine = matterEvents.some((event) => (event.assignedUsers || []).includes(ctx.viewerId));
    const matterInScope = ctx.scope === "firm" || matterIsMine || anyHearingMine;

    for (const hearing of courtMatter.upcomingHearings) {
      const event = eventById.get(hearing.id);
      const eventIsMine = (event?.assignedUsers || []).includes(ctx.viewerId);
      const isMine = matterIsMine || eventIsMine;
      if (ctx.scope === "mine" && !isMine) continue;
      const assignedUserIds =
        event?.assignedUsers && event.assignedUsers.length > 0 ? event.assignedUsers : matter.assignedUsers || [];
      entries.push({
        matterId: matter.id,
        matterTitle: matter.title,
        suitNumber: matter.suitNumber,
        referenceNumber: matter.referenceNumber,
        court: hearing.court || matter.court,
        courtRoom: matter.courtRoom,
        presidingJudge: matter.presidingJudge,
        assignedUserIds,
        lawyerNames: assignedUserIds.map((id) => ctx.userNames[id] ?? id),
        isMine,
        hearingId: hearing.id,
        date: hearing.date,
        dayKey: dateKey(hearing.date) ?? "",
        timeLabel: hearing.id.startsWith(SYNTHESIZED_HEARING_ID_PREFIX) ? null : timeLabelFor(hearing.date),
        title: hearing.title,
        lastOrderSnippet: snippet,
      });
    }

    if (!matterInScope) continue;
    if (courtMatter.hearings.length === 0) noDate.push(courtMatter);
    else if (courtMatter.upcomingHearings.length === 0 && courtMatter.previousHearing) needsNewDate.push(courtMatter);
  }

  return { groups: groupDiaryEntries(entries, today), needsNewDate, noDate };
}

const alphanumeric = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Case-insensitive substring over matter title, suit/reference (ignoring
 *  non-alphanumerics), court and lawyer names. Empty query: unchanged. */
export function filterDiary(diary: CourtDiary, query: string): CourtDiary {
  const trimmed = query.trim();
  if (!trimmed) return diary;
  const queryLower = trimmed.toLowerCase();
  const queryAlnum = alphanumeric(trimmed);

  const entryMatches = (entry: DiaryEntry): boolean => {
    if (entry.matterTitle.toLowerCase().includes(queryLower)) return true;
    if ((entry.court || "").toLowerCase().includes(queryLower)) return true;
    if (entry.lawyerNames.some((name) => name.toLowerCase().includes(queryLower))) return true;
    for (const identifier of [entry.suitNumber, entry.referenceNumber]) {
      if (identifier && alphanumeric(identifier).includes(queryAlnum)) return true;
    }
    return false;
  };

  // Needs-new-date / no-date cards carry matters, not entries: lawyer names
  // come from the diary's own entries when that matter has one.
  const entryNamesByMatter = new Map<string, string[]>();
  for (const group of diary.groups) {
    for (const entry of group.entries) {
      if (!entryNamesByMatter.has(entry.matterId)) entryNamesByMatter.set(entry.matterId, entry.lawyerNames);
    }
  }

  const groups = diary.groups
    .map((group) => ({ ...group, entries: group.entries.filter(entryMatches) }))
    .filter((group) => group.entries.length > 0);

  const matterMatches = (courtMatter: CourtMatter): boolean => {
    const matter = courtMatter.matter;
    if (matter.title.toLowerCase().includes(queryLower)) return true;
    if ((matter.court || "").toLowerCase().includes(queryLower)) return true;
    const names = entryNamesByMatter.get(matter.id) || [];
    if (names.some((name) => name.toLowerCase().includes(queryLower))) return true;
    for (const identifier of [matter.suitNumber, matter.referenceNumber]) {
      if (identifier && alphanumeric(identifier).includes(queryAlnum)) return true;
    }
    return false;
  };

  return {
    groups,
    needsNewDate: diary.needsNewDate.filter(matterMatches),
    noDate: diary.noDate.filter(matterMatches),
  };
}

export type DateRisk =
  | { kind: "weekend"; weekday: "Saturday" | "Sunday" }
  | { kind: "public_holiday" }
  | {
      kind: "clash";
      sameDayCount: number;
      overlapping: boolean;
      forViewer: boolean;
      attendeeNames: string[];
      others: { matterId: string; matterTitle: string; hearingId: string; timeLabel: string | null }[];
    };

interface ClashCandidate {
  matterId: string;
  matterTitle: string;
  hearingId: string;
  timeLabel: string | null;
  timed: boolean;
  startMs: number;
  endMs: number;
}

/**
 * Warn only from encoded facts: weekends (isWeekend), public holidays
 * (isPublicHoliday, custom overrides), and the firm's own diary clashes.
 * NEVER claims a court "will not sit" — no vacation/sitting-day logic.
 * Clash scope: OTHER matters' non-cancelled events on the same local day,
 * assigned to ANY attendee or with no assignedUsers. The same matter's own
 * events never count (adjourning inside one matter is not a clash).
 */
export function assessNextDate(input: {
  dateISO: string;
  timeHHmm: string | null;
  matterId: string;
  events: CalendarEvent[];
  matters: Matter[];
  /** WHO WILL ATTEND = matter.assignedUsers if non-empty, else [viewerId]. */
  attendeeIds: string[];
  viewerId: string;
  userNames: Record<string, string>;
  customHolidays?: string[];
}): DateRisk[] {
  const [year, month, day] = input.dateISO.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return [];

  const risks: DateRisk[] = [];

  if (isWeekend(date)) {
    risks.push({ kind: "weekend", weekday: date.getDay() === 6 ? "Saturday" : "Sunday" });
  }
  if (isPublicHoliday(date, input.customHolidays || [])) {
    risks.push({ kind: "public_holiday" });
  }

  const dayKeyOfCandidate = input.dateISO;
  const candidateTimed = input.timeHHmm != null;
  const [hours, minutes] = candidateTimed ? (input.timeHHmm as string).split(":").map(Number) : [0, 0];
  const candidateStart = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const candidateEnd = new Date(candidateStart.getTime() + 60 * 60 * 1000);

  const matterTitleOf = (matterId: string | undefined): string => {
    if (!matterId) return "";
    const found = input.matters.find((matter) => matter.id === matterId);
    return found?.title || "";
  };

  const candidates: ClashCandidate[] = [];
  for (const event of input.events) {
    if (event.status === "Cancelled") continue;
    if (event.matterId === input.matterId) continue;
    const eventDayKey = dateKey(event.date);
    if (eventDayKey !== dayKeyOfCandidate) continue;
    const assigned = event.assignedUsers || [];
    const assignedToAttendee = input.attendeeIds.some((id) => assigned.includes(id));
    if (assigned.length > 0 && !assignedToAttendee) continue;

    const timed = timeMinutesFor(event.date) != null;
    const eventDate = dayKeyToDate(eventDayKey as string);
    const eventMinutes = timeMinutesFor(event.date) ?? 0;
    const startMs = new Date(
      eventDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate(),
      Math.floor(eventMinutes / 60),
      eventMinutes % 60,
    ).getTime();
    // end = endDate (app-wide parse convention) or start+60min.
    const endMs = event.endDate ? parseDateString(event.endDate).getTime() : startMs + 60 * 60 * 1000;
    candidates.push({
      matterId: event.matterId || "",
      matterTitle: matterTitleOf(event.matterId) || event.matterTitle || "Another matter",
      hearingId: event.id,
      timeLabel: timeLabelFor(event.date),
      timed,
      startMs,
      endMs: Number.isNaN(endMs) ? startMs + 60 * 60 * 1000 : endMs,
    });
  }

  if (candidates.length > 0) {
    const overlapping = candidateTimed && candidates.some((other) => other.timed && other.startMs < candidateEnd.getTime() && candidateStart.getTime() < other.endMs);
    risks.push({
      kind: "clash",
      sameDayCount: candidates.length,
      overlapping,
      forViewer: input.attendeeIds.length === 1 && input.attendeeIds[0] === input.viewerId,
      attendeeNames: input.attendeeIds.map((id) => input.userNames[id] ?? id),
      others: candidates.map(({ matterId, matterTitle, hearingId, timeLabel }) => ({
        matterId,
        matterTitle,
        hearingId,
        timeLabel,
      })),
    });
  }

  return risks;
}

/** Latest non-archived endorsement for the matter — by the SITTING date
 * (the jacket's Date line) when the record carries one, else the save moment.
 * A backdated insertion therefore never displaces the true last endorsement. */
export function pickLastEndorsement(notes: NotePage[], matterId: string): NotePage | null {
  const endorsements = notes
    .filter((note) => note.matterId === matterId && note.type === "endorsement" && !note.archivedAt)
    .sort((left, right) => endorsementOrderMs(right) - endorsementOrderMs(left) || right.id.localeCompare(left.id));
  return endorsements[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUND 23 — the dictated-endorsement hygiene + ordering layer (all pure,
// deterministic — no LLM anywhere in Court Mode; the notes-tab composer keeps
// its own reviewed Format engine).
// ─────────────────────────────────────────────────────────────────────────────

/** Unambiguous spoken filler ONLY — matched on word boundaries so real words
 * ("sum", "thus", "August", "a") are never touched. One trailing comma and
 * the following spaces go with the token, so "uh, the court" → "the court". */
const SPOKEN_FILLER_RE = /\b(?:u+h+|u*m+h*|h+m+|e+r+m*|a+h+|e+h+|m+h+m+)\b[,.]?\s*/gi;

/** A sentence-initial "So" is a spoken false start; a mid-sentence "so"
 * ("…and so the matter stands adjourned") keeps its meaning and stays. */
const LEADING_SO_RE = /(^|[\n.!?]\s+)So[,.]?\s+/gi;

/** ROUND 23 (owner spec): strip conversational filler ("uh", "um", "erm",
 * sentence-initial "so"…) from a dictated/typed endorsement while preserving
 * every fact, name, date and figure byte-for-byte — nothing is ever invented,
 * reordered or summarised. Pure, idempotent, and deliberately conservative:
 * spoken false starts that cannot be told apart from substance (a repeated
 * half-word) are the lawyer's own edit to make, never a machine guess. */
export function stripDictationFiller(text: string): string {
  const source = text ?? "";
  if (!source.trim()) return source;
  let out = source.replace(SPOKEN_FILLER_RE, "");
  out = out.replace(LEADING_SO_RE, "$1");
  // Tidy only the seams the removals leave behind — never the words.
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/^[ \t]*,[ \t]*/gm, "");
  out = out.replace(/[ \t]+([,;:])/g, "$1");
  return out.replace(/[ \t]+\n/g, "\n").trim();
}

/** The jacket's sitting date line — `Date: DD/MM/YYYY` (the Nigerian order) —
 * as a local YYYY-MM-DD key; null when the record carries none (legacy raw
 * notes). Pure, never throws. */
export function endorsementSittingDayKey(content: string): string | null {
  const match = /(?:^|\n)Date:[^\S\n]*(\d{2})\/(\d{2})\/(\d{4})/.exec(content || "");
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

/** The recording counsel a jacket's first Appearances line names — the
 * honest author fallback for legacy records saved before notes carried an
 * authorId ("- Ada Uzo for the Claimant" → "Ada Uzo"). Never invented: no
 * appearance line, no name. */
export function endorsementCounselOf(content: string): string | null {
  const match = /(?:^|\n)-\s+([^\n]+?)\s+for the\s/.exec(content || "");
  return match ? match[1].trim() : null;
}

/** Chronological order key for an endorsement: the SITTING date when the
 * jacket records one, else the save moment. Milliseconds, higher = later. */
export function endorsementOrderMs(note: Pick<NotePage, "content" | "createdAt">): number {
  const sittingDayKey = endorsementSittingDayKey(note.content || "");
  if (sittingDayKey) {
    const [year, month, day] = sittingDayKey.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  const created = new Date(note.createdAt || "").getTime();
  return Number.isNaN(created) ? 0 : created;
}

/** True when the id is a recurrence EXPANSION INSTANCE (`${eventId}_YYYY-MM-DD`,
 * the calendarUtils convention) — a virtual occurrence, not a stored row.
 * Raw event ids (uuid / kebab-case) never end in that date suffix. */
export function isRecurringInstanceId(id: string): boolean {
  return /_\d{4}-\d{2}-\d{2}$/.test(id || "");
}

/** How far ahead the court surfaces materialise recurring diary items —
 * comfortably past the mini-calendar's month navigation and the diary's
 * 14-day window, well under the 366-occurrence expansion budget. */
const RECURRING_WINDOW_FORWARD_DAYS = 400;
const RECURRING_WINDOW_BACK_DAYS = 1;

/** ROUND 23 (parity fix): the main calendar, the dashboard mini-calendar and
 * Daily Focus all expand recurring events — the Court Mode diary and the
 * matter date picker did not, so a recurring court item dotted the main
 * calendar on every occurrence date but never showed in Court Mode. This
 * keeps every raw event AND adds the expansion instances (unique
 * `${eventId}_YYYY-MM-DD` ids) inside the window — one shared source for the
 * diary, the briefing's clash scan and the mini-calendar. */
export function expandCourtEvents(events: CalendarEvent[], today: string): CalendarEvent[] {
  const list = events || [];
  const recurring = list.filter((event) => event.recurrence);
  if (!recurring.length) return list;
  const start = dayKeyToDate(offsetDayKey(today, -RECURRING_WINDOW_BACK_DAYS));
  const end = dayKeyToDate(offsetDayKey(today, RECURRING_WINDOW_FORWARD_DAYS));
  return [...list.filter((event) => !event.recurrence), ...expandRecurringEvents(recurring, start, end)];
}

function offsetDayKey(dayKey: string, days: number): string {
  const date = dayKeyToDate(dayKey);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUND 22 — the structured Nigerian file-jacket endorsement. A dictated or
// typed ENDORSEMENT is never saved as raw verbatim text: it is mapped
// deterministically onto the standard court file jacket (Date / Appearances /
// Endorsement / Next Adjourned Date) from existing schema fields — the
// matter's parties and representing role, the recording counsel, the legacy
// opposing-counsel field and the plan's next date. No LLM, no invention:
// what is not on record prints the standard fallback ("… absent /
// unrepresented") and the body stays the lawyer's own words, verbatim.
// ─────────────────────────────────────────────────────────────────────────────

const CLAIMANT_SIDE_ROLES = ["Claimant", "Plaintiff", "Applicant", "Petitioner", "Appellant"];
const DEFENDANT_SIDE_ROLES = ["Defendant", "Respondent", "Co-Defendant"];

/** DD/MM/YYYY (the Nigerian convention) from an ISO instant or YYYY-MM-DD. */
function toDDMMYYYY(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

export interface EndorsementJacketInput {
  matter: Matter;
  /** The counsel on record who appeared and is recording the outcome. */
  viewerName: string;
  /** The dictated/typed body — the lawyer's own words. */
  bodyText: string;
  /** The save moment (ISO or YYYY-MM-DD) — the jacket's Date line. */
  nowISO: string;
  /** The plan's next date — drives the Next Adjourned Date line. */
  nextDate: OutcomeDraft["nextDate"];
}

/** The jacket's Appearances lines — deterministic, from the matter's own
 * fields. `firmRepresentingRole` (set by the matter forms) names our side;
 * the parties name the other side's role; the legacy opposingCounsel field
 * names their counsel when the firm recorded it. Nothing is invented — a
 * side with no counsel on record prints the standard fallback. */
export function endorsementAppearances(matter: Matter, viewerName: string): string[] {
  const parties = (matter.parties || []).filter(
    (party) => party && typeof party.name === "string" && party.name.trim(),
  );
  const representingRole = String(
    (matter as { specialtyData?: { firmRepresentingRole?: unknown } }).specialtyData
      ?.firmRepresentingRole || "",
  ).trim();
  const ourRole = representingRole || "Claimant";
  const ourSideIsClaimant = !DEFENDANT_SIDE_ROLES.includes(ourRole);
  const otherSideRoles = ourSideIsClaimant ? DEFENDANT_SIDE_ROLES : CLAIMANT_SIDE_ROLES;
  const otherRole =
    parties.find((party) => otherSideRoles.includes(party.role))?.role ||
    (ourSideIsClaimant ? "Defendant" : "Claimant");
  const opposingCounsel = (matter.opposingCounsel || "").trim();
  return [
    `- ${viewerName || "Counsel"} for the ${ourRole}`,
    opposingCounsel
      ? `- ${opposingCounsel} for the ${otherRole}`
      : `- ${otherRole} absent / unrepresented`,
  ];
}

/** The standard file jacket for one endorsement. */
export function formatEndorsementJacket(input: EndorsementJacketInput): string {
  // ROUND 23: the dictated/typed body loses only unambiguous spoken filler —
  // every fact, name, date and figure stays exactly as recorded.
  const body = stripDictationFiller(input.bodyText).trim() || input.bodyText.trim();
  const purpose =
    input.nextDate?.purpose === "Other" && input.nextDate.purposeOther?.trim()
      ? input.nextDate.purposeOther.trim()
      : input.nextDate?.purpose;
  const jacket = [
    `Date: ${toDDMMYYYY(input.nowISO)}`,
    "",
    "Appearances:",
    ...endorsementAppearances(input.matter, input.viewerName),
    "",
    "Endorsement:",
    body,
  ];
  // No next date on record → no line (sine die is the lawyer's call to make
  // in the body, never invented here).
  if (input.nextDate?.dateISO) {
    jacket.push("", `Next Adjourned Date: ${toDDMMYYYY(input.nextDate.dateISO)} — For ${purpose}`);
  }
  return jacket.join("\n");
}

const ENDORSEMENT_BODY_RE = /(?:^|\n)Endorsement:[^\S\n]*\n([\s\S]*?)(?=\n\nNext Adjourned Date:|$)/;

/** The body text of a jacket-formatted endorsement; legacy raw notes come
 * back unchanged. The diary snippet and the inline editor read THIS — never
 * the jacket boilerplate. */
export function endorsementBodyOf(content: string): string {
  const match = ENDORSEMENT_BODY_RE.exec(content || "");
  return match ? match[1].trim() : content || "";
}

export interface OutcomeDraft {
  matterId: string;
  noteType: "endorsement" | "user";
  text: string;
  nextDate: {
    /** ROUND 21: "" = purpose/time chosen but the date itself not picked
     * yet (the draft survives without text; see useCourtDrafts). A plan
     * with an empty dateISO records the note only. */
    dateISO: string;
    timeHHmm: string | null;
    purpose: HearingPurpose;
    /** Free text when purpose === "Other" (Round 21). */
    purposeOther?: string;
    source: "detected" | "manual";
  } | null;
  addToDiary: boolean;
  setAsMatterNextDate: boolean;
}

export interface OutcomePlan {
  note: { matterId: string; title: string; content: string; type: "endorsement" | "user" };
  /** The exact object passed to addItem('events', ...) — or null. */
  event: Record<string, unknown> | null;
  matterPatch: { nextAdjournedDate: string } | null;
  skipReasons: ("already_in_diary" | "no_date" | "date_not_set" | "diary_off" | "matter_date_off")[];
}

/** Mirrors TeamDiscussionTab's private coerceEventType (exact → partial →
 * keyword fallbacks → first). Round 21: the new long purposes and the
 * custom "Other" text fall back through their practice keywords. */
function coerceCourtEventType(purpose: string, eventTypeNames: string[]): string {
  if (!purpose) return eventTypeNames[0] || "Meeting";
  const needle = purpose.toLowerCase();
  const exact = eventTypeNames.find((name) => name.toLowerCase() === needle);
  if (exact) return exact;
  const partial = eventTypeNames.find(
    (name) => name.toLowerCase().includes(needle) || needle.includes(name.toLowerCase()),
  );
  if (partial) return partial;
  const fallbacks = PURPOSE_EVENT_TYPE_FALLBACKS[purpose as HearingPurpose] || [];
  for (const keyword of fallbacks) {
    const hit = eventTypeNames.find(
      (name) => name.toLowerCase().includes(keyword.toLowerCase()),
    );
    if (hit) return hit;
  }
  return eventTypeNames[0] || "Meeting";
}

/**
 * Deterministic write plan for the single Save press. No LLM, no side
 * effects: the caller executes (1) note, (2) event, (3) matter patch — in
 * that order — and owns the partial-failure rules.
 *
 * Colleague's matter (assignedUsers non-empty, excludes the viewer): the
 * note title gains " (brief held by {viewerName})" and the next date goes
 * to the people who will attend (matter.assignedUsers), not the stand-in.
 */
export function buildOutcomePlan(
  draft: OutcomeDraft,
  ctx: {
    matter: Matter;
    events: CalendarEvent[];
    viewerId: string;
    viewerName: string;
    eventTypeNames: string[];
    nowISO: string;
  },
): OutcomePlan {
  const matter = ctx.matter;
  const text = draft.text.trim();
  const nextDate = draft.nextDate;
  const isColleaguesMatter =
    (matter.assignedUsers || []).length > 0 && !(matter.assignedUsers || []).includes(ctx.viewerId);

  // ROUND 23 (owner vocabulary): "Endorsement" / "Note" — never "Court
  // endorsement"; there is no need to say "court" to a lawyer.
  const noteTitle =
    `${draft.noteType === "endorsement" ? "Endorsement" : "Note"} — ${matter.title}` +
    (isColleaguesMatter ? ` (brief held by ${ctx.viewerName})` : "");

  // ROUND 22: an ENDORSEMENT saves as the standard Nigerian file jacket —
  // never raw verbatim text. A plain "Note" keeps the lawyer's raw words.
  const note = {
    matterId: matter.id,
    title: noteTitle,
    content:
      draft.noteType === "endorsement"
        ? formatEndorsementJacket({ matter, viewerName: ctx.viewerName, bodyText: text, nowISO: ctx.nowISO, nextDate })
        : text,
    type: draft.noteType,
  };

  const skipReasons: OutcomePlan["skipReasons"] = [];

  // ROUND 21: a nextDate with an empty dateISO means the purpose (and maybe
  // time) was chosen but no date — the note still saves, and the matter
  // stays in "Needs a New Date" (adjourned sine die / awaiting the registry).
  if (!nextDate) {
    return { note, event: null, matterPatch: null, skipReasons: ["no_date"] };
  }
  if (!nextDate.dateISO) {
    return { note, event: null, matterPatch: null, skipReasons: ["date_not_set"] };
  }

  // Event — mirrors the TeamDiscussionTab endorsement-to-diary pattern.
  let event: Record<string, unknown> | null = null;
  if (!draft.addToDiary) {
    skipReasons.push("diary_off");
  } else {
    const duplicate = ctx.events.some(
      (candidate) =>
        candidate.status !== "Cancelled" &&
        candidate.matterId === matter.id &&
        dateKey(candidate.date) === nextDate.dateISO,
    );
    if (duplicate) {
      skipReasons.push("already_in_diary");
    } else {
      const [year, month, day] = nextDate.dateISO.split("-").map(Number);
      const [hours, minutes] = nextDate.timeHHmm ? nextDate.timeHHmm.split(":").map(Number) : [9, 0];
      const start = new Date(year, month - 1, day, hours, minutes, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const assignedUsers =
        (matter.assignedUsers || []).length > 0 ? matter.assignedUsers : [ctx.viewerId];
      event = {
        title: endorsementTitleFrom(text),
        description: text,
        matterTitle: matter.title,
        // "Other" carries the lawyer's own purpose text (Round 21).
        type: coerceCourtEventType(
          nextDate.purpose === "Other" && nextDate.purposeOther?.trim()
            ? nextDate.purposeOther.trim()
            : nextDate.purpose,
          ctx.eventTypeNames,
        ),
        date: start.toISOString(),
        endDate: end.toISOString(),
        matterId: matter.id,
        status: "Active",
        createdAt: ctx.nowISO,
        updatedAt: ctx.nowISO,
        court: matter.court,
        judicialDivision: matter.judicialDivision,
        assignedUsers,
      };
    }
  }

  const matterPatch = draft.setAsMatterNextDate ? { nextAdjournedDate: nextDate.dateISO } : null;
  if (!draft.setAsMatterNextDate) skipReasons.push("matter_date_off");

  return { note, event, matterPatch, skipReasons };
}

/** Thin wrapper over extractDatedMention for the composer's live detection. */
export function detectNextDate(
  text: string,
  now: Date = new Date(),
): { dateISO: string; timeHHmm: string | null; label: string } | null {
  const mention = extractDatedMention(text, now);
  if (!mention) return null;
  const dateISO = localDateKey(mention.date);
  const timeHHmm =
    mention.timeMinutes != null
      ? `${String(Math.floor(mention.timeMinutes / 60)).padStart(2, "0")}:${String(mention.timeMinutes % 60).padStart(2, "0")}`
      : null;
  return { dateISO, timeHHmm, label: formatDatedMention(mention) };
}

// Presentation helpers (Round 19, UI-only, reusing the private formatters above
// so the am/pm + label rules have ONE source of truth).

/** "9:00 am" / null — the shared timeLabel rule, exported for the views. */
export function hearingTimeLabel(dateISO: string): string | null {
  return timeLabelFor(dateISO);
}

/** "Wed 18 Mar" — the shared day-label rule, exported for the views. */
export function diaryDayLabel(dayKey: string): string {
  return dayKeyLabel(dayKey);
}

/** Local YYYY-MM-DD for "now" — the views' single definition of today. */
export function todayDayKey(): string {
  return localDateKey(new Date());
}

/** The shared court-event rule (one definition) for entry points outside
 *  the diary — e.g. EventDetailModal's "Open in Court Mode". */
export function isCourtCalendarEvent(event: CalendarEvent): boolean {
  return isCourtEvent(event);
}
