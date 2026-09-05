/**
 * observability.ts — backend error visibility (plan Round 17, item 1).
 *
 * WHY THIS EXISTS: through Round 16 the backend was effectively silent.
 * Sentry covered the FRONTEND only, so when a scheduled job or webhook
 * failed, the round-9 bug pattern repeated: one symptom, weeks of quiet
 * breakage, nothing to look at. This module gives the backend a voice:
 *
 *   1. `error_events` TABLE (first-class, queryable, in-app dashboard) —
 *      works with ZERO external configuration and survives even when
 *      no DSN is set. This is the source of truth.
 *   2. Optional Sentry envelope POST (best-effort, fire-and-forget) when
 *      the `SENTRY_BACKEND_DSN` Convex env var is set — unifies backend
 *      errors with frontend errors in one dashboard + alerting.
 *
 * WIRING (keep it boring):
 *   - `withCronReporting(name, handler)` — wraps scheduled-job handlers:
 *     capture, rethrow (Convex still marks the run failed), never let
 *     reporting itself break the job.
 *   - `captureWebhookError(...)` — called from http.ts webhook handlers.
 *   - Actions (node runtime) can call `reportToSentry` directly.
 *
 * RETENTION: 30 days via the purgeOldErrorEvents cron (crons.ts). The
 * table is append-only for clients: only internal mutations write.
 */
import { internalMutation, internalQuery, query, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireFounder } from "./founderMetrics";

export const ERROR_RETENTION_DAYS = 30;

// ─── Writers (internal only — never exposed to the client) ──────────────────

export const captureErrorEvent = internalMutation({
  args: {
    scope: v.string(),          // 'cron' | 'webhook' | 'action' | 'http'
    name: v.string(),           // e.g. 'crons:runSubscriptionDunning'
    message: v.string(),
    stack: v.optional(v.string()),
    context: v.optional(v.string()), // JSON string of extra detail
    severity: v.optional(v.string()), // 'error' (default) | 'warning'
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("error_events", {
      scope: args.scope,
      name: args.name,
      message: args.message.slice(0, 2000),
      stack: args.stack?.slice(0, 4000),
      context: args.context?.slice(0, 4000),
      severity: args.severity ?? "error",
      timestamp: Date.now(),
    });
    // Hard cap: keep the table lean even if a job fails every 5 minutes
    // for days (bounded blow-up, cheap query). Oldest first.
    const count = await ctx.db.query("error_events").withIndex("by_scope", (q) => q.eq("scope", args.scope)).collect();
    if (count.length > 1000) {
      const toDelete = count.slice(0, count.length - 1000);
      for (const row of toDelete) {
        await ctx.db.delete(row._id);
      }
    }
    return { recorded: true };
  },
});

// ─── Cron wrapper: the one-line retrofit for scheduled jobs ─────────────────

/**
 * Wrap a scheduled-job handler so failures are captured (table + Sentry)
 * and then RETHROWN — Convex's cron log stays the authority on run status;
 * this just makes the failure impossible to miss.
 *
 * Works for BOTH internalMutation and internalAction handlers:
 * mutations write the event via ctx.db (no fetch, no runMutation), actions
 * relay through the internal capture mutation and can also fire the
 * Sentry envelope. Reporting failures are swallowed — a monitoring
 * problem must never make the monitored job worse.
 *
 * Usage in myFunctions.ts & friends:
 *   export const runThing = internalMutation({
 *     args: {...},
 *     handler: withCronReporting("crons:runThing", async (ctx, args) => {
 *       ...existing body untouched...
 *     }),
 *   });
 */
export function withCronReporting(
  name: string,
  handler: (ctx: any, args: any) => Promise<any>
): (ctx: any, args: any) => Promise<any> {
  const buildEvent = (err: any) => ({
    scope: "cron" as const,
    name,
    message: String(err?.message || err).slice(0, 2000),
    stack: err?.stack ? String(err.stack).slice(0, 4000) : undefined,
    severity: "error" as const,
    timestamp: Date.now(),
  });

  return async (ctx: any, args: any) => {
    try {
      return await handler(ctx, args);
    } catch (err: any) {
      try {
        const event = buildEvent(err);
        if (typeof ctx?.db?.insert === "function") {
          // Mutation context: direct table write.
          await ctx.db.insert("error_events", event);
        } else if (typeof ctx?.runMutation === "function") {
          // Action context: relay through the internal capture mutation.
          await ctx.runMutation(internal.observability.captureErrorEvent, {
            scope: event.scope,
            name: event.name,
            message: event.message,
            stack: event.stack,
            severity: event.severity,
          });
          // Action runtime can also reach Sentry directly (best-effort).
          await reportToSentry("cron", name, String(err?.message || err));
        }
      } catch {
        // Reporting must never turn a job failure into a double failure.
      }
      throw err;
    }
  };
}

