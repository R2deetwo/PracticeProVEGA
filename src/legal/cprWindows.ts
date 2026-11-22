/**
 * legal/cprWindows.ts — the verified Nigerian Civil Procedure Rules windows
 * behind "Deadlines by the right rules" (owner question 2026-11-22:
 * "How does the app actually know when a document was served? … this could
 * be a very useful tool for lawyers").
 *
 * THE HONEST MECHANISM, end to end:
 *   1. The app can never KNOW a document was served — a human records the
 *      service event (date + method + proof) on the court process
 *      (Document.serviceEvents, captured in the litigation pipeline UI).
 *   2. The matter's court resolves to a jurisdiction profile, and each
 *      verified window in this registry computes the response deadline from
 *      the recorded service date (courtCalculator does the day math:
 *      first day excluded, weekend/public-holiday last-day rollover).
 *   3. Every computed entry CARRIES THE GOVERNING RULE CITATION on its
 *      face, plus verifyBy: "counsel" — the repo's anti-fabrication
 *      contract. Courts without a verified window here are never guessed:
 *      the UI offers a manual deadline instead.
 *
 * VERIFIED COVERAGE (2026-11-22) — every entry sourced, nothing invented:
 *   - Lagos HC: statement of defence 42 days from service of the
 *     originating process — Order 17 Rule 1(2), HCLS (CP) Rules 2019.
 *   - FCT HC (2025 Rules): memorandum of appearance 21 days — Order 11
 *     Rule 1; statement of defence 21 days — Order 15 Rule 1(2)&(3),
 *     FCT HC (CP) Rules 2025 (the 2025 Rules superseded the 2018 Rules).
 *   - Federal High Court: memorandum of appearance 30 days from service —
 *     Order 7 Rule 1, FHC (CP) Rules 2019.
 *   - Court of Appeal: notice of appeal — 3 months from a final decision /
 *     14 days from an interlocutory decision — sections 24(3) and 24(2) of
 *     the Court of Appeal Act.
 *
 * Other states' windows are NOT invented here: their registries carry only
 * the rules citation (jurisdictionConfig), and deadline entries for those
 * courts are set manually until counsel-verified windows are added.
 *
 * Pure data + pure functions; zero imports besides the calculator and the
 * jurisdiction profiles.
 */

import { calculateCourtDeadline, isPublicHoliday, isWeekend } from "../utils/courtCalculator";
import { resolveJurisdictionProfile } from "./drafting/jurisdictionProfiles";
import type { JurisdictionProfile } from "./drafting/types";

// ─── The registry ───────────────────────────────────────────────────────────

/** What happened that starts a window running. */
export type WindowTrigger =
  | "service_of_originating_process"
  | "judgment_final"
  | "judgment_interlocutory";

export interface RuleWindow {
  /** Stable id — also the dedupe key when tracking a computed deadline. */
  id: string;
  /** JurisdictionProfile.key this window belongs to. */
  jurisdictionKey: string;
  /** The event that starts the window. */
  trigger: WindowTrigger;
  /** One-line action label, e.g. "File the Statement of Defence". */
  action: string;
  /** Whose obligation it is (framing for the deadline entry). */
  actor: string;
  /** The window length in days. */
  windowDays: number;
  /** How the days are counted (displayed on the entry, never silent). */
  counting: "days" | "months";
  /** The governing citation, printed on every entry. */
  citation: string;
  /** Where this window was verified from (transparency for counsel). */
  source: string;
  /** ISO date of verification. */
  verifiedOn: string;
  /** The repo-wide anti-fabrication flag — counsel confirms before relying. */
  verifyBy: "counsel";
}

const w = (win: Omit<RuleWindow, "verifyBy">): RuleWindow => ({ ...win, verifyBy: "counsel" });

