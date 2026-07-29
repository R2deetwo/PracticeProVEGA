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
 *
 * AUDIT FIX (C2 — Trust Account Commingling):
 * Previously, the trust account used a single firm-wide running balance.
 * This meant Client A's deposit could be withdrawn for Client B's matter —
 * a commingling violation under RPC Rule 23.
 *
 * Now, each transaction is linked to a matterId/clientName, and the balance
 * is tracked PER MATTER. A withdrawal for Matter X cannot exceed the
 * balance held for Matter X. The firm-wide total is the sum of all
 * matter balances.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser, requireAdmin } from "./authHelpers";

// ─── Helper: Compute balance for a specific matter ───────────────────────

async function getMatterBalance(ctx: any, firmId: string, matterId: string): Promise<number> {
  const txs: any[] = await ctx.db
    .query("trust_transactions")
    .withIndex("by_firm_created", (q: any) => q.eq("firmId", firmId))
    .filter((q: any) => q.eq(q.field("matterId"), matterId))
    .collect();

  let balance = 0;
  for (const tx of txs) {
    if (tx.type === "deposit") {
      balance += tx.amount;
    } else {
      balance -= tx.amount;
    }
  }
  return balance;
}

// ─── Helper: Compute balance for a specific client (by name) ─────────────

async function getClientBalance(ctx: any, firmId: string, clientName: string): Promise<number> {
  const txs: any[] = await ctx.db
    .query("trust_transactions")
    .withIndex("by_firm_created", (q: any) => q.eq("firmId", firmId))
    .filter((q: any) => q.eq(q.field("clientName"), clientName))
    .collect();

  let balance = 0;
  for (const tx of txs) {
    if (tx.type === "deposit") {
      balance += tx.amount;
    } else {
      balance -= tx.amount;
    }
  }
  return balance;
}

// ─── Record a Trust Transaction ──────────────────────────────────────────

export const recordTrustTransaction = mutation({
  args: {
    firmId: v.optional(v.string()),
    matterId: v.optional(v.string()),
    clientName: v.optional(v.string()),
    type: v.union(v.literal("deposit"), v.literal("withdrawal"), v.literal("transfer")),
    amount: v.number(),
    description: v.string(),
    reference: v.optional(v.string()),
    recordedBy: v.optional(v.string()),
    recordedByName: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Authenticate and get the real firmId from the session
    const auth = await requireFirmUser(ctx, args.userEmail);
    const firmId = auth.firmId;
    const recordedBy = args.recordedBy || auth.userId;
    const recordedByName = args.recordedByName || auth.user.name || 'Unknown';

    const now = Date.now();

    // ─── ANTI-COMMINGLING ENFORCEMENT ──────────────────────────────────
    // For withdrawals and transfers, check that the specific matter/client
    // has sufficient balance. This prevents using Client A's money for
    // Client B's matter (RPC Rule 23 violation).
    if (args.type === "withdrawal" || args.type === "transfer") {
      if (args.matterId) {
        const matterBalance = await getMatterBalance(ctx, firmId, args.matterId);
        if (args.amount > matterBalance) {
          throw new Error(
            `Insufficient trust balance for this matter. ` +
            `This matter's trust balance is ₦${matterBalance.toLocaleString()}, ` +
            `but you're trying to withdraw ₦${args.amount.toLocaleString()}. ` +
            `Withdrawing more than this matter's balance would constitute commingling ` +
            `of client funds (RPC Rule 23 violation).`
          );
        }
      } else if (args.clientName) {
        const clientBalance = await getClientBalance(ctx, firmId, args.clientName);
        if (args.amount > clientBalance) {
          throw new Error(
            `Insufficient trust balance for this client. ` +
            `This client's trust balance is ₦${clientBalance.toLocaleString()}, ` +
            `but you're trying to withdraw ₦${args.amount.toLocaleString()}. ` +
            `Withdrawing more than this client's balance would constitute commingling ` +
            `of client funds (RPC Rule 23 violation).`
          );
        }
      } else {
        // No matterId or clientName — this is a withdrawal without attribution.
        // For safety, we require matterId or clientName on all withdrawals.
        throw new Error(
          `Withdrawals and transfers must specify a matter or client. ` +
          `Unattributed trust withdrawals are not permitted as they could ` +
          `constitute commingling of client funds (RPC Rule 23).`
        );
      }
    }

    // For deposits, require matterId or clientName (must attribute the money)
    if (args.type === "deposit" && !args.matterId && !args.clientName) {
      throw new Error(
        `Deposits must specify a matter or client. ` +
        `Unattributed trust deposits are not permitted.`
      );
    }

    // Get firm-wide balance for the balanceAfter field (kept for backward
    // compatibility with the ledger view, but per-matter enforcement is
    // done above)
    const lastTx: any = await ctx.db
      .query("trust_transactions")
      .withIndex("by_firm_created", (q: any) => q.eq("firmId", firmId))
      .order("desc")
      .first();

    const currentFirmBalance = lastTx?.balanceAfter ?? 0;

    let newFirmBalance: number;
    if (args.type === "deposit") {
      newFirmBalance = currentFirmBalance + args.amount;
    } else {
      newFirmBalance = currentFirmBalance - args.amount;
    }

    if (newFirmBalance < 0) {
      throw new Error("Insufficient trust account balance.");
    }

    const txId = await ctx.db.insert("trust_transactions", {
      firmId,
      matterId: args.matterId,
      clientName: args.clientName,
      type: args.type,
      amount: args.amount,
      description: args.description,
      reference: args.reference,
      recordedBy,
      recordedByName,
      balanceAfter: newFirmBalance,
      createdAt: now,
      updatedAt: now,
    });

    // Compute the per-matter balance after this transaction
    const matterBalanceAfter = args.matterId
      ? await getMatterBalance(ctx, firmId, args.matterId)
      : null;

    return {
      transactionId: txId,
      newFirmBalance,
      matterBalanceAfter,
    };
  },
});

