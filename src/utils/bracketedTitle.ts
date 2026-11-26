/**
 * Bracketed title splitting — Stage 2A (owner report 2026-11-25).
 *
 * Document titles in the firm library regularly carry a parenthetical
 * qualifier — "Client Interview Guide: Divorce (Abusive Husband)" —
 * and the Documents list and breadcrumb clipped those titles mid-bracket
 * when truncating ("…(Abusive Hus…"). The split below lets callers
 * render the bracketed qualifier as its own fully-wrapped element so
 * the entire phrase/bracket stays enclosed, instead of an awkward clip.
 */

export interface SplitTitle {
    /** The title without the trailing parenthetical qualifier. */
    main: string;
    /**
     * The trailing parenthetical qualifier INCLUDING its brackets — e.g.
     * "(Abusive Husband)" — or null when the title has no bracketed
     * qualifier worth splitting off.
     */
    parenthetical: string | null;
}

/**
 * Split a display title into its main part and trailing bracketed qualifier.
 *
 * Rules, deliberately conservative so ordinary titles (including ones that
 * merely contain an opening bracket, or unbalanced ones) pass through whole:
 *  - Only the FIRST "(" and the LAST ")" participate, so nested groups stay
 *    inside the qualifier ("Divorce (Adultery, Cruelty)") stay together.
 *  - The brackets must actually wrap something ("()" is not a qualifier).
 *  - If everything before the bracket is blank, the title passes through
 *    whole (the bracket is the title's only content, not a qualifier).
 */
export function splitBracketedTitle(title: string | null | undefined): SplitTitle {
    const clean = (title ?? '').trim();
    if (!clean) return { main: '', parenthetical: null };

    const open = clean.indexOf('(');
    if (open === -1) return { main: clean, parenthetical: null };

    const close = clean.lastIndexOf(')');
    if (close === -1 || close < open) return { main: clean, parenthetical: null };

    const main = clean.slice(0, open).trim();
    const parenthetical = clean.slice(open, close + 1).trim();
    if (!main || !parenthetical || parenthetical === '()') {
        return { main: clean, parenthetical: null };
    }

    return { main, parenthetical };
}
