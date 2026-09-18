/**
 * moveInBreakdown.test.ts — regression guards for the Task 59 follow-ups
 * (serviceChargeMonthsInAdvance enforcement + itemised move-in breakdown).
 *
 * CONTRACT 1 — buildMoveInBreakdown (shared row builder):
 *   Every surface that shows a NEW resident their move-in cost uses the
 *   same categories and periodicity semantics as the Lease & Rent
 *   Configuration's Move-in Cost Summary (Task 59):
 *   - rent + service charge keep their own cycle (never a lump sum);
 *   - the service-charge advance is its own one-time row computed as
 *     monthly rate × months (clamped 0-24);
 *   - legal / agency are one-time, caution deposit is refundable;
 *   - N/A fees and zero figures are omitted;
 *   - Management-Only hides the rent row; Core-Services-off hides SC rows;
 *   - the builder NEVER returns a total (different kinds of money).
 *
 * CONTRACT 2 — deriveAdvanceRequirementRows (onboarding ledger enforcement):
 *   The unit's months-in-advance policy materialises the UNCOLLECTED
 *   months as "due at move-in" rows on the cadence grid:
 *   - 0 policy months (default) → no rows, nothing changes;
 *   - settled advance rows (advance_paid / paid / late with the advance
 *     flag) count as covered — only the gap is derived;
 *   - reopening never duplicates collected months (covered is counted,
 *     not re-added);
 *   - rows are outstanding + isAdvance (ephemeral at read time —
 *     buildTimeline drops unpaid future advance rows, so no phantom
 *     overdue in running balances);
 *   - requirement rows are clamped 0-24 and require a cadence amount.
 *
 * CONTRACT 3 — surface wiring (source pins):
 *   - ComposeModal: the breakdown renders ONLY for a single NEW resident
 *     (existing residents keep the rent-only note — Task 16 contract);
 *     the panel copy states items are not added together.
 *   - OnboardUnitLedgerModal: SC mode derives the requirement rows and
 *     surfaces the policy note ("Advance requirement") + a "Due at
 *     move-in" badge on uncollected months.
 *   - AtriumPublicApplicationForm: applicants see the same itemised
 *     disclosure (or an honest rent range for multi-unit, no-hint links)
 *     BEFORE applying.
 *   - usePropertyGroups: UnitOption carries the cadence + advance-policy
 *     inputs so the ComposeModal panel reflects each resident's own unit.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildMoveInBreakdown,
    rentCycleLabel,
    scCycleMonths,
    monthlyServiceChargeRate,
    type MoveInBreakdownInput,
} from '../../src/utils/propertyPayload';
import {
    deriveAdvanceRequirementRows,
    countSettledAdvanceRows,
    buildTimeline,
    resolveCadence,
} from '../../src/utils/leaseTimeline';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/schema.ts'))
    ? resolve(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

// ─── CONTRACT 1: buildMoveInBreakdown ───────────────────────────────────────

describe('buildMoveInBreakdown', () => {
    const full: MoveInBreakdownInput = {
        rentAmount: 1_400_000,
        rentFrequency: 'Annually',
        serviceCharge: 200_000,          // monthly rate (legacy field)
        serviceChargeAmount: 600_000,    // per-cycle total
        serviceChargeFrequency: 'Quarterly',
        serviceChargeMonthsInAdvance: 6,
        legalFee: 140_000,
        agencyFee: 140_000,
        cautionDeposit: 200_000,
    };

    it('itemises by category with each recurring charge keeping its own cycle', () => {
        const { rows } = buildMoveInBreakdown(full);
        const rent = rows.find(r => r.key === 'rent')!;
        expect(rent.amount).toBe(1_400_000);
        expect(rent.kind).toBe('recurring');
        expect(rent.period).toBe('per annum');

        // Quarterly cadence → per-cycle total wins (loadServiceChargeCycle rule)
        const sc = rows.find(r => r.key === 'serviceCharge')!;
        expect(sc.amount).toBe(600_000);
        expect(sc.kind).toBe('recurring');
        expect(sc.period).toBe('every 3 months');
    });

    it('derives the advance row as monthly rate × months — its own one-time line', () => {
        const { rows } = buildMoveInBreakdown(full);
        const adv = rows.find(r => r.key === 'scAdvance')!;
        // 600,000 per quarter / 3 = 200,000 monthly × 6 months = 1,200,000
        expect(adv.amount).toBe(1_200_000);
        expect(adv.kind).toBe('one-time');
        expect(adv.label).toContain('6 months');
        expect(adv.period).toBeUndefined();
    });

    it('marks legal/agency one-time and caution refundable', () => {
        const { rows } = buildMoveInBreakdown(full);
        expect(rows.find(r => r.key === 'legalFee')!.kind).toBe('one-time');
        expect(rows.find(r => r.key === 'agencyFee')!.kind).toBe('one-time');
        expect(rows.find(r => r.key === 'cautionDeposit')!.kind).toBe('refundable');
    });

    it('NEVER produces a lump-sum total (Task 59 policy)', () => {
        const { rows } = buildMoveInBreakdown(full);
        const sum = rows.reduce((s, r) => s + r.amount, 0);
        // No row equals the sum — the builder's return type has no total field.
        expect(rows.every(r => r.amount !== sum)).toBe(true);
        expect(Object.keys(rows[0]).sort()).toEqual(['amount', 'key', 'kind', 'label', 'period']);
    });

    it('omits zero figures and N/A fees entirely', () => {
        const { rows } = buildMoveInBreakdown({
            rentAmount: 500_000,
            legalFee: 0,
            isAgencyNA: true,
            agencyFee: 999,       // N/A wins — the fee is not charged
            cautionDeposit: 0,
        });
        expect(rows.map(r => r.key)).toEqual(['rent']);
    });

    it('hides the rent row for Management-Only properties but keeps the rest', () => {
        const { rows } = buildMoveInBreakdown(full, { rentCollecting: false });
        expect(rows.some(r => r.key === 'rent')).toBe(false);
        expect(rows.some(r => r.key === 'serviceCharge')).toBe(true);
        expect(rows.some(r => r.key === 'cautionDeposit')).toBe(true);
    });

    it('hides ALL service-charge rows when the Core Services toggle is off', () => {
        const { rows } = buildMoveInBreakdown(full, { scActive: false });
        expect(rows.some(r => r.key === 'serviceCharge')).toBe(false);
        expect(rows.some(r => r.key === 'scAdvance')).toBe(false);
        expect(rows.some(r => r.key === 'rent')).toBe(true);
    });

    it('resolves the monthly cadence rate-first (mirrors loadServiceChargeCycle)', () => {
        const { rows } = buildMoveInBreakdown({
            serviceCharge: 20_000,           // monthly rate
            serviceChargeAmount: 0,
            serviceChargeFrequency: 'Monthly',
            serviceChargeMonthsInAdvance: 3,
        });
        const sc = rows.find(r => r.key === 'serviceCharge')!;
        expect(sc.amount).toBe(20_000);
        expect(sc.period).toBe('every month');
        expect(rows.find(r => r.key === 'scAdvance')!.amount).toBe(60_000);
    });

    it('clamps advance months to 0-24 and drops the row when nothing is configured', () => {
        const clamped = buildMoveInBreakdown({ ...full, serviceChargeMonthsInAdvance: 99 });
        expect(clamped.rows.find(r => r.key === 'scAdvance')!.label).toContain('24 months');

        const zero = buildMoveInBreakdown({ ...full, serviceChargeMonthsInAdvance: 0 });
        expect(zero.rows.some(r => r.key === 'scAdvance')).toBe(false);

        const none = buildMoveInBreakdown(null);
        expect(none.hasAny).toBe(false);
        expect(none.rows).toEqual([]);
    });

    it('exposes cycle labels consistently with the form', () => {
        expect(rentCycleLabel('Annually')).toBe('per annum');
        expect(rentCycleLabel('Monthly')).toBe('per month');
        expect(rentCycleLabel('Quarterly')).toBe('per quarter');
        expect(rentCycleLabel('Bi-Annually')).toBe('every 6 months');
        expect(rentCycleLabel(undefined)).toBe('per annum');
        expect(scCycleMonths('Quarterly')).toBe(3);
        expect(monthlyServiceChargeRate(600_000, 'Quarterly')).toBe(200_000);
    });
});

// ─── CONTRACT 2: deriveAdvanceRequirementRows ────────────────────────────────

describe('deriveAdvanceRequirementRows', () => {
    const cadence = { months: 1, perPeriodAmount: 200_000 };
    const leaseStart = '2026-10-01';

    it('derives the full requirement for a new tenancy (no settled advances)', () => {
        const { rows, required, covered } = deriveAdvanceRequirementRows({
            monthsInAdvance: 6, leaseStart, cadence, periods: [],
        });
        expect(required).toBe(6);
        expect(covered).toBe(0);
        expect(rows).toHaveLength(6);
        expect(rows.every(r => r.isAdvance === true && r.status === 'outstanding')).toBe(true);
        expect(rows.every(r => r.amount === 200_000)).toBe(true);
        // Cadence grid: consecutive indexes from 1, monthly steps from leaseStart
        expect(rows[0].index).toBe(1);
        expect(rows[0].dueDate).toBe('2026-10-01');
        expect(rows[1].dueDate).toBe('2026-11-01');
        expect(rows[5].dueDate).toBe('2027-03-01');
    });

    it('counts settled advance months as covered — only the gap is derived', () => {
        const settled = [
            { index: 1, status: 'advance_paid', isAdvance: true },
            { index: 2, status: 'paid', isAdvance: true },
            { index: 3, status: 'late', isAdvance: true },
        ];
        const { rows, covered, required } = deriveAdvanceRequirementRows({
            monthsInAdvance: 6, leaseStart, cadence, periods: settled,
        });
        expect(covered).toBe(3);
        expect(required).toBe(6);
        expect(rows).toHaveLength(3);
        // New rows continue AFTER the highest existing index — no collisions
        expect(rows[0].index).toBe(4);
    });

    it('derives nothing when the requirement is met (reopening never duplicates)', () => {
        const settled = Array.from({ length: 6 }, (_, i) => ({
            index: i + 1, status: 'advance_paid', isAdvance: true,
        }));
        const { rows, covered } = deriveAdvanceRequirementRows({
            monthsInAdvance: 6, leaseStart, cadence, periods: settled,
        });
        expect(covered).toBe(6);
        expect(rows).toHaveLength(0);
    });

    it('no-op for 0 policy months, missing lease start, or zero cadence amount', () => {
        expect(deriveAdvanceRequirementRows({ monthsInAdvance: 0, leaseStart, cadence, periods: [] }).rows).toHaveLength(0);
        expect(deriveAdvanceRequirementRows({ monthsInAdvance: 6, leaseStart: '', cadence, periods: [] }).rows).toHaveLength(0);
        expect(deriveAdvanceRequirementRows({ monthsInAdvance: 6, leaseStart, cadence: { months: 1, perPeriodAmount: 0 }, periods: [] }).rows).toHaveLength(0);
        expect(deriveAdvanceRequirementRows({ monthsInAdvance: 99, leaseStart, cadence, periods: [] }).required).toBe(24);
    });

    it('unpaid future advance rows are dropped by buildTimeline (no phantom overdue)', () => {
        // The requirement rows this helper produces, saved as-is, must NOT
        // resurface as owed periods through the shared read engine.
        const { rows } = deriveAdvanceRequirementRows({
            monthsInAdvance: 3, leaseStart, cadence, periods: [],
        });
        const reread = buildTimeline({
            leaseStart,
            cadence: resolveCadence({ scFrequency: 'Monthly', monthlyRate: 200_000, resolvedTotal: 200_000 }),
            stored: rows as unknown as Array<Record<string, any>>,
            now: new Date('2026-09-18T00:00:00Z'), // lease not started yet
        });
        expect(reread).toHaveLength(0);
    });

    it('countSettledAdvanceRows counts only settled advance-flagged rows', () => {
        expect(countSettledAdvanceRows([
            { status: 'advance_paid', isAdvance: true },
            { status: 'paid', isAdvance: true },
            { status: 'outstanding', isAdvance: true },   // uncollected — not covered
            { status: 'paid', isAdvance: undefined },     // regular period, not advance
            { status: 'advance_paid', isAdvance: undefined },
        ])).toBe(2);
        expect(countSettledAdvanceRows(null)).toBe(0);
    });
});

// ─── CONTRACT 3: surface wiring (source pins) ────────────────────────────────

describe('surface wiring', () => {
    it('ComposeModal renders the breakdown ONLY for a single NEW resident', () => {
        const src = read('src/components/atrium/ComposeModal.tsx');
        // New-resident gate: exactly one recipient, tenant, NOT existing
        expect(src).toContain("selectedRecipients.length !== 1 ||");
        expect(src).toContain("r?.recipientType !== 'tenant'");
        expect(src).toContain("(r as any).isExistingTenant !== false");
        // Panel present + the not-added-together copy
        expect(src).toContain('Move-in breakdown —');
        expect(src).toContain('items are not added together');
        // The existing-resident note (Task 16 contract) is still intact
        expect(src).toContain('Existing resident:');
        // Inputs come from the recipient's own unit record
        expect(src).toContain('serviceChargeMonthsInAdvance: r.serviceChargeMonthsInAdvance');
    });

    it('OnboardUnitLedgerModal enforces the advance policy in SC mode', () => {
        const src = read('src/components/modals/OnboardUnitLedgerModal.tsx');
        expect(src).toContain("chargeType === 'SC'");
        expect(src).toContain('deriveAdvanceRequirementRows');
        expect(src).toContain('Advance requirement:');
        expect(src).toContain('Due at move-in');
        expect(src).toContain('Mark Advance as each month is collected');
        // Requirement note hidden when nothing is required
        expect(src).toContain('scAdvanceMonths > 0 && effCadence.perPeriodAmount > 0');
    });

    it('the public application discloses move-in costs before applying', () => {
        const src = read('src/components/atrium/AtriumPublicApplicationForm.tsx');
        expect(src).toContain('buildMoveInBreakdown');
        expect(src).toContain('Move-in Costs');
        expect(src).toContain('confirmed per unit during review'); // honest multi-unit range
        // Core-services + management-only gating respected in public too
        expect(src).toContain("p.coreServices?.serviceCharge !== false");
        expect(src).toContain("p.rentCollectionMode !== 'Management Only (No Rent)'");
    });

    it('UnitOption carries the cadence + advance-policy inputs', () => {
        const src = read('src/hooks/usePropertyGroups.ts');
        expect(src).toContain('rentFrequency: unit.rentFrequency');
        expect(src).toContain('serviceChargeMonthsInAdvance: Math.max(0, Math.min(24');
        expect(src).toContain('serviceChargeAmount: unit.serviceChargeAmount');
    });
});
