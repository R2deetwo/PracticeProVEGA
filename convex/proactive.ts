import { internalMutation, internalAction, internalQuery, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireStaffCaller, assertSameFirm } from "./callerAuth";

// ─────────────────────────────────────────────────────────────────────────────
// PROACTIVE INTELLIGENCE ENGINE — Phase 2
//
// This module runs server-side crons that make ARIA proactive rather than
// purely reactive. Three core capabilities:
//
//   1. DEADLINE SCANNER — Scans tasks/events for upcoming & overdue deadlines
//   2. ANOMALY DETECTOR — Flags unusual patterns (stalled matters, revenue drops, etc.)
//   3. AI MORNING BRIEFING — Generates a concise daily briefing per firm
//
// All findings are written to the `proactive_insights` table and surfaced
// as in-app notifications.  The morning briefing is additionally stored as a
// special conversation in `aloaConversations` so it appears in ARIA chat.
// ─────────────────────────────────────────────────────────────────────────────

// ─── TYPES (inline for Convex portability) ──────────────────────────────────

type InsightCategory = "deadline" | "anomaly" | "briefing";
type InsightSeverity = "info" | "warning" | "critical";

// ─── QUERIES ────────────────────────────────────────────────────────────────

/** Fetch un-dismissed insights for a firm, newest first. */
export const getInsights = query({
  args: {
    firmId: v.string(),
    category: v.optional(v.string()),
    dismissed: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { firmId, category, dismissed, limit }) => {
    let q = ctx.db
      .query("proactive_insights")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId));

    let results = await q.order("desc").take(limit ?? 50);

    if (category !== undefined) {
      results = results.filter((r) => r.category === category);
    }
    if (dismissed !== undefined) {
      results = results.filter((r) => (r.dismissed ?? false) === dismissed);
    }
    return results;
  },
});

/** Fetch the latest morning briefing for a firm. */
export const getLatestBriefing = query({
  args: { firmId: v.string() },
  handler: async (ctx, { firmId }) => {
    const briefing = await ctx.db
      .query("proactive_insights")
      .withIndex("by_firm_category", (q) =>
        q.eq("firmId", firmId).eq("category", "briefing")
      )
      .order("desc")
      .first();
    return briefing ?? null;
  },
});

/** Count unread insights per category for badge display. */
export const getInsightCounts = query({
  args: { firmId: v.string() },
  handler: async (ctx, { firmId }) => {
    const all = await ctx.db
      .query("proactive_insights")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const undismissed = all.filter((i) => !i.dismissed);
    return {
      deadline: undismissed.filter((i) => i.category === "deadline").length,
      anomaly: undismissed.filter((i) => i.category === "anomaly").length,
      briefing: undismissed.filter((i) => i.category === "briefing").length,
      total: undismissed.length,
    };
  },
});

// ─── MUTATIONS ──────────────────────────────────────────────────────────────

/** Dismiss an insight so it no longer appears in the feed. */
export const dismissInsight = mutation({
  args: {
    insightId: v.id("proactive_insights"),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: dismissing was a bare id patch — any internet
    // caller could dismiss any firm's insights. Verify the caller owns it.
    const caller = await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    const insight = await ctx.db.get(args.insightId);
    if (!insight) throw new Error("Insight not found");
    assertSameFirm(caller, insight.firmId as any);
    await ctx.db.patch(args.insightId, { dismissed: true, dismissedAt: Date.now() });
  },
});
// ─── CRON-TRIGGERED INTERNAL MUTATIONS ──────────────────────────────────────

/**
 * DEADLINE SCANNER (runs every 6 hours)
 *
 * Scans all firms for:
 *   - Tasks with dueDate within 48 hours (warning)
 *   - Tasks with dueDate in the past (critical / overdue)
 *   - Events (court dates) within 72 hours (warning) or past (critical)
 *   - Service charges overdue by 14+ days (critical — revenue at risk)
 *
 * Deduplicates by generating a deterministic key per entity+date so the same
 * insight isn't re-created on every scan.
 */
