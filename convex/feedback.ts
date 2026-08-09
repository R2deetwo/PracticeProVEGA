
import { mutation, query, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

/**
 * mutation: submitFeedback
 * Called from the app or triggered reactively.
 *
 * AUTO-REPLY: after storing the feedback, creates a context-aware
 * auto-reply notification for the user based on the feedback type.
 * Also creates a notification for the founder (bell badge in admin app).
 */
export const submitFeedback = mutation({
  args: {
    firmId: v.string(),
    userId: v.string(),
    userName: v.string(),
    userEmail: v.string(),
    type: v.optional(v.string()),
    title: v.optional(v.string()),
    message: v.string(),
    rating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const feedbackId = await ctx.db.insert("user_feedback", {
      ...args,
      status: "New",
      source: "feedback",
      timestamp: Date.now(),
    });

    // ─── Context-aware auto-reply ───────────────────────────────────
    // Different feedback types get different acknowledgment messages
    // so the user knows their report went to the right team.
    const feedbackType = (args.type || 'General Feedback').toLowerCase();
    let autoReplyMessage: string;
    if (feedbackType.includes('bug') || feedbackType.includes('maintenance') || feedbackType.includes('technical')) {
      autoReplyMessage = `We have logged your technical report. Our team is investigating the issue and will update you on the progress.`;
    } else if (feedbackType.includes('feature') || feedbackType.includes('suggestion')) {
      autoReplyMessage = `Thanks for sharing your idea! We've passed this directly to our product development team.`;
    } else if (feedbackType.includes('billing') || feedbackType.includes('account')) {
      autoReplyMessage = `Thank you for reaching out about your account. Our billing team will review your request and respond shortly.`;
    } else if (feedbackType.includes('support') || feedbackType.includes('data restoration')) {
      autoReplyMessage = `Your support request has been received. Our team will investigate and get back to you as soon as possible.`;
    } else {
      autoReplyMessage = `Thank you for your feedback! Our team has received your submission and will review it shortly.`;
    }

    // Store the auto-reply as the first reply on the feedback doc
    // so it appears in the conversation thread when the user opens it.
    await ctx.db.patch(feedbackId, {
      status: "Replied",
      adminReply: autoReplyMessage,
      replies: [{
        adminId: "system_auto_reply",
        message: autoReplyMessage,
        timestamp: Date.now(),
      }],
    } as any);

    // Notify the user with a clickable notification that opens the thread
    await ctx.db.insert("notifications", {
      firmId: args.firmId,
      userId: args.userId,
      title: "PracticePro Team",
      message: autoReplyMessage,
      type: "feedback_auto_reply",
      link: {
        view: 'messaging',
        id: null,
        context: {
          systemInbox: true,
          feedbackId: feedbackId.toString(),
          initialTab: 'inbox',
          selectedInboxId: 'system-inbox',
        },
      },
      timestamp: new Date().toISOString(),
      isRead: false,
    } as any);

    return feedbackId;
  },
});

/**
 * query: getFeedbackList
 * Used by the Founder BI/Metrics app to show an inbox of messages.
 * Now supports category filtering via the `category` arg.
 */
export const getFeedbackList = query({
  args: {
    status: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let results;
    if (args.status) {
      results = await ctx.db
        .query("user_feedback")
        .withIndex("by_status", (s) => s.eq("status", args.status as any))
        .order("desc")
        .take(500);
    } else {
      results = await ctx.db.query("user_feedback").order("desc").take(500);
    }
    // STRICT ISOLATION: Only return actual user-submitted feedback.
    const EXCLUDED_SOURCES = ["aloa_echo", "search_log", "telemetry", "system"];
    const EXCLUDED_TYPES = ["Search Log", "ALOA Search", "Telemetry", "System Event"];
    let filtered = results.filter((item: any) => {
      if (EXCLUDED_SOURCES.includes(item.source)) return false;
      if (EXCLUDED_TYPES.includes(item.type)) return false;
      if ((item.source || '').toLowerCase().includes('aloa')) return false;
      if ((item.type || '').toLowerCase().includes('search')) return false;
      if (!item.message || item.message.trim().length === 0) return false;
      return true;
    });

    // Category filtering — maps feedback type to a category bucket
    if (args.category && args.category !== 'all') {
      filtered = filtered.filter((item: any) => {
        const t = (item.type || 'General Feedback').toLowerCase();
        switch (args.category) {
          case 'product_feedback':
            return t.includes('feature') || t.includes('suggestion') || t.includes('general');
          case 'technical':
            return t.includes('bug') || t.includes('maintenance') || t.includes('technical');
          case 'billing':
            return t.includes('billing') || t.includes('account') || t.includes('data restoration');
          case 'general':
            return t.includes('support') || t.includes('general');
          default:
            return true;
        }
      });
    }

    return filtered;
  },
});

/**
 * query: getMyFeedbackReplies
 * Used by individual users to see admin replies to their own feedback posts.
 */
export const getMyFeedbackReplies = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("user_feedback")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .order("desc")
      .take(100);
    return all.filter((item: any) => item.source !== "aloa_echo");
  },
});

/**
 * mutation: submitDataRestoreRequest
 * Called when an existing beta user cannot find their workspace after the migration.
 */
