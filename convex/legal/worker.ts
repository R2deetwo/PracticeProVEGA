import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { urlHash } from "./shared";
import { embedTexts, embeddingConfigured, EMBEDDING_DIMS } from "./embed";
import { PRIORITY } from "./schema";
import {
  robotsUrlFor,
  robotsAllows,
  rulesForUserAgent,
  type RobotRules,
  extractHtml,
  isPdfBody,
  classifyCategory,
  classifyDocumentType,
  chunkDocument,
  extractJudgmentMeta,
  buildInstrumentMeta,
  BUILTIN_SEED_SOURCES,
  filterCandidateUrl,
} from "../../src/legal/ingestionEngine";

/**
 * legal/worker — THE IN-CONVEX INGESTION ENGINE (2026-11-19).
 *
 * OWNER DIRECTIVE: the legacy ingestion engine (tools/legal_ingester — a
 * Python CLI) was supposed to move INTO the Founder APK and "work by
 * itself": crawl Nigerian legal sources continuously, whether or not any
 * laptop is open. This module is that port. The Python tool remains a
 * fully-compatible alternative client of the same queue (it holds the
 * LEGAL_INGEST_TOKEN); nothing about its contract changed.
 *
 * HOW IT RUNS BY ITSELF:
 *   convex/crons.ts registers `legalKbIngestionWorker` every 15 minutes →
 *   runIngestionWorker (internalAction). Each tick:
 *     1. reads the legal_engine_state singleton — disabled (or absent)
 *        → immediate no-op. The Founder APK's Ingestion view owns that
 *        toggle; pausing from the phone stops crawling within one cycle.
 *     2. seeds the builtin authoritative sources on first enable.
 *     3. claims up to `maxTasksPerRun` queued rows — AT MOST ONE PER
 *        DOMAIN per run (per-domain serialization, the politeness
 *        contract that replaces the Python worker's jittered locks).
 *     4. per task: robots.txt → conditional GET (304 = free) → SHA-256 →
 *        dedup probe → HTML extract → classify → chunk → metadata →
 *        raw artifact stored ONCE in Convex file storage →
 *        ingestDocumentInternal → complete/fail. Index pages harvest
 *        same-domain child links (max 25) back into the queue.
 *
 * HONEST BOUNDARIES (same philosophy as the corpus):
 *   - PDFs are DEFERRED (outcome pdf_deferred): no pypdf in Convex. The
 *     Python ingester with pypdf remains the full-fidelity PDF path.
 *   - Embeddings (2026-11-22 upgrade): generated IN-ENGINE with the
 *     platform GEMINI_API_KEY (legal/embed.ts) whenever that env var is
 *     set — same 768-dim contract as the Python tool, so chunks land
 *     with vectors and the dense search leg goes live on its own. No
 *     key → keyword-only (the old documented boundary), audited as
 *     embeddings.skipped and explained in the inspector. A bounded
 *     backfill pass also embeds pre-existing vector-less chunks.
 *   - Judgment metadata is heuristic; unfound fields stay UNKNOWN.
 *
 * Every step writes system_audit_logs (actor "ingester:engine").
 */

const ENGINE_UA =
  "PracticePro-LegalKB-Engine/1.0 (+autonomous in-app crawler; contact: founders@practicepro.ng)";
const FETCH_TIMEOUT_MS = 15_000;
const ROBOTS_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 2_000_000;
/** Raw links forwarded from one index page to the strict filter (nav/footer
 *  links die inside the filter, so the raw scan is wider than the yield;
 *  queue growth stays bounded by dedup + the one-page-per-domain pacing). */
const MAX_LINK_CANDIDATES_PER_INDEX = 200;
const MAX_ATTEMPTS = 3;

