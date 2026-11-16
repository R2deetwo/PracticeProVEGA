/**
 * limitationEngine — statutory limitation golden vectors + SAFE_STOP.
 *
 * Part of the ALOA LEGAL ENGINE test suite. The engine must NEVER guess:
 * known causes compute exact deadlines; unknown causes return NEEDS_REVIEW;
 * time bars trigger safeStop with the exceptions list.
 */
import { describe, it, expect } from 'vitest';
import { calculateLimitation } from '../../src/legal/limitationEngine';

describe('calculateLimitation — simple contract (6 years, Lagos table)', () => {
    it('filed within the window → WITHIN_LIMIT with the exact deadline', () => {
        const r = calculateLimitation({
            causeOfAction: 'simple_contract',
            accrualDate: '2020-01-15',
            proposedFilingDate: '2025-06-01',
        });
        expect(r.status).toBe('WITHIN_LIMIT');
        expect(r.limitationDeadline).toBe('2026-01-15');
        expect(r.daysRemaining).toBeGreaterThan(0);
        expect(r.period.years).toBe(6);
        expect(r.citation).toContain('Limitation Law of Lagos State');
        expect(r.safeStop).toBe(false);
    });

    it('filed after the deadline → TIME_BARRED with safeStop and exceptions', () => {
        const r = calculateLimitation({
            causeOfAction: 'simple_contract',
            accrualDate: '2020-01-15',
            proposedFilingDate: '2027-01-16',
        });
        expect(r.status).toBe('TIME_BARRED');
        expect(r.safeStop).toBe(true);
        expect(r.exceptionsToExplore.length).toBeGreaterThan(2);
        expect(r.exceptionsToExplore.some(e => e.toLowerCase().includes('fraud'))).toBe(true);
    });

    it('filing exactly on the deadline is not yet barred', () => {
        const r = calculateLimitation({
            causeOfAction: 'simple_contract',
            accrualDate: '2020-01-15',
            proposedFilingDate: '2026-01-15',
        });
        expect(r.status).toBe('EXPIRING_SOON');
        expect(r.daysRemaining).toBe(0);
        expect(r.safeStop).toBe(false);
    });
});

describe('calculateLimitation — other causes', () => {
    it('recovery of land: 12 years', () => {
        const r = calculateLimitation({
            causeOfAction: 'land_recovery',
            accrualDate: '2014-05-01',
            proposedFilingDate: '2023-05-01',
        });
        expect(r.status).toBe('WITHIN_LIMIT');
        expect(r.period.years).toBe(12);
        expect(r.limitationDeadline).toBe('2026-05-01');
    });

    it('public officer action: 3-month POPA window bars a late claim', () => {
        const r = calculateLimitation({
            causeOfAction: 'public_officer_action',
            accrualDate: '2026-01-01',
            proposedFilingDate: '2026-05-01',
        });
        expect(r.status).toBe('TIME_BARRED');
        expect(r.safeStop).toBe(true);
        expect(r.citation).toContain('Public Officers Protection Act');
    });

    it('a window closing within 90 days is EXPIRING_SOON (advisory, not safe-stop)', () => {
        // Deadline 2026-06-01; filing 2026-04-01 leaves 61 days.
        const r = calculateLimitation({
            causeOfAction: 'simple_contract',
            accrualDate: '2020-06-01',
            proposedFilingDate: '2026-04-01',
        });
        expect(r.status).toBe('EXPIRING_SOON');
        expect(r.safeStop).toBe(false);
        expect(r.exceptionsToExplore).toEqual([]);
    });
});

describe('calculateLimitation — honesty discipline', () => {
    it('an unknown cause of action NEVER gets a period — NEEDS_REVIEW', () => {
        const r = calculateLimitation({
            causeOfAction: 'some exotic cause',
            accrualDate: '2020-01-01',
        });
        expect(r.status).toBe('NEEDS_REVIEW');
        expect(r.safeStop).toBe(false);
        expect(r.citation).toBe('—');
        expect(r.verifyNote).toContain('never guesses');
    });

    it('a missing accrual date is NEEDS_REVIEW, not a computed guess', () => {
        const r = calculateLimitation({ causeOfAction: 'tort' });
        expect(r.status).toBe('NEEDS_REVIEW');
    });

    it('a non-Lagos state carries a state-verification note', () => {
        const r = calculateLimitation({
            causeOfAction: 'simple_contract',
            accrualDate: '2022-01-01',
            proposedFilingDate: '2024-01-01',
            state: 'Rivers',
        });
        expect(r.status).toBe('WITHIN_LIMIT');
        expect(r.stateNote).toContain('Rivers');
        expect(r.stateNote).toContain('must be confirmed');
    });
});
