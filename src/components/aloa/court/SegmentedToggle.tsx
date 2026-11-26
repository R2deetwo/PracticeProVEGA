/**
 * Round 19 — the pill segmented toggle (My diary | Firm diary, Endorsement |
 * Note): Button primitives with segmented / segmented-active variants inside
 * a rounded group with role="group" (the established QuickCapture pattern).
 */
import React from "react";
import { Button } from "../../ui";

export interface SegmentedOption {
  value: string;
  label: string;
}

export const SegmentedToggle: React.FC<{
  /** Group name for aria-label. */
  label: string;
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** ROUND 22: option values that cannot be selected right now (e.g. the
   *  other Vox pane while a dictation take is live). */
  disabledValues?: string[];
  /** Hover/focus explanation shown on a disabled option. */
  disabledReason?: string;
}> = ({ label, options, value, onChange, className, disabledValues, disabledReason }) => (
  <div
    role="group"
    aria-label={label}
    className={`inline-flex items-center rounded-full border border-hairline bg-white p-0.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className || ""}`}
  >
    {options.map((option) => (
      <Button
        key={option.value}
        variant={value === option.value ? "segmented-active" : "segmented"}
        size="sm"
        type="button"
        className="rounded-full px-3"
        aria-pressed={value === option.value}
        disabled={disabledValues?.includes(option.value)}
        title={disabledValues?.includes(option.value) ? disabledReason : undefined}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </Button>
    ))}
  </div>
);

export default SegmentedToggle;
