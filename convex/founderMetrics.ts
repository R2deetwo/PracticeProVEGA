
import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

// ─── Platform Subscription Pricing ───────────────────────────────────
// PRIVACY: The founder dashboard ONLY tracks platform subscription
// revenue (what firms pay PracticePro). It does NOT track client-level
// invoices, accounts receivable, or any firm-internal financial data.
// That data belongs exclusively to the firm and is never exposed to
// the platform founder.
//
// These prices mirror src/constants/tiers.ts. If those change, update
// here too.
const PLAN_MONTHLY_PRICE: Record<string, number> = {
  Core: 0,
  Growth: 45000,
  Pro: 80000,
  Enterprise: 0, // Enterprise is custom-priced, not tracked here
  Komplete: 130000,
};

const PLAN_ANNUAL_PRICE: Record<string, number> = {
  Core: 0,
  Growth: 432000,
  Pro: 768000,
  Enterprise: 0,
  Komplete: 1248000,
};

/**
 * Calculate the platform subscription revenue for a single firm.
 * Returns the annualized revenue based on the firm's plan and billing interval.
 * Returns 0 for Core (free) or unknown plans.
 */
function calcPlatformRevenue(firm: any): number {
  const plan = firm.subscriptionPlan || 'Core';
  const interval = firm.billingInterval || 'monthly';
  if (interval === 'annual') {
    return PLAN_ANNUAL_PRICE[plan] || 0;
  }
  // Monthly — annualize for comparison
  return (PLAN_MONTHLY_PRICE[plan] || 0) * 12;
}

/**
 * Calculate the monthly platform subscription amount for a firm.
 * This is what the firm pays PracticePro per month.
 */
function calcMonthlySubscription(firm: any): number {
  const plan = firm.subscriptionPlan || 'Core';
  const interval = firm.billingInterval || 'monthly';
  if (interval === 'annual') {
    return Math.round((PLAN_ANNUAL_PRICE[plan] || 0) / 12);
  }
  return PLAN_MONTHLY_PRICE[plan] || 0;
}

/**
 * requireFounder — server-side access control for founder-only data.
 *
 * CRITICAL SECURITY: All founder metrics queries MUST call this helper
 * at the top of their handler. Without it, ANY authenticated user (or
 * even an unauthenticated user who knows the Convex URL) can call these
 * queries and see ALL firms, ALL users, ALL revenue, ALL matters —
 * which is a catastrophic data breach.
 *
 * ROLE SEPARATION:
 *   - role='Admin'  = firm-level admin (a law firm administrator).
 *                     These users manage their OWN firm in the consumer app.
 *                     They must NOT have access to platform-wide data.
 *   - role='Founder' = platform-level founder (PracticePro owner).
 *                     Only this role can access the Founder APK's dashboard.
 *
 * This helper:
 *   1. Looks up the caller by their tokenIdentifier (email).
 *   2. Verifies their role is exactly 'Founder'.
 *   3. Throws an Authorization error if not.
 */
async function requireFounder(ctx: any, tokenIdentifier: string): Promise<any> {
  if (!tokenIdentifier || typeof tokenIdentifier !== 'string') {
    throw new Error("Unauthorized: authentication required.");
  }

  // Look up the user by tokenIdentifier (case-insensitive)
  const token = tokenIdentifier.toLowerCase().trim();
  const directMatches = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
    .collect();

  const lowerMatches = directMatches.length === 0
    ? await ctx.db
        .query("users")
        .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", token))
        .collect()
    : [];

  const allMatches = directMatches.length > 0 || lowerMatches.length > 0
    ? [...directMatches, ...lowerMatches]
    : (await ctx.db.query("users").take(500))
        .filter((u: any) =>
          u.tokenIdentifier &&
          u.tokenIdentifier.toLowerCase() === token
        );

  if (allMatches.length === 0) {
    throw new Error("Unauthorized: user not found.");
  }

  // Pick the user record. Prefer a Founder record if duplicates exist.
  const founderRecord = allMatches.find((u: any) => u.role === 'Founder');
  const userRecord = founderRecord || allMatches[0];

  if (userRecord.role !== 'Founder') {
    throw new Error(`Unauthorized: founder access required. Your role is '${userRecord.role || 'unknown'}'. Firm administrators must use the consumer app, not the Founder APK.`);
  }

  return userRecord;
}

/**
 * query: getFounderMetrics
 * ENHANCED: Provides rich statistics for the Founder's Dashboard,
 * including practice area breakdowns, top firms, and daily growth curves.
 *
 * SECURITY: Requires admin authentication via tokenIdentifier.
 */
