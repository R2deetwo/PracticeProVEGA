import { internalAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { CORE_INSTRUMENTS } from "./coreInstruments";
import { urlHash } from "./shared";
import { deriveCurrencyStatus } from "./currency";
import { PRIORITY } from "./schema";
import { sha256Hex } from "../sha256";

/**
 * legal/seedCoreInstruments — the curated core-authorities seed (2026-11-25,
 * Antigravity audit response: "Legal KB Corpus Emptiness").
 *
 * WHAT IT DOES (idempotent, re-runnable):
 *   1. Upserts one `legal_instruments` row per CORE_INSTRUMENTS def —
 *      verified citation metadata only, currencyStatus derived through the
 *      SAME deriveCurrencyStatus the ingest path uses. NO statutory text is
 *      written anywhere in this seed (house rule 2 — no invented legal
 *      specifics; text only arrives through the pipeline with provenance).
 *   2. Enqueues a CURATED-priority `legal_scrape_queue` row per instrument
 *      so the in-Convex worker (or the Python ingester) fetches the REAL
 *      document from its authoritative source, chunks and embeds it — the
 *      ingest path then patches the same key (structure, chunks, real
 *      rawDocumentHash) with zero manual configuration.
 *   3. Writes system_audit_logs rows for every insert/patch and enqueue
 *      (the spec's audit trail: nothing lands silently).
 *
 * PROVENANCE MARKER: rows seeded here carry
 *   rawDocumentHash = "curated:<sha256(sourceUrl|key)>"
 * — an honest sentinel that says "metadata-only, not a fetched artifact".
 * The pipeline's ingest (which hashes the actual fetched bytes) overwrites
 * it on the same key. "curated:" is greppable so anyone can audit how many
 * rows are still awaiting full-text ingestion.
 *
 * INTERNAL action — deploy-key trust only (the same admin class as
 * whatsappDiagnostics / createVegaTemplates), never invocable from a
 * client. Invocation:
 *   npx convex run internal.legal.seedCoreInstruments.seedCoreInstruments \
 *     --prod '{"dryRun":false}'
 *   (dryRun:true lists what would land without writing).
 */

interface SeedOutcome {
  key: string;
  outcome: "inserted" | "updated" | "queued-only" | "dry_run";
  currencyStatus: string;
}

interface SeedReport {
  ok: boolean;
  dryRun: boolean;
  instrumentsSeeded: number;
  scrapeRowsEnqueued: number;
  results: SeedOutcome[];
}

export const seedCoreInstrumentsInternal = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<SeedReport> => {
    const now = Date.now();
    const dryRun = args.dryRun ?? false;
    const results: SeedOutcome[] = [];
    let instrumentsSeeded = 0;
    let scrapeRowsEnqueued = 0;

    for (const def of CORE_INSTRUMENTS) {
      const currencyStatus = deriveCurrencyStatus({
        status: def.status,
        amended: def.amendmentTracker.amended,
        repealed: def.amendmentTracker.repealed,
        // Curated metadata verified against the cited sources on 2026-11-25.
        verified: true,
      });

      if (dryRun) {
        results.push({ key: def.key, outcome: "dry_run", currencyStatus });
        continue;
      }

      // ── 1. Instrument upsert (by_key — idempotent) ─────────────────────
      const row = {
        title: def.title,
        key: def.key,
        issuingBody: def.issuingBody,
        instrumentType: def.instrumentType,
        commencementDate: def.commencementDate,
        year: def.year,
        status: def.status,
        structure: def.structure,
        amendmentTracker: def.amendmentTracker,
        summary: def.summary,
        currencyStatus,
        sourceUrl: def.sourceUrl,
        rawDocumentHash: `curated:${sha256Hex(`${def.sourceUrl}|${def.key}`)}`,
        lastVerifiedAt: now,
        updatedAt: now,
      };
      const existing = await ctx.db
        .query("legal_instruments")
        .withIndex("by_key", (q) => q.eq("key", def.key))
        .first();
      let outcome: SeedOutcome["outcome"];
      if (existing) {
        // Never clobber a pipeline-ingested row back to metadata-only: if
        // the stored hash is a real fetched-artifact hash (no "curated:"
        // prefix), only refresh the metadata fields and KEEP structure +
        // rawDocumentHash + lastVerifiedAt from the ingest.
        const alreadyIngested = !existing.rawDocumentHash.startsWith("curated:");
        if (alreadyIngested) {
          await ctx.db.patch(existing._id, {
            title: def.title,
            issuingBody: def.issuingBody,
            instrumentType: def.instrumentType,
            commencementDate: def.commencementDate,
            year: def.year,
            status: def.status,
            amendmentTracker: def.amendmentTracker,
            summary: def.summary,
            currencyStatus,
            sourceUrl: def.sourceUrl,
            updatedAt: now,
          });
          outcome = "queued-only";
        } else {
          await ctx.db.patch(existing._id, row);
          outcome = "updated";
        }
      } else {
        await ctx.db.insert("legal_instruments", { ...row, createdAt: now });
        outcome = "inserted";
      }
      instrumentsSeeded++;
      results.push({ key: def.key, outcome, currencyStatus });

      await ctx.db.insert("system_audit_logs", {
        eventType: "ingest.document",
        actor: "seed:core-instruments",
        status: "ok",
        payload: {
          key: def.key,
          title: def.title,
          mode: "curated-metadata",
          currencyStatus,
          outcome,
        },
        createdAt: now,
      });

      // ── 2. Scrape-queue enqueue (CURATED priority, idempotent) ─────────
      const hash = urlHash(def.sourceUrl);
      const existingQueueRow = await ctx.db
        .query("legal_scrape_queue")
        .withIndex("by_urlHash", (q) => q.eq("urlHash", hash))
        .first();
      if (!existingQueueRow) {
        await ctx.db.insert("legal_scrape_queue", {
          sourceUrl: def.sourceUrl,
          urlHash: hash,
          domainCategory: def.domainCategory,
          priority: PRIORITY.CURATED,
          status: "queued",
          attempts: 0,
          discoveredFrom: "curated:core-instruments",
          documentType: "instrument",
          documentKey: def.key,
          createdAt: now,
          updatedAt: now,
        });
        scrapeRowsEnqueued++;
        await ctx.db.insert("system_audit_logs", {
          eventType: "queue.enqueue",
          actor: "seed:core-instruments",
          status: "ok",
          payload: {
            sourceUrl: def.sourceUrl,
            priority: PRIORITY.CURATED,
            domainCategory: def.domainCategory,
            documentKey: def.key,
          },
          createdAt: now,
        });
      }
    }

    return {
      ok: true,
      dryRun,
      instrumentsSeeded,
      scrapeRowsEnqueued,
      results,
    };
  },
});

/** CLI-invocable wrapper (deploy-key trust) — the ingest.ts pattern.
 * The explicit SeedReport return annotation breaks the TS7022 circular
 * self-reference (same lesson as legal/ingest.ts). */
export const seedCoreInstruments = internalAction({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<SeedReport> =>
    ctx.runMutation(internal.legal.seedCoreInstruments.seedCoreInstrumentsInternal, {
      dryRun: args.dryRun ?? false,
    }),
});
