
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { resolveUserBySessionToken } from "./sessions";

/**
 * Simple recursive text chunker.
 */
function chunkText(text: string, size = 1000, overlap = 200): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        chunks.push(text.substring(start, Math.min(start + size, text.length)));
        start += size - overlap;
    }
    return chunks;
}

/**
 * Returns all firm docs and notes that need embedding — called from the client.
 * The client fetches this list, generates embeddings for each chunk, and stores them.
 *
 * ── ROUND QA (§3 estate isolation): this function was PUBLIC and took ANY
 * firmId — an anonymous caller who knew (or brute-forced) a firm id could
 * pull that firm's ENTIRE document + note corpus as plain text. It now
 * requires a live session whose firmId matches the requested firm.
 *
 * It stays a QUERY on purpose: the three client callers invoke it through
 * ConvexHttpClient.query(), whose /api/query endpoint only executes
 * queries — and Convex queries cannot write, so a cross-firm attempt is
 * DENIED (with the reason surfaced) rather than audit-logged. The deny is
 * the security fix; the anonymous caller never reaches firm data either
 * way.
 */
export const getSourcesForIndexing = query({
    args: { firmId: v.string(), sessionToken: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const caller = args.sessionToken
            ? await resolveUserBySessionToken(ctx, args.sessionToken)
            : null;
        if (!caller) {
            throw new Error(
                "Unauthenticated: a valid session is required to index firm sources."
            );
        }
        if (String(caller.firmId ?? "") !== String(args.firmId)) {
            throw new Error(
                "Unauthorized: you may only index sources for your own firm."
            );
        }

        // Use filter instead of withIndex to avoid the reported server error during collection
        // for these table types in this specific backend context.
        const docs = await ctx.db
            .query("documents")
            .filter((q) => q.eq(q.field("firmId"), args.firmId))
            .collect();

        const notes = await ctx.db
            .query("notePages")
            .filter((q) => q.eq(q.field("firmId"), args.firmId))
            .collect();

        // Return chunks from each source — ready for the client to embed
        const chunks: { text: string; sourceId: string; sourceType: string; title: string; chunkIndex: number }[] = [];

        for (const doc of docs) {
            if (!doc.content) continue;
            const docChunks = chunkText(doc.content);
            docChunks.forEach((chunk, i) => {
                chunks.push({
                    text: chunk,
                    sourceId: doc._id,
                    sourceType: "document",
                    title: doc.title || "Untitled Document",
                    chunkIndex: i,
                });
            });
        }

        for (const note of notes) {
            if (!note.content) continue;
            const noteChunks = chunkText(note.content);
            noteChunks.forEach((chunk, i) => {
                chunks.push({
                    text: chunk,
                    sourceId: note._id,
                    sourceType: "note",
                    title: note.title || "Untitled Note",
                    chunkIndex: i,
                });
            });
        }

        return chunks;
    },
});
