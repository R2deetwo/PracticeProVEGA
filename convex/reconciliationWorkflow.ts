/**
 * convex/reconciliationWorkflow.ts — ROUND F (Wave F2): the interactive
 * reconciliation workflow — the §4 capstone of the owner brief.
 * ─────────────────────────────────────────────────────────────────────────────
 * Round B built the DETECTION (the daily checker proves every post-Round-B
 * money movement is booked exactly once). This module builds the WORKFLOW on
 * top of it — the difference between an alarm and a control center:
 *
 *   1. THE UNALLOCATED QUEUE (getUnallocatedPayments): payments that arrived
 *      and booked to the ledger (Round B guarantees that part) but were never
 *      tied to an OBLIGATION. Two real queues exist today:
 *        • settled proofs (approved/verified with money) that carry no
 *          linkedChargeId and no active reconciliation match — money in,
 *          no obligation attached;
 *        • service charges holding creditCarriedForward — the tenant's
 *          overpayment sitting unapplied to any future obligation.
 *
 *   2. MATCH TO OBLIGATION (matchProofToCharge): ties a settled proof to the
 *      service charge it was paying. Moves NO money — the proof's ledger row
 *      already booked it at settlement (Round B H1); the match settles the
 *      CHARGE's state with the same state math the settlement-time linkage
 *      uses, records the join (reconciliation_matches), and writes the
 *      financial_audit_log row. Idempotent per proof; one ACTIVE match per
 *      payment; a PAID_FULLY charge refuses loudly (never a silent no-op).
 *
 *   3. AUTHORIZED REVERSAL (reverseMatch): undoes a match FAITHFULLY — the
 *      charge is restored from the match's stored before-snapshot (the same
 *      forensic pattern as reinstateLedgerEntry: restore what was, never
 *      recompute what might have been), the match is marked reversed, the
 *      proof re-opens in the queue, and the reversal is audited. The MONEY
 *      is never rewritten: the payment's ledger row stays booked (retiring
 *      the payment itself is the separate, reason-gated void lifecycle).
 *
 *   4. STATUS TRACKING (getReconciliationMatches, getReconciliationReportHistory):
 *      the match ledger and the checker's report history — the two records a
 *      founder reads to answer "is the money tied to its obligations?".
 *
 * Conventions (same contract as every money surface):
 *   - staff-only: requireStaffCaller (strict bearer-session identity, portal
 *     roles blocked) with the caller's own firmId, firm-scoped entities.
 *   - every write carries a REQUIRED reason (min 3 chars) + full
 *     before-snapshot — the financial_audit_log contract.
 *   - integer kobo internally for the charge state math (Round F §6);
 *     storage stays naira @2dp.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffCaller } from "./callerAuth";
import { roundMoney } from "./moneyUtils";

// ─── Shared helpers ──────────────────────────────────────────────────────────

const MIN_REASON_LENGTH = 3;

function assertReason(reason: string): string {
  const clean = String(reason || "").trim();
  if (clean.length < MIN_REASON_LENGTH) {
    throw new Error(
      `A reason is required for every reconciliation action (min ${MIN_REASON_LENGTH} characters). This is the audit trail — an unexplained match is exactly the "records I don't remember" the lifecycle system exists to end.`
    );
  }
  return clean;
}

function snapshot(row: any): any {
  if (!row) return null;
  const out: any = { ...row };
  if (out._id !== undefined) out._id = String(out._id);
  return out;
}

async function writeAudit(
  ctx: any,
  args: {
    firmId: string;
    tableName: string;
    recordId: string;
    action: string;
    actorEmail?: string | null;
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
    actorUserId: null,
    reason: args.reason,
    ...(args.beforeState !== undefined ? { beforeState: args.beforeState } : {}),
    ...(args.afterState !== undefined ? { afterState: args.afterState } : {}),
    ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    createdAt: Date.now(),
  });
  return String(auditId);
}

// ─── 1. The unallocated queue ────────────────────────────────────────────────

/**
 * getUnallocatedPayments — the queue the reconciliation console renders.
 * Read-only, staff-only, firm-scoped.
 */
