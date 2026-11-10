/**
 * convex/financialIntegrity.ts — the financial record lifecycle system
 * (accounting-integrity round, 2026-09-14).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS MODULE EXISTS — the user's problem, verbatim
 * ─────────────────────────────────────────────────────────────────────────────
 * "We have some legacy payments that I am not clear how they got there… I
 * have been testing with the same account and I am seeing financial records
 * I don't remember. Should we have a system of clearing the financial
 * records in a manner that complies with international standards? I need to
 * be sure I am not creating something that will be problematic to the user
 * in the future or bad for financial forensics."
 *
 * The audit that prompted this found SIX automatic record writers the user
 * never sees (monthly charge-reset cron, wallet auto-deduction cron,
 * retainer auto-billing crons, defaulter flagging cron, auto caution-deposit
 * rows on unit creation, historical-period settlements) PLUS offline-queue
 * replays that duplicate entries (addLedgerEntry had no idempotency key).
 * Meanwhile the only "undo" was a status flip with no record of who, when
 * or why — and generic mutations could hard-delete money rows and even
 * REWRITE trust running balances.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE STANDARD THIS IMPLEMENTS (international bookkeeping norms)
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. IMMOVABLE LEDGER — a booked financial record is never deleted or
 *      silently edited. Corrections are ANNOTATIONS: void (with reason) or
 *      test-quarantine. This is the same principle as IFRS record-keeping
 *      requirements and the paper-ledger norm ("cross out, never erase"):
 *      an auditor must be able to reconstruct what was believed true at
 *      every point in time.
 *   2. COMPLETE AUDIT TRAIL — every lifecycle action writes an append-only
 *      financial_audit_log row: actor, timestamp, REQUIRED reason, and the
 *      full before-state snapshot. After-state too where useful. Nothing
 *      can void or un-void without leaving this trace.
 *   3. REVERSIBLE — voids can be reinstated (people make mistakes in both
 *      directions); reinstatement is audited like everything else.
 *   4. TEST-DATA QUARANTINE — records created during testing are MARKED,
 *      not deleted: they stay for forensic completeness (the auditor can
 *      see the test activity) but are excluded from every revenue,
 *      receivables and risk aggregate.
 *   5. NO DELETION PATH — the generic deleteItem/forceDeleteItem mutations
 *      are fenced off for financial tables (see myFunctions.ts), so the
 *      only lifecycle exits are the audited ones here.
 *
 * The compliance posture in one line: the system of record may only ever
 * GROW; interpretation (what counts) is a view concern controlled by
 * recordStatus — voided and test rows are invisible to money totals but
 * forever visible to the audit log.
 */

import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser } from "./authHelpers";
import { requireStaffCaller } from "./callerAuth";
import { withCronReporting } from "./observability";
import { roundMoney } from "./moneyUtils";
import { Id } from "./_generated/dataModel";

// ─── Auth (same contract as sentry.ts requireSentryAuth) ────────────────────

async function requireFinancialAuth(
  ctx: any,
  userEmail: string | undefined,
  sessionToken: string | undefined,
  firmId?: string
) {
  const auth = await requireFirmUser(ctx, userEmail, sessionToken);
  if (!auth.firmId || !auth.user) {
    throw new Error("Unauthenticated: a verified user session is required for financial lifecycle operations.");
  }
  if (firmId !== undefined && auth.firmId !== firmId) {
    throw new Error("Not authorized: cannot access financial records belonging to a different firm.");
  }
  return auth as { firmId: string; user: any; userId?: string };
}

// ─── Shared lifecycle core ──────────────────────────────────────────────────

const MIN_REASON_LENGTH = 3;

/**
 * isActiveFinancialRecord — the ONE definition of "counts as money" shared by
 * server aggregates and the client mirrors. A row whose recordStatus is
 * 'voided' or 'test' is an annotation, not money: it stays in the table for
 * forensics but never enters a total. Anything else (including undefined,
 * the state of every pre-lifecycle row) is active.
 *
 * Exported pure so the client mirrors (LedgerManager cashFlow, tenant
 * outstanding) and the unit tests can import the exact same predicate —
 * if this ever drifts between server and client, the dashboard and the
 * ledger would silently disagree, which is precisely the confusion this
 * module exists to end.
 */
