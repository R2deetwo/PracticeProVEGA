/**
 * verificationHarness — sequential (BOED-style) citation verification.
 *
 * PART OF THE ALOA LEGAL ENGINE (Pillar 2 — anti-hallucination guardrails).
 *
 * Verification runs as a SEQUENCE of evidence-gathering stages, each
 * updating a structured belief-state payload — never a single lookup:
 *
 *   1. PRIMARY_CITATION_LOOKUP — query the canonical citation string
 *      (volume, reporter, page) against the corpus.
 *   2. OPEN_CASE_SEARCH        — if the reporter lookup fails, search by
 *      case name / docket before concluding anything.
 *   3. FETCH_FULL_OPINION      — pull the complete judgment text so
 *      verbatim and star-pagination checks can run.
 *   4. PINCITE_STAR_PAGINATION — run the full LePhantomCite audit with the
 *      fetched record.
 *
 * WHY A BACKEND SEAM: PracticePro has NO licensed law-report corpus today,
 * and the app's standing rule (src/utils/citationVerification.ts) is that
 * nothing may be presented as authority-verified until one is connected.
 * This harness is the machinery that will set authority_verified the day a
 * real corpus (LawPavilion, NWLR, LPELR or an approved equivalent) is
 * wired in — until then, with no backend, the honest result is
 * UNVERIFIABLE and the recommendation tells the lawyer exactly that.
 */

import {
    auditCitation,
    CitationAudit,
    CitationClaim,
    CorpusRecord,
} from './lePhantomCite';

/** The pluggable corpus backend — implement against a licensed provider. */
export interface CorpusBackend {
    /** Canonical citation-string lookup (volume/reporter/page, LPELR id…). */
    lookupByCitation(citation: string): Promise<CorpusRecord | null>;
    /** Case-name / docket search used before declaring non-existence. */
    searchByName(caseName: string): Promise<CorpusRecord | null>;
    /** Fetch the full opinion (text, star pages, holding) for a record. */
    fetchOpinion(recordId: string): Promise<CorpusRecord | null>;
}

export type BeliefStatus =
    | 'PENDING'
    | 'VERIFIED'
    | 'HALLUCINATED'
    | 'UNVERIFIABLE'
    | 'NEEDS_REVIEW';

export interface StageLog {
    stage:
        | 'PRIMARY_CITATION_LOOKUP'
        | 'OPEN_CASE_SEARCH'
        | 'FETCH_FULL_OPINION'
        | 'PINCITE_STAR_PAGINATION';
    outcome: 'FOUND' | 'NOT_FOUND' | 'SKIPPED' | 'DONE';
    detail: string;
}

/** The structured belief-state payload carried across iterations. */
export interface BeliefState {
    citation: string;
    status: BeliefStatus;
    caseNameMatch: boolean | null;
    pinciteMatch: boolean | null;
    quoteVerbatimMatch: boolean | null;
    holdingFidelity: 'HIGH' | 'PARTIAL' | 'LOW' | 'UNKNOWN';
    iterations: number;
    stages: StageLog[];
    recommendation: string;
    /** The full LePhantomCite audit, once stage 4 runs. */
    audit?: CitationAudit;
}

// ─── In-memory backend (tests, demos, and future seeding) ───────────────────

/**
 * A minimal CorpusBackend over a fixed record set. lookupByCitation does
 * normalised exact matching; searchByName does word-overlap matching;
 * fetchOpinion returns the full record (in a real backend this is where
 * the opinion text arrives).
 */
export class InMemoryCorpus implements CorpusBackend {
    private records: CorpusRecord[];

    constructor(records: CorpusRecord[]) {
        this.records = records;
    }

    private normalize = (s: string): string => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

    /** Strip a trailing "at N" pincite and terminal punctuation, so
     *  "… (Pt. 1934) 1 at 15" still matches the canonical citation
     *  "… (Pt. 1934) 1". */
    private canonicalKey = (s: string): string =>
        this.normalize(s)
            .replace(/\s+at\s+\d{1,5}\s*$/i, '')
            .replace(/\s*[.,;]\s*$/, '');

    async lookupByCitation(citation: string): Promise<CorpusRecord | null> {
        const target = this.canonicalKey(citation);
        return (
            this.records.find(r => this.canonicalKey(r.citation) === target) ||
            this.records.find(r => this.normalize(r.citation) === this.normalize(citation)) ||
            null
        );
    }

    async searchByName(caseName: string): Promise<CorpusRecord | null> {
        if (!caseName) return null;
        const target = new Set(
            caseName
                .toLowerCase()
                .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                .split(/\s+/)
                .filter(w => w.length > 1),
        );
        if (target.size === 0) return null;
        let best: { record: CorpusRecord; score: number } | null = null;
        for (const r of this.records) {
            const words = new Set(
                r.caseName
                    .toLowerCase()
                    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                    .split(/\s+/)
                    .filter(w => w.length > 1),
            );
            let hits = 0;
            for (const w of target) if (words.has(w)) hits++;
            const score = hits / target.size;
            if (score >= 0.6 && (!best || score > best.score)) best = { record: r, score };
        }
        return best ? best.record : null;
    }

    async fetchOpinion(recordId: string): Promise<CorpusRecord | null> {
        return this.records.find(r => r.id === recordId) || null;
    }
}

