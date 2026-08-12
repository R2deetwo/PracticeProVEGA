/**
 * usePushNotifications — Capacitor push notification registration hook.
 *
 * On app boot (if native platform), this hook:
 *   1. Requests notification permission
 *   2. Registers with FCM to get a device token
 *   3. Saves the token to the backend (user_push_tokens table)
 *   4. Listens for incoming notifications (foreground + background)
 *   5. Listens for notification taps (for APK download actions, etc.)
 *
 * Usage: Just add `usePushNotifications()` to App.tsx
 *
 * FIREBASE SETUP:
 *   The google-services.json file must be in android/app/ for this to work.
 *   Without it, the plugin will silently fail (no crash — just no push).
 */

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function usePushNotifications(userId?: string, firmId?: string) {
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

    const setupPushNotifications = async () => {
      try {
        // Request permission
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.log('[push] Permission not granted — skipping registration');
          return;
        }

        // Register with FCM
        await PushNotifications.register();

        // Listen for registration token
        PushNotifications.addListener('registration', (token: Token) => {
          console.log('[push] Device registered with FCM:', token.value.slice(0, 20) + '...');

          // Save token to backend
          registerToken({
            userId,
            firmId: firmId || undefined,
            token: token.value,
            deviceType: Capacitor.getPlatform(), // 'android' | 'ios'
            deviceName: navigator.userAgent.slice(0, 100),
          }).catch(err => console.error('[push] Failed to save token:', err));
        });

        // Listen for registration errors
        PushNotifications.addListener('registrationError', (err: any) => {
          console.error('[push] Registration error:', err);
        });

        // Listen for incoming notifications (foreground)
        PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          console.log('[push] Notification received in foreground:', notification.title);

          // If it's an app update notification with an APK URL, we could
          // show an in-app banner. The in-app notification center will
          // also show it.
          if (notification.data?.type === 'app_update' && notification.data?.apkUrl) {
            // Show a toast or banner
            console.log('[push] App update available:', notification.data.apkUrl);
          }
        });

        // Listen for notification taps (when user taps the notification)
        PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
          console.log('[push] Notification tapped:', action.notification.data);

          const data = action.notification.data;

          // If it's an APK download action, open the download URL
          if (data?.type === 'app_update' && data?.apkUrl) {
            console.log('[push] Opening APK download URL:', data.apkUrl);
            // Use Capacitor Browser to open the download URL
            import('@capacitor/browser').then(({ Browser }) => {
              Browser.open({ url: data.apkUrl });
            }).catch(() => {
              // Fallback: open in system browser
              window.open(data.apkUrl, '_blank');
            });
          }
        });

        console.log('[push] Notification setup complete');
      } catch (err) {
        console.error('[push] Setup failed:', err);
      }
    };

    setupPushNotifications();

    // Cleanup: unregister token on unmount (e.g., logout)
    return () => {
      // Note: We don't unregister on every unmount — only on explicit logout.
      // The token stays active so the user continues to receive notifications.
    };
  }, [userId, firmId, registerToken]);
}
