
/**
 * ALOA Brain — Client-Side Brain Service
 *
 * Architecture: Client generates embeddings using the user's existing Gemini API key.
 * Only the resulting number vectors are sent to Convex for storage.
 * No server-side API key required in Convex at all.
 *
 * Usage:
 *   import { brain } from './brainService';
 *   await brain.ingestSource({ text, sourceId, sourceType, title, firmId });
 *   const context = await brain.search({ query, firmId, convexClient });
 */

import { generateEmbedding } from '../utils/aiUtils';
import { api } from '../../convex/_generated/api';

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

function chunkText(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        chunks.push(text.substring(start, Math.min(start + CHUNK_SIZE, text.length)));
        start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
    return chunks;
}

interface IngestArgs {
    text: string;
    sourceId: string;
    sourceType: 'document' | 'note';
    title: string;
    firmId: string;
    scope: 'legal' | 'property';
    convexMutation: (name: any, args: any) => Promise<any>;
    userId?: string;
}

interface SearchArgs {
    query: string;
    firmId: string;
    scope?: 'legal' | 'property';
    convexQuery: (name: any, args: any) => Promise<any>;
    limit?: number;
}

export const brain = {
    /**
     * Chunk a document/note and embed each chunk using the user's API key.
     * Stores vectors in Convex. Done entirely on the client — no server key needed.
     */
    async ingestSource({ text, sourceId, sourceType, title, firmId, scope, convexMutation, userId }: IngestArgs): Promise<void> {
        const chunks = chunkText(text);
        for (let i = 0; i < chunks.length; i++) {
            try {
                const embedding = await generateEmbedding(chunks[i]);
                await convexMutation(api.embeddings.addMemory, {
                    text: chunks[i],
                    embedding,
                    metadata: { sourceId, sourceType, title, chunkIndex: i },
                    firmId,
                    scope,
                    userId,
                });
            } catch (e) {
                console.error(`[Brain] Failed to index chunk ${i} of "${title}":`, e);
            }
        }
    },

    /**
     * Search the brain for the most relevant memories for a given query.
     * Embeds the query client-side, then performs a vector similarity search.
     * Returns formatted context string ready to be injected into the system prompt.
     */
    async search({ query, firmId, scope, convexQuery, limit = 8 }: SearchArgs): Promise<string> {
        try {
            const queryEmbedding = await generateEmbedding(query);
            const results: any[] = await convexQuery(api.embeddings.searchMemories, {
                queryEmbedding,
                firmId,
                scope,
                limit,
            });

            if (!results || results.length === 0) {
                return 'No relevant firm memories found for this query.';
            }

            return results
                .map((r) => `[From: ${r.metadata?.title || 'Untitled'} (${r.metadata?.sourceType})]:\n${r.text}`)
                .join('\n\n---\n\n');
        } catch (e) {
            console.error('[Brain] Search failed:', e);
            return 'Brain search encountered an error.';
        }
    },

    /**
     * Seed all existing firm data from Convex into the brain.
     * Fetches chunks server-side, embeds them client-side.
     */
    async seedFirm({
        firmId,
        scope,
        convexQuery,
        convexMutation,
        onProgress,
    }: {
        firmId: string;
        scope: 'legal' | 'property';
        convexQuery: (name: any, args: any) => Promise<any>;
        convexMutation: (name: any, args: any) => Promise<any>;
        onProgress?: (done: number, total: number) => void;
    }): Promise<{ indexed: number; errors: number }> {
        const chunks: any[] = await convexQuery(api.brainIngestion.getSourcesForIndexing, { firmId });
        let indexed = 0;
        let errors = 0;
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            try {
                const embedding = await generateEmbedding(chunk.text);
                await convexMutation(api.embeddings.addMemory, {
                    text: chunk.text,
                    embedding,
                    metadata: {
                        sourceId: chunk.sourceId,
                        sourceType: chunk.sourceType,
                        title: chunk.title,
                        chunkIndex: chunk.chunkIndex,
                    },
                    firmId,
                    scope,
                });
                indexed++;
            } catch (e) {
                console.error(`[Brain] Seed error on chunk ${i}:`, e);
                errors++;
            }
            onProgress?.(i + 1, chunks.length);
        }
        return { indexed, errors };
    },

    /**
     * Index specific items (e.g. after a save).
     */
    async indexItems({
        items,
        firmId,
        scope,
        convexMutation,
        userId
    }: {
        items: { text: string; sourceId: string; sourceType: 'document' | 'note'; title: string }[];
        firmId: string;
        scope: 'legal' | 'property';
        convexMutation: (name: any, args: any) => Promise<any>;
        userId?: string;
    }): Promise<void> {
        for (const item of items) {
            await this.ingestSource({
                ...item,
                firmId,
                scope,
                convexMutation,
                userId
            });
        }
    }
};
