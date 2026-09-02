
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * mutation: trackEvent
 * Used to record an analytics event from the app.
 * Compatible with the Founder's Dashboard Project.
 */
export const trackEvent = mutation({
  args: {
    firmId: v.string(),
    userId: v.string(),
    event: v.string(),
    properties: v.any(),
  },
  handler: async (ctx, args) => {
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

/**
 * query: getDashboardData
 * Retrives data for charts in the analytics dashboard.
 */
export const getDashboardData = query({
  args: { firmId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.firmId) {
      // Individual Firm View
      const snapshots = await ctx.db
        .query("usage_snapshots")
        .withIndex("by_firm_date", (q) => q.eq("firmId", args.firmId as string))
        .take(365);
      
      const health = await ctx.db
        .query("firm_health_scores")
        .withIndex("by_firm", (q) => q.eq("firmId", args.firmId as string))
        .first();

      return { snapshots, health: health?.score || 0 };
    } else {
       // Global Founder View: Last 30 days of snapshots
       const snapshots = await ctx.db.query("usage_snapshots").take(1000);
       const firms = await ctx.db.query("firms").take(500);
       const users = await ctx.db.query("users").take(500);
       const healthScores = await ctx.db.query("firm_health_scores").take(500);
       
       const avgHealth = healthScores.length > 0 
           ? healthScores.reduce((sum, h) => sum + h.score, 0) / healthScores.length
           : 0;

       return { 
           globalSnapshots: snapshots.slice(-30),
           firmsCount: firms.length,
           usersCount: users.length,
           avgHealth
       };
    }
  },
});

export const getUserActivity = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("analytics_events")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .take(500);
    }
});

export const getFirmActivity = query({
    args: { firmId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("analytics_events")
            .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
            .take(1000);
    }
});

/**
 * query: getUsersList
 * Returns a full directory of all users across all firms.
 */
export const getUsersList = query({
    args: {},
    handler: async (ctx) => {
        const users = await ctx.db.query("users").take(500);
        const presence = await ctx.db.query("presence").take(500);
        
        return users.map(u => ({
            id: u._id,
            email: u.email,
            role: u.role,
            firmId: u.firmId,
            isActive: presence.some((p: any) => p.userId === u._id && p.updatedAt > (Date.now() - 15 * 60 * 1000))
        }));
    }
});

/**
 * query: getFirmsList
 * Returns a full directory of all firms on the platform.
 */
export const getFirmsList = query({
    args: {},
    handler: async (ctx) => {
        const firms = await ctx.db.query("firms").take(500);
        return firms.map(f => ({
            id: f._id,
            name: f.name,
            createdAt: f._creationTime
        }));
    }
});
