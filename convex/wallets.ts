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
import { withCronReporting } from "./observability";

// ─── ROUND A (C1): wallet top-up replay + unauthenticated funding ────────
// Before this round, initiateWalletFunding and verifyWalletFunding were
// PUBLIC actions that trusted caller-supplied tenantId/firmId/propertyId,
// and fundWallet performed no dedup on paystackReference — replaying a
// Paystack reference re-credited the wallet on EVERY call (unbounded free
// credit once Paystack goes live; the reference is visible in the redirect
// URL). Fixed here:
//   1. fundWallet: idempotent on paystackReference (by_paystack_reference
//      index + check-then-insert inside Convex's serializable transaction).
//   2. initiateWalletFunding: portal-caller auth + wallet-owner binding —
//      tenantId/firmId are derived from the SESSION, never from args.
//   3. verifyWalletFunding: the credit identity comes from PAYSTACK
//      METADATA set at initiation (server-side truth), not from args; the
//      caller must be the wallet's own portal user; amount is the
//      Paystack-verified amount, cross-checked against the initiated amount.

/**
 * ROUND A (C1): the wallet-owner key for a portal caller. Wallets may be
 * keyed by the tenant's Convex user _id (the current model) or, on legacy
 * data, by the contact id linked on the user row (`tenantId`) — see the
 * candidate-shape comments in processAutoDeductions. Funding must target
 * the caller's EXISTING wallet when one exists under any of their aliases
 * (otherwise a re-keyed credit would create a second wallet); otherwise a
 * fresh wallet is created keyed by the caller's _id (the current model).
 */
async function resolveWalletOwnerKey(ctx: any, caller: any): Promise<string> {
  const candidates = Array.from(new Set(
    [String(caller._id), (caller as any).tenantId, String(caller.email || "").toLowerCase()]
      .filter((c): c is string => typeof c === "string" && c.length > 0)
  ));
  for (const c of candidates) {
    const existing = await ctx.db
      .query("resident_wallets")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", c))
      .first();
    if (existing) return String(existing.tenantId); // fund the wallet that already exists
  }
  return String(caller._id); // no wallet yet — create keyed by the user _id (current model)
}

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
  handler: async (ctx, args): Promise<{ success: boolean; newBalance?: number; reference?: string; alreadyCredited?: boolean }> => {
    // ── ROUND A (C1): idempotency guard — a Paystack reference must credit
    //    exactly once, ever. Replaying verifyWalletFunding with the same
    //    reference (the reference is public in the redirect URL) now finds
    //    the existing credit row and returns a no-op success with the
    //    already-recorded balance. The lookup rides the
    //    wallet_transactions.by_paystack_reference index (schema.ts), and
    //    Convex's serializable transactions make check-then-insert atomic
    //    under concurrency (a racing replay retries, re-reads, and no-ops).
    if (args.paystackReference) {
      const alreadyCredited = await ctx.db
        .query("wallet_transactions")
        .withIndex("by_paystack_reference", (q: any) => q.eq("paystackReference", args.paystackReference))
        .first();
      if (alreadyCredited) {
        console.log(`[wallets] Duplicate Paystack reference ${args.paystackReference} — already credited, no-op (ROUND A C1)`);
        return {
          success: true,
          alreadyCredited: true,
          newBalance: (alreadyCredited as any).newBalance,
          reference: (alreadyCredited as any).reference,
        };
      }
    }

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
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ reference: string; authorizationUrl: string; accessCode: string }> => {
    // ── ROUND A (C1): portal-caller auth + server-side identity binding.
    //    Previously this action was PUBLIC: any caller could start a funding
    //    session for any tenantId/firmId, and those caller-supplied values
    //    flowed into the Paystack metadata that verifyWalletFunding later
    //    trusted. Now the wallet owner is derived from the SESSION: the
    //    wallet targeted is the caller's own (existing wallet under any of
    //    their alias keys, else keyed by their _id), the firm is the
    //    caller's own firm, and the Paystack receipt email is the caller's
    //    own email. The args are kept for call-site compatibility but are
    //    NOT trusted for identity.
    const caller = await requirePortalCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    if (!caller.firmId) {
      throw new Error("Your account is not linked to a firm yet — please contact your property manager.");
    }
    const boundTenantId = await resolveWalletOwnerKey(ctx, caller);
    const boundFirmId = String(caller.firmId);
    const boundEmail = String((caller as any).email || args.email || "").toLowerCase();

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey || process.env.PAYSTACK_ENABLED !== 'true') {
      throw new Error("Online card payments are not yet activated. Please contact your property manager to fund your wallet manually.");
    }
    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) throw new Error("SITE_URL is not configured.");

    // SECURITY: crypto-secure reference (was Math.random — predictable PRNG)
    const reference = `WALLET-${boundTenantId.slice(0, 8)}-${Date.now()}-${randomHex(8)}`;
    const amountInKobo = Math.round(args.amount * 100);

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: boundEmail, amount: amountInKobo, reference,
        callback_url: `${siteUrl}/portal/tenant?wallet_funded=${reference}`,
        // The metadata is the server-side truth verifyWalletFunding binds
        // the credit to (ROUND A C1): tenant/firm/property + the initiated
        // amount, all session-derived. propertyId stays caller-supplied —
        // it only selects which wallet row is created/updated (the wallet
        // lookup itself is keyed by tenantId, never by propertyId), so it
        // cannot redirect the credit to another resident's wallet.
        metadata: { type: "wallet_funding", tenantId: boundTenantId, firmId: boundFirmId, propertyId: args.propertyId, amount: args.amount },
      }),
    });
    const data = await response.json() as any;
    if (!data.status) throw new Error(`Payment initialization failed: ${data.message}`);
    return { reference, authorizationUrl: data.data.authorization_url, accessCode: data.data.access_code };
  },
});

