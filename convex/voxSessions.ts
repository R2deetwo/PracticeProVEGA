/**
 * voxSessions.ts — the Legal Session Capture backend (dual-mode Vox, owner
 * spec 2026-11-22).
 *
 * Mode A (Quick Dictation) lives untouched in voiceCapture.ts — zero
 * regression. This module is Mode B: the Plaud-style session workflow for
 * longer legal work — client intakes, witness interviews, strategy
 * debriefs, post-hearing notes, general meetings.
 *
 *   uploadSegment    — archive + DIARIZED transcription per 60s segment
 *                      (always speaker-attributed; a solo session simply
 *                      yields one speaker). Idempotent on
 *                      (clientLocalId, segmentIndex); offline replays safe.
 *   finalizeSession  — flatten + reconcile the speakers into the final
 *                      speaker-attributed transcript (voxTranscriptSegments),
 *                      then the ONE-Click legal synthesis (voxOutputs):
 *                      a File Note (Stated Facts / Client Instructions /
 *                      Legal Issues Identified), an Action & Deadline
 *                      checklist, and a structured Issue & Fact map —
 *                      plus the cross-session search chunks (voxChunks).
 *   generateFollowUpDraft — optional client recap / internal memo /
 *                      instruction confirmation letter, flagging
 *                      [Unverified Fact] / [Missing Detail] instead of
 *                      inventing.
 *   askVox           — "Ask Aloa Vox": full-text retrieval over the user's
 *                      voxChunks (optionally scoped to one matter) with a
 *                      grounded answer citing Session Title · [MM:SS].
 *
 * Security follows the house rules: every public function authenticates by
 * session bearer (never caller-supplied identity), is firm+user scoped,
 * rate-limited, payload-capped, and re-checks ownership server-side. Vox
 * is Pro-and-above (tierLimits.canUseVox: Pro | Enterprise | Komplete —
 * the same entitlement the client's useFeatures().canUseVox applies).
 * Stale wording said "Growth"; the code has gated on Pro since
 * 2026-11-23 (owner: "It should be in Pro, not in Growth anymore").
 *
 * Architecture note (same trap as voiceCapture): actions reach the database
 * only through internal.voxSessionsInternal.* — never internal.<this
 * module> — and every action handler carries an explicit return-type
 * annotation to break the circular type-inference cycle.
 */

