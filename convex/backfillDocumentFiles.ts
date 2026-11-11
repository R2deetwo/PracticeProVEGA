/**
 * backfillDocumentFiles — V4 (V-DOC-5) additive migration.
 *
 * Legacy document rows carry their file bytes INLINE as base64 data URLs
 * (`file.dataUrl`) — megabytes inside the row, a pattern V4's fences now
 * block on every new write. This backfill migrates those rows to the
 * storage pattern: decode the data URL, store the bytes in Convex file
 * storage, and patch the row to `{ name, type, size, storageId }` with the
 * dataUrl removed.
 *
 * Convex version note: mutations cannot write to storage in this version
 * of the framework (StorageWriter exposes no store()); only ACTIONS have
 * `ctx.storage.store`. The backfill is therefore an ACTION that:
 *   1. lists legacy rows via an internal query,
 *   2. decodes + stores each file with ctx.storage.store,
 *   3. patches the row via an internal mutation.
 * The internal functions live in backfillDocumentFilesInternal.ts.
 *
 * Typing note: the function references are obtained through `anyApi`
 * (convex/server), NOT the generated `internal` — referencing the
 * generated api from inside a module that the api itself re-exports puts
 * the action's type inference into a self-referential cycle (TS7022, with
 * collateral errors in unrelated modules). `anyApi` resolves to the same
 * runtime references without participating in the type graph.
 *
 * SAFETY (same contract as the V3 backfills):
 *   - dryRun defaults to TRUE: report only, write nothing.
 *   - Idempotent: rows whose file already has a storageId (or no file, or
 *     no decodable dataUrl) are never touched.
 *   - Never guesses: a dataUrl that does not decode (not a data: URL,
 *     corrupt base64, oversize) is REPORTED in `skipped`, never patched,
 *     never dropped.
 *   - Additive: the row's other fields are never touched; the file's
 *     original name/type/size are preserved on the migrated shape.
 *
 * Run via the "Convex Backfill Document Files (V4)" workflow
 * (.github/workflows/convex-backfill-document-files.yml) — review the
 * dry-run counts, then re-run with dry_run=false.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { anyApi } from "convex/server";
import { decodeDataUrl } from "./backfillDocumentFilesInternal";

export const backfillDocumentFiles = action({
  args: { dryRun: v.optional(v.boolean()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const listing = await ctx.runQuery(
      anyApi.backfillDocumentFilesInternal.listLegacyDocumentFiles,
      { limit: args.limit },
    );

    const migrated: any[] = [];
    let decoded = 0;

    for (const row of listing.legacy) {
      decoded++;
      if (args.dryRun !== false) continue;

      const decodedResult = decodeDataUrl(row.dataUrl);
      if (!decodedResult) continue; // listed rows already decoded; belt-and-braces

      const blob = new Blob([decodedResult.bytes.buffer as ArrayBuffer], { type: decodedResult.mime });
      const storageId = await ctx.storage.store(blob);
      await ctx.runMutation(
        anyApi.backfillDocumentFilesInternal.applyDocumentFileMigration,
        {
          documentId: row.id,
          storageId,
          name: row.name,
          type: row.type,
          size: row.size,
          filePath: row.filePath,
        },
      );
      migrated.push({ id: row.id, title: row.title, name: row.name, storageId });
    }

    return {
      dryRun: args.dryRun !== false,
      total: listing.total,
      alreadyStorage: listing.alreadyStorage,
      noFile: listing.noFile,
      noDataUrl: listing.noDataUrl,
      decoded,
      migratedCount: migrated.length,
      migrated: migrated.slice(0, 50),
      skipped: listing.skipped.slice(0, 50),
    };
  },
});
