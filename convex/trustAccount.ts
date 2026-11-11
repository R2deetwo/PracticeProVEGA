/**
 * Trust Account — Toggleable Trust Accounting for Legal Firms
 * ═══════════════════════════════════════════════════════════════════════
 *
 * When a firm enables Trust Accounting in Settings → Firm, they get:
 *   - A Trust tab in Financials showing the trust account ledger
 *   - Record deposits (client money received into trust)
 *   - Record withdrawals (money paid out of trust)
 *   - Record transfers (trust → operating account)
 *   - Explicit, audited reversals (V2) — a contra entry, never an edit
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
 *
 * ─── V2 TRUTH AND INTEGRITY (2026-11-11) — V-FIN-8 / V-FIN-13 ────────────
 * 1. IDEMPOTENCY: recordTrustTransaction accepts a stable client key (the
 *    offline queue always sends one). A replayed submission — double-tap,
 *    reconnect retry, offline-queue replay — returns the ORIGINAL
 *    transaction instead of booking a second row.
 * 2. KOBO ARITHMETIC: every balance is summed in integer kobo and converted
 *    to naira once (0.1 + 0.2 is exactly 0.3 — float drift is gone).
 * 3. CONCURRENCY ANCHOR: every trust write patches the firm's
 *    financial_counters row (scope "trust") INSIDE the transaction. Convex's
 *    serializable isolation makes two concurrent trust writes conflict on
 *    that one row, so one retries — the insufficient-balance check and the
 *    running balance can no longer race past each other (two simultaneous
 *    withdrawals of the same matter balance cannot both succeed).
 * 4. SUM-BASED BALANCES: getTrustBalance and the per-matter/per-client
 *    checks sum the ledger in kobo instead of trusting the last row's
 *    cached balanceAfter — the number is recomputed from the records, so it
 *    is always the truth of the table.
 * 5. EXPLICIT REVERSALS: reverseTrustTransaction writes a contra entry that
 *    references the original, requires a reason, and snapshots everything
 *    into the append-only financial_audit_log. The original row keeps every
 *    original field (gains only reversedAt/By) — history is immutable.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser, requireAdmin } from "./authHelpers";
import { assertPositiveAmount } from "./moneyUtils";

// ─── Kobo-exact balance core ────────────────────────────────────────────────

function toKobo(naira: number): number {
  return Math.round((Number(naira) || 0) * 100);
}

function fromKobo(kobo: number): number {
  return Math.round((kobo / 100) * 100) / 100;
}

/**
 * A transaction's signed effect on a balance, in kobo:
 *   deposit  → +
 *   withdrawal / transfer → −
 *   reversal → the INVERSE of the transaction it references (a reversal of
 *              a deposit takes the money back out; a reversal of a
 *              withdrawal puts it back). The original row keeps its own
 *              sign, so original + contra always net to zero.
 */
async function signedAmountKobo(ctx: any, tx: any): Promise<number> {
  const amountKobo = toKobo(tx.amount);
  if (tx.type === "deposit") return amountKobo;
  if (tx.type === "withdrawal" || tx.type === "transfer") return -amountKobo;
  if (tx.type === "reversal") {
    if (!tx.reversalOf) return 0;
    let original: any = null;
    try { original = await ctx.db.get(tx.reversalOf); } catch { original = null; }
    if (!original) return 0;
    const originalKobo = toKobo(original.amount);
    return original.type === "deposit" ? -originalKobo : originalKobo;
  }
  return 0;
}

/** Sum a set of trust rows into a naira balance (integer kobo internally). */
async function sumBalanceKobo(ctx: any, rows: any[]): Promise<number> {
  let kobo = 0;
  for (const tx of rows) {
    kobo += await signedAmountKobo(ctx, tx);
  }
  return kobo;
}

async function getMatterBalance(ctx: any, firmId: string, matterId: string): Promise<number> {
  const txs: any[] = await ctx.db
    .query("trust_transactions")
    .withIndex("by_firm_created", (q: any) => q.eq("firmId", firmId))
    .filter((q: any) => q.eq(q.field("matterId"), matterId))
    .collect();
  return fromKobo(await sumBalanceKobo(ctx, txs));
}

async function getClientBalance(ctx: any, firmId: string, clientName: string): Promise<number> {
  const txs: any[] = await ctx.db
    .query("trust_transactions")
    .withIndex("by_firm_created", (q: any) => q.eq("firmId", firmId))
    .filter((q: any) => q.eq(q.field("clientName"), clientName))
    .collect();
  return fromKobo(await sumBalanceKobo(ctx, txs));
}

