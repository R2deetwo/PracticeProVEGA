
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
    // ─── IDEMPOTENCY KEY ───────────────────────────────────────────────
    // Prevents duplicate feedback threads when the client double-clicks the
    // Submit button or retries after a network blip. If a feedback with the
    // same idempotencyKey already exists for this user, return its id without
    // inserting a new doc. Generate on the client with uuidv4() per submit
    // attempt (not per typing session).
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // ─── DEDUP CHECK ──────────────────────────────────────────────────
    // Scan recent feedback from this user for a matching idempotencyKey.
    // We scan by user (not index) because the schema doesn't have a composite
    // index on (userId, idempotencyKey) and adding one would require a migration.
    // 500 rows is enough to catch double-submit retries within ~minutes.
    if (args.idempotencyKey) {
      const recent = await ctx.db
        .query("user_feedback")
        .order("desc")
        .take(500);
      const existing = recent.find((f: any) =>
        f.userId === args.userId && f.idempotencyKey === args.idempotencyKey
      );
      if (existing) {
        return existing._id;
      }
    }

    const feedbackId = await ctx.db.insert("user_feedback", {
      ...args,
      status: "New",
      source: "feedback",
      timestamp: Date.now(),
    } as any);

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
    try {
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
      // ─── STRICT ISOLATION (v2) — Inverted Allowlist ───────────────────
      // The previous blocklist filter was BROKEN against leaked ALOA rows:
      // the old saveAloaMessage echo inserted rows with source=undefined,
      // type=undefined, title=undefined — which passed through the blocklist
      // because none of the excluded strings matched undefined.
      //
      // FIX: Use an allowlist. Only rows that look like legitimate feedback
      // are returned. A row is legitimate if:
      //   1. source === "feedback" (explicitly tagged), OR
      //   2. source === undefined BUT title AND type are set (legacy real
      //      feedback from before the source field existed), OR
      //   3. source is a known-good value ("feedback_form", etc.)
      //
      // A row is REJECTED if:
      //   - source is any non-feedback value (aloa_echo, search_log, etc.)
      //   - source is undefined AND title is undefined AND type is undefined
      //     (this is the fingerprint of a leaked ALOA echo)
      //   - message is empty
      const ALLOWED_SOURCES = ["feedback", "feedback_form", "data_restore"];
      let filtered = results.filter((item: any) => {
        // Empty message → reject
        if (!item.message || item.message.trim().length === 0) return false;
        // ─── SOFT-DELETE FILTER ─────────────────────────────────────────
        // Hide threads the user (or admin) has deleted. Founder can still see
        // these via getFeedbackListIncludingDeleted (audit-only query).
        if (item.deletedAt) return false;
        // Explicitly tagged non-feedback → reject
        if (item.source && !ALLOWED_SOURCES.includes(item.source)) return false;
        // Leaked ALOA echo fingerprint: no source, no title, no type → reject
        if (!item.source && !item.title && !item.type) return false;
        // Rows whose source contains 'aloa' or 'search' → reject (defense)
        if (item.source && (item.source.toLowerCase().includes('aloa') || item.source.toLowerCase().includes('search'))) return false;
        if (item.type && (item.type.toLowerCase().includes('aloa') || item.type.toLowerCase().includes('search log'))) return false;
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
    } catch (error: any) {
      console.error('[getFeedbackList] Error:', error);
      // Return empty array on any error — never throw to the client
      return [];
    }
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
    // Same inverted allowlist as getFeedbackList — blocks leaked ALOA
    // echoes (which have source=undefined, title=undefined, type=undefined)
    const ALLOWED_SOURCES = ["feedback", "feedback_form", "data_restore"];
    return all.filter((item: any) => {
      if (!item.message || item.message.trim().length === 0) return false;
      // Hide soft-deleted threads from the user's own inbox
      if (item.deletedAt) return false;
      if (item.source && !ALLOWED_SOURCES.includes(item.source)) return false;
      if (!item.source && !item.title && !item.type) return false;
      if (item.source && (item.source.toLowerCase().includes('aloa') || item.source.toLowerCase().includes('search'))) return false;
      return true;
    });
  },
});

