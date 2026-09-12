/**
 * Units-tab timeline regression suite — auto-advancing billing pills.
 *
 * THE BUGS THIS LOCKS IN:
 *   1. SC pills stepped at RENT frequency (no form ever set
 *      serviceChargeFrequency) → annual rent produced ONE pill per year —
 *      "it doesn't even go from month to month".
 *   2. All computed periods defaulted to 'outstanding' (red) — the
 *      auto-late engine had been removed, so colors conveyed nothing and
 *      "new service charge is due" was never surfaced.
 *   3. Pills were disconnected from real payment records; the expanded
 *      card's "Payment History" never showed rent at all.
 *
 * A missing "monthly pills advance with the calendar" or
 * "payment settles a pill automatically" case means the fix is NOT in.
 */
import { describe, it, expect } from 'vitest';
import {
    buildTimeline,
    buildRentTimeline,
    buildAdvanceRows,
    advanceCoverageLabel,
    resolveCadence,
    summarizeTimeline,
    serviceChargeTimeline,
    monthLabel,
    periodMonths,
    type CadenceResolution,
    type TimelinePeriod,
} from '../../src/utils/leaseTimeline';

// Deterministic clock — the engine must be pure w.r.t. `now`.
const NOW = new Date('2026-03-15T12:00:00Z');

const monthly = (amount: number): CadenceResolution => ({
    months: 1, perPeriodAmount: amount, frequency: 'Monthly', explicit: false,
});

// ─── Cadence resolution ─────────────────────────────────────────────────────
describe('resolveCadence — the 12× trap', () => {
    it('no explicit SC frequency → MONTHLY cadence (the production fleet)', () => {
        const c = resolveCadence({ rentFrequency: 'Annually', monthlyRate: 15000, resolvedTotal: 180000 });
        expect(c.months).toBe(1);
        expect(c.perPeriodAmount).toBe(15000); // monthly rate wins, never 12×
        expect(c.explicit).toBe(false);
    });

    it('annual total with NO monthly rate → spread across the rent period (total / 12)', () => {
        const c = resolveCadence({ rentFrequency: 'Annually', monthlyRate: 0, resolvedTotal: 600000 });
        expect(c.months).toBe(1);
        expect(c.perPeriodAmount).toBe(50000);
    });

    it('monthly rate of 0 with a defined 0 is respected for exemption via amount<=0 at build', () => {
        // rate 0 + total 0 → perPeriod 0 → buildTimeline returns [] (exempt)
        const c = resolveCadence({ rentFrequency: 'Annually', monthlyRate: 0, resolvedTotal: 0 });
        expect(c.perPeriodAmount).toBe(0);
    });

    it('explicit Annually frequency keeps legacy behavior: one period per year at the resolved total', () => {
        const c = resolveCadence({ scFrequency: 'Annually', monthlyRate: 15000, resolvedTotal: 180000 });
        expect(c.months).toBe(12);
        expect(c.perPeriodAmount).toBe(180000);
        expect(c.explicit).toBe(true);
    });

    it('explicit Monthly frequency uses the monthly rate when defined', () => {
        const c = resolveCadence({ scFrequency: 'Monthly', monthlyRate: 20000, resolvedTotal: 240000 });
        expect(c.months).toBe(1);
        expect(c.perPeriodAmount).toBe(20000);
    });

    it('quarterly and bi-annual labels map correctly', () => {
        expect(periodMonths('Quarterly')).toBe(3);
        expect(periodMonths('Bi-Annually')).toBe(6);
        expect(periodMonths('Monthly')).toBe(1);
        expect(periodMonths('Annually')).toBe(12);
    });
});

