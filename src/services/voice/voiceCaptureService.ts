/**
 * voiceCaptureService — typed client for the Voice Capture Engine backend
 * (convex/voiceCapture.ts). Follows the geminiService pattern: a module-level
 * ConvexHttpClient for imperative (non-hook) calls, with the session bearer
 * read from storage on every request — never cached, never logged.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { convertBlobToWav } from "../../utils/webmToWav";
import { getGeminiApiKey } from "../../utils/aiUtils";
import type { DraftBlueprint } from "../../legal/drafting/types";
import type { IntentMode } from "./draftUtils";
// Exact backend result types — importing them keeps client and server
// contracts in lockstep (triageMeta is `any` server-side; the typed view
// below is what the UI consumes).
import type {
  FinalizeCaptureResult,
  QuickAskResult,
  QuickAskSource,
  QuickAskActionResult,
} from "../../../convex/voiceCapture";

export type { FinalizeCaptureResult, QuickAskResult, QuickAskSource, QuickAskActionResult };

const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string) ||
  "https://gregarious-malamute-537.convex.cloud";

const convex = new ConvexHttpClient(CONVEX_URL);

function readSessionBearer(): string | undefined {
  return (
    (typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem("practicepro_session_bearer")) ||
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("practicepro_session_bearer")) ||
    undefined
  );
}

export type CaptureKind = "quick" | "legalpad" | "session";
export type OutputMode = "smart-clean" | "verbatim";
export type CaptureStatus = "recording" | "transcribing" | "ready" | "failed";
export type TriageIntent = "case_note" | "schedule" | "question" | "share";

export interface TriageEventDraft {
  title: string;
  type: string;
  dateISO: string;
  time: string;
  location?: string;
  /** True when the time was NOT spoken (LLM defaulted 09:00/14:00/17:00) —
   *  the card flags it as easily editable inline. */
  timeEstimated?: boolean;
  /** Concise action summary for this diary entry's Notes field (owner spec
   *  2026-11-19, Wispr-Flow style formatting) — editable inline on the
   *  triage card before the event is saved. */
  note?: string;
}

/** Semantic matter match from the analysis pass (owner spec §2): ranked
 *  by confidence, validated server-side against the firm's real matters. */
export interface MatterMatchView {
  matterId: string;
  confidence: number;
  reason?: string;
}

/** Structured courtroom endorsement fields (owner spec §4) — populated
 *  when dictated courtroom proceedings were detected. */
export interface EndorsementDataView {
  court?: string;
  suitNumber?: string;
  parties?: string;
  judge?: string;
  orders?: string[];
  nextAdjournedDate?: string;
  nextAdjournedTime?: string;
}

export interface TriageMeta {
  intent?: TriageIntent;
  /** Read/write intent mode resolved server-side by enforceIntentGate
   *  (owner bug report 2026-11-19): "query_only" captures are pure lookups
   *  — events/proposals are hard-gated to empty and the card renders a
   *  read-only hint instead of staging anything. */
  mode?: IntentMode;
  /** False only when mode is "query_only" — write tools are gated off. */
  allowWriteTools?: boolean;
  matterCandidates?: string[];
  /** Ranked semantic matches (top 3) — drives auto-select + the
   *  disambiguation pills on the triage card. */
  matterMatches?: MatterMatchView[];
  events?: TriageEventDraft[];
  /** True when the note contains any task/follow-up/deadline to act on. */
  isDiaryTask?: boolean;
  endorsement?: EndorsementDataView | null;
  isQuestion?: boolean;
  questionText?: string;
  summary?: string;
  /** Destination-formatted note body (owner spec 2026-11-19): meta-speech
   *  stripped, paragraphs vs bullets chosen by content complexity. The
   *  triage card's draft defaults to it; smartClean/verbatim stay available
   * via the tier toggle. */
  caseNoteText?: string;
  /** Warm plain-English client update drafted by the analysis when the note
   *  reads like one (register shifting, owner spec Part 2 §2). */
  clientUpdateText?: string;
  /** Workspace proposals (owner spec 2026-11-19, Part 1) — validated
   *  server-side against the firm's real records before display. */
  proposals?: WorkspaceProposalsView | null;
  matchedMatterIds?: string[];
  matchedContactIds?: string[];
}

