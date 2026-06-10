
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
 */
export const getSourcesForIndexing = query({
    args: { firmId: v.string() },
    handler: async (ctx, args) => {
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
