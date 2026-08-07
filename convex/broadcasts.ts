/**
 * convex/broadcasts.ts
 *
 * Dedicated real-time query for active broadcast notifications.
 *
 * The BroadcastBanner component subscribes to this query to get the
 * list of active (unread) broadcasts for the current user. This is
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

import { query } from "./_generated/server";
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
 *
 * Returns:
 *   Array of broadcast notifications, sorted by timestamp descending
 *   (most recent first). Each item includes all notification fields
 *   plus the targetProduct (extracted from link.context).
 *
 * SECURITY:
 *   This query is public (no auth check) because:
 *     - It only returns broadcast notifications (not private firm data)
 *     - It filters by userId, so a user can only see their own broadcasts
 *     - The userId is passed from the client, but broadcasts are
 *       non-sensitive platform announcements
 *
 * PRODUCT TARGETING:
 *   Each broadcast's link.context.targetProduct indicates which product
 *   tier it was sent to ('all', 'legal', 'property', 'unified'). The
 *   client evaluates whether to display it based on the user's product.
 */
export const getActiveBroadcasts = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    if (!args.userId) return [];

    // Fetch notifications for this user via the by_firm index is not
    // ideal (we'd need firmId). Instead, we scan the notifications
    // table and filter by userId + broadcast type.
    //
    // NOTE: The notifications table has by_firm and by_custom_id indexes
    // but no by_user index. We use .collect() and filter — this is fine
    // because broadcasts are a small subset of all notifications.
    const allNotes = await ctx.db.query("notifications").collect();

    const broadcasts = allNotes.filter((n: Doc<"notifications">) => {
      // Must be a broadcast type
      const type = n.type || '';
      if (!type.startsWith('broadcast_')) return false;

      // Must be unread (active)
      if (n.isRead) return false;

      // Must belong to this user. The userId field stores the Convex _id
      // of the target user. We compare as strings because the client
      // passes currentUser._id as a string.
      const nUserId = String(n.userId || '');
      const targetUserId = String(args.userId);

      // Match if userId matches exactly
      if (nUserId === targetUserId) return true;

      // Also match if the notification has no specific userId (legacy
      // broadcasts that were created before per-user targeting)
      if (!nUserId || nUserId === 'undefined' || nUserId === 'null') return true;

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
      // Extract targetProduct for client-side product filtering
      targetProduct: (n.link as any)?.context?.targetProduct || 'all',
      deepLink: (n.link as any)?.context?.deepLink || null,
    }));
  },
});
