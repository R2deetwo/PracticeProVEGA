/**
 * founderNotifications.ts — Van Clief-inspired unified notification helper.
 *
 * PROBLEM: Each mutation (submitSalesInquiry, createAddonRequest,
 * adminReplyToFeedback) had its own copy-pasted notification + FCM push
 * logic. This is the "automating the wrong layer" anti-pattern — the
 * notification chain should be ONE function, not duplicated across
 * 3+ mutations.
 *
 * SOLUTION: This single helper handles the entire chain:
 *   1. Find all founder users
 *   2. Create in-app notification records
 *   3. Fire FCM push notifications to registered devices
 *
 * Any mutation that needs to notify the founder calls ONE function:
 *   await notifyFounders(ctx, { title, message, type, link })
 *
 * 2026-09-14 round 2 — two silent-failure defects fixed:
 *   a) userId form: in-app rows and token lookups now use
 *      String(founder._id) consistently. The old code wrote the raw Id
 *      OBJECT into the `notifications` row while dispatchPushToUsers
 *      looked tokens up by the STRING form — the two representations
 *      could disagree, so rows landed without pushes and vice versa.
 *   b) Dispatch now routes through internal.pushNotifications.dispatchPushToUsers
 *      (channel auto-derivation from type, per-thread tag grouping,
 *      dead-token pruning) instead of a bespoke token query + sendFcmPush
 *      that skipped categorization entirely.
 */

import { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

export interface FounderNotificationPayload {
  title: string;
  message: string;
  type: string; // 'sales_lead' | 'addon_request' | 'new_signup' | 'feedback_user_reply' | etc.
  link?: {
    view: string;
    id: string | null;
    context: Record<string, any>;
  };
  /** Optional Android channel override; auto-derived from type otherwise. */
  channelId?: string;
  /** Optional per-thread tray grouping key (Android replaces the row). */
  tag?: string;
}

/**
 * Notifies ALL founder users of an event.
 * Creates in-app notifications + fires FCM push to registered devices.
 *
 * Usage (inside any Convex mutation):
 *   await notifyFounders(ctx, {
 *     title: "New Sales Lead",
 *     message: "ACME Corp requested Atrium",
 *     type: "sales_lead",
 *     link: { view: "sales", id: inquiryId, context: { inquiryId } },
 *   });
 */
export async function notifyFounders(
  ctx: MutationCtx,
  payload: FounderNotificationPayload,
): Promise<{ notified: number; pushed: number }> {
  // 1. Find all founder users
  const founders = await ctx.db
    .query("users")
    .filter((q: any) => q.eq(q.field("role"), "Founder"))
    .collect();

  let notified = 0;
  let pushed = 0;

  const founderIds = founders.map((f: any) => String(f._id));

  for (const founder of founders) {
    // 2. Create in-app notification (STRING userId — matches how
    //    registerPushToken stores it and how every reader looks it up)
    await ctx.db.insert("notifications", {
      firmId: "system",
      userId: String(founder._id),
      title: payload.title,
      message: payload.message,
      type: payload.type,
      link: payload.link || { view: "notifications", id: null, context: {} },
      timestamp: Date.now(),
      isRead: false,
    } as any);
    notified++;
  }

  // 3. Fire FCM push to founder devices via the shared dispatcher.
  //    Fire-and-forget: a push failure must never fail the caller's
  //    transaction (the in-app rows above are already committed).
  if (founderIds.length > 0) {
    try {
      await (ctx as any).runMutation(
        internal.pushNotifications.dispatchPushToUsers,
        {
          userIds: founderIds,
          title: payload.title,
          body: payload.message,
          data: {
            type: payload.type,
            view: payload.link?.view || "notifications",
            ...(payload.link?.id ? { id: String(payload.link.id) } : {}),
            ...(payload.link?.context || {}),
          },
          ...(payload.channelId ? { channelId: payload.channelId } : {}),
          ...(payload.tag ? { tag: payload.tag } : {}),
        }
      );
      pushed = founderIds.length;
    } catch (pushErr: any) {
      console.warn("[notifyFounders] Push failed:", pushErr?.message || pushErr);
    }
  }

  return { notified, pushed };
}