import { action, query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { requireFirmUser } from "./authHelpers";
import { canUseVox, effectiveFirmPlan } from "./tierLimits";
import { QUALITY_MODEL } from "./aiModels";
import {
  VOX_UPGRADE_REQUIRED_MESSAGE,
  transcribeSegment,
  geminiText,
  resolveGeminiKey,
  decodeBase64ToBytes,
  sanitizeSegmentText,
  wavRmsLevel,
  SILENT_RMS_THRESHOLD,
  flattenSegmentTurns,
  parseReconcileResult,
  fallbackSpeakerTurns,
  buildSpeakerReconcilePrompt,
} from "./voiceCapture";
// Pure, dependency-free helpers shared with the client bundle — safe for
// the Convex bundler (zero imports of its own; same convention as
// voiceCapture's draftUtils import).
import { defaultSpeakerLabels } from "../src/services/voice/draftUtils";

// ─── Caps & limits ─────────────────────────────────────────────────────────

/** Max base64 audio per segment call (~4 MB binary → ~5.5 MB base64). */
const MAX_AUDIO_BASE64_CHARS = 5_500_000;
/** Max wall-clock length of ONE segment (client slices at ≤75s; headroom). */
const MAX_SEGMENT_MS = 5 * 60 * 1000;
/** Max transcript characters fed to a synthesis pass. */
const MAX_TRANSCRIPT_CHARS = 200_000;
/** Max chunks returned by an Ask Vox retrieval pass. */
const ASK_VOX_CHUNK_CAP = 24;

// ─── Session type vocabulary ───────────────────────────────────────────────

export const VOX_SESSION_TYPES = [
  "intake",
  "interview",
  "debrief",
  "court_note",
  "meeting",
] as const;
export type VoxSessionType = (typeof VOX_SESSION_TYPES)[number];

/** Human label for a session type id (client + prompts). */
export function voxSessionTypeLabel(t: string): string {
  switch (t) {
    case "intake":
      return "Client Intake";
    case "interview":
      return "Witness / Third-Party Interview";
    case "debrief":
      return "Strategy & Chambers Debrief";
    // ROUND 20: an endorsement in Nigerian practice (owner vocabulary).
    case "court_note":
      return "Endorsement";
    case "meeting":
      return "General Meeting";
    default:
      return "Session";
  }
}

// ─── Pure timing helpers (exported for tests) ──────────────────────────────

/** A raw per-segment diarized turn record as stored on the session row. */
export interface RawSegmentTurns {
  index: number;
  startMs: number;
  endMs: number;
  turns: { speaker: string; text: string }[];
}

/** A flat turn with an APPROXIMATE start offset — turns inside one 60s
 * segment share that segment's window; each turn's start is interpolated
 * by its share of the segment's words (honest enough for a [MM:SS] seek
 * tag; the exact audio boundaries live in the archived segment). */
export interface TimedTurn {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
}

/** Flatten segment turns in order, interpolating per-turn timestamps by
 * word share within each segment's [startMs, endMs] window. Pure. */
export function withApproxTimestamps(segTurns: RawSegmentTurns[]): TimedTurn[] {
  const ordered = [...segTurns].sort((a, b) => a.index - b.index);
  const out: TimedTurn[] = [];
  for (const seg of ordered) {
    const turns = (seg.turns || []).filter((t) => (t.text || "").trim().length > 0);
    if (turns.length === 0) continue;
    const windowMs = Math.max(0, seg.endMs - seg.startMs);
    const totalWords = turns.reduce((n, t) => n + Math.max(1, t.text.split(/\s+/).length), 0);
    let cursor = seg.startMs;
    turns.forEach((t, i) => {
      const share = (Math.max(1, t.text.split(/\s+/).length) / totalWords) * windowMs;
      const startMs = Math.round(cursor);
      cursor += share;
      const endMs = i === turns.length - 1 ? seg.endMs : Math.round(cursor);
      out.push({ speaker: String(t.speaker || "1"), text: t.text.trim(), startMs, endMs });
    });
  }
  return out;
}

/** "[MM:SS]" (or "H:MM:SS" past the hour) for a millisecond offset. Pure. */
export function formatTimestampTag(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ─── Synthesis prompt + parser (exported for tests) ────────────────────────

export const SESSION_SYNTHESIS_SYSTEM_PROMPT = `You are a Nigerian legal practice's session secretary. You receive the speaker-attributed transcript of a recorded legal session (a client intake, a witness interview, a chambers strategy debrief, a post-hearing note, or a general meeting) and produce the firm's standard session records.

Return ONLY a JSON object — no prose, no code fence:
{
  "fileNote": "<markdown file note>",
  "actionItems": [{"task": "<follow-up>", "owner": "<who owes it>", "dueDateText": "<date/deadline as stated, or empty string>"}],
  "issueMap": [
    {"category": "key_facts", "nodes": ["..."]},
    {"category": "admissions_contradictions", "nodes": ["..."]},
    {"category": "open_questions", "nodes": ["..."]},
    {"category": "next_steps", "nodes": ["..."]}
  ]
}

FILE NOTE rules — chronological, objective, court-usable:
- Start with a one-line header: "Session record — <session type>, <date>" then a "Present / Speakers" line naming each labelled speaker.
- Then exactly these sections, in order, as H2 (## Stated Facts, ## Client Instructions, ## Legal Issues Identified). For a witness interview use "## Witness Account" in place of "## Client Instructions"; for a post-hearing note use "## Proceedings Observed"; for a debrief use "## Strategy Discussed". Omit a section only if nothing in the transcript supports it.
- EVERY statement must come from the transcript. Attribute facts to the speaker who stated them ("Counsel advised…", "Client stated…"). Never merge speakers.
- If the speaker said something uncertain, incomplete or unverifiable, keep it and tag it inline as [Unverified Fact] or [Missing Detail] rather than guessing or smoothing it over.
- NEVER invent dates, amounts, names, statutes or case citations. Quote amounts and dates exactly as spoken (₦, plot numbers, suit numbers).
- Preserve Nigerian legal terms and Latin phrases verbatim. Do not translate Pidgin phrases.
- Timestamps: cite the session clock for load-bearing statements, e.g. "(at 04:12)".

ACTION ITEMS rules:
- Follow-ups, evidence/document requests, filing tasks and mentioned deadlines ONLY — each traceable to the transcript.
- owner: the speaker who took it on ("Counsel", "Client", "Witness", or a named person). Empty string if unstated.
- dueDateText: the date EXACTLY as stated ("before the 14th", "next week Tuesday"). Empty string when none was mentioned — never invent one.
- No more than 12 items; only genuinely actionable ones.

ISSUE MAP rules — exactly the four categories above (empty arrays when nothing fits):
- key_facts: the load-bearing facts, each one line, attributed.
- admissions_contradictions: admissions, denials, and any statements that conflict with each other.
- open_questions: what the firm still needs to find out or confirm.
- next_steps: the immediate practical moves (may overlap action items, one line each).

You are a record-keeper, not an advocate: neutral language, no advice beyond what was actually discussed.`;

/** The synthesis result shape (client view; ids + completion added here). */
export interface SynthesisResult {
  fileNoteMarkdown: string;
  actionItems: { id: string; task: string; owner: string; dueDateText: string; completed: boolean }[];
  issueMap: { category: string; nodes: string[] }[];
}

const ISSUE_MAP_CATEGORIES = [
  "key_facts",
  "admissions_contradictions",
  "open_questions",
  "next_steps",
] as const;

/** Parse + sanitize the synthesis model output. Returns null when the
 * output is unparseable as an object. Pure, exported for tests. */
export function parseSynthesisResult(raw: string): SynthesisResult | null {
  const parsed = safeJson(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const fileNote = typeof parsed.fileNote === "string" ? parsed.fileNote.trim() : "";
  if (!fileNote) return null;

  const actionItems: SynthesisResult["actionItems"] = [];
  if (Array.isArray(parsed.actionItems)) {
    for (const a of parsed.actionItems.slice(0, 12)) {
      const task = String(a?.task || "").trim().slice(0, 500);
      if (!task) continue;
      actionItems.push({
        id: `act-${actionItems.length + 1}`,
        task,
        owner: String(a?.owner || "").trim().slice(0, 80),
        dueDateText: String(a?.dueDateText || "").trim().slice(0, 120),
        completed: false,
      });
    }
  }

  const issueMap: SynthesisResult["issueMap"] = [];
  if (Array.isArray(parsed.issueMap)) {
    for (const cat of ISSUE_MAP_CATEGORIES) {
      const found = parsed.issueMap.find(
        (c: any) => String(c?.category || "").toLowerCase() === cat
      );
      const nodes = Array.isArray(found?.nodes)
        ? found.nodes
            .map((n: any) => String(n || "").trim().slice(0, 300))
            .filter(Boolean)
            .slice(0, 12)
        : [];
      issueMap.push({ category: cat, nodes });
    }
  } else {
    for (const cat of ISSUE_MAP_CATEGORIES) issueMap.push({ category: cat, nodes: [] });
  }

  return { fileNoteMarkdown: fileNote.slice(0, 60_000), actionItems, issueMap };
}

/** Lenient JSON extraction (fences, leading prose) — same discipline as
 * parseModelJson but local so this module stays dependency-light. */
function safeJson(text: string): any {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** The synthesis user prompt: the labelled, timestamped transcript. */
export function buildSynthesisUserPrompt(opts: {
  sessionType: string;
  sessionTypeLabel: string;
  matterTitle: string | null;
  lawyerName: string | null;
  lagosDate: string;
  turns: { speakerLabel: string; text: string; startMs: number }[];
}): string {
  const header = [
    `SESSION TYPE: ${opts.sessionTypeLabel} (${opts.sessionType})`,
    opts.matterTitle ? `LINKED MATTER: ${opts.matterTitle}` : "LINKED MATTER: none (standalone session)",
    `RECORDING LAWYER: ${opts.lawyerName || "the signing counsel"}`,
    `DATE (Lagos): ${opts.lagosDate}`,
  ].join("\n");
  const transcript = opts.turns
    .map((t) => `[${t.speakerLabel} · ${formatTimestampTag(t.startMs)}] ${t.text}`)
    .join("\n")
    .slice(0, MAX_TRANSCRIPT_CHARS);
  return `${header}\n\nSPEAKER-ATTRIBUTED TRANSCRIPT:\n"""${transcript}"""`;
}

// ─── Search chunking (exported for tests) ──────────────────────────────────

/** Build the Ask Vox search chunks: transcript turns grouped into
 * ~700-char windows (consecutive turns merged, timestamp = the window's
 * first turn) + the file note split into its sections. Pure. */
export function buildSearchChunks(
  turns: { speakerLabel: string; text: string; startMs: number }[],
  fileNoteMarkdown: string | null
): { kind: "transcript" | "file_note"; timestampMs: number; text: string }[] {
  const chunks: { kind: "transcript" | "file_note"; timestampMs: number; text: string }[] = [];
  let buffer = "";
  let bufferStart = 0;
  const flush = () => {
    const text = buffer.trim();
    if (text) chunks.push({ kind: "transcript", timestampMs: bufferStart, text: text.slice(0, 1200) });
    buffer = "";
  };
  for (const t of turns) {
    const line = `${t.speakerLabel}: ${t.text}`;
    if (!buffer) bufferStart = t.startMs;
    if ((buffer + "\n" + line).length > 700) flush();
    buffer = buffer ? `${buffer}\n${line}` : line;
  }
  flush();

  if (fileNoteMarkdown && fileNoteMarkdown.trim()) {
    // Split the note on H2 section boundaries; each section is one chunk
    // (timestamp 0 — the note is a whole-session artifact).
    const sections = fileNoteMarkdown
      .split(/\n(?=##\s)/g)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const s of sections) {
      chunks.push({ kind: "file_note", timestampMs: 0, text: s.slice(0, 1500) });
    }
  }
  return chunks.slice(0, 160);
}

// ─── Follow-up draft prompts (exported for tests) ─────────────────────────

export const VOX_DRAFT_TYPES = ["client_recap", "internal_memo", "instruction_confirmation"] as const;
export type VoxDraftType = (typeof VOX_DRAFT_TYPES)[number];

export function buildFollowUpPrompt(opts: {
  type: VoxDraftType;
  turns: { speakerLabel: string; text: string; startMs: number }[];
  matterTitle: string | null;
  lawyerName: string | null;
  lagosDate: string;
}): { system: string; user: string } {
  const transcript = opts.turns
    .map((t) => `[${t.speakerLabel} · ${formatTimestampTag(t.startMs)}] ${t.text}`)
    .join("\n")
    .slice(0, MAX_TRANSCRIPT_CHARS);
  const context = `MATTER: ${opts.matterTitle || "(standalone session)"}\nRECORDING LAWYER: ${opts.lawyerName || "the signing counsel"}\nDATE (Lagos): ${opts.lagosDate}\n\nSPEAKER-ATTRIBUTED TRANSCRIPT:\n"""${transcript}"""`;
  const commonRules =
    "Ground every statement in the transcript. Where a fact was not stated or is uncertain, write [Unverified Fact] or [Missing Detail] inline instead of inventing. Never invent statutes, cases, dates or amounts. Keep Nigerian legal terms and ₦ figures exactly as spoken.";
  switch (opts.type) {
    case "client_recap":
      return {
        system: `You draft a warm but precise client recap note from a recorded session, for the client of a Nigerian law practice. Plain professional English, short paragraphs, then a clear "Next steps" list (only steps actually discussed). End with the firm's standard closing line placeholder "[Firm signature]". ${commonRules}`,
        user: context,
      };
    case "internal_memo":
      return {
        system: `You draft an internal chambers memo from a recorded session: To / From / Re / Date header lines (From = the recording lawyer, To = "[Partner]", Re = the matter), then a 3-6 paragraph factual summary, then "Issues" and "Recommended next steps" (only what was actually discussed — label anything beyond the transcript [Missing Detail]). ${commonRules}`,
        user: context,
      };
    case "instruction_confirmation":
      return {
        system: `You draft an instruction confirmation letter from a recorded session: it restates, in numbered paragraphs, ONLY the instructions the client actually gave in the session, quotes key dates/amounts exactly, flags any instruction that was ambiguous as [Unverified Fact], and closes by inviting correction within a stated review window of "[X] days" (placeholder — never invent a number). Formal Nigerian legal register. ${commonRules}`,
        user: context,
      };
  }
}

// ─── Ask Vox prompt (exported for tests) ───────────────────────────────────

export const ASK_VOX_SYSTEM_PROMPT = `You answer a Nigerian lawyer's question from THEIR OWN recorded session excerpts — client consultations, witness interviews, debriefs and court notes. Rules:
- Answer ONLY from the excerpts provided. Each excerpt is tagged "— SessionTitle · [MM:SS]".
- Cite the source inline for every claim, exactly as [SessionTitle · MM:SS] (copy the tag text verbatim from its excerpt header).
- If the excerpts do not contain the answer, say so plainly: "That is not in your recordings yet." — never guess, never general legal knowledge.
- Quote amounts, dates and names exactly as they appear. Note conflicts between sessions rather than silently picking one.
- Be concise: 2-6 sentences or a short list. Plain English, no headers.`;

export interface AskVoxSource {
  clientLocalId: string;
  sessionId: string;
  title: string;
  sessionType: string | null;
  matterId: string | null;
  timestampMs: number;
  kind: string;
  snippet: string;
}

/** Build the Ask Vox user prompt from retrieved chunks. Pure. */
export function buildAskVoxUserPrompt(
  question: string,
  sources: AskVoxSource[]
): string {
  const excerpts = sources
    .map(
      (s) =>
        `— ${s.title || "Untitled session"} · [${formatTimestampTag(s.timestampMs)}]${
          s.kind === "file_note" ? " (file note)" : ""
        }\n${s.snippet}`
    )
    .join("\n\n")
    .slice(0, MAX_TRANSCRIPT_CHARS);
  return `QUESTION: ${question}\n\nSESSION EXCERPTS:\n${excerpts || "(no matching excerpts)"}`;
}

// ─── Shared view types ─────────────────────────────────────────────────────

/** The client-facing transcript turn. */
export interface VoxTurnView {
  id: string;
  index: number;
  speakerLabel: string;
  speakerRole: string;
  startMs: number;
  endMs: number;
  text: string;
}

/** The client-facing outputs projection. */
export interface VoxOutputsView {
  fileNoteMarkdown: string | null;
  actionItems: { id: string; task: string; owner: string; dueDateText: string; completed: boolean }[];
  issueMap: { category: string; nodes: string[] }[];
  customDrafts: { type: string; content: string; createdAt: number }[];
  generatedAt: number | null;
}

export interface VoxSessionView {
  sessionId: string;
  clientLocalId: string;
  title: string | null;
  sessionType: string;
  sessionTypeLabel: string;
  captureSource: string;
  matterId: string | null;
  status: string;
  provider: string | null;
  durationSeconds: number | null;
  segmentCount: number;
  hasAudio: boolean;
  /** Per-segment audio windows (playback bar seek math; URLs fetched on
 *  demand via getSegmentAudioUrl — storage ids never leave the backend). */
  audioSegments?: { startMs: number; endMs: number }[];
  error: string | null;
  synthesisError: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  turns?: VoxTurnView[];
  outputs?: VoxOutputsView | null;
}

function projectSession(
  row: any,
  turns: VoxTurnView[] | undefined,
  outputs: VoxOutputsView | null | undefined
): VoxSessionView {
  return {
    sessionId: String(row._id),
    clientLocalId: String(row.clientLocalId || ""),
    title: row.title ?? null,
    sessionType: String(row.sessionType || "meeting"),
    sessionTypeLabel: voxSessionTypeLabel(String(row.sessionType || "meeting")),
    captureSource: String(row.captureSource || "mic"),
    matterId: row.matterId ?? null,
    status: String(row.status || "recording"),
    provider: row.provider ?? null,
    durationSeconds: row.durationSeconds ?? null,
    segmentCount: Array.isArray(row.segments) ? row.segments.length : Number(row.segmentCount || 0),
    hasAudio: Array.isArray(row.segments) && row.segments.length > 0,
    ...(Array.isArray(row.segments)
      ? {
          audioSegments: [...row.segments]
            .sort((a: any, b: any) => (a.startMs || 0) - (b.startMs || 0))
            .map((s: any) => ({
              startMs: Number(s.startMs || 0),
              endMs: Number(s.endMs || 0),
            })),
        }
      : {}),
    error: row.error ?? null,
    synthesisError: row.synthesisError ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    ...(turns !== undefined ? { turns } : {}),
    ...(outputs !== undefined ? { outputs } : {}),
  };
}

function projectOutputs(o: any): VoxOutputsView {
  return {
    fileNoteMarkdown: o?.fileNoteMarkdown ?? null,
    actionItems: Array.isArray(o?.actionItems) ? o.actionItems : [],
    issueMap: Array.isArray(o?.issueMap) ? o.issueMap : [],
    customDrafts: Array.isArray(o?.customDrafts) ? o.customDrafts : [],
    generatedAt: o?.generatedAt ?? null,
  };
}

/** Lagos today (UTC+1) as an ISO date — the house clock for prompts. */
function lagosDateISO(): string {
  const now = new Date();
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ─── VOX ENTITLEMENT (same gate as the rest of Vox) ─────────────────────────

async function requireVoxEntitlement(ctx: any, firmId: string): Promise<void> {
  const firm: any = await ctx.runQuery(internal.voiceCaptureInternal.getFirmPlanInternal, {
    firmId,
  });
  const plan = firm ? effectiveFirmPlan(firm) : "Core";
  if (!canUseVox(plan)) {
    throw new ConvexError(VOX_UPGRADE_REQUIRED_MESSAGE);
  }
}

// ─── uploadSegment (action) ────────────────────────────────────────────────

export interface VoxUploadSegmentResult {
  sessionId: string;
  skipped: boolean;
  provider: string | null;
  transcriptSoFar: string;
  status: string;
}

export const uploadSegment = action({
  args: {
    clientLocalId: v.string(),
    segmentIndex: v.number(),
    audioBase64: v.string(), // 16 kHz mono WAV, base64
    startMs: v.number(),
    endMs: v.number(),
    // Session context — rides the FIRST upload; later segments may refresh it.
    title: v.optional(v.string()),
    sessionType: v.optional(v.string()),
    captureSource: v.optional(v.string()),
    matterId: v.optional(v.string()),
    retentionDays: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    callerApiKey: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()), // ignored — session is the proof
  },
  handler: async (ctx, args): Promise<VoxUploadSegmentResult> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
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
    const sessionType = VOX_SESSION_TYPES.includes(args.sessionType as VoxSessionType)
      ? String(args.sessionType)
      : "meeting";

    await ctx.runMutation(internal.voxSessionsInternal.upsertSessionRow, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
      userId: auth.userId,
      title: args.title ?? undefined,
      sessionType,
      captureSource: args.captureSource ?? undefined,
      matterId: args.matterId ?? undefined,
      retentionDays: args.retentionDays ?? undefined,
      startedAt: args.startedAt ?? undefined,
    });

    const row: any = await ctx.runQuery(internal.voxSessionsInternal.getSessionRowInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
    });
    if (!row) throw new ConvexError("Session not found.");
    if (row.deleted === true) {
      throw new ConvexError("This session was deleted — the upload was discarded.");
    }

    // Idempotent replay check — this segment index already landed?
    const segs: any[] = Array.isArray(row.segments) ? row.segments : [];
    const segTurns: any[] = Array.isArray(row.segmentTurns) ? row.segmentTurns : [];
    if (segs.length > args.segmentIndex && segs[args.segmentIndex]) {
      const prior = segTurns.find((t) => t.index === args.segmentIndex);
      const priorText = (prior?.turns || []).map((t: any) => t.text).join(" ");
      return {
        sessionId: String(row._id),
        skipped: true,
        provider: row.provider ?? null,
        transcriptSoFar: priorText,
        status: row.status ?? "transcribing",
      };
    }

    // Continuity tail — heals the 60s chunk seams.
    const prev = segTurns.find((t) => t.index === args.segmentIndex - 1);
    const prevText = (prev?.turns || []).map((t: any) => t.text).join(" ");
    const continuationTail = prevText ? prevText.slice(-400) : undefined;

    const wavBytes = decodeBase64ToBytes(args.audioBase64);
    // Archive FIRST (audio is never lost) — then decide on transcription.
    const storageId = await ctx.storage.store(
      new Blob([wavBytes.buffer as ArrayBuffer], { type: "audio/wav" })
    );

    // Near-silent / zero-speech frames are never submitted for
    // transcription (same guard + threshold as quick capture).
    const segDurationMs = Math.max(0, args.endMs - args.startMs);
    const rms = wavRmsLevel(wavBytes);
    if (segDurationMs < 400 || (rms > 0 && rms <= SILENT_RMS_THRESHOLD)) {
      await ctx.runMutation(internal.voxSessionsInternal.appendSessionSegment, {
        clientLocalId: args.clientLocalId,
        firmId: auth.firmId,
        segmentIndex: args.segmentIndex,
        segment: {
          storageId: String(storageId),
          mimeType: "audio/wav",
          startMs: args.startMs,
          endMs: args.endMs,
          bytes: wavBytes.byteLength,
        },
        provider: "skipped-silence",
        at: Date.now(),
      });
      return {
        sessionId: String(row._id),
        skipped: false,
        provider: "skipped-silence",
        transcriptSoFar: "",
        status: "transcribing",
      };
    }

    // Session capture is ALWAYS diarized — speaker attribution is the point
    // of the mode (a solo session simply yields one speaker).
    const { text, provider, turns } = await transcribeSegment(ctx, {
      wavBytes,
      wavBase64: args.audioBase64,
      user: auth.user,
      callerKey: args.callerApiKey,
      continuationTail,
      diarize: true,
    });

    const sanitized = sanitizeSegmentText(text);
    const cleanTurns = (turns || [])
      .map((t) => ({ speaker: t.speaker, text: sanitizeSegmentText(t.text).text }))
      .filter((t) => t.text.length > 0);

    await ctx.runMutation(internal.voxSessionsInternal.appendSessionSegment, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
      segmentIndex: args.segmentIndex,
      segment: {
        storageId: String(storageId),
        mimeType: "audio/wav",
        startMs: args.startMs,
        endMs: args.endMs,
        bytes: wavBytes.byteLength,
      },
      turns: cleanTurns.length > 0 ? cleanTurns : undefined,
      provider: sanitized.dropped ? `${provider}+filtered` : provider,
      at: Date.now(),
    });

    return {
      sessionId: String(row._id),
      skipped: false,
      provider,
      transcriptSoFar: cleanTurns.map((t) => t.text).join(" ") || sanitized.text,
      status: "transcribing",
    };
  },
});

// ─── finalizeSession (action) ──────────────────────────────────────────────

export interface VoxFinalizeResult {
  session: VoxSessionView;
  synthesisError: string | null;
  speakerError: string | null;
}

export const finalizeSession = action({
  args: {
    clientLocalId: v.string(),
    totalDurationMs: v.optional(v.number()),
    title: v.optional(v.string()),
    sessionType: v.optional(v.string()),
    matterId: v.optional(v.string()),
    callerApiKey: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<VoxFinalizeResult> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    await requireVoxEntitlement(ctx, auth.firmId);
    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `voice_finalize:${auth.userId}`, maxRequests: 15 }
    );
    if (!allowed) throw new Error("Rate limit exceeded. Please wait a moment and try again.");

    await ctx.runMutation(internal.voxSessionsInternal.closeSessionRow, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
      totalDurationMs: args.totalDurationMs ?? undefined,
    });
    // Late context edits (the user relabelled the session while it uploaded).
    await ctx.runMutation(internal.voxSessionsInternal.patchSessionInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
      patch: {
        ...(args.title !== undefined ? { title: args.title } : {}),
        ...(args.sessionType !== undefined && VOX_SESSION_TYPES.includes(args.sessionType as VoxSessionType)
          ? { sessionType: args.sessionType }
          : {}),
        ...(args.matterId !== undefined ? { matterId: args.matterId || null } : {}),
      },
    });

    const row: any = await ctx.runQuery(internal.voxSessionsInternal.getSessionRowInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
    });
    if (!row) throw new ConvexError("Session not found.");

    const segTurns: RawSegmentTurns[] = Array.isArray(row.segmentTurns) ? row.segmentTurns : [];
    const timed = withApproxTimestamps(segTurns);
    let speakerError: string | null = null;
    let synthesisError: string | null = null;

    if (timed.length === 0) {
      // No speech anywhere — the honest outcome (mirrors quick capture).
      await ctx.runMutation(internal.voxSessionsInternal.patchSessionInternal, {
        clientLocalId: args.clientLocalId,
        firmId: auth.firmId,
        patch: { status: "failed", error: "No speech was detected in this session." },
      });
      throw new ConvexError("No speech was detected in this session.");
    }

    await ctx.runMutation(internal.voxSessionsInternal.patchSessionInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
      patch: { status: "synthesizing", error: null },
    });

    // ── Speaker reconcile (same pass as conversation-mode quick captures).
    const gemini = await resolveGeminiKey(ctx, auth.user, args.callerApiKey);
    let speakerSet: {
      speakers: { id: string; role: string; name: string | null; confidence: number }[];
      turns: { speakerId: string; text: string }[];
    };
    if (gemini) {
      try {
        const matterTitle = row.matterId
          ? (
              await ctx.runQuery(internal.voxSessionsInternal.listFirmMattersForVoxInternal, {
                firmId: auth.firmId,
              })
            ).find((m: any) => m.id === row.matterId)?.title ?? null
          : null;
        const flat = flattenSegmentTurns(segTurns);
        const reconcileRaw = await geminiText({
          apiKey: gemini.key,
          system: buildSpeakerReconcilePrompt({
            counselName: auth.user?.name || null,
            matter: matterTitle
              ? {
                  title: matterTitle,
                  clientName: null,
                  opposingCounsel: null,
                  presidingJudge: null,
                  parties: [],
                }
              : null,
          }),
          user: flat.map((t) => `${t.key} [${t.localLabel}] ${t.text.slice(0, 2000)}`).join("\n"),
          maxTokens: 2048,
        });
        speakerSet = parseReconcileResult(reconcileRaw, flat) ?? fallbackSpeakerTurns(segTurns);
      } catch (err: any) {
        speakerSet = fallbackSpeakerTurns(segTurns);
        speakerError = err?.message || "Speaker reconcile failed — raw labels kept.";
      }
    } else {
      speakerSet = fallbackSpeakerTurns(segTurns);
      speakerError = "No AI key available for speaker identification — raw labels kept.";
    }

    // Zip the reconciled turns (same order as `timed`) with the interpolated
    // timestamps; default labels mirror the quick-capture staging card.
    const labels = defaultSpeakerLabels(speakerSet as any);
    const roleFor = (role: string): string => {
      // Same vocabulary the diarization prompt suggests (voiceCapture.ts
      // buildSpeakerReconcilePrompt: counsel | client | opposing_counsel |
      // witness | judge | court_official | other) — previously everything
      // outside counsel/client/witness collapsed to "other", so an
      // opposing-counsel speaker (the whole point of labeling turns in
      // settlement meetings) was indistinguishable from a stranger.
      if (
        role === "counsel" || role === "client" || role === "opposing_counsel" ||
        role === "witness" || role === "judge" || role === "court_official"
      ) return role;
      return "other";
    };
    const turns: VoxTurnView[] = timed.map((t, i) => {
      const reconciled = speakerSet.turns[i];
      const speakerId = reconciled?.speakerId || `V0-${t.speaker}`;
      const meta = speakerSet.speakers.find((s) => s.id === speakerId);
      return {
        id: `t${i}`,
        index: i,
        speakerLabel: labels[speakerId] || `Speaker ${i + 1}`,
        speakerRole: roleFor(meta?.role || "unknown"),
        startMs: t.startMs,
        endMs: t.endMs,
        text: (reconciled?.text || t.text).trim(),
      };
    });
    await ctx.runMutation(internal.voxSessionsInternal.writeTranscriptSegments, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
      userId: auth.userId,
      turns: turns.map((t) => ({
        speakerLabel: t.speakerLabel,
        speakerRole: t.speakerRole,
        startMs: t.startMs,
        endMs: t.endMs,
        text: t.text,
      })),
    });

    // ── One-click synthesis: file note + action items + issue map.
    let outputs: VoxOutputsView = {
      fileNoteMarkdown: null,
      actionItems: [],
      issueMap: [],
      customDrafts: [],
      generatedAt: null,
    };
    const sessionType = String(row.sessionType || "meeting");
    if (gemini) {
      try {
        const matters: any[] = row.matterId
          ? await ctx.runQuery(internal.voxSessionsInternal.listFirmMattersForVoxInternal, {
              firmId: auth.firmId,
            })
          : [];
        const matterTitle = row.matterId
          ? matters.find((m: any) => m.id === row.matterId)?.title ?? null
          : null;
        const synthesisRaw = await geminiText({
          apiKey: gemini.key,
          system: SESSION_SYNTHESIS_SYSTEM_PROMPT,
          user: buildSynthesisUserPrompt({
            sessionType,
            sessionTypeLabel: voxSessionTypeLabel(sessionType),
            matterTitle,
            lawyerName: auth.user?.name || null,
            lagosDate: lagosDateISO(),
            turns: turns.map((t) => ({ speakerLabel: t.speakerLabel, text: t.text, startMs: t.startMs })),
          }),
          maxTokens: 8192,
        });
        const parsed = parseSynthesisResult(synthesisRaw);
        if (parsed) {
          outputs = { ...parsed, customDrafts: [], generatedAt: Date.now() };
          await ctx.runMutation(internal.voxSessionsInternal.writeSessionOutputs, {
            clientLocalId: args.clientLocalId,
            firmId: auth.firmId,
            userId: auth.userId,
            fileNoteMarkdown: parsed.fileNoteMarkdown,
            actionItems: parsed.actionItems,
            issueMap: parsed.issueMap,
            model: QUALITY_MODEL,
          });
        } else {
          synthesisError = "The synthesis returned an unparseable result — the transcript is safe; regenerate from the session.";
        }
      } catch (err: any) {
        synthesisError = err?.message || "Session synthesis failed — the transcript is safe.";
      }
    } else {
      synthesisError = "No AI key available for the session synthesis — the transcript is saved.";
    }

    // ── Search chunks for Ask Vox (transcript + file note).
    try {
      const chunks = buildSearchChunks(
        turns.map((t) => ({ speakerLabel: t.speakerLabel, text: t.text, startMs: t.startMs })),
        outputs.fileNoteMarkdown
      );
      await ctx.runMutation(internal.voxSessionsInternal.writeSessionChunks, {
        clientLocalId: args.clientLocalId,
        firmId: auth.firmId,
        userId: auth.userId,
        matterId: (row.matterId || undefined) ?? undefined,
        chunks,
      });
    } catch { /* chunks are best-effort; the session still finalizes */ }

    await ctx.runMutation(internal.voxSessionsInternal.patchSessionInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
      patch: { status: "ready", synthesisError: synthesisError ?? null, error: null },
    });

    const fresh: any = await ctx.runQuery(internal.voxSessionsInternal.getSessionRowInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
    });
    return {
      session: projectSession(fresh ?? row, turns, outputs),
      synthesisError,
      speakerError,
    };
  },
});

