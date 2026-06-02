
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Persist an extraction checkpoint for large documents (100-335+ pages)
 */
export const saveCheckpoint = mutation({
  args: {
    sessionId: v.string(),
    sourceFile: v.string(),
    lastProcessedFrame: v.number(),
    totalFrames: v.number(),
    cumulativeText: v.string(),
    metadataSnapshot: v.any(),
    completedFrameIds: v.array(v.string()),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("index_checkpoints")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return await ctx.db.insert("index_checkpoints", args);
    }
  },
});

export const getCheckpoint = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("index_checkpoints")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();
  },
});

/**
 * Log a diagnostic event (Phase 6: Logging & Observability)
 */
export const logEvent = mutation({
  args: {
    firmId: v.string(),
    moduleKey: v.string(),
    action: v.string(),
    sourceType: v.string(),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("module_usage_logs", {
      ...args,
      loggedAt: new Date().toISOString(),
    });
  },
});

/**
 * Final Indexing: Push a completed case record to the Law Library
 */
export const publishRecord = mutation({
  args: {
    moduleKey: v.string(),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const record = {
      moduleKey: args.moduleKey,
      title: args.metadata.title,
      suitNumber: args.metadata.suitNumber,
      court: args.metadata.court,
      parties: args.metadata.title, // Simplified party mapping
      dateOfDelivery: args.metadata.dateDelivered,
      fullText: args.metadata.fullText,
      summary: args.metadata.headnote?.summary,
      tags: args.metadata.secondaryAreas || [],
      // AI Metadata from spec
      confidence: args.metadata.confidence,
    };

    return await ctx.db.insert("statutes", record);
  },
});

// ─────────────────────────────────────────────────────────────────
// ALOA-X: Indexed Document Persistence
// ─────────────────────────────────────────────────────────────────

/**
 * Save a fully processed ALOA-X indexed document to Convex.
 * Called once after all chunks are merged.
 */
export const saveAloaDocument = mutation({
  args: {
    sessionId: v.string(),
    firmId: v.optional(v.string()),
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
    // Check if a document with this sessionId already exists — if so, patch it
    const existing = await ctx.db
      .query("aloa_documents")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

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

/**
 * Get all ALOA-X indexed documents for a firm (or session-based if no firmId).
 */
export const getAloaDocuments = query({
  args: {
    firmId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.firmId) {
      return await ctx.db
        .query("aloa_documents")
        .withIndex("by_firmId", (q) => q.eq("firmId", args.firmId!))
        .order("desc")
        .take(100);
    }
    // Fallback: return recent docs (public session)
    return await ctx.db
      .query("aloa_documents")
      .withIndex("by_processedAt")
      .order("desc")
      .take(50);
  },
});

/**
 * Get a single ALOA-X document by session ID.
 */
export const getAloaDocument = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aloa_documents")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();
  },
});

/**
 * Delete an ALOA-X indexed document.
 */
export const deleteAloaDocument = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("aloa_documents")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (doc) {
      await ctx.db.delete(doc._id);
      return { success: true };
    }
    return { success: false, reason: "Document not found" };
  },
});