export const getUnallocatedPayments = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = args.firmId;

    // Active matches keyed by proof — a proof with an active match is tied;
    // a reversed match re-opens the proof in the queue.
    const matches = (await ctx.db
      .query("reconciliation_matches")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(3000)) as any[];
    const activeMatchByProof = new Map<string, any>();
    for (const m of matches || []) {
      if (String(m.status ?? "") !== "active") continue;
      activeMatchByProof.set(String(m.proofId), m);
    }

    // Settled proofs with money: in the queue when they carry neither a
    // settlement-time charge link nor an active match.
    const proofs = (await ctx.db
      .query("payment_proofs")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(3000)) as any[];
    const unmatched: any[] = [];
    for (const p of proofs || []) {
      const settled = String(p.status ?? "") === "approved" || String(p.status ?? "") === "verified";
      if (!settled) continue;
      const hasMoney = typeof p.amount === "number" && p.amount > 0;
      if (!hasMoney) continue;
      if (p.linkedChargeId) continue;
      if (activeMatchByProof.has(String(p._id))) continue;
      unmatched.push({
        id: String(p._id),
        tenantName: p.tenantName ?? null,
        tenantEmail: p.tenantEmail ?? null,
        amount: roundMoney(Number(p.amount)),
        period: p.period ?? null,
        method: p.paymentMethod ?? null,
        ledgerEntryId: p.ledgerEntryId ? String(p.ledgerEntryId) : null,
        settledAt: p.updatedAt ?? p.createdAt ?? null,
      });
    }
    unmatched.sort((a, b) => (b.settledAt ?? 0) - (a.settledAt ?? 0));

    // Credits waiting: charges holding overpayment credit.
    const charges = (await ctx.db
      .query("service_charges")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(3000)) as any[];
    const credits: any[] = [];
    for (const c of charges || []) {
      const credit = Number(c.creditCarriedForward) || 0;
      if (credit <= 0) continue;
      credits.push({
        id: String(c._id),
        category: c.category ?? null,
        unitId: c.unitId ? String(c.unitId) : null,
        credit: roundMoney(credit),
        status: c.serviceChargeStatus ?? null,
      });
    }
    credits.sort((a, b) => b.credit - a.credit);

    return {
      unmatchedProofs: unmatched.slice(0, 200),
      unmatchedCount: unmatched.length,
      unmatchedTotal: roundMoney(unmatched.reduce((s, p) => s + (Number(p.amount) || 0), 0)),
      creditsWaiting: credits.slice(0, 200),
      creditsCount: credits.length,
      creditsTotal: roundMoney(credits.reduce((s, c) => s + (Number(c.credit) || 0), 0)),
    };
  },
});

// ─── 2. Match a settled proof to its obligation ──────────────────────────────

/**
 * matchProofToCharge — tie a settled payment proof to the service charge it
 * was paying. The money is ALREADY booked (the proof's ledger row, written
 * atomically at settlement by the H1 fix); this settles the OBLIGATION side
 * and records the join. Idempotent per proof; every guard refuses loudly.
 */
