/**
 * aiAudit.ts — audit trail for AI outputs (Item 3 — trust signals).
 *
 * WHY THIS EXISTS: ALOA/ARIA responses were previously fire-and-forget —
 * nothing recorded WHAT the AI told a user, WHICH model produced it, or
 * HOW reliable it looked. "All AI outputs are audit-logged" is now a
 * hard guarantee: every finalized assistant response (chat, research,
 * draft paths) is written here by the client immediately after render,
 * before the message is even persisted to the conversation.
 *
 * WHAT IS LOGGED (deliberately bounded — full PII never lands here):
 *   assistant, model, conversationId, messageKind,
 *   confidence level + heuristic score, citation coverage counts,
 *   charCount, and a 400-char whitespace-collapsed preview.
 *
 * ACCESS: logAiOutput requires a verified firm session (same
 * requireFirmUser bearer-token protocol as the rest of the app) and
 * writes scoped to the authenticated firm. listAiOutputLogs is
 * firm-scoped and bounded (.take) — the same discipline Item 4 is
 * bringing to every query.
 *
 * RETENTION: append-only for clients; purge follows the 30-day
 * error_events policy when the retention cron is extended.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser } from "./authHelpers";

export const logAiOutput = mutation({
  args: {
    firmId: v.string(),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    assistant: v.string(),
    conversationId: v.optional(v.string()),
    messageKind: v.optional(v.string()),
    model: v.optional(v.string()),
    confidenceLevel: v.optional(v.string()),
    confidenceScore: v.optional(v.number()),
    citationCount: v.optional(v.number()),
    unverifiedCitationCount: v.optional(v.number()),
    charCount: v.optional(v.number()),
    preview: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: bearer-session proof only; firmId must match the session.
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    if (args.firmId && args.firmId !== auth.firmId) {
      throw new Error("Not authorized: cannot log AI output for a different firm.");
    }
    await ctx.db.insert("ai_output_logs", {
      firmId: auth.firmId,
      userId: args.userId || auth.userId,
      assistant: String(args.assistant || "AI").slice(0, 24),
      conversationId: args.conversationId?.slice(0, 80),
      messageKind: String(args.messageKind || "chat").slice(0, 24),
      model: args.model?.slice(0, 80),
      confidenceLevel: String(args.confidenceLevel || "unassessed").slice(0, 16),
      confidenceScore: args.confidenceScore,
      citationCount: args.citationCount,
      unverifiedCitationCount: args.unverifiedCitationCount,
      charCount: args.charCount,
      preview: args.preview?.slice(0, 400),
      loggedAt: Date.now(),
    });
    return true;
  },
});

/** Firm-scoped audit trail — most recent first, bounded to 200 rows. */
export const listAiOutputLogs = query({
  args: {
    firmId: v.string(),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    if (args.firmId && args.firmId !== auth.firmId) {
      throw new Error("Not authorized: cannot read another firm's AI audit log.");
    }
    const limit = Math.max(1, Math.min(200, Math.floor(args.limit ?? 50)));
    return await ctx.db
      .query("ai_output_logs")
      .withIndex("by_firm_logged", (q) => q.eq("firmId", auth.firmId))
      .order("desc")
      .take(limit);
  },
});
