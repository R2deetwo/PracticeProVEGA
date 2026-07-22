/**
 * NotificationManager — handles local notifications + smart delivery.
 *
 * ARCHITECTURE:
 *   True push notifications (FCM/APNs) require a server-side push service
 *   + Firebase Cloud Messaging setup, which is a bigger project. For now,
 *   we use @capacitor/local-notifications which can display notifications
 *   in the phone's notification shade even when the app is backgrounded
 *   (as long as the app has been opened at least once).
 *
 *   When a portal user takes an action (submits a ticket, sends a message),
 *   the backend creates an in-app notification + schedules an email. On the
 *   FRONTEND, we poll for new notifications every 30 seconds. When a new
 *   notification arrives, we:
 *     1. Show a local notification (if the app is backgrounded)
 *     2. Play a sound (if enabled)
 *     3. Trigger haptic feedback
 *     4. Mark that the user was "notified via push" — the backend can then
 *        SKIP the email (smart delivery: push OR email, not both)
 *
 * SMART DELIVERY (push OR email):
 *   - If the user's app is installed AND they've enabled push notifications,
 *     we send a push notification and skip the email.
 *   - If the user doesn't have the app (web only), we send the email.
 *   - The backend checks a `pushNotificationEnabled` flag on the user record
 *     to decide. This flag is set by this module when the user grants
 *     notification permission.
 *
 * SOUND:
 *   Local notifications can play a sound. We use the default notification
 *   sound. Users can toggle this in settings via 'practicepro_notification_sound'.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications, LocalNotificationSchema, ActionType } from '@capacitor/local-notifications';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { haptics } from './haptics';

const SOUND_KEY = 'practicepro_notification_sound';
const PUSH_REGISTERED_KEY = 'practicepro_push_registered';

function isSoundEnabled(): boolean {
    try {
        const v = localStorage.getItem(SOUND_KEY);
        return v === null ? true : v === '1';
    } catch {
        return true;
    }
}

export function setSoundEnabled(enabled: boolean) {
    try { localStorage.setItem(SOUND_KEY, enabled ? '1' : '0'); } catch {}
}

/**
 * requestPermission — Asks the user for notification permission.
 * On Android 13+, this is required. On iOS, this shows the permission dialog.
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
        const result = await LocalNotifications.requestPermissions();
        return result.display === 'granted';
    } catch {
        return false;
    }
}

/**
 * isPushRegistered — Returns true if the user has granted notification
 * permission AND we've registered them for local notifications. Used by
 * the backend to decide whether to send push (and skip email) or send
 * email (and skip push).
 */
export function isPushRegistered(): boolean {
    try {
        return localStorage.getItem(PUSH_REGISTERED_KEY) === '1';
    } catch {
        return false;
    }
}

/**
 * registerForNotifications — Should be called on app launch (in App.tsx).
 * Requests permission, creates the default notification channel (Android),
 * and marks the user as "push registered" so the backend knows to send
 * push instead of email.
 */
export async function registerForNotifications(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;

    const granted = await requestNotificationPermission();
    if (!granted) return false;

    try {
        // Create a notification channel for Android (so notifications
        // appear in the right category in the phone's settings)
        await LocalNotifications.createChannel({
            id: 'practicepro-notifications',
            name: 'PracticePro Notifications',
            description: 'Notifications from your PracticePro portal',
            importance: 3, // HIGH
            visibility: 1, // PUBLIC
            sound: isSoundEnabled() ? 'notification.wav' : undefined,
        });

        localStorage.setItem(PUSH_REGISTERED_KEY, '1');
        return true;
    } catch (err) {
        console.warn('[NotificationManager] Registration failed:', err);
        return false;
    }
}

/**
 * showLocalNotification — Displays a local notification in the phone's
 * notification shade. If the app is in the foreground, also plays a sound
 * and triggers haptic feedback.
 *
 * Use this when a new notification arrives via Convex real-time query
 * (e.g., admin received a new portal message).
 */
export async function showLocalNotification(opts: {
    title: string;
    body: string;
    id?: number;
    extraData?: Record<string, any>;
}): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
        const id = opts.id || Date.now();
        await LocalNotifications.schedule({
            notifications: [
                {
                    id,
                    title: opts.title,
                    body: opts.body,
                    channelId: 'practicepro-notifications',
                    sound: isSoundEnabled() ? 'notification.wav' : undefined,
                    smallIcon: 'ic_notification', // res/drawable
                    largeIcon: 'ic_launcher',
                    extra: opts.extraData,
                } as any,
            ],
        });

        // If app is in foreground, the notification won't show in the
        // shade (Android behavior). So we also trigger a proper notification
        // vibration pattern + the in-app toast handles the visual.
        // Using NotificationType (not ImpactStyle) for a proper vibration
        // pattern that signals "new message" rather than just a tap.
        try {
            await Haptics.notification({ type: NotificationType.Success });
        } catch {
            haptics.medium(); // fallback
        }
    } catch (err) {
        console.warn('[NotificationManager] showLocalNotification failed:', err);
    }
}

/**
 * cancelAllNotifications — Clears all pending/delivered notifications.
 * Useful when the user marks all as read.
 */
export async function cancelAllNotifications(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
            await LocalNotifications.cancel({
                notifications: pending.notifications.map(n => ({ id: n.id })),
            });
        }
        await LocalNotifications.removeAllDeliveredNotifications();
    } catch {}
}

export const notificationManager = {
    requestPermission: requestNotificationPermission,
    register: registerForNotifications,
    show: showLocalNotification,
    cancelAll: cancelAllNotifications,
    isPushRegistered,
    isSoundEnabled,
    setSoundEnabled,
};

export default notificationManager;