export const scanDeadlines = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const FORTY_EIGHT_H = 48 * 3600000;
    const SEVENTY_TWO_H = 72 * 3600000;
    const FOURTEEN_DAYS = 14 * 86400000;
    const todayStr = new Date().toISOString().split("T")[0]; // for dedup
    let created = 0;

    // Fetch all firms
    const firms = await ctx.db.query("firms").take(500);

    for (const firm of firms) {
      const firmId = firm._id as string;

      // ── TASKS ──────────────────────────────────────────────────────
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_firm", (q) => q.eq("firmId", firmId))
        .collect();

      const pendingTasks = tasks.filter(
        (t) => t.status !== "Done" && t.status !== "done" && t.dueDate
      );

      for (const task of pendingTasks) {
        const due = typeof task.dueDate === "string"
          ? new Date(task.dueDate).getTime()
          : (task.dueDate as unknown as number);

        if (isNaN(due)) continue;

        const diff = due - now;
        let severity: InsightSeverity | null = null;
        let title = "";
        let body = "";

        if (diff < 0) {
          // Overdue
          const daysLate = Math.floor(Math.abs(diff) / 86400000);
          severity = "critical";
          title = `Overdue Task: ${task.title}`;
          body = `"${task.title}" was due ${daysLate} day(s) ago and is still incomplete.`;
        } else if (diff <= FORTY_EIGHT_H) {
          // Due within 48h
          const hoursLeft = Math.floor(diff / 3600000);
          severity = "warning";
          title = `Task Due Soon: ${task.title}`;
          body = `"${task.title}" is due in ${hoursLeft} hour(s).`;
        }

        if (severity) {
          const dedupKey = `deadline|task|${task._id}|${todayStr}`;
          const existing = await ctx.db
            .query("proactive_insights")
            .withIndex("by_firm_dedup", (q) => q.eq("firmId", firmId).eq("dedupKey", dedupKey))
            .first();

          if (!existing) {
            await ctx.db.insert("proactive_insights", {
              firmId,
              category: "deadline",
              severity,
              title,
              body,
              entityType: "task",
              entityId: task._id as string,
              dedupKey,
              dismissed: false,
              createdAt: now,
            });

            // Also create an in-app notification
            await ctx.db.insert("notifications", {
              firmId,
              userId: (task as any).assignedTo ?? firm.created_by ?? firm.createdBy ?? "",
              title,
              message: body,
              type: "deadline_reminder",
              isRead: false,
              createdAt: now as any,
            });

            created++;
          }
        }
      }

      // ── EVENTS (Court Dates / Hearings) ────────────────────────────
      const events = await ctx.db
        .query("events")
        .withIndex("by_firm", (q) => q.eq("firmId", firmId))
        .collect();

      const futureEvents = events.filter((e) => e.date);

      for (const event of futureEvents) {
        const eventTime = typeof event.date === "string"
          ? new Date(event.date).getTime()
          : (event.date as unknown as number);

        if (isNaN(eventTime)) continue;

        const diff = eventTime - now;
        let severity: InsightSeverity | null = null;
        let title = "";
        let body = "";

        if (diff < 0) {
          // Past event — might be missed
          severity = "info";
          title = `Past Event: ${event.title}`;
          body = `"${event.title}" was scheduled for ${new Date(eventTime).toLocaleDateString("en-NG")}. Verify outcome is recorded.`;
        } else if (diff <= SEVENTY_TWO_H) {
          severity = "warning";
          const hoursLeft = Math.floor(diff / 3600000);
          title = `Upcoming: ${event.title}`;
          body = `"${event.title}" is scheduled in ${hoursLeft} hour(s). Ensure preparation is complete.`;
        }

        if (severity) {
          const dedupKey = `deadline|event|${event._id}|${todayStr}`;
          const existing = await ctx.db
            .query("proactive_insights")
            .withIndex("by_firm_dedup", (q) => q.eq("firmId", firmId).eq("dedupKey", dedupKey))
            .first();

          if (!existing) {
            await ctx.db.insert("proactive_insights", {
              firmId,
              category: "deadline",
              severity,
              title,
              body,
              entityType: "event",
              entityId: event._id as string,
              dedupKey,
              dismissed: false,
              createdAt: now,
            });
            created++;
          }
        }
      }

      // ── SERVICE CHARGES (Atrium) — long-overdue revenue risk ───────
      const overdueCharges = await ctx.db
        .query("service_charges")
        .withIndex("by_firm_defaulter", (q) => q.eq("firmId", firmId).eq("isDefaulter", true))
        .collect();

      for (const charge of overdueCharges) {
        if ((charge.daysOverdue ?? 0) >= 14) {
          const dedupKey = `deadline|sc|${charge._id}|${todayStr}`;
          const existing = await ctx.db
            .query("proactive_insights")
            .withIndex("by_firm_dedup", (q) => q.eq("firmId", firmId).eq("dedupKey", dedupKey))
            .first();

          if (!existing) {
            await ctx.db.insert("proactive_insights", {
              firmId,
              category: "deadline",
              severity: "critical",
              title: `Revenue at Risk: ${charge.category} Service Charge`,
              body: `${charge.category} service charge for unit ${charge.unitId} is ${charge.daysOverdue} days overdue. Amount: ₦${charge.amount.toLocaleString()}. Consider escalating to formal demand.`,
              entityType: "service_charge",
              entityId: charge._id as string,
              dedupKey,
              dismissed: false,
              createdAt: now,
            });
            created++;
          }
        }
      }
    }

    return { created };
  },
});