export function isActiveFinancialRecord(recordStatus: string | undefined | null): boolean {
  return recordStatus !== "voided" && recordStatus !== "test";
}

/** Client-side idempotency key for addLedgerEntry — same shape the offline
 *  queue replays. Deterministic per (firm, unit, amount, type, client_nonce)
 *  so an offline queue replay NEVER books twice. */
export function makeLedgerIdempotencyKey(parts: {
  firmId: string;
  unitId: string;
  amount: number;
  type: string;
  nonce: string;
}): string {
  return `ledger:${parts.firmId}:${parts.unitId}:${parts.type}:${parts.amount}:${parts.nonce}`;
}

function assertReason(reason: string) {
  const clean = String(reason || "").trim();
  if (clean.length < MIN_REASON_LENGTH) {
    throw new Error(`A reason is required for every financial lifecycle action (min ${MIN_REASON_LENGTH} characters). This is the audit trail — "just clean it up" is not an answer an auditor can work with.`);
  }
  return clean;
}

/** Serialize a row for the audit snapshot (drops nothing — the full row IS
 *  the evidence; Convex ids become strings so it round-trips as JSON). */
function snapshot(row: any): any {
  if (!row) return null;
  const out: any = { ...row };
  if (out._id !== undefined) out._id = String(out._id);
  if (out._creationTime !== undefined) out._creationTime = out._creationTime;
  return out;
}

async function writeAudit(
  ctx: any,
  args: {
    firmId: string;
    tableName: string;
    recordId: string;
    action: string;
    actorEmail?: string;
    actorUserId?: string;
    reason: string;
    beforeState?: any;
    afterState?: any;
    metadata?: any;
  }
): Promise<string> {
  const auditId = await ctx.db.insert("financial_audit_log", {
    firmId: args.firmId,
    tableName: args.tableName,
    recordId: args.recordId,
    action: args.action,
    actorEmail: args.actorEmail ?? null,
    actorUserId: args.actorUserId ?? null,
    reason: args.reason,
    ...(args.beforeState !== undefined ? { beforeState: args.beforeState } : {}),
    ...(args.afterState !== undefined ? { afterState: args.afterState } : {}),
    ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    createdAt: Date.now(),
  });
  return String(auditId);
}

/** Load a ledger entry and verify firm ownership. */
async function loadFirmLedgerEntry(ctx: any, firmId: string, entryId: string) {
  let entry: any = null;
  try {
    entry = await ctx.db.get(entryId as Id<"ledger_entries">);
  } catch {
    throw new Error("Ledger entry not found.");
  }
  if (!entry || entry.firmId !== firmId) {
    throw new Error("Ledger entry not found or does not belong to your firm.");
  }
  return entry;
}

// ─── Ledger entry lifecycle ─────────────────────────────────────────────────

/**
 * voidLedgerEntry — retire a booked ledger entry from all money aggregates.
 *
 * Accounting meaning: a REVERSAL ANNOTATION. The entry stays in the table
 * (forensic completeness), keeps its original fields, and gains
 * recordStatus='voided' + who/when/why. Every aggregation (income, risk,
 * tenant outstanding) filters voided rows out — see getCashFlowSummary and
 * getTenantLedger.
 *
 * Guard rails: reason required; already-voided entries cannot be voided
 * again (idempotence); test-marked entries are voidable too (a test row
 * can still be plain wrong).
 */
export const voidLedgerEntry = mutation({
  args: {
    entryId: v.string(),
    reason: v.string(),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFinancialAuth(ctx, args.userEmail, args.sessionToken);
    const reason = assertReason(args.reason);
    const entry = await loadFirmLedgerEntry(ctx, auth.firmId, args.entryId);

    if (entry.recordStatus === "voided") {
      throw new Error("This entry is already voided. Reinstate it first if you need to re-void with a different reason.");
    }

    const auditId = await writeAudit(ctx, {
      firmId: auth.firmId,
      tableName: "ledger_entries",
      recordId: args.entryId,
      action: "void",
      actorEmail: args.userEmail ?? auth.user?.email ?? null,
      actorUserId: String(auth.user?._id ?? auth.userId ?? ""),
      reason,
      beforeState: snapshot(entry),
      metadata: args.metadata,
    });

    await ctx.db.patch(args.entryId as Id<"ledger_entries">, {
      recordStatus: "voided",
      voidedAt: Date.now(),
      voidedByEmail: args.userEmail ?? auth.user?.email ?? null,
      voidReason: reason,
      auditId,
    });

    return { success: true, auditId };
  },
});

