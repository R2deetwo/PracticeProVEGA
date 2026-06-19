/**
 * Retainer Billing Automation Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Implements the premium-tier automated retainer invoicing workflow described
 * in the Master Engineering Prompt.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  [Matter: Retainer + Frequency]                                  │
 * │             │                                                    │
 * │             ▼  cron (every 30 min) — scanMattersForRetainerCycle │
 * │  [Stage Draft Invoice in invoice_outbox]                         │
 * │             │                                                    │
 * │             ▼  cron (every 15 min) — advanceStagedOutbox         │
 * │  [Staged → Queued → Sent]                                       │
 * │             │                                                    │
 * │             ▼                                                    │
 * │  [Billing Monitor Dashboard — lawyer override controls]          │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * FEATURE GATING:
 *   - The cron calls `isFirmPremiumRetainerEligible()` for each matter's firm
 *     before staging. Non-premium firms are skipped entirely.
 *   - Premium = Vega Growth+ | Vega Pro+ | Komplete | Enterprise
 *
 * NEXT BILLING DATE COMPUTATION:
 *   Weekly      → +7 days
 *   Monthly     → +1 calendar month (same day, clamped to month end)
 *   Quarterly   → +3 calendar months
 *   Bi-Annually → +6 calendar months
 *   Annually    → +1 calendar year
 */

import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  internalAction,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireFirmUser } from "./authHelpers";

// ─── Frequency → day/month offsets ──────────────────────────────────────────

export const FREQUENCY_DAYS: Record<string, number> = {
  Weekly: 7,
};

export const FREQUENCY_MONTHS: Record<string, number> = {
  Monthly: 1,
  Quarterly: 3,
  "Bi-Annually": 6,
  Annually: 12,
};

/**
 * Compute the next billing date from a reference date and a frequency.
 * Uses calendar math (not fixed-day) so Monthly means "same day next month".
 * Clamps to month-end if the target day doesn't exist (e.g. Jan 31 → Feb 28).
 */
export function computeNextBillingDate(
  referenceISO: string,
  frequency: string,
): string {
  const ref = new Date(referenceISO);
  if (isNaN(ref.getTime())) return new Date().toISOString();

  if (FREQUENCY_DAYS[frequency]) {
    const next = new Date(ref);
    next.setDate(next.getDate() + FREQUENCY_DAYS[frequency]);
    return next.toISOString();
  }

  const months = FREQUENCY_MONTHS[frequency];
  if (!months) return ref.toISOString(); // Unknown frequency — leave unchanged

  const next = new Date(ref);
  const originalDay = next.getDate();
  next.setMonth(next.getMonth() + months);

  // Clamp to month-end if we overflowed (e.g. Jan 31 + 1 month → Mar 3 is wrong; should be Feb 28)
  // setMonth() in JS already does this, so we need to detect and roll back.
  if (next.getDate() !== originalDay) {
    // We overflowed into the next month — set to last day of the intended month
    next.setDate(0); // Rolls back to last day of previous month (which is our target month)
  }
  return next.toISOString();
}

// ─── Premium Tier Gating ────────────────────────────────────────────────────

interface FirmRecord {
  subscriptionPlan?: string;
  product?: string;
}

/**
 * Determines whether a firm is eligible for the premium automated retainer
 * billing feature. Mirrors the client-side `useFeatures().canUseRetainerAutoBilling`
 * logic — keep both in sync when changing tier rules.
 *
 * Eligible:
 *   - Vega (legal) firms on Growth, Pro, or Enterprise
 *   - Komplete (unified) firms (any plan)
 *   - Atrium (property) firms are NOT eligible — retainer billing is legal-only
 */
export function isFirmPremiumRetainerEligible(
  firm: FirmRecord | null | undefined,
): boolean {
  if (!firm) return false;
  const product = firm.product || "legal";
  const plan = firm.subscriptionPlan || "Core";

  // Komplete includes everything
  if (product === "unified") return true;

  // Retainer billing is a LEGAL feature. Atrium-only firms are excluded.
  const isLegalFirm = product === "legal" || product === "vega";
  if (!isLegalFirm) return false;

  // Vega tiers: Growth+, Pro, Enterprise
  return plan === "Growth" || plan === "Pro" || plan === "Enterprise";
}

