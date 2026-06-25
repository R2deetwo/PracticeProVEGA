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
 *   1. Reads every table in the Convex database (72 tables)
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
 * If a target's env vars are missing, it silently skips. The app still works.
 *
 * COST: $0/month — GitHub private repos are free, Telegram cloud is free.
 */

import { internalAction, mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── Table list — all 72 tables from schema.ts ────────────────────────────
const ALL_TABLES = [
  "firms", "users", "matters", "contacts", "tasks", "documents", "workflows",
  "leads", "notifications", "invoices", "events", "timeEntries", "expenses",
  "firmActivity", "chatMessages", "chatConversations", "noteNotebooks",
  "notePages", "eventTypes", "contactCategories", "documentCategories",
  "checklistTemplates", "documentTemplates", "documentTemplateCategories",
  "externalCounselInvites", "automationRules", "intakeForms",
  "documentGenerationMetadata", "clientMessages", "archive",
  "researchNotebooks", "researchSources", "researchMessages",
  "researchAnalysisResults", "presence", "properties", "tenancies",
  "memories", "aloaConversations", "aloaMessages", "analytics_events",
  "usage_snapshots", "firm_health_scores", "user_feedback", "legal_modules",
  "statutes", "firm_licenses", "ledger_entries", "service_charges",
  "leads_pipeline", "automation_logs", "atrium_inbound_messages",
  "index_checkpoints", "module_usage_logs", "aloa_documents",
  "sales_inquiries", "service_request_types", "client_service_requests",
  "maintenance_tickets", "portal_invites", "scheduled_messages",
  "portal_conversations", "portal_messages", "payment_proofs",
  "portal_settings", "portal_notices", "notification_preferences",
  "proactive_insights", "conversation_summaries", "audit_logs",
  "invoice_outbox", "backup_log",
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
async function gzip(data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoded);
      controller.close();
    },
  });
  const compressed = stream.pipeThrough(new CompressionStream("gzip"));
  return await new Response(compressed).arrayBuffer();
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
  console.log(`[Backup] GitHub cleanup: deleting ${oldEntries.length} old backup(s)...`);

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
      console.log(`[Backup] GitHub deleted: ${entry.backupKey}`);
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
  console.log(`[Backup] Telegram cleanup: deleting ${oldEntries.length} old message(s)...`);

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
      console.log(`[Backup] Telegram deleted message ${entry.externalId}`);
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
      console.log("[Backup] No backup targets configured. Set GITHUB_BACKUP_* and/or TELEGRAM_* env vars in Convex dashboard.");
      return { success: false, reason: "NO_TARGETS_CONFIGURED" };
    }

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const timeStr = now.toISOString().split("T")[1].split(".")[0].replace(/[:]/g, ""); // HHMMSS
    const backupKey = `${dateStr}/convex-backup-${timeStr}.json.gz`;

    console.log(`[Backup] Starting export for ${dateStr} at ${now.toISOString()}...`);

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

    const results: any = { backupKey, totalDocs, rawBytes: totalBytes, compressedBytes: compressedSize, targets: {} };

    // ─── Upload to GitHub ──────────────────────────────────────────────
    if (githubConfig) {
      try {
        console.log("[Backup] Uploading to GitHub...");
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
        console.log(`[Backup] ✓ GitHub: ${ghResult.url}`);

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
        console.log("[Backup] Uploading to Telegram...");
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
        console.log(`[Backup] ✓ Telegram: message ${tgResult.messageId}`);

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

    console.log("[Backup] Done.");
    return { success: true, ...results };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// BACKUP LOG MUTATIONS / QUERIES
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
export const triggerBackupNow = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.backups.runBackup, {});
    return { scheduled: true, message: "Backup scheduled. Check Convex logs for progress." };
  },
});

// ─── Backup status query ─────────────────────────────────────────────────
export const getBackupStatus = query({
  args: {},
  handler: async (ctx) => {
    const githubConfigured = getGitHubConfig() !== null;
    const telegramConfigured = getTelegramConfig() !== null;

    // Get last 10 backup log entries
    const recentLogs: any[] = await ctx.db
      .query("backup_log")
      .withIndex("by_created", (q: any) => q)
      .order("desc")
      .take(10);

    return {
      githubConfigured,
      telegramConfigured,
      tableCount: ALL_TABLES.length,
      recentBackups: recentLogs.map((l: any) => ({
        target: l.target,
        backupKey: l.backupKey,
        success: l.success,
        sizeBytes: l.sizeBytes,
        error: l.error,
        createdAt: l.createdAt,
        url: l.fileUrl,
      })),
    };
  },
});

// ─── Internal query: fetch all documents from a table ────────────────────
export const getAllDocuments = internalQuery({
  args: { tableName: v.string() },
  handler: async (ctx, args) => {
    const results = await (ctx.db as any).query(args.tableName).collect();
    return results;
  },
});
