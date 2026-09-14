/**
 * refunds.ts — P3 refund guarantee backend (minimal, human-in-the-loop).
 *
 * CONTEXT: the marketing surface (LandingPage badge + FAQ, UsagePolicy §7.1,
 * ResourcesPage changelog, README, index.html JSON-LD) all promise a
 * "30-day money-back guarantee on annual plans". Before this module the
 * promise had NO backend: no table, no mutation, no tracking. Customers
 * had to email the founder and refunds lived in nobody's audit trail.
 *
 * SCOPE (deliberately minimal — decision (a), confirmed by the user):
 *   - refundRequests table + status trail (see convex/schema.ts)
 *   - CUSTOMER submission: submitRefundRequest (Settings → Billing & Plans)
 *   - CUSTOMER withdrawal: cancelMyRefundRequest (while still pending)
 *   - FOUNDER filing on a customer's behalf: createRefundRequestOnBehalf
 *     (for requests that arrive via email/WhatsApp outside the app)
 *   - FOUNDER decision: decideRefundRequest (approve / deny, with note)
 *   - FOUNDER money movement: markRefundProcessed — the founder executes
 *     the refund MANUALLY in the Paystack dashboard, then pastes the
 *     refund reference here. The app NEVER calls the Paystack refund API.
 *   - The paystack webhook's refund.processed event auto-completes an
 *     approved request when Paystack confirms the money moved
 *     (see convex/paystack.ts recordPaystackEvent).
 *
 * STATUS FLOW: 'pending' → 'approved' → 'processed'
 *                           ↘ 'denied'
 *             'pending' → 'cancelled' (withdrawn by the requesting firm)
 *
 * ELIGIBILITY (computed server-side at submission, surfaced to the founder):
 *   'guarantee'      — annual plan + within 30 days of the referenced
 *                      payment → the marketing promise applies as-of-right
 *   'discretionary'  — outside the window / monthly plan → founder judgement
 *   'unverified'     — no payment could be matched → founder investigates
 *
 * SECURITY: customer mutations go through requireFirmUser (bearer session,
 * portal roles blocked); founder mutations go through requireFounder
 * (session-verified, role === 'Founder'). Money NEVER moves here.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser } from "./authHelpers";
import { requireFounder } from "./founderMetrics";
import { logError } from "./observability";
import { notifyFounders } from "./founderNotifications";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

/** The money-back guarantee window (days) — matches all marketing copy. */
export const GUARANTEE_WINDOW_DAYS = 30;

/** Open statuses that block a second refund request for the same firm. */
const OPEN_STATUSES = new Set(["pending", "approved"]);