// ─── generateFollowUpDraft (action) ────────────────────────────────────────

export interface VoxDraftResult {
  type: string;
  content: string;
  createdAt: number;
}

export const generateFollowUpDraft = action({
  args: {
    clientLocalId: v.string(),
    type: v.string(), // 'client_recap' | 'internal_memo' | 'instruction_confirmation'
    callerApiKey: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<VoxDraftResult> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    await requireVoxEntitlement(ctx, auth.firmId);
    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `voice_polish:${auth.userId}`, maxRequests: 10 }
    );
    if (!allowed) throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    if (!VOX_DRAFT_TYPES.includes(args.type as VoxDraftType)) {
      throw new Error("Unknown draft type.");
    }
    const row: any = await ctx.runQuery(internal.voxSessionsInternal.getSessionRowInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
    });
    if (!row) throw new ConvexError("Session not found.");

    const turns = await ctx.runQuery(internal.voxSessionsInternal.listSessionTurnsInternal, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
    });
    if (!turns || turns.length === 0) {
      throw new ConvexError("This session has no transcript yet.");
    }
    const gemini = await resolveGeminiKey(ctx, auth.user, args.callerApiKey);
    if (!gemini) {
      throw new ConvexError("No AI key available for drafting — set one in Settings or try again later.");
    }
    const matters: any[] = row.matterId
      ? await ctx.runQuery(internal.voxSessionsInternal.listFirmMattersForVoxInternal, {
          firmId: auth.firmId,
        })
      : [];
    const matterTitle = row.matterId ? matters.find((m: any) => m.id === row.matterId)?.title ?? null : null;
    const prompt = buildFollowUpPrompt({
      type: args.type as VoxDraftType,
      turns: turns.map((t: any) => ({ speakerLabel: t.speakerLabel, text: t.text, startMs: t.startMs })),
      matterTitle,
      lawyerName: auth.user?.name || null,
      lagosDate: lagosDateISO(),
    });
    const content = await geminiText({
      apiKey: gemini.key,
      system: prompt.system,
      user: prompt.user,
      maxTokens: 4096,
    });
    const draft: VoxDraftResult = {
      type: args.type,
      content: content.slice(0, 30_000),
      createdAt: Date.now(),
    };
    await ctx.runMutation(internal.voxSessionsInternal.appendCustomDraft, {
      clientLocalId: args.clientLocalId,
      firmId: auth.firmId,
      draft: { type: draft.type, content: draft.content, createdAt: draft.createdAt },
    });
    return draft;
  },
});