/**
 * reinstateLedgerEntry — reverse a void (audited, both directions visible).
 * Restores the entry to its prior recordStatus (active or test).
 */
export const reinstateLedgerEntry = mutation({
  args: {
    entryId: v.string(),
    reason: v.string(),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFinancialAuth(ctx, args.userEmail, args.sessionToken);
    const reason = assertReason(args.reason);
    const entry = await loadFirmLedgerEntry(ctx, auth.firmId, args.entryId);

    if (entry.recordStatus !== "voided") {
      throw new Error("Only voided entries can be reinstated.");
    }

    // What was the record BEFORE it was voided? The current row says
    // 'voided' — the pre-void state lives in the void action's audit
    // snapshot. (This is the audit trail earning its keep: reinstatement
    // is faithful, not guessed.)
    let priorWasTest = false;
    try {
      const voidAudits = await ctx.db
        .query("financial_audit_log")
        .withIndex("by_table_record", (q: any) =>
          q.eq("tableName", "ledger_entries").eq("recordId", args.entryId)
        )
        .order("desc")
        .collect();
      const lastVoid = (voidAudits as any[]).find((a: any) => a.action === "void");
      if (lastVoid?.beforeState?.recordStatus === "test") priorWasTest = true;
    } catch { /* worst case: reinstate as active — the audit rows above tell the story */ }

    const auditId = await writeAudit(ctx, {
      firmId: auth.firmId,
      tableName: "ledger_entries",
      recordId: args.entryId,
      action: "reinstate",
      actorEmail: args.userEmail ?? auth.user?.email ?? null,
      actorUserId: String(auth.user?._id ?? auth.userId ?? ""),
      reason,
      beforeState: snapshot(entry),
      metadata: { restoredRecordStatus: priorWasTest ? "test" : "active" },
    });

    await ctx.db.patch(args.entryId as Id<"ledger_entries">, {
      recordStatus: priorWasTest ? "test" : undefined,
      voidedAt: undefined,
      voidedByEmail: undefined,
      voidReason: undefined,
      auditId,
    });

    return { success: true, auditId };
  },
});

/**
 * markLedgerEntryAsTest — quarantine a record as test data.
 *
 * THE USER'S EXACT PAIN: testing with the same account leaves records you
 * don't remember. Deleting them would falsify history (and this system
 * refuses to); MARKING them keeps the forensic trail intact while removing
 * every naira from revenue, risk and receivables views.
 */
export const markLedgerEntryAsTest = mutation({
  args: {
    entryId: v.string(),
    reason: v.string(),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFinancialAuth(ctx, args.userEmail, args.sessionToken);
    const reason = assertReason(args.reason);
    const entry = await loadFirmLedgerEntry(ctx, auth.firmId, args.entryId);

    if (entry.recordStatus === "voided") {
      throw new Error("This entry is voided — voided records are already excluded from reporting. Reinstate it first if you want it treated as test data.");
    }
    if (entry.recordStatus === "test") {
      throw new Error("This entry is already marked as test data.");
    }

    const auditId = await writeAudit(ctx, {
      firmId: auth.firmId,
      tableName: "ledger_entries",
      recordId: args.entryId,
      action: "mark_test",
      actorEmail: args.userEmail ?? auth.user?.email ?? null,
      actorUserId: String(auth.user?._id ?? auth.userId ?? ""),
      reason,
      beforeState: snapshot(entry),
    });

    await ctx.db.patch(args.entryId as Id<"ledger_entries">, {
      recordStatus: "test",
      auditId,
    });

    return { success: true, auditId };
  },
});