// ─── Mutation: upsertMatterRetainerSchedule ─────────────────────────────────
// Called from the client (via MatterForm) when a user saves a matter with
// Retainer billing. Sets nextBillingDate = matter.createdAt + 1 cycle and
// records the frequency + auto-billing flag.
//
// SECURITY: Verifies the caller's firm matches the matter's firm. Premium
// gating is enforced here too — non-premium firms cannot enable
// retainerAutoBillingEnabled even if the client tries.

export const upsertMatterRetainerSchedule = mutation({
  args: {
    matterId: v.string(),
    billingFrequency: v.string(),
    autoBillingEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx);

    // Look up the matter by both _id and legacy id field
    let matter: any = await ctx.db
      .query("matters")
      .withIndex("by_custom_id", (q) => q.eq("id", args.matterId))
      .first();
    if (!matter) {
      try {
        matter = await ctx.db.get(args.matterId as any);
      } catch {}
    }
    if (!matter) {
      throw new Error("Matter not found.");
    }
    if (matter.firmId !== auth.firmId) {
      throw new Error("Unauthorized. Matter does not belong to your firm.");
    }

    // Resolve firm record for premium gating
    let firm: any = null;
    try {
      firm = await ctx.db.get(auth.firmId as any);
    } catch {}
    const eligible = isFirmPremiumRetainerEligible(firm);

    // Compute the next billing date from matter.createdAt (or now)
    const reference = matter.createdAt || new Date().toISOString();
    const nextBillingDate = computeNextBillingDate(reference, args.billingFrequency);

    await ctx.db.patch(matter._id, {
      billingFrequency: args.billingFrequency,
      retainerAutoBillingEnabled: eligible ? args.autoBillingEnabled : false,
      nextBillingDate,
      updatedAt: new Date().toISOString(),
    });

    return {
      ok: true,
      nextBillingDate,
      premiumEligible: eligible,
      autoBillingEnabled: eligible ? args.autoBillingEnabled : false,
    };
  },
});

// ─── Query: getOutboxForFirm ────────────────────────────────────────────────
// Returns all invoice_outbox entries for the caller's firm, optionally
// filtered by state. Used by the Billing Monitor Dashboard.

export const getOutboxForFirm = query({
  args: {
    state: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx);

    let entries: any[];
    if (args.state) {
      entries = await ctx.db
        .query("invoice_outbox")
        .withIndex("by_firm_state", (q) =>
          q.eq("firmId", auth.firmId).eq("state", args.state as string),
        )
        .collect();
    } else {
      entries = await ctx.db
        .query("invoice_outbox")
        .withIndex("by_firm", (q) => q.eq("firmId", auth.firmId))
        .collect();
    }

    // Sort by scheduledFor descending (most recent first)
    return entries.sort((a: any, b: any) =>
      (b.scheduledFor || "").localeCompare(a.scheduledFor || ""),
    );
  },
});

// ─── Query: getOutboxStats ──────────────────────────────────────────────────
// Returns counts by state for the dashboard's KPI cards.

export const getOutboxStats = query({
  args: {},
  handler: async (ctx) => {
    const auth = await requireFirmUser(ctx);
    const entries = await ctx.db
      .query("invoice_outbox")
      .withIndex("by_firm", (q) => q.eq("firmId", auth.firmId))
      .collect();

    const stats = {
      Staged: 0,
      Queued: 0,
      Sent: 0,
      Failed: 0,
      Paused: 0,
      Skipped: 0,
      total: entries.length,
      totalValue: 0,
    };
    for (const e of entries) {
      const s = (e.state || "Staged") as keyof typeof stats;
      if (typeof stats[s] === "number") (stats[s] as number)++;
      if (e.state === "Sent" && typeof e.totalAmount === "number") {
        stats.totalValue += e.totalAmount;
      }
    }
    return stats;
  },
});

// ─── Mutation: approveAndSendNow ────────────────────────────────────────────
// Lawyer override: immediately transitions a Staged/Paused entry to Queued
// and triggers the send pipeline (effectively bypassing the wait window).

export const approveAndSendNow = mutation({
  args: {
    outboxId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx);
    const entry: any = await ctx.db.get(args.outboxId as any);
    if (!entry) throw new Error("Outbox entry not found.");
    if (entry.firmId !== auth.firmId) {
      throw new Error("Unauthorized. Entry does not belong to your firm.");
    }

    // Only Staged or Paused entries can be force-sent
    if (entry.state !== "Staged" && entry.state !== "Paused") {
      throw new Error(`Cannot approve entry in state '${entry.state}'.`);
    }

    const now = new Date().toISOString();
    await ctx.db.patch(entry._id, {
      state: "Queued",
      scheduledFor: now, // expedite
      lastEditedBy: auth.userId,
      lastEditedAt: now,
      updatedAt: now,
    });

    // Schedule the actual send via an action (non-blocking)
    ctx.scheduler.runAfter(0, internal.retainerBilling.processOutboxEntry, {
      outboxId: entry._id,
    });

    return { ok: true };
  },
});