/**
 * ANOMALY DETECTOR (runs daily at 6 AM UTC / 7 AM WAT)
 *
 * Scans for:
 *   - Stalled matters (no activity in 14+ days while still "Active")
 *   - High overdue ratios (Atrium: >50% of service charges are defaulters)
 *   - Inactive users (team members who haven't been seen in 14+ days)
 *   - Unread inbound messages older than 48 hours (Atrium)
 *   - Matters with no assigned users
 */
export const detectAnomalies = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Stale matter threshold: 30 days (was 14 — too aggressive)
    const STALE_THRESHOLD = 30 * 86400000;
    const FORTY_EIGHT_H = 48 * 3600000;
    const todayStr = new Date().toISOString().split("T")[0];
    let created = 0;

    const firms = await ctx.db.query("firms").take(500);

    for (const firm of firms) {
      const firmId = firm._id as string;

      // ─── BATCH: Fetch all non-dismissed insights for this firm ONCE ──
      // Previously: 2 DB queries per matter (dedup check + entity check)
      // = 1000 queries for a firm with 500 matters. Now: 1 query.
      const allFirmInsights = await ctx.db
        .query("proactive_insights")
        .withIndex("by_firm", (q) => q.eq("firmId", firmId))
        .filter((q) => q.eq(q.field("dismissed"), false))
        .collect();
      const existingDedupKeys = new Set(allFirmInsights.map((i) => i.dedupKey));
      const existingEntities = new Set(allFirmInsights.map((i) => `${i.entityType}:${i.entityId}`));

      // ── STALLED MATTERS ────────────────────────────────────────────
      // Phase 4 (perf): index seek for Active matters only (matters.by_status)
      // — closed/archived matters are no longer read into the cron's memory.
      const activeMatters = await ctx.db
        .query("matters")
        .withIndex("by_status", (q) => q.eq("firmId", firmId).eq("status", "Active"))
        .collect();

      for (const matter of activeMatters) {
        const lastUpdate = matter.updatedAt
          ? (typeof matter.updatedAt === "string"
              ? new Date(matter.updatedAt).getTime()
              : matter.updatedAt as number)
          : matter._creationTime;

        if (now - lastUpdate > STALE_THRESHOLD) {
          // ── ACTIVITY CROSS-CHECK (Phase 4 / audit 3.2) ───────────────
          // A matter whose ROW is old may still be actively worked on —
          // recent document uploads or note edits mean it is NOT stalled.
          // Probe the newest document + note for this matter (by_matter
          // index, newest-first) before creating a false "Stalled" insight.
          // The matterId forms (Convex _id vs legacy id copy) are the same
          // string in practice; probe both defensively.
          const matterIdForms = new Set<string>([String(matter._id)]);
          if (matter.id && String(matter.id) !== String(matter._id)) {
            matterIdForms.add(String(matter.id));
          }

          const toTs = (v: unknown): number => {
            if (typeof v === "string") {
              const t = new Date(v).getTime();
              return Number.isNaN(t) ? 0 : t;
            }
            return typeof v === "number" ? v : 0;
          };

          let latestActivity = lastUpdate;
          for (const mid of matterIdForms) {
            const [newestDoc, newestNote] = await Promise.all([
              ctx.db
                .query("documents")
                .withIndex("by_matter", (q) => q.eq("matterId", mid))
                .order("desc")
                .first(),
              ctx.db
                .query("notePages")
                .withIndex("by_matter", (q) => q.eq("matterId", mid))
                .order("desc")
                .first(),
            ]);
            latestActivity = Math.max(
              latestActivity,
              toTs(newestDoc?.updatedAt ?? newestDoc?.createdAt),
              newestDoc?._creationTime ?? 0,
              toTs(newestNote?.updatedAt ?? newestNote?.createdAt),
              newestNote?._creationTime ?? 0,
            );
          }

          if (now - latestActivity > STALE_THRESHOLD) {
            const daysStalled = Math.floor((now - latestActivity) / 86400000);
            const stallBucket = daysStalled < 60 ? '30-60' : daysStalled < 90 ? '60-90' : '90+';
            const dedupKey = `anomaly|stalled|${matter._id}|${stallBucket}`;

            // In-memory check — NO DB query needed
            if (!existingDedupKeys.has(dedupKey) && !existingEntities.has(`matter:${matter._id}`)) {
              await ctx.db.insert("proactive_insights", {
                firmId,
                category: "anomaly",
                severity: "warning",
                title: `Stalled Matter: ${matter.title}`,
                body: `"${matter.title}" has had no activity in ${daysStalled} days (no matter updates, document uploads, or note edits). Consider a status review or task assignment.`,
                entityType: "matter",
                entityId: matter._id as string,
                dedupKey,
                dismissed: false,
                createdAt: now,
              });
              existingDedupKeys.add(dedupKey);
              existingEntities.add(`matter:${matter._id}`);
              created++;
            }
          }
        }

        // ── UNASSIGNED MATTERS ──────────────────────────────────────
        if (
          !matter.assignedUsers ||
          (Array.isArray(matter.assignedUsers) && matter.assignedUsers.length === 0)
        ) {
          const dedupKey = `anomaly|unassigned|${matter._id}`;

          // In-memory check — NO DB query needed
          if (!existingDedupKeys.has(dedupKey)) {
            await ctx.db.insert("proactive_insights", {
              firmId,
              category: "anomaly",
              severity: "info",
              title: `Unassigned Matter: ${matter.title}`,
              body: `"${matter.title}" has no team members assigned. Assign counsel to ensure timely progress.`,
              entityType: "matter",
              entityId: matter._id as string,
              dedupKey,
              dismissed: false,
              createdAt: now,
            });
            existingDedupKeys.add(dedupKey);
            created++;
          }
        }
      }

      // ── HIGH DEFAULTER RATIO (Atrium) ──────────────────────────────
      const allCharges = await ctx.db
        .query("service_charges")
        .withIndex("by_firm", (q) => q.eq("firmId", firmId))
        .collect();

      if (allCharges.length >= 3) {
        const defaulters = allCharges.filter((c) => c.isDefaulter).length;
        const ratio = defaulters / allCharges.length;

        if (ratio > 0.5) {
          const dedupKey = `anomaly|defaulter_ratio|${firmId}|${todayStr}`;
          const existing = await ctx.db
            .query("proactive_insights")
            .withIndex("by_firm_dedup", (q) => q.eq("firmId", firmId).eq("dedupKey", dedupKey))
            .first();

          if (!existing) {
            await ctx.db.insert("proactive_insights", {
              firmId,
              category: "anomaly",
              severity: "critical",
              title: "High Defaulter Ratio Detected",
              body: `${Math.round(ratio * 100)}% of service charges (${defaulters}/${allCharges.length}) are in default. Revenue recovery should be prioritized. Consider batch-issuing formal demand notices.`,
              entityType: "firm",
              entityId: firmId,
              dedupKey,
              dismissed: false,
              createdAt: now,
            });
            created++;
          }
        }
      }

      // ── UNREAD INBOUND MESSAGES (Atrium) ───────────────────────────
      const unreadInbound = await ctx.db
        .query("atrium_inbound_messages")
        .withIndex("by_firm_read", (q) => q.eq("firmId", firmId).eq("isRead", false))
        .collect();

      const oldUnread = unreadInbound.filter((m) => now - m.receivedAt > FORTY_EIGHT_H);

      if (oldUnread.length >= 3) {
        const dedupKey = `anomaly|unread_msgs|${firmId}|${todayStr}`;
        const existing = await ctx.db
          .query("proactive_insights")
          .withIndex("by_firm_dedup", (q) => q.eq("firmId", firmId).eq("dedupKey", dedupKey))
          .first();

        if (!existing) {
          await ctx.db.insert("proactive_insights", {
            firmId,
            category: "anomaly",
            severity: "warning",
            title: `${oldUnread.length} Unread Tenant Messages`,
            body: `${oldUnread.length} inbound tenant messages have been unread for over 48 hours. Delayed responses may impact tenant satisfaction.`,
            entityType: "firm",
            entityId: firmId,
            dedupKey,
            dismissed: false,
            createdAt: now,
          });
          created++;
        }
      }
    }

    return { created };
  },
});

