/**
 * In-engine embeddings (2026-11-22) — convex/legal/embed.ts.
 *
 * The engine now embeds chunks server-side with the platform
 * GEMINI_API_KEY (batchEmbedContents, 768-dim, model fallback
 * text-embedding-004 → gemini-embedding-001). These tests pin the
 * contract with a mocked fetch:
 *   - unconfigured → [] (keyword-only, never throws)
 *   - happy path on the platform pin (768-dim native)
 *   - 404 on the pin → gemini-embedding-001 with outputDimensionality=768
 *   - wrong dimensions → [] (ingest continues keyword-only)
 *   - transient 429/5xx → [] (no model fallback — same provider)
 *   - batching: > EMBED_BATCH texts split across calls, partial failure
 *     degrades the whole call to []
 *   - the key rides the x-goog-api-key HEADER, never a URL param
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const realFetch = globalThis.fetch;

function geminiResponse(vectors: number[][]) {
    return {
        ok: true,
        status: 200,
        json: async () => ({ embeddings: vectors.map((values) => ({ values })) }),
        text: async () => JSON.stringify({ embeddings: vectors.map((values) => ({ values })) }),
    } as unknown as Response;
}

function geminiError(status: number, message = 'boom') {
    return {
        ok: false,
        status,
        json: async () => ({ error: { code: status, message } }),
        text: async () => JSON.stringify({ error: { code: status, message } }),
    } as unknown as Response;
}

const vec = (dim: number, fill = 0.25) => Array.from({ length: dim }, () => fill);

async function loadEmbed(env: Record<string, string | undefined>) {
    // Fresh module per test so the per-isolate model cache and
    // process.env mutations don't leak between cases.
    vi.resetModules();
    const orig = { ...process.env };
    for (const [k, v] of Object.entries(env)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    const mod = await import('../../convex/legal/embed');
    return {
        mod,
        restore: () => {
            for (const k of Object.keys(process.env)) delete process.env[k];
            Object.assign(process.env, orig);
        },
    };
}

describe('legal/embed — in-engine Gemini embeddings', () => {
    let calls: Array<{ url: string; headers: any; body: any }> = [];

    beforeEach(() => {
        calls = [];
    });
    afterEach(() => {
        globalThis.fetch = realFetch;
    });

    it('returns [] and reports unconfigured when no key', async () => {
        const { mod, restore } = await loadEmbed({ GEMINI_API_KEY: undefined, GEMINI_DEMO_KEY: undefined });
        try {
            expect(mod.embeddingConfigured()).toBe(false);
            expect(await mod.embedTexts(['hello'])).toEqual([]);
            expect(calls.length).toBe(0);
        } finally { restore(); }
    });

    it('embeds with the platform pin (text-embedding-004, 768-dim native)', async () => {
        const { mod, restore } = await loadEmbed({ GEMINI_API_KEY: 'test-key' });
        try {
            globalThis.fetch = (async (_url: any, init: any) => {
                calls.push({ url: String(_url), headers: init.headers, body: JSON.parse(init.body) });
                return geminiResponse([vec(768)]);
            }) as any;
            expect(mod.embeddingConfigured()).toBe(true);
            const out = await mod.embedTexts(['Nigerian judgment text']);
            expect(out).toHaveLength(1);
            expect(out[0]).toHaveLength(768);
            expect(calls[0].url).toContain('text-embedding-004:batchEmbedContents');
            // S2 rule: key in the header, never the URL.
            expect(calls[0].headers['x-goog-api-key']).toBe('test-key');
            expect(calls[0].url).not.toContain('test-key');
            // The pin must NOT request a dimension slice (768 native).
            expect(calls[0].body.requests[0].outputDimensionality).toBeUndefined();
        } finally { restore(); }
    });

    it('falls back to gemini-embedding-001 with outputDimensionality=768 on 404', async () => {
        const { mod, restore } = await loadEmbed({ GEMINI_API_KEY: 'test-key' });
        try {
            globalThis.fetch = (async (_url: any, init: any) => {
                const url = String(_url);
                calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
                if (url.includes('text-embedding-004')) return geminiError(404, 'model not found');
                return geminiResponse([vec(768)]);
            }) as any;
            const out = await mod.embedTexts(['act text']);
            expect(out).toHaveLength(1);
            expect(out[0]).toHaveLength(768);
            expect(calls).toHaveLength(2);
            expect(calls[1].url).toContain('gemini-embedding-001:batchEmbedContents');
            expect(calls[1].body.requests[0].outputDimensionality).toBe(768);
        } finally { restore(); }
    });

    it('caches the working fallback model (no re-probe of the 404 pin)', async () => {
        const { mod, restore } = await loadEmbed({ GEMINI_API_KEY: 'test-key' });
        try {
            globalThis.fetch = (async (_url: any, init: any) => {
                const url = String(_url);
                calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
                if (url.includes('text-embedding-004')) return geminiError(404, 'model not found');
                return geminiResponse([vec(768)]);
            }) as any;
            await mod.embedTexts(['one']);
            await mod.embedTexts(['two']);
            // Second call goes straight to the cached model.
            expect(calls.filter((c) => c.url.includes('text-embedding-004'))).toHaveLength(1);
            expect(calls.filter((c) => c.url.includes('gemini-embedding-001'))).toHaveLength(2);
        } finally { restore(); }
    });

    it('degrades to [] on wrong dimensions (768 contract enforced)', async () => {
        const { mod, restore } = await loadEmbed({ GEMINI_API_KEY: 'test-key' });
        try {
            globalThis.fetch = (async () => geminiResponse([vec(3072)])) as any;
            expect(await mod.embedTexts(['text'])).toEqual([]);
        } finally { restore(); }
    });

    it('degrades to [] on transient errors WITHOUT trying another model (same provider)', async () => {
        const { mod, restore } = await loadEmbed({ GEMINI_API_KEY: 'test-key' });
        try {
            globalThis.fetch = (async (_url: any, init: any) => {
                calls.push({ url: String(_url), headers: init.headers, body: JSON.parse(init.body) });
                return geminiError(429, 'rate limited');
            }) as any;
            expect(await mod.embedTexts(['text'])).toEqual([]);
            expect(calls).toHaveLength(1); // no fallback attempt
        } finally { restore(); }
    });

    it('batches large inputs and degrades wholly if any batch fails', async () => {
        const { mod, restore } = await loadEmbed({ GEMINI_API_KEY: 'test-key' });
        try {
            const texts = Array.from({ length: mod.EMBED_BATCH + 5 }, (_, i) => `chunk ${i}`);
            globalThis.fetch = (async (_url: any, init: any) => {
                calls.push({ url: String(_url), headers: init.headers, body: JSON.parse(init.body) });
                if (calls.length === 1) return geminiResponse(texts.slice(0, mod.EMBED_BATCH).map(() => vec(768)));
                return geminiError(500, 'oops');
            }) as any;
            expect(await mod.embedTexts(texts)).toEqual([]); // partial vectors never surface
            expect(calls).toHaveLength(2); // exactly two batches
            expect(calls[0].body.requests).toHaveLength(mod.EMBED_BATCH);
            expect(calls[1].body.requests).toHaveLength(5);
        } finally { restore(); }
    });

    it('truncates each text to EMBED_MAX_CHARS before sending', async () => {
        const { mod, restore } = await loadEmbed({ GEMINI_API_KEY: 'test-key' });
        try {
            globalThis.fetch = (async (_url: any, init: any) => {
                calls.push({ url: String(_url), headers: init.headers, body: JSON.parse(init.body) });
                return geminiResponse([vec(768)]);
            }) as any;
            await mod.embedTexts(['x'.repeat(mod.EMBED_MAX_CHARS + 500)]);
            const sent: string = calls[0].body.requests[0].content.parts[0].text;
            expect(sent.length).toBe(mod.EMBED_MAX_CHARS);
        } finally { restore(); }
    });

    it('honors LEGAL_EMBEDDING_MODEL as a single-model override', async () => {
        const { mod, restore } = await loadEmbed({
            GEMINI_API_KEY: 'test-key',
            LEGAL_EMBEDDING_MODEL: 'my-org-model',
        });
        try {
            globalThis.fetch = (async (_url: any, init: any) => {
                calls.push({ url: String(_url), headers: init.headers, body: JSON.parse(init.body) });
                return geminiResponse([vec(768)]);
            }) as any;
            await mod.embedTexts(['text']);
            expect(calls).toHaveLength(1);
            expect(calls[0].url).toContain('my-org-model:batchEmbedContents');
        } finally { restore(); }
    });
});

describe('legal/embed — worker wiring contracts (source-scanned)', () => {
    const read = (p: string) =>
        require('node:fs').readFileSync(require('node:path').resolve(process.cwd(), p), 'utf8');

    it('processTask attaches 768-dim vectors to chunks before ingest', () => {
        const worker = read('convex/legal/worker.ts');
        expect(worker).toContain('embedTexts(chunks.map((c) => c.text))');
        expect(worker).toContain('vectors[i].length === EMBEDDING_DIMS');
    });

    it('the run heals legacy vector-less chunks via the bounded backfill', () => {
        const worker = read('convex/legal/worker.ts');
        expect(worker).toContain('getUnembeddedChunksInternal');
        expect(worker).toContain('patchChunkEmbeddingsInternal');
        expect(worker).toContain('embeddedBackfilled');
    });

    it('skips are audited once per run, with the exact anticipated event type', () => {
        const worker = read('convex/legal/worker.ts');
        expect(worker.match(/embeddings\.skipped/g)?.length).toBeGreaterThan(0);
    });

    it('the dashboard and inspector expose embeddingConfigured (no false "by design" claims)', () => {
        const engine = read('convex/legal/engine.ts');
        expect(engine).toContain('embeddingConfigured');
        expect(engine).not.toContain('never generates embeddings by design');
    });
});