// ─── Mutation: pauseForEdit ─────────────────────────────────────────────────
// Freezes a Staged entry so the lawyer can edit line items / client details.
// The recurring schedule on the parent matter is NOT affected.

export const pauseForEdit = mutation({
  args: {
    outboxId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx);
    const entry: any = await ctx.db.get(args.outboxId as any);
    if (!entry) throw new Error("Outbox entry not found.");
    if (entry.firmId !== auth.firmId) {
      throw new Error("Unauthorized. Entry does not belong to your firm.");
    }
    if (entry.state === "Sent") {
      throw new Error("Cannot pause an already-sent invoice.");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(entry._id, {
      state: "Paused",
      pausedAt: now,
      lastEditedBy: auth.userId,
      lastEditedAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

// ─── Mutation: updateOutboxEntry ────────────────────────────────────────────
// Allows the lawyer to edit line items, client email, or scheduled date on
// a Paused or Staged entry.

export const updateOutboxEntry = mutation({
  args: {
    outboxId: v.string(),
    clientEmail: v.optional(v.string()),
    clientName: v.optional(v.string()),
    lineItems: v.optional(v.array(v.any())),
    subTotal: v.optional(v.number()),
    taxAmount: v.optional(v.number()),
    totalAmount: v.optional(v.number()),
    scheduledFor: v.optional(v.string()),
    cycleLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx);
    const entry: any = await ctx.db.get(args.outboxId as any);
    if (!entry) throw new Error("Outbox entry not found.");
    if (entry.firmId !== auth.firmId) {
      throw new Error("Unauthorized. Entry does not belong to your firm.");
    }
    if (entry.state === "Sent") {
      throw new Error("Cannot edit an already-sent invoice.");
    }

    const { outboxId, ...updates } = args;
    const now = new Date().toISOString();
    const cleaned: Record<string, any> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) cleaned[k] = val;
    }
    cleaned.lastEditedBy = auth.userId;
    cleaned.lastEditedAt = now;
    cleaned.updatedAt = now;

    await ctx.db.patch(entry._id, cleaned);
    return { ok: true };
  },
});

// ─── Mutation: skipCycle ────────────────────────────────────────────────────
// Cancels the invoice for the current cycle without breaking the recurring
// schedule. The matter's nextBillingDate is still advanced.

export const skipCycle = mutation({
  args: {
    outboxId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx);
    const entry: any = await ctx.db.get(args.outboxId as any);
    if (!entry) throw new Error("Outbox entry not found.");
    if (entry.firmId !== auth.firmId) {
      throw new Error("Unauthorized. Entry does not belong to your firm.");
    }
    if (entry.state === "Sent") {
      throw new Error("Cannot skip an already-sent invoice.");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(entry._id, {
      state: "Skipped",
      skippedAt: now,
      failureReason: args.reason || "Skipped by lawyer",
      lastEditedBy: auth.userId,
      lastEditedAt: now,
      updatedAt: now,
    });

    // Advance the matter's nextBillingDate so the recurring schedule continues
    if (entry.matterId && entry.frequency) {
      const matter: any = await ctx.db
        .query("matters")
        .withIndex("by_custom_id", (q) => q.eq("id", entry.matterId))
        .first();
      if (matter && matter.firmId === auth.firmId) {
        const nextDate = computeNextBillingDate(now, entry.frequency);
        await ctx.db.patch(matter._id, {
          nextBillingDate: nextDate,
          updatedAt: now,
        });
      }
    }
    return { ok: true };
  },
});

// ─── Mutation: retryFailed ──────────────────────────────────────────────────
// Re-queues a Failed entry for another send attempt.

export const retryFailed = mutation({
  args: {
    outboxId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx);
    const entry: any = await ctx.db.get(args.outboxId as any);
    if (!entry) throw new Error("Outbox entry not found.");
    if (entry.firmId !== auth.firmId) {
      throw new Error("Unauthorized. Entry does not belong to your firm.");
    }
    if (entry.state !== "Failed") {
      throw new Error("Only Failed entries can be retried.");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(entry._id, {
      state: "Queued",
      scheduledFor: now,
      failureReason: undefined,
      lastEditedBy: auth.userId,
      lastEditedAt: now,
      updatedAt: now,
    });

    ctx.scheduler.runAfter(0, internal.retainerBilling.processOutboxEntry, {
      outboxId: entry._id,
    });
    return { ok: true };
  },
});

// ─── Internal Mutation: scanMattersForRetainerCycle ─────────────────────────
// CRON-TRIGGERED. Scans all matters with billingModel=Retainer,
// retainerAutoBillingEnabled=true, and nextBillingDate <= now. For each,
// stages a draft invoice in invoice_outbox and advances nextBillingDate.

export const scanMattersForRetainerCycle = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const nowISO = new Date(now).toISOString();
    let stagedCount = 0;
    let skippedCount = 0;

    // Collect all matters — Convex doesn't support server-side filtering on
    // multiple fields, so we filter in JS. This is fine because the absolute
    // number of active retainer matters per firm is small.
    const allMatters = await ctx.db.query("matters").collect();
    const dueMatters = allMatters.filter((m: any) => {
      if (m.billingModel !== "Retainer") return false;
      if (m.retainerAutoBillingEnabled !== true) return false;
      if (m.status && m.status !== "Active") return false;
      if (!m.nextBillingDate) return false;
      return new Date(m.nextBillingDate).getTime() <= now;
    });

    // Cache firms to avoid repeated lookups
    const firmCache = new Map<string, any>();

    for (const matter of dueMatters) {
      const firmId = matter.firmId;
      if (!firmId) {
        skippedCount++;
        continue;
      }

      let firm = firmCache.get(firmId);
      if (!firm) {
        try {
          firm = await ctx.db.get(firmId as any);
        } catch {}
        if (firm) firmCache.set(firmId, firm);
      }

      // Premium gate — non-premium firms are skipped (their auto-billing
      // should already be false, but this is a defense-in-depth check)
      if (!isFirmPremiumRetainerEligible(firm)) {
        skippedCount++;
        continue;
      }

      // Resolve client email — fail staging if missing
      let clientEmail: string | undefined;
      let clientName: string | undefined;
      if (matter.clientId) {
        const client: any = await ctx.db
          .query("contacts")
          .withIndex("by_custom_id", (q) => q.eq("id", matter.clientId))
          .first();
        if (client) {
          clientEmail = client.email || undefined;
          clientName = client.name || undefined;
        }
      }

      const frequency = matter.billingFrequency || "Monthly";
      const amount = matter.fixedFeeAmount || 0;
      // 7.5% VAT is the standard Nigerian rate; firms can override at staging time
      const taxRate = 7.5;
      const subTotal = amount;
      const taxAmount = Math.round(amount * taxRate) / 100;
      const total = subTotal + taxAmount;

      const cycleDate = new Date(matter.nextBillingDate || new Date().toISOString());
      const cycleLabel = `${cycleDate.toLocaleString("en-NG", { month: "long", year: "numeric" })} Retainer — ${matter.title || "Matter"}`;

      // Stage the entry — even if clientEmail is missing, we still stage it
      // so the lawyer sees a "Failed" entry in the monitor and can fix it
      await ctx.db.insert("invoice_outbox", {
        firmId,
        matterId: matter.id || matter._id,
        clientId: matter.clientId || undefined,
        clientName,
        clientEmail,
        matterTitle: matter.title || undefined,
        cycleLabel,
        frequency,
        scheduledFor: nowISO, // review window = 0 for now; cron advances every 15 min
        stagedAt: nowISO,
        state: clientEmail ? "Staged" : "Failed",
        failureReason: clientEmail
          ? undefined
          : "Missing client email — fix in contact record",
        subTotal,
        taxAmount,
        totalAmount: total,
        currency: matter.billingCurrency || "NGN",
        lineItems: [
          {
            id: crypto.randomUUID(),
            description: `${frequency} retainer — ${cycleDate.toLocaleDateString("en-NG")}`,
            hours: 0,
            rate: amount,
            total: amount,
          },
        ],
        createdAt: nowISO,
        updatedAt: nowISO,
      });

      // Advance the matter's nextBillingDate so the recurring schedule continues
      const nextDate = computeNextBillingDate(matter.nextBillingDate || new Date().toISOString(), frequency);
      await ctx.db.patch(matter._id, {
        nextBillingDate: nextDate,
        updatedAt: nowISO,
      });

      stagedCount++;
    }

    console.log(
      `[retainerBilling.scanMattersForRetainerCycle] staged=${stagedCount} skipped=${skippedCount}`,
    );
    return { stagedCount, skippedCount };
  },
});