// ─── askVox (action — cross-session recall) ────────────────────────────────

export interface AskVoxResult {
  answer: string;
  sources: AskVoxSource[];
  scopeMatterId: string | null;
}

export const askVox = action({
  args: {
    question: v.string(),
    matterId: v.optional(v.string()), // scope to one matter's sessions
    callerApiKey: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AskVoxResult> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    await requireVoxEntitlement(ctx, auth.firmId);
    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `voice_quickask:${auth.userId}`, maxRequests: 20 }
    );
    if (!allowed) throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    const question = (args.question || "").trim().slice(0, 2000);
    if (!question) throw new ConvexError("Ask a question about your recordings.");

    const gemini = await resolveGeminiKey(ctx, auth.user, args.callerApiKey);
    if (!gemini) {
      throw new ConvexError("No AI key available — set one in Settings or try again later.");
    }

    // Retrieval: full-text search over this user's voxChunks (the search
    // index filters firmId+userId — cross-workspace leakage is impossible),
    // then the optional matter scope narrows the results.
    const sources: AskVoxSource[] = await ctx.runQuery(
      internal.voxSessionsInternal.searchVoxChunksInternal,
      {
        firmId: auth.firmId,
        userId: auth.userId,
        query: question,
        matterId: args.matterId || undefined,
      }
    );

    const answer = await geminiText({
      apiKey: gemini.key,
      system: ASK_VOX_SYSTEM_PROMPT,
      user: buildAskVoxUserPrompt(question, sources.slice(0, ASK_VOX_CHUNK_CAP)),
      maxTokens: 2048,
    });

    return {
      answer,
      sources: sources.slice(0, ASK_VOX_CHUNK_CAP),
      scopeMatterId: args.matterId || null,
    };
  },
});

