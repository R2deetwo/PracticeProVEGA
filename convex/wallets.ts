/**
 * Resident Wallet Engine — Prepaid Balance for Auto-Deducting Monthly Charges
 * ============================================================================
 * Each RESIDENT has ONE wallet tied to their property. They preload it with
 * funds via Paystack/card, and the system auto-deducts from it when their
 * service charge, electricity minimum vend, or custom charge is due.
 */

import { internalMutation, mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { randomHex } from "./secureRandom";
import { createUnitResolver } from "./unitLookup";
import { requirePortalCaller } from "./callerAuth";

// Round 8 auth retrofit: fundWalletPublic (a PUBLIC mutation that credited
// ANY wallet by an arbitrary amount with NO Paystack verification) was
// DELETED — its only verified path is initiateWalletFunding →
// verifyWalletFunding, which credits only after Paystack confirms the
// transaction server-side. The tenant self-service endpoints below now
// verify the caller is the wallet's own portal user.

const DEFAULT_LOW_BALANCE_THRESHOLD = 1000;

function formatNGN(amount: number): string {
  return Math.round(amount).toLocaleString("en-NG");
}

function generateTransactionReference(): string {
  // SECURITY: crypto-secure (was Math.random — predictable PRNG)
  const rand = randomHex(6).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  return `TXN-${ts}${rand}`;
}

// ─── Internal: get or create wallet ────────────────────────────────────────

export const getOrCreateWallet = internalMutation({
  args: {
    tenantId: v.string(),
    sessionToken: v.optional(v.string()),
    firmId: v.string(),
    propertyId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("resident_wallets")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .first();
    if (existing) return existing;

    const now = Date.now();
    const walletId = await ctx.db.insert("resident_wallets", {
      tenantId: args.tenantId,
      firmId: args.firmId,
      propertyId: args.propertyId,
      balance: 0,
      currency: "NGN",
      autoDeductEnabled: false,
      status: "active",
      lowBalanceThreshold: DEFAULT_LOW_BALANCE_THRESHOLD,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(walletId);
  },
});

// ─── Public: resident gets their wallet + recent transactions ─────────────

export const getMyWallet = query({
  args: { sessionToken: v.optional(v.string()), tenantId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: tenantId was the ONLY scoping — any caller
    // could read any resident's balance and transactions. Verify the
    // caller is the wallet's own portal user.
    const caller = await requirePortalCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    const wallet = await ctx.db
      .query("resident_wallets")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .first();
    if (!wallet) return null;
    // Cross-tenant read protection: wallet keys can be user ids or legacy
    // contact ids; when the key is a user id it must be the caller's own.
    if (String(wallet.tenantId) !== String(caller._id) &&
        String(wallet.tenantId) !== String((caller as any).tenantId || "")) {
      throw new Error("Not authorized: this wallet belongs to a different resident.");
    }

    const recentTransactions = await ctx.db
      .query("wallet_transactions")
      .withIndex("by_wallet", (q: any) => q.eq("walletId", wallet._id))
      .order("desc")
      .take(20);

    return { wallet, recentTransactions };
  },
});

// ─── Public: toggle auto-deduct ───────────────────────────────────────────

export const toggleAutoDeduct = mutation({
  args: { sessionToken: v.optional(v.string()), tenantId: v.string(), enabled: v.boolean(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: tenantId was caller-supplied — anyone could
    // toggle any resident's auto-deduct (stopping their charge coverage).
    const caller = await requirePortalCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    const wallet = await ctx.db
      .query("resident_wallets")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .first();
    if (!wallet) throw new Error("Wallet not found");
    if (String(wallet.tenantId) !== String(caller._id) &&
        String(wallet.tenantId) !== String((caller as any).tenantId || "")) {
      throw new Error("Not authorized: this wallet belongs to a different resident.");
    }
    await ctx.db.patch(wallet._id, { autoDeductEnabled: args.enabled, updatedAt: Date.now() });
    return { success: true, autoDeductEnabled: args.enabled };
  },
});

// ─── Internal: fund wallet ────────────────────────────────────────────────

export const fundWallet = internalMutation({
  args: {
    tenantId: v.string(),
    firmId: v.string(),
    propertyId: v.string(),
    amount: v.number(),
    paystackReference: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; newBalance?: number; reference?: string }> => {
    const wallet = await ctx.runMutation(internal.wallets.getOrCreateWallet, {
      tenantId: args.tenantId, firmId: args.firmId, propertyId: args.propertyId,
    });
    if (!wallet) return { success: false };

    const previousBalance = wallet.balance;
    const newBalance = previousBalance + args.amount;
    const reference = generateTransactionReference();
    const newStatus = newBalance >= (wallet.lowBalanceThreshold ?? DEFAULT_LOW_BALANCE_THRESHOLD) ? "active" : "low_balance";

    await ctx.db.patch(wallet._id, { balance: newBalance, status: newStatus, updatedAt: Date.now() });

    await ctx.db.insert("wallet_transactions", {
      walletId: wallet._id, tenantId: args.tenantId, firmId: args.firmId,
      type: "credit", amount: args.amount, previousBalance, newBalance,
      currency: wallet.currency,
      reason: args.paystackReference ? `Wallet top-up via Paystack (${args.paystackReference})` : "Manual wallet top-up",
      reference, paystackReference: args.paystackReference, timestamp: Date.now(),
    });

    return { success: true, newBalance, reference };
  },
});

// ─── Public: fund wallet (frontend wrapper) ───────────────────────────────

// Round 8 auth retrofit: fundWalletPublic was DELETED. It was a PUBLIC
// mutation that credited ANY wallet by an arbitrary amount with NO Paystack
// verification — an unauthenticated money-writing primitive. The verified
// path (initiateWalletFunding -> Paystack -> verifyWalletFunding, which
// credits only after server-side transaction verification) is the ONLY
// funding route now. The internal fundWallet remains for that path.


// ─── Paystack: initiate wallet funding ────────────────────────────────────

export const initiateWalletFunding = action({
  args: {
    tenantId: v.string(), firmId: v.string(), propertyId: v.string(),
    amount: v.number(), email: v.string(),
  },
  handler: async (ctx, args): Promise<{ reference: string; authorizationUrl: string; accessCode: string }> => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey || process.env.PAYSTACK_ENABLED !== 'true') {
      throw new Error("Online card payments are not yet activated. Please contact your property manager to fund your wallet manually.");
    }
    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) throw new Error("SITE_URL is not configured.");

    // SECURITY: crypto-secure reference (was Math.random — predictable PRNG)
    const reference = `WALLET-${args.tenantId.slice(0, 8)}-${Date.now()}-${randomHex(8)}`;
    const amountInKobo = Math.round(args.amount * 100);

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: args.email, amount: amountInKobo, reference,
        callback_url: `${siteUrl}/portal/tenant?wallet_funded=${reference}`,
        metadata: { type: "wallet_funding", tenantId: args.tenantId, firmId: args.firmId, propertyId: args.propertyId, amount: args.amount },
      }),
    });
    const data = await response.json() as any;
    if (!data.status) throw new Error(`Payment initialization failed: ${data.message}`);
    return { reference, authorizationUrl: data.data.authorization_url, accessCode: data.data.access_code };
  },
});

