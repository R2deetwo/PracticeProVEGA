/**
 * Paystack Payment Provider — DORMANT
 *
 * This file implements the PaystackPaymentProvider. It is built and
 * code-reviewed now, but is NOT live until:
 *   1. PAYSTACK_ENABLED=true is set in Convex env
 *   2. PAYSTACK_SECRET_KEY is set to a valid Paystack secret key
 *
 * Until then, getActiveProvider() in payments.ts returns 'manual' and
 * this code is never called. This is a deliberate, later, single-flag flip.
 *
 * ACTIVATION CHECKLIST (for when you're ready to go live):
 *   [ ] Set PAYSTACK_ENABLED=true in Convex env
 *   [ ] Set PAYSTACK_SECRET_KEY to your Paystack secret key
 *   [ ] Set PAYSTACK_PUBLIC_KEY to your Paystack public key (for frontend Inline)
 *   [ ] Register the webhook URL in Paystack dashboard: https://your-domain.convex.site/paystack/webhook
 *   [ ] Test with Paystack test keys first
 *   [ ] Verify the trust model fix: client-side no longer auto-flips to Paid
 *
 * PAYSTACK API DOCS:
 *   - Initialize: https://paystack.directory/docs/payments/multilingual-transactions
 *   - Verify: https://paystack.directory/docs/payments/verify-transaction
 *   - Webhooks: https://paystack.directory/docs/webhooks
 */

import { internalAction, httpAction, query, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireFirmUser } from "./authHelpers";
import { randomHex } from "./secureRandom";
// R12: webhook event coverage — refund events notify the founders too.
import { notifyFounders } from "./founderNotifications";

// ─── CHECK IF PAYSTACK IS ACTIVE ───────────────────────────────────────────
// Frontend uses this to decide whether to show "Pay with Card" (Paystack)
// or fall back to bank transfer instructions.

export const isPaystackActive = query({
  args: {},
  handler: async (ctx) => {
    // This only checks if the PUBLIC key is set — the secret key check
    // happens server-side in the actual payment flow. We don't expose
    // the secret key existence to the frontend for security.
    return {
      active: process.env.PAYSTACK_ENABLED === 'true' && !!process.env.PAYSTACK_PUBLIC_KEY,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
    };
  },
});

// ─── INITIATE PAYSTACK PAYMENT (CLIENT-CALLABLE) ───────────────────────────
// This wraps the internal initiatePaystackPayment action so the client
// can call it directly. It authenticates the user and verifies the
// invoice belongs to their firm before initiating payment.
//
// CRO AUDIT FIX (Track B — B6): now persists the providerReference on the
// invoice (via internal.payments.markInvoiceProviderReference) so the webhook
// can actually find the invoice when payment is confirmed. Previously this
// was skipped, breaking the end-to-end Paystack flow.
//
// CRO AUDIT FIX (Track B — B5): replaced `window.location.origin` (which
// throws ReferenceError in Convex's server runtime) with a hard requirement
// on process.env.SITE_URL — throws a clear error if unset.

