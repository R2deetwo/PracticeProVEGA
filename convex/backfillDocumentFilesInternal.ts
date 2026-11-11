/**
 * backfillDocumentFilesInternal — V4 (V-DOC-5) internal functions for the
 * document-file backfill (see backfillDocumentFiles.ts for the contract).
 *
 * The internals live in their OWN module (not with the action) so the
 * generated api's type graph has no self-referential cycle: an action
 * referencing `internal.backfillDocumentFiles` from inside
 * backfillDocumentFiles.ts sends TS7022 through the whole app's type
 * inference (observed as collateral errors in unrelated modules).
 */
import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

const MAX_MIGRATE_BYTES = 10 * 1024 * 1024; // matches the product's file limit

interface RowFile {
  name?: string;
  type?: string;
  size?: number;
  filePath?: string;
  dataUrl?: string;
  storageId?: string;
}

export interface DecodedDataUrl {
  bytes: Uint8Array;
  mime: string;
}

export function decodeDataUrl(dataUrl: string): DecodedDataUrl | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl || "");
  if (!match) return null;
  const mime = match[1] || "application/octet-stream";
  const isB64 = !!match[2];
  let bytes: Uint8Array;
  try {
    if (isB64) {
      const bin = atob(match[3]);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(match[3]));
    }
  } catch {
    return null;
  }
  if (bytes.length === 0) return null;
  return { bytes, mime };
}

/** Step 1: list legacy rows carrying an inline dataUrl (never writes). */
export const listLegacyDocumentFiles = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = (await ctx.db.query("documents").collect()) as any[];

    const legacy: any[] = [];
    let alreadyStorage = 0;
    let noFile = 0;
    let noDataUrl = 0;
    const skipped: any[] = [];

    for (const d of rows) {
      if (args.limit && legacy.length >= args.limit) break;
      const f: RowFile = d.file;
      if (typeof f === "string") { alreadyStorage++; continue; }
      if (f === undefined || f === null || typeof f !== "object") { noFile++; continue; }
      if (f.storageId) { alreadyStorage++; continue; }
      const dataUrl = typeof f.dataUrl === "string" ? f.dataUrl : "";
      if (!dataUrl) { noDataUrl++; continue; }

      const decoded = decodeDataUrl(dataUrl);
      if (!decoded) {
        skipped.push({ id: d._id, title: d.title, name: f.name, reason: "dataUrl did not decode" });
        continue;
      }
      if (decoded.bytes.length > MAX_MIGRATE_BYTES) {
        skipped.push({
          id: d._id,
          title: d.title,
          name: f.name,
          reason: `dataUrl ${Math.round(decoded.bytes.length / 1024)}KB exceeds the 10MB limit`,
        });
        continue;
      }
      legacy.push({
        id: d._id,
        title: d.title,
        name: f.name ?? "file",
        type: f.type ?? decoded.mime,
        size: f.size ?? decoded.bytes.length,
        filePath: typeof f.filePath === "string" ? f.filePath.slice(0, 300) : "",
        dataUrl,
        bytes: decoded.bytes.length,
      });
    }

    return {
      total: rows.length,
      alreadyStorage,
      noFile,
      noDataUrl,
      legacy,
      skipped,
    };
  },
});

/** Step 3: patch one row onto the storage shape (additive, single field). */
export const applyDocumentFileMigration = internalMutation({
  args: {
    documentId: v.id("documents"),
    storageId: v.string(),
    name: v.string(),
    type: v.string(),
    size: v.number(),
    filePath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      file: {
        name: args.name,
        type: args.type,
        size: args.size,
        filePath: args.filePath ?? "",
        storageId: args.storageId,
      },
    });
  },
});