// ─── Internal Mutation: advanceStagedOutbox ─────────────────────────────────
// CRON-TRIGGERED. Picks up Staged entries whose review window has elapsed
// (scheduledFor <= now) and transitions them to Queued, then triggers the
// send action.

export const advanceStagedOutbox = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const nowISO = new Date(now).toISOString();
    let advancedCount = 0;

    const staged = await ctx.db
      .query("invoice_outbox")
      .withIndex("by_state", (q) => q.eq("state", "Staged"))
      .collect();

    const due = staged.filter((e: any) => {
      if (!e.scheduledFor) return false;
      return new Date(e.scheduledFor).getTime() <= now;
    });

    for (const entry of due) {
      await ctx.db.patch(entry._id, {
        state: "Queued",
        updatedAt: nowISO,
      });
      // Fire-and-forget the send attempt
      ctx.scheduler.runAfter(0, internal.retainerBilling.processOutboxEntry, {
        outboxId: entry._id,
      });
      advancedCount++;
    }

    console.log(`[retainerBilling.advanceStagedOutbox] advanced=${advancedCount}`);
    return { advancedCount };
  },
});

// ─── Internal Action: processOutboxEntry ────────────────────────────────────
// Performs the actual "send" of an outbox entry. In production this would
// call an email/WhatsApp gateway. For now it just marks the entry Sent.
//
// FAILURES: If clientEmail is missing, the entry transitions to Failed with
// a clear reason. Lawyers can fix the email and click Retry.