export const CPR_WINDOWS: RuleWindow[] = [
  // ── High Court of Lagos State (CP) Rules 2019 ────────────────────────────
  w({
    id: "lagos-hc-defence-42",
    jurisdictionKey: "lagos_high_court",
    trigger: "service_of_originating_process",
    action: "File the Statement of Defence (with set-off or counterclaim, and frontloaded documents)",
    actor: "Defendant",
    windowDays: 42,
    counting: "days",
    citation:
      "Order 17 Rule 1(2) of the High Court of Lagos State (Civil Procedure) Rules 2019",
    source:
      "HCLS (CP) Rules 2019 text (Scribd full rules); Legal 500 Nigeria Litigation guide — 42 days after service of the claim",
    verifiedOn: "2026-11-22",
  }),

  // ── FCT High Court (CP) Rules 2025 ───────────────────────────────────────
  w({
    id: "fct-hc-appearance-21",
    jurisdictionKey: "fct_high_court",
    trigger: "service_of_originating_process",
    action: "File the Memorandum of Appearance",
    actor: "Defendant",
    windowDays: 21,
    counting: "days",
    citation:
      "Order 11 Rule 1 of the High Court of the Federal Capital Territory (Civil Procedure) Rules 2025",
    source:
      "Legal 500 — 'Notable Innovations in the Recent FCT HC (CP) Rules 2025' (Order 11 Rule 1; the 2025 Rules raised it from 7 days under the 2018 Rules)",
    verifiedOn: "2026-11-22",
  }),
  w({
    id: "fct-hc-defence-21",
    jurisdictionKey: "fct_high_court",
    trigger: "service_of_originating_process",
    action: "File the Statement of Defence / set-off / counterclaim",
    actor: "Defendant",
    windowDays: 21,
    counting: "days",
    citation:
      "Order 15 Rule 1(2) & (3) of the High Court of the Federal Capital Territory (Civil Procedure) Rules 2025",
    source:
      "Legal 500 — FCT HC (CP) Rules 2025 review (Order 15 Rule 1(2)&(3); the 21-day period carried into the 2025 Rules)",
    verifiedOn: "2026-11-22",
  }),

  // ── Federal High Court (CP) Rules 2019 ───────────────────────────────────
  w({
    id: "fhc-appearance-30",
    jurisdictionKey: "federal_high_court",
    trigger: "service_of_originating_process",
    action: "File the Memorandum of Appearance",
    actor: "Defendant",
    windowDays: 30,
    counting: "days",
    citation: "Order 7 Rule 1 of the Federal High Court (Civil Procedure) Rules 2019",
    source:
      "Manifold Solicitors — 'Memorandum of Appearance in Nigeria' (quoting Order 7 Rule 1: within 30 days of service of the originating process)",
    verifiedOn: "2026-11-22",
  }),

  // ── Court of Appeal Act ───────────────────────────────────────────────────
  w({
    id: "ca-appeal-final-3m",
    jurisdictionKey: "court_of_appeal",
    trigger: "judgment_final",
    action: "File the Notice of Appeal (final decision)",
    actor: "Appellant",
    windowDays: 90,
    counting: "months",
    citation:
      "Section 24(3) of the Court of Appeal Act — three months from the date of the final decision",
    source:
      "Court of Appeal Act (Laws of Nigeria, PLAC text); 'How To Appeal A Judgement In Nigeria' — s. 24(2)(a)/(3) periods",
    verifiedOn: "2026-11-22",
  }),
  w({
    id: "ca-appeal-interlocutory-14",
    jurisdictionKey: "court_of_appeal",
    trigger: "judgment_interlocutory",
    action: "File the Notice of Appeal (interlocutory decision)",
    actor: "Appellant",
    windowDays: 14,
    counting: "days",
    citation:
      "Section 24(2) of the Court of Appeal Act — fourteen days from the date of the interlocutory decision",
    source:
      "Court of Appeal Act (Laws of Nigeria, PLAC text); Anyigbo, 'When is a Decision Final or Interlocutory' (fn 11–12)",
    verifiedOn: "2026-11-22",
  }),
];

// ─── Resolution ─────────────────────────────────────────────────────────────

export interface ComputedDeadline {
  /** The window that produced this entry (citation, action, actor). */
  window: RuleWindow;
  /** ISO date-time of the computed deadline (local midnight). */
  dueDate: string;
  /** Human note on how the date was computed. */
  note: string;
}

/**
 * Compute the response deadlines a service event (or a judgment) triggers
 * under the matter's court. Returns ONLY verified windows for the resolved
 * court — an empty array means "no verified window for this court yet;
 * set the deadline manually", never a guess.
 */
export function computeServiceDeadlines(args: {
  /** The matter's court, free text — same vocabulary as Matter.court. */
  court: string | null | undefined;
  /** The service date (originating process) or judgment date, ISO or Date. */
  fromDate: string | Date;
  /** Extra public holidays (ISO dates) honored when rolling the last day. */
  customHolidays?: string[];
  /** Whether the from-event is an interlocutory decision (appeal windows). */
  interlocutory?: boolean;
}): ComputedDeadline[] {
  const profile = resolveJurisdictionProfile(args.court || "");
  const from = typeof args.fromDate === "string" ? new Date(args.fromDate) : args.fromDate;
  if (Number.isNaN(from.getTime())) return [];

  const triggers: WindowTrigger[] = args.interlocutory
    ? ["judgment_interlocutory"]
    : ["service_of_originating_process", "judgment_final"];

  const windows = CPR_WINDOWS.filter(
    (win) => win.jurisdictionKey === profile.key && triggers.includes(win.trigger)
  );
  return windows.map((win) => {
    const due = win.counting === "months"
      ? addCalendarMonths(from, Math.round(win.windowDays / 30), args.customHolidays || [])
      : calculateCourtDeadline(from, win.windowDays, args.customHolidays || []).deadline;
    due.setHours(0, 0, 0, 0);
    const unit = win.counting === "months" ? `${Math.round(win.windowDays / 30)} calendar months` : `${win.windowDays} days`;
    const parts = [
      `Computed as ${unit} from ${from.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} (first day excluded)`,
      "deadline moved off a weekend/public holiday where it fell on one",
    ];
    return {
      window: win,
      dueDate: due.toISOString(),
      note: parts.join(" — ") + ". Verify against your division's practice.",
    };
  });
}

/** Calendar-month arithmetic (3 months from 22 Nov is 22 Feb, not 90 days),
 *  with the last day rolled off weekends/public holidays. */
function addCalendarMonths(from: Date, months: number, customHolidays: string[]): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setDate(1); // avoid month-length overflow (Jan 31 + 1 month)
  d.setMonth(d.getMonth() + months);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, daysInMonth));
  let guard = 0;
  while ((isWeekend(d) || isPublicHoliday(d, customHolidays)) && guard < 30) {
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return d;
}

/** The jurisdiction a court string resolves to (for the coverage chip). */
export function courtJurisdictionProfile(court: string | null | undefined): JurisdictionProfile {
  return resolveJurisdictionProfile(court || "");
}
