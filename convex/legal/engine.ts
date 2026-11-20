import { v } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireFounderCaller } from "../callerAuth";
import { normalizeUrl, urlHash } from "./shared";
import { PRIORITY } from "./schema";
import { classifyCategory } from "../../src/legal/ingestionEngine";

/**
 * legal/engine — the FOUNDER APK's control surface for the ingestion
 * engine (2026-11-19: "the ingestion engine is supposed to be in the
 * founder's app and work by itself").
 *
 * Every function here is session-gated (requireFounderCaller — the same
 * strict bearer verification as every other founder surface). The
 * founder's phone becomes the operations console:
 *
 *   getIngestionDashboard  → engine state, queue + corpus stats, seeds,
 *                            recent documents, the audit feed, gap events
 *   setIngestionEngineState→ ON/OFF toggle (+ tasks-per-run pacing); the
 *                            first enable auto-seeds the builtin sources
 *   runIngestionNow        → kick a worker run immediately (the 15-min
 *                            cron keeps it running by itself otherwise)
 *   toggleSeedSource       → enable/disable any seed source
 *   enqueueUrlForIngestion → add a specific URL to the queue by hand
 *
 * The Python CLI (tools/legal_ingester) remains a fully-compatible
 * operator client of the same queue — nothing about its contract changed.
 */

const QUEUE_STATUSES = ["queued", "in_progress", "completed", "failed", "skipped_dedup"] as const;

export const getIngestionDashboard = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireFounderCaller(ctx, { sessionToken: args.sessionToken });

    // ── engine state ────────────────────────────────────────────────────
    const state = await ctx.db.query("legal_engine_state").first();

    // ── queue stats (bounded take, mirroring queue.stats) ───────────────
    const queue: Record<string, number> = {};
    for (const status of QUEUE_STATUSES) {
      const rows = await ctx.db
        .query("legal_scrape_queue")
        .withIndex("by_status_priority", (q) => q.eq("status", status))
        .take(1000);
      queue[status] = rows.length;
    }

    // ── corpus stats ────────────────────────────────────────────────────
    const chunks = await ctx.db.query("legal_chunks").take(10000);
    const judgments = await ctx.db.query("legal_judgments").take(10000);
    const instruments = await ctx.db.query("legal_instruments").take(10000);
    const artifacts = await ctx.db.query("legal_raw_artifacts").take(10000);

    // ── seed sources (the founder's editable discovery roots) ───────────
    // 2026-11-20 OWNER BUG REPORT ("the paused button can't be toggled"):
    // this was an index RANGE filter (gte) on the BOOLEAN `enabled` field,
    // which Convex rejects at runtime (range filters need number/string/
    // bigint). The whole dashboard query threw on every poll, so the
    // founder view fell into its "backend not deployed" branch with a
    // dead toggle. A plain bounded scan is correct here (≤ a handful of
    // seed rows) and can never throw.
    const seeds = await ctx.db
      .query("legal_seed_sources")
      .order("asc")
      .take(100);

    // ── recent activity ─────────────────────────────────────────────────
    const recentAudit = await ctx.db
      .query("system_audit_logs")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(15);
    const recentJudgments = await ctx.db
      .query("legal_judgments")
      .withIndex("by_date", (q) => q.gte("dateDelivered", ""))
      .order("desc")
      .take(5);
    const recentInstruments = await ctx.db
      .query("legal_instruments")
      .order("desc")
      .take(5);

    // ── gap-detection pressure (what users asked for that we lack) ──────
    const gapEvents = await ctx.db
      .query("system_audit_logs")
      .withIndex("by_event_type", (q) => q.eq("eventType", "gap.detected"))
      .order("desc")
      .take(5);

    // ── next queued work preview ────────────────────────────────────────
    const queuedPreview = await ctx.db
      .query("legal_scrape_queue")
      .withIndex("by_status_priority", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(10);

    // 2026-11-20: when the state row does not exist yet (fresh deployment —
    // it is created on first toggle), return a DEFAULT OFF engine object
    // instead of null. The old null made the founder view's toggle guard
    // (`!dash?.engine` → silent return) a chicken-and-egg deadlock: the
    // only mutation that creates the row could never be invoked because
    // the row did not exist. The UI now always has an engine to toggle.
    const DEFAULT_ENGINE = {
      enabled: false,
      maxTasksPerRun: 4,
      autoSeedBuiltins: true,
      seededBuiltinsAt: null as number | null,
      lastRunAt: null as number | null,
      lastRunSummary: null as any,
      runsCount: 0,
    };

    return {
      engine: state
        ? {
            enabled: state.enabled,
            maxTasksPerRun: state.maxTasksPerRun,
            autoSeedBuiltins: state.autoSeedBuiltins,
            seededBuiltinsAt: state.seededBuiltinsAt ?? null,
            lastRunAt: state.lastRunAt ?? null,
            lastRunSummary: state.lastRunSummary ?? null,
            runsCount: state.runsCount ?? 0,
          }
        : DEFAULT_ENGINE,
      queue,
      corpus: {
        judgments: judgments.length,
        instruments: instruments.length,
        chunks: chunks.length,
        chunksEmbedded: chunks.filter((c: any) => Array.isArray(c.embedding) && c.embedding.length > 0).length,
        rawArtifacts: artifacts.length,
      },
      seeds: seeds.map((s: any) => ({
        id: s._id,
        sourceUrl: s.sourceUrl,
        domainCategory: s.domainCategory,
        kind: s.kind,
        authority: s.authority,
        enabled: s.enabled,
        lastSweptAt: s.lastSweptAt ?? null,
      })),
      recentAudit: recentAudit.map((a: any) => ({
        eventType: a.eventType,
        actor: a.actor,
        status: a.status,
        payload: a.payload,
        createdAt: a.createdAt,
      })),
      recentJudgments: recentJudgments.map((j: any) => ({
        citation: j.citation,
        court: j.court,
        dateDelivered: j.dateDelivered,
      })),
      recentInstruments: recentInstruments.map((i: any) => ({
        title: i.title,
        instrumentType: i.instrumentType,
        status: i.status,
      })),
      recentGaps: gapEvents.map((g: any) => ({
        payload: g.payload,
        createdAt: g.createdAt,
      })),
      queuedPreview: queuedPreview.map((q: any) => ({
        sourceUrl: q.sourceUrl,
        domainCategory: q.domainCategory,
        priority: q.priority,
        discoveredFrom: q.discoveredFrom ?? "",
      })),
    };
  },
});

