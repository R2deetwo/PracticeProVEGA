/**
 * unitNaming — the unit label generator (R39).
 *
 * Owner direction: "Does the app support unit numbering like A1–A6 /
 * B1–B6 — letters plus numbers — the way the landing page's estate grid
 * shows? If not, it should be just a flick of a switch." The schema
 * side needed nothing (unit names are free-form strings end to end —
 * convex readers treat them as opaque labels); the only gap was that
 * every creation flow generated `Unit N` and the main form never let
 * you edit the label. This module is the switch:
 *
 *   'sequential'  Unit 1, Unit 2, Unit 3 …        (the classic default)
 *   'blocks'      A1, A2 … A6, B1, B2 … B6, C1 …  (block letters wrap
 *                 every UNITS_PER_BLOCK units; after Z the prefix runs
 *                 AA, AB … so 200-unit estates still label cleanly)
 *
 * Used by PropertyForm (the Lease & Rent Configuration unit tabs), the
 * Add-Unit button, the auto-add effect and the units sync effect, and
 * by SmartMatterModal's generator — one definition, every entry point.
 */

/** How many units carry one block letter before the next letter starts
 *  (A1–A6 then B1). The landing estate grid runs 6-per-block; so does
 *  the default here. */
export const UNITS_PER_BLOCK = 6;

export type UnitNamingScheme = 'sequential' | 'blocks';

/** Bijective base-26 column letters: 0→A, 25→Z, 26→AA, 27→AB …
 *  (the spreadsheet convention — no zero column). */
function blockLetters(index: number): string {
    let n = index;
    let letters = '';
    while (n >= 0) {
        letters = String.fromCharCode(65 + (n % 26)) + letters;
        n = Math.floor(n / 26) - 1;
    }
    return letters;
}

/** The label for the unit at `index` (0-based) under `scheme`. */
export function unitLabelForIndex(
    index: number,
    scheme: UnitNamingScheme = 'sequential',
    perBlock: number = UNITS_PER_BLOCK,
): string {
    if (index < 0) return `Unit ${index}`;
    if (scheme === 'blocks') {
        const safePerBlock = perBlock > 0 ? perBlock : UNITS_PER_BLOCK;
        return `${blockLetters(Math.floor(index / safePerBlock))}${(index % safePerBlock) + 1}`;
    }
    return `Unit ${index + 1}`;
}

/** Whether a label looks like the block scheme (letter(s) + number),
 *  so forms can auto-detect an estate that already runs A1-style. */
export function isBlockStyleLabel(label: string | undefined | null): boolean {
    return /^[A-Z]{1,3}\d{1,4}$/.test((label || '').trim());
}