/** unmarkLedgerEntryAsTest — return a test record to live reporting. */
export const unmarkLedgerEntryAsTest = mutation({
  args: {
    entryId: v.string(),
    reason: v.string(),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFinancialAuth(ctx, args.userEmail, args.sessionToken);
    const reason = assertReason(args.reason);
    const entry = await loadFirmLedgerEntry(ctx, auth.firmId, args.entryId);

    if (entry.recordStatus !== "test") {
      throw new Error("Only test-marked entries can be unmarked.");
    }

    const auditId = await writeAudit(ctx, {
      firmId: auth.firmId,
      tableName: "ledger_entries",
      recordId: args.entryId,
      action: "unmark_test",
      actorEmail: args.userEmail ?? auth.user?.email ?? null,
      actorUserId: String(auth.user?._id ?? auth.userId ?? ""),
      reason,
      beforeState: snapshot(entry),
    });

    await ctx.db.patch(args.entryId as Id<"ledger_entries">, {
      recordStatus: undefined,
      auditId,
    });

    return { success: true, auditId };
  },
});

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * bulkVoidLedgerEntries + markInvoiceAsTest + getLatestFinancialReconciliation removed (this record covers all three): requireFinancialAuth/staff-gated orphans with zero product callers — the reconciliation console reads through the wired paths.
 */

// ─── Invoice lifecycle ──────────────────────────────────────────────────────

/** Load an invoice (custom id or Convex id) and verify firm ownership. */
async function loadFirmInvoice(ctx: any, firmId: string, invoiceId: string) {
  let invoice: any = await ctx.db
    .query("invoices")
    .withIndex("by_custom_id", (q: any) => q.eq("id", invoiceId))
    .first();
  if (!invoice) {
    try { invoice = await ctx.db.get(invoiceId as Id<"invoices">) || null; } catch { invoice = null; }
  }
  if (!invoice || invoice.firmId !== firmId) {
    throw new Error("Invoice not found or does not belong to your firm.");
  }
  return { invoice, rowId: invoice._id as Id<"invoices">, recordId: String(invoice.id ?? invoice._id) };
}

/**
 * voidInvoice — the audited replacement for the old status-flip reversal
 * (payments.manualRevertPayment set 'Reversed' with zero record). Sets the
 * UI's reserved 'Void' status + the lifecycle cluster + audit snapshot.
 * priorStatus is preserved so reinstate can restore faithfully.
 */
