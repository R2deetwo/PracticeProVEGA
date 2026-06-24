/**
 * Cloudflare R2 Backup System
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Nightly full-database export to Cloudflare R2.
 *
 * WHAT IT DOES:
 *   1. Reads every table in the Convex database
 *   2. Serializes all documents to a single JSON blob
 *   3. Compresses with gzip
 *   4. Uploads to R2 at: practicepro-backups/YYYY-MM-DD/convex-backup-HHMM.json.gz
 *   5. Deletes backups older than 30 days (rolling retention)
 *
 * ENV VARS REQUIRED (set in Convex dashboard → Settings → Environment Variables):
 *   R2_ACCOUNT_ID    — Cloudflare account ID (found in R2 dashboard sidebar)
 *   R2_ACCESS_KEY    — R2 access key ID (from API token creation)
 *   R2_SECRET_KEY    — R2 secret access key (from API token creation)
 *   R2_BUCKET_NAME   — bucket name, e.g. "practicepro-backups"
 *   R2_ENDPOINT      — https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 *
 * If any env var is missing, the backup silently skips (logs to console)
 * instead of crashing — so the app still works even before R2 is configured.
 *
 * COST: Free tier = 10 GB storage + 1M writes/month. Your data is likely
 * under 2 GB, so this costs $0/month.
 */

import { internalAction, internalMutation, mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── Table list — all 72 tables from schema.ts ────────────────────────────
// Hardcoded (not introspected) because Convex doesn't expose a "list all
// tables" API. If you add a new table to schema.ts, add it here too.
const ALL_TABLES = [
  "firms",
  "users",
  "matters",
  "contacts",
  "tasks",
  "documents",
  "workflows",
  "leads",
  "notifications",
  "invoices",
  "events",
  "timeEntries",
  "expenses",
  "firmActivity",
  "chatMessages",
  "chatConversations",
  "noteNotebooks",
  "notePages",
  "eventTypes",
  "contactCategories",
  "documentCategories",
  "checklistTemplates",
  "documentTemplates",
  "documentTemplateCategories",
  "externalCounselInvites",
  "automationRules",
  "intakeForms",
  "documentGenerationMetadata",
  "clientMessages",
  "archive",
  "researchNotebooks",
  "researchSources",
  "researchMessages",
  "researchAnalysisResults",
  "presence",
  "properties",
  "tenancies",
  "memories",
  "aloaConversations",
  "aloaMessages",
  "analytics_events",
  "usage_snapshots",
  "firm_health_scores",
  "user_feedback",
  "legal_modules",
  "statutes",
  "firm_licenses",
  "ledger_entries",
  "service_charges",
  "leads_pipeline",
  "automation_logs",
  "atrium_inbound_messages",
  "index_checkpoints",
  "module_usage_logs",
  "aloa_documents",
  "sales_inquiries",
  "service_request_types",
  "client_service_requests",
  "maintenance_tickets",
  "portal_invites",
  "scheduled_messages",
  "portal_conversations",
  "portal_messages",
  "payment_proofs",
  "portal_settings",
  "portal_notices",
  "notification_preferences",
  "proactive_insights",
  "conversation_summaries",
  "audit_logs",
  "invoice_outbox",
] as const;

// ─── R2 configuration helper ─────────────────────────────────────────────
function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY;
  const secretKey = process.env.R2_SECRET_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const endpoint = process.env.R2_ENDPOINT;

  if (!accountId || !accessKey || !secretKey || !bucketName || !endpoint) {
    return null; // R2 not configured — skip backup silently
  }
  return { accountId, accessKey, secretKey, bucketName, endpoint };
}

