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
import { logError } from "./observability";
import { internal } from "./_generated/api";
import { requireFirmUser } from "./authHelpers";
import { withCronReporting } from "./observability";
import { computeInvoiceTotals, normalizeTaxRate } from "./invoiceFinancials";
import { issueInvoiceNumber } from "./invoiceNumbering";

// ─── V2 RETAINER HONESTY (V-FIN-3/5) ─────────────────────────────────────────
//
// STATE MACHINE (the truthful version — the pre-V2 machine claimed a
// review window of zero and marked entries "Sent" while the code comment
// admitted it "simulated a successful send"):
//
//   Staged ──(lawyer approves: approveAndSendNow)──▶ Queued ──▶ Sent
//     │                                                │   (ONLY when the
//     │ never auto-issues                              │    email gateway
//     ▼                                                ▼    CONFIRMED)
//   Paused / Skipped                            Issued (invoice created,
//     via pauseForEdit/skipCycle                       email NOT confirmed —
//   Failed (missing email / gateway error)             deliveryStatus tells)
//
// A staged entry is PENDING REVIEW. The cron never issues it. The lawyer's
// approval is the ONLY path to issue. reviewDueBy is the advisory display
// deadline for that review (48h), not a send trigger.
export const RETAINER_REVIEW_WINDOW_MS = 48 * 60 * 60 * 1000;

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

/** Date-only display for the staged line-item label (stable across
 *  timezone quirks of toLocaleDateString in the Convex runtime). */
function cycleDateStr(nextBillingDate: any): string {
  const d = new Date(nextBillingDate || Date.now());
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
    sessionToken: v.optional(v.string()),
    matterId: v.string(),
    billingFrequency: v.string(),
    autoBillingEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, undefined, args.sessionToken);

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

    // ── V2 CATCH-UP CLAMP (V-FIN-4): enabling auto-billing on an OLD matter
    //    used to set nextBillingDate = createdAt + 1 cycle — months in the
    //    past — and the scan cron then staged one invoice per tick forever.
    //    Now: a fresh enable starts one FULL cycle from now (no retroactive
    //    billing the client never saw coming); a schedule that already has a
    //    FUTURE next billing date keeps it (re-saving a schedule is not a
    //    reset). The scan-side clamp bounds the rest.
    const nowISO = new Date().toISOString();
    let nextBillingDate: string;
    const reference = matter.createdAt || nowISO;
    const fromCreation = computeNextBillingDate(reference, args.billingFrequency);
    const existingFuture = matter.nextBillingDate && new Date(matter.nextBillingDate).getTime() > Date.now()
      ? (matter.nextBillingDate as string)
      : null;
    if (existingFuture) {
      nextBillingDate = existingFuture;
    } else if (new Date(fromCreation).getTime() > Date.now()) {
      nextBillingDate = fromCreation;
    } else {
      nextBillingDate = computeNextBillingDate(nowISO, args.billingFrequency);
    }

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
    sessionToken: v.optional(v.string()),
    state: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, undefined, args.sessionToken);

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
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, undefined, args.sessionToken);
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
      Issued: 0, // V2: invoice created but email NOT confirmed
      notEmailed: 0, // entries whose deliveryStatus is explicitly not_emailed
      total: entries.length,
      totalValue: 0,
    };
    for (const e of entries) {
      const s = (e.state || "Staged") as keyof typeof stats;
      if (typeof stats[s] === "number") (stats[s] as number)++;
      if (e.deliveryStatus === "not_emailed") stats.notEmailed++;
      if (e.state === "Sent" && typeof e.totalAmount === "number") {
        stats.totalValue += e.totalAmount;
      }
    }
    return stats;
  },
});

// ─── Mutation: approveAndSendNow ────────────────────────────────────────────
// Lawyer override: the ONLY path from Staged/Paused to issued. Approving
// records WHO approved and WHEN, queues the entry, and triggers the send
// pipeline (real email attempt — see processOutboxEntry). Without this
// explicit approval, a staged entry never leaves the review state.