export const voidInvoice = mutation({
  args: {
    invoiceId: v.string(),
    reason: v.string(),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFinancialAuth(ctx, args.userEmail, args.sessionToken);
    const reason = assertReason(args.reason);
    const { invoice, rowId, recordId } = await loadFirmInvoice(ctx, auth.firmId, args.invoiceId);

    if (invoice.status === "Void" || invoice.recordStatus === "voided") {
      throw new Error("This invoice is already voided.");
    }

    const auditId = await writeAudit(ctx, {
      firmId: auth.firmId,
      tableName: "invoices",
      recordId,
      action: "void",
      actorEmail: args.userEmail ?? auth.user?.email ?? null,
      actorUserId: String(auth.user?._id ?? auth.userId ?? ""),
      reason,
      beforeState: snapshot(invoice),
    });

    await ctx.db.patch(rowId, {
      status: "Void",
      priorStatus: invoice.status ?? "Unpaid",
      recordStatus: "voided",
      voidedAt: Date.now(),
      voidedByEmail: args.userEmail ?? auth.user?.email ?? null,
      voidReason: reason,
      auditId,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, auditId };
  },
});

/** reinstateInvoice — restore a voided invoice to its prior status. */
export const reinstateInvoice = mutation({
  args: {
    invoiceId: v.string(),
    reason: v.string(),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFinancialAuth(ctx, args.userEmail, args.sessionToken);
    const reason = assertReason(args.reason);
    const { invoice, rowId, recordId } = await loadFirmInvoice(ctx, auth.firmId, args.invoiceId);

    if (invoice.recordStatus !== "voided") {
      throw new Error("Only voided invoices can be reinstated.");
    }

    const auditId = await writeAudit(ctx, {
      firmId: auth.firmId,
      tableName: "invoices",
      recordId,
      action: "reinstate",
      actorEmail: args.userEmail ?? auth.user?.email ?? null,
      actorUserId: String(auth.user?._id ?? auth.userId ?? ""),
      reason,
      beforeState: snapshot(invoice),
      metadata: { restoredStatus: invoice.priorStatus ?? "Unpaid" },
    });

    // recordStatus was only ever set to 'voided' by voidInvoice (the sole
    // writer of that status on this table), so clearing it returns the
    // invoice to active. priorStatus restores the pre-void lifecycle state.
    await ctx.db.patch(rowId, {
      status: invoice.priorStatus ?? "Unpaid",
      priorStatus: undefined,
      recordStatus: undefined,
      voidedAt: undefined,
      voidedByEmail: undefined,
      voidReason: undefined,
      auditId,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, auditId };
  },
});

// ─── Audit log read path ────────────────────────────────────────────────────

/**
 * getFinancialAuditLog — the forensic trail, newest first. Firm-scoped,
 * session-verified. This is what an auditor (or the founder asking "where
 * did this record come from and what happened to it") reads.
 */
export const getFinancialAuditLog = query({
  args: {
    firmId: v.string(),
    limit: v.optional(v.number()),
    tableName: v.optional(v.string()),
    recordId: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFinancialAuth(ctx, args.userEmail, args.sessionToken, args.firmId);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);

    let rows: any[];
    if (args.tableName && args.recordId) {
      rows = await ctx.db
        .query("financial_audit_log")
        .withIndex("by_table_record", (q: any) =>
          q.eq("tableName", args.tableName).eq("recordId", args.recordId!)
        )
        .order("desc")
        .take(limit);
    } else {
      rows = await ctx.db
        .query("financial_audit_log")
        .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
        .order("desc")
        .take(limit);
    }

    // Filter by tableName when only that is provided (post-filter on the
    // firm index — the by_table_record index requires both parts).
    const filtered = args.tableName && !args.recordId
      ? rows.filter((r: any) => r.tableName === args.tableName)
      : rows;

    return filtered.map((r: any) => ({
      id: String(r._id),
      tableName: r.tableName,
      recordId: r.recordId,
      action: r.action,
      actorEmail: r.actorEmail ?? null,
      reason: r.reason,
      metadata: r.metadata ?? null,
      createdAt: r.createdAt,
    }));
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUND B (Wave S2) — THE RECONCILIATION CHECKER
// ═══════════════════════════════════════════════════════════════════════════
//
// The money-truth round made every collection path book to the ledger
// atomically (proof approvals H1, wallet auto-deduct H2, rent collections
// M6/M8). This checker is the proof that it STAYS true: a daily pass that
// joins ledger_entries ↔ service_charges ↔ wallet_transactions ↔
// payment_proofs and proves every post-Round-B money movement is booked
// exactly once.
//
// What it checks (and what a red flag means):
//   1. walletDebitsWithoutLedger — an auto-deduct debit (post-cutoff) whose
//      ledger row is missing → money left the wallet but never reached the
//      books. THE H2 invariant.
//   2. approvedProofsUnbooked — an approved/verified proof (post-cutoff)
//      with no ledger entry → money was confirmed but never booked.
//      THE H1 invariant.
//   3. invalidAmountRows — ledger/wallet rows with amount <= 0 or non-finite
//      (post-cutoff) → the M5 validation was bypassed somewhere.
//   4. duplicateIdempotencyKeys — two ledger rows sharing one key → the
//      exactly-once contract broke.
//   5. duplicateReceiptNumbers — two rent collections stamped the same
//      server-side receipt number → the M8 counter was bypassed.
//   6. balanceDriftWallets — a wallet whose stored balance disagrees with
//      its latest transaction row's newBalance → a balance changed without
//      its transaction (legacy manual patches). Informational: reported for
//      staff follow-up, does not fail the run.
//
// Rows written BEFORE the Round B cutoff cannot satisfy the new invariants
// (they predate the links) — they are counted in separate legacy* buckets so
// historical data never reds a healthy deployment.

/** The Round B deploy date (2026-11-09 UTC). Rows created before this
 *  timestamp are evaluated as legacy data, not as contract violations. */
export const ROUND_B_CUTOFF_MS = Date.UTC(2026, 10, 9);

async function reconcileFinancialRecords(ctx: any) {
  const cutoff = ROUND_B_CUTOFF_MS;

  const walletDebitsWithoutLedger: string[] = [];
  const legacyWalletDebits: string[] = [];
  const approvedProofsUnbooked: string[] = [];
  const legacyApprovedProofs: string[] = [];
  const invalidAmountRows: string[] = [];
  const duplicateReceiptNumbers: string[] = [];
  const balanceDriftWallets: string[] = [];
  const firmsAffected = new Set<string>();

  // ── Check 1 (H2): every post-cutoff auto-deduct debit carries its ledger
  //    key; the ledger row must exist. Pre-cutoff debits have no key — legacy.
  const walletTxns = await ctx.db.query("wallet_transactions").take(5000);
  const ledgerKeySeen = new Set<string>();
  const latestTxnPerWallet = new Map<string, { timestamp: number; newBalance: number }>();
  for (const txn of walletTxns as any[]) {
    if (txn.type === "debit" && txn.chargeId) {
      if (txn.timestamp >= cutoff) {
        if (!txn.ledgerIdempotencyKey) {
          walletDebitsWithoutLedger.push(String(txn._id));
          if (txn.firmId) firmsAffected.add(String(txn.firmId));
        } else {
          ledgerKeySeen.add(String(txn.ledgerIdempotencyKey));
        }
      } else {
        legacyWalletDebits.push(String(txn._id));
      }
    }
    // Track the latest transaction per wallet for the drift check (6).
    const prev = latestTxnPerWallet.get(String(txn.walletId));
    if (!prev || (txn.timestamp ?? 0) >= prev.timestamp) {
      latestTxnPerWallet.set(String(txn.walletId), { timestamp: txn.timestamp ?? 0, newBalance: txn.newBalance });
    }
  }
  for (const key of ledgerKeySeen) {
    const ledgerRow = await ctx.db
      .query("ledger_entries")
      .withIndex("by_idempotency", (q: any) => q.eq("idempotencyKey", key))
      .first();
    if (!ledgerRow) {
      walletDebitsWithoutLedger.push(`ledger-missing:${key}`);
      firmsAffected.add("unknown");
    }
  }

  // ── Check 2 (H1): every post-cutoff approved/verified proof with money
  //    must carry a live ledger link.
  const proofs = await ctx.db.query("payment_proofs").take(5000);
  for (const proof of proofs as any[]) {
    const settled = proof.status === "approved" || proof.status === "verified";
    if (!settled) continue;
    const hasMoney = typeof proof.amount === "number" && proof.amount > 0;
    if ((proof.updatedAt ?? proof.createdAt) >= cutoff) {
      if (hasMoney && !proof.ledgerEntryId) {
        approvedProofsUnbooked.push(String(proof._id));
        if (proof.firmId) firmsAffected.add(String(proof.firmId));
      }
    } else if (hasMoney) {
      legacyApprovedProofs.push(String(proof._id));
    }
  }

  // ── Checks 3–5 (M5/M8): post-cutoff ledger rows must be well-formed and
  //    exactly-once.
  const recentLedger = await ctx.db
    .query("ledger_entries")
    .withIndex("by_timestamp", (q: any) => q.gte("timestamp", cutoff))
    .take(5000);
  const idempotencySeen = new Set<string>();
  const receiptSeen = new Map<string, number>();
  for (const entry of recentLedger as any[]) {
    if (typeof entry.amount !== "number" || !isFinite(entry.amount) || entry.amount <= 0) {
      invalidAmountRows.push(String(entry._id));
      if (entry.firmId) firmsAffected.add(String(entry.firmId));
    }
    if (entry.idempotencyKey) {
      if (idempotencySeen.has(entry.idempotencyKey)) {
        invalidAmountRows.push(`duplicate-key:${entry.idempotencyKey}`);
      }
      idempotencySeen.add(entry.idempotencyKey);
    }
    if (entry.type === "rent" && typeof entry.paymentRef === "string" && entry.paymentRef.startsWith("REC-")) {
      const n = receiptSeen.get(entry.paymentRef) ?? 0;
      if (n > 0) duplicateReceiptNumbers.push(entry.paymentRef);
      receiptSeen.set(entry.paymentRef, n + 1);
    }
  }

  // ── Check 6: wallet balance drift (informational). The latest transaction
  //    row's newBalance IS the wallet's balance whenever every balance change
  //    wrote its row — a mismatch means a manual patch bypassed the books.
  let walletsChecked = 0;
  for (const [walletId, latest] of latestTxnPerWallet) {
    if (walletsChecked >= 200) break; // bounded: newest-activity wallets first
    const wallet = await ctx.db.get(walletId as any);
    if (!wallet) continue;
    walletsChecked++;
    if (Math.abs(roundMoney((wallet as any).balance ?? 0) - roundMoney(latest.newBalance)) > 0.01) {
      balanceDriftWallets.push(String(walletId));
      if ((wallet as any).firmId) firmsAffected.add(String((wallet as any).firmId));
    }
  }

  const ok =
    walletDebitsWithoutLedger.length === 0 &&
    approvedProofsUnbooked.length === 0 &&
    invalidAmountRows.length === 0 &&
    duplicateReceiptNumbers.length === 0;

  const summary = {
    ok,
    walletDebitsWithoutLedger: walletDebitsWithoutLedger.length,
    approvedProofsUnbooked: approvedProofsUnbooked.length,
    invalidAmountRows: invalidAmountRows.length,
    duplicateIdempotencyKeys: invalidAmountRows.filter((s) => s.startsWith("duplicate-key:")).length,
    duplicateReceiptNumbers: duplicateReceiptNumbers.length,
    balanceDriftWallets: balanceDriftWallets.length,
    legacyWalletDebits: legacyWalletDebits.length,
    legacyApprovedProofs: legacyApprovedProofs.length,
    firmsAffected: Array.from(firmsAffected).slice(0, 50),
    details: {
      walletDebitsWithoutLedger: walletDebitsWithoutLedger.slice(0, 20),
      approvedProofsUnbooked: approvedProofsUnbooked.slice(0, 20),
      invalidAmountRows: invalidAmountRows.slice(0, 20),
      duplicateReceiptNumbers: duplicateReceiptNumbers.slice(0, 20),
      balanceDriftWallets: balanceDriftWallets.slice(0, 20),
    },
    ranAt: Date.now(),
  };

  await ctx.db.insert("financial_reconciliation_reports", {
    ranAt: summary.ranAt,
    ok: summary.ok,
    walletDebitsWithoutLedger: summary.walletDebitsWithoutLedger,
    approvedProofsUnbooked: summary.approvedProofsUnbooked,
    invalidAmountRows: summary.invalidAmountRows,
    duplicateIdempotencyKeys: summary.duplicateIdempotencyKeys,
    duplicateReceiptNumbers: summary.duplicateReceiptNumbers,
    balanceDriftWallets: summary.balanceDriftWallets,
    legacyWalletDebits: summary.legacyWalletDebits,
    legacyApprovedProofs: summary.legacyApprovedProofs,
    firmsAffected: summary.firmsAffected,
    details: summary.details,
  });

  console.log(
    `[reconciliation] ${summary.ok ? "OK" : "DISCREPANCIES"} — walletDebitsWithoutLedger=${summary.walletDebitsWithoutLedger} approvedProofsUnbooked=${summary.approvedProofsUnbooked} invalidAmounts=${summary.invalidAmountRows} dupReceipts=${summary.duplicateReceiptNumbers} drift=${summary.balanceDriftWallets} legacy(wallet/proofs)=${summary.legacyWalletDebits}/${summary.legacyApprovedProofs}`
  );
  return summary;
}

/** The daily cron entry point (registered in crons.ts as
 *  crons:financialReconciliation). Failures are captured to error_events by
 *  withCronReporting like every money-adjacent cron. */
export const runFinancialReconciliation = internalMutation({
  args: {},
  handler: withCronReporting("crons:financialReconciliation", async (ctx) => {
    return await reconcileFinancialRecords(ctx);
  }),
});

/** On-demand run + result read-back for the founder (the app surface can
 *  expose a "Run reconciliation now" control; the same core as the cron). */
export const runFinancialReconciliationNow = mutation({
  args: { userEmail: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    if (String((caller as any).role || "") !== "Founder") {
      throw new Error("Not authorized: on-demand reconciliation runs are founder-only.");
    }
    return await reconcileFinancialRecords(ctx);
  },
});