/**
 * AI MORNING BRIEFING (runs daily at 6:30 AM UTC / 7:30 AM WAT)
 *
 * For each firm with active users, generates a concise AI-powered briefing
 * that summarizes:
 *   - Overdue deadlines & upcoming court dates
 *   - Stalled matters & anomalies
 *   - Atrium: Revenue at risk, defaulter count
 *   - Suggested priorities for the day
 *
 * The briefing is stored both as a `proactive_insight` and as an
 * `aloaConversations` entry so it appears in the ARIA chat panel.
 */
export const generateMorningBriefing = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const todayStr = new Date().toISOString().split("T")[0];
    let briefingsCreated = 0;

    // Fetch all firms
    const firms: any[] = await ctx.runQuery(internal.proactive.getFirmsForBriefing, {});

    for (const firm of firms) {
      const firmId = firm._id as string;
      const productName = (firm as any).product || "legal";

      // ── GATHER DATA ──────────────────────────────────────────────
      const data: any = await ctx.runQuery(internal.proactive.getBriefingData, { firmId });

      // Build a compact text summary for the AI
      const briefingPrompt = buildBriefingPrompt(data, productName, firm.name);

      // ── CALL AI ──────────────────────────────────────────────────
      const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_DEMO_KEY;
      if (!apiKey) {
        console.warn(`[Proactive] No API key for firm ${firmId}, skipping briefing.`);
        continue;
      }

      try {
        const aiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: briefingPrompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
              },
            }),
          }
        );

        if (!aiResponse.ok) {
          console.warn(`[Proactive] AI call failed for firm ${firmId}: ${aiResponse.statusText}`);
          continue;
        }

        const aiData = await aiResponse.json();
        const briefingText =
          aiData?.candidates?.[0]?.content?.parts?.[0]?.text ??
          "Unable to generate briefing this morning. Please check your deadlines manually.";

        // ── STORE INSIGHT ──────────────────────────────────────────
        const dedupKey = `briefing|${firmId}|${todayStr}`;
        const existing = await ctx.runQuery(internal.proactive.findInsightByDedup, {
          firmId,
          dedupKey,
        });

        if (!existing) {
          await ctx.runMutation(internal.proactive.storeBriefing, {
            firmId,
            briefingText,
            dedupKey,
            createdAt: now,
          });
          briefingsCreated++;
        }
      } catch (err) {
        console.error(`[Proactive] Briefing generation error for firm ${firmId}:`, err);
      }
    }

    return { briefingsCreated };
  },
});

