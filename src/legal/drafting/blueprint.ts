/**
 * legal/drafting/blueprint.ts — Stage 1 of the Voice → DraftPro pipeline:
 * validating + normalising the LLM's extraction into a DraftBlueprint
 * (owner spec 2026-11-19, §4 "PHASE 2: Voice Extraction").
 *
 * Deterministic guarantees this module enforces (no LLM involved):
 *   - schema validation with a typed PASS/FAIL result the caller uses to
 *     drive the reject → retry-once → minimal-fallback flow (spec §4.1);
 *   - document-type resolution: enum check first, then the deterministic
 *     ALIAS MAP; unresolvable names NEVER guess — they surface as a
 *     clarifying missingCriticalFields entry (spec §4.4);
 *   - bundle dependency ordering (processes → affidavit → written address;
 *     NTQ before the Seven Days' Notice; spec §4.3);
 *   - cleaning rules for dictated content: meta-speech stripped, spoken
 *     self-corrections resolved to the corrected value ONLY ("ten days,
 *     no, fourteen days" → "fourteen days"; spec §4.2);
 *   - the 0.85 matter-match gate: below it the blueprint is NEVER
 *     auto-linked and the top-3 alternatives ride along (spec §4.5).
 *
 * Zero runtime imports besides draftUtils (itself import-free) — shared by
 * the client bundle, the Convex function bundle and unit tests.
 */

import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_CATEGORIES,
  resolveDocumentTypeByAlias,
  sortBlueprintDocuments,
} from "./documentTypes";
import type {
  DictatedContent,
  DocumentCategory,
  DocumentType,
  DraftBlueprint,
} from "./types";
import { stripMetaSpeech } from "../../services/voice/draftUtils";

// ─── Caps ───────────────────────────────────────────────────────────────────

const MAX_ITEMS = {
  reliefs: 20,
  groundsOrFacts: 40,
  amounts: 12,
  periods: 12,
  dates: 12,
  namedPeople: 12,
  specialInstructions: 12,
};
const MAX_CHARS = {
  relief: 500,
  fact: 800,
  instruction: 400,
  label: 160,
  name: 160,
  role: 120,
};
/** Never auto-link a blueprint to a matter below this confidence (spec §4.5). */
export const MATTER_MATCH_AUTO_LINK_THRESHOLD = 0.85;

// ─── Dictated cleaning (spec §4.2) ──────────────────────────────────────────

/** Pivot phrases that mark a spoken self-correction. */
const PIVOT_RE =
  /\b(?:no|nope|wait|actually|i mean|make that|scratch that|sorry|rather|correction)\b/i;

/** True for pivot items that retract the whole preceding phrase. */
const PHRASE_RETRACTION_RE = /\b(?:scratch that|make that|cancel that|correction)\b/i;