const REFUND_STATUSES = ["pending", "approved", "denied", "processed", "cancelled"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

// ─── PURE HELPERS (exported for unit tests) ─────────────────────────────────

/**
 * Compute the eligibility label for a refund request from the referenced
 * payment facts. Pure function — no ctx, no db.
 *
 * @param paidAt      ISO timestamp of the payment (reviewedAt || requestedAt)
 * @param interval    billingInterval of the paid request ('annual'|'monthly'|…)
 * @param now         current time (epoch ms) — injected for testability
 */
export function computeRefundEligibility(
  paidAt: string | null | undefined,
  interval: string | null | undefined,
  now: number = Date.now()
): "guarantee" | "discretionary" | "unverified" {
  if (!paidAt) return "unverified";
  const paidMs = new Date(paidAt).getTime();
  if (!Number.isFinite(paidMs)) return "unverified";

  const intervalNorm = String(interval || "").toLowerCase();
  const withinWindow =
    now - paidMs <= GUARANTEE_WINDOW_DAYS * 24 * 60 * 60 * 1000 && now >= paidMs;

  if (intervalNorm === "annual") {
    // Annual plan: the guarantee applies as-of-right inside the window.
    return withinWindow ? "guarantee" : "discretionary";
  }
  if (intervalNorm === "monthly" || intervalNorm === "") {
    // Monthly (or unknown-interval) payments are outside the promise —
    // still refundable at the founder's discretion.
    return "discretionary";
  }
  return withinWindow ? "guarantee" : "discretionary";
}

/** Guard: is this transition allowed? (used by every status-changing mutation) */
export function isValidTransition(from: string, to: string): boolean {
  const edges: Record<string, string[]> = {
    pending: ["approved", "denied", "cancelled"],
    approved: ["processed"],
    denied: [],
    processed: [],
    cancelled: [],
  };
  return (edges[from] || []).includes(to);
}

/** Append a trail entry immutably (trail is the request's audit timeline). */
function appendTrail(
  trail: { status: string; at: string; by: string; note?: string }[] | undefined,
  entry: { status: string; by: string; note?: string }
): { status: string; at: string; by: string; note?: string }[] {
  return [...(trail || []), { at: new Date().toISOString(), ...entry }];
}

// ─── SHARED RESOLUTION ───────────────────────────────────────────────────────

/**
 * Resolve the payment a refund request refers to. Precedence:
 *   1. explicit subscriptionRequestId
 *   2. explicit transactionReference (Paystack reference)
 *   3. the firm's most recent APPROVED subscription request (the payment
 *      most likely being refunded, for self-serve submissions that don't
 *      know their reference)
 * Returns null when nothing matches — eligibility becomes 'unverified'.
 */
async function resolvePaymentContext(
  ctx: any,
  firmId: string,
  subscriptionRequestId?: string | null,
  transactionReference?: string | null
): Promise<any | null> {
  if (subscriptionRequestId) {
    const req = await ctx.db.get(subscriptionRequestId as any);
    if (req && String((req as any).firmId || "") === firmId) return req;
    // Wrong-firm or missing id: fall through to reference/latest lookup.
  }
  if (transactionReference) {
    const req = await ctx.db
      .query("subscriptionRequests")
      .withIndex("by_reference", (q: any) => q.eq("transactionReference", transactionReference))
      .first();
    if (req && String((req as any).firmId || "") === firmId) return req;
  }
  // Latest approved request for the firm.
  const approved = await ctx.db
    .query("subscriptionRequests")
    .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
    .filter((q: any) => q.eq(q.field("status"), "approved"))
    .order("desc")
    .first();
  return approved || null;
}

/** In-app notification to a firm user — never fails the caller. */
async function notifyUser(
  ctx: any,
  firmId: string,
  userId: string | null | undefined,
  title: string,
  message: string,
  type: string
): Promise<void> {
  try {
    await ctx.db.insert("notifications", {
      firmId,
      ...(userId ? { userId } : {}),
      title,
      message,
      type,
      link: { view: "settings", id: "subscription-management", context: {} },
      timestamp: Date.now(),
      isRead: false,
    } as any);
  } catch (e: any) {
    await logError(ctx, {
      scope: "payment",
      name: "refunds:notifyUser",
      error: e,
      severity: "warning",
      firmId,
      context: { title, type },
    });
  }
}

// ─── CUSTOMER-FACING FUNCTIONS ───────────────────────────────────────────────

/**
 * getMyRefundRequests — the requesting firm's refund history (own firm only).
 */
export const getMyRefundRequests = query({
  args: {
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const rows = await ctx.db
      .query("refundRequests")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .order("desc")
      .take(50);
    return rows.map((r: any) => ({
      id: r._id,
      plan: r.plan,
      billingInterval: r.billingInterval,
      amount: r.amount,
      reason: r.reason,
      eligibility: r.eligibility,
      status: r.status,
      statusTrail: r.statusTrail || [],
      transactionReference: r.transactionReference,
      submittedBy: r.submittedBy,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
      processedAt: r.processedAt,
      paystackRefundReference: r.paystackRefundReference,
    }));
  },
});

/**
 * submitRefundRequest — customer (firm user) submission.
 *
 * Guards:
 *   - bearer session (requireFirmUser — portal roles rejected)
 *   - reason: 10–2000 chars after trim
 *   - one OPEN request per firm (pending or approved) — no double-submission
 *   - explicit subscriptionRequestId / transactionReference must belong to
 *     the caller's own firm (silently unmatched ids degrade to the firm's
 *     latest approved payment, eligibility 'unverified' if nothing matches)
 *
 * Side effects: founder push+in-app notification (notifyFounders), in-app
 * receipt notification to the submitter.
 */
export const submitRefundRequest = mutation({
  args: {
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    reason: v.string(),
    subscriptionRequestId: v.optional(v.string()),
    transactionReference: v.optional(v.string()),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { firmId, userId, user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    const reason = String(args.reason || "").trim();
    if (reason.length < 10 || reason.length > 2000) {
      throw new Error("Please describe your refund reason in 10–2000 characters.");
    }

    // One open request per firm.
    const open = await ctx.db
      .query("refundRequests")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .filter((q: any) =>
        q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "approved"))
      )
      .first();
    if (open) {
      throw new Error(
        `Your firm already has an open refund request (status: ${open.status}). ` +
        `It will be reviewed before a new one can be submitted.`
      );
    }

    // Resolve the payment this refund concerns.
    const payment = await resolvePaymentContext(
      ctx, firmId, args.subscriptionRequestId, args.transactionReference
    );
    const paidAt = payment?.reviewedAt || payment?.requestedAt || null;
    const interval = payment?.billingInterval || null;
    const eligibility = computeRefundEligibility(paidAt, interval);

    const now = new Date().toISOString();
    const requestId = await ctx.db.insert("refundRequests", {
      firmId,
      subscriptionRequestId: payment?._id ? String(payment._id) : (args.subscriptionRequestId || null),
      transactionReference: args.transactionReference || payment?.transactionReference || null,
      requestedByUserId: String(userId),
      requestedByEmail: user?.email || args.userEmail || null,
      submittedBy: "customer",
      plan: payment?.requestedPlan || null,
      billingInterval: interval,
      amount:
        typeof args.amount === "number" && args.amount > 0
          ? args.amount
          : payment?.discountedAmount ?? payment?.amount ?? null,
      reason,
      eligibility,
      status: "pending",
      statusTrail: [{ status: "pending", at: now, by: user?.email || "customer", note: "Request submitted" }],
      createdAt: now,
      updatedAt: now,
    } as any);

    // Notify the founders (in-app + push, channel auto-derived).
    try {
      await notifyFounders(ctx, {
        title: "New Refund Request",
        message: `${user?.email || "A firm user"} requested a refund${payment?.requestedPlan ? ` on the ${payment.requestedPlan} plan` : ""}${payment?.discountedAmount || payment?.amount ? ` (₦${Number(payment.discountedAmount ?? payment.amount).toLocaleString("en-NG")})` : ""}. Eligibility: ${eligibility}.`,
        type: "refund_request",
        link: { view: "refunds", id: String(requestId), context: { requestId: String(requestId) } },
      });
    } catch (e: any) {
      await logError(ctx, {
        scope: "payment",
        name: "refunds:submit:notifyFounders",
        error: e,
        severity: "warning",
        firmId,
        context: { requestId: String(requestId) },
      });
    }

    // Receipt notification to the submitter.
    await notifyUser(
      ctx, firmId, String(userId),
      "Refund Request Received",
      "We received your refund request and will review it within 24 hours. You'll be notified here when a decision is made.",
      "refund_status"
    );

    return { success: true, requestId: String(requestId), eligibility };
  },
});