/** Validated workspace proposal payloads (mirrors convex validators). */
export interface WorkspaceProposalsView {
  newMatter: {
    title: string;
    clientName: string;
    opposingParty: string;
    practiceArea: string;
    summaryNote: string;
  } | null;
  contactUpsert: {
    contactId: string;
    name: string;
    phone: string;
    email: string;
    company: string;
    role: string;
    notes: string;
  } | null;
  propertyNote: {
    propertyId: string;
    unitId: string;
    note: string;
    followUp: string;
  } | null;
  draftBlueprint: DraftBlueprint | null;
  financialEntry: {
    type: "expense" | "fee";
    amount: number;
    currency: string;
    description: string;
    matterId: string;
  } | null;
  taskUpdates: {
    kind: "task" | "event";
    itemId: string;
    status: string;
    note: string;
  }[];
  clientUpdateText: string;
}

/** A Personal Dictionary entry (voiceTools). */
export interface VoiceDictionaryEntry {
  id: string;
  term: string;
  source: "auto" | "manual" | string;
  hits: number;
  createdAt?: string | null;
}

/** A Spoken Snippet (voiceTools). */
export interface VoiceSnippet {
  id: string;
  trigger: string;
  content: string;
  isDefault: boolean;
}

export interface CaptureProjection {
  captureId: string;
  clientLocalId: string;
  kind: CaptureKind;
  outputMode: OutputMode;
  status: CaptureStatus;
  provider: string | null;
  durationMs: number | null;
  startedAt: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  segmentCount: number;
  /** INCREMENTAL DICTATION: the segment index an "Add More" round must
 *  start from (max existing index + 1 — gaps from dead segments make this
 *  differ from segmentCount). */
  nextSegmentIndex?: number;
  triageIntent: TriageIntent | null;
  triageMeta: TriageMeta | null;
  matterId: string | null;
  notePageId: string | null;
  eventId: string | null;
  error: string | null;
  // slim projection extras
  snippet?: string;
  hasSmartClean?: boolean;
  hasMergedSummary?: boolean;
  // full projection extras
  verbatimText?: string;
  smartCleanText?: string;
  mergedSummary?: string;
  shorthandText?: string;
  segments?: { storageId: string; startMs: number; endMs: number }[];
  /** From finalizeCapture: why the Smart Clean pass was skipped, if it was. */
  polishError?: string | null;
  triageError?: string | null;
  mergeError?: string | null;
  // MULTI-SPEAKER DIARIZATION (owner spec 2026-11-20): conversation-mode
  // captures carry reconciled speaker turns + roles for the staging card.
  multiSpeaker?: boolean;
  speakerTurns?: SpeakerTurnsResult | null;
  speakerError?: string | null;
}

/** The finalize-time reconcile pass output (see convex/voiceCapture.ts). */
export interface SpeakerTurnsResult {
  speakers: { id: string; role: string; name: string | null; confidence: number }[];
  turns: { speakerId: string; text: string }[];
}

export interface QuickAskResultView {
  answer: string;
  sources: {
    matters: { kind: "matter"; id: string; title: string; detail: string }[];
    notes: { kind: "note"; id: string; title: string; detail: string }[];
    events: { kind: "event"; id: string; title: string; detail: string }[];
  };
}

/** Blob → base64 (no data: prefix). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read audio data."));
    reader.onloadend = () => {
      const result = reader.result as string;
      if (!result || !result.includes(",")) {
        reject(new Error("Audio data was empty."));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/** True when the error looks like connectivity (retry later), not a bug. */
export function isRetryableError(err: any): boolean {
  const msg = String(err?.message || err || "").toLowerCase();
  if (msg.includes("rate limit")) return true;
  if (msg.includes("unauthorized") || msg.includes("unauthenticated")) return false;
  if (msg.includes("too large") || msg.includes("segment too long")) return false;
  // Convex network failures surface as TypeError (fetch) or "Network" strings.
  return (
    err instanceof TypeError ||
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("failed to fetch") ||
    msg.includes("request failed") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("internal") && msg.includes("convex")
  );
}

export interface UploadSegmentArgs {
  clientLocalId: string;
  kind: CaptureKind;
  outputMode: OutputMode;
  segmentIndex: number;
  segmentCount?: number;
  /** Raw recorded blob (any supported container) — converted to 16kHz mono WAV here. */
  blob: Blob;
  startMs: number;
  endMs: number;
  startedAt?: number;
  /** Conversation mode (multi-speaker diarization, 2026-11-20): the
   *  backend transcribes with speaker-turn separation. */
  multiSpeaker?: boolean;
}

/**
 * Upload ONE segment: normalize to WAV on-device, base64 it, send to the
 * backend Whisper/Gemini transcription service. Audio also lands in Convex
 * file storage (two-tier storage). Idempotent per (clientLocalId, segmentIndex).
 */
