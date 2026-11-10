/**
 * convex/financialReporting.ts — ROUND F (Wave F1): the financial overview
 * console read.
 * ─────────────────────────────────────────────────────────────────────────────
 * The owner brief §1 gap: the pieces existed (Round B cash-flow summary,
 * Round E per-property rollup, real outstanding balances) but there was no
 * unified, filterable control center — one read the Financials surface can
 * open that answers, in a single view: what came in, what is at risk, what
 * is awaiting review, what is unapplied, and what happened lately.
 *
 * Conventions honored here (the same contract as every money read):
 *   - staff-only: requireStaffCaller (strict bearer-session identity,
 *     portal roles blocked) with the caller's own firmId.
 *   - read-only: nothing here writes.
 *   - active records only: voided/test ledger rows are annotations, not
 *     money — the exact predicate the aggregates share (financialIntegrity).
 *   - integer kobo internally (Round F §6): every total below is computed
 *     in kobo and converted back to naira @2dp once, at the end. Storage
 *     stays naira @2dp — the kobo storage migration is a separate,
 *     deliberately deferred wave.
 */
import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffCaller } from "./callerAuth";
import { isActiveFinancialRecord } from "./financialIntegrity";

export const getFinancialOverview = query({
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

    // ── Kobo-internal helpers (Round F §6). ─────────────────────────────
    const kb = (naira: any): number => Math.round((Number(naira) || 0) * 100);
    const naira = (kobo: number): number => Math.round((kobo / 100) * 100) / 100;

    // ── Ledger (bounded take, active rows only). ────────────────────────
    const ledgerRows = (await ctx.db
      .query("ledger_entries")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(4000)) as any[];
    const active = (ledgerRows || []).filter((r) => isActiveFinancialRecord(r.recordStatus));
    const cleared = active.filter((r) => r.status === "cleared");
    const pending = active.filter((r) => r.status === "pending");
    const defaulted = active.filter((r) => r.status === "defaulted");

    let incomeKb = 0;
    let riskKb = 0;
    const byType = new Map<string, { kb: number; count: number }>();
    for (const r of cleared) {
      incomeKb += kb(r.amount);
      const t = String(r.type ?? "other");
      const cur = byType.get(t) ?? { kb: 0, count: 0 };
      cur.kb += kb(r.amount);
      cur.count += 1;
      byType.set(t, cur);
    }
    for (const r of [...pending, ...defaulted]) {
      riskKb += kb(r.amount);
      const t = String(r.type ?? "other");
      const cur = byType.get(t) ?? { kb: 0, count: 0 };
      cur.kb += kb(r.amount);
      cur.count += 1;
      byType.set(t, cur);
    }

    // Monthly buckets for the last 6 months (same key format as the Round B
    // cash-flow summary so the two surfaces can never disagree by format).
    const now = new Date();
    const monthlyData: Record<string, { income: number; risk: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyData[key] = { income: 0, risk: 0 };
    }
    for (const r of active) {
      const d = new Date(Number(r.timestamp) || 0);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyData[key]) continue;
      if (r.status === "cleared") monthlyData[key].income += naira(kb(r.amount));
      else monthlyData[key].risk += naira(kb(r.amount));
    }

    // ── Payment proofs (the review queue at a glance). ──────────────────
    const proofs = (await ctx.db
      .query("payment_proofs")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(3000)) as any[];
    let pendingReview = 0;
    let pendingVerification = 0;
    let rejected = 0;
    for (const p of proofs || []) {
      const s = String(p.status ?? "");
      if (s === "pending_review") pendingReview++;
      else if (s === "pending_verification") pendingVerification++;
      else if (s === "rejected" || s === "declined") rejected++;
    }

    // ── Service charges (the obligations side). ─────────────────────────
    const charges = (await ctx.db
      .query("service_charges")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(3000)) as any[];
    let outstandingKb = 0;
    let creditsWaitingKb = 0;
    let unpaid = 0;
    let partiallyPaid = 0;
    let defaulters = 0;
    const byCategory = new Map<string, { outstandingKb: number; count: number }>();
    for (const c of charges || []) {
      const status = String(c.serviceChargeStatus ?? "");
      if (status === "PAID_FULLY") continue;
      const amount = Number(c.amount) || 0;
      const credit = Number(c.creditCarriedForward) || 0;
      let out = 0;
      if (status === "PARTIALLY_PAID") {
        out = typeof c.outstandingBalance === "number" ? Math.max(0, Number(c.outstandingBalance)) : Math.max(0, amount - (Number(c.amountPaidThisCycle) || 0));
      } else {
        out = Math.max(0, amount - credit);
      }
      if (out > 0) outstandingKb += kb(out);
      if (status === "UNPAID") unpaid++;
      else if (status === "PARTIALLY_PAID") partiallyPaid++;
      if (c.isDefaulter === true) defaulters++;
      if (credit > 0) creditsWaitingKb += kb(credit);
      const cat = String(c.category ?? "Other");
      const cur = byCategory.get(cat) ?? { outstandingKb: 0, count: 0 };
      cur.outstandingKb += kb(out);
      cur.count += 1;
      byCategory.set(cat, cur);
    }

    // ── Recent activity (the last 12 ledger movements, newest first). ───
    const recentActivity = [...active]
      .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
      .slice(0, 12)
      .map((r) => ({
        id: String(r._id),
        type: String(r.type ?? "other"),
        status: String(r.status ?? ""),
        amount: naira(kb(r.amount)),
        timestamp: Number(r.timestamp) || 0,
        channel: r.channel ? String(r.channel) : null,
        unitId: r.unitId ? String(r.unitId) : null,
        description: r.description ? String(r.description) : null,
      }));

    return {
      cashFlow: {
        totalIncome: naira(incomeKb),
        revenueAtRisk: naira(riskKb),
        totalTransactions: active.length,
        clearedCount: cleared.length,
        pendingCount: pending.length,
        defaultedCount: defaulted.length,
        monthlyData,
      },
      collections: {
        byType: Array.from(byType.entries())
          .map(([type, v]) => ({ type, amount: naira(v.kb), count: v.count }))
          .sort((a, b) => b.amount - a.amount),
      },
      proofs: {
        pendingReview,
        pendingVerification,
        rejected,
      },
      serviceCharges: {
        outstanding: naira(outstandingKb),
        unpaid,
        partiallyPaid,
        defaulters,
        creditsWaiting: naira(creditsWaitingKb),
        byCategory: Array.from(byCategory.entries())
          .map(([category, v]) => ({ category, outstanding: naira(v.outstandingKb), count: v.count }))
          .sort((a, b) => b.outstanding - a.outstanding),
      },
      unallocated: {
        // The two work queues that exist TODAY (the reconciliation workflow
        // in Wave F2 builds its matched/unmatched status on these + the
        // proofs-awaiting-review queue).
        creditsWaiting: naira(creditsWaitingKb),
        proofsAwaitingReview: pendingReview + pendingVerification,
      },
      recentActivity,
    };
  },
});