// ─── Read paths (queries) ──────────────────────────────────────────────────

export const listSessions = query({
  args: {
    matterId: v.optional(v.string()),
    limit: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<VoxSessionView[]> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    const rows: any[] = args.matterId
      ? await ctx.db
          .query("voxSessions")
          .withIndex("by_firm_matter_created", (q: any) =>
            q.eq("firmId", auth.firmId).eq("matterId", args.matterId!)
          )
          .order("desc")
          .collect()
      : await ctx.db
          .query("voxSessions")
          .withIndex("by_firm_user_created", (q: any) =>
            q.eq("firmId", auth.firmId).eq("userId", auth.userId)
          )
          .order("desc")
          .collect();
    return rows
      .filter((r) => r.deleted !== true && r.firmId === auth.firmId && r.userId === auth.userId)
      .slice(0, limit)
      .map((r) => projectSession(r, undefined, undefined));
  },
});

export const getSession = query({
  args: {
    clientLocalId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<VoxSessionView | null> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) => q.eq("clientLocalId", args.clientLocalId))
      .first();
    if (!row || row.deleted === true) return null;
    if (row.firmId !== auth.firmId || row.userId !== auth.userId) return null;
    const segRows: any[] = await ctx.db
      .query("voxTranscriptSegments")
      .withIndex("by_session", (q) => q.eq("sessionId", row._id))
      .collect();
    const outputsRow: any = await ctx.db
      .query("voxOutputs")
      .withIndex("by_session", (q) => q.eq("sessionId", row._id))
      .first();
    const turns: VoxTurnView[] = segRows
      .sort((a: any, b: any) => (a.segmentIndex || 0) - (b.segmentIndex || 0))
      .map((s: any, i: number) => ({
        id: String(s._id),
        index: Number(s.segmentIndex ?? i),
        speakerLabel: String(s.speakerLabel || "Speaker 1"),
        speakerRole: String(s.speakerRole || "other"),
        startMs: Number(s.startMs || 0),
        endMs: Number(s.endMs || 0),
        text: String(s.text || ""),
      }));
    return projectSession(row, turns, outputsRow ? projectOutputs(outputsRow) : null);
  },
});