export const getFounderMetrics = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);
    // 1. Fetch data
    // PRIVACY: We do NOT fetch the invoices table. Client invoices are
    // private firm data and must never be exposed to the platform founder.
    // Platform revenue is calculated from subscription plans, not from
    // client billing.
    const [events, firms, users, matters] = await Promise.all([
      ctx.db.query("analytics_events").collect(),
      ctx.db.query("firms").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("matters").collect()
    ]);

    // 2. Core KPIs
    // Filter out Founder role users — they're platform staff, not customers.
    const customerUsers = users.filter((u: any) => u.role !== 'Founder');
    const totalMatters = matters.length;
    const totalFirms = firms.length;
    const totalUsers = customerUsers.length;

    // PRIVACY: Platform subscription revenue — calculated from each firm's
    // subscription plan, NOT from client invoices. This is the only
    // financial data the founder should see: what firms pay PracticePro.
    const platformRevenue = firms.reduce((sum, f) => sum + calcPlatformRevenue(f), 0);
    const monthlyRecurringRevenue = firms.reduce((sum, f) => sum + calcMonthlySubscription(f), 0);

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
    // Filter out Founder users — they're platform staff, not customers.
    const activeThreshold = Date.now() - (24 * 60 * 60 * 1000);
    const presenceData = await ctx.db.query("presence").collect();
    const activeUserIds = new Set(presenceData.filter((p: any) => p.updatedAt > activeThreshold).map(p => p.userId));
    
    // Fallback: If no presence, show recent signups as active
    const activeUserList = customerUsers
        .filter((u: any) => activeUserIds.has(u._id) || (u._creationTime || 0) > activeThreshold)
        .map((u: any) => ({ name: u.email }));

    // ─── Recent Activity (filtered — no noise, no client data) ──────
    // Filter out:
    //   - Low-value events (logouts, page views, etc.)
    //   - Client-specific events (ALOA searches, chat messages, etc.)
    //     These are private to each firm and must NOT appear in the
    //     founder's audit log.
    const NOISE_PATTERNS = [
      'user_logout', 'page_view', 'sidebar_toggle', 'modal_open',
      'modal_close', 'notification_read', 'toast_dismissed',
      'Demo Signup', 'sendHeartbeat',
      // Client-specific events — must not appear in admin app
      'aloa', 'search', 'chat_message', 'draft_generated',
      'ai_request', 'gemini', 'citation', 'research_',
      'document_generated', 'form_submit',
    ];
    const isNoise = (eventStr: string) => {
      const lower = (eventStr || '').toLowerCase();
      return NOISE_PATTERNS.some(n => lower.includes(n.toLowerCase()));
    };
    const meaningfulEvents = events
      .filter((e: any) => !isNoise(e.event || ''))
      .sort((a: any, b: any) => (b.timestamp || b._creationTime || 0) - (a.timestamp || a._creationTime || 0))
      .slice(0, 50);

    return {
      totalMatters,
      totalFirms,
      totalUsers,
      // PRIVACY: Platform subscription revenue, NOT client invoice totals.
      platformRevenue,           // Annualized platform revenue
      monthlyRecurringRevenue,   // MRR — what firms pay PracticePro per month
      practiceAreaStats,
      dailyGrowth,
      topFirms,
      activeUserList,
      recentActivity: meaningfulEvents,
      lastUpdated: new Date().toISOString()
    };
  },
});

/**
 * mutation: triggerManualRefresh
 * Force-records a system refresh event.
 */
