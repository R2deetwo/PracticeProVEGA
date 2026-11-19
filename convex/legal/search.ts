import { v } from "convex/values";
import { action, query, internalQuery, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  normalizeQuery,
  queryHash,
  rrfFuse,
  cacheTtlFor,
  isCacheFresh,
  computeConfidence,
  COVERAGE_GAP_NOTICE,
  type Confidence,
  type RankedId,
} from "./shared";
import { resolveUserBySessionToken } from "../sessions";

/**
 * legal/search — the hybrid retrieval engine (spec §4–§5).
 *
 * PIPELINE (per query):
 *   1. CACHE   legal_query_cache lookup on sha256(normalized|mode).
 *              Fresh hit → served instantly, hitCount++, no search, no
 *              LLM spend. This is what makes concurrent identical user
 *              queries free.
 *   2. DENSE   vector leg — ctx.vectorSearch over legal_chunks embeddings
 *              (768-dim), catching CONCEPTS ("can my landlord lock me
 *              out") even when no keyword matches.
 *   3. SPARSE  keyword leg — Convex full-text search index (BM25-style),
 *              nailing EXACT CITATIONS ("Section 330 CAMA 2020").
 *   4. FUSE    Reciprocal Rank Fusion (k=60) — scale-free rank fusion.
 *   5. WARN    hydrate top chunks; surface overruled/amended/stale flags
 *              from chunk.warnings + parent instrument status.
 *   6. GAP     low confidence → honest user notice + high-priority
 *              ingestion task auto-queued (rate-limited, internal).
 *
 * AUTH: this is deliberately NOT anonymous. Callers present EITHER a
 * valid session token (in-app ALOA/ARIA) or the LEGAL_INGEST_TOKEN
 * (operator tooling / CLI). A public rate-limited Q&A action is a
 * separate, later decision (see AloaAssistantFab's "not a live AI chat"
 * note) — the anonymous landing surface must not fund retrieval compute.
 */

/** A hydrated, citation-ready search result (strict grounding unit). */
export interface GroundedResult {
  chunkId: string;
  documentType: string;
  documentKey: string;
  boundaryPath: string[];
  heading: string;
  text: string;
  citations: string[];
  warnings: string[];
  sourceUrl: string;
  sha256: string;
  lastVerifiedAt: number;
  fusedScore: number;
  denseRank?: number;
  sparseRank?: number;
}

export interface HybridSearchResult {
  query: string;
  results: GroundedResult[];
  legs: { dense: number; sparse: number };
  cached: boolean;
  confidence: Confidence;
  notice?: string;
  tookMs?: number;
}

const SEARCH_LEG_LIMIT = 25;
const DEFAULT_TOP_K = 8;
const EMBEDDING_DIMS = 768;

/** Authoritative roots the gap-detector auto-queues per domain category.
 *  Kept in lockstep with tools/legal_ingester/legal_ingester/seeds.py. */
const GAP_SEEDS: Record<string, string> = {
  judgments: "https://nigerialii.org",
  statutes: "https://nass.gov.ng",
  subsidiary: "https://nass.gov.ng",
  rules_of_court: "https://nigerialii.org",
  sec_regulations: "https://sec.gov.ng",
  electoral: "https://www.inecnigeria.org",
  index: "https://nigerialii.org",
};

function categoryForQuery(normalized: string): string {
  if (/(\bsec\b|capital market|securities)/.test(normalized)) return "sec_regulations";
  if (/(\binec\b|elect(oral|ion))/.test(normalized)) return "electoral";
  if (/rules? of court/.test(normalized)) return "rules_of_court";
  if (/(\bact\b|\bstatute\b|\blaw\b|\bsection\b|\bpart\b)/.test(normalized)) return "statutes";
  return "judgments";
}

