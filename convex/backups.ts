/**
 * Multi-Target Cloud Backup System (No Credit Card Required)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Nightly full-database export to TWO free cloud targets:
 *
 *   1. GitHub Private Repo — uses the GitHub Contents API
 *   2. Telegram Bot Channel — uses the Telegram Bot API sendDocument
 *
 * Both are TRULY FREE (no credit card required) and provide redundant
 * off-Convex copies of your entire database.
 *
 * WHAT IT DOES:
 *   1. Reads every table in the Convex database (135 tables — the full
 *      schema inventory, audited 2026-11-22)
 *   2. Serializes all documents to a single JSON blob
 *   3. Compresses with gzip
 *   4. Uploads to GitHub (if GITHUB_BACKUP_TOKEN is set)
 *   5. Uploads to Telegram (if TELEGRAM_BOT_TOKEN is set)
 *   6. Logs each upload to backup_log table (for cleanup + status)
 *   7. Deletes backups older than 30 days from each target
 *
 * ENV VARS (set in Convex dashboard → Settings → Environment Variables):
 *
 *   GitHub target:
 *     GITHUB_BACKUP_TOKEN  — GitHub Personal Access Token (classic, with repo scope)
 *     GITHUB_BACKUP_OWNER  — your GitHub username, e.g. "R2deetwo"
 *     GITHUB_BACKUP_REPO   — private repo name, e.g. "PracticePro-Backups"
 *
 *   Telegram target:
 *     TELEGRAM_BOT_TOKEN     — bot token from @BotFather
 *     TELEGRAM_BACKUP_CHAT_ID — chat ID of the private channel (negative number)
 *
 * If a target's env vars are missing, it records one `none` row per run
 * (target "none", success false) so the pipeline's firing stays visible;
 * the ALOA X watchdog reads the env vars directly and shows an honest
 * "NOT CONFIGURED" info state — no false "backup failed" alarms. The
 * app still works either way.
 *
 * COST: $0/month — GitHub private repos are free, Telegram cloud is free.
 */