export const initiateClientPayment = action({
  args: {
    invoiceId: v.string(),
    sessionToken: v.optional(v.string()),
    amount: v.number(),       // in Naira
    email: v.string(),        // customer email
    userEmail: v.optional(v.string()),
    // CRO AUDIT Track B — optional firmId + plan for subscription payments
    // (not just invoice payments). When provided, the webhook will call
    // activateFirmSubscription to flip the firm's tier.
    firmId: v.optional(v.string()),
    plan: v.optional(v.string()),
    billingInterval: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Authenticate the user
    await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey || process.env.PAYSTACK_ENABLED !== 'true') {
      throw new Error("Online card payments are not yet activated. Please use bank transfer.");
    }

    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) {
      // CRO AUDIT FIX (B5): window.location.origin throws in Convex server runtime.
      // Require SITE_URL to be set instead of silently falling back to a broken value.
      throw new Error(
        "SITE_URL environment variable is not configured. " +
        "The PracticePro team must set SITE_URL in Convex env to enable card payments."
      );
    }

    // Generate a unique reference
    // SECURITY: crypto-secure reference (was Math.random — predictable PRNG)
    const reference = `PP-${args.invoiceId}-${Date.now()}-${randomHex(8)}`;

    const amountInKobo = Math.round(args.amount * 100);

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: args.email,
        amount: amountInKobo,
        reference,
        callback_url: `${siteUrl}/billing`,
        metadata: {
          invoiceId: args.invoiceId,
          firmId: args.firmId || null,
          plan: args.plan || null,
          billingInterval: args.billingInterval || null,
          custom_fields: [
            { display_name: "Invoice ID", variable_name: "invoice_id", value: args.invoiceId },
            ...(args.firmId ? [{ display_name: "Firm ID", variable_name: "firm_id", value: args.firmId }] : []),
            ...(args.plan ? [{ display_name: "Plan", variable_name: "plan", value: args.plan }] : []),
          ],
        },
      }),
    });

    const data = await response.json() as any;

    if (!data.status) {
      throw new Error(`Payment initialization failed: ${data.message}`);
    }

    // CRO AUDIT FIX (B6): persist the providerReference so the webhook can
    // find the invoice (and optionally the firm) when payment is confirmed.
    // We use a try/catch because the invoice may not exist yet for
    // subscription upgrades (only for invoice payments).
    try {
      await ctx.runMutation(internal.payments.markInvoiceProviderReference, {
        invoiceId: args.invoiceId,
        provider: 'paystack',
        providerReference: reference,
      });
    } catch (e) {
      // Non-fatal: invoice may not exist for subscription-only flows.
      // The reference is also stored in the subscriptionRequests table
      // (created by createSubscriptionRequest) so the webhook can match.
      console.warn(`[initiateClientPayment] Could not mark invoice reference (may be a subscription-only flow): ${(e as any)?.message}`);
    }

    // If this is a subscription payment (firmId + plan provided), also store
    // the reference on the matching subscriptionRequest so the webhook can
    // find it AND activate the firm subscription.
    if (args.firmId && args.plan) {
      try {
        await ctx.runMutation(internal.payments.markSubscriptionRequestReference, {
          firmId: args.firmId,
          plan: args.plan,
          billingInterval: args.billingInterval || 'annual',
          providerReference: reference,
          amount: args.amount,
        });
      } catch (e) {
        console.warn(`[initiateClientPayment] Could not mark subscription request reference: ${(e as any)?.message}`);
      }
    }

    return {
      reference,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
    };
  },
});

export const initiatePaystackPayment = internalAction({
  args: {
    invoiceId: v.string(),
    firmId: v.string(),
    amount: v.number(),         // in Naira (will be converted to kobo)
    email: v.string(),          // customer email
    reference: v.string(),      // unique transaction reference
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      throw new Error("PAYSTACK_SECRET_KEY is not configured. Paystack is dormant.");
    }

    // Convert Naira to kobo (Paystack requires amounts in kobo)
    const amountInKobo = Math.round(args.amount * 100);

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: args.email,
        amount: amountInKobo,
        reference: args.reference,
        callback_url: `${process.env.SITE_URL || ''}/billing`,
        metadata: {
          invoiceId: args.invoiceId,
          firmId: args.firmId,
          custom_fields: [
            { display_name: "Invoice ID", variable_name: "invoice_id", value: args.invoiceId },
            { display_name: "Firm ID", variable_name: "firm_id", value: args.firmId },
          ],
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      throw new Error(`Paystack initialization failed: ${data.message}`);
    }

    // Update invoice with provider reference
    await ctx.runMutation(internal.payments.markInvoiceProviderReference, {
      invoiceId: args.invoiceId,
      provider: 'paystack',
      providerReference: args.reference,
    });

    return {
      reference: args.reference,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
    };
  },
});

// ─── VERIFY PAYSTACK TRANSACTION ────────────────────────────────────────────

