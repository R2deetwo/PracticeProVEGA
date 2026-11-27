/**
 * Round 21 — the composer's NEXT DATE section: the detected-date prompt
 * (Set as next date / Dismiss — never overwriting a manual date), the date /
 * time / purpose inputs, the factual risk chips (never blocking), and the
 * add-to-diary + set-as-next-date toggles. Pure presentation — state
 * lives in the composer.
 *
 * ROUND 21 (owner report): (1) the Purpose dropdown was STUCK on "Hearing"
 * — the old onChange dropped the purpose when no date was picked yet (it
 * nulled the whole nextDate); the purpose now persists in the draft with an
 * empty dateISO until a date is chosen. (2) "Other" revealed nothing — it
 * now shows a custom text input that rides along on the save plan.
 * The full Nigerian courtroom purpose list ships here.
 *
 * ROUND 25 (owner bug report 2026-11-28): the explicit one-tap confirmation
 * banner — `Detected next date: 4 December 2026 — [Set as next date]
 * [Dismiss]` — long-form date so the lawyer verifies the parsed value at a
 * glance.
 */
import React from "react";
import { Check } from "lucide-react";
import { Button, Input, Select } from "../../ui";
import { DateRisk, detectNextDate, HEARING_PURPOSES, HearingPurpose } from "../courtModeUtils";
import type { StoredCourtDraft } from "./courtDrafts";
import { DateRiskChips } from "./DateRiskChips";
import { formatDayKeyFull, timeLabelOf } from "./format";

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

/** Merge a partial into the current nextDate; a missing one starts fresh
 * (empty dateISO = date not picked yet — purpose/time survive). */
const draftWith = (nextDate: NextDateValue | null, patch: Partial<NextDateValue>): NextDateValue =>
  nextDate ? { ...nextDate, ...patch } : { dateISO: "", timeHHmm: null, purpose: "Hearing", source: "manual", ...patch };

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
}) => {
  const purpose = nextDate?.purpose ?? "Hearing";
  const purposeOther = nextDate?.purposeOther ?? "";

  return (
    <div className="space-y-2">
      <p className="text-2xs font-black uppercase tracking-widest text-subtle">Next date (optional)</p>
      {showDetected && detected ? (
        /* ROUND 25 (owner bug report 2026-11-28): the explicit one-tap
         * confirmation — long-form date so the parsed value is verified at
         * a glance: "Detected next date: 4 December 2026". */
        <div className="flex flex-wrap items-center gap-2 rounded-sm bg-surface-2 px-3 py-2">
          <p className="min-w-0 flex-1 text-xs font-medium text-body">
            Detected next date: <span className="font-bold text-strong">{formatDayKeyFull(detected.dateISO)}</span>
            {detected.timeHHmm ? (
              <span className="font-bold text-strong"> · {timeLabelOf(`${detected.dateISO}T${detected.timeHHmm}:00`) ?? detected.timeHHmm}</span>
            ) : null}
          </p>
          <Button variant="secondary" size="sm" type="button" onClick={onUseDetected}>
            Set as next date
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={onIgnoreDetected}>
            Dismiss
          </Button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="date"
          label="Date"
          value={nextDate?.dateISO ?? ""}
          onChange={(event) =>
            event.target.value
              ? onNextDateChange(draftWith(nextDate, { dateISO: event.target.value, source: "manual" }))
              : // Clearing the date keeps the chosen time/purpose (empty ISO).
                onNextDateChange(nextDate ? draftWith(nextDate, { dateISO: "" }) : null)
          }
        />
        <Input
          type="time"
          label="Time"
          value={nextDate?.timeHHmm ?? ""}
          onChange={(event) =>
            event.target.value || nextDate?.dateISO
              ? onNextDateChange(draftWith(nextDate, { timeHHmm: event.target.value || null }))
              : onNextDateChange(null)
          }
        />
      </div>
      <Select
        label="Purpose"
        value={purpose}
        onChange={(event) => {
          const value = event.target.value as HearingPurpose;
          onNextDateChange(
            draftWith(nextDate, {
              purpose: value,
              purposeOther: value === "Other" ? purposeOther : undefined,
            }),
          );
        }}
      >
        {HEARING_PURPOSES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      {purpose === "Other" ? (
        <Input
          label="Specify purpose"
          value={purposeOther}
          placeholder="e.g. Pre-trial conference"
          onChange={(event) => onNextDateChange(draftWith(nextDate, { purposeOther: event.target.value }))}
          containerClassName="mt-2"
        />
      ) : null}
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
          Set as the matter&apos;s next date
        </Button>
      </div>
    </div>
  );
};

export default NextDateSection;