export const triggerManualRefresh = mutation({
    args: { tokenIdentifier: v.string() },
    handler: async (ctx, args) => {
        await requireFounder(ctx, args.tokenIdentifier);
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
 * Returns all firms enriched with their users, matter counts, and
 * PLATFORM-ONLY subscription billing fields.
 *
 * PRIVACY: This query does NOT fetch or return client-level invoices,
 * accounts receivable, or any firm-internal financial data. The only
 * financial data returned is the firm's platform subscription status
 * (what they pay PracticePro). Client financials are private to each
 * firm and are never exposed to the platform founder.
 */
export const getAllFirmsForAdmin = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);
    try {
      const fetchTable = async (table: string) => {
        try {
          return await ctx.db.query(table as any).collect();
        } catch (e) {
          console.warn(`[Convex] Could not fetch ${table}:`, e);
          return [];
        }
      };

      // PRIVACY: We do NOT fetch the invoices table. Client invoices are
      // private firm data. Platform billing is calculated from the firm's
      // subscription plan, not from client billing records.
      const [firms, users, matters] = await Promise.all([
        fetchTable("firms"),
        fetchTable("users"),
        fetchTable("matters"),
      ]);

      return firms.map((firm: any) => {
        const firmUsers = users.filter((u: any) => u.firmId === firm._id || (u.joinedFirmIds && Array.isArray(u.joinedFirmIds) && u.joinedFirmIds.includes(firm._id)));
        const firmMatters = matters.filter((m: any) => m.firmId === firm._id);
        const adminUser = firmUsers.find((u: any) => u.role === 'Admin');

        // Platform subscription data (what the firm pays PracticePro)
        const monthlySubscription = calcMonthlySubscription(firm);
        const annualSubscription = calcPlatformRevenue(firm);

        return {
          id: firm._id,
          firmName: firm.name || 'Unnamed Firm',
          adminEmail: adminUser?.email || adminUser?.tokenIdentifier || firm.createdBy || 'unknown',
          plan: firm.subscriptionPlan || 'Core',
          status: firm.adminStatus || 'active',
          product: firm.product || 'legal', // actual product: 'legal' | 'property' | 'unified'
          userCount: firmUsers.length,
          // PRIVACY: Platform subscription billing — NOT client invoices
          billingInterval: firm.billingInterval || 'monthly',
          nextBillingDate: firm.nextBillingDate || '—',
          monthlySubscription,       // What they pay PracticePro per month
          annualSubscription,        // Annualized platform revenue from this firm
          setupFeePaid: firm.setupFeePaid || false,
          subscriptionStatus: firm.setupFeePaid ? 'active' : 'pending',
          joinedAt: new Date(firm._creationTime).toISOString().split('T')[0],
          lastActive: firm.lastActive || new Date(firm._creationTime).toISOString().split('T')[0],
          ingestionAccess: firm.ingestionAccess !== false,
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
    tokenIdentifier: v.string(),
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
    await requireFounder(ctx, args.tokenIdentifier);
    const cleanSettings: any = {};
    Object.entries(args.settings).forEach(([k, v]) => {
      if (v !== undefined) cleanSettings[k] = v;
    });
    await ctx.db.patch(args.firmId as any, cleanSettings);
    return { success: true };
  },
});

/**
 * query: getFounderAlerts
 * Returns founder-grade signals the Founder APK surfaces both as a
 * "Signals" tab and as LOCAL notifications on the device:
 *
 *   - newUsers24h / newUsers7d  : signups worth celebrating
 *   - churnRisks                 : users who haven't been seen in 14+ days
 *   - newFirms24h                : new firm sign-ups
 *   - scalingSignals             : computed health-of-platform flags
 *                                  (active ratio, matter velocity,
 *                                   revenue per firm, plan concentration)
 *   - productBreakdown           : per-product metrics for legal / property
 *                                  / unified — firms, users, matters, and
 *                                  7-day matter velocity, so the founder
 *                                  can decide which product to push.
 *   - lastUpdated                 : ISO timestamp
 *
 * All thresholds are intentionally conservative — we'd rather surface a
 * signal late than cry wolf.
 */
export const getFounderAlerts = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const churnThreshold = now - (14 * DAY);
    const inactiveThreshold = now - (30 * DAY);

    // PRIVACY: We do NOT fetch the invoices table. Platform revenue is
    // calculated from subscription plans, not from client billing.
    const [firms, users, matters, presence] = await Promise.all([
      ctx.db.query("firms").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("matters").collect(),
      ctx.db.query("presence").collect(),
    ]);

    // ─── New users / firms ────────────────────────────────────────────
    // Filter out Founder users — they're platform staff, not customers.
    const customerUsersAlerts = users.filter((u: any) => u.role !== 'Founder');
    const newUsers24h = customerUsersAlerts.filter((u: any) => (u._creationTime || 0) > now - DAY);
    const newUsers7d  = customerUsersAlerts.filter((u: any) => (u._creationTime || 0) > now - (7 * DAY));
    const newFirms24h = firms.filter((f: any) => (f._creationTime || 0) > now - DAY);

    // ─── Churn signals ────────────────────────────────────────────────
    // A user is a churn risk if:
    //   - they've existed for >14 days AND
    //   - they have no presence record in the last 14 days AND
    //   - they have no presence record at all OR lastSeen < churnThreshold
    const presenceByUser = new Map<string, number>();
    presence.forEach((p: any) => {
      const ts = p.updatedAt || p._creationTime || 0;
      const cur = presenceByUser.get(p.userId) || 0;
      if (ts > cur) presenceByUser.set(p.userId, ts);
    });

    const churnRisks = customerUsersAlerts
      .filter((u: any) => {
        const created = u._creationTime || 0;
        if (created > churnThreshold) return false; // too new
        const lastSeen = presenceByUser.get(u._id) || 0;
        // If we have presence data and they're active, not a risk.
        if (lastSeen > churnThreshold) return false;
        // If we have no presence data, only flag if user is older than 30d
        if (lastSeen === 0 && created > inactiveThreshold) return false;
        return true;
      })
      .map((u: any) => ({
        name: u.name || u.email || 'Unknown',
        email: u.email || '',
        firmId: u.firmId || null,
        daysSinceSeen: Math.floor((now - (presenceByUser.get(u._id) || u._creationTime || now)) / DAY),
      }))
      .sort((a, b) => b.daysSinceSeen - a.daysSinceSeen)
      .slice(0, 25);

    // ─── Active users (last 24h) ──────────────────────────────────────
    const activeUserIds = new Set(
      presence.filter((p: any) => (p.updatedAt || p._creationTime || 0) > now - DAY).map((p: any) => p.userId)
    );
    const activeCount = customerUsersAlerts.filter((u: any) => activeUserIds.has(u._id)).length;

    // ─── Matter velocity (7-day vs prior 7-day) ───────────────────────
    const mattersLast7d = matters.filter((m: any) => (m._creationTime || 0) > now - (7 * DAY)).length;
    const mattersPrior7d = matters.filter((m: any) => {
      const t = m._creationTime || 0;
      return t > now - (14 * DAY) && t <= now - (7 * DAY);
    }).length;
    const matterVelocityDelta = mattersLast7d - mattersPrior7d;

    // ─── Platform Revenue (subscription-based, NOT client invoices) ───
    // PRIVACY: This is what firms pay PracticePro, calculated from their
    // subscription plan. NOT the sum of client invoices.
    const platformRevenue = firms.reduce((sum, f) => sum + calcPlatformRevenue(f), 0);
    const monthlyRecurringRevenue = firms.reduce((sum, f) => sum + calcMonthlySubscription(f), 0);
    const revenuePerFirm = firms.length > 0 ? monthlyRecurringRevenue / firms.length : 0;

    // ─── Plan concentration (top plan share) ──────────────────────────
    const planMap: Record<string, number> = {};
    firms.forEach((f: any) => {
      const p = f.subscriptionPlan || "Core";
      planMap[p] = (planMap[p] || 0) + 1;
    });
    const planEntries = Object.entries(planMap).sort((a, b) => b[1] - a[1]);
    const topPlan = planEntries[0]?.[0] || "Core";
    const topPlanShare = firms.length > 0 ? ((planEntries[0]?.[1] || 0) / firms.length) : 0;

    // ─── Per-product breakdown (legal / property / unified) ───────────
    // `product` field on firms/users holds one of these values; missing
    // or null defaults to "unified" (the broad SaaS tier).
    const PRODUCTS = ["legal", "property", "unified"] as const;
    const productBreakdown = PRODUCTS.map(product => {
      const productFirms = firms.filter((f: any) => (f.product || "unified") === product);
      const productFirmIds = new Set(productFirms.map((f: any) => f._id));
      const productUsers = users.filter((u: any) => (u.product || "unified") === product || productFirmIds.has(u.firmId));
      const productMatters = matters.filter((m: any) => productFirmIds.has(m.firmId));
      const productMatters7d = productMatters.filter((m: any) => (m._creationTime || 0) > now - (7 * DAY)).length;
      // PRIVACY: Platform subscription revenue per product, NOT client invoices
      const productRevenue = productFirms.reduce((sum, f) => sum + calcPlatformRevenue(f), 0);
      return {
        product,
        firms: productFirms.length,
        users: productUsers.length,
        matters: productMatters.length,
        matters7d: productMatters7d,
        revenue: productRevenue,
      };
    });

    // ─── Scaling signals (computed flags) ─────────────────────────────
    const activeRatio = customerUsersAlerts.length > 0 ? activeCount / customerUsersAlerts.length : 0;
    const scalingSignals: { id: string; severity: "info" | "warning" | "critical"; title: string; detail: string; }[] = [];

    if (activeRatio < 0.20 && customerUsersAlerts.length >= 10) {
      scalingSignals.push({
        id: "low-active-ratio",
        severity: activeRatio < 0.10 ? "critical" : "warning",
        title: "Low active-user ratio",
        detail: `${Math.round(activeRatio * 100)}% of users active in the last 24h (${activeCount}/${customerUsersAlerts.length}). Consider a re-engagement push.`,
      });
    }
    if (matterVelocityDelta < 0 && (mattersLast7d + mattersPrior7d) >= 10) {
      scalingSignals.push({
        id: "matter-velocity-down",
        severity: "warning",
        title: "Matter creation slowing down",
        detail: `${mattersLast7d} matters in the last 7 days vs ${mattersPrior7d} the week before (${Math.abs(matterVelocityDelta)} drop).`,
      });
    } else if (matterVelocityDelta > 0 && mattersLast7d >= 5) {
      scalingSignals.push({
        id: "matter-velocity-up",
        severity: "info",
        title: "Matter creation accelerating",
        detail: `${mattersLast7d} matters in the last 7 days vs ${mattersPrior7d} the week before (+${matterVelocityDelta}). Scaling well — ensure capacity.`,
      });
    }
    if (topPlanShare > 0.7 && firms.length >= 10) {
      scalingSignals.push({
        id: "plan-concentration",
        severity: "warning",
        title: `Plan concentration: ${topPlan}`,
        detail: `${Math.round(topPlanShare * 100)}% of firms are on the "${topPlan}" plan. Diversify by upselling or launching adjacent products.`,
      });
    }
    if (churnRisks.length >= 5) {
      scalingSignals.push({
        id: "churn-pool-growing",
        severity: churnRisks.length >= 10 ? "critical" : "warning",
        title: "Churn risk pool growing",
        detail: `${churnRisks.length} users haven't been seen in 14+ days. Reach out before they fully churn.`,
      });
    }
    if (newFirms24h.length > 0) {
      scalingSignals.push({
        id: "new-firms",
        severity: "info",
        title: `${newFirms24h.length} new firm${newFirms24h.length !== 1 ? "s" : ""} in 24h`,
        detail: newFirms24h.map((f: any) => f.name || "Unnamed").slice(0, 3).join(", "),
      });
    }
    // Push-product recommendation: surface the product with the highest
    // 7-day velocity / firm ratio (i.e., the one growing fastest per
    // customer) — that's the product most worth pushing.
    const pushCandidates = productBreakdown
      .filter(p => p.firms > 0)
      .map(p => ({
        product: p.product,
        velocityPerFirm: p.matters7d / p.firms,
        firms: p.firms,
        matters7d: p.matters7d,
      }))
      .sort((a, b) => b.velocityPerFirm - a.velocityPerFirm);
    const pushProduct = pushCandidates[0] || null;

    return {
      newUsers24h: newUsers24h.map((u: any) => ({ name: u.name || u.email || "Unknown", email: u.email || "", product: u.product || "unified" })),
      newUsers24hCount: newUsers24h.length,
      newUsers7dCount: newUsers7d.length,
      newFirms24h: newFirms24h.map((f: any) => ({ name: f.name || "Unnamed Firm", product: f.product || "unified" })),
      newFirms24hCount: newFirms24h.length,
      churnRisks,
      churnRiskCount: churnRisks.length,
      activeCount,
      totalUsers: customerUsersAlerts.length,
      totalFirms: firms.length,
      mattersLast7d,
      mattersPrior7d,
      matterVelocityDelta,
      // PRIVACY: Platform subscription revenue, NOT client invoices
      platformRevenue,
      monthlyRecurringRevenue,
      revenuePerFirm,
      topPlan,
      topPlanShare,
      productBreakdown,
      pushProduct,
      scalingSignals,
      lastUpdated: new Date().toISOString(),
    };
  },
});

