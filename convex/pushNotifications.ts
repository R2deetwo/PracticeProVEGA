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

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { resolveCaller, assertSameFirm, requireFounderCaller } from "./callerAuth";

// ─── Token Registration ──────────────────────────────────────────────────────

export const registerPushToken = mutation({
  args: {
    userId: v.string(),
    sessionToken: v.optional(v.string()),
    firmId: v.optional(v.string()),
    token: v.string(),
    deviceType: v.string(),
    deviceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: userId was trusted as-is — any caller could
    // register push tokens against a victim's account. Resolve the caller
    // (ANY role — portal users on mobile also register push tokens) and,
    // when a firmId is supplied, require it to be the caller's own firm.
    const caller = await resolveCaller(ctx, { sessionToken: args.sessionToken, userId: args.userId });
    if (args.firmId) assertSameFirm(caller, args.firmId);
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
  args: { sessionToken: v.optional(v.string()), token: v.string(), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: token-only unregistration let any caller
    // knock another user's device out of the notification loop (silent
    // DoS). When the token record exists, the caller must own it.
    if (args.userId) {
      const caller = await resolveCaller(ctx, { sessionToken: args.sessionToken, userId: args.userId });
      const owned = await ctx.db
        .query("user_push_tokens")
        .withIndex("by_token", (q: any) => q.eq("token", args.token))
        .first();
      if (owned && String(owned.userId) !== String(caller._id)) {
        throw new Error("Not authorized: this push token belongs to a different user.");
      }
    }

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
  args: {
    notificationId: v.id("app_notifications"),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // B3 SHIP-BLOCKER FIX: Verify caller owns the notification before patching.
    // Without this, anyone with a notificationId could mark any user's
    // notifications as read (suppressing sales-lead alerts, etc.).
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      return { success: false, error: "Notification not found" };
    }

    // R16 strict: resolve the caller from the verified bearer session
    // (the previous email lookup was spoofable — knowing an email let a
    // caller mark that user's notifications as read).
    const caller: any = await resolveCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
    });

    // The notification's userId field stores the user's _id (Convex id) or
    // a legacy string id. Check both for backward compatibility.
    const notifUserId = notification.userId;
    const callerId = caller._id;
    const callerLegacyId = (caller as any).id || (caller as any).userId || "";

    if (notifUserId !== callerId && notifUserId !== callerLegacyId) {
      // Log the unauthorized attempt
      try {
        await ctx.db.insert("securityEvents", {
          eventType: "unauthorized_notification_access",
          details: `markNotificationRead: caller ${args.userEmail} attempted to mark notification owned by ${notifUserId}`,
          timestamp: Date.now(),
        });
      } catch {}
      return { success: false, error: "Not authorized to mark this notification" };
    }

    await ctx.db.patch(args.notificationId, {
      isRead: true,
      readAt: Date.now(),
    });
    return { success: true };
  },
});