// ─── AWS S3-compatible signing for R2 ────────────────────────────────────
// R2 uses the S3 API, which requires AWS Signature V4. We implement the
// signing manually (no AWS SDK dependency) to keep the bundle small.
async function signV4(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: ArrayBuffer,
  accessKey: string,
  secretKey: string,
  region: string,
  service: string,
): Promise<Record<string, string>> {
  const urlObj = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  // Canonical headers (sorted, lowercase keys, trimmed values)
  const headerKeys = Object.keys(headers).map(k => k.toLowerCase()).sort();
  const canonicalHeaders = headerKeys.map(k => `${k}:${headers[k].trim()}\n`).join("");
  const signedHeaders = headerKeys.join(";");

  // Payload hash
  const encoder = new TextEncoder();
  const bodyHash = await crypto.subtle.digest("SHA-256", body);
  const payloadHash = Array.from(new Uint8Array(bodyHash))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  // Canonical request
  const canonicalRequest = [
    method,
    urlObj.pathname,
    urlObj.search.replace(/^\?/, ""), // query string without leading ?
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  // String to sign
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(canonicalRequest),
  );
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    canonicalRequestHashHex,
  ].join("\n");

  // Signing key
  const kDate = await hmac(encoder.encode(dateStamp), encoder.encode("AWS4" + secretKey));
  const kRegion = await hmac(encoder.encode(region), kDate);
  const kService = await hmac(encoder.encode(service), kRegion);
  const kSigning = await hmac(encoder.encode("aws4_request"), kService);

  // Signature
  const signature = await hmac(encoder.encode(stringToSign), kSigning);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  // Authorization header
  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  return {
    ...headers,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    "Authorization": authHeader,
  };
}

async function hmac(key: BufferSource, data: BufferSource): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, data);
}

// ─── Gzip compression (using Web Compression API) ────────────────────────
async function gzip(data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const stream = new Blob([encoder.encode(data)]).stream();
  const compressed = stream.pipeThrough(new CompressionStream("gzip"));
  const result = await new Response(compressed).arrayBuffer();
  return result;
}

// ─── Main backup action ──────────────────────────────────────────────────
export const runBackup = internalAction({
  args: {},
  handler: async (ctx) => {
    const config = getR2Config();
    if (!config) {
      console.log("[Backup] R2 not configured — skipping. Set R2_* env vars in Convex dashboard.");
      return { success: false, reason: "R2_NOT_CONFIGURED" };
    }

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const timeStr = now.toISOString().split("T")[1].split(".")[0].replace(/[:]/g, ""); // HHMMSS
    const backupKey = `${dateStr}/convex-backup-${timeStr}.json.gz`;

    console.log(`[Backup] Starting export for ${dateStr}...`);

    // ─── Export each table ──────────────────────────────────────────────
    const exportData: Record<string, any> = {
      _metadata: {
        exportedAt: now.toISOString(),
        convexDeployment: "gregarious-malamute-537",
        tableCount: ALL_TABLES.length,
        version: 1,
      },
    };

    let totalDocs = 0;
    let totalBytes = 0;

    for (const tableName of ALL_TABLES) {
      try {
        const docs: any[] = await ctx.runQuery(internal.backups.getAllDocuments, { tableName });
        exportData[tableName] = docs;
        totalDocs += docs.length;
        const tableBytes = JSON.stringify(docs).length;
        totalBytes += tableBytes;
        console.log(`[Backup] ${tableName}: ${docs.length} docs (${(tableBytes / 1024).toFixed(1)} KB)`);
      } catch (err: any) {
        console.error(`[Backup] Failed to export ${tableName}:`, err.message);
        exportData[tableName] = { _error: err.message, _exported: false };
      }
    }

    // ─── Serialize + compress ──────────────────────────────────────────
    const jsonStr = JSON.stringify(exportData);
    const compressed = await gzip(jsonStr);
    const compressedSize = compressed.byteLength;

    console.log(`[Backup] Total: ${totalDocs} docs, ${(totalBytes / 1024 / 1024).toFixed(2)} MB raw → ${(compressedSize / 1024 / 1024).toFixed(2)} MB compressed`);

    // ─── Upload to R2 ──────────────────────────────────────────────────
    const uploadUrl = `${config.endpoint}/${config.bucketName}/${backupKey}`;
    const uploadHeaders: Record<string, string> = {
      "Host": new URL(config.endpoint).host,
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
    };

    const signedHeaders = await signV4(
      "PUT",
      uploadUrl,
      uploadHeaders,
      compressed,
      config.accessKey,
      config.secretKey,
      "auto",
      "s3",
    );

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: signedHeaders,
      body: compressed,
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      console.error(`[Backup] R2 upload failed (${uploadResponse.status}):`, errText);
      return { success: false, reason: "UPLOAD_FAILED", status: uploadResponse.status, error: errText };
    }

    console.log(`[Backup] ✓ Uploaded to R2: ${backupKey}`);

    // ─── Cleanup old backups (>30 days) ────────────────────────────────
    try {
      await cleanupOldBackups(config, 30);
    } catch (err: any) {
      console.warn(`[Backup] Cleanup failed (non-fatal):`, err.message);
    }

    return {
      success: true,
      backupKey,
      totalDocs,
      rawBytes: totalBytes,
      compressedBytes: compressedSize,
    };
  },
});

