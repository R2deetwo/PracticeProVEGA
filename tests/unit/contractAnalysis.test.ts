/**
 * contractAnalysis tests — pin the DraftPro MODULE 1 engine (R48).
 *
 * The engine is pure and deterministic; these tests pin the behaviors the
 * workspace relies on: clause splitting, doc-type detection, defined-terms
 * hygiene, missing-clause checklists (with the Nigerian-law standard
 * drafts), risk scoring with redlines, and the overall-risk rollup.
 */
import { describe, it, expect } from 'vitest';
import {
    analyzeContract,
    detectDocType,
    extractDefinedTerms,
    findUndefinedUses,
    checkMissingClauses,
    splitClauses,
} from '../../src/utils/contractAnalysis';

const SHAREHOLDERS_TEXT = `
SHAREHOLDERS' AGREEMENT

Adelayo Ventures Limited (the "Company") and the subscribers set out in Schedule 1.

RECITALS

This Agreement is made prior to the incorporation of the Company.

1. The Business. The Company shall carry on the business of logistics and freight forwarding, managed by its board of directors.

2. Services. The parties shall cooperate on the introduction of new clients to the Company.

3. Liability. The Consultant shall be liable for all losses howsoever arising out of the performance of the Services.

4. Variation. The Company may vary the scope of the engagement at its sole discretion.

5. Termination. The Company may terminate this agreement at any time without notice.

The parties shall keep the Confidential Information of the other party confidential. The Confidential Information remains the property of the party that disclosed it.
`;

const CLEAN_GENERAL_TEXT = `
This Agreement is made between the parties on the Effective Date.

1. Governing law. This Agreement shall be governed by the laws of the Federal Republic of Nigeria, and the parties submit to the exclusive jurisdiction of the High Court of Lagos State.

2. Disputes. Disputes shall be referred to arbitration in Lagos under the Arbitration and Mediation Act 2023.

3. Termination. Either party may terminate this agreement on 30 days' prior written notice for an unremedied material breach.

4. Indemnity. Each party shall indemnify the other against direct losses caused by its breach of this Agreement, and its aggregate liability shall not exceed the fees paid in the preceding 12 months.
`;

describe('splitClauses', () => {
    it('splits blank-line paragraphs into clauses with stable ids', () => {
        const clauses = splitClauses(SHAREHOLDERS_TEXT);
        expect(clauses.length).toBeGreaterThanOrEqual(5);
        expect(clauses[0].id).toBe('c1');
        expect(clauses.map((c) => c.index)).toEqual(clauses.map((_, i) => i + 1));
    });

    it('drops short fragments (signatures, page noise)', () => {
        const clauses = splitClauses('DONE this day.\n\nA short line.\n\n' + SHAREHOLDERS_TEXT);
        expect(clauses.every((c) => c.text.length >= 40)).toBe(true);
    });
});

describe('detectDocType', () => {
    it('recognises a shareholders agreement', () => {
        expect(detectDocType(SHAREHOLDERS_TEXT)).toBe('shareholders');
    });

    it('falls back to general for unsignalled text', () => {
        expect(detectDocType('A simple exchange of letters about nothing in particular.')).toBe('general');
    });
});

describe('defined terms', () => {
    it('extracts "(the X)" and "X shall mean" definitions', () => {
        const defined = extractDefinedTerms(SHAREHOLDERS_TEXT);
        expect(defined.some((d) => d.term === 'Company')).toBe(true);
    });

    it('extracts the "shall mean" form', () => {
        const defined = extractDefinedTerms('"Services" shall mean the services described in Schedule 1 to this Agreement.');
        expect(defined).toEqual([{ term: 'Services', definition: 'the services described in Schedule 1 to this Agreement' }]);
    });

    it('flags labelled terms in use but never defined', () => {
        const undefined = findUndefinedUses(SHAREHOLDERS_TEXT, extractDefinedTerms(SHAREHOLDERS_TEXT));
        expect(undefined.some((u) => u.term === 'Confidential Information' && u.occurrences >= 2)).toBe(true);
    });
});

describe('missing standard clauses', () => {
    it('names the gaps with a Nigerian-law standard draft', () => {
        const missing = checkMissingClauses(SHAREHOLDERS_TEXT, 'shareholders');
        const gov = missing.find((m) => m.id === 'governing_law');
        expect(gov).toBeDefined();
        expect(gov!.severity).toBe('High');
        expect(gov!.nigerianStandard).toContain('Federal Republic of Nigeria');
        expect(missing.some((m) => m.id === 'share_transfer')).toBe(true);
    });

    it('a complete general contract has no gaps', () => {
        expect(checkMissingClauses(CLEAN_GENERAL_TEXT, 'general')).toEqual([]);
    });
});

describe('risk scoring and redlines', () => {
    const r = analyzeContract(SHAREHOLDERS_TEXT, 'shareholders');

    it('flags unlimited liability as High with a redline', () => {
        const flag = r.riskFlags.find((f) => f.id.startsWith('unlimited_liability-'));
        expect(flag).toBeDefined();
        expect(flag!.level).toBe('High');
        expect(flag!.redline).not.toBeNull();
        expect(flag!.redline!.suggested).toContain('shall not exceed');
    });

    it('flags sole discretion as Medium', () => {
        const flag = r.riskFlags.find((f) => f.id.startsWith('sole_discretion-'));
        expect(flag?.level).toBe('Medium');
    });

    it('flags pre-incorporation execution as High (CAMA 2020 s.18(1))', () => {
        const flag = r.riskFlags.find((f) => f.id.startsWith('pre_incorporation-'));
        expect(flag?.level).toBe('High');
        expect(flag!.redline!.suggested).toContain('Section 18(1) of CAMA 2020');
    });

    it('escalates overall risk to High', () => {
        expect(r.overallRisk).toBe('High');
    });

    it('suppresses the liability flag when a cap is present', () => {
        const capped = analyzeContract(CLEAN_GENERAL_TEXT, 'general');
        expect(capped.riskFlags.find((f) => f.id.startsWith('unlimited_liability-'))).toBeUndefined();
        expect(capped.overallRisk).toBe('Low');
    });
});

describe('determinism', () => {
    it('identical input produces identical output', () => {
        const a = analyzeContract(SHAREHOLDERS_TEXT, 'shareholders');
        const b = analyzeContract(SHAREHOLDERS_TEXT, 'shareholders');
        expect(a).toEqual(b);
        expect(a.reviewHoursSaved).toBeGreaterThan(0);
        expect(a.reviewHoursSaved).toBeLessThanOrEqual(12);
    });
});