export const hybridSearch = action({
  args: {
    query: v.string(),
    sessionToken: v.optional(v.string()),
    ingestToken: v.optional(v.string()),
    topK: v.optional(v.number()),
    /** Optional 768-dim query embedding (client-side Gemini path). The
     *  dense leg simply doesn't run without it — keyword-only retrieval
     *  still works, which keeps the engine useful pre-embedding setup. */
    queryEmbedding: v.optional(v.array(v.number())),
    documentType: v.optional(v.string()), // judgment | instrument
    actor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<HybridSearchResult> => {
    const started = Date.now();

    // ── AUTH: session (in-app) or ingest token (operator). ───────────────
    let actor = args.actor ?? "aloa";
    if (args.sessionToken) {
      const user = await resolveUserBySessionToken(ctx, args.sessionToken);
      if (!user) throw new Error("Unauthorized: invalid session.");
      actor = `user:${user._id}`;
    } else {
      const expected = process.env.LEGAL_INGEST_TOKEN;
      if (!expected || args.ingestToken !== expected) {
        throw new Error("Unauthorized: session token or ingest token required.");
      }
      actor = args.actor ?? "operator";
    }

    const normalized = normalizeQuery(args.query);
    if (!normalized) throw new Error("Query is empty after normalization.");
    const mode = "hybrid_search";
    const qHash = queryHash(normalized, mode);
    const topK = Math.min(args.topK ?? DEFAULT_TOP_K, 20);

    // ── 1. Cache check ──────────────────────────────────────────────────
    const cacheHit = await ctx.runQuery(internal.legal.search.findFreshCache, {
      queryHash: qHash,
      topK,
    });
    const now = Date.now();
    if (cacheHit && isCacheFresh(cacheHit.expiresAt, now)) {
      await ctx.runMutation(internal.legal.search.bumpCacheHit, { cacheId: cacheHit._id });
      await ctx.runMutation(internal.legal.audit.logInternal, {
        eventType: "cache.hit",
        actor,
        payload: { queryHash: qHash, hitCount: (cacheHit.hitCount ?? 0) + 1 },
      });
      return {
        ...cacheHit.payload,
        cached: true,
        confidence: cacheHit.confidence,
        notice: cacheHit.confidence === "coverage_gap" ? COVERAGE_GAP_NOTICE : undefined,
      };
    }
    await ctx.runMutation(internal.legal.audit.logInternal, {
      eventType: "cache.miss",
      actor,
      payload: { queryHash: qHash },
    });

    // ── 2. Dense leg (optional) ─────────────────────────────────────────
    let dense: RankedId<Id<"legal_chunks">>[] = [];
    const hasEmbedding =
      Array.isArray(args.queryEmbedding) && args.queryEmbedding.length === EMBEDDING_DIMS;
    if (hasEmbedding) {
      try {
        // NOTE: the dense leg runs unfiltered (vectorSearch filter typing
        // is per-builder); a documentType restriction is applied AFTER
        // fusion on the hydrated results, which also keeps rank blending
        // honest when both document types discuss a topic.
        const results = await ctx.vectorSearch("legal_chunks", "by_embedding", {
          vector: args.queryEmbedding as number[],
          limit: SEARCH_LEG_LIMIT,
        });
        dense = results.map((r) => ({ id: r._id, score: r._score }));
      } catch (err) {
        // A dense failure (e.g. no vectors ingested yet) must not kill
        // the keyword leg.
        await ctx.runMutation(internal.legal.audit.logInternal, {
          eventType: "search.query",
          actor,
          status: "error",
          payload: { stage: "dense", error: String(err).slice(0, 200) },
        });
      }
    }

    // ── 3. Sparse leg (Convex full-text / BM25-style) ───────────────────
    let sparse: RankedId<Id<"legal_chunks">>[] = [];
    try {
      const results = await ctx.runQuery(internal.legal.search.keywordSearch, {
        query: normalized,
        limit: SEARCH_LEG_LIMIT,
        documentType: args.documentType,
      });
      sparse = (results as Array<Doc<"legal_chunks">>).map((r) => ({ id: r._id }));
    } catch (err) {
      await ctx.runMutation(internal.legal.audit.logInternal, {
        eventType: "search.query",
        actor,
        status: "error",
        payload: { stage: "sparse", error: String(err).slice(0, 200) },
      });
    }

    // ── 4. RRF fusion ───────────────────────────────────────────────────
    const fused = rrfFuse(dense, sparse, { k: 60, denseWeight: 1, sparseWeight: 1 });
    const top = fused.slice(0, topK);

    // ── 5. Hydrate + warnings ───────────────────────────────────────────
    // Cast pins the element type: hydrateChunks is reached through
    // internal.legal.search (this same module), and that self-referential
    // route through the generated api now exceeds TS's inference budget,
    // degrading `hydrated` to any/{} (TS7006/TS2339). The handler on the
    // other side returns Array<Doc<"legal_chunks">> — same shape.
    const hydrated = (await ctx.runQuery(internal.legal.search.hydrateChunks, {
      ids: top.map((t) => t.id),
    })) as Array<Doc<"legal_chunks">>;
    const byId = new Map(hydrated.map((c) => [c._id, c]));
    const results = top
      .map((t) => {
        const chunk = byId.get(t.id);
        if (!chunk) return null;
        if (args.documentType && chunk.documentType !== args.documentType) return null;
        return {
          chunkId: chunk._id,
          documentType: chunk.documentType,
          documentKey: chunk.documentKey,
          boundaryPath: chunk.boundaryPath,
          heading: chunk.heading,
          text: chunk.text,
          citations: chunk.citations,
          warnings: chunk.warnings,
          sourceUrl: chunk.sourceUrl,
          sha256: chunk.rawDocumentHash,
          lastVerifiedAt: chunk.lastVerifiedAt,
          fusedScore: Number(t.fusedScore.toFixed(6)),
          denseRank: t.denseRank,
          sparseRank: t.sparseRank,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // ── 6. Confidence + gap detection ───────────────────────────────────
    const relevant = results.filter((r) => r.fusedScore >= 0.008);
    const confidence: Confidence = computeConfidence({
      resultCount: relevant.length,
      topFusedScore: results[0]?.fusedScore ?? 0,
      bothLegs: dense.length > 0 && sparse.length > 0,
    });
    let notice: string | undefined;
    if (confidence === "coverage_gap") {
      notice = COVERAGE_GAP_NOTICE;
      const category = categoryForQuery(normalized);
      await ctx.runMutation(internal.legal.queue.enqueueGapFill, {
        domainCategory: category,
        sourceUrl: GAP_SEEDS[category] ?? GAP_SEEDS.judgments,
        reason: normalized.slice(0, 200),
      });
    }

    const payload = {
      query: normalized,
      results: relevant.length > 0 ? results.slice(0, topK) : results.slice(0, topK),
      legs: { dense: dense.length, sparse: sparse.length },
    };

    // ── 7. Cache write (TTL by mode) ────────────────────────────────────
    const ttlMs = cacheTtlFor(mode) * 1000;
    await ctx.runMutation(internal.legal.search.storeCache, {
      queryHash: qHash,
      normalizedQuery: normalized,
      mode,
      payload,
      resultCount: payload.results.length,
      confidence,
      expiresAt: now + ttlMs,
    });

    await ctx.runMutation(internal.legal.audit.logInternal, {
      eventType: "search.query",
      actor,
      payload: {
        queryHash: qHash,
        dense: dense.length,
        sparse: sparse.length,
        fused: payload.results.length,
        confidence,
        tookMs: Date.now() - started,
      },
    });

    return { ...payload, cached: false, confidence, notice, tookMs: Date.now() - started };
  },
});

/** INTERNAL: fresh-cache lookup (payload returned verbatim). */
export const findFreshCache = internalQuery({
  args: { queryHash: v.string(), topK: v.number() },
  handler: async (ctx, args): Promise<Doc<"legal_query_cache"> | null> => {
    const rows = await ctx.db
      .query("legal_query_cache")
      .withIndex("by_queryHash", (q) => q.eq("queryHash", args.queryHash))
      .order("desc")
      .take(5);
    return rows.find((r) => isCacheFresh(r.expiresAt, Date.now()) && r.resultCount >= 0) ?? null;
  },
});

/** INTERNAL: keyword leg over the full-text search index. */
export const keywordSearch = internalQuery({
  args: { query: v.string(), limit: v.number(), documentType: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<Array<Doc<"legal_chunks">>> => {
    const rows = await ctx.db
      .query("legal_chunks")
      .withSearchIndex("search_text", (q) => q.search("text", args.query))
      .take(args.limit);
    return args.documentType ? rows.filter((r) => r.documentType === args.documentType) : rows;
  },
});

/** INTERNAL: hydrate chunk docs by id. */
export const hydrateChunks = internalQuery({
  args: { ids: v.array(v.id("legal_chunks")) },
  handler: async (ctx, args): Promise<Array<Doc<"legal_chunks">>> => {
    const out = [];
    for (const id of args.ids) {
      const doc = await ctx.db.get(id);
      if (doc) out.push(doc);
    }
    return out;
  },
});

/** INTERNAL: cache write (upsert on queryHash, newest wins). */
export const storeCache = internalMutation({
  args: {
    queryHash: v.string(),
    normalizedQuery: v.string(),
    mode: v.string(),
    payload: v.any(),
    resultCount: v.number(),
    confidence: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("legal_query_cache")
      .withIndex("by_queryHash", (q) => q.eq("queryHash", args.queryHash))
      .order("desc")
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        payload: args.payload,
        resultCount: args.resultCount,
        confidence: args.confidence,
        hitCount: 0,
        createdAt: now,
        expiresAt: args.expiresAt,
      });
      return existing._id;
    }
    return await ctx.db.insert("legal_query_cache", {
      queryHash: args.queryHash,
      normalizedQuery: args.normalizedQuery,
      mode: args.mode,
      payload: args.payload,
      resultCount: args.resultCount,
      confidence: args.confidence,
      hitCount: 0,
      createdAt: now,
      expiresAt: args.expiresAt,
    });
  },
});

/** INTERNAL: bump the hit counter on a served cache row. */
export const bumpCacheHit = internalMutation({
  args: { cacheId: v.id("legal_query_cache") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.cacheId);
    if (row) {
      await ctx.db.patch(args.cacheId, { hitCount: (row.hitCount ?? 0) + 1 });
    }
  },
});

/** INTERNAL: synthesis cache write — the AI-answer layer (when enabled)
 *  stores its strictly-cited synthesis here so identical questions skip
 *  LLM compute entirely (spec §4 "Synthesis Caching"). */
export const storeSynthesis = internalMutation({
  args: {
    queryHash: v.string(),
    normalizedQuery: v.string(),
    synthesis: v.string(),
    citationChunkIds: v.array(v.id("legal_chunks")),
    model: v.string(),
    tokensSpent: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + cacheTtlFor("synthesis") * 1000;
    const existing = await ctx.db
      .query("legal_query_cache")
      .withIndex("by_queryHash", (q) => q.eq("queryHash", args.queryHash))
      .order("desc")
      .first();
    const doc = {
      normalizedQuery: args.normalizedQuery,
      mode: "synthesis",
      payload: { synthesis: args.synthesis, citationChunkIds: args.citationChunkIds, model: args.model },
      resultCount: args.citationChunkIds.length,
      confidence: "high",
      hitCount: 0,
      createdAt: now,
      expiresAt,
    };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
    } else {
      await ctx.db.insert("legal_query_cache", { queryHash: args.queryHash, ...doc });
    }
    await ctx.db.insert("system_audit_logs", {
      eventType: "token.expenditure",
      actor: "synthesis",
      status: "ok",
      payload: { model: args.model, queryHash: args.queryHash },
      tokensSpent: args.tokensSpent,
      createdAt: now,
    });
    return { ok: true };
  },
});

/** Operator CLI probe: search with the ingest token (no session). */
export const searchAsOperator = query({
  args: {
    ingestToken: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const expected = process.env.LEGAL_INGEST_TOKEN;
    if (!expected || args.ingestToken !== expected) {
      throw new Error("Unauthorized: invalid ingest token.");
    }
    const normalized = normalizeQuery(args.query);
    const rows = await ctx.db
      .query("legal_chunks")
      .withSearchIndex("search_text", (q) => q.search("text", normalized))
      .take(args.limit ?? 10);
    return rows.map((r) => ({
      documentKey: r.documentKey,
      boundaryPath: r.boundaryPath,
      heading: r.heading,
      snippet: r.text.slice(0, 240),
      warnings: r.warnings,
      sourceUrl: r.sourceUrl,
    }));
  },
});