// ─── Get Trust Transactions (with optional matter filter) ───────────────

export const getTrustTransactions = query({
  args: {
    firmId: v.optional(v.string()),
    matterId: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail);
    const firmId = auth.firmId;

    const transactions = await ctx.db
      .query("trust_transactions")
      .withIndex("by_firm_created", (q: any) => q.eq("firmId", firmId))
      .order("desc")
      .collect();

    // Filter by matter if provided
    const filtered = args.matterId
      ? transactions.filter((t: any) => t.matterId === args.matterId)
      : transactions;

    return filtered;
  },
});

// ─── Get Current Trust Balance (firm-wide total) ─────────────────────────

export const getTrustBalance = query({
  args: { firmId: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail);
    const firmId = auth.firmId;

    const lastTx: any = await ctx.db
      .query("trust_transactions")
      .withIndex("by_firm_created", (q: any) => q.eq("firmId", firmId))
      .order("desc")
      .first();

    return lastTx?.balanceAfter ?? 0;
  },
});

// ─── Get Per-Matter Trust Balances (anti-commingling view) ───────────────
// Returns a breakdown of trust balances by matter, so the firm can see
// exactly how much is held for each client. This is the view that should
// be used for trust accounting compliance reports.

export const getTrustBalancesByMatter = query({
  args: { firmId: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail);
    const firmId = auth.firmId;

    const allTxs: any[] = await ctx.db
      .query("trust_transactions")
      .withIndex("by_firm_created", (q: any) => q.eq("firmId", firmId))
      .collect();

    // Group by matterId and compute balances
    const byMatter = new Map<string, { matterId: string; clientName?: string; balance: number; depositCount: number; withdrawalCount: number }>();

    for (const tx of allTxs) {
      // Use matterId if available, otherwise group by clientName
      const key = tx.matterId || `client:${tx.clientName || 'unattributed'}`;
      const existing = byMatter.get(key) || {
        matterId: tx.matterId || key,
        clientName: tx.clientName,
        balance: 0,
        depositCount: 0,
        withdrawalCount: 0,
      };

      if (tx.type === 'deposit') {
        existing.balance += tx.amount;
        existing.depositCount++;
      } else {
        existing.balance -= tx.amount;
        existing.withdrawalCount++;
      }

      if (!existing.clientName && tx.clientName) {
        existing.clientName = tx.clientName;
      }

      byMatter.set(key, existing);
    }

    return Array.from(byMatter.values()).sort((a, b) => b.balance - a.balance);
  },
});

// ─── Delete a Trust Transaction (admin only, with balance recalculation) ─

export const deleteTrustTransaction = mutation({
  args: {
    transactionId: v.id("trust_transactions"),
    firmId: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.userEmail);
    const firmId = auth.firmId;

    // Verify the transaction belongs to this firm before deleting
    const tx = await ctx.db.get(args.transactionId);
    if (!tx || tx.firmId !== firmId) {
      throw new Error("Transaction not found or does not belong to your firm.");
    }

    // Delete the transaction
    await ctx.db.delete(args.transactionId);

    // Recalculate running balances for all transactions after the deleted one
    const allTx: any[] = await ctx.db
      .query("trust_transactions")
      .withIndex("by_firm_created", (q: any) => q.eq("firmId", firmId))
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