/**
 * mutation: recordFounderSignalSeen
 * Lightweight marker so the founder's device can dedupe notifications
 * (we store a tiny "lastSeenSignalsAt" per admin in localStorage as well,
 * but this server-side record makes it work across reinstalls).
 */
export const recordFounderSignalSeen = mutation({
  args: {
    tokenIdentifier: v.string(),
    signalIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);
    await ctx.db.insert("analytics_events", {
      firmId: "system",
      userId: "founder",
      event: "Founder signals acknowledged",
      properties: { signalIds: args.signalIds, ts: Date.now() },
      timestamp: Date.now(),
    });
    return { success: true };
  },
});

/**
 * action: createFounderAccount
 *
 * Creates a new user with role='Founder'. This is the signup flow for
 * the Founder APK — the founder enters their name, email, and password,
 * and this action creates their account.
 *
 * SECURITY:
 *   - This is a PUBLIC action (no auth required to call it) because the
 *     founder needs to create their account before they can log in.
 *   - However, it ONLY creates role='Founder' users — never 'Admin' or
 *     other consumer-app roles.
 *   - If a user with this email already exists, the action refuses to
 *     overwrite their role (prevents privilege escalation).
 *   - The password is hashed server-side with PBKDF2-SHA512.
 *
 * AFTER SIGNUP:
 *   The founder can immediately log in via verifyLogin (same as consumer
 *   app) and the Founder APK will recognize their role='Founder' and
 *   grant access to the dashboard.
 */
