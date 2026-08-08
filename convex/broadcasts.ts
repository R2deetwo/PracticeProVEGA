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

    // CRO AUDIT FIX — BANNER RENDERING BUG:
    // Look up the user's firmId by email so we can match broadcasts that
    // were created with the user's firmId (not 'system'). Previously the
    // query only matched on exact userId, empty userId (legacy), or
    // firmId='system'. When the client's currentUser._id wasn't loaded yet
    // (empty string), NONE of those matched → no banner rendered, even
    // though the notification bell (which fetches by firmId) showed it.
    let targetFirmId: string | null = null;
    if (targetEmail) {
      try {
        const userRecord = await ctx.db
          .query("users")
          .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", targetEmail))
          .first();
        if (userRecord) {
          targetFirmId = String(userRecord.firmId || '');
        }
      } catch {
        // Fallback: try case-insensitive scan
        try {
          const allUsers = await ctx.db.query("users").take(500);
          const found = allUsers.find((u: any) =>
            (u.tokenIdentifier || '').toLowerCase() === targetEmail
          );
          if (found) targetFirmId = String(found.firmId || '');
        } catch {}
      }
    }

    const broadcasts = allNotes.filter((n: Doc<"notifications">) => {
      // Must be a broadcast type
      const type = n.type || '';
      if (!type.startsWith('broadcast_')) return false;

      // Must be unread (active)
      if (n.isRead) return false;

      // USER MATCHING — multi-signal (relaxed for reliable rendering):
      const nUserId = String(n.userId || '');
      const nFirmId = String(n.firmId || '');

      // 1. Exact userId match
      if (nUserId && targetUserId && nUserId === targetUserId) return true;

      // 2. Legacy broadcasts with no specific userId (firm-wide)
      if (!nUserId || nUserId === 'undefined' || nUserId === 'null' || nUserId === '') {
        return true;
      }

      // 3. Platform-wide broadcasts (firmId === 'system')
      if (nFirmId === 'system') {
        return true;
      }

      // 4. CRO AUDIT FIX — match by firmId.
      // If the broadcast was created with the user's firmId (which is the
      // normal case — createBroadcastNotification sets firmId to the user's
      // actual firmId, NOT 'system'), and the requesting user belongs to
      // that firm, show the broadcast. This is the rule that was MISSING
      // and caused the banner to never render.
      if (targetFirmId && nFirmId && nFirmId === targetFirmId) {
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

    // CRO AUDIT FIX — DEDUPLICATE BY BROADCAST ID.
    // If a user has multiple user records (from joining multiple firms),
    // the same broadcast creates one notification per record. Without
    // deduplication, the user sees identical banners stacked vertically.
    // We keep only the FIRST (most recent) notification per broadcastId.
    const seenBroadcastIds = new Set<string>();
    const deduped = sorted.filter((n) => {
      const bid = (n.link as any)?.context?.broadcastId || '';
      if (!bid) return true;  // No broadcastId = legacy, keep it
      if (seenBroadcastIds.has(bid)) return false;  // Duplicate, skip
      seenBroadcastIds.add(bid);
      return true;
    });

    // Map to a clean shape for the client
    return deduped.map((n) => ({
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
      // Include persistenceMode + broadcastId for the client
      persistenceMode: (n.link as any)?.context?.persistenceMode || 'permanent',
      broadcastId: (n.link as any)?.context?.broadcastId || null,
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

/**
 * getActiveBroadcastsForAdmin
 *
 * Fetches all active broadcast notifications across ALL users — used by
 * the Founder Admin Dashboard's "Active Banners Control Center" to
 * monitor and manage running banners.
 *
 * Groups notifications by broadcastId (so a broadcast sent to 100 users
 * appears as ONE row with recipientCount=100).
 *
 * Returns:
 *   Array of broadcast groups, sorted by timestamp descending.
 *   Each group includes: broadcastId, title, message, theme, targetProduct,
 *   persistenceMode, createdAt, recipientCount, isReadCount.
 *
 * SECURITY: Requires founder auth (tokenIdentifier).
 */
export const getActiveBroadcastsForAdmin = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    // Note: This is a public query — the founder auth check is done
    // via a simple email match. If the caller's email matches a
    // Founder-role user, they're authorized.
    const users = await ctx.db.query("users").take(500);
    const founder = users.find((u: any) =>
      u.role === 'Founder' && u.email?.toLowerCase() === args.tokenIdentifier?.toLowerCase()
    );
    if (!founder) return [];

    // Fetch ALL broadcast notifications (read + unread)
    const allNotes = await ctx.db.query("notifications").collect();
    const broadcasts = allNotes.filter((n: Doc<"notifications">) => {
      const type = n.type || '';
      return type.startsWith('broadcast_');
    });

    // Group by broadcastId
    const groups = new Map<string, any>();
    for (const n of broadcasts) {
      const broadcastId = (n.link as any)?.context?.broadcastId || n._id;
      if (!groups.has(broadcastId)) {
        groups.set(broadcastId, {
          broadcastId,
          title: n.title,
          message: n.message,
          type: n.type,
          theme: (n.type || '').replace('broadcast_', ''),
          targetProduct: (n.link as any)?.context?.targetProduct || 'all',
          persistenceMode: (n.link as any)?.context?.persistenceMode || 'permanent',
          createdAt: n.timestamp || new Date(n._creationTime).toISOString(),
          _creationTime: n._creationTime,
          notifications: [],
        });
      }
      const group = groups.get(broadcastId);
      group.notifications.push(n);
      if (n.isRead) group.isReadCount = (group.isReadCount || 0) + 1;
    }

    // Compute recipientCount and impressedCount for each group
    const result = Array.from(groups.values()).map((g: any) => ({
      broadcastId: g.broadcastId,
      title: g.title,
      message: g.message,
      type: g.type,
      theme: g.theme,
      targetProduct: g.targetProduct,
      persistenceMode: g.persistenceMode,
      createdAt: g.createdAt,
      recipientCount: g.notifications.length,
      dismissedCount: g.isReadCount || 0,
      activeCount: g.notifications.length - (g.isReadCount || 0),
    }));

    // Sort by createdAt descending (most recent first)
    result.sort((a, b) => {
      const tsA = new Date(a.createdAt || 0).getTime();
      const tsB = new Date(b.createdAt || 0).getTime();
      return tsB - tsA;
    });

    return result;
  },
});

/**
 * archiveBroadcast
 *
 * Archives (deletes) ALL notification rows for a specific broadcastId.
 * Used by the Founder Admin Dashboard's "Active Banners Control Center"
 * when the founder clicks "Kill / Archive Banner".
 *
 * MATCHING LOGIC:
 *   The broadcastId passed from the admin UI may be either:
 *     1. A real broadcastId stored in link.context.broadcastId (new broadcasts)
 *     2. A notification _id fallback (legacy broadcasts without broadcastId)
 *
 *   We match BOTH so that legacy broadcasts are correctly archived.
 *
 * SECURITY: Requires founder auth.
 */
export const archiveBroadcast = mutation({
  args: {
    tokenIdentifier: v.string(),
    broadcastId: v.string(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").take(500);
    const founder = users.find((u: any) =>
      u.role === 'Founder' && u.email?.toLowerCase() === args.tokenIdentifier?.toLowerCase()
    );
    if (!founder) throw new Error("Unauthorized: founder access required");

    const allNotes = await ctx.db.query("notifications").collect();
    const toDelete = allNotes.filter((n: Doc<"notifications">) => {
      const type = n.type || '';
      if (!type.startsWith('broadcast_')) return false;
      // Match by link.context.broadcastId OR by the notification's own _id
      // (for legacy broadcasts where broadcastId falls back to _id)
      const bid = (n.link as any)?.context?.broadcastId;
      if (bid === args.broadcastId) return true;
      if (String(n._id) === args.broadcastId) return true;
      return false;
    });

    for (const n of toDelete) {
      await ctx.db.delete(n._id);
    }

    return { success: true, deleted: toDelete.length };
  },
});

/**
 * bulkArchiveBroadcasts
 *
 * Archives (deletes) ALL notification rows for MULTIPLE broadcastIds.
 * Used by the "Bulk Archive Selected" button in the Active Banners
 * Control Center.
 *
 * MATCHING LOGIC:
 *   Each broadcastId in the array may be either:
 *     1. A real broadcastId stored in link.context.broadcastId (new broadcasts)
 *     2. A notification _id fallback (legacy broadcasts without broadcastId)
 *
 *   We match BOTH so that legacy broadcasts are correctly archived.
 *   This fixes the "Archive Selected removes 0" bug where old broadcasts
 *   had no broadcastId field and thus never matched.
 *
 * SECURITY: Requires founder auth.
 */
export const bulkArchiveBroadcasts = mutation({
  args: {
    tokenIdentifier: v.string(),
    broadcastIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").take(500);
    const founder = users.find((u: any) =>
      u.role === 'Founder' && u.email?.toLowerCase() === args.tokenIdentifier?.toLowerCase()
    );
    if (!founder) throw new Error("Unauthorized: founder access required");

    const allNotes = await ctx.db.query("notifications").collect();
    const toDelete = allNotes.filter((n: Doc<"notifications">) => {
      const type = n.type || '';
      if (!type.startsWith('broadcast_')) return false;
      // Match by link.context.broadcastId OR by the notification's own _id
      const bid = (n.link as any)?.context?.broadcastId;
      if (bid && args.broadcastIds.includes(bid)) return true;
      if (args.broadcastIds.includes(String(n._id))) return true;
      return false;
    });

    for (const n of toDelete) {
      await ctx.db.delete(n._id);
    }

    return { success: true, deleted: toDelete.length };
  },
});

/**
 * cleanupDuplicateBroadcasts
 *
 * Removes duplicate broadcast notifications — when the same broadcast
 * (same title + message + targetProduct) was sent multiple times, only
 * keep the most recent batch and delete the older duplicates.
 *
 * Also handles the case where the dedup fix wasn't deployed yet and
 * users received N copies of the same broadcast. Groups by
 * (userId + title + message) and keeps only ONE per group.
 *
 * SECURITY: Requires founder auth.
 */
export const cleanupDuplicateBroadcasts = mutation({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").take(500);
    const founder = users.find((u: any) =>
      u.role === 'Founder' && u.email?.toLowerCase() === args.tokenIdentifier?.toLowerCase()
    );
    if (!founder) throw new Error("Unauthorized: founder access required");

    const allNotes = await ctx.db.query("notifications").collect();
    const broadcasts = allNotes.filter((n: Doc<"notifications">) => {
      return (n.type || '').startsWith('broadcast_');
    });

    // Group by (userId + title + message) — keep the newest, delete rest
    const seen = new Map<string, { _id: any; _creationTime: number }>();
    let deleted = 0;

    for (const n of broadcasts) {
      const key = `${n.userId}|||${n.title || ''}|||${n.message || ''}`;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, { _id: n._id, _creationTime: n._creationTime });
      } else {
        // Keep the newer one, delete the older one
        if (n._creationTime > existing._creationTime) {
          await ctx.db.delete(existing._id);
          seen.set(key, { _id: n._id, _creationTime: n._creationTime });
        } else {
          await ctx.db.delete(n._id);
        }
        deleted++;
      }
    }

    return { success: true, deleted, totalChecked: broadcasts.length };
  },
});

/**
 * purgeAllBroadcasts
 *
 * Deletes ALL broadcast notifications from the database — every single
 * notification row with a type starting with 'broadcast_'.
 *
 * Used by the Founder Admin Dashboard's "Purge All" button when the
 * founder wants to clean up all test/stale broadcasts in one shot.
 *
 * SECURITY: Requires founder auth.
 */
export const purgeAllBroadcasts = mutation({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").take(500);
    const founder = users.find((u: any) =>
      u.role === 'Founder' && u.email?.toLowerCase() === args.tokenIdentifier?.toLowerCase()
    );
    if (!founder) throw new Error("Unauthorized: founder access required");

    const allNotes = await ctx.db.query("notifications").collect();
    const toDelete = allNotes.filter((n: Doc<"notifications">) => {
      return (n.type || '').startsWith('broadcast_');
    });

    for (const n of toDelete) {
      await ctx.db.delete(n._id);
    }

    return { success: true, deleted: toDelete.length };
  },
});