/**
 * cancelMyRefundRequest — the requesting firm withdraws its own pending
 * request. Only 'pending' requests are cancellable (an approved request is
 * already in the money-movement pipeline — contact support instead).
 */
export const cancelMyRefundRequest = mutation({
  args: {
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const { firmId, user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    const request: any = await ctx.db.get(args.requestId as any);
    if (!request) throw new Error("Refund request not found.");
    if (String(request.firmId) !== String(firmId)) {
      throw new Error("Not authorized: this refund request belongs to a different firm.");
    }
    if (request.status !== "pending") {
      throw new Error(`Only pending requests can be withdrawn (current status: ${request.status}).`);
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId as any, {
      status: "cancelled",
      statusTrail: appendTrail(request.statusTrail, {
        status: "cancelled",
        by: user?.email || "customer",
        note: "Withdrawn by the requesting firm",
      }),
      updatedAt: now,
    } as any);

    // Let the founders know the request is moot.
    try {
      await notifyFounders(ctx, {
        title: "Refund Request Withdrawn",
        message: `The refund request from firm ${firmId} was withdrawn by ${user?.email || "the firm"} before a decision was made.`,
        type: "refund_request",
        link: { view: "refunds", id: args.requestId, context: { requestId: args.requestId } },
      });
    } catch (e: any) {
      await logError(ctx, {
        scope: "payment",
        name: "refunds:cancel:notifyFounders",
        error: e,
        severity: "warning",
        firmId,
        context: { requestId: args.requestId },
      });
    }

    return { success: true };
  },
});

// ─── FOUNDER-FACING FUNCTIONS ────────────────────────────────────────────────

/**
 * getRefundRequests — founder approval queue (all firms).
 * Enriched with firm name/product for display. Filter by status, or 'all'.
 */
export const getRefundRequests = query({
  args: {
    tokenIdentifier: v.string(),
    sessionToken: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier, args.sessionToken);
    const status = args.status || "pending";

    const requests =
      status === "all"
        ? await ctx.db.query("refundRequests").order("desc").take(200)
        : await ctx.db
            .query("refundRequests")
            .withIndex("by_status", (q: any) => q.eq("status", status))
            .order("desc")
            .take(200);

    const firmCache = new Map<string, any>();
    const enriched = await Promise.all(
      (requests || []).map(async (r: any) => {
        let firm = firmCache.get(r.firmId);
        if (!firm) {
          try { firm = await ctx.db.get(r.firmId as any); } catch { firm = null; }
          if (firm) firmCache.set(r.firmId, firm);
        }
        return {
          id: r._id,
          firmId: r.firmId,
          firmName: firm?.name || "Unknown Firm",
          firmProduct: firm?.product || "unified",
          firmPlan: firm?.subscriptionPlan || null,
          requestedByEmail: r.requestedByEmail,
          submittedBy: r.submittedBy,
          plan: r.plan,
          billingInterval: r.billingInterval,
          amount: r.amount,
          reason: r.reason,
          eligibility: r.eligibility,
          status: r.status,
          statusTrail: r.statusTrail || [],
          transactionReference: r.transactionReference,
          subscriptionRequestId: r.subscriptionRequestId,
          createdAt: r.createdAt,
          decidedAt: r.decidedAt,
          decidedBy: r.decidedBy,
          processedAt: r.processedAt,
          processedBy: r.processedBy,
          paystackRefundReference: r.paystackRefundReference,
        };
      })
    );
    return enriched;
  },
});