// ─── Timeline construction ──────────────────────────────────────────────────
describe('buildTimeline — time drives the strip', () => {
    it('monthly cadence advances month-to-month from leaseStart (calendar-accurate)', () => {
        const periods = buildTimeline({
            leaseStart: '2025-11-01', cadence: monthly(10000), now: new Date('2026-03-15'),
        });
        expect(periods.map(p => p.dueDate)).toEqual([
            '2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01', '2026-03-01',
        ]);
        // each period's window ends the day before the next starts
        expect(periods[0].windowEnd).toBe('2025-11-30');
        expect(periods[2].windowEnd).toBe('2026-01-31');
    });

    it('past-window unpaid periods become OVERDUE; current window shows DUE', () => {
        const periods = buildTimeline({
            leaseStart: '2025-11-01', cadence: monthly(10000), now: NOW,
        });
        expect(periods[0].status).toBe('overdue'); // Nov, Dec, Jan windows closed
        expect(periods[1].status).toBe('overdue');
        expect(periods[2].status).toBe('overdue');
        expect(periods[4].status).toBe('due');     // Mar — inside its window
    });

    it('a period becomes overdue the day AFTER its window closes (no grace by default)', () => {
        const at = (d: string) => buildTimeline({ leaseStart: '2026-01-01', cadence: monthly(1000), now: new Date(d) });
        expect(at('2026-01-31')[0].status).toBe('due');
        expect(at('2026-02-01')[0].status).toBe('overdue');
    });

    it('graceDays delays the overdue transition', () => {
        const periods = buildTimeline({
            leaseStart: '2026-01-01', cadence: monthly(1000), now: new Date('2026-02-03'), graceDays: 5,
        });
        expect(periods[0].status).toBe('due'); // Jan closed Feb 1, grace 5d
    });

    it('records a payment and the pill turns green AUTOMATICALLY', () => {
        const periods = buildTimeline({
            leaseStart: '2025-11-01', cadence: monthly(10000),
            payments: [{ amount: 10000, paidDate: '2025-11-20', status: 'paid' }],
            now: NOW,
        });
        expect(periods[0].status).toBe('paid');
        expect(periods[0].paidOnTime).toBe(true); // paid within its window
        expect(periods[1].status).toBe('overdue'); // untouched stays red
    });

    it('payment AFTER the window closes → paid late (paidOnTime false) — explicit period fields attribute correctly', () => {
        // Collect Rent rows carry periodStart/periodEnd; a Nov charge settled
        // on Dec 5 must land on NOV as Paid Late, not on Dec's window.
        const periods = buildTimeline({
            leaseStart: '2025-11-01', cadence: monthly(10000),
            payments: [{
                amount: 10000, paidDate: '2025-12-05', status: 'paid',
                periodStart: '2025-11-01', periodEnd: '2025-11-30',
            }],
            now: NOW,
        });
        expect(periods[0].status).toBe('paid');
        expect(periods[0].paidOnTime).toBe(false);
        expect(periods[1].status).toBe('overdue');
    });

    it('bare payments (no period fields) attribute to the window they were paid in', () => {
        // A Dec-5 payment with no period metadata settles DECEMBER's window —
        // attribution follows the money's own date when nothing else is known.
        const periods = buildTimeline({
            leaseStart: '2025-11-01', cadence: monthly(10000),
            payments: [{ amount: 10000, paidDate: '2025-12-05', status: 'paid' }],
            now: NOW,
        });
        expect(periods[0].status).toBe('overdue');
        expect(periods[1].status).toBe('paid');
        expect(periods[1].paidOnTime).toBe(true);
    });

    it('partial payment keeps the period due/overdue but records paidAmount', () => {
        const periods = buildTimeline({
            leaseStart: '2026-02-01', cadence: monthly(10000),
            payments: [{ amount: 4000, paidDate: '2026-02-10', status: 'paid' }],
            now: new Date('2026-02-20'),
        });
        expect(periods[0].status).toBe('due');
        expect(periods[0].paidAmount).toBe(4000);
    });

    it('payment rows with periodStart/periodEnd (Collect Rent shape) match by overlap', () => {
        const periods = buildTimeline({
            leaseStart: '2026-01-01', cadence: monthly(10000),
            payments: [{
                amount: 10000, paidDate: '2026-01-08', status: 'paid',
                periodStart: '2026-01-01', periodEnd: '2026-01-31',
            }],
            now: new Date('2026-03-15'),
        });
        expect(periods[0].status).toBe('paid');
        expect(periods[1].status).toBe('overdue');
    });

    it('pending payments never settle a period', () => {
        const periods = buildTimeline({
            leaseStart: '2026-01-01', cadence: monthly(10000),
            payments: [{ amount: 10000, paidDate: '2026-01-08', status: 'pending' }],
            now: new Date('2026-02-15'),
        });
        expect(periods[0].status).not.toBe('paid');
    });

    it('annual cadence (explicit frequency) yields one pill per year — legacy parity', () => {
        const periods = buildTimeline({
            leaseStart: '2023-06-01', now: new Date('2026-03-15'),
            cadence: { months: 12, perPeriodAmount: 500000, frequency: 'Annually', explicit: true },
        });
        expect(periods.map(p => p.dueDate)).toEqual(['2023-06-01', '2024-06-01', '2025-06-01']);
    });

    it('missing leaseStart → empty timeline (no pills, no crash)', () => {
        expect(buildTimeline({ cadence: monthly(1000), now: NOW })).toEqual([]);
    });

    it('zero amount → empty timeline (exempt unit, 0 is a real value)', () => {
        expect(buildTimeline({ leaseStart: '2026-01-01', cadence: monthly(0), now: NOW })).toEqual([]);
    });

    it('caps at 60 periods', () => {
        const periods = buildTimeline({
            leaseStart: '2010-01-01', cadence: monthly(1000), now: NOW,
        });
        expect(periods.length).toBe(60);
    });
});

