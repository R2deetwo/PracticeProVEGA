/**
 * citationParser — extracts citations from AI responses and populates a
 * CitationRegistry.
 *
 * HOW IT WORKS
 * ------------
 * When ALOA responds in research mode, the AI is instructed to:
 *   1. Use inline [1], [2], [3] markers for citations
 *   2. End the response with a "## Sources" block listing each source
 *
 * This parser:
 *   - Finds the ## Sources block (or "Sources:" section)
 *   - Parses each source line into structured citation data
 *   - Adds them to the CitationRegistry (with dedup)
 *   - Returns the display text (with the Sources block stripped)
 *     and the populated registry
 *
 * SOURCE LINE FORMAT
 * ------------------
 * The AI is instructed to emit sources in this format:
 *   [1] | type | citation text | url | jurisdiction
 *
 * Where type is one of: case, statute, regulation, journal, book, web, other
 *
 * If the AI doesn't use the structured format, we fall back to parsing
 * plain "[1] text" lines.
 */

import { CitationRegistry, Citation, CitationType, detectCitationType } from './citationRegistry';

export interface ParsedCitations {
    /** The display text with the Sources block stripped out */
    displayText: string;
    /** All citations found, in order */
    citations: Citation[];
    /** Whether any structured sources were found */
    hasSources: boolean;
}

/**
 * Parse an AI response for citations.
 * Extracts the ## Sources block and populates the registry.
 *
 * @param text The full AI response text
 * @param registry The CitationRegistry to populate (mutated)
 * @returns The display text (Sources block stripped) + citations array
 */
export function parseAIResponseForCitations(
    text: string,
    registry: CitationRegistry
): ParsedCitations {
    if (!text) return { displayText: '', citations: [], hasSources: false };

    // ─── Find the Sources block ───
    // Match either "## Sources", "Sources:", or "### Sources"
    const sourcesBlockRegex = /(?:^|\n)(#{1,3}\s*)?Sources\s*:?\s*\n/i;
    const match = text.match(sourcesBlockRegex);

    if (!match || match.index === undefined) {
        // No Sources block — just return the text as-is
        return {
            displayText: text,
            citations: registry.getAll(),
            hasSources: false,
        };
    }

    const sourcesStart = match.index + match[0].length;
    const bodyText = text.substring(0, match.index).trim();
    const sourcesText = text.substring(sourcesStart).trim();

    // ─── Parse source lines ───
    const lines = sourcesText.split('\n');
    const numberToId = new Map<number, string>();

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Stop if we hit a non-source line (e.g., a new heading)
        if (/^#{1,3}\s/.test(trimmed) && !/^#{1,3}\s*Sources/i.test(trimmed)) {
            break;
        }

        // Try structured format first: [1] | type | text | url | jurisdiction
        const structured = trimmed.match(/^\[(\d+)\]\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*(?:\|\s*([^|]*))?\s*(?:\|\s*([^|]*))?\s*$/i);
        if (structured) {
            const num = parseInt(structured[1]);
            const type = (structured[2].trim().toLowerCase() as CitationType);
            const citeText = structured[3].trim();
            const url = structured[4]?.trim() || undefined;
            const jurisdiction = structured[5]?.trim() || undefined;

            const citation = registry.add({
                type: isValidCitationType(type) ? type : detectCitationType(citeText),
                text: citeText,
                rawText: citeText,
                url: url && url !== '' ? url : undefined,
                jurisdiction: jurisdiction && jurisdiction !== '' ? jurisdiction : undefined,
            });
            numberToId.set(num, citation.id);
            continue;
        }

        // Fallback: plain [1] text format
        const plain = trimmed.match(/^\[(\d+)\]\s*(.+)$/);
        if (plain) {
            const num = parseInt(plain[1]);
            const citeText = plain[2].trim();

            const citation = registry.add({
                type: detectCitationType(citeText),
                text: citeText,
                rawText: citeText,
            });
            numberToId.set(num, citation.id);
            continue;
        }

        // Try numbered list format: "1. text" or "1) text"
        const numbered = trimmed.match(/^(\d+)[.)]\s*(.+)$/);
        if (numbered) {
            const num = parseInt(numbered[1]);
            const citeText = numbered[2].trim();

            const citation = registry.add({
                type: detectCitationType(citeText),
                text: citeText,
                rawText: citeText,
            });
            numberToId.set(num, citation.id);
            continue;
        }
    }

    return {
        displayText: bodyText,
        citations: registry.getAll(),
        hasSources: registry.getAll().length > 0,
    };
}

function isValidCitationType(type: string): boolean {
    return ['case', 'statute', 'regulation', 'journal', 'book', 'web', 'other'].includes(type);
}

/**
 * Convert [n] markers in text to HTML citation chips.
 * Used when rendering AI responses in the chat.
 *
 * Example: "See Smith v. Jones [1] for the holding" →
 *   "See Smith v. Jones <sup class="citation-chip" data-cite-num="1">[1]</sup> for the holding"
 */
export function renderCitationChips(text: string, registry: CitationRegistry): string {
    if (!text || registry.getAll().length === 0) return text;

    // Replace [n] with clickable citation chips
    return text.replace(/\[(\d+)\]/g, (match, numStr) => {
        const num = parseInt(numStr);
        const citation = registry.getByNumber(num);
        if (!citation) return match; // No matching citation — leave as-is

        const tooltip = citation.text.replace(/"/g, '&quot;');
        const url = citation.url ? ` data-url="${citation.url}"` : '';
        return `<sup class="citation-chip" data-cite-num="${num}" data-cite-id="${citation.id}" title="${tooltip}"${url} style="cursor:pointer;color:#16a34a;font-weight:bold;">[${num}]</sup>`;
    });
}

/**
 * Build the system prompt instruction for the AI to produce citations.
 * Appended to the research-mode system prompt.
 */
export function getCitationInstructions(): string {
    return `

## CITATION PROTOCOL (RESEARCH MODE)
When making legal assertions, you MUST cite relevant authorities using inline markers.

FORMAT:
1. Use [1], [2], [3] etc. as inline citation markers in the body text
2. At the END of your response, include a "## Sources" block listing each source

SOURCE LINE FORMAT (use the pipe-separated structure):
[1] | type | citation text | url | jurisdiction

Where:
- type is one of: case, statute, regulation, journal, book, web, other
- citation text is the full citation (e.g., "Adekunle v. State (1989) 5 NWLR (Pt. 123) 456")
- url is the source URL (if available, otherwise leave empty)
- jurisdiction is the country/region (e.g., "Nigeria", "UK", "US")

EXAMPLE:
In the landmark case of Adekunle v. State [1], the Supreme Court held that...
Section 36 of the Constitution [2] guarantees the right to fair hearing...

## Sources
[1] | case | Adekunle v. State (1989) 5 NWLR (Pt. 123) 456 | | Nigeria
[2] | statute | Constitution of the Federal Republic of Nigeria 1999 (as amended), s. 36 | | Nigeria

IMPORTANT:
- Only cite REAL cases and statutes that you are confident exist
- If you are unsure of a citation, do NOT include it — uncited assertions are better than false citations
- When calling start_drafting, pass the citations array so they appear in the draft
`;
}