/** Playback URL for one archived audio segment (the session's own copy). */
export const getSegmentAudioUrl = query({
  args: {
    clientLocalId: v.string(),
    segmentIndex: v.number(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) => q.eq("clientLocalId", args.clientLocalId))
      .first();
    if (!row || row.deleted === true) throw new Error("Session not found.");
    if (row.firmId !== auth.firmId || row.userId !== auth.userId) throw new Error("Not authorized.");
    const segs: any[] = Array.isArray(row.segments) ? row.segments : [];
    // Positional access over the START-ORDERED copy (the projection the
    // client's playback bar uses — the two must agree even if segments
    // arrived out of order during an offline replay).
    const ordered = [...segs].sort((a: any, b: any) => (a.startMs || 0) - (b.startMs || 0));
    const target = ordered[args.segmentIndex];
    if (!target) throw new Error("Segment not found.");
    return await ctx.storage.getUrl(target.storageId);
  },
});

// ─── Write paths (mutations) ───────────────────────────────────────────────

export const updateSessionMeta = mutation({
  args: {
    clientLocalId: v.string(),
    title: v.optional(v.string()),
    sessionType: v.optional(v.string()),
    matterId: v.optional(v.string()),
    retentionDays: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) => q.eq("clientLocalId", args.clientLocalId))
      .first();
    if (!row || row.deleted === true) throw new Error("Session not found.");
    if (row.firmId !== auth.firmId || row.userId !== auth.userId) throw new Error("Not authorized.");
    const patch: any = { updatedAt: new Date().toISOString() };
    if (args.title !== undefined) patch.title = args.title.trim().slice(0, 200) || null;
    if (args.sessionType !== undefined && VOX_SESSION_TYPES.includes(args.sessionType as VoxSessionType)) {
      patch.sessionType = args.sessionType;
    }
    if (args.matterId !== undefined) patch.matterId = args.matterId || null;
    if (args.retentionDays !== undefined) {
      patch.retentionDays = args.retentionDays > 0 ? Math.round(args.retentionDays) : null;
    }
    await ctx.db.patch(row._id, patch);
    // Matter re-scope also re-tags the search chunks (Ask Vox filters on it).
    if (args.matterId !== undefined) {
      const chunks: any[] = await ctx.db
        .query("voxChunks")
        .withIndex("by_session", (q) => q.eq("sessionId", row._id))
        .collect();
      for (const c of chunks) {
        if (c.matterId !== (args.matterId || null)) {
          await ctx.db.patch(c._id, { matterId: args.matterId || null });
        }
      }
    }
  },
});