export const processOutboxEntry = internalAction({
  args: { outboxId: v.string() },
  handler: async (ctx, args) => {
    // Look up the entry
    const entry: any = await ctx.runQuery(
      internal.retainerBilling.getOutboxEntryInternal,
      { outboxId: args.outboxId },
    );
    if (!entry) {
      console.warn(
        `[retainerBilling.processOutboxEntry] entry not found: ${args.outboxId}`,
      );
      return;
    }
    if (entry.state !== "Queued") {
      // Already processed or paused — skip
      return;
    }

    const nowISO = new Date().toISOString();

    // Validate we have everything needed to send
    if (!entry.clientEmail) {
      await ctx.runMutation(internal.retainerBilling.markOutboxState, {
        outboxId: args.outboxId,
        state: "Failed",
        failureReason: "Missing client email — fix in contact record",
      });
      return;
    }

    try {
      // ─── INTEGRATION POINT ────────────────────────────────────────────
      // This is where we would call the actual email/WhatsApp gateway.
      // For now we simulate a successful send and create the invoice record.
      //
      // Future: ctx.runAction(internal.email.sendInvoiceEmail, { ... })

      // Create the invoice record so it shows up in the regular Billing view
      const invoiceId = await ctx.runMutation(
        internal.retainerBilling.createInvoiceFromOutbox,
        { outboxId: args.outboxId },
      );

      await ctx.runMutation(internal.retainerBilling.markOutboxState, {
        outboxId: args.outboxId,
        state: "Sent",
        sentAt: nowISO,
        invoiceId,
      });
    } catch (err: any) {
      await ctx.runMutation(internal.retainerBilling.markOutboxState, {
        outboxId: args.outboxId,
        state: "Failed",
        failureReason: err?.message || "Unknown gateway error",
      });
    }
  },
});

// ─── Internal Query: getOutboxEntryInternal ─────────────────────────────────
// Used by processOutboxEntry to fetch the entry without auth context (since
// it's called from an internal action).

export const getOutboxEntryInternal = internalQuery({
  args: { outboxId: v.string() },
  handler: async (ctx, args) => {
    try {
      return await ctx.db.get(args.outboxId as any);
    } catch {
      return null;
    }
  },
});

// ─── Internal Mutation: markOutboxState ─────────────────────────────────────
// Updates an outbox entry's state. Used by processOutboxEntry.

