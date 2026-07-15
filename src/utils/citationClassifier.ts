/**
 * citationClassifier — classifies legal citations into a 6-class taxonomy
 * and applies per-class completeness rules.
 *
 * PROBLEM WITH PREVIOUS IMPLEMENTATION
 * ------------------------------------
 * The old `checkCitationCompleteness` in DraftProEditor.tsx only
 * distinguished "Statute" vs "Case Law" and applied Case Law completeness
 * rules (volume/reporter/court) to ALL citations, incorrectly flagging
 * valid statute citations like "Companies and Allied Matters Act (CAMA) 2020"
 * as incomplete because they lacked a reporter/volume.
 *
 * NEW TAXONOMY
 * ------------
 * Every citation is classified into one of these classes BEFORE any
 * completeness check runs. Each class has its own completeness rules:
 *
 * | Class | Trigger pattern | Completeness requires |
 * |---|---|---|
 * | Statute / Act / Regulation | Contains "Act", "Regulations", "Code", known abbreviations (CAMA, NDPA), or "Constitution" | Title + Year. Section number if a specific provision is referenced. NO reporter/volume/court required. |
 * | Case Law | Contains " v " or " v. " between two party-name-like tokens | Party names, Year, Volume/Reporter (e.g. NWLR, LPELR), Court identifier |
 * | Constitutional Provision | "Constitution" + section/article reference | Instrument name, Year, Section/Article number |
 * | Contract / Document Clause | Reference to an uploaded or referenced agreement, clause, or exhibit | Document identifier, clause/section number |
 * | Direct Quote / Statement | Quoted text attributed to a person, source, or document not otherwise classified above | Source identity, and page/paragraph/timestamp if available |
 * | Secondary Source | Textbook, journal article, commentary | Author, Title, Year, page if pinpointed |
 *
 * If a citation doesn't clearly match any row, classify as "Unclassified"
 * and flag it as "needs manual review" instead of applying Case Law rules.
 */

export type CitationClass =
    | 'statute'
    | 'case_law'
    | 'constitutional'
    | 'contract'
    | 'direct_quote'
    | 'secondary'
    | 'unclassified';

export interface CitationIssue {
    field: string;
    message: string;
}

export interface ClassificationResult {
    /** The classified citation class */
    citationClass: CitationClass;
    /** Human-readable class name for display */
    className: string;
    /** Whether the citation is complete per its class rules */
    isComplete: boolean;
    /** Whether the citation needs manual review (unclassified) */
    needsManualReview: boolean;
    /** List of missing fields (empty if complete) */
    issues: CitationIssue[];
    /** Extracted pinpoint reference (e.g., "Section 21") if found */
    pinpoint?: string;
    /** Whether the citation needs a pinpoint but doesn't have one */
    needsPinpoint?: boolean;
}

// ─── Known statute abbreviations ─────────────────────────────────────
const STATUTE_ABBREVIATIONS = [
    'CAMA', 'NDPA', 'CITA', 'PITA', 'VATA', 'CITA', 'FIRS',
    'ISA', 'CAMA 2020', 'CAMA 2004',
    'BOFIA', 'NDIC', 'AMCON',
    'EFCC', 'ICPC', 'NDLEA',
    'NCC', 'NOTAP',
    'Land Use Act', 'Recovery of Premises',
];

// ─── Class names for display ─────────────────────────────────────────
const CLASS_NAMES: Record<CitationClass, string> = {
    statute: 'Statute / Act',
    case_law: 'Case Law',
    constitutional: 'Constitutional Provision',
    contract: 'Contract / Document Clause',
    direct_quote: 'Direct Quote',
    secondary: 'Secondary Source',
    unclassified: 'Unclassified',
};

/**
 * Classify a citation into one of the 6 taxonomy classes.
 * Returns the class + display name.
 */
