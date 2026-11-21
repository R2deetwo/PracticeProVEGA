import { defineTable } from "convex/server";
import { v } from "convex/values";
import { URL_PRIORITY } from "../../src/legal/ingestionEngine/urlFilter";

/**
 * legal/schema — the Legal Knowledge Base & Retrieval Engine tables.
 *
 * THE ACQUISITION LAYER (owner spec, 2026-11-16): an autonomous,
 * cryptographically-verified, bandwidth-optimised pipeline that crawls,
 * parses, structures, chunks, embeds, caches and audits Nigerian court
 * judgments, statutes, subsidiary legislation, rules of court, SEC
 * regulations and INEC electoral guidelines — powering ALOA and ARIA
 * with strictly-cited legal intelligence.
 *
 * DATA FLOW
 *   legal_seed_sources ──┐
 *   gap detection ───────┼──▶ legal_scrape_queue ──▶ Python ingester
 *   weekly freshness ────┘         (claim → fetch → SHA-256 → cache raw
 *                                    artifact → parse → chunk → embed)
 *                                        │
 *                        legal_raw_artifacts (immutable provenance store)
 *                                        │
 *                        legal_judgments / legal_instruments
 *                                        │
 *                        legal_chunks (search + vector indexed)
 *                                        │
 *                        legal_query_cache (RRF-hybrid results, TTL'd)
 *
 * Every step writes system_audit_logs. Table names follow the owner's
 * spec verbatim (legal_scrape_queue, legal_judgments,
 * legal_instruments, system_audit_logs).
 *
 * EMBEDDINGS: 768 dimensions — same as the platform's existing Gemini
 * text-embedding pipeline (statutes / instrument_provisions /
 * court_forms), so one client-side embedding path serves everything.
 * Vectors are OPTIONAL per chunk: keyword search works before any
 * embedding key is configured; the dense leg joins once embeddings run.
 */

/** Domain categories per the spec's taxonomy. */
export const DOMAIN_CATEGORIES = [
  "judgments",
  "statutes",
  "subsidiary",
  "rules_of_court",
  "sec_regulations",
  "electoral",
  "index",
] as const;
export type DomainCategory = (typeof DOMAIN_CATEGORIES)[number];

/** Queue priorities: lower = more urgent. DOC_LINK/INDEX_DISCOVERY come
 *  from the pure urlFilter module (the enqueue-time scorer) so the gate
 *  and the queue can never disagree on ordering. */
export const PRIORITY = {
  GAP_FILL: 0, // query-time gap detection — user is waiting on coverage
  /** Direct document link / canonical legal detail path (owner spec
   *  Priority 1 — highest signal). */
  DOC_LINK: URL_PRIORITY.DOC_LINK, // 2
  CURATED: 3, // founder/operator-curated source
  DEFAULT: 5, // routine seed discovery
  /** Index/listing pages — discovery only, never stored (owner spec
   *  Priority 2). */
  INDEX_DISCOVERY: URL_PRIORITY.INDEX_DISCOVERY, // 6
  FRESHNESS_RECHECK: 8, // weekly sweep re-verification
  BACKGROUND: 9,
} as const;

/** Politeness contract enforced by the Python worker (spec §1):
 *  randomized jittered delays 3.0–6.0s and max 2–3 concurrent workers. */
export const POLITENESS = {
  MIN_DELAY_S: 3.0,
  MAX_DELAY_S: 6.0,
  MAX_CONCURRENCY: 3,
} as const;

/** URL staging queue (spec §1). One row per discovered URL; the Python
 *  worker claims queued rows, fetches politely, and completes/fails them. */
