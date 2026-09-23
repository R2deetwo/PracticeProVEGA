/**
 * draftHtml — ONE shared post-processing pipeline for every AI draft,
 * wherever it is produced (DraftProEditor's in-editor stream, ALOA's
 * background packet drafting).
 *
 * ## Why this module exists (2026-09-24, user feedback round 3)
 *
 * The user reported persistent "weird gaps" in drafts — unprofessional
 * vertical spacing that made documents look badly formatted. Root cause:
 * the drafting models (despite prompt instructions) sometimes emit
 *   - empty paragraphs (`<p></p>`, `<p>&nbsp;</p>`, `<p><br></p>`) as spacing,
 *   - doubled `<br><br>` line breaks,
 *   - markdown bold (`**like this**`) and ```html fences.
 * The cleanup used to live as THREE copy-pasted inline regex chains inside
 * DraftProEditor (stream preview, final, abort-recovery) and a FOURTH in
 * the ALOA packet path — each slightly different, none stripping the
 * spacing garbage. This module is the single, tested, deterministic fix:
 * no AI draft reaches an editor without passing through `cleanDraftHtml` /
 * `finalizeDraftHtml`.
 */

/** Extracted from DraftProEditor's three inline copies + hardened. */
export function cleanDraftHtml(raw: string): string {
    if (!raw) return '';
    let html = raw
        // Code fences the models sometimes wrap output in (forbidden, but
        // "trust and verify" — stripping is free).
        .replace(/```html/gi, '')
        .replace(/```/g, '')
        // Literal "\n" escapes and stray CRs.
        .replace(/\\n/g, '\n')
        .replace(/\r/g, '')
        // Markdown bold → real <strong>.
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Doubled <br><br> is the model's "blank line" — convert to a real
    // paragraph break so the editor's paragraph spacing applies once
    // (instead of an empty gap line).
    html = html.replace(/<br\s*\/?>(\s*(?:<br\s*\/?>\s*)+)/gi, '</p><p>');

    // Empty paragraphs — THE "weird gaps". A paragraph that contains only
    // whitespace, &nbsp; entities and/or <br> tags carries no content and
    // only exists to fake spacing. Remove every one of them, wherever it
    // appears (start, middle, end).
    html = html.replace(
        /<p(\s[^>]*)?>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p>/gi,
        '',
    );

    // Whitespace-only runs BETWEEN block tags (line breaks the model puts
    // between paragraphs parse as text nodes and can render as stray gaps).
    // Only touches runs strictly between ">" and "<" — inline spaces inside
    // sentences ("Hello <strong>world</strong>") are untouched because the
    // character before the space is not ">".
    html = html.replace(/>\s{2,}</g, '><');

    // Empty anchors: a lone "</p><p>" pair produced by the <br><br> swap
    // above (when the break sat at a paragraph edge) leaves an empty
    // paragraph — strip again in a second pass.
    html = html.replace(
        /<p(\s[^>]*)?>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p>/gi,
        '',
    );

    return html.trim();
}

/**
 * Convert [BRACKETED PLACEHOLDERS] into legal-placeholder spans.
 * Mirrors DraftProEditor's final-pass conversion so background-drafted
 * packets get the same clickable, color-coded placeholders as in-editor
 * drafts. Category resolution happens in the editor on parse (the span
 * carries only data-label; data-category is a best-effort hint).
 */
export function placeholdersToSpans(html: string): string {
    if (!html) return '';
    return html.replace(/\[([^\]\n]{1,120})\]/g, (match, label: string) => {
        // Skip things that are clearly not placeholders:
        //  - citation markers like [1] / [12]
        if (/^\d+$/.test(label.trim())) return match;
        const cat = guessPlaceholderCategory(label);
        const safe = label
            .trim()
            .toUpperCase()
            .replace(/"/g, '&quot;')
            .slice(0, 120);
        return `<span data-type="legal-placeholder" data-label="${safe}" data-category="${cat}"></span>`;
    });
}

/**
 * Lightweight category guess that mirrors the editor extension's
 * `resolveCategory` logic without importing React/tiptap (this util is
 * also used from node-side unit tests). Keep the two in sync — the editor
 * re-resolves on parse anyway, so a mismatch is cosmetic only.
 */
export function guessPlaceholderCategory(label: string): string {
    const n = (label || '').trim().toUpperCase();
    // Court reference numbers ("SUIT NUMBER", "SUIT NO", "CASE NUMBER")
    // are COURT facts, not durations — checked before the quantity heuristic
    // so "NUMBER" alone doesn't misfile them.
    if (/^(SUIT|CASE|MATTER|CAUSE)\s*(NO|NUMBER)/.test(n)) return 'court';
    const isDuration =
        /\b(NUMBER|COUNT|QUANTITY|DURATION|PERIOD|TERM|LENGTH)\b/.test(n) ||
        /\b(DAYS|WEEKS|MONTHS|YEARS|HOURS|MINUTES)\b/.test(n);
    if (isDuration) return 'freetext';
    if (/(NAME|PARTY|COUNSEL|TENANT|LANDLORD|GUARANTOR|DEPONENT|JUDGE|WITNESS|CLAIMANT|DEFENDANT|APPLICANT|RESPONDENT|PETITIONER|TRUSTEE|BENEFICIARY|DIRECTOR|SHAREHOLDER|EXECUTOR|ADMINISTRATOR|GUARDIAN|ATTORNEY|SOLICITOR|BARRISTER|NOTARY|CLIENT)/.test(n)) return 'parties';
    if (/(DATE|DAY|MONTH|YEAR|TIME|DEADLINE|HEARING|EXPIR|COMMENCEMENT|TERMINATION|EFFECTIVE)/.test(n)) return 'dates';
    if (/(AMOUNT|FEE|CHARGE|RENT|DEPOSIT|PAYMENT|COST|PRICE|SUM|MONEY|NAIRA|DOLLAR|PENALTY|RATE|SALARY|WAGE|INCOME|REVENUE|TAX|VAT|DISCOUNT|BALANCE|TOTAL)/.test(n)) return 'financial';
    if (/(ADDRESS|LOCATION|STREET|AVENUE|ROAD|CITY|STATE|COUNTRY|LGA|PLOT|ZONE|DISTRICT|REGION|AREA)/.test(n)) return 'location';
    if (/(COURT|SUIT|CASE|MATTER|JURISDICTION|CAUSE|RELIEF|EXHIBIT|ORDER|RULE|GROUND|TRIBUNAL|CHAMBER|REGISTRY)/.test(n)) return 'court';
    if (/(FIRM|SOLICITOR|PRACTICE|CHAMBERS|OFFICE|REG|REGISTRATION)/.test(n)) return 'firm';
    return 'freetext';
}

/**
 * Full pipeline: cleanup + placeholder conversion. What every finalized
 * draft goes through before it is handed to an editor or persisted.
 */
export function finalizeDraftHtml(raw: string): string {
    return placeholdersToSpans(cleanDraftHtml(raw));
}

/**
 * Human-visible sanity check used by callers to decide whether a
 * "drafted" document actually has substance (not just whitespace/empty
 * tags). Guards the packet system against marking an empty generation
 * as "ready".
 */
export function draftHasSubstance(html: string): boolean {
    if (!html) return false;
    const text = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;|&#160;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    // At least 40 visible characters of content.
    return text.length >= 40;
}