// ─── Stored overrides + legacy cadence migration ────────────────────────────
describe('buildTimeline — stored scPeriods overrides', () => {
    it('stored paid mark (matched by dueDate) is preserved with its receipt', () => {
        const periods = buildTimeline({
            leaseStart: '2025-11-01', cadence: monthly(10000), now: NOW,
            stored: [{ index: 1, dueDate: '2025-11-01', status: 'paid', paidDate: '2025-11-05', receiptNumber: 'RC-1' }],
        });
        expect(periods[0].status).toBe('paid');
        expect(periods[0].receiptNumber).toBe('RC-1');
    });

    it('LEGACY ANNUAL stored marks land on the correct month of the monthly grid (dueDate match, not index)', () => {
        // Old annual cadence: period 1 due 2025-01-01, period 2 due 2026-01-01 (year 2).
        // On the new monthly grid, index 2 is Feb — the "year 2 paid" mark MUST NOT smear there.
        const periods = buildTimeline({
            leaseStart: '2025-01-01', cadence: monthly(41666), now: new Date('2026-03-15'),
            stored: [
                { index: 1, dueDate: '2025-01-01', status: 'paid', paidDate: '2025-01-10' },
                { index: 2, dueDate: '2026-01-01', status: 'paid', paidDate: '2026-01-05' },
            ],
        });
        // Jan 2025 pill paid...
        expect(periods[0].status).toBe('paid');
        // ...Feb 2025 is NOT marked paid by the legacy index-2 row...
        expect(periods[1].status).toBe('overdue');
        // ...but Jan 2026 (grid index 13) is.
        const jan26 = periods.find(p => p.dueDate === '2026-01-01');
        expect(jan26?.status).toBe('paid');
    });

    it('stored "outstanding" (legacy red) is RE-DERIVED from time instead of freezing the strip', () => {
        const periods = buildTimeline({
            leaseStart: '2026-02-01', cadence: monthly(10000), now: new Date('2026-02-20'),
            stored: [{ index: 1, dueDate: '2026-02-01', status: 'outstanding' }],
        });
        expect(periods[0].status).toBe('due'); // in-window now shows DUE, not frozen red
    });

    it('stored advance periods beyond the elapsed head append as advance_paid', () => {
        const periods = buildTimeline({
            leaseStart: '2026-01-01', cadence: monthly(10000), now: new Date('2026-02-15'),
            stored: [
                { index: 1, dueDate: '2026-01-01', status: 'paid', paidDate: '2026-01-05' },
                { index: 4, status: 'advance_paid', paidDate: '2026-01-06', amount: 10000 },
            ],
        });
        const advance = periods.find(p => p.index === 4);
        expect(advance?.status).toBe('advance_paid');
        expect(advance?.isAdvance).toBe(true);
        expect(advance?.dueDate).toBe('2026-04-01');
    });

    it('stored rows without dueDate fall back to index matching', () => {
        const periods = buildTimeline({
            leaseStart: '2026-01-01', cadence: monthly(10000), now: new Date('2026-03-15'),
            stored: [{ index: 2, status: 'late', paidDate: '2026-02-20' }],
        });
        expect(periods[1].status).toBe('late');
        expect(periods[1].paidOnTime).toBe(false);
    });
});

