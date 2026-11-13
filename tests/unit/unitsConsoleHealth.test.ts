/**
 * unitsConsoleHealth.test.ts — the Unit Health rubric (UNITS_PAGE_REDESIGN §3.2).
 *
 * deriveUnitHealth is the pure derivation behind the health dot, the
 * attention bar, the filters and the default attention-first sort. These
 * tests pin the rubric: Action > Watch > OK; vacant/listed carry no health;
 * every trigger maps to the right level + a human reason.
 *
 * The BASE fixture is a healthy, freshly-let unit (lease started days ago,
 * monthly cadence, no elapsed billing cycles, active ledger row) — each
 * test then flips exactly one input.
 */
import { describe, it, expect } from 'vitest';
import { deriveUnitHealth, arrearsTokens, compareUnitsByAttention } from '../../src/components/details/units/useUnitHealth';
import type { Property } from '../../src/types';

const baseProperty = { id: 'p1', address: 'No. 20 Westsyde Drive, Ogombo, Ajah' } as unknown as Property;
const ACTIVE_LEDGER = { resolved: true, active: { tenantName: 'Mr. Chigozie' }, total: 1 };

/** Fresh, complete unit whose first rent cycle is already settled → the OK baseline. */
const mkUnit = (overrides: Record<string, any> = {}): Property => ({
    id: 'u1',
    status: 'Occupied',
    rentalDetails: {
        unitName: 'Unit 1',
        tenantName: 'Mr. Chigozie',
        tenantPhone: '08031234567',
        rentAmount: 250_000,
        rentFrequency: 'Monthly',
        leaseStart: '2026-11-01',
        leaseEnd: '2027-10-31',
        serviceChargeAmount: 0, // no SC stream on the baseline unit
    },
    rentPaymentHistory: [
        { amount: 250_000, paidDate: '2026-11-02', status: 'paid', periodStart: '2026-11-01', periodEnd: '2026-11-30' },
    ],
    ...overrides,
} as unknown as Property);

const healthy = (unit: Property, over: Partial<Parameters<typeof deriveUnitHealth>[0]> = {}) =>
    deriveUnitHealth({ unit, property: baseProperty, includeRent: true, tenancyStatus: ACTIVE_LEDGER, tickets: [], ...over });

describe('Unit Health rubric (deriveUnitHealth)', () => {
    it('a clean occupied unit is OK with a "records complete" reason', () => {
        const h = healthy(mkUnit());
        expect(h.level).toBe('ok');
        expect(h.reasons.join(' ')).toContain('Records complete');
    });

    it('vacant and listed units carry NO health (occupancy axis only)', () => {
        for (const status of ['Vacant', 'Listed']) {
            const h = healthy(mkUnit({ status }));
            expect(h.level).toBe('none');
            expect(h.reasons).toEqual([]);
        }
    });

    it('an expired lease with the resident in place is ACTION with days overstayed', () => {
        const h = healthy(mkUnit({ rentalDetails: { unitName: 'Unit 1', tenantName: 'A', tenantPhone: '080', rentAmount: 100, rentFrequency: 'Monthly', leaseStart: '2024-01-01', leaseEnd: '2025-01-01' } }));
        expect(h.level).toBe('action');
        expect(h.daysOverstayed).toBeGreaterThan(300);
        expect(h.reasons.some(r => r.includes('overstayed'))).toBe(true);
    });

    it('overdue service-charge cycles are ACTION and produce SC arrears tokens', () => {
        // Lease ran long ago with a real monthly SC → cycles closed unpaid.
        const h = healthy(mkUnit({ rentalDetails: { unitName: 'Unit 2', tenantName: 'B', tenantPhone: '080', rentAmount: 100, rentFrequency: 'Monthly', leaseStart: '2023-01-01', leaseEnd: '2026-06-01', serviceChargeAmount: 50_000, serviceChargeFrequency: 'Monthly' } }));
        expect(h.streams.sc.overdueCount).toBeGreaterThan(0);
        expect(h.level).toBe('action');
        const tokens = arrearsTokens(h.streams);
        expect(tokens.some(t => t.label.startsWith('SC ') && t.tone === 'overdue')).toBe(true);
    });

    it('occupied without tier-1 records (no tenant name or lease end) is ACTION', () => {
        const h = healthy(mkUnit({ rentalDetails: { unitName: 'Unit 3', rentAmount: 100, rentFrequency: 'Monthly', leaseStart: '2026-11-01', leaseEnd: '2027-10-31' } }));
        expect(h.level).toBe('action');
        expect(h.reasons.some(r => r.includes('records incomplete'))).toBe(true);
    });

    it('a quit notice served is ACTION', () => {
        const tracker = { quitNoticeStatus: 'served', quitNoticeServedDate: Date.now() - 86_400_000, sevenDayNoticeStatus: 'none' };
        const h = healthy(mkUnit({ rentalDetails: { unitName: 'U', tenantName: 'C', tenantPhone: '080', rentAmount: 100, rentFrequency: 'Monthly', leaseStart: '2026-11-01', leaseEnd: '2027-10-31', evictionTracker: tracker } }));
        expect(h.level).toBe('action');
        expect(h.reasons.some(r => r.includes('Quit notice served'))).toBe(true);
    });

    it('a stale maintenance ticket (>24h) is ACTION; a fresh one is WATCH', () => {
        const stale = healthy(mkUnit(), { tickets: [{ status: 'open', isStale: true }] });
        expect(stale.level).toBe('action');
        const fresh = healthy(mkUnit(), { tickets: [{ status: 'open', isStale: false }] });
        expect(fresh.level).toBe('watch');
        expect(fresh.reasons.some(r => r.includes('open maintenance ticket'))).toBe(true);
    });

    it('occupied without a tenancy-ledger row is WATCH (record the resident)', () => {
        const h = healthy(mkUnit(), { tenancyStatus: { resolved: true, active: null, total: 0 } });
        expect(h.level).toBe('watch');
        expect(h.reasons.some(r => r.includes('without a tenancy ledger row'))).toBe(true);
    });

    it('the attention-first sort puts Action above Watch above OK, then most-overstayed', () => {
        const mk = (name: string, level: 'action' | 'watch' | 'ok', days = 0) => ({
            name,
            health: { level, daysOverstayed: days, streams: { rent: { overdueCount: 0 }, sc: { overdueCount: 0 }, mv: { overdueCount: 0 } } } as any,
        });
        const sorted = [mk('Unit 9', 'ok'), mk('Unit 2', 'action', 10), mk('Unit 7', 'watch'), mk('Unit 1', 'action', 40)]
            .sort(compareUnitsByAttention as any);
        expect(sorted.map(s => s.name)).toEqual(['Unit 1', 'Unit 2', 'Unit 7', 'Unit 9']);
    });
});
