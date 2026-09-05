
import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffCaller } from "./callerAuth";

/**
 * mutation: trackEvent
 * Used to record an analytics event from the app.
 * Compatible with the Founder's Dashboard Project.
 *
 * Round 8 auth retrofit: firmId/userId were caller-supplied and trusted —
 * anyone could forge analytics rows for any firm/user. The caller is now
 * resolved against the users table and firm-scoped.
 *
 * Round 8 dead-code removal: getUsersList / getFirmsList (no-args dumps of
 * every user email + firm directory), getDashboardData (global snapshots),
 * getUserActivity / getFirmActivity (cross-firm analytics feeds) all had
 * ZERO callers after the admin dashboard redesign and leaked cross-firm
 * data to any unauthenticated caller. They were deleted.
 */
export const trackEvent = mutation({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.string(),
    event: v.string(),
    properties: v.any(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, { sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      userId: args.userId,
      firmId: args.firmId,
    });
    await ctx.db.insert("analytics_events", {
      firmId: args.firmId,
      userId: args.userId,
      event: args.event,
      properties: args.properties,
      timestamp: Date.now(),
    });
  },
});

/**
 * internalMutation: aggregateDailyMetrics
 * Background task to take nightly snapshots of firm growth and health.
 */
export const aggregateDailyMetrics = internalMutation({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    // 1. Get all firms
    const firms = await ctx.db.query("firms").take(500);

    for (const firm of firms) {
      // Aggregate matters
      const matters = await ctx.db
        .query("matters")
        .withIndex("by_firm", (q) => q.eq("firmId", firm._id))
        .take(1000);

      // Aggregate users
      const users = await ctx.db
        .query("users")
        .withIndex("by_firm", (q) => q.eq("firmId", firm._id))
        .take(500);

      // Aggregate revenue (assuming invoices)
      const invoices = await ctx.db
        .query("invoices")
        .withIndex("by_firm", (q) => q.eq("firmId", firm._id))
        .take(500);
      const revenue = invoices
        .filter((i: any) => i.status === "Paid")
        .reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0);

      const snapshot = {
        date: args.date,
        firmId: firm._id as string,
        totalMatters: matters.length,
        activeUsers: users.length,
        revenueToDate: revenue,
      };

      // Check for existing snapshot for this date and firm
      const existing = await ctx.db
        .query("usage_snapshots")
        .withIndex("by_firm_date", (q) =>
          q.eq("firmId", firm._id as string).eq("date", args.date)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, snapshot);
      } else {
        await ctx.db.insert("usage_snapshots", snapshot);
      }

      // 2. Health score calculation
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentLogins = (await ctx.db
          .query("presence")
          .withIndex("by_firm", (q) => q.eq("firmId", firm._id as string))
          .take(1000))
          .filter((p: any) => p.updatedAt && p.updatedAt > oneDayAgo).length;


      const previousDate = new Date(args.date);
      previousDate.setDate(previousDate.getDate() - 1);
      const isoPrevDate = previousDate.toISOString().split("T")[0];

      const prevSnapshot = await ctx.db
        .query("usage_snapshots")
        .withIndex("by_firm_date", (q) =>
          q.eq("firmId", firm._id as string).eq("date", isoPrevDate)
        )
        .first();

      const matterGrowth = matters.length - (prevSnapshot?.totalMatters || 0);

      // Score 0-100: weighted average (base 50, +10 per login, +5 per new matter)
      const score = Math.min(100, Math.max(0, (recentLogins * 10) + (matterGrowth * 5) + 50));

      const healthRecord = {
        firmId: firm._id as string,
        score,
        factors: { recentLogins, matterGrowth }
      };

      const existingHealth = await ctx.db
          .query("firm_health_scores")
          .withIndex("by_firm", (q) => q.eq("firmId", firm._id as string))
          .first();

      if (existingHealth) {
          await ctx.db.patch(existingHealth._id, healthRecord);
      } else {
          await ctx.db.insert("firm_health_scores", healthRecord);
      }
    }
  },
});