import { internalAction, mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── Table list — every table in convex/schema.ts (2026-11-22 audit) ──────
// FOUNDER AUDIT ("document what exact data this job is intended to back
// up"): the original list had 72 tables and had drifted — 63 newer tables
// were silently excluded, including the ENTIRE Legal KB (judgments,
// instruments, chunks, artifacts, queue, seeds), the Aloa X watchdog
// (alerts/state/login events), sessions, push tokens, wallets, trust
// transactions, reconciliation reports and the estate/visitor stack.
// This list is now the complete schema inventory (135 tables), grouped by
// domain so future drift is easy to spot. `legal_raw_artifacts` rows are
// metadata only — the artifact BYTES live in Convex file storage, which
// table reads cannot export (an honest boundary: the parse cache is
// re-fetchable from source URLs; the structured data IS backed up).
const ALL_TABLES = [
  // Core workspace
  "firms", "users", "contacts", "matters", "matterStageHistory", "tasks",
  "documents", "workflows", "events", "eventTypes", "timeEntries", "expenses",
  "leads", "notifications", "invoices", "archive", "contactCategories",
  "documentCategories", "checklistTemplates", "documentTemplates",
  "documentTemplateCategories", "externalCounselInvites", "intakeForms",
  "documentGenerationMetadata", "conflict_checks", "feature_flags",
  "termsAcceptance", "impersonation_tokens", "rateLimits",
  // Messaging & portals
  "presence", "chatMessages", "chatConversations", "clientMessages", "portal_conversations",
  "portal_messages", "portal_invites", "portal_notices", "portal_settings",
  "scheduled_messages", "message_opt_outs", "atrium_inbound_messages",
  "notification_preferences", "app_notifications",
  // Notes & research
  "noteNotebooks", "notePages", "researchNotebooks", "researchSources",
  "researchMessages", "researchAnalysisResults",
  // AI & voice
  "memories", "aloaConversations", "aloaMessages", "aloa_documents",
  "ai_output_logs", "conversation_summaries", "proactive_insights",
  "voiceCaptures", "voiceSnippets", "voiceDictionary",
  // Legal knowledge base (the autonomous corpus)
  "legal_scrape_queue", "legal_raw_artifacts", "legal_judgments",
  "legal_instruments", "legal_chunks", "legal_query_cache",
  "legal_seed_sources", "legal_engine_state",
  "statutes", "legal_modules", "instruments", "instrument_provisions",
  "instrument_changes", "court_forms", "authorityLibrary",
  // Property (Atrium)
  "properties", "tenancies", "service_charges", "maintenance_tickets",
  "client_service_requests", "service_request_types", "payment_proofs",
  "property_relationships", "relationship_types", "resident_wallets",
  "wallet_transactions", "trust_transactions", "estate_amenities",
  "estate_amenity_bookings", "estate_bulletins", "estate_service_providers",
  "visitor_tokens",
  // Money
  "ledger_entries", "charge_types", "financial_counters",
  "financial_audit_log", "financial_reconciliation_reports",
  "reconciliation_matches", "invoice_outbox", "paystackEvents",
  "refundRequests", "organization_payout_details",
  // Automation & growth
  "automationRules", "automation_workflows", "automation_dispatch_log",
  "automation_logs", "automation_unit_opt_outs", "leads_pipeline",
  "sales_inquiries", "subscriptionRequests", "subscriptionAddons",
  "firm_licenses", "firm_health_scores", "usage_snapshots",
  "analytics_events", "module_usage_logs", "index_checkpoints",
  "user_feedback", "institutions",
  // WhatsApp
  "whatsapp_settings", "whatsapp_templates", "whatsapp_template_mappings",
  // Security & observability
  "sessions", "user_push_tokens", "blockedIps", "suspendedUsers",
  "securityEvents", "sentry_arrival_requests", "audit_logs",
  "error_events", "alox_alerts", "alox_state", "founder_login_events",
  "table_size_records", "firmActivity",
  // Self-reference (the backup ledger itself)
  "backup_log",
] as const;

// ─── Config helpers ──────────────────────────────────────────────────────
function getGitHubConfig() {
  const token = process.env.GITHUB_BACKUP_TOKEN;
  const owner = process.env.GITHUB_BACKUP_OWNER;
  const repo = process.env.GITHUB_BACKUP_REPO;
  if (!token || !owner || !repo) return null;
  return { token, owner, repo };
}

function getTelegramConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_BACKUP_CHAT_ID;
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

// ─── Gzip compression ────────────────────────────────────────────────────
// Uses Web APIs (TextEncoder, CompressionStream, Response) which are
// available in the Convex actions runtime.
/** Compress with gzip when the runtime supports CompressionStream.
 *  LIVE-AUDIT FIX (2026-11-22): Convex's V8 isolate does NOT expose
 *  CompressionStream — the first real run of this pipeline (targets
 *  configured) crashed with "CompressionStream is not defined", proving
 *  the gzip path had never been exercisable. Fallback: upload the RAW
 *  JSON bytes with an honest .json extension — the export is complete
 *  either way; only the wire size differs. */
async function maybeGzip(data: string): Promise<{ bytes: ArrayBuffer; ext: "json.gz" | "json" }> {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  if (typeof (globalThis as any).CompressionStream === "undefined") {
    return { bytes: encoded.slice().buffer, ext: "json" };
  }
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoded);
      controller.close();
    },
  });
  const compressed = stream.pipeThrough(new (globalThis as any).CompressionStream("gzip"));
  return { bytes: await new Response(compressed).arrayBuffer(), ext: "json.gz" };
}

// ArrayBuffer → base64 (for GitHub API)
// Uses a manual byte-by-byte conversion to avoid btoa() which may not
// be available in all Convex runtime environments.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // Process in 32KB chunks to avoid stack overflow
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk) as number[]);
  }
  // Use globalThis.btoa if available, otherwise use Buffer (Node fallback)
  if (typeof globalThis !== 'undefined' && typeof (globalThis as any).btoa === 'function') {
    return (globalThis as any).btoa(binary);
  }
  // Node.js fallback
  return Buffer.from(binary, 'binary').toString('base64');
}

// ═══════════════════════════════════════════════════════════════════════════
// GITHUB TARGET
// ═══════════════════════════════════════════════════════════════════════════

