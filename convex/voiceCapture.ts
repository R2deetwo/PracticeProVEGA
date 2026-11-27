/**
 * voiceCapture.ts — the Voice Capture Engine backend.
 *
 * The dependable 3-step pipeline behind Quick Capture Mode and the Hybrid
 * Legal Pad (owner spec, 2026-11-18):
 *
 *   STEP 1 — on-device capture (client side, src/services/voice/):
 *     segmented MediaRecorder → 16 kHz mono WAV → IndexedDB queue →
 *     upload when connectivity returns. A courtroom/basement recording is
 *     never lost: audio lands on disk BEFORE any network call.
 *
 *   STEP 2 — backend transcription (this file):
 *     `uploadSegment` stores the original audio in Convex file storage
 *     (two-tier storage, tier 1) and transcribes it through a DEDICATED
 *     backend service — OpenAI Whisper when OPENAI_API_KEY is configured,
 *     with the already-wired Gemini as fallback. Never browser speech
 *     recognition. Segments carry an explicit index so out-of-order
 *     offline replays still assemble correctly, and (clientLocalId,
 *     segmentIndex) is idempotent — a retry storm can never double-book.
 *
 *   STEP 3 — smart polishing + routing (this file):
 *     `finalizeCapture` assembles the word-for-word VERBATIM transcript
 *     (tier 1, source of truth — never edited), optionally runs the
 *     SMART CLEAN pass (filler removal, self-correction resolution,
 *     punctuation, Nigerian legal terminology preserved), triages quick
 *     captures into the single best next action (case note / diary /
 *     quick ask / share), and merges the Hybrid Legal Pad's typed
 *     shorthand with the spoken record into one structured summary.
 *
 * Architecture note: actions have no ctx.db in Convex, and an action must
 * never call `internal.<its own module>` (circular type inference — see
 * voiceCaptureInternal.ts). All action-side database access therefore goes
 * through internal.voiceCaptureInternal.*.
 *
 * Security follows the house rules: every public function authenticates
 * the caller by session bearer (never caller-supplied identity), is
 * firm-scoped, rate-limited, and payload-capped.
 */

import { action, query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { requireFirmUser } from "./authHelpers";
import { canUseVox, effectiveFirmPlan } from "./tierLimits";
import { QUALITY_MODEL } from "./aiModels";
// Pure, dependency-free formatting helpers shared with the CLIENT bundle
// (TriageCard / QuickCaptureView). Safe to import here: draftUtils has zero
// imports of its own, so the Convex function bundler just inlines the text
// logic (owner spec 2026-11-19: context- & intent-aware formatting).
import {
  classifyIntentMode,
  eventHasActionableSubject,
  resolveIntentMode,
  stripMetaSpeech,
  type IntentMode,
} from "../src/services/voice/draftUtils";
// VOICE → DRAFTPRO PIPELINE (owner spec 2026-11-19, §4 Phase 2): the same
// convention — pure, dependency-free modules under src/legal/drafting are
// safe for the Convex bundler. The blueprint validator, self-correction
// resolver and alias map live there, unit-tested in tests/unit/drafting/.
import {
  blueprintIsSubstantive,
  minimalBlueprint,
  validateDraftBlueprint,
} from "../src/legal/drafting/blueprint";
import type { DraftBlueprint } from "../src/legal/drafting/types";
// Firm-wide default spoken snippets (used until the firm seeds its own).
import { DEFAULT_SNIPPETS } from "./voiceTools";

// ─── Caps & limits ─────────────────────────────────────────────────────────

/** Max base64 audio per segment call (~4 MB binary → ~5.5 MB base64). */
const MAX_AUDIO_BASE64_CHARS = 5_500_000;
/** Max wall-clock length of ONE segment (client slices at ≤75 s; headroom). */
const MAX_SEGMENT_MS = 5 * 60 * 1000;
/** Max assembled transcript accepted by the polish/triage passes. */
const MAX_TRANSCRIPT_CHARS = 200_000;

// ─── Pure helpers (unit-tested in tests/unit/voiceCapture.test.ts) ─────────

/**
 * Classify a Gemini HTTP failure into an actionable bucket.
 *
 * WHY THIS EXISTS (2026-11-18, founder-reported): the platform's Gemini key
 * had been committed to the public repo, so Google's leaked-credential
 * scanner disabled it. Every AI call then failed with
 *   403 PERMISSION_DENIED "Your API key was reported as leaked"
 * and — because the raw Error string crossed the Convex action boundary —
 * users saw a terrifying "[Request ID: …] Server Error Uncaught Error:
 * Gemini 403: …" dialog instead of something human. ConvexError messages
 * DO reach the client verbatim, so the classifier lets us surface a clean,
 * honest, actionable message for every failure class.
 */
export type GeminiFailureClass =
  | "key-rejected" // 401/403, leaked/invalid/suspended key, permission denied
  | "rate-limited" // 429
  | "provider-down" // 5xx
  | "bad-request" // 400/404/422 — wrong model name, malformed body
  | "unknown";

export function classifyGeminiFailure(status: number, errText: string): GeminiFailureClass {
  const t = (errText || "").toLowerCase();
  if (
    status === 401 ||
    status === 403 ||
    t.includes("leaked") ||
    t.includes("permission_denied") ||
    t.includes("api key") ||
    t.includes("api_key")
  ) {
    return "key-rejected";
  }
  if (status === 429 || t.includes("resource_exhausted")) return "rate-limited";
  if (status >= 500) return "provider-down";
  if (status === 400 || status === 404 || status === 422) return "bad-request";
  return "unknown";
}

/** Human messages for each failure class (client-safe, no provider jargon). */
export const GEMINI_FAILURE_MESSAGES: Record<GeminiFailureClass, string> = {
  "key-rejected":
    "AI is temporarily unavailable — the platform's AI key needs to be rotated. Nothing you recorded was lost; please try again once it's updated.",
  "rate-limited":
    "The AI service is rate-limited right now. Please wait a moment and try again — nothing you recorded was lost.",
  "provider-down":
    "The AI service had a temporary problem. Please try again in a moment — nothing you recorded was lost.",
  "bad-request":
    "The AI service rejected the request. Please try again, and report it if it keeps happening.",
  unknown: "The AI service could not be reached. Please try again in a moment.",
};

/**
 * Throw the RIGHT kind of error for a Gemini HTTP failure. ConvexError
 * messages reach the client verbatim (plain Error becomes
 * "Uncaught Error … [Request ID]"), so every user-visible path must throw
 * ConvexError.
 */
function throwGeminiFailure(status: number, errText: string, what: string): never {
  const cls = classifyGeminiFailure(status, errText);
  if (cls !== "unknown" && cls !== "bad-request") {
    throw new ConvexError(GEMINI_FAILURE_MESSAGES[cls]);
  }
  // Bad request / unknown: still a server-side concern — keep the detail
  // for the logs but wrap in ConvexError so the client sees clean text.
  throw new ConvexError(
    `AI ${what} failed (${status}). ${errText.slice(0, 160)}`
  );
}

/** Decode a base64 string (optionally a data: URL) into bytes. */
export function decodeBase64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") && b64.trimStart().startsWith("data:")
    ? b64.slice(b64.indexOf(",") + 1)
    : b64;
  const bin =
    typeof Buffer !== "undefined"
      ? Buffer.from(clean, "base64")
      : Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  return new Uint8Array(bin);
}

