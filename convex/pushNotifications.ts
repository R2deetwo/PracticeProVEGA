/**
 * convex/pushNotifications.ts — Push notification infrastructure
 *
 * Provides:
 *   1. registerPushToken — client calls this on app boot after FCM permission
 *   2. unregisterPushToken — client calls this on logout / token revocation
 *   3. getUserNotifications — fetch in-app notification center entries
 *   4. markNotificationRead — mark a notification as read
 *   5. markAllNotificationsRead — bulk mark read
 *   6. notifyAppUpdate — founder-only mutation to push "new APK available" to all users
 *   7. internal helpers used by pushNotificationsNode.ts (token lookup,
 *      in-app notification writes, stale-token deactivation)
 *
 *   The public test actions (sendTestPush, sendTestPushToUser) live in
 *   pushNotificationsNode.ts (node runtime) so they can dispatch FCM
 *   inline and return the REAL delivery result to the caller's UI.
 *
 * FIREBASE SETUP (Sept 2026 push-fix):
 *   The legacy FCM server-key API was shut down by Google (June 2024).
 *   The ONLY supported credential now is a service account:
 *     1. Create project "practicepro-42178" in Firebase (already done)
 *     2. Add Android app (com.practicepro.app) → google-services.json in android/app/ (done)
 *     3. Add Android app (com.practicepro.admin) for the Founder APK (REQUIRED —
 *        a cloned client entry in google-services.json does NOT work; Firebase
 *        validates app-id ↔ package-name at token registration)
 *     4. Project Settings → Service accounts → Generate new private key
 *     5. Set FIREBASE_SERVICE_ACCOUNT_JSON on the Convex deployment
 *        (Dashboard → Settings → Environment Variables,
 *         or `npx convex env set FIREBASE_SERVICE_ACCOUNT_JSON '<json>'`)
 */

import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
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
// FCM's OAuth2 JWT signing requires the Node.js runtime ("use node" directive).
// Convex's default runtime doesn't support Node.js APIs like Buffer/crypto.
// Mutations here schedule internal.pushNotificationsNode.sendFcmPush for
// fire-and-forget fan-outs (notifyAppUpdate, notifyFounders); the public
// test actions dispatch inline and return real results.

// Round 8 auth retrofit: sendToUsers was DELETED. It was a public, fully
// unauthenticated mutation that inserted in-app notifications and dispatched
// FCM pushes to ARBITRARY user ids — a mass-notification/impersonation
// primitive with zero callers. (The test actions and notifyAppUpdate remain,
// and all verify the caller role / session.)

/**
 * internalQuery: getFounderPushTargets — session-verified founder gate.
 * Resolves the founder and their ACTIVE device tokens. Consumed by the
 * public sendTestPush action in pushNotificationsNode.ts.
 */
export const getFounderPushTargets = internalQuery({
  args: {
    tokenIdentifier: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const founder: any = await requireFounderCaller(ctx, {
        sessionToken: args.sessionToken,
        userEmail: args.tokenIdentifier,
      });
      const tokens = await ctx.db
        .query("user_push_tokens")
        .withIndex("by_user_active", (q: any) =>
          q.eq("userId", String(founder._id)).eq("isActive", true)
        )
        .collect();
      if (tokens.length === 0) {
        return { reason: "NO_REGISTERED_DEVICES", userId: String(founder._id), tokens: [] as string[] };
      }
      return {
        reason: "OK",
        userId: String(founder._id),
        tokens: tokens.map((t: any) => t.token),
      };
    } catch (err: any) {
      return { reason: "NOT_FOUNDER", message: String(err?.message || err) };
    }
  },
});

/**
 * internalQuery: getUserPushTargets — session-verified self-lookup.
 * The caller may only resolve their own device tokens. Consumed by the
 * public sendTestPushToUser action in pushNotificationsNode.ts.
 */
export const getUserPushTargets = internalQuery({
  args: {
    userEmail: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const caller: any = await resolveCaller(ctx, {
        sessionToken: args.sessionToken,
        userEmail: args.userEmail,
      });
      const callerEmail = String(caller.tokenIdentifier || caller.email || "").toLowerCase();
      if (callerEmail !== args.userEmail.toLowerCase()) {
        return { reason: "UNAUTHORIZED" };
      }
      const tokens = await ctx.db
        .query("user_push_tokens")
        .withIndex("by_user_active", (q: any) =>
          q.eq("userId", String(caller._id)).eq("isActive", true)
        )
        .collect();
      if (tokens.length === 0) {
        return { reason: "NO_REGISTERED_DEVICES", userId: String(caller._id), tokens: [] as string[] };
      }
      return {
        reason: "OK",
        userId: String(caller._id),
        tokens: tokens.map((t: any) => t.token),
      };
    } catch (err: any) {
      return { reason: "USER_NOT_FOUND", message: String(err?.message || err) };
    }
  },
});

/**
 * internalMutation: recordInAppNotification — used by the node-runtime test
 * actions to write the notification-center entry (actions can't touch ctx.db).
 */
export const recordInAppNotification = internalMutation({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("app_notifications", {
      userId: args.userId,
      firmId: undefined,
      title: args.title,
      body: args.body,
      type: args.type,
      priority: "normal",
      actionType: "dismiss",
      isRead: false,
      createdAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * internalMutation: deactivatePushToken — token hygiene. Called by the FCM
 * dispatcher when FCM reports a token as UNREGISTERED/NOT_FOUND, so dead
 * tokens stop being retried in every future send.
 */
export const deactivatePushToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("user_push_tokens")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();
    if (existing && existing.isActive) {
      await ctx.db.patch(existing._id, { isActive: false, updatedAt: Date.now() });
    }
    return { success: true };
  },
});
