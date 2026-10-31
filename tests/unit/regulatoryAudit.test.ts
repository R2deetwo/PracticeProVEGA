/**
 * regulatoryAudit tests — pin the DraftPro MODULE 2 engine (R48): the
 * Regulatory & Compliance Cross-Referencing add-on.
 *
 * Pins: statute selection by jurisdiction, and the audit log for each
 * provision — exact citations ("Violation of Section 4 of the Lagos
 * Tenancy Law 2011"), severity (Violation vs Advisory) and required fixes.
 */
import { describe, it, expect } from 'vitest';
import {
    runRegulatoryAudit,
    listStatutesForJurisdiction,
    STATUTE_LIBRARY,
} from '../../src/utils/statuteLibrary';

const clauses = (...texts: string[]) => texts.map((text, i) => ({ id: `c${i + 1}`, text }));

describe('statute library', () => {
    it('separates federal from Lagos statutes', () => {
        expect(listStatutesForJurisdiction('federal').map((s) => s.id)).toEqual([
            'cama-s18', 'labour-s7', 'labour-s18', 'fccpa-s17', 'fccpa-s24',
        ]);
        expect(listStatutesForJurisdiction('lagos').map((s) => s.id)).toEqual([
            'lagos-tenancy-s4', 'lagos-tenancy-s25',
        ]);
        expect(STATUTE_LIBRARY).toHaveLength(7);
    });
});

describe('CAMA 2020 s.18(1) — pre-incorporation contracts', () => {
    it('violation when executed before incorporation with no conditional mechanism', () => {
        const log = runRegulatoryAudit(
            clauses('This Agreement is made prior to the incorporation of the Company by the promoters named herein.'),
            'general',
            ['cama-s18'],
        );
        expect(log).toHaveLength(1);
        expect(log[0].severity).toBe('Violation');
        expect(log[0].citation).toBe('Violation of Section 18(1) of CAMA 2020');
        expect(log[0].requiredFix).toContain('Section 18(1)');
    });

    it('advisory when the s.18(1) conditional mechanism is present', () => {
        const log = runRegulatoryAudit(
            clauses('This Agreement is made prior to the incorporation of the Company and takes effect only upon incorporation of the Company.'),
            'general',
            ['cama-s18'],
        );
        expect(log).toHaveLength(1);
        expect(log[0].severity).toBe('Advisory');
        expect(log[0].citation).toBe('Flag under Section 18(1) of CAMA 2020');
    });

    it('silent when the contract is ordinary', () => {
        const log = runRegulatoryAudit(clauses('The Company shall provide logistics services to the Client.'), 'general', ['cama-s18']);
        expect(log).toEqual([]);
    });
});

describe('Labour Act s.7(1) — written particulars', () => {
    it('violation when an employment contract carries no particulars', () => {
        const log = runRegulatoryAudit(
            clauses('The Employee shall perform such duties as assigned from time to time.'),
            'employment',
            ['labour-s7'],
        );
        expect(log).toHaveLength(1);
        expect(log[0].severity).toBe('Violation');
        expect(log[0].citation).toBe('Violation of Section 7(1) of Labour Act');
    });

    it('satisfied when particulars are present', () => {
        const log = runRegulatoryAudit(
            clauses('Schedule 1 sets out the particulars of the terms of employment, including role, remuneration and hours.'),
            'employment',
            ['labour-s7'],
        );
        expect(log).toEqual([]);
    });
});