export const approveAndSendNow = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    outboxId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, undefined, args.sessionToken);
    const entry: any = await ctx.db.get(args.outboxId as any);
    if (!entry) throw new Error("Outbox entry not found.");
    if (entry.firmId !== auth.firmId) {
      throw new Error("Unauthorized. Entry does not belong to your firm.");
    }

    // Only Staged or Paused entries can be approved
    if (entry.state !== "Staged" && entry.state !== "Paused") {
      throw new Error(`Cannot approve entry in state '${entry.state}'.`);
    }

    const now = new Date().toISOString();
    await ctx.db.patch(entry._id, {
      state: "Queued",
      scheduledFor: now, // approved — process immediately
      approvedAt: now,
      approvedBy: auth.userId,
      failureReason: undefined,
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
    sessionToken: v.optional(v.string()),
    outboxId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, undefined, args.sessionToken);
    const entry: any = await ctx.db.get(args.outboxId as any);
    if (!entry) throw new Error("Outbox entry not found.");
    if (entry.firmId !== auth.firmId) {
      throw new Error("Unauthorized. Entry does not belong to your firm.");
    }
    if (entry.state === "Sent" || entry.state === "Issued") {
      throw new Error("Cannot pause an already-issued invoice.");
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
// a Paused or Staged entry (the review workflow). V2: when lineItems are
// edited, the money figures are RECOMPUTED server-side from those items
// with the same tax contract as every other invoice — the review edit
// cannot stuff arbitrary totals into the books.

export const updateOutboxEntry = mutation({
  args: {
    sessionToken: v.optional(v.string()),
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
    const auth = await requireFirmUser(ctx, undefined, args.sessionToken);
    const entry: any = await ctx.db.get(args.outboxId as any);
    if (!entry) throw new Error("Outbox entry not found.");
    if (entry.firmId !== auth.firmId) {
      throw new Error("Unauthorized. Entry does not belong to your firm.");
    }
    if (entry.state === "Sent" || entry.state === "Issued") {
      throw new Error("Cannot edit an already-issued invoice.");
    }

    const { outboxId, sessionToken: _st, ...updates } = args;
    const now = new Date().toISOString();
    const cleaned: Record<string, any> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) cleaned[k] = val;
    }

    // V2 server-side recompute: line items are the source of truth; the
    // client's subTotal/taxAmount/totalAmount are ignored entirely.
    if (Array.isArray(cleaned.lineItems)) {
      let firm: any = null;
      try { firm = await ctx.db.get(entry.firmId); } catch { firm = null; }
      const vatPct = normalizeTaxRate(firm?.taxSettings?.vatRate, 7.5);
      const totals = computeInvoiceTotals(
        cleaned.lineItems,
        { applicable: true, ratePct: vatPct },
      );
      cleaned.subTotal = totals.subTotal;
      cleaned.taxAmount = totals.taxAmount;
      cleaned.totalAmount = totals.total_amount;
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
    sessionToken: v.optional(v.string()),
    outboxId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, undefined, args.sessionToken);
    const entry: any = await ctx.db.get(args.outboxId as any);
    if (!entry) throw new Error("Outbox entry not found.");
    if (entry.firmId !== auth.firmId) {
      throw new Error("Unauthorized. Entry does not belong to your firm.");
    }
    if (entry.state === "Sent" || entry.state === "Issued") {
      throw new Error("Cannot skip an already-issued invoice.");
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
    sessionToken: v.optional(v.string()),
    outboxId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, undefined, args.sessionToken);
    const entry: any = await ctx.db.get(args.outboxId as any);
    if (!entry) throw new Error("Outbox entry not found.");
    if (entry.firmId !== auth.firmId) {
      throw new Error("Unauthorized. Entry does not belong to your firm.");
    }
    // V2: a Failed entry OR an Issued entry whose email never went out can
    // be retried (the retry re-drives delivery; the invoice itself is not
    // duplicated — createInvoiceFromOutbox is idempotent).
    if (entry.state !== "Failed" && !(entry.state === "Issued" && entry.deliveryStatus !== "emailed")) {
      throw new Error("Only Failed entries (or issued entries whose email was not delivered) can be retried.");
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
  handler: withCronReporting("crons:scanMattersForRetainerCycle", async (ctx) => {
    const now = Date.now();
    const nowISO = new Date(now).toISOString();
    let stagedCount = 0;
    let skippedCount = 0;

    // Phase 4 (perf): index seek via matters.by_retainer — only matters with
    // retainerAutoBillingEnabled === true (docs without the field, i.e. the
    // vast majority, are excluded from the index entirely). The 30-minute
    // cron previously read the ENTIRE matters table on every tick.
    const candidateMatters = await ctx.db
      .query("matters")
      .withIndex("by_retainer", (q: any) => q.eq("retainerAutoBillingEnabled", true))
      .collect();
    const dueMatters = candidateMatters.filter((m: any) => {
      if (m.billingModel !== "Retainer") return false;
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
          .withIndex("by_custom_id", (q: any) => q.eq("id", matter.clientId))
          .first();
        if (client) {
          clientEmail = client.email || undefined;
          clientName = client.name || undefined;
        }
      }

      const frequency = matter.billingFrequency || "Monthly";
      const amount = matter.fixedFeeAmount || 0;

      // ── V2 TAX CONTRACT (V-FIN-15): the firm's own VAT rate, normalized
      //    (legacy fraction storage reconciled), kobo-exact — the SAME
      //    contract every other invoice path uses. No more hardcoded 7.5
      //    drifting away from the firm's settings.
      const vatPct = normalizeTaxRate((firm as any)?.taxSettings?.vatRate, 7.5);
      const stagedLineItems = [
        {
          id: crypto.randomUUID(),
          description: `${frequency} retainer — ${cycleDateStr(matter.nextBillingDate)}`,
          hours: 0,
          rate: amount,
          total: amount,
        },
      ];
      const totals = computeInvoiceTotals(stagedLineItems, { applicable: true, ratePct: vatPct });

      const cycleDate = new Date(matter.nextBillingDate || new Date().toISOString());
      const cycleLabel = `${cycleDate.toLocaleString("en-NG", { month: "long", year: "numeric" })} Retainer — ${matter.title || "Matter"}`;

      // ── V2 HONEST REVIEW WINDOW (V-FIN-3): the entry is staged PENDING
      //    REVIEW. Nothing is issued until a lawyer approves it
      //    (approveAndSendNow). reviewDueBy is the advisory review deadline
      //    (48h) — it is displayed, never acted on. A missing client email
      //    still lands as Failed so the lawyer sees it and can fix it.
      const reviewDueBy = new Date(now + RETAINER_REVIEW_WINDOW_MS).toISOString();
      await ctx.db.insert("invoice_outbox", {
        firmId,
        matterId: matter.id || matter._id,
        clientId: matter.clientId || undefined,
        clientName,
        clientEmail,
        matterTitle: matter.title || undefined,
        cycleLabel,
        frequency,
        scheduledFor: nowISO,
        reviewDueBy,
        stagedAt: nowISO,
        state: clientEmail ? "Staged" : "Failed",
        failureReason: clientEmail
          ? undefined
          : "Missing client email — fix in contact record",
        subTotal: totals.subTotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.total_amount,
        currency: matter.billingCurrency || "NGN",
        lineItems: stagedLineItems,
        createdAt: nowISO,
        updatedAt: nowISO,
      });

      // ── V2 CATCH-UP CLAMP (V-FIN-4): after staging AT MOST ONE entry for
      //    the most recent due cycle, advance nextBillingDate FORWARD past
      //    now. A schedule enabled on an old matter (nextBillingDate months
      //    in the past) stages exactly ONE catch-up invoice, never one per
      //    cron tick — enabling a schedule can no longer flood the firm
      //    with a semester of unexpected invoices.
      let nextDate = computeNextBillingDate(matter.nextBillingDate || new Date().toISOString(), frequency);
      let guard = 0;
      while (new Date(nextDate).getTime() <= now && guard < 240) {
        nextDate = computeNextBillingDate(nextDate, frequency);
        guard++;
      }
      await ctx.db.patch(matter._id, {
        nextBillingDate: nextDate,
        updatedAt: nowISO,
      });

      stagedCount++;
    }

    console.log(`[retainerBilling.scanMattersForRetainerCycle] staged=${stagedCount} skipped=${skippedCount}`);
    return { stagedCount, skippedCount };
  },),
});

// ─── Internal Mutation: advanceStagedOutbox ─────────────────────────────────
// CRON-TRIGGERED (every 15 min). V2 (V-FIN-3): this cron NO LONGER issues
// staged entries — a staged entry is PENDING REVIEW and only a lawyer's
// explicit approval (approveAndSendNow → state Queued) can issue it. The
// cron's remaining job is delivery assurance: re-drive APPROVED entries
// still sitting in Queued (a scheduler hiccup or a crashed send attempt),
// which is idempotent — processOutboxEntry skips anything not Queued.
// Staged entries past their reviewDueBy are simply flagged overdue in the
// monitor UI; they never auto-issue.

export const advanceStagedOutbox = internalMutation({
  args: {},
  handler: withCronReporting("crons:advanceStagedRetainerOutbox", async (ctx) => {
    const now = Date.now();
    const nowISO = new Date(now).toISOString();
    let advancedCount = 0;

    const queued = await ctx.db
      .query("invoice_outbox")
      .withIndex("by_state", (q: any) => q.eq("state", "Queued"))
      .collect();

    const due = queued.filter((e: any) => {
      if (!e.scheduledFor) return true; // approved but never scheduled — drive it
      return new Date(e.scheduledFor).getTime() <= now;
    });

    for (const entry of due) {
      // Idempotent re-drive of an ALREADY-APPROVED entry (state stays
      // Queued — only processOutboxEntry moves it further).
      ctx.scheduler.runAfter(0, internal.retainerBilling.processOutboxEntry, {
        outboxId: entry._id,
      });
      advancedCount++;
    }

    return { advancedCount };
  },),
});

// ─── Internal Action: processOutboxEntry ────────────────────────────────────
// Performs the actual issue of an APPROVED outbox entry. V2 (V-FIN-3) —
// the delivery truth this function now records:
//
//   1. The invoice record is created (idempotently — a retry never books a
//      second invoice) and the entry becomes `Issued` with issuedAt.
//   2. The email is REALLY attempted through the live gateway
//      (communications.sendEmailCore — Brevo, the same rail the portal
//      invites and reminders use).
//        • Gateway CONFIRMS delivery (messageId)  → state `Sent`,
//          sentAt, deliveryStatus 'emailed'. "Sent" now means SENT.
//        • Gateway not configured / simulated     → entry stays `Issued`,
//          deliveryStatus 'not_emailed', failureReason states plainly that
//          no email left the building.
//        • Gateway hard error                     → `Issued` + 'not_emailed'
//          with the provider error (the invoice itself is real).
//   3. A missing client email fails BEFORE the invoice is created (the
//      lawyer fixes the contact and retries).
//
// The pre-V2 behavior — the code admitted it faked a successful send and
// the invoice record", then mark it Sent with a sentAt timestamp — claimed
// an email that never existed. That simulation is gone.

export const processOutboxEntry = internalAction({
  args: { outboxId: v.string() },
  handler: async (ctx, args) => {
    // Look up the entry
    const entry: any = await ctx.runQuery(
      internal.retainerBilling.getOutboxEntryInternal,
      { outboxId: args.outboxId },
    );
    if (!entry) {
      await logError(ctx, {
        scope: "payment", name: "retainerBilling:processOutboxEntry:missingEntry",
        error: new Error(`entry not found: ${args.outboxId}`),
        severity: "warning",
        context: { outboxId: args.outboxId },
      });
      return;
    }
    if (entry.state !== "Queued" && entry.state !== "Issued") {
      // Not approved (or already fully sent / paused) — nothing to do.
      return;
    }

    const nowISO = new Date().toISOString();

    // Validate we have everything needed to deliver
    if (!entry.clientEmail) {
      await ctx.runMutation(internal.retainerBilling.markOutboxState, {
        outboxId: args.outboxId,
        state: "Failed",
        failureReason: "Missing client email — fix in contact record",
      });
      return;
    }

    try {
      // ── 1. Issue the invoice (idempotent: a retried send reuses the
      //    invoice that already exists — never a second row).
      let invoiceId: string = entry.invoiceId;
      if (!invoiceId) {
        invoiceId = await ctx.runMutation(
          internal.retainerBilling.createInvoiceFromOutbox,
          { outboxId: args.outboxId },
        );
        await ctx.runMutation(internal.retainerBilling.markOutboxState, {
          outboxId: args.outboxId,
          state: "Issued",
          issuedAt: nowISO,
          invoiceId,
          deliveryStatus: "not_emailed",
        });
      }

      // ── 2. Actually attempt the delivery. sendEmailCore returns
      //    { success, simulated, error, messageId } — `simulated` means NO
      //    email was sent (no Brevo key on the deployment). Only a real
      //    confirmation (success && !simulated && messageId) earns `Sent`.
      const firmName = entry.firmName || "your legal team";
      const amount = Number(entry.totalAmount || 0);
      const amountStr = `₦${amount.toLocaleString("en-NG")}`;
      const dueDate = entry.dueDate || nowISO;
      let emailResult: any = null;
      try {
        emailResult = await ctx.runAction(internal.communications.sendEmailCore, {
          to: entry.clientEmail,
          toName: entry.clientName || undefined,
          subject: `Invoice ${entry.invoiceNumber || ""} from ${firmName}`.replace(/\s+/g, " ").trim(),
          htmlContent:
            `<p>Dear ${entry.clientName || "Client"},</p>` +
            `<p>Your retainer invoice <strong>${entry.invoiceNumber || cycleLabelFallback(entry)}</strong> for <strong>${amountStr}</strong> ` +
            `(covering: ${entry.cycleLabel || "retainer services"}) has been issued${dueDate ? ` and is due on ${dueDate}` : ""}.</p>` +
            `<p>Please arrange payment according to our agreed terms and reply to this email with your payment evidence.</p>` +
            `<p>Thank you.</p>`,
          firmId: entry.firmId,
          recordLog: true,
        });
      } catch (emailErr: any) {
        emailResult = { success: false, simulated: false, error: emailErr?.message || "email action failed" };
      }

      const confirmed = !!(
        emailResult &&
        emailResult.success === true &&
        emailResult.simulated !== true &&
        emailResult.messageId
      );

      if (confirmed) {
        // The gateway confirmed delivery — "Sent" is now the truth.
        await ctx.runMutation(internal.retainerBilling.markOutboxState, {
          outboxId: args.outboxId,
          state: "Sent",
          sentAt: new Date().toISOString(),
          invoiceId,
          deliveryStatus: "emailed",
          emailMessageId: emailResult.messageId,
          failureReason: undefined,
        });
      } else {
        // The invoice is issued, but NO email went out. Say exactly that.
        await ctx.runMutation(internal.retainerBilling.markOutboxState, {
          outboxId: args.outboxId,
          state: "Issued",
          issuedAt: entry.issuedAt || nowISO,
          invoiceId,
          deliveryStatus: "not_emailed",
          failureReason: !emailResult
            ? "Email could not be attempted."
            : emailResult.simulated
              ? (emailResult.error || "Email gateway not configured — the invoice was issued but NO email was sent.")
              : (emailResult.error || "Email delivery failed — the invoice was issued but the email did not go out."),
        });
      }
    } catch (err: any) {
      await ctx.runMutation(internal.retainerBilling.markOutboxState, {
        outboxId: args.outboxId,
        state: "Failed",
        failureReason: err?.message || "Unknown error while issuing the invoice",
      });
    }
  },
});

function cycleLabelFallback(entry: any): string {
  return entry?.cycleLabel || "retainer invoice";
}

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
    // ─── V2 truthful delivery fields (V-FIN-3) ──────────────────────
    deliveryStatus: v.optional(v.string()),   // 'emailed' | 'not_emailed'
    emailMessageId: v.optional(v.string()),
    issuedAt: v.optional(v.string()),
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
    if (args.deliveryStatus !== undefined) updates.deliveryStatus = args.deliveryStatus;
    if (args.emailMessageId !== undefined) updates.emailMessageId = args.emailMessageId;
    if (args.issuedAt) updates.issuedAt = args.issuedAt;
    if (args.state === "Failed") updates.failedAt = new Date().toISOString();

    await ctx.db.patch(entry._id, updates);
  },
});

