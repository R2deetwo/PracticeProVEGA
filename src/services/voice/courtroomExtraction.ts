/**
 * courtroomExtraction — the shared structured-extraction layer behind Court
 * Mode and ALOA Vox (ROUND 25, ALOA Vox intelligence overhaul, owner spec
 * 2026-11-28).
 *
 * A dictated courtroom passage must yield SEPARATED, ACTIONABLE items that
 * the lawyer can act on with ONE tap, auto-associated with the active
 * matter:
 *
 *   "The court adjourned to the 4th of December for hearing of the motion;
 *    the defendants are to file their response; we will file a written
 *    address; remind me to prepare the written address"
 *
 *        → next date  4 Dec 2026   ([Set as next date])
 *        → task       "Defendants to file their response"
 *        → task       "File a written address"
 *        → reminder   "Prepare the written address"
 *
 * Pure and deterministic — no LLM, no React, no network. The next date uses
 * the same `detectNextDate`/`extractDatedMention` engine the composer's
 * detected-date prompt runs on, so the chip and the banner can never
 * disagree. Unit-tested in tests/unit/courtroomExtraction.test.ts.
 */
import { detectNextDate } from "../../components/aloa/courtModeUtils";
import { extractDatedMention } from "../../utils/endorsementDateParser";

/** One actionable directive pulled out of a dictated courtroom passage. */
export interface CourtroomAction {
  /** "task" — a party/case deadline or filing directive.
   *  "reminder" — a personal reminder the lawyer asked for. */
  kind: "task" | "reminder";
  /** A clean, self-describing imperative title
   *  ("Defendants to file their response" / "Prepare the written address"). */
  title: string;
  /** Local YYYY-MM-DD when the directive stated its own date; else null. */
  dueDayKey: string | null;
  /** The raw sentence the action was read from (for tooltips/audits). */
  sourceSentence: string;
}

export interface CourtroomExtraction {
  /** The detected next/adjourned date (shared detection engine), or null. */
  nextDate: { dateISO: string; timeHHmm: string | null; label: string } | null;
  /** Party / case deadlines and directives ("the defendants are to file…",
   *  "we will file a written address"). */
  tasks: CourtroomAction[];
  /** Personal reminders ("remind me to prepare the written address"). */
  reminders: CourtroomAction[];
}

/** Litigation-side nouns that can carry a directive. */
const PARTY_RE =
  "(?:the\\s+)?(?:defendants?|defendants'?|defence|defense|claimants?|claimants'?|plaintiffs?|plaintiffs'?|applicants?|applicants'?|respondents?|respondents'?|appellants?|appellants'?|petitioners?|parties|party|counsel(?:\\s+for\\s+the\\s+(?:defendants?|claimants?|plaintiffs?|applicants?|respondents?|appellants?))?)";

/** First-person subjects ("we", "our counsel") — the directive becomes the
 *  bare imperative ("we will file a written address" → "File a written
 *  address"). */
const WE_RE = "(?:we|our\\s+counsel|our\\s+side)";

/** Directive verb forms after a subject: "are to", "is to", "shall",
 *  "must", "will", "should", "is directed to", "are directed to", or the
 *  bare "to" of a court order ("ordered the defendants to file…",
 *  "the defendants to file…"). */
const DIRECTIVE_RE =
  "(?:\\s+(?:are|is|was|were)\\s+(?:to|directed\\s+to)|\\s+(?:shall|must|should|will)|\\s+(?:has|have)\\s+to|\\s+to)";

/** Optional "the court ordered / directed" lead-in before a party. */
const ORDERED_LEADIN_RE = "(?:\\b(?:ordered|directed)\\s+)?";

/** The action verbs a directive is recognised by (courtroom practice). */
const ACTION_VERB_RE =
  "(?:file|serve|submit|forward|respond|reply|open|close|call|enter|tender|amend|withdraw|pay|depose|adopt|conclude|furnish|comply)\\b";

const MAX_TASKS = 6;
const MAX_REMINDERS = 4;

/** Split a passage into sentence-ish chunks a directive can live inside. */
const sentencesOf = (text: string): string[] =>
  (text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.;])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

