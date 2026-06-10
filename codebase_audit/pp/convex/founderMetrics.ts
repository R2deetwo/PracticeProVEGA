
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * query: getFounderMetrics
 * ENHANCED: Provides rich statistics for the Founder's Dashboard,
 * including practice area breakdowns, top firms, and daily growth curves.
 */
export const getFounderMetrics = query({
  args: {},
  handler: async (ctx) => {
    // 1. Fetch data
    const [events, firms, users, matters, invoices] = await Promise.all([
      ctx.db.query("analytics_events").collect(),
      ctx.db.query("firms").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("matters").collect(),
      ctx.db.query("invoices").collect()
    ]);

    // 2. Core KPIs
    const totalMatters = matters.length;
    const totalFirms = firms.length;
    const totalUsers = users.length;
    const totalRevenue = invoices
      .filter((i: any) => i.status === "Paid")
      .reduce((sum, i: any) => sum + (i.total_amount || 0), 0);

    // 3. Practice Area Heatmap
    const areaMap: Record<string, number> = {};
    matters.forEach(m => {
        const area = m.type || "General";
        areaMap[area] = (areaMap[area] || 0) + 1;
    });
    const practiceAreaStats = Object.keys(areaMap).map(area => ({
        area,
        count: areaMap[area]
    })).sort((a, b) => b.count - a.count);

    // 4. Daily Growth History (Cumulative for last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const dailyGrowthMap: Record<string, number> = {};
    
    // Initialize last 30 days
    for (let i = 0; i < 30; i++) {
        const d = new Date(Date.now() - (i * 24 * 60 * 60 * 1000));
        dailyGrowthMap[d.toISOString().split('T')[0]] = 0;
    }

    matters.forEach(m => {
        const date = new Date(m._creationTime).toISOString().split('T')[0];
        if (dailyGrowthMap[date] !== undefined) {
            dailyGrowthMap[date]++;
        }
    });

    const dailyGrowth = Object.keys(dailyGrowthMap).sort().map(date => ({
        date,
        count: dailyGrowthMap[date]
    }));

    // 5. Top 5 Firms by Volume
    const firmMatters: Record<string, number> = {};
    matters.forEach(m => {
        if (m.firmId) firmMatters[m.firmId] = (firmMatters[m.firmId] || 0) + 1;
    });

    const topFirms = firms
        .map(f => ({
            name: f.name,
            matters: firmMatters[f._id] || 0
        }))
        .sort((a, b) => b.matters - a.matters)
        .slice(0, 5);

    // 6. Active User Tracking (Last 24h)
    const activeThreshold = Date.now() - (24 * 60 * 60 * 1000);
    const presenceData = await ctx.db.query("presence").collect();
    const activeUserIds = new Set(presenceData.filter((p: any) => p.updatedAt > activeThreshold).map(p => p.userId));
    
    // Fallback: If no presence, show recent signups as active
    const activeUserList = users
        .filter((u: any) => activeUserIds.has(u._id) || (u._creationTime || 0) > activeThreshold)
        .map((u: any) => ({ name: u.email }));

    return {
      totalMatters,
      totalFirms,
      totalUsers,
      totalRevenue,
      practiceAreaStats,
      dailyGrowth,
      topFirms,
      activeUserList,
      recentActivity: events.slice(-15).reverse(),
      lastUpdated: new Date().toISOString()
    };
  },
});

/**
 * mutation: triggerManualRefresh
 * Force-records a system refresh event.
 */
export const triggerManualRefresh = mutation({
    args: {},
    handler: async (ctx) => {
        await ctx.db.insert("analytics_events", {
            firmId: "system",
            userId: "admin",
            event: "Manual Refresh Executed",
            properties: { timestamp: new Date().toISOString() },
            timestamp: Date.now()
        });
    }
});

/**
 * query: getAllFirmsForAdmin
 * Returns all firms enriched with their users, matter counts, and admin-facing billing fields.
 * Used exclusively by the PracticePro Index (admin dashboard) SaaS Control Center.
 */
export const getAllFirmsForAdmin = query({
  args: {},
  handler: async (ctx) => {
    try {
      const fetchTable = async (table: string) => {
        try {
          return await ctx.db.query(table as any).collect();
        } catch (e) {
          console.warn(`[Convex] Could not fetch ${table}:`, e);
          return [];
        }
      };

      const [firms, users, matters, invoices] = await Promise.all([
        fetchTable("firms"),
        fetchTable("users"),
        fetchTable("matters"),
        fetchTable("invoices"),
      ]);

      return firms.map((firm: any) => {
        const firmUsers = users.filter((u: any) => u.firmId === firm._id || (u.joinedFirmIds && Array.isArray(u.joinedFirmIds) && u.joinedFirmIds.includes(firm._id)));
        const firmMatters = matters.filter((m: any) => m.firmId === firm._id);
        const firmInvoices = invoices.filter((inv: any) => inv.firmId === firm._id);
        const unpaidInvoices = firmInvoices.filter((inv: any) => inv.status === 'Sent' || inv.status === 'Overdue');
        const totalDue = unpaidInvoices.reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0);
        const adminUser = firmUsers.find((u: any) => u.role === 'Admin');

        return {
          id: firm._id,
          firmName: firm.name || 'Unnamed Firm',
          adminEmail: adminUser?.email || adminUser?.tokenIdentifier || firm.createdBy || 'unknown',
          plan: firm.subscriptionPlan || 'Core',
          status: firm.adminStatus || 'active',
          userCount: firmUsers.length,
          billingInterval: firm.billingInterval || 'monthly',
          nextBillingDate: firm.nextBillingDate || '—',
          amountDue: totalDue,
          joinedAt: new Date(firm._creationTime).toISOString().split('T')[0],
          lastActive: firm.lastActive || new Date(firm._creationTime).toISOString().split('T')[0],
          hasUnpaidInvoice: unpaidInvoices.length > 0,
          ingestionAccess: firm.ingestionAccess !== false, // default true
          matterCount: firmMatters.length,
          notes: firm.adminNotes || '',
          firmSpecialties: firm.firmSpecialties || [],
          inviteCode: firm.inviteCode || '',
          address: firm.address || '',
        };
      });
    } catch (error) {
      console.error("Critical error in getAllFirmsForAdmin:", error);
      throw new Error(`Convex Backend Error: ${error}`);
    }
  },
});

/**
 * mutation: updateFirmAdminSettings
 * Allows the admin panel to update billing plan, status, notes, and ingestion access.
 */
export const updateFirmAdminSettings = mutation({
  args: {
    firmId: v.string(),
    settings: v.object({
      subscriptionPlan: v.optional(v.string()),
      adminStatus: v.optional(v.string()),
      ingestionAccess: v.optional(v.boolean()),
      billingInterval: v.optional(v.string()),
      adminNotes: v.optional(v.string()),
      nextBillingDate: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const cleanSettings: any = {};
    Object.entries(args.settings).forEach(([k, v]) => {
      if (v !== undefined) cleanSettings[k] = v;
    });
    await ctx.db.patch(args.firmId as any, cleanSettings);
    return { success: true };
  },
});