/**
 * getRefundRequestStats — counts + NGN volumes for the founder dashboard
 * and the nav badge.
 */
export const getRefundRequestStats = query({
  args: {
    tokenIdentifier: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.tokenIdentifier, args.sessionToken);

    const all = await ctx.db.query("refundRequests").take(500);
    const stats = {
      pending: 0,
      pendingAmountNaira: 0,
      approved: 0,          // approved but not yet processed — money should move
      denied: 0,
      processed: 0,
      processedAmountNaira: 0,
    };
    for (const r of all) {
      const row = r as any;
      const amount = Number(row.amount || 0);
      if (row.status === "pending") {
        stats.pending++;
        stats.pendingAmountNaira += amount;
      } else if (row.status === "approved") {
        stats.approved++;
      } else if (row.status === "denied") {
        stats.denied++;
      } else if (row.status === "processed") {
        stats.processed++;
        stats.processedAmountNaira += amount;
      }
    }
    return stats;
  },
});

/**
 * createRefundRequestOnBehalf — founder files a request for a firm that
 * asked outside the app (email / WhatsApp / phone). Status starts at
 * 'pending' so the approve step is still an explicit founder decision —
 * filing on behalf does NOT shortcut the pipeline.
 */
export const createRefundRequestOnBehalf = mutation({
  args: {
    tokenIdentifier: v.string(),
    sessionToken: v.optional(v.string()),
    firmId: v.string(),
    reason: v.string(),
    amount: v.optional(v.number()),
    transactionReference: v.optional(v.string()),
    subscriptionRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const founder = await requireFounder(ctx, args.tokenIdentifier, args.sessionToken);

    const reason = String(args.reason || "").trim();
    if (reason.length < 10 || reason.length > 2000) {
      throw new Error("Please record the customer's refund reason in 10–2000 characters.");
    }

    const firm: any = await ctx.db.get(args.firmId as any);
    if (!firm) throw new Error("Firm not found — check the firm id in Organizations.");

    // One open request per firm still applies.
    const open = await ctx.db
      .query("refundRequests")
      .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
      .filter((q: any) =>
        q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "approved"))
      )
      .first();
    if (open) {
      throw new Error(`Firm already has an open refund request (status: ${open.status}).`);
    }

    const payment = await resolvePaymentContext(
      ctx, args.firmId, args.subscriptionRequestId, args.transactionReference
    );
    const paidAt = payment?.reviewedAt || payment?.requestedAt || null;
    const interval = payment?.billingInterval || null;
    const eligibility = computeRefundEligibility(paidAt, interval);

    const now = new Date().toISOString();
    const requestId = await ctx.db.insert("refundRequests", {
      firmId: args.firmId,
      subscriptionRequestId: payment?._id ? String(payment._id) : (args.subscriptionRequestId || null),
      transactionReference: args.transactionReference || payment?.transactionReference || null,
      requestedByUserId: null,
      requestedByEmail: null,
      submittedBy: "founder",
      plan: payment?.requestedPlan || firm?.subscriptionPlan || null,
      billingInterval: interval,
      amount:
        typeof args.amount === "number" && args.amount > 0
          ? args.amount
          : payment?.discountedAmount ?? payment?.amount ?? null,
      reason,
      eligibility,
      status: "pending",
      statusTrail: [{
        status: "pending",
        at: now,
        by: founder.email,
        note: "Filed by the founder on the customer's behalf",
      }],
      createdAt: now,
      updatedAt: now,
    } as any);

    // Transparency: tell the firm a refund request was opened for them.
    await notifyUser(
      ctx, args.firmId, payment?.userId || null,
      "Refund Request Opened",
      "A refund request was opened for your firm by the PracticePro team. We will notify you here once a decision is made.",
      "refund_status"
    );

    return { success: true, requestId: String(requestId), eligibility };
  },
});