export const createFounderAccount = action({
  args: {
    fullName: v.string(),
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message?: string }> => {
    const token = args.email.toLowerCase().trim();

    // 1. Check if a user with this email already exists
    const existing: any = await ctx.runQuery(api.myFunctions.getUser, {
      tokenIdentifier: token,
    });

    if (existing) {
      if (existing.role === 'Founder') {
        return {
          success: false,
          message: "A founder account with this email already exists. Please log in instead.",
        };
      }
      return {
        success: false,
        message: `This email is already registered as a ${existing.role || 'user'} account. Use a different email for your founder account.`,
      };
    }

    // 2. Hash the password server-side with PBKDF2-SHA512
    const passwordHash: string = await ctx.runAction(
      internal.authUtils.hashPassword,
      { password: args.password }
    ) as string;

    // 3. Create the user with role='Founder'
    await ctx.runMutation(internal.myFunctions.createUser, {
      name: args.fullName,
      email: token,
      tokenIdentifier: token,
      role: 'Founder',
      password: passwordHash,
      isVerified: true,
      emailVerified: true,
      product: 'unified',
    });

    return { success: true };
  },
});

/**
 * action: broadcastNotification
 *
 * Sends a platform-wide announcement to all users matching the target
 * product. Supports in-app notifications, email, or both.
 *
 * This is the founder's broadcast console — used for announcements like
 * "New Feature Available", "Scheduled Maintenance", "Milestone Celebration".
 *
 * Target products:
 *   - 'all'      → All users regardless of product
 *   - 'legal'    → Vega users only
 *   - 'property' → Atrium users only
 *   - 'unified'  → Komplete users only
 *
 * Channels:
 *   - 'inapp' → Creates a notification row for each user
 *   - 'email' → Sends an email via Brevo
 *   - 'both'  → Does both
 */