/** Assemble the verbatim transcript from per-segment texts, order-safe. */
export function assembleVerbatim(
  segmentTexts: { index: number; text: string }[]
): string {
  if (!segmentTexts || segmentTexts.length === 0) return "";
  const sorted = [...segmentTexts].sort((a, b) => a.index - b.index);
  // 2026-11-20 (owner: "fix the repeating 'so' loop"): a prompt-conditioned
  // transcriber can echo the PREVIOUS segment's text verbatim when the next
  // chunk is near-silent (Low-Volume / Quiet Mode is the worst case — the
  // recorder keeps the noise-suppression gate open). Consecutive identical
  // segment texts are collapsed to one before the join.
  const deduped: { index: number; text: string }[] = [];
  const normText = (t: string) =>
    (t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  for (const s of sorted) {
    const prev = deduped[deduped.length - 1];
    if (prev && normText(prev.text) && normText(prev.text) === normText(s.text)) {
      continue; // identical consecutive segment — an echo, not a real repeat
    }
    deduped.push(s);
  }
  const joined = deduped
    .map((s) => (s.text || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  // Cross-seam loop collapse ("…end. so" + "so so…" → "…end. so") — the
  // per-segment sanitizer cannot see across the join.
  return collapseFillerLoops(joined);
}

// ─── HALLUCINATED-FILLER GUARD (owner spec 2026-11-20) ─────────────────────
//
// Speech models hallucinate short filler tokens on near-silent audio —
// Whisper's signature failure is an endless "So. So. So…" and Gemini emits
// "Thank you." / "Mm-hmm." on room noise. Low-Volume / Quiet Mode (the
// whisper capture profile: noise suppression OFF so quiet speech survives)
// feeds the transcriber more noise floor, so the failure clusters there.
// These three deterministic helpers run on EVERY segment transcript — they
// can never remove real words, only collapse pathological repetition and
// drop transcripts that contain nothing else.

/**
 * TRUE spoken fillers: even a 2× consecutive repeat is collapsed to one.
 * Deliberately NARROW — common function words (the, and, a, is…) are NOT
 * here, so a real human stutter ("the the file") survives the VERBATIM
 * tier intact (Smart Clean handles stutters on the cleaned tier).
 */
const LOOP_COLLAPSE_2X = new Set([
  "so", "um", "uh", "uhm", "erm", "er", "ah", "ahh", "ahem", "hm", "hmm",
  "hmmm", "mm", "mmm", "mm-hmm", "mhm", "huh", "uh-huh", "uh-oh", "oh",
  "ooh", "yeah", "ya", "yep", "yup", "nah", "nope", "hey", "hi", "hello",
  "thanks", "thank", "please", "bye", "goodbye", "welcome", "okay", "ok",
  "okey", "you", "your", "music", "sound", "noise", "silence", "applause",
  "laughter", "laughing", "cheering", "clapping", "coughing", "sighing",
  "sigh", "exhale", "breathing", "breath", "wind", "breeze", "sub", "sin",
  "sen",
]);

/**
 * FILLER-ONLY detection vocabulary (a SUPERSET of LOOP_COLLAPSE_2X): a
 * transcript made entirely of these tokens (plus punctuation) carries no
 * substance — it is a hallucination on silence, never real dictation.
 * Function words belong HERE (not in LOOP_COLLAPSE_2X) because "the the
 * the" alone is still nonsense, while "the the file" is real speech.
 */
const FILLER_ONLY_TOKENS = new Set([
  ...LOOP_COLLAPSE_2X,
  "yes", "no", "am", "i", "me", "my", "the", "and", "a", "an", "of", "to",
  "it", "is", "in", "on", "for", "this", "that",
]);

/** Strip punctuation/case for token comparison. */
const tokenKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9'-]/g, "");

/** True when the transcript contains no word outside the filler vocabulary. */
export function isFillerOnlyText(text: string): boolean {
  const tokens = (text || "").split(/\s+/).map(tokenKey).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => FILLER_ONLY_TOKENS.has(t));
}

/**
 * Collapse runs of a repeated token: "so so so so" → "so", "the the the" →
 * "the". Rules (conservative by design — this runs on the VERBATIM tier):
 *   - any token repeated 3+ times consecutively → one instance (a real
 *     stutter is 2; 3+ is a loop);
 *   - a TRUE filler token (LOOP_COLLAPSE_2X) repeated even twice → one
 *     instance;
 *   - everything else is left exactly as spoken.
 * The LAST raw instance of the run is the survivor, so sentence-final
 * punctuation ("So. So. So." → "So.") is preserved.
 */
export function collapseFillerLoops(text: string): string {
  if (!text) return text;
  const rawTokens = text.split(/\s+/).filter((t) => t.length > 0);
  const out: string[] = [];
  // Current run of an identical token. The survivor rule at flush:
  //   filler OR 3+ run  → ONE instance (the last — punctuation rides along)
  //   exactly 2, non-filler → BOTH instances (a real stutter, verbatim-true)
  let runKey = "";
  let runFirst = "";
  let runLast = "";
  let runTotal = 0;
  const flush = () => {
    if (!runKey) return;
    if (LOOP_COLLAPSE_2X.has(runKey) || runTotal >= 3) {
      out.push(runLast);
    } else if (runTotal === 2) {
      out.push(runFirst, runLast);
    } else {
      out.push(runLast);
    }
    runKey = "";
    runFirst = "";
    runLast = "";
    runTotal = 0;
  };
  for (const raw of rawTokens) {
    const key = tokenKey(raw);
    if (!key) {
      // pure punctuation — flushes the run, never starts one
      flush();
      out.push(raw);
      continue;
    }
    if (runKey === key) {
      runTotal++;
      runLast = raw;
      continue;
    }
    flush();
    runKey = key;
    runFirst = raw;
    runLast = raw;
    runTotal = 1;
  }
  flush();
  return out.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Full segment-transcript sanitizer: collapse loops, then decide whether
 * anything substantive remains. Returns the cleaned text and whether the
 * transcript should be dropped entirely (filler-only hallucination).
 */
export function sanitizeSegmentText(text: string): { text: string; dropped: boolean } {
  const collapsed = collapseFillerLoops((text || "").trim());
  if (!collapsed || isFillerOnlyText(collapsed)) {
    return { text: "", dropped: true };
  }
  return { text: collapsed, dropped: false };
}

/**
 * Digital-silence guard: RMS level of a 16-bit PCM WAV in [0, 1]. The
 * recorder delivers 16 kHz mono WAVs; anything at/below SILENT_RMS carries
 * no recoverable speech (it is the codec's noise floor) — submitting it to
 * the transcription endpoint only buys hallucinated fillers. Quiet-mode
 * recordings of REAL whispered speech sit orders of magnitude above this.
 */
export const SILENT_RMS_THRESHOLD = 0.0006;

export function wavRmsLevel(wavBytes: Uint8Array): number {
  try {
    const dv = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
    // Walk the RIFF chunks to the data chunk (skip LIST/fmt extras).
    let offset = 12;
    let dataLen = 0;
    let dataOffset = 0;
    let bitsPerSample = 16;
    while (offset + 8 <= dv.byteLength) {
      const chunkId = String.fromCharCode(
        dv.getUint8(offset), dv.getUint8(offset + 1), dv.getUint8(offset + 2), dv.getUint8(offset + 3)
      );
      const chunkSize = dv.getUint32(offset + 4, true);
      if (chunkId === "fmt ") {
        // fmt chunk layout: +0..3 "fmt ", +4..7 size, +8..9 audioFormat,
        // +10..11 channels, +12..15 sampleRate, +16..19 byteRate,
        // +20..21 blockAlign, +22..23 bitsPerSample.
        bitsPerSample = dv.getUint16(offset + 8 + 14, true) || 16;
      } else if (chunkId === "data") {
        dataOffset = offset + 8;
        dataLen = Math.min(chunkSize, dv.byteLength - dataOffset);
        break;
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    if (!dataLen || bitsPerSample !== 16) return 1; // unparseable → assume speech
    const sampleCount = Math.floor(dataLen / 2);
    if (sampleCount <= 0) return 0;
    // Stride on long clips — RMS is stable well before every sample.
    const stride = sampleCount > 40_000 ? Math.ceil(sampleCount / 40_000) : 1;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < sampleCount; i += stride) {
      const v = dv.getInt16(dataOffset + i * 2, true) / 32768;
      sum += v * v;
      n++;
    }
    return Math.sqrt(sum / Math.max(n, 1));
  } catch {
    return 1; // never let the guard itself kill audio
  }
}

/** Lagos (West Africa) is UTC+01:00 year-round — no DST to worry about. */
export function lagosNow(nowMs: number): { dateISO: string; weekday: string; time: string } {
  const d = new Date(nowMs + 60 * 60 * 1000); // shift to WAT
  const dateISO = d.toISOString().slice(0, 10);
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
  const time = d.toISOString().slice(11, 16);
  return { dateISO, weekday, time };
}

/**
 * Deterministic matter/contact matching — the backstop behind the LLM's
 * candidate names. Normalised containment both ways so "the Okafor matter"
 * matches "Okafor & Sons Ltd v. FBN" and vice versa.
 */
export function matchMatterCandidates(
  candidates: string[],
  matters: { id: string; title?: string | null; suitNumber?: string | null; clientId?: string | null }[],
  contacts: { id: string; name?: string | null }[]
): { matchedMatterIds: string[]; matchedContactIds: string[] } {
  const norm = (s: string) =>
    (s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const matchedMatterIds: string[] = [];
  const matchedContactIds: string[] = [];
  const names = (candidates || []).map(norm).filter((n) => n.length >= 3);
  if (names.length === 0) return { matchedMatterIds, matchedContactIds };

  for (const m of matters || []) {
    const title = norm(m.title || "");
    const suit = norm(m.suitNumber || "");
    if (!title && !suit) continue;
    const hit = names.some(
      (n) =>
        (title && (title.includes(n) || n.includes(title))) ||
        (suit && (suit.includes(n) || n.includes(suit)))
    );
    if (hit && !matchedMatterIds.includes(m.id)) matchedMatterIds.push(m.id);
  }
  for (const c of contacts || []) {
    const name = norm(c.name || "");
    if (!name) continue;
    const hit = names.some((n) => name.includes(n) || n.includes(name));
    if (hit && !matchedContactIds.includes(c.id)) matchedContactIds.push(c.id);
  }
  return { matchedMatterIds, matchedContactIds };
}

/** Parse a model response that should contain JSON (fences, prose, the works). */
export function parseModelJson<T = any>(text: string): T | null {
  if (!text) return null;
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  try {
    return JSON.parse(t.slice(first, last + 1)) as T;
  } catch {
    return null;
  }
}

// ─── Prompts (verbatim transcription / smart clean / triage / merge) ───────

/**
 * ROUND 25 (ALOA Vox intelligence overhaul, owner bug report 2026-11-28:
 * "hearing of emotion" / "council" mis-hearings): the Nigerian litigation
 * vocabulary the STT layer is biased with — one shared hint block for the
 * Whisper `prompt` param (vocabulary biasing) and both Gemini transcription
 * prompts. Domain terms captured accurately at the SOURCE reduce what the
 * cleanup pass has to repair.
 */
export const LEGAL_STT_VOCABULARY_HINT = [
  "Nigerian litigation vocabulary — transcribe these terms accurately:",
  "counsel (a lawyer appearing in court — never 'council' unless a local-government or legislative council is clearly meant),",
  "hearing of motion (never 'hearing of emotion'), motion on notice, motion ex parte,",
  "written address / written addresses (never 'written addresses' for one),",
  "notice of appeal, notice of preliminary objection, originating summons, originating motion,",
  "adjourned / adjournment, ruling, judgment, coram (the judge, e.g. 'coram: Hon. Justice…'),",
  "suit numbers exactly as spoken (e.g. FHC/L/CS/1234/2024, NICN/LA/45/2023, CA/L/123/2024, SC/234/2025),",
  "mention, pre-trial conference, adoption of written addresses, holding brief, leading counsel,",
  "affidavit, counter-affidavit, further affidavit, exhibit, locus standi, lis pendens,",
  "claimant, defendant, respondent, appellant, applicant, petitioner.",
].join(" ");

export function buildVerbatimPrompt(continuationTail?: string): string {
  return [
    "You are a verbatim speech-to-text transcription engine for a Nigerian legal practice.",
    "Transcribe EXACTLY what is spoken — word for word. Do NOT clean up, summarise, punctuate beyond natural pauses, or remove fillers (um, uh, repetitions).",
    "Preserve Nigerian names (Chidi, Ngozi, Adebayo...), titles (Barrister, SAN, Hon. Justice), amounts in Naira, dates, case names, statute names, and Latin legal terms exactly as spoken.",
    LEGAL_STT_VOCABULARY_HINT,
    "PRODUCT NAMES (vocabulary hints — spell them EXACTLY): the assistant is \"ALOA\" (never \"Alleva\", \"Aloha\", \"Alleluia\"), the voice-capture tool is \"Vox\" (never \"Fox\", \"Box\", \"Vocks\"), plus \"PracticePro\", \"DraftPro\", \"Atrium\", \"Vega\".",
    "If the speaker uses Nigerian Pidgin, transcribe the Pidgin phrasing — do not translate.",
    "Never add content that was not spoken. If a passage is unintelligible, write [inaudible].",
    "Return ONLY the transcript text — no preamble, no commentary.",
    continuationTail
      ? `CONTEXT: This clip continues a recording. The previous clip ended with: "${continuationTail}". Do not repeat that text; continue from where it ends.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const SMART_CLEAN_SYSTEM_PROMPT = `You clean up dictated notes for a Nigerian legal practice management platform. You will receive a raw, word-for-word speech-to-text transcript. Return ONLY the cleaned text, nothing else.

RULES:
1. Remove filler words (um, uh, like, you know, I mean) and stutters (repeated words like "the the").
2. RESOLVE MID-SENTENCE SELF-CORRECTIONS AND BACKTRACKING: when the speaker pivots — "actually", "scratch that", "no, wait", "I mean", "make that", "sorry", "rather" — DISCARD the retracted phrase entirely and keep ONLY the final corrected intent. "Tuesday at 2 PM — actually scratch that, make it Wednesday at 4 PM" becomes just the Wednesday 4 PM plan; "bring the original C of O, no, certified copy" becomes "bring the certified copy of the C of O". Never let the abandoned version survive, and never mention the correction itself.
3. Add punctuation, capitalisation, and paragraph breaks based on natural pauses and topic shifts. Do not add headings the speaker did not say.
4. Preserve VERBATIM and never change: names, dates, times, amounts (₦ figures), addresses, phone numbers, case citations (e.g. [2023] NWLR (Pt 1291) 1; (2023) LPELR-58880(SC); FGN v. ABC Ltd (2020) LPELR-99999(CA)), statute names (Evidence Act 2011, CFRN 1999), Latin legal phrases (habeas corpus, inter alia, res judicata, ratio decidendi, locus standi), and Nigerian legal terminology (affidavit, tenancy, deed of assignment, governor's consent).
5. Fix ONLY obvious recognition mis-transcriptions of Nigerian legal/property terms ("affi davit" → "affidavit", "tenency" → "tenancy", "Barister" → "Barrister"). If unsure, leave the word as-is.
6. Preserve Nigerian English spellings (judgement, colour).
7. NIGERIAN CODE-SWITCHING: the speaker may drift between English and Pidgin ("make I follow up with registrar for Ikeja before court sit"). In this CLEANED tier, normalise casual Pidgin phrasing into crisp professional English ("Follow up with the Registrar at Ikeja before court sitting") while keeping every fact identical. The verbatim tier preserves the original phrasing separately — your job here is the professional rendering.
8. NEVER add, infer, or reorder factual content. When ambiguous, leave as-is.
9. If SPELLING HINTS are provided, spell those names/terms exactly as hinted.
10. Return ONLY the cleaned text.`;

function eventTypesLine(names: string[]): string {
  const safe = (names || []).filter(Boolean).slice(0, 12).join(", ");
  return safe || "Meeting, Hearing, Mention, Deadline, Consultation";
}

// ─── MULTI-SPEAKER DIARIZATION (owner spec 2026-11-20) ─────────────────────
// Conversation-mode recordings — client consultations, witness conferences,
// settlement meetings, court hearings — are transcribed as SPEAKER TURNS
// (speakerId + text per turn), then a finalize-time pass reconciles the
// per-segment labels into whole-capture speakers and pre-suggests legal
// roles from the matched Matter context + conversational cues.

/** The diarizing transcription prompt (per audio segment). */
export function buildDiarizationTranscriptionPrompt(continuationTail?: string): string {
  return [
    "You are a diarizing speech-to-text engine for a Nigerian legal practice: the audio may contain TWO OR MORE distinct voices (a lawyer and their client, opposing counsel, a witness, a judge).",
    "Split the audio into SPEAKER TURNS. Label each distinct voice with a short id: \"1\", \"2\", \"3\"… (local to THIS clip). Consecutive speech by the same voice is ONE turn.",
    "Transcribe each turn EXACTLY word for word — no cleaning, no summary, no fillers removed. Preserve Nigerian names, titles (Barrister, SAN, My Lord), amounts, dates and Pidgin phrasing exactly as spoken. Unintelligible passages: [inaudible].",
    LEGAL_STT_VOCABULARY_HINT,
    "PRODUCT NAMES (vocabulary hints — spell them EXACTLY): the assistant is \"ALOA\" (never \"Alleva\", \"Aloha\"), the voice-capture tool is \"Vox\" (never \"Fox\", \"Box\"), plus \"PracticePro\", \"DraftPro\", \"Atrium\", \"Vega\".",
    "If the clip contains only ONE voice, return a single turn with speaker \"1\".",
    "Respond with STRICT JSON only, no markdown fences:",
    '{"turns":[{"speaker":"1","text":"..."},{"speaker":"2","text":"..."}]}',
    continuationTail
      ? `CONTEXT: This clip continues a recording. The previous clip ended with: "${continuationTail}". Do not repeat that text; continue from where it ends.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Parse + sanitize the diarizing transcriber's JSON (exported for tests). */
export function parseSegmentTurns(raw: string): { speaker: string; text: string }[] | null {
  const parsed = parseModelJson<any>(raw);
  const turns = parsed?.turns;
  if (!Array.isArray(turns) || turns.length === 0) return null;
  const out: { speaker: string; text: string }[] = [];
  for (const t of turns) {
    const speaker = String(t?.speaker ?? "1").replace(/[^0-9A-Za-z]/g, "").slice(0, 4) || "1";
    const text = String(t?.text || "").trim();
    if (!text) continue;
    out.push({ speaker, text: text.slice(0, 8000) });
  }
  return out.length > 0 ? out : null;
}

/** The finalize-time reconcile + role-inference prompt (exported for tests). */
export function buildSpeakerReconcilePrompt(opts: {
  counselName: string | null;
  matter: {
    title: string;
    clientName: string | null;
    opposingCounsel: string | null;
    presidingJudge: string | null;
    parties: string[];
  } | null;
}): string {
  const matterCtx = opts.matter
    ? [
        `Matter: ${opts.matter.title}`,
        opts.matter.clientName ? `Client (likely a speaker): ${opts.matter.clientName}` : "",
        opts.matter.opposingCounsel ? `Opposing counsel: ${opts.matter.opposingCounsel}` : "",
        opts.matter.presidingJudge ? `Presiding judge: ${opts.matter.presidingJudge}` : "",
        opts.matter.parties.length ? `Parties: ${opts.matter.parties.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "(no matter matched — rely on conversational cues only)";
  return `You reconcile the speaker labels of a MULTI-SPEAKER recording made by a Nigerian lawyer and pre-suggest each speaker's legal role.

The recording was made by ${opts.counselName || "the lawyer"} (Counsel) — their device, their voice is one of the speakers.
MATCHED MATTER CONTEXT (use for identification where confident):
${matterCtx}

You receive turns labelled T1, T2, T3… in recording order. Each carries a LOCAL segment label (e.g. "seg3:1" = first voice in segment 3). The same physical voice may carry DIFFERENT local labels in different segments — your job is to unify them into whole-recording speakers S1, S2, S3…

CUES (in priority order):
- "My Lord", "Your Lordship", "the court", "Hon. Justice" — addressed TO the judge; the speaker using them is NOT the judge unless they are delivering a ruling.
- The person asking structured questions in a consultation/witness interview is usually Counsel; the person answering with personal facts is usually the Client or a Witness.
- Names spoken in the matter context (client, opposing counsel, judge) identify voices when the conversation itself uses the names.
- Voice/style continuity across segments: same speaker = same S-id.

RULES:
- Assign EVERY turn exactly one S-id. Merge voices that are clearly the same person split across segments.
- Suggest a role for each S-id: "counsel", "client", "opposing_counsel", "witness", "judge", "court_official", "other", or "unknown" — plus a display name ONLY when you are confident (the matter context name, or a name the recording itself uses). Otherwise name = null.
- ${opts.counselName || "Counsel"} is "counsel" — match their voice by style/role in the conversation.
- NEVER invent, merge or reword turn text. You may additionally return "turnClean": {"T1": "…"} — the same turn with ONLY filler words (um, uh, like, you know, stutters) and false starts removed; every name, number, date, amount and substantive word must be kept EXACTLY as spoken. When in doubt, omit a turn from turnClean and its verbatim text is kept.

Respond with STRICT JSON only, no markdown fences:
{"speakers":[{"id":"S1","role":"counsel","name":"${JSON.stringify(opts.counselName || "").replace(/^"|"$/g, "")}","confidence":0.0}],"assignment":{"T1":"S1","T2":"S2"},"turnClean":{"T1":"…"}}`;
}

/** Deterministic anti-hallucination guard for a model-proposed "cleaned"
 *  turn: the cleaned text must stay within 60–140% of the original length
 *  and share ≥ 60% of the original's significant words — anything else is
 *  rejected and the verbatim turn is kept (fillers beat fiction).
 *  (Exported for tests.) */
export function cleanedTurnAcceptable(original: string, cleaned: string): boolean {
  const o = (original || "").trim();
  const c = (cleaned || "").trim();
  if (!o || !c) return false;
  if (c.length < o.length * 0.6 || c.length > o.length * 1.4) return false;
  const norm = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s₦]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !["the", "and", "that", "this", "with", "have"].includes(w))
    );
  const origWords = norm(o);
  if (origWords.size === 0) return true; // nothing significant to protect
  let kept = 0;
  for (const w of norm(c)) if (origWords.has(w)) kept += 1;
  return kept / origWords.size >= 0.6;
}

/** Parse + apply the reconcile result over OUR turn texts (exported for
 *  tests). The model's returned text is NEVER trusted blindly — only a
 *  "turnClean" proposal that passes the cleanedTurnAcceptable guard may
 *  replace a turn's verbatim text (filler removal only, never rewording). */
export function parseReconcileResult(
  raw: string,
  flatTurns: { key: string; localLabel: string; text: string }[]
): {
  speakers: { id: string; role: string; name: string | null; confidence: number }[];
  turns: { speakerId: string; text: string }[];
} | null {
  const parsed = parseModelJson<any>(raw);
  const speakersRaw = parsed?.speakers;
  const assignment = parsed?.assignment;
  const turnClean = parsed?.turnClean && typeof parsed.turnClean === "object" ? parsed.turnClean : null;
  if (!Array.isArray(speakersRaw) || speakersRaw.length === 0 || !assignment || typeof assignment !== "object") {
    return null;
  }
  // Sanitize speakers.
  const speakers: { id: string; role: string; name: string | null; confidence: number }[] = [];
  const idSet = new Set<string>();
  for (const s of speakersRaw) {
    const id = String(s?.id || "").trim().slice(0, 8);
    if (!id || idSet.has(id)) continue;
    const role = String(s?.role || "unknown").toLowerCase().slice(0, 24);
    const name = s?.name == null ? null : String(s.name).trim().slice(0, 80) || null;
    const confidence = Math.max(0, Math.min(1, Number(s?.confidence) || 0));
    idSet.add(id);
    speakers.push({ id, role, name, confidence });
  }
  if (speakers.length === 0) return null;
  // Apply the assignment to OUR texts; unknown ids fall back to S?.
  // A guarded turnClean proposal (filler removal) may replace the text.
  const turns: { speakerId: string; text: string }[] = [];
  for (const t of flatTurns) {
    const assigned = String(assignment[t.key] || "").trim().slice(0, 8);
    const speakerId = idSet.has(assigned) ? assigned : speakers[0].id;
    let text = t.text;
    if (turnClean) {
      const proposal = turnClean[t.key];
      if (typeof proposal === "string" && cleanedTurnAcceptable(t.text, proposal)) {
        text = proposal.trim().slice(0, 8000);
      }
    }
    turns.push({ speakerId, text });
  }
  // Drop speakers that ended up with no turns.
  const used = new Set(turns.map((t) => t.speakerId));
  const finalSpeakers = speakers.filter((s) => used.has(s.id));
  if (finalSpeakers.length === 0) return null;
  return { speakers: finalSpeakers, turns };
}

/** Deterministic fallback when the reconcile pass is unavailable (no key /
 *  unparseable): keep every local label as its own speaker. The staging UI
 *  can still label + merge manually. (Exported for tests.) */
export function fallbackSpeakerTurns(
  segTurns: { index: number; turns: { speaker: string; text: string }[] }[]
): {
  speakers: { id: string; role: string; name: string | null; confidence: number }[];
  turns: { speakerId: string; text: string }[];
} {
  const speakers: { id: string; role: string; name: string | null; confidence: number }[] = [];
  const turns: { speakerId: string; text: string }[] = [];
  for (const seg of [...segTurns].sort((a, b) => a.index - b.index)) {
    for (const t of seg.turns || []) {
      const id = `V${seg.index}-${t.speaker}`;
      if (!speakers.some((s) => s.id === id)) {
        speakers.push({ id, role: "unknown", name: null, confidence: 0 });
      }
      turns.push({ speakerId: id, text: t.text });
    }
  }
  return { speakers, turns };
}

/** Flatten segment turns into the reconcile prompt's input format. */
export function flattenSegmentTurns(
  segTurns: { index: number; turns: { speaker: string; text: string }[] }[]
): { key: string; localLabel: string; text: string }[] {
  const out: { key: string; localLabel: string; text: string }[] = [];
  const ordered = [...segTurns].sort((a, b) => a.index - b.index);
  ordered.forEach((seg) => {
    (seg.turns || []).forEach((t, i) => {
      out.push({ key: `T${out.length + 1}`, localLabel: `seg${seg.index}:${t.speaker}`, text: t.text });
      void i;
    });
  });
  return out;
}

export function buildTriagePrompt(opts: {
  lagos: { dateISO: string; weekday: string; time: string };
  matters: { id: string; title?: string | null; suitNumber?: string | null }[];
  contacts: { id: string; name?: string | null }[];
  eventTypeNames: string[];
}): string {
  const matterList = (opts.matters || [])
    .slice(0, 60)
    .map((m) => `- ${m.title || "(untitled)"}${m.suitNumber ? ` [Suit: ${m.suitNumber}]` : ""} (id: ${m.id})`)
    .join("\n");
  const contactList = (opts.contacts || [])
    .slice(0, 60)
    .map((c) => `- ${c.name || "(unnamed)"} (id: ${c.id})`)
    .join("\n");
  return `You triage a quick voice note dictated by a Nigerian lawyer, and decide the single best next action for it.

TODAY (Lagos, UTC+01:00): ${opts.lagos.weekday}, ${opts.lagos.dateISO}, ${opts.lagos.time}.

THE FIRM'S MATTERS:
${matterList || "(none on record)"}

THE FIRM'S CONTACTS (clients etc.):
${contactList || "(none on record)"}

THE FIRM'S EVENT TYPES: ${eventTypesLine(opts.eventTypeNames)}

Decide:
- "intent": the single best action — "case_note" (it is a note about a matter/client), "schedule" (it is primarily about a date/deadline/court event), "question" (the lawyer is ASKING something), or "share" (none of the above — just capture text).
- "matterCandidates": every matter title or client name MENTIONED in the note (exact wording from the note; include near-matches even if unsure).
- "events": every date/time/deadline mentioned — each with "title" (short calendar title), "type" (one of: ${eventTypesLine(opts.eventTypeNames)}), "dateISO" (YYYY-MM-DD — resolve relative words like "tomorrow", "Friday", "next week" using TODAY above), "time" (HH:MM 24h, or empty), "location" (court/place if mentioned, else empty).
- "isQuestion": true only if the lawyer is asking for information.
- "questionText": the question in the lawyer's words (empty if not a question).
- "summary": one line (≤15 words) describing the note.

Respond with STRICT JSON only — no prose, no markdown fences:
{"intent":"case_note|schedule|question|share","matterCandidates":["..."],"events":[{"title":"...","type":"...","dateISO":"YYYY-MM-DD","time":"HH:MM","location":""}],"isQuestion":false,"questionText":"","summary":"..."}`;
}

// ─── INTELLIGENCE UPGRADE (owner spec, 2026-11-18) ─────────────────────────
//
// The old triage (buildTriagePrompt, kept above for reference/compat) picked
// ONE action per note and matched matters by exact-string containment. The
// upgraded ANALYSIS pass below behaves like a context-aware legal assistant:
//
//   1. LIVE CONTEXT — the exact current date/time (Africa/Lagos, WAT) and a
//      rich matters directory (client names + parties) go into every call,
//      so relative terms ("tomorrow", "next week", "Friday morning") and
//      informal references ("the Chukwu file") resolve against real data.
//   2. SEMANTIC MATCHING — the LLM SCORES and RANKS matter matches with
//      confidence + reason; rankAndValidateMatterMatches() validates the
//      ids against the firm's actual matters and merges a deterministic
//      containment backstop underneath.
//   3. RELATIVE DATES + IMPLIED TASKS — "I need to do a check tomorrow",
//      "follow up with registry" become diary events; unspoken clock times
//      default to 09:00 (marked timeEstimated so the UI flags them as
//      easily editable).
//   4. MULTI-INTENT — one note can be BOTH a case note AND a diary task:
//      the analysis returns every applicable item at once, and the triage
//      card offers a unified "Save Case Note & Add to Diary" CTA.
//   5. ENDORSEMENTS — dictated courtroom proceedings extract structured
//      endorsement fields.

/** A matters-directory row as the analysis prompt renders it. */
export interface AnalysisMatterRow {
  id: string;
  title?: string | null;
  suitNumber?: string | null;
  clientName?: string | null;
  parties?: string[];
  status?: string | null;
  court?: string | null;
}

/** A properties-directory row as the analysis prompt renders it. */
export interface AnalysisPropertyRow {
  id: string;
  address?: string | null;
  category?: string | null;
  propertyType?: string | null;
  status?: string | null;
  units: { id: string; label: string; tenantName?: string }[];
}

/** An open task/reminder row (tasks table ∪ Active events). */
export interface AnalysisOpenTaskRow {
  kind: "task" | "event";
  id: string;
  title?: string | null;
  status?: string | null;
  dueDate?: string | null;
  matterId?: string | null;
  matterTitle?: string | null;
}

/** The multi-intent analysis + formatting prompt (owner spec §1–§4 + the
 * 2026-11-19 Wispr-Flow upgrade: expanded workspace actions, backtracking,
 * register shifting, snippets, code-switching). Exported for tests. */
export function buildAnalysisPrompt(opts: {
  lagos: { dateISO: string; weekday: string; time: string };
  matters: AnalysisMatterRow[];
  contacts: { id: string; name?: string | null }[];
  eventTypeNames: string[];
  properties?: AnalysisPropertyRow[];
  openTasks?: AnalysisOpenTaskRow[];
  snippets?: { trigger: string; content: string }[];
  dictionaryTerms?: string[];
}): string {
  const dirLine = (m: AnalysisMatterRow) => {
    const bits: string[] = [m.title || "(untitled)"];
    if (m.suitNumber) bits.push(`suit ${m.suitNumber}`);
    if (m.clientName) bits.push(`client ${m.clientName}`);
    if (m.parties && m.parties.length) bits.push(`parties ${m.parties.join(" / ")}`);
    if (m.court) bits.push(`court ${m.court}`);
    return `- ${bits.join(" · ")} (id: ${m.id})`;
  };
  const matterDir = (opts.matters || [])
    .slice(0, 120)
    .map(dirLine)
    .join("\n");
  const contactList = (opts.contacts || [])
    .slice(0, 60)
    .map((c) => `- ${c.name || "(unnamed)"} (id: ${c.id})`)
    .join("\n");
  const propertyDir = (opts.properties || [])
    .slice(0, 60)
    .map((p) => {
      const units = (p.units || [])
        .slice(0, 20)
        .map((u) => `${u.label || "unit"}${u.tenantName ? ` (tenant ${u.tenantName})` : ""} [unitId: ${u.id}]`)
        .join(", ");
      return `- ${p.address || "(no address)"}${p.propertyType ? ` (${p.propertyType})` : ""}${units ? ` — units: ${units}` : ""} (propertyId: ${p.id})`;
    })
    .join("\n");
  const taskDir = (opts.openTasks || [])
    .slice(0, 80)
    .map(
      (t) =>
        `- [${t.kind}] ${t.title || "(untitled)"}${t.dueDate ? ` · due ${String(t.dueDate).slice(0, 10)}` : ""}${t.matterTitle ? ` · ${t.matterTitle}` : ""} (id: ${t.id})`
    )
    .join("\n");
  const snippetLines = (opts.snippets || [])
    .slice(0, 12)
    .map((s) => `- "${s.trigger}" → """${s.content.slice(0, 400)}"""`)
    .join("\n");
  const dictLine = (opts.dictionaryTerms || []).slice(0, 60).join(", ");
  const types = eventTypesLine(opts.eventTypeNames);
  return `You analyse a quick voice note dictated by a Nigerian lawyer and extract EVERYTHING actionable from it — one note can be several things at once. You ALSO format the note's text for each destination it may be saved to.

TODAY (Lagos, Nigeria — Africa/Lagos, WAT UTC+01:00): ${opts.lagos.weekday}, ${opts.lagos.dateISO}, ${opts.lagos.time}.
Resolve every relative date against that TODAY: "tomorrow" = ${addDaysISO(opts.lagos.dateISO, 1)}, "in 3 days" = ${addDaysISO(opts.lagos.dateISO, 3)}, "next week" = ${addDaysISO(opts.lagos.dateISO, 7)}.

THE FIRM'S MATTERS DIRECTORY (active matters first):
${matterDir || "(no matters on record)"}

THE FIRM'S CONTACTS (clients etc.):
${contactList || "(none on record)"}

THE FIRM'S PROPERTIES / ESTATES (for property & tenancy notes):
${propertyDir || "(no properties on record)"}

OPEN TASKS & REMINDERS (the lawyer may report one of these DONE — match, do not duplicate):
${taskDir || "(no open tasks)"}

THE FIRM'S EVENT TYPES: ${types}
${dictLine ? `\nSPELLING HINTS — spell these names/terms exactly as written when they appear: ${dictLine}` : ""}${snippetLines ? `\nSPOKEN SNIPPETS — if the speaker says a trigger phrase, replace it with its text in formatted outputs:\n${snippetLines}` : ""}

EXTRACT — all that apply:
1. "mode": FIRST — BEFORE extracting anything else, classify the note's READ vs WRITE intent:
     - "query_only": any question or lookup ("What's my schedule today?", "Do I have anything tomorrow?", "Show my tasks for Friday", "When is the Sino Truck matter coming up?"). RULE: when mode is "query_only", "events" MUST be [], "isDiaryTask" false, "endorsement" null, and every write proposal ("newMatter", "contactUpsert", "propertyNote", "draftBlueprint", "financialEntry", "taskUpdates") null/[] — NEVER create or propose a calendar entry, task or note from a pure lookup question.
     - "mutation_action": an imperative or logging statement ("Remind me to…", "Schedule…", "Add a task…", "Log an expense…", a dictated court endorsement).
     - "hybrid": ONLY when the user explicitly combines a lookup AND a write command ("What's my schedule tomorrow, and add a review task at 4 PM?"). Extract ONLY the explicit write clause as events/proposals — the question clause is answered ("questionText"), never extracted.
     A standalone date/time word ("today", "tomorrow", "next week") is NEVER by itself evidence to create anything.
2. "summary": one line (≤15 words) describing the note.
3. "intent": the PRIMARY purpose — "case_note", "schedule", "question", or "share". A note about a matter that ALSO contains dates is still "case_note" (the events ride along). A NEW client instruction with no matching matter is "case_note" with a "newMatter" proposal. A note with NO matter relevance (chambers admin) is "schedule" or "share" with events and NO matter. When "mode" is "query_only", "intent" MUST be "question".
4. "matterMatches": rank the firm's matters this note is about — SEMANTIC fuzzy matching, not exact strings. Match client names, party names, suit numbers, and INFORMAL references ("the Chukwu file" → the matter with party Chukwu; "the Lekki land case" → the land matter in Lekki). Return the top 3 max, each {"matterId": <exact id from the directory>, "confidence": 0.0-1.0, "reason": "<why, ≤12 words>"}. Only include matches with confidence ≥ 0.3. If no existing matter is being discussed, return [].
5. "matterCandidates": the EXACT word(s) the speaker used to refer to the matter/client (verbatim from the note; may be informal).
6. "events": EVERY date, deadline, court event, or implied follow-up task — including ones without an explicit date word ("follow up with registry" is a task) and STANDALONE chambers/admin tasks with no matter. ONLY valid when "mode" is "mutation_action" or "hybrid" AND each event carries an actionable subject — NEVER create an event from a pure lookup question, and NEVER from a bare date mention. Each: {"title": "<short calendar title>", "type": "<one of: ${types}>", "dateISO": "YYYY-MM-DD resolved from TODAY (empty string if truly no date was spoken)", "time": "HH:MM 24h", "timeEstimated": true|false, "location": "<court/place if mentioned, else empty>", "note": "<CONCISE ACTION SUMMARY for this diary entry's Notes field — what the lawyer must DO, stripped of meta-speech; 1-2 sentences; if THIS entry involves multiple distinct checks/tasks, format them as '- ' bullet lines>"}. TIME RULES: if a specific clock time was spoken use it (timeEstimated false); if only a part of day was spoken use 09:00 for morning, 14:00 for afternoon, 17:00 for evening; if NO time was spoken use 09:00 — in all default cases set timeEstimated true.
7. "isDiaryTask": true if the note contains any task, follow-up, check, or deadline the lawyer must act on (with or without a date).
8. "endorsement": if courtroom proceedings were dictated (court session, orders, adjournment), extract {"court": "", "suitNumber": "", "parties": "", "judge": "", "orders": ["<each order/holding, one line>"], "nextAdjournedDate": "YYYY-MM-DD or empty", "nextAdjournedTime": "HH:MM or empty"}; otherwise null.
9. "isQuestion": true only if the lawyer is ASKING for information; "questionText": the question in their words.
10. "caseNoteText": the note body formatted for saving as a CASE NOTE (see FORMATTING RULES below).
11. "clientUpdateText": if the note is clearly meant to be communicated to a client ("tell the client…", "update Mrs Tunde that…") OR reads like a client update, draft a warm, clear, plain-English message a lawyer could send as-is (no legalese clutter, no meta-speech); otherwise empty string.
12. "newMatter": propose a NEW matter ONLY when the note is a genuinely NEW instruction/client that matches NO existing matter with confidence ≥ 0.5: {"title": "<Formal matter title, e.g. 'Mrs. Tunde Adeyemi — Lekki Phase 1 Commercial Lease Renewal'>", "clientName": "", "opposingParty": "", "practiceArea": "<e.g. Commercial Lease, Debt Recovery, Land Dispute>", "summaryNote": "<clean intake bullets: parties, property/subject, key figures, instructions>"}. When an existing matter clearly matches, return null.
13. "contactUpsert": when the note introduces or updates a CONTACT: {"contactId": "<exact id from the contacts directory when this is an UPDATE, else empty>", "name": "", "phone": "", "email": "", "company": "", "role": "", "notes": "<what they want / context>"}; otherwise null.
14. "propertyNote": when the note is about a PROPERTY/UNIT in the directory (estate, block, flat, tenant issue) rather than a litigation matter: {"propertyId": "<exact id>", "unitId": "<exact unitId if a specific flat/block was named, else empty>", "note": "<clean formatted note for the property/unit record>", "followUp": "<optional follow-up summary, else empty>"}; otherwise null.
15. "draftBlueprint": when the lawyer asks to DRAFT/PREPARE a legal or property document, extract a STRUCTURED DRAFTING BLUEPRINT (the app assembles the document itself — you do NOT write the document): {"documents": ["<document type — use the snake_case registry value when known, else the spoken name: motion_on_notice, supporting_affidavit, written_address, statement_of_claim, statement_of_defence, notice_to_quit, seven_days_notice_of_intention, writ_of_summons, originating_summons, formal_demand_letter, tenancy_or_lease_agreement, deed_of_assignment, notice_of_appeal, appellants_brief, garnishee_application, writ_of_fi_fa, witness_statement_on_oath, power_of_attorney …>"], "reliefs": ["<each discrete prayer/relief the lawyer dictated, cleaned — plain professional wording, NO legalese rewriting, NO meta-speech>"], "groundsOrFacts": ["<each discrete fact or ground, in the order spoken, cleaned>"], "amounts": [{"label": "", "amount": <plain number in NAIRA>, "currency": "NGN"}], "periods": [{"label": "<what the period is for>", "value": <number>, "unit": "days|weeks|months|years"}], "dates": [{"label": "", "iso": "YYYY-MM-DD resolved from TODAY"}], "namedPeople": [{"name": "", "role": "<deponent / witness / landlord / tenant / counterparty …>"}], "specialInstructions": ["<any other drafting instruction, cleaned>"]}. CLEANING RULES: strip filler and meta-speech ("draft me a", "make it", "I want to", "um"); resolve self-corrections to the corrected value ONLY ("ten days, no, fourteen days" → fourteen days); do NOT invent facts, amounts, dates, reliefs or parties not spoken; do NOT rewrite reliefs into legalese — that happens at assembly. If the note is NOT a drafting instruction, return null.
16. "financialEntry": when the note logs money spent or earned: {"type": "expense"|"fee", "amount": <plain number in NAIRA, e.g. "4.5 million naira" → 4500000, "14,500" → 14500>, "currency": "NGN", "description": "<clean description>", "matterId": "<exact id when a matter was named>"}; otherwise null.
17. "taskUpdates": when the lawyer reports an OPEN TASK/REMINDER as done or changed: [{"kind": "task"|"event", "itemId": "<exact id from OPEN TASKS & REMINDERS>", "status": "Completed"|"In Progress"|"Blocked", "note": "<clean one-line outcome>"}]; otherwise [].

FORMATTING RULES — strip meta-speech and adapt the format to the destination (the raw transcript is kept separately; your output is the CLEAN saved text):
- STRIP all conversational scaffolding and meta-instructions: "From voice note…", "I want to capture a quick note…", "I'm trying to set a reminder for…", "Note to self…", hesitations, stumbles. The saved text must read as clean, direct, professional dictation — as if the lawyer had written it themselves.
- BACKTRACKING: when the speaker pivots ("actually", "scratch that", "no, wait", "I mean", "make that"), discard the retracted phrase COMPLETELY — keep only the final corrected intent. "Tuesday at 2 PM — actually scratch that, Wednesday at 4 PM, and tell them to bring the original C of O, no, certified copy" → event on Wednesday at 16:00 + note "Client to bring certified copy of the Certificate of Occupancy." Never surface the abandoned version.
- ORDERED MAPPINGS: when the dictation links a list of people/things to a list of values by order ("respectively", "in that order", or plain parallel listing), bind them POSITIONALLY and keep the binding explicit in the note text — "Three children: Tunde (male, 12), Bola (male, 9), Ada (female, 6)." NEVER merge the two lists ambiguously and NEVER drop ages, genders, counts or amounts. Copy numbers EXACTLY as spoken; if one half of the mapping is missing, say "age not stated" rather than guessing.
- INSTRUCTIONS ARE NEVER DROPPED: a client instruction the lawyer relays ("client wants to file a divorce petition", "she instructed me to write the bank") is a FIRST-CLASS fact of the note — it must appear in the caseNoteText (and the summary when it is the note's point), and imply its Action/diary follow-up. Never reduce an explicit instruction to a vague "wants assistance".
- CODE-SWITCHING: normalise casual Nigerian Pidgin phrasing into crisp professional English in formatted outputs ("make I follow up with registrar for Ikeja before court sit" → "Follow up with the Registrar at Ikeja High Court before court sitting") while keeping every fact identical. Names of people, places and courts must be spelled correctly (Ikeja High Court, not "Ikeja High Cot").
- REGISTER SHIFTING by destination: COURT ENDORSEMENTS strict formal Nigerian legal register (the structured fields); CLIENT UPDATES warm, clear, plain English without legalese clutter; DIARY/CALENDAR entries ultra-concise actionable summaries (1 line or tight bullets) with zero conversational filler; CASE/ATTENDANCE NOTES clean paragraphs for narrative, switching to '- ' bullets when the dictation contains 3+ distinct action items, findings, documents or multi-part steps.
- DIARY EVENT NOTE (each event's "note"): a CONCISE ACTION SUMMARY, never the whole transcript — e.g. "Visit the court registry to confirm the next adjourned date on the Sino Truck file." Bullets only when that one entry carries several distinct checks.
- ENDORSEMENT: when courtroom proceedings were dictated, fill the structured "endorsement" fields faithfully (Matter/Suit No, Coram, Parties, Proceedings/Orders, Next Adjourned Date) — the app renders the formal block itself.
- SNIPPETS: expand any spoken snippet trigger into its full text inside caseNoteText/draft briefs (never inside verbatim-style fields).
- FINANCIAL AMOUNTS: parse spoken amounts into plain naira numbers ("18 million naira" → 18000000; "₦4.5 million" → 4500000; "14,500 naira" → 14500).

RULES: never invent matters, dates, or details absent from the note; every id must be copied EXACTLY from its directory; never split one continuous note into more events than were actually dictated; newMatter and a high-confidence matterMatches must not both be returned. A calendar/task extraction is ONLY valid when there is BOTH an actionable subject/task AND a clear intent to record or schedule it — a standalone date/time token ("today", "tomorrow", "next week") is NEVER sufficient evidence on its own. Classify "mode" FIRST and let it gate every write extraction (query_only → no events, no proposals, ever).

Respond with STRICT JSON only — no prose, no markdown fences:
{"mode":"query_only|mutation_action|hybrid","summary":"...","intent":"case_note|schedule|question|share","matterMatches":[{"matterId":"...","confidence":0.0,"reason":"..."}],"matterCandidates":["..."],"events":[{"title":"...","type":"...","dateISO":"YYYY-MM-DD","time":"HH:MM","timeEstimated":true,"location":"","note":"..."}],"isDiaryTask":false,"endorsement":null,"isQuestion":false,"questionText":"","caseNoteText":"...","clientUpdateText":"","newMatter":null,"contactUpsert":null,"propertyNote":null,"draftBlueprint":null,"financialEntry":null,"taskUpdates":[]}`;
}

/** Date arithmetic on YYYY-MM-DD strings (UTC-safe, exported for tests). */
export function addDaysISO(dateISO: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO || "");
  if (!m) return dateISO;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface MatterMatch {
  matterId: string;
  confidence: number;
  reason?: string;
}

/**
 * rankAndValidateMatterMatches — merge the LLM's semantic matches with the
 * deterministic containment backstop (matchMatterCandidates), validated
 * against the firm's real matters. Exported pure for tests.
 *
 *   - LLM matches with an id NOT in the firm's matters are dropped (the
 *     model must never conjure ids).
 *   - Deterministic hits not already in the LLM's list are appended with a
 *     modest backstop confidence (0.5) — the LLM ranking always wins when
 *     both agree.
 *   - Result: ranked (confidence desc), de-duplicated, capped at 3 —
 *     exactly the disambiguation pills the triage card shows.
 */
export function rankAndValidateMatterMatches(
  llmMatches: any[],
  matters: AnalysisMatterRow[],
  candidates: string[],
  contacts: { id: string; name?: string | null }[]
): MatterMatch[] {
  const validIds = new Set((matters || []).map((m) => m.id));
  const out: MatterMatch[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(llmMatches) ? llmMatches : []) {
    const id = String(raw?.matterId ?? raw?.id ?? "");
    const conf = Number(raw?.confidence);
    if (!id || !validIds.has(id) || seen.has(id)) continue;
    if (!isFinite(conf) || conf < 0.05) continue;
    seen.add(id);
    out.push({ matterId: id, confidence: Math.min(1, Math.max(0, conf)), reason: raw?.reason || undefined });
  }
  const backstop = matchMatterCandidates(candidates || [], matters as any, contacts);
  for (const id of backstop.matchedMatterIds) {
    if (seen.has(id) || !validIds.has(id)) continue;
    seen.add(id);
    out.push({ matterId: id, confidence: 0.5, reason: "name mentioned in the note" });
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

/** A validated Quick Ask action ready to execute (owner spec §5). */
export interface QuickAskAction {
  type: "create_event" | "save_note";
  title: string;
  content?: string;
  type2?: string; // event type (Deadline, Hearing…) — named type2 to avoid
  //                  colliding with the discriminating `type` field.
  dateISO?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  matterId?: string;
  location?: string;
  /** Concise action summary for the diary entry's Notes field (owner spec
   *  2026-11-19 — never the raw instruction/meta-speech). */
  note?: string;
}

/**
 * enforceIntentGate — the deterministic READ vs WRITE gate applied AFTER the
 * LLM analysis, BEFORE anything is staged on the triage card (owner bug
 * report 2026-11-19: asking "What's my schedule today?" detected the date
 * keyword "today" and mistakenly created a calendar entry for today).
 *
 * Two layers meet here: the LLM's own "mode" verdict and the deterministic
 * classifier (classifyIntentMode) run over the raw source text. The merged
 * verdict (resolveIntentMode) then HARD-GATES the parsed payload:
 *
 *   - query_only → events [], isDiaryTask false, endorsement null, every
 *     write proposal (newMatter / contactUpsert / propertyNote /
 *     draftBlueprint / financialEntry / taskUpdates) nulled, caseNoteText /
 *     clientUpdateText emptied, intent forced to "question". Read-only
 *     outputs (summary, matterMatches, matterCandidates, questionText)
 *     survive — they only inform the answer UI.
 *   - mutation_action / hybrid → the per-event DATE-KEYWORD GUARDRAIL still
 *     applies: any proposed event whose title carries no actionable subject
 *     (nothing but date words + generic containers, e.g. "My schedule
 *     today") is dropped. For hybrid inputs only the explicit write clause
 *     should ever have been extracted; the guardrail catches the rest.
 *
 * Pure and exported — the exact code path finalizeCapture runs is directly
 * unit-tested (tests/unit/voiceCapture.test.ts).
 */
export function enforceIntentGate(
  parsed: any,
  sourceText: string
): { mode: IntentMode; parsed: any } {
  const mode = resolveIntentMode(classifyIntentMode(sourceText), parsed?.mode);
  const filterEvents = (events: any): any[] =>
    (Array.isArray(events) ? events : []).filter((e: any) =>
      eventHasActionableSubject(String(e?.title || ""))
    );
  if (mode === "query_only") {
    return {
      mode,
      parsed: {
        ...parsed,
        mode,
        intent: "question",
        isQuestion: true,
        events: [],
        isDiaryTask: false,
        endorsement: null,
        newMatter: null,
        contactUpsert: null,
        propertyNote: null,
        draftBlueprint: null,
        financialEntry: null,
        taskUpdates: [],
        caseNoteText: "",
        clientUpdateText: "",
      },
    };
  }
  return {
    mode,
    parsed: { ...parsed, mode, events: filterEvents(parsed?.events) },
  };
}

/**
 * validateQuickAskActions — sanitise the LLM's proposed tool actions against
 * the firm's data before executing anything. Exported pure for tests.
 *
 *   - unknown action types are dropped (never executed)
 *   - create_event requires a title + a valid YYYY-MM-DD date (relative
 *     words are already resolved by the prompt, but a non-date string still
 *     cannot pass)
 *   - create_event ALSO requires an actionable subject (date-keyword
 *     guardrail, owner bug report 2026-11-19: "My schedule today"-style
 *     titles are dropped — a lookup question never becomes an entry)
 *   - save_note requires a title + content
 *   - matterId must exist in the firm's matters (when supplied)
 *   - capped at 3 actions per call
 */
export function validateQuickAskActions(
  rawActions: any[],
  matters: AnalysisMatterRow[],
  maxActions = 3
): QuickAskAction[] {
  const validIds = new Set((matters || []).map((m) => m.id));
  const out: QuickAskAction[] = [];
  for (const raw of Array.isArray(rawActions) ? rawActions : []) {
    if (!raw || typeof raw !== "object") continue;
    const type = String(raw.type || "");
    if (type !== "create_event" && type !== "save_note") continue;
    const title = String(raw.title || "").trim().slice(0, 160);
    if (!title) continue;
    const matterId = raw.matterId ? String(raw.matterId) : undefined;
    if (matterId && !validIds.has(matterId)) continue;
    if (type === "create_event") {
      const dateISO = String(raw.dateISO || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) continue;
      // Date-keyword guardrail: a title with no actionable subject ("My
      // schedule today", "Hearings this week") is a lookup restatement,
      // not a task — never let it become a diary entry.
      if (!eventHasActionableSubject(title)) continue;
      const time = /^\d{2}:\d{2}$/.test(String(raw.time || "")) ? String(raw.time) : "09:00";
      out.push({
        type,
        title,
        type2: String(raw.eventType || raw.type2 || "").trim() || undefined,
        dateISO,
        time,
        matterId,
        location: String(raw.location || "").trim() || undefined,
        // Concise action summary (sanitised) for the Notes field.
        note: String(raw.note || "").trim().slice(0, 600) || undefined,
      });
    } else {
      const content = String(raw.content || "").trim().slice(0, 20_000);
      if (!content) continue;
      out.push({ type, title, content, matterId });
    }
    if (out.length >= maxActions) break;
  }
  return out;
}

/** A validated New-Matter proposal. */
export interface NewMatterProposal {
  title: string;
  clientName: string;
  opposingParty: string;
  practiceArea: string;
  summaryNote: string;
}

/** A validated contact create/update proposal. */
export interface ContactUpsertProposal {
  contactId: string; // "" → create new
  name: string;
  phone: string;
  email: string;
  company: string;
  role: string;
  notes: string;
}

/** A validated property/unit note proposal. */
export interface PropertyNoteProposal {
  propertyId: string;
  unitId: string;
  note: string;
  followUp: string;
}

/** A validated DRAFTING BLUEPRINT (owner spec 2026-11-19, §4 Phase 2 —
 *  replaces the old free-text DraftKickoffProposal): documents resolved
 *  through the deterministic alias map, dictated content cleaned and
 *  self-corrections resolved, the 0.85 matter gate applied. The full type
 *  lives in src/legal/drafting/types.ts (single source of truth). */
export type { DraftBlueprint };

/** The focused retry prompt for a schema-invalid blueprint (spec §4.1:
 *  reject → retry ONCE → safe fallback). Exported for unit tests. */
export const BLUEPRINT_RETRY_SYSTEM_PROMPT = `You extract a STRUCTURED DRAFTING BLUEPRINT from a Nigerian lawyer's dictated note. The app assembles the document deterministically — you never write the document itself.

Return STRICT JSON only, exactly this shape:
{"documents":["motion_on_notice"],"reliefs":["..."],"groundsOrFacts":["..."],"amounts":[{"label":"","amount":0,"currency":"NGN"}],"periods":[{"label":"","value":0,"unit":"days"}],"dates":[{"label":"","iso":"YYYY-MM-DD"}],"namedPeople":[{"name":"","role":""}],"specialInstructions":["..."]}

- "documents": snake_case registry values when you know them (motion_on_notice, supporting_affidavit, written_address, statement_of_claim, notice_to_quit, formal_demand_letter, tenancy_or_lease_agreement …), else the spoken name verbatim.
- Clean each item: strip meta-speech ("draft me a", "I want to"); resolve self-corrections to the corrected value ONLY; never invent facts, amounts, dates, reliefs or parties.
- Use an EMPTY array for any category the note does not contain. Never leave keys out.`;

/** A validated expense/fee log proposal. */
export interface FinancialEntryProposal {
  type: "expense" | "fee";
  amount: number;
  currency: string;
  description: string;
  matterId: string; // "" → unlinked
}

/** A validated status update on an open task/reminder. */
export interface TaskUpdateProposal {
  kind: "task" | "event";
  itemId: string;
  status: string;
  note: string;
}

export interface WorkspaceProposals {
  newMatter: NewMatterProposal | null;
  contactUpsert: ContactUpsertProposal | null;
  propertyNote: PropertyNoteProposal | null;
  /** Voice → DraftPro blueprint (owner spec 2026-11-19): replaces the old
   *  free-text draftKickoff. Validated by validateDraftBlueprint —
   *  documents resolved via the deterministic alias map, dictated content
   *  cleaned, the 0.85 matter gate applied (never auto-linked below 0.85). */
  draftBlueprint: DraftBlueprint | null;
  financialEntry: FinancialEntryProposal | null;
  taskUpdates: TaskUpdateProposal[];
  clientUpdateText: string;
}

/**
 * validateWorkspaceProposals — sanitise the LLM's workspace proposals
 * against the firm's real records before anything reaches the triage card
 * (owner spec 2026-11-19, Part 1). Deterministic guards:
 *   - newMatter is dropped when an existing matter already matched with
 *     high confidence (≥ 0.75) — never propose a duplicate file;
 *   - contactId / propertyId / task itemId must exist in their directory
 *     (the model must never conjure ids);
 *   - financial amounts must be finite, positive and sane (≤ ₦1 trillion);
 *   - everything string-shaped is trimmed and capped;
 *   - taskUpdates statuses are normalised to the app's vocabulary.
 * Exported pure for tests.
 */
export function validateWorkspaceProposals(
  parsed: any,
  ctx: {
    matters: AnalysisMatterRow[];
    contacts: { id: string; name?: string | null }[];
    properties: AnalysisPropertyRow[];
    openTasks: AnalysisOpenTaskRow[];
    bestMatterConfidence: number;
    /** Voice → DraftPro pipeline (owner spec §4): the verbatim transcript
     *  (audit trail on the blueprint) and the ranked matter matches with
     *  labels (the 0.85 auto-link gate + alternatives). */
    rawTranscript?: string;
    matterMatches?: Array<{ matterId: string; confidence: number; label?: string }>;
  }
): WorkspaceProposals {
  const s = (x: any, cap = 400): string =>
    String(x ?? "").trim().slice(0, cap);

  // ── New matter ──────────────────────────────────────────────────────────
  let newMatter: NewMatterProposal | null = null;
  const rawMatter = parsed?.newMatter;
  if (rawMatter && typeof rawMatter === "object") {
    const title = s(rawMatter.title, 200);
    if (title && ctx.bestMatterConfidence < 0.75) {
      newMatter = {
        title,
        clientName: s(rawMatter.clientName, 160),
        opposingParty: s(rawMatter.opposingParty, 160),
        practiceArea: s(rawMatter.practiceArea, 120),
        summaryNote: s(rawMatter.summaryNote, 4000),
      };
    }
  }

  // ── Contact upsert ──────────────────────────────────────────────────────
  let contactUpsert: ContactUpsertProposal | null = null;
  const rawContact = parsed?.contactUpsert;
  if (rawContact && typeof rawContact === "object") {
    const name = s(rawContact.name, 160);
    const contactId = s(rawContact.contactId, 64);
    const validContact =
      !contactId || ctx.contacts.some((c) => c.id === contactId);
    if (name && validContact && (contactId || s(rawContact.phone) || s(rawContact.email) || s(rawContact.company) || s(rawContact.notes))) {
      contactUpsert = {
        contactId,
        name,
        phone: s(rawContact.phone, 60),
        email: s(rawContact.email, 160),
        company: s(rawContact.company, 160),
        role: s(rawContact.role, 120),
        notes: s(rawContact.notes, 2000),
      };
    }
  }

  // ── Property / unit note ────────────────────────────────────────────────
  let propertyNote: PropertyNoteProposal | null = null;
  const rawProperty = parsed?.propertyNote;
  if (rawProperty && typeof rawProperty === "object") {
    const propertyId = s(rawProperty.propertyId, 64);
    const prop = ctx.properties.find((p) => p.id === propertyId);
    const note = s(rawProperty.note, 4000);
    if (prop && note) {
      const unitId = s(rawProperty.unitId, 64);
      propertyNote = {
        propertyId,
        unitId:
          unitId && (prop.units || []).some((u) => u.id === unitId) ? unitId : "",
        note,
        followUp: s(rawProperty.followUp, 600),
      };
    }
  }

  // ── Drafting blueprint (owner spec 2026-11-19, §4 Phase 2) ──────────
  // Schema validation, alias-first document resolution, dictated cleaning
  // and the 0.85 matter gate all happen in validateDraftBlueprint (pure,
  // unit-tested in tests/unit/drafting/). A blueprint the model did not
  // emit (null) — or one that fails validation with nothing to salvage —
  // stays null here; the finalize action drives the retry/fallback flow.
  let draftBlueprint: DraftBlueprint | null = null;
  if (parsed?.draftBlueprint != null) {
    const validation = validateDraftBlueprint(parsed.draftBlueprint, {
      rawTranscript: ctx.rawTranscript || "",
      matches: (ctx.matterMatches || []).map((m: any) => ({
        matterId: m.matterId,
        confidence: m.confidence,
        label: m.label || m.matterId,
      })),
    });
    if (validation.ok && blueprintIsSubstantive(validation.value)) {
      draftBlueprint = validation.value;
    }
  }

  // ── Financial entry ─────────────────────────────────────────────────────
  let financialEntry: FinancialEntryProposal | null = null;
  const rawFin = parsed?.financialEntry;
  if (rawFin && typeof rawFin === "object") {
    const amount = Number(rawFin.amount);
    if (isFinite(amount) && amount > 0 && amount <= 1e12) {
      const matterId = s(rawFin.matterId, 64);
      financialEntry = {
        type: String(rawFin.type).toLowerCase() === "fee" ? "fee" : "expense",
        amount: Math.round(amount),
        currency: (s(rawFin.currency, 8) || "NGN").toUpperCase(),
        description: s(rawFin.description, 1000) || "Voice-logged entry",
        matterId:
          matterId && ctx.matters.some((m) => m.id === matterId) ? matterId : "",
      };
    }
  }

  // ── Task / reminder status updates ──────────────────────────────────────
  const taskUpdates: TaskUpdateProposal[] = [];
  for (const raw of Array.isArray(parsed?.taskUpdates) ? parsed.taskUpdates : []) {
    const kind = String(raw?.kind || "") === "event" ? "event" : "task";
    const itemId = s(raw?.itemId, 64);
    const exists = ctx.openTasks.some((t) => t.kind === kind && t.id === itemId);
    if (!exists) continue;
    const requested = String(raw?.status || "").toLowerCase();
    const status =
      ["completed", "done", "finished"].includes(requested)
        ? "Completed"
        : requested.includes("progress")
          ? "In Progress"
          : requested.includes("block")
            ? "Blocked"
            : "Completed";
    taskUpdates.push({ kind, itemId, status, note: s(raw?.note, 600) });
    if (taskUpdates.length >= 5) break;
  }

  return {
    newMatter,
    contactUpsert,
    propertyNote,
    draftBlueprint,
    financialEntry,
    taskUpdates,
    clientUpdateText: s(parsed?.clientUpdateText, 4000),
  };
}

export function buildMergePrompt(): string {
  return `You merge two records of the same client consultation / interview session for a Nigerian legal practice:

RECORD A — the lawyer's typed shorthand notes (brief bullet points written while listening; terse, sometimes incomplete).
RECORD B — the word-for-word verbatim transcript of everything that was said (may contain fillers and digressions).

Produce a STRUCTURED SUMMARY that weaves the two together:
1. "Session Overview" — 2-3 sentences: who, what, purpose.
2. "Key Facts" — bullet points of the material facts. Prefer the lawyer's shorthand phrasing as headings; fill in the detail from the verbatim record.
3. "Client Instructions / Requests" — what the client asked for.
4. "Action Items" — concrete next steps, each on its own line.
5. "Discrepancies" — anything the shorthand asserts that the verbatim record contradicts (or vice versa). If none, write "None noted."

SECTION RULES (each section must be COMPLETE before you move on):
- "Key Facts" must capture EVERY material fact from BOTH records: parties and their details, children/family members (with gender and age where stated), relationships, addresses, property descriptions, dates, durations, amounts (₦), documents mentioned, and any stated history of the matter. Nothing material from either record may be silently dropped.
- ORDERED MAPPINGS: when a list is linked to another list by order ("respectively", "in that order", or plain parallel listing), bind the items POSITIONALLY and spell the binding out. "Three children — Tunde, Bola and Ada — aged 12, 9 and 6 respectively" is a Key Fact line "Three children: Tunde (male, 12), Bola (male, 9), Ada (female, 6)." NEVER merge two ordered lists into one ambiguous string, and NEVER drop the ages, genders or order. If the records give an ordered list WITHOUT the paired values (or vice versa), state exactly what was given and mark the missing half "age not stated" rather than guessing.
- "Client Instructions / Requests" must list EVERY instruction, want and request the client expressed — however phrased ("she wants to file for divorce", "he asked us to draft...", "they want us to write the bank"). Express instructions like filing a petition, drafting a document, writing a letter or commencing an action are ALWAYS instructions. Never leave this section empty or vague when the client expressed any want, need or instruction anywhere in either record; quote the operative verb accurately ("file a petition for divorce", not just "wants help").
- "Action Items" must NEVER be empty when the session produced instructions, follow-ups, undertakings, deadlines or next steps. Every instruction the client gave implies an action item implementing it (e.g. "Prepare and file the divorce petition"), every undertaking by the lawyer ("I will write to...") is one, every document either party promised to bring/obtain is one, and every procedural step discussed (registry, service, filing, court date) is one. Phrase each as a concrete imperative the lawyer can act on tomorrow.
- "Discrepancies" must actively CROSS-CHECK the two records: counts (three children vs two), ages and their order, names/spellings, dates, amounts (₦) and addresses. Also flag within-record inconsistencies the client themselves corrected or contradicted. "None noted." only when you have actually compared these dimensions and found nothing.

RULES:
- Never invent facts absent from both records. In particular: never invent or interpolate ages, dates, amounts, counts or document names — copy them EXACTLY as they appear, and when a value was corrected mid-speech use the corrected value.
- Names, dates, amounts (₦), case citations, and legal terminology must be copied EXACTLY as they appear in the records.
- Where the shorthand and the verbatim conflict, surface it under Discrepancies rather than silently choosing one.
- Write in clean professional English; preserve Nigerian Pidgin quotes verbatim inside quotation marks if quoting the client.
- Return ONLY the structured summary text (with the five numbered section headings above).`;
}

// ─── Key resolution & provider layer ───────────────────────────────────────

type GeminiKey = { key: string } | null;

export async function resolveGeminiKey(
  ctx: any,
  user: any,
  callerKey?: string | null
): Promise<GeminiKey> {
  // 2026-11-18: ONE key policy for every voice surface, mirroring the CLIENT
  // resolver (src/services/aiProvider.ts resolveProvider) so Quick Capture
  // spends the SAME key text ALOA already uses:
  //   1. the caller's OWN key (BYO — the client passes the user's key),
  //   2. the caller's FIRM key — applied whenever the firm hasn't FULLY
  //      configured a direct openai-compatible endpoint (key + baseUrl).
  //      The old `aiProvider === "gemini"` gate skipped firms that had a
  //      stored key but no explicit provider selection, silently dropping
  //      them onto the platform env key — the exact "the firm's key doesn't
  //      apply to Quick Capture" asymmetry the founder reported.
  //   3. the platform env key (operator rotates it; see
  //      GEMINI_KEY_ROTATION_RUNBOOK).
  const own = (callerKey || "").trim();
  if (own) return { key: own };

  let apiKey: string | null = null;
  if (user?.firmId) {
    try {
      const firmAi: any = await ctx.runQuery(
        internal.ai.getFirmAiSettingsInternal,
        { firmId: String(user.firmId) }
      );
      const openaiFullyConfigured =
        firmAi?.aiProvider === "openai-compatible" &&
        !!(firmAi?.openaiBaseUrl || "").trim();
      if (!openaiFullyConfigured && firmAi?.firmGeminiApiKey) {
        apiKey = String(firmAi.firmGeminiApiKey);
      }
    } catch { /* best-effort; env fallback below */ }
  }
  if (!apiKey) apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_DEMO_KEY || null;
  return apiKey ? { key: apiKey } : null;
}

/** OpenAI Whisper (or compatible) — the dedicated transcription service. */
async function transcribeWithWhisper(opts: {
  wavBytes: Uint8Array;
  apiKey: string;
  model: string;
  prompt?: string;
}): Promise<string> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([opts.wavBytes.buffer as ArrayBuffer], { type: "audio/wav" }),
    "segment.wav"
  );
  form.append("model", opts.model);
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (opts.prompt) form.append("prompt", opts.prompt.slice(0, 800));

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Transcription service error ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const text = (data?.text || "").trim();
  if (!text) throw new Error("The transcription service returned no text for this segment.");
  return text;
}

/** Gemini inline-audio transcription — the fallback when no Whisper key. */
async function transcribeWithGemini(opts: {
  wavBase64: string;
  apiKey: string;
  continuationTail?: string;
}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${QUALITY_MODEL}:generateContent`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "audio/wav", data: opts.wavBase64 } },
          { text: buildVerbatimPrompt(opts.continuationTail) },
        ],
      },
    ],
    generationConfig: { temperature: 0, maxOutputTokens: 8192 },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throwGeminiFailure(res.status, errText, "transcription");
  }
  const data: any = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  if (!text) throw new ConvexError("The AI transcription returned no text for this segment — it will retry automatically.");
  return text;
}

/** DIARIZING transcription (conversation mode, 2026-11-20): Gemini
 *  inline audio with the speaker-turn prompt. Returns structured turns;
 *  the plain-text join is the compat tier for segmentTexts/verbatim. */
async function transcribeWithGeminiDiarize(opts: {
  wavBase64: string;
  apiKey: string;
  continuationTail?: string;
}): Promise<{ turns: { speaker: string; text: string }[]; text: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${QUALITY_MODEL}:generateContent`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "audio/wav", data: opts.wavBase64 } },
          { text: buildDiarizationTranscriptionPrompt(opts.continuationTail) },
        ],
      },
    ],
    generationConfig: { temperature: 0, maxOutputTokens: 8192, responseMimeType: "application/json" },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throwGeminiFailure(res.status, errText, "diarizing transcription");
  }
  const data: any = await res.json();
  const raw = (data?.candidates?.[0]?.content?.parts || [])
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
  const turns = parseSegmentTurns(raw);
  if (!turns) {
    // Model ignored the JSON contract — treat its prose as a single turn
    // rather than failing the segment (never lose audio over formatting).
    if (raw) return { turns: [{ speaker: "1", text: raw }], text: raw };
    throw new ConvexError("The diarizing transcription returned no text — it will retry automatically.");
  }
  return { turns, text: turns.map((t) => t.text).join(" ") };
}

/**
 * The provider chain: Whisper when the platform key exists, else Gemini.
 * Returns the text plus which provider produced it (recorded per segment
 * and per capture for the audit trail).
 *
 * DIARIZATION (2026-11-20): when `diarize` is set (conversation mode) the
 * chain ALWAYS uses the Gemini diarizing path — whisper-1 cannot separate
 * speakers, so a Whisper transcription of a multi-person consultation
 * would be a wall of merged text with no attribution. On a diarize-path
 * failure the segment falls back to the PLAIN chain so the audio is never
 * lost (the capture then stages without speaker attribution).
 */
export async function transcribeSegment(_ctx: any, opts: {
  wavBytes: Uint8Array;
  wavBase64: string;
  user: any;
  callerKey?: string | null;
  continuationTail?: string;
  diarize?: boolean;
}): Promise<{ text: string; provider: string; turns?: { speaker: string; text: string }[] }> {
  if (opts.diarize) {
    const geminiD = await resolveGeminiKey(_ctx, opts.user, opts.callerKey);
    if (geminiD) {
      try {
        const out = await transcribeWithGeminiDiarize({
          wavBase64: opts.wavBase64,
          apiKey: geminiD.key,
          continuationTail: opts.continuationTail,
        });
        return { text: out.text, provider: "gemini-diarize", turns: out.turns };
      } catch (err: any) {
        console.error("[voiceCapture] diarizing transcription failed, falling back to the plain chain:", err?.message);
        // fall through to the plain chain — audio is never lost
      }
    }
  }
  const openAiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (openAiKey) {
    try {
      const text = await transcribeWithWhisper({
        wavBytes: opts.wavBytes,
        apiKey: openAiKey,
        model: (process.env.TRANSCRIPTION_MODEL || "whisper-1").trim(),
        // ROUND 25 (owner bug report 2026-11-28): the prompt param is the
        // ONLY biasing surface whisper-1 exposes. With no continuation tail
        // to carry, bias it with the Nigerian litigation vocabulary so
        // "counsel" / "hearing of motion" are captured at the source. (A
        // dedicated legal STT model — e.g. gpt-4o-transcribe, which follows
        // prompt instructions more closely — would tune this further;
        // TRANSCRIPTION_MODEL is env-switchable without a code change.)
        prompt: opts.continuationTail || LEGAL_STT_VOCABULARY_HINT,
      });
      return { text, provider: "openai-whisper" };
    } catch (err: any) {
      console.error("[voiceCapture] Whisper failed, falling back to Gemini:", err?.message);
      // fall through to Gemini
    }
  }
  const gemini = await resolveGeminiKey(_ctx, opts.user, opts.callerKey);
  if (!gemini) {
    throw new ConvexError(
      "No transcription provider available yet — the platform AI key is being configured. Your recording is saved on device and will process automatically once it's set."
    );
  }
  const text = await transcribeWithGemini({
    wavBase64: opts.wavBase64,
    apiKey: gemini.key,
    continuationTail: opts.continuationTail,
  });
  return { text, provider: "gemini" };
}

/** Generic Gemini text completion (polish / triage / merge / quick ask).
 * Exported for the sibling voxSessions module (session synthesis + Ask
 * Vox) — one completion helper, one provider chain, no duplication. */
export async function geminiText(opts: {
  apiKey: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${QUALITY_MODEL}:generateContent`;
  const body = {
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    systemInstruction: { parts: [{ text: opts.system }] },
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: opts.maxTokens ?? Math.min(8192, opts.user.length * 4 + 1024),
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throwGeminiFailure(res.status, errText, "completion");
  }
  const data: any = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  if (!text) throw new ConvexError("The AI service returned an empty answer. Please try again.");
  return text;
}

// ─── Public API ────────────────────────────────────────────────────────────
// NOTE: every ACTION handler below carries an EXPLICIT return-type annotation.
// Without it, TS infers the handler return from `ctx.runMutation(internal.*...)`,
// whose FunctionReference types flow through _generated/api.d.ts → typeof
// voiceCapture (this very module) — a circular inference that degrades to `any`
// (TS7022) and poisons FunctionReturnType resolution for unrelated modules
// (observed as legal/search.ts types collapsing to {}). The annotations break
// the cycle at a concrete type.

export interface UploadSegmentResult {
  captureId: string;
  skipped: boolean;
  provider: string | null;
  verbatimSoFar: string;
  status: string;
}

export interface FinalizeCaptureResult {
  captureId: string;
  clientLocalId: string;
  kind: string;
  outputMode: string;
  verbatimText: string;
  provider: string | null;
  smartCleanText: string | null;
  mergedSummary: string | null;
  triageIntent: string | null;
  triageMeta: any;
  polishError: string | null;
  triageError: string | null;
  mergeError: string | null;
  status: string;
  /** Multi-speaker diarization (2026-11-20): the reconciled speakers +
   *  turns when the capture was recorded in conversation mode. */
  speakerTurns?: any;
  speakerError?: string | null;
}

export interface QuickAskSource {
  kind: "matter" | "note" | "event";
  id: string;
  title: string;
  detail: string;
}

/** A successfully executed Quick Ask action (owner spec §5 — read + write).
 *  Rendered by the client as a confirmation card with View / Undo. */
export interface QuickAskActionResult {
  /** The created item's kind. */
  type: "event" | "note";
  status: "created";
  /** The created item's id (for View navigation and Undo). */
  itemId: string;
  title: string;
  dateISO?: string;
  time?: string;
  matterId?: string;
  matterTitle?: string;
}

export interface QuickAskResult {
  answer: string;
  /** The resolved read/write intent mode (owner bug report 2026-11-19):
   *  "query_only" questions are answered read-only — the client renders a
   *  "nothing was created" hint; actions are always [] in that mode. */
  mode?: IntentMode;
  sources: { matters: QuickAskSource[]; notes: QuickAskSource[]; events: QuickAskSource[] };
  /** Items Quick Ask created on the lawyer's instruction (diary entries,
   *  saved notes). Empty for pure questions. */
  actions: QuickAskActionResult[];
}

/**
 * gateQuickAskActions — the READ vs WRITE gate for Quick Ask (owner bug
 * report 2026-11-19: "What's my schedule today?" created a calendar entry
 * because of the date keyword "today"). Resolves the input's mode from the
 * question text itself (deterministic classifier) merged with the model's
 * own "mode" verdict, then hard-gates the proposed tool actions:
 * query_only → ZERO actions, always — no event, task or note may be created
 * or even staged from a pure lookup question. mutation_action / hybrid →
 * validateQuickAskActions sanitises them (ids, dates, actionable subject).
 * Pure and exported — directly unit-tested.
 */
export function gateQuickAskActions(
  question: string,
  envelopeMode: unknown,
  rawActions: any[],
  matters: AnalysisMatterRow[]
): { mode: IntentMode; actions: QuickAskAction[] } {
  const mode = resolveIntentMode(
    classifyIntentMode(question),
    typeof envelopeMode === "string" ? envelopeMode : undefined
  );
  if (mode === "query_only") return { mode, actions: [] };
  return { mode, actions: validateQuickAskActions(rawActions, matters) };
}

// ─── VOX ENTITLEMENT GATE (owner spec 2026-11-20) ───────────────────────────
//
// Vox — voice capture, multi-speaker diarization and the hybrid Legal Pad —
// is a MIDDLE-TIER-AND-ABOVE feature (Growth / Pro / Enterprise / Komplete;
// a live trial of any of those counts, per effectiveFirmPlan). The Free
// tier (Core / legacy Starter) cannot upload audio, transcribe, diarize or
// finalize Legal Pad sessions. The structured error code rides the message
// so the client can open the dedicated Vox upsell modal instead of a
// generic failure toast.

/** Message thrown when a Free-tier workspace calls a Vox action. */
export const VOX_UPGRADE_REQUIRED_MESSAGE =
  "UPGRADE_REQUIRED_FOR_VOX: Vox — voice capture, speaker diarization and the hybrid Legal Pad — is available on the Growth plan and above. Upgrade to unlock it.";

/** Throws UPGRADE_REQUIRED_FOR_VOX when the firm's effective plan is Free. */
async function requireVoxEntitlement(ctx: any, firmId: string): Promise<void> {
  const firm: any = await ctx.runQuery(internal.voiceCaptureInternal.getFirmPlanInternal, {
    firmId,
  });
  const plan = firm ? effectiveFirmPlan(firm) : "Core";
  if (!canUseVox(plan)) {
    throw new ConvexError(VOX_UPGRADE_REQUIRED_MESSAGE);
  }
}

/**
 * uploadSegment — one recorded audio segment: archive + transcribe.
 * Idempotent on (clientLocalId, segmentIndex); offline replays are safe.
 */
export const uploadSegment = action({
  args: {
    clientLocalId: v.string(),
    kind: v.string(), // 'quick' | 'legalpad'
    outputMode: v.string(), // 'smart-clean' | 'verbatim'
    segmentIndex: v.number(),
    segmentCount: v.optional(v.number()),
    audioBase64: v.string(), // 16 kHz mono WAV, base64
    startMs: v.number(),
    endMs: v.number(),
    startedAt: v.optional(v.number()),
    // Conversation mode (multi-speaker diarization, 2026-11-20).
    multiSpeaker: v.optional(v.boolean()),
    callerApiKey: v.optional(v.string()), // the caller's own BYO key
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()), // ignored — session is the proof
  },
  handler: async (ctx, args): Promise<UploadSegmentResult> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    // VOX ENTITLEMENT (owner spec 2026-11-20): audio upload + transcription
    // + diarization are Growth-and-above. Free-tier callers get the
    // structured UPGRADE_REQUIRED_FOR_VOX error.
    await requireVoxEntitlement(ctx, auth.firmId);
    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `voice_upload:${auth.userId}`, maxRequests: 60 }
    );
    if (!allowed) throw new Error("Rate limit exceeded. Please wait a moment and try again.");

    if (args.audioBase64.length > MAX_AUDIO_BASE64_CHARS) {
      throw new Error("Audio segment too large (4 MB limit). The recorder slices at ≤75s — this should never trigger.");
    }
    if (args.endMs - args.startMs > MAX_SEGMENT_MS) {
      throw new Error("Segment too long (5 min limit).");
    }

    const captureId = await ctx.runMutation(internal.voiceCaptureInternal.upsertCaptureRow, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
      userId: auth.userId,
      kind: args.kind,
      outputMode: args.outputMode,
      startedAt: args.startedAt ?? undefined,
      segmentCount: args.segmentCount ?? undefined,
      multiSpeaker: args.multiSpeaker ?? undefined,
    });

    const row: any = await ctx.runQuery(internal.voiceCaptureInternal.getCaptureInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
    });

    // Tombstone check (owner spec 2026-11-20: deleted notes must never
    // reappear): the user deleted this capture while an upload was in
    // flight. Refuse — permanent, non-retryable — so the client dead-letters
    // the segment instead of resurrecting the note.
    if (row?.deleted === true) {
      throw new ConvexError("This voice note was deleted — the upload was discarded.");
    }
    // Idempotent replay check — already have this segment's text?
    const existingTexts: any[] = Array.isArray(row?.segmentTexts) ? row.segmentTexts : [];
    if (existingTexts.some((t) => t.index === args.segmentIndex)) {
      return {
        captureId,
        skipped: true,
        provider: existingTexts.find((t) => t.index === args.segmentIndex)?.provider ?? null,
        verbatimSoFar: assembleVerbatim(existingTexts),
        status: row?.status ?? "transcribing",
      };
    }

    // Continuity: the tail of the previous segment helps both Whisper
    // (prompt param) and Gemini (continuation context) join at sentence
    // boundaries — no duplicated or dropped words at the seams.
    const prev = existingTexts
      .filter((t) => t.index === args.segmentIndex - 1)
      .map((t) => t.text || "")
      .join(" ");
    const continuationTail = prev ? prev.slice(-400) : undefined;

    const wavBytes = decodeBase64ToBytes(args.audioBase64);
    // Archive FIRST (owner rule: audio is never lost) — then decide whether
    // the frame is worth a transcription call.
    const storageId = await ctx.storage.store(
      new Blob([wavBytes.buffer as ArrayBuffer], { type: "audio/wav" })
    );

    // ── 2026-11-20 (owner spec): near-silent / zero-speech frames are never
    // submitted to the transcription endpoint. Digital silence (codec noise
    // floor) and sub-400ms crumbs cannot contain speech — transcribing them
    // is precisely what produced the endless "So. So. So…" hallucinations
    // in Recent Voice Notes (worst under Low-Volume / Quiet Mode, where the
    // open noise gate feeds the model more room noise). The audio is still
    // ARCHIVED (never lost) — only the transcription call is skipped.
    const segDurationMs = Math.max(0, args.endMs - args.startMs);
    const rms = wavRmsLevel(wavBytes);
    if (segDurationMs < 400 || (rms > 0 && rms <= SILENT_RMS_THRESHOLD)) {
      const appendResult: any = await ctx.runMutation(
        internal.voiceCaptureInternal.appendSegmentToRow,
        {
          captureId,
          firmId: auth.firmId,
          segment: {
            storageId: String(storageId),
            mimeType: "audio/wav",
            startMs: args.startMs,
            endMs: args.endMs,
            bytes: wavBytes.byteLength,
          },
          segmentText: {
            index: args.segmentIndex,
            text: "",
            provider: "skipped-silence",
            at: Date.now(),
          },
          // A silent frame carries no speaker turns either.
        }
      );
      return {
        captureId,
        skipped: appendResult?.skipped ?? false,
        provider: "skipped-silence",
        verbatimSoFar: assembleVerbatim(appendResult?.segmentTexts ?? []),
        status: "transcribing",
      };
    }

    const { text, provider, turns } = await transcribeSegment(ctx, {
      wavBytes,
      wavBase64: args.audioBase64,
      user: auth.user,
      callerKey: args.callerApiKey,
      continuationTail,
      diarize: args.multiSpeaker === true || row?.multiSpeaker === true,
    });

    // ── HALLUCINATION FILTER (owner spec 2026-11-20): collapse repeated-token
    // loops ("so so so" → "so") and drop filler-only transcripts BEFORE they
    // ever reach the transcript store or Recent Voice Notes.
    const sanitized = sanitizeSegmentText(text);
    const cleanTurns = turns
      ?.map((t) => ({ speaker: t.speaker, text: sanitizeSegmentText(t.text).text }))
      .filter((t) => t.text.length > 0);

    const appendResult: any = await ctx.runMutation(
      internal.voiceCaptureInternal.appendSegmentToRow,
      {
        captureId,
        firmId: auth.firmId,
        segment: {
          storageId: String(storageId),
          mimeType: "audio/wav",
          startMs: args.startMs,
          endMs: args.endMs,
          bytes: wavBytes.byteLength,
        },
        segmentText: {
          index: args.segmentIndex,
          text: sanitized.text,
          provider: sanitized.dropped ? `${provider}+filtered` : provider,
          at: Date.now(),
        },
        turns: cleanTurns && cleanTurns.length > 0 ? cleanTurns : undefined,
      }
    );

    return {
      captureId,
      skipped: appendResult?.skipped ?? false,
      provider,
      verbatimSoFar: assembleVerbatim(appendResult?.segmentTexts ?? []),
      status: "transcribing",
    };
  },
});

