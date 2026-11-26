import { Matter, MatterStatus, MatterType, CalendarEvent, NotePage } from "../../types";
import { extractNewClipText, joinDraftText } from "../../services/voice/draftUtils";
import { extractDatedMention, formatDatedMention, endorsementTitleFrom } from "../../utils/endorsementDateParser";
import { isPublicHoliday, isWeekend } from "../../utils/courtCalculator";
import { parseDateString } from "../../utils/calendarUtils";

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

export type HearingPurpose = "Hearing" | "Mention" | "Judgment" | "Ruling" | "Trial" | "Other";

export type DiaryScope = "mine" | "firm";

/** Hearing ids synthesized from matter.nextAdjournedDate (getCourtHearings). */
const SYNTHESIZED_HEARING_ID_PREFIX = "matter-next-hearing-";

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
  const collapsed = (content || "").replace(/\s+/g, " ").trim();
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

/** Latest non-archived endorsement for the matter, by createdAt. */
export function pickLastEndorsement(notes: NotePage[], matterId: string): NotePage | null {
  const endorsements = notes
    .filter((note) => note.matterId === matterId && note.type === "endorsement" && !note.archivedAt)
    .sort((left, right) => (right.createdAt || "").localeCompare(left.createdAt || "") || right.id.localeCompare(left.id));
  return endorsements[0] || null;
}

export interface OutcomeDraft {
  matterId: string;
  noteType: "endorsement" | "user";
  text: string;
  nextDate: {
    dateISO: string;
    timeHHmm: string | null;
    purpose: HearingPurpose;
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
  skipReasons: ("already_in_diary" | "no_date" | "diary_off" | "matter_date_off")[];
}

/** Mirrors TeamDiscussionTab's private coerceEventType (exact → partial → first). */
function coerceCourtEventType(purpose: string, eventTypeNames: string[]): string {
  if (!purpose) return eventTypeNames[0] || "Meeting";
  const exact = eventTypeNames.find((name) => name.toLowerCase() === purpose.toLowerCase());
  if (exact) return exact;
  const partial = eventTypeNames.find(
    (name) => name.toLowerCase().includes(purpose.toLowerCase()) || purpose.toLowerCase().includes(name.toLowerCase()),
  );
  return partial || eventTypeNames[0] || "Meeting";
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
  const isColleaguesMatter =
    (matter.assignedUsers || []).length > 0 && !(matter.assignedUsers || []).includes(ctx.viewerId);

  const noteTitle =
    `${draft.noteType === "endorsement" ? "Court endorsement" : "Court note"} — ${matter.title}` +
    (isColleaguesMatter ? ` (brief held by ${ctx.viewerName})` : "");

  const note = { matterId: matter.id, title: noteTitle, content: text, type: draft.noteType };

  const skipReasons: OutcomePlan["skipReasons"] = [];
  const nextDate = draft.nextDate;

  if (!nextDate) {
    return { note, event: null, matterPatch: null, skipReasons: ["no_date"] };
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
        type: coerceCourtEventType(nextDate.purpose, ctx.eventTypeNames),
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