// ─── HELPER QUERIES / MUTATIONS (called by the action above) ────────────────

export const getFirmsForBriefing = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("firms").take(500);
  },
});

export const getBriefingData = internalQuery({
  args: { firmId: v.string() },
  handler: async (ctx, { firmId }) => {
    const now = Date.now();
    const SEVENTY_TWO_H = 72 * 3600000;

    // Tasks
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const overdueTasks = tasks.filter(
      (t) =>
        t.dueDate &&
        t.status !== "Done" &&
        t.status !== "done" &&
        (typeof t.dueDate === "string" ? new Date(t.dueDate).getTime() : t.dueDate as number) < now
    );
    const upcomingTasks = tasks.filter(
      (t) =>
        t.dueDate &&
        t.status !== "Done" &&
        t.status !== "done" &&
        (typeof t.dueDate === "string" ? new Date(t.dueDate).getTime() : t.dueDate as number) - now > 0 &&
        (typeof t.dueDate === "string" ? new Date(t.dueDate).getTime() : t.dueDate as number) - now <= SEVENTY_TWO_H
    );

    // Events
    const events = await ctx.db
      .query("events")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const upcomingEvents = events
      .filter((e) => {
        if (!e.date) return false;
        const t = typeof e.date === "string" ? new Date(e.date).getTime() : (e.date as number);
        return t > now && t - now <= SEVENTY_TWO_H;
      })
      .slice(0, 10);

    // Matters
    const matters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const activeMatters = matters.filter((m) => m.status === "Active");
    const stalledMatters = activeMatters.filter((m) => {
      const lastUpdate = m.updatedAt
        ? (typeof m.updatedAt === "string" ? new Date(m.updatedAt).getTime() : m.updatedAt as number)
        : m._creationTime;
      return now - lastUpdate > 14 * 86400000;
    });

    // Atrium-specific: Service charges & defaults
    const serviceCharges = await ctx.db
      .query("service_charges")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const defaulters = serviceCharges.filter((c) => c.isDefaulter);
    const totalRevenueAtRisk = defaulters.reduce((sum, c) => sum + c.amount, 0);

    // Properties
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    // Recent insights (anomalies already detected)
    const recentAnomaliesRaw = await ctx.db
      .query("proactive_insights")
      .withIndex("by_firm_category", (q) => q.eq("firmId", firmId).eq("category", "anomaly"))
      .order("desc")
      .take(5);

    const recentAnomalies = recentAnomaliesRaw as any[];

    return {
      overdueTasks: overdueTasks.slice(0, 10).map((t) => ({
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
      })),
      upcomingTasks: upcomingTasks.slice(0, 10).map((t) => ({
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
      })),
      upcomingEvents: upcomingEvents.map((e) => ({
        title: e.title,
        date: e.date,
      })),
      activeMatters: activeMatters.length,
      stalledMatters: stalledMatters.length,
      totalMatters: matters.length,
      defaulters: defaulters.length,
      totalServiceCharges: serviceCharges.length,
      totalRevenueAtRisk,
      totalProperties: properties.length,
      occupiedProperties: properties.filter((p: any) => p.status === "Occupied").length,
      vacantProperties: properties.filter((p: any) => p.status === "Vacant").length,
      recentAnomalies: recentAnomalies.map((a: any) => ({
        title: a.title,
        severity: a.severity,
      })),
    };
  },
});

