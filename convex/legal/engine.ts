import { v } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireFounderCaller } from "../callerAuth";
import { urlHash } from "./shared";
import { PRIORITY } from "./schema";
import { classifyCategory, filterCandidateUrl } from "../../src/legal/ingestionEngine";

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
        // 2026-11-22: the engine embeds in-run with the platform key
        // (legal/embed.ts). True = vectors are being generated; the UI
        // explains 0-embedded as "pass pending/retrying", not "by design".
        embeddingConfigured: Boolean(
          process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 0,
        ),
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
    // 2026-11-22 STRICT FILTER: the founder's manual adds pass the same
    // gate as discovered links — the block-list always rejects junk
    // (cdn-cgi, cookie pages, blogs, assets…), and URLs off the legal
    // allow-list are refused WITH THE REASON so the founder knows what to
    // fix (e.g. link the .pdf directly instead of a viewer page).
    const verdict = filterCandidateUrl(args.url);
    if (!verdict.allowed) {
      return { queued: false, rejected: verdict.reason ?? "rejected by URL policy" };
    }
    const normalized = verdict.url;
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
      // Founder-curated entries keep their CURATED boost (3); direct
      // document links score even higher (DOC_LINK 2) via the verdict.
      priority: Math.min(PRIORITY.CURATED, verdict.priority),
      status: "queued",
      attempts: 0,
      discoveredFrom: `founder:${founder.email}`,
      documentType: verdict.kind === "index" ? "index" : undefined,
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

// ─── The inspector (2026-11-22: "no dead-end metric cards") ─────────────────
//
// FOUNDER CONTRACT: every metric card and queue bucket in the Ingestion
// view is clickable and opens an inspector drawer. This query returns the
// actual rows behind the number — where judgments/instruments/chunks/
// artifacts live, why chunks show "0 embedded", and the exact URL + error
// for every failed queue row.

const INSPECTOR_BUCKETS = [
  "judgments",
  "instruments",
  "chunks",
  "artifacts",
  "queued",
  "in_progress",
  "completed",
  "skipped_dedup",
  "failed",
] as const;

