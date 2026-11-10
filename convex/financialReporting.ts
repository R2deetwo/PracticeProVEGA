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
import { createUnitResolver } from "./unitLookup";

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

// ─── ROUND F (Wave F3): the report suite read ────────────────────────────────
//
// The owner brief §5: rent roll, arrears aging, service-charge collections,
// revenue by type, payment history, period comparison — plus CSV export on
// the client. Every figure is computed HERE, server-side, kobo-internally
// (the money-truth discipline: the client renders and exports what the
// server computed, never its own arithmetic).
export const getFinancialReports = query({
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

    const kb = (naira: any): number => Math.round((Number(naira) || 0) * 100);
    const naira = (kobo: number): number => Math.round((kobo / 100) * 100) / 100;
    const resolver = createUnitResolver(ctx, firmId);

    // ── Raw rows (bounded takes, the same bounds as F1). ─────────────────
    const ledgerRows = ((await ctx.db
      .query("ledger_entries")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(4000)) || []) as any[];
    const activeLedger = ledgerRows.filter((r) => isActiveFinancialRecord(r.recordStatus));
    const charges = ((await ctx.db
      .query("service_charges")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(3000)) || []) as any[];
    const properties = ((await ctx.db
      .query("properties")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000)) || []) as any[];
    const tenancies = ((await ctx.db
      .query("tenancies")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000)) || []) as any[];

    // ── Unit-key resolution cache (shape-proof: any id form → one key). ──
    const keyCache = new Map<string, string | null>();
    const keyFor = async (rawId: any): Promise<string | null> => {
      const raw = String(rawId || "");
      if (!raw) return null;
      if (keyCache.has(raw)) return keyCache.get(raw) ?? null;
      let key: string | null = null;
      try {
        const ref = await resolver.resolveUnit(raw);
        if (ref) {
          const propPart = String(ref.propertyId);
          const unitPart = ref.unit ? String((ref.unit as any).id ?? (ref.unit as any).unitName ?? "") : "";
          key = unitPart ? `${propPart}_${unitPart}` : propPart;
        }
      } catch {
        key = null;
      }
      keyCache.set(raw, key);
      return key;
    };

    // ── Newest payment per unit (for the rent roll's last-payment column). ──
    const newestPaymentByUnit = new Map<string, any>();
    for (const row of activeLedger) {
      if (row.status !== "cleared") continue;
      const key = await keyFor(row.unitId);
      if (!key) continue;
      const prev = newestPaymentByUnit.get(key);
      if (!prev || (Number(row.timestamp) || 0) > (Number(prev.timestamp) || 0)) {
        newestPaymentByUnit.set(key, row);
      }
    }

    // ── Active tenancy per unit. ──────────────────────────────────────────
    const activeTenancyByUnit = new Map<string, any>();
    for (const t of tenancies) {
      if (String(t.status ?? "") !== "active") continue;
      const key = await keyFor(t.unitId);
      if (!key) continue;
      const prev = activeTenancyByUnit.get(key);
      if (!prev || String(t.startDate ?? "") > String(prev.startDate ?? "")) {
        activeTenancyByUnit.set(key, t);
      }
    }

    // ── REPORT 1: the rent roll — every unit in the firm, its current lease
    //    state, and its last received payment. ─────────────────────────────
    const rentRoll: any[] = [];
    for (const p of properties) {
      const embedded: any[] = Array.isArray(p.units) ? (p.units as any[]) : [];
      const addr0 = String(p.address || "Property").split(",")[0];
      const propId = String(p._id);
      if (embedded.length > 0) {
        for (const u of embedded) {
          const unitPart = String(u.id ?? u.unitName ?? "");
          const key = unitPart ? `${propId}_${unitPart}` : propId;
          const rd = (u.rentalDetails || {}) as any;
          const tenancy = activeTenancyByUnit.get(key) ?? null;
          const last = newestPaymentByUnit.get(key) ?? null;
          rentRoll.push({
            unitKey: key,
            unitLabel: u.unitName ? `${String(u.unitName)} · ${addr0}` : addr0,
            status: (u.status ?? p.status ?? null) as string | null,
            leaseActive: !!tenancy,
            tenantName: tenancy?.tenantName ?? u.tenantName ?? rd.tenantName ?? null,
            rent: naira(kb(Number((tenancy as any)?.rent ?? (tenancy as any)?.rentAmount ?? u.rentAmount ?? rd.rentAmount) || 0)),
            frequency: (tenancy?.paymentFrequency ?? u.rentFrequency ?? rd.rentFrequency ?? null) as string | null,
            leaseStart: (tenancy?.startDate ? String(tenancy.startDate).slice(0, 10) : (u.leaseStart ?? rd.leaseStart ?? null)) as string | null,
            leaseEnd: (tenancy?.endDate ? String(tenancy.endDate).slice(0, 10) : (u.leaseEnd ?? rd.leaseEnd ?? null)) as string | null,
            lastPaymentAt: last ? Number(last.timestamp) || 0 : null,
            lastPaymentAmount: last ? naira(kb(last.amount)) : null,
            lastPaymentRef: last?.paymentRef ? String(last.paymentRef) : null,
          });
        }
      } else {
        const rd = (p.rentalDetails || {}) as any;
        const tenancy = activeTenancyByUnit.get(propId) ?? null;
        const last = newestPaymentByUnit.get(propId) ?? null;
        rentRoll.push({
          unitKey: propId,
          unitLabel: rd.unitName ? `${String(rd.unitName)} · ${addr0}` : addr0,
          status: (p.status ?? null) as string | null,
          leaseActive: !!tenancy,
          tenantName: tenancy?.tenantName ?? rd.tenantName ?? null,
          rent: naira(kb(Number((tenancy as any)?.rent ?? (tenancy as any)?.rentAmount ?? rd.rentAmount) || 0)),
          frequency: (tenancy?.paymentFrequency ?? rd.rentFrequency ?? null) as string | null,
          leaseStart: (tenancy?.startDate ? String(tenancy.startDate).slice(0, 10) : (rd.leaseStart ?? null)) as string | null,
          leaseEnd: (tenancy?.endDate ? String(tenancy.endDate).slice(0, 10) : (rd.leaseEnd ?? null)) as string | null,
          lastPaymentAt: last ? Number(last.timestamp) || 0 : null,
          lastPaymentAmount: last ? naira(kb(last.amount)) : null,
          lastPaymentRef: last?.paymentRef ? String(last.paymentRef) : null,
        });
      }
    }
    rentRoll.sort((a, b) => String(a.unitLabel).localeCompare(String(b.unitLabel)));

    // ── REPORT 2: arrears aging — unsettled charges bucketed by days
    //    overdue (0-30 / 31-60 / 61-90 / 90+), credit-netted. ───────────────
    const BUCKETS = [
      { label: "0-30 days", min: 0, max: 30 },
      { label: "31-60 days", min: 31, max: 60 },
      { label: "61-90 days", min: 61, max: 90 },
      { label: "90+ days", min: 91, max: Infinity },
    ];
    const bucketKb = BUCKETS.map(() => 0);
    const bucketCount = BUCKETS.map(() => 0);
    const arrearsRows: any[] = [];
    const now = Date.now();
    for (const c of charges) {
      if (String(c.serviceChargeStatus ?? "") === "PAID_FULLY") continue;
      const amount = Number(c.amount) || 0;
      const credit = Number(c.creditCarriedForward) || 0;
      let outstanding = 0;
      if (String(c.serviceChargeStatus ?? "") === "PARTIALLY_PAID") {
        outstanding = typeof c.outstandingBalance === "number"
          ? Math.max(0, Number(c.outstandingBalance))
          : Math.max(0, amount - (Number(c.amountPaidThisCycle) || 0));
      } else {
        outstanding = Math.max(0, amount - credit);
      }
      if (outstanding <= 0) continue;
      const days = Number(c.daysOverdue) || Math.max(0, Math.floor((now - (Number(c.nextDueDate) || now)) / 86400000));
      const idx = BUCKETS.findIndex((b) => days >= b.min && days <= b.max);
      const bi = idx >= 0 ? idx : 3;
      bucketKb[bi] += kb(outstanding);
      bucketCount[bi] += 1;
      arrearsRows.push({
        category: String(c.category ?? "Charge"),
        unitId: c.unitId ? String(c.unitId) : null,
        daysOverdue: days,
        outstanding: naira(kb(outstanding)),
      });
    }
    arrearsRows.sort((a, b) => b.daysOverdue - a.daysOverdue);
    const arrearsAging = {
      buckets: BUCKETS.map((b, i) => ({ label: b.label, outstanding: naira(bucketKb[i]), count: bucketCount[i] })),
      rows: arrearsRows.slice(0, 200),
    };

    // ── REPORT 3: service-charge collections by category (current cycle). ──
    const catMap = new Map<string, { charges: number; cycleAmountKb: number; collectedKb: number; outstandingKb: number }>();
    for (const c of charges) {
      const cat = String(c.category ?? "Other");
      const cur = catMap.get(cat) ?? { charges: 0, cycleAmountKb: 0, collectedKb: 0, outstandingKb: 0 };
      cur.charges += 1;
      cur.cycleAmountKb += kb(c.amount);
      const status = String(c.serviceChargeStatus ?? "");
      let outstanding = 0;
      if (status === "PARTIALLY_PAID") {
        outstanding = typeof c.outstandingBalance === "number" ? Math.max(0, Number(c.outstandingBalance)) : Math.max(0, Number(c.amount) - (Number(c.amountPaidThisCycle) || 0));
      } else if (status !== "PAID_FULLY") {
        outstanding = Math.max(0, Number(c.amount) - (Number(c.creditCarriedForward) || 0));
      }
      cur.outstandingKb += kb(outstanding);
      // Collected THIS cycle: fully-paid rows collected their full amount
      // (amountPaidThisCycle was reset to 0 on full payment); partial rows
      // hold the running figure. Reconstruct honestly: full → amount; else
      // amountPaidThisCycle.
      const collectedThisCycle = status === "PAID_FULLY" ? Number(c.amount) || 0 : Number(c.amountPaidThisCycle) || 0;
      cur.collectedKb += kb(collectedThisCycle);
      catMap.set(cat, cur);
    }
    const scCollections = {
      byCategory: Array.from(catMap.entries())
        .map(([category, v]) => ({
          category,
          charges: v.charges,
          cycleAmount: naira(v.cycleAmountKb),
          collectedThisCycle: naira(v.collectedKb),
          outstanding: naira(v.outstandingKb),
        }))
        .sort((a, b) => b.outstanding - a.outstanding),
    };

    // ── REPORT 4: revenue by type, last 6 months (income + at-risk). ─────
    const monthKeys: string[] = [];
    const now2 = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now2.getFullYear(), now2.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const monthMap = new Map<string, { incomeKb: number; riskKb: number; byType: Map<string, number> }>();
    for (const k of monthKeys) monthMap.set(k, { incomeKb: 0, riskKb: 0, byType: new Map() });
    for (const r of activeLedger) {
      const d = new Date(Number(r.timestamp) || 0);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = monthMap.get(key);
      if (!bucket) continue;
      const t = String(r.type ?? "other");
      if (r.status === "cleared") {
        bucket.incomeKb += kb(r.amount);
        bucket.byType.set(t, (bucket.byType.get(t) ?? 0) + kb(r.amount));
      } else {
        bucket.riskKb += kb(r.amount);
      }
    }
    const revenueByType = {
      months: monthKeys.map((k) => {
        const b = monthMap.get(k)!;
        return {
          key: k,
          income: naira(b.incomeKb),
          risk: naira(b.riskKb),
          byType: Array.from(b.byType.entries())
            .map(([type, kbv]) => ({ type, amount: naira(kbv) }))
            .sort((a, b2) => b2.amount - a.amount),
        };
      }),
    };

    // ── REPORT 5: payment history (newest first, bounded). ────────────────
    const paymentHistory = activeLedger
      .filter((r) => r.status === "cleared")
      .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
      .slice(0, 200)
      .map((r) => ({
        at: Number(r.timestamp) || 0,
        unitId: r.unitId ? String(r.unitId) : null,
        tenantId: r.tenantId ? String(r.tenantId) : null,
        type: String(r.type ?? "other"),
        channel: r.channel ? String(r.channel) : null,
        paymentRef: r.paymentRef ? String(r.paymentRef) : null,
        amount: naira(kb(r.amount)),
      }));

    // ── REPORT 6: period comparison — this month vs the previous one. ────
    const thisKey = monthKeys[monthKeys.length - 1];
    const prevKey = monthKeys[monthKeys.length - 2];
    const thisB = monthMap.get(thisKey)!;
    const prevB = monthMap.get(prevKey)!;
    const thisCount = activeLedger.filter((r) => {
      const d = new Date(Number(r.timestamp) || 0);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === thisKey;
    }).length;
    const prevCount = activeLedger.filter((r) => {
      const d = new Date(Number(r.timestamp) || 0);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === prevKey;
    }).length;
    const periodComparison = {
      current: { key: thisKey, income: naira(thisB.incomeKb), risk: naira(thisB.riskKb), count: thisCount },
      previous: { key: prevKey, income: naira(prevB.incomeKb), risk: naira(prevB.riskKb), count: prevCount },
      delta: {
        income: naira(thisB.incomeKb - prevB.incomeKb),
        risk: naira(thisB.riskKb - prevB.riskKb),
        count: thisCount - prevCount,
      },
    };

    return {
      rentRoll,
      arrearsAging,
      scCollections,
      revenueByType,
      paymentHistory,
      periodComparison,
      // The totals-vs-transactions proof inputs (the export and the tests
      // assert these equal the raw row sums — the §5 reconciliation of
      // totals to transaction records).
      proof: {
        clearedTotal: naira(activeLedger.filter((r) => r.status === "cleared").reduce((s, r) => s + kb(r.amount), 0)),
        clearedCount: activeLedger.filter((r) => r.status === "cleared").length,
        activeRows: activeLedger.length,
        outstandingTotal: naira(bucketKb.reduce((s, x) => s + x, 0)),
      },
    };
  },
});
