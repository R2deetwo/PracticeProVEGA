
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireStaffCaller } from "./callerAuth";

// ─────────────────────────────────────────────────────────────────
// ALOA-X: Indexed Document Persistence
// ─────────────────────────────────────────────────────────────────
// Round 8 auth retrofit: this module previously exported EIGHT public
// functions (saveCheckpoint, logEvent, publishRecord, deleteAloaDocument,
// getCheckpoint, getAloaDocuments, getAloaDocument + saveAloaDocument) —
// all unauthenticated, and only saveAloaDocument had a caller. The dead
// writers let any internet caller insert/patch/delete rows (publishRecord
// injected statutes; deleteAloaDocument deleted any firm's indexed docs)
// and getAloaDocuments leaked recent documents firm-wide when firmId was
// omitted. All zero-caller functions were deleted; the one live mutation
// is now caller-verified and firm-scoped.

/**
 * Save a fully processed ALOA-X indexed document to Convex.
 * Called once after all chunks are merged.
 */
export const saveAloaDocument = mutation({
  args: {
    sessionId: v.string(),
    firmId: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    fileName: v.string(),
    documentType: v.string(),
    totalPages: v.number(),
    totalChunks: v.number(),
    indexData: v.any(),
    processedAt: v.number(),
    status: v.string(),
    confidence: v.optional(v.number()),
    confidenceReasons: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
    fullTextLength: v.optional(v.number()),
    fullText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: resolve the caller; when a firmId is supplied
    // it must be the caller's own firm (the upsert below patches ANY row
    // matching the sessionId, so a spoofed firmId/sessionId could have
    // rewritten another firm's indexed document).
    const caller = await requireStaffCaller(ctx, {
      userEmail: args.userEmail,
      firmId: args.firmId ?? undefined,
    });

    // Check if a document with this sessionId already exists — if so, patch it
    const existing = await ctx.db
      .query("aloa_documents")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    // Cross-firm upsert protection: a session id collision must never let
    // one firm overwrite another firm's indexed document.
    if (existing && existing.firmId && caller.firmId && String(existing.firmId) !== String(caller.firmId)) {
      throw new Error("Not authorized: document belongs to a different firm.");
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        indexData: args.indexData,
        status: args.status,
        processedAt: args.processedAt,
        fullTextLength: args.fullTextLength,
        fullText: args.fullText,
        confidence: args.confidence,
        confidenceReasons: args.confidenceReasons,
        metadata: args.metadata,
        totalChunks: args.totalChunks,
        fileName: args.fileName,
      });
      return existing._id;
    }

    return await ctx.db.insert("aloa_documents", args);
  },
});