export const legalScrapeQueue = defineTable({
  sourceUrl: v.string(),
  urlHash: v.string(), // sha256(normalized url) — dedup key
  domainCategory: v.string(), // DOMAIN_CATEGORIES
  priority: v.number(), // PRIORITY.*
  status: v.string(), // queued | in_progress | completed | failed | skipped_dedup
  lastCheckedAt: v.optional(v.number()),
  rawDocumentHash: v.optional(v.string()), // sha256 of fetched bytes
  // Conditional-GET validators: bandwidth saver #1 — a 304 Not Modified
  // skips the body transfer entirely on freshness sweeps.
  etag: v.optional(v.string()),
  lastModified: v.optional(v.string()),
  attempts: v.number(),
  lastError: v.optional(v.string()),
  discoveredFrom: v.optional(v.string()), // parent URL or "gap:<query-hash>"
  documentType: v.optional(v.string()), // judgment | instrument | index
  documentKey: v.optional(v.string()), // citation / instrument key once parsed
  claimedBy: v.optional(v.string()), // worker run id
  claimedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_urlHash", ["urlHash"])
  .index("by_status_priority", ["status", "priority"])
  .index("by_category", ["domainCategory"])
  .index("by_lastChecked", ["lastCheckedAt"]);

/** Immutable raw artifact cache (spec §1): every fetched HTML/PDF binary
 *  is stored ONCE, content-addressed by SHA-256. Parser upgrades re-run
 *  extraction from here — never re-fetching from public servers. */
export const legalRawArtifacts = defineTable({
  sha256: v.string(), // cryptographic provenance (spec §2)
  storageBackend: v.string(), // r2 | convex | local
  storageKey: v.string(), // R2 object key / Convex storage id / local rel path
  contentType: v.string(), // text/html | application/pdf | …
  byteSize: v.number(),
  sourceUrl: v.string(),
  fetchedAt: v.number(),
  parseStatus: v.string(), // pending | completed | failed
  parserVersion: v.optional(v.string()),
  lastParsedAt: v.optional(v.number()),
})
  .index("by_sha256", ["sha256"])
  .index("by_parseStatus", ["parseStatus"])
  .index("by_fetched", ["fetchedAt"]);

/** Court judgments (spec §3): full relational capture including judicial
 *  treatment tags on cited cases. */
export const legalJudgments = defineTable({
  citation: v.string(), // "[2024] LPELR-12345(SC)" / (2024) LPELR-…
  suitNumber: v.string(), // SC/123/2021, FHC/L/CS/…
  court: v.string(), // "Supreme Court of Nigeria"
  courtLevel: v.optional(v.string()), // supreme | court_of_appeal | federal_high_court | state_high_court | …
  dateDelivered: v.string(), // ISO date
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
    v.object({
      case: v.string(),
      treatment: v.string(), // applied | distinguished | overruled | affirmed | considered | followed
    }),
  ),
  sourceUrl: v.string(),
  rawDocumentHash: v.string(),
  lastVerifiedAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_citation", ["citation"])
  .index("by_suitNumber", ["suitNumber"])
  .index("by_court", ["court"])
  .index("by_date", ["dateDelivered"]);

/** Statutes, subsidiary legislation, rules of court, regulations and
 *  guidelines (spec §3): hierarchical tree structure plus amendment
 *  tracking ("know when rules change"). Distinct from the founder-curated
 *  `instruments` table (rules & forms of institutions): this is the
 *  autonomously-ingested body of Nigerian legislation. */
export const legalInstruments = defineTable({
  title: v.string(),
  key: v.string(), // stable slug, e.g. "cama_2020"
  issuingBody: v.string(), // National Assembly | SEC | INEC | Lagos State House of Assembly
  instrumentType: v.string(), // act | regulation | rules_of_court | guideline | subsidiary_instrument
  commencementDate: v.optional(v.string()),
  year: v.optional(v.number()),
  status: v.string(), // in_force | amended | repealed | unknown
  // Hierarchical tree, flattened: Part → Section → Subsection (+ proviso).
  structure: v.array(
    v.object({
      level: v.string(), // part | section | subsection | proviso | schedule
      number: v.string(),
      heading: v.string(),
    }),
  ),
  amendmentTracker: v.object({
    amended: v.boolean(),
    amendmentRefs: v.array(v.string()),
    repealed: v.boolean(),
    repealRef: v.optional(v.string()),
  }),
  summary: v.optional(v.string()),
  sourceUrl: v.string(),
  rawDocumentHash: v.string(),
  lastVerifiedAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_key", ["key"])
  .index("by_title", ["title"])
  .index("by_type", ["instrumentType"])
  .index("by_status", ["status"]);

/** Legal-boundary hierarchical chunks (spec §4): statutes chunk along
 *  Part → Section → Subsection (+ proviso); judgments along
 *  Issue → Reasoning → Ratio. Complete legal context per chunk. */
export const legalChunks = defineTable({
  documentType: v.string(), // judgment | instrument
  documentKey: v.string(), // judgment citation or instrument key
  boundaryPath: v.array(v.string()), // ["Part C", "Section 18", "(3)", "proviso"]
  heading: v.string(),
  text: v.string(),
  tokenCount: v.number(),
  embedding: v.optional(v.array(v.number())), // 768-dim, same pipeline as statutes
  citations: v.array(v.string()), // statutory refs found in this chunk
  warnings: v.array(v.string()), // amended | overruled | repealed | stale | unverified
  sourceUrl: v.string(),
  rawDocumentHash: v.string(),
  lastVerifiedAt: v.number(),
  createdAt: v.number(),
})
  .searchIndex("search_text", { searchField: "text" }) // sparse (BM25-style) leg
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 768,
    filterFields: ["documentType"],
  })
  .index("by_document", ["documentType", "documentKey"])
  .index("by_sha256", ["rawDocumentHash"]);

/** Query & synthesis cache (spec §4): identical concurrent queries hit
 *  the cached fused result instantly — no re-search, no re-synthesis,
 *  no wasted tokens. */
export const legalQueryCache = defineTable({
  queryHash: v.string(), // sha256(normalized query + mode)
  normalizedQuery: v.string(),
  mode: v.string(), // hybrid_search | synthesis
  payload: v.any(), // fused results / synthesis payload
  resultCount: v.number(),
  confidence: v.optional(v.string()), // high | medium | coverage_gap
  hitCount: v.number(),
  createdAt: v.number(),
  expiresAt: v.number(),
})
  .index("by_queryHash", ["queryHash"])
  .index("by_expires", ["expiresAt"]);

/** Immutable audit trail (spec §2): every scrape event, cache hit/miss,
 *  parser success/failure and token expenditure lands here. */
export const systemAuditLogs = defineTable({
  eventType: v.string(), // scrape.start | scrape.fetch | scrape.dedup_skip | cache.hit | cache.miss | parse.success | parse.failure | ingest.document | ingest.chunks | search.query | gap.detected | queue.enqueue | sweep.run | embeddings.skipped | token.expenditure
  actor: v.string(), // "ingester:py" | "aloa" | "aria" | "cron:freshness" | "gap-detector"
  status: v.string(), // ok | error
  payload: v.any(),
  tokensSpent: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_event_type", ["eventType", "createdAt"])
  .index("by_created", ["createdAt"]);

/** Authoritative index pages the weekly freshness sweep re-checks
 *  (spec §5). Seeded by the Python CLI `seed` command. */
export const legalSeedSources = defineTable({
  sourceUrl: v.string(),
  urlHash: v.string(),
  domainCategory: v.string(),
  kind: v.string(), // index | document
  authority: v.string(), // human label, e.g. "NigeriaLII (AfricanLII)"
  enabled: v.boolean(),
  notes: v.optional(v.string()),
  lastSweptAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_urlHash", ["urlHash"])
  .index("by_enabled", ["enabled"])
  .index("by_category", ["domainCategory"]);

/** Engine singleton state — the Founder APK's control surface for the
 * IN-CONVEX ingestion engine (2026-11-19: the ingestion engine moved
 * INTO the founder's app and runs itself; see convex/legal/worker.ts).
 * One row, created on first toggle. The worker cron is a no-op while
 * enabled !== true, so the founder pausing the engine from the phone
 * stops all crawling within one 15-minute cycle. */
export const legalEngineState = defineTable({
  enabled: v.boolean(),
  /** Politeness + action-runtime budget: tasks processed per 15-min
   * cron tick (clamped 1-8; one task per domain per run). */
  maxTasksPerRun: v.number(),
  /** Seed the builtin authoritative sources on first enable. */
  autoSeedBuiltins: v.boolean(),
  seededBuiltinsAt: v.optional(v.number()),
  lastRunAt: v.optional(v.number()),
  lastRunSummary: v.optional(v.any()),
  runsCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_enabled", ["enabled"]);
