/**
 * lePhantomCite — the 5-point citation-hallucination taxonomy audit.
 *
 * PART OF THE ALOA LEGAL ENGINE (Pillar 2 — anti-hallucination guardrails).
 *
 * The taxonomy (from the LePhantomCite benchmark, adapted to the Nigerian
 * citation ecosystem — NWLR, All FWLR, LPELR, SC/CA suit numbers):
 *
 *   1. NON_EXISTENT           — the citation string points to no real case.
 *   2. CASE_NAME_MISMATCH     — the volume/page exists, but belongs to a
 *                                completely different case.
 *   3. INCORRECT_PINCITE      — the proposition is in the case, but on a
 *                                different page than the "at" marker claims.
 *   4. VERBATIM_MISQUOTE      — a quoted passage has substituted/altered
 *                                words inside the quotation marks.
 *   5. CONTENT_MISREPRESENTATION — the case exists, but its ratio does not
 *                                support the asserted proposition.
 *
 * HONESTY CONTRACT (extends src/utils/citationVerification.ts): this audit
 * can only be as authoritative as the corpus record it is given. With NO
 * corpus, the honest result is UNVERIFIABLE — never "verified", and never
 * a hallucination claim either. A definitive HALLUCINATED verdict requires
 * a backend that was actually searched (backendAvailable). Content
 * misrepresentation is fundamentally semantic — the deterministic check
 * uses keyword overlap as a screening heuristic and returns INCONCLUSIVE
 * (null) below a safe threshold rather than pretending to certainty.
 */

export type HallucinationMode =
    | 'NON_EXISTENT'
    | 'CASE_NAME_MISMATCH'
    | 'INCORRECT_PINCITE'
    | 'VERBATIM_MISQUOTE'
    | 'CONTENT_MISREPRESENTATION';

export type CitationStatus = 'VERIFIED' | 'HALLUCINATED' | 'UNVERIFIABLE' | 'NEEDS_REVIEW';

/** A verified corpus record — what a licensed law-report backend returns. */
export interface CorpusRecord {
    id: string;
    /** Canonical citation string, e.g. "Uba v. Eze (2024) 12 NWLR (Pt. 1934) 1". */
    citation: string;
    caseName: string;
    year?: string;
    court?: string;
    reporter?: { volume: number; reporter: string; part?: string; page: number };
    /** Star pagination: printed page number -> text on that page. */
    pages?: Record<string, string>;
    /** Full opinion text (or the relevant extract), for verbatim checks. */
    text?: string;
    /** Summarised holding, for fidelity screening. */
    holding?: string;
}

/** What the assistant (or a lawyer) claims a citation says. */
export interface CitationClaim {
    citation: string;
    caseName?: string;
    /** The "at 461" pincite page being relied on. */
    pincite?: string;
    /** Exact text presented as a direct quotation. */
    quote?: string;
    /** The legal proposition the case is cited to support. */
    proposition?: string;
}

export interface CitationCheck {
    name: string;
    /** true = passed; false = definitive failure; null = inconclusive. */
    passed: boolean | null;
    /** Was this element actually claimed (so a null verdict means
     *  "claimed but uncheckable" rather than "not applicable")? */
    claimed?: boolean;
    detail: string;
}

export interface CitationAudit {
    citation: string;
    status: CitationStatus;
    failureModes: HallucinationMode[];
    checks: CitationCheck[];
    recommendation: string;
}

// ─── Normalisation helpers ───────────────────────────────────────────────────

const STOP_WORDS = new Set([
    'the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'v', 'v.',
    'vs', 'ltd', 'plc', 'limited', 'co', 'company', 'state', 'federal', 'republic',
    'is', 'are', 'was', 'were', 'be', 'been', 'that', 'which', 'this', 'it', 'as',
    'by', 'with', 'from', 'not', 'no', 'its', 'their', 'his', 'her',
]);

const contentWords = (s: string): string[] =>
    (s || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !STOP_WORDS.has(w));

/** Word-set overlap ratio vs the smaller set — 0..1. */
const overlapRatio = (a: string[], b: string[]): number => {
    if (a.length === 0 || b.length === 0) return 0;
    const setB = new Set(b);
    const intersection = new Set(a.filter(w => setB.has(w)));
    return intersection.size / Math.min(a.length, b.length);
};

const normalizeForQuote = (s: string): string =>
    (s || '')
        .toLowerCase()
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
        .replace(/[\u201C\u201D\u201E]/g, '"')
        .replace(/\u2013|\u2014/g, '-')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

