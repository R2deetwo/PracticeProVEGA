/**
 * convex/pushNotifications.ts — Push notification infrastructure
 *
 * Provides:
 *   1. registerPushToken — client calls this on app boot after FCM permission
 *   2. unregisterPushToken — client calls this on logout / token revocation
 *   3. getUserNotifications — fetch in-app notification center entries
 *   4. markNotificationRead — mark a notification as read
 *   5. markAllNotificationsRead — bulk mark read
 *   6. sendPushNotification — internal action that dispatches FCM via firebase-admin
 *   7. notifyAppUpdate — founder-only mutation to push "new APK available" to all users
 *
 * FIREBASE SETUP:
 *   Set FCM_SERVER_KEY in Convex env (Project Settings → Cloud Messaging → Server Key).
 *   Or set FIREBASE_SERVICE_ACCOUNT_JSON for service-account auth (recommended).
 *
 *   In Firebase Console:
 *     1. Create project "PracticePro"
 *     2. Add Android app (com.practicepro.app)
 *     3. Download google-services.json → place in android/app/
 *     4. Project Settings → Cloud Messaging → copy Server Key
 *     5. Set FCM_SERVER_KEY in Convex env
 */

import { mutation, query, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── Token Registration ──────────────────────────────────────────────────────

export const registerPushToken = mutation({
  args: {
    userId: v.string(),
    firmId: v.optional(v.string()),
    token: v.string(),
    deviceType: v.string(),
    deviceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if token already exists
    const existing = await ctx.db
      .query("user_push_tokens")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();

    if (existing) {
      // Update the existing token record
      await ctx.db.patch(existing._id, {
        userId: args.userId,
        firmId: args.firmId || existing.firmId,
        deviceType: args.deviceType,
        deviceName: args.deviceName || existing.deviceName,
        isActive: true,
        updatedAt: now,
      });
      return { success: true, updated: true };
    }

    // Insert new token
    const id = await ctx.db.insert("user_push_tokens", {
      userId: args.userId,
      firmId: args.firmId || undefined,
      token: args.token,
      deviceType: args.deviceType,
      deviceName: args.deviceName,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, id };
  },
});

export const unregisterPushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("user_push_tokens")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isActive: false,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// ─── In-App Notification Center ──────────────────────────────────────────────

export const getUserNotifications = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("app_notifications")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 50);

    return notifications;
  },
});

export const getUnreadNotificationCount = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("app_notifications")
      .withIndex("by_user_read", (q: any) =>
        q.eq("userId", args.userId).eq("isRead", false)
      )
      .collect();

    return unread.length;
  },
});

export const markNotificationRead = mutation({
  args: { notificationId: v.id("app_notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, {
      isRead: true,
      readAt: Date.now(),
    });
    return { success: true };
  },
});

export const markAllNotificationsRead = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("app_notifications")
      .withIndex("by_user_read", (q: any) =>
        q.eq("userId", args.userId).eq("isRead", false)
      )
      .collect();

    const now = Date.now();
    for (const notif of unread) {
      await ctx.db.patch(notif._id, {
        isRead: true,
        readAt: now,
      });
    }

    return { success: true, count: unread.length };
  },
});

// ─── Founder: Send Push + In-App Notification ────────────────────────────────

/**
 * notifyAppUpdate — Founder-only mutation.
 *
 * Sends "New App Update Available" to ALL active users:
 *   1. Creates an in-app notification center entry for every user
 *   2. Triggers an FCM push notification via the internal action
 *
 * The in-app notification includes a direct APK download action.
 */
export const notifyAppUpdate = mutation({
  args: {
    tokenIdentifier: v.string(),
    version: v.string(),
    apkUrl: v.string(),
    releaseNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify founder
    const founder = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", args.tokenIdentifier.toLowerCase()))
      .first();

    if (!founder || founder.role !== "Founder") {
      throw new Error("Unauthorized. Only Founders can send app update notifications.");
    }

    // Get ALL users (who have a firmId — skip demo/pending users)
    const allUsers = await ctx.db
      .query("users")
      .filter((q: any) => q.neq(q.field("firmId"), undefined))
      .take(5000);

    const now = Date.now();
    let notificationCount = 0;

    for (const user of allUsers) {
      // Create in-app notification
      await ctx.db.insert("app_notifications", {
        userId: String(user._id),
        firmId: user.firmId,
        title: `New App Update Available (v${args.version})`,
        body: args.releaseNotes || `A new performance update is ready for your app. Tap to download directly.`,
        type: "app_update",
        priority: "high",
        actionType: "apk_download",
        actionUrl: args.apkUrl,
        isRead: false,
        createdAt: now,
      });
      notificationCount++;
    }

    // Trigger FCM push for all users with registered tokens
    // Get all active push tokens
    const allTokens = await ctx.db
      .query("user_push_tokens")
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .take(2000);

    const tokens = allTokens.map((t: any) => t.token);

    if (tokens.length > 0) {
      // Fire the push notification via internal action (async — don't block)
      ctx.scheduler.runAfter(0, internal.pushNotifications.sendFcmPush, {
        tokens,
        title: `New App Update Available (v${args.version})`,
        body: args.releaseNotes || "A new performance update is ready. Tap to download.",
        data: {
          type: "app_update",
          apkUrl: args.apkUrl,
          version: args.version,
        },
      });
    }

    return {
      success: true,
      notificationsCreated: notificationCount,
      pushTokensNotified: tokens.length,
    };
  },
});

// ─── FCM Dispatch (Internal Action) ──────────────────────────────────────────

/**
 * sendFcmPush — Internal action that sends FCM push notifications.
 *
 * Uses either:
 *   - FCM_SERVER_KEY (legacy server key, simpler)
 *   - FIREBASE_SERVICE_ACCOUNT_JSON (service account, recommended)
 *
 * Falls back gracefully if neither is configured — the in-app notification
 * center still works, just no OS tray notification.
 */
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
    // (in-app notifications still work — just no OS tray notification)
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
          const result = await response.json();
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
        // Dynamic import so firebase-admin doesn't crash if not installed
        const admin = await import('firebase-admin');
        const serviceAccount = JSON.parse(serviceAccountJson);

        if (!admin.apps.length) {
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

// ─── General Purpose: Send to specific users ────────────────────────────────

/**
 * sendToUsers — Internal mutation helper that creates in-app notifications
 * for a list of users. Other mutations can call this + schedule the FCM action.
 */
export const sendToUsers = mutation({
  args: {
    userIds: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    type: v.string(),
    priority: v.optional(v.string()),
    actionType: v.optional(v.string()),
    actionUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let count = 0;

    for (const userId of args.userIds) {
      await ctx.db.insert("app_notifications", {
        userId,
        firmId: undefined,
        title: args.title,
        body: args.body,
        type: args.type,
        priority: args.priority || "normal",
        actionType: args.actionType,
        actionUrl: args.actionUrl,
        isRead: false,
        createdAt: now,
      });
      count++;
    }

    // Get push tokens for these users
    const tokens: string[] = [];
    for (const userId of args.userIds) {
      const userTokens = await ctx.db
        .query("user_push_tokens")
        .withIndex("by_user_active", (q: any) => q.eq("userId", userId).eq("isActive", true))
        .collect();
      tokens.push(...userTokens.map((t: any) => t.token));
    }

    if (tokens.length > 0) {
      ctx.scheduler.runAfter(0, internal.pushNotifications.sendFcmPush, {
        tokens,
        title: args.title,
        body: args.body,
        data: { type: args.type, actionUrl: args.actionUrl },
      });
    }

    return { success: true, count, pushTokens: tokens.length };
  },
});