// ─── The harness ─────────────────────────────────────────────────────────────

const fidelityFromAudit = (audit: CitationAudit): 'HIGH' | 'PARTIAL' | 'LOW' | 'UNKNOWN' => {
    const holding = audit.checks.find(c => c.name === 'holding_fidelity');
    if (!holding || holding.passed === null) return holding && holding.passed === false ? 'LOW' : 'UNKNOWN';
    return holding.passed ? 'HIGH' : 'PARTIAL';
};

/**
 * Sequentially verify a citation claim. With no backend the result is
 * UNVERIFIABLE — the honest answer — and the recommendation carries the
 * standing disclosure so no surface can imply authority verification.
 */
export async function verifyCitation(
    claim: CitationClaim,
    backend?: CorpusBackend | null,
): Promise<BeliefState> {
    const stages: StageLog[] = [];
    const citation = claim.citation || '';
    let record: CorpusRecord | null = null;

    // No backend connected — the current production reality.
    if (!backend) {
        return {
            citation,
            status: 'UNVERIFIABLE',
            caseNameMatch: null,
            pinciteMatch: null,
            quoteVerbatimMatch: null,
            holdingFidelity: 'UNKNOWN',
            iterations: 0,
            stages: [
                {
                    stage: 'PRIMARY_CITATION_LOOKUP',
                    outcome: 'SKIPPED',
                    detail:
                        'No law-report corpus is connected (see the app\'s standing law-reports disclosure). No stage can honestly run.',
                },
            ],
            recommendation:
                'This citation CANNOT be verified in-app — no law-report database is connected. Present it to the user as UNVERIFIED and require manual confirmation against a law report (NWLR, All FWLR, LPELR or an approved equivalent) before it is filed or served.',
        };
    }

    // ── Stage 1: PRIMARY_CITATION_LOOKUP ──────────────────────────────
    record = await backend.lookupByCitation(citation);
    stages.push(
        record
            ? { stage: 'PRIMARY_CITATION_LOOKUP', outcome: 'FOUND', detail: `Canonical citation matched: ${record.citation}` }
            : { stage: 'PRIMARY_CITATION_LOOKUP', outcome: 'NOT_FOUND', detail: 'No exact citation-string match.' },
    );

    // ── Stage 2: OPEN_CASE_SEARCH (before declaring non-existence) ────
    if (!record) {
        const name =
            claim.caseName ||
            (await import('./lePhantomCite')).parseCaseNameFromCitation(citation) ||
            '';
        if (name) {
            record = await backend.searchByName(name);
            stages.push(
                record
                    ? { stage: 'OPEN_CASE_SEARCH', outcome: 'FOUND', detail: `Case located by name ("${name}") — reporter string differs from the canonical form.` }
                    : { stage: 'OPEN_CASE_SEARCH', outcome: 'NOT_FOUND', detail: `No case named "${name}" in the corpus either.` },
            );
        } else {
            stages.push({
                stage: 'OPEN_CASE_SEARCH',
                outcome: 'SKIPPED',
                detail: 'No case name to search on.',
            });
        }
    }

    // Nothing found through either route — the citation is non-existent.
    if (!record) {
        return {
            citation,
            status: 'HALLUCINATED',
            caseNameMatch: false,
            pinciteMatch: null,
            quoteVerbatimMatch: null,
            holdingFidelity: 'UNKNOWN',
            iterations: stages.length,
            stages,
            recommendation:
                'The citation was not found by canonical string OR by case name after an exhaustive sequential search — treat it as NON-EXISTENT (hallucinated). Omit it from the document.',
        };
    }

    // ── Stage 3: FETCH_FULL_OPINION ───────────────────────────────────
    const needsOpinion = !record.text || !record.holding || !record.pages;
    if (needsOpinion) {
        const full = await backend.fetchOpinion(record.id);
        stages.push(
            full
                ? { stage: 'FETCH_FULL_OPINION', outcome: 'FOUND', detail: 'Full opinion retrieved — verbatim and star-pagination checks can run.' }
                : { stage: 'FETCH_FULL_OPINION', outcome: 'NOT_FOUND', detail: 'Opinion text unavailable — verbatim/pagination checks will be inconclusive.' },
        );
        if (full) record = full;
    } else {
        stages.push({
            stage: 'FETCH_FULL_OPINION',
            outcome: 'SKIPPED',
            detail: 'Record already carries the full opinion.',
        });
    }

    // ── Stage 4: PINCITE_STAR_PAGINATION (the full audit) ─────────────
    const audit = auditCitation(claim, record, { backendAvailable: true });
    stages.push({
        stage: 'PINCITE_STAR_PAGINATION',
        outcome: 'DONE',
        detail: `LePhantomCite audit: ${audit.status}${audit.failureModes.length ? ` (${audit.failureModes.join(', ')})` : ''}.`,
    });

    return {
        citation,
        status: audit.status,
        caseNameMatch: audit.checks.find(c => c.name === 'case_name_match')?.passed ?? null,
        pinciteMatch: audit.checks.find(c => c.name === 'pincite_match')?.passed ?? null,
        quoteVerbatimMatch: audit.checks.find(c => c.name === 'verbatim_quote_match')?.passed ?? null,
        holdingFidelity: fidelityFromAudit(audit),
        iterations: stages.length,
        stages,
        recommendation: audit.recommendation,
        audit,
    };
}
