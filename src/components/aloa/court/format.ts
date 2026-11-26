/**
 * Round 19 — Court Mode presentation formatters (pure).
 * Day/time label rules live in courtModeUtils; these wrap them for the views.
 */
import { diaryDayLabel, hearingTimeLabel } from "../courtModeUtils";
import type { CalendarEvent } from "../../../types";
import type { CourtHearing } from "../courtModeUtils";

const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const parseDayKey = (dayKey: string): Date => {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/** "Thu 1 Oct 2026" from a local YYYY-MM-DD key. */
export const formatDayKeyLong = (dayKey: string): string => {
  const date = parseDayKey(dayKey);
  return `${WEEKDAY_LONG[date.getDay()]} ${date.getDate()} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;
};

/** The time label rule ("9:00 am" / null) for a raw date string. */
export const timeLabelOf = (dateISO: string): string | null => hearingTimeLabel(dateISO);

/** The day label rule ("Wed 18 Mar") for a local day key. */
export const dayLabelOf = (dayKey: string): string => diaryDayLabel(dayKey);

/** "today" | "tomorrow" | "in N days" | "overdue" — factual, never alarmist. */
export const relativeDayLabel = (dayKey: string, today: string): string => {
  const diffDays = Math.round(
    (parseDayKey(dayKey).getTime() - parseDayKey(today).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays > 1) return `in ${diffDays} days`;
  return "overdue";
};

/** mm:ss for the recording timer (measured locally by the capture hook). */
export const formatElapsed = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

/** Local YYYY-MM-DD key from a raw date string (date-only or ISO). */
export const dayKeyOf = (dateISO: string): string => {
  const dateOnly = dateISO.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly && !dateISO.includes("T")) return dateOnly;
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return dateISO.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

/** Header-length matter title (28 chars + ellipsis). */
export const shortTitle = (title?: string): string =>
  title && title.length > 28 ? `${title.slice(0, 28).trimEnd()}…` : title || "Court Mode";

/** Non-court diary items linked to the matter (the court-regex-invisible ones), next 3. */
export const nonCourtEventsFor = (
  matterId: string,
  courtMatter: { hearings: CourtHearing[] },
  events: CalendarEvent[],
  today: string,
): CalendarEvent[] => {
  const hearingIds = new Set(courtMatter.hearings.map((hearing) => hearing.id));
  return events
    .filter((event) => event.matterId === matterId)
    .filter((event) => event.status !== "Cancelled")
    .filter((event) => !hearingIds.has(event.id))
    .filter((event) => dayKeyOf(event.date) >= today)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 3);
};