/**
 * finalizeCapture — assemble the verbatim transcript, run the Smart Clean
 * pass (unless the capture is verbatim-mode), triage quick captures, and
 * merge the Legal Pad's shorthand with the spoken record.
 */
export const finalizeCapture = action({
  args: {
    clientLocalId: v.string(),
    shorthandText: v.optional(v.string()), // legal pad: latest typed notes
    eventTypeNames: v.optional(v.array(v.string())), // firm's calendar types
    totalDurationMs: v.optional(v.number()),
    // Conversation mode (multi-speaker diarization, 2026-11-20) — also
    // read from the stored row so replays need not repeat it.
    multiSpeaker: v.optional(v.boolean()),
    callerApiKey: v.optional(v.string()), // the caller's own BYO key
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<FinalizeCaptureResult> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    // VOX ENTITLEMENT: finalize drives Smart Clean, triage, the Legal Pad
    // merge and the diarization reconcile pass — Pro and above only
    // (tierLimits.canUseVox; stale comment said Growth).
    await requireVoxEntitlement(ctx, auth.firmId);
    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `voice_finalize:${auth.userId}`, maxRequests: 15 }
    );
    if (!allowed) throw new Error("Rate limit exceeded. Please wait a moment and try again.");

    const row: any = await ctx.runQuery(internal.voiceCaptureInternal.getCaptureInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
    });
    // Tombstoned (deleted) captures cannot finalize — the user deleted them.
    if (!row || row.deleted === true) throw new Error("Capture not found.");

    const texts: any[] = Array.isArray(row.segmentTexts) ? row.segmentTexts : [];
    if (texts.length === 0) {
      await ctx.runMutation(internal.voiceCaptureInternal.patchCaptureInternal, {
        clientLocalId: args.clientLocalId,
        firmId: auth.firmId,
        patch: { status: "failed", error: "No audio segments were uploaded for this capture." },
      });
      throw new Error("No audio segments were uploaded for this capture.");
    }

    const verbatim = assembleVerbatim(texts);
    const shorthand =
      typeof args.shorthandText === "string" ? args.shorthandText : row.shorthandText || "";

    // ── EMPTY / FILLER-ONLY GUARD (owner spec 2026-11-20: "prevent empty or
    // filler-only transcripts from being saved to Recent Voice Notes").
    // Every segment was silence-skipped or hallucination-filtered and the
    // user typed nothing — there is no note here. Delete the row + archived
    // audio so the note never appears anywhere, and fail with a clear,
    // NON-retryable message (retrying cannot conjure speech out of silence).
    // Legacy rows recorded before the segment sanitizer may still carry
    // filler-only text — isFillerOnlyText catches those too.
    const noSpeechDetected =
      (!verbatim.trim() || isFillerOnlyText(verbatim)) && !shorthand.trim();
    if (noSpeechDetected) {
      const segs: any[] = Array.isArray(row.segments) ? row.segments : [];
      for (const s of segs) {
        try { await ctx.storage.delete(s.storageId as any); } catch { /* already gone */ }
      }
      await ctx.runMutation(internal.voiceCaptureInternal.deleteCaptureInternal, {
        clientLocalId: args.clientLocalId,
        firmId: auth.firmId,
      });
      throw new ConvexError(
        "No speech was detected in this recording — nothing was saved. Tap record and try again, speaking a little closer to the microphone."
      );
    }
    const lastProvider = [...texts].sort((a, b) => b.index - a.index)[0]?.provider || null;

    const result: any = {
      captureId: row._id,
      clientLocalId: args.clientLocalId,
      kind: row.kind,
      outputMode: row.outputMode,
      verbatimText: verbatim,
      provider: lastProvider,
      smartCleanText: null,
      mergedSummary: null,
      triageIntent: null,
      triageMeta: null,
      polishError: null,
      triageError: null,
      mergeError: null,
      status: "ready",
    };

    const gemini = await resolveGeminiKey(ctx, auth.user, args.callerApiKey);
    // The matters directory is shared by the analysis pass and the
    // multi-speaker reconcile pass below (2026-11-20) — hoisted so the
    // reconcile block can reuse it (or load it for legalpad captures).
    let mattersDir: any[] | null = null;
    const patch: any = {
      verbatimText: verbatim,
      provider: lastProvider,
      status: "ready",
      durationMs: args.totalDurationMs ?? row.durationMs ?? null,
    };
    if (shorthand !== (row.shorthandText || "")) patch.shorthandText = shorthand;

    // ── Smart Clean (quick captures only — the legal pad's polish tier is
    //    the merged summary, and its transcript tier stays verbatim).
    //    SPELLING HINTS (Personal Dictionary, owner spec 2026-11-19 §3) ride
    //    along as a user message suffix.
    let dictionaryTerms: string[] = [];
    try {
      const dictRows: { term: string }[] = await ctx.runQuery(
        internal.voiceCaptureInternal.listFirmUserDictionaryInternal,
        { firmId: auth.firmId, userId: String(auth.user._id) }
      );
      dictionaryTerms = (dictRows || []).map((d) => d.term).filter(Boolean);
    } catch { /* dictionary is optional polish context */ }
    const hintsSuffix = dictionaryTerms.length
      ? `\n\nSPELLING HINTS (spell these exactly when they appear): ${dictionaryTerms.join(", ")}`
      : "";
    if (row.kind === "quick" && row.outputMode === "smart-clean") {
      if (gemini) {
        try {
          const cleaned = await geminiText({
            apiKey: gemini.key,
            system: SMART_CLEAN_SYSTEM_PROMPT,
            user: `Clean this transcript:\n\n${verbatim.slice(0, MAX_TRANSCRIPT_CHARS)}${hintsSuffix}`,
          });
          patch.smartCleanText = cleaned;
          patch.polishedAt = Date.now();
          patch.polishModel = QUALITY_MODEL;
          result.smartCleanText = cleaned;
        } catch (err: any) {
          result.polishError = err?.message || "Smart Clean failed.";
        }
      } else {
        result.polishError = "No AI key available for Smart Clean — verbatim preserved.";
      }
    }

    // ── Analysis (quick captures): multi-intent structured extraction.
    //    Owner spec (2026-11-18, "Upgrade Quick Capture Intelligence"): the
    //    LLM receives LIVE CONTEXT (exact WAT date/time + a rich matters
    //    directory with client names and parties) and returns EVERYTHING
    //    actionable at once — ranked semantic matter matches, relative-date
    //    resolved diary events with 09:00 defaults, implied follow-up
    //    tasks, endorsement fields, and the question text. The card then
    //    offers combined actions ("Save Case Note & Add to Diary").
    if (row.kind === "quick" && gemini) {
      try {
        const matters: any[] = await ctx.runQuery(
          internal.voiceCaptureInternal.listFirmMattersInternal,
          { firmId: auth.firmId }
        );
        mattersDir = matters;
        const contacts: any[] = await ctx.runQuery(
          internal.voiceCaptureInternal.listFirmContactsInternal,
          { firmId: auth.firmId }
        );
        // WORKSPACE DIRECTORIES (owner spec 2026-11-19, Part 1): properties
        // and open tasks/ reminders join matters + contacts so estate notes
        // and "mark that reminder done" updates match real records. Snippets
        // + dictionary come along for expansion and spelling hints.
        let properties: any[] = [];
        let openTasks: any[] = [];
        let snippets: { trigger: string; content: string }[] = [];
        try {
          properties = await ctx.runQuery(
            internal.voiceCaptureInternal.listFirmPropertiesInternal,
            { firmId: auth.firmId }
          );
          openTasks = await ctx.runQuery(
            internal.voiceCaptureInternal.listFirmOpenTasksInternal,
            { firmId: auth.firmId }
          );
          snippets = await ctx.runQuery(
            internal.voiceCaptureInternal.listFirmUserSnippetsInternal,
            { firmId: auth.firmId, userId: String(auth.user._id) }
          );
        } catch { /* directories are additive context — never fatal */ }
        if (!snippets || snippets.length === 0) {
          // First-ever use: the firm defaults from voiceTools apply before
          // any seeding happens, so spoken snippets work out of the box.
          snippets = DEFAULT_SNIPPETS;
        }

        const analysisRaw = await geminiText({
          apiKey: gemini.key,
          system:
            "You are a precise legal-assistant extraction engine. Respond with strict JSON only.",
          user:
            buildAnalysisPrompt({
              lagos: lagosNow(Date.now()),
              matters,
              contacts,
              eventTypeNames: args.eventTypeNames || [],
              properties,
              openTasks,
              snippets,
              dictionaryTerms,
            }) + `\n\nTHE VOICE NOTE TRANSCRIPT:\n"""${verbatim.slice(0, MAX_TRANSCRIPT_CHARS)}"""`,
          // Bumped again for the Wispr-Flow upgrade (2026-11-19): the
          // envelope now also carries workspace proposals + a draft brief.
          maxTokens: 4096,
        });
        const parsed = parseModelJson<any>(analysisRaw);
        if (parsed) {
          // ── READ vs WRITE INTENT GATE (owner bug report 2026-11-19):
          //    classify the transcript BEFORE anything is staged. A pure
          //    lookup ("What's my schedule today?") can never produce
          //    events or write proposals — even when the model misreads a
          //    date keyword as an instruction. enforceIntentGate merges the
          //    model's "mode" with the deterministic classifier and
          //    hard-gates the payload accordingly.
          const intentGate = enforceIntentGate(parsed, verbatim);
          const gated = intentGate.parsed;
          // Semantic matches: validate LLM ids against the firm's real
          // matters, then merge the deterministic containment backstop.
          const matterMatches = rankAndValidateMatterMatches(
            gated.matterMatches,
            matters,
            gated.matterCandidates || [],
            contacts
          );
          const deterministic = matchMatterCandidates(
            gated.matterCandidates || [],
            matters,
            contacts
          );
          const events = (Array.isArray(gated.events) ? gated.events : [])
            .slice(0, 6)
            .map((e: any) => ({
              title: String(e?.title || "").slice(0, 160),
              type: String(e?.type || ""),
              dateISO: /^\d{4}-\d{2}-\d{2}$/.test(String(e?.dateISO || ""))
                ? String(e.dateISO)
                : "",
              time: /^\d{2}:\d{2}$/.test(String(e?.time || "")) ? String(e.time) : "09:00",
              timeEstimated: e?.timeEstimated !== false,
              location: String(e?.location || "").slice(0, 160),
              // Wispr-Flow style: the diary Notes field gets the LLM's concise
              // action summary for THIS entry, never the raw transcript. The
              // client falls back to stripMetaSpeech() when it is empty.
              note: String(e?.note || "").slice(0, 600),
            }))
            .filter((e: any) => e.title);
          const endorsement =
            gated.endorsement && typeof gated.endorsement === "object"
              ? {
                  court: String(gated.endorsement.court || "").slice(0, 160),
                  suitNumber: String(gated.endorsement.suitNumber || "").slice(0, 80),
                  parties: String(gated.endorsement.parties || "").slice(0, 240),
                  judge: String(gated.endorsement.judge || "").slice(0, 120),
                  orders: (Array.isArray(gated.endorsement.orders)
                    ? gated.endorsement.orders
                    : []
                  )
                    .map((o: any) => String(o || "").slice(0, 400))
                    .filter(Boolean)
                    .slice(0, 12),
                  nextAdjournedDate: /^\d{4}-\d{2}-\d{2}$/.test(
                    String(gated.endorsement.nextAdjournedDate || "")
                  )
                    ? String(gated.endorsement.nextAdjournedDate)
                    : "",
                  nextAdjournedTime: /^\d{2}:\d{2}$/.test(
                    String(gated.endorsement.nextAdjournedTime || "")
                  )
                    ? String(gated.endorsement.nextAdjournedTime)
                    : "",
                }
              : null;
          const triageMeta = {
            ...gated,
            // Read/write mode resolved by enforceIntentGate (owner bug
            // report 2026-11-19): "query_only" captures render as
            // read-only on the triage card and never stage writes.
            mode: intentGate.mode,
            allowWriteTools: intentGate.mode !== "query_only",
            matterMatches,
            events,
            isDiaryTask: gated.isDiaryTask === true || events.length > 0,
            endorsement,
            // Destination-formatted note body (paragraphs vs bullets, meta-
            // speech stripped — owner spec 2026-11-19). Empty string when the
            // model omitted it; the client falls back to smartClean/verbatim.
            caseNoteText: String(gated.caseNoteText || "")
              .trim()
              .slice(0, MAX_TRANSCRIPT_CHARS),
            // WORKSPACE PROPOSALS (owner spec 2026-11-19, Part 1): validated
            // new-matter / contact / property / draft / financial / task-done
            // proposals the triage card renders as 1-tap action cards.
            proposals: validateWorkspaceProposals(gated, {
              matters,
              contacts,
              properties: properties || [],
              openTasks: openTasks || [],
              bestMatterConfidence: matterMatches[0]?.confidence || 0,
              rawTranscript: verbatim,
              matterMatches: matterMatches.map((m: MatterMatch) => ({
                matterId: m.matterId,
                confidence: m.confidence,
                label: matters.find((x: any) => x.id === m.matterId)?.title || m.matterId,
              })),
            }),
            // Legacy fields kept for older clients / recent-notes strip.
            matchedMatterIds: matterMatches.map((m) => m.matterId),
            matchedContactIds: deterministic.matchedContactIds,
          };
          // ── VOICE → DRAFTPRO PIPELINE (owner spec §4.1): reject → retry
          //    ONCE → safe fallback. When the analysis emitted a blueprint
          //    that failed schema validation (validateWorkspaceProposals
          //    dropped it), run ONE focused re-extraction; if that also
          //    fails, fall back to the minimal blueprint — documents: []
          //    with the transcript preserved and a clarifying missing-field
          //    entry. The dictation is never lost.
          const hadBlueprintIntent = gated?.draftBlueprint != null;
          if (
            hadBlueprintIntent &&
            !triageMeta.proposals.draftBlueprint &&
            gemini
          ) {
            try {
              const retryRaw = await geminiText({
                apiKey: gemini.key,
                system: BLUEPRINT_RETRY_SYSTEM_PROMPT,
                user: `TODAY (Lagos): ${lagosNow(Date.now()).dateISO}\n\nTHE LAWYER'S DICTATED NOTE:\n"""${verbatim.slice(0, MAX_TRANSCRIPT_CHARS)}"""`,
                maxTokens: 2048,
              });
              const retryParsed = parseModelJson<any>(retryRaw);
              const retryValidation = validateDraftBlueprint(retryParsed, {
                rawTranscript: verbatim,
                matches: triageMeta.matterMatches.map((m: MatterMatch) => ({
                  matterId: m.matterId,
                  confidence: m.confidence,
                  label: matters.find((x: any) => x.id === m.matterId)?.title || m.matterId,
                })),
              });
              triageMeta.proposals.draftBlueprint =
                retryValidation.ok && blueprintIsSubstantive(retryValidation.value)
                  ? retryValidation.value
                  : minimalBlueprint(verbatim);
            } catch {
              // Provider failure on the retry: minimal blueprint — the
              // transcript is preserved, never the dictation lost.
              triageMeta.proposals.draftBlueprint = minimalBlueprint(verbatim);
            }
          }
          patch.triageIntent = gated.intent || "share";
          patch.triageMeta = triageMeta;
          result.triageIntent = patch.triageIntent;
          result.triageMeta = triageMeta;
        } else {
          result.triageError = "Analysis returned unparseable output.";
        }
      } catch (err: any) {
        result.triageError = err?.message || "Analysis failed.";
      }
    }

    // ── Legal Pad merge: typed shorthand + spoken verbatim → one summary.
    if (row.kind === "legalpad" && shorthand.trim() && gemini) {
      try {
        const merged = await geminiText({
          apiKey: gemini.key,
          system: buildMergePrompt(),
          user: `RECORD A — the lawyer's typed shorthand notes:\n"""${shorthand.slice(0, MAX_TRANSCRIPT_CHARS)}"""\n\nRECORD B — the verbatim transcript of the session:\n"""${verbatim.slice(0, MAX_TRANSCRIPT_CHARS)}"""`,
        });
        patch.mergedSummary = merged;
        patch.mergedAt = Date.now();
        result.mergedSummary = merged;
      } catch (err: any) {
        result.mergeError = err?.message || "Merge failed.";
      }
    }

    // ── MULTI-SPEAKER RECONCILE + ROLE INFERENCE (owner spec 2026-11-20):
    //    unify the per-segment speaker labels into whole-recording
    //    speakers and pre-suggest legal roles from the matched matter's
    //    people (client, opposing counsel, judge) + conversational cues
    //    ("My Lord", Q&A patterns). The staging card renders tappable
    //    speaker pills the lawyer can relabel/merge before saving. When
    //    only ONE speaker is detected the UI keeps the clean single-block
    //    view (no badges) — diarization only surfaces when it found
    //    people. Turn TEXT always comes from our own segment turns — the
    //    model returns ids/roles/names only, never reworded text.
    const segTurns: { index: number; turns: { speaker: string; text: string }[] }[] = Array.isArray(
      row.segmentTurns
    )
      ? row.segmentTurns
      : [];
    const isMultiSpeaker = args.multiSpeaker === true || row.multiSpeaker === true;
    if (isMultiSpeaker && segTurns.length > 0) {
      const flatTurns = flattenSegmentTurns(segTurns);
      if (flatTurns.length > 0) {
        if (!gemini) {
          // No AI key: deterministic per-segment fallback — the staging
          // card can still label + merge speakers by hand.
          const speakerResult = fallbackSpeakerTurns(segTurns);
          patch.speakerTurns = speakerResult;
          result.speakerTurns = speakerResult as any;
          result.speakerError = "No AI key available for speaker identification — raw per-segment labels kept.";
        } else {
        try {
          if (mattersDir === null) {
            mattersDir = await ctx.runQuery(
              internal.voiceCaptureInternal.listFirmMattersInternal,
              { firmId: auth.firmId }
            );
          }
          // The best-matched matter from the analysis (or null).
          const topMatchId =
            (Array.isArray(patch.triageMeta?.matterMatches) && patch.triageMeta.matterMatches[0]?.matterId) ||
            null;
          const matterRow = topMatchId
            ? (mattersDir || []).find((m: any) => m.id === topMatchId) || null
            : null;
          const reconcileRaw = await geminiText({
            apiKey: gemini.key,
            system: buildSpeakerReconcilePrompt({
              counselName: auth.user?.name || null,
              matter: matterRow
                ? {
                    title: String(matterRow.title || ""),
                    clientName: matterRow.clientName || null,
                    opposingCounsel: matterRow.opposingCounsel || null,
                    presidingJudge: matterRow.presidingJudge || null,
                    parties: Array.isArray(matterRow.parties) ? matterRow.parties : [],
                  }
                : null,
            }),
            user: flatTurns
              .map((t) => `${t.key} [${t.localLabel}] ${t.text.slice(0, 2000)}`)
              .join("\n"),
            maxTokens: 2048,
          });
          const reconciled = parseReconcileResult(reconcileRaw, flatTurns);
          const speakerResult =
            reconciled ?? fallbackSpeakerTurns(segTurns);
          patch.speakerTurns = speakerResult;
          result.speakerTurns = speakerResult as any;
        } catch (err: any) {
          // The capture still finalizes — it just stages without
          // attribution, with the raw per-segment turns as fallback.
          const speakerResult = fallbackSpeakerTurns(segTurns);
          patch.speakerTurns = speakerResult;
          result.speakerTurns = speakerResult as any;
          result.speakerError = err?.message || "Speaker reconcile failed.";
        }
        }
      }
    }

    await ctx.runMutation(internal.voiceCaptureInternal.patchCaptureInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
      patch,
    });
    return result;
  },
});

