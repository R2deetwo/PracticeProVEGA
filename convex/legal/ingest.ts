import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { estimateTokens, urlHash } from "./shared";

/**
 * legal/ingest — document + chunk ingestion (spec §1–§4).
 *
 * TWO CALLERS, ONE CODE PATH:
 *   1. The external Python ingester (tools/legal_ingester) pushes parsed
 *      documents through the PUBLIC `ingestDocument` — gated by the
 *      LEGAL_INGEST_TOKEN shared secret (spec §2).
 *   2. The IN-CONVEX worker (convex/legal/worker.ts — the autonomous
 *      engine the Founder APK controls) calls `ingestDocumentInternal`
 *      directly; internal functions cannot be invoked by outsiders, so
 *      no token is needed for the platform's own engine.
 *
 * IDEMPOTENCE: chunks are keyed by (documentType, documentKey) — a
 * re-ingest of the same document replaces its chunks wholesale, so the
 * `reparse` command (parser upgrade, re-run from object storage, never
 * re-fetch) is a drop-in re-run of the same call.
 *
 * STRICT GROUNDING (spec §5): every chunk row carries sourceUrl +
 * rawDocumentHash + citations — ALOA/ARIA render inline citations from
 * these fields, and any assertion that cannot map to a chunk is refused
 * downstream (see search.ts).
 */

const TREATMENTS = ["applied", "distinguished", "overruled", "affirmed", "considered", "followed"];

function requireToken(presented: string | undefined): void {
  const expected = process.env.LEGAL_INGEST_TOKEN;
  if (!expected) {
    throw new Error("LEGAL_INGEST_TOKEN is not configured in this Convex deployment.");
  }
  if (presented !== expected) {
    throw new Error("Unauthorized: invalid ingest token.");
  }
}

/** Shared validators — the public and internal entry points stay in
 * lock-step by construction (one source of truth for the payload shape). */
const artifactValidator = v.object({
  sha256: v.string(),
  storageBackend: v.string(), // r2 | convex | local
  storageKey: v.string(),
  contentType: v.string(),
  byteSize: v.number(),
  sourceUrl: v.string(),
  fetchedAt: v.number(),
  parserVersion: v.optional(v.string()),
});
const judgmentValidator = v.optional(
  v.object({
    citation: v.string(),
    suitNumber: v.string(),
    court: v.string(),
    courtLevel: v.optional(v.string()),
    dateDelivered: v.string(),
    parties: v.array(v.object({ role: v.string(), name: v.string() })),
    judges: v.object({
      lead: v.array(v.string()),
      concurring: v.array(v.string()),
      dissenting: v.array(v.string()),
    }),
    counsel: v.array(v.object({ party: v.string(), names: v.string() })),
    ratioDecidendi: v.string(),
    obiterDicta: v.optional(v.string()),
    summary: v.optional(v.string()),
    statutesConsidered: v.array(v.string()),
    casesCited: v.array(
      v.object({ case: v.string(), treatment: v.string() }),
    ),
  }),
);
const instrumentValidator = v.optional(
  v.object({
    title: v.string(),
    key: v.string(),
    issuingBody: v.string(),
    instrumentType: v.string(),
    commencementDate: v.optional(v.string()),
    year: v.optional(v.number()),
    status: v.string(),
    structure: v.array(
      v.object({ level: v.string(), number: v.string(), heading: v.string() }),
    ),
    amendmentTracker: v.object({
      amended: v.boolean(),
      amendmentRefs: v.array(v.string()),
      repealed: v.boolean(),
      repealRef: v.optional(v.string()),
    }),
    summary: v.optional(v.string()),
  }),
);
const chunksValidator = v.array(
  v.object({
    boundaryPath: v.array(v.string()),
    heading: v.string(),
    text: v.string(),
    citations: v.optional(v.array(v.string())),
    warnings: v.optional(v.array(v.string())),
    embedding: v.optional(v.array(v.number())),
  }),
);