// ─── Paystack: verify wallet funding ───────────────────────────────────────

export const verifyWalletFunding = action({
  args: { reference: v.string(), tenantId: v.string(), firmId: v.string(), propertyId: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean; newBalance?: number; error?: string }> => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return { success: false, error: "Paystack is not configured" };

    const response = await fetch(`https://api.paystack.co/transaction/verify/${args.reference}`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
    });
    const data = await response.json() as any;
    if (!data.status || data.data.status !== 'success') {
      return { success: false, error: `Payment not successful: ${data.data?.status || 'unknown'}` };
    }

    const amountInNaira = data.data.amount / 100;
    const result = await ctx.runMutation(internal.wallets.fundWallet, {
      tenantId: args.tenantId, firmId: args.firmId, propertyId: args.propertyId,
      amount: amountInNaira, paystackReference: args.reference,
    });
    return { success: result.success, newBalance: result.newBalance, error: result.success ? undefined : 'Failed to credit wallet' };
  },
});

// ─── Billing Cron: Auto-Deduct Due Charges ───────────────────────────────

export const processAutoDeductions = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ chargesScanned: number; deductionsMade: number; insufficientFunds: number; autoDeductDisabled: number }> => {
    const now = Date.now();
    let chargesScanned = 0, deductionsMade = 0, insufficientFunds = 0, autoDeductDisabled = 0;

    // Phase 4 (perf): range seek via service_charges.by_next_due — only
    // charges with nextDueDate <= now are read, instead of the whole table.
    const dueWindowCharges = await ctx.db
      .query("service_charges")
      .withIndex("by_next_due", (q) => q.lte("nextDueDate", now))
      .collect();
    const dueCharges = dueWindowCharges.filter((sc: any) =>
      sc.serviceChargeStatus !== "PAID_FULLY" && !sc.remindersMuted && !sc.remindersPaused
    );
    chargesScanned = dueCharges.length;

    // ROUND 6: shared unit resolver (convex/unitLookup.ts). The old
    // `ctx.db.get(sc.unitId)` only resolved standalone-property Convex ids —
    // embedded units (composite `propId_unitId` keys) were silently skipped,
    // so their wallets were NEVER auto-deducted. The resolver handles all
    // four unitId shapes and is memoized per firm.
    const resolvers = new Map<string, ReturnType<typeof createUnitResolver>>();
    const getResolver = (firmId: string) => {
      let r = resolvers.get(firmId);
      if (!r) {
        r = createUnitResolver(ctx, firmId);
        resolvers.set(firmId, r);
      }
      return r;
    };

    for (const sc of dueCharges) {
      const ref = await getResolver(sc.firmId).resolveUnit(sc.unitId);
      if (!ref) continue; // unit no longer exists (or cross-firm) — nothing to deduct from
      const tenant = await getResolver(sc.firmId).tenantFor(ref);

      // Wallet lookup by candidate ids — wallets are keyed by the tenant's
      // Convex user _id (portal currentUser.id), but legacy data may key on
      // a raw contact id or the email. Try each candidate shape once.
      const candidates = Array.from(new Set(
        [sc.tenantId, tenant.userConvexId, tenant.email?.toLowerCase(), tenant.rawTenantId]
          .filter((c): c is string => typeof c === "string" && c.length > 0)
      ));
      if (candidates.length === 0) continue; // unlinked charge — backfill/migration handles it

      let wallet: any = null;
      for (const c of candidates) {
        wallet = await ctx.db
          .query("resident_wallets")
          .withIndex("by_tenant", (q: any) => q.eq("tenantId", c))
          .first();
        if (wallet) break;
      }
      if (!wallet || !wallet.autoDeductEnabled) { autoDeductDisabled++; continue; }
      const tenantId = wallet.tenantId; // canonical id for this wallet's transaction rows

      const amount = sc.outstandingBalance ?? sc.amount;

      if (wallet.balance < amount) {
        const reference = generateTransactionReference();
        await ctx.db.insert("wallet_transactions", {
          walletId: wallet._id, tenantId, firmId: sc.firmId,
          type: "insufficient_funds", amount, previousBalance: wallet.balance, newBalance: wallet.balance,
          currency: wallet.currency,
          reason: `Insufficient funds for auto-deduct: ${sc.isMinimumVend ? "Electricity" : "Service Charge"} (${sc.category}). Needed ₦${formatNGN(amount)}, had ₦${formatNGN(wallet.balance)}.`,
          reference, chargeType: sc.isMinimumVend ? "electricity" : "service_charge", chargeId: sc._id, timestamp: now,
        });
        if (wallet.status !== "low_balance") await ctx.db.patch(wallet._id, { status: "low_balance", updatedAt: now });
        insufficientFunds++;
        continue;
      }

      const previousBalance = wallet.balance;
      const newBalance = previousBalance - amount;
      const reference = generateTransactionReference();
      const newWalletStatus = newBalance < (wallet.lowBalanceThreshold ?? DEFAULT_LOW_BALANCE_THRESHOLD) ? "low_balance" : "active";

      await ctx.db.patch(wallet._id, { balance: newBalance, status: newWalletStatus, updatedAt: now });
      await ctx.db.insert("wallet_transactions", {
        walletId: wallet._id, tenantId, firmId: sc.firmId,
        type: "debit", amount, previousBalance, newBalance, currency: wallet.currency,
        reason: `Auto-deduct: ${sc.isMinimumVend ? "Electricity / Minimum Vend" : "Service Charge"} (${sc.category}) — ${new Date(now).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`,
        reference, chargeType: sc.isMinimumVend ? "electricity" : "service_charge", chargeId: sc._id, timestamp: now,
      });

      const cycleMs = sc.cycle === "Monthly" ? 30 * 86400000 : sc.cycle === "Quarterly" ? 90 * 86400000 : 365 * 86400000;
      await ctx.db.patch(sc._id, {
        serviceChargeStatus: "PAID_FULLY", outstandingBalance: 0, amountPaidThisCycle: amount,
        lastPaidDate: now, nextDueDate: now + cycleMs, isDefaulter: false, daysOverdue: 0,
        penaltyApplied: false, consecutiveReminderCount: 0, lastReminderSentAt: undefined, remindersPaused: false,
      });
      deductionsMade++;
    }

    console.log(`[wallets] Auto-deduct: ${chargesScanned} due, ${deductionsMade} deducted, ${insufficientFunds} insufficient, ${autoDeductDisabled} disabled`);
    return { chargesScanned, deductionsMade, insufficientFunds, autoDeductDisabled };
  },
});