export const getIngestionInspector = query({
  args: { sessionToken: v.string(), bucket: v.string() },
  handler: async (ctx, args) => {
    await requireFounderCaller(ctx, { sessionToken: args.sessionToken });
    const bucket = args.bucket as (typeof INSPECTOR_BUCKETS)[number];
    if (!INSPECTOR_BUCKETS.includes(bucket)) {
      throw new Error(`Unknown inspector bucket "${args.bucket}".`);
    }

    // ── Corpus buckets: where ingested records live ────────────────────
    if (bucket === "judgments") {
      const rows = await ctx.db
        .query("legal_judgments")
        .withIndex("by_date", (q: any) => q.gte("dateDelivered", ""))
        .order("desc")
        .take(50);
      return {
        bucket,
        hint: "Stored in the legal_judgments table (Legal KB). ALOA cites these via the retrieval index — each row links the citation, court, parties and source URL.",
        rows: rows.map((j: any) => ({
          title: j.citation,
          sub: `${j.court} · delivered ${j.dateDelivered}`,
          sourceUrl: j.sourceUrl,
        })),
      };
    }
    if (bucket === "instruments") {
      const rows = await ctx.db
        .query("legal_instruments")
        .order("desc")
        .take(50);
      return {
        bucket,
        hint: "Stored in the legal_instruments table (Legal KB) — acts, regulations, rules of court and guidelines with their section structure.",
        rows: rows.map((i: any) => ({
          title: i.title,
          sub: `${String(i.instrumentType || "").replace(/_/g, " ")} · ${i.status} · ${i.issuingBody}`,
          sourceUrl: i.sourceUrl,
        })),
      };
    }
    if (bucket === "chunks") {
      const rows = await ctx.db
        .query("legal_chunks")
        .order("desc")
        .take(50);
      const total = await ctx.db.query("legal_chunks").take(1000);
      const embedded = total.filter(
        (c: any) => Array.isArray(c.embedding) && c.embedding.length > 0
      ).length;
      const embeddingConfigured = Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 0,
      );
      return {
        bucket,
        hint:
          embedded > 0
            ? `Stored in the legal_chunks table — the search index ALOA retrieves from (${embedded} of ${total.length} sampled rows carry 768-dim embeddings; keyword + vector search both active).`
            : embeddingConfigured
              ? "Stored in the legal_chunks table — keyword search works today, and the engine now embeds in-run with the platform Gemini key (768-dim). 0 embedded means the embedding pass has not completed yet; it runs every 15-minute cycle and backfills vector-less chunks — check back shortly."
              : "Stored in the legal_chunks table — keyword search (BM25-style) works today. 0 embedded because no GEMINI_API_KEY is configured in the Convex environment: set it (Settings → Environment Variables) and the engine will embed every chunk in-run and backfill the rest. This is a configuration gap, not a failure.",
        rows: rows.map((c: any) => ({
          title: c.heading || (c.boundaryPath || []).join(" › ") || c.documentKey,
          sub: `${c.documentType} · ${(c.boundaryPath || []).join(" › ") || "no boundary"} · ${c.tokenCount} tokens · ${Array.isArray(c.embedding) && c.embedding.length > 0 ? "embedded" : "not embedded (keyword-only)"}`,
          sourceUrl: c.sourceUrl,
        })),
      };
    }
    if (bucket === "artifacts") {
      const rows = await ctx.db
        .query("legal_raw_artifacts")
        .order("desc")
        .take(50);
      return {
        bucket,
        hint: "Stored in legal_raw_artifacts (metadata) + Convex file storage (bytes), content-addressed by SHA-256 — every document is stored ONCE and re-parses never re-fetch.",
        rows: rows.map((a: any) => ({
          title: `${String(a.sha256 || "").slice(0, 16)}… · ${a.contentType}`,
          sub: `${a.byteSize.toLocaleString("en-NG")} bytes · fetched ${a.fetchedAt ? new Date(a.fetchedAt).toISOString().slice(0, 10) : "?"} · parse ${a.parseStatus}`,
          sourceUrl: a.sourceUrl,
        })),
      };
    }

    // ── Queue buckets: the pipeline's live state ───────────────────────
    const rows = await ctx.db
      .query("legal_scrape_queue")
      .withIndex("by_status_priority", (q: any) => q.eq("status", bucket))
      .order("asc")
      .take(50);
    const hints: Record<string, string> = {
      queued: "Waiting for the next 15-minute run (or Run Now). Ordered by priority: gap fills → document links → curated → index discovery → freshness rechecks.",
      in_progress: "Claimed by a running worker — moves to completed/failed within the run.",
      completed: "Fetched and processed. Index pages harvest links; documents are parsed into judgments/instruments/chunks; unchanged pages short-circuit as dedup/304.",
      skipped_dedup: "Skipped without re-parsing — the SHA-256 already exists (identical content) or the server returned 304 Not Modified.",
      failed: "Terminal failures after 3 attempts. Each row carries the exact error (HTTP status, network/timeout, robots block or parse failure).",
    };
    return {
      bucket,
      hint: hints[bucket] ?? "",
      rows: rows.map((r: any) => ({
        title: r.sourceUrl,
        sub: [
          `attempts ${r.attempts}`,
          r.lastError ? `error: ${r.lastError}` : null,
          r.documentType ? `parsed as ${r.documentType}` : null,
          r.documentKey ? `key: ${r.documentKey}` : null,
          `priority ${r.priority}`,
          r.lastCheckedAt ? `checked ${new Date(r.lastCheckedAt).toISOString().slice(0, 16).replace("T", " ")} UTC` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        sourceUrl: r.sourceUrl,
      })),
    };
  },
});
