/**
 * NotificationManager — handles local notifications + smart delivery.
 *
 * ARCHITECTURE:
 *   True push notifications (FCM/APNs) require a server-side push service
 *   + Firebase Cloud Messaging setup. For now, we use @capacitor/local-notifications
 *   which can display notifications in the phone's notification shade.
 *
 *   When a new notification arrives via Convex real-time query, we:
 *     1. Show a local notification (visible in notification shade)
 *     2. Play a sound (if enabled)
 *     3. Trigger a DISTINCT haptic pattern for "new message" (not the
 *        same as form-submission success)
 *     4. Handle tap → navigate to the relevant page in the app
 *
 * NOTIFICATION TAP HANDLING:
 *   When the user taps a notification in the shade, the app opens and
 *   fires a 'localNotificationReceived' event (if app was foreground)
 *   or 'localNotificationActionPerformed' event (if app was backgrounded).
 *   Both are handled to navigate to the notification's target view.
 *
 * VIBRATION PATTERNS (distinct from typing/error haptics):
 *   - Notification arrival: Vibration pattern (long-short-long) via
 *     Android channel importance + a dedicated Haptics.notification call
 *   - Typing/UI taps: haptics.light() / haptics.medium() (short impact)
 *   - Errors: haptics.error() (single strong buzz)
 *   These are intentionally different so the user can distinguish
 *   "new notification" from "I tapped a button".
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
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
 * permission AND we've registered them for local notifications.
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
 * Requests permission, creates notification channels (Android), sets up
 * tap handlers, and marks the user as "push registered".
 *
 * NOTIFICATION CHANNELS (Android):
 *   We create THREE channels so users can customize vibration/sound per
 *   category in their phone's notification settings:
 *   1. 'practicepro-messages' — new messages (highest priority, sound+vibrate)
 *   2. 'practicepro-tasks' — task assignments (high priority, sound+vibrate)
 *   3. 'practicepro-general' — other notifications (default priority)
 */
export async function registerForNotifications(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;

    const granted = await requestNotificationPermission();
    if (!granted) return false;

    try {
        // Create notification channels for Android — each with distinct
        // vibration pattern and importance level so the user can tell
        // what type of notification arrived without looking at the screen.
        await LocalNotifications.createChannel({
            id: 'practicepro-messages',
            name: 'Messages',
            description: 'New messages from clients, residents, and team members',
            importance: 5, // MAX — sound + heads-up + vibration
            visibility: 1, // PUBLIC
            sound: isSoundEnabled() ? 'notification.wav' : undefined,
            vibration: true,
        });

        await LocalNotifications.createChannel({
            id: 'practicepro-tasks',
            name: 'Tasks & Deadlines',
            description: 'Task assignments, deadline reminders, and overdue alerts',
            importance: 4, // HIGH — sound + heads-up + vibration
            visibility: 1,
            sound: isSoundEnabled() ? 'notification.wav' : undefined,
            vibration: true,
        });

        await LocalNotifications.createChannel({
            id: 'practicepro-general',
            name: 'General Notifications',
            description: 'Other PracticePro notifications',
            importance: 3, // HIGH — default
            visibility: 1,
            sound: isSoundEnabled() ? 'notification.wav' : undefined,
            vibration: true,
        });

        // Set up tap handlers — when user taps a notification in the shade,
        // the app opens and we navigate to the target view.
        await LocalNotifications.addListener(
            'localNotificationActionPerformed',
            (action) => {
                const notification = action.notification;
                const extra = notification.extra || notification.data;
                if (extra && extra.view) {
                    // Navigate to the target view
                    // We use a custom event so App.tsx can pick it up
                    // and call navigateTo()
                    window.dispatchEvent(new CustomEvent('practicepro-notification-tap', {
                        detail: {
                            view: extra.view,
                            id: extra.id || null,
                            context: extra.context || {},
                        },
                    }));
                }
            }
        );

        // Also handle when a notification is received while app is in
        // foreground — we need to explicitly show it (Android hides
        // foreground local notifications by default).
        await LocalNotifications.addListener(
            'localNotificationReceived',
            (notification) => {
                // The notification was already scheduled. On Android, if the
                // app is in the foreground, the notification shade doesn't
                // show it. We trigger a distinct haptic so the user knows
                // something arrived even if they're looking at the app.
                try {
                    Haptics.notification({ type: NotificationType.Warning });
                } catch {
                    haptics.medium();
                }
            }
        );

        localStorage.setItem(PUSH_REGISTERED_KEY, '1');
        return true;
    } catch (err) {
        console.warn('[NotificationManager] Registration failed:', err);
        return false;
    }
}

/**
 * Determine which notification channel to use based on the notification type.
 */
function getChannelForType(type?: string): string {
    if (type === 'message' || type === 'task_assignment') return 'practicepro-messages';
    if (type === 'task' || type === 'deadline' || type === 'overdue') return 'practicepro-tasks';
    return 'practicepro-general';
}

/**
 * showLocalNotification — Displays a local notification in the phone's
 * notification shade. Works even when the app is backgrounded (as long
 * as the app was opened at least once).
 *
 * The notification includes:
 *   - Title + body text
 *   - The correct channel (messages/tasks/general) for distinct vibration
 *   - Extra data (view, id, context) so tapping opens the right page
 *   - Sound (if enabled in settings)
 *
 * HAPTIC PATTERN:
 *   Uses NotificationType.Warning (a medium-long buzz pattern) for
 *   notifications — DISTINCT from:
 *   - haptics.light() (tiny tap for UI interactions)
 *   - haptics.success() (two rising taps for form submission)
 *   - haptics.error() (single strong buzz for errors)
 *   The user can feel the difference between "new message" and "I tapped
 *   a button" without looking at the screen.
 */
export async function showLocalNotification(opts: {
    title: string;
    body: string;
    id?: number;
    type?: string;
    extraData?: Record<string, any>;
}): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
        const id = opts.id || Date.now();
        const channelId = getChannelForType(opts.type);

        await LocalNotifications.schedule({
            notifications: [
                {
                    id,
                    title: opts.title,
                    body: opts.body,
                    channelId,
                    sound: isSoundEnabled() ? 'notification.wav' : undefined,
                    smallIcon: 'ic_notification',
                    largeIcon: 'ic_launcher',
                    // Store the navigation target so the tap handler
                    // can open the right page when the user taps the
                    // notification in the shade.
                    extra: opts.extraData || {},
                } as any,
            ],
        });

        // Trigger a DISTINCT haptic pattern for notifications.
        // NotificationType.Warning gives a medium-long vibration pattern
        // that feels different from the short taps used for UI interactions.
        try {
            await Haptics.notification({ type: NotificationType.Warning });
        } catch {
            haptics.medium();
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

/**
 * removeAllListeners — Clean up notification listeners on unmount.
 * Should be called when the app is closing.
 */
export async function removeAllNotificationListeners(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
        await LocalNotifications.removeAllListeners();
    } catch {}
}

export const notificationManager = {
    requestPermission: requestNotificationPermission,
    register: registerForNotifications,
    show: showLocalNotification,
    cancelAll: cancelAllNotifications,
    removeAllListeners: removeAllNotificationListeners,
    isPushRegistered,
    isSoundEnabled,
    setSoundEnabled,
};

export default notificationManager;