async function uploadToGitHub(
  config: NonNullable<ReturnType<typeof getGitHubConfig>>,
  compressed: ArrayBuffer,
  backupKey: string,
): Promise<{ sha: string; url: string }> {
  const base64Content = arrayBufferToBase64(compressed);
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${backupKey}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${config.token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      message: `Nightly backup: ${backupKey}`,
      content: base64Content,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GitHub upload failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return { sha: data.content.sha, url: data.content.html_url };
}

async function cleanupOldGitHubBackups(
  config: NonNullable<ReturnType<typeof getGitHubConfig>>,
  retentionDays: number,
  ctx: any,
) {
  // List backup_log entries older than retention period for GitHub
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const oldEntries: any[] = await ctx.runQuery(internal.backups.getOldBackupLogs, { target: "github", cutoff });

  if (oldEntries.length === 0) return;

  for (const entry of oldEntries) {
    try {
      // Delete the file from GitHub (needs the SHA)
      const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${entry.backupKey}`;
      await fetch(url, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${config.token}`,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          message: `Cleanup: delete ${entry.backupKey}`,
          sha: entry.externalId,
        }),
      });
      // Delete the log entry
      await ctx.runMutation(internal.backups.deleteBackupLog, { id: entry._id });
    } catch (err: any) {
      console.warn(`[Backup] Failed to delete GitHub backup ${entry.backupKey}:`, err.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TELEGRAM TARGET
// ═══════════════════════════════════════════════════════════════════════════

async function uploadToTelegram(
  config: NonNullable<ReturnType<typeof getTelegramConfig>>,
  compressed: ArrayBuffer,
  backupKey: string,
): Promise<{ messageId: string; fileId: string }> {
  const formData = new FormData();
  formData.append("chat_id", config.chatId);
  const blob = new Blob([compressed], { type: "application/gzip" });
  formData.append("document", blob, backupKey);
  formData.append("caption", `📦 PracticePro backup: ${backupKey}`);

  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendDocument`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Telegram upload failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (!data.ok) throw new Error(`Telegram API error: ${data.description}`);

  return {
    messageId: String(data.result.message_id),
    fileId: data.result.document?.file_id || "",
  };
}

async function cleanupOldTelegramBackups(
  config: NonNullable<ReturnType<typeof getTelegramConfig>>,
  retentionDays: number,
  ctx: any,
) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const oldEntries: any[] = await ctx.runQuery(internal.backups.getOldBackupLogs, { target: "telegram", cutoff });

  if (oldEntries.length === 0) return;

  for (const entry of oldEntries) {
    try {
      await fetch(`https://api.telegram.org/bot${config.botToken}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          message_id: parseInt(entry.externalId, 10),
        }),
      });
      await ctx.runMutation(internal.backups.deleteBackupLog, { id: entry._id });
    } catch (err: any) {
      console.warn(`[Backup] Failed to delete Telegram message ${entry.externalId}:`, err.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN BACKUP ACTION
// ═══════════════════════════════════════════════════════════════════════════

export const runBackup = internalAction({
  args: {},
  handler: async (ctx) => {
    const githubConfig = getGitHubConfig();
    const telegramConfig = getTelegramConfig();

    if (!githubConfig && !telegramConfig) {
      // 2026-11-22: the job FIRES but has nowhere to send data. Record
      // that fact (target "none", success false) so the founder can see
      // the pipeline is alive but unconfigured — the ALOA X watchdog
      // separately reads the env vars and shows the honest "NOT
      // CONFIGURED" state instead of "never completed". Old "none" rows
      // are pruned to the last 7 (a week's evidence is plenty).
      try {
        await ctx.runMutation(internal.backups.recordUnconfiguredRun, {});
      } catch (e: any) {
        console.warn("[Backup] Could not record the unconfigured run:", e?.message);
      }
      return { success: false, reason: "NO_TARGETS_CONFIGURED" };
    }

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const timeStr = now.toISOString().split("T")[1].split(".")[0].replace(/[:]/g, ""); // HHMMSS

    // ─── Export each table ──────────────────────────────────────────────
    const exportData: Record<string, any> = {
      _metadata: {
        exportedAt: now.toISOString(),
        convexDeployment: "gregarious-malamute-537",
        tableCount: ALL_TABLES.length,
        version: 2,
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
      } catch (err: any) {
        console.error(`[Backup] Failed to export ${tableName}:`, err.message);
        exportData[tableName] = { _error: err.message, _exported: false };
      }
    }

    // ─── Serialize + compress ──────────────────────────────────────────
    const jsonStr = JSON.stringify(exportData);
    const { bytes: compressed, ext } = await maybeGzip(jsonStr);
    const backupKey = `${dateStr}/convex-backup-${timeStr}.${ext}`;
    const compressedSize = compressed.byteLength;

    const results: any = { backupKey, totalDocs, rawBytes: totalBytes, compressedBytes: compressedSize, targets: {} };

    // ─── Upload to GitHub ──────────────────────────────────────────────
    if (githubConfig) {
      try {
        const ghResult = await uploadToGitHub(githubConfig, compressed, backupKey);
        await ctx.runMutation(internal.backups.logBackup, {
          target: "github",
          backupKey,
          externalId: ghResult.sha,
          fileUrl: ghResult.url,
          sizeBytes: compressedSize,
          success: true,
        });
        results.targets.github = { success: true, url: ghResult.url };

        // Cleanup old backups
        try {
          await cleanupOldGitHubBackups(githubConfig, 30, ctx);
        } catch (err: any) {
          console.warn(`[Backup] GitHub cleanup failed (non-fatal):`, err.message);
        }
      } catch (err: any) {
        console.error(`[Backup] GitHub upload failed:`, err.message);
        await ctx.runMutation(internal.backups.logBackup, {
          target: "github",
          backupKey,
          externalId: "",
          fileUrl: "",
          sizeBytes: compressedSize,
          success: false,
          error: err.message,
        });
        results.targets.github = { success: false, error: err.message };
      }
    }

    // ─── Upload to Telegram ────────────────────────────────────────────
    if (telegramConfig) {
      try {
        const tgResult = await uploadToTelegram(telegramConfig, compressed, backupKey);
        await ctx.runMutation(internal.backups.logBackup, {
          target: "telegram",
          backupKey,
          externalId: tgResult.messageId,
          fileUrl: "",
          sizeBytes: compressedSize,
          success: true,
        });
        results.targets.telegram = { success: true, messageId: tgResult.messageId };

        // Cleanup old messages
        try {
          await cleanupOldTelegramBackups(telegramConfig, 30, ctx);
        } catch (err: any) {
          console.warn(`[Backup] Telegram cleanup failed (non-fatal):`, err.message);
        }
      } catch (err: any) {
        console.error(`[Backup] Telegram upload failed:`, err.message);
        await ctx.runMutation(internal.backups.logBackup, {
          target: "telegram",
          backupKey,
          externalId: "",
          fileUrl: "",
          sizeBytes: compressedSize,
          success: false,
          error: err.message,
        });
        results.targets.telegram = { success: false, error: err.message };
      }
    }

    return { success: true, ...results };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// BACKUP LOG MUTATIONS / QUERIES

/**
 * 2026-11-22: nightly-run evidence when NO target is configured. Inserts
 * one `none` row per unconfigured run (so the job's firing is visible in
 * backup_log) and prunes older `none` rows to the most recent 7 — bounded,
 * and never touched by the per-target retention (which only deletes
 * SUCCESS rows by target).
 */
export const recordUnconfiguredRun = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();
    await ctx.db.insert("backup_log", {
      target: "none",
      backupKey: `unconfigured/${now.split("T")[0]}`,
      externalId: "",
      fileUrl: "",
      sizeBytes: 0,
      success: false,
      error: "NO_TARGETS_CONFIGURED — set GITHUB_BACKUP_* or TELEGRAM_* env vars (RUNBOOK.md → Backups)",
      createdAt: now,
    });
    // Prune: keep the newest 7 "none" rows, delete the rest.
    const noneRows = await ctx.db
      .query("backup_log")
      .withIndex("by_target_created", (q: any) => q.eq("target", "none").lt("createdAt", now))
      .order("desc")
      .take(50);
    for (const row of noneRows.slice(7)) {
      await ctx.db.delete(row._id);
    }
    return { recorded: true };
  },
});
// ═══════════════════════════════════════════════════════════════════════════

export const logBackup = internalMutation({
  args: {
    target: v.string(),
    backupKey: v.string(),
    externalId: v.string(),
    fileUrl: v.optional(v.string()),
    sizeBytes: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("backup_log", {
      target: args.target,
      backupKey: args.backupKey,
      externalId: args.externalId,
      fileUrl: args.fileUrl,
      sizeBytes: args.sizeBytes,
      success: args.success,
      error: args.error,
      createdAt: now,
    });
  },
});

export const deleteBackupLog = internalMutation({
  args: { id: v.id("backup_log") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getOldBackupLogs = internalQuery({
  args: { target: v.string(), cutoff: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("backup_log")
      .withIndex("by_target_created", (q: any) => q.eq("target", args.target).lt("createdAt", args.cutoff))
      .filter((q: any) => q.eq(q.field("success"), true))
      .collect();
  },
});

// ─── Manual trigger (for testing) ────────────────────────────────────────
/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * triggerBackupNow + getBackupStatus removed (this record covers both): UNGATED public backup trigger/status with zero product callers — the backup drill is workflow-driven. The internal log helpers remain (out of the D8 public-surface charter).
 */

// ─── Backup status query ─────────────────────────────────────────────────

// ─── Internal query: fetch all documents from a table ────────────────────
export const getAllDocuments = internalQuery({
  args: { tableName: v.string() },
  handler: async (ctx, args) => {
    const results = await (ctx.db as any).query(args.tableName).collect();
    return results;
  },
});
