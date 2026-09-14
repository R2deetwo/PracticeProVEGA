/**
 * usePushNotifications — Capacitor push notification registration hook.
 *
 * On app boot (if native platform), this hook:
 *   1. Creates the Android notification channels FIRST (so background FCM
 *      pushes targeting 'practicepro-general' are never silently dropped —
 *      Android 8+ discards notifications posted to a nonexistent channel)
 *   2. Requests notification permission
 *   3. Registers with FCM to get a device token
 *   4. Saves the token to the backend (user_push_tokens table) WITH the
 *      bundle's push capability flags — the WhatsApp-grade signal: the JS
 *      bundle and the native PracticeProMessagingService ship in the SAME
 *      APK, so "data_only" here tells the server this device can receive
 *      data-only FCM messages that the service renders as MessagingStyle
 *      notifications with inline reply (see pushNotificationsNode.ts).
 *   5. NO local re-posting of foreground pushes — the native service owns
 *      the tray row in EVERY app state (this was the duplicate-notification
 *      bug: the service posted one row, this listener posted a second).
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
import { ensureNotificationChannels } from '../utils/notifications';

/**
 * Push capabilities THIS bundle's APK carries (2026-09-14, WhatsApp-grade
 * push round). Registered alongside the FCM token so the server can pick
 * the right payload shape per device:
 *   - data_only: the native PracticeProMessagingService is present and
 *     renders data-only FCM messages as MessagingStyle notifications with
 *     per-conversation stacking and inline reply.
 *   - inline_reply: the notification reply action posts through
 *     /api/push-reply with a server-minted replyToken.
 * Stale APKs (no capabilities registered) keep receiving notification
 * payloads — delivery never regresses during rollout.
 */
const PUSH_CAPABILITIES = 'data_only,inline_reply';

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
            // Save token to backend (session-verified server-side) — WITH
            // this APK's push capabilities so the FCM dispatcher can send
            // data-only messages to the native MessagingStyle service.
            registerToken({
              userId,
              firmId: firmId || undefined,
              sessionToken: sessionToken || undefined,
              token: token.value,
              deviceType: Capacitor.getPlatform(), // 'android' | 'ios'
              deviceName: navigator.userAgent.slice(0, 100),
              capabilities: PUSH_CAPABILITIES,
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

        // STEP 4 — Foreground push receipt: the native
        // PracticeProMessagingService has ALREADY posted the tray
        // notification for data-only messages (it runs for foreground,
        // background and killed-app states alike). Re-posting here was the
        // duplicate-notification bug ("two notifications that give a
        // preview"): the service's row + this listener's local row.
        // This listener now stays OBSERVATION-ONLY: JS-side effects that
        // need the event (analytics, in-app toast when the Header watcher
        // hasn't fired) can hook on; display is the service's job.
        listenerHandles.push(
          await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
            console.log('[push] Notification received in foreground:', notification.title || '(data-only)');
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
              return;
            }

            // Deep-link navigation. Round 2 (2026-09-14): the server now
            // emits many view targets (messaging, feedback, organizations,
            // subscriptions, sales, ...). Broadcast for ANY payload that
            // carries a view — App/AdminApp each map the views they own
            // (previously only chat_message/portal_reply payloads routed,
            // so tapping a signup/lead/issue push did nothing).
            if (data?.view && typeof data.view === 'string') {
              const isMessagingPush =
                data.view === 'messaging' ||
                data?.type === 'chat_message' ||
                data?.type === 'portal_reply' ||
                data?.type === 'feedback_reply';
              const conversationId = data.conversationId || data.id || null;
              // Messaging context: prefer the server's own deep-link fields
              // (support threads send selectedInboxId 'system-inbox' +
              // selectedFeedbackId) and only synthesize conversation
              // selection for plain chat/portal pushes.
              const messagingContext: Record<string, any> = {
                initialTab: data.initialTab || 'inbox',
              };
              if (data.systemInbox) messagingContext.systemInbox = true;
              if (data.selectedFeedbackId) messagingContext.selectedFeedbackId = String(data.selectedFeedbackId);
              if (data.selectedInboxId) {
                messagingContext.selectedInboxId = String(data.selectedInboxId);
              } else if (conversationId) {
                messagingContext.selectedInboxId = String(conversationId);
                messagingContext.activeConversationId = String(conversationId);
                messagingContext.selectedInboxType = data.type === 'portal_reply' ? 'client_tenant' : 'team';
              } else if (data.feedbackId) {
                // support-thread push without a system-inbox marker
                messagingContext.selectedInboxId = 'system-inbox';
                messagingContext.selectedFeedbackId = String(data.feedbackId);
              }
              window.dispatchEvent(new CustomEvent('pp:navigate', {
                detail: {
                  view: data.view,
                  id: conversationId || data.feedbackId || undefined,
                  ...(isMessagingPush
                    ? { context: messagingContext }
                    : { context: { ...(data as any) } }),
                },
              }));
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
  }, [userId, firmId, registerToken, sessionToken]);
  // ^ sessionToken added to deps (2026-09-14): the bearer token can arrive
  // one render AFTER the user object (async storage reads / cross-tab
  // adoption in AuthContext). The old closure captured a null token, the
  // registerPushToken mutation then failed its server-side session check
  // ("Unauthenticated") and — because the effect never re-ran — the device
  // stayed token-less for the whole session. Pushes silently never arrived.
  // With sessionToken in the deps, a late token re-triggers registration;
  // isRegistered guards double-registration when both land in one render.
}
