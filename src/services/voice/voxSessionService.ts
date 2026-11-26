/**
 * voxSessionService — typed client for the Vox Session Capture backend
 * (convex/voxSessions.ts). Follows the voiceCaptureService pattern: a
 * module-level ConvexHttpClient for imperative (non-hook) calls, with the
 * session bearer read from storage on every request — never cached, never
 * logged.
 *
 * Mode B of the dual-mode Vox (owner spec 2026-11-22): record or upload a
 * full legal session, get the speaker-attributed transcript + the one-click
 * synthesis (file note / action items / issue map), optional follow-up
 * drafts, and Ask Aloa Vox cross-session recall with timestamped citations.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { convertBlobToWav } from "../../utils/webmToWav";
import { getGeminiApiKey } from "../../utils/aiUtils";
// Exact backend result types — importing them keeps client and server
// contracts in lockstep.
import type {
  VoxSessionView,
  VoxTurnView,
  VoxOutputsView,
  VoxUploadSegmentResult,
  VoxFinalizeResult,
  VoxDraftResult,
  AskVoxResult,
  AskVoxSource,
} from "../../../convex/voxSessions";

export type {
  VoxSessionView,
  VoxTurnView,
  VoxOutputsView,
  VoxUploadSegmentResult,
  VoxFinalizeResult,
  VoxDraftResult,
  AskVoxResult,
  AskVoxSource,
};

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

// ─── Types (client vocabulary) ──────────────────────────────────────────────

export type VoxSessionType = "intake" | "interview" | "debrief" | "court_note" | "meeting";

export const VOX_SESSION_TYPE_OPTIONS: { value: VoxSessionType; label: string; hint: string }[] = [
  { value: "intake", label: "Client Intake", hint: "First instructions, facts and conflict details." },
  {
    value: "interview",
    label: "Witness / Third-Party Interview",
    hint: "Witness accounts with clear attribution.",
  },
  {
    value: "debrief",
    label: "Strategy & Chambers Debrief",
    hint: "Internal case strategy discussions.",
  },
  {
    value: "court_note",
    // ROUND 20 (owner directive): in Nigerian legal parlance this is an
    // ENDORSEMENT (some call it a case note) — that is our vocabulary now.
    // The stored value stays "court_note" (existing sessions depend on it).
    label: "Endorsement",
    hint: "Ruling, orders and next date, right after court.",
  },
  { value: "meeting", label: "General Meeting", hint: "Any other recorded meeting." },
];

export type VoxDraftType = "client_recap" | "internal_memo" | "instruction_confirmation";

export const VOX_DRAFT_OPTIONS: { value: VoxDraftType; label: string }[] = [
  { value: "client_recap", label: "Client recap note" },
  { value: "internal_memo", label: "Internal memo" },
  { value: "instruction_confirmation", label: "Instruction confirmation letter" },
];

/** "[MM:SS]" (or "H:MM:SS") for a millisecond offset — mirrors the backend
 *  tag so transcript rows and citations always agree. */
export function formatVoxTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ─── Upload + finalize (the capture pipeline) ──────────────────────────────

export interface VoxUploadSegmentArgs {
  clientLocalId: string;
  segmentIndex: number;
  /** Raw recorded/uploaded blob — converted to 16 kHz mono WAV here. */
  blob: Blob;
  startMs: number;
  endMs: number;
  startedAt?: number;
  title?: string;
  sessionType?: VoxSessionType;
  captureSource?: "mic" | "system_audio" | "upload";
  matterId?: string;
  retentionDays?: number;
}

/** Upload ONE segment of a session: normalize to WAV on-device, base64 it,
 *  send for diarized transcription + archival. Idempotent per
 *  (clientLocalId, segmentIndex). */
