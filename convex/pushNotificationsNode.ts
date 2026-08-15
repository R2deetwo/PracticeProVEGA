/**
 * convex/pushNotificationsNode.ts — Node.js-only push notification dispatch.
 *
 * This file uses "use node" because firebase-admin requires Node.js APIs
 * (Buffer, crypto, etc.) that aren't available in Convex's default runtime.
 *
 * The sendFcmPush action is called from pushNotifications.ts via the
 * internal API — it should never be called directly from the client.
 */
"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export const sendFcmPush = internalAction({
  args: {
    tokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (args.tokens.length === 0) return { success: true, sent: 0 };

    const serverKey = process.env.FCM_SERVER_KEY;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    // If no Firebase credentials configured, skip silently
    if (!serverKey && !serviceAccountJson) {
      console.log("[push] FCM not configured — skipping OS tray notification (in-app notification still created)");
      return { success: true, sent: 0, reason: "FCM_NOT_CONFIGURED" };
    }

    try {
      // Method 1: Legacy server key (HTTP v1 API via fetch)
      if (serverKey) {
        const response = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Authorization": `key=${serverKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            registration_ids: args.tokens,
            notification: {
              title: args.title,
              body: args.body,
              sound: "default",
              click_action: "FCM_PLUGIN_ACTIVITY",
              icon: "ic_launcher",
            },
            data: args.data || {},
            priority: "high",
          }),
        });

        if (response.ok) {
          const result: any = await response.json();
          console.log(`[push] FCM sent: ${result.success || 0} success, ${result.failure || 0} failure`);
          return { success: true, sent: result.success || 0, failed: result.failure || 0 };
        } else {
          const errText = await response.text();
          console.error("[push] FCM error:", response.status, errText);
          return { success: false, error: `FCM ${response.status}: ${errText}` };
        }
      }

      // Method 2: Service account (firebase-admin SDK)
      if (serviceAccountJson) {
        const admin: any = await import('firebase-admin');
        const serviceAccount = JSON.parse(serviceAccountJson);

        if (!admin.apps?.length) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
        }

        const message = {
          notification: { title: args.title, body: args.body },
          data: args.data || {},
          tokens: args.tokens,
          android: {
            priority: "high" as const,
            notification: {
              sound: "default",
              icon: "ic_launcher",
              clickAction: "FCM_PLUGIN_ACTIVITY",
              channelId: "practicepro-general",
              priority: "high" as const,
              defaultVibrateTimings: true,
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
              },
            },
          },
        };

        const response = await admin.messaging().sendEachForMulticast(message as any);
        console.log(`[push] FCM sent: ${response.successCount} success, ${response.failureCount} failure`);
        return { success: true, sent: response.successCount, failed: response.failureCount };
      }
    } catch (err: any) {
      console.error("[push] FCM dispatch error:", err.message);
      return { success: false, error: err.message };
    }

    return { success: false, reason: "NO_METHOD_AVAILABLE" };
  },
});
