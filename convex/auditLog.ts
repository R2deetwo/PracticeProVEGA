import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Server-Side Audit Log System
 *
 * Provides an append-only, server-side audit trail for all significant mutations.
 * Unlike the client-side logActivity, this cannot be tampered with or bypassed.
 *
 * Usage: Call logAuditEvent from any Convex mutation that modifies data.
 * Every create, update, delete, archive, restore, invite, revoke, etc. should be logged.
 */

/**
 * Log an audit event. Should be called from within mutations that modify data.
 * This is an internal helper — not exposed as a public mutation.
 */
export function createAuditLogger(db: any) {
  return async (params: {
    firmId: string;
    actorId?: string;
    actorName?: string;
    actorRole?: string;
    action: string;
    resource: string;
    resourceId?: string;
    resourceName?: string;
    previousState?: any;
    metadata?: any;
  }) => {
    try {
      await db.insert("audit_logs", {
        firmId: params.firmId,
        actorId: params.actorId,
        actorName: params.actorName,
        actorRole: params.actorRole,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        resourceName: params.resourceName,
        previousState: params.previousState,
        metadata: params.metadata,
        timestamp: Date.now(),
      });
    } catch (error) {
      // Audit logging should never break the main mutation
      console.error("[AUDIT] Failed to log event:", error);
    }
  };
}

/**
 * Public mutation to log audit events from client-side.
 * Used for operations that don't go through Convex mutations
 * but still need to be recorded (e.g., email sends, exports).
 */
export const logAuditEvent = mutation({
  args: {
    firmId: v.string(),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    actorRole: v.optional(v.string()),
    action: v.string(),
    resource: v.string(),
    resourceId: v.optional(v.string()),
    resourceName: v.optional(v.string()),
    previousState: v.optional(v.any()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("audit_logs", {
      firmId: args.firmId,
      actorId: args.actorId,
      actorName: args.actorName,
      actorRole: args.actorRole,
      action: args.action,
      resource: args.resource,
      resourceId: args.resourceId,
      resourceName: args.resourceName,
      previousState: args.previousState,
      metadata: args.metadata,
      timestamp: Date.now(),
    });
  }
});

/**
 * Query audit logs for a firm with filtering and pagination.
 */
export const getAuditLogs = query({
  args: {
    firmId: v.string(),
    resource: v.optional(v.string()),       // filter by resource type
    actorId: v.optional(v.string()),         // filter by actor
    action: v.optional(v.string()),          // filter by action type
    since: v.optional(v.number()),           // only logs after this timestamp
    limit: v.optional(v.number()),           // max results (default 100)
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 100, 500);

    let logs = await ctx.db
      .query("audit_logs")
      .withIndex("by_firm_timestamp", (q: any) => {
        let q2 = q.eq("firmId", args.firmId);
        if (args.since) q2 = q2.gte("timestamp", args.since);
        return q2;
      })
      .order("desc")
      .take(limit);

    // Apply filters (client-side since Convex index queries don't support compound filters)
    if (args.resource) {
      logs = logs.filter(l => l.resource === args.resource);
    }
    if (args.actorId) {
      logs = logs.filter(l => l.actorId === args.actorId);
    }
    if (args.action) {
      logs = logs.filter(l => l.action === args.action);
    }

    return logs;
  }
});

/**
 * Get audit log statistics for a firm — counts by action type and resource type.
 */
export const getAuditLogStats = query({
  args: {
    firmId: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const since = args.since || (Date.now() - 30 * 24 * 60 * 60 * 1000);

    const logs = await ctx.db
      .query("audit_logs")
      .withIndex("by_firm_timestamp", (q) =>
        q.eq("firmId", args.firmId).gte("timestamp", since)
      )
      .collect();

    const byAction: Record<string, number> = {};
    const byResource: Record<string, number> = {};
    const byActor: Record<string, { name: string; count: number }> = {};

    logs.forEach(l => {
      byAction[l.action] = (byAction[l.action] || 0) + 1;
      byResource[l.resource] = (byResource[l.resource] || 0) + 1;

      if (l.actorId) {
        if (!byActor[l.actorId]) {
          byActor[l.actorId] = { name: l.actorName || l.actorId, count: 0 };
        }
        byActor[l.actorId].count++;
      }
    });

    return {
      totalEvents: logs.length,
      byAction,
      byResource,
      byActor,
    };
  }
});
