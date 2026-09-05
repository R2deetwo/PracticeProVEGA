
import { v } from "convex/values";
import { mutation, query, action, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { requireStaffCaller } from "./callerAuth";

/**
 * Mutation to store a memory chunk.
 * The embedding is GENERATED CLIENT-SIDE using the user's existing Gemini API key.
 * Convex only stores the resulting vector — no API key required here.
 *
 * Round 8 auth retrofit: firmId used to be trusted as-is, so any internet
 * caller could poison or REPLACE another firm's AI memory chunks (the dedup
 * delete made this a replace primitive). The caller is now resolved against
 * the users table and firm-scoped.
 */
export const addMemory = mutation({
    args: {
        text: v.string(),
    sessionToken: v.optional(v.string()),
        embedding: v.array(v.number()), // Client sends the pre-computed vector
        metadata: v.any(),
        firmId: v.string(),
        scope: v.optional(v.string()),
        userId: v.optional(v.string()),
        userEmail: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireStaffCaller(ctx, { sessionToken: args.sessionToken,
            userId: args.userId,
            userEmail: args.userEmail,
            firmId: args.firmId,
        });

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
 * Vector similarity search — called from the client after the query embedding is generated.
 * firmId filter ensures strict data isolation between firms.
 *
 * Round 8 auth retrofit: the firmId filter was the ONLY scoping and was
 * caller-supplied — any caller could read another firm's memories by passing
 * that firmId. The caller is now resolved and firm-scoped.
 */
export const searchMemories = action({
    args: {
        queryEmbedding: v.array(v.number()),
    sessionToken: v.optional(v.string()),
        firmId: v.string(),
        scope: v.optional(v.string()),
        limit: v.optional(v.number()),
        userId: v.optional(v.string()),
        userEmail: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<Doc<"memories">[]> => {
        await requireStaffCaller(ctx, { sessionToken: args.sessionToken,
            userId: args.userId,
            userEmail: args.userEmail,
            firmId: args.firmId,
        });

        const limit = args.limit ?? 8;

        // Convex vectorSearch filters are limited; we'll filter by firmId here
        const results = await ctx.vectorSearch("memories", "by_embedding", {
            vector: args.queryEmbedding,
            limit: limit,
            filter: (q) => q.eq("firmId", args.firmId)
        });

        // Fetch the actual text/metadata for each result
        const memories: Doc<"memories">[] = await ctx.runQuery(internal.embeddings.fetchResultsByIds, { ids: results.map(r => r._id) });

        // Post-filter by scope if provided
        if (args.scope) {
            return memories.filter((m: Doc<"memories">) => m.scope === args.scope);
        }

        return memories;
    },
});

/**
 * INTERNAL: hydrate search results. Round 8 auth retrofit: was public —
 * raw-id reads let any caller fetch any firm's memory rows directly.
 * Only searchMemories (which has already verified the caller) uses it.
 */
export const fetchResultsByIds = internalQuery({
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
