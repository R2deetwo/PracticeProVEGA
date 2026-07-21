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

import { internalAction, httpAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── INITIATE PAYSTACK TRANSACTION ──────────────────────────────────────────

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

export const handlePaystackWebhook = httpAction(async (ctx, request) => {
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

    // Only handle successful charge events
    if (event.event !== "charge.success") {
      return new Response(JSON.stringify({ status: "ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tx = event.data;
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
  });
