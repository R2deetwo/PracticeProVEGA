
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * mutation: submitFeedback
 * Called from the app or triggered reactively.
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
    return await ctx.db.insert("user_feedback", {
      ...args,
      status: "New",
      source: "feedback",  // Explicitly tag as real user feedback
      timestamp: Date.now(),
    });
  },
});

/**
 * query: getFeedbackList
 * Used by the Founder BI/Metrics app to show an inbox of messages.
 */
export const getFeedbackList = query({
  args: { status: v.optional(v.string()) },
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
    // STRICT ISOLATION: Only return actual user feedback, not ALOA echoes
    // or any other telemetry/search logs that may have been stored here.
    return results.filter((item: any) => item.source !== "aloa_echo" && item.type !== "Search Log" && item.type !== "ALOA Search");
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
    // Filter out Aloa echo entries — those belong in the Aloa panel, not the System Inbox
    return all.filter((item: any) => item.source !== "aloa_echo");
  },
});

/**
 * mutation: submitDataRestoreRequest
 * Called when an existing beta user cannot find their workspace after the migration.
 * Records all fields needed for the founder to manually restore their firm data.
 *
 * ADMIN ACTION: When you receive this, go to the old keen-jaguar-204 project,
 * find the user's firm data, export it, and import it into the new project.
 * Then reply via adminReplyToFeedback to notify the user.
 */
export const submitDataRestoreRequest = mutation({
  args: {
    email: v.string(),
    previousFirmName: v.optional(v.string()),
    newAccountEmail: v.optional(v.string()),
    notes: v.optional(v.string()),
    source: v.string(), // 'login_page' | 'feedback_form'
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
 * This triggers an in-app notification for the user.
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

    // 1. Update feedback status and direct reply for simple BI dashboards
    await ctx.db.patch(args.feedbackId, {
      status: "Replied",
      adminReply: args.message,
      replies
    } as any);

    // 2. Alert the user with a notification
    await ctx.db.insert("notifications", {
      firmId: feedback.firmId,
      userId: feedback.userId,
      message: `PracticePro Team: We've reviewed your feedback and responded! View it in Messages.`,
      link: { view: 'messaging', id: null, context: { systemInbox: true } },
      timestamp: new Date().toISOString(),
      isRead: false
    } as any);

    return { success: true };
  },
});
