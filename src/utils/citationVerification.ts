/**
 * citationVerification — the four honest levels of "checking" a citation can
 * have in PracticePro, and the copy that labels them.
 *
 * V5 (LEGAL AI RELIABILITY): every prior surface conflated these levels —
 * "verified sources" meant "sources the model itself listed", the
 * confidence chip said "High" off a text heuristic, and nothing anywhere
 * was checked against an external legal authority. This module makes the
 * distinction explicit and gives every surface ONE vocabulary:
 *
 *   1. SYNTACTIC VALIDITY — does the citation look like a well-formed
 *      statute/case citation? (citationClassifier — regex only)
 *   2. INTERNAL CONSISTENCY — is the draft's citation consistent with the
 *      researched source set? (reviewDraft cross-check)
 *   3. SOURCE MATCHING — does the [n] marker resolve to a source entry the
 *      model listed? (aiTrust.assessConfidence coverage)
 *   4. AUTHORITY VERIFICATION — was it checked against a licensed,
 *      maintained legal corpus (LawPavilion, NWLR, LPELR or approved
 *      equivalent)? This NEVER happens today, and must never be implied.
 */
export type CitationVerificationLevel =
    | 'authority_verified'
    | 'source_matched'
    | 'syntactic_only';

export const VERIFICATION_LABELS: Record<CitationVerificationLevel, string> = {
    authority_verified:
        'Independently verified against a maintained legal corpus — this level does not exist in PracticePro today and must never be claimed.',
    source_matched:
        'Matches a source the AI itself listed — not independently verified against any external authority.',
    syntactic_only:
        'Format check only — the citation looks well-formed; no source was matched and no external authority was consulted.',
};

/**
 * The honest level for a citation, given what is actually known.
 * `authorityVerified` must only be passed by a caller that REALLY performed
 * an authority check — no such caller exists today (see
 * LAW_REPORTS_DISCLOSURE); the parameter is here so the day a licensed
 * corpus is connected, the wiring has somewhere to go.
 */
export function citationVerificationLevel(input: {
    sourceMatched: boolean;
    authorityVerified?: boolean;
}): CitationVerificationLevel {
    if (input.authorityVerified) return 'authority_verified';
    if (input.sourceMatched) return 'source_matched';
    return 'syntactic_only';
}

/** One-line basis statement for tooltips and cards. */
export function verificationBasisLine(level: CitationVerificationLevel): string {
    switch (level) {
        case 'authority_verified':
            return 'Externally verified (authority check performed).';
        case 'source_matched':
            return 'Basis: matches an AI-listed source — no external authority verification has occurred.';
        case 'syntactic_only':
            return 'Basis: format check only — no source matched, no external authority consulted.';
    }
}

/**
 * The standing disclosure for the missing external dependency. Until a
 * licensed, maintained Nigerian legal corpus (LawPavilion, NWLR, LPELR or
 * an approved equivalent) is connected, NOTHING in the app may claim real
 * authority verification. Every law-report surface renders this.
 */
export const LAW_REPORTS_DISCLOSURE =
    'No law-report database is connected. PracticePro has no access to Nigerian law reports (NWLR, SCNLR, LawPavilion, LPELR or an approved equivalent), so no citation in this app is verified against a legal authority. Case-law search will be enabled when a licensed, maintained corpus is connected.';