export const findInsightByDedup = internalQuery({
  args: { firmId: v.string(), dedupKey: v.string() },
  handler: async (ctx, { firmId, dedupKey }) => {
    return await ctx.db
      .query("proactive_insights")
      .withIndex("by_firm_dedup", (q) => q.eq("firmId", firmId).eq("dedupKey", dedupKey))
      .first();
  },
});

export const storeBriefing = internalMutation({
  args: {
    firmId: v.string(),
    briefingText: v.string(),
    dedupKey: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, { firmId, briefingText, dedupKey, createdAt }) => {
    // 1. Store as a proactive insight
    await ctx.db.insert("proactive_insights", {
      firmId,
      category: "briefing",
      severity: "info",
      title: `Morning Briefing — ${new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}`,
      body: briefingText,
      entityType: "firm",
      entityId: firmId,
      dedupKey,
      dismissed: false,
      createdAt,
    });

    // 2. Also store as an ARIA conversation so it appears in chat
    //    We'll create a conversation titled "Morning Briefing" and add the
    //    briefing as the first model message.
    const conversationId = await ctx.db.insert("aloaConversations", {
      firmId,
      userId: "proactive_engine",
      title: `☀️ Morning Briefing — ${new Date().toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}`,
      createdAt,
      updatedAt: createdAt,
    });

    await ctx.db.insert("aloaMessages", {
      conversationId: conversationId as string,
      firmId,
      id: `briefing_${Date.now()}`,
      role: "model",
      content: briefingText,
      modelUsed: "gemini-2.0-flash",
      createdAt,
    });

    return { success: true, conversationId };
  },
});

