/**
 * Round 19 — Court Mode next-date card (the briefing's NEXT DATE block).
 * Large type, factual relative label ("today" / "in 3 days" / "overdue"),
 * DateRiskChips underneath. Never blocks — warnings only from encoded facts.
 */
import React from "react";
import { CalendarDays } from "lucide-react";
import { Badge } from "../../ui";
import type { CourtHearing, DateRisk } from "../courtModeUtils";
import { formatDayKeyLong, relativeDayLabel, timeLabelOf } from "./format";
import { DateRiskChips } from "./DateRiskChips";

interface NextDateCardProps {
  hearing: CourtHearing;
  risks: DateRisk[];
  today: string;
  /** ROUND 22: an optional affordance in the card's header row (the inline
   *  Edit button lives here — the card's own layout is unchanged). */
  action?: React.ReactNode;
}

const dayKeyOf = (dateISO: string): string => {
  const dateOnly = dateISO.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly && !dateISO.includes("T")) return dateOnly;
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return dateISO.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const NextDateCard: React.FC<NextDateCardProps> = ({ hearing, risks, today, action }) => {
  const dayKey = dayKeyOf(hearing.date);
  const timeLabel = timeLabelOf(hearing.date);
  const relative = relativeDayLabel(dayKey, today);

  return (
    <div className="rounded-md border border-hairline bg-surface-2 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-subtle">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          Next date
        </div>
        {action}
      </div>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className="text-base font-extrabold leading-snug text-strong">{formatDayKeyLong(dayKey)}</p>
        {timeLabel ? (
          <p className="text-base font-bold leading-snug text-primary-700 dark:text-primary-300">{timeLabel}</p>
        ) : null}
        <Badge tone={relative === "overdue" ? "danger" : relative === "today" ? "info" : "neutral"}>{relative}</Badge>
      </div>
      {risks.length ? <DateRiskChips risks={risks} className="mt-2" /> : null}
    </div>
  );
};