/**
 * mutation: deleteFeedbackThread
 * Soft-deletes a user_feedback thread. Called by:
 *   - The user (deletes their own support thread from their inbox)
 *   - The founder/admin (deletes any user's thread from the admin inbox)
 *
 * Soft-delete preserves the audit trail — the row remains in the database
 * with deletedAt + deletedBy set, but is filtered out of all inbox queries.
 * The founder can query getFeedbackListIncludingDeleted for compliance review.
 *
 * AUTH:
 *   - User can only delete their OWN threads (verified by userEmail match).
 *   - Founder (practicepro.ng founder email) can delete any thread.
 */
export const deleteFeedbackThread = mutation({
  args: {
    feedbackId: v.id("user_feedback"),
    deletedBy: v.string(),  // user email OR 'admin'
    userEmail: v.optional(v.string()),  // for user-side auth
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) throw new Error("Feedback thread not found");

    // AUTH CHECK
    const FOUNDER_EMAILS = ['founder@practicepro.ng', 'admin@practicepro.ng'];
    const isFounder = args.userEmail && FOUNDER_EMAILS.includes(args.userEmail);
    if (!isFounder) {
      // Regular user — must own the thread
      if (args.userEmail && feedback.userEmail !== args.userEmail) {
        throw new Error("Not authorized to delete this thread");
      }
      if (!args.userEmail && args.deletedBy !== 'admin') {
        throw new Error("Authentication required to delete thread");
      }
    }

    // Already deleted? Return idempotent success
    if (feedback.deletedAt) {
      return { success: true, alreadyDeleted: true };
    }

    await ctx.db.patch(args.feedbackId, {
      deletedAt: Date.now(),
      deletedBy: args.deletedBy,
      status: 'Deleted',
    } as any);

    return { success: true };
  },
});

/**
 * mutation: restoreFeedbackThread
 * Reverses a soft-delete. Founder-only — used for compliance review or
 * accidental-deletion recovery.
 */
export const restoreFeedbackThread = mutation({
  args: {
    feedbackId: v.id("user_feedback"),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const FOUNDER_EMAILS = ['founder@practicepro.ng', 'admin@practicepro.ng'];
    if (!FOUNDER_EMAILS.includes(args.userEmail)) {
      throw new Error("Only founder can restore deleted threads");
    }
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) throw new Error("Feedback thread not found");

    await ctx.db.patch(args.feedbackId, {
      deletedAt: undefined,
      deletedBy: undefined,
      status: feedback.status === 'Deleted' ? 'Replied' : feedback.status,
    } as any);

    return { success: true };
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
    // CHANNEL TYPE — extensible field for future team channels.
    // Defaults to 'SUPPORT'. Supports: SUPPORT, FOUNDER, OPERATIONS,
    // BILLING, CUSTOMER_RELATIONS. Rendered as a badge on the message.
    channelType: v.optional(v.string()),
    // IDEMPOTENCY KEY — prevents duplicate message inserts when the
    // client retries due to network issues. If a reply with the same
    // idempotencyKey already exists on this feedback, the mutation
    // returns early without inserting a duplicate.
    idempotencyKey: v.optional(v.string()),
    // ─── REPLY CHANNEL TOGGLE ───────────────────────────────────────
    // When false (DEFAULT), the reply is delivered IN-APP ONLY — the
    // user sees it in their System Inbox the next time they open the app.
    // No email is sent.
    // When true, the reply is delivered in-app AND via email (Brevo).
    // This matches top-tier SaaS support desk conventions (Intercom,
    // Zendesk) where in-app is the default and email is an explicit
    // "also send via email" toggle.
    sendEmail: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) throw new Error("Feedback not found");

    const replies = (feedback as any).replies || [];

    // DEDUPLICATION — if idempotencyKey is provided, check if a reply
    // with the same key already exists. If so, return early without
    // inserting a duplicate. This prevents double-messages when the
    // client double-clicks or retries.
    if (args.idempotencyKey) {
      const existing = replies.find((r: any) => r.idempotencyKey === args.idempotencyKey);
      if (existing) {
        return { success: true, deduplicated: true };
      }
    }

    replies.push({
      adminId: args.adminId,
      message: args.message,
      timestamp: Date.now(),
      channelType: args.channelType || 'SUPPORT',
      idempotencyKey: args.idempotencyKey,
    });

    await ctx.db.patch(args.feedbackId, {
      status: "Replied",
      adminReply: args.message,
      replies
    } as any);

    // ─── FIX: notification payload now carries the feedbackId ───────
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

    // ─── Send Brevo email to the user (OPTIONAL) ────────────────────
    // Only sends if sendEmail is explicitly true AND the user has an
    // email on file. Default is in-app only (sendEmail = false/undefined).
    // This matches Intercom/Zendesk conventions: in-app is the default
    // delivery channel; email is an explicit "+ Email" toggle.
    if (args.sendEmail === true && feedback.userEmail) {
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
        htmlContent: `
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
                Open the PracticePro app - Messages - System Inbox to view the full conversation and reply.
              </p>
            </div>
          </div>
        ` as any,
      } as any);
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

