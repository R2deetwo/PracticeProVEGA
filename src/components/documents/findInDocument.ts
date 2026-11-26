/**
 * Find-in-document helpers — Stage 2B (owner report 2026-11-25).
 *
 * The full-screen document reader (HtmlPagePreview inside
 * DocumentPreviewModal) needs real find-in-document: type a query, see
 * every occurrence highlighted, jump between them. The page sheets are
 * plain sanitized HTML rendered via dangerouslySetInnerHTML, so the
 * highlight pass below operates on the HTML STRING, not the live DOM:
 *
 *   1. Tokenize the page HTML into tag segments and text segments.
 *   2. Only TEXT segments are searched — attribute values, tag names and
 *      comments are never touched, so `title="…"` or `class="…"` can
 *      never produce a stray highlight.
 *   3. Every match in a text segment is wrapped in <mark class="pp-find-mark">;
 *      the occurrence the user is currently on additionally carries
 *      `pp-find-active` so it can render stronger than its siblings.
 *
 * Known, accepted limitation (documented for future readers): a match
 * that spans a tag boundary ("foo<b>bar" for query "foobar") and matches
 * that depend on HTML entities ("A & B" never matches "A &amp; B") are
 * not found — the same trade-off the browser's Ctrl+F makes against
 * fragment-level formatting, and vanishingly rare in legal document
 * bodies, which is what this viewer renders.
 */

/** Escape a user query for safe interpolation into a RegExp. */
export function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** One HTML token: either a tag (or comment) or a run of text. */
interface HtmlToken {
    isTag: boolean;
    value: string;
}

export function tokenizeHtml(html: string): HtmlToken[] {
    const tokens: HtmlToken[] = [];
    const pattern = /<[^>]+>|[^<]+/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
        tokens.push({ isTag: match[0].startsWith('<'), value: match[0] });
    }
    return tokens;
}

/**
 * Ranges of HTML entities inside a text segment. A query like "amp" must
 * never match INSIDE "&amp;" — wrapping the entity's interior would
 * corrupt the rendered text ("&<mark>amp</mark>;" renders as "&amp;;").
 */
const ENTITY_PATTERN = /&[a-zA-Z][a-zA-Z0-9]{0,30};|&#\d{1,6};|&#x[0-9a-fA-F]{1,6};/g;

function entityRanges(segment: string): Array<[number, number]> {
    const ranges: Array<[number, number]> = [];
    let match: RegExpExecArray | null;
    ENTITY_PATTERN.lastIndex = 0;
    while ((match = ENTITY_PATTERN.exec(segment)) !== null) {
        ranges.push([match.index, match.index + match[0].length]);
    }
    return ranges;
}

function withinEntities(index: number, length: number, ranges: Array<[number, number]>): boolean {
    return ranges.some(([start, end]) => index < end && index + length > start);
}

/** Count case-insensitive query occurrences inside the TEXT of an HTML string. */
export function countHtmlMatches(html: string, query: string): number {
    const needle = query.trim();
    if (!needle) return 0;
    const finder = new RegExp(escapeRegExp(needle), 'gi');
    let count = 0;
    for (const token of tokenizeHtml(html)) {
        if (token.isTag) continue;
        const entities = entityRanges(token.value);
        finder.lastIndex = 0;
        let found: RegExpExecArray | null;
        while ((found = finder.exec(token.value)) !== null) {
            if (found[0].length === 0) continue;
            if (!withinEntities(found.index, found[0].length, entities)) count += 1;
        }
    }
    return count;
}

/**
 * Wrap every query occurrence in the TEXT of an HTML string with a
 * <mark class="pp-find-mark"> element. When `activeLocalIndex` is a
 * number, the occurrence at that index (0-based, in reading order)
 * additionally carries class `pp-find-active`.
 *
 * Returns the rewritten HTML plus the number of matches on this page —
 * callers use the count to map global match indices to per-page indices.
 */
export function highlightHtmlMatches(
    html: string,
    query: string,
    activeLocalIndex: number | null,
): { html: string; count: number } {
    const needle = query.trim();
    if (!needle) return { html, count: 0 };

    const finder = new RegExp(escapeRegExp(needle), 'gi');
    let count = 0;
    const out: string[] = [];

    for (const token of tokenizeHtml(html)) {
        if (token.isTag) {
            out.push(token.value);
            continue;
        }
        const entities = entityRanges(token.value);
        let cursor = 0;
        finder.lastIndex = 0;
        let found: RegExpExecArray | null;
        while ((found = finder.exec(token.value)) !== null) {
            if (found[0].length === 0) {
                // Zero-length matches (impossible after trim, but guard the
                // loop anyway) must not advance the regex in place.
                finder.lastIndex += 1;
                continue;
            }
            if (withinEntities(found.index, found[0].length, entities)) continue;
            const isActive = activeLocalIndex !== null && count === activeLocalIndex;
            out.push(token.value.slice(cursor, found.index));
            out.push(
                `<mark class="pp-find-mark${isActive ? ' pp-find-active' : ''}">`
                    + `${escapeHtmlText(found[0])}</mark>`,
            );
            cursor = found.index + found[0].length;
            count += 1;
        }
        out.push(token.value.slice(cursor));
    }

    return { html: out.join(''), count };
}

/** Minimal HTML escaping so a matched string re-embedded in HTML stays literal. */
function escapeHtmlText(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