/** PUBLIC: token-gated entry for external callers (the Python ingester). */
export const ingestDocument = mutation({
  args: {
    ingestToken: v.string(),
    artifact: artifactValidator,
    judgment: judgmentValidator,
    instrument: instrumentValidator,
    chunks: chunksValidator,
  },
  handler: async (ctx, args): Promise<{
    ok: boolean;
    documentType: string;
    documentKey: string;
    chunksIngested: number;
    chunksEmbedded: number;
    artifactDeduped: boolean;
  }> => {
    requireToken(args.ingestToken);
    // Explicit return annotation above breaks the ApiFromModules circular
    // degradation (TS7022) — same lesson as legal/search.ts.
    return await ctx.runMutation(internal.legal.ingest.ingestDocumentInternal, {
      artifact: args.artifact,
      judgment: args.judgment,
      instrument: args.instrument,
      chunks: args.chunks,
      actor: "ingester:py",
    });
  },
});

/** INTERNAL: the core write path — also used by the in-Convex worker
 * (convex/legal/worker.ts), which passes actor "ingester:engine". */
export const ingestDocumentInternal = internalMutation({
  args: {
    artifact: artifactValidator,
    judgment: judgmentValidator,
    instrument: instrumentValidator,
    chunks: chunksValidator,
    actor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const actor = args.actor || "ingester:internal";

    if (!args.judgment && !args.instrument) {
      throw new Error("ingestDocument requires a judgment or an instrument.");
    }

    // ── 1. Artifact registration (content-addressed, immutable) ─────────
    const existingArtifact = await ctx.db
      .query("legal_raw_artifacts")
      .withIndex("by_sha256", (q) => q.eq("sha256", args.artifact.sha256))
      .first();
    let artifactId = existingArtifact?._id;
    if (!artifactId) {
      artifactId = await ctx.db.insert("legal_raw_artifacts", {
        sha256: args.artifact.sha256,
        storageBackend: args.artifact.storageBackend,
        storageKey: args.artifact.storageKey,
        contentType: args.artifact.contentType,
        byteSize: args.artifact.byteSize,
        sourceUrl: args.artifact.sourceUrl,
        fetchedAt: args.artifact.fetchedAt,
        parseStatus: "completed",
        parserVersion: args.artifact.parserVersion,
        lastParsedAt: now,
      });
    } else {
      // Parser upgrade path: same bytes, new extraction.
      await ctx.db.patch(artifactId, {
        parseStatus: "completed",
        parserVersion: args.artifact.parserVersion,
        lastParsedAt: now,
      });
    }

    // ── 2. Document upsert ──────────────────────────────────────────────
    let documentType: "judgment" | "instrument";
    let documentKey: string;
    if (args.judgment) {
      documentType = "judgment";
      documentKey = args.judgment.citation;
      const existing = await ctx.db
        .query("legal_judgments")
        .withIndex("by_citation", (q) => q.eq("citation", args.judgment!.citation))
        .first();
      const doc = {
        ...args.judgment,
        // Defensive normalization: unknown treatments never enter the table.
        casesCited: args.judgment.casesCited.filter(
          (c) => TREATMENTS.includes(c.treatment) || (c.treatment = "considered"),
        ),
        sourceUrl: args.artifact.sourceUrl,
        rawDocumentHash: args.artifact.sha256,
        lastVerifiedAt: now,
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, doc);
      } else {
        await ctx.db.insert("legal_judgments", { ...doc, createdAt: now });
      }
    } else if (args.instrument) {
      documentType = "instrument";
      documentKey = args.instrument.key;
      const existing = await ctx.db
        .query("legal_instruments")
        .withIndex("by_key", (q) => q.eq("key", args.instrument!.key))
        .first();
      const doc = {
        ...args.instrument,
        sourceUrl: args.artifact.sourceUrl,
        rawDocumentHash: args.artifact.sha256,
        lastVerifiedAt: now,
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, doc);
      } else {
        await ctx.db.insert("legal_instruments", { ...doc, createdAt: now });
      }
    } else {
      throw new Error("unreachable");
    }

    // ── 3. Chunk replacement (idempotent per document) ──────────────────
    const oldChunks = await ctx.db
      .query("legal_chunks")
      .withIndex("by_document", (q) =>
        q.eq("documentType", documentType).eq("documentKey", documentKey),
      )
      .collect();
    for (const c of oldChunks) await ctx.db.delete(c._id);

    let embedded = 0;
    for (const chunk of args.chunks) {
      if (chunk.embedding && chunk.embedding.length === 768) embedded++;
      await ctx.db.insert("legal_chunks", {
        documentType,
        documentKey,
        boundaryPath: chunk.boundaryPath,
        heading: chunk.heading,
        text: chunk.text,
        tokenCount: estimateTokens(chunk.text),
        embedding: chunk.embedding && chunk.embedding.length === 768 ? chunk.embedding : undefined,
        citations: chunk.citations ?? [],
        warnings: chunk.warnings ?? ["unverified"],
        sourceUrl: args.artifact.sourceUrl,
        rawDocumentHash: args.artifact.sha256,
        lastVerifiedAt: now,
        createdAt: now,
      });
    }

    // ── 4. Audit ────────────────────────────────────────────────────────
    await ctx.db.insert("system_audit_logs", {
      eventType: "ingest.document",
      actor,
      status: "ok",
      payload: {
        documentType,
        documentKey,
        sha256: args.artifact.sha256,
        chunks: args.chunks.length,
        embedded,
        artifactExisted: Boolean(existingArtifact),
      },
      tokensSpent: args.chunks.reduce((sum, c) => sum + estimateTokens(c.text), 0),
      createdAt: now,
    });

    return {
      ok: true,
      documentType,
      documentKey,
      chunksIngested: args.chunks.length,
      chunksEmbedded: embedded,
      artifactDeduped: Boolean(existingArtifact),
    };
  },
});