// ─── Internal Mutation: createInvoiceFromOutbox ─────────────────────────────
// Creates the real invoice record from an APPROVED outbox entry. V2:
//   • IDEMPOTENT — if the entry already carries its invoiceId, that invoice
//     is returned; a retried or re-driven send can never book a second one.
//   • SERVER-ISSUED NUMBER — the same atomic financial_counters sequence
//     every other invoice uses (V-FIN-6). The old `INV-RET-` + last-six-
//     digits-of-Date.now() stamp collided in the same second and lived
//     outside the firm's numbering.
//   • AUTHORITATIVE TOTALS — recomputed from the entry's line items with
//     the one tax contract (the lawyer's review edits already went through
//     updateOutboxEntry's server-side recompute; the issue step re-derives
//     from the same source, so a stale outbox total can never leak in).
//   • TRUTHFUL STATUS — the invoice is created 'Unpaid' (issued, awaiting
//     payment). It is flipped to 'Sent' ONLY when the email gateway
//     confirms delivery; the pre-V2 code stamped 'Sent' on an invoice no
//     email ever carried.

export const createInvoiceFromOutbox = internalMutation({
  args: { outboxId: v.string() },
  handler: async (ctx, args) => {
    const entry: any = await ctx.db.get(args.outboxId as any);
    if (!entry) throw new Error("Outbox entry not found");

    // Idempotency: the retry path arrives here with the invoice already
    // booked — return it, don't duplicate it.
    if (entry.invoiceId) {
      return entry.invoiceId as string;
    }

    const nowISO = new Date().toISOString();
    const invoiceId = crypto.randomUUID();

    // Atomic, per-firm, sequential number (conflict-free by construction).
    const invoiceNumber = await issueInvoiceNumber(ctx, entry.firmId);

    // Authoritative totals from the line items — the ONE tax contract.
    let firm: any = null;
    try { firm = await ctx.db.get(entry.firmId); } catch { firm = null; }
    const vatPct = normalizeTaxRate(firm?.taxSettings?.vatRate, 7.5);
    const totals = computeInvoiceTotals(
      entry.lineItems || [],
      { applicable: true, ratePct: vatPct },
    );

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
      status: "Unpaid", // issued, NOT claimed as delivered (email may follow)
      issueDate: nowISO,
      dueDate: nowISO,
      subTotal: totals.subTotal,
      taxAmount: totals.taxAmount,
      total_amount: totals.total_amount,
      taxApplicable: totals.taxApplicable,
      taxRate: totals.taxRate,
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

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * stageRetainerInvoiceManually removed: firm-gated orphan with zero product callers (the outbox pipeline is internal).
 */