export async function uploadVoxSegment(args: VoxUploadSegmentArgs): Promise<VoxUploadSegmentResult> {
  const wavBlob = await convertBlobToWav(args.blob);
  const audioBase64 = await blobToBase64(wavBlob);
  return convex.action(api.voxSessions.uploadSegment, {
    clientLocalId: args.clientLocalId,
    segmentIndex: args.segmentIndex,
    audioBase64,
    startMs: args.startMs,
    endMs: args.endMs,
    startedAt: args.startedAt,
    title: args.title,
    sessionType: args.sessionType,
    captureSource: args.captureSource,
    matterId: args.matterId,
    retentionDays: args.retentionDays,
    callerApiKey: getGeminiApiKey() || undefined,
    sessionToken: readSessionBearer(),
  });
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

export async function finalizeVoxSession(args: {
  clientLocalId: string;
  totalDurationMs?: number;
  title?: string;
  sessionType?: VoxSessionType;
  matterId?: string;
}): Promise<VoxFinalizeResult> {
  return convex.action(api.voxSessions.finalizeSession, {
    ...args,
    callerApiKey: getGeminiApiKey() || undefined,
    sessionToken: readSessionBearer(),
  });
}

// ─── Session reads ─────────────────────────────────────────────────────────

export async function listVoxSessions(opts?: {
  matterId?: string;
  limit?: number;
}): Promise<VoxSessionView[]> {
  return convex.query(api.voxSessions.listSessions, {
    matterId: opts?.matterId,
    limit: opts?.limit,
    sessionToken: readSessionBearer(),
  });
}

export async function getVoxSession(clientLocalId: string): Promise<VoxSessionView | null> {
  try {
    return await convex.query(api.voxSessions.getSession, {
      clientLocalId,
      sessionToken: readSessionBearer(),
    });
  } catch (err: any) {
    if (String(err?.message || "").includes("Session not found")) return null;
    throw err;
  }
}

export async function getVoxSegmentAudioUrl(
  clientLocalId: string,
  segmentIndex: number
): Promise<string | null> {
  return convex.query(api.voxSessions.getSegmentAudioUrl, {
    clientLocalId,
    segmentIndex,
    sessionToken: readSessionBearer(),
  });
}

// ─── Session edits ─────────────────────────────────────────────────────────

export async function updateVoxSessionMeta(args: {
  clientLocalId: string;
  title?: string;
  sessionType?: VoxSessionType;
  matterId?: string;
  retentionDays?: number;
}): Promise<void> {
  await convex.mutation(api.voxSessions.updateSessionMeta, {
    ...args,
    sessionToken: readSessionBearer(),
  });
}

/** Rename one speaker across the whole session (label + optional role). */
export async function renameVoxSpeaker(args: {
  clientLocalId: string;
  fromLabel: string;
  toLabel: string;
  // Same vocabulary the diarization prompt proposes and the server's
  // renameSpeaker validates (opposing_counsel + judge/court_official
  // joined the set 2026-11-24 — see voxSessions.ts roleFor).
  role?: "counsel" | "client" | "opposing_counsel" | "witness" | "judge" | "court_official" | "other";
}): Promise<{ renamed: number }> {
  return convex.mutation(api.voxSessions.renameSpeaker, {
    ...args,
    sessionToken: readSessionBearer(),
  });
}

export async function toggleVoxActionItem(args: {
  clientLocalId: string;
  itemId: string;
  completed: boolean;
}): Promise<void> {
  await convex.mutation(api.voxSessions.toggleActionItem, {
    ...args,
    sessionToken: readSessionBearer(),
  });
}

export async function deleteVoxSession(clientLocalId: string): Promise<void> {
  await convex.mutation(api.voxSessions.deleteSession, {
    clientLocalId,
    sessionToken: readSessionBearer(),
  });
}

// ─── Follow-up drafts ──────────────────────────────────────────────────────

export async function generateVoxFollowUpDraft(args: {
  clientLocalId: string;
  type: VoxDraftType;
}): Promise<VoxDraftResult> {
  return convex.action(api.voxSessions.generateFollowUpDraft, {
    ...args,
    callerApiKey: getGeminiApiKey() || undefined,
    sessionToken: readSessionBearer(),
  });
}

// ─── Ask Aloa Vox (cross-session recall) ───────────────────────────────────

export async function askAloaVox(
  question: string,
  opts?: { matterId?: string }
): Promise<AskVoxResult> {
  return convex.action(api.voxSessions.askVox, {
    question,
    matterId: opts?.matterId,
    callerApiKey: getGeminiApiKey() || undefined,
    sessionToken: readSessionBearer(),
  });
}

// ─── Export helpers (client-side file generation) ──────────────────────────

/** The complete session record as Markdown (header + transcript + outputs). */
export function buildSessionMarkdown(session: VoxSessionView): string {
  const lines: string[] = [];
  lines.push(`# ${session.title || "Untitled session"}`);
  lines.push("");
  lines.push(`- **Session type:** ${session.sessionTypeLabel}`);
  if (session.matterId) lines.push(`- **Linked matter:** ${session.matterId}`);
  lines.push(`- **Recorded:** ${session.createdAt || ""}`);
  if (session.durationSeconds) {
    lines.push(`- **Duration:** ${formatVoxTimestamp(session.durationSeconds * 1000)}`);
  }
  lines.push("");
  if (session.outputs?.fileNoteMarkdown) {
    lines.push(session.outputs.fileNoteMarkdown);
    lines.push("");
  }
  const turns = session.turns || [];
  if (turns.length > 0) {
    lines.push("## Transcript");
    lines.push("");
    for (const t of turns) {
      lines.push(`**[${formatVoxTimestamp(t.startMs)}] ${t.speakerLabel}:** ${t.text}`);
      lines.push("");
    }
  }
  const items = session.outputs?.actionItems || [];
  if (items.length > 0) {
    lines.push("## Action items");
    lines.push("");
    for (const i of items) {
      const bits = [i.owner ? `owner: ${i.owner}` : "", i.dueDateText ? `due: ${i.dueDateText}` : ""].filter(Boolean);
      lines.push(`- [${i.completed ? "x" : " "}] ${i.task}${bits.length ? ` (${bits.join(" · ")})` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Download any text payload as a file. */
export function downloadTextFile(filename: string, text: string, mime = "text/markdown"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Markdown → clean export HTML (headers, bold, lists — no chat-app
 *  citation pills; the file note's own [Unverified Fact] tags must survive
 *  verbatim). */
function sessionMarkdownToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc(md)
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^[-*] \[ \] (.*)$/gm, "<li>☐ $1</li>")
    .replace(/^[-*] \[x\] (.*)$/gm, "<li>☑ $1</li>")
    .replace(/^[-*] (.*)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.*)$/gm, "<li>$1</li>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .split(/\n{2,}/)
    .map((block) => {
      const t = block.trim();
      if (!t) return "";
      if (t.startsWith("<h") || t.startsWith("<li")) return t;
      return `<p>${t.replace(/\n/g, "<br/>")}</p>`;
    })
    .filter(Boolean)
    .map((block) => (block.startsWith("<li") ? `<ul>${block}</ul>` : block))
    .join("\n");
}

/** Export the session as a REAL Office Open XML .docx (the DraftPro export
 *  engine — Word opens it without repair; A4, selectable text). */
export async function exportSessionDocx(session: VoxSessionView): Promise<void> {
  const { exportHtmlToDocx } = await import("../../utils/docxExport");
  const filename = `${(session.title || "vox-session").replace(/[^\w\-]+/g, "-").slice(0, 60)}.docx`;
  await exportHtmlToDocx(sessionMarkdownToHtml(buildSessionMarkdown(session)), filename, {
    title: session.title || "Session record",
  });
}
