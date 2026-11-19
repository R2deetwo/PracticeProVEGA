/**
 * legal/drafting/voiceEditGuards.ts — the deterministic refusal rules behind
 * Edit Selection by Voice in DraftPro (owner spec 2026-11-19, §7.4).
 *
 * The edit may change prose slots and numbered items only; it may NOT alter
 * hydrated slots (court, parties, case number) or structural blocks. These
 * pure guards are shared by the editor component and the unit tests so the
 * refusal behaviour is pinned (AC4.4).
 */

/** Court-record identifiers that are never voice-editable (AC4.4). */
const CASE_NUMBER_TEXT_RE = /\b(SUIT|APPEAL|MOTION)\s*(NO|NUMBER)\b/i;

/** Instructions that target the suit/case number are refused (AC4.4). */
const CASE_NUMBER_INSTRUCTION_RE =
  /\b(change|edit|update|amend|alter|rewrite|fix|make)\b[^.]{0,40}\b(suit|case|appeal|motion)\s*(no|number)\b/i;

/** A selection that sits inside centre/right-aligned (structural) court
 *  furniture — the editor supplies the alignments it found. */
export function selectionIsStructural(alignments: Array<string | undefined | null>): boolean {
  return alignments.some((a) => a === 'center' || a === 'right');
}

/**
 * The refusal message for a voice edit, or null when the edit is allowed.
 * Pure — the editor passes the selected text, the spoken instruction and
 * the text alignments intersecting the selection.
 */
export function voiceEditRefusalReason(args: {
  selectedText: string;
  instruction: string;
  /** textAlign values of the blocks intersecting the selection. */
  alignments?: Array<string | undefined | null>;
}): string | null {
  const { selectedText, instruction, alignments } = args;
  if (CASE_NUMBER_TEXT_RE.test(selectedText)) {
    return 'The suit/case number is court record data — edit it with its placeholder pill, not by voice.';
  }
  if (CASE_NUMBER_INSTRUCTION_RE.test(instruction)) {
    return 'Voice edits cannot change the suit/case number — court record data is protected.';
  }
  if (CASE_NUMBER_TEXT_RE.test(instruction)) {
    return 'Voice edits cannot change the suit/case number — court record data is protected.';
  }
  if (selectionIsStructural(alignments || [])) {
    return 'Court headings, case numbers and signature blocks are fixed structure — voice edits work on paragraphs, reliefs and grounds.';
  }
  return null;
}