export interface EngineRunSummary {
  claimed: number;
  completed: number;
  failed: number;
  notModified: number;
  dedupSkipped: number;
  robotsSkipped: number;
  pdfDeferred: number;
  chunksIngested: number;
  documentsIngested: number;
  indexesHarvested: number;
  /** 2026-11-22 strict-filter round: junk queued URLs deleted by the
   *  pre-run purge (block-list/allow-list violators). */
  purgedBlocked: number;
  /** 2026-11-22 embedding round: chunks that reached storage WITH a
   *  768-dim vector this run (GEMINI_API_KEY configured). */
  chunksEmbedded: number;
  /** 2026-11-22 embedding round: legacy vector-less chunks given a
   *  vector by the bounded backfill pass. */
  embeddedBackfilled: number;
  durationMs: number;
  startedAt: number;
}

const emptySummary = (): EngineRunSummary => ({
  claimed: 0, completed: 0, failed: 0, notModified: 0, dedupSkipped: 0,
  robotsSkipped: 0, pdfDeferred: 0, chunksIngested: 0, documentsIngested: 0,
  indexesHarvested: 0, purgedBlocked: 0, chunksEmbedded: 0, embeddedBackfilled: 0,
  durationMs: 0, startedAt: Date.now(),
});

// ── Internal state access ───────────────────────────────────────────────────

export const getEngineStateInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("legal_engine_state").first();
  },
});

/** Claim queued rows for one engine run — priority order, oldest first,
 * AT MOST ONE PER DOMAIN (per-domain politeness without locks: two runs
 * can never hammer the same domain, and a run touches each domain once). */
export const claimForEngine = internalMutation({
  args: { workerId: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = Math.max(1, Math.min(args.limit, 8));
    const rows = await ctx.db
      .query("legal_scrape_queue")
      .withIndex("by_status_priority", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(limit * 10); // over-fetch: domain dedup drops many

    const claimed: Array<{
      id: Id<"legal_scrape_queue">;
      sourceUrl: string;
      domainCategory: string;
      priority: number;
      etag?: string;
      lastModified?: string;
    }> = [];
    const domains = new Set<string>();
    for (const row of rows) {
      if (claimed.length >= limit) break;
      let domain = "";
      try { domain = new URL(row.sourceUrl).host; } catch { continue; }
      if (domains.has(domain)) continue;
      domains.add(domain);
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
      actor: "ingester:engine",
      status: "ok",
      payload: { claimed: claimed.length, workerId: args.workerId },
      createdAt: now,
    });
    return claimed;
  },
});

/** Complete a claimed row (mirrors queue.complete — one task, one outcome).
 *  2026-11-22: when the completed task IS a seed source (the weekly
 *  freshness sweep re-queues seeds), the seed's lastSweptAt is patched —
 *  the Ingestion view used to show "swept never" even right after the
 *  engine crawled the seed, because only the MONDAY cron ever stamped
 *  it. Now a sweep is a sweep whenever the engine actually fetched it. */
export const completeForEngine = internalMutation({
  args: {
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
    const now = Date.now();
    const task = await ctx.db.get(args.taskId);
    await ctx.db.patch(args.taskId, {
      status: args.outcome === "completed" ? "completed" : "skipped_dedup",
      lastCheckedAt: now,
      rawDocumentHash: args.rawDocumentHash,
      etag: args.etag,
      lastModified: args.lastModified,
      documentType: args.documentType,
      documentKey: args.documentKey,
      lastError: args.error,
      updatedAt: now,
    });
    // Seed sweep telemetry: stamp the matching seed source row.
    if (task?.urlHash) {
      const seed = await ctx.db
        .query("legal_seed_sources")
        .withIndex("by_urlHash", (q: any) => q.eq("urlHash", task.urlHash))
        .first();
      if (seed) {
        await ctx.db.patch(seed._id, { lastSweptAt: now });
      }
    }
    await ctx.db.insert("system_audit_logs", {
      eventType: args.outcome === "completed" ? "scrape.fetch" : "scrape.dedup_skip",
      actor: "ingester:engine",
      status: "ok",
      payload: {
        taskId: args.taskId,
        outcome: args.outcome,
        sha256: args.rawDocumentHash,
        documentType: args.documentType,
      },
      createdAt: now,
    });
    return { ok: true };
  },
});

