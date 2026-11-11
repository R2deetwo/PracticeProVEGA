/**
 * citationClassifier — the 6-class taxonomy + per-class completeness rules.
 *
 * V5 (G: wiring): this suite was previously a hand-rolled assert-script that
 * lived at src/utils/citationClassifier.test.ts (and a near-duplicate under
 * scripts/) — NEVER picked up by the vitest run, which only includes test
 * files under the tests/ directory. It is now a real suite in the actual
 * test run. The stale copies were deleted.
 *
 * V5 (A: citation integrity): new cases pin the distinction between
 * SYNTACTIC VALIDITY (all this classifier can ever establish) and
 * verification — a well-formed citation is never treated as verified, and
 * fabricated authorities (plausible-looking but incomplete) are flagged.
 */
import { describe, it, expect } from 'vitest';
import {
    classifyCitation,
    classifyAndCheckCitation,
    extractPinpoint,
} from '../../src/utils/citationClassifier';
import {
    citationVerificationLevel,
    verificationBasisLine,
    LAW_REPORTS_DISCLOSURE,
    VERIFICATION_LABELS,
} from '../../src/utils/citationVerification';

describe('classifyCitation — the 6-class taxonomy', () => {
    it('statutes: CAMA 2020 and abbreviations', () => {
        expect(classifyCitation('Companies and Allied Matters Act (CAMA) 2020')).toBe('statute');
        expect(classifyCitation('Land Use Act')).toBe('statute');
        expect(classifyCitation('NDPA 2023')).toBe('statute');
    });

    it('constitutional provisions', () => {
        expect(classifyCitation('1999 Constitution, Section 251(1)(a)')).toBe('constitutional');
    });

    it('case law via the "v" pattern', () => {
        expect(classifyCitation('Adeyemi v. State (2021) LPELR-56034(SC)')).toBe('case_law');
        expect(classifyCitation('Central Bank of Nigeria v Imokharia')).toBe('case_law');
    });

    it('contracts, direct quotes, secondary sources', () => {
        expect(classifyCitation('clause 7.2 of the Shareholders\u2019 Agreement')).toBe('contract');
        expect(classifyCitation('per Obaseki, JSC, "the court is not a father Christmas"')).toBe('direct_quote');
        expect(classifyCitation('Nwabueze, Introduction to Nigerian Legal Method (3rd ed., 2018)')).toBe('secondary');
    });

    it('URLs and unrecognisable text fall to unclassified (manual review), never case-law rules', () => {
        expect(classifyCitation('https://example.com/case')).toBe('unclassified');
        expect(classifyCitation('something that is not a reference at all')).toBe('unclassified');
    });

    it('a URL that merely LOOKS like a citation pattern is not treated as verified', () => {
        // A fabricated case-law string — well-formed, but nothing behind it.
        const fabricated = classifyAndCheckCitation('Odili & Anor v. Group Textile Ltd (2023) NWLR (Pt 1900) 77 (SC)');
        expect(fabricated.citationClass).toBe('case_law');
        expect(fabricated.isComplete).toBe(true); // syntactically fine —
        // …but the result carries NO verification claim anywhere:
        expect((fabricated as any).verified).toBeUndefined();
        expect((fabricated as any).externallyVerified).toBeUndefined();
    });
});

describe('classifyAndCheckCitation — per-class completeness (fabricated-authority flags)', () => {
    it('statute without a year is flagged', () => {
        const r = classifyAndCheckCitation('Land Use Act');
        expect(r.citationClass).toBe('statute');
        expect(r.issues.some(i => i.field === 'year')).toBe(true);
        expect(r.issues.some(i => i.field === 'reporter')).toBe(false); // statutes never need a reporter
    });

    it('case law missing a reporter is flagged — plausible-looking is not enough', () => {
        const r = classifyAndCheckCitation('Adeyemi v. State (2021)');
        expect(r.citationClass).toBe('case_law');
        expect(r.issues.some(i => i.field === 'reporter')).toBe(true);
        expect(r.isComplete).toBe(false);
    });

    it('case law missing the court identifier is flagged', () => {
        const r = classifyAndCheckCitation('Nwosu v. State (2020) NWLR (Pt 1122) 1');
        expect(r.issues.some(i => i.field === 'court')).toBe(true);
    });

    it('complete case law passes the format check (format check only — see below)', () => {
        const r = classifyAndCheckCitation('Adeyemi v. State (2021) LPELR-56034(SC)');
        expect(r.issues).toHaveLength(0);
        expect(r.isComplete).toBe(true);
        expect(r.needsManualReview).toBe(false);
    });

    it('constitutional citations need a pinpoint', () => {
        const r = classifyAndCheckCitation('1999 Constitution');
        expect(r.issues.some(i => i.field === 'pinpoint')).toBe(true);
        const ok = classifyAndCheckCitation('Section 251(1)(a) of the 1999 Constitution');
        expect(ok.isComplete).toBe(true);
    });

    it('unclassified citations are routed to manual review, not case-law rules', () => {
        const r = classifyAndCheckCitation('https://lawpavilion.com/odili-v-group-textile');
        expect(r.citationClass).toBe('unclassified');
        expect(r.needsManualReview).toBe(true);
        expect(r.issues[0].field).toBe('review');
    });

    it('missing-source citations: pinpoint extraction works across forms', () => {
        expect(extractPinpoint('Section 21, CAMA 2020')).toContain('21');
        expect(extractPinpoint('s. 251(1)(a) of the 1999 Constitution')).toContain('251');
        expect(extractPinpoint('clause 7.2 of the Shareholders\u2019 Agreement')).toContain('7.2');
        expect(extractPinpoint('no pinpoint here')).toBeUndefined();
    });
});

describe('citationVerification — the honest basis levels (V5 A)', () => {
    it('syntactic only when nothing is matched', () => {
        expect(citationVerificationLevel({ sourceMatched: false })).toBe('syntactic_only');
        expect(verificationBasisLine('syntactic_only')).toContain('no external authority consulted');
    });

    it('source matched is still NOT external verification', () => {
        const level = citationVerificationLevel({ sourceMatched: true });
        expect(level).toBe('source_matched');
        expect(verificationBasisLine(level)).toContain('no external authority verification has occurred');
        expect(verificationBasisLine(level)).not.toContain('Externally verified');
    });

    it('authority_verified exists as a level but is labelled honestly', () => {
        // No caller passes authorityVerified today — the level exists so the
        // day a licensed corpus is connected the wiring has somewhere to go.
        expect(citationVerificationLevel({ sourceMatched: true, authorityVerified: true })).toBe('authority_verified');
        expect(VERIFICATION_LABELS.authority_verified).toContain('must never be claimed');
    });

    it('the law-reports dependency limitation is disclosed, not simulated', () => {
        expect(LAW_REPORTS_DISCLOSURE).toContain('No law-report database is connected');
        expect(LAW_REPORTS_DISCLOSURE).toContain('LawPavilion');
        expect(LAW_REPORTS_DISCLOSURE).toContain('no citation in this app is verified against a legal authority');
    });
});
