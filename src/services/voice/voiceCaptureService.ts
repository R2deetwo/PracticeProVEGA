/**
 * voiceCaptureService — typed client for the Voice Capture Engine backend
 * (convex/voiceCapture.ts). Follows the geminiService pattern: a module-level
 * ConvexHttpClient for imperative (non-hook) calls, with the session bearer
 * read from storage on every request — never cached, never logged.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { convertBlobToWav } from "../../utils/webmToWav";
// Exact backend result types — importing them keeps client and server
// contracts in lockstep (triageMeta is `any` server-side; the typed view
// below is what the UI consumes).
import type {
  FinalizeCaptureResult,
  QuickAskResult,
  QuickAskSource,
} from "../../../convex/voiceCapture";

export type { FinalizeCaptureResult, QuickAskResult, QuickAskSource };

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

export type CaptureKind = "quick" | "legalpad";
export type OutputMode = "smart-clean" | "verbatim";
export type CaptureStatus = "recording" | "transcribing" | "ready" | "failed";
export type TriageIntent = "case_note" | "schedule" | "question" | "share";

export interface TriageEventDraft {
  title: string;
  type: string;
  dateISO: string;
  time: string;
  location?: string;
}

export interface TriageMeta {
  intent?: TriageIntent;
  matterCandidates?: string[];
  events?: TriageEventDraft[];
  isQuestion?: boolean;
  questionText?: string;
  summary?: string;
  matchedMatterIds?: string[];
  matchedContactIds?: string[];
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
    sessionToken: readSessionBearer(),
  });
}

export async function finalizeCapture(args: {
  clientLocalId: string;
  shorthandText?: string;
  eventTypeNames?: string[];
  totalDurationMs?: number;
}): Promise<FinalizeCaptureResult> {
  return convex.action(api.voiceCapture.finalizeCapture, {
    ...args,
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

export async function quickAsk(question: string): Promise<QuickAskResult> {
  return convex.action(api.voiceCapture.quickAsk, {
    question,
    sessionToken: readSessionBearer(),
  });
}

export async function repolish(clientLocalId: string): Promise<{ smartCleanText: string }> {
  return convex.action(api.voiceCapture.repolish, {
    clientLocalId,
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
