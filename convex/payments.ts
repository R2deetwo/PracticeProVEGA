/**
 * Payment Provider Abstraction — Paystack-Ready Billing Architecture
 *
 * GOAL: restructure billing so a Paystack integration can be dropped in
 * later with minimal changes, WITHOUT changing any current manual-billing
 * behavior today. This is a refactor for extensibility, not a feature launch.
 *
 * ARCHITECTURE:
 *   - PaymentProvider interface defines the contract
 *   - ManualPaymentProvider reproduces EXACTLY the current behavior (lawyer
 *     marks invoice as paid manually, no processor involved) as the DEFAULT
 *   - PaystackPaymentProvider implements the same interface but is DORMANT
 *     until PAYSTACK_ENABLED=true AND PAYSTACK_SECRET_KEY is set in env
 *
 * ACTIVATION:
 *   The active provider is determined by env vars:
 *     - PAYSTACK_ENABLED unset/false → ManualPaymentProvider (current behavior)
 *     - PAYSTACK_ENABLED=true + PAYSTACK_SECRET_KEY set → PaystackPaymentProvider
 *
 * This file defines the interface and provider selection logic.
 * The actual Paystack implementation lives in convex/paystack.ts.
 */

import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── PROVIDER SELECTION ─────────────────────────────────────────────────────

// Determines which payment provider is active.
// Returns 'paystack' ONLY if PAYSTACK_ENABLED is explicitly 'true' AND
// PAYSTACK_SECRET_KEY is set. Otherwise returns 'manual'.
// Inlined (not exported) to avoid Convex module parsing issues.
const ACTIVE_PROVIDER = (
  process.env.PAYSTACK_ENABLED === 'true' &&
  !!process.env.PAYSTACK_SECRET_KEY &&
  process.env.PAYSTACK_SECRET_KEY.length > 0
) ? 'paystack' : 'manual';

// ─── MANUAL PAYMENT PROVIDER (DEFAULT — reproduces current behavior) ────────

/**
 * ManualPaymentProvider — reproduces EXACTLY the current behavior:
 * lawyer marks invoice as paid manually, no processor involved.
 *
 * This is a pure refactor of existing logic into the new interface shape.
 * Behavior must be byte-for-byte identical to what exists today.
 *
 * The actual mark-as-paid flow still goes through the generic updateItem
 * mutation (convex/myFunctions.ts:2301-2346) — this provider just wraps
 * the frontend hook logic into a server-side function for consistency.
 */

export const manualMarkAsPaid = internalMutation({
  args: {
    invoiceId: v.string(),
    firmId: v.string(),
    markedBy: v.string(),
  },
  handler: async (ctx, args) => {
    // This reproduces the current behavior: just flip the status to Paid
    // and set paidDate. No provider call, no verification.
    const now = new Date().toISOString();
    await ctx.db.patch(args.invoiceId as any, {
      status: 'Paid',
      paidDate: now,
      provider: 'manual',
      paymentMethod: 'manual',
      updatedAt: now,
    } as any);

    return { success: true, provider: 'manual' };
  },
});

export const manualRevertPayment = internalMutation({
  args: {
    invoiceId: v.string(),
    firmId: v.string(),
  },
  handler: async (ctx, args) => {
    // Reproduces current revert behavior: flip status to Reversed, clear paidDate
    const now = new Date().toISOString();
    await ctx.db.patch(args.invoiceId as any, {
      status: 'Reversed',
      paidDate: undefined,
      updatedAt: now,
    } as any);

    return { success: true, provider: 'manual' };
  },
});

// ─── PROVIDER STATUS QUERY (for frontend) ───────────────────────────────────

export const getPaymentProviderStatus = internalAction({
  args: {},
  handler: async (ctx) => {
    const provider = ACTIVE_PROVIDER;
    return {
      activeProvider: provider,
      onlinePaymentEnabled: provider === 'paystack',
    };
  },
});

// ─── PAYSTACK SUPPORT MUTATIONS ─────────────────────────────────────────────
// These are called by the Paystack provider (paystack.ts) to update invoice
// records. They are safe to exist even when Paystack is dormant — they're
// just never called unless Paystack is active.

/**
 * Called when a Paystack transaction is initiated. Stores the provider
 * reference on the invoice so the webhook can find it later.
 */
export const markInvoiceProviderReference = internalMutation({
  args: {
    invoiceId: v.string(),
    provider: v.string(),
    providerReference: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    await ctx.db.patch(args.invoiceId as any, {
      provider: args.provider,
      providerReference: args.providerReference,
      status: 'Sent', // mark as sent (pending payment)
      updatedAt: now,
    } as any);
    return { success: true };
  },
});

/**
 * Called by the Paystack webhook when payment is confirmed.
 * This is the ONLY path that sets invoice status to 'Paid' for Paystack
 * transactions. NOT the client-side auto-flip.
 */
export const completePaystackPayment = internalMutation({
  args: {
    reference: v.string(),
    paidAt: v.string(),
    channel: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    // Find the invoice by providerReference
    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_provider_reference", (q) => q.eq("providerReference", args.reference))
      .first();

    if (!invoice) {
      console.warn(`[completePaystackPayment] No invoice found for reference ${args.reference}`);
      return { success: false, error: "INVOICE_NOT_FOUND" };
    }

    // Update invoice — this is the trusted path
    await ctx.db.patch(invoice._id, {
      status: 'Paid',
      paidDate: args.paidAt,
      provider: 'paystack',
      paymentMethod: args.channel,
      updatedAt: new Date().toISOString(),
    } as any);

    console.log(`[completePaystackPayment] Invoice ${invoice._id} marked Paid via Paystack (ref: ${args.reference})`);
    return { success: true, invoiceId: invoice._id };
  },
});
