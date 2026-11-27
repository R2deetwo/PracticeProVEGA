/**
 * Round 21 — the matter-scoped mini-calendar inside Court Mode (appears ONLY
 * inside MatterBriefing; Mon-first week rows, muted weekday headers, soft
 * grid). DOTS mark dates that already carry diary items (the matter's own
 * dates get the primary dot, other matters' a neutral dot); tapping a date
 * SMOOTHLY REVEALS that day's agenda card (spot clashes before locking an
 * adjournment); "Use as next date" pipes the picked date into the Record
 * outcome flow. ROUND 25: a `focusDayKey` JUMPS the calendar to that
 * month/date and selects it (confirmed dictated dates / committed NEXT DATE
 * edits) so the lawyer immediately verifies what is on the diary that day.
 * Pure presentation — all data arrives via props; nothing here writes.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, Button } from "../../ui";
import { dayKeyOf, formatDayKeyLong, timeLabelOf } from "./format";
import { SegmentedToggle } from "./SegmentedToggle";

export interface MiniCalendarEntry {
  eventId: string;
  matterId: string;
  matterTitle: string;
  suitNumber?: string;
  court?: string;
  /** The calendar event's type (Hearing, Mention, …). */
  purpose: string;
  date: string;
  /** ROUND 22: who attends this hearing (the event's assignees, else the
   *  matter's) — drives the My diary | Firm diary dot filter. */
  attendeeIds: string[];
}

interface MiniCalendarProps {
  /** All court-type diary events visible to the viewer (the clash surface). */
  entries: MiniCalendarEntry[];
  /** The open matter — its own dates get the primary dot. */
  matterId: string;
  /** YYYY-MM-DD of today. */
  today: string;
  /** ROUND 22: the viewer — scopes the dots to their diary. */
  viewerId: string;
  /** Pipes a picked date into the Record outcome flow. */
  onUseDate: (dateISO: string) => void;
  /** Disabled while dictation is busy (the preserved rule). */
  captureBusy: boolean;
  /** ROUND 25: jump to this month/date and select/highlight it. */
  focusDayKey?: string | null;
}

/** My diary | Firm diary — the calendar's visibility toggle (Round 22).
 * This matter's own dates always show; the OTHER matters' dots depend on
 * the scope (mine = only hearings the viewer attends). */
