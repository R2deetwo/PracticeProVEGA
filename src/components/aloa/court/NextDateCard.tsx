/**
 * Round 19 — Court Mode next-date card (the briefing's NEXT DATE block).
 * Large type, factual relative label ("today" / "in 3 days" / "overdue"),
 * DateRiskChips underneath. Never blocks — warnings only from encoded facts.
 *
 * ROUND 25 (owner bug report 2026-11-28: the card rendered
 * "undefined NaN undefined NaN · overdue" when the date was missing or
 * malformed): a missing/invalid date renders the clean empty state —
 * "No next date set" with the subtle `action` affordance ("Set date").
 * `undefined` and `NaN` can never appear anywhere in this card.
 */
import React from "react";
import { CalendarDays } from "lucide-react";
import { Badge } from "../../ui";
import type { CourtHearing, DateRisk } from "../courtModeUtils";
import { formatDayKeyLong, isValidDayKey, relativeDayLabel, safeDayKeyOf, timeLabelOf } from "./format";
import { DateRiskChips } from "./DateRiskChips";

interface NextDateCardProps {
  /** ROUND 25: null allowed — the no-date empty state. */
  hearing: CourtHearing | null;
  risks: DateRisk[];
  today: string;
  /** ROUND 22: an optional affordance in the card's header row (the inline
   *  Edit / Set date button lives here — the card's own layout is unchanged). */
  action?: React.ReactNode;
}

export const NextDateCard: React.FC<NextDateCardProps> = ({ hearing, risks, today, action }) => {
  const dayKey = hearing ? safeDayKeyOf(hearing.date) : null;
  const timeLabel = dayKey && hearing ? timeLabelOf(hearing.date) : null;
  const relative = dayKey ? relativeDayLabel(dayKey, today) : "";

  return (
    <div className="rounded-md border border-hairline bg-surface-2 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-subtle">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          Next date
        </div>
        {action}
      </div>
      {dayKey && isValidDayKey(dayKey) ? (
        <>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-base font-extrabold leading-snug text-strong">{formatDayKeyLong(dayKey)}</p>
            {timeLabel ? (
              <p className="text-base font-bold leading-snug text-primary-700 dark:text-primary-300">{timeLabel}</p>
            ) : null}
            {relative ? (
              <Badge tone={relative === "overdue" ? "danger" : relative === "today" ? "info" : "neutral"}>
                {relative}
              </Badge>
            ) : null}
          </div>
          {risks.length ? <DateRiskChips risks={risks} className="mt-2" /> : null}
        </>
      ) : (
        /* ROUND 25: the clean empty state — never `undefined NaN` garbage. */
        <p className="mt-1.5 text-base font-bold leading-snug text-subtle">No next date set</p>
      )}
    </div>
  );
};
