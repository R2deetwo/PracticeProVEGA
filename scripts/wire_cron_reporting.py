#!/usr/bin/env python3
"""
wire_cron_reporting.py — R17: wrap scheduled-job handlers with
withCronReporting() so backend cron failures land in error_events (+Sentry).

Surgical, structure-aware edit:
  1. anchor line: `export const <fn> = internalMutation({` / `internalAction({`
  2. the next `  handler: async ...` line gets `withCronReporting("<job>", ` inserted
  3. the function's closing `  },` (the line immediately before the column-0
     `});` that closes the internalMutation/internalAction call) becomes `  }),`
  4. add the observability import if missing.

Idempotent: skips files already wired. Aborts (warns) on any structural
mismatch WITHOUT writing that file.
"""
import re
import sys

TARGETS = [
    ("convex/wallets.ts", "export const processAutoDeductions = internalMutation(", "crons:walletAutoDeduct"),
    ("convex/retainerBilling.ts", "export const scanMattersForRetainerCycle = internalMutation(", "crons:scanMattersForRetainerCycle"),
    ("convex/retainerBilling.ts", "export const advanceStagedOutbox = internalMutation(", "crons:advanceStagedRetainerOutbox"),
    ("convex/portals.ts", "export const processScheduledMessages = internalAction(", "crons:processScheduledMessages"),
    ("convex/myFunctions.ts", "export const runSubscriptionDunning = internalAction(", "crons:runSubscriptionDunning"),
    ("convex/sentry.ts", "export const runDailyAutomation = internalMutation(", "crons:sentryDailyAutomation"),
    ("convex/sentry.ts", "export const sendServiceChargeReminders = internalMutation(", "crons:serviceChargeWhatsAppReminder"),
    ("convex/sentry.ts", "export const flagOverdueCharges = internalMutation(", "crons:flagOverdueServiceCharges"),
]

IMPORT_LINE = 'import { withCronReporting } from "./observability";\n'


def wire(path: str, anchor: str, job: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    if any(f'withCronReporting("{job}"' in ln for ln in lines):
        return f"SKIP (already wired): {job} in {path}"

    # 1. locate the anchor
    anchor_idx = next((i for i, ln in enumerate(lines) if ln.startswith(anchor)), None)
    if anchor_idx is None:
        return f"ABORT (anchor not found): {anchor!r} in {path}"

    # 2. locate the handler line within the 6 lines after the anchor
    handler_idx = None
    for i in range(anchor_idx + 1, min(anchor_idx + 7, len(lines))):
        if re.match(r"^\s*handler:\s*async\s", lines[i]):
            handler_idx = i
            break
    if handler_idx is None:
        return f"ABORT (handler line not found after anchor): {anchor!r} in {path}"

    # 3. locate the column-0 `});` that closes the internalMutation call
    close_idx = None
    for i in range(handler_idx + 1, len(lines)):
        if lines[i].rstrip() == ");" or (lines[i].rstrip() == "});" and not lines[i].startswith(" ")):
            close_idx = i
            break
    if close_idx is None:
        return f"ABORT (function close not found): {anchor!r} in {path}"

    # the handler's own close is the last `  },` / `  }` line before close_idx
    hclose_idx = None
    for i in range(close_idx - 1, handler_idx, -1):
        if re.match(r"^\s+\},?\s*$", lines[i]):
            hclose_idx = i
            break
    if hclose_idx is None:
        return f"ABORT (handler close not found): {anchor!r} in {path}"

    # 4. apply edits
    lines[handler_idx] = lines[handler_idx].replace(
        "handler: async", f'handler: withCronReporting("{job}", async', 1
    )
    lines[hclose_idx] = lines[hclose_idx].rstrip("\n").rstrip() + "),\n"

    # 5. ensure import (after the last top-level import line)
    if IMPORT_LINE not in lines:
        last_import = max(
            (i for i, ln in enumerate(lines[:200]) if ln.startswith("import ")),
            default=None,
        )
        if last_import is None:
            return f"ABORT (no import block): {path}"
        lines.insert(last_import + 1, IMPORT_LINE)

    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    return f"OK: {job} in {path} (handler line {handler_idx + 1}, close line {hclose_idx + 1})"


def main() -> int:
    failures = 0
    for path, anchor, job in TARGETS:
        result = wire(path, anchor, job)
        print(result)
        if result.startswith("ABORT"):
            failures += 1
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