// ─── Cleanup: delete backups older than N days ───────────────────────────
async function cleanupOldBackups(config: NonNullable<ReturnType<typeof getR2Config>>, retentionDays: number) {
  // List objects in the bucket
  const listUrl = `${config.endpoint}/${config.bucketName}?list-type=2`;
  const listHeaders: Record<string, string> = {
    "Host": new URL(config.endpoint).host,
  };

  const signedListHeaders = await signV4(
    "GET",
    listUrl,
    listHeaders,
    new ArrayBuffer(0),
    config.accessKey,
    config.secretKey,
    "auto",
    "s3",
  );

  const listResponse = await fetch(listUrl, { headers: signedListHeaders });
  if (!listResponse.ok) {
    throw new Error(`List failed: ${listResponse.status}`);
  }

  const listXml = await listResponse.text();

  // Parse XML response to extract object keys + last modified dates
  const objects: Array<{ key: string; lastModified: string }> = [];
  const objectRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match;
  while ((match = objectRegex.exec(listXml)) !== null) {
    const contents = match[1];
    const keyMatch = contents.match(/<Key>(.*?)<\/Key>/);
    const dateMatch = contents.match(/<LastModified>(.*?)<\/LastModified>/);
    if (keyMatch && dateMatch) {
      objects.push({ key: keyMatch[1], lastModified: dateMatch[1] });
    }
  }

  // Find old backups
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const oldObjects = objects.filter(o => new Date(o.lastModified).getTime() < cutoff);

  if (oldObjects.length === 0) {
    console.log("[Backup] No old backups to clean up.");
    return;
  }

  console.log(`[Backup] Cleaning up ${oldObjects.length} backup(s) older than ${retentionDays} days...`);

  // Delete each old object
  for (const obj of oldObjects) {
    const deleteUrl = `${config.endpoint}/${config.bucketName}/${encodeURIComponent(obj.key)}`;
    const deleteHeaders: Record<string, string> = {
      "Host": new URL(config.endpoint).host,
    };

    const signedDeleteHeaders = await signV4(
      "DELETE",
      deleteUrl,
      deleteHeaders,
      new ArrayBuffer(0),
      config.accessKey,
      config.secretKey,
      "auto",
      "s3",
    );

    const deleteResponse = await fetch(deleteUrl, {
      method: "DELETE",
      headers: signedDeleteHeaders,
    });

    if (deleteResponse.ok) {
      console.log(`[Backup] Deleted: ${obj.key}`);
    } else {
      console.warn(`[Backup] Failed to delete ${obj.key}: ${deleteResponse.status}`);
    }
  }
}

// ─── Manual trigger (for testing) ────────────────────────────────────────
export const triggerBackupNow = mutation({
  args: {},
  handler: async (ctx) => {
    // Schedule the backup action to run immediately
    await ctx.scheduler.runAfter(0, internal.backups.runBackup, {});
    return { scheduled: true, message: "Backup scheduled. Check Convex logs for progress." };
  },
});

// ─── Backup status query ─────────────────────────────────────────────────
export const getBackupStatus = query({
  args: {},
  handler: async (ctx) => {
    return {
      r2Configured: getR2Config() !== null,
      tableCount: ALL_TABLES.length,
      tables: ALL_TABLES,
    };
  },
});

// ─── Internal query: fetch all documents from a table ────────────────────
// Called by runBackup for each table. Uses .collect() with no filter
// to get every document. The result is JSON-serialized by the action.
export const getAllDocuments = internalQuery({
  args: { tableName: v.string() },
  handler: async (ctx, args) => {
    // Convex doesn't allow dynamic table names in the typed query builder,
    // so we use the generic db.query() with a cast.
    const results = await (ctx.db as any).query(args.tableName).collect();
    return results;
  },
});