// ─── Rent timeline ──────────────────────────────────────────────────────────
describe('buildRentTimeline — rent finally tracks', () => {
    it('annual rent produces yearly periods settled by recorded rentPaymentHistory rows', () => {
        const periods = buildRentTimeline({
            leaseStart: '2024-01-01', rentFrequency: 'Annually', rentAmount: 1200000,
            payments: [{ amount: 1200000, paidDate: '2024-01-15', status: 'paid', periodStart: '2024-01-01', periodEnd: '2024-12-31' }],
            now: new Date('2026-03-15'),
        });
        expect(periods.map(p => p.dueDate)).toEqual(['2024-01-01', '2025-01-01', '2026-01-01']);
        expect(periods[0].status).toBe('paid');
        expect(periods[1].status).toBe('overdue'); // 2025 window closed 2025-12-31
        expect(periods[2].status).toBe('due');     // 2026 window still open — amber, not red
    });

    it('monthly rent advances monthly and payments settle each window', () => {
        const payments = [1, 2].map(m => ({
            amount: 100000, paidDate: `2026-0${m}-10`, status: 'paid',
        }));
        const periods = buildRentTimeline({
            leaseStart: '2026-01-01', rentFrequency: 'Monthly', rentAmount: 100000,
            payments, now: new Date('2026-03-15'),
        });
        expect(periods[0].status).toBe('paid');
        expect(periods[1].status).toBe('paid');
        expect(periods[2].status).toBe('due');
    });

    it('no rentAmount → empty (nothing to track)', () => {
        expect(buildRentTimeline({ leaseStart: '2026-01-01', rentFrequency: 'Monthly', rentAmount: 0, now: NOW })).toEqual([]);
    });
});