const NUMBER_WORD_RE =
  /^(?:\d+(?:[.,]\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|hundred|thousand|million|millions|billion|bn|k)$/i;
const DATE_WORD_RE =
  /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|week|weeks|month|months|day|days|year|years|hour|hours|o'?clock|am|pm|p\.m\.|a\.m\.)$/i;

/** A "value word" is a number, date or unit token that can be corrected. */
function isValueWord(w: string): boolean {
  const clean = w.replace(/[₦$£€,%]/g, "");
  if (!clean) return false;
  return NUMBER_WORD_RE.test(clean) || DATE_WORD_RE.test(clean);
}

/**
 * Find the trailing value phrase: the contiguous run of value words
 * (number/date/unit tokens, ≤4) at the END of a comma-item, e.g. "the
 * notice period is ten days" → "ten days".
 */
function trailingValuePhrase(item: string): string | null {
  const words = item.trim().split(/\s+/);
  const tail: string[] = [];
  for (let i = words.length - 1; i >= 0 && tail.length < 4; i--) {
    if (!isValueWord(words[i])) break;
    tail.unshift(words[i]);
  }
  return tail.length > 0 ? tail.join(" ") : null;
}

/**
 * resolveSelfCorrections — deterministic defence-in-depth for spoken
 * backtracking (the Smart Clean tier + the extraction prompt already resolve
 * corrections semantically; this guarantees the corrected value ONLY ever
 * survives into dictated content, spec §4.2).
 *
 * Comma/dash-clause semantics: "A, no, B" → B. When the item directly
 * before the pivot is a short value ("ten days"), the whole item is the
 * retracted value; when it is a longer phrase, only its trailing value
 * phrase is retracted ("the period is ten days, no, fourteen days" →
 * "the period is fourteen days"); phrase-retraction pivots ("scratch
 * that") always retract the entire preceding item.
 */
export function resolveSelfCorrections(text: string): string {
  let out = (text || "").trim();
  for (let round = 0; round < 4; round++) {
    const next = resolveOnce(out);
    if (next === out) break;
    out = next;
  }
  return out.trim().replace(/\s{2,}/g, " ");
}

/** Strip leading pivot phrases ("no, wait," → "") so a tail that is itself
 *  still a pivot falls through to the next clause. */
function stripLeadingPivots(s: string): string {
  let out = (s || "").trim();
  for (let k = 0; k < 4; k++) {
    const m = out.match(
      /^(?:no|nope|wait|actually|i mean|make that|scratch that|sorry|rather|correction)\b[:,]?\s*/i
    );
    if (!m) break;
    out = out.slice(m[0].length).trim();
  }
  return out;
}

function resolveOnce(text: string): string {
  if (!text) return text;
  // Split into clauses on commas / semicolons / dashes.
  const items = text
    .split(/[,;—–]|\s-\s/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (items.length < 2) return text;

  // Find the LAST item that is (or starts with) a pivot.
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const strippedTail = stripLeadingPivots(item);
    const isPivotItem = strippedTail === "";
    if (!isPivotItem && !PIVOT_RE.test(item)) continue;

    // The corrected tail: inside the pivot item, else the next clause.
    let tail = isPivotItem ? "" : strippedTail;
    let tailFromNext = false;
    if (!tail) {
      tail = items[i + 1] || "";
      tailFromNext = !!tail;
    }
    if (!tail) continue;

    const before = i > 0 ? items[i - 1] : null;
    if (before === null) {
      // Nothing retracted — drop the pivot item itself.
      const kept = items.filter((_, idx) => idx !== i);
      return kept.length ? kept.join(", ") : tail;
    }

    const phraseRetraction =
      PHRASE_RETRACTION_RE.test(item) || PHRASE_RETRACTION_RE.test(before);
    // What of the retracted clause survives?
    let head = "";
    if (!phraseRetraction) {
      const vp = trailingValuePhrase(before);
      if (vp && vp.length < before.length) {
        // "the period is ten days" → keep "the period is", retract "ten days".
        head = before.slice(0, before.length - vp.length).trim();
      } else if (!vp && before.split(/\s+/).length <= 5) {
        // Short item entirely retracted ("ten days", "Tuesday at 2 PM").
        head = "";
      } else if (!vp) {
        // Long item, no value phrase — cannot retract deterministically;
        // keep the clause (the Smart Clean tier already resolved semantics).
        head = before;
      }
      // (vp && vp.length === before.length): the whole item IS the value.
    }

    const keptBefore = items.slice(0, Math.max(0, i - 1));
    const merged = head ? `${head} ${tail}` : tail;
    const skipFrom = tailFromNext ? i + 2 : i + 1;
    return [...keptBefore, merged, ...items.slice(skipFrom)]
      .filter((s) => s.length > 0)
      .join(", ");
  }
  return text;
}

/** Clean ONE dictated string item: strip meta-speech, resolve corrections,
 *  normalise whitespace, capitalise the first letter. */
export function cleanDictatedItem(raw: string): string {
  const stripped = stripMetaSpeech(String(raw || ""));
  const corrected = resolveSelfCorrections(stripped);
  const t = corrected.replace(/\s{2,}/g, " ").trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ─── Payload validation (spec §4.1) ─────────────────────────────────────────

/** The raw JSON shape the extractor is contracted to emit. */
export interface RawDraftBlueprint {
  documents?: unknown;
  reliefs?: unknown;
  groundsOrFacts?: unknown;
  amounts?: unknown;
  periods?: unknown;
  dates?: unknown;
  namedPeople?: unknown;
  specialInstructions?: unknown;
}

export type BlueprintValidation =
  | { ok: true; value: DraftBlueprint }
  | { ok: false; reason: string };

/** The safe fallback: never loses the dictation (spec §4.1). */
export function minimalBlueprint(rawTranscript: string): DraftBlueprint {
  return {
    documents: [],
    matchedMatterId: null,
    matchConfidence: 0,
    matchAlternatives: [],
    dictated: {
      reliefs: [],
      groundsOrFacts: [],
      amounts: [],
      periods: [],
      dates: [],
      namedPeople: [],
      specialInstructions: [],
    },
    missingCriticalFields: [
      {
        key: "documents.clarification",
        label: "Which document(s) to draft",
        documentIndex: 0,
      },
    ],
    rawTranscript: rawTranscript || "",
  };
}

const isDocumentType = (x: string): x is DocumentType =>
  (DOCUMENT_TYPES as readonly string[]).includes(x);

/** Resolve ONE spoken/enum document reference. Deterministic first. */
export function resolveDocumentReference(ref: string): DocumentType | null {
  const t = String(ref || "").trim();
  if (!t) return null;
  // 1. Direct enum value (the LLM's own resolution).
  if (isDocumentType(t)) return t;
  // 2. Deterministic alias map (spec §4.4).
  return resolveDocumentTypeByAlias(t);
}

const CURRENCIES = ["NGN", "USD", "GBP", "EUR"] as const;
const UNITS = ["days", "weeks", "months", "years"] as const;

function strArray(v: unknown, cap: number, maxChars: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => cleanDictatedItem(String(x ?? "")))
    .filter((s) => s.length > 0)
    .slice(0, cap)
    .map((s) => s.slice(0, maxChars));
}

function parseDictated(raw: RawDraftBlueprint): DictatedContent {
  const amounts = (Array.isArray(raw.amounts) ? raw.amounts : [])
    .slice(0, MAX_ITEMS.amounts)
    .map((a: any) => ({
      label: String(a?.label || "").trim().slice(0, MAX_CHARS.label),
      amount: Number(a?.amount),
      currency: (CURRENCIES as readonly string[]).includes(String(a?.currency || "").toUpperCase())
        ? (String(a.currency).toUpperCase() as "NGN" | "USD" | "GBP" | "EUR")
        : "NGN",
    }))
    .filter((a) => a.label && isFinite(a.amount) && a.amount > 0 && a.amount <= 1e15);

  const periods = (Array.isArray(raw.periods) ? raw.periods : [])
    .slice(0, MAX_ITEMS.periods)
    .map((p: any) => ({
      label: String(p?.label || "").trim().slice(0, MAX_CHARS.label),
      value: Number(p?.value),
      unit: (UNITS as readonly string[]).includes(String(p?.unit || "").toLowerCase())
        ? (String(p.unit).toLowerCase() as "days" | "weeks" | "months" | "years")
        : "days",
    }))
    .filter((p) => p.label && isFinite(p.value) && p.value > 0 && p.value <= 1000);

  const dates = (Array.isArray(raw.dates) ? raw.dates : [])
    .slice(0, MAX_ITEMS.dates)
    .map((d: any) => ({
      label: String(d?.label || "").trim().slice(0, MAX_CHARS.label),
      iso: /^\d{4}-\d{2}-\d{2}$/.test(String(d?.iso || "")) ? String(d.iso) : "",
    }))
    .filter((d) => d.label && d.iso);

  const namedPeople = (Array.isArray(raw.namedPeople) ? raw.namedPeople : [])
    .slice(0, MAX_ITEMS.namedPeople)
    .map((p: any) => ({
      name: String(p?.name || "").trim().slice(0, MAX_CHARS.name),
      role: String(p?.role || "").trim().slice(0, MAX_CHARS.role),
    }))
    .filter((p) => p.name);

  return {
    reliefs: strArray(raw.reliefs, MAX_ITEMS.reliefs, MAX_CHARS.relief),
    groundsOrFacts: strArray(raw.groundsOrFacts, MAX_ITEMS.groundsOrFacts, MAX_CHARS.fact),
    amounts,
    periods,
    dates,
    namedPeople,
    specialInstructions: strArray(
      raw.specialInstructions,
      MAX_ITEMS.specialInstructions,
      MAX_CHARS.instruction
    ),
  };
}

/**
 * validateDraftBlueprint — full validation + normalisation of the LLM's
 * blueprint payload. PASS iff the payload is an object with at least one
 * dictated element or one resolvable document (an empty blueprint the model
 * emitted for a non-drafting note FAILs fast so the caller treats it as
 * "no blueprint").
 */
export function validateDraftBlueprint(
  raw: unknown,
  opts: {
    rawTranscript: string;
    /** Ranked matter matches (matterId, confidence, label) — the gate. */
    matches: Array<{ matterId: string; confidence: number; label?: string }>;
  }
): BlueprintValidation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "draftBlueprint is not an object" };
  }
  const payload = raw as RawDraftBlueprint;
  const dictated = parseDictated(payload);
  const hasDictated =
    dictated.reliefs.length > 0 ||
    dictated.groundsOrFacts.length > 0 ||
    dictated.amounts.length > 0 ||
    dictated.periods.length > 0 ||
    dictated.dates.length > 0 ||
    dictated.namedPeople.length > 0 ||
    dictated.specialInstructions.length > 0;

  // ── Document resolution (deterministic alias first, enum second) ──────
  const rawDocs = Array.isArray(payload.documents) ? payload.documents : [];
  const resolved: DocumentType[] = [];
  const unresolvedSpoken: string[] = [];
  const seen = new Set<DocumentType>();
  for (const d of rawDocs.slice(0, 6)) {
    const spoken = String((d as any)?.type || (d as any)?.spoken || d || "").trim();
    if (!spoken) continue;
    const t = resolveDocumentReference(spoken);
    if (t && !seen.has(t)) {
      seen.add(t);
      resolved.push(t);
    } else if (!t) {
      unresolvedSpoken.push(spoken.slice(0, 120));
    }
  }

  if (resolved.length === 0 && !hasDictated) {
    return { ok: false, reason: "no documents and no dictated content" };
  }

  const missingCriticalFields: DraftBlueprint["missingCriticalFields"] = [];
  if (resolved.length === 0) {
    // Spec §4.4: unresolvable → documents: [] + clarifying entry; never guess.
    missingCriticalFields.push({
      key: "documents.clarification",
      label: `Which document(s) to draft${unresolvedSpoken.length ? ` — could not map "${unresolvedSpoken[0]}"` : ""}`,
      documentIndex: 0,
    });
  } else if (unresolvedSpoken.length > 0) {
    // Partial resolution: keep what resolved, flag the rest (DECISION D11 —
    // never guess, never discard valid extraction).
    missingCriticalFields.push({
      key: "documents.clarification",
      label: `Also mentioned but unmapped: ${unresolvedSpoken.join(", ")}`,
      documentIndex: 0,
    });
  }

  // ── Bundle dependency order (spec §4.3) ───────────────────────────────
  const ordered = sortBlueprintDocuments(
    resolved.map((documentType) => ({
      documentType,
      BUNDLE_ORDER_HINT: 0,
    }))
  );
  const documents = ordered.map((d, i) => ({
    documentCategory: DOCUMENT_TYPE_CATEGORIES[d.documentType] as DocumentCategory,
    documentType: d.documentType,
    order: i + 1,
  }));

  // ── Matter gate (spec §4.5): auto-link ONLY at ≥ 0.85 ─────────────────
  const ranked = [...opts.matches].sort((a, b) => b.confidence - a.confidence);
  const top = ranked[0];
  const autoLinked = !!(top && top.confidence >= MATTER_MATCH_AUTO_LINK_THRESHOLD);
  const matchAlternatives = autoLinked
    ? []
    : ranked.slice(0, 3).map((m) => ({
        matterId: m.matterId,
        label: m.label || m.matterId,
        score: m.confidence,
      }));

  return {
    ok: true,
    value: {
      documents,
      matchedMatterId: autoLinked ? top.matterId : null,
      matchConfidence: top ? top.confidence : 0,
      matchAlternatives,
      dictated,
      missingCriticalFields,
      rawTranscript: opts.rawTranscript || "",
    },
  };
}

/** True when a normalised blueprint is worth showing (any document or any
 *  dictated content) — drives the triage card's Drafting Blueprint section. */
export function blueprintIsSubstantive(bp: DraftBlueprint | null | undefined): boolean {
  if (!bp) return false;
  return (
    bp.documents.length > 0 ||
    bp.dictated.reliefs.length > 0 ||
    bp.dictated.groundsOrFacts.length > 0 ||
    bp.dictated.specialInstructions.length > 0 ||
    bp.dictated.amounts.length > 0 ||
    bp.dictated.namedPeople.length > 0
  );
}
