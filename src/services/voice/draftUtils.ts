/**
 * draftUtils — pure helpers for INCREMENTAL DICTATION (owner spec,
 * 2026-11-18: "Add More / append to voice note").
 *
 * The invariant the whole feature hangs on: the verbatim tier is append-only
 * and immutable (tier 1, source of truth — `assembleVerbatim` joins segment
 * texts in index order and never edits them). So after an "Add More" cycle
 * the PREVIOUS verbatim is always a prefix of the NEW verbatim, which lets
 * us isolate exactly the words spoken in the newest clip — the delta that
 * gets appended onto the user's working draft.
 *
 * Everything here is pure string logic: no React, no network, fully covered
 * by tests/unit/voiceCapture.test.ts.
 */

/** Normalise whitespace for prefix comparison (assembleVerbatim collapses it). */
function normaliseWs(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/**
 * Extract the text of the NEWEST clip from the combined verbatim transcript.
 *
 * `fullVerbatim` is the capture's verbatim AFTER the append finalized;
 * `previousVerbatim` is what it was BEFORE the user tapped "Add More".
 * If the previous text is a prefix (the normal case), everything after it
 * is the new clip. If it is not a prefix (e.g. the Smart Clean tier was
 * passed by mistake, or a repair changed old segments), we fall back to the
 * full text so words are never silently dropped — the caller can decide how
 * to surface that.
 */
export function extractNewClipText(fullVerbatim: string, previousVerbatim: string): string {
  const full = normaliseWs(fullVerbatim);
  const prev = normaliseWs(previousVerbatim);
  if (!full) return "";
  if (!prev) return full;
  if (full === prev) return "";
  if (full.startsWith(prev)) {
    return full.slice(prev.length).trim();
  }
  // Not a clean prefix — return the whole thing rather than guessing.
  return full;
}

/**
 * Append a new dictation clip onto the end of the working draft.
 *
 * NEVER overwrites or deletes the earlier text (owner spec): the addition is
 * joined with a paragraph break so each dictation round reads as its own
 * block, and both sides are trimmed of edge whitespace. An empty current
 * draft simply becomes the addition.
 */
export function joinDraftText(currentDraft: string, addition: string): string {
  const base = (currentDraft || "").trimEnd();
  const add = (addition || "").trim();
  if (!add) return currentDraft || "";
  if (!base) return add;
  return `${base}\n\n${add}`;
}

/**
 * The timestamp separator inserted when dictation is appended onto an
 * ALREADY-SAVED note (owner spec: "with an optional timestamp separator").
 * Kept here so the format is consistent + testable.
 */
export function appendSeparatorLabel(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = new Date(date);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `— Appended ${day} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())} —`;
}

// ─── CONTEXT- & INTENT-AWARE FORMATTING (owner spec, 2026-11-19: "Wispr ────
// Flow style" upgrade). Voice notes used to dump the raw conversational
// transcript — meta-instructions included ("From voice note: I'm trying to
// set a reminder…") — straight into diary event notes and case notes. The
// LLM formatter is the primary layer (see buildAnalysisPrompt /
// QUICK_ASK_SYSTEM_PROMPT); the pure helpers below are the deterministic
// fallback + post-processing, shared verbatim by the CLIENT (TriageCard,
// QuickCaptureView) and the CONVEX backend (voiceCapture.ts) — this module
// has zero imports so both bundles can follow it safely.

/**
 * stripMetaSpeech — deterministically remove the conversational scaffolding
 * people wrap around dictations. Conservative by design: only well-known
 * meta-openers and trailing closers are stripped, so legal content can
 * never be eaten. The LLM pass handles the harder cases (mid-sentence
 * self-corrections, stumbles); this is the safety net when no AI output is
 * available (analysis failed, note added before AI finished, offline).
 */
const META_OPENERS: RegExp[] = [
  /^from (?:a |my )?voice ?note(?: recording)?[:,]?\s*/i,
  /^note to (?:self|file)[:,]?\s*/i,
  /^quick note[:,]?\s*/i,
  /^(?:i(?:'d| would| just)? (?:want|wanted|like|need) to|let me|i'm going to)\s+(?:capture|record|make|take|put down|dictate|log|file)\s+(?:a |this |the )?(?:quick )?note(?: (?:about|on|for|regarding))?[:,]?\s*/i,
  /^(?:i(?:'m| am) trying to|i want to|i'd like to|i need to|can you|could you(?: please)?|please)\s+(?:set(?: up)?|create|make|put)\s+(?:a |an )?reminder\s*(?:for|to|about|on)?\s*/i,
  /^(?:i(?:'m| am) trying to|i want to|i'd like to|i need to|can you|could you(?: please)?|please)\s+(?:remind me\s*(?:to|about|on)?|set a reminder to)\s*/i,
  /^(?:remind me|reminder)\s+(?:to|for|about|on)\s+/i,
  /^(?:set|add|create|put)\s+(?:a |an )?reminder\s*(?:to|for|about|on)?\s*/i,
  /^(?:okay|ok|right|so|well|yeah)\s*,\s*/i,
];

const META_CLOSERS: RegExp[] = [
  /[.,;!]?\s*(?:that'?s (?:it|all|everything)|that is all)\s*[.!]?$/i,
  /[.,;!]?\s*(?:thanks|thank you|okay thanks|alright then)\s*[.!]?$/i,
];

export function stripMetaSpeech(text: string): string {
  let out = (text || "").replace(/\s+/g, " ").trim();
  if (!out) return "";
  let stripped = true;
  // Openers can stack ("Okay, I want to set a reminder to …") — peel layers.
  let guard = 0;
  while (stripped && guard < 4) {
    stripped = false;
    for (const re of META_OPENERS) {
      const next = out.replace(re, "");
      if (next !== out) {
        out = next.trim();
        stripped = true;
      }
    }
    guard++;
  }
  for (const re of META_CLOSERS) {
    out = out.replace(re, "").trim();
  }
  // Recapitalise the first letter after a stripped opener.
  out = out.replace(/^([a-z])/, (m) => m.toUpperCase());
  return out.trim();
}

/**
 * formatEndorsementText — render the structured courtroom endorsement fields
 * as a formal, organized legal block (Court, Suit No, Parties, Coram,
 * Proceedings/Orders, Next Adjourned Date) for saving into a case note.
 * Deterministic: built from the already-extracted structured fields, so no
 * second LLM round-trip and nothing can be invented. Returns "" when there
 * is nothing meaningful to render.
 */
export function formatEndorsementText(e: {
  court?: string;
  suitNumber?: string;
  parties?: string;
  judge?: string;
  orders?: string[];
  nextAdjournedDate?: string;
  nextAdjournedTime?: string;
} | null | undefined): string {
  if (!e) return "";
  const lines: string[] = [];
  if (e.court) lines.push(`COURT: ${e.court}`);
  if (e.suitNumber) lines.push(`SUIT NO: ${e.suitNumber}`);
  if (e.parties) lines.push(`PARTIES: ${e.parties}`);
  if (e.judge) lines.push(`CORAM: ${e.judge}`);
  const orders = (e.orders || []).filter(Boolean);
  if (orders.length > 0) {
    lines.push("PROCEEDINGS / ORDERS:");
    orders.forEach((o, i) => lines.push(`${i + 1}. ${o}`));
  }
  if (e.nextAdjournedDate) {
    lines.push(
      `NEXT ADJOURNED DATE: ${e.nextAdjournedDate}${e.nextAdjournedTime ? ` at ${e.nextAdjournedTime}` : ""}`
    );
  }
  return lines.join("\n");
}

/**
 * eventDescriptionFrom — the diary event's Notes field, Wispr-Flow style:
 * the LLM's concise action summary for THIS event when the analysis
 * produced one; otherwise the meta-stripped draft as a bounded fallback.
 * NEVER the old "From voice note: <400 chars of raw transcript>" dump.
 */
export function eventDescriptionFrom(
  note: string | null | undefined,
  fallbackText: string,
  maxChars = 600
): string {
  const n = (note || "").trim();
  if (n) return n.slice(0, maxChars);
  return stripMetaSpeech(fallbackText || "").slice(0, maxChars);
}

// ─── PERSONAL DICTIONARY SILENT LEARNING (owner spec 2026-11-19, Part 2 §3) ─

/** Words never learned — common English, formatting, pronouns. */
const LEARN_STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "from", "have", "has", "was",
  "were", "will", "shall", "been", "being", "their", "there", "then", "than",
  "they", "them", "his", "her", "him", "she", "who", "whom", "whose", "which",
  "what", "when", "where", "why", "how", "all", "any", "some", "not", "but",
  "our", "your", "its", "it's", "dont", "does", "did", "doing", "done", "into",
  "onto", "over", "under", "again", "just", "also", "very", "much", "more",
  "most", "less", "least", "make", "made", "take", "took", "give", "gave",
  "said", "says", "say", "get", "got", "put", "set", "let", "one", "two",
  "next", "last", "first", "second", "new", "old", "now", "today", "tomorrow",
  "yesterday", "please", "okay", "note", "matter", "client", "case",
]);

function tokenizeForLearn(text: string): string[] {
  return (text || "")
    .replace(/[ \t]+/g, " ")
    .split(/[\n\r]+/)
    .join(" ")
    .split(" ")
    .map((w) => w.replace(/^[""'(\[{-]+|[""'')\]},.!?;:]+$/g, "").trim())
    .filter(Boolean);
}

function isLearnable(token: string): boolean {
  if (token.length < 3 || token.length > 40) return false;
  if (/^\d+$/.test(token)) return false;
  // Learn proper-noun-ish tokens: any capital letter anywhere, or an
  // all-lowercase token is only learned when it REPLACED a capitalised one
  // (handled by the caller comparing pairs) — standalone lowercase common
  // words are filtered by the stopword list + capitalisation check.
  if (LEARN_STOPWORDS.has(token.toLowerCase())) return false;
  if (/^[a-z]+$/.test(token)) return false; // plain lowercase → not a name/term
  return /[A-Z]/.test(token);
}

/**
 * extractLearnedTerms — the silent-learning diff behind the Personal
 * Dictionary. Compares the text the AI produced (before) with the user's
 * edited version (after) and returns the corrected proper nouns / terms
 * worth memorising: "Chinedoo" → "Chinedu" learns "Chinedu";
 * "Ikeja High Cot" → "Ikeja High Court" learns "Ikeja High Court".
 *
 * Alignment: word-level longest-common-subsequence; a replaced block of
 * ≤4 words whose replacement is capitalised becomes one learned phrase.
 * Pure string logic, fully unit-tested.
 */
export function extractLearnedTerms(before: string, after: string): string[] {
  const a = tokenizeForLearn(before || "");
  const b = tokenizeForLearn(after || "");
  if (a.length === 0 || b.length === 0) return [];

  // LCS table (capped so a pathological paste can't hang the tab).
  const MAX = 600;
  const A = a.slice(0, MAX);
  const B = b.slice(0, MAX);
  const dp: number[][] = Array.from({ length: A.length + 1 }, () =>
    new Array(B.length + 1).fill(0)
  );
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      dp[i][j] =
        A[i] === B[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Walk the LCS to collect the non-matching (replaced) segments.
  const learned: string[] = [];
  // B-words matched immediately before the currently-open replacement —
  // used to EXTEND a learned phrase with its proper-noun context
  // ("Cot"→"Court" alone learns "Ikeja High Court", not just "Court").
  let matchRun: string[] = [];
  const push = (seg: string[], prefix: string[]) => {
    const phrase = [...prefix, ...seg].join(" ").replace(/\s+/g, " ").trim();
    if (!phrase) return;
    if (seg.length === 1 ? isLearnable(seg[0]) : /[A-Z]/.test(phrase)) {
      learned.push(phrase);
    }
  };
  let i = 0;
  let j = 0;
  let delSeg: string[] = [];
  let insSeg: string[] = [];
  const flush = () => {
    if (delSeg.length > 0 && insSeg.length > 0 && insSeg.length <= 4) {
      // A replacement: the user's wording wins — learn it, extended with the
      // trailing proper-noun run that immediately precedes it.
      const prefix: string[] = [];
      for (let k = matchRun.length - 1; k >= 0 && prefix.length < 3; k--) {
        if (isLearnable(matchRun[k])) prefix.unshift(matchRun[k]);
        else break;
      }
      push(insSeg, prefix);
      matchRun = [];
    }
    delSeg = [];
    insSeg = [];
  };
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) {
      // Only close an open replacement block; consecutive matches keep
      // accumulating the proper-noun context run.
      if (delSeg.length > 0 || insSeg.length > 0) flush();
      matchRun.push(B[j]);
      if (matchRun.length > 4) matchRun.shift();
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      delSeg.push(A[i]);
      i++;
    } else {
      insSeg.push(B[j]);
      j++;
    }
  }
  while (i < A.length) {
    delSeg.push(A[i]);
    i++;
  }
  while (j < B.length) {
    insSeg.push(B[j]);
    j++;
  }
  flush();

  // De-dup, drop substrings of other learned phrases, cap at 5 per save.
  const uniq = Array.from(new Set(learned.map((t) => t.trim()))).filter(Boolean);
  const sorted = uniq.sort((x, y) => y.length - x.length);
  const kept: string[] = [];
  for (const t of sorted) {
    if (kept.some((k) => k.toLowerCase().includes(t.toLowerCase()))) continue;
    kept.push(t);
  }
  return kept.reverse().slice(0, 5);
}

// ─── READ vs WRITE INTENT CLASSIFICATION (owner bug report 2026-11-19) ─────
// Asking a read-only question like "What's my schedule today?" used to detect
// the date keyword "today" and MISTAKENLY create/stage a calendar entry for
// today. The fix classifies every input into one of three modes BEFORE any
// event/note extraction runs, in two layers:
//   1. The LLM classifies ("mode" in buildAnalysisPrompt /
//      QUICK_ASK_SYSTEM_PROMPT).
//   2. These pure helpers are the deterministic backstop: classifyIntentMode
//      detects question-shaped input with no write phrase, resolveIntentMode
//      merges the two verdicts (a deterministic query_only can NEVER be
//      upgraded to a write by the model), and eventHasActionableSubject is
//      the per-event date-keyword guardrail (a standalone date/time token is
//      never sufficient evidence to create an entry).
// Shared verbatim by the CLIENT and the CONVEX backend — zero dependencies.

/** The three capture/ask modes. `query_only` never creates anything. */
export type IntentMode = "query_only" | "mutation_action" | "hybrid";

/** Sentence-leading question shapes: interrogatives, aux-inversion and
 *  imperative lookups ("Show my tasks for Friday", "Any hearings this week?"). */
const QUESTION_STARTERS: RegExp[] = [
  /^(what|whats|what's|which|when|where|who|whom|whose|why|how)\b/i,
  /^(do|does|did|is|are|was|were|am|have|has|had|can|could|would|will|should|shall|may|might)\b/i,
  /^(show|list|find|search|look\s?up|pull\s?up|tell\sme|any|are\s there|is\s there|whats\s on)\b/i,
];

/** Interrogative evidence ANYWHERE in the text (embedded second sentences,
 *  trailing question marks, "do I have…" mid-string). */
const QUESTION_EMBEDDED: RegExp[] = [
  /\?\s*$/,
  /\b(do|does|did|is|are|was|were|have|has|had|can|could|will|would|should)\s+(i|we|you|there|my|mr|mrs|ms|dr|chief)\b/i,
  /\b(what|when|where|which|how)\b[^.!?]*\b(my|our|the|today|tomorrow|schedule|diary|calendar|hearing|task)\b/i,
];

/**
 * Write phrases — grammatical patterns that record/schedule/create something.
 * Deliberately VERB+OBJECT shaped: "schedule a meeting" is a write command,
 * but "my schedule" (the noun in "What's my schedule today?") is NOT. A bare
 * date/time word is never on this list — that is the whole bug being fixed.
 */
const WRITE_PHRASES: RegExp[] = [
  /\bremind me\b/i,
  /\bschedule\s+(a|an|the|another|us|for)\b/i,
  /\b(add|create|put|set)\b[^.!?]{0,30}\b(task|event|reminder|entry|note|meeting|hearing|appointment|to-?do|deadline|milestone)s?\b/i,
  /\bset\s+(a|an|the)?\s*(reminder|task|alarm)\b/i,
  /\blog\s+(a|an|the)?\s*(expense|fee|cost|payment|disbursement|receipt|income)\b/i,
  /\bnote\s+(that|down|to)\b/i,
  /\bsave\s+(a|an|the|this|that)\b/i,
  /\b(draft|prepare|write)\s+(me\s+)?(a|an|the)\b/i,
  /\bfile\s+(the|my|a|an|our)\b/i,
  /\bfollow[\s-]?up\b/i,
  /\bmeeting\s+with\b/i,
  /\bappointment\s+with\b/i,
  /\bnew\s+(instruction|client|matter|brief)\b/i,
  /\bmark\b[^.!?]*\b(done|completed|complete)\b/i,
  /\b(court\s+rose|coram|suit\s+no|next\s+adjourned|matter\s+of)\b/i,
  /\bi\s+(need\s+to|have\s+to|must|will|would\s+like\s+to|want\s+to)\b/i,
  /\bi'?ll\b/i,
];

/**
 * classifyIntentMode — the deterministic read/write verdict for a raw
 * transcript or typed question.
 *
 *   query_only       question-shaped AND no write phrase anywhere
 *   hybrid           question-shaped AND at least one write phrase
 *                    (e.g. "What's my schedule tomorrow, and add a review
 *                    task at 4 PM?" — only the write clause may be extracted)
 *   mutation_action  everything else (Quick Capture's primary use is
 *                    dictated notes/tasks, so command-shaped text defaults
 *                    to a write; the LLM's own query_only verdict can still
 *                    downgrade it in resolveIntentMode)
 */
export function classifyIntentMode(text: string): IntentMode {
  const t = (text || "").trim();
  if (!t) return "mutation_action";
  const isQuestion =
    QUESTION_STARTERS.some((rx) => rx.test(t)) ||
    QUESTION_EMBEDDED.some((rx) => rx.test(t));
  if (!isQuestion) return "mutation_action";
  const hasWrite = WRITE_PHRASES.some((rx) => rx.test(t));
  return hasWrite ? "hybrid" : "query_only";
}

/**
 * resolveIntentMode — merge the deterministic verdict (above) with the LLM's
 * own "mode" field. Precedence, conservative by design:
 *
 *   1. deterministic query_only ALWAYS wins — a question-shaped input with
 *      no write phrase can never be upgraded into a write by the model
 *      (this is the exact regression being fixed).
 *   2. otherwise the LLM's query_only wins (it catches nuance the regexes
 *      miss, e.g. "Should I add a task?" is advice-seeking, not a command).
 *   3. hybrid from either side → hybrid (extract only the write clause).
 *   4. default mutation_action.
 */
export function resolveIntentMode(
  det: IntentMode,
  llm: string | null | undefined
): IntentMode {
  if (det === "query_only") return "query_only";
  const llmMode = (llm || "").trim().toLowerCase();
  if (llmMode === "query_only") return "query_only";
  if (llmMode === "hybrid" || det === "hybrid") return "hybrid";
  return "mutation_action";
}

/** Date/time words, interrogatives, determiners and connectives — stripped
 *  before an event title is judged for an actionable subject. */
const DATE_TIME_WORDS = new Set([
  "today", "tonight", "tomorrow", "tmrw", "yesterday", "monday",
  "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "morning", "afternoon", "evening", "night", "noon", "midday", "midnight",
  "week", "weeks", "weekly", "weekend", "weekday", "month", "months",
  "monthly", "year", "years", "yearly", "fortnight", "quarter", "day",
  "days", "daily", "date", "time", "times", "hour", "hours", "minute",
  "minutes", "oclock", "am", "pm", "january", "february", "march", "april",
  "may", "june", "july", "august", "september", "october", "november",
  "december", "next", "this", "last", "every", "each", "coming", "upcoming",
  "till", "until", "at", "on", "in", "by", "from", "to", "for", "of", "and",
  "or", "with", "without", "the", "a", "an", "my", "our", "your", "his",
  "her", "their", "its", "that", "these", "those", "all", "any", "some",
  "is", "are", "was", "were", "be", "been", "being", "do", "does", "did",
  "have", "has", "had", "will", "would", "can", "could", "should", "may",
  "might", "must", "shall", "not", "no", "yes", "i", "we", "you", "he",
  "she", "they", "it", "me", "us", "them", "there", "here", "what", "whats",
  "when", "where", "who", "whom", "whose", "why", "how", "which", "show",
  "list", "find", "search", "tell", "please", "kindly",
]);

/** Generic container nouns — they name the KIND of entry, never its subject
 *  ("My schedule today", "Hearings this week" have no actionable subject). */
const GENERIC_SUBJECT_WORDS = new Set([
  "schedule", "calendar", "diary", "agenda", "itinerary", "plan", "plans",
  "planning", "event", "events", "entry", "entries", "task", "tasks",
  "reminder", "reminders", "item", "items", "thing", "things", "stuff",
  "hearing", "hearings", "appearance", "appearances", "meeting",
  "meetings", "appointment", "appointments", "matter", "matters", "case",
  "cases", "note", "notes", "brief", "briefs", "client", "clients",
  "update", "updates", "activity", "activities", "court", "date", "dates",
]);

/** Bare action verbs — only actionable when paired with an object or a
 *  generic task noun ("Review task", "Check registry"); alone ("Review",
 *  "Check") they are subjectless junk. */
const ACTION_VERBS = new Set([
  "review", "check", "verify", "confirm", "call", "phone", "email", "file",
  "submit", "draft", "send", "prepare", "pay", "renew", "visit", "meet",
  "discuss", "attend", "collect", "sign", "print", "serve", "complete",
  "finish", "respond", "reply", "obtain", "process", "register", "follow",
  "mark", "book", "arrange", "organise", "organize", "compile", "evaluate",
  "assess", "analyse", "analyze", "research", "investigate", "inspect",
  "examine", "chase", "escalate", "attend",
]);

/**
 * eventHasActionableSubject — the per-event DATE-KEYWORD GUARDRAIL (owner
 * spec §2): a calendar/task extraction is only valid when there is BOTH an
 * actionable subject/task AND a clear intent to record it. A title that is
 * nothing but date/time words plus generic containers ("My schedule today",
 * "Hearings this week", "What's on tomorrow") carries no subject and is
 * dropped — a standalone date token is never sufficient evidence.
 */
export function eventHasActionableSubject(title: string): boolean {
  const words = (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  // Words that survive noise-stripping and are long enough to carry meaning.
  const significant = words.filter(
    (w) => w.length >= 3 && !DATE_TIME_WORDS.has(w)
  );
  if (significant.length === 0) return false;
  // Any word that is neither a generic container nor a bare action verb is a
  // real subject ("Sino Truck", "registry", "engagement letter").
  const hasSpecific = significant.some(
    (w) => !GENERIC_SUBJECT_WORDS.has(w) && !ACTION_VERBS.has(w)
  );
  if (hasSpecific) return true;
  // "Review task" / "Prepare brief" — action verb + task noun still names a
  // doable thing (the explicit "add a review task at 4 PM" hybrid case).
  const hasAction = significant.some((w) => ACTION_VERBS.has(w));
  const hasNoun = significant.some((w) => GENERIC_SUBJECT_WORDS.has(w));
  return hasAction && hasNoun;
}
