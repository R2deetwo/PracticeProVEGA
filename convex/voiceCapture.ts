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
import { QUALITY_MODEL } from "./aiModels";

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
  return [...segmentTexts]
    .sort((a, b) => a.index - b.index)
    .map((s) => (s.text || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
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

export function buildVerbatimPrompt(continuationTail?: string): string {
  return [
    "You are a verbatim speech-to-text transcription engine for a Nigerian legal practice.",
    "Transcribe EXACTLY what is spoken — word for word. Do NOT clean up, summarise, punctuate beyond natural pauses, or remove fillers (um, uh, repetitions).",
    "Preserve Nigerian names (Chidi, Ngozi, Adebayo...), titles (Barrister, SAN, Hon. Justice), amounts in Naira, dates, case names, statute names, and Latin legal terms exactly as spoken.",
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
2. RESOLVE MID-SENTENCE SELF-CORRECTIONS: when the speaker corrects themselves — e.g. "Tuesday... actually make that Thursday", or "twenty million — sorry, twenty-five million" — keep ONLY the corrected value (Thursday; twenty-five million). Discard the abandoned version.
3. Add punctuation, capitalisation, and paragraph breaks based on natural pauses and topic shifts. Do not add headings the speaker did not say.
4. Preserve VERBATIM and never change: names, dates, times, amounts (₦ figures), addresses, phone numbers, case citations (e.g. [2023] NWLR (Pt 1291) 1; (2023) LPELR-58880(SC); FGN v. ABC Ltd (2020) LPELR-99999(CA)), statute names (Evidence Act 2011, CFRN 1999), Latin legal phrases (habeas corpus, inter alia, res judicata, ratio decidendi, locus standi), and Nigerian legal terminology (affidavit, tenancy, deed of assignment, governor's consent).
5. Fix ONLY obvious recognition mis-transcriptions of Nigerian legal/property terms ("affi davit" → "affidavit", "tenency" → "tenancy", "Barister" → "Barrister"). If unsure, leave the word as-is.
6. Preserve Nigerian English spellings (judgement, colour).
7. If the speaker uses Nigerian Pidgin, preserve the Pidgin phrasing; do not translate to English.
8. NEVER add, infer, or reorder factual content. When ambiguous, leave as-is.
9. Return ONLY the cleaned text.`;

function eventTypesLine(names: string[]): string {
  const safe = (names || []).filter(Boolean).slice(0, 12).join(", ");
  return safe || "Meeting, Hearing, Mention, Deadline, Consultation";
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

RULES:
- Never invent facts absent from both records.
- Names, dates, amounts (₦), case citations, and legal terminology must be copied EXACTLY as they appear in the records.
- Where the shorthand and the verbatim conflict, surface it under Discrepancies rather than silently choosing one.
- Write in clean professional English; preserve Nigerian Pidgin quotes verbatim inside quotation marks if quoting the client.
- Return ONLY the structured summary text (with the five numbered section headings above).`;
}

// ─── Key resolution & provider layer ───────────────────────────────────────

type GeminiKey = { key: string } | null;

async function resolveGeminiKey(
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
    throw new Error(`Whisper API ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const text = (data?.text || "").trim();
  if (!text) throw new Error("Whisper returned no text for this segment.");
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

/**
 * The provider chain: Whisper when the platform key exists, else Gemini.
 * Returns the text plus which provider produced it (recorded per segment
 * and per capture for the audit trail).
 */
export async function transcribeSegment(_ctx: any, opts: {
  wavBytes: Uint8Array;
  wavBase64: string;
  user: any;
  callerKey?: string | null;
  continuationTail?: string;
}): Promise<{ text: string; provider: string }> {
  const openAiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (openAiKey) {
    try {
      const text = await transcribeWithWhisper({
        wavBytes: opts.wavBytes,
        apiKey: openAiKey,
        model: (process.env.TRANSCRIPTION_MODEL || "whisper-1").trim(),
        prompt: opts.continuationTail,
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

/** Generic Gemini text completion (polish / triage / merge / quick ask). */
async function geminiText(opts: {
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
}

export interface QuickAskSource {
  kind: "matter" | "note" | "event";
  id: string;
  title: string;
  detail: string;
}

export interface QuickAskResult {
  answer: string;
  sources: { matters: QuickAskSource[]; notes: QuickAskSource[]; events: QuickAskSource[] };
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
    callerApiKey: v.optional(v.string()), // the caller's own BYO key
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()), // ignored — session is the proof
  },
  handler: async (ctx, args): Promise<UploadSegmentResult> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
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
    });

    const row: any = await ctx.runQuery(internal.voiceCaptureInternal.getCaptureInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
    });

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
    const storageId = await ctx.storage.store(
      new Blob([wavBytes.buffer as ArrayBuffer], { type: "audio/wav" })
    );

    const { text, provider } = await transcribeSegment(ctx, {
      wavBytes,
      wavBase64: args.audioBase64,
      user: auth.user,
      callerKey: args.callerApiKey,
      continuationTail,
    });

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
          text,
          provider,
          at: Date.now(),
        },
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
    callerApiKey: v.optional(v.string()), // the caller's own BYO key
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<FinalizeCaptureResult> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `voice_finalize:${auth.userId}`, maxRequests: 15 }
    );
    if (!allowed) throw new Error("Rate limit exceeded. Please wait a moment and try again.");

    const row: any = await ctx.runQuery(internal.voiceCaptureInternal.getCaptureInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
    });
    if (!row) throw new Error("Capture not found.");

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
    const lastProvider = [...texts].sort((a, b) => b.index - a.index)[0]?.provider || null;
    const shorthand =
      typeof args.shorthandText === "string" ? args.shorthandText : row.shorthandText || "";

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
    const patch: any = {
      verbatimText: verbatim,
      provider: lastProvider,
      status: "ready",
      durationMs: args.totalDurationMs ?? row.durationMs ?? null,
    };
    if (shorthand !== (row.shorthandText || "")) patch.shorthandText = shorthand;

    // ── Smart Clean (quick captures only — the legal pad's polish tier is
    //    the merged summary, and its transcript tier stays verbatim).
    if (row.kind === "quick" && row.outputMode === "smart-clean") {
      if (gemini) {
        try {
          const cleaned = await geminiText({
            apiKey: gemini.key,
            system: SMART_CLEAN_SYSTEM_PROMPT,
            user: `Clean this transcript:\n\n${verbatim.slice(0, MAX_TRANSCRIPT_CHARS)}`,
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

    // ── Triage (quick captures): the single best next action.
    if (row.kind === "quick" && gemini) {
      try {
        const matters: any[] = await ctx.runQuery(
          internal.voiceCaptureInternal.listFirmMattersInternal,
          { firmId: auth.firmId }
        );
        const contacts: any[] = await ctx.runQuery(
          internal.voiceCaptureInternal.listFirmContactsInternal,
          { firmId: auth.firmId }
        );

        const triageRaw = await geminiText({
          apiKey: gemini.key,
          system: "You are a precise triage assistant. Respond with strict JSON only.",
          user:
            buildTriagePrompt({
              lagos: lagosNow(Date.now()),
              matters,
              contacts,
              eventTypeNames: args.eventTypeNames || [],
            }) + `\n\nTHE VOICE NOTE TRANSCRIPT:\n"""${verbatim.slice(0, MAX_TRANSCRIPT_CHARS)}"""`,
          maxTokens: 2048,
        });
        const parsed = parseModelJson<any>(triageRaw);
        if (parsed) {
          const matched = matchMatterCandidates(
            parsed.matterCandidates || [],
            matters,
            contacts
          );
          const triageMeta = {
            ...parsed,
            matchedMatterIds: matched.matchedMatterIds,
            matchedContactIds: matched.matchedContactIds,
          };
          patch.triageIntent = parsed.intent || "share";
          patch.triageMeta = triageMeta;
          result.triageIntent = patch.triageIntent;
          result.triageMeta = triageMeta;
        } else {
          result.triageError = "Triage returned unparseable output.";
        }
      } catch (err: any) {
        result.triageError = err?.message || "Triage failed.";
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
    return rows.slice(0, Math.min(args.limit ?? 15, 30)).map((r) => projectCapture(r, true));
  },
});

/** Load a capture row firm-scoped from a mutation/query context (has ctx.db). */
async function loadOwnedCapture(ctx: any, auth: { firmId: string }, clientLocalId: string) {
  const row: any = await ctx.db
    .query("voiceCaptures")
    .withIndex("by_client_local_id", (q: any) => q.eq("clientLocalId", clientLocalId))
    .first();
  if (!row) throw new Error("Capture not found.");
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
    return base;
  }
  base.verbatimText = row.verbatimText;
  base.smartCleanText = row.smartCleanText;
  base.mergedSummary = row.mergedSummary;
  base.shorthandText = row.shorthandText;
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

/** deleteCapture — remove the row and its archived audio. */
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
    await ctx.db.delete(row._id);
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
    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `voice_polish:${auth.userId}`, maxRequests: 10 }
    );
    if (!allowed) throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    const row: any = await ctx.runQuery(internal.voiceCaptureInternal.getCaptureInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
    });
    if (!row) throw new Error("Capture not found.");
    if (!row.verbatimText) throw new Error("Nothing to polish yet.");
    const gemini = await resolveGeminiKey(ctx, auth.user, args.callerApiKey);
    if (!gemini) throw new Error("No AI key available for Smart Clean.");
    const cleaned = await geminiText({
      apiKey: gemini.key,
      system: SMART_CLEAN_SYSTEM_PROMPT,
      user: `Clean this transcript:\n\n${row.verbatimText.slice(0, MAX_TRANSCRIPT_CHARS)}`,
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
 * quickAsk — a concise, GROUNDED answer to the lawyer's question, built
 * only from their own firm data (matters, notes, schedule). If the data
 * doesn't contain the answer, it says exactly that — no hallucination.
 */
export const quickAsk = action({
  args: {
    question: v.string(),
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

    // Firm-scoped retrieval. Simple normalised-term scoring (no embeddings
    // needed at this scale): matters + notes matched on the question's
    // terms; the upcoming schedule is always included for date questions.
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

    const gemini = await resolveGeminiKey(ctx, auth.user, args.callerApiKey);
    if (!gemini) throw new ConvexError("AI is not configured yet — the platform AI key is being set up. Please try again shortly.");

    const contextBlock = [
      `MATCHED MATTERS (of ${matters.length} on record):\n${matchedMatters.map((m) => `- [Matter: ${m.title}] ${m.detail}`).join("\n") || "(none)"}`,
      `MATCHED NOTES (of ${notePages.length}):\n${matchedNotes.map((n) => `- [Note: ${n.title}] ${n.detail}`).join("\n") || "(none)"}`,
      `UPCOMING SCHEDULE (next 12):\n${upcoming.map((e) => `- [Schedule: ${e.title}] ${e.detail}`).join("\n") || "(nothing scheduled)"}`,
    ].join("\n\n");

    const lagos = lagosNow(Date.now());
    const answer = await geminiText({
      apiKey: gemini.key,
      system:
        "You answer a Nigerian lawyer's questions using ONLY the firm data provided. Be concise (≤120 words). Cite what you used inline as [Matter: X], [Note: Y] or [Schedule: Z]. If the data does not contain the answer, say so plainly and name what is missing (e.g. 'no matter with that name is on record'). Never invent matters, dates, figures or case details.",
      user: `TODAY (Lagos): ${lagos.weekday}, ${lagos.dateISO}\n\nFIRM DATA:\n${contextBlock}\n\nTHE LAWYER'S QUESTION:\n"""${q}"""`,
      maxTokens: 1024,
    });

    return { answer, sources: { matters: matchedMatters, notes: matchedNotes, events: upcoming } };
  },
});