export const markOutboxState = internalMutation({
  args: {
    outboxId: v.string(),
    state: v.string(),
    failureReason: v.optional(v.string()),
    sentAt: v.optional(v.string()),
    invoiceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entry: any = await ctx.db.get(args.outboxId as any);
    if (!entry) return;

    const updates: Record<string, any> = {
      state: args.state,
      updatedAt: new Date().toISOString(),
    };
    if (args.failureReason !== undefined)
      updates.failureReason = args.failureReason;
    if (args.sentAt) updates.sentAt = args.sentAt;
    if (args.invoiceId) updates.invoiceId = args.invoiceId;
    if (args.state === "Failed") updates.failedAt = new Date().toISOString();

    await ctx.db.patch(entry._id, updates);
  },
});

// ─── Internal Mutation: createInvoiceFromOutbox ─────────────────────────────
// Creates a real invoice record in the invoices table from an outbox entry.
// This is called when the outbox entry is successfully "sent".

export const createInvoiceFromOutbox = internalMutation({
  args: { outboxId: v.string() },
  handler: async (ctx, args) => {
    const entry: any = await ctx.db.get(args.outboxId as any);
    if (!entry) throw new Error("Outbox entry not found");

    const nowISO = new Date().toISOString();
    const invoiceId = crypto.randomUUID();
    const invoiceNumber = `INV-RET-${Date.now().toString().slice(-6)}`;

    await ctx.db.insert("invoices", {
      firmId: entry.firmId,
      invoiceNumber,
      client: {
        id: entry.clientId || "",
        name: entry.clientName || "",
      },
      matter: {
        id: entry.matterId,
        title: entry.matterTitle || "",
      },
      lineItems: entry.lineItems || [],
      status: "Sent",
      issueDate: nowISO,
      dueDate: nowISO,
      subTotal: entry.subTotal || 0,
      taxAmount: entry.taxAmount || 0,
      total_amount: entry.totalAmount || 0,
      id: invoiceId,
      createdAt: nowISO,
      updatedAt: nowISO,
    });

    return invoiceId;
  },
});

// ─── Mutation: stageRetainerInvoiceManually ─────────────────────────────────
// Allows a lawyer or admin to manually stage an invoice for a retainer matter
// out-of-cycle. Useful for one-off billings that aren't on the auto schedule.

export const stageRetainerInvoiceManually = mutation({
  args: {
    matterId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx);
    let matter: any = await ctx.db
      .query("matters")
      .withIndex("by_custom_id", (q) => q.eq("id", args.matterId))
      .first();
    if (!matter) {
      try {
        matter = await ctx.db.get(args.matterId as any);
      } catch {}
    }
    if (!matter) throw new Error("Matter not found.");
    if (matter.firmId !== auth.firmId) {
      throw new Error("Unauthorized. Matter does not belong to your firm.");
    }
    if (matter.billingModel !== "Retainer") {
      throw new Error("Only Retainer-billed matters can be staged this way.");
    }

    let firm: any = null;
    try {
      firm = await ctx.db.get(auth.firmId as any);
    } catch {}
    if (!isFirmPremiumRetainerEligible(firm)) {
      throw new Error("Your tier does not include automated retainer billing.");
    }

    const nowISO = new Date().toISOString();
    const amount = matter.fixedFeeAmount || 0;
    const taxAmount = Math.round(amount * 7.5) / 100;
    const total = amount + taxAmount;

    let clientEmail: string | undefined;
    let clientName: string | undefined;
    if (matter.clientId) {
      const client: any = await ctx.db
        .query("contacts")
        .withIndex("by_custom_id", (q) => q.eq("id", matter.clientId))
        .first();
      if (client) {
        clientEmail = client.email || undefined;
        clientName = client.name || undefined;
      }
    }

    const outboxId = await ctx.db.insert("invoice_outbox", {
      firmId: auth.firmId,
      matterId: matter.id || matter._id,
      clientId: matter.clientId || undefined,
      clientName,
      clientEmail,
      matterTitle: matter.title || undefined,
      cycleLabel: `Manual retainer invoice — ${nowISO.slice(0, 10)}`,
      frequency: matter.billingFrequency || "Monthly",
      scheduledFor: nowISO,
      stagedAt: nowISO,
      state: "Staged",
      subTotal: amount,
      taxAmount,
      totalAmount: total,
      currency: matter.billingCurrency || "NGN",
      lineItems: [
        {
          id: crypto.randomUUID(),
          description: `Manual retainer invoice — ${new Date().toLocaleDateString("en-NG")}`,
          hours: 0,
          rate: amount,
          total: amount,
        },
      ],
      createdAt: nowISO,
      updatedAt: nowISO,
    });

    return { outboxId };
  },
});
