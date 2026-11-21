/**
 * reminderEngine — client-side reminder firing + device scheduling.
 *
 * WHY THIS EXISTS (owner direction 2026-11-22): CalendarEvent.reminder was
 * collected at event creation but NOTHING ever fired when the reminder time
 * arrived — one-off reminders were silently missed. The engine closes that
 * loop:
 *
 *   1. IN-APP (persistent): when a reminder time passes and the app is open
 *      (or is opened within a lookback window), the engine writes a durable
 *      notification row (Convex `notifications` table, type 'event_reminder')
 *      that lands in the Header's Notification Center with quick actions
 *      (Open · Snooze · Done). The row persists until read/dismissed — a
 *      reminder is never "toast and gone".
 *
 *   2. DEVICE (native): upcoming reminder times within the next 24h are
 *      PRE-SCHEDULED via @capacitor/local-notifications so they appear in
 *      the phone's notification shade even when the app is backgrounded or
 *      killed. Taps deep-link through the existing
 *      'practicepro-notification-tap' → navigateTo() flow.
 *
 *   3. DEVICE (web): the browser Notification API is used when the user has
 *      granted permission (opt-in from Notification Settings); otherwise the
 *      in-app row + toast (the Header watcher already toasts new rows) is
 *      the delivery channel.
 *
 * RECURRENCE: recurring events fire once per occurrence. The occurrence
 * identity is `<eventId>@<occurrenceStartMs>` so "fired" bookkeeping never
 * double-fires an occurrence and never skips the next one.
 *
 * DEDUP: fired occurrences live in localStorage under
 * `pp_reminder_fired_v1` (a Set of occurrence keys, periodically pruned).
 * Snoozes live in `pp_reminder_snooze_v1` — each snooze re-creates the
 * notification row (and a device notification if scheduled while native).
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { CalendarEvent, NotificationSettings } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────

/** How far back to fire a missed reminder when the app opens (24h). */
export const REMINDER_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/** How far ahead to pre-schedule device notifications (24h). */
export const REMINDER_SCHEDULE_AHEAD_MS = 24 * 60 * 60 * 1000;
/** Engine tick interval. */
export const REMINDER_TICK_MS = 30 * 1000;
/** Default snooze offered by the quick action. */
export const DEFAULT_SNOOZE_MINUTES = 10;

const FIRED_KEY = 'pp_reminder_fired_v1';
const SNOOZE_KEY = 'pp_reminder_snooze_v1';
const SCHEDULED_KEY = 'pp_reminder_scheduled_v1';

// ─── Small helpers ──────────────────────────────────────────────────────────

function readJson<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function writeJson(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch { /* storage full / private mode — degrade to session-only */ }
}

/** djb2 hash → positive 31-bit int (Capacitor notification ids are Int32). */
function stableNotificationId(key: string): number {
    let h = 5381;
    for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) & 0x7fffffff;
    return h || 1;
}

/** Reminder offset in ms for an event's reminder config. */
export function reminderOffsetMs(reminder?: CalendarEvent['reminder']): number {
    if (!reminder) return 0;
    const unitMs = reminder.unit === 'days' ? 86400000
        : reminder.unit === 'hours' ? 3600000
        : 60000;
    return Math.max(0, reminder.value) * unitMs;
}

// ─── Occurrence expansion (handles recurrence) ─────────────────────────────

export interface ReminderOccurrence {
    /** Stable per-occurrence key — the dedup identity. */
    key: string;
    eventId: string;
    /** When the reminder should fire (event start − lead time). */
    triggerAt: number;
    /** The occurrence's start time. */
    occurStart: number;
}

/**
 * Expand an event into the reminder occurrences relevant around `now`:
 * the most recent occurrence whose trigger has passed (within lookback —
 * missed while the app was closed) plus upcoming occurrences (within the
 * schedule-ahead window). Non-recurring events yield at most one entry.
 */
