import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireFounder } from "./founderMetrics";
import { withCronReporting } from "./observability";

/**
 * queryMetrics — Item 4's observability tailpiece: a weekly record of
 * table sizes so cap growth is VISIBLE.
 *
 * WHY: the bounding pass (portals 78 + myFunctions 53 + founderMetrics 19 +
 * sentry 18 + proactive 15 = 183 .collect() → .take(n)) turned unbounded
 * reads into documented truncation. Truncation is only honest if someone
 * can SEE the table approaching its cap — this job records per-table row
 * counts weekly so the trend shows up in the founder dashboard before a
 * cap is ever hit.
 *
 * COUNTING: Convex has no count() API — each count is a take(5001) read
 * capped at 5000 (rows beyond report as 5000 with capped:true). A weekly,
 * per-table 5k-doc read is an acceptable observability cost; it is NOT a
 * request-path read.
 *
 * "TOP QUERIES": Convex does not expose per-function telemetry through the
 * API — the dashboard's function-run stats remain the source for that.
 * What this table gives is the demand side (rows per table per week) that
 * those function stats can be read against.
 */

// The monitored set — the tables the five bounded modules read, plus the
// core operational tables. Keep in sync with the bounding caps.
const MONITORED_TABLES = [
  "firms", "users", "contacts", "properties", "matters", "tasks",
  "documents", "invoices", "ledger_entries", "service_charges",
  "firmActivity", "clientMessages", "maintenance_tickets",
  "client_service_requests", "service_request_types", "portal_messages",
  "portal_conversations", "portal_invites", "portal_notices",
  "payment_proofs", "tenancies", "atrium_inbound_messages",
  "scheduled_messages", "notifications", "presence", "analytics_events",
  "automation_logs", "leads_pipeline", "proactive_insights", "archive",
] as const;

const COUNT_CAP = 5000;

export const recordTableSizes = internalMutation({
  args: {},
  handler: withCronReporting("crons:recordTableSizes", async (ctx) => {
    const sizes: Array<{ table: string; rowCount: number; capped: boolean }> = [];
    let totalRows = 0;

    for (const table of MONITORED_TABLES) {
      try {
        // Capped count: take one past the cap so "capped" is exact.
        const rows = await ctx.db.query(table as any).take(COUNT_CAP + 1);
        const capped = rows.length > COUNT_CAP;
        const rowCount = Math.min(rows.length, COUNT_CAP);
        sizes.push({ table, rowCount, capped });
        totalRows += rowCount;
      } catch (e) {
        // A missing/renamed table must never kill the whole recording.
        console.warn(`[queryMetrics] could not count ${table}:`, e);
      }
    }

    await ctx.db.insert("table_size_records" as any, {
      recordedAt: new Date().toISOString(),
      weekOf: new Date().toISOString().split("T")[0],
      sizes,
      totalRows,
      monitoredCount: MONITORED_TABLES.length,
    });
  }),
});

/** Founder-guarded: the weekly size history, newest first. */
export const getTableSizeHistory = query({
  args: {
    tokenIdentifier: v.string(),
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier, args.sessionToken);
    const limit = Math.min(Math.max(args.limit ?? 12, 1), 52);
    return await ctx.db
      .query("table_size_records" as any)
      .withIndex("by_recorded_at")
      .order("desc")
      .take(limit);
  },
});