/**
 * mutation: purgeLeakedAloaEchoes
 *
 * PRIVACY REMEDIATION — One-time cleanup of orphaned ALOA chat messages
 * that were leaked into the user_feedback table by the old saveAloaMessage
 * echo code. Those rows have:
 *   - source === undefined (not tagged)
 *   - title === undefined
 *   - type === undefined
 *   - status === "New"
 *
 * This mutation either DELETES them or re-tags them as "aloa_echo_purged"
 * (which the getFeedbackList filter hides). Default action: re-tag (safe,
 * preserves the data for audit without showing it to admins/users).
 *
 * Should be called ONCE from an authenticated admin context. After running,
 * the leaked rows will no longer appear in the Feedback Inbox or in users'
 * feedback reply lists.
 *
 * Args:
 *   - tokenIdentifier: founder auth token (verified against users table)
 *   - action: "retag" (default) or "delete"
 */
export const purgeLeakedAloaEchoes = mutation({
  args: {
    tokenIdentifier: v.string(),
    action: v.optional(v.string()), // "retag" | "delete", default "retag"
  },
  handler: async (ctx, args) => {
    // Verify caller is a Founder
    const founder = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", args.tokenIdentifier.toLowerCase()))
      .first();
    if (!founder || founder.role !== "Founder") {
      throw new Error("Unauthorized. Only Founders can purge leaked data.");
    }

    const action = args.action === "delete" ? "delete" : "retag";

    // Fetch all user_feedback rows — we need to scan for the leaked fingerprint
    const allFeedback = await ctx.db.query("user_feedback").take(2000);

    // Identify leaked ALOA echoes: no source, no title, no type
    const leakedRows = allFeedback.filter((item: any) =>
      !item.source && !item.title && !item.type
    );

    let processed = 0;
    for (const row of leakedRows) {
      if (action === "delete") {
        await ctx.db.delete(row._id);
      } else {
        // Re-tag as aloa_echo_purged — the filter will hide these
        await ctx.db.patch(row._id, {
          source: "aloa_echo_purged",
          status: "Archived",
        } as any);
      }
      processed++;
    }

    // Log the purge action to securityEvents for audit trail
    try {
      await ctx.db.insert("securityEvents", {
        eventType: "data_purge",
        userId: String(founder._id),
        email: args.tokenIdentifier,
        details: `purgeLeakedAloaEchoes: ${action} ${processed} rows`,
        timestamp: Date.now(),
      });
    } catch {}

    return {
      success: true,
      action,
      purgedCount: processed,
      message: `Successfully ${action === "delete" ? "deleted" : "re-tagged"} ${processed} leaked ALOA echo rows.`,
    };
  },
});