/** saveShorthand — autosave the Legal Pad's typed notes onto the capture row. */
export const saveShorthand = mutation({
  args: {
    clientLocalId: v.string(),
    shorthandText: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    if (args.shorthandText.length > MAX_TRANSCRIPT_CHARS) {
      throw new Error("Shorthand notes too large (200 KB limit).");
    }
    const row: any = await loadOwnedCapture(ctx, auth, args.clientLocalId);
    await ctx.db.patch(row._id, {
      shorthandText: args.shorthandText,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** linkCapture — record where the capture landed (matter / note / diary). */
export const linkCapture = mutation({
  args: {
    clientLocalId: v.string(),
    matterId: v.optional(v.string()),
    notePageId: v.optional(v.string()),
    eventId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const row: any = await loadOwnedCapture(ctx, auth, args.clientLocalId);
    const patch: any = { updatedAt: new Date().toISOString() };
    if (args.matterId !== undefined) patch.matterId = args.matterId;
    if (args.notePageId !== undefined) patch.notePageId = args.notePageId;
    if (args.eventId !== undefined) patch.eventId = args.eventId;
    await ctx.db.patch(row._id, patch);
  },
});

/** getCaptureByLocalId — rehydrate a capture (poll after upload / reconnect). */
export const getCaptureByLocalId = query({
  args: {
    clientLocalId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const row: any = await loadOwnedCapture(ctx, auth, args.clientLocalId);
    return projectCapture(row, false);
  },
});

/** listRecentCaptures — the Quick Capture history strip. */
export const listRecentCaptures = query({
  args: {
    limit: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const rows: any[] = await ctx.db
      .query("voiceCaptures")
      .withIndex("by_firm_user", (q: any) => q.eq("firmId", auth.firmId).eq("userId", auth.userId))
      .order("desc")
      .collect();
    return rows
      .filter((r) => r.deleted !== true) // tombstoned deletes never reappear
      .slice(0, Math.min(args.limit ?? 15, 30))
      .map((r) => projectCapture(r, true));
  },
});

/** Load a capture row firm-scoped from a mutation/query context (has ctx.db). */
async function loadOwnedCapture(ctx: any, auth: { firmId: string }, clientLocalId: string) {
  const row: any = await ctx.db
    .query("voiceCaptures")
    .withIndex("by_client_local_id", (q: any) => q.eq("clientLocalId", clientLocalId))
    .first();
  // Tombstoned (deleted) captures are GONE to every read path — the user
  // deleted them; an in-flight upload must never resurrect them.
  if (!row || row.deleted === true) throw new Error("Capture not found.");
  if (row.firmId !== auth.firmId) throw new Error("Not authorized.");
  return row;
}

function projectCapture(row: any, slim: boolean) {
  const texts: any[] = Array.isArray(row.segmentTexts) ? row.segmentTexts : [];
  // INCREMENTAL DICTATION: the index the NEXT segment must carry so an
  // "Add More" round can never collide with an existing (idempotent-skip)
  // index. Gaps from dead-lettered segments mean max-index+1 ≠ count, so
  // derive it from the indexes themselves.
  const maxIndex = texts.reduce((m: number, t: any) => Math.max(m, t?.index ?? 0), -1);
  const base: any = {
    captureId: row._id,
    clientLocalId: row.clientLocalId,
    kind: row.kind,
    outputMode: row.outputMode,
    status: row.status,
    provider: row.provider,
    durationMs: row.durationMs,
    startedAt: row.startedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    segmentCount: texts.length,
    nextSegmentIndex: maxIndex + 1,
    triageIntent: row.triageIntent,
    triageMeta: row.triageMeta,
    matterId: row.matterId,
    notePageId: row.notePageId,
    eventId: row.eventId,
    error: row.error,
  };
  if (slim) {
    base.snippet = (row.verbatimText || row.smartCleanText || row.mergedSummary || "").slice(0, 180);
    base.hasSmartClean = !!row.smartCleanText;
    base.hasMergedSummary = !!row.mergedSummary;
    base.multiSpeaker = row.multiSpeaker === true;
    return base;
  }
  base.verbatimText = row.verbatimText;
  base.smartCleanText = row.smartCleanText;
  base.mergedSummary = row.mergedSummary;
  base.shorthandText = row.shorthandText;
  base.multiSpeaker = row.multiSpeaker === true;
  base.speakerTurns = row.speakerTurns ?? null;
  base.segments = Array.isArray(row.segments)
    ? row.segments.map((s: any) => ({ storageId: s.storageId, startMs: s.startMs, endMs: s.endMs }))
    : [];
  return base;
}

/** getSegmentUrl — playback URL for an archived audio segment (tier 1 audio). */
export const getSegmentUrl = query({
  args: {
    clientLocalId: v.string(),
    segmentIndex: v.number(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const row: any = await loadOwnedCapture(ctx, auth, args.clientLocalId);
    const segs: any[] = Array.isArray(row.segments) ? row.segments : [];
    const target = segs[args.segmentIndex];
    if (!target) throw new Error("Segment not found.");
    return await ctx.storage.getUrl(target.storageId);
  },
});

/** deleteCapture — remove the row's visibility and its archived audio.
 *
 * 2026-11-20 (owner spec: "deleting a note removes it cleanly … so it never
 * reappears"): a PHYSICAL delete raced the drain loop — an in-flight
 * uploadSegment for the same capture would re-create the row via
 * upsertCaptureRow right after the delete, and the note resurrected in
 * Recent Voice Notes. Deletion is now a TOMBSTONE: the row is flagged
 * `deleted`, its audio is purged, every read path hides it, and any
 * in-flight upload that lands sees the flag and refuses with a permanent
 * error. Old tombstones are physically swept after 7 days. */
export const deleteCapture = mutation({
  args: {
    clientLocalId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const row: any = await loadOwnedCapture(ctx, auth, args.clientLocalId);
    const segs: any[] = Array.isArray(row.segments) ? row.segments : [];
    for (const s of segs) {
      try {
        await ctx.storage.delete(s.storageId as any);
      } catch { /* already gone */ }
    }
    await ctx.db.patch(row._id, {
      deleted: true,
      deletedAt: Date.now(),
      status: "failed",
      segments: [],
      segmentTexts: [],
      segmentTurns: [],
      verbatimText: "",
      smartCleanText: null,
      mergedSummary: null,
      updatedAt: new Date().toISOString(),
    });
    // Sweep this firm's stale tombstones (older than 7 days) — bounded scan
    // over the firm's own rows, piggybacked on the delete that created new
    // ones, so no cron is needed.
    try {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const firmRows: any[] = await ctx.db
        .query("voiceCaptures")
        .withIndex("by_firm_user", (q: any) => q.eq("firmId", auth.firmId).eq("userId", auth.userId))
        .collect();
      for (const r of firmRows) {
        if (r.deleted === true && typeof r.deletedAt === "number" && r.deletedAt < cutoff) {
          try { await ctx.db.delete(r._id); } catch { /* already gone */ }
        }
      }
    } catch { /* sweeping is best-effort */ }
  },
});

/** repolish — re-run the Smart Clean pass on a finished capture. */
export const repolish = action({
  args: {
    clientLocalId: v.string(),
    callerApiKey: v.optional(v.string()), // the caller's own BYO key
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ smartCleanText: string }> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    // VOX ENTITLEMENT: repolish is part of the Vox pipeline.
    await requireVoxEntitlement(ctx, auth.firmId);
    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `voice_polish:${auth.userId}`, maxRequests: 10 }
    );
    if (!allowed) throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    const row: any = await ctx.runQuery(internal.voiceCaptureInternal.getCaptureInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
    });
    if (!row || row.deleted === true) throw new Error("Capture not found.");
    if (!row.verbatimText) throw new Error("Nothing to polish yet.");
    const gemini = await resolveGeminiKey(ctx, auth.user, args.callerApiKey);
    if (!gemini) throw new Error("No AI key available for Smart Clean.");
    let repolishHints = "";
    try {
      const dict: { term: string }[] = await ctx.runQuery(
        internal.voiceCaptureInternal.listFirmUserDictionaryInternal,
        { firmId: auth.firmId, userId: String(auth.user._id) }
      );
      if (dict.length) {
        repolishHints = `\n\nSPELLING HINTS (spell these exactly when they appear): ${dict.map((d) => d.term).join(", ")}`;
      }
    } catch { /* optional context */ }
    const cleaned = await geminiText({
      apiKey: gemini.key,
      system: SMART_CLEAN_SYSTEM_PROMPT,
      user: `Clean this transcript:\n\n${row.verbatimText.slice(0, MAX_TRANSCRIPT_CHARS)}${repolishHints}`,
    });
    await ctx.runMutation(internal.voiceCaptureInternal.patchCaptureInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
      patch: {
        smartCleanText: cleaned,
        polishedAt: Date.now(),
        polishModel: QUALITY_MODEL,
      },
    });
    return { smartCleanText: cleaned };
  },
});

/**
 * transcribeBatch — one-shot verbatim transcription through the provider
 * chain (Whisper → Gemini), with NO storage and NO voiceCaptures row.
 *
 * This is the retrofitted engine for the LEGACY dictation surfaces that
 * predate Quick Capture: the NoteEditor mic and the SaveToNoteForm
 * recorder. They keep their own in-memory batch flow (text lands at the
 * editor cursor as batches arrive) but now route every batch through the
 * DEDICATED backend transcription service instead of the old
 * browser-level speech recognition / direct-Gemini path — same Whisper
 * upgrade, same Nigerian-English verbatim prompt, same continuity tail.
 */
export const transcribeBatch = action({
  args: {
    audioBase64: v.string(), // 16 kHz mono WAV, base64
    continuationTail: v.optional(v.string()),
    callerApiKey: v.optional(v.string()), // the caller's own BYO key
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ text: string; provider: string }> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `voice_batch:${auth.userId}`, maxRequests: 60 }
    );
    if (!allowed) throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    if (args.audioBase64.length > MAX_AUDIO_BASE64_CHARS) {
      throw new Error("Audio batch too large (4 MB limit).");
    }
    const wavBytes = decodeBase64ToBytes(args.audioBase64);
    const { text, provider } = await transcribeSegment(ctx, {
      wavBytes,
      wavBase64: args.audioBase64,
      user: auth.user,
      callerKey: args.callerApiKey,
      continuationTail: args.continuationTail || undefined,
    });
    return { text, provider };
  },
});