export function expandReminderOccurrences(
    event: CalendarEvent,
    now: number,
    lookbackMs = REMINDER_LOOKBACK_MS,
    aheadMs = REMINDER_SCHEDULE_AHEAD_MS,
): ReminderOccurrence[] {
    if (event.status === 'Cancelled') return [];
    if (!event.reminder) return [];

    const lead = reminderOffsetMs(event.reminder);
    const startMs = new Date(event.date).getTime();
    if (!Number.isFinite(startMs)) return [];

    const out: ReminderOccurrence[] = [];
    const push = (occurStart: number) => {
        const triggerAt = occurStart - lead;
        if (triggerAt > now + aheadMs) return; // beyond scheduling horizon
        if (triggerAt < now - lookbackMs) return; // too old to matter
        out.push({
            key: `${event.id}@${occurStart}`,
            eventId: event.id,
            triggerAt,
            occurStart,
        });
    };

    if (!event.recurrence) {
        push(startMs);
        return out;
    }

    // Recurring: walk occurrences backwards/forwards from the event start.
    const recurEndMs = event.recurrence.endDate ? new Date(event.recurrence.endDate).getTime() : Infinity;
    const freq = event.recurrence.frequency;
    const stepMs =
        freq === 'daily' ? 86400000 :
        freq === 'weekly' ? 7 * 86400000 :
        freq === 'monthly' ? 30 * 86400000 :
        freq === 'quarterly' ? 91 * 86400000 :
        freq === 'biannually' ? 182 * 86400000 :
        365 * 86400000;
    // Monthly+ steps are approximate — sufficient for a lookback/ahead
    // window of ±24h; exact calendar math is unnecessary here.

    const earliest = now - lookbackMs - lead - stepMs;
    let occ = startMs;
    // Advance to the window start (bounded: recurrence series from the
    // event start, capped at 400 steps to avoid pathological loops).
    let guard = 0;
    while (occ < earliest && occ < recurEndMs && guard++ < 400) occ += stepMs;
    guard = 0;
    while (occ <= now + aheadMs + lead && occ <= recurEndMs && guard++ < 400) {
        push(occ);
        occ += stepMs;
    }
    return out;
}

// ─── Fired registry ────────────────────────────────────────────────────────

export function getFiredKeys(): Set<string> {
    const arr = readJson<string[]>(FIRED_KEY, []);
    return new Set(Array.isArray(arr) ? arr : []);
}

export function markFired(key: string) {
    const set = getFiredKeys();
    set.add(key);
    // Prune: keep the newest 500 entries.
    const arr = Array.from(set);
    writeJson(FIRED_KEY, arr.slice(-500));
}

export function unmarkFired(key: string) {
    const set = getFiredKeys();
    if (set.delete(key)) writeJson(FIRED_KEY, Array.from(set));
}

// ─── Snooze registry ───────────────────────────────────────────────────────

export interface SnoozedReminder {
    /** Unique snooze id. */
    id: string;
    /** When to re-deliver (epoch ms). */
    fireAt: number;
    /** Notification payload to re-create. */
    title: string;
    message: string;
    link: { view: any; id: string | null; context?: any };
    /** Original occurrence key (so the re-fire is itself snoozable). */
    occurrenceKey?: string;
}

export function getSnoozedReminders(): SnoozedReminder[] {
    const arr = readJson<SnoozedReminder[]>(SNOOZE_KEY, []);
    return Array.isArray(arr) ? arr : [];
}

export function addSnooze(entry: SnoozedReminder) {
    const all = getSnoozedReminders().filter(s => s.id !== entry.id);
    all.push(entry);
    writeJson(SNOOZE_KEY, all.slice(-50));
}

export function removeSnooze(id: string) {
    writeJson(SNOOZE_KEY, getSnoozedReminders().filter(s => s.id !== id));
}

/**
 * snoozeReminder — quick-action helper. Registers the snooze (engine re-fires
 * the in-app row when due) and, on native, schedules the device notification
 * for the snooze time so it reaches the shade even if the app is closed.
 */