/** Rename one speaker across the whole session (label + role) — the common
 *  post-capture fix ("Speaker 2" → "Mrs. Adeyemi (Client)"). */
export const renameSpeaker = mutation({
  args: {
    clientLocalId: v.string(),
    fromLabel: v.string(),
    toLabel: v.string(),
    role: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) => q.eq("clientLocalId", args.clientLocalId))
      .first();
    if (!row || row.deleted === true) throw new Error("Session not found.");
    if (row.firmId !== auth.firmId || row.userId !== auth.userId) throw new Error("Not authorized.");
    const toLabel = args.toLabel.trim().slice(0, 80);
    if (!toLabel) throw new Error("The new label cannot be empty.");
    const role =
      args.role &&
      ["counsel", "client", "opposing_counsel", "witness", "judge", "court_official", "other"].includes(args.role)
        ? args.role
        : undefined;
    const segRows: any[] = await ctx.db
      .query("voxTranscriptSegments")
      .withIndex("by_session", (q) => q.eq("sessionId", row._id))
      .collect();
    let renamed = 0;
    for (const s of segRows) {
      if (String(s.speakerLabel) === args.fromLabel) {
        await ctx.db.patch(s._id, {
          speakerLabel: toLabel,
          ...(role ? { speakerRole: role } : {}),
          updatedAt: new Date().toISOString(),
        });
        renamed += 1;
      }
    }
    return { renamed };
  },
});