export const verifyPaystackPayment = internalAction({
  args: {
    reference: v.string(),
  },
  handler: async (ctx, args) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      throw new Error("PAYSTACK_SECRET_KEY is not configured. Paystack is dormant.");
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${args.reference}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
      },
    });

    const data = await response.json();

    if (!data.status) {
      return { status: 'failed' as const, reference: args.reference, amount: 0 };
    }

    const tx = data.data;
    return {
      status: tx.status === 'success' ? 'success' as const : tx.status === 'pending' ? 'pending' as const : 'failed' as const,
      amount: tx.amount / 100, // convert kobo back to Naira
      paidAt: tx.paid_at,
      channel: tx.channel,
      reference: args.reference,
    };
  },
});

// ─── PAYSTACK WEBHOOK HANDLER ───────────────────────────────────────────────
// Registered at /paystack/webhook in convex/http.ts
// Verifies the Paystack signature and updates invoice status on confirmed payment.
// This is the ONLY path that should set invoice status to 'Paid' for Paystack
// transactions — NOT the client-side auto-flip.

export async function handlePaystackWebhookImpl(
  ctx: any,
  request: Request
): Promise<Response> {
    // Verify Paystack signature
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return new Response("Paystack not configured", { status: 503 });
    }

    const signature = request.headers.get("x-paystack-signature");
    const body = await request.text();

    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }

    // Verify HMAC-SHA512 signature using Web Crypto API (works in Convex's
    // default runtime without needing "use node" directive)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const data = encoder.encode(body);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);
    // Convert ArrayBuffer to hex string
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== expectedSignature) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);

    // ─── R12: EVENT AUDIT TRAIL (dedupe + record EVERY verified event) ──
    // Before R12 the handler only acted on charge.success and silently
    // discarded everything else — failed charges and refunds left no
    // trace. Now every signature-verified event is recorded (deduped),
    // charge.failed / refund.processed get notifications, and duplicate
    // deliveries short-circuit (webhook redeliveries are common).
    const tx = event.data || {};
    const eventId = `${event.event}:${tx.id ?? tx.reference ?? 'unknown'}`;
    const recordResult = await ctx.runMutation(internal.paystack.recordPaystackEvent, {
      eventId,
      eventType: String(event.event || 'unknown'),
      reference: tx.reference ? String(tx.reference) : undefined,
      amount: typeof tx.amount === 'number' ? tx.amount / 100 : undefined, // kobo → NGN
      status: tx.status ? String(tx.status) : undefined,
      raw: event,
    });
    if (!recordResult.isNew) {
      // Duplicate delivery of an event we already fully processed.
      return new Response(JSON.stringify({ status: "duplicate", eventId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Only charge.success activates payments; every other event type has
    // already been recorded (and failed/refund notifications dispatched)
    // by recordPaystackEvent above.
    if (event.event !== "charge.success") {
      return new Response(JSON.stringify({ status: "recorded" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const reference = tx.reference;

    // Update the invoice — this is the ONLY path that sets Paid for Paystack
    await ctx.runMutation(internal.payments.completePaystackPayment, {
      reference,
      paidAt: tx.paid_at,
      channel: tx.channel,
      amount: tx.amount / 100, // kobo to Naira
    });

    return new Response(JSON.stringify({ status: "success" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

export const handlePaystackWebhook = httpAction(handlePaystackWebhookImpl);

/**
 * R12 — recordPaystackEvent (internal): webhook event audit trail.
 *
 * Called by handlePaystackWebhook for EVERY signature-verified event.
 *   1. Dedupes by eventId (Paystack redelivers; charge.success must never
 *      double-run).
 *   2. Inserts a row into paystackEvents (full raw payload) — the founder
 *      dashboard's audit trail for disputes + reconciliation.
 *   3. charge.failed  → in-app notification to the firm admin (resolved
 *      from the reference's subscriptionRequest when possible).
 *      refund.processed → flags the subscriptionRequest 'refund_review'
 *      (founder decision — never auto-revert a live plan), notifies the
 *      firm admin AND the founders.
 *   4. All other event types are recorded with handled='recorded_only'.
 */
export const recordPaystackEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    reference: v.optional(v.string()),
    amount: v.optional(v.number()),
    status: v.optional(v.string()),
    raw: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("paystackEvents")
      .withIndex("by_eventId", (q: any) => q.eq("eventId", args.eventId))
      .first();
    if (existing) {
      return { isNew: false };
    }

    // Resolve the firm from the reference's subscription request when
    // possible (charge.failed / refund notifications need a recipient).
    let firmId: string | null = null;
    if (args.reference) {
      const subRequest = await ctx.db
        .query("subscriptionRequests")
        .withIndex("by_reference", (q: any) => q.eq("transactionReference", args.reference))
        .first();
      if (subRequest?.firmId) {
        firmId = subRequest.firmId;
      }
    }

    let handled = 'recorded_only';
    const nowIso = new Date().toISOString();

    if (args.eventType === 'charge.failed') {
      handled = 'charge_failed';
      if (firmId) {
        const admin = await ctx.db
          .query("users")
          .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
          .filter((q: any) => q.eq(q.field("role"), "Admin"))
          .first();
        if (admin) {
          await ctx.db.insert("notifications", {
            firmId,
            userId: admin._id,
            title: 'Card Payment Failed',
            message: `A card payment attempt${args.reference ? ` (${args.reference})` : ''} did not go through. No money moved and your plan is unchanged — you can retry the payment from Billing & Plans.`,
            type: 'payment_failed',
            link: { view: 'settings', id: 'subscription-management', context: {} },
            timestamp: nowIso,
            isRead: false,
          } as any);
        }
      }
    } else if (args.eventType === 'refund.processed') {
      handled = 'refund_processed';
      if (firmId) {
        const admin = await ctx.db
          .query("users")
          .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
          .filter((q: any) => q.eq(q.field("role"), "Admin"))
          .first();
        if (admin) {
          await ctx.db.insert("notifications", {
            firmId,
            userId: admin._id,
            title: 'Refund Processed',
            message: `A refund${args.reference ? ` for ${args.reference}` : ''}${args.amount ? ` of ₦${args.amount.toLocaleString('en-NG')}` : ''} was processed. Our team will follow up on any impact to your subscription.`,
            type: 'payment_refund',
            link: { view: 'settings', id: 'subscription-management', context: {} },
            timestamp: nowIso,
            isRead: false,
          } as any);
        }
        // Flag the matching subscription request for founder review —
        // a refund must NEVER auto-revert a live plan (that's a human
        // decision; the flag surfaces it in SubscriptionRequestsCenter).
        if (args.reference) {
          const subRequest = await ctx.db
            .query("subscriptionRequests")
            .withIndex("by_reference", (q: any) => q.eq("transactionReference", args.reference))
            .first();
          if (subRequest) {
            await ctx.db.patch(subRequest._id, {
              status: 'refund_review',
              reviewedAt: nowIso,
              reviewedBy: 'paystack_webhook',
              updatedAt: nowIso,
            } as any);
          }
        }
        await notifyFounders(ctx, {
          title: 'Refund Processed',
          message: `A Paystack refund was processed${args.reference ? ` for ${args.reference}` : ''}${args.amount ? ` (₦${args.amount.toLocaleString('en-NG')})` : ''}${firmId ? ` on firm ${firmId}` : ''}. The subscription request is flagged 'refund_review' — decide whether to adjust the firm's plan.`,
          type: 'payment_refund',
          link: { view: 'admin', id: 'subscription-requests', context: {} },
        });
      }
    } else if (args.eventType === 'charge.success') {
      handled = 'charge_success';
    }

    await ctx.db.insert("paystackEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      reference: args.reference ?? null,
      amount: args.amount ?? null,
      status: args.status ?? null,
      firmId,
      handled,
      raw: args.raw,
      receivedAt: nowIso,
    } as any);

    return { isNew: true, firmId, handled };
  },
});