// ─── Webhook capture (called from http.ts error paths) ──────────────────────

export const captureWebhookError = internalMutation({
  args: {
    name: v.string(),
    message: v.string(),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("error_events", {
      scope: "webhook",
      name: args.name,
      message: args.message.slice(0, 2000),
      context: args.context?.slice(0, 4000),
      severity: "error",
      timestamp: Date.now(),
    });
    return { recorded: true };
  },
});

// ─── Sentry relay (best-effort; table above is the source of truth) ─────────

/**
 * Post a Sentry event directly from a Convex action (node runtime) using
 * the envelope endpoint — no SDK needed. Fire-and-forget with hard
 * timeouts; returns silently when no DSN is configured or on any failure.
 *
 * DSN shape: https://<key>@o<org>.ingest.sentry.io/<project>
 */
export async function reportToSentry(
  scope: string,
  name: string,
  message: string,
  extra?: Record<string, unknown>
): Promise<void> {
  const dsn = process.env.SENTRY_BACKEND_DSN;
  if (!dsn) return;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace("/", "");
    const publicKey = url.username;
    const envelopeEndpoint = `https://${url.host}/api/${projectId}/envelope/`;

    const event = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: new Date().toISOString(),
      platform: "node",
      environment: process.env.NODE_ENV || "production",
      server_name: "convex-backend",
      level: "error",
      logger: `convex.${scope}`,
      message: `${name}: ${message}`,
      extra: extra ?? {},
      tags: { scope, name },
    };
    const envelope = `${JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString() })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    await fetch(envelopeEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=convex-observability/1.0`,
      },
      body: envelope,
      signal: controller.signal,
    }).catch(() => { /* swallow — table already has the event */ });
    clearTimeout(timeout);
  } catch {
    // Never let telemetry break the caller.
  }
}

// ─── Readers (founder-only — the in-app observability surface) ──────────────

export const getRecentErrorEvents = query({
  args: { sessionToken: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Founder-only: error events can contain messages with firm context.
    await requireFounder(ctx, undefined, args.sessionToken ?? null);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const rows = await ctx.db
      .query("error_events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
    return rows;
  },
});

export const getErrorEventCounts = internalQuery({
  args: {},
  handler: async (ctx, _args) => {
    const now = Date.now();
    const day = now - 24 * 60 * 60 * 1000;
    const week = now - 7 * 24 * 60 * 60 * 1000;
    const all = await ctx.db.query("error_events").withIndex("by_timestamp").collect();
    return {
      last24h: all.filter((r: any) => r.timestamp >= day).length,
      last7d: all.filter((r: any) => r.timestamp >= week).length,
      total: all.length,
      byName: all
        .filter((r: any) => r.timestamp >= week)
        .reduce((acc: Record<string, number>, r: any) => {
          acc[r.name] = (acc[r.name] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
    };
  },
});

// ─── Retention (cron-driven) ─────────────────────────────────────────────────

export const purgeOldErrorEvents = internalMutation({
  args: {},
  handler: async (ctx, _args) => {
    const cutoff = Date.now() - ERROR_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const old = await ctx.db.query("error_events").withIndex("by_timestamp").collect();
    let deleted = 0;
    for (const row of old) {
      if (row.timestamp < cutoff) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

// ─── Self-test (used by the Round 17 "alert fires on a simulated failure"
//     acceptance: dispatch once from CI or the founder dashboard, then read
//     it back with getRecentErrorEvents) ────────────────────────────────────

export const simulateErrorEvent = internalAction({
  args: { name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const name = args.name ?? "observability:simulated-failure";
    await ctx.runMutation(internal.observability.captureErrorEvent, {
      scope: "action",
      name,
      message: "Simulated failure — this is the Round 17 alert-path drill. Safe to ignore.",
      severity: "warning",
    });
    await reportToSentry("action", name, "Simulated failure (Round 17 drill)");
    return { simulated: true };
  },
});