// ─── Summaries (drive the readable chips) ───────────────────────────────────
describe('summarizeTimeline — states the chips say out loud', () => {
    it('all settled → clear with settledThrough label', () => {
        const periods = buildTimeline({
            leaseStart: '2026-01-01', cadence: monthly(10000), now: new Date('2026-03-15'),
            payments: [
                { amount: 10000, paidDate: '2026-01-05', status: 'paid' },
                { amount: 10000, paidDate: '2026-02-05', status: 'paid' },
            ],
        });
        const s = summarizeTimeline(periods, new Date('2026-03-15'));
        // Feb paid, Mar due → still due
        expect(s.state).toBe('due');
        const cleared = summarizeTimeline(periods.slice(0, 2), new Date('2026-03-15'));
        expect(cleared.state).toBe('clear');
        expect(cleared.settledThrough).toBe('Feb 2026');
    });

    it('unpaid current window → due with the amount outstanding', () => {
        const periods = buildTimeline({
            leaseStart: '2026-03-01', cadence: monthly(15000), now: new Date('2026-03-15'),
        });
        const s = summarizeTimeline(periods, new Date('2026-03-15'));
        expect(s.state).toBe('due');
        expect(s.outstandingTotal).toBe(15000);
        expect(s.currentPeriod?.dueDate).toBe('2026-03-01');
    });

    it('past-window unpaid → overdue with count and running total', () => {
        const periods = buildTimeline({
            leaseStart: '2025-12-01', cadence: monthly(10000), now: new Date('2026-03-15'),
        });
        const s = summarizeTimeline(periods, new Date('2026-03-15'));
        expect(s.state).toBe('overdue');
        expect(s.overdueCount).toBe(3); // Dec, Jan, Feb
        expect(s.dueCount).toBe(1);     // Mar
        expect(s.outstandingTotal).toBe(40000);
    });

    it('partial payments reduce the outstanding total', () => {
        const periods = buildTimeline({
            leaseStart: '2026-02-01', cadence: monthly(10000),
            payments: [{ amount: 4000, paidDate: '2026-02-10', status: 'paid' }],
            now: new Date('2026-02-20'),
        });
        const s = summarizeTimeline(periods, new Date('2026-02-20'));
        expect(s.state).toBe('due');
        expect(s.outstandingTotal).toBe(6000);
    });

    it('empty timeline → state none', () => {
        const s = summarizeTimeline([], NOW);
        expect(s.state).toBe('none');
    });
});

describe('summarizeTimeline — late is SETTLED, never "due" (the 3-late-payments report)', () => {
    // User report 2026-09-12: "why does it say that there are three cycles
    // due when it shows that they are all paid up and there are three late
    // payments. it cannot be due if they have paid; late or otherwise."
    // 'late' means PAID after its window — counting it as unsettled drew a
    // red "SC 3 MO OVERDUE" chip and inflated the outstanding balance on a
    // fully-paid unit.

    const threeLateMarks = [
        { index: 1, dueDate: '2025-12-01', status: 'late', paidDate: '2025-12-20', paidOnTime: false },
        { index: 2, dueDate: '2026-01-01', status: 'late', paidDate: '2026-01-18', paidOnTime: false },
        { index: 3, dueDate: '2026-02-01', status: 'late', paidDate: '2026-02-25', paidOnTime: false },
    ];

    it('ALL periods paid late → state clear, nothing outstanding', () => {
        const periods = buildTimeline({
            leaseStart: '2025-12-01', cadence: monthly(10000),
            stored: threeLateMarks,
            now: new Date('2026-02-28'), // Dec, Jan, Feb elapsed — all settled
        });
        const s = summarizeTimeline(periods, new Date('2026-02-28'));
        expect(s.state).toBe('clear');
        expect(s.dueCount).toBe(0);
        expect(s.overdueCount).toBe(0);
        expect(s.outstandingTotal).toBe(0);
        expect(s.currentPeriod).toBeNull();
    });

    it('settledThrough extends over late-settled periods', () => {
        const periods = buildTimeline({
            leaseStart: '2025-12-01', cadence: monthly(10000),
            stored: threeLateMarks,
            now: new Date('2026-02-28'),
        });
        const s = summarizeTimeline(periods, new Date('2026-02-28'));
        expect(s.settledThrough).toBe('Feb 2026');
    });

    it('mixed: one genuinely overdue + one new + two paid late → exact split', () => {
        const periods = buildTimeline({
            leaseStart: '2025-11-01', cadence: monthly(10000),
            stored: [
                { index: 1, dueDate: '2025-11-01', status: 'late', paidDate: '2025-11-30', paidOnTime: false },
                { index: 2, dueDate: '2025-12-01', status: 'late', paidDate: '2025-12-28', paidOnTime: false },
                // Jan left unpaid — window closed → genuinely overdue
                // Feb just landed → genuinely due
            ],
            now: new Date('2026-02-05'),
        });
        const s = summarizeTimeline(periods, new Date('2026-02-05'));
        expect(s.state).toBe('overdue');
        expect(s.overdueCount).toBe(1); // Jan only — the two LATE marks don't count
        expect(s.dueCount).toBe(1);     // Feb (new cycle, genuinely due)
        expect(s.outstandingTotal).toBe(20000); // Jan + Feb — NOT 4 cycles / 40000
        expect(s.currentPeriod?.dueDate).toBe('2026-01-01'); // oldest owed
    });

    it('payment-matched LATE settlement also reads settled (explicit period fields)', () => {
        // Nov charge settled Dec 5 — the Collect-Rent row carries
        // periodStart/periodEnd, so it attributes to Nov (paid late).
        const periods = buildTimeline({
            leaseStart: '2025-11-01', cadence: monthly(10000),
            payments: [{ amount: 10000, paidDate: '2025-12-05', periodStart: '2025-11-01', periodEnd: '2025-11-30', status: 'paid' }],
            now: new Date('2025-12-10'),
        });
        const s = summarizeTimeline(periods, new Date('2025-12-10'));
        // Nov is settled (late) — only Dec is owed.
        expect(s.state).toBe('due');           // NOT overdue: Nov is settled
        expect(s.overdueCount).toBe(0);
        expect(s.outstandingTotal).toBe(10000); // Dec only
        expect(s.settledThrough).toBe('Nov 2025');
        expect(periods[0].status).toBe('paid');
        expect(periods[0].paidOnTime).toBe(false); // amber "Paid Late" pill
    });

    it('chip math: 3 late periods yield NO overdue chip text (regression guard)', () => {
        const periods = buildTimeline({
            leaseStart: '2025-12-01', cadence: monthly(10000),
            stored: threeLateMarks,
            now: new Date('2026-02-28'),
        });
        const s = summarizeTimeline(periods, new Date('2026-02-28'));
        const chipCount = s.overdueCount + s.dueCount;
        expect(chipCount).toBe(0); // "SC 3 MO OVERDUE" can no longer render
    });
});

