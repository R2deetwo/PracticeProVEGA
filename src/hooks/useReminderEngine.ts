/**
 * useReminderEngine — mounts the client reminder engine inside the app.
 *
 * Mounted once from App.tsx (main user workspace — portal/founder apps are
 * out of scope). Every REMINDER_TICK_MS (and whenever events/prefs change):
 *
 *   1. FIRES due occurrences — creates the persistent in-app notification
 *      row (Convex `notifications`, type 'event_reminder') so it lands in
 *      the Notification Center with quick actions, and (web) a browser
 *      notification when permitted. On native the tray row is posted by the
 *      Header watcher for non-FCM types (same path as every other in-app
 *      notification), plus the PRE-SCHEDULED notification from (2) may
 *      already be in the shade.
 *   2. PRE-SCHEDULES device notifications for upcoming triggers (native,
 *      next 24h) so reminders reach the shade while the app is closed.
 *   3. RE-FIRES snoozed reminders whose snooze time has arrived.
 *
 * The engine is a no-op until isDataLoaded and currentUser exist, and its
 * fired-registry is namespaced per user (a shared device never cross-fires
 * another account's reminders).
 */

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useCoreState } from '../contexts/CoreContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useAuth } from '../contexts/AuthContext';
import { useDataActions } from '../contexts/DataContext';
import type { CalendarEvent, NotificationSettings, View } from '../types';
import {
    expandReminderOccurrences,
    getFiredKeys,
    markFired,
    getSnoozedReminders,
    removeSnooze,
    syncDeviceReminderSchedule,
    deviceReminderId,
    reminderCategoryEnabled,
    reminderNotificationCopy,
    showWebNotification,
    REMINDER_TICK_MS,
    REMINDER_SCHEDULE_AHEAD_MS,
    type DeviceReminderSpec,
} from '../utils/reminderEngine';