/** Fail a claimed row — retry up to MAX_ATTEMPTS, then terminal. */
export const failForEngine = internalMutation({
  args: {
    taskId: v.id("legal_scrape_queue"),
    error: v.string(),
    retryable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const task = await ctx.db.get(args.taskId);
    const requeue = args.retryable !== false && (task?.attempts ?? 0) < MAX_ATTEMPTS;
    await ctx.db.patch(args.taskId, {
      status: requeue ? "queued" : "failed",
      lastError: args.error.slice(0, 500),
      lastCheckedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("system_audit_logs", {
      eventType: "scrape.failure",
      actor: "ingester:engine",
      status: "error",
      payload: { taskId: args.taskId, error: args.error.slice(0, 300), requeue },
      createdAt: now,
    });
    return { requeued: requeue };
  },
});

/** Enqueue discovered URLs (index-page link harvest, founder-added URLs).
 *  Idempotent on urlHash; terminal rows are never resurrected here — only
 *  the weekly freshness sweep re-queues seeds explicitly.
 *
 *  2026-11-22 STRICT FILTER: every candidate passes filterCandidateUrl
 *  BEFORE insertion — junk (Cloudflare internals, cookie/privacy pages,
 *  blogs, assets, off-domain links) is rejected with a reason instead of
 *  polluting the queue, and survivors carry policy priorities (document
 *  links 2 < curated 3 < index discovery 6). `parentUrl` (the index page
 *  the link was found on) drives the off-domain rule. */
export const enqueueForEngine = internalMutation({
  args: {
    urls: v.array(
      v.object({
        sourceUrl: v.string(),
        domainCategory: v.string(),
        priority: v.optional(v.number()),
        discoveredFrom: v.optional(v.string()),
        parentUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let queued = 0;
    let rejected = 0;
    const rejectSamples: string[] = [];
    for (const item of args.urls) {
      const verdict = filterCandidateUrl(item.sourceUrl, item.parentUrl);
      if (!verdict.allowed) {
        rejected++;
        if (rejectSamples.length < 5) {
          rejectSamples.push(`${item.sourceUrl.slice(0, 120)} — ${verdict.reason}`);
        }
        continue;
      }
      const normalized = verdict.url;
      const hash = urlHash(normalized);
      const existing = await ctx.db
        .query("legal_scrape_queue")
        .withIndex("by_urlHash", (q) => q.eq("urlHash", hash))
        .first();
      if (existing) continue;
      await ctx.db.insert("legal_scrape_queue", {
        sourceUrl: normalized,
        urlHash: hash,
        domainCategory: item.domainCategory,
        priority: item.priority ?? verdict.priority,
        status: "queued",
        attempts: 0,
        discoveredFrom: item.discoveredFrom,
        documentType: verdict.kind === "index" ? "index" : undefined,
        createdAt: now,
        updatedAt: now,
      });
      queued++;
    }
    if (queued > 0 || rejected > 0) {
      await ctx.db.insert("system_audit_logs", {
        eventType: "queue.enqueue",
        actor: "ingester:engine",
        status: "ok",
        payload: {
          count: queued,
          rejected,
          source: "harvest",
          ...(rejectSamples.length > 0 ? { rejectSamples } : {}),
        },
        createdAt: now,
      });
    }
    return { queued, rejected };
  },
});

/** 2026-11-22 STRICT FILTER — the junk purge. Deletes every QUEUED row
 *  that violates the block-list/allow-list policy (Cloudflare internals,
 *  cookie pages, blogs, assets, non-legal pages that slipped in before
 *  the gate existed) so the next 15-minute run only ever processes
 *  genuine legal authorities. Bounded to 1000 rows per call; runs at the
 *  start of every worker cycle until the backlog is drained. */
export const purgeBlockedQueuedInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("legal_scrape_queue")
      .withIndex("by_status_priority", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(1000);
    const violators: string[] = [];
    for (const row of rows) {
      const verdict = filterCandidateUrl(row.sourceUrl);
      if (!verdict.allowed) {
        violators.push(`${row.sourceUrl.slice(0, 140)} — ${verdict.reason}`);
        await ctx.db.delete(row._id);
      }
    }
    if (violators.length > 0) {
      await ctx.db.insert("system_audit_logs", {
        eventType: "queue.purge",
        actor: "ingester:engine",
        status: "ok",
        payload: {
          purged: violators.length,
          scanned: rows.length,
          urls: violators.slice(0, 50), // cap the audit payload
        },
        createdAt: now,
      });
    }
    return { purged: violators.length, scanned: rows.length };
  },
});

/** Upsert the builtin authoritative seeds (port of seeds.py) into
 *  legal_seed_sources + the queue at CURATED priority. Idempotent.
 *  2026-11-22: seed URLs pass the SAME strict filter as every other
 *  candidate (they are index roots, so they classify as index discovery —
 *  but a future seed that violates policy is refused visibly instead of
 *  silently poisoning the queue). */
export const seedBuiltinSourcesInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let added = 0;
    let updated = 0;
    const refused: string[] = [];
    for (const s of BUILTIN_SEED_SOURCES) {
      const verdict = filterCandidateUrl(s.sourceUrl);
      if (!verdict.allowed) {
        refused.push(`${s.sourceUrl} — ${verdict.reason}`);
        continue;
      }
      const normalized = verdict.url;
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
          discoveredFrom: "seed:builtin",
          documentType: verdict.kind === "index" ? "index" : undefined,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    const state = await ctx.db.query("legal_engine_state").first();
    if (state) await ctx.db.patch(state._id, { seededBuiltinsAt: now, updatedAt: now });
    await ctx.db.insert("system_audit_logs", {
      eventType: "queue.enqueue",
      actor: "ingester:engine",
      status: refused.length > 0 ? "error" : "ok",
      payload: { source: "seed:builtin", added, updated, ...(refused.length > 0 ? { refused } : {}) },
      createdAt: now,
    });
    return { added, updated, refused: refused.length };
  },
});

/** Record a completed run on the singleton state row. */
export const recordEngineRun = internalMutation({
  args: { summary: v.any() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const state = await ctx.db.query("legal_engine_state").first();
    if (!state) return { ok: false };
    await ctx.db.patch(state._id, {
      lastRunAt: now,
      lastRunSummary: args.summary,
      runsCount: (state.runsCount ?? 0) + 1,
      updatedAt: now,
    });
    await ctx.db.insert("system_audit_logs", {
      eventType: "engine.run",
      actor: "ingester:engine",
      status: "ok",
      payload: args.summary,
      createdAt: now,
    });
    return { ok: true };
  },
});

// ── Embedding backfill (2026-11-22) ──────────────────────────────────────
// Chunks ingested before the in-engine embedding upgrade (or while its
// key was missing) carry no vector. The worker run embeds a bounded
// batch of them each cycle — the "0 embedded" state self-heals without
// a Python-tool pass, and the legal_chunks.by_embedding vector index
// fills retroactively.

/** Bounded list of chunk rows still missing their 768-dim vector. */
export const getUnembeddedChunksInternal = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit, 64));
    const rows = await ctx.db.query("legal_chunks").order("asc").take(400);
    const pending = rows.filter(
      (c: any) => !Array.isArray(c.embedding) || c.embedding.length !== EMBEDDING_DIMS,
    );
    return pending.slice(0, limit).map((c: any) => ({
      id: c._id,
      text: String(c.text || ""),
    }));
  },
});

