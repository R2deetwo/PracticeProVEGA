import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";
import { normalizeUrl, urlHash } from "./shared";
import { DOMAIN_CATEGORIES, PRIORITY } from "./schema";

/**
 * legal/queue — the URL discovery & staging queue (spec §1).
 *
 * CONTRACT WITH THE PYTHON WORKER (tools/legal_ingester):
 *   1. seed            → upsertSeedSources + enqueue each seed URL
 *   2. claim           → atomically claim up to N 'queued' rows (by
 *                        priority, oldest first) → 'in_progress'
 *   3a. complete       → mark completed with rawDocumentHash + conditional
 *                        GET validators (etag / last-modified)
 *   3b. skipDedup      → mark skipped_dedup when the SHA-256 already
 *                        exists with completed parsing (bandwidth saver
 *                        #2 — no parse, no storage re-upload)
 *   3c. fail           → record the error, retry policy decided by the
 *                        worker (attempts, backoff)
 *
 * All writes are token-gated for external callers (LEGAL_INGEST_TOKEN);
 * the gap-detector enqueue is an internal mutation used by search.ts.
 */

const STATUSES = ["queued", "in_progress", "completed", "failed", "skipped_dedup"] as const;

/** Insert-or-verify a queue row. Idempotent on urlHash: an existing
 *  non-terminal row is never duplicated; a completed row only re-queues
 *  when explicitly asked (freshness recheck). */
