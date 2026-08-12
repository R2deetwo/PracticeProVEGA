
import { query, mutation, action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { getMaxUsersForFirm, getTierLimitsForFirm, getDisplayPlan } from "./tierLimits";

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
export async function requireFounder(ctx: any, tokenIdentifier: string): Promise<any> {
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

    // 5. Top 5 Firms by Volume (includes product for filter)
    const firmMatters: Record<string, number> = {};
    matters.forEach(m => {
        if (m.firmId) firmMatters[m.firmId] = (firmMatters[m.firmId] || 0) + 1;
    });

    const topFirms = firms
        .map(f => ({
            name: f.name,
            matters: firmMatters[f._id] || 0,
            product: (f as any).product || 'unified',
        }))
        .sort((a, b) => b.matters - a.matters)
        .slice(0, 10);

    // ─── Per-product breakdown (legal / property / unified) ───────────
    // Includes per-product MRR and revenue so the dashboard can show
    // product-specific KPIs when the founder taps Atrium/Vega/Komplete.
    const PRODUCTS = ["legal", "property", "unified"] as const;
    const productBreakdown = PRODUCTS.map(product => {
      const productFirms = firms.filter((f: any) => (f.product || "unified") === product);
      const productFirmIds = new Set(productFirms.map((f: any) => f._id));
      const productUsers = users.filter((u: any) =>
        (u.product || "unified") === product || productFirmIds.has(u.firmId)
      );
      const productMatters = matters.filter((m: any) => productFirmIds.has(m.firmId));
      const productMRR = productFirms.reduce((sum, f) => sum + calcMonthlySubscription(f), 0);
      const productRevenue = productFirms.reduce((sum, f) => sum + calcPlatformRevenue(f), 0);
      return {
        product,
        firms: productFirms.length,
        users: productUsers.length,
        matters: productMatters.length,
        mrr: productMRR,
        revenue: productRevenue,
      };
    });

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

    // ─── Resolve user IDs to emails for readability ───────────────────
    // Build a lookup map from userId → email so the audit log shows
    // "john@example.com" instead of raw Convex IDs like "k7m2n3...".
    const userEmailMap = new Map<string, string>();
    users.forEach((u: any) => {
      const id = String(u._id || u.id || '');
      if (id && u.email) userEmailMap.set(id, u.email);
    });

    const meaningfulEvents = events
      .filter((e: any) => !isNoise(e.event || ''))
      .map((e: any) => ({
        ...e,
        actorEmail: userEmailMap.get(String(e.userId || '')) || null,
      }))
      .sort((a: any, b: any) => (b.timestamp || b._creationTime || 0) - (a.timestamp || a._creationTime || 0))
      .slice(0, 50);

    return {
      totalMatters,
      totalFirms,
      totalUsers,
      // PRIVACY: Platform subscription revenue, NOT client invoice totals.
      platformRevenue,           // Annualized platform revenue
      monthlyRecurringRevenue,   // MRR — what firms pay PracticePro per month
      productBreakdown,          // Per-product metrics including MRR
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
          plan: getDisplayPlan(firm.subscriptionPlan, firm.product), // Komplete = Enterprise
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
          // CRO AUDIT Track B — trial fields for the founder dashboard.
          // When trialEndsAt is in the future, the firm is on active trial of
          // trialPlan (its billingPlan stays at 'Core' until the trial converts).
          trialStartsAt: firm.trialStartsAt || null,
          trialEndsAt: firm.trialEndsAt || null,
          trialPlan: firm.trialPlan || null,
          isOnTrial: !!(firm.trialEndsAt && firm.trialPlan && firm.trialEndsAt > Date.now()),
          trialDaysRemaining: firm.trialEndsAt
            ? Math.max(0, Math.ceil((firm.trialEndsAt - Date.now()) / (24 * 60 * 60 * 1000)))
            : 0,
          joinedAt: firm._creationTime ? new Date(firm._creationTime).toISOString().split('T')[0] : 'Unknown',
          lastActive: firm.lastActive || (firm._creationTime ? new Date(firm._creationTime).toISOString().split('T')[0] : 'Unknown'),
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
      // Return empty array instead of throwing — prevents the admin APK
      // from crashing when a single firm record has bad data.
      return [];
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

    // PLAN CHANGE DETECTION — compare old plan vs new plan to determine
    // if this is an UPGRADE or DOWNGRADE, then dispatch the appropriate
    // celebratory or warning notification to all firm users.
    let planChangeType: 'upgrade' | 'downgrade' | null = null;
    let newPlan: string | undefined;
    let oldPlan: string | undefined;

    if (cleanSettings.subscriptionPlan) {
      newPlan = cleanSettings.subscriptionPlan;
      const firm: any = await ctx.db.get(args.firmId as any);
      oldPlan = firm?.subscriptionPlan;

      if (oldPlan && oldPlan !== newPlan) {
        // Plan rank hierarchy: core < growth < komplete (arbitrary names
        // may vary, so we use a simple rank map)
        const PLAN_RANK: Record<string, number> = {
          'core': 1, 'starter': 1, 'free': 1,
          'growth': 2, 'pro': 2, 'atrium': 2, 'vega': 2,
          'komplete': 3, 'unified': 3, 'enterprise': 4,
        };
        const oldRank = PLAN_RANK[(oldPlan || '').toLowerCase()] || 0;
        const newRank = PLAN_RANK[(newPlan || '').toLowerCase()] || 0;
        planChangeType = newRank > oldRank ? 'upgrade' : 'downgrade';
      }
    }

    await ctx.db.patch(args.firmId as any, cleanSettings);

    // DISPATCH PLAN CHANGE NOTIFICATION to all firm users
    if (planChangeType && newPlan) {
      const now = new Date().toISOString();
      const firmUsers = await ctx.db
        .query("users")
        .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
        .collect();

      const title = planChangeType === 'upgrade'
        ? 'Plan Upgraded'
        : 'Plan Updated';
      const message = planChangeType === 'upgrade'
        ? `Your account has been upgraded to the ${newPlan} plan! All premium features and expanded limits are now unlocked.`
        : `Your account has been transitioned to the ${newPlan} plan. Some higher-tier features may now be restricted.`;

      for (const u of firmUsers) {
        await ctx.db.insert("notifications", {
          firmId: args.firmId,
          userId: u._id,
          title,
          message,
          type: planChangeType === 'upgrade' ? 'subscription_activated' : 'subscription_changed',
          link: { view: 'settings', id: null, context: { settingsTargetId: 'billing' } },
          timestamp: now,
          isRead: false,
        } as any);
      }
    }

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
    // ONLY count firm team signups (Admin, Lawyer, Paralegal) — NOT portal
    // users (Tenant, Client, Resident, Portal User). Portal user activity
    // is attributed to the firm/org level for engagement tracking, but the
    // founder should NOT see individual portal user PII (names, emails).
    // This protects client/resident privacy while still tracking adoption.
    const FIRM_TEAM_ROLES = ['Admin', 'Lawyer', 'Paralegal'];
    const customerUsersAlerts = users.filter((u: any) => FIRM_TEAM_ROLES.includes(u.role));
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
    persistenceMode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Actions can't use ctx.db directly — use internal query for auth check
    await ctx.runQuery(internal.founderMetrics.checkFounderRole, {
      tokenIdentifier: args.tokenIdentifier,
    });
    const rawUsers = await ctx.runQuery(internal.myFunctions.getAllUsersForBroadcast, {
      targetProduct: args.targetProduct,
    });

    // Generate a unique broadcastId for this broadcast — used to group
    // all per-user notification rows created by this single broadcast.
    // This lets the admin "archive" (delete) all rows for a broadcast
    // in one operation, and lets the client track dismissal per-broadcast.
    const broadcastId = `broadcast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const persistenceMode = args.persistenceMode || 'permanent';

    // SECOND-LAYER DEDUP: The query already deduplicates by email, but
    // we add a second check here by _id as well — defense in depth.
    // This ensures we NEVER create duplicate notifications for the same
    // user, even if the query returns duplicates for any reason.
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();
    const allUsers = (rawUsers as any[]).filter((u: any) => {
      const id = String(u._id || '');
      const email = (u.email || '').toLowerCase().trim();
      if (id && seenIds.has(id)) return false;
      if (email && seenEmails.has(email)) return false;
      if (id) seenIds.add(id);
      if (email) seenEmails.add(email);
      return true;
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
          targetProduct: args.targetProduct,
          persistenceMode,
          broadcastId,
        });
        recipientCount++;
      }
    }

    // 3. Send emails (deduplicated — one per unique email)
    if (args.channel === 'email' || args.channel === 'both') {
      const emailedSet = new Set<string>();
      for (const user of allUsers) {
        if (user.email && !emailedSet.has(user.email)) {
          emailedSet.add(user.email);
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

/**
 * mutation: cleanupDuplicateBroadcastNotifications
 * Removes duplicate broadcast notifications from the DB.
 *
 * When a user has multiple records in the users table (e.g., from
 * joining multiple firms), the old broadcast code created one
 * notification per record — so a user with 6 records saw the same
 * broadcast 6 times. This mutation cleans up those duplicates by
 * keeping only ONE notification per (userId, title, message) combo.
 *
 * SAFE TO RUN: This only affects notifications with type starting
 * 'broadcast_'. Non-broadcast notifications are untouched.
 */
export const cleanupDuplicateBroadcastNotifications = mutation({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    // Fetch all broadcast notifications
    const allNotes = await ctx.db.query("notifications").collect();
    const broadcastNotes = allNotes.filter((n: any) =>
      (n.type || '').startsWith('broadcast_')
    );

    // Group by (userId, title, message) — keep the first, delete the rest
    const seen = new Set<string>();
    let deleted = 0;
    for (const note of broadcastNotes) {
      const key = `${note.userId}|||${note.title || ''}|||${note.message || ''}`;
      if (seen.has(key)) {
        // Duplicate — delete it
        await ctx.db.delete(note._id);
        deleted++;
      } else {
        seen.add(key);
      }
    }

    return { success: true, deleted, totalChecked: broadcastNotes.length };
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
 *   - seatsUsed vs maxSeats (correct tier-based seat limits)
 *   - feature adoption flags (hasUsedEsign, hasUsedVoiceDictation, etc.)
 *   - recent activity count (last 7 days)
 *   - churn risk score
 *   - usage limits: maxUsers, maxUnits, maxActiveTenants, maxActiveMatters,
 *     maxManagedProperties, maxCaseFileStorageGb, whatsappLimit
 *   - current usage: seatsUsed, unitsUsed, tenantsCount, mattersCount,
 *     propertiesCount
 *   - usage percentages for "approaching limit" indicators
 */
export const getFirmHealthDetails = query({
  args: { tokenIdentifier: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    const [firm, users, matters, presence, events, properties] = await Promise.all([
      ctx.db.get(args.firmId as any),
      ctx.db.query("users").withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId)).collect(),
      ctx.db.query("matters").withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId)).take(500),
      ctx.db.query("presence").withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId)).collect(),
      ctx.db.query("analytics_events").filter((q: any) => q.eq(q.field("firmId"), args.firmId)).take(200),
      ctx.db.query("properties").withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId)).take(500),
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

    // ─── CORRECT SEAT LIMITS ───────────────────────────────────────────
    // OLD BUG: used firm.maxUnits (property units) as maxSeats — showed
    // 999999 for Vega firms and ∞ for Core firms.
    // FIX: use getMaxUsersForFirm() which returns the correct tier-based
    // seat limit (1 for Core, 5 for Growth, null for Pro/Enterprise/Komplete).
    const plan = (firm as any)?.subscriptionPlan || 'Core';
    const product = (firm as any)?.product || 'legal';
    const seatsUsed = users.length;
    const maxSeats = getMaxUsersForFirm(plan, product); // null = unlimited

    // KOMPLETE = ENTERPRISE: Komplete firms always display as "Enterprise"
    // regardless of their subscriptionPlan field value.
    const displayPlan = getDisplayPlan(plan, product);

    // ─── USAGE LIMITS & CURRENT USAGE ──────────────────────────────────
    // Get all tier limits for this firm's plan/product
    const tierLimits = getTierLimitsForFirm(plan, product);

    // Current usage counts
    const unitsUsed = properties.length; // property units
    const propertiesCount = properties.length;
    const mattersCount = matters.length;
    const activeMattersCount = matters.filter((m: any) =>
      m.status === 'Active' || m.status === 'In Progress' || m.status === 'Open'
    ).length;

    // Count tenants (contacts with role Tenant, or residents in properties)
    const tenantsCount = users.filter((u: any) =>
      u.role === 'Tenant' || u.role === 'Resident'
    ).length;

    // Usage percentages (null = unlimited, so no percentage)
    const usagePercent = (used: number, max: number | null): number | null => {
      if (max === null || max === undefined) return null;
      if (max === 0) return 0;
      return Math.round((used / max) * 100);
    };

    const seatsUsagePercent = usagePercent(seatsUsed, maxSeats);
    const unitsUsagePercent = usagePercent(unitsUsed, tierLimits.maxUnits);
    const tenantsUsagePercent = usagePercent(tenantsCount, tierLimits.maxActiveTenants);
    const mattersUsagePercent = usagePercent(activeMattersCount, tierLimits.maxActiveMatters);

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
      plan: displayPlan, // Komplete shows as "Enterprise"
      product,
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
      joinedAt: (firm as any)?._creationTime ? new Date((firm as any)._creationTime).toISOString() : 'Unknown',

      // ─── USAGE LIMITS (tier-based) ───────────────────────────────
      tierLimits: {
        maxUsers: tierLimits.maxUsers,
        maxUnits: tierLimits.maxUnits,
        maxManagedProperties: tierLimits.maxManagedProperties,
        maxActiveTenants: tierLimits.maxActiveTenants,
        maxActiveMatters: tierLimits.maxActiveMatters,
        maxCaseFileStorageGb: tierLimits.maxCaseFileStorageGb,
        whatsappLimit: tierLimits.whatsappLimit,
      },

      // ─── CURRENT USAGE ───────────────────────────────────────────
      usage: {
        seatsUsed,
        unitsUsed,
        propertiesCount,
        tenantsCount,
        mattersCount,
        activeMattersCount,
      },

      // ─── USAGE PERCENTAGES (for "approaching limit" indicators) ──
      // null = unlimited (no % shown). 80%+ = warning, 100%+ = at limit.
      usagePercentages: {
        seats: seatsUsagePercent,
        units: unitsUsagePercent,
        tenants: tenantsUsagePercent,
        matters: mattersUsagePercent,
      },
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

    // CRO AUDIT FIX — NOISE_PATTERNS filter to prevent ALOA chat content
    // from leaking through error events. If an error event's name contains
    // any of these patterns, it's excluded entirely. This prevents the
    // founder from seeing user ALOA search queries or chat content that
    // might be embedded in error properties.
    const NOISE_PATTERNS = [
      'aloa', 'search', 'chat_message', 'chat_conversation',
      'draft_generated', 'ai_request', 'gemini', 'citation',
      'research_', 'document_generated', 'form_submit',
      'user_query', 'prompt', 'conversation',
    ];

    return events
      .filter((e: any) => {
        const evt = (e.event || '').toLowerCase();
        // Must be an error/fail/exception event
        if (!(evt.includes('error') || evt.includes('fail') || evt.includes('exception'))) return false;
        // Must be within 7 days
        if ((e.timestamp || 0) <= now - 7 * DAY) return false;
        // CRO AUDIT FIX — exclude events that might contain ALOA/chat content
        if (NOISE_PATTERNS.some(p => evt.includes(p))) return false;
        return true;
      })
      .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 50)
      .map((e: any) => {
        // CRO AUDIT FIX — strip properties to only safe fields.
        // Never return raw properties — they might contain user content.
        const safeProps: any = {};
        const rawProps = e.properties || {};
        // Only keep known-safe error fields
        if (rawProps.errorMessage) safeProps.errorMessage = rawProps.errorMessage;
        if (rawProps.errorType) safeProps.errorType = rawProps.errorType;
        if (rawProps.error) safeProps.error = rawProps.error;
        if (rawProps.url) safeProps.url = rawProps.url;
        if (rawProps.method) safeProps.method = rawProps.method;
        if (rawProps.status) safeProps.status = rawProps.status;
        if (rawProps.statusCode) safeProps.statusCode = rawProps.statusCode;
        return {
          event: e.event,
          firmId: e.firmId,
          properties: safeProps,
          timestamp: e.timestamp,
          timeAgo: Math.floor((now - (e.timestamp || 0)) / DAY),
        };
      });
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
        joinedAt: f._creationTime ? new Date(f._creationTime).toISOString().split('T')[0] : 'Unknown',
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
        lastActive: lastActivity > 0 ? new Date(lastActivity).toISOString().split('T')[0] : 'Unknown',
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

/**
 * internal query: checkFounderRole
 * Used by actions (which can't access ctx.db directly) to verify
 * that the caller has Founder role. Returns the user record or throws.
 */
export const checkFounderRole = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    if (!args.tokenIdentifier) {
      throw new Error("Unauthorized: authentication required.");
    }
    const token = args.tokenIdentifier.toLowerCase().trim();
    const directMatches = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", args.tokenIdentifier))
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
          .filter((u: any) => u.tokenIdentifier && u.tokenIdentifier.toLowerCase() === token);
    if (allMatches.length === 0) {
      throw new Error("Unauthorized: user not found.");
    }
    const founderRecord = allMatches.find((u: any) => u.role === 'Founder');
    const userRecord = founderRecord || allMatches[0];
    if (userRecord.role !== 'Founder') {
      throw new Error(`Unauthorized: founder access required. Your role is '${userRecord.role || 'unknown'}'.`);
    }
    return userRecord;
  },
});

// ════════════════════════════════════════════════════════════════════════════
// CRO AUDIT TRACK A — FOUNDER-FACING SUBSCRIPTION REQUEST QUERIES
// ════════════════════════════════════════════════════════════════════════════
// These queries expose the new subscriptionRequests table to the founder
// admin app. The founder can see all pending payment reports, approve them
// (which flips firm.subscriptionPlan via approveSubscriptionRequest), or
// reject them (which leaves the firm on its current plan).
// ════════════════════════════════════════════════════════════════════════════

/**
 * getSubscriptionRequests — returns subscription requests filtered by status.
 * Default: 'pending_review' (the most actionable). Also supports 'all',
 * 'approved', 'rejected', 'auto_reverted', 'expired'.
 */
export const getSubscriptionRequests = query({
  args: {
    tokenIdentifier: v.string(),
    status: v.optional(v.string()),  // 'pending_review' | 'all' | 'approved' | etc.
  },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);
    const status = args.status || 'pending_review';

    const requests = status === 'all'
      ? await ctx.db.query("subscriptionRequests").order("desc").take(200)
      : await ctx.db
          .query("subscriptionRequests")
          .withIndex("by_status", (q: any) => q.eq("status", status))
          .order("desc")
          .take(200);

    // Enrich with firm + user info
    const firmCache = new Map<string, any>();
    const userCache = new Map<string, any>();
    const enriched = await Promise.all((requests || []).map(async (r: any) => {
      let firm = firmCache.get(r.firmId);
      if (!firm && r.firmId) {
        try { firm = await ctx.db.get(r.firmId as any); } catch { firm = null; }
        if (firm) firmCache.set(r.firmId, firm);
      }
      let user = userCache.get(r.userId);
      if (!user && r.userId) {
        try { user = await ctx.db.get(r.userId as any); } catch { user = null; }
        if (user) userCache.set(r.userId, user);
      }
      return {
        id: r._id,
        firmId: r.firmId,
        firmName: firm?.name || 'Unknown Firm',
        firmProduct: firm?.product || 'unified',
        userEmail: r.userEmail || user?.email || '',
        userName: user?.name || '',
        currentPlan: r.currentPlan || 'Core',
        requestedPlan: r.requestedPlan,
        billingInterval: r.billingInterval || 'annual',
        amount: r.amount || 0,
        transactionReference: r.transactionReference || '',
        status: r.status,
        paymentProofStorageId: r.paymentProofStorageId || null,
        paymentProofNote: r.paymentProofNote || null,
        requestedAt: r.requestedAt,
        reviewedAt: r.reviewedAt || null,
        reviewedBy: r.reviewedBy || null,
        autoRevertAt: r.autoRevertAt || null,
        adminNotes: r.adminNotes || null,
        // CRO AUDIT — discount fields
        discountPercent: r.discountPercent || null,
        discountedAmount: r.discountedAmount || null,
        discountReason: r.discountReason || null,
      };
    }));

    return enriched;
  },
});

/**
 * getSubscriptionRequestStats — high-level stats for the founder dashboard.
 * Returns counts by status + total pending NGN volume.
 */
export const getSubscriptionRequestStats = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    const all = await ctx.db.query("subscriptionRequests").take(500);
    const now = Date.now();

    const stats = {
      pending: 0,
      pendingAmountNaira: 0,
      approved: 0,
      rejected: 0,
      autoReverted: 0,
      expiringSoon: 0,  // pending + autoRevertAt within 24h
    };

    for (const r of all) {
      const status = (r as any).status;
      const amount = (r as any).amount || 0;
      const autoRevertAt = (r as any).autoRevertAt;
      if (status === 'pending_review') {
        stats.pending++;
        stats.pendingAmountNaira += amount;
        if (autoRevertAt && (autoRevertAt - now) < 24 * 60 * 60 * 1000) {
          stats.expiringSoon++;
        }
      } else if (status === 'approved') {
        stats.approved++;
      } else if (status === 'rejected') {
        stats.rejected++;
      } else if (status === 'auto_reverted') {
        stats.autoReverted++;
      }
    }

    return stats;
  },
});

/**
 * approveSubscriptionRequestAsFounder — founder-only wrapper around
 * approveSubscriptionRequest. Logs the admin action and triggers a refresh
 * of the firm's data via updateFirmAdminSettings.
 *
 * CRO AUDIT — DISCOUNTING SYSTEM: founder can pass discountPercent (0-100)
 * and discountReason. The discountedAmount is computed server-side as
 * amount * (1 - discountPercent/100) and stored on the request row for
 * audit + revenue reporting.
 *
 * NOTE: the actual plan flip happens directly here (founders don't have a
 * firmId, so they bypass the requireAdmin gate in
 * myFunctions.approveSubscriptionRequest).
 */
export const approveSubscriptionRequestAsFounder = mutation({
  args: {
    tokenIdentifier: v.string(),
    requestId: v.string(),
    adminNotes: v.optional(v.string()),
    // CRO AUDIT — discounting system
    discountPercent: v.optional(v.number()),   // 0-100
    discountReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const founder = await requireFounder(ctx, args.tokenIdentifier);

    // Fetch the request first so we can log the details
    const request: any = await ctx.db.get(args.requestId as any);
    if (!request) throw new Error("Subscription request not found.");
    if (request.status !== 'pending_review') {
      throw new Error(`Request is not pending (current status: ${request.status}).`);
    }

    // CRO AUDIT — compute discounted amount if discount provided
    const discountPercent = Math.max(0, Math.min(100, args.discountPercent || 0));
    const originalAmount = request.amount || 0;
    const discountedAmount = Math.round(originalAmount * (1 - discountPercent / 100));

    // Patch the request directly — bypass the requireAdmin gate in
    // myFunctions.approveSubscriptionRequest because founders don't have
    // a firmId (they're platform-level users, not firm members).
    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId as any, {
      status: 'approved',
      reviewedAt: now,
      reviewedBy: founder.email,
      adminNotes: args.adminNotes || null,
      // CRO AUDIT — store discount info for audit + revenue reporting
      discountPercent,
      discountedAmount,
      discountReason: args.discountReason || null,
      updatedAt: now,
    } as any);

    // Flip the firm's subscriptionPlan + clear trial fields
    await ctx.db.patch(request.firmId, {
      subscriptionPlan: request.requestedPlan,
      setupFeePaid: true,
      adminStatus: 'active',
      trialStartsAt: null,
      trialEndsAt: null,
      trialPlan: null,
      billingInterval: request.billingInterval,
      nextBillingDate: computeNextBillingDate(request.billingInterval, now),
      updatedAt: now,
    } as any);

    // Notify the requesting user — include discount info if applied
    if (request.userId) {
      try {
        const discountMsg = discountPercent > 0
          ? ` A ${discountPercent}% discount was applied — your actual amount due is ₦${discountedAmount.toLocaleString()}.`
          : '';
        await ctx.db.insert("notifications", {
          firmId: request.firmId,
          userId: request.userId,
          title: 'Subscription Activated',
          message: `Your upgrade to ${request.requestedPlan} has been confirmed by ${founder.email}. Enjoy the new features!${discountMsg}`,
          type: 'subscription_activated',
          timestamp: now,
          isRead: false,
        } as any);
      } catch (e) {
        console.warn('[approveSubscriptionRequestAsFounder] Notification insert failed:', e);
      }
    }

    // Log the admin action (uses analytics_events table — same as logAdminAction)
    try {
      await ctx.db.insert("analytics_events", {
        firmId: "system",
        userId: args.tokenIdentifier,
        event: 'ADMIN ACTION: APPROVED SUBSCRIPTION REQUEST',
        properties: {
          targetFirmId: request.firmId,
          targetUserId: request.userId,
          adminEmail: founder.email,
          details: `Approved ${request.currentPlan} → ${request.requestedPlan} (${request.billingInterval}). Original: ₦${originalAmount}. Discount: ${discountPercent}% (${args.discountReason || 'no reason given'}). Final: ₦${discountedAmount}. Reference: ${request.transactionReference}. Notes: ${args.adminNotes || 'none'}`,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn('[approveSubscriptionRequestAsFounder] Log insert failed:', e);
    }

    return { success: true, discountedAmount, discountPercent };
  },
});

/**
 * rejectSubscriptionRequestAsFounder — founder-only wrapper around
 * rejectSubscriptionRequest. Same pattern as approve: patch directly + log.
 */
export const rejectSubscriptionRequestAsFounder = mutation({
  args: {
    tokenIdentifier: v.string(),
    requestId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const founder = await requireFounder(ctx, args.tokenIdentifier);

    const request: any = await ctx.db.get(args.requestId as any);
    if (!request) throw new Error("Subscription request not found.");
    if (request.status !== 'pending_review') {
      throw new Error(`Request is not pending (current status: ${request.status}).`);
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId as any, {
      status: 'rejected',
      reviewedAt: now,
      reviewedBy: founder.email,
      adminNotes: args.reason || null,
      updatedAt: now,
    } as any);

    // Notify the requesting user
    if (request.userId) {
      try {
        await ctx.db.insert("notifications", {
          firmId: request.firmId,
          userId: request.userId,
          title: 'Subscription Request Update',
          message: `Your upgrade request could not be verified. Reason: ${args.reason || 'Payment not confirmed. Please contact support.'}`,
          type: 'subscription_rejected',
          timestamp: now,
          isRead: false,
        } as any);
      } catch (e) {
        console.warn('[rejectSubscriptionRequestAsFounder] Notification insert failed:', e);
      }
    }

    // Log the admin action
    try {
      await ctx.db.insert("analytics_events", {
        firmId: "system",
        userId: args.tokenIdentifier,
        event: 'ADMIN ACTION: REJECTED SUBSCRIPTION REQUEST',
        properties: {
          targetFirmId: request.firmId,
          targetUserId: request.userId,
          adminEmail: founder.email,
          details: `Rejected ${request.currentPlan} → ${request.requestedPlan}. Reason: ${args.reason || 'none'}`,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn('[rejectSubscriptionRequestAsFounder] Log insert failed:', e);
    }

    return { success: true };
  },
});

/**
 * Helper — compute the next billing date given an interval and start ISO.
 */
function computeNextBillingDate(interval: string, startIso: string): string {
  const start = new Date(startIso);
  if (interval === 'monthly') {
    start.setMonth(start.getMonth() + 1);
  } else {
    start.setFullYear(start.getFullYear() + 1);
  }
  return start.toISOString();
}

/**
 * getTrialMetrics — for the founder dashboard trial funnel.
 * Returns counts of active trials, trials ending soon (4 days), trials
 * ending today, and total trials started (lifetime).
 */
export const getTrialMetrics = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    // Fetch all firms with trialEndsAt set
    const firms = await ctx.db
      .query("firms")
      .withIndex("by_trial_ends", (q: any) => q.gte("trialEndsAt", 0))
      .take(1000);

    let activeTrials = 0;
    let endingIn4Days = 0;
    let endingToday = 0;
    let expiredUncleared = 0;  // firms whose trialEndsAt < now but trialPlan still set
    let totalTrialsStarted = 0;

    for (const f of firms) {
      const endsAt = (f as any).trialEndsAt;
      const plan = (f as any).trialPlan;
      if (!endsAt || !plan) continue;
      totalTrialsStarted++;
      if (endsAt > now) {
        activeTrials++;
        const msRemaining = endsAt - now;
        if (msRemaining < DAY) endingToday++;
        else if (msRemaining < 4 * DAY) endingIn4Days++;
      } else {
        // trialEndsAt is in the past but trialPlan still set → cron hasn't
        // cleared it yet (runs daily at 0:05 UTC).
        expiredUncleared++;
      }
    }

    return {
      activeTrials,
      endingIn4Days,
      endingToday,
      expiredUncleared,
      totalTrialsStarted,
    };
  },
});

// ════════════════════════════════════════════════════════════════════════════
// CRO AUDIT — ADD-ONS SYSTEM (Founder-facing queries + mutations)
// ════════════════════════════════════════════════════════════════════════════

/**
 * getAddonRequests — returns add-on requests filtered by status.
 * Default: 'pending_review'. Founder dashboard uses this to surface
 * pending add-on purchases for approval.
 */
export const getAddonRequests = query({
  args: {
    tokenIdentifier: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);
    const status = args.status || 'pending_review';

    const requests = status === 'all'
      ? await ctx.db.query("subscriptionAddons").order("desc").take(200)
      : await ctx.db
          .query("subscriptionAddons")
          .withIndex("by_status", (q: any) => q.eq("status", status))
          .order("desc")
          .take(200);

    // Enrich with firm name
    const firmCache = new Map<string, any>();
    const enriched = await Promise.all((requests || []).map(async (r: any) => {
      let firm = firmCache.get(r.firmId);
      if (!firm && r.firmId) {
        try { firm = await ctx.db.get(r.firmId as any); } catch { firm = null; }
        if (firm) firmCache.set(r.firmId, firm);
      }
      return {
        id: r._id,
        firmId: r.firmId,
        firmName: firm?.name || 'Unknown Firm',
        userEmail: r.userEmail || '',
        addonId: r.addonId,
        addonName: r.addonName,
        billingInterval: r.billingInterval,
        amount: r.amount || 0,
        quantity: r.quantity || 1,
        status: r.status,
        notes: r.notes || null,
        requestedAt: r.requestedAt,
        activatedAt: r.activatedAt || null,
        cancelledAt: r.cancelledAt || null,
        reviewedBy: r.reviewedBy || null,
        discountPercent: r.discountPercent || null,
        discountedAmount: r.discountedAmount || null,
        discountReason: r.discountReason || null,
      };
    }));

    return enriched;
  },
});

/**
 * approveAddonRequestAsFounder — activates a pending add-on request.
 * Optionally applies a discount. The firm sees the add-on as 'active'
 * in their Billing & Plans page.
 */
export const approveAddonRequestAsFounder = mutation({
  args: {
    tokenIdentifier: v.string(),
    requestId: v.string(),
    discountPercent: v.optional(v.number()),
    discountReason: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const founder = await requireFounder(ctx, args.tokenIdentifier);

    const request: any = await ctx.db.get(args.requestId as any);
    if (!request) throw new Error("Add-on request not found.");
    if (request.status !== 'pending_review') {
      throw new Error(`Request is not pending (current status: ${request.status}).`);
    }

    const discountPercent = Math.max(0, Math.min(100, args.discountPercent || 0));
    const originalAmount = request.amount || 0;
    const discountedAmount = Math.round(originalAmount * (1 - discountPercent / 100));

    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId as any, {
      status: 'active',
      activatedAt: now,
      reviewedBy: founder.email,
      discountPercent,
      discountedAmount,
      discountReason: args.discountReason || null,
      notes: args.adminNotes || request.notes,
      updatedAt: now,
    } as any);

    // Notify the requesting user
    if (request.userId) {
      try {
        const discountMsg = discountPercent > 0
          ? ` A ${discountPercent}% discount was applied — your actual amount due is ₦${discountedAmount.toLocaleString()}.`
          : '';
        await ctx.db.insert("notifications", {
          firmId: request.firmId,
          userId: request.userId,
          title: 'Add-On Activated',
          message: `Your ${request.addonName} add-on has been activated.${discountMsg}`,
          type: 'addon_activated',
          timestamp: now,
          isRead: false,
        } as any);
      } catch (e) {
        console.warn('[approveAddonRequestAsFounder] Notification insert failed:', e);
      }
    }

    // Log the admin action
    try {
      await ctx.db.insert("analytics_events", {
        firmId: "system",
        userId: args.tokenIdentifier,
        event: 'ADMIN ACTION: APPROVED ADD-ON REQUEST',
        properties: {
          targetFirmId: request.firmId,
          targetUserId: request.userId,
          adminEmail: founder.email,
          details: `Approved ${request.addonName} (qty ${request.quantity || 1}). Original: ₦${originalAmount}. Discount: ${discountPercent}%. Final: ₦${discountedAmount}. Notes: ${args.adminNotes || 'none'}`,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn('[approveAddonRequestAsFounder] Log insert failed:', e);
    }

    return { success: true, discountedAmount, discountPercent };
  },
});

/**
 * rejectAddonRequestAsFounder — rejects a pending add-on request.
 */
export const rejectAddonRequestAsFounder = mutation({
  args: {
    tokenIdentifier: v.string(),
    requestId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const founder = await requireFounder(ctx, args.tokenIdentifier);

    const request: any = await ctx.db.get(args.requestId as any);
    if (!request) throw new Error("Add-on request not found.");
    if (request.status !== 'pending_review') {
      throw new Error(`Request is not pending (current status: ${request.status}).`);
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId as any, {
      status: 'cancelled',  // reuse 'cancelled' status for rejected too
      cancelledAt: now,
      reviewedBy: founder.email,
      notes: args.reason || null,
      updatedAt: now,
    } as any);

    if (request.userId) {
      try {
        await ctx.db.insert("notifications", {
          firmId: request.firmId,
          userId: request.userId,
          title: 'Add-On Request Update',
          message: `Your ${request.addonName} add-on request could not be verified. Reason: ${args.reason || 'Please contact support.'}`,
          type: 'addon_rejected',
          timestamp: now,
          isRead: false,
        } as any);
      } catch (e) {
        console.warn('[rejectAddonRequestAsFounder] Notification insert failed:', e);
      }
    }

    return { success: true };
  },
});

// ── Real-Time Presence for Admin Dashboard ──────────────────────────────
// Returns all currently-online users across ALL firms, for the founder's
// admin dashboard. Each entry includes the user's name, email, firm name,
// and how long ago their last heartbeat was.
export const getAllPresenceForAdmin = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    const ACTIVE_THRESHOLD = 90 * 1000; // 90 seconds — heartbeat fires every 20s
    const cutoff = Date.now() - ACTIVE_THRESHOLD;

    // Fetch all presence records updated within the active window
    const activePresence = await ctx.db
      .query("presence")
      .filter((q: any) => q.gte(q.field("updatedAt"), cutoff))
      .collect();

    if (activePresence.length === 0) return [];

    // Enrich with user + firm details
    const result: any[] = [];
    for (const p of activePresence) {
      let userName = p.userName || 'Unknown';
      let userEmail = '';
      let firmName = '';
      let product = '';

      // Fetch user details
      try {
        const user: any = await ctx.db.get(p.userId as any);
        if (user) {
          userName = user.name || userName;
          userEmail = user.email || '';
          product = user.product || '';
        }
      } catch {}

      // Fetch firm name
      if (p.firmId) {
        try {
          const firm: any = await ctx.db.get(p.firmId as any);
          if (firm) firmName = firm.name || '';
        } catch {}
      }

      result.push({
        userId: p.userId,
        userName,
        userEmail,
        firmId: p.firmId,
        firmName,
        product,
        lastSeen: p.updatedAt,
        secondsAgo: Math.round((Date.now() - (p.updatedAt || Date.now())) / 1000),
        isOnline: true,
      });
    }

    // Group by firm for the admin dashboard
    return result.sort((a, b) => b.lastSeen - a.lastSeen);
  },
});

// ── Security Events Log ─────────────────────────────────────────────────
// Returns recent security-relevant events for the admin Security Center.
export const getSecurityEventsForAdmin = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    // Fetch recent security-relevant events from analytics_events
    const recentEvents = await ctx.db
      .query("analytics_events")
      .filter((q: any) =>
        q.or(
          q.eq(q.field("event"), "login_failed"),
          q.eq(q.field("event"), "disposable_email_blocked"),
          q.eq(q.field("event"), "unauthorized_access"),
          q.eq(q.field("event"), "signup_blocked"),
        )
      )
      .order("desc")
      .take(50);

    return recentEvents.map((e: any) => ({
      id: e._id,
      eventType: e.event,
      email: e.properties?.email || '',
      ip: e.properties?.ip || '',
      details: e.properties?.details || e.event,
      timestamp: e.timestamp,
    }));
  },
});

/**
 * query: getAloaUsageStats
 *
 * PRIVACY-SAFE ALOA usage analytics for the founder app.
 *
 * Returns AGGREGATE COUNTS ONLY — never returns message content,
 * tool results, or error details. The founder can see:
 *   - Total AI messages across the platform (today/7d/30d)
 *   - Per-firm breakdown (message count, conversation count, error rate,
 *     last activity timestamp, top tool actions, models used)
 *   - Platform-wide tool-action distribution
 *   - Platform-wide error rate
 *
 * This fixes the issue where ALOA usage was completely invisible to the
 * founder after the privacy lockdown. The lockdown correctly stopped
 * exposing message CONTENT — but it also accidentally blocked all
 * aggregate usage stats. This query restores visibility without
 * compromising privacy.
 */
export const getAloaUsageStats = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Fetch all ALOA messages (indexed by firm)
    // We take a large batch to aggregate — this is fine for a few thousand messages
    const allMessages = await ctx.db
      .query("aloaMessages")
      .order("desc")
      .take(5000);

    // Fetch all ALOA conversations for conversation counts
    const allConversations = await ctx.db
      .query("aloaConversations")
      .take(2000);

    // ─── Platform-wide stats ──────────────────────────────────────────────
    const totalMessages = allMessages.length;
    const messagesToday = allMessages.filter((m: any) => m.createdAt > oneDayAgo).length;
    const messages7d = allMessages.filter((m: any) => m.createdAt > sevenDaysAgo).length;
    const messages30d = allMessages.filter((m: any) => m.createdAt > thirtyDaysAgo).length;
    const errorCount = allMessages.filter((m: any) => m.isError).length;
    const errorRate = totalMessages > 0 ? (errorCount / totalMessages) * 100 : 0;

    // Tool action distribution (aggregate, no content)
    const toolActionCounts: Record<string, number> = {};
    for (const msg of allMessages) {
      if (msg.toolAction) {
        toolActionCounts[msg.toolAction] = (toolActionCounts[msg.toolAction] || 0) + 1;
      }
    }

    // Model distribution
    const modelCounts: Record<string, number> = {};
    for (const msg of allMessages) {
      if (msg.modelUsed) {
        modelCounts[msg.modelUsed] = (modelCounts[msg.modelUsed] || 0) + 1;
      }
    }

    // ─── Per-firm breakdown ───────────────────────────────────────────────
    const firmStatsMap: Record<string, {
      firmId: string;
      messageCount: number;
      conversationCount: number;
      errorCount: number;
      lastActivity: number;
      toolActions: Record<string, number>;
    }> = {};

    // Aggregate messages by firm
    for (const msg of allMessages) {
      const firmId = msg.firmId || 'unknown';
      if (!firmStatsMap[firmId]) {
        firmStatsMap[firmId] = {
          firmId,
          messageCount: 0,
          conversationCount: 0,
          errorCount: 0,
          lastActivity: 0,
          toolActions: {},
        };
      }
      firmStatsMap[firmId].messageCount++;
      if (msg.isError) firmStatsMap[firmId].errorCount++;
      if (msg.createdAt > firmStatsMap[firmId].lastActivity) {
        firmStatsMap[firmId].lastActivity = msg.createdAt;
      }
      if (msg.toolAction) {
        firmStatsMap[firmId].toolActions[msg.toolAction] =
          (firmStatsMap[firmId].toolActions[msg.toolAction] || 0) + 1;
      }
    }

    // Aggregate conversations by firm
    for (const conv of allConversations) {
      const firmId = conv.firmId || 'unknown';
      if (!firmStatsMap[firmId]) {
        firmStatsMap[firmId] = {
          firmId,
          messageCount: 0,
          conversationCount: 0,
          errorCount: 0,
          lastActivity: 0,
          toolActions: {},
        };
      }
      firmStatsMap[firmId].conversationCount++;
    }

    // Fetch firm names for display
    const firmIds = Object.keys(firmStatsMap).filter(id => id !== 'unknown');
    const firmNames: Record<string, { name: string; product: string }> = {};
    for (const firmId of firmIds) {
      try {
        const firm = await ctx.db.get(firmId as any);
        if (firm) {
          firmNames[firmId] = {
            name: (firm as any).name || 'Unknown Firm',
            product: (firm as any).product || 'vega',
          };
        }
      } catch {}
    }

    // Build per-firm array (sorted by message count desc)
    const perFirm = Object.values(firmStatsMap)
      .map(stat => ({
        firmId: stat.firmId,
        firmName: firmNames[stat.firmId]?.name || 'Unknown Firm',
        product: firmNames[stat.firmId]?.product || 'unknown',
        messageCount: stat.messageCount,
        conversationCount: stat.conversationCount,
        errorCount: stat.errorCount,
        errorRate: stat.messageCount > 0 ? (stat.errorCount / stat.messageCount) * 100 : 0,
        lastActivity: stat.lastActivity,
        lastActivityAgo: stat.lastActivity > 0 ? Math.round((now - stat.lastActivity) / 1000 / 60) : null, // minutes ago
        topToolActions: Object.entries(stat.toolActions)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([action, count]) => ({ action, count })),
      }))
      .sort((a, b) => b.messageCount - a.messageCount);

    // Active AI firms (used ALOA in last 7 days)
    const activeAiFirms = perFirm.filter(f => f.lastActivity > sevenDaysAgo).length;

    return {
      platform: {
        totalMessages,
        messagesToday,
        messages7d,
        messages30d,
        totalConversations: allConversations.length,
        errorCount,
        errorRate: Math.round(errorRate * 100) / 100,
        activeAiFirms,
        totalAiFirms: perFirm.length,
      },
      toolActionDistribution: Object.entries(toolActionCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([action, count]) => ({ action, count })),
      modelDistribution: Object.entries(modelCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([model, count]) => ({ model, count })),
      perFirm: perFirm.slice(0, 50), // Top 50 firms by usage
    };
  },
});

/**
 * query: getVisitorAnalytics
 *
 * Landing page visitor tracking for the founder app.
 * Tracks visits to public routes (/, /privacy-policy, /terms-of-service,
 * /portal/*/login) so the founder can see landing page effectiveness.
 *
 * Data is collected from analytics_events with event='page_view' that
 * originate from unauthenticated routes.
 */
export const getVisitorAnalytics = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier);

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Fetch recent page view events
    const pageViews = await ctx.db
      .query("analytics_events")
      .filter((q: any) => q.eq(q.field("event"), "page_view"))
      .order("desc")
      .take(5000);

    const viewsToday = pageViews.filter((e: any) => e.timestamp > oneDayAgo).length;
    const views7d = pageViews.filter((e: any) => e.timestamp > sevenDaysAgo).length;
    const views30d = pageViews.filter((e: any) => e.timestamp > thirtyDaysAgo).length;

    // Route breakdown
    const routeCounts: Record<string, number> = {};
    for (const view of pageViews) {
      const route = view.properties?.route || '/';
      routeCounts[route] = (routeCounts[route] || 0) + 1;
    }

    // Unique visitors (by IP or session ID if available)
    const uniqueIps = new Set(pageViews.map((e: any) => e.properties?.ip || 'unknown'));

    // Portal login attempts (interest signal)
    const portalLogins = pageViews.filter((e: any) =>
      e.properties?.route?.includes('/portal/') && e.properties?.route?.includes('/login')
    ).length;

    return {
      totalViews: pageViews.length,
      viewsToday,
      views7d,
      views30d,
      uniqueVisitors: uniqueIps.size,
      portalLoginViews: portalLogins,
      routeBreakdown: Object.entries(routeCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([route, count]) => ({ route, count }))
        .slice(0, 10),
      conversionSignal: portalLogins > 0 ? Math.round((portalLogins / pageViews.length) * 100) : 0,
    };
  },
});
