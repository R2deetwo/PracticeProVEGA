/**
 * Round 21 — the matter-scoped mini-calendar inside Court Mode.
 *
 * Appears ONLY inside the active matter view (MatterBriefing), styled in
 * the same calm light register as the main dashboard calendar (Mon-first
 * week rows, muted weekday headers, soft grid), sized to fit the panel.
 *
 * Interactions (owner spec):
 *   - DOTS mark dates that already carry diary items — the selected
 *     matter's own dates get the primary dot, other matters' dates a
 *     neutral dot (so a clash with another matter is visible at a glance).
 *   - Tapping a date SMOOTHLY REVEALS that day's agenda card (one row per
 *     item: time, matter title, suit number, court, purpose) — the
 *     flip-to-inspect view for spotting clashes before locking an
 *     adjournment.
 *   - "Use as next date" pipes the picked date straight into the matter's
 *     Record outcome flow (the composer's Next Date field).
 *
 * Pure presentation — all data arrives via props; nothing here writes.
 */
import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, Button } from "../../ui";
import { dayKeyOf, formatDayKeyLong, timeLabelOf } from "./format";

export interface MiniCalendarEntry {
  eventId: string;
  matterId: string;
  matterTitle: string;
  suitNumber?: string;
  court?: string;
  /** The calendar event's type (Hearing, Mention, …). */
  purpose: string;
  date: string;
}

interface MiniCalendarProps {
  /** All court-type diary events visible to the viewer (this is the clash surface). */
  entries: MiniCalendarEntry[];
  /** The open matter — its own dates get the primary dot. */
  matterId: string;
  /** YYYY-MM-DD of today. */
  today: string;
  /** Pipes a picked date into the Record outcome flow. */
  onUseDate: (dateISO: string) => void;
  /** Disabled while dictation is busy (the preserved rule). */
  captureBusy: boolean;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const MiniCalendar: React.FC<MiniCalendarProps> = ({
  entries,
  matterId,
  today,
  onUseDate,
  captureBusy,
}) => {
  const todayDate = useMemo(() => new Date(`${today}T00:00:00`), [today]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  // dayKey → entries for the whole diary (the clash surface).
  const byDay = useMemo(() => {
    const map = new Map<string, MiniCalendarEntry[]>();
    for (const entry of entries) {
      const key = dayKeyOf(entry.date);
      const list = map.get(key) || [];
      list.push(entry);
      map.set(key, list);
    }
    return map;
  }, [entries]);

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
          <Button
            variant="ghost"
            size="sm"
            type="button"
            icon={ChevronLeft}
            iconOnly
            aria-label="Previous month"
            onClick={() => setMonthOffset((value) => value - 1)}
          />
          <p className="min-w-24 text-center text-sm font-extrabold text-strong">
            {anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            icon={ChevronRight}
            iconOnly
            aria-label="Next month"
            onClick={() => setMonthOffset((value) => value + 1)}
          />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-7">
        {WEEKDAYS.map((weekday) => (
          <p key={weekday} className="py-1.5 text-center text-3xs font-bold uppercase tracking-widest text-subtle">
            {weekday}
          </p>
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

      {/* The flip-to-inspect day agenda — smoothly reveals under the grid. */}
      {selected ? (
        <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-300 rounded-md border border-hairline bg-surface-2 p-3 dark:border-zinc-800">
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
            variant="secondary"
            size="sm"
            type="button"
            fullWidth
            minTouchTarget
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