export const matchProofToCharge = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    proofId: v.string(),
    chargeId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = args.firmId;
    const reason = assertReason(args.reason);

    // ── Load + guard the proof. ──────────────────────────────────────────
    let proof: any = null;
    try {
      proof = await ctx.db.get(args.proofId as any);
    } catch {
      proof = null;
    }
    if (!proof || String(proof.firmId ?? "") !== firmId) {
      throw new Error("Payment proof not found or does not belong to your firm.");
    }
    const settled = String(proof.status ?? "") === "approved" || String(proof.status ?? "") === "verified";
    if (!settled) {
      throw new Error("Only settled proofs (approved or verified) can be matched — the money must be booked first.");
    }
    const matchedAmount = roundMoney(Number(proof.amount) || 0);
    if (matchedAmount <= 0) {
      throw new Error("This settled proof carries no money to match.");
    }

    // ── Idempotency: one ACTIVE match per payment. ────────────────────────
    const existingMatches = await ctx.db
      .query("reconciliation_matches")
      .withIndex("by_proof", (q: any) => q.eq("proofId", args.proofId))
      .take(50);
    const activeMatch = (existingMatches || []).find(
      (m: any) => String(m.status ?? "") === "active" && String(m.firmId ?? "") === firmId
    );
    if (activeMatch) {
      return {
        success: true,
        duplicate: true,
        matchId: String((activeMatch as any)._id),
        chargeId: String((activeMatch as any).chargeId),
      };
    }

    // ── Load + guard the charge. ──────────────────────────────────────────
    let charge: any = null;
    try {
      charge = await ctx.db.get(args.chargeId as any);
    } catch {
      charge = null;
    }
    if (!charge || String(charge.firmId ?? "") !== firmId) {
      throw new Error("Service charge not found or does not belong to your firm.");
    }
    if (String(charge.serviceChargeStatus ?? "") === "PAID_FULLY") {
      throw new Error(
        "This charge is already paid in full — there is nothing left to match against. Matching would double-credit the obligation. If the payment belongs elsewhere, match it to its real charge."
      );
    }

    // ── Settle the charge's state (kobo-internal; the SAME math the
    //    settlement-time linkage uses — see portals.settleProofInternal). ──
    const kb = (n: any): number => Math.round((Number(n) || 0) * 100);
    const naira = (kobo: number): number => Math.round((kobo / 100) * 100) / 100;

    const chargeAmountKb = kb(charge.amount);
    const previouslyPaidKb = kb(charge.amountPaidThisCycle);
    const matchedKb = kb(matchedAmount);
    const rawOutstandingKb = chargeAmountKb - previouslyPaidKb - matchedKb;
    const outstandingKb = Math.max(0, rawOutstandingKb);
    const existingCreditKb = kb(charge.creditCarriedForward);
    const creditKb = rawOutstandingKb < 0 ? -rawOutstandingKb : existingCreditKb;
    const fullyPaid = outstandingKb <= 0;

    const chargeBefore = snapshot(charge);
    const now = Date.now();
    await ctx.db.patch(args.chargeId as any, {
      serviceChargeStatus: fullyPaid ? "PAID_FULLY" : "PARTIALLY_PAID",
      outstandingBalance: fullyPaid ? 0 : naira(outstandingKb),
      amountPaidThisCycle: fullyPaid ? 0 : naira(previouslyPaidKb + matchedKb),
      creditCarriedForward: naira(creditKb),
      lastPaidDate: now,
      ...(fullyPaid
        ? {
            nextDueDate:
              now +
              (charge.cycle === "Monthly" ? 30 * 86400000 : charge.cycle === "Quarterly" ? 90 * 86400000 : 365 * 86400000),
            isDefaulter: false,
            daysOverdue: 0,
            penaltyApplied: false,
          }
        : {}),
      consecutiveReminderCount: 0,
      remindersPaused: false,
    } as any);

    // ── Persist the join + the proof linkage (the queue's source of truth). ──
    const matchId = await ctx.db.insert("reconciliation_matches", {
      firmId,
      proofId: args.proofId,
      ledgerEntryId: proof.ledgerEntryId ? String(proof.ledgerEntryId) : undefined,
      matchedAmount,
      chargeId: args.chargeId,
      chargeBefore,
      matchedBy: (auth as any).email ?? args.userEmail ?? null,
      matchedAt: now,
      reason,
      status: "active",
    });
    await ctx.db.patch(args.proofId as any, { linkedChargeId: args.chargeId } as any);

    // ── Audit (the who/when/why + both before-states). ────────────────────
    await writeAudit(ctx, {
      firmId,
      tableName: "reconciliation_matches",
      recordId: String(matchId),
      action: "reconcile_match",
      actorEmail: (auth as any).email ?? args.userEmail ?? null,
      reason,
      beforeState: { charge: chargeBefore, proofLinkedChargeId: proof.linkedChargeId ?? null },
      afterState: {
        chargeStatus: fullyPaid ? "PAID_FULLY" : "PARTIALLY_PAID",
        outstanding: naira(outstandingKb),
        credit: naira(creditKb),
        proofLinkedChargeId: args.chargeId,
      },
      metadata: { matchedAmount, chargeCategory: charge.category ?? null },
    });

    return {
      success: true,
      duplicate: false,
      matchId: String(matchId),
      chargeStatus: fullyPaid ? "PAID_FULLY" : "PARTIALLY_PAID",
      outstanding: naira(outstandingKb),
      credit: naira(creditKb),
    };
  },
});

// ─── 3. Reverse a match (audited, faithful) ──────────────────────────────────

/**
 * reverseMatch — undo a match: restore the charge EXACTLY from the stored
 * before-snapshot, mark the match reversed, re-open the proof in the queue.
 * The payment's ledger row is NOT touched (retiring the payment itself is
 * the separate void lifecycle — a reversal here is a bookkeeping correction,
 * not a money movement).
 */