export const broadcastNotification = action({
  args: {
    tokenIdentifier: v.string(),
    targetProduct: v.string(),
    channel: v.string(),
    theme: v.string(),
    title: v.string(),
    message: v.string(),
    deepLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    // 1. Fetch all users matching the target product
    const allUsers = await ctx.runQuery(internal.myFunctions.getAllUsersForBroadcast, {
      targetProduct: args.targetProduct,
    });

    let recipientCount = 0;

    // 2. Create in-app notifications
    if (args.channel === 'inapp' || args.channel === 'both') {
      for (const user of allUsers) {
        await ctx.runMutation(internal.myFunctions.createBroadcastNotification, {
          userId: user._id,
          firmId: user.firmId || 'system',
          title: args.title,
          message: args.message,
          theme: args.theme,
          deepLink: args.deepLink || undefined,
        });
        recipientCount++;
      }
    }

    // 3. Send emails
    if (args.channel === 'email' || args.channel === 'both') {
      for (const user of allUsers) {
        if (user.email) {
          try {
            await ctx.runAction(internal.myFunctions.sendBroadcastEmail, {
              to: user.email,
              title: args.title,
              message: args.message,
              theme: args.theme,
            });
            if (args.channel === 'email') recipientCount++;
          } catch (e) {
            console.warn('[broadcast] Email failed for', user.email, e);
          }
        }
      }
    }

    // 4. Log the broadcast
    await ctx.runMutation(internal.myFunctions.logBroadcastEvent, {
      targetProduct: args.targetProduct,
      channel: args.channel,
      theme: args.theme,
      title: args.title,
      recipientCount,
    });

    return { success: true, recipientCount };
  },
});

// ═════════════════════════════════════════════════════════════════════
// FOUNDER APP FEATURES — Impersonation, Health, Export, Audit, Search
// ═════════════════════════════════════════════════════════════════════

/**
 * query: getFirmHealthDetails
 * Returns detailed health metrics for a single firm — used by the
 * firm health dashboard in the founder app.
 *
 * Returns:
 *   - daysSinceLastLogin (per user)
 *   - seatsUsed vs maxSeats
 *   - feature adoption flags (hasUsedEsign, hasUsedVoiceDictation, etc.)
 *   - recent activity count (last 7 days)
 *   - churn risk score
 */
