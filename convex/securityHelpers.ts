/**
 * Security Helpers — Rate limiting, RLS audit logging, and admin actions.
 *
 * Rate Limiting:
 *   - checkRateLimit(ctx, key, maxRequests, windowMs) → boolean (true if allowed)
 *   - Used to wrap exposed mutations/actions (signup, heartbeat, trackEvent)
 *
 * RLS Audit:
 *   - logSecurityEvent(ctx, eventType, email, ip, details)
 *   - logUnauthorizedAccess(ctx, userId, attemptedFirmId, actualFirmId)
 *
 * Admin Actions:
 *   - blockIp(ctx, ip, reason)
 *   - suspendUser(ctx, userId, reason)
 *   - unblockIp(ctx, ip)
 *   - unsuspendUser(ctx, userId)
 *   - getBlockedIps / getSuspendedUsers / getSecurityEvents (queries)
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireFounder } from "./founderMetrics";

// ── Rate Limiting ──────────────────────────────────────────────────────────

const WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Check if a request is within the rate limit.
 * Returns true if the request is ALLOWED, false if it should be throttled.
 * Uses a simple counter per key with a rolling window.
 */
export async function checkRateLimit(
  ctx: any,
  key: string,
  maxRequests: number,
  windowMs: number = WINDOW_MS
): Promise<boolean> {
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .first();

  if (!existing) {
    // First request — create the counter
    await ctx.db.insert("rateLimits", { key, count: 1, windowStart: now });
    return true;
  }

  // Reset window if expired
  if (now - existing.windowStart > windowMs) {
    await ctx.db.patch(existing._id, { count: 1, windowStart: now });
    return true;
  }

  // Within window — increment and check
  if (existing.count >= maxRequests) {
    // Rate limit exceeded — log as security event
    await logSecurityEventInline(ctx, {
      eventType: "rate_limit_exceeded",
      details: `Key: ${key}, Count: ${existing.count}, Limit: ${maxRequests}`,
    });
    return false;
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 });
  return true;
}

// ── Security Event Logging ─────────────────────────────────────────────────

/**
 * Internal mutation to log a security event (callable from other Convex functions).
 */
export const logSecurityEventInternal = internalMutation({
  args: {
    eventType: v.string(),
    firmId: v.optional(v.string()),
    userId: v.optional(v.string()),
    email: v.optional(v.string()),
    ip: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("securityEvents", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

/**
 * Inline helper to log a security event from within another mutation/action.
 * Use this pattern: await logSecurityEventInline(ctx, { eventType: "..." })
 */
async function logSecurityEventInline(ctx: any, data: {
  eventType: string;
  firmId?: string;
  userId?: string;
  email?: string;
  ip?: string;
  details?: string;
}) {
  try {
    await ctx.db.insert("securityEvents", {
      ...data,
      timestamp: Date.now(),
    });
  } catch (e) {
    console.warn("[Security] Failed to log security event:", e);
  }
}

// ── Admin Queries (founder-gated) ──────────────────────────────────────────

export const getSecurityEvents = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);
    return await ctx.db
      .query("securityEvents")
      .order("desc")
      .take(100);
  },
});

export const getBlockedIps = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);
    return await ctx.db.query("blockedIps").collect();
  },
});

export const getSuspendedUsers = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);
    return await ctx.db.query("suspendedUsers").collect();
  },
});

// ── Admin Actions (founder-gated) ──────────────────────────────────────────

export const blockIp = mutation({
  args: {
    tokenIdentifier: v.string(),
    ip: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const founder = await requireFounder(ctx, args.tokenIdentifier);
    // Check if already blocked
    const existing = await ctx.db
      .query("blockedIps")
      .withIndex("by_ip", (q: any) => q.eq("ip", args.ip))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("blockedIps", {
      ip: args.ip,
      reason: args.reason || "Blocked by admin",
      blockedBy: founder.email,
      blockedAt: Date.now(),
    });
  },
});

export const unblockIp = mutation({
  args: {
    tokenIdentifier: v.string(),
    ip: v.string(),
  },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);
    const existing = await ctx.db
      .query("blockedIps")
      .withIndex("by_ip", (q: any) => q.eq("ip", args.ip))
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const suspendUser = mutation({
  args: {
    tokenIdentifier: v.string(),
    userId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const founder = await requireFounder(ctx, args.tokenIdentifier);
    const existing = await ctx.db
      .query("suspendedUsers")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("suspendedUsers", {
      userId: args.userId,
      reason: args.reason || "Suspended by admin",
      suspendedBy: founder.email,
      suspendedAt: Date.now(),
    });
  },
});

export const unsuspendUser = mutation({
  args: {
    tokenIdentifier: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);
    const existing = await ctx.db
      .query("suspendedUsers")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});