export async function uploadSegment(args: UploadSegmentArgs): Promise<{
  captureId: string;
  skipped: boolean;
  provider: string | null;
  verbatimSoFar: string;
  status: string;
}> {
  // Normalize: 16 kHz mono PCM WAV — the universal format both the Whisper
  // endpoint and the Gemini inline-data fallback accept, and the archival
  // format for the evidentiary audio tier.
  const wavBlob = await convertBlobToWav(args.blob);
  const audioBase64 = await blobToBase64(wavBlob);
  return convex.action(api.voiceCapture.uploadSegment, {
    clientLocalId: args.clientLocalId,
    kind: args.kind,
    outputMode: args.outputMode,
    segmentIndex: args.segmentIndex,
    segmentCount: args.segmentCount,
    audioBase64,
    startMs: args.startMs,
    endMs: args.endMs,
    startedAt: args.startedAt,
    multiSpeaker: args.multiSpeaker ?? undefined,
    // 2026-11-18: send the caller's own BYO key (the same key text ALOA
    // chat already uses client-side) so quick capture spends the user's
    // account key instead of depending solely on the platform env key.
    callerApiKey: getGeminiApiKey() || undefined,
    sessionToken: readSessionBearer(),
  });
}

export async function finalizeCapture(args: {
  clientLocalId: string;
  shorthandText?: string;
  eventTypeNames?: string[];
  totalDurationMs?: number;
  /** Conversation mode (multi-speaker diarization, 2026-11-20). */
  multiSpeaker?: boolean;
}): Promise<FinalizeCaptureResult> {
  return convex.action(api.voiceCapture.finalizeCapture, {
    ...args,
    callerApiKey: getGeminiApiKey() || undefined,
    sessionToken: readSessionBearer(),
  });
}

export async function saveShorthand(clientLocalId: string, shorthandText: string): Promise<void> {
  await convex.mutation(api.voiceCapture.saveShorthand, {
    clientLocalId,
    shorthandText,
    sessionToken: readSessionBearer(),
  });
}

export async function linkCapture(args: {
  clientLocalId: string;
  matterId?: string;
  notePageId?: string;
  eventId?: string;
}): Promise<void> {
  await convex.mutation(api.voiceCapture.linkCapture, {
    ...args,
    sessionToken: readSessionBearer(),
  });
}

export async function getCaptureByLocalId(clientLocalId: string): Promise<CaptureProjection | null> {
  try {
    return await convex.query(api.voiceCapture.getCaptureByLocalId, {
      clientLocalId,
      sessionToken: readSessionBearer(),
    });
  } catch (err: any) {
    if (String(err?.message || "").includes("Capture not found")) return null;
    throw err;
  }
}

export async function listRecentCaptures(limit = 15): Promise<CaptureProjection[]> {
  return convex.query(api.voiceCapture.listRecentCaptures, {
    limit,
    sessionToken: readSessionBearer(),
  });
}

export async function quickAsk(
  question: string,
  opts?: { notebookId?: string }
): Promise<QuickAskResult> {
  return convex.action(api.voiceCapture.quickAsk, {
    question,
    notebookId: opts?.notebookId,
    callerApiKey: getGeminiApiKey() || undefined,
    sessionToken: readSessionBearer(),
  });
}

/** One-tap Undo for an item Quick Ask created (diary entry / saved note).
 *  Server-side guards: firm scope + creator ownership + 15-min window. */
export async function undoQuickAskAction(kind: "event" | "note", itemId: string): Promise<void> {
  await convex.mutation(api.voiceCapture.undoQuickAskAction, {
    kind,
    itemId,
    sessionToken: readSessionBearer(),
  });
}

export async function repolish(clientLocalId: string): Promise<{ smartCleanText: string }> {
  return convex.action(api.voiceCapture.repolish, {
    clientLocalId,
    callerApiKey: getGeminiApiKey() || undefined,
    sessionToken: readSessionBearer(),
  });
}

export async function deleteCapture(clientLocalId: string): Promise<void> {
  await convex.mutation(api.voiceCapture.deleteCapture, {
    clientLocalId,
    sessionToken: readSessionBearer(),
  });
}

export async function getSegmentUrl(
  clientLocalId: string,
  segmentIndex: number
): Promise<string | null> {
  return convex.query(api.voiceCapture.getSegmentUrl, {
    clientLocalId,
    segmentIndex,
    sessionToken: readSessionBearer(),
  });
}