describe('Labour Act s.18(1) — termination notice', () => {
    it('violation when termination dispenses with notice', () => {
        const log = runRegulatoryAudit(
            clauses('The Company may terminate this contract at will without notice.'),
            'employment',
            ['labour-s18'],
        );
        expect(log).toHaveLength(1);
        expect(log[0].severity).toBe('Violation');
        expect(log[0].citation).toBe('Violation of Section 18(1) of Labour Act');
    });

    it('advisory when the stated notice may fall below the statutory minimum', () => {
        const log = runRegulatoryAudit(
            clauses('Either party may terminate on five days\' notice in writing.'),
            'employment',
            ['labour-s18'],
        );
        expect(log).toHaveLength(1);
        expect(log[0].severity).toBe('Advisory');
        expect(log[0].citation).toBe('Flag under Section 18(1) of Labour Act');
    });

    it('satisfied by a lawful notice period', () => {
        const log = runRegulatoryAudit(
            clauses('Either party may terminate on three months\' notice in writing.'),
            'employment',
            ['labour-s18'],
        );
        expect(log).toEqual([]);
    });
});

describe('FCCPA 2018 s.17 — restraints of trade', () => {
    it('violation for a blanket restraint', () => {
        const log = runRegulatoryAudit(
            clauses('The Employee shall not engage in any business whatsoever during the term.'),
            'employment',
            ['fccpa-s17'],
        );
        expect(log).toHaveLength(1);
        expect(log[0].severity).toBe('Violation');
        expect(log[0].citation).toBe('Violation of Section 17 of FCCPA 2018');
    });

    it('advisory for a scoped restraint', () => {
        const log = runRegulatoryAudit(
            clauses('The Employee shall not compete with the Company for 6 months after termination, within Lagos.'),
            'employment',
            ['fccpa-s17'],
        );
        expect(log).toHaveLength(1);
        expect(log[0].severity).toBe('Advisory');
    });
});

describe('Lagos Tenancy Law 2011 s.4 — advance rent', () => {
    it('violation for 24 months in advance', () => {
        const log = runRegulatoryAudit(
            clauses('The Tenant shall pay twenty-four months\' rent in advance on execution of this lease.'),
            'commercial_lease',
            ['lagos-tenancy-s4'],
        );
        expect(log).toHaveLength(1);
        expect(log[0].severity).toBe('Violation');
        expect(log[0].citation).toBe('Violation of Section 4 of Lagos Tenancy Law 2011');
        expect(log[0].finding).toContain('24 months');
    });

    it('violation for two years in advance (word form)', () => {
        const log = runRegulatoryAudit(
            clauses('The Tenant shall pay two years rent in advance.'),
            'commercial_lease',
            ['lagos-tenancy-s4'],
        );
        expect(log).toHaveLength(1);
        expect(log[0].severity).toBe('Violation');
    });

    it('advisory in the 7–12 month band', () => {
        const log = runRegulatoryAudit(
            clauses('The Tenant shall pay nine months rent in advance.'),
            'commercial_lease',
            ['lagos-tenancy-s4'],
        );
        expect(log).toHaveLength(1);
        expect(log[0].severity).toBe('Advisory');
    });

    it('satisfied at or below six months', () => {
        const log = runRegulatoryAudit(
            clauses('The Tenant shall pay six months rent in advance, and monthly thereafter.'),
            'commercial_lease',
            ['lagos-tenancy-s4'],
        );
        expect(log).toEqual([]);
    });
});

describe('Lagos Tenancy Law 2011 s.25 — notice to quit', () => {
    it('violation when the statutory notice is waived', () => {
        const log = runRegulatoryAudit(
            clauses('The Tenant waives all rights to notice to quit, howsoever the tenancy is determined.'),
            'commercial_lease',
            ['lagos-tenancy-s25'],
        );
        expect(log).toHaveLength(1);
        expect(log[0].severity).toBe('Violation');
        expect(log[0].citation).toBe('Violation of Section 25 of Lagos Tenancy Law 2011');
    });
});

describe('audit ordering', () => {
    it('lists violations before advisories', () => {
        const log = runRegulatoryAudit(
            clauses(
                'The Tenant shall pay eighteen months rent in advance.',
                'The Supplier shall not compete with the Company for 6 months after termination.',
            ),
            'general',
            ['lagos-tenancy-s4', 'fccpa-s17'],
        );
        expect(log.map((v) => v.severity)).toEqual(['Violation', 'Advisory']);
    });
});
