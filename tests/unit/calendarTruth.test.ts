/**
 * Calendar truth suite — the calendar troubleshooting round.
 *
 * Six defect families were confirmed by direct repro before fixing (see the
 * round's worklog record); this suite locks each fix in:
 *
 *  1. expandRecurringEvents starved daily series older than MAX_OCCURRENCES
 *     (366) — the fast-forward loop consumed the output budget, so a daily
 *     event created >1 year before the window NEVER rendered again.
 *  2. Monthly/yearly stepping drifted: JS setMonth() rolls Jan 31 → Feb 31 →
 *     Mar 3 and stays there. Fixed with day-of-month clamping (the SAME
 *     convention as the billing engine's computeNextBillingDate).
 *  3. computeAtriumVirtualEvents never emitted RENT DUE events (promised by
 *     CalendarView's comment since the Komplete product-aware round) and
 *     ignored embedded units — multi-unit buildings produced no lease events.
 *  4. The modal pipelines (ModalLayer/DockedModal) parsed the month-view instance date with
 *     `new Date('YYYY-MM-DD')` (UTC midnight) — east of UTC the window began
 *     at 01:00 local and the recurring-instance modal opened blank.
 *  5. Virtual events were un-clickable: they are not in executionState.events
 *     and their ids contain underscores, so the modal's '_'-split lookup
 *     failed and the detail modal opened blank.
 *  6. CalendarView's Day/diary view received the RAW events array — recurring
 *     instances never appeared in the agenda.
 *
 * Plus source contracts that pin the fixed wiring in place.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    parseDateString,
    expandRecurringEvents,
    computeAtriumVirtualEvents,
} from '../../src/utils/calendarUtils';
import type { CalendarEvent } from '../../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../src/utils/calendarUtils.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
    id: 'e1', firmId: 'f1', title: 'Event', type: 'Meeting',
    date: '2026-01-15T09:00:00.000Z', status: 'Active' as any, ...over,
});

const localDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ── parseDateString ─────────────────────────────────────────────────────────

describe('parseDateString (timezone-safe parser)', () => {
    it('parses YYYY-MM-DD as LOCAL midnight (not UTC)', () => {
        const d = parseDateString('2026-11-10');
        expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 10]);
        expect(d.getHours()).toBe(0);
        expect(d.getMinutes()).toBe(0);
    });

    it('parses full ISO strings via the native constructor', () => {
        const d = parseDateString('2026-11-10T14:30:00.000Z');
        expect(d.getTime()).toBe(new Date('2026-11-10T14:30:00.000Z').getTime());
    });

    it('falls back to now for invalid strings instead of crashing', () => {
        const before = Date.now();
        const d = parseDateString('not-a-date');
        expect(d.getTime()).toBeGreaterThanOrEqual(before);
    });
});

// ── Defect 1: daily starvation ──────────────────────────────────────────────

describe('expandRecurringEvents — long-lived series (calendar round fix)', () => {
    it('renders a DAILY series started more than a year before the window', () => {
        // date-only anchor (local midnight) keeps the assertion timezone-independent
        const old = ev({ id: 'daily', date: '2024-11-01', recurrence: { frequency: 'daily' } });
        const win = expandRecurringEvents([old], new Date(2026, 10, 9), new Date(2026, 10, 15, 23, 59, 59, 999));
        // Nov 9..15 inclusive — previously ZERO (budget exhausted while skipping)
        expect(win).toHaveLength(7);
        expect(win[0].originalId).toBe('daily');
    });

    it('renders a WEEKLY series started years before the window', () => {
        const old = ev({ id: 'weekly', date: '2020-01-06T09:00:00.000Z', recurrence: { frequency: 'weekly' } });
        const win = expandRecurringEvents([old], new Date(2026, 10, 9), new Date(2026, 10, 22));
        expect(win.length).toBeGreaterThanOrEqual(1);
        expect(win.length).toBeLessThanOrEqual(2);
    });

    it('still caps output at MAX_OCCURRENCES (366) — an infinite-loop guard, not a series killer', () => {
        const daily = ev({ id: 'cap', date: '2026-01-01', recurrence: { frequency: 'daily' } });
        const win = expandRecurringEvents([daily], new Date(2026, 0, 1), new Date(2030, 0, 1));
        expect(win.length).toBeLessThanOrEqual(366);
    });
});

// ── Defect 2: month-step clamping ───────────────────────────────────────────

describe('expandRecurringEvents — month-based stepping (calendar round fix)', () => {
    it('clamps monthly occurrences on the 31st to month-end (no Mar-3 drift)', () => {
        const m31 = ev({ id: 'm31', date: '2026-01-31', recurrence: { frequency: 'monthly' } });
        const win = expandRecurringEvents([m31], new Date(2026, 0, 1), new Date(2026, 5, 30));
        const days = win.map(i => parseDateString(i.date).getDate());
        // Jan 31, Feb 28 (2026 not a leap year), Mar 31, Apr 30, May 31, Jun 30
        expect(days).toEqual([31, 28, 31, 30, 31, 30]);
    });

    it('keeps the anchor day stable after a clamped month (Feb 28 → Mar 31)', () => {
        const m31 = ev({ id: 'm31b', date: '2026-01-31', recurrence: { frequency: 'monthly' } });
        const win = expandRecurringEvents([m31], new Date(2026, 2, 1), new Date(2026, 3, 30));
        const days = win.map(i => parseDateString(i.date).getDate());
        expect(days).toEqual([31, 30]); // March 31, April 30 — anchor did NOT become 28
    });

    it('clamps yearly Feb 29 to Feb 28 on non-leap years', () => {
        const y = ev({ id: 'leap', date: '2024-02-29', recurrence: { frequency: 'yearly' } });
        const win = expandRecurringEvents([y], new Date(2024, 0, 1), new Date(2026, 11, 31));
        const dates = win.map(i => parseDateString(i.date));
        expect(dates.map(d => localDate(d))).toEqual(['2024-02-29', '2025-02-28', '2026-02-28']);
    });

    it('supports quarterly and biannually frequencies (rent cadences)', () => {
        const q = ev({ id: 'q', date: '2026-01-31', recurrence: { frequency: 'quarterly' } });
        const winQ = expandRecurringEvents([q], new Date(2026, 0, 1), new Date(2026, 11, 31));
        expect(winQ.map(i => localDate(parseDateString(i.date)))).toEqual([
            '2026-01-31', '2026-04-30', '2026-07-31', '2026-10-31',
        ]);

        const b = ev({ id: 'b', date: '2026-03-15', recurrence: { frequency: 'biannually' } });
        const winB = expandRecurringEvents([b], new Date(2026, 0, 1), new Date(2027, 11, 31));
        expect(winB.map(i => localDate(parseDateString(i.date)))).toEqual([
            '2026-03-15', '2026-09-15', '2027-03-15', '2027-09-15',
        ]);
    });

    it('honors recurrence.endDate — the last occurrence is on or before it', () => {
        const m = ev({
            id: 'ends', date: '2026-01-15',
            recurrence: { frequency: 'monthly', endDate: '2026-03-15' },
        });
        const win = expandRecurringEvents([m], new Date(2026, 0, 1), new Date(2026, 11, 31));
        expect(win.map(i => localDate(parseDateString(i.date)))).toEqual([
            '2026-01-15', '2026-02-15', '2026-03-15',
        ]);
    });

    it('emits unique instance ids of the form `${originalId}_${localDate}`', () => {
        const w = ev({ id: 'wid', date: '2026-11-02T23:00:00.000Z', recurrence: { frequency: 'weekly' } });
        const win = expandRecurringEvents([w], new Date(2026, 10, 1), new Date(2026, 10, 30));
        for (const inst of win) {
            expect(inst.id.startsWith('wid_')).toBe(true);
            expect(inst.originalId).toBe('wid');
        }
    });
});

// ── Defects 3a/3b: virtual events — rent due + embedded units ───────────────

describe('computeAtriumVirtualEvents (calendar round: rent due + unit coverage)', () => {
    const P1 = 'p1';
    const property = (over: any = {}) => ({
        id: P1, firmId: 'f1', address: '12 Marina Rd, Lagos',
        rentalDetails: {
            rentAmount: 1_500_000, rentFrequency: 'Monthly',
            leaseStart: '2026-03-09', leaseEnd: '2027-03-08', tenantName: 'Mrs. Bello',
        },
        ...over,
    });

    it('emits the lease lifecycle events (expiry / T-30 warning / midpoint) with stable ids', () => {
        const out = computeAtriumVirtualEvents([property()]);
        const ids = out.map(v => v.id);
        expect(ids).toContain(`virtual_expiry_${P1}`);
        expect(ids).toContain(`virtual_warning_${P1}`);
        expect(ids).toContain(`virtual_midpoint_${P1}`);
    });

    it('emits a RECURRING rent-due event anchored at leaseStart, ending at leaseEnd', () => {
        const out = computeAtriumVirtualEvents([property()]);
        const rent = out.find(v => v.id === `virtual_rentdue_${P1}`);
        expect(rent).toBeDefined();
        expect(rent!.title).toContain('Rent Due');
        expect(rent!.title).toContain('Mrs. Bello'.length > 0 ? '12 Marina Rd, Lagos' : '');
        expect(rent!.recurrence?.frequency).toBe('monthly');
        expect(rent!.recurrence?.endDate).toBe('2027-03-08');
        // The anchor is the lease start, parsed as a local date
        const anchor = parseDateString(rent!.date);
        expect([anchor.getFullYear(), anchor.getMonth(), anchor.getDate()]).toEqual([2026, 2, 9]);
    });

    it('expands rent-due occurrences inside a month window at the lease cadence', () => {
        const virtuals = computeAtriumVirtualEvents([property()]);
        // November 2026: the 9th is a monthly occurrence of the Mar 9 anchor
        const nov = expandRecurringEvents(virtuals, new Date(2026, 10, 1), new Date(2026, 10, 30));
        const rentInstances = nov.filter(i => i.id.startsWith(`virtual_rentdue_${P1}`));
        expect(rentInstances.map(i => localDate(parseDateString(i.date)))).toEqual(['2026-11-09']);
    });

    it('maps Quarterly / Bi-Annually / Annually rent frequencies to the right recurrence', () => {
        const mk = (freq: string) => computeAtriumVirtualEvents([property({
            rentalDetails: {
                rentAmount: 900_000, rentFrequency: freq,
                leaseStart: '2026-01-31', leaseEnd: '2027-12-30', tenantName: 'T',
            },
        })]).find(v => v.id === `virtual_rentdue_${P1}`)!;

        expect(mk('Quarterly').recurrence!.frequency).toBe('quarterly');
        expect(mk('Bi-Annually').recurrence!.frequency).toBe('biannually');
        expect(mk('Annually').recurrence!.frequency).toBe('yearly');
        expect(mk('Monthly').recurrence!.frequency).toBe('monthly');
        expect(mk('Whatever').recurrence!.frequency).toBe('monthly'); // sane default
    });

    it('emits lease AND rent-due events for EMBEDDED units (multi-unit buildings)', () => {
        const multiUnit = {
            id: 'p2', firmId: 'f1', address: '4 Allen Avenue, Ikeja',
            rentalDetails: {},
            units: [
                { id: 'u1', unitName: 'Flat 1', tenantName: 'Mr. Ade', rentAmount: 800_000, rentFrequency: 'Monthly', leaseStart: '2026-05-12', leaseEnd: '2027-05-11' },
                { id: 'u2', unitName: 'Flat 2', tenantName: 'Ms. Chidi', rentAmount: 900_000, rentFrequency: 'Quarterly', leaseStart: '2026-06-01', leaseEnd: '2027-05-31' },
                { id: 'u3', unitName: 'Flat 3' }, // vacant — no lease, no tenant
            ],
        };
        const out = computeAtriumVirtualEvents([multiUnit]);
        const ids = out.map(v => v.id);

        // Lease events per unit
        expect(ids).toContain('virtual_expiry_p2_u1');
        expect(ids).toContain('virtual_expiry_p2_u2');
        expect(out.find(v => v.id === 'virtual_expiry_p2_u1')!.title).toContain('Flat 1');

        // Rent-due per TENANTED unit only
        expect(ids).toContain('virtual_rentdue_p2_u1');
        expect(ids).toContain('virtual_rentdue_p2_u2');
        expect(ids).not.toContain('virtual_rentdue_p2_u3');

        // No property-level events: no property rentalDetails
        expect(ids).not.toContain('virtual_expiry_p2');
        expect(ids).not.toContain('virtual_rentdue_p2');
    });

    it('reads unit lease data from a nested rentalDetails when present', () => {
        const nested = {
            id: 'p3', firmId: 'f1', address: '5 Adeniyi Jones',
            units: [{ id: 'u9', rentalDetails: { tenantName: 'Nested Tenant', rentAmount: 500_000, rentFrequency: 'Annually', leaseStart: '2026-02-01', leaseEnd: '2027-01-31' } }],
        };
        const out = computeAtriumVirtualEvents([nested]);
        expect(out.map(v => v.id)).toContain('virtual_rentdue_p3_u9');
        expect(out.map(v => v.id)).toContain('virtual_expiry_p3_u9');
    });

    it('skips rent-due when the tenancy has no rent amount or no anchor date', () => {
        const noRent = property({ rentalDetails: { tenantName: 'T', leaseStart: '2026-01-01', leaseEnd: '2026-12-31', rentAmount: 0, rentFrequency: 'Monthly' } });
        const noAnchor = property({ rentalDetails: { tenantName: 'T', rentAmount: 500_000, rentFrequency: 'Monthly', leaseEnd: '2026-12-31' } });
        const out = [...computeAtriumVirtualEvents([noRent]), ...computeAtriumVirtualEvents([noAnchor])];
        expect(out.some(v => v.id.startsWith('virtual_rentdue'))).toBe(false);
        // Lease events still appear (they only need leaseEnd)
        expect(out.some(v => v.id === `virtual_expiry_${P1}`)).toBe(true);
    });

    it('keeps every virtual event marked source=atrium_auto (read-only in the UI)', () => {
        const out = computeAtriumVirtualEvents([property(), {
            id: 'p4', firmId: 'f1', address: 'X', units: [{ id: 'u1', unitName: 'A', tenantName: 'T', rentAmount: 1, rentFrequency: 'Monthly', leaseStart: '2026-01-01', leaseEnd: '2026-12-31' }],
        }]);
        expect(out.length).toBeGreaterThan(0);
        for (const v of out) expect((v as any).source).toBe('atrium_auto');
    });
});

// ── Defects 4/5/6: source contracts (wiring pins) ───────────────────────────

describe('calendar wiring — source contracts', () => {
    // UX-01: ModalLayer absorbed ModalManager's switch verbatim.
    const modalManager = read('src/overlays/layers/ModalLayer.tsx');
    const dockedModal = read('src/components/modals/DockedModal.tsx');
    const calendarView = read('src/components/CalendarView.tsx');
    const eventDetailModal = read('src/components/details/EventDetailModal.tsx');

    it('both modal managers resolve virtual events (they are not in executionState.events)', () => {
        for (const src of [modalManager, dockedModal]) {
            expect(src).toContain("editingId.startsWith('virtual_')");
            expect(src).toContain('computeAtriumVirtualEvents');
        }
    });

    it('both modal managers parse the instance date with parseDateString (not UTC new Date)', () => {
        for (const src of [modalManager, dockedModal]) {
            const m = src.match(/const dateInstanceStr[\s\S]{0,400}?const instanceDate = ([^;]+);/);
            expect(m).not.toBeNull();
            expect(m![1]).toContain('parseDateString(');
            expect(m![1]).not.toMatch(/new Date\(/);
        }
    });

    it('both modal managers pass readOnly for auto-generated events', () => {
        for (const src of [modalManager, dockedModal]) {
            expect(src).toContain("source === 'atrium_auto'");
            expect(src).toContain('readOnly={isVirtualEvent}');
        }
    });

    it('EventDetailModal hides Edit/Delete/Assign in readOnly mode', () => {
        expect(eventDetailModal).toContain('readOnly?: boolean');
        expect(eventDetailModal).toContain('{!readOnly && (');
        expect(eventDetailModal).toContain('Auto-generated from lease data');
    });

    it('CalendarView feeds the Day/diary view EXPANDED events (recurring instances included)', () => {
        const m = calendarView.match(/<DiaryModeView[\s\S]{0,300}?events=\{([^}]+)\}/);
        expect(m).not.toBeNull();
        expect(m![1]).toBe('diaryEvents');
        // ...and the diaryEvents memo exists and expands
        expect(calendarView).toContain('const diaryEvents = useMemo(');
    });

    it('CalendarView keeps the month-view expansion (regression guard)', () => {
        expect(calendarView).toContain('return expandRecurringEvents(events, startExpansion, endExpansion);');
    });

    it('CalendarView syncs selectedDate when switching away from month view', () => {
        expect(calendarView).toContain("if (localViewMode === 'month' && mode !== 'month')");
    });
});
