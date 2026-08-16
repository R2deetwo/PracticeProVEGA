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
 * The context IS the orchestration — no complex state machine needed.
 */

import { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

export interface FounderNotificationPayload {
  title: string;
  message: string;
  type: string; // 'sales_lead' | 'addon_request' | 'feedback_reply' | 'feedback_user_reply' | etc.
  link?: {
    view: string;
    id: string | null;
    context: Record<string, any>;
  };
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

  for (const founder of founders) {
    // 2. Create in-app notification
    await ctx.db.insert("notifications", {
      firmId: "system",
      userId: founder._id,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      link: payload.link || { view: "notifications", id: null, context: {} },
      timestamp: new Date().toISOString(),
      isRead: false,
    } as any);
    notified++;

    // 3. Fire FCM push to founder's registered devices
    try {
      const tokens = await ctx.db
        .query("user_push_tokens")
        .filter((q: any) => q.eq(q.field("userId"), String(founder._id)))
        .filter((q: any) => q.eq(q.field("isActive"), true))
        .take(10);

      if (tokens.length > 0) {
        ctx.scheduler.runAfter(0, internal.pushNotificationsNode.sendFcmPush, {
          tokens: tokens.map((t: any) => t.token),
          title: payload.title,
          body: payload.message,
          data: {
            type: payload.type,
            view: payload.link?.view || "notifications",
            ...(payload.link?.context || {}),
          },
        });
        pushed += tokens.length;
      }
    } catch (pushErr) {
      console.warn("[notifyFounders] Push failed:", pushErr);
    }
  }

  return { notified, pushed };
}