export function classifyCitation(text: string): CitationClass {
    const t = (text || '').trim();
    if (!t) return 'unclassified';
    const lower = t.toLowerCase();

    // ─── 1. Statute / Act / Regulation ───────────────────────────────
    // Trigger: contains "Act", "Regulations", "Code", known abbreviations
    if (/\bact\b/i.test(t) ||
        /\bregulations?\b/i.test(t) ||
        /\bcode\b/i.test(t) ||
        STATUTE_ABBREVIATIONS.some(abbr => t.toUpperCase().includes(abbr.toUpperCase()))) {
        return 'statute';
    }

    // ─── 2. Constitutional Provision ─────────────────────────────────
    // Trigger: "Constitution" + section/article reference
    if (/\bconstitution\b/i.test(t)) {
        return 'constitutional';
    }

    // ─── 3. Case Law ─────────────────────────────────────────────────
    // Trigger: contains " v " or " v. " between two party-name-like tokens
    // Match patterns like "Adeyemi v. State" or "ABC Ltd v XYZ Ltd"
    if (/\b[a-z][a-z\s.']+?\s+v\.?\s+[a-z]/i.test(t)) {
        return 'case_law';
    }

    // ─── 4. Contract / Document Clause ───────────────────────────────
    // Trigger: reference to agreement, clause, exhibit, schedule
    if (/\b(?:agreement|contract|clause|exhibit|schedule|annexure|appendix)\b/i.test(t) ||
        /\b(?:exhibit\s+[a-z]|\bclause\s+\d)/i.test(t)) {
        return 'contract';
    }

    // ─── 5. Direct Quote / Statement ─────────────────────────────────
    // Trigger: quoted text (in quotes) attributed to a person or source
    if (/["""].+?["""]\s*(?:—|--|-|\u2014)?\s*(?:said|stated|noted|per|per,)/i.test(t) ||
        /\b(?:per|according to|as stated by|said|noted)\b/i.test(t)) {
        return 'direct_quote';
    }

    // ─── 6. Secondary Source ─────────────────────────────────────────
    // Trigger: textbook, journal, article, commentary
    if (/\b(?:textbook|journal|article|commentary|treatise|monograph)\b/i.test(t) ||
        /\b(?:ed\.|eds\.|vol\.|pp\.)\b/i.test(t)) {
        return 'secondary';
    }

    // ─── 7. URL-only citation ────────────────────────────────────────
    if (/^https?:\/\//i.test(t)) {
        return 'unclassified';
    }

    return 'unclassified';
}

/**
 * Extract a pinpoint reference (section/clause/article) from a citation.
 * Returns the pinpoint string if found, undefined otherwise.
 *
 * Examples:
 *   "Section 21, CAMA 2020" → "Section 21"
 *   "s. 251(1)(a) of the 1999 Constitution" → "s. 251(1)(a)"
 *   "Article 32 of the African Charter" → "Article 32"
 *   "clause 7.2 of the Shareholders' Agreement" → "clause 7.2"
 */
export function extractPinpoint(text: string): string | undefined {
    const t = text || '';
    if (!t) return undefined;

    // Match common pinpoint patterns
    const patterns = [
        /(?:section|s\.|sec\.?)\s*(\d+[A-Za-z]?(?:\(\d+\))?(?:\([a-z]\))?)/i,
        /(?:article|art\.?)\s*(\d+[A-Za-z]?)/i,
        /(?:clause|cl\.?)\s*(\d+(?:\.\d+)*)/i,
        /(?:paragraph|para\.?|¶)\s*(\d+)/i,
        /(?:rule|r\.?)\s*(\d+)/i,
        /(?:regulation|reg\.?)\s*(\d+)/i,
        /(?:item|item)\s*(\d+)/i,
        /(?:page|p\.|pp\.?)\s*(\d+)/i,
    ];

    for (const pattern of patterns) {
        const match = t.match(pattern);
        if (match) {
            // Return the full match (including the label)
            return match[0].trim();
        }
    }

    return undefined;
}

/**
 * Check whether a citation references a specific provision (section/article/etc.)
 * without actually extracting it. Used to flag "needs pinpoint" when the
 * document text references a provision but the citation doesn't include the number.
 */
export function referencesProvision(text: string): boolean {
    const t = text || '';
    return /\b(?:section|article|clause|paragraph|rule|regulation)\b/i.test(t);
}

/**
 * Full classification + completeness check for a citation.
 * Applies per-class rules and returns issues, pinpoint, and flags.
 */
export function classifyAndCheckCitation(text: string): ClassificationResult {
    const t = (text || '').trim();
    if (!t) {
        return {
            citationClass: 'unclassified',
            className: 'Unclassified',
            isComplete: false,
            needsManualReview: true,
            issues: [{ field: 'empty', message: 'Citation text is empty.' }],
        };
    }

    const citationClass = classifyCitation(t);
    const className = CLASS_NAMES[citationClass];
    const pinpoint = extractPinpoint(t);
    const issues: CitationIssue[] = [];

    // ─── Per-class completeness rules ────────────────────────────────
    switch (citationClass) {
        case 'statute': {
            // Title + Year. Section if a specific provision is referenced.
            const hasYear = /\b(?:19|20)\d{2}\b/.test(t);
            if (!hasYear) {
                issues.push({ field: 'year', message: 'Statute citation lacks a year — include the year of enactment (e.g., "CAMA 2020").' });
            }
            // Check if the document text references a specific section
            // (heuristic: if "section" appears in the citation but no number)
            if (referencesProvision(t) && !pinpoint) {
                issues.push({ field: 'pinpoint', message: 'Citation references a section but no specific section number is given.' });
            }
            // NO reporter/volume/court required for statutes
            break;
        }

        case 'constitutional': {
            // Instrument name, Year, Section/Article number
            const hasYear = /\b(?:19|20)\d{2}\b/.test(t);
            if (!hasYear) {
                issues.push({ field: 'year', message: 'Constitutional citation lacks a year (e.g., "1999 Constitution").' });
            }
            if (!pinpoint) {
                issues.push({ field: 'pinpoint', message: 'Constitutional citation should specify the section or article number (e.g., "Section 251(1)(a)").' });
            }
            break;
        }

        case 'case_law': {
            // Party names, Year, Volume/Reporter, Court identifier
            const hasYear = /\b(?:19|20)\d{2}\b/.test(t);
            if (!hasYear) {
                issues.push({ field: 'year', message: 'Case citation lacks the year of decision.' });
            }
            const hasReporter = /\b(?:NWLR|SC|LR|All\s*ER|AC|QB|WLR|NMLR|QdLRN|JLRN|PLC|AELR|LPELR)\b/i.test(t);
            if (!hasReporter) {
                issues.push({ field: 'reporter', message: 'Case citation lacks a reporter (e.g., "NWLR", "LPELR", "SC").' });
            }
            const hasCourt = /\b(?:SC|CA|FHC|HC|NICN|SCN|CCA|SCA)\b|\b(?:Supreme Court|Court of Appeal|Federal High Court|High Court)\b/i.test(t);
            if (!hasCourt) {
                issues.push({ field: 'court', message: 'Case citation lacks the court identifier (e.g., "(SC)", "(CA)").' });
            }
            // Page number check (only if reporter exists)
            if (hasReporter && !/\)\s*\d{1,4}\b/.test(t) && !/LPELR[-\s]?\d{3,}/i.test(t)) {
                issues.push({ field: 'page', message: 'Case citation should include the starting page number.' });
            }
            break;
        }

        case 'contract': {
            // Document identifier, clause/section number
            if (!pinpoint) {
                issues.push({ field: 'pinpoint', message: 'Contract citation should specify the clause or section number.' });
            }
            break;
        }

        case 'direct_quote': {
            // Source identity, page/paragraph/timestamp if available
            if (!/\b(?:per|said|stated|noted|according to)\b/i.test(t)) {
                issues.push({ field: 'source', message: 'Direct quote should identify the source (speaker or document).' });
            }
            break;
        }

        case 'secondary': {
            // Author, Title, Year, page if pinpointed
            const hasYear = /\b(?:19|20)\d{2}\b/.test(t);
            if (!hasYear) {
                issues.push({ field: 'year', message: 'Secondary source citation lacks a year.' });
            }
            break;
        }

        case 'unclassified': {
            // Don't apply case law rules — flag for manual review
            return {
                citationClass,
                className,
                isComplete: false,
                needsManualReview: true,
                issues: [{ field: 'review', message: 'Citation type not recognized — needs manual review to verify completeness.' }],
                pinpoint,
            };
        }
    }

    return {
        citationClass,
        className,
        isComplete: issues.length === 0,
        needsManualReview: false,
        issues,
        pinpoint,
        needsPinpoint: referencesProvision(t) && !pinpoint,
    };
}