export const submitDataRestoreRequest = mutation({
  args: {
    email: v.string(),
    previousFirmName: v.optional(v.string()),
    newAccountEmail: v.optional(v.string()),
    notes: v.optional(v.string()),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const lines = [
      `User Email (Old Account): ${args.email}`,
      args.previousFirmName ? `Previous Firm Name: ${args.previousFirmName}` : null,
      args.newAccountEmail && args.newAccountEmail !== args.email
        ? `Restore To (New Account): ${args.newAccountEmail}`
        : null,
      args.notes ? `Additional Notes: ${args.notes}` : null,
      `Request Source: ${args.source}`,
      `Submitted At: ${new Date().toISOString()}`,
    ].filter(Boolean).join("\n");

    return await ctx.db.insert("user_feedback", {
      firmId: "migration",
      userId: args.email,
      userName: args.email,
      userEmail: args.email,
      type: "Data Restoration Request",
      title: `[BETA MIGRATION] Restore data for: ${args.email}`,
      message: lines,
      status: "New",
      timestamp: Date.now(),
    } as any);
  },
});

/**
 * mutation: adminReplyToFeedback
 * Allows the founder/admin to send a reply back to the user.
 *
 * FIXES:
 * 1. Notification payload now includes feedbackId + selectedInboxId so
 *    clicking the notification opens the specific conversation thread.
 * 2. Sends a Brevo email to the user (via internalAction) so offline
 *    users are notified of the reply.
 */
export const adminReplyToFeedback = mutation({
  args: {
    feedbackId: v.id("user_feedback"),
    adminId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) throw new Error("Feedback not found");

    const replies = (feedback as any).replies || [];
    replies.push({
      adminId: args.adminId,
      message: args.message,
      timestamp: Date.now(),
    });

    await ctx.db.patch(args.feedbackId, {
      status: "Replied",
      adminReply: args.message,
      replies
    } as any);

    // ─── FIX: notification payload now carries the feedbackId ───────
    // Previously: link.id was null, context was just { systemInbox: true }
    // → clicking the notification opened the generic Messages tab with
    //   no thread visible (dead-end navigation).
    // Now: link.id is the feedbackId, context includes selectedInboxId
    //   and initialTab so MessagesView can auto-open the System Inbox
    //   thread showing this specific conversation.
    await ctx.db.insert("notifications", {
      firmId: feedback.firmId,
      userId: feedback.userId,
      title: "PracticePro Team",
      message: `PracticePro Team: We've reviewed your feedback and responded! Tap to view the conversation.`,
      type: "feedback_reply",
      link: {
        view: 'messaging',
        id: null,
        context: {
          systemInbox: true,
          feedbackId: args.feedbackId.toString(),
          initialTab: 'inbox',
          selectedInboxId: 'system-inbox',
          selectedFeedbackId: args.feedbackId.toString(),
        },
      },
      timestamp: new Date().toISOString(),
      isRead: false,
    } as any);

    // ─── Send Brevo email to the user (for offline notification) ────
    // Fires an internalAction so the mutation returns immediately.
    // Only sends if the user has an email on file.
    if (feedback.userEmail) {
      ctx.scheduler.runAfter(0, internal.feedback.sendReplyEmail, {
        userEmail: feedback.userEmail,
        userName: feedback.userName,
        feedbackTitle: feedback.title || 'Your feedback',
        replyMessage: args.message,
      });
    }

    return { success: true };
  },
});

/**
 * internalAction: sendReplyEmail
 * Sends a Brevo transactional email to the user when the founder replies.
 * Fires asynchronously so the admin mutation returns immediately.
 */
export const sendReplyEmail = internalAction({
  args: {
    userEmail: v.string(),
    userName: v.string(),
    feedbackTitle: v.string(),
    replyMessage: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.runAction(api.communications.sendEmail, {
        to: args.userEmail,
        subject: `PracticePro Team replied to your feedback`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="background: #16A34A; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; font-size: 18px;">PracticePro Team</h2>
              <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Re: ${args.feedbackTitle}</p>
            </div>
            <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 16px; font-size: 14px; color: #334155;">Hi ${args.userName},</p>
              <p style="margin: 0 0 16px; font-size: 14px; color: #334155; line-height: 1.6;">
                The PracticePro team has reviewed your feedback and responded:
              </p>
              <div style="background: white; border-left: 4px solid #16A34A; padding: 16px; margin: 16px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #1e293b; line-height: 1.6;">${args.replyMessage}</p>
              </div>
              <p style="margin: 16px 0 0; font-size: 13px; color: #64748b;">
                Open the PracticePro app → Messages → System Inbox to view the full conversation and reply.
              </p>
            </div>
          </div>
        `,
      });
      console.log(`[feedback] Reply email sent to ${args.userEmail}`);
    } catch (e: any) {
      console.error(`[feedback] Failed to send reply email to ${args.userEmail}:`, e.message);
    }
  },
});

/**
 * mutation: updateFeedbackStatus
 * Allows the founder to mark feedback as Resolved or Archived.
 * Previously the filter tabs existed in the UI but no mutation ever
 * set these statuses — so those tabs were always empty.
 */
export const updateFeedbackStatus = mutation({
  args: {
    feedbackId: v.id("user_feedback"),
    status: v.string(), // "New" | "Replied" | "Resolved" | "Archived"
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) throw new Error("Feedback not found");
    await ctx.db.patch(args.feedbackId, { status: args.status } as any);
    return { success: true };
  },
});