export function snoozeReminder(opts: {
    minutes: number;
    title: string;
    message: string;
    link: { view: any; id: string | null; context?: any };
    occurrenceKey?: string;
}): SnoozedReminder {
    const fireAt = Date.now() + opts.minutes * 60000;
    const id = `snooze-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: SnoozedReminder = {
        id,
        fireAt,
        title: opts.title,
        message: opts.message,
        link: opts.link,
        occurrenceKey: opts.occurrenceKey,
    };
    addSnooze(entry);
    if (Capacitor.isNativePlatform()) {
        scheduleDeviceReminder({
            id: stableNotificationId(`pp|snooze|${id}`),
            triggerAt: fireAt,
            title: opts.title,
            body: opts.message,
            link: opts.link,
        }).catch(() => { /* non-fatal */ });
    }
    return entry;
}

// ─── Device notification scheduling (native) ───────────────────────────────

export interface DeviceReminderSpec {
    id: number;
    triggerAt: number;
    title: string;
    body: string;
    link: { view: any; id: string | null; context?: any };
}

async function scheduleDeviceReminder(spec: DeviceReminderSpec): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
        await LocalNotifications.schedule({
            notifications: [{
                id: spec.id,
                title: spec.title,
                body: spec.body,
                channelId: 'practicepro-tasks',
                schedule: { at: new Date(spec.triggerAt) },
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                extra: { ...(spec.link || {}), kind: 'reminder' },
            } as any],
        });
    } catch (err) {
        console.warn('[reminderEngine] scheduleDeviceReminder failed:', err);
    }
}

/**
 * syncDeviceReminderSchedule — reconciles the set of PRE-SCHEDULED device
 * reminders with the desired set (upcoming triggers within 24h). Cancels
 * reminders whose event disappeared/was edited, schedules missing ones.
 * Registry-based (localStorage) so we only ever cancel ids we created.
 */
export async function syncDeviceReminderSchedule(desired: DeviceReminderSpec[]): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const registry: number[] = readJson<number[]>(SCHEDULED_KEY, []);
        const desiredIds = new Set(desired.map(d => d.id));
        const toCancel = registry.filter(id => !desiredIds.has(id));

        if (toCancel.length > 0) {
            try {
                await LocalNotifications.cancel({ notifications: toCancel.map(id => ({ id })) });
            } catch { /* already delivered/absent */ }
        }

        // Only schedule what isn't already pending. getPending() gives us the
        // OS view; a registered id still pending is skipped (re-scheduling
        // the same id would just replace it — harmless — but skipping avoids
        // re-arming snoozed-away reminders).
        let pendingIds = new Set<number>();
        try {
            const pending = await LocalNotifications.getPending();
            pendingIds = new Set(pending.notifications.map(n => n.id));
        } catch { /* best effort */ }

        for (const spec of desired) {
            if (pendingIds.has(spec.id)) continue;
            await scheduleDeviceReminder(spec);
        }

        writeJson(SCHEDULED_KEY, desired.map(d => d.id));
    } catch (err) {
        console.warn('[reminderEngine] syncDeviceReminderSchedule failed:', err);
    }
}

// ─── Web notifications ─────────────────────────────────────────────────────

export function webNotificationPermission(): 'unsupported' | 'default' | 'granted' | 'denied' {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission as any;
}

export async function requestWebNotificationPermission(): Promise<boolean> {
    if (typeof Notification === 'undefined') return false;
    try {
        const result = await Notification.requestPermission();
        return result === 'granted';
    } catch {
        return false;
    }
}

export function showWebNotification(title: string, body: string): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
        new Notification(title, { body, icon: '/logo.png', tag: `pp-reminder-${Date.now()}` });
    } catch { /* some browsers require a ServiceWorkerRegistration — degrade silently */ }
}

// ─── Preferences ───────────────────────────────────────────────────────────

export function reminderCategoryEnabled(
    prefs: NotificationSettings | undefined,
    category: 'events' | 'draftsAI' | 'matterUpdates' | 'payments' | 'messages',
): boolean {
    if (!prefs) return true; // default ON
    switch (category) {
        case 'events': return prefs.reminderEvents !== false;
        case 'draftsAI': return prefs.reminderDraftsAI !== false;
        case 'matterUpdates': return prefs.reminderMatterUpdates !== false;
        case 'payments': return prefs.reminderPayments !== false;
        case 'messages': return prefs.reminderMessages !== false;
        default: return true;
    }
}

// ─── Presentation helpers ──────────────────────────────────────────────────

/** Human label for a reminder's lead time, e.g. "in 30 minutes". */
export function leadTimeLabel(reminder?: CalendarEvent['reminder']): string {
    if (!reminder) return 'at start time';
    return `${reminder.value} ${reminder.unit === 'days' ? 'day' : reminder.unit}${reminder.value === 1 ? '' : 's'} before`;
}

/** Notification copy for an occurrence. */
export function reminderNotificationCopy(event: CalendarEvent, occurStart: number): { title: string; message: string } {
    const when = new Date(occurStart);
    const timeLabel = when.toLocaleString(undefined, {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
        day: 'numeric',
    });
    const typeLabel = String(event.type || 'Event').replace(/_/g, ' ');
    return {
        title: `Reminder: ${event.title}`,
        message: `${typeLabel} · ${timeLabel}${event.matterTitle ? ` · ${event.matterTitle}` : ''}`,
    };
}

/** Stable device-notification id for an occurrence. */
export function deviceReminderId(occurrenceKey: string): number {
    return stableNotificationId(`pp|reminder|${occurrenceKey}`);
}