export function useReminderEngine() {
    const { coreState, isDataLoaded } = useCoreState();
    // Events live in the Execution context (executionState.events) — the
    // calendar's own source of truth.
    const { executionState } = useExecutionState();
    const { currentUser } = useAuth();
    const { addItem } = useDataActions();
    const userId = currentUser?.id;
    const firmId = currentUser?.firmId || coreState.firmDetails?.id || '';
    const prefs: NotificationSettings | undefined = currentUser?.notificationSettings;

    // Stable refs so the interval closure never goes stale but also never
    // restarts the timer on every render.
    const eventsRef = useRef<CalendarEvent[]>([]);
    const prefsRef = useRef<NotificationSettings | undefined>(undefined);
    const addItemRef = useRef(addItem);
    const readyRef = useRef(false);
    eventsRef.current = (executionState.events || []) as CalendarEvent[];
    prefsRef.current = prefs;
    addItemRef.current = addItem;
    readyRef.current = !!(isDataLoaded && userId);

    // Per-user localStorage namespace for this session's fired markers.
    const firedKeyRef = useRef<string>('');

    const userFiredKey = () => firedKeyRef.current;

    // Remap the shared registry helpers onto the per-user namespace by
    // reading/writing through the same key with a user prefix.
    const firedForUser = (): Set<string> => {
        try {
            const raw = localStorage.getItem(userFiredKey());
            return new Set(raw ? (JSON.parse(raw) as string[]) : []);
        } catch {
            return new Set();
        }
    };
    const markFiredForUser = (key: string) => {
        const set = firedForUser();
        set.add(key);
        try {
            localStorage.setItem(userFiredKey(), JSON.stringify(Array.from(set).slice(-500)));
        } catch { /* non-fatal */ }
    };

    /** Create the persistent notification row for a reminder occurrence. */
    const createReminderNotification = (
        event: CalendarEvent,
        occurStart: number,
        occurrenceKey: string,
        copy: { title: string; message: string },
    ) => {
        const link: { view: View; id: string | null; context?: any } = event.matterId
            ? { view: 'matterDetail' as View, id: event.matterId, context: { initialTab: 'tasks', eventId: event.id, occurrenceKey } }
            : { view: 'calendar' as View, id: event.id, context: { eventId: event.id, occurrenceKey, selectedDate: new Date(occurStart).toISOString() } };

        addItemRef.current('notifications', {
            userId,
            firmId,
            title: copy.title,
            message: copy.message,
            type: 'event_reminder',
            isRead: false,
            timestamp: Date.now(),
            // Schema: createdAt is nullableNumber (epoch ms) — the ISO-string
            // pattern seen in older writers predates the 2026-09-08 timestamp
            // normalization; numbers are canonical now.
            createdAt: Date.now(),
            link,
        }, 'Event Reminder').catch(err => {
            console.warn('[reminderEngine] notification write failed:', err?.message || err);
        });

        // Web: browser notification when the user opted in.
        if (!Capacitor.isNativePlatform()) {
            showWebNotification(copy.title, copy.message);
        }
    };

    useEffect(() => {
        if (!userId) return;
        firedKeyRef.current = `pp_reminder_fired_v1_${userId}`;
        // Reset the shared registry read for this user (the util module's
        // getFiredKeys is user-agnostic; the hook keeps its own namespace).
        void getFiredKeys; // (registry util kept for tooling/tests)

        let syncTimer: number | undefined;

        const runTick = () => {
            if (!readyRef.current) return;
            const now = Date.now();
            const events = eventsRef.current;
            const fired = firedForUser();
            const eventsEnabled = reminderCategoryEnabled(prefsRef.current, 'events');

            // ── 1. Fire due occurrences (incl. missed-while-closed, 24h lookback)
            const desiredDevice: DeviceReminderSpec[] = [];
            for (const event of events) {
                const occurrences = expandReminderOccurrences(event, now);
                for (const occ of occurrences) {
                    const copy = reminderNotificationCopy(event, occ.occurStart);
                    if (occ.triggerAt <= now) {
                        if (!fired.has(occ.key)) {
                            if (!eventsEnabled) continue; // category muted — skip silently
                            fired.add(occ.key);
                            markFiredForUser(occ.key);
                            createReminderNotification(event, occ.occurStart, occ.key, copy);
                        }
                    } else if (occ.triggerAt <= now + REMINDER_SCHEDULE_AHEAD_MS && eventsEnabled) {
                        // ── 2. Upcoming → pre-schedule the device notification.
                        desiredDevice.push({
                            id: deviceReminderId(occ.key),
                            triggerAt: occ.triggerAt,
                            title: copy.title,
                            body: copy.message,
                            link: event.matterId
                                ? { view: 'matterDetail', id: event.matterId, context: { initialTab: 'tasks', eventId: event.id } }
                                : { view: 'calendar', id: event.id, context: { eventId: event.id } },
                        });
                    }
                }
            }

            // ── 3. Re-fire snoozed reminders that are due.
            for (const snooze of getSnoozedReminders()) {
                if (snooze.fireAt <= now) {
                    removeSnooze(snooze.id);
                    if (eventsEnabled) {
                        addItemRef.current('notifications', {
                            userId,
                            firmId,
                            title: snooze.title,
                            message: snooze.message,
                            type: 'event_reminder',
                            isRead: false,
                            timestamp: Date.now(),
                            createdAt: Date.now(),
                            link: snooze.link,
                        }, 'Event Reminder').catch(() => { /* non-fatal */ });
                        if (!Capacitor.isNativePlatform()) {
                            showWebNotification(snooze.title, snooze.message);
                        }
                    }
                }
            }

            // ── Reconcile the native schedule (debounced to every other tick —
            // the OS round-trip is not free and the desired set rarely changes).
            if (Capacitor.isNativePlatform()) {
                if (syncTimer === undefined) {
                    syncTimer = window.setTimeout(() => {
                        syncTimer = undefined;
                        void syncDeviceReminderSchedule(desiredDevice);
                    }, 1500);
                }
            }
        };

        // Prime once data is loaded, then keep ticking.
        const interval = window.setInterval(runTick, REMINDER_TICK_MS);
        runTick();

        return () => {
            window.clearInterval(interval);
            if (syncTimer !== undefined) window.clearTimeout(syncTimer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, isDataLoaded]);

    // Re-run the first tick shortly after the events array changes identity
    // (new/edited event → schedule its device notification promptly).
    useEffect(() => {
        if (!readyRef.current) return;
        const t = window.setTimeout(() => {
            // Cheap: the main interval closure reads eventsRef; trigger a
            // synchronous device-schedule pass for the current set.
            const now = Date.now();
            const desired: DeviceReminderSpec[] = [];
            for (const event of eventsRef.current) {
                for (const occ of expandReminderOccurrences(event, now)) {
                    if (occ.triggerAt > now && occ.triggerAt <= now + REMINDER_SCHEDULE_AHEAD_MS
                        && reminderCategoryEnabled(prefsRef.current, 'events')) {
                        const copy = reminderNotificationCopy(event, occ.occurStart);
                        desired.push({
                            id: deviceReminderId(occ.key),
                            triggerAt: occ.triggerAt,
                            title: copy.title,
                            body: copy.message,
                            link: event.matterId
                                ? { view: 'matterDetail', id: event.matterId, context: { initialTab: 'tasks', eventId: event.id } }
                                : { view: 'calendar', id: event.id, context: { eventId: event.id } },
                        });
                    }
                }
            }
            void syncDeviceReminderSchedule(desired);
        }, 2000);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [executionState.events, prefs]);
}
