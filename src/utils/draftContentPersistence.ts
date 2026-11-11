/**
 * draftContentPersistence — V4 (V-DOC-4) pure save-content rule.
 *
 * The DraftPro save form pre-fills its textarea with PLAIN text (HTML tags
 * would read as "weird text" to users) while the formatted HTML rides
 * along. This module decides, honestly, which of the two is persisted:
 *
 *   - If DraftPro supplied HTML AND the user did not edit the textarea
 *     (its value still equals the pre-filled plain text), the HTML is
 *     persisted — formatting survives the round trip.
 *   - If the user edited the text, THEIR words win — honestly, even though
 *     they lose the original formatting by their own edit.
 *
 * Extracted from DocumentForm so the rule is unit-testable (the pre-V4
 * form dropped draftHtml on the floor; the rule lives nowhere testable).
 */
export interface ResolvePersistedContentArgs {
    /** The textarea value at submit time. */
    content?: string | null;
    /** The plain text the form was pre-filled with (ctx.draftContent). */
    plainPrefill?: string | null;
    /** The DraftPro HTML for this save (ctx.draftHtml). */
    draftHtml?: string | null;
}

export function resolvePersistedContent(args: ResolvePersistedContentArgs): string | undefined {
    const { content, plainPrefill, draftHtml } = args;
    if (!draftHtml) return content ?? undefined;
    if (plainPrefill === undefined || plainPrefill === null) return content ?? undefined;
    const untouched = (content ?? '') === (plainPrefill ?? '');
    return untouched ? draftHtml : (content ?? undefined);
}