/** Capitalise the first letter; clean a leading "the ". */
const toTitle = (phrase: string): string => {
  let out = phrase.trim().replace(/\s+/g, " ");
  out = out.replace(/^the\s+/i, "");
  if (out) out = out[0].toUpperCase() + out.slice(1);
  return out;
};

/** Normalise a third-party directive into an imperative title:
 *  "the defendants are to file their response" → "Defendants to file their
 *  response". */
const partyTitle = (party: string, action: string): string => {
  const subject = party.replace(/^the\s+/i, "").trim();
  return toTitle(`${subject} to ${action}`);
};

/** Trim a trailing sentence punctuation / conjunction tail a sentence
 *  boundary leaves ("file their response." → "file their response"). */
const trimTail = (phrase: string): string =>
  phrase
    .replace(/[.;,]+$/, "")
    .replace(/\s+(?:and|or|but)$/i, "")
    .trim();

const extractDueDayKey = (sentence: string, nextDateISO: string | null): string | null => {
  const mention = extractDatedMention(sentence);
  if (!mention) return null;
  const year = mention.date.getFullYear();
  const month = String(mention.date.getMonth() + 1).padStart(2, "0");
  const day = String(mention.date.getDate()).padStart(2, "0");
  const dayKey = `${year}-${month}-${day}`;
  // The adjournment date itself is the NEXT DATE, not this action's due date.
  if (nextDateISO && dayKey === nextDateISO) return null;
  return dayKey;
};

/**
 * Extract the actionable structure from a dictated courtroom passage.
 * Deterministic: no LLM, no invention — every item is read from the lawyer's
 * own words; a sentence with no directive yields nothing.
 */
export function extractCourtroomActions(text: string, now: Date = new Date()): CourtroomExtraction {
  const nextDate = detectNextDate(text, now);
  const tasks: CourtroomAction[] = [];
  const reminders: CourtroomAction[] = [];
  const seenTaskTitles = new Set<string>();
  const seenReminderTitles = new Set<string>();

  for (const sentence of sentencesOf(text)) {
    // ── Personal reminders: "remind me to prepare the written address". ──
    if (reminders.length < MAX_REMINDERS) {
      const reminder = /\bremind me to\s+(.+)$/i.exec(sentence);
      if (reminder) {
        const title = toTitle(trimTail(reminder[1]));
        if (title && !seenReminderTitles.has(title.toLowerCase())) {
          seenReminderTitles.add(title.toLowerCase());
          reminders.push({
            kind: "reminder",
            title,
            dueDayKey: extractDueDayKey(sentence, nextDate?.dateISO ?? null),
            sourceSentence: sentence,
          });
          continue; // a reminder sentence is not also a task
        }
      }
    }

    if (tasks.length >= MAX_TASKS) continue;

    // ── Party directives: "the defendants are to file their response",
    //    "the court ordered the defendants to file their response",
    //    "counsel for the claimant shall serve…" ──
    const partyMatch = new RegExp(
      `${ORDERED_LEADIN_RE}\\b(${PARTY_RE})${DIRECTIVE_RE}\\s+(${ACTION_VERB_RE}.*)`,
      "i",
    ).exec(sentence);
    if (partyMatch) {
      const title = trimTail(partyTitle(partyMatch[1], partyMatch[2]));
      if (title && !seenTaskTitles.has(title.toLowerCase())) {
        seenTaskTitles.add(title.toLowerCase());
        tasks.push({
          kind: "task",
          title,
          dueDayKey: extractDueDayKey(sentence, nextDate?.dateISO ?? null),
          sourceSentence: sentence,
        });
      }
      continue;
    }

    // ── First-person directives: "we will file a written address" ──
    const weMatch = new RegExp(`\\b${WE_RE}${DIRECTIVE_RE}\\s+(${ACTION_VERB_RE}.*)`, "i").exec(sentence);
    if (weMatch) {
      const title = trimTail(toTitle(weMatch[1]));
      if (title && !seenTaskTitles.has(title.toLowerCase())) {
        seenTaskTitles.add(title.toLowerCase());
        tasks.push({
          kind: "task",
          title,
          dueDayKey: extractDueDayKey(sentence, nextDate?.dateISO ?? null),
          sourceSentence: sentence,
        });
      }
    }
  }

  return { nextDate, tasks, reminders };
}
