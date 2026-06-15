import { internalMutation, internalAction, internalQuery, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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
  args: { insightId: v.id("proactive_insights") },
  handler: async (ctx, { insightId }) => {
    await ctx.db.patch(insightId, { dismissed: true, dismissedAt: Date.now() });
  },
});

/** Dismiss all insights of a given category for a firm. */
export const dismissAllInsights = mutation({
  args: { firmId: v.string(), category: v.optional(v.string()) },
  handler: async (ctx, { firmId, category }) => {
    const all = await ctx.db
      .query("proactive_insights")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const targets = category
      ? all.filter((i) => i.category === category && !i.dismissed)
      : all.filter((i) => !i.dismissed);

    const now = Date.now();
    for (const t of targets) {
      await ctx.db.patch(t._id, { dismissed: true, dismissedAt: now });
    }
    return { dismissed: targets.length };
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

    console.log(`[Proactive] Deadline scan complete: ${created} new insights created.`);
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
    const FOURTEEN_DAYS = 14 * 86400000;
    const FORTY_EIGHT_H = 48 * 3600000;
    const todayStr = new Date().toISOString().split("T")[0];
    let created = 0;

    const firms = await ctx.db.query("firms").take(500);

    for (const firm of firms) {
      const firmId = firm._id as string;

      // ── STALLED MATTERS ────────────────────────────────────────────
      const matters = await ctx.db
        .query("matters")
        .withIndex("by_firm", (q) => q.eq("firmId", firmId))
        .collect();

      const activeMatters = matters.filter((m) => m.status === "Active");

      for (const matter of activeMatters) {
        const lastUpdate = matter.updatedAt
          ? (typeof matter.updatedAt === "string"
              ? new Date(matter.updatedAt).getTime()
              : matter.updatedAt as number)
          : matter._creationTime;

        if (now - lastUpdate > FOURTEEN_DAYS) {
          const daysStalled = Math.floor((now - lastUpdate) / 86400000);
          const dedupKey = `anomaly|stalled|${matter._id}|${todayStr}`;
          const existing = await ctx.db
            .query("proactive_insights")
            .withIndex("by_firm_dedup", (q) => q.eq("firmId", firmId).eq("dedupKey", dedupKey))
            .first();

          if (!existing) {
            await ctx.db.insert("proactive_insights", {
              firmId,
              category: "anomaly",
              severity: "warning",
              title: `Stalled Matter: ${matter.title}`,
              body: `"${matter.title}" has had no activity in ${daysStalled} days. Consider a status review or task assignment.`,
              entityType: "matter",
              entityId: matter._id as string,
              dedupKey,
              dismissed: false,
              createdAt: now,
            });
            created++;
          }
        }

        // ── UNASSIGNED MATTERS ──────────────────────────────────────
        if (
          !matter.assignedUsers ||
          (Array.isArray(matter.assignedUsers) && matter.assignedUsers.length === 0)
        ) {
          const dedupKey = `anomaly|unassigned|${matter._id}|${todayStr}`;
          const existing = await ctx.db
            .query("proactive_insights")
            .withIndex("by_firm_dedup", (q) => q.eq("firmId", firmId).eq("dedupKey", dedupKey))
            .first();

          if (!existing) {
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

    console.log(`[Proactive] Anomaly scan complete: ${created} new insights created.`);
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

    console.log(`[Proactive] Morning briefing complete: ${briefingsCreated} briefings generated.`);
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
