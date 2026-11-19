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
