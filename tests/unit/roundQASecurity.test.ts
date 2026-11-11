/**
 * roundQASecurity.test.ts — ROUND QA (§3 API access) acceptance suite.
 *
 * THE GAP THIS LOCKS IN: four PUBLIC Convex actions predated every
 * hardening round and shipped ungated to production —
 *   • ai.generateContent          — anonymous spend of the platform Gemini key
 *   • noteDictation.cleanTranscript — same pattern, dictation cleanup
 *   • webFetch.fetchUrlContent/searchWeb — unauthenticated open fetch/search proxy
 *   • brainIngestion.getSourcesForIndexing — ANY firmId returned that firm's
 *     ENTIRE document + note corpus as plain text (cross-tenant read)
 *
 * Every case drives the REAL handlers on a fixture-backed ctx (the
 * Round A/B/F/G/Sentry house pattern — zero reimplementation). Auth is
 * real: sessions rows carry SHA-256 token hashes, resolveUserBySessionToken
 * resolves through them, and the rate limiter is simulated exactly
 * (counter per key, window reset, hard stop at maxRequests).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateContent } from '../../convex/ai';
import { cleanTranscript } from '../../convex/noteDictation';
import { fetchUrlContent, searchWeb } from '../../convex/webFetch';
import { getSourcesForIndexing } from '../../convex/brainIngestion';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/ai.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

// ─── Fixture ctx (roundSentry harness, + a REAL rate limiter) ───────────────
type Row = Record<string, any>;

function makeCtx(tables: Record<string, Row[]>) {
    const CMP: Record<string, (a: any, b: any) => boolean> = {
        eq: (a, b) => String(a) === String(b),
        gte: (a, b) => Number(a) >= Number(b),
        lte: (a, b) => Number(a) <= Number(b),
        lt: (a, b) => Number(a) < Number(b),
        gt: (a, b) => Number(a) > Number(b),
        neq: (a, b) => String(a) !== String(b),
    };
    const findRows = (table: string, conds: Array<[string, string, any]>) =>
        (tables[table] ?? []).filter((r) => conds.every(([f, op, v]) => r[f] !== undefined && CMP[op](r[f], v)));
    const qFor = (r: Row) => {
        const q: any = { field: (name: string) => r[name] };
        for (const op of Object.keys(CMP)) q[op] = (a: any, b: any) => CMP[op](a, b);
        return q;
    };
    const chainFor = (rows: Row[]) => {
        const chain: any = {
            first: async () => rows[0] ?? null,
            unique: async () => rows[0] ?? null,
            collect: async () => rows,
            take: async (n: number) => rows.slice(0, n),
            order: (_d: string) => chain,
            filter: (fn: any) => chainFor(rows.filter((r) => fn(qFor(r)) !== false)),
        };
        return chain;
    };
    const db: any = {
        query: (table: string) => ({
            withIndex: (_name: string, fn: (q: any) => any) => {
                const conds: Array<[string, string, any]> = [];
                const q: any = { eq: (field: string, value: any) => { conds.push([field, 'eq', value]); return q; } };
                fn(q);
                return chainFor(findRows(table, conds));
            },
            filter: (fn: any) => chainFor((tables[table] ?? []).filter((r) => fn(qFor(r)) !== false)),
            order: (_d: string) => chainFor(tables[table] ?? []),
            collect: async () => tables[table] ?? [],
            take: async (n: number) => (tables[table] ?? []).slice(0, n),
            first: async () => (tables[table] ?? [])[0] ?? null,
        }),
        get: async (id: any) => {
            for (const rows of Object.values(tables)) {
                const hit = rows.find((r) => String(r._id) === String(id));
                if (hit) return hit;
            }
            return null;
        },
        insert: async (table: string, value: any) => {
            const _id = `${table}_${(tables[table] ?? []).length + 1}_${Math.random().toString(36).slice(2, 7)}`;
            (tables[table] = tables[table] ?? []).push({ _id, ...value });
            return _id as any;
        },
        patch: async (id: any, patch: any) => {
            for (const rows of Object.values(tables)) {
                const hit = rows.find((r) => String(r._id) === String(id));
                if (hit) { Object.assign(hit, patch); return null; }
            }
            return null;
        },
        delete: async () => null,
    };

    // Rate limiter simulation — checkRateLimit's exact semantics.
    // (The anyApi function reference is an opaque null-proto object in
    // tests, so dispatch on the ARGS SHAPE: consumeRateLimit carries
    // {key, maxRequests}; logSecurityEventInternal carries {eventType}.)
    const rateState = new Map<string, { count: number; windowStart: number }>();
    const runMutation = vi.fn(async (_fnRef: any, args: any) => {
        if (args && typeof args.key === 'string' && typeof args.maxRequests === 'number') {
            const now = Date.now();
            const windowMs = args.windowMs ?? 60_000;
            const existing = rateState.get(args.key);
            if (!existing) {
                rateState.set(args.key, { count: 1, windowStart: now });
                return true;
            }
            if (now - existing.windowStart > windowMs) {
                rateState.set(args.key, { count: 1, windowStart: now });
                return true;
            }
            if (existing.count >= args.maxRequests) {
                await db.insert('securityEvents', {
                    eventType: 'rate_limit_exceeded', details: `Key: ${args.key}`,
                });
                return false;
            }
            existing.count += 1;
            return true;
        }
        if (args && typeof args.eventType === 'string') {
            await db.insert('securityEvents', {
                eventType: args.eventType, details: args.details ?? '',
            });
            return null;
        }
        return null;
    });

    return {
        ctx: {
            db,
            runMutation,
            runQuery: vi.fn(),
            runAction: vi.fn(),
            scheduler: { runAfter: vi.fn() },
            auth: { getUserIdentity: async () => null },
        },
        tables,
        rateState,
    };
}

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const SESSION_PLAIN = 'sess-qa-1111';
const OTHER_PLAIN = 'sess-qa-2222';

function baseTables(): Record<string, Row[]> {
    return {
        users: [
            { _id: 'users_qa_1', id: 'users_qa_1', name: 'QA Admin', email: 'qa@atrium.ng', role: 'Administrator', firmId: 'firm-1' },
            { _id: 'users_qa_2', id: 'users_qa_2', name: 'Other Firm', email: 'other@firm.ng', role: 'Administrator', firmId: 'firm-2' },
        ],
        sessions: [
            { _id: 'sess_qa_1', tokenHash: hashSessionToken(SESSION_PLAIN), userId: 'users_qa_1', expiresAt: NOW + DAY, revokedAt: null },
            { _id: 'sess_qa_2', tokenHash: hashSessionToken(OTHER_PLAIN), userId: 'users_qa_2', expiresAt: NOW + DAY, revokedAt: null },
        ],
        documents: [
            { _id: 'doc_1', firmId: 'firm-1', title: 'Tenancy Agreement — Palm Grove', content: 'LEASE AGREEMENT made this day between the Landlord and the Tenant. '.repeat(40) },
            { _id: 'doc_2', firmId: 'firm-2', title: 'Other Firm Doc', content: 'COMPETITOR SECRETS — never leak. '.repeat(20) },
        ],
        notePages: [
            { _id: 'note_1', firmId: 'firm-1', title: 'Site inspection', content: 'Inspected unit B14. Leak under kitchen sink. '.repeat(10) },
        ],
        securityEvents: [],
        rateLimits: [],
    };
}

// Gemini fetch mock: success payload shaped like Google's response.
const geminiOk = (text: string) => ({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    text: async () => '',
});

let fetchMock: any;
beforeEach(() => {
    fetchMock = vi.fn(async () => geminiOk('cleaned text'));
    (globalThis as any).fetch = fetchMock;
});
afterEach(() => {
    vi.restoreAllMocks();
});

const call = (fn: any, ctx: any, args: any) => (fn as any)._handler(ctx, args);

// ─── §3 acceptance: the AI proxy is session-gated + throttled ───────────────
describe('QA §3 — ai.generateContent: auth + throttle + payload bound', () => {
    it('rejects an anonymous caller (no session token)', async () => {
        const { ctx } = makeCtx(baseTables());
        await expect(call(generateContent, ctx, {
            modelName: 'gemini-2.5-flash', contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
        })).rejects.toThrow(/Unauthorized.*session/i);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects an invalid / unknown token', async () => {
        const { ctx } = makeCtx(baseTables());
        await expect(call(generateContent, ctx, {
            modelName: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
            sessionToken: 'not-a-real-token',
        })).rejects.toThrow(/Unauthorized.*session/i);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('serves a valid session and forwards the model call', async () => {
        const { ctx } = makeCtx(baseTables());
        const res = await call(generateContent, ctx, {
            modelName: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: 'Summarise this lease.' }] }],
            sessionToken: SESSION_PLAIN,
            firmGeminiApiKey: 'test-firm-key',
        });
        expect(res.candidates[0].content.parts[0].text).toBe('cleaned text');
        const calledUrl = fetchMock.mock.calls[0][0] as string;
        expect(calledUrl).toContain('generativelanguage.googleapis.com');
        expect(calledUrl).toContain('gemini-2.5-flash');
        expect(calledUrl).toContain('test-firm-key');
    });

    it('throttles at 30 generations/minute per user (31st call rejected)', async () => {
        const { ctx } = makeCtx(baseTables());
        const args = {
            modelName: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
            sessionToken: SESSION_PLAIN,
            firmGeminiApiKey: 'test-firm-key',
        };
        for (let i = 0; i < 30; i++) await call(generateContent, ctx, args);
        await expect(call(generateContent, ctx, args)).rejects.toThrow(/Rate limit/i);
    });

    it('refuses an oversized payload (>6 MB)', async () => {
        const { ctx } = makeCtx(baseTables());
        await expect(call(generateContent, ctx, {
            modelName: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: 'x'.repeat(6_000_001) }] }],
            sessionToken: SESSION_PLAIN,
        })).rejects.toThrow(/Payload too large/i);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

// ─── §3 acceptance: dictation cleanup is session-gated + bounded ────────────
describe('QA §3 — noteDictation.cleanTranscript: auth + bound', () => {
    it('rejects an anonymous caller', async () => {
        const { ctx } = makeCtx(baseTables());
        await expect(call(cleanTranscript, ctx, { rawTranscript: 'um the the lease' }))
            .rejects.toThrow(/Unauthorized.*session/i);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('serves a valid session', async () => {
        const { ctx } = makeCtx(baseTables());
        const res = await call(cleanTranscript, ctx, {
            rawTranscript: 'um the the lease agreement',
            contextHint: 'matter note',
            sessionToken: SESSION_PLAIN,
            firmGeminiApiKey: 'test-firm-key',
        });
        expect(res).toBe('cleaned text');
    });

    it('refuses a transcript over 200 KB', async () => {
        const { ctx } = makeCtx(baseTables());
        await expect(call(cleanTranscript, ctx, {
            rawTranscript: 'x'.repeat(200_001),
            sessionToken: SESSION_PLAIN,
        })).rejects.toThrow(/too large/i);
    });
});

// ─── §3 acceptance: the web proxy is session-gated + SSRF-guarded ───────────
describe('QA §3 — webFetch: auth + private-host refusal + throttle', () => {
    it('fetchUrlContent rejects an anonymous caller', async () => {
        const { ctx } = makeCtx(baseTables());
        await expect(call(fetchUrlContent, ctx, { url: 'https://example.com/doc' }))
            .rejects.toThrow(/Unauthorized.*session/i);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('searchWeb rejects an anonymous caller', async () => {
        const { ctx } = makeCtx(baseTables());
        await expect(call(searchWeb, ctx, { query: 'lagos tenancy law' }))
            .rejects.toThrow(/Unauthorized.*session/i);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses private/loopback/link-local hosts without fetching', async () => {
        const { ctx } = makeCtx(baseTables());
        for (const url of [
            'http://localhost:3210',
            'http://127.0.0.1/admin',
            'http://10.1.2.3/internal',
            'http://192.168.0.1/router',
            'http://172.16.0.1/panel',
            'http://169.254.169.254/latest/meta-data',
        ]) {
            const res = await call(fetchUrlContent, ctx, { url, sessionToken: SESSION_PLAIN });
            expect(res.success).toBe(false);
            expect(res.error).toBe('INVALID_URL');
        }
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('serves a public URL for a valid session', async () => {
        fetchMock.mockResolvedValue({
            ok: true, status: 200,
            headers: { get: (h: string) => (h === 'content-type' ? 'text/html' : null) },
            json: async () => ({}),
            text: async () => '<html><head><title>Lease Guide</title></head><body><p>Nigerian tenancy law…</p></body></html>',
        });
        const { ctx } = makeCtx(baseTables());
        const res = await call(fetchUrlContent, ctx, { url: 'https://example.com/lease', sessionToken: SESSION_PLAIN });
        expect(res.success).toBe(true);
        expect(res.title).toBe('Lease Guide');
    });

    it('throttles both proxy actions at 20/min per user (shared budget)', async () => {
        fetchMock.mockResolvedValue({
            ok: true, status: 200,
            headers: { get: (h: string) => (h === 'content-type' ? 'text/html' : null) },
            json: async () => ({}),
            text: async () => '<html><head><title>t</title></head><body><p>p</p></body></html>',
        });
        const { ctx } = makeCtx(baseTables());
        const args = { url: 'https://example.com/x', sessionToken: SESSION_PLAIN };
        for (let i = 0; i < 20; i++) await call(fetchUrlContent, ctx, args);
        await expect(call(fetchUrlContent, ctx, args)).rejects.toThrow(/Rate limit/i);
        await expect(call(searchWeb, ctx, { query: 'anything', sessionToken: SESSION_PLAIN }))
            .rejects.toThrow(/Rate limit/i);
    });
});

// ─── §3 acceptance: firm-scoped brain ingestion (the cross-tenant read) ─────
describe('QA §3 — brainIngestion.getSourcesForIndexing: auth + firm isolation', () => {
    it('rejects an anonymous caller even with a valid firmId', async () => {
        const { ctx } = makeCtx(baseTables());
        await expect(call(getSourcesForIndexing, ctx, { firmId: 'firm-1' }))
            .rejects.toThrow(/Unauthenticated/i);
    });

    it('returns ONLY the caller-firm sources, chunked, for a valid session', async () => {
        const { ctx } = makeCtx(baseTables());
        const chunks = await call(getSourcesForIndexing, ctx, {
            firmId: 'firm-1', sessionToken: SESSION_PLAIN,
        });
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.every((c: any) => c.sourceType === 'document' || c.sourceType === 'note')).toBe(true);
        // The chunk text must never contain the OTHER firm's content.
        expect(chunks.some((c: any) => c.text.includes('COMPETITOR SECRETS'))).toBe(false);
        // Both firm-1 sources are present (doc + note).
        expect(chunks.some((c: any) => c.title === 'Tenancy Agreement — Palm Grove')).toBe(true);
        expect(chunks.some((c: any) => c.title === 'Site inspection')).toBe(true);
    });

    it('rejects a cross-firm request (stays a QUERY — /api/query callers)', async () => {
        const { ctx, tables } = makeCtx(baseTables());
        await expect(call(getSourcesForIndexing, ctx, {
            firmId: 'firm-1', sessionToken: OTHER_PLAIN, // firm-2 user asking for firm-1
        })).rejects.toThrow(/Unauthorized.*own firm/i);
        // It stays a query: ConvexHttpClient.query() (/api/query) can only
        // execute queries — flipping it to a mutation would break all three
        // client callers. Queries cannot write, so there is no security
        // event row — the DENY is the fix.
        expect(tables.securityEvents.filter((e) => e.eventType === 'brain_ingestion_firm_mismatch').length).toBe(0);
    });
});

// ─── §3 source contracts: the build can no longer bake an AI key ────────────
describe('QA §3 — build-time AI-key channel closed (vite.config)', () => {
    const src = read('vite.config.ts');

    it('the client-visible define is pinned to the empty string', () => {
        expect(src).toContain("'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify('')");
        expect(src).toContain("'process.env.API_KEY': JSON.stringify('')");
        // The old env-reading form must be gone from the define block.
        expect(src).not.toContain("'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY");
    });

    it('a build with GEMINI_API_KEY in the environment FAILS loudly', () => {
        expect(src).toContain("command === 'build' && (env.GEMINI_API_KEY || env.API_KEY)");
        expect(src).toContain('Client bundles must not embed AI keys');
    });
});

// ─── §3 source contracts: every client call site forwards the bearer ────────
describe('QA §3 — client wiring: session bearer on every gated call site', () => {
    it('geminiService forwards the bearer on all three generateContent sites', () => {
        const src = read('src/services/geminiService.ts');
        const sites = src.split('api.ai.generateContent').length - 1;
        expect(sites).toBe(3);
        expect(src.split('sessionToken: readSessionBearer()').length - 1).toBe(3);
    });

    it('NoteEditor passes bearerToken to cleanTranscript', () => {
        const src = read('src/components/notes/NoteEditor.tsx');
        const callBlock = src.slice(src.indexOf('cleanTranscriptAction({'), src.indexOf('saveTranscripts({'));
        expect(callBlock).toContain('sessionToken: (bearerToken ?? undefined)');
    });

    it('AloaChat passes bearerToken to both webFetch actions', () => {
        const src = read('src/components/aloa/AloaChat.tsx');
        expect(src).toContain("api.webFetch.searchWeb, { query, sessionToken:");
        expect(src).toContain("api.webFetch.fetchUrlContent, { url, sessionToken:");
    });

    it('brainService forwards its sessionToken to getSourcesForIndexing', () => {
        const src = read('src/services/brainService.ts');
        expect(src).toContain('api.brainIngestion.getSourcesForIndexing');
        expect(src).toContain('sessionToken: sessionToken ?? undefined');
    });
});
