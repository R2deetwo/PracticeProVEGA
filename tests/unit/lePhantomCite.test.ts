/**
 * lePhantomCite + verificationHarness — the 5-point hallucination taxonomy
 * and the sequential belief-state verification, pinned by golden vectors.
 *
 * Part of the ALOA LEGAL ENGINE test suite (Pillar 2). The honesty
 * contract is tested as hard as the failure modes: with no corpus the
 * result must be UNVERIFIABLE, never "verified", and never a hallucination
 * claim either.
 */
import { describe, it, expect } from 'vitest';
import {
    auditCitation,
    parseCaseNameFromCitation,
    parsePinciteFromCitation,
    CorpusRecord,
} from '../../src/legal/citations/lePhantomCite';
import {
    verifyCitation,
    InMemoryCorpus,
} from '../../src/legal/citations/verificationHarness';

const RECORD: CorpusRecord = {
    id: 'rec-1',
    citation: 'Okafor v. Eze (2024) 12 NWLR (Pt. 1934) 1',
    caseName: 'Okafor v. Eze',
    year: '2024',
    court: 'Supreme Court',
    reporter: { volume: 12, reporter: 'NWLR', part: '1934', page: 1 },
    pages: { '1': 'The Supreme Court held that a party must plead and prove fraud.', '15': 'Specific performance is discretionary and equitable in nature.' },
    text: 'The Supreme Court held that a party must plead and prove fraud. Specific performance is discretionary and equitable in nature.',
    holding: 'A claimant seeking specific performance must show readiness and willingness to perform the contract.',
};

describe('parseCaseNameFromCitation / parsePinciteFromCitation', () => {
    it('extracts the case name and the at-page', () => {
        expect(parseCaseNameFromCitation('Uba v. Eze (2024) 12 NWLR (Pt. 1934) 1 at 15')).toBe('Uba v. Eze');
        expect(parsePinciteFromCitation('Uba v. Eze (2024) 12 NWLR (Pt. 1934) 1 at 15')).toBe('15');
    });
});

describe('auditCitation — the 5-point taxonomy', () => {
    it('a fully-matching claim is VERIFIED', () => {
        const audit = auditCitation(
            {
                citation: 'Okafor v. Eze (2024) 12 NWLR (Pt. 1934) 1 at 15',
                caseName: 'Okafor v. Eze',
                pincite: '15',
                quote: 'Specific performance is discretionary and equitable in nature.',
                proposition: 'Specific performance is an equitable and discretionary remedy.',
            },
            RECORD,
            { backendAvailable: true },
        );
        expect(audit.status).toBe('VERIFIED');
        expect(audit.failureModes).toEqual([]);
        expect(audit.checks.every(c => c.passed === true)).toBe(true);
    });

    it('failure mode 2: CASE_NAME_MISMATCH — right reporter, wrong case', () => {
        const audit = auditCitation(
            {
                citation: 'Adeyemi v. Federal Republic of Nigeria (2024) 12 NWLR (Pt. 1934) 1',
                caseName: 'Adeyemi v. Federal Republic of Nigeria',
            },
            RECORD,
            { backendAvailable: true },
        );
        expect(audit.status).toBe('HALLUCINATED');
        expect(audit.failureModes).toContain('CASE_NAME_MISMATCH');
    });

    it('failure mode 3: INCORRECT_PINCITE — cited page before the case begins', () => {
        // The case starts at page 1 of the report; a star-paged page that
        // does not exist in the opinion is flagged.
        const audit = auditCitation(
            { citation: 'Okafor v. Eze (2024) 12 NWLR (Pt. 1934) 1 at 77', pincite: '77' },
            RECORD,
            { backendAvailable: true },
        );
        expect(audit.status).toBe('HALLUCINATED');
        expect(audit.failureModes).toContain('INCORRECT_PINCITE');
    });

    it('failure mode 4: VERBATIM_MISQUOTE — altered words inside quotes', () => {
        const audit = auditCitation(
            {
                citation: 'Okafor v. Eze (2024) 12 NWLR (Pt. 1934) 1 at 1',
                quote: 'Specific performance is mandatory and automatic in nature.',
            },
            RECORD,
            { backendAvailable: true },
        );
        expect(audit.status).toBe('HALLUCINATED');
        expect(audit.failureModes).toContain('VERBATIM_MISQUOTE');
    });

    it('failure mode 5: CONTENT_MISREPRESENTATION — holding does not support the proposition', () => {
        const audit = auditCitation(
            {
                citation: 'Okafor v. Eze (2024) 12 NWLR (Pt. 1934) 1',
                proposition: 'The court held that admiralty claims lie exclusively in the State High Court.',
            },
            RECORD,
            { backendAvailable: true },
        );
        expect(audit.status).toBe('HALLUCINATED');
        expect(audit.failureModes).toContain('CONTENT_MISREPRESENTATION');
    });

    it('weak (but not absent) holding alignment is NEEDS_REVIEW, never a false verdict', () => {
        // Overlap with the recorded holding is engineered to ~0.25 —
        // above the LOW threshold (0.15) but below HIGH (0.35): the
        // heuristic must defer to a human, not certify or condemn.
        const audit = auditCitation(
            {
                citation: 'Okafor v. Eze (2024) 12 NWLR (Pt. 1934) 1',
                proposition: 'A willing claimant who performs must still seek the court\'s discretion.',
            },
            RECORD,
            { backendAvailable: true },
        );
        expect(audit.status).toBe('NEEDS_REVIEW');
    });

    it('failure mode 1: NON_EXISTENT — an exhaustive corpus miss is HALLUCINATED', () => {
        const audit = auditCitation({ citation: 'Ghost v. Phantom (1999) 1 NWLR (Pt. 1) 1' }, null, {
            backendAvailable: true,
        });
        expect(audit.status).toBe('HALLUCINATED');
        expect(audit.failureModes).toContain('NON_EXISTENT');
        expect(audit.recommendation).toContain('OMIT');
    });
});

