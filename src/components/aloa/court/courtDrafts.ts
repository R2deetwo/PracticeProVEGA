/**
 * Round 19 — Court Mode draft persistence (pure functions, no React).
 *
 * Survives panel close/reopen and page reload; cleared on save success,
 * explicit discard, and sign-out. Text only — audio is NEVER stored.
 * Keys are matterIds; values are plain JSON-safe objects.
 */
import { OutcomeDraft } from "../courtModeUtils";

export interface StoredCourtDraft {
  text: string;
  noteType: "endorsement" | "user";
  nextDate: OutcomeDraft["nextDate"];
  updatedAt: number;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const isValidNextDate = (value: unknown): value is NonNullable<StoredCourtDraft["nextDate"]> => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  // ROUND 21: an EMPTY dateISO is valid — the purpose/time can be chosen
  // before the date itself (the draft survives without text).
  if (typeof candidate.dateISO !== "string" || !/^\d{4}-\d{2}-\d{2}$|^$/.test(candidate.dateISO)) return false;
  if (candidate.timeHHmm !== null && typeof candidate.timeHHmm !== "string") return false;
  if (typeof candidate.purpose !== "string") return false;
  if (candidate.purposeOther !== undefined && typeof candidate.purposeOther !== "string") return false;
  if (candidate.source !== "detected" && candidate.source !== "manual") return false;
  return true;
};

const isValidDraft = (value: unknown): value is StoredCourtDraft => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.text !== "string") return false;
  if (candidate.noteType !== "endorsement" && candidate.noteType !== "user") return false;
  if (typeof candidate.updatedAt !== "number" || !Number.isFinite(candidate.updatedAt)) return false;
  if (candidate.nextDate !== null && !isValidNextDate(candidate.nextDate)) return false;
  return true;
};

/**
 * Parse a stored drafts blob. Drops entries older than 7 days and malformed
 * entries. NEVER throws — storage corruption degrades to "no drafts".
 */
export function parseDrafts(raw: string | null, nowMs: number): Record<string, StoredCourtDraft> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

  const out: Record<string, StoredCourtDraft> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!key || !isValidDraft(value)) continue;
    const draft = value as StoredCourtDraft;
    if (nowMs - draft.updatedAt > SEVEN_DAYS_MS) continue;
    out[key] = draft;
  }
  return out;
}

/** Serialize the drafts record back to JSON. Never throws.
 * Round 21: a draft with neither text nor a dated next date is dropped —
 * the same rule the hook's setDraft applies, so a stale empty row can never
 * survive a round-trip. */
export function serializeDrafts(drafts: Record<string, StoredCourtDraft>): string {
  const clean: Record<string, StoredCourtDraft> = {};
  for (const [key, value] of Object.entries(drafts)) {
    if (!isValidDraft(value)) continue;
    if (!value.text.trim() && !value.nextDate?.dateISO) continue;
    clean[key] = value;
  }
  try {
    return JSON.stringify(clean);
  } catch {
    return "{}";
  }
}