export const setIngestionEngineState = mutation({
  args: {
    sessionToken: v.string(),
    enabled: v.boolean(),
    maxTasksPerRun: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const founder = await requireFounderCaller(ctx, { sessionToken: args.sessionToken });
    const now = Date.now();
    const clamp = (n: number) => Math.max(1, Math.min(8, Math.round(n)));

    const existing = await ctx.db.query("legal_engine_state").first();
    let seededNow = false;
    if (!existing) {
      await ctx.db.insert("legal_engine_state", {
        enabled: args.enabled,
        maxTasksPerRun: clamp(args.maxTasksPerRun ?? 4),
        autoSeedBuiltins: true,
        runsCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        ...(args.maxTasksPerRun !== undefined ? { maxTasksPerRun: clamp(args.maxTasksPerRun) } : {}),
        updatedAt: now,
      });
    }

    // First enable: seed the builtin authoritative sources so the engine
    // has something to chew on without any laptop involved.
    const state = await ctx.db.query("legal_engine_state").first();
    if (args.enabled && state?.autoSeedBuiltins && !state.seededBuiltinsAt) {
      await ctx.runMutation(internal.legal.worker.seedBuiltinSourcesInternal, {});
      seededNow = true;
    }

    await ctx.db.insert("system_audit_logs", {
      eventType: args.enabled ? "engine.enable" : "engine.disable",
      actor: `founder:${founder.email}`,
      status: "ok",
      payload: { enabled: args.enabled, seededBuiltins: seededNow },
      createdAt: now,
    });
    return { ok: true, seededBuiltins: seededNow };
  },
});

export const runIngestionNow = action({
  args: { sessionToken: v.string() },
  handler: async (ctx, args): Promise<{ scheduled: boolean }> => {
    await requireFounderCaller(ctx, { sessionToken: args.sessionToken });
    const state: any = await ctx.runQuery(internal.legal.worker.getEngineStateInternal, {});
    if (!state?.enabled) {
      throw new Error("The ingestion engine is paused — switch it on first.");
    }
    // Immediate run; the 15-minute cron is the standing heartbeat.
    await ctx.scheduler.runAfter(0, internal.legal.worker.runIngestionWorker, {});
    return { scheduled: true };
  },
});

export const toggleSeedSource = mutation({
  args: {
    sessionToken: v.string(),
    seedId: v.id("legal_seed_sources"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const founder = await requireFounderCaller(ctx, { sessionToken: args.sessionToken });
    const seed = await ctx.db.get(args.seedId);
    if (!seed) throw new Error("Seed source not found.");
    await ctx.db.patch(args.seedId, { enabled: args.enabled });
    await ctx.db.insert("system_audit_logs", {
      eventType: "seed.toggle",
      actor: `founder:${founder.email}`,
      status: "ok",
      payload: { seedUrl: seed.sourceUrl, enabled: args.enabled },
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const enqueueUrlForIngestion = mutation({
  args: {
    sessionToken: v.string(),
    url: v.string(),
    domainCategory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const founder = await requireFounderCaller(ctx, { sessionToken: args.sessionToken });
    const normalized = normalizeUrl(args.url);
    if (!/^https?:\/\//.test(normalized)) {
      throw new Error("Enter a full http(s) URL, e.g. https://nigerialii.org/…");
    }
    const hash = urlHash(normalized);
    const existing = await ctx.db
      .query("legal_scrape_queue")
      .withIndex("by_urlHash", (q) => q.eq("urlHash", hash))
      .first();
    if (existing) {
      return { queued: false, status: `already_${existing.status}` };
    }
    const category =
      args.domainCategory && QUEUE_CATEGORIES.includes(args.domainCategory as any)
        ? args.domainCategory
        : classifyCategory(normalized, "");
    const now = Date.now();
    await ctx.db.insert("legal_scrape_queue", {
      sourceUrl: normalized,
      urlHash: hash,
      domainCategory: category,
      priority: PRIORITY.CURATED,
      status: "queued",
      attempts: 0,
      discoveredFrom: `founder:${founder.email}`,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("system_audit_logs", {
      eventType: "queue.enqueue",
      actor: `founder:${founder.email}`,
      status: "ok",
      payload: { source: "founder", url: normalized, category },
      createdAt: now,
    });
    return { queued: true, category };
  },
});

const QUEUE_CATEGORIES = [
  "judgments",
  "statutes",
  "subsidiary",
  "rules_of_court",
  "sec_regulations",
  "electoral",
  "index",
];
