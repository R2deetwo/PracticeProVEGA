
import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import { Doc } from "./_generated/dataModel";

/**
 * Mutation to store a memory chunk.
 * The embedding is GENERATED CLIENT-SIDE using the user's existing Gemini API key.
 * Convex only stores the resulting vector — no API key required here.
 */
export const addMemory = mutation({
    args: {
        text: v.string(),
        embedding: v.array(v.number()), // Client sends the pre-computed vector
        metadata: v.any(),
        firmId: v.string(),
        scope: v.optional(v.string()),
        userId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Simple dedup: delete any old chunk from the same source at the same index.
        const existing = await ctx.db
            .query("memories")
            .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
            .filter((q) => q.eq(q.field("metadata.sourceId"), args.metadata?.sourceId))
            .filter((q) => q.eq(q.field("metadata.chunkIndex"), args.metadata?.chunkIndex))
            .first();

        if (existing) {
            await ctx.db.delete(existing._id);
        }

        await ctx.db.insert("memories", {
            text: args.text,
            embedding: args.embedding as number[] & { length: 768 },
            metadata: args.metadata,
            firmId: args.firmId,
            scope: args.scope,
            userId: args.userId,
        });
    },
});

/**
 * Delete all memories for a firm (used for re-seeding).
 */
export const clearFirmMemories = mutation({
    args: { firmId: v.string() },
    handler: async (ctx, args) => {
        const all = await ctx.db
            .query("memories")
            .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
            .collect();
        for (const m of all) {
            await ctx.db.delete(m._id);
        }
        return { deleted: all.length };
    },
});

/**
 * Vector similarity search — called from the client after the query embedding is generated.
 * firmId filter ensures strict data isolation between firms.
 */
export const searchMemories = action({
    args: {
        queryEmbedding: v.array(v.number()),
        firmId: v.string(),
        scope: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<Doc<"memories">[]> => {
        const limit = args.limit ?? 8;
        
        // Convex vectorSearch filters are limited; we'll filter by firmId here
        const results = await ctx.vectorSearch("memories", "by_embedding", {
            vector: args.queryEmbedding,
            limit: limit,
            filter: (q) => q.eq("firmId", args.firmId)
        });
        
        // Fetch the actual text/metadata for each result
        const memories: Doc<"memories">[] = await ctx.runQuery(api.embeddings.fetchResultsByIds, { ids: results.map(r => r._id) });
        
        // Post-filter by scope if provided
        if (args.scope) {
            return memories.filter((m: Doc<"memories">) => m.scope === args.scope);
        }
        
        return memories;
    },
});

export const fetchResultsByIds = query({
    args: { ids: v.array(v.id("memories")) },
    handler: async (ctx, args): Promise<Doc<"memories">[]> => {
        const results: Doc<"memories">[] = [];
        for (const id of args.ids) {
            const m = await ctx.db.get(id);
            if (m) results.push(m);
        }
        return results;
    },
});