type CalendarDiaryScope = "mine" | "firm";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const MiniCalendar: React.FC<MiniCalendarProps> = ({
  entries,
  matterId,
  today,
  viewerId,
  onUseDate,
  captureBusy,
  focusDayKey,
}) => {
  const todayDate = useMemo(() => new Date(`${today}T00:00:00`), [today]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  // ROUND 22: My diary (the default, like the diary view) | Firm diary — the
  // visibility toggle over the dots. Local state — a matter-scoped view.
  const [diaryScope, setDiaryScope] = useState<CalendarDiaryScope>("mine");

  // ROUND 25: the diary AUTO-JUMP — switch the calendar to the focused
  // month and select/highlight the day. Runs once per new focus value;
  // navigating away afterwards is free.
  useEffect(() => {
    if (!focusDayKey) return;
    const [year, month] = focusDayKey.split("-").map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return;
    setMonthOffset((year - todayDate.getFullYear()) * 12 + (month - 1 - todayDate.getMonth()));
    setSelected(focusDayKey);
  }, [focusDayKey, todayDate]);

  // ROUND 22: the scope filter — this matter's dates always show; other
  // matters' dots only in Firm diary, or in My diary when the viewer attends.
  const visibleEntries = useMemo(
    () =>
      diaryScope === "firm"
        ? entries
        : entries.filter(
            (entry) => entry.matterId === matterId || entry.attendeeIds.includes(viewerId),
          ),
    [entries, diaryScope, matterId, viewerId],
  );

  // dayKey → visible entries (the dots + the agenda follow the same scope).
  const byDay = useMemo(() => {
    const map = new Map<string, MiniCalendarEntry[]>();
    for (const entry of visibleEntries) {
      const key = dayKeyOf(entry.date);
      const list = map.get(key) || [];
      list.push(entry);
      map.set(key, list);
    }
    return map;
  }, [visibleEntries]);

  // The revealed day agenda scrolls into view the moment a date is picked
  // (Round 23) — including after a ROUND 25 focus jump.
  const agendaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) agendaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  const grid = useMemo(() => {
    const anchor = new Date(todayDate.getFullYear(), todayDate.getMonth() + monthOffset, 1);
    const start = new Date(anchor);
    const dayOfWeek = start.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start.setDate(start.getDate() - diff);
    const days: Date[] = [];
    const iter = new Date(start);
    for (let i = 0; i < 42; i++) {
      days.push(new Date(iter));
      iter.setDate(iter.getDate() + 1);
    }
    return { anchor, days };
  }, [todayDate, monthOffset]);

  const anchor = grid.anchor;
  const selectedEntries = selected ? byDay.get(selected) || [] : [];

  return (
    <div className="rounded-md border border-hairline bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs font-black uppercase tracking-widest text-subtle">Check dates</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" type="button" icon={ChevronLeft} iconOnly
            aria-label="Previous month" onClick={() => setMonthOffset((value) => value - 1)} />
          <p className="min-w-24 text-center text-sm font-extrabold text-strong">
            {anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
          <Button variant="ghost" size="sm" type="button" icon={ChevronRight} iconOnly
            aria-label="Next month" onClick={() => setMonthOffset((value) => value + 1)} />
        </div>
      </div>

      {/* ROUND 22: My diary | Firm diary — the calendar's visibility toggle. */}
      <div className="mt-2 flex items-center justify-center">
        <SegmentedToggle label="Calendar diary scope"
          options={[{ value: "mine", label: "My diary" }, { value: "firm", label: "Firm diary" }]}
          value={diaryScope} onChange={(value) => setDiaryScope(value as CalendarDiaryScope)} />
      </div>

      <div className="mt-2 grid grid-cols-7">
        {WEEKDAYS.map((weekday) => (
          <p key={weekday} className="py-1.5 text-center text-3xs font-bold uppercase tracking-widest text-subtle">{weekday}</p>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.days.map((date) => {
          const key = dayKeyOf(date.toISOString());
          const dayEntries = byDay.get(key) || [];
          const inMonth = date.getMonth() === anchor.getMonth();
          const isToday = key === today;
          const isSelected = key === selected;
          const own = dayEntries.some((entry) => entry.matterId === matterId);
          const other = dayEntries.some((entry) => entry.matterId !== matterId);
          return (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setSelected(isSelected ? null : key)}
              aria-label={`${formatDayKeyLong(key)}${dayEntries.length ? ` — ${dayEntries.length} item${dayEntries.length === 1 ? "" : "s"}` : ""}`}
              aria-pressed={isSelected}
              className={`h-9 w-full flex-col items-center justify-center gap-0.5 rounded-md !px-0 text-xs transition-colors ${
                isSelected
                  ? "bg-primary-600 font-bold text-white"
                  : isToday
                    ? "font-black text-primary-700 dark:text-primary-300"
                    : inMonth
                      ? "text-body hover:bg-surface-2"
                      : "text-subtle opacity-40"
              }`}
            >
              <span>{date.getDate()}</span>
              {dayEntries.length ? (
                <span className="flex h-1.5 items-center gap-0.5" aria-hidden="true">
                  {own ? <span className={`w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-primary-600 dark:bg-primary-400"}`} /> : null}
                  {other ? <span className={`w-1.5 rounded-full ${isSelected ? "bg-white/70" : "bg-zinc-400 dark:bg-zinc-500"}`} /> : null}
                </span>
              ) : (
                <span className="h-1.5" aria-hidden="true" />
              )}
            </Button>
          );
        })}
      </div>

      {/* The flip-to-inspect day agenda — smoothly reveals under the grid
          and scrolls into view (Round 23) once picked (incl. a focus jump). */}
      {selected ? (
        <div ref={agendaRef} tabIndex={-1} className="mt-3 animate-in fade-in slide-in-from-top-1 duration-300 rounded-md border border-hairline bg-surface-2 p-3 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-extrabold text-strong">{formatDayKeyLong(selected)}</p>
            {selectedEntries.length ? (
              <Badge tone={selectedEntries.length > 2 ? "warning" : "neutral"}>
                {selectedEntries.length} item{selectedEntries.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
          {selectedEntries.length ? (
            <div className="mt-2 space-y-1.5">
              {selectedEntries.map((entry) => (
                <div key={entry.eventId} className="rounded-sm bg-white px-2.5 py-2 dark:bg-zinc-900">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-bold text-strong">{entry.matterTitle}</p>
                    <p className="flex-shrink-0 text-2xs font-semibold text-primary-700 dark:text-primary-300">
                      {timeLabelOf(entry.date) || entry.purpose}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-2xs text-body">
                    {[entry.suitNumber, entry.court, entry.purpose].filter(Boolean).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-body">Nothing on the diary for this date.</p>
          )}
          <Button
            variant="secondary" size="sm" type="button" fullWidth minTouchTarget
            disabled={captureBusy}
            onClick={() => onUseDate(selected)}
            className="mt-2.5"
          >
            Use as next date
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-2xs text-subtle">Tap a date to see what is on the diary that day.</p>
      )}
    </div>
  );
};

export default MiniCalendar;
