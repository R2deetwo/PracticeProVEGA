import { describe, it, expect } from 'vitest';
import {
    deriveCurrencyStatus,
    currencyStatusLabel,
    currencyStatusCaveat,
    currencyStatusChipClass,
    CURRENCY_STATUSES,
} from '../../src/legal/currencyStatus';

// ─── Workstream B (2026-11-24): the ONE currency/repeal vocabulary ─────────
// The derivation is the honesty contract of the whole corpus: absent or
// unknown inputs must NEVER come out as anything stronger than
// unverified_archive. A ~15-year archive file nobody has re-checked
// reads as unverified, not "in force".

describe('currency status derivation (legacy vocabularies → one model)', () => {
    it('repealed / superseded map to superseded_or_repealed', () => {
        expect(deriveCurrencyStatus({ status: 'repealed' })).toBe('superseded_or_repealed');
        expect(deriveCurrencyStatus({ statusV2: 'superseded' })).toBe('superseded_or_repealed');
        expect(deriveCurrencyStatus({ status: 'in_force', repealed: true })).toBe('superseded_or_repealed');
    });

    it('amended maps to amended_partial', () => {
        expect(deriveCurrencyStatus({ status: 'amended' })).toBe('amended_partial');
        expect(deriveCurrencyStatus({ status: 'in_force', amended: true })).toBe('amended_partial');
    });

    it('in force AND verified maps to active_verified; in force but unverified stays honest', () => {
        expect(deriveCurrencyStatus({ status: 'in_force', verified: true })).toBe('active_verified');
        expect(deriveCurrencyStatus({ statusV2: 'monitor', verified: true })).toBe('active_verified');
        // The archive default: in force but nobody verified the citator.
        expect(deriveCurrencyStatus({ status: 'in_force', verified: false })).toBe('unverified_archive');
        expect(deriveCurrencyStatus({ status: 'in_force' })).toBe('unverified_archive');
    });

    it('absent / unknown / garbage input NEVER claims currency', () => {
        expect(deriveCurrencyStatus({})).toBe('unverified_archive');
        expect(deriveCurrencyStatus({ status: 'unknown' })).toBe('unverified_archive');
        expect(deriveCurrencyStatus({ status: 'whatever', verified: true })).toBe('unverified_archive');
        expect(deriveCurrencyStatus({ status: null, statusV2: undefined })).toBe('unverified_archive');
    });

    it('the four values are the whole vocabulary', () => {
        expect([...CURRENCY_STATUSES]).toEqual([
            'active_verified',
            'amended_partial',
            'superseded_or_repealed',
            'unverified_archive',
        ]);
    });
});

describe('currency status labels, caveats and chips', () => {
    it('every status has a human label and a distinct chip class', () => {
        for (const status of CURRENCY_STATUSES) {
            expect(currencyStatusLabel(status).length).toBeGreaterThan(3);
            expect(currencyStatusChipClass(status)).toMatch(/bg-\w+-\d+|dark:/);
        }
        // Unknown strings fall back to the archive presentation, never throw.
        expect(currencyStatusLabel('nonsense')).toBe('Unverified archive');
        expect(currencyStatusChipClass('nonsense')).toBeTruthy();
    });

    it('active_verified carries no caveat; every other status warns', () => {
        expect(currencyStatusCaveat('active_verified')).toBe('');
        expect(currencyStatusCaveat('amended_partial')).toContain('amended');
        expect(currencyStatusCaveat('superseded_or_repealed')).toContain('must not be cited as current law');
        expect(currencyStatusCaveat('unverified_archive')).toContain('Confirm the provision is still in force');
        expect(currencyStatusCaveat('nonsense')).toContain('Confirm the provision is still in force');
    });
});