// ─── Paystack: verify wallet funding ───────────────────────────────────────

export const verifyWalletFunding = action({
  args: { reference: v.string(), tenantId: v.string(), firmId: v.string(), propertyId: v.string(), sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ success: boolean; newBalance?: number; alreadyCredited?: boolean; error?: string }> => {
    // ── ROUND A (C1): portal-caller auth + Paystack-metadata binding.
    //    The credit identity no longer comes from args (previously any
    //    caller could credit ANY wallet by replaying a reference with
    //    their own tenantId/firmId). Now: (1) the caller must be a portal
    //    user; (2) the credit targets the tenant/firm/property recorded in
    //    the PAYSTACK METADATA at initiation (server-side truth — the
    //    metadata was written by initiateWalletFunding from the session);
    //    (3) the metadata tenantId must be one of the caller's own alias
    //    keys (only the wallet's owner can complete their funding);
    //    (4) the credited amount is the Paystack-verified amount and must
    //    match the amount initiated for this reference; (5) fundWallet
    //    dedups on the reference, so replays no-op.
    const caller = await requirePortalCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });

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

    // Bind the credit to the initiation-time metadata (server-side truth).
    const metadata = (data.data.metadata || {}) as any;
    if (String(metadata.type || "") !== "wallet_funding") {
      return { success: false, error: "This transaction was not initiated as a wallet top-up. Refusing to credit." };
    }
    const metaTenantId = String(metadata.tenantId || "");
    const metaFirmId = String(metadata.firmId || "");
    const metaPropertyId = String(metadata.propertyId || "");
    const metaAmount = Number(metadata.amount);
    if (!metaTenantId || !metaFirmId || !metaPropertyId) {
      return { success: false, error: "Wallet funding metadata is incomplete for this reference. Refusing to credit." };
    }
    // Only the wallet's own owner may complete the funding: the metadata
    // tenantId must be one of the caller's alias keys (user _id, legacy
    // contact id, or email — same acceptance set as the existing
    // getMyWallet/toggleAutoDeduct retrofits).
    const callerAliases = new Set([
      String(caller._id),
      String((caller as any).tenantId || ""),
      String((caller as any).email || "").toLowerCase(),
    ].filter(Boolean));
    if (!callerAliases.has(metaTenantId)) {
      return { success: false, error: "Not authorized: this wallet top-up belongs to a different resident." };
    }

    const amountInNaira = data.data.amount / 100;
    // Amount cross-check: the Paystack charge must match what was initiated
    // for this reference (guard against a tampered/mismatched transaction
    // being applied to a wallet).
    if (Number.isFinite(metaAmount) && Math.abs(metaAmount - amountInNaira) > 0.01) {
      return { success: false, error: `Amount mismatch: Paystack charged ₦${amountInNaira} but this reference was initiated for ₦${metaAmount}. Refusing to credit.` };
    }

    const result = await ctx.runMutation(internal.wallets.fundWallet, {
      tenantId: metaTenantId, firmId: metaFirmId, propertyId: metaPropertyId,
      amount: amountInNaira, paystackReference: args.reference,
    });
    return {
      success: result.success,
      newBalance: result.newBalance,
      alreadyCredited: (result as any).alreadyCredited,
      error: result.success ? undefined : 'Failed to credit wallet',
    };
  },
});

// ─── Billing Cron: Auto-Deduct Due Charges ───────────────────────────────

export const processAutoDeductions = internalMutation({
  args: {},
  handler: withCronReporting("crons:walletAutoDeduct", async (ctx): Promise<{ chargesScanned: number; deductionsMade: number; insufficientFunds: number; autoDeductDisabled: number }> => {
    const now = Date.now();
    let chargesScanned = 0, deductionsMade = 0, insufficientFunds = 0, autoDeductDisabled = 0;

    // Phase 4 (perf): range seek via service_charges.by_next_due — only
    // charges with nextDueDate <= now are read, instead of the whole table.
    const dueWindowCharges = await ctx.db
      .query("service_charges")
      .withIndex("by_next_due", (q: any) => q.lte("nextDueDate", now))
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
  },),
});