/**
 * QUICK_ASK_SYSTEM_PROMPT — exported for unit tests. The FIRM DATA SUMMARY
 * (built by buildQuickAskContext) is authoritative for counting questions;
 * the KEYWORD-MATCHED sections are explicitly labelled as filtered subsets
 * so an empty subset can never be read as "the firm has none" (owner bug
 * report 2026-11-18: "how many matters do I have?" → "you have no matters").
 */
export const QUICK_ASK_SYSTEM_PROMPT =
  "You answer a Nigerian lawyer's questions and carry out their instructions using ONLY the firm data provided. Be concise (≤120 words). Cite what you used inline as [Matter: X], [Note: Y] or [Schedule: Z]. The FIRM DATA SUMMARY holds the authoritative counts and matter inventory — answer counting questions (e.g. 'how many matters do I have?') from those counts, never from the keyword-matched subsets. The KEYWORD-MATCHED sections are filtered subsets: an empty subset only means no title matched the question's wording, not that the firm has none. If the data does not contain the answer, say so plainly and name what is missing (e.g. 'no matter with that name is on record'). Never invent matters, dates, figures or case details.\n\nREAD vs WRITE — classify the lawyer's input FIRST, before proposing any action, and report it as \"mode\":\n- \"query_only\": any question or lookup ('What\u2019s my schedule today?', 'What do I have tomorrow?', 'Any hearings this week?', 'Do I have anything tomorrow?', 'Show my tasks for Friday', 'When is the Sino Truck matter coming up?'). When mode is \"query_only\", actions MUST be [] — NEVER create or propose a calendar entry, task or note from a pure lookup question. A date/time word ('today', 'tomorrow', 'next week') inside a question is NEVER an instruction to create anything.\n- \"mutation_action\": a clear imperative or logging instruction ('Remind me to\u2026', 'Schedule\u2026', 'Add a task\u2026', 'Log an expense\u2026').\n- \"hybrid\": ONLY when the lawyer explicitly combines a lookup AND a write command ('What\u2019s my schedule tomorrow, and add a review task at 4 PM?'). Extract ONLY the explicit write clause as an action — never the question clause.\n\nACTION TOOLS — the lawyer may ask you to DO something, not just answer:\n- create_event: create a Court Diary / calendar entry (e.g. 'add a check on the Chukwu matter for tomorrow at 10 AM', 'remind me to file the brief on Friday'). Resolve relative dates ('tomorrow', 'next week', 'in 3 days') using TODAY; if no clock time is given use 09:00. matterId must be copied EXACTLY from the data when a matter is named; omit it when no matter is named. Each create_event action carries a 'note' field — a CONCISE ACTION SUMMARY for the entry's Notes field (what the lawyer must DO, 1-2 sentences, or '- ' bullet lines if the entry involves multiple distinct checks). NEVER copy the lawyer's meta-speech ('I'm trying to set a reminder…', 'can you please…') into the note; strip it and state the task directly.\n- save_note: save a case note to a matter (e.g. 'note that the client confirmed the settlement terms on the Chukwu matter'). The 'content' is CLEAN, PROFESSIONAL TEXT, not the raw instruction: strip the lawyer's meta-speech and filler, use a concise paragraph for a continuous narrative, and switch to '- ' bullets when the instruction lists 3+ distinct items or steps. Never invent facts the lawyer did not state; preserve names, dates, amounts and citations EXACTLY. matterId as above.\n\nAction rules: only act when mode is \"mutation_action\" or \"hybrid\" AND the instruction is a CLEAR command to create or save; if the request is ambiguous or merely asks a question, mode is \"query_only\" and actions MUST be []. At most 3 actions. Prefer event types 'Deadline', 'Meeting', 'Hearing', 'Mention' or 'Task' when unsure.\n\nRespond with STRICT JSON only — no prose, no markdown fences:\n{\"mode\":\"query_only|mutation_action|hybrid\",\"answer\":\"<your answer, ≤120 words>\",\"actions\":[{\"type\":\"create_event\",\"title\":\"...\",\"eventType\":\"Deadline\",\"dateISO\":\"YYYY-MM-DD\",\"time\":\"HH:MM\",\"matterId\":\"...\",\"location\":\"\",\"note\":\"<concise action summary>\"},{\"type\":\"save_note\",\"title\":\"...\",\"content\":\"<clean formatted note text>\",\"matterId\":\"...\"}]}";