export const getFirmHealthDetails = query({
  args: { tokenIdentifier: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    const [firm, users, matters, presence, events] = await Promise.all([
      ctx.db.get(args.firmId as any),
      ctx.db.query("users").withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId)).collect(),
      ctx.db.query("matters").withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId)).take(500),
      ctx.db.query("presence").withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId)).collect(),
      ctx.db.query("analytics_events").filter((q: any) => q.eq(q.field("firmId"), args.firmId)).take(200),
    ]);

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    // Per-user activity
    const userHealth = users.map((u: any) => {
      const userPresence = presence.find((p: any) => p.userId === u._id);
      const lastSeen = userPresence?.updatedAt || u._creationTime || 0;
      const daysSinceLogin = Math.floor((now - lastSeen) / DAY);
      return {
        userId: u._id,
        name: u.name || u.email || 'Unknown',
        email: u.email || '',
        role: u.role || 'Unknown',
        daysSinceLogin,
        lastSeen: lastSeen ? new Date(lastSeen).toISOString() : null,
      };
    });

    // Feature adoption (check if any user has used these features)
    const recentEvents = events.filter((e: any) => (e.timestamp || 0) > now - 7 * DAY);
    const hasUsedEsign = events.some((e: any) => (e.event || '').toLowerCase().includes('esign') || (e.event || '').toLowerCase().includes('signature'));
    const hasUsedVoiceDictation = events.some((e: any) => (e.event || '').toLowerCase().includes('voice') || (e.event || '').toLowerCase().includes('dictation'));
    const hasUsedDraftPro = events.some((e: any) => (e.event || '').toLowerCase().includes('draft'));
    const hasUsedResearch = events.some((e: any) => (e.event || '').toLowerCase().includes('research'));

    // Seats
    const seatsUsed = users.length;
    const maxSeats = (firm as any)?.maxUnits || 0; // if 0 = unlimited

    // Churn risk score (0-100, higher = more risk)
    const activeUsers = userHealth.filter((u: any) => u.daysSinceLogin < 7).length;
    const activeRatio = users.length > 0 ? activeUsers / users.length : 0;
    const churnRiskScore = Math.round(
      (1 - activeRatio) * 50 + // 50% weight: active ratio
      (userHealth.every((u: any) => u.daysSinceLogin > 14) ? 30 : 0) + // 30%: all inactive
      (recentEvents.length < 5 ? 20 : 0) // 20%: low activity
    );

    return {
      firmId: args.firmId,
      firmName: (firm as any)?.name || 'Unknown',
      plan: (firm as any)?.subscriptionPlan || 'Core',
      product: (firm as any)?.product || 'legal',
      seatsUsed,
      maxSeats,
      userHealth,
      featureAdoption: {
        hasUsedEsign,
        hasUsedVoiceDictation,
        hasUsedDraftPro,
        hasUsedResearch,
      },
      recentActivityCount: recentEvents.length,
      churnRiskScore,
      totalMatters: matters.length,
      joinedAt: new Date((firm as any)?._creationTime || 0).toISOString(),
    };
  },
});

/**
 * mutation: logAdminAction
 * Logs an admin action for audit trail — separate from analytics_events.
 * Used for: firm suspension, plan changes, impersonation, broadcasts.
 */
export const logAdminAction = mutation({
  args: {
    tokenIdentifier: v.string(),
    action: v.string(),
    targetFirmId: v.optional(v.string()),
    targetUserId: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    await ctx.db.insert("analytics_events", {
      firmId: "system",
      userId: args.tokenIdentifier,
      event: `ADMIN ACTION: ${args.action}`,
      properties: {
        targetFirmId: args.targetFirmId,
        targetUserId: args.targetUserId,
        details: args.details,
        adminEmail: args.tokenIdentifier,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * query: getAdminActionLog
 * Returns admin actions for the audit log — separate from user activity.
 */
export const getAdminActionLog = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    const events = await ctx.db
      .query("analytics_events")
      .filter((q: any) => q.eq(q.field("firmId"), "system"))
      .take(500);

    return events
      .filter((e: any) => (e.event || '').startsWith("ADMIN ACTION:") || (e.event || '').startsWith("Broadcast sent:"))
      .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 100);
  },
});

/**
 * query: globalSearch
 * Global search across firms, users, and properties by email, name, or phone.
 * Returns matching entities with type labels.
 */
export const globalSearch = query({
  args: { tokenIdentifier: v.string(), query: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    const q = args.query.toLowerCase().trim();
    if (!q || q.length < 2) return [];

    const [firms, users] = await Promise.all([
      ctx.db.query("firms").take(500),
      ctx.db.query("users").take(1000),
    ]);

    const results: any[] = [];

    // Search firms
    firms.forEach((f: any) => {
      const name = (f.name || '').toLowerCase();
      const inviteCode = (f.inviteCode || '').toLowerCase();
      if (name.includes(q) || inviteCode.includes(q)) {
        results.push({
          type: 'Firm',
          id: f._id,
          name: f.name || 'Unnamed',
          subtitle: `Plan: ${f.subscriptionPlan || 'Core'} · Product: ${f.product || 'legal'}`,
          firmId: f._id,
        });
      }
    });

    // Search users
    users.forEach((u: any) => {
      const email = (u.email || '').toLowerCase();
      const name = (u.name || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      if (email.includes(q) || name.includes(q) || phone.includes(q)) {
        results.push({
          type: 'User',
          id: u._id,
          name: u.name || u.email || 'Unknown',
          subtitle: `${u.email || ''} · Role: ${u.role || 'Unknown'}`,
          firmId: u.firmId,
        });
      }
    });

    return results.slice(0, 50);
  },
});

/**
 * query: getSystemErrors
 * Returns recent system errors from analytics_events — Gemini failures,
 * PDF generation failures, Convex errors.
 */
export const getSystemErrors = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    const events = await ctx.db
      .query("analytics_events")
      .take(1000);

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    return events
      .filter((e: any) => {
        const evt = (e.event || '').toLowerCase();
        return (evt.includes('error') || evt.includes('fail') || evt.includes('exception')) &&
               (e.timestamp || 0) > now - 7 * DAY;
      })
      .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 50)
      .map((e: any) => ({
        event: e.event,
        firmId: e.firmId,
        properties: e.properties,
        timestamp: e.timestamp,
        timeAgo: Math.floor((now - (e.timestamp || 0)) / DAY),
      }));
  },
});

