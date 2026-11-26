/**
 * Round 19 — the composer's NEXT DATE section: the detected-from-your-
 * endorsement prompt (Use / Ignore — never overwriting a manual date, and
 * Ignore suppressing that exact date), the date / time / purpose inputs,
 * the factual risk chips (never blocking), and the add-to-diary +
 * set-as-next-date toggles. Pure presentation — state lives in the composer.
 */
import React from "react";
import { Check } from "lucide-react";
import { Button, Input, Select } from "../../ui";
import { HearingPurpose } from "../courtModeUtils";
import { DateRisk, detectNextDate } from "../courtModeUtils";
import type { StoredCourtDraft } from "./courtDrafts";
import { DateRiskChips } from "./DateRiskChips";

const PURPOSES: HearingPurpose[] = ["Hearing", "Mention", "Judgment", "Ruling", "Trial", "Other"];

type NextDateValue = NonNullable<StoredCourtDraft["nextDate"]>;

export interface NextDateSectionProps {
  nextDate: NextDateValue | null;
  detected: ReturnType<typeof detectNextDate> | null;
  risks: DateRisk[];
  showDetected: boolean;
  addToDiary: boolean;
  setAsMatterNextDate: boolean;
  onUseDetected: () => void;
  onIgnoreDetected: () => void;
  onNextDateChange: (nextDate: NextDateValue | null) => void;
  onToggleAddToDiary: () => void;
  onToggleSetAsMatterNextDate: () => void;
}

export const NextDateSection: React.FC<NextDateSectionProps> = ({
  nextDate,
  detected,
  risks,
  showDetected,
  addToDiary,
  setAsMatterNextDate,
  onUseDetected,
  onIgnoreDetected,
  onNextDateChange,
  onToggleAddToDiary,
  onToggleSetAsMatterNextDate,
}) => (
  <div className="space-y-2">
    <p className="text-2xs font-black uppercase tracking-widest text-subtle">Next date (optional)</p>
    {showDetected && detected ? (
      <div className="flex flex-wrap items-center gap-2 rounded-sm bg-surface-2 px-3 py-2">
        <p className="min-w-0 flex-1 text-xs font-medium text-body">Detected from your endorsement: {detected.label}</p>
        <Button variant="secondary" size="sm" type="button" onClick={onUseDetected}>
          Use
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={onIgnoreDetected}>
          Ignore
        </Button>
      </div>
    ) : null}
    <div className="grid grid-cols-2 gap-2">
      <Input
        type="date"
        label="Date"
        value={nextDate?.dateISO ?? ""}
        onChange={(event) =>
          onNextDateChange(
            event.target.value
              ? {
                  dateISO: event.target.value,
                  timeHHmm: nextDate?.timeHHmm ?? null,
                  purpose: nextDate?.purpose ?? "Hearing",
                  source: "manual",
                }
              : null,
          )
        }
      />
      <Input
        type="time"
        label="Time"
        value={nextDate?.timeHHmm ?? ""}
        onChange={(event) =>
          onNextDateChange(
            nextDate?.dateISO
              ? {
                  dateISO: nextDate.dateISO,
                  timeHHmm: event.target.value || null,
                  purpose: nextDate?.purpose ?? "Hearing",
                  source: "manual",
                }
              : null,
          )
        }
      />
    </div>
    <Select
      label="Purpose"
      value={nextDate?.purpose ?? "Hearing"}
      onChange={(event) =>
        onNextDateChange(
          nextDate?.dateISO
            ? {
                dateISO: nextDate.dateISO,
                timeHHmm: nextDate?.timeHHmm ?? null,
                purpose: event.target.value as HearingPurpose,
                source: nextDate?.source ?? "manual",
              }
            : null,
        )
      }
    >
      {PURPOSES.map((purpose) => (
        <option key={purpose} value={purpose}>
          {purpose}
        </option>
      ))}
    </Select>
    <DateRiskChips risks={risks} className="mt-1" />
    <div className="mt-1 space-y-1">
      <Button
        variant={addToDiary ? "secondary" : "ghost"}
        size="sm"
        type="button"
        aria-pressed={addToDiary}
        icon={addToDiary ? Check : undefined}
        onClick={onToggleAddToDiary}
        className="w-full justify-start"
      >
        Add to diary
      </Button>
      <Button
        variant={setAsMatterNextDate ? "secondary" : "ghost"}
        size="sm"
        type="button"
        aria-pressed={setAsMatterNextDate}
        icon={setAsMatterNextDate ? Check : undefined}
        onClick={onToggleSetAsMatterNextDate}
        className="w-full justify-start"
      >
        Set as the matter&apos;s next adjourned date
      </Button>
    </div>
  </div>
);

export default NextDateSection;
