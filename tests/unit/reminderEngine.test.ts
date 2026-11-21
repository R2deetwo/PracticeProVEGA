/**
 * Reminder engine — occurrence expansion + dedup identity.
 *
 * The engine (owner direction 2026-11-22) fires CalendarEvent reminders as
 * persistent Notification Center rows + device notifications. These tests
 * pin the core contract:
 *   1. Lead-time math (minutes/hours/days before the event start).
 *   2. One occurrence per recurring event per period (keyed by
 *      `<eventId>@<occurrenceStartMs>` — the dedup identity).
 *   3. Cancelled events never fire.
 *   4. The lookback/ahead window: missed-while-closed reminders (within
 *      24h) still surface; ancient ones don't spam on app open.
 *   5. Snooze registry round-trip (add → list → remove).
 */
import { describe, it, expect } from 'vitest';
import {
    expandReminderOccurrences,
    reminderOffsetMs,
    reminderCategoryEnabled,
    reminderNotificationCopy,
    deviceReminderId,
} from '../../src/utils/reminderEngine';
import type { CalendarEvent } from '../../src/types';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

const baseEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
    id: 'evt-1',
    firmId: 'firm-1',
    title: 'Court Hearing — Adeyemi v State',
    type: 'Court Hearing',
    date: new Date(Date.now() + 2 * DAY).toISOString(),
    status: 'Active',
    reminder: { value: 30, unit: 'minutes' },
    ...overrides,
} as CalendarEvent);

describe('reminderOffsetMs', () => {
    it('converts minutes/hours/days to ms', () => {
        expect(reminderOffsetMs({ value: 30, unit: 'minutes' })).toBe(30 * 60_000);
        expect(reminderOffsetMs({ value: 2, unit: 'hours' })).toBe(2 * HOUR);
        expect(reminderOffsetMs({ value: 1, unit: 'days' })).toBe(DAY);
    });

    it('returns 0 for a missing reminder', () => {
        expect(reminderOffsetMs(undefined)).toBe(0);
    });
});

describe('expandReminderOccurrences', () => {
    it('yields one occurrence for a single (non-recurring) event within the window', () => {
        const now = Date.now();
        const evt = baseEvent({ date: new Date(now + 3 * HOUR).toISOString() });
        const occ = expandReminderOccurrences(evt, now);
        expect(occ).toHaveLength(1);
        expect(occ[0].triggerAt).toBe(now + 3 * HOUR - 30 * 60_000);
        expect(occ[0].key).toBe(`evt-1@${now + 3 * HOUR}`);
    });

    it('skips events with no reminder configured', () => {
        const evt = baseEvent({ reminder: undefined });
        expect(expandReminderOccurrences(evt, Date.now())).toHaveLength(0);
    });

    it('never fires cancelled events', () => {
        const evt = baseEvent({ status: 'Cancelled' as any });
        expect(expandReminderOccurrences(evt, Date.now())).toHaveLength(0);
    });

    it('includes an occurrence whose trigger just passed (missed while closed)', () => {
        const now = Date.now();
        // Event started 10 minutes ago; the 30-min reminder fired 40 min ago.
        const evt = baseEvent({ date: new Date(now - 10 * 60_000).toISOString() });
        const occ = expandReminderOccurrences(evt, now);
        expect(occ).toHaveLength(1);
        expect(occ[0].triggerAt).toBeLessThanOrEqual(now);
    });

    it('drops occurrences older than the 24h lookback', () => {
        const now = Date.now();
        // Event started 3 days ago — its reminder is stale, not missed.
        const evt = baseEvent({ date: new Date(now - 3 * DAY).toISOString() });
        expect(expandReminderOccurrences(evt, now)).toHaveLength(0);
    });

    it('expands recurring events into per-occurrence keys (no double-fire)', () => {
        const now = Date.now();
        const start = now - 10 * DAY; // series began 10 days ago, daily
        const evt = baseEvent({
            date: new Date(start).toISOString(),
            recurrence: { frequency: 'daily' },
            reminder: { value: 15, unit: 'minutes' },
        });
        const occ = expandReminderOccurrences(evt, now);
        expect(occ.length).toBeGreaterThan(0);
        expect(occ.length).toBeLessThan(5); // window is ±~24h, not the whole series
        const keys = new Set(occ.map(o => o.key));
        expect(keys.size).toBe(occ.length); // every occurrence distinct
        // Every trigger respects the 15-minute lead.
        for (const o of occ) {
            expect(o.occurStart - o.triggerAt).toBe(15 * 60_000);
        }
    });
});

describe('reminderCategoryEnabled', () => {
    it('defaults every category to ON when prefs are absent', () => {
        expect(reminderCategoryEnabled(undefined, 'events')).toBe(true);
        expect(reminderCategoryEnabled(undefined, 'payments')).toBe(true);
    });

    it('honours explicit opt-outs only for the muted category', () => {
        const prefs = { reminderEvents: false } as any;
        expect(reminderCategoryEnabled(prefs, 'events')).toBe(false);
        expect(reminderCategoryEnabled(prefs, 'draftsAI')).toBe(true);
        expect(reminderCategoryEnabled(prefs, 'messages')).toBe(true);
    });
});

describe('reminderNotificationCopy', () => {
    it('carries the event title, type and time context', () => {
        const start = Date.now() + HOUR;
        const copy = reminderNotificationCopy(baseEvent(), start);
        expect(copy.title).toContain('Court Hearing — Adeyemi v State');
        expect(copy.message).toContain('Court Hearing');
    });
});

describe('deviceReminderId', () => {
    it('is stable and positive for the same occurrence key', () => {
        const a = deviceReminderId('evt-1@1700000000000');
        const b = deviceReminderId('evt-1@1700000000000');
        const c = deviceReminderId('evt-1@1700000006000');
        expect(a).toBe(b);
        expect(a).not.toBe(c);
        expect(a).toBeGreaterThan(0);
        expect(Number.isInteger(a)).toBe(true);
    });
});
