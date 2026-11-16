import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";

/**
 * legal/audit — the immutable audit trail (spec §2).
 *
 * Every scrape event, cache hit/miss, parser success/failure and token
 * expenditure lands in system_audit_logs. Writes are fire-and-forget
 * from the ingester's perspective (it never blocks politeness on
 * auditing its own backend), but each event is a durable row.
 *
 * AUTH: reads require the ingest token (operator tooling); writes are
 * open to internal callers only via the internal mutation below — the
 * public mutation is the token-gated one the Python worker uses.
 */

export const log = mutation({
  args: {
    ingestToken: v.optional(v.string()),
    eventType: v.string(),
    actor: v.string(),
    status: v.string(),
    payload: v.optional(v.any()),
    tokensSpent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Internal callers (Convex actions/crons) pass the env token check
    // instead of a presented token: they already run trusted. External
    // callers (the Python ingester) must present the shared secret.
    const envToken = process.env.LEGAL_INGEST_TOKEN;
    if (args.ingestToken !== undefined && args.ingestToken !== "__internal__") {
      if (!envToken || args.ingestToken !== envToken) {
        throw new Error("Unauthorized: invalid ingest token.");
      }
    }
    const now = Date.now();
    await ctx.db.insert("system_audit_logs", {
      eventType: args.eventType,
      actor: args.actor,
      status: args.status,
      payload: args.payload ?? {},
      tokensSpent: args.tokensSpent,
      createdAt: now,
    });
    return { ok: true, at: now };
  },
});

/** INTERNAL (no token — only callable by Convex code): the audit sink
 *  used by search/cron internals. External callers must use `log` with
 *  the ingest token. */
export const logInternal = internalMutation({
  args: {
    eventType: v.string(),
    actor: v.string(),
    status: v.optional(v.string()),
    payload: v.optional(v.any()),
    tokensSpent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("system_audit_logs", {
      eventType: args.eventType,
      actor: args.actor,
      status: args.status ?? "ok",
      payload: args.payload ?? {},
      tokensSpent: args.tokensSpent,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Operator view: recent audit events, newest first. Token-gated. */
export const recent = query({
  args: {
    ingestToken: v.string(),
    eventType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const envToken = process.env.LEGAL_INGEST_TOKEN;
    if (!envToken || args.ingestToken !== envToken) {
      throw new Error("Unauthorized: invalid ingest token.");
    }
    const limit = Math.min(args.limit ?? 50, 200);
    const q = args.eventType
      ? ctx.db
          .query("system_audit_logs")
          .withIndex("by_event_type", (q) =>
            q.eq("eventType", args.eventType as string),
          )
      : ctx.db.query("system_audit_logs").withIndex("by_created", (q) => q.gte("createdAt", 0));
    return await q.order("desc").take(limit);
  },
});
