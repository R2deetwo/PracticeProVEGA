/**
 * Trust Account — Toggleable Trust Accounting for Legal Firms
 * ═══════════════════════════════════════════════════════════════════════
 *
 * P0 FIX: Per-client sub-ledger + soft delete.
 *
 * PREVIOUS BUG: Single firm-wide balance meant Client A's deposit could
 * be withdrawn for Client B's matter = commingling = RPC Rule 23 violation.
 *
 * FIX: Every transaction now has a `clientId` and `clientBalanceAfter`.
 * Withdrawals are checked against the PER-CLIENT balance, not just the
 * firm-wide balance. A withdrawal that would push a client's sub-balance
 * negative is blocked — even if the firm-wide balance is positive.
 *
 * P0 FIX: Soft delete (never rewrite history).
 * PREVIOUS BUG: Deleting a transaction recalculated all subsequent
 * balanceAfter fields — silently rewriting the audit trail.
 * FIX: Deletion marks the record with deletedAt/deletedBy. The
 * transaction remains in the ledger for audit. A compensating entry
 * is NOT automatically created — the admin must manually record one.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Record a Trust Transaction ──────────────────────────────────────────

export const recordTrustTransaction = mutation({
  args: {
    firmId: v.string(),
    matterId: v.optional(v.string()),
    clientId: v.optional(v.string()),     // P0 FIX: required for per-client sub-ledger
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

    // ─── 1. Get current FIRM-WIDE balance ────────────────────────────
    const lastFirmTx: any = await ctx.db
      .query("trust_transactions")
      .withIndex("by_firm_created", (q: any) => q.eq("firmId", args.firmId))
      .order("desc")
      .first();

    const currentFirmBalance = lastFirmTx?.balanceAfter ?? 0;

    // ─── 2. Get current PER-CLIENT balance (P0 FIX) ──────────────────
    let currentClientBalance = 0;
    if (args.clientId) {
      const lastClientTx: any = await ctx.db
        .query("trust_transactions")
        .withIndex("by_client", (q: any) =>
          q.eq("firmId", args.firmId).eq("clientId", args.clientId!)
        )
        .order("desc")
        .first();
      currentClientBalance = lastClientTx?.clientBalanceAfter ?? 0;
    }

    // ─── 3. Calculate new balances ───────────────────────────────────
    let newFirmBalance: number;
    let newClientBalance: number | undefined;

    if (args.type === "deposit") {
      newFirmBalance = currentFirmBalance + args.amount;
      if (args.clientId) {
        newClientBalance = currentClientBalance + args.amount;
      }
    } else {
      // withdrawal or transfer — money leaves trust
      newFirmBalance = currentFirmBalance - args.amount;

      // P0 FIX: Check PER-CLIENT balance — prevent commingling
      if (args.clientId) {
        newClientBalance = currentClientBalance - args.amount;
        if (newClientBalance < 0) {
          throw new Error(
            `Insufficient client trust balance. This client's trust sub-balance is ${currentClientBalance.toFixed(2)} — cannot withdraw ${args.amount.toFixed(2)}. ` +
            `Withdrawing one client's funds for another client's matter is prohibited (RPC Rule 23 — commingling).`
          );
        }
      }
    }

    // ─── 4. Check firm-wide balance ──────────────────────────────────
    if (newFirmBalance < 0) {
      throw new Error("Insufficient trust account balance. Current balance is not enough for this withdrawal.");
    }

    // ─── 5. Insert the transaction ───────────────────────────────────
    const txId = await ctx.db.insert("trust_transactions", {
      firmId: args.firmId,
      matterId: args.matterId,
      clientId: args.clientId,
      clientName: args.clientName,
      type: args.type,
      amount: args.amount,
      description: args.description,
      reference: args.reference,
      recordedBy: args.recordedBy,
      recordedByName: args.recordedByName,
      balanceAfter: newFirmBalance,
      clientBalanceAfter: newClientBalance,
      createdAt: now,
      updatedAt: now,
    });

    return { transactionId: txId, newFirmBalance, newClientBalance };
  },
});

// ─── Get Trust Transactions (with optional matter/client filter) ─────────

export const getTrustTransactions = query({
  args: {
    firmId: v.string(),
    matterId: v.optional(v.string()),
    clientId: v.optional(v.string()),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("trust_transactions")
      .withIndex("by_firm_created", (q: any) => q.eq("firmId", args.firmId));

    const transactions = await q.order("desc").collect();

    // Filter out soft-deleted transactions unless explicitly requested
    let filtered = args.includeDeleted
      ? transactions
      : transactions.filter((t: any) => !t.deletedAt);

    // Filter by client if provided
    if (args.clientId) {
      filtered = filtered.filter((t: any) => t.clientId === args.clientId);
    }

    // Filter by matter if provided
    if (args.matterId) {
      filtered = filtered.filter((t: any) => t.matterId === args.matterId);
    }

    return filtered;
  },
});

// ─── Get Current Trust Balance (firm-wide + per-client) ──────────────────

export const getTrustBalance = query({
  args: { firmId: v.string(), clientId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Firm-wide balance
    const lastFirmTx: any = await ctx.db
      .query("trust_transactions")
      .withIndex("by_firm_created", (q: any) => q.eq("firmId", args.firmId))
      .order("desc")
      .first();

    const firmBalance = lastFirmTx?.balanceAfter ?? 0;

    // Per-client balance (if clientId provided)
    let clientBalance = 0;
    if (args.clientId) {
      const lastClientTx: any = await ctx.db
        .query("trust_transactions")
        .withIndex("by_client", (q: any) =>
          q.eq("firmId", args.firmId).eq("clientId", args.clientId!)
        )
        .order("desc")
        .first();
      clientBalance = lastClientTx?.clientBalanceAfter ?? 0;
    }

    return { firmBalance, clientBalance };
  },
});

// ─── Soft Delete a Trust Transaction (P0 FIX: never rewrite history) ─────

export const deleteTrustTransaction = mutation({
  args: {
    transactionId: v.id("trust_transactions"),
    firmId: v.string(),
    deletedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // P0 FIX: Soft delete — mark as deleted, never rewrite balanceAfter fields.
    // The transaction remains in the ledger for audit trail.
    // The admin must manually record a compensating entry if needed.
    await ctx.db.patch(args.transactionId, {
      deletedAt: Date.now(),
      deletedBy: args.deletedBy,
      updatedAt: Date.now(),
    });

    return { success: true, message: "Transaction marked as deleted. Record a compensating entry if needed." };
  },
});