// ─── PROMPT BUILDER ─────────────────────────────────────────────────────────

function buildBriefingPrompt(data: any, productName: string, firmName: string): string {
  const isAtrium = productName === "property" || productName === "unified";
  const today = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `You are ARIA, the AI assistant for ${firmName}. Generate a concise, professional morning briefing for today, ${today}.

RULES:
- Be conversational but professional, like a senior associate briefing the principal
- Use Nigerian English conventions
- Keep it under 300 words
- Lead with the most urgent items
- End with 1-2 suggested priorities for the day
- Do NOT use generic AI phrases like "As an AI" or "I'm here to help"
- Do NOT use markdown headers (##), use bold (**text**) for emphasis instead
- If a section has zero items, omit it entirely rather than saying "None"

FIRM DATA:
${isAtrium ? `
**Property Portfolio:** ${data.totalProperties} properties (${data.occupiedProperties} occupied, ${data.vacantProperties} vacant)
**Service Charges:** ${data.totalServiceCharges} tracked, ${data.defaulters} in default
**Revenue at Risk:** ₦${data.totalRevenueAtRisk.toLocaleString()}
` : `
**Matters:** ${data.totalMatters} total, ${data.activeMatters} active, ${data.stalledMatters} stalled (no activity in 14+ days)
`}

**Overdue Tasks (${data.overdueTasks.length}):**
${data.overdueTasks.map((t: any) => `- ${t.title} (${t.priority || "Medium"} Priority)`).join("\n") || "None"}

**Upcoming Deadlines (next 72h):**
${data.upcomingTasks.map((t: any) => `- ${t.title} (Due: ${typeof t.dueDate === "string" ? t.dueDate : new Date(t.dueDate).toLocaleDateString("en-NG")})`).join("\n") || "None"}

**Upcoming Events (next 72h):**
${data.upcomingEvents.map((e: any) => `- ${e.title} (${typeof e.date === "string" ? e.date : new Date(e.date).toLocaleDateString("en-NG")})`).join("\n") || "None"}

**Active Anomalies:**
${data.recentAnomalies.map((a: any) => `- [${a.severity.toUpperCase()}] ${a.title}`).join("\n") || "None"}

Generate the morning briefing now.`;
}

// ─── COURT DATE REMINDERS ────────────────────────────────────────────────────
// Scans matters with nextAdjournedDate set. For each matter where the
// hearing date is 7, 3, or 1 day(s) away, inserts a scheduled_messages
// row with messageType "court_reminder". The existing processScheduledMessages
// cron (every 5 min) will deliver it via WhatsApp/email.
//
// Duplicate prevention: before inserting, checks if a reminder for the
// same matter + milestone (7/3/1) already exists in scheduled_messages.
//
// Recipients: the assigned lawyer(s) on the matter (from assignedUsers).
// Client-facing reminders are OFF by default (court dates can be sensitive).