export const reverseMatch = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    matchId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = args.firmId;
    const reason = assertReason(args.reason);

    let match: any = null;
    try {
      match = await ctx.db.get(args.matchId as any);
    } catch {
      match = null;
    }
    if (!match || String(match.firmId ?? "") !== firmId) {
      throw new Error("Match not found or does not belong to your firm.");
    }
    if (String(match.status ?? "") !== "active") {
      throw new Error("Only active matches can be reversed.");
    }

    // ── Restore the charge from the stored before-snapshot (faithful). ────
    const before = (match.chargeBefore ?? {}) as any;
    let charge: any = null;
    try {
      charge = await ctx.db.get(match.chargeId as any);
    } catch {
      charge = null;
    }
    if (charge) {
      const chargeBeforeNow = snapshot(charge);
      await ctx.db.patch(match.chargeId as any, {
        serviceChargeStatus: before.serviceChargeStatus ?? charge.serviceChargeStatus ?? undefined,
        outstandingBalance: before.outstandingBalance ?? undefined,
        amountPaidThisCycle: before.amountPaidThisCycle ?? undefined,
        creditCarriedForward: before.creditCarriedForward ?? undefined,
        lastPaidDate: before.lastPaidDate ?? undefined,
        nextDueDate: before.nextDueDate ?? undefined,
        isDefaulter: before.isDefaulter ?? undefined,
        daysOverdue: before.daysOverdue ?? undefined,
        penaltyApplied: before.penaltyApplied ?? undefined,
      } as any);
      await writeAudit(ctx, {
        firmId,
        tableName: "service_charges",
        recordId: String(match.chargeId),
        action: "reconcile_reversal_restore",
        actorEmail: (auth as any).email ?? args.userEmail ?? null,
        reason: `Match ${args.matchId} reversed — charge restored to its pre-match state`,
        beforeState: chargeBeforeNow,
        afterState: snapshot(before),
        metadata: { matchId: args.matchId },
      });
    }

    // ── Mark the match reversed. ──────────────────────────────────────────
    const matchBefore = snapshot(match);
    await ctx.db.patch(args.matchId as any, {
      status: "reversed",
      reversedAt: Date.now(),
      reversedBy: (auth as any).email ?? args.userEmail ?? null,
      reversalReason: reason,
    } as any);

    // ── Re-open the proof in the queue (clear the linkage this match wrote). ──
    let proof: any = null;
    try {
      proof = await ctx.db.get(match.proofId as any);
    } catch {
      proof = null;
    }
    if (proof && String(proof.linkedChargeId ?? "") === String(match.chargeId)) {
      await ctx.db.patch(match.proofId as any, { linkedChargeId: undefined } as any);
    }

    await writeAudit(ctx, {
      firmId,
      tableName: "reconciliation_matches",
      recordId: args.matchId,
      action: "reconcile_reversal",
      actorEmail: (auth as any).email ?? args.userEmail ?? null,
      reason,
      beforeState: matchBefore,
      afterState: { status: "reversed", proofReopened: !!proof },
      metadata: { reversedChargeRestored: !!charge },
    });

    return { success: true, chargeRestored: !!charge, proofReopened: !!proof };
  },
});

// ─── 4. Status tracking reads ────────────────────────────────────────────────

/** The match ledger — newest first, bounded, firm-scoped. */
export const getReconciliationMatches = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    chargeId: v.optional(v.string()),
    proofId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

    let rows: any[];
    if (args.proofId) {
      rows = await ctx.db
        .query("reconciliation_matches")
        .withIndex("by_proof", (q: any) => q.eq("proofId", args.proofId!))
        .take(limit);
    } else if (args.chargeId) {
      rows = await ctx.db
        .query("reconciliation_matches")
        .withIndex("by_charge", (q: any) => q.eq("chargeId", args.chargeId!))
        .take(limit);
    } else {
      rows = await ctx.db
        .query("reconciliation_matches")
        .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId!))
        .take(limit);
    }

    const filtered = (rows || [])
      .filter((m: any) => String(m.firmId ?? "") === args.firmId)
      .sort((a: any, b: any) => (Number(b.matchedAt) || 0) - (Number(a.matchedAt) || 0))
      .slice(0, limit);

    return filtered.map((m: any) => ({
      id: String(m._id),
      proofId: String(m.proofId),
      chargeId: String(m.chargeId),
      matchedAmount: roundMoney(Number(m.matchedAmount) || 0),
      reason: m.reason ?? null,
      matchedBy: m.matchedBy ?? null,
      matchedAt: Number(m.matchedAt) || 0,
      status: String(m.status ?? "active"),
      reversedAt: m.reversedAt ? Number(m.reversedAt) : null,
      reversedBy: m.reversedBy ?? null,
      reversalReason: m.reversalReason ?? null,
    }));
  },
});

/**
 * The checker's report history — newest first. Round D removed the old
 * getLatestFinancialReconciliation as an orphan with zero product callers;
 * this is its properly-wired successor (the console renders it).
 */
export const getReconciliationReportHistory = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);
    const rows = await ctx.db
      .query("financial_reconciliation_reports")
      .withIndex("by_ran_at", (q: any) => q.gte("ranAt", 0))
      .order("desc")
      .take(limit);
    return (rows || []).map((r: any) => ({
      id: String(r._id),
      ranAt: Number(r.ranAt) || 0,
      ok: r.ok === true,
      walletDebitsWithoutLedger: Number(r.walletDebitsWithoutLedger) || 0,
      approvedProofsUnbooked: Number(r.approvedProofsUnbooked) || 0,
      invalidAmountRows: Number(r.invalidAmountRows) || 0,
      duplicateReceiptNumbers: Number(r.duplicateReceiptNumbers) || 0,
      balanceDriftWallets: Number(r.balanceDriftWallets) || 0,
      legacyWalletDebits: Number(r.legacyWalletDebits) || 0,
      legacyApprovedProofs: Number(r.legacyApprovedProofs) || 0,
      unmatchedSettledProofs: Number(r.unmatchedSettledProofs) || 0,
      creditsWaiting: Number(r.creditsWaiting) || 0,
    }));
  },
});