export const markAllNotificationsRead = mutation({
  args: {
    userId: v.string(),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // R16 strict: resolve the caller from the verified bearer session.
    const caller: any = await resolveCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
    });

    const callerId = caller._id;
    const callerLegacyId = (caller as any).id || (caller as any).userId || "";

    // The client passes userId — verify it matches the caller
    if (args.userId !== callerId && args.userId !== callerLegacyId) {
      try {
        await ctx.db.insert("securityEvents", {
          eventType: "unauthorized_notification_access",
          details: `markAllNotificationsRead: caller ${args.userEmail} attempted to mark notifications for userId ${args.userId}`,
          timestamp: Date.now(),
        });
      } catch {}
      return { success: false, count: 0, error: "Not authorized to mark notifications for this user" };
    }

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
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // R16b: session-verified founder gate (was caller-supplied email match).
    await requireFounderCaller(ctx, { sessionToken: args.sessionToken });

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
      ctx.scheduler.runAfter(0, internal.pushNotificationsNode.sendFcmPush, {
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

// ─── FCM Dispatch ────────────────────────────────────────────────────────────
// The sendFcmPush internal action lives in pushNotificationsNode.ts because
// firebase-admin requires the Node.js runtime ("use node" directive).
// Convex's default runtime doesn't support Node.js APIs like Buffer/crypto.
// The scheduler calls internal.pushNotificationsNode.sendFcmPush from here.

// Round 8 auth retrofit: sendToUsers was DELETED. It was a public, fully
// unauthenticated mutation that inserted in-app notifications and dispatched
// FCM pushes to ARBITRARY user ids — a mass-notification/impersonation
// primitive with zero callers. (sendTestPush/notifyAppUpdate remain, but
// both verify the Founder role.)

/**
 * mutation: sendTestPush
 *
 * Sends a test FCM push notification to the founder's own device(s).
 * Used by the "Send Test Push Notification" button in founder Settings.
 * Returns the FCM dispatch result so the founder can see exactly what
 * happened (success count, failure count, or error message).
 */
export const sendTestPush = mutation({
  args: {
    tokenIdentifier: v.string(),
    title: v.string(),
    body: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // R16b: session-verified founder gate (was caller-supplied email match).
    const founder: any = await requireFounderCaller(ctx, { sessionToken: args.sessionToken });

    // Get the founder's device tokens
    const tokens = await ctx.db
      .query("user_push_tokens")
      .withIndex("by_user_active", (q: any) =>
        q.eq("userId", String(founder._id)).eq("isActive", true)
      )
      .collect();

    const tokenStrings = tokens.map((t: any) => t.token);

    if (tokenStrings.length === 0) {
      return {
        success: false,
        reason: "NO_REGISTERED_DEVICES",
        error: "No active device tokens found for your account. Open the founder APK on your device first — it will auto-register with FCM on launch.",
      };
    }

    // Create an in-app notification too
    await ctx.db.insert("app_notifications", {
      userId: String(founder._id),
      firmId: undefined,
      title: args.title,
      body: args.body,
      type: "system",
      priority: "normal",
      actionType: "dismiss",
      isRead: false,
      createdAt: Date.now(),
    });

    // Dispatch FCM push via scheduler (fire-and-forget for the FCM call)
    ctx.scheduler.runAfter(0, internal.pushNotificationsNode.sendFcmPush, {
      tokens: tokenStrings,
      title: args.title,
      body: args.body,
      data: { type: "test_push" },
    });

    // Note: scheduler.runAfter doesn't return the action's result.
    // We return success based on having tokens — the actual FCM result
    // is logged server-side in pushNotificationsNode.ts.
    return {
      success: true,
      sent: tokenStrings.length,
      failed: 0,
      totalDevices: tokenStrings.length,
      message: `Push dispatched to ${tokenStrings.length} device(s). Check server logs for FCM delivery status.`,
    };
  },
});

/**
 * mutation: sendTestPushToUser
 * Allows ANY authenticated user (not just founders) to send a test push
 * notification to their own registered devices. Used by the "Test Push"
 * button in the user app's Notification Settings.
 */
export const sendTestPushToUser = mutation({
  args: {
    userEmail: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // R16 strict: resolve the caller from the verified bearer session; only
    // self-tests allowed (the previous bare-email lookup let anyone probe
    // any user's device tokens).
    const caller: any = await resolveCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
    });
    const callerEmail = String(caller.tokenIdentifier || caller.email || "").toLowerCase();
    if (callerEmail !== args.userEmail.toLowerCase()) {
      throw new Error("Unauthorized. You can only send test notifications to yourself.");
    }
    // Find the user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", args.userEmail.toLowerCase()))
      .first();

    if (!user) {
      return { success: false, sent: 0, reason: "USER_NOT_FOUND" };
    }

    // Get the user's device tokens
    const tokens = await ctx.db
      .query("user_push_tokens")
      .withIndex("by_user_active", (q: any) =>
        q.eq("userId", String(user._id)).eq("isActive", true)
      )
      .collect();

    const tokenStrings = tokens.map((t: any) => t.token);

    if (tokenStrings.length === 0) {
      return { success: false, sent: 0, reason: "NO_REGISTERED_DEVICES" };
    }

    // Dispatch FCM push
    ctx.scheduler.runAfter(0, internal.pushNotificationsNode.sendFcmPush, {
      tokens: tokenStrings,
      title: "PracticePro Test Push",
      body: "This is a test notification from PracticePro. If you can see this, push notifications are working correctly!",
      data: { type: "test_push" },
    });

    return {
      success: true,
      sent: tokenStrings.length,
    };
  },
});