/** A slim matter row as buildQuickAskContext consumes. */
export interface QuickAskMatterRow {
  /** Present when the caller can reference matters by id (Quick Ask
   *  actions must copy matterId EXACTLY — the inventory line carries it). */
  id?: string;
  title?: string | null;
  suitNumber?: string | null;
  status?: string | null;
}

/**
 * buildQuickAskContext — the quickAsk grounding context, exported pure for
 * unit tests. Two layers:
 *   1. FIRM DATA SUMMARY — authoritative counts plus a compact matter
 *      inventory (first 25) so counting/inventory questions are answered
 *      from real numbers instead of keyword-match luck.
 *   2. KEYWORD-MATCHED subsets for topical questions, each explicitly
 *      labelled as a subset with its "of N on record" denominator and a
 *      "(no keyword match)" placeholder that can no longer be mistaken for
 *      an empty firm.
 */
export function buildQuickAskContext(args: {
  matters: QuickAskMatterRow[];
  noteCount: number;
  upcomingCount: number;
  matchedMatters: { title: string; detail: string }[];
  matchedNotes: { title: string; detail: string }[];
  upcoming: { title: string; detail: string }[];
}): string {
  const { matters, noteCount, upcomingCount, matchedMatters, matchedNotes, upcoming } = args;
  const statusOf = (m: QuickAskMatterRow) => (m.status || "").toLowerCase();
  const activeCount = matters.filter((m) => statusOf(m) === "active").length;
  const closedCount = matters.filter((m) => ["closed", "archived"].includes(statusOf(m))).length;
  const otherCount = matters.length - activeCount - closedCount;
  const inventoryLines = matters
    .slice(0, 25)
    .map(
      (m) =>
        `- ${m.title || "(untitled matter)"}${m.suitNumber ? ` [${m.suitNumber}]` : ""}${
          m.status ? ` (${m.status})` : ""
        }${m.id ? ` — id: ${m.id}` : ""}`
    );
  const summaryBlock = [
    "FIRM DATA SUMMARY (authoritative — use these numbers for counting questions):",
    `- Matters on record: ${matters.length}` +
      (matters.length > 0
        ? ` (${activeCount} active, ${closedCount} closed/archived${otherCount > 0 ? `, ${otherCount} other status` : ""})`
        : ""),
    `- Notes on record: ${noteCount}`,
    `- Upcoming calendar events (today onwards): ${upcomingCount}`,
    matters.length > 0
      ? `MATTER INVENTORY (first ${inventoryLines.length} of ${matters.length}):\n${inventoryLines.join("\n")}`
      : "MATTER INVENTORY: the firm has no matters on record.",
  ].join("\n");

  return [
    summaryBlock,
    `KEYWORD-MATCHED MATTERS (subset filtered by the question's words — of ${matters.length} on record; empty here means no title matched the wording, NOT that the firm has none):\n${matchedMatters.map((m) => `- [Matter: ${m.title}] ${m.detail}`).join("\n") || "(no keyword match)"}`,
    `KEYWORD-MATCHED NOTES (of ${noteCount}):\n${matchedNotes.map((n) => `- [Note: ${n.title}] ${n.detail}`).join("\n") || "(no keyword match)"}`,
    `UPCOMING SCHEDULE (next 12):\n${upcoming.map((e) => `- [Schedule: ${e.title}] ${e.detail}`).join("\n") || "(nothing scheduled)"}`,
  ].join("\n\n");
}