/**
 * transcribeBatch — one-shot verbatim transcription through the backend
 * provider chain (Whisper → Gemini), no storage, no capture row. Used by
 * the retrofitted legacy dictation surfaces (NoteEditor mic, SaveToNoteForm).
 */
export async function transcribeBatch(args: {
  audioBase64: string;
  continuationTail?: string;
}): Promise<{ text: string; provider: string }> {
  return convex.action(api.voiceCapture.transcribeBatch, {
    ...args,
    sessionToken: readSessionBearer(),
  });
}

// ─── EDIT SELECTION BY VOICE (owner spec 2026-11-19, Part 2 §6) ─────────────

/** Rewrite ONLY the highlighted passage per the spoken instruction. */
export async function editSelection(args: {
  selectedText: string;
  instruction: string;
  surroundingText?: string;
}): Promise<{ rewritten: string }> {
  return convex.action(api.voiceCapture.editSelection, {
    ...args,
    callerApiKey: getGeminiApiKey() || undefined,
    sessionToken: readSessionBearer(),
  });
}

// ─── ENDORSEMENT FORMATTING (matter timeline composer) ──────────────────────

/**
 * Tidy a dictated case endorsement — filler out, structure in, facts frozen
 * exactly as dictated (see ENDORSEMENT_FORMAT_SYSTEM_PROMPT). Powers the
 * endorsement composer's manual Format button and the auto-format that runs
 * when Aloa Vox dictation stops (TeamDiscussionTab). One shot, no storage.
 */
export async function formatEndorsement(args: {
  endorsementText: string;
  matterTitle?: string;
  matterSuitNumber?: string;
}): Promise<{ formatted: string }> {
  return convex.action(api.voiceCapture.formatEndorsement, {
    ...args,
    callerApiKey: getGeminiApiKey() || undefined,
    sessionToken: readSessionBearer(),
  });
}

// ─── PERSONAL DICTIONARY & SPOKEN SNIPPETS (voiceTools) ─────────────────────

export async function listDictionary(): Promise<VoiceDictionaryEntry[]> {
  return convex.query(api.voiceTools.listDictionary, {
    sessionToken: readSessionBearer(),
  });
}

/** Silent-learning entry point — auto terms from draft edits (no toast
 *  blocking; the caller shows "Added 'X' to your Voice Dictionary"). */
export async function addDictionaryTerms(
  terms: string[],
  source: "auto" | "manual" = "auto"
): Promise<{ added: string[]; total: number }> {
  return convex.mutation(api.voiceTools.addDictionaryTerms, {
    terms,
    source,
    sessionToken: readSessionBearer(),
  });
}

export async function removeDictionaryTerm(id: string): Promise<void> {
  await convex.mutation(api.voiceTools.removeDictionaryTerm, {
    id,
    sessionToken: readSessionBearer(),
  });
}

export async function listSnippets(): Promise<VoiceSnippet[]> {
  const rows = await convex.query(api.voiceTools.listSnippets, {
    sessionToken: readSessionBearer(),
  });
  // Seed the firm defaults on first read so they persist as real rows
  // (the backend also serves the in-code defaults before that).
  if (rows.length > 0 && rows.every((r: any) => String(r.id).startsWith("default-"))) {
    try {
      await convex.mutation(api.voiceTools.seedDefaultSnippets, {
        sessionToken: readSessionBearer(),
      });
    } catch { /* seeding is best-effort */ }
  }
  return rows;
}

export async function saveSnippet(args: {
  id?: string;
  trigger: string;
  content: string;
}): Promise<{ id: string }> {
  return convex.mutation(api.voiceTools.saveSnippet, {
    ...args,
    sessionToken: readSessionBearer(),
  });
}

export async function deleteSnippet(id: string): Promise<void> {
  await convex.mutation(api.voiceTools.deleteSnippet, {
    id,
    sessionToken: readSessionBearer(),
  });
}

// ─── DRAFTPRO VOICE EDIT (owner spec 2026-11-19, §7.4) ───────────────────────

/** Rewrite / add-to / delete ONE selected block in a DraftPro document. */
export async function draftVoiceEdit(args: {
  selectedText: string;
  instruction: string;
  documentType?: string;
  surroundingText?: string;
}): Promise<{ intent: "add" | "delete" | "rewrite"; text: string }> {
  return convex.action(api.voiceCapture.draftVoiceEdit, {
    ...args,
    callerApiKey: getGeminiApiKey() || undefined,
    sessionToken: readSessionBearer(),
  });
}