/** Pre-fetch dedup probe (spec §1): the worker asks BEFORE downloading
 *  whether this URL's validators (etag / last-modified) or hash are
 *  already known, and whether a completed artifact exists for them. */
export const dedupProbe = query({
  args: {
    ingestToken: v.string(),
    sourceUrl: v.string(),
    expectedSha256: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireToken(args.ingestToken);
    const hash = urlHash(args.sourceUrl);
    const task = await ctx.db
      .query("legal_scrape_queue")
      .withIndex("by_urlHash", (q) => q.eq("urlHash", hash))
      .first();
    let artifactCompleted = false;
    const expectedSha = args.expectedSha256;
    if (expectedSha) {
      const artifact = await ctx.db
        .query("legal_raw_artifacts")
        .withIndex("by_sha256", (q) => q.eq("sha256", expectedSha))
        .first();
      artifactCompleted = artifact?.parseStatus === "completed";
    }
    return {
      known: Boolean(task),
      etag: task?.etag,
      lastModified: task?.lastModified,
      lastCheckedAt: task?.lastCheckedAt,
      artifactCompleted,
      canSkipDownload: artifactCompleted,
    };
  },
});

/** INTERNAL dedup probe — same contract, callable by the in-Convex
 * worker without the external token. internalQuery: unreachable from
 * outside the deployment. */
export const dedupProbeInternal = internalQuery({
  args: {
    sourceUrl: v.string(),
    expectedSha256: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hash = urlHash(args.sourceUrl);
    const task = await ctx.db
      .query("legal_scrape_queue")
      .withIndex("by_urlHash", (q) => q.eq("urlHash", hash))
      .first();
    let artifactCompleted = false;
    if (args.expectedSha256) {
      const artifact = await ctx.db
        .query("legal_raw_artifacts")
        .withIndex("by_sha256", (q) => q.eq("sha256", args.expectedSha256!))
        .first();
      artifactCompleted = artifact?.parseStatus === "completed";
    }
    return {
      known: Boolean(task),
      etag: task?.etag,
      lastModified: task?.lastModified,
      lastCheckedAt: task?.lastCheckedAt,
      artifactCompleted,
      canSkipDownload: artifactCompleted,
    };
  },
});