/**
 * quickAsk — a concise, GROUNDED answer to the lawyer's question, built
 * only from their own firm data (matters, notes, schedule). If the data
 * doesn't contain the answer, it says exactly that — no hallucination.
 */
export const quickAsk = action({
  args: {
    question: v.string(),
    /** Fallback notebook for standalone (matter-less) saved notes. */
    notebookId: v.optional(v.string()),
    callerApiKey: v.optional(v.string()), // the caller's own BYO key
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<QuickAskResult> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `voice_quickask:${auth.userId}`, maxRequests: 20 }
    );
    if (!allowed) throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    const q = (args.question || "").trim().slice(0, 2000);
    if (q.length < 2) throw new Error("Ask a question first.");

    // Firm-scoped retrieval, two layers (owner bug report 2026-11-18: asking
    // "how many matters do I have?" was answered "you have no matters"):
    //   1. A DATA SUMMARY — authoritative counts plus a compact matter
    //      inventory — so counting/inventory questions are answered from
    //      real numbers instead of keyword-match luck. The old prompt led
    //      with "MATCHED MATTERS: (none)" (a keyword miss on generic words
    //      like "how many matters do I have"), which the model read as an
    //      empty firm.
    //   2. Keyword-matched slices for topical questions (a case name, a
    //      suit number, a note topic). No embeddings needed at this scale.
    const terms = Array.from(
      new Set(
        q.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length >= 3)
      )
    );
    const score = (text: string) =>
      terms.reduce((acc, t) => acc + (text.toLowerCase().includes(t) ? 1 : 0), 0);

    const matters: any[] = await ctx.runQuery(
      internal.voiceCaptureInternal.listFirmMattersInternal,
      { firmId: auth.firmId }
    );
    const notePages: any[] = await ctx.runQuery(
      internal.voiceCaptureInternal.listFirmNotePagesInternal,
      { firmId: auth.firmId }
    );
    const events: any[] = await ctx.runQuery(
      internal.voiceCaptureInternal.listFirmEventsInternal,
      { firmId: auth.firmId }
    );

    const nowIso = new Date().toISOString();
    const matchedMatters = matters
      .map((m) => ({ m, s: score(`${m.title || ""} ${m.suitNumber || ""} ${m.status || ""}`) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => ({
        kind: "matter" as const,
        id: x.m.id,
        title: x.m.title || "(untitled matter)",
        detail: [x.m.suitNumber, x.m.status, x.m.court].filter(Boolean).join(" · "),
      }));
    const matchedNotes = notePages
      .map((n) => ({ n, s: score(`${n.title || ""} ${n.contentHead || ""}`) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => ({
        kind: "note" as const,
        id: x.n.id,
        title: x.n.title || "(untitled note)",
        detail: (x.n.contentHead || "").slice(0, 160),
      }));
    const upcoming = events
      .filter((e) => (e.date || "") >= nowIso.slice(0, 10))
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .slice(0, 12)
      .map((e) => ({
        kind: "event" as const,
        id: e.id,
        title: e.title || "(untitled event)",
        detail: `${(e.date || "").slice(0, 16).replace("T", " ")}${e.type ? ` · ${e.type}` : ""}${e.matterTitle ? ` · ${e.matterTitle}` : ""}`,
      }));

    // ── Grounding context: buildQuickAskContext (exported, unit-tested).
    //    Layer 1 = authoritative DATA SUMMARY (counts + inventory); layer 2 =
    //    the keyword-matched subsets above, labelled as subsets.
    const gemini = await resolveGeminiKey(ctx, auth.user, args.callerApiKey);
    if (!gemini) throw new ConvexError("AI is not configured yet — the platform AI key is being set up. Please try again shortly.");

    const contextBlock = buildQuickAskContext({
      matters,
      noteCount: notePages.length,
      upcomingCount: upcoming.length,
      matchedMatters,
      matchedNotes,
      upcoming,
    });

    const lagos = lagosNow(Date.now());
    const answerRaw = await geminiText({
      apiKey: gemini.key,
      system: QUICK_ASK_SYSTEM_PROMPT,
      user: `TODAY (Lagos): ${lagos.weekday}, ${lagos.dateISO}, ${lagos.time}\n\nFIRM DATA:\n${contextBlock}\n\nTHE LAWYER'S QUESTION / INSTRUCTION:\n"""${q}"""`,
      maxTokens: 1024,
    });

    // Parse the JSON envelope; a plain-text answer (older model behaviour,
    // refusal formatting) degrades gracefully to answer-only.
    const envelope = parseModelJson<{ answer?: string; actions?: any[]; mode?: string }>(answerRaw);
    const answer = (envelope?.answer || answerRaw || "").trim();

    // ── READ vs WRITE INTENT GATE (owner bug report 2026-11-19): resolve
    //    the mode from the question text merged with the model's own
    //    verdict, then hard-gate the actions — a pure lookup ("What's my
    //    schedule today?") executes ZERO writes, even when the model
    //    misreads a date keyword as an instruction. The LLM never touches
    //    the database directly either way: gateQuickAskActions →
    //    validateQuickAskActions sanitises proposals against the firm's
    //    real matters, then the internal mutations do the writes with
    //    ownership stamps so the one-tap Undo can verify provenance.
    const actionGate = gateQuickAskActions(q, envelope?.mode, envelope?.actions || [], matters);
    const executed: QuickAskActionResult[] = [];
    for (const act of actionGate.actions) {
      try {
        const matter = act.matterId ? matters.find((m: any) => m.id === act.matterId) : null;
        if (act.type === "create_event") {
          // WAT is UTC+01:00 — build the instant from the Lagos wall clock.
          const startISO = new Date(
            `${act.dateISO}T${act.time || "09:00"}:00+01:00`
          ).toISOString();
          // Wispr-Flow style Notes field (owner spec 2026-11-19): the LLM's
          // concise action summary for THIS entry; when the model omitted it,
          // the deterministic stripMetaSpeech fallback still guarantees the
          // raw conversational instruction never lands in the diary verbatim.
          const eventNote = act.note || stripMetaSpeech(q).slice(0, 400);
          const created: any = await ctx.runMutation(
            internal.voiceCaptureInternal.createDiaryEventInternal,
            {
              firmId: auth.firmId,
              userId: String(auth.user._id),
              title: act.title,
              description: eventNote,
              type: act.type2,
              dateISO: startISO,
              matterId: act.matterId,
              matterTitle: matter?.title || undefined,
            }
          );
          executed.push({
            type: "event",
            status: "created",
            itemId: created.eventId,
            title: created.title,
            dateISO: act.dateISO,
            time: act.time || "09:00",
            matterId: act.matterId,
            matterTitle: matter?.title || undefined,
          });
        } else if (act.type === "save_note") {
          const created: any = await ctx.runMutation(
            internal.voiceCaptureInternal.createCaseNoteInternal,
            {
              firmId: auth.firmId,
              userId: String(auth.user._id),
              title: act.title,
              content: act.content || "",
              matterId: act.matterId,
              // Matter-linked notes live in the matters notebook; standalone
              // ones use the caller's preferred (general) notebook.
              notebookId: act.matterId ? "notebook_matters" : args.notebookId,
            }
          );
          executed.push({
            type: "note",
            status: "created",
            itemId: created.notePageId,
            title: created.title,
            matterId: act.matterId,
            matterTitle: matter?.title || undefined,
          });
        }
      } catch {
        // One failed action must never sink the whole answer.
      }
    }

    return {
      answer,
      mode: actionGate.mode,
      sources: { matters: matchedMatters, notes: matchedNotes, events: upcoming },
      actions: executed,
    };
  },
});

// ─── EDIT SELECTION BY VOICE (owner spec 2026-11-19, Part 2 §6) ────────────

export const EDIT_SELECTION_SYSTEM_PROMPT = `You rewrite ONLY a selected passage of a Nigerian lawyer's note according to a short spoken instruction (e.g. "make this sound firmer and turn the demands into three numbered points").

RULES:
1. Return ONLY the rewritten passage — never the surrounding text, never explanations, never quotes around it.
2. Rewrite ONLY what the instruction asks (tone, structure, brevity, bullets/numbering, clarity). Do not add new facts, dates, names, amounts or legal conclusions that are not already in the passage.
3. Preserve every fact exactly: names, dates, amounts (₦), case citations, statute names, Latin maxims, Nigerian legal terminology.
4. Keep the same professional register unless the instruction says otherwise; Nigerian English spellings (judgement, colour) are correct.
5. If the instruction is not applicable or unintelligible, return the passage unchanged.
6. Expand "- " bullet lists or numbered points when asked; collapse to a paragraph when asked.`;

/**
 * editSelection — the engine behind "Edit Selection by Voice": the user
 * highlights a passage in the Quick Capture staging box (or an editor),
 * speaks an instruction, and ONLY that passage is rewritten in place.
 * The surrounding text is passed for context but is never returned.
 */
export const editSelection = action({
  args: {
    selectedText: v.string(),
    instruction: v.string(),
    /** Optional surrounding passage for context (never rewritten). */
    surroundingText: v.optional(v.string()),
    callerApiKey: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ rewritten: string }> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `voice_editselection:${auth.userId}`, maxRequests: 20 }
    );
    if (!allowed) throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    const selected = (args.selectedText || "").trim().slice(0, 20_000);
    const instruction = (args.instruction || "").trim().slice(0, 2000);
    if (!selected) throw new Error("Select the text you want to edit first.");
    if (!instruction) throw new Error("Say what you want changed, then try again.");

    const gemini = await resolveGeminiKey(ctx, auth.user, args.callerApiKey);
    if (!gemini) throw new ConvexError("AI is not configured yet — the platform AI key is being set up. Please try again shortly.");

    const context = (args.surroundingText || "").trim().slice(0, 6000);
    const out = await geminiText({
      apiKey: gemini.key,
      system: EDIT_SELECTION_SYSTEM_PROMPT,
      user:
        `SPOKEN INSTRUCTION: "${instruction}"\n\n` +
        (context ? `SURROUNDING TEXT (context only — do NOT rewrite): """${context}"""\n\n` : "") +
        `SELECTED PASSAGE (rewrite THIS only):\n"""${selected}"""`,
      maxTokens: 2048,
    });
    const rewritten = out.trim();
    return { rewritten: rewritten || selected };
  },
});