/** Extract the case name from a citation string ("X v. Y (year) …"). */
export function parseCaseNameFromCitation(citation: string): string | null {
    const m = (citation || '').match(/^(.+?)\s+v\.?\s+(.+?)(?=\s*\((?:19|20)\d{2}|\s*\[|$)/i);
    if (!m) return null;
    const name = `${m[1]} v. ${m[2]}`.replace(/\s+/g, ' ').trim();
    return name.length >= 3 ? name : null;
}

/** Extract an "at N" pincite from a citation string (pages can be 1–5 digits). */
export function parsePinciteFromCitation(citation: string): string | null {
    const m = (citation || '').match(/\bat\s+(\d{1,5})\b/i);
    return m ? m[1] : null;
}

// ─── The audit ───────────────────────────────────────────────────────────────

/**
 * Audit a citation claim against a corpus record.
 *
 * - `record` present       → run all five deterministic checks.
 * - `record` null +
 *   backendAvailable       → NON_EXISTENT → HALLUCINATED.
 * - `record` null, no
 *   backend                → UNVERIFIABLE (the honest default today).
 */
export function auditCitation(
    claim: CitationClaim,
    record: CorpusRecord | null,
    opts: { backendAvailable?: boolean } = {},
): CitationAudit {
    const citation = claim.citation || '';

    if (!record) {
        if (opts.backendAvailable) {
            return {
                citation,
                status: 'HALLUCINATED',
                failureModes: ['NON_EXISTENT'],
                checks: [
                    {
                        name: 'corpus_lookup',
                        passed: false,
                        detail: 'The citation was not found in the searched corpus — it points to no known case.',
                    },
                ],
                recommendation:
                    'OMIT this citation from the document. It does not exist in the searched corpus. Offer the user a verified alternative if one is available.',
            };
        }
        return {
            citation,
            status: 'UNVERIFIABLE',
            failureModes: [],
            checks: [
                {
                    name: 'corpus_lookup',
                    passed: null,
                    detail:
                        'No law-report corpus is connected, so this citation cannot be verified. Per the app\'s standing disclosure, nothing may be treated as authority-verified.',
                },
            ],
            recommendation:
                'This citation CANNOT be verified in-app — no law-report database is connected. Present it to the user as UNVERIFIED and require manual confirmation against a law report (NWLR, All FWLR, LPELR or an approved equivalent) before it is filed or served.',
        };
    }

    const checks: CitationCheck[] = [];

    // ── Check 1: case name ────────────────────────────────────────────
    const claimedName = claim.caseName || parseCaseNameFromCitation(citation);
    if (!claimedName || !record.caseName) {
        checks.push({
            name: 'case_name_match',
            passed: null,
            claimed: Boolean(claimedName),
            detail: !claimedName
                ? 'No case name available to compare — not applicable.'
                : 'Claimed a case name, but the corpus record carries none — name fidelity inconclusive.',
        });
    } else {
        const ratio = overlapRatio(contentWords(claimedName), contentWords(record.caseName));
        const nameMatch = ratio >= 0.7;
        checks.push({
            name: 'case_name_match',
            passed: nameMatch,
            claimed: true,
            detail: nameMatch
                ? `Claimed name matches the corpus record ("${record.caseName}").`
                : `Claimed name "${claimedName}" does NOT match the corpus record ("${record.caseName}") — the citation may belong to a different case.`,
        });
    }

    // ── Check 2: pincite ──────────────────────────────────────────────
    const pincite = claim.pincite || parsePinciteFromCitation(citation);
    let pincitePassed: boolean | null = null;
    let pinciteDetail = 'No pincite page claimed — not applicable.';
    if (pincite && record.reporter) {
        const page = parseInt(pincite, 10);
        if (Number.isNaN(page)) {
            pincitePassed = null;
            pinciteDetail = `Pincite "${pincite}" is not a page number — inconclusive.`;
        } else if (page < record.reporter.page) {
            pincitePassed = false;
            pinciteDetail = `Pincite ${page} is BEFORE page ${record.reporter.page} where the case begins in ${record.reporter.volume} ${record.reporter.reporter} — the cited page cannot contain this case.`;
        } else if (record.pages) {
            const has = Object.prototype.hasOwnProperty.call(record.pages, String(page));
            pincitePassed = has;
            pinciteDetail = has
                ? `Star pagination confirms text at page ${page}.`
                : `Star pagination has no page ${page} in this opinion — the pincite is wrong.`;
        } else {
            pincitePassed = null;
            pinciteDetail = `Pincite ${page} is at or after the case's start page (${record.reporter.page}), but without star pagination the exact page cannot be confirmed.`;
        }
    } else if (pincite && !record.reporter) {
        pincitePassed = null;
        pinciteDetail = 'Corpus record has no reporter pagination — pincite inconclusive.';
    }
    checks.push({ name: 'pincite_match', passed: pincitePassed, claimed: Boolean(pincite), detail: pinciteDetail });

    // ── Check 3: verbatim quote ───────────────────────────────────────
    let quotePassed: boolean | null = null;
    let quoteDetail = 'No quotation claimed — not applicable.';
    if (claim.quote) {
        if (record.text) {
            const normQuote = normalizeForQuote(claim.quote);
            const normText = normalizeForQuote(record.text);
            quotePassed = normText.includes(normQuote);
            quoteDetail = quotePassed
                ? 'The quoted passage appears verbatim in the corpus opinion text.'
                : 'The quoted passage does NOT appear in the corpus opinion text — words may have been substituted or altered.';
        } else {
            quoteDetail = 'Corpus record has no opinion text — verbatim check inconclusive.';
        }
    }
    checks.push({ name: 'verbatim_quote_match', passed: quotePassed, claimed: Boolean(claim.quote), detail: quoteDetail });

    // ── Check 4: holding fidelity (screening heuristic) ───────────────
    let holdingPassed: boolean | null = null;
    let holdingDetail = 'No proposition claimed — not applicable.';
    if (claim.proposition) {
        if (record.holding) {
            const ratio = overlapRatio(contentWords(claim.proposition), contentWords(record.holding));
            if (ratio >= 0.35) {
                holdingPassed = true;
                holdingDetail = `Proposition aligns with the recorded holding (keyword overlap ${Math.round(ratio * 100)}%).`;
            } else if (ratio < 0.15) {
                holdingPassed = false;
                holdingDetail = `Proposition shows almost no overlap with the recorded holding (keyword overlap ${Math.round(ratio * 100)}%) — the case may not support the asserted proposition.`;
            } else {
                holdingPassed = null;
                holdingDetail = `Proposition only weakly aligns with the recorded holding (keyword overlap ${Math.round(ratio * 100)}%) — semantic review required; a heuristic cannot certify fidelity.`;
            }
        } else {
            holdingDetail = 'Corpus record has no summarised holding — fidelity inconclusive.';
        }
    }
    checks.push({ name: 'holding_fidelity', passed: holdingPassed, claimed: Boolean(claim.proposition), detail: holdingDetail });

    // ── Verdict ────────────────────────────────────────────────────────
    const failureModes: HallucinationMode[] = [];
    if (checks.find(c => c.name === 'case_name_match')?.passed === false) failureModes.push('CASE_NAME_MISMATCH');
    if (checks.find(c => c.name === 'pincite_match')?.passed === false) failureModes.push('INCORRECT_PINCITE');
    if (checks.find(c => c.name === 'verbatim_quote_match')?.passed === false) failureModes.push('VERBATIM_MISQUOTE');
    if (checks.find(c => c.name === 'holding_fidelity')?.passed === false) failureModes.push('CONTENT_MISREPRESENTATION');

    // A null verdict only taints the result when the element was CLAIMED
    // (claimed but uncheckable). An absent element — no quote, no
    // proposition, no pincite — is simply not applicable and must not
    // dilute a verdict into NEEDS_REVIEW.
    const inconclusive = checks.some(c => c.passed === null && c.claimed && c.name !== 'corpus_lookup');

    let status: CitationStatus;
    let recommendation: string;
    if (failureModes.length > 0) {
        status = 'HALLUCINATED';
        recommendation =
            'OMIT or CORRECT this citation before the document is finalised: ' +
            failureModes.join(', ') +
            '. Never render a hallucinated citation into a filed process.';
    } else if (inconclusive) {
        status = 'NEEDS_REVIEW';
        recommendation =
            'The citation matches the corpus record on every check the engine could complete, but at least one check was inconclusive — a lawyer must confirm before filing.';
    } else {
        status = 'VERIFIED';
        recommendation =
            'All deterministic checks passed against the corpus record (this verifies name, pagination, quotation and holding-alignment — it is not a substitute for professional confirmation of continuing authority).';
    }

    return { citation, status, failureModes, checks, recommendation };
}
