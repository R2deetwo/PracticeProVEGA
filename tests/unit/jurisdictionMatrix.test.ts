/**
 * jurisdictionMatrix — DMN subject-matter routing golden vectors.
 *
 * Part of the ALOA LEGAL ENGINE test suite. These vectors pin the
 * constitutional routing so a regression (e.g. labour disputes silently
 * falling to the State High Court) fails CI instead of a filing.
 */
import { describe, it, expect } from 'vitest';
import { routeJurisdiction, FORUM_LABELS } from '../../src/legal/jurisdictionMatrix';

describe('routeJurisdiction — enumerated heads (s. 251(1) → Federal High Court)', () => {
    it('routes banking and IP disputes to the FHC with citation', () => {
        const banking = routeJurisdiction({ subjectMatter: 'banking' });
        expect(banking.recommendedForum).toBe('FEDERAL_HIGH_COURT');
        expect(banking.exclusivity).toBe('EXCLUSIVE');
        expect(banking.citation).toContain('s. 251(1)');

        const ip = routeJurisdiction({ text: 'The defendant infringed our trademark and is passing off our brand' });
        expect(ip.recommendedForum).toBe('FEDERAL_HIGH_COURT');
        expect(ip.subject).toBe('intellectual_property');
        expect(ip.citation).toContain('s. 251(1)');
    });

    it('classifies free text: a bank loan recovery routes to the FHC', () => {
        const r = routeJurisdiction({ text: 'We want to recover an unpaid loan from a customer of our bank' });
        expect(r.recommendedForum).toBe('FEDERAL_HIGH_COURT');
        expect(r.matchedKeywords.length).toBeGreaterThan(0);
    });
});

describe('routeJurisdiction — labour (s. 254C → NICN)', () => {
    it('routes an unfair dismissal claim to the NICN', () => {
        const r = routeJurisdiction({ text: 'Our client was unfairly dismissed from her employment at a factory in Lagos' });
        expect(r.recommendedForum).toBe('NICN');
        expect(r.subject).toBe('labour_employment');
        expect(r.citation).toContain('s. 254C');
        expect(r.exclusivity).toBe('EXCLUSIVE');
    });

    it('a labour claim inside another dispute still routes to the NICN (enumerated before residual)', () => {
        const r = routeJurisdiction({ text: 'The employee was terminated after a contract dispute with staff' });
        expect(r.recommendedForum).toBe('NICN');
    });

    it('trade union matters are NICN', () => {
        const r = routeJurisdiction({ subjectMatter: 'trade_union' });
        expect(r.recommendedForum).toBe('NICN');
    });
});

describe('routeJurisdiction — residual (State High Court)', () => {
    it('recovery of land routes to the State High Court', () => {
        const r = routeJurisdiction({ text: 'Recovery of a parcel of land with a certificate of occupancy in Ikeja', state: 'Lagos' });
        expect(r.recommendedForum).toBe('STATE_HIGH_COURT');
        expect(r.exclusivity).toBe('RESIDUAL_DEFAULT');
        expect(r.notes.some(n => n.includes('High Court of Lagos'))).toBe(true);
    });

    it('landlord/tenant recovery of premises routes to the State High Court', () => {
        const r = routeJurisdiction({ text: 'Landlord wants to evict the tenant over rent arrears and serve a quit notice' });
        expect(r.recommendedForum).toBe('STATE_HIGH_COURT');
        expect(r.subject).toBe('landlord_tenant');
    });
});

describe('routeJurisdiction — honesty discipline', () => {
    it('unclassifiable text is NEEDS_REVIEW with the residual default, never a silent answer', () => {
        const r = routeJurisdiction({ text: 'Something entirely unclassifiable like a birthday party' });
        expect(r.subject).toBe('unclassified');
        expect(r.confidence).toBe('NEEDS_REVIEW');
        expect(r.recommendedForum).toBe('STATE_HIGH_COURT');
        expect(r.notes[0]).toContain('confirm the forum');
    });

    it('every result carries a citation — no routing without authority', () => {
        for (const text of ['banking dispute', 'unfair dismissal', 'random gibberish xyz']) {
            const r = routeJurisdiction({ text });
            expect(r.citation.length).toBeGreaterThan(10);
            expect(r.citation).toContain('Constitution');
        }
    });

    it('exact keys bypass keyword classification and are DETERMINISTIC', () => {
        const r = routeJurisdiction({ subjectMatter: 'company_cama' });
        expect(r.confidence).toBe('DETERMINISTIC');
        expect(r.recommendedForum).toBe('FEDERAL_HIGH_COURT');
        expect(r.forumLabel).toBe(FORUM_LABELS.FEDERAL_HIGH_COURT);
    });
});