/**
 * query: getExportData
 * Returns data formatted for CSV export — firm list with all billing details.
 */
export const getExportData = query({
  args: {
    tokenIdentifier: v.string(),
    exportType: v.union(v.literal("firms"), v.literal("mrr"), v.literal("churn")),
  },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    const [firms, users, matters] = await Promise.all([
      ctx.db.query("firms").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("matters").collect(),
    ]);

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    if (args.exportType === "firms") {
      return firms.map((f: any) => ({
        firmName: f.name || 'Unnamed',
        adminEmail: users.find((u: any) => u.firmId === f._id && u.role === 'Admin')?.email || '',
        product: f.product || 'legal',
        plan: f.subscriptionPlan || 'Core',
        status: f.adminStatus || 'active',
        userCount: users.filter((u: any) => u.firmId === f._id).length,
        matterCount: matters.filter((m: any) => m.firmId === f._id).length,
        monthlySubscription: calcMonthlySubscription(f),
        annualSubscription: calcPlatformRevenue(f),
        joinedAt: new Date(f._creationTime).toISOString().split('T')[0],
      }));
    }

    if (args.exportType === "mrr") {
      return firms.map((f: any) => ({
        firmName: f.name || 'Unnamed',
        product: f.product || 'legal',
        plan: f.subscriptionPlan || 'Core',
        billingInterval: f.billingInterval || 'monthly',
        monthlySubscription: calcMonthlySubscription(f),
        annualSubscription: calcPlatformRevenue(f),
        setupFeePaid: f.setupFeePaid ? 'Yes' : 'No',
      }));
    }

    // churn
    const presence = await ctx.db.query("presence").collect();
    return firms.map((f: any) => {
      const firmUsers = users.filter((u: any) => u.firmId === f._id);
      const firmPresence = presence.filter((p: any) => p.firmId === f._id);
      const lastActivity = Math.max(
        ...firmPresence.map((p: any) => p.updatedAt || 0),
        ...firmUsers.map((u: any) => u._creationTime || 0),
        f._creationTime || 0
      );
      const daysSinceActive = Math.floor((now - lastActivity) / DAY);
      return {
        firmName: f.name || 'Unnamed',
        plan: f.subscriptionPlan || 'Core',
        userCount: firmUsers.length,
        daysSinceActive,
        churnRisk: daysSinceActive > 30 ? 'HIGH' : daysSinceActive > 14 ? 'MEDIUM' : 'LOW',
        lastActive: new Date(lastActivity).toISOString().split('T')[0],
      };
    }).sort((a: any, b: any) => b.daysSinceActive - a.daysSinceActive);
  },
});

/**
 * mutation: setFeatureFlag
 * Sets a per-firm feature flag (enable/disable a feature for one firm).
 */
export const setFeatureFlag = mutation({
  args: {
    tokenIdentifier: v.string(),
    firmId: v.string(),
    flagKey: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    // Check if flag already exists
    const existing = await ctx.db
      .query("feature_flags")
      .withIndex("by_firm_flag", (q: any) => q.eq("firmId", args.firmId).eq("flagKey", args.flagKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        setBy: args.tokenIdentifier,
        setAt: Date.now(),
      });
    } else {
      await ctx.db.insert("feature_flags", {
        firmId: args.firmId,
        flagKey: args.flagKey,
        enabled: args.enabled,
        setBy: args.tokenIdentifier,
        setAt: Date.now(),
      });
    }

    // Log the action
    await ctx.db.insert("analytics_events", {
      firmId: "system",
      userId: args.tokenIdentifier,
      event: `ADMIN ACTION: Feature flag '${args.flagKey}' ${args.enabled ? 'enabled' : 'disabled'} for firm ${args.firmId}`,
      properties: { firmId: args.firmId, flagKey: args.flagKey, enabled: args.enabled },
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * query: getFeatureFlags
 * Returns all feature flags for a firm.
 */
export const getFeatureFlags = query({
  args: { tokenIdentifier: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);
    return await ctx.db
      .query("feature_flags")
      .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
      .collect();
  },
});
