/**
 * usePushNotifications — Capacitor push notification registration hook.
 *
 * On app boot (if native platform), this hook:
 *   1. Creates the Android notification channels FIRST (so background FCM
 *      pushes targeting 'practicepro-general' are never silently dropped —
 *      Android 8+ discards notifications posted to a nonexistent channel)
 *   2. Requests notification permission
 *   3. Registers with FCM to get a device token
 *   4. Saves the token to the backend (user_push_tokens table)
 *   5. Shows foreground pushes as local notifications (FCM does NOT display
 *      notification payloads while the app is open — previously they were
 *      only console.logged, so users saw nothing while using the app)
 *   6. Listens for notification taps (APK download actions, navigation)
 *
 * Usage: `usePushNotifications(currentUser?.id, currentUser?.firmId, bearerToken)`
 *
 * FIREBASE SETUP:
 *   google-services.json must be in android/app/ AND the app's package name
 *   must be registered in the Firebase project (com.practicepro.app ✓;
 *   com.practicepro.admin must be added in Firebase Console). Without it,
 *   registration silently fails (no crash — just no push).
 */

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ensureNotificationChannels, showLocalNotification } from '../utils/notifications';

export function usePushNotifications(userId?: string, firmId?: string, sessionToken?: string | null) {
  const registerToken = useMutation(api.pushNotifications.registerPushToken);
  const unregisterToken = useMutation(api.pushNotifications.unregisterPushToken);
  const isRegistered = useRef(false);

  useEffect(() => {
    if (!userId || isRegistered.current) return;

    // Only register on native platforms (Android/iOS)
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    isRegistered.current = true;
    let disposed = false;
    const listenerHandles: Array<{ remove: () => Promise<void> }> = [];

    const setupPushNotifications = async () => {
      try {
        // STEP 1 — Create notification channels BEFORE anything else.
        // Channel creation does not require permission (only displaying does)
        // and background FCM pushes are DROPPED on Android 8+ if the target
        // channel doesn't exist yet.
        await ensureNotificationChannels();
        if (disposed) return;

        // STEP 2 — Request permission
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn('[push] Permission not granted — FCM registration skipped. ' +
            'The user can enable notifications in system settings; they will be ' +
            'requested again next session.');
          return;
        }

        // STEP 3 — Attach ALL listeners BEFORE calling register(), so the
        // 'registration' event can never race ahead of its listener.
        listenerHandles.push(
          await PushNotifications.addListener('registration', (token: Token) => {
            console.log('[push] Device registered with FCM:', token.value.slice(0, 20) + '...');
            // Save token to backend (session-verified server-side)
            registerToken({
              userId,
              firmId: firmId || undefined,
              sessionToken: sessionToken || undefined,
              token: token.value,
              deviceType: Capacitor.getPlatform(), // 'android' | 'ios'
              deviceName: navigator.userAgent.slice(0, 100),
            }).catch(err => console.error('[push] Failed to save token to backend:', err?.message || err));
          })
        );

        listenerHandles.push(
          await PushNotifications.addListener('registrationError', (err: any) => {
            console.error('[push] Registration error:', err);
            // Most common cause: the app's package name is not registered in
            // the Firebase project (google-services.json mismatch). Firebase
            // then rejects the token request with FIREBASE_INSTALLATIONS 403.
            if (String(err?.error || err?.message || '').match(/403|INSTALLATION|FirebaseApp/i)) {
              console.error('[push] This app package is likely not registered in the Firebase project. ' +
                'Add it in Firebase Console → Project Settings → Your apps.');
            }
          })
        );

        // STEP 4 — Foreground notifications: FCM does NOT display them while
        // the app is open; re-display as a local notification so the user
        // actually sees something (distinct channel + haptic + tap handling).
        listenerHandles.push(
          await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
            console.log('[push] Notification received in foreground:', notification.title);
            const data = (notification.data || {}) as Record<string, any>;
            showLocalNotification({
              title: notification.title || 'PracticePro',
              body: notification.body || '',
              type: data.type,
              extraData: data,
            }).catch(() => {});
          })
        );

        // STEP 5 — Notification taps (backgrounded app): FCM opens the
        // launcher activity (no clickAction in the server payload) and the
        // plugin delivers the data here.
        listenerHandles.push(
          await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
            console.log('[push] Notification tapped:', action.notification.data);
            const data = action.notification.data || {};

            // If it's an APK download action, open the download URL
            if (data?.type === 'app_update' && data?.apkUrl) {
              console.log('[push] Opening APK download URL:', data.apkUrl);
              import('@capacitor/browser').then(({ Browser }) => {
                Browser.open({ url: data.apkUrl });
              }).catch(() => {
                window.open(data.apkUrl, '_blank');
              });
            }
          })
        );

        if (disposed) {
          listenerHandles.forEach(h => { h.remove?.().catch(() => {}); });
          return;
        }

        // STEP 6 — NOW register with FCM to obtain the token.
        await PushNotifications.register();
        console.log('[push] Notification setup complete');
      } catch (err) {
        console.error('[push] Setup failed:', err);
      }
    };

    setupPushNotifications();

    // Cleanup on unmount (logout / account switch): remove listeners so a
    // re-mounted hook with a different userId re-registers with fresh
    // closures (previously stale listeners kept saving tokens under the
    // previous account).
    return () => {
      disposed = true;
      isRegistered.current = false;
      listenerHandles.forEach(h => { h.remove?.().catch(() => {}); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, firmId, registerToken]);
}