async function getFirmBalanceRows(ctx: any, firmId: string): Promise<any[]> {
  return await ctx.db
    .query("trust_transactions")
    .withIndex("by_firm_created", (q: any) => q.eq("firmId", firmId))
    .collect();
}

/**
 * CONCURRENCY ANCHOR — patch the firm's trust counter row so any two trust
 * writes in flight conflict on it and serialize. The counter's VALUE is
 * also a per-firm trust sequence number (audit-friendly); the patch itself
 * is what makes the check-then-write balance guarantee safe.
 */
async function anchorTrustWrite(ctx: any, firmId: string): Promise<void> {
  const now = Date.now();
  const counter = await ctx.db
    .query("financial_counters")
    .withIndex("by_firm_scope", (q: any) => q.eq("firmId", firmId).eq("scope", "trust"))
    .first();
  if (counter) {
    await ctx.db.patch(counter._id, { value: counter.value + 1, updatedAt: now });
  } else {
    await ctx.db.insert("financial_counters", { firmId, scope: "trust", value: 1, updatedAt: now });
  }
}

// ─── Record a Trust Transaction ──────────────────────────────────────────

export const recordTrustTransaction = mutation({
  args: {
    firmId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    matterId: v.optional(v.string()),
    clientName: v.optional(v.string()),
    type: v.union(v.literal("deposit"), v.literal("withdrawal"), v.literal("transfer")),
    amount: v.number(),
    description: v.string(),
    reference: v.optional(v.string()),
    recordedBy: v.optional(v.string()),
    recordedByName: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    // ─── V2 (V-FIN-8/13): stable client key. The offline queue sends the
    // queue item's id; direct sends generate a uuid per user action. A
    // replay returns the original transaction — never a second row.
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Authenticate and get the real firmId from the session
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const firmId = auth.firmId;
    const recordedBy = args.recordedBy || auth.userId;
    const recordedByName = args.recordedByName || auth.user.name || 'Unknown';

    const amount = assertPositiveAmount(args.amount, "Trust amount");

    // ─── IDEMPOTENCY (V-FIN-8): a replayed submission returns the
    // original result instead of booking twice. Checked BEFORE any write,
    // so even a mid-transaction retry is a no-op.
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("trust_transactions")
        .withIndex("by_idempotency", (q: any) => q.eq("idempotencyKey", args.idempotencyKey!))
        .first();
      if (existing) {
        const matterBalanceAfter = args.matterId
          ? await getMatterBalance(ctx, firmId, args.matterId)
          : null;
        return {
          transactionId: existing._id,
          newFirmBalance: await sumFirmBalance(ctx, firmId),
          matterBalanceAfter,
          duplicate: true,
        };
      }
    }

    const now = Date.now();

    // ─── CONCURRENCY ANCHOR: serialize concurrent trust writes on the
    // firm's counter row BEFORE reading balances — the check-then-write
    // below is race-free (V-FIN-13).
    await anchorTrustWrite(ctx, firmId);

    // ─── ANTI-COMMINGLING ENFORCEMENT ──────────────────────────────────
    // For withdrawals and transfers, check that the specific matter/client
    // has sufficient balance. This prevents using Client A's money for
    // Client B's matter (RPC Rule 23 violation).
    if (args.type === "withdrawal" || args.type === "transfer") {
      if (args.matterId) {
        const matterBalance = await getMatterBalance(ctx, firmId, args.matterId);
        if (toKobo(amount) > toKobo(matterBalance)) {
          throw new Error(
            `Insufficient trust balance for this matter. ` +
            `This matter's trust balance is ₦${matterBalance.toLocaleString()}, ` +
            `but you're trying to withdraw ₦${amount.toLocaleString()}. ` +
            `Withdrawing more than this matter's balance would constitute commingling ` +
            `of client funds (RPC Rule 23 violation).`
          );
        }
      } else if (args.clientName) {
        const clientBalance = await getClientBalance(ctx, firmId, args.clientName);
        if (toKobo(amount) > toKobo(clientBalance)) {
          throw new Error(
            `Insufficient trust balance for this client. ` +
            `This client's trust balance is ₦${clientBalance.toLocaleString()}, ` +
            `but you're trying to withdraw ₦${amount.toLocaleString()}. ` +
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

    // ─── SUM-BASED BALANCES (V-FIN-13): the balance is recomputed from the
    // records in integer kobo — never inherited from the last row's cached
    // figure (which two concurrent writes could both read).
    const allRows = await getFirmBalanceRows(ctx, firmId);
    const newFirmBalanceKobo = (await sumBalanceKobo(ctx, allRows)) +
      (args.type === "deposit" ? toKobo(amount) : -toKobo(amount));
    if (newFirmBalanceKobo < 0) {
      throw new Error("Insufficient trust account balance.");
    }
    const newFirmBalance = fromKobo(newFirmBalanceKobo);

    const txId = await ctx.db.insert("trust_transactions", {
      firmId,
      matterId: args.matterId,
      clientName: args.clientName,
      type: args.type,
      amount,
      description: args.description,
      reference: args.reference,
      recordedBy,
      recordedByName,
      idempotencyKey: args.idempotencyKey ?? undefined,
      balanceAfter: newFirmBalance,
      createdAt: now,
      updatedAt: now,
    });

    // Compute the per-matter balance after this transaction (sum-based)
    const matterBalanceAfter = args.matterId
      ? await getMatterBalance(ctx, firmId, args.matterId)
      : null;

    return {
      transactionId: txId,
      newFirmBalance,
      matterBalanceAfter,
      duplicate: false,
    };
  },
});

async function sumFirmBalance(ctx: any, firmId: string): Promise<number> {
  const rows = await getFirmBalanceRows(ctx, firmId);
  return fromKobo(await sumBalanceKobo(ctx, rows));
}

// ─── Get Trust Transactions (with optional matter filter) ───────────────

export const getTrustTransactions = query({
  args: {
    firmId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    matterId: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
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
  args: { sessionToken: v.optional(v.string()), firmId: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const firmId = auth.firmId;

    // V2 (V-FIN-13): the balance is the SUM of the ledger (integer kobo),
    // recomputed from the records — not the last row's cached balanceAfter.
    // Two same-second writes can no longer make the displayed balance lie.
    return await sumFirmBalance(ctx, firmId);
  },
});

// ─── Get Per-Matter Trust Balances (anti-commingling view) ───────────────
// Returns a breakdown of trust balances by matter, so the firm can see
// exactly how much is held for each client. This is the view that should
// be used for trust accounting compliance reports.

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * getTrustBalancesByMatter removed: firm-gated orphan with zero product callers (the live trust surface reads via the wired trust functions).
 */

// ─── Explicit, audited reversal (V2 — V-FIN-8) ─────────────────────────────
//
// The accounting-correct correction: a CONTRA ENTRY that references the
// original transaction. The original row is never edited (beyond gaining
// reversedAt/reversedBy markers), never deleted; the reversal appears in
// the ledger beside it and the two net to zero in every balance. Every
// reversal carries a reason and lands in the append-only
// financial_audit_log.

export const reverseTrustTransaction = mutation({
  args: {
    transactionId: v.id("trust_transactions"),
    reason: v.string(),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const firmId = auth.firmId;

    const reason = String(args.reason || "").trim();
    if (reason.length < 3) {
      throw new Error("A reason is required to reverse a trust transaction — this is the audit trail.");
    }

    const original = await ctx.db.get(args.transactionId);
    if (!original || original.firmId !== firmId) {
      throw new Error("Transaction not found or does not belong to your firm.");
    }
    if (original.type === "reversal") {
      throw new Error("Reversals cannot be reversed — reverse the ORIGINAL transaction instead.");
    }
    if (original.reversedAt) {
      throw new Error("This transaction has already been reversed. The audit trail records the original reversal.");
    }

    // Serialize on the trust anchor before reading balances (same guarantee
    // as a recording: concurrent writes cannot interleave).
    await anchorTrustWrite(ctx, firmId);

    const now = Date.now();
    const beforeSnapshot = { ...original, _id: String(original._id) };

    // 1. The contra entry — same matter/client attribution, inverse effect.
    const newFirmBalance = await sumFirmBalance(ctx, firmId); // before reversal effect
    const reversalEffectKobo = original.type === "deposit"
      ? -toKobo(original.amount)   // take the deposited money back out
      : toKobo(original.amount);   // return the withdrawn/transferred money
    const reversalBalance = fromKobo(toKobo(newFirmBalance) + reversalEffectKobo);
    if (reversalBalance < 0) {
      throw new Error(
        "Reversing this transaction would drive the firm trust balance below zero — " +
        "the money it represented has already left. Record the correcting movement explicitly."
      );
    }

    const reversalId = await ctx.db.insert("trust_transactions", {
      firmId,
      matterId: original.matterId,
      clientName: original.clientName,
      type: "reversal",
      amount: original.amount,
      description: `Reversal of ${original.type}: ${original.description || 'trust transaction'}`,
      reference: original.reference,
      recordedBy: auth.userId,
      recordedByName: auth.user?.name || 'Unknown',
      reversalOf: String(original._id),
      reversalReason: reason,
      balanceAfter: reversalBalance,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Mark the original reversed — fields added, nothing removed.
    await ctx.db.patch(original._id, {
      reversedAt: now,
      reversedBy: auth.userId,
      reversalReason: reason,
      updatedAt: now,
    });

    // 3. The audit trail (append-only, full before/after).
    await ctx.db.insert("financial_audit_log", {
      firmId,
      tableName: "trust_transactions",
      recordId: String(original._id),
      action: "reverse",
      actorEmail: args.userEmail ?? auth.user?.email ?? undefined,
      actorUserId: String(auth.user?._id ?? auth.userId ?? ""),
      reason,
      beforeState: beforeSnapshot,
      afterState: { ...beforeSnapshot, reversedAt: now, reversedBy: auth.userId, reversalReason: reason },
      metadata: { via: "trustAccount.reverseTrustTransaction", reversalTxId: String(reversalId) },
      createdAt: now,
    });

    const matterBalanceAfter = original.matterId
      ? await getMatterBalance(ctx, firmId, original.matterId)
      : null;

    return {
      success: true,
      reversalId,
      newFirmBalance: reversalBalance,
      matterBalanceAfter,
    };
  },
});

// ─── Delete a Trust Transaction (admin only, with balance recalculation) ─

export const deleteTrustTransaction = mutation({
  args: {
    transactionId: v.id("trust_transactions"),
    sessionToken: v.optional(v.string()),
    firmId: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    // ACCOUNTING-INTEGRITY ROUND (2026-09-14): a reason is now REQUIRED and
    // the full before-state is snapshotted into financial_audit_log before
    // anything is removed. Trust deletions rewrite every later running
    // balance — the audit snapshot is the only surviving proof of what the
    // books said before. (V2 note: prefer reverseTrustTransaction — it
    // corrects the books WITHOUT deleting history. This path remains for
    // the admin's data-repair tooling, unchanged in its protections.)
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.userEmail, args.sessionToken);
    const firmId = auth.firmId;

    const reason = String(args.reason || "").trim();
    if (reason.length < 3) {
      throw new Error("A reason is required to delete a trust transaction — this is the audit trail.");
    }

    // Verify the transaction belongs to this firm before deleting
    const tx = await ctx.db.get(args.transactionId);
    if (!tx || tx.firmId !== firmId) {
      throw new Error("Transaction not found or does not belong to your firm.");
    }

    if (tx.reversedAt) {
      throw new Error(
        "This transaction was reversed — the reversal references it. " +
        "Deleting it would break the reversal's audit link; the books keep both rows."
      );
    }

    // Forensic snapshot FIRST — the row's full before-state survives in the
    // append-only financial audit log even after the delete below.
    const beforeSnapshot = { ...tx, _id: String(tx._id) };
    await ctx.db.insert("financial_audit_log", {
      firmId,
      tableName: "trust_transactions",
      recordId: String(args.transactionId),
      action: "delete",
      actorEmail: args.userEmail ?? undefined,
      actorUserId: String((auth as any).user?._id ?? ""),
      reason,
      beforeState: beforeSnapshot,
      metadata: { via: "trustAccount.deleteTrustTransaction", note: "Running balances were recomputed after this deletion" },
      createdAt: Date.now(),
    });

    // Delete the transaction
    await ctx.db.delete(args.transactionId);

    // Recalculate running balances for all transactions after the deleted one
    // (V2: integer kobo, reversal-aware).
    const allTx: any[] = await ctx.db
      .query("trust_transactions")
      .withIndex("by_firm_created", (q: any) => q.eq("firmId", firmId))
      .order("asc")
      .collect();

    let runningKobo = 0;
    for (const row of allTx) {
      runningKobo += await signedAmountKobo(ctx, row);
      await ctx.db.patch(row._id, { balanceAfter: fromKobo(runningKobo), updatedAt: Date.now() });
    }

    return { success: true, newBalance: fromKobo(runningKobo) };
  },
});
