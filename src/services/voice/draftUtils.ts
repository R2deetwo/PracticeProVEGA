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