/** Patch computed vectors onto chunk rows (content is unchanged — only
 *  the vector leg is filled in). */
export const patchChunkEmbeddingsInternal = internalMutation({
  args: {
    patches: v.array(
      v.object({
        id: v.id("legal_chunks"),
        embedding: v.array(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let patched = 0;
    const now = Date.now();
    for (const p of args.patches) {
      if (p.embedding.length !== EMBEDDING_DIMS) continue;
      try {
        await ctx.db.patch(p.id, { embedding: p.embedding });
        patched++;
      } catch { /* deleted mid-run — skip */ }
    }
    if (patched > 0) {
      await ctx.db.insert("system_audit_logs", {
        eventType: "embeddings.backfill",
        actor: "ingester:engine",
        status: "ok",
        payload: { patched },
        createdAt: now,
      });
    }
    return { patched };
  },
});

// ── The worker action (cron + founder "Run Now") ────────────────────────────

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchWithTimeout(url: string, timeoutMs: number, headers: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "User-Agent": ENGINE_UA, "Accept-Language": "en-NG,en;q=0.9", ...headers },
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

/** One queue task through the full pipeline. Never throws — every
 *  outcome is recorded and the run continues. */
async function processTask(
  ctx: any,
  task: { id: Id<"legal_scrape_queue">; sourceUrl: string; domainCategory: string; etag?: string; lastModified?: string },
  robotsCache: Map<string, RobotRules | null>,
  summary: EngineRunSummary,
): Promise<void> {
  // ── robots.txt (cached per domain for the whole run) ────────────────
  let rules: RobotRules | null = null;
  let domain = "";
  try { domain = new URL(task.sourceUrl).host; } catch { /* unreachable: queue URLs are normalized */ }
  if (robotsCache.has(domain)) {
    rules = robotsCache.get(domain) ?? null;
  } else {
    const robotsUrl = robotsUrlFor(task.sourceUrl);
    rules = null;
    if (robotsUrl) {
      try {
        const r = await fetchWithTimeout(robotsUrl, ROBOTS_TIMEOUT_MS, {});
        if (r.status === 200) {
          rules = rulesForUserAgent(await r.text(), ENGINE_UA);
        }
      } catch { /* unreachable robots = allowed */ }
    }
    robotsCache.set(domain, rules);
  }
  if (rules && !robotsAllows(rules, task.sourceUrl)) {
    summary.robotsSkipped++;
    await ctx.runMutation(internal.legal.worker.completeForEngine, {
      taskId: task.id,
      outcome: "skipped_dedup",
      error: "robots.txt disallows this path",
    });
    return;
  }

  // ── conditional GET ─────────────────────────────────────────────────
  const headers: Record<string, string> = {
    Accept: "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
  };
  if (task.etag) headers["If-None-Match"] = task.etag;
  if (task.lastModified) headers["If-Modified-Since"] = task.lastModified;

  let resp: Response;
  try {
    resp = await fetchWithTimeout(task.sourceUrl, FETCH_TIMEOUT_MS, headers);
  } catch (e: any) {
    summary.failed++;
    await ctx.runMutation(internal.legal.worker.failForEngine, {
      taskId: task.id,
      error: `network: ${String(e?.message || e).slice(0, 200)}`,
    });
    return;
  }

  if (resp.status === 304) {
    // Bandwidth saver: unchanged since last check — no parse, no storage.
    summary.notModified++;
    await ctx.runMutation(internal.legal.worker.completeForEngine, {
      taskId: task.id,
      outcome: "not_modified",
      etag: task.etag,
      lastModified: task.lastModified,
    });
    return;
  }
  if (resp.status >= 400) {
    summary.failed++;
    await ctx.runMutation(internal.legal.worker.failForEngine, {
      taskId: task.id,
      error: `HTTP ${resp.status}`,
      retryable: resp.status === 429 || resp.status >= 500,
    });
    return;
  }

  const contentType = (resp.headers.get("Content-Type") || "text/html").split(";")[0].trim();
  const bodyBuf = await resp.arrayBuffer();
  const bodyBytes = new Uint8Array(bodyBuf);
  if (bodyBytes.byteLength === 0) {
    summary.failed++;
    await ctx.runMutation(internal.legal.worker.failForEngine, { taskId: task.id, error: "empty body" });
    return;
  }
  if (bodyBytes.byteLength > MAX_BODY_BYTES) {
    summary.failed++;
    await ctx.runMutation(internal.legal.worker.failForEngine, {
      taskId: task.id,
      error: `body too large (${bodyBytes.byteLength} bytes > ${MAX_BODY_BYTES})`,
      retryable: false,
    });
    return;
  }

  const etag = resp.headers.get("ETag") || undefined;
  const lastModified = resp.headers.get("Last-Modified") || undefined;
  const sha = await sha256Hex(bodyBytes);

  // ── pre-ingest dedup: identical artifact already parsed? skip all ──
  const probe = await ctx.runQuery(internal.legal.ingest.dedupProbeInternal, {
    sourceUrl: task.sourceUrl,
    expectedSha256: sha,
  });
  if (probe?.artifactCompleted) {
    summary.dedupSkipped++;
    await ctx.runMutation(internal.legal.worker.completeForEngine, {
      taskId: task.id,
      outcome: "skipped_dedup",
      rawDocumentHash: sha,
      etag,
      lastModified,
    });
    return;
  }

  const bodyText = new TextDecoder("utf-8", { fatal: false }).decode(bodyBytes);

  // ── honest boundary: PDFs deferred (no pypdf equivalent in Convex) ──
  if (contentType.includes("pdf") || isPdfBody(bodyText)) {
    summary.pdfDeferred++;
    await ctx.runMutation(internal.legal.worker.completeForEngine, {
      taskId: task.id,
      outcome: "completed",
      rawDocumentHash: sha,
      documentType: "pdf_deferred",
      etag,
      lastModified,
    });
    await ctx.runMutation(internal.legal.audit.logInternal, {
      eventType: "pdf.deferred",
      actor: "ingester:engine",
      status: "ok",
      payload: { taskId: task.id, sourceUrl: task.sourceUrl, sha256: sha, note: "PDF parsing stays on the Python ingester (pypdf)" },
    });
    return;
  }

  // ── extract + classify ──────────────────────────────────────────────
  const document = extractHtml(bodyText, task.sourceUrl);
  if (!document.text.trim()) {
    summary.failed++;
    await ctx.runMutation(internal.legal.worker.failForEngine, {
      taskId: task.id,
      error: "no extractable text",
      retryable: false,
    });
    return;
  }

  const category = classifyCategory(task.sourceUrl, document.text, document.title);
  const docType = classifyDocumentType(category, task.sourceUrl, document.text);

  if (docType === "index") {
    // Index page: harvest child links into the queue — STRICT (2026-11-22):
    // every link passes filterCandidateUrl with THIS page as the parent,
    // so only same-host (or official-subdomain document) links that match
    // the legal allow-list ever enter the queue. Junk hrefs (cookie
    // pages, /cdn-cgi/, blogs, assets, off-site) die there with a reason.
    // The cap counts RAW candidates forwarded to the filter — nav bars and
    // footer links get rejected inside, so scanning more raw links is how
    // enough real documents survive per index.
    const candidates: Array<{
      sourceUrl: string;
      domainCategory: string;
      discoveredFrom: string;
      parentUrl: string;
    }> = [];
    for (const link of document.links) {
      if (candidates.length >= MAX_LINK_CANDIDATES_PER_INDEX) break;
      if (link === task.sourceUrl) continue;
      candidates.push({
        sourceUrl: link,
        domainCategory: category,
        discoveredFrom: task.sourceUrl,
        parentUrl: task.sourceUrl,
      });
    }
    if (candidates.length > 0) {
      try {
        await ctx.runMutation(internal.legal.worker.enqueueForEngine, { urls: candidates });
      } catch { /* queue full / transient — never fatal */ }
    }
    summary.completed++;
    summary.indexesHarvested++;
    await ctx.runMutation(internal.legal.worker.completeForEngine, {
      taskId: task.id,
      outcome: "completed",
      rawDocumentHash: sha,
      documentType: "index",
      etag,
      lastModified,
    });
    return;
  }

  // ── chunk along legal boundaries ────────────────────────────────────
  const chunks = chunkDocument(docType, document.text);
  if (chunks.length === 0) {
    summary.failed++;
    await ctx.runMutation(internal.legal.worker.failForEngine, {
      taskId: task.id,
      error: "chunking produced no chunks",
      retryable: false,
    });
    return;
  }

  // ── metadata: judgment or instrument ────────────────────────────────
  let judgment: any;
  let instrument: any;
  let documentKey: string;
  if (docType === "judgment") {
    const meta = extractJudgmentMeta(document.text, document.title, task.sourceUrl);
    judgment = {
      citation: meta.citation,
      suitNumber: meta.suitNumber || "UNKNOWN",
      court: meta.court || "Unknown court",
      courtLevel: meta.courtLevel || undefined,
      dateDelivered: meta.dateDelivered || "1970-01-01",
      parties: meta.parties,
      judges: meta.judges,
      counsel: meta.counsel,
      ratioDecidendi: meta.ratioDecidendi || "See judgment text (ratio section not machine-detectable).",
      obiterDicta: meta.obiterDicta || undefined,
      summary: document.text.slice(0, 400).replace(/\s+/g, " ").slice(0, 400) || undefined,
      statutesConsidered: meta.statutesConsidered,
      casesCited: meta.casesCited,
    };
    documentKey = meta.citation;
  } else {
    instrument = buildInstrumentMeta(document.title || task.sourceUrl, document.text, task.sourceUrl, category);
    documentKey = instrument.key;
  }

  // ── raw artifact: stored ONCE, content-addressed, in Convex storage ─
  let storageKey = `pending:${sha}`;
  try {
    const storageId = await ctx.storage.store(bodyBytes);
    storageKey = storageId;
  } catch {
    // Storage failure must not lose the DOCUMENT: the artifact row still
    // records provenance (sha256 + sourceUrl) — only re-parse-from-cache
    // is unavailable for this item until the next successful fetch.
  }

  // ── embeddings (2026-11-22): the same run that chunks also embeds,
  //  with the platform GEMINI_API_KEY — the dense search leg no longer
  //  waits for the Python tool. Any failure degrades to keyword-only
  //  (vectors=[] → no embedding field); the run-level audit records
  //  the skip once, never per-task spam.
  let vectors: number[][] = [];
  if (embeddingConfigured()) {
    try {
      vectors = await embedTexts(chunks.map((c) => c.text));
    } catch { vectors = []; }
    if (vectors.length !== chunks.length) vectors = [];
    if (vectors.length > 0) summary.chunksEmbedded += vectors.length;
  }

  const result = await ctx.runMutation(internal.legal.ingest.ingestDocumentInternal, {
    artifact: {
      sha256: sha,
      storageBackend: "convex",
      storageKey,
      contentType,
      byteSize: bodyBytes.byteLength,
      sourceUrl: task.sourceUrl,
      fetchedAt: Date.now(),
      parserVersion: "engine-1.0.0",
    },
    judgment,
    instrument,
    chunks: chunks.map((c, i) => ({
      boundaryPath: c.boundaryPath,
      heading: c.heading,
      text: c.text,
      citations: c.citations,
      ...(vectors[i] && vectors[i].length === EMBEDDING_DIMS
        ? { embedding: vectors[i] }
        : {}),
    })),
    actor: "ingester:engine",
  });

  summary.completed++;
  summary.documentsIngested++;
  summary.chunksIngested += result?.chunksIngested ?? 0;
  await ctx.runMutation(internal.legal.worker.completeForEngine, {
    taskId: task.id,
    outcome: "completed",
    rawDocumentHash: sha,
    documentType: docType,
    documentKey,
    etag,
    lastModified,
  });
}

/**
 * THE RUN — invoked every 15 minutes by the legalKbIngestionWorker cron,
 * and on demand by the Founder APK's "Run Now" (legal/engine.ts).
 */
export const runIngestionWorker = internalAction({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ skipped?: string; summary?: EngineRunSummary }> => {
    const summary = emptySummary();

    // 1. Gate on the founder's toggle.
    const state: any = await ctx.runQuery(internal.legal.worker.getEngineStateInternal, {});
    if (!state || !state.enabled) {
      return { skipped: "disabled" };
    }

    // 2. First-enable bootstrap: seed the builtin authoritative sources.
    if (state.autoSeedBuiltins && !state.seededBuiltinsAt) {
      await ctx.runMutation(internal.legal.worker.seedBuiltinSourcesInternal, {});
    }

    // 2b. STRICT FILTER purge (2026-11-22): before claiming anything,
    // delete every QUEUED row that violates the block-list/allow-list —
    // junk that entered before the gate existed (or through legacy
    // paths) never gets fetched. Bounded to 1000 rows/run, so a large
    // backlog drains over successive 15-minute cycles.
    try {
      const purge = await ctx.runMutation(internal.legal.worker.purgeBlockedQueuedInternal, {});
      summary.purgedBlocked = purge?.purged ?? 0;
    } catch { /* purge must never block the run */ }

    // 3. Claim this run's tasks (one per domain).
    const limit = Math.max(1, Math.min(args.limit ?? state.maxTasksPerRun ?? 4, 8));
    const workerId = `engine-${Date.now()}`;
    const tasks = await ctx.runMutation(internal.legal.worker.claimForEngine, { workerId, limit });
    if (!tasks || tasks.length === 0) {
      summary.durationMs = Date.now() - summary.startedAt;
      await ctx.runMutation(internal.legal.worker.recordEngineRun, { summary });
      return { summary };
    }

    // 4. Process each task — one failure never kills the run.
    const robotsCache = new Map<string, RobotRules | null>();
    for (const task of tasks) {
      summary.claimed++;
      try {
        await processTask(ctx, task, robotsCache, summary);
      } catch (e: any) {
        summary.failed++;
        try {
          await ctx.runMutation(internal.legal.worker.failForEngine, {
            taskId: task.id,
            error: String(e?.message || e).slice(0, 400),
          });
        } catch { /* last-resort: the row self-heals via stale-claim requeue */ }
      }
    }

    // 5. Embedding backfill (2026-11-22): heal legacy vector-less chunks
    //    with the platform key — bounded so a huge backlog drains over
    //    successive 15-minute cycles instead of one long run.
    if (embeddingConfigured()) {
      try {
        const pending = await ctx.runQuery(internal.legal.worker.getUnembeddedChunksInternal, {
          limit: 32,
        });
        if (pending && pending.length > 0) {
          const vectors = await embedTexts(pending.map((p: any) => p.text));
          if (vectors.length === pending.length) {
            const patches = pending
              .map((p: any, i: number) => ({ id: p.id, embedding: vectors[i] }))
              .filter((p: any) => Array.isArray(p.embedding) && p.embedding.length === EMBEDDING_DIMS);
            if (patches.length > 0) {
              const res = await ctx.runMutation(internal.legal.worker.patchChunkEmbeddingsInternal, {
                patches,
              });
              summary.embeddedBackfilled += res?.patched ?? 0;
            }
          }
        }
        // Honest audit when the configured key produced nothing all run:
        // chunksEmbedded===0 AND embeddedBackfilled===0 while chunks
        // exist and were ingested — one row per run, never per task.
        const ingestedChunksNeedingVectors = summary.chunksIngested > 0;
        if (
          summary.chunksEmbedded === 0 &&
          summary.embeddedBackfilled === 0 &&
          ingestedChunksNeedingVectors
        ) {
          await ctx.runMutation(internal.legal.audit.logInternal, {
            eventType: "embeddings.skipped",
            actor: "ingester:engine",
            status: "error",
            payload: {
              reason: "GEMINI_API_KEY is set but no vectors were produced (provider error or model unavailable) — ingestion continued keyword-only",
              chunksIngested: summary.chunksIngested,
            },
          });
        }
      } catch { /* backfill must never kill the run */ }
    } else if (summary.chunksIngested > 0) {
      // Key absent: the documented keyword-only boundary, stated once
      // per run so the audit trail explains the inspector's "not
      // embedded" rows without spam.
      try {
        await ctx.runMutation(internal.legal.audit.logInternal, {
          eventType: "embeddings.skipped",
          actor: "ingester:engine",
          status: "ok",
          payload: { reason: "GEMINI_API_KEY not configured — keyword-only ingestion (the documented boundary)" },
        });
      } catch { /* audit must never kill the run */ }
    }

    // 6. Record the run.
    summary.durationMs = Date.now() - summary.startedAt;
    await ctx.runMutation(internal.legal.worker.recordEngineRun, { summary });
    return { summary };
  },
});
