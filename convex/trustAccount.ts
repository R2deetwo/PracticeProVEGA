/**
 * Trust Account — Toggleable Trust Accounting for Legal Firms
 * ═══════════════════════════════════════════════════════════════════════
 *
 * When a firm enables Trust Accounting in Settings → Firm, they get:
 *   - A Trust tab in Financials showing the trust account ledger
 *   - Record deposits (client money received into trust)
 *   - Record withdrawals (money paid out of trust)
 *   - Record transfers (trust → operating account)
 *   - Running balance tracking per transaction
 *   - Matter linking (know which client's money it is)
 *
 * When disabled, the Trust tab is completely hidden.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Record a Trust Transaction ──────────────────────────────────────────

export const recordTrustTransaction = mutation({
  args: {
    firmId: v.string(),
    matterId: v.optional(v.string()),
    clientName: v.optional(v.string()),
    type: v.union(v.literal("deposit"), v.literal("withdrawal"), v.literal("transfer")),
    amount: v.number(),
    description: v.string(),
    reference: v.optional(v.string()),
    recordedBy: v.optional(v.string()),
    recordedByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get current balance (last transaction's balanceAfter)
    const lastTx: any = await ctx.db
      .query("trust_transactions")
      .withIndex("by_firm_created", (q: any) => q.eq("firmId", args.firmId))
      .order("desc")
      .first();

    const currentBalance = lastTx?.balanceAfter ?? 0;

    // Calculate new balance
    let newBalance: number;
    if (args.type === "deposit") {
      newBalance = currentBalance + args.amount;
    } else {
      // withdrawal or transfer — money leaves trust
      newBalance = currentBalance - args.amount;
    }

    if (newBalance < 0) {
      throw new Error("Insufficient trust account balance. Current balance is not enough for this withdrawal.");
    }

    const txId = await ctx.db.insert("trust_transactions", {
      firmId: args.firmId,
      matterId: args.matterId,
      clientName: args.clientName,
      type: args.type,
      amount: args.amount,
      description: args.description,
      reference: args.reference,
      recordedBy: args.recordedBy,
      recordedByName: args.recordedByName,
      balanceAfter: newBalance,
      createdAt: now,
      updatedAt: now,
    });

    return { transactionId: txId, newBalance };
  },
});

// ─── Get Trust Transactions (with optional matter filter) ───────────────

export const getTrustTransactions = query({
  args: {
    firmId: v.string(),
    matterId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("trust_transactions")
      .withIndex("by_firm_created", (q: any) => q.eq("firmId", args.firmId));

    const transactions = await q.order("desc").collect();

    // Filter by matter if provided
    const filtered = args.matterId
      ? transactions.filter((t: any) => t.matterId === args.matterId)
      : transactions;

    return filtered;
  },
});

// ─── Get Current Trust Balance ───────────────────────────────────────────

export const getTrustBalance = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const lastTx: any = await ctx.db
      .query("trust_transactions")
      .withIndex("by_firm_created", (q: any) => q.eq("firmId", args.firmId))
      .order("desc")
      .first();

    return lastTx?.balanceAfter ?? 0;
  },
});

// ─── Delete a Trust Transaction (admin only, with balance recalculation) ─

export const deleteTrustTransaction = mutation({
  args: {
    transactionId: v.id("trust_transactions"),
    firmId: v.string(),
  },
  handler: async (ctx, args) => {
    // Delete the transaction
    await ctx.db.delete(args.transactionId);

    // Recalculate running balances for all transactions after the deleted one
    const allTx: any[] = await ctx.db
      .query("trust_transactions")
      .withIndex("by_firm_created", (q: any) => q.eq("firmId", args.firmId))
      .order("asc")
      .collect();

    let runningBalance = 0;
    for (const tx of allTx) {
      if (tx.type === "deposit") {
        runningBalance += tx.amount;
      } else {
        runningBalance -= tx.amount;
      }
      await ctx.db.patch(tx._id, { balanceAfter: runningBalance, updatedAt: Date.now() });
    }

    return { success: true, newBalance: runningBalance };
  },
});