/**
 * decideRefundRequest — founder approves or denies a pending request.
 * This is the promise-keeping step: approving a 'guarantee' request
 * commits us to refund an annual payment made within the 30-day window.
 * No money moves here — approval only unlocks markRefundProcessed.
 */
export const decideRefundRequest = mutation({
  args: {
    tokenIdentifier: v.string(),
    sessionToken: v.optional(v.string()),
    requestId: v.string(),
    decision: v.string(),          // 'approved' | 'denied'
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const founder = await requireFounder(ctx, args.tokenIdentifier, args.sessionToken);

    if (args.decision !== "approved" && args.decision !== "denied") {
      throw new Error("Decision must be 'approved' or 'denied'.");
    }

    const request: any = await ctx.db.get(args.requestId as any);
    if (!request) throw new Error("Refund request not found.");
    if (!isValidTransition(String(request.status), args.decision)) {
      throw new Error(`Cannot ${args.decision === "approved" ? "approve" : "deny"} a request with status '${request.status}'.`);
    }

    // GUARANTEE SAFEGUARD: denying a request that is inside the guarantee
    // window requires an explicit note (we promised this money back).
    if (
      args.decision === "denied" &&
      request.eligibility === "guarantee" &&
      !String(args.note || "").trim()
    ) {
      throw new Error(
        "This request is inside the 30-day annual money-back guarantee. " +
        "Denying it requires a note explaining why (e.g. the payment was already refunded by another channel)."
      );
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId as any, {
      status: args.decision,
      decidedBy: founder.email,
      decidedAt: now,
      statusTrail: appendTrail(request.statusTrail, {
        status: args.decision,
        by: founder.email,
        note: String(args.note || "").trim() || undefined,
      }),
      updatedAt: now,
    } as any);

    // Tell the requesting firm.
    const amountStr = request.amount ? ` of ₦${Number(request.amount).toLocaleString("en-NG")}` : "";
    if (args.decision === "approved") {
      await notifyUser(
        ctx, request.firmId, request.requestedByUserId,
        "Refund Approved",
        `Your refund request${amountStr} was approved. Our team will process the refund to your original payment method and notify you when it is done.`,
        "refund_status"
      );
    } else {
      await notifyUser(
        ctx, request.firmId, request.requestedByUserId,
        "Refund Request Declined",
        `Your refund request${amountStr} was declined.${args.note ? ` Reason: ${args.note}` : " Please contact support to discuss."}`,
        "refund_status"
      );
    }

    return { success: true };
  },
});