/**
 * undoQuickAskAction — the one-tap Undo behind every Quick Ask confirmation
 * card (owner spec §5: "display a clean confirmation card with a 1-tap link
 * to view or undo it"). Guards live in undoQuickAskItemInternal: firm scope,
 * creator ownership (created_by / authorId) and a 15-minute recency window.
 */
export const undoQuickAskAction = mutation({
  args: {
    kind: v.string(), // "event" | "note"
    itemId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  // NOTE: the explicit return annotation is REQUIRED — returning a
  // ctx.runMutation(internal.…) result directly makes TS infer this
  // mutation's type from the generated api, which itself includes this
  // module's types — a circular reference that degrades ApiFromModules
  // inference for the WHOLE app (TS7022; the same class of failure the
  // voiceCaptureInternal.ts header documents). Annotating breaks the cycle.
  handler: async (ctx, args): Promise<{ undone: boolean }> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const result: { undone: boolean } = await ctx.runMutation(
      internal.voiceCaptureInternal.undoQuickAskItemInternal,
      {
        firmId: auth.firmId,
        userId: String(auth.user._id),
        kind: args.kind,
        itemId: args.itemId,
      }
    );
    return result;
  },
});

// ─── DRAFTPRO VOICE EDIT (owner spec 2026-11-19, §7.4 Phase 4) ──────────────

export const DRAFT_VOICE_EDIT_SYSTEM_PROMPT = `You edit ONE selected passage of a Nigerian legal document in DraftPro according to a short spoken instruction. The surrounding document is court furniture generated by code — you never rewrite it.

Classify the instruction into an intent:
- "add": the instruction ADDS a new item (e.g. an alternative relief, a further ground) after the selected passage. Return ONLY the new item's text.
- "delete": the instruction removes the selected passage. Return an empty string.
- "rewrite": the instruction reworks the selected passage itself (tighten, expand, reword, formalise). Return ONLY the rewritten passage.

RULES:
1. Return STRICT JSON only: {"intent":"add|delete|rewrite","text":"<the new item or the rewritten passage; empty for delete>"}
2. Rewrite ONLY what the instruction asks. Do not add facts, dates, names, amounts or legal conclusions absent from the passage and its context.
3. Preserve every existing fact exactly: names, dates, amounts (₦), citations, statute names, Latin maxims, Nigerian legal terminology.
4. Keep the professional register; Nigerian English spellings (judgement, defence) are correct.
5. For "add" intents, return the new item text alone — never a sentence about adding it.
6. If the instruction is unintelligible or not an edit, return {"intent":"rewrite","text":"<the selected passage unchanged>"}.`;

/**
 * draftVoiceEdit — the engine behind the DraftPro toolbar mic (owner spec
 * §7.4 "Edit Selection by Voice"): the user selects a block (paragraph,
 * relief, ground, argument), speaks an instruction, and ONLY that block
 * changes. Structural/hydrated blocks (court, parties, case number) are
 * guarded CLIENT-SIDE before this action is ever called; this action only
 * ever sees prose passages.
 */
export const draftVoiceEdit = action({
  args: {
    selectedText: v.string(),
    instruction: v.string(),
    documentType: v.optional(v.string()),
    surroundingText: v.optional(v.string()),
    callerApiKey: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ intent: "add" | "delete" | "rewrite"; text: string }> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `voice_draftedit:${auth.userId}`, maxRequests: 20 }
    );
    if (!allowed) throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    const selected = (args.selectedText || "").trim().slice(0, 20_000);
    const instruction = (args.instruction || "").trim().slice(0, 2000);
    if (!selected) throw new Error("Select the passage you want to edit first.");
    if (!instruction) throw new Error("Say what you want changed, then try again.");

    const gemini = await resolveGeminiKey(ctx, auth.user, args.callerApiKey);
    if (!gemini) throw new ConvexError("AI is not configured yet — the platform AI key is being set up. Please try again shortly.");

    const context = (args.surroundingText || "").trim().slice(0, 6000);
    const out = await geminiText({
      apiKey: gemini.key,
      system: DRAFT_VOICE_EDIT_SYSTEM_PROMPT,
      user:
        `DOCUMENT TYPE: ${(args.documentType || "legal document").replace(/_/g, " ")}\n\n` +
        `SPOKEN INSTRUCTION: "${instruction}"\n\n` +
        (context ? `SURROUNDING TEXT (context only — do NOT rewrite): """${context}"""\n\n` : "") +
        `SELECTED PASSAGE:\n"""${selected}"""`,
      maxTokens: 2048,
    });
    const parsed = parseModelJson<{ intent?: string; text?: string }>(out);
    const intent =
      parsed?.intent === "add" || parsed?.intent === "delete" ? parsed.intent : "rewrite";
    const text = String(parsed?.text ?? "").trim();
    return { intent, text: intent === "delete" ? "" : text || selected };
  },
});

// ─── ENDORSEMENT FORMATTING (owner brief 2026-11-24: Aloa Vox into the ──────
//     matter endorsement composer — Antigravity audit follow-up 2026-11-25) ──

/**
 * ENDORSEMENT_FORMAT_SYSTEM_PROMPT — exported for unit tests. Tidies a
 * dictated case endorsement WITHOUT inventing anything: filler removal and
 * structure only. The matter context lines (title / suit number) are
 * REFERENCE-ONLY grounding so the model never "corrects" a name it half
 * heard — they are never a licence to add facts the lawyer did not say.
 *
 * ROUND 25 (ALOA Vox intelligence overhaul, owner bug report 2026-11-28):
 * (a) LEGAL HOMOPHONE repair — the STT layer can still mis-hear domain
 *     terms ("hearing of emotion" for "hearing of motion", "council" for
 *     "counsel"), so the cleanup pass fixes the unambiguous litigation
 *     mis-hearings; (b) STUTTER / false-start repair beyond single fillers
 *     ("the judge the judge", "they said they were going to they were
 *     opposed to"); (c) the STANDARD NIGERIAN COURTROOM ENDORSEMENT SEQUENCE
 *     — regardless of the order dictated, the cleaned endorsement runs
 *     Appearance/Counsel → Proceedings → Ruling/Orders & directives → Next
 *     date & purpose, using only the dictated facts.
 */
export const ENDORSEMENT_FORMAT_SYSTEM_PROMPT = `You tidy a Nigerian lawyer's spoken case endorsement (a note dictated into the matter timeline) so it reads as a clean professional entry — WITHOUT changing what was said.

RULES:
1. Remove filler and false starts ("erm", "okay so", "let me", repeated phrases, self-corrections where the final wording survives) and fix punctuation and capitalisation.
2. Resolve stutters and immediate phrase repetitions: "my time and the judge the judge said" becomes "the judge said"; "they said they were going to they were opposed to" becomes "they said they were opposed to". Keep the final wording; discard the abandoned fragment entirely.
3. Fix UNAMBIGUOUS legal-domain mis-hearings only: "hearing of emotion" → "hearing of motion"; "council" → "counsel" when it denotes a lawyer appearing in court (keep "council" when a legislative or local-government council is clearly meant); "Barister" → "Barrister". When a term is ambiguous, leave it exactly as dictated.
4. Preserve the lawyer's voice: first-person, plain professional register.
5. NEVER add anything the note does not say: no names, dates, amounts, courts, coram, case citations, suit numbers, legal conclusions, jurisdictions, participants or next steps that are not already in the dictated text. If the note mentions no date, no court and no amount, the formatted endorsement has none either.
6. Keep every fact EXACTLY as dictated: names, dates, amounts (₦), suit numbers, statutes, Latin maxims, Nigerian legal terminology. Do not "correct", normalise or paraphrase them into something else.
7. The MATTER CONTEXT (title / suit number), when supplied, is reference only — use it to avoid mangling a name or suit number it happens to contain; never copy anything from it into the endorsement.
8. Structure only what was said: short paragraphs; "- " bullets only when the lawyer listed distinct items; a numbered list only when they enumerated steps in order.
9. STANDARD COURTROOM ENDORSEMENT SEQUENCE: whatever order the facts were dictated in, present them in the standard Nigerian endorsement order — (i) Appearance / counsel (who appeared and for which party), (ii) Proceedings (the application or business before the court and the submissions made), (iii) Ruling / orders and party directives (what the court ruled or ordered, and what each party is to file or do), (iv) Next date and its purpose. Omit any stage the lawyer did not speak about; never invent a stage. Do not add headings the lawyer did not say — the surrounding file jacket carries its own.
10. Nigerian English spellings (judgement, colour, learnt) are correct — never Americanise.
11. Return ONLY the formatted endorsement text — no headings, no explanations, no quotes around it, no markdown fences.
12. If the note is already clean, return it unchanged.`;

/**
 * ROUND 25 (FEATURE 6 — one shared intelligence layer across surfaces): the
 * capture context that adapts the SAME cleanup engine's output structure.
 * Court Mode passes "court_hearning" (full endorsement-sequence rule);
 * conversation-style surfaces keep the dialogue structure; drafting surfaces
 * keep the drafting register. Kept deliberately small — the no-invention
 * guardrails above apply in EVERY context.
 */
const ENDORSEMENT_CONTEXT_NOTES: Record<string, string> = {
  court_hearing:
    "CONTEXT: this endorsement was dictated in COURT MODE, immediately after a hearing. Apply the STANDARD COURTROOM ENDORSEMENT SEQUENCE rule in full — Appearance/counsel first, then proceedings, then ruling/orders and party directives, then the next date and its purpose.",
  client_consultation:
    "CONTEXT: this note was dictated after a CLIENT CONSULTATION. Keep the consultation structure — issues discussed, client instructions, agreed next steps — in the order the lawyer gave them.",
  process_drafting:
    "CONTEXT: this text is dictation toward a COURT PROCESS draft. Keep the drafting register and the order the lawyer dictated; do not restructure into endorsement sequence.",
  general_note:
    "",
};

/**
 * formatEndorsement — the engine behind the endorsement composer's Format
 * button and the auto-format-on-dictation-stop (TeamDiscussionTab, and since
 * ROUND 25 the Court Mode cleanup pass — ONE shared intelligence layer for
 * every Vox surface). One shot: no storage row, no capture pipeline — the
 * text in, the tidied text out. Grounded by an optional matter title/suit
 * number pair so a half-heard name is not silently "corrected" into
 * something else, with the optional `context` adapting the output structure
 * (court hearing vs consultation vs process drafting vs general note).
 */
export const formatEndorsement = action({
  args: {
    endorsementText: v.string(),
    matterTitle: v.optional(v.string()),
    matterSuitNumber: v.optional(v.string()),
    /** ROUND 25 (FEATURE 6): the capture context — "court_hearing" |
     *  "client_consultation" | "process_drafting" | "general_note". One
     *  shared engine, structure adapted to the surface it serves. */
    context: v.optional(v.string()),
    callerApiKey: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ formatted: string }> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `voice_formatendorsement:${auth.userId}`, maxRequests: 20 }
    );
    if (!allowed) throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    const endorsement = (args.endorsementText || "").trim().slice(0, 20_000);
    if (!endorsement) throw new Error("Dictate or type the endorsement first, then format it.");

    const gemini = await resolveGeminiKey(ctx, auth.user, args.callerApiKey);
    if (!gemini) throw new ConvexError("AI is not configured yet — the platform AI key is being set up. Please try again shortly.");

    const matterTitle = (args.matterTitle || "").trim().slice(0, 300);
    const matterSuitNumber = (args.matterSuitNumber || "").trim().slice(0, 100);
    const matterContext =
      matterTitle || matterSuitNumber
        ? `MATTER CONTEXT (reference only — NEVER copy from it into the endorsement):\n` +
          `Title: ${matterTitle || "(not stated)"}\nSuit number: ${matterSuitNumber || "(not stated)"}\n\n`
        : "";
    // ROUND 25 (FEATURE 6): the capture context adapts the shared engine's
    // structure — Court Mode's cleanup passes "court_hearing".
    const contextNote = ENDORSEMENT_CONTEXT_NOTES[args.context || "general_note"] ?? "";

    const out = await geminiText({
      apiKey: gemini.key,
      system: ENDORSEMENT_FORMAT_SYSTEM_PROMPT,
      user:
        (contextNote ? `${contextNote}\n` : "") +
        matterContext +
        `DICTATED ENDORSEMENT (format THIS only):\n"""${endorsement}"""`,
      maxTokens: 2048,
    });
    const formatted = out.trim();
    // The model returning nothing is not a reason to eat the lawyer's words.
    return { formatted: formatted || endorsement };
  },
});

