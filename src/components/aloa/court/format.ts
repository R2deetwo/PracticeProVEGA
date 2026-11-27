/**
 * Round 19 — Court Mode presentation formatters (pure).
 * Day/time label rules live in courtModeUtils; these wrap them for the views.
 *
 * ROUND 25 (owner bug report 2026-11-28: `NEXT DATE` rendered "undefined NaN
 * undefined NaN · overdue"): STRICT date validation at the presentation
 * layer. A malformed / missing / unparseable date NEVER reaches a formatter
 * as a real value — `safeDayKeyOf` collapses it to null, `dayKeyOf` to "",
 * and the views render the "No next date set" empty state instead of NaN
 * garbage. No formatter may ever emit "undefined" or "NaN".
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

/** ROUND 25: strict YYYY-MM-DD shape + real-calendar-date check (a
 *  "2026-13-45" fails even though `new Date` would roll it over). */
export const isValidDayKey = (dayKey: string | null | undefined): dayKey is string =>
  typeof dayKey === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(dayKey) &&
  (() => {
    const [year, month, day] = dayKey.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return (
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  })();

const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Thu 1 Oct 2026" from a local YYYY-MM-DD key. ROUND 25: an invalid
 *  key returns "" — never `undefined NaN` garbage (the views check
 *  `isValidDayKey` first and render the empty state instead). */
export const formatDayKeyLong = (dayKey: string): string => {
  if (!isValidDayKey(dayKey)) return "";
  const date = parseDayKey(dayKey);
  return `${WEEKDAY_LONG[date.getDay()]} ${date.getDate()} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;
};

/** "4 December 2026" — the long-form label for the detected-date banner. */
export const formatDayKeyFull = (dayKey: string): string => {
  if (!isValidDayKey(dayKey)) return "";
  const date = parseDayKey(dayKey);
  return `${date.getDate()} ${MONTH_LONG[date.getMonth()]} ${date.getFullYear()}`;
};

/** The time label rule ("9:00 am" / null) for a raw date string. */
export const timeLabelOf = (dateISO: string): string | null => hearingTimeLabel(dateISO);

/** The day label rule ("Wed 18 Mar") for a local day key. */
export const dayLabelOf = (dayKey: string): string => diaryDayLabel(dayKey);

/** "today" | "tomorrow" | "in N days" | "overdue" — factual, never
 *  alarmist. ROUND 25: an invalid key returns "" instead of a NaN-derived
 *  "overdue" (NaN comparisons were the "· overdue" half of the bug). */
export const relativeDayLabel = (dayKey: string, today: string): string => {
  if (!isValidDayKey(dayKey) || !isValidDayKey(today)) return "";
  const diffDays = Math.round(
    (parseDayKey(dayKey).getTime() - parseDayKey(today).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (!Number.isFinite(diffDays)) return "";
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

/** Local YYYY-MM-DD key from a raw date string (date-only or ISO).
 *  ROUND 25: an unparseable value returns "" — never `value.slice(0, 10)`
 *  garbage like "Invalid Da" (the source of the NaN rendering). */
export const dayKeyOf = (dateISO: string | null | undefined): string => safeDayKeyOf(dateISO) ?? "";

/** ROUND 25: the shared strict resolver — null when the value is missing,
 *  malformed or unparseable (one definition for every Court Mode surface). */
export const safeDayKeyOf = (dateISO: string | null | undefined): string | null => {
  if (!dateISO || typeof dateISO !== "string") return null;
  const dateOnly = dateISO.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly && !dateISO.includes("T")) return isValidDayKey(dateOnly) ? dateOnly : null;
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const key = `${year}-${month}-${day}`;
  return isValidDayKey(key) ? key : null;
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