/**
 * markRefundProcessed — founder confirms the money ACTUALLY moved.
 *
 * The founder executes the refund manually in the Paystack dashboard
 * (Transactions → Refund), then records it here with the Paystack refund
 * reference. If the paystack webhook already auto-completed the request
 * (refund.processed for an approved request), this mutation rejects the
 * stale transition instead of double-writing.
 */
export const markRefundProcessed = mutation({
  args: {
    tokenIdentifier: v.string(),
    sessionToken: v.optional(v.string()),
    requestId: v.string(),
    paystackRefundReference: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const founder = await requireFounder(ctx, args.tokenIdentifier, args.sessionToken);

    const request: any = await ctx.db.get(args.requestId as any);
    if (!request) throw new Error("Refund request not found.");
    if (!isValidTransition(String(request.status), "processed")) {
      const by = request.processedBy === "paystack_webhook"
        ? " — the Paystack webhook already confirmed this refund"
        : "";
      throw new Error(`Cannot mark processed a request with status '${request.status}'${by}.`);
    }

    const refundRef = String(args.paystackRefundReference || "").trim();
    if (!refundRef) {
      throw new Error(
        "Paste the Paystack refund reference (from the Paystack dashboard refund receipt) to confirm the money moved."
      );
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId as any, {
      status: "processed",
      processedBy: founder.email,
      processedAt: now,
      paystackRefundReference: refundRef,
      statusTrail: appendTrail(request.statusTrail, {
        status: "processed",
        by: founder.email,
        note: args.note?.trim() || `Paystack refund reference: ${refundRef}`,
      }),
      updatedAt: now,
    } as any);

    // Final notification to the requesting firm.
    const amountStr = request.amount ? ` of ₦${Number(request.amount).toLocaleString("en-NG")}` : "";
    await notifyUser(
      ctx, request.firmId, request.requestedByUserId,
      "Refund Processed",
      `Your refund${amountStr} has been processed to your original payment method. Depending on your bank, it may take 5–10 business days to appear.`,
      "refund_status"
    );

    return { success: true };
  },
});
