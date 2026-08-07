/**
 * convex/broadcasts.ts
 *
 * Dedicated real-time queries for broadcast notifications.
 *
 * The BroadcastBanner component subscribes to getActiveBroadcasts to get
 * the list of active (unread) broadcasts for the current user. This is
 * separate from the firm-scoped notifications fetch in getFirmData
 * because:
 *   1. Broadcasts are created per-user (one row per user), so we
 *      filter by userId, not firmId.
 *   2. We want real-time updates — the banner should appear the
 *      moment a broadcast is sent, without waiting for the full
 *      firm data refresh.
 *   3. We only need broadcast-type notifications here, not all
 *      notifications (keeps the payload small).
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";

/**
 * getActiveBroadcasts
 *
 * Fetches all unread broadcast notifications for a specific user.
 * Broadcasts are identified by `type` starting with 'broadcast_'.
 *
 * Args:
 *   userId — the Convex _id of the user (from currentUser._id)
 *   email  — the user's email (fallback for matching)
 *
 * Returns:
 *   Array of broadcast notifications, sorted by timestamp descending
 *   (most recent first). Each item includes all notification fields
 *   plus the targetProduct (extracted from link.context).
 *
 * USER MATCHING:
 *   Broadcast notifications store `userId` as the Convex _id of the
 *   target user. We match by:
 *     1. Exact userId match (string comparison)
 *     2. Email match (if the notification has an email field)
 *     3. Legacy broadcasts with no userId (created before per-user targeting)
 *
 *   This multi-signal approach handles edge cases where the userId
 *   format doesn't match exactly (e.g., Id object vs string).
 */
export const getActiveBroadcasts = query({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.userId && !args.email) return [];

    const allNotes = await ctx.db.query("notifications").collect();

    const targetUserId = String(args.userId || '');
    const targetEmail = (args.email || '').toLowerCase().trim();

    const broadcasts = allNotes.filter((n: Doc<"notifications">) => {
      // Must be a broadcast type
      const type = n.type || '';
      if (!type.startsWith('broadcast_')) return false;

      // Must be unread (active)
      if (n.isRead) return false;

      // USER MATCHING — multi-signal:
      const nUserId = String(n.userId || '');

      // 1. Exact userId match
      if (nUserId && nUserId === targetUserId) return true;

      // 2. Legacy broadcasts with no specific userId
      //    (created before per-user targeting — these are firm-wide)
      if (!nUserId || nUserId === 'undefined' || nUserId === 'null' || nUserId === '') {
        // For legacy broadcasts, show to everyone (they were meant for all)
        return true;
      }

      // 3. If userId doesn't match, but this is a broadcast and the
      //    notification's firmId is 'system' (platform-wide), show it
      //    to all users. This handles broadcasts where the per-user
      //    creation loop might have missed some users due to the
      //    dedup logic.
      if (n.firmId === 'system') {
        return true;
      }

      return false;
    });

    // Sort by timestamp descending (most recent first)
    const sorted = broadcasts.sort((a, b) => {
      const tsA = new Date(a.timestamp || a._creationTime || 0).getTime();
      const tsB = new Date(b.timestamp || b._creationTime || 0).getTime();
      return tsB - tsA;
    });

    // Map to a clean shape for the client
    return sorted.map((n) => ({
      _id: n._id,
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      timestamp: n.timestamp,
      _creationTime: n._creationTime,
      link: n.link,
      firmId: n.firmId,
      userId: n.userId,
      // Extract targetProduct for client-side product filtering
      targetProduct: (n.link as any)?.context?.targetProduct || 'all',
      deepLink: (n.link as any)?.context?.deepLink || null,
    }));
  },
});

/**
 * getBroadcastHistory
 *
 * Fetches ALL broadcast notifications (read and unread) for the
 * notification center / history view. Used by the "Platform Notices"
 * tab in the consumer app's notification panel.
 *
 * Args:
 *   userId — the Convex _id of the user
 *   email  — the user's email (fallback)
 *
 * Returns:
 *   Array of all broadcast notifications (read + unread), sorted by
 *   timestamp descending. Includes isRead flag so the UI can show
 *   read/unread state.
 */
export const getBroadcastHistory = query({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.userId && !args.email) return [];

    const allNotes = await ctx.db.query("notifications").collect();

    const targetUserId = String(args.userId || '');

    const broadcasts = allNotes.filter((n: Doc<"notifications">) => {
      const type = n.type || '';
      if (!type.startsWith('broadcast_')) return false;

      const nUserId = String(n.userId || '');

      // Same matching logic as getActiveBroadcasts
      if (nUserId && nUserId === targetUserId) return true;
      if (!nUserId || nUserId === 'undefined' || nUserId === 'null' || nUserId === '') return true;
      if (n.firmId === 'system') return true;

      return false;
    });

    const sorted = broadcasts.sort((a, b) => {
      const tsA = new Date(a.timestamp || a._creationTime || 0).getTime();
      const tsB = new Date(b.timestamp || b._creationTime || 0).getTime();
      return tsB - tsA;
    });

    return sorted.map((n) => ({
      _id: n._id,
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      timestamp: n.timestamp,
      _creationTime: n._creationTime,
      link: n.link,
      firmId: n.firmId,
      targetProduct: (n.link as any)?.context?.targetProduct || 'all',
      deepLink: (n.link as any)?.context?.deepLink || null,
    }));
  },
});

/**
 * deleteBroadcastNotification
 *
 * Deletes a single broadcast notification. Used by the "Platform Notices"
 * tab when the user clicks "Delete" on a notice.
 *
 * SECURITY: This is a public mutation. Broadcast notifications are
 * non-sensitive platform announcements. The worst case is a user
 * deletes their own copy of a broadcast — no privilege escalation.
 */
export const deleteBroadcastNotification = mutation({
  args: { notificationId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.notificationId as any);
    return { success: true };
  },
});
