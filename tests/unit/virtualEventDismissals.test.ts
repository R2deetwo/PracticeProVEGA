// @vitest-environment jsdom
/**
 * virtualEventDismissals — the "get rid of the lease expiry reminder" model
 * (owner brief 2026-11-24). Locks the semantics:
 *   • single events hide under their id + exact date;
 *   • a renewed lease (new date, same id) re-surfaces automatically;
 *   • recurring rent-due series hide as a WHOLE series keyed to the lease
 *     end — moving the lease end re-surfaces the series;
 *   • a corrupted store never crashes the calendar render.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    dismissVirtualEvent,
    isVirtualEventDismissed,
    clearVirtualEventDismissals,
    filterDismissedVirtualEvents,
} from '../../src/utils/virtualEventDismissals';

const FIRM = 'firm-1';

const single = (dateISO: string) => ({
    id: 'virtual_expiry_prop1',
    firmId: FIRM,
    date: `${dateISO}T00:00:00.000Z`,
});

const seriesInstance = (leaseEndISO: string, instanceISO: string) => ({
    id: 'virtual_rentdue_prop1_2026-01-05',
    originalId: 'virtual_rentdue_prop1',
    firmId: FIRM,
    date: `${instanceISO}T00:00:00.000Z`,
    recurrence: { frequency: 'monthly', endDate: leaseEndISO },
});

describe('virtualEventDismissals', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('a dismissal hides the single event', () => {
        const e = single('2027-03-12');
        dismissVirtualEvent(e);
        expect(isVirtualEventDismissed(e)).toBe(true);
    });

    it('a RENEWED lease (same id, new date) re-surfaces', () => {
        dismissVirtualEvent(single('2027-03-12'));
        // Lease renewed — the same virtual id now points at a new expiry.
        expect(isVirtualEventDismissed(single('2029-03-12'))).toBe(false);
    });

    it('a dismissal hides the WHOLE recurring rent series', () => {
        const inst = seriesInstance('2027-03-12', '2026-02-05');
        dismissVirtualEvent(inst);
        // Any other instance of the same series is hidden too.
        const otherInstance = seriesInstance('2027-03-12', '2026-04-05');
        expect(isVirtualEventDismissed(otherInstance)).toBe(true);
    });

    it('moving the lease end re-surfaces the series', () => {
        const inst = seriesInstance('2027-03-12', '2026-02-05');
        dismissVirtualEvent(inst);
        // Renewed lease: series end moves.
        const renewed = seriesInstance('2029-03-12', '2026-02-05');
        expect(isVirtualEventDismissed(renewed)).toBe(false);
    });

    it('filterDismissedVirtualEvents drops hidden events and keeps others', () => {
        const a = single('2027-03-12');
        const b = single('2029-06-01');
        dismissVirtualEvent(a);
        const visible = filterDismissedVirtualEvents([a, b]);
        expect(visible.map((v) => v.id)).toEqual([b.id]);
    });

    it('dismissals are firm-scoped', () => {
        const e = single('2027-03-12');
        dismissVirtualEvent(e);
        const otherFirm = { ...e, firmId: 'firm-2' };
        expect(isVirtualEventDismissed(otherFirm)).toBe(false);
    });

    it('clearVirtualEventDismissals restores everything', () => {
        dismissVirtualEvent(single('2027-03-12'));
        clearVirtualEventDismissals(FIRM);
        expect(isVirtualEventDismissed(single('2027-03-12'))).toBe(false);
    });

    it('a corrupted store never crashes (guards degrade to visible)', () => {
        localStorage.setItem('practicepro_virtual_event_dismissals_v1', 'not-json{{{');
        expect(isVirtualEventDismissed(single('2027-03-12'))).toBe(false);
        expect(() => dismissVirtualEvent(single('2027-03-12'))).not.toThrow();
    });

    it('an open-ended series dismissal holds until the lease gains an end date', () => {
        const open = { ...seriesInstance('', '2026-02-05'), recurrence: { frequency: 'monthly' } as any };
        dismissVirtualEvent(open);
        expect(isVirtualEventDismissed(open)).toBe(true);
        // Once an end date appears, the anchor changes → visible again.
        const bounded = seriesInstance('2027-03-12', '2026-02-05');
        expect(isVirtualEventDismissed(bounded)).toBe(false);
    });
});
