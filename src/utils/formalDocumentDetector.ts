/**
 * formalDocumentDetector — detects whether an ALOA response contains a
 * formal document or letter that should be offered to DraftPro.
 *
 * The user wants a "Draft in DraftPro" button to appear on ALOA messages
 * that contain formal documents like:
 *   - Letters (demand letter, legal notice, cover letter)
 *   - Agreements (tenancy, employment, service)
 *   - Affidavits, motions, pleadings
 *   - Memos, briefs
 *   - Any structured legal document with headings, sections, formal language
 *
 * The button should NOT appear on:
 *   - Casual conversational responses
 *   - Short answers to questions
 *   - Status updates ("I've opened the form for you")
 *   - Lists of options or recommendations
 */

/**
 * Check if a message looks like a formal document that should be sent to DraftPro.
 *
 * Heuristics:
 * 1. Length — formal documents are usually 300+ characters
 * 2. Document-type keywords — "DEED OF", "LETTER OF", "AGREEMENT", "AFFIDAVIT", etc.
 * 3. Formal structure markers — headings (##, ###), "WHEREAS", "NOW THEREFORE",
 *    "IN WITNESS WHEREOF", numbered clauses, signature blocks
 * 4. Legal formatting — court captions, "DATED this", "SIGNED by"
 */
export function isFormalDocument(content: string): boolean {
    if (!content || content.trim().length < 200) return false;

    const text = content;
    const upper = text.toUpperCase();

    // ─── Strong signals (any one is sufficient) ───
    // These are document titles or formal openings that almost always
    // indicate a formal document.
    const strongSignals = [
        /\bDEED OF\b/i,
        /\bLETTER OF\b/i,
        /\bLEGAL NOTICE\b/i,
        /\bDEMAND LETTER\b/i,
        /\bNOTICE TO\b/i,
        /\bMEMORANDUM OF\b/i,
        /\bARTICLES OF\b/i,
        /\bAGREEMENT\b/i,
        /\bAFFIDAVIT\b/i,
        /\bSTATUTORY DECLARATION\b/i,
        /\bPOWER OF ATTORNEY\b/i,
        /\bTENANCY AGREEMENT\b/i,
        /\bEMPLOYMENT CONTRACT\b/i,
        /\bSERVICE AGREEMENT\b/i,
        /\bLEASE AGREEMENT\b/i,
        /\bSALE AND PURCHASE\b/i,
        /\bMOTION TO\b/i,
        /\bORIGINATING SUMMONS\b/i,
        /\bWRIT OF\b/i,
        /\bSTATEMENT OF\b/i,
        /\bPETITION FOR\b/i,
        /\bIN THE HIGH COURT\b/i,
        /\bIN THE MAGISTRATE\b/i,
        /\bIN THE FEDERAL HIGH COURT\b/i,
        /\bWHEREAS\b/i,
        /\bNOW THEREFORE\b/i,
        /\bIN WITNESS WHEREOF\b/i,
        /\bSIGNED BY\b/i,
        /\bDATED this\b/i,
        /\bSIGNED AND DELIVERED\b/i,
    ];

    if (strongSignals.some(re => re.test(text))) return true;

    // ─── Structural signals (need multiple to qualify) ───
    // These suggest a document but aren't conclusive on their own.
    let structuralScore = 0;

    // Has multiple headings (## or ###)
    const headingMatches = text.match(/^#{2,3}\s/gm);
    if (headingMatches && headingMatches.length >= 2) structuralScore += 2;

    // Has numbered clauses (1., 2., 3. at start of lines)
    const numberedClauses = text.match(/^\d+\.\s/gm);
    if (numberedClauses && numberedClauses.length >= 3) structuralScore += 2;

    // Has a signature block
    if (/_________________|Signature|Signed by/i.test(text)) structuralScore += 1;

    // Has formal date formatting
    if (/\bDATED\b.*\bday of\b/i.test(text)) structuralScore += 1;

    // Has "Dear" salutation (letter format)
    if (/\bDear\s+(Sir|Madam|Mr\.|Mrs\.|Ms\.|Dr\.)/i.test(text)) structuralScore += 1;

    // Has "Yours faithfully/sincerely" closing (letter format)
    if (/\bYours (faithfully|sincerely)\b/i.test(text)) structuralScore += 1;

    // Has placeholders like [NAME], [DATE], [AMOUNT]
    if (/\[[A-Z_ ]{3,}\]/.test(text)) structuralScore += 1;

    // Long enough to be a document (500+ chars)
    if (text.length > 500) structuralScore += 1;

    return structuralScore >= 3;
}

/**
 * Extract a suitable title for the document from its content.
 * Looks for the first heading, "RE:" line, or document-type keyword.
 */
export function extractDocumentTitle(content: string): string {
    if (!content) return 'Untitled Draft';

    // Try to find a heading (## or ###)
    const headingMatch = content.match(/^#{1,3}\s+(.+)$/m);
    if (headingMatch && headingMatch[1]) {
        return headingMatch[1].trim().substring(0, 80);
    }

    // Try to find "RE:" line
    const reMatch = content.match(/\bRE:\s*(.+)$/im);
    if (reMatch && reMatch[1]) {
        return `Re: ${reMatch[1].trim().substring(0, 70)}`;
    }

    // Try to find a document-type keyword at the start
    const firstLine = content.split('\n').find(l => l.trim().length > 0) || '';
    const docTypeMatch = firstLine.match(/^(DEED OF|LETTER OF|LEGAL NOTICE|DEMAND LETTER|NOTICE TO|MEMORANDUM OF|AGREEMENT|AFFIDAVIT|TENANCY|EMPLOYMENT|LEASE|POWER OF ATTORNEY)\b/i);
    if (docTypeMatch) {
        return firstLine.trim().substring(0, 80);
    }

    // Fallback: first 50 chars of the content
    return content.trim().substring(0, 50).replace(/\n/g, ' ') + '...';
}

/**
 * Convert ALOA markdown content to clean HTML for DraftPro.
 * Reuses the parseAloaMarkdown logic but ensures the output is
 * suitable for the TipTap editor.
 */
export function aloaContentToDraftHtml(content: string): string {
    // The content from ALOA is already markdown-ish. We convert it to
    // basic HTML that TipTap can parse.
    let html = content;

    // Convert markdown headings to HTML
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Convert bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Convert line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br />');

    // Wrap in paragraphs
    html = `<p>${html}</p>`;

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
}