export const sendCourtReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const ONE_DAY = 86400000;
    const milestones = [
      { days: 7, label: "7 days" },
      { days: 3, label: "3 days" },
      { days: 1, label: "1 day" },
    ];
    let created = 0;

    // Fetch all firms
    const firms = await ctx.db.query("firms").take(500);

    for (const firm of firms) {
      const firmId = firm._id as string;

      // ── TIER GATE: Court Date Reminders is a Growth+ feature ──
      // FIX: Moved from Pro-only to Growth+ (Growth, Pro, Enterprise, Komplete).
      // Court date reminders are a safety net — a missed court date is a
      // malpractice-level risk. The marginal cost (~₦10/WhatsApp message)
      // is negligible compared to the value of preventing a missed hearing.
      const plan = (firm as any).subscriptionPlan;
      const trialPlan = (firm as any).trialPlan;
      const effectivePlan = trialPlan || plan; // Use trial plan if on active trial
      if (effectivePlan !== 'Growth' && effectivePlan !== 'Pro' && effectivePlan !== 'Enterprise' && effectivePlan !== 'Komplete') continue;

      // Query all matters for this firm that have a nextAdjournedDate
      const matters = await ctx.db
        .query("matters")
        .withIndex("by_firm", (q) => q.eq("firmId", firmId))
        .filter((q) => q.neq(q.field("nextAdjournedDate"), undefined))
        .filter((q) => q.neq(q.field("nextAdjournedDate"), ""))
        .collect();

      for (const matter of matters) {
        if (!matter.nextAdjournedDate) continue;

        const hearingDate = new Date(matter.nextAdjournedDate).getTime();
        if (isNaN(hearingDate)) continue;

        // Calculate days until hearing
        const daysUntil = Math.floor((hearingDate - now) / ONE_DAY);

        // Check each milestone
        for (const milestone of milestones) {
          if (daysUntil !== milestone.days) continue;

          // Duplicate check: look for existing scheduled message with same matter + milestone
          const existing = await ctx.db
            .query("scheduled_messages")
            .withIndex("by_firm", (q) => q.eq("firmId", firmId))
            .filter((q) => q.eq(q.field("messageType"), "court_reminder"))
            .filter((q) => q.eq(q.field("status"), "scheduled"))
            .collect();

          // Check if any existing message references this matter + milestone
          const dedupKey = `matter:${matter._id}:milestone:${milestone.days}`;
          const alreadyScheduled = existing.some((msg) =>
            msg.content.includes(dedupKey)
          );

          if (alreadyScheduled) continue;

          // Build reminder content
          const hearingDateStr = new Date(matter.nextAdjournedDate).toLocaleDateString("en-NG", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          });

          const courtInfo = matter.court ? ` at ${matter.court}` : "";
          const courtRoomInfo = matter.courtRoom ? ` (${matter.courtRoom})` : "";

          const content = `⚖️ COURT REMINDER: ${matter.title}\n\n` +
            `Your next hearing is in ${milestone.label}${courtInfo}${courtRoomInfo}.\n` +
            `Date: ${hearingDateStr}\n\n` +
            `This is an automated reminder from PracticePro.\n` +
            `<!--${dedupKey}-->`;

          // Get assigned lawyers
          const assignedUsers = (matter as any).assignedUsers || [];
          if (assignedUsers.length === 0) continue;

          // Insert into scheduled_messages — processScheduledMessages cron
          // (every 5 min) will pick this up and send via WhatsApp
          await ctx.db.insert("scheduled_messages", {
            firmId,
            messageType: "court_reminder",
            channel: "whatsapp",
            content,
            scheduledFor: now, // deliver immediately
            status: "scheduled",
            isAutomation: true,
            tenantIds: assignedUsers, // reuse field for lawyer userIds
            skipConversation: true, // don't create portal conversation
            createdAt: now,
            updatedAt: now,
          });
          created++;
        }
      }
    }

    return { created };
  },
});