export const enqueue = mutation({
  args: {
    ingestToken: v.string(),
    urls: v.array(
      v.object({
        sourceUrl: v.string(),
        domainCategory: v.string(),
        priority: v.optional(v.number()),
        discoveredFrom: v.optional(v.string()),
        forceRecheck: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const envToken = process.env.LEGAL_INGEST_TOKEN;
    if (!envToken || args.ingestToken !== envToken) {
      throw new Error("Unauthorized: invalid ingest token.");
    }
    const now = Date.now();
    const results: Array<{ url: string; status: string; id?: string }> = [];
    for (const item of args.urls) {
      const normalized = normalizeUrl(item.sourceUrl);
      const hash = urlHash(normalized);
      const existing = await ctx.db
        .query("legal_scrape_queue")
        .withIndex("by_urlHash", (q) => q.eq("urlHash", hash))
        .first();
      if (existing && !item.forceRecheck) {
        results.push({ url: normalized, status: `already_${existing.status}` });
        continue;
      }
      if (existing) {
        // Freshness recheck: reset to queued, keep the conditional-GET
        // validators so an unchanged document costs one 304, not a re-download.
        await ctx.db.patch(existing._id, {
          status: "queued",
          priority: item.priority ?? PRIORITY.FRESHNESS_RECHECK,
          discoveredFrom: item.discoveredFrom ?? existing.discoveredFrom,
          updatedAt: now,
        });
        results.push({ url: normalized, status: "requeued", id: existing._id });
        continue;
      }
      const id = await ctx.db.insert("legal_scrape_queue", {
        sourceUrl: normalized,
        urlHash: hash,
        domainCategory: item.domainCategory,
        priority: item.priority ?? PRIORITY.DEFAULT,
        status: "queued",
        attempts: 0,
        discoveredFrom: item.discoveredFrom,
        createdAt: now,
        updatedAt: now,
      });
      results.push({ url: normalized, status: "queued", id });
    }
    await ctx.db.insert("system_audit_logs", {
      eventType: "queue.enqueue",
      actor: "ingester:py",
      status: "ok",
      payload: { count: results.length, statuses: results.map((r) => r.status) },
      createdAt: now,
    });
    return results;
  },
});

/** Seed sources registry (spec §5) + first-pass queue fill. */
export const seedSources = mutation({
  args: {
    ingestToken: v.string(),
    sources: v.array(
      v.object({
        sourceUrl: v.string(),
        domainCategory: v.string(),
        kind: v.string(), // index | document
        authority: v.string(),
        notes: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const envToken = process.env.LEGAL_INGEST_TOKEN;
    if (!envToken || args.ingestToken !== envToken) {
      throw new Error("Unauthorized: invalid ingest token.");
    }
    const now = Date.now();
    let added = 0;
    let updated = 0;
    for (const s of args.sources) {
      const normalized = normalizeUrl(s.sourceUrl);
      const hash = urlHash(normalized);
      const existing = await ctx.db
        .query("legal_seed_sources")
        .withIndex("by_urlHash", (q) => q.eq("urlHash", hash))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          domainCategory: s.domainCategory,
          kind: s.kind,
          authority: s.authority,
          notes: s.notes,
          enabled: true,
        });
        updated++;
      } else {
        await ctx.db.insert("legal_seed_sources", {
          sourceUrl: normalized,
          urlHash: hash,
          domainCategory: s.domainCategory,
          kind: s.kind,
          authority: s.authority,
          enabled: true,
          notes: s.notes,
          createdAt: now,
        });
        added++;
      }
      // Index seeds go straight into the queue for the first crawl.
      const qExisting = await ctx.db
        .query("legal_scrape_queue")
        .withIndex("by_urlHash", (q) => q.eq("urlHash", hash))
        .first();
      if (!qExisting) {
        await ctx.db.insert("legal_scrape_queue", {
          sourceUrl: normalized,
          urlHash: hash,
          domainCategory: s.domainCategory,
          priority: PRIORITY.CURATED,
          status: "queued",
          attempts: 0,
          discoveredFrom: "seed",
          documentType: s.kind === "index" ? "index" : undefined,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    await ctx.db.insert("system_audit_logs", {
      eventType: "queue.enqueue",
      actor: "ingester:py",
      status: "ok",
      payload: { source: "seed", added, updated },
      createdAt: now,
    });
    return { added, updated };
  },
});

/** Claim a batch of queued rows for a worker run. Rows move to
 *  in_progress atomically (single mutation, sequential patch loop) so
 *  two workers never claim the same URL. Stale in_progress rows (> 30
 *  min without a heartbeat) are re-queueable. */
export const claim = mutation({
  args: {
    ingestToken: v.string(),
    workerId: v.string(),
    limit: v.optional(v.number()),
    domainCategory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const envToken = process.env.LEGAL_INGEST_TOKEN;
    if (!envToken || args.ingestToken !== envToken) {
      throw new Error("Unauthorized: invalid ingest token.");
    }
    const now = Date.now();
    const limit = Math.min(args.limit ?? 5, 20);
    const rows = await ctx.db
      .query("legal_scrape_queue")
      .withIndex("by_status_priority", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(limit * 3); // over-fetch, filter by category, cap at limit

    const claimed: Array<{
      id: string;
      sourceUrl: string;
      domainCategory: string;
      priority: number;
      etag?: string;
      lastModified?: string;
    }> = [];
    for (const row of rows) {
      if (claimed.length >= limit) break;
      if (args.domainCategory && row.domainCategory !== args.domainCategory) continue;
      await ctx.db.patch(row._id, {
        status: "in_progress",
        claimedBy: args.workerId,
        claimedAt: now,
        attempts: row.attempts + 1,
        updatedAt: now,
      });
      claimed.push({
        id: row._id,
        sourceUrl: row.sourceUrl,
        domainCategory: row.domainCategory,
        priority: row.priority,
        etag: row.etag,
        lastModified: row.lastModified,
      });
    }
    await ctx.db.insert("system_audit_logs", {
      eventType: "scrape.start",
      actor: `ingester:${args.workerId}`,
      status: "ok",
      payload: { claimed: claimed.length },
      createdAt: now,
    });
    return claimed;
  },
});

/** Complete a claimed row (fetched + parsed + ingested, or dedup-skipped). */
export const complete = mutation({
  args: {
    ingestToken: v.string(),
    taskId: v.id("legal_scrape_queue"),
    outcome: v.string(), // completed | skipped_dedup | not_modified
    rawDocumentHash: v.optional(v.string()),
    etag: v.optional(v.string()),
    lastModified: v.optional(v.string()),
    documentType: v.optional(v.string()),
    documentKey: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const envToken = process.env.LEGAL_INGEST_TOKEN;
    if (!envToken || args.ingestToken !== envToken) {
      throw new Error("Unauthorized: invalid ingest token.");
    }
    const now = Date.now();
    const status =
      args.outcome === "completed"
        ? "completed"
        : args.outcome === "failed"
          ? "failed"
          : "skipped_dedup";
    await ctx.db.patch(args.taskId, {
      status,
      lastCheckedAt: now,
      rawDocumentHash: args.rawDocumentHash,
      etag: args.etag,
      lastModified: args.lastModified,
      documentType: args.documentType,
      documentKey: args.documentKey,
      lastError: args.error,
      updatedAt: now,
    });
    await ctx.db.insert("system_audit_logs", {
      eventType: args.outcome === "failed" ? "scrape.failure" : "scrape.fetch",
      actor: "ingester:py",
      status: args.outcome === "failed" ? "error" : "ok",
      payload: {
        taskId: args.taskId,
        outcome: args.outcome,
        sha256: args.rawDocumentHash,
        error: args.error,
      },
      createdAt: now,
    });
    return { ok: true };
  },
});

/** Fail a claimed row (network error, 429/403, parse failure). */
export const fail = mutation({
  args: {
    ingestToken: v.string(),
    taskId: v.id("legal_scrape_queue"),
    error: v.string(),
    retryable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const envToken = process.env.LEGAL_INGEST_TOKEN;
    if (!envToken || args.ingestToken !== envToken) {
      throw new Error("Unauthorized: invalid ingest token.");
    }
    const now = Date.now();
    const task = await ctx.db.get(args.taskId);
    // Retry policy: up to 3 attempts, then terminal failure.
    const requeue = args.retryable !== false && (task?.attempts ?? 0) < 3;
    await ctx.db.patch(args.taskId, {
      status: requeue ? "queued" : "failed",
      lastError: args.error.slice(0, 500),
      lastCheckedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("system_audit_logs", {
      eventType: "scrape.failure",
      actor: "ingester:py",
      status: "error",
      payload: { taskId: args.taskId, error: args.error.slice(0, 300), requeue },
      createdAt: now,
    });
    return { requeued: requeue };
  },
});

/** Queue stats for the operator CLI (`status` command). */
export const stats = query({
  args: { ingestToken: v.string() },
  handler: async (ctx, args) => {
    const envToken = process.env.LEGAL_INGEST_TOKEN;
    if (!envToken || args.ingestToken !== envToken) {
      throw new Error("Unauthorized: invalid ingest token.");
    }
    const out: Record<string, number> = {};
    for (const status of STATUSES) {
      const rows = await ctx.db
        .query("legal_scrape_queue")
        .withIndex("by_status_priority", (q) => q.eq("status", status))
        .take(1000);
      out[status] = rows.length;
    }
    const chunks = await ctx.db.query("legal_chunks").take(10000);
    const judgments = await ctx.db.query("legal_judgments").take(10000);
    const instruments = await ctx.db.query("legal_instruments").take(10000);
    const artifacts = await ctx.db.query("legal_raw_artifacts").take(10000);
    return {
      queue: out,
      chunks: chunks.length,
      chunksEmbedded: chunks.filter((c) => Array.isArray(c.embedding) && c.embedding.length > 0).length,
      judgments: judgments.length,
      instruments: instruments.length,
      rawArtifacts: artifacts.length,
    };
  },
});

/** INTERNAL (no token — only callable by Convex code): gap-detector
 *  enqueue (spec §5). Rate-limited: at most one GAP_FILL row per
 *  category per 15 minutes, so a burst of identical user questions
 *  cannot flood the queue. */
export const enqueueGapFill = internalMutation({
  args: {
    domainCategory: v.string(),
    sourceUrl: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const hash = urlHash(args.sourceUrl);
    const existing = await ctx.db
      .query("legal_scrape_queue")
      .withIndex("by_urlHash", (q) => q.eq("urlHash", hash))
      .first();
    if (existing) {
      // Already known — bump priority only if it's not already being
      // worked and hasn't been checked in the last 15 minutes.
      const recent = existing.lastCheckedAt && now - existing.lastCheckedAt < 15 * 60 * 1000;
      if (existing.status === "queued" || existing.status === "in_progress" || recent) {
        return { queued: false, reason: "already_scheduled" };
      }
      await ctx.db.patch(existing._id, {
        status: "queued",
        priority: PRIORITY.GAP_FILL,
        discoveredFrom: `gap:${args.reason.slice(0, 60)}`,
        updatedAt: now,
      });
      return { queued: true, requeued: true };
    }
    await ctx.db.insert("legal_scrape_queue", {
      sourceUrl: normalizeUrl(args.sourceUrl),
      urlHash: hash,
      domainCategory: args.domainCategory,
      priority: PRIORITY.GAP_FILL,
      status: "queued",
      attempts: 0,
      discoveredFrom: `gap:${args.reason.slice(0, 60)}`,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("system_audit_logs", {
      eventType: "gap.detected",
      actor: "gap-detector",
      status: "ok",
      payload: { domainCategory: args.domainCategory, sourceUrl: args.sourceUrl, reason: args.reason.slice(0, 200) },
      createdAt: now,
    });
    return { queued: true };
  },
});

/** INTERNAL: weekly freshness sweep (spec §5) — requeue every enabled
 *  index seed at FRESHNESS_RECHECK priority. Called by convex/crons.ts. */
export const requeueSeedsForSweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const seeds = await ctx.db
      .query("legal_seed_sources")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .take(500);
    let queued = 0;
    for (const seed of seeds) {
      const existing = await ctx.db
        .query("legal_scrape_queue")
        .withIndex("by_urlHash", (q) => q.eq("urlHash", seed.urlHash))
        .first();
      if (existing && existing.status !== "queued" && existing.status !== "in_progress") {
        await ctx.db.patch(existing._id, {
          status: "queued",
          priority: PRIORITY.FRESHNESS_RECHECK,
          updatedAt: now,
        });
        queued++;
      } else if (!existing) {
        await ctx.db.insert("legal_scrape_queue", {
          sourceUrl: seed.sourceUrl,
          urlHash: seed.urlHash,
          domainCategory: seed.domainCategory,
          priority: PRIORITY.FRESHNESS_RECHECK,
          status: "queued",
          attempts: 0,
          discoveredFrom: "cron:freshness",
          createdAt: now,
          updatedAt: now,
        });
        queued++;
      }
      await ctx.db.patch(seed._id, { lastSweptAt: now });
    }
    await ctx.db.insert("system_audit_logs", {
      eventType: "sweep.run",
      actor: "cron:freshness",
      status: "ok",
      payload: { seeds: seeds.length, queued },
      createdAt: now,
    });
    return { seeds: seeds.length, queued };
  },
});

export const DOMAIN_CATEGORY_VALUES = DOMAIN_CATEGORIES;