describe('auditCitation — the honesty contract (no corpus)', () => {
    it('no record and no backend → UNVERIFIABLE, never "verified"', () => {
        const audit = auditCitation({ citation: 'Okafor v. Eze (2024) 12 NWLR (Pt. 1934) 1' }, null);
        expect(audit.status).toBe('UNVERIFIABLE');
        expect(audit.recommendation.toLowerCase()).toContain('cannot be verified');
    });
});

describe('verifyCitation — sequential harness', () => {
    it('stage 1 hit: canonical lookup finds the record, full audit runs', async () => {
        const backend = new InMemoryCorpus([RECORD]);
        const belief = await verifyCitation(
            {
                citation: 'Okafor v. Eze (2024) 12 NWLR (Pt. 1934) 1 at 15',
                pincite: '15',
                quote: 'Specific performance is discretionary and equitable in nature.',
            },
            backend,
        );
        expect(belief.stages[0].stage).toBe('PRIMARY_CITATION_LOOKUP');
        expect(belief.stages[0].outcome).toBe('FOUND');
        expect(belief.status).toBe('VERIFIED');
        expect(belief.stages.some(s => s.stage === 'PINCITE_STAR_PAGINATION')).toBe(true);
        expect(belief.audit).toBeDefined();
    });

    it('stage 2 fallback: citation string missed, case name found', async () => {
        const backend = new InMemoryCorpus([RECORD]);
        const belief = await verifyCitation(
            { citation: 'Okafor & Anor v Eze & Ors (2024) LPELR-99999(SC)', caseName: 'Okafor v. Eze' },
            backend,
        );
        expect(belief.stages[0].outcome).toBe('NOT_FOUND');
        expect(belief.stages[1].stage).toBe('OPEN_CASE_SEARCH');
        expect(belief.stages[1].outcome).toBe('FOUND');
        expect(belief.status).not.toBe('HALLUCINATED'); // found via name — audit determines the rest
    });

    it('exhaustive miss through both routes → HALLUCINATED (non-existent)', async () => {
        const backend = new InMemoryCorpus([RECORD]);
        const belief = await verifyCitation(
            { citation: 'Ghost v. Phantom (1999) 1 NWLR (Pt. 1) 1', caseName: 'Ghost v. Phantom' },
            backend,
        );
        expect(belief.status).toBe('HALLUCINATED');
        expect(belief.stages.map(s => s.outcome)).toEqual(['NOT_FOUND', 'NOT_FOUND']);
    });

    it('NO backend (today\'s production reality) → UNVERIFIABLE with the standing disclosure', async () => {
        const belief = await verifyCitation({ citation: 'Okafor v. Eze (2024) 12 NWLR (Pt. 1934) 1' }, null);
        expect(belief.status).toBe('UNVERIFIABLE');
        expect(belief.stages[0].outcome).toBe('SKIPPED');
        expect(belief.recommendation).toContain('no law-report database is connected');
        expect(belief.recommendation).toContain('UNVERIFIED');
    });
});