// ─── Minimum vend — monthly grid ────────────────────────────────────────────
describe('minimum vend — monthly grid like SC (the MV tracking report)', () => {
    // User report 2026-09-12: "minimum vend is a monthly thing as well. So
    // for some reason, it's not tracking the same way service charge
    // tracks." Root cause: the units-tab view built the MV timeline at the
    // RENT frequency (annual for most units) — one MV pill a YEAR — while
    // onboarding built it monthly. The contract: MV is MONTHLY, period.

    const mvMonthly = monthly(5000);

    it('MV produces one pill per month regardless of annual rent (view parity)', () => {
        const periods = buildTimeline({
            leaseStart: '2026-01-01', cadence: mvMonthly, now: new Date('2026-03-15'),
        });
        expect(periods.length).toBe(3); // Jan, Feb, Mar — not one pill per year
        expect(periods.every(p => p.amount === 5000)).toBe(true);
        expect(periods.map(p => p.dueDate)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    });

    it('legacy annual-step MV marks land on their own month of the monthly grid', () => {
        // Stored MV ledger written under the old rent-frequency stepping:
        // marks 12 months apart. On the monthly grid the Jan mark lands on
        // Jan; the 2027 mark simply sits in the future until time reaches it.
        const periods = buildTimeline({
            leaseStart: '2026-01-01', cadence: mvMonthly,
            stored: [
                { index: 1, dueDate: '2026-01-01', status: 'paid', paidDate: '2026-01-10' },
                { index: 2, dueDate: '2027-01-01', status: 'paid', paidDate: '2027-01-10' },
            ],
            now: new Date('2026-03-15'),
        });
        expect(periods.length).toBe(3);
        expect(periods[0].status).toBe('paid');
        expect(periods[1].status).toBe('overdue'); // Feb window closed, unpaid
        expect(periods[2].status).toBe('due');     // Mar current cycle
    });

    it('MV summary speaks monthly: 2 late-settled + current cycle unpaid → 1 due only', () => {
        const periods = buildTimeline({
            leaseStart: '2026-01-01', cadence: mvMonthly,
            stored: [
                { index: 1, dueDate: '2026-01-01', status: 'late', paidDate: '2026-01-25', paidOnTime: false },
                { index: 2, dueDate: '2026-02-01', status: 'late', paidDate: '2026-02-22', paidOnTime: false },
            ],
            now: new Date('2026-03-10'),
        });
        const s = summarizeTimeline(periods, new Date('2026-03-10'));
        expect(s.overdueCount).toBe(0);  // the two LATE marks are settled
        expect(s.dueCount).toBe(1);      // Mar (current cycle, in window)
        expect(s.outstandingTotal).toBe(5000);
    });
});

// ─── High-level convenience ─────────────────────────────────────────────────
describe('serviceChargeTimeline — one call, whole picture', () => {
    it('production shape: annual rent, monthly rate defined → monthly pills at the rate', () => {
        const { periods, cadence, summary } = serviceChargeTimeline({
            unit: {
                rentalDetails: {
                    leaseStart: '2026-01-01',
                    rentFrequency: 'Annually',
                    serviceCharge: 15000,        // "Monthly Service Charge"
                    serviceChargeAmount: 180000, // current-period total
                },
            },
            now: new Date('2026-03-15'),
        });
        expect(cadence.months).toBe(1);
        expect(periods.length).toBe(3);
        expect(periods.every(p => p.amount === 15000)).toBe(true);
        expect(summary.state).toBe('overdue'); // nothing paid yet
        expect(summary.overdueCount).toBe(2);
    });

    it('production shape: only an annual total exists → spread across 12 months', () => {
        const { periods, cadence } = serviceChargeTimeline({
            unit: {
                rentalDetails: {
                    leaseStart: '2026-01-01',
                    rentFrequency: 'Annually',
                    serviceChargeAmount: 600000,
                },
            },
            now: new Date('2026-03-15'),
        });
        expect(cadence.months).toBe(1);
        expect(periods.length).toBe(3);
        expect(periods[0].amount).toBe(50000);
    });

    it('explicit frequency is honored end-to-end', () => {
        const { periods, cadence } = serviceChargeTimeline({
            unit: {
                rentalDetails: {
                    leaseStart: '2024-06-01',
                    serviceChargeFrequency: 'Annually',
                    serviceChargeAmount: 500000,
                },
            },
            now: new Date('2026-03-15'),
        });
        expect(cadence.explicit).toBe(true);
        expect(periods.length).toBe(2); // Jun 2024, Jun 2025
        expect(periods[0].amount).toBe(500000);
    });

    it('resolved 0 (exempt unit) → empty timeline, state none', () => {
        const { periods, summary } = serviceChargeTimeline({
            unit: { rentalDetails: { leaseStart: '2026-01-01', serviceCharge: 0, serviceChargeAmount: 0 } },
            now: NOW,
        });
        expect(periods).toEqual([]);
        expect(summary.state).toBe('none');
    });

    it('monthLabel formats "Aug 2026"', () => {
        expect(monthLabel('2026-08-09')).toBe('Aug 2026');
    });
});

// ─── Advance payments — one payment, N cycles, ONE receipt ──────────────────
describe('buildAdvanceRows + advanceCoverageLabel — pay N cycles ahead', () => {
    const anchorOf = (index: number, dueDate: string): TimelinePeriod => ({
        index, dueDate, windowEnd: '2026-01-31', status: 'due',
        amount: 10000, paidAmount: 0,
    });

    it('six months in advance → 6 rows, calendar-stepped, anchor included', () => {
        const rows = buildAdvanceRows({
            anchor: anchorOf(3, '2026-03-01'),
            cycles: 6,
            cadence: monthly(10000),
            paidDate: '2026-02-20',
        });
        expect(rows).toHaveLength(6);
        expect(rows[0]).toMatchObject({ index: 3, dueDate: '2026-03-01', status: 'advance_paid', paidDate: '2026-02-20' });
        expect(rows[1].dueDate).toBe('2026-04-01');
        expect(rows[5]).toMatchObject({ index: 8, dueDate: '2026-08-01' });
        expect(rows.every(r => r.isAdvance && r.paidOnTime && r.amount === 10000)).toBe(true);
    });

    it('quarterly cadence steps cycles, not months', () => {
        const rows = buildAdvanceRows({
            anchor: anchorOf(2, '2026-04-01'),
            cycles: 3,
            cadence: { months: 3, perPeriodAmount: 500000, frequency: 'Quarterly', explicit: true },
        });
        expect(rows.map(r => r.dueDate)).toEqual(['2026-04-01', '2026-07-01', '2026-10-01']);
        expect(rows.every(r => r.amount === 500000)).toBe(true);
    });

    it('cycles are clamped to 1..12', () => {
        const rows = buildAdvanceRows({ anchor: anchorOf(1, '2026-01-01'), cycles: 40, cadence: monthly(10000) });
        expect(rows).toHaveLength(12);
        const floor = buildAdvanceRows({ anchor: anchorOf(1, '2026-01-01'), cycles: 0, cadence: monthly(10000) });
        expect(floor).toHaveLength(1);
    });

    it('coverage label speaks months on monthly cadence, cycles otherwise', () => {
        expect(advanceCoverageLabel('2026-09-01', 6, 1).label).toBe('Sep 2026 – Feb 2027 (6 months)');
        expect(advanceCoverageLabel('2026-09-01', 1, 1).label).toBe('Sep 2026 (1 month)');
        expect(advanceCoverageLabel('2026-01-01', 2, 6).label).toBe('Jan 2026 – Jul 2026 (2 cycles)');
        expect(advanceCoverageLabel('2026-09-01', 6, 1).from).toBe('Sep 2026');
        expect(advanceCoverageLabel('2026-09-01', 6, 1).to).toBe('Feb 2027');
    });

    it('round-trip: advance rows render as blue advance periods via buildTimeline', () => {
        // Anchor Sep 2026 is elapsed; the covered cycles run into the future.
        const rows = buildAdvanceRows({
            anchor: anchorOf(2, '2026-09-01'),
            cycles: 6,
            cadence: monthly(10000),
            paidDate: '2026-09-05',
        });
        const periods = buildTimeline({
            leaseStart: '2026-08-01', cadence: monthly(10000),
            stored: rows,
            now: new Date('2026-09-15'),
        });
        // Aug + Sep elapsed head; Sep override reads advance_paid; the
        // future covered cycles append as advance periods.
        expect(periods.length).toBe(1 + 6);
        expect(periods.find(p => p.dueDate === '2026-09-01')?.status).toBe('advance_paid');
        expect(periods.filter(p => p.isAdvance).length).toBeGreaterThanOrEqual(6);
        expect(periods.find(p => p.dueDate === '2027-02-01')?.status).toBe('advance_paid');
    });

    it('advance-covered cycles never count as owed in the summary', () => {
        const rows = buildAdvanceRows({
            anchor: anchorOf(1, '2026-01-01'),
            cycles: 12,
            cadence: monthly(10000),
        });
        const periods = buildTimeline({
            leaseStart: '2026-01-01', cadence: monthly(10000),
            stored: rows,
            now: new Date('2026-06-15'),
        });
        const s = summarizeTimeline(periods, new Date('2026-06-15'));
        expect(s.state).toBe('clear'); // half a year covered in advance
        expect(s.outstandingTotal).toBe(0);
    });
});
