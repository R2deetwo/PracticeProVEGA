/**
 * Round 19 — Court Mode date-risk chips.
 *
 * Warning-only, from encoded facts (constraint: never a claim that a court
 * "will not sit"): weekend, public holiday, the firm's own diary clashes.
 * Every chip carries text + icon (colour is never the only signal) and a
 * neutral dark-mode pairing via the Badge status tokens.
 */
import React from "react";
import { AlertTriangle, CalendarOff } from "lucide-react";
import { Badge } from "../../ui";
import type { DateRisk } from "../courtModeUtils";

const nameList = (names: string[]): string => {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

const plural = (count: number, singular: string): string =>
  `${count} other ${singular}${count === 1 ? "" : "s"}`;

/** One-line factual chip text for a risk. */
export const dateRiskLabel = (risk: DateRisk): string => {
  if (risk.kind === "weekend") return `Falls on a ${risk.weekday}`;
  if (risk.kind === "public_holiday") return "Falls on a public holiday";
  const who = risk.forViewer ? "You" : nameList(risk.attendeeNames);
  const whoLabel = who ? who : "Someone";
  return `${whoLabel} already has ${plural(risk.sameDayCount, "hearing")} that day`;
};

export const DateRiskChips: React.FC<{ risks: DateRisk[]; className?: string }> = ({
  risks,
  className,
}) => {
  if (!risks.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className || ""}`} aria-label="Date warnings">
      {risks.map((risk, index) => {
        const Icon = risk.kind === "clash" ? AlertTriangle : CalendarOff;
        return (
          <Badge key={index} tone="warning" className="items-center gap-1 leading-snug">
            <Icon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span>{dateRiskLabel(risk)}</span>
          </Badge>
        );
      })}
    </div>
  );
};