/** Toggle one action item's completed state (outputs row patch). */
export const toggleActionItem = mutation({
  args: {
    clientLocalId: v.string(),
    itemId: v.string(),
    completed: v.boolean(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) => q.eq("clientLocalId", args.clientLocalId))
      .first();
    if (!row || row.deleted === true) throw new Error("Session not found.");
    if (row.firmId !== auth.firmId || row.userId !== auth.userId) throw new Error("Not authorized.");
    const outputs: any = await ctx.db
      .query("voxOutputs")
      .withIndex("by_session", (q) => q.eq("sessionId", row._id))
      .first();
    if (!outputs) throw new Error("Session outputs not generated yet.");
    const items = Array.isArray(outputs.actionItems)
      ? outputs.actionItems.map((i: any) =>
          String(i.id) === args.itemId ? { ...i, completed: args.completed } : i
        )
      : [];
    await ctx.db.patch(outputs._id, { actionItems: items, updatedAt: new Date().toISOString() });
    return { updated: true };
  },
});

/** deleteSession — tombstone + purge the archived audio (same discipline as
 *  deleteCapture: an in-flight upload sees the flag and refuses; old
 *  tombstones are swept on the next delete from this firm). */
export const deleteSession = mutation({
  args: {
    clientLocalId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const row: any = await ctx.db
      .query("voxSessions")
      .withIndex("by_client_local_id", (q) => q.eq("clientLocalId", args.clientLocalId))
      .first();
    if (!row) throw new Error("Session not found.");
    if (row.firmId !== auth.firmId || row.userId !== auth.userId) throw new Error("Not authorized.");
    if (row.deleted === true) return; // idempotent
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
      segmentTurns: [],
      error: "Deleted.",
      updatedAt: new Date().toISOString(),
    });
    // The search chunks must go too — deleted sessions never surface in
    // Ask Vox results.
    try {
      const chunks: any[] = await ctx.db
        .query("voxChunks")
        .withIndex("by_session", (q) => q.eq("sessionId", row._id))
        .collect();
      for (const c of chunks) await ctx.db.delete(c._id);
    } catch { /* best-effort */ }
    // Sweep this user's stale tombstones (older than 7 days), bounded.
    try {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const firmRows: any[] = await ctx.db
        .query("voxSessions")
        .withIndex("by_firm_user_created", (q: any) =>
          q.eq("firmId", auth.firmId).eq("userId", auth.userId)
        )
        .collect();
      for (const r of firmRows) {
        if (r.deleted === true && typeof r.deletedAt === "number" && r.deletedAt < cutoff) {
          try { await ctx.db.delete(r._id); } catch { /* already gone */ }
        }
      }
    } catch { /* sweeping is best-effort */ }
  },
});

// ─── Audio retention sweep (cron) ──────────────────────────────────────────

/** Daily sweep: purge stored AUDIO past a session's retention window. The
 *  transcript, outputs and search chunks REMAIN (the written record is not
 *  deleted — only the audio ages out). Bounded scan, best-effort. */
export const purgeExpiredVoxAudioInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // only sessions ≥1 day old
    const rows: any[] = await ctx.db.query("voxSessions").collect();
    let swept = 0;
    for (const row of rows.slice(0, 500)) {
      if (row.deleted === true || row.audioPurgedAt) continue;
      const retentionDays = Number(row.retentionDays || 0);
      if (retentionDays <= 0) continue; // null/0 = keep forever
      const ageMs = Date.now() - new Date(row.updatedAt || row.createdAt || 0).getTime();
      if (isNaN(ageMs) || ageMs < retentionDays * 24 * 60 * 60 * 1000) continue;
      if (ageMs < cutoff) continue;
      const segs: any[] = Array.isArray(row.segments) ? row.segments : [];
      for (const s of segs) {
        try {
          await ctx.storage.delete(s.storageId as any);
        } catch { /* already gone */ }
      }
      await ctx.db.patch(row._id, {
        segments: [],
        audioPurgedAt: Date.now(),
        updatedAt: new Date().toISOString(),
      });
      swept += 1;
    }
    return { swept };
  },
});
