import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser } from "./authHelpers";
import { createUnitResolver, canonicalTenantId } from "./unitLookup";
import { withCronReporting } from "./observability";
import { assertValidChargeType } from "./chargeTypes";
import { assertPositiveAmount, assertNonNegativeAmount, roundMoney } from "./moneyUtils";

// ─── QUERY BOUNDING POLICY (Item 4, perf — 2026-09-12) ────────────────────────
// Every read in this module is BOUNDED. Firm-scoped reads (by_firm index)
// carry per-firm caps (500–2000). Platform-wide CRON scans (overdue
// flagging, cycle resets, minimum-vend provisioning) carry generous caps
// (5000) — the cron repeats, so a capped pass retries what it missed, and
// the read is never unbounded. No public function signature changed.

// ─── AUTH HELPER ────────────────────────────────────────────────────────────

/**
 * SECURITY: Strict auth for all sentry operations.
 * Sentry functions previously trusted client-supplied firmId with ZERO
 * caller verification — anyone could read/write ANY firm's ledger, service
 * charges, pipeline and inbox (critical IDOR). This helper enforces:
 *   1. Caller has a verified bearer session (requireFirmUser validates the
 *      sessionToken hash against the sessions table; the caller-supplied
 *      userEmail arg is ignored — see authHelpers.ts). Portal roles
 *      Tenant/Client are blocked by requireFirmUser.
 *   2. If a firmId is supplied, it must match the caller's own firm.
 * Returns the verified auth context so writes use the session-derived
 * firmId, never raw client input.
 */
async function requireSentryAuth(
  ctx: any,
  userEmail: string | undefined,
  firmId?: string,
  sessionToken?: string | null
) {
  // R16 strict (Phase B, burned in): pass the bearer token through —
  const auth = await requireFirmUser(ctx, userEmail, sessionToken);
  if (!auth.firmId || !auth.user) {
    throw new Error("Unauthenticated: a verified user session is required for this operation.");
  }
  if (firmId !== undefined && auth.firmId !== firmId) {
    throw new Error("Not authorized: cannot access data belonging to a different firm.");
  }
  return auth;
}

/** Resolve a property by custom id or Convex _id and verify firm ownership. */
async function requirePropertyAccess(ctx: any, auth: { firmId: string }, propertyOrUnitId: string) {
  let prop: any = await ctx.db
    .query("properties")
    .withIndex("by_custom_id", (q: any) => q.eq("id", propertyOrUnitId))
    .first();
  if (!prop) {
    try { prop = await ctx.db.get(propertyOrUnitId as any) || null; } catch { prop = null; }
  }
  if (!prop) throw new Error("Property not found");
  if (prop.firmId !== auth.firmId) {
    throw new Error("Not authorized: property belongs to a different firm.");
  }
  return prop;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

/** Simple deterministic hash for append-only enforcement.
 *  ROUND B: exported so wallets.ts can stamp identical txHash provenance on
 *  the ledger rows written by the auto-deduct cron. */
export function makeTxHash(firmId: string, unitId: string, amount: number, timestamp: number, type: string): string {
  const raw = `${firmId}|${unitId}|${amount}|${timestamp}|${type}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = Math.imul(31, h) + raw.charCodeAt(i) | 0;
  }
  return `TX-${Math.abs(h).toString(16).toUpperCase().padStart(8, "0")}`;
}

// ─── LEDGER ─────────────────────────────────────────────────────────────────

export const addLedgerEntry = mutation({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    propertyId: v.optional(v.string()),
    unitId: v.string(),
    tenantId: v.optional(v.string()),
    amount: v.number(),
    // EXTENSIBLE CHARGES (Task 51): free string validated against the firm's
    // charge_types registry — the 5 system types plus any custom types the
    // firm has added under Settings → Charge Types.
    type: v.string(),
    status: v.union(v.literal("pending"), v.literal("cleared"), v.literal("defaulted")),
    paymentRef: v.optional(v.string()),
    channel: v.optional(v.string()),
    description: v.optional(v.string()),
    period: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    // IDEMPOTENCY (accounting-integrity round, 2026-09-14): the offline
    // queue replays this mutation on reconnect with the SAME args — with
    // no key, one flaky connection DUPLICATED revenue entries (one of the
    // "records I don't remember" origins). A client-generated key makes
    // the replay a no-op. Legacy callers omitting the key keep working.
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: verify caller + firm ownership; write with session-derived firmId
    const auth = await requireSentryAuth(ctx, args.userEmail, args.firmId, args.sessionToken);

    // ── ROUND B (M5): money mutations validate the amount server-side.
    //    Zero/negative/NaN ledger amounts used to commit silently.
    const amount = assertPositiveAmount(args.amount, "Ledger entry amount");

    // EXTENSIBLE CHARGES (Task 51): reject unknown types BEFORE any write —
    // system types pass, custom types must be active registry entries.
    await assertValidChargeType(ctx, auth.firmId, "ledger", args.type);

    // Dedupe on the idempotency key BEFORE any write (same contract as
    // settleUnitPeriods / markChargeAsPaid).
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("ledger_entries")
        .withIndex("by_idempotency", (q: any) => q.eq("idempotencyKey", args.idempotencyKey!))
        .first();
      if (existing) {
        return existing._id;
      }
    }

    const { userEmail: _u, firmId: _f, sessionToken: _st, ...data } = args;
    const timestamp = Date.now();
    const txHash = makeTxHash(auth.firmId, args.unitId, amount, timestamp, args.type);
    return await ctx.db.insert("ledger_entries", {
      ...data,
      amount,
      firmId: auth.firmId,
      timestamp,
      txHash,
    });
  },
});

// ─── HISTORICAL PERIOD SETTLEMENT (Phase 3 — OnboardUnitLedgerModal → ledger) ─
/**
 * settleUnitPeriods — writes ledger_entries rows for billing periods marked
 * paid/late/advance_paid in the OnboardUnitLedgerModal ("Settle Historical
 * Ledger" during unit onboarding).
 *
 * WHY: the modal previously only persisted status pills into the unit's
 * rentalDetails.scPeriods/mvPeriods blob. The firm-wide revenue ledger
 * (RevenueMonitor → getLedgerByFirm) reads ledger_entries — so quick-settled
 * historical revenue was INVISIBLE in every ledger/revenue view.
 *
 * IDEMPOTENT: each period gets a stable key
 *   settle-{firmId}-{unitId}-{chargeType}-{periodIndex}
 * so re-submitting the property form (or re-running settlement) never
 * duplicates entries. Outstanding periods are intentionally NOT written —
 * the unit's scPeriods tracks those; the ledger records money that moved.
 *
 * Timestamp uses paidDate > dueDate > now so revenue attributes to the
 * correct historical month in reporting.
 */
export const settleUnitPeriods = mutation({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    unitId: v.string(),
    tenantId: v.optional(v.string()),
    chargeType: v.union(v.literal("SC"), v.literal("MV")),
    periods: v.array(v.object({
      index: v.number(),
      dueDate: v.optional(v.string()),
      status: v.string(),           // 'paid' | 'late' | 'advance_paid' | 'outstanding'
      amount: v.optional(v.number()),
      paidDate: v.optional(v.string()),
    })),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireSentryAuth(ctx, args.userEmail, args.firmId, args.sessionToken);

    let created = 0;
    let skipped = 0;
    for (const p of args.periods) {
      const settled = p.status === "paid" || p.status === "late" || p.status === "advance_paid";
      const amount = Number(p.amount || 0);
      if (!settled || amount <= 0) {
        skipped++;
        continue;
      }

      const idempotencyKey = `settle-${auth.firmId}-${args.unitId}-${args.chargeType}-${p.index}`;
      const existing = await ctx.db
        .query("ledger_entries")
        .withIndex("by_idempotency", (q: any) => q.eq("idempotencyKey", idempotencyKey))
        .first();
      if (existing) {
        skipped++;
        continue;
      }

      // Historical timestamp: paidDate > dueDate > now (revenue attribution)
      let timestamp = Date.now();
      try {
        const t = p.paidDate ? new Date(p.paidDate).getTime() : p.dueDate ? new Date(p.dueDate).getTime() : NaN;
        if (!isNaN(t)) timestamp = t;
      } catch {}

      const txHash = makeTxHash(auth.firmId, args.unitId, amount, timestamp, "service_charge");
      await ctx.db.insert("ledger_entries", {
        firmId: auth.firmId,
        unitId: args.unitId,
        tenantId: args.tenantId,
        amount,
        type: "service_charge",
        status: "cleared",
        timestamp,
        txHash,
        channel: "Historical Settlement",
        idempotencyKey,
        period: p.dueDate,
        description:
          `Historical ${args.chargeType === "SC" ? "Service Charge" : "Minimum Vend"} period #${p.index}` +
          `${p.dueDate ? ` (${p.dueDate})` : ""} — settled during onboarding` +
          `${p.status === "late" ? " (paid late)" : p.status === "advance_paid" ? " (advance payment)" : ""}`,
      });
      created++;
    }

    return { success: true, created, skipped };
  },
});

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * The superseded rent-console twins removed (this record covers all eleven: getLedgerByFirm, getLedgerByUnit, updateLedgerStatus, getDefaulters, getPipelineByUnit, getAuditTrail, getCommunicationsForPrint, checkSpamGuard, setPropertyRemindersEnabled, setUnitRemindersMuted, unpauseReminders): all properly gated (requireSentryAuth) with ZERO product callers. The live Financials surface reads via getCashFlowSummary / getPipelineByFirm / getServiceChargesByFirm / getInboundMessages (all retained below). The ledger detail reads, the defaulter list, the reminders-settings trio and the print/audit/spam-guard reads never had UI.
 */

// ─── ATOMIC RENT COLLECTION (ROUND B — M6 + M8, money truth) ────────────────

/**
 * collectRentPayment — ONE server-side transaction for a rent collection.
 *
 * WHY THIS EXISTS (audit M6/M8): the CollectRentModal online path used to be
 * FOUR separate writes — (1) updateItem('properties', …rentPaymentHistory…),
 * (2) a legacy updateItem('contacts', …) mirror, (3) addLedgerEntry(rent),
 * (4) addLedgerEntry(management_fee) — with the receipt number minted on the
 * CLIENT (`REC-{timestamp}-{random}`: collisions possible, no sequence, no
 * uniqueness anywhere) and NO idempotency key on the ledger writes. A network
 * retry mid-sequence left the books in EITHER of two broken states: rent
 * history says paid but the ledger never heard of it, or the ledger booked
 * the rent twice while the property row advanced once.
 *
 * NOW: receipt number (server-side sequential counter per firm — two
 * same-second collections get distinct consecutive numbers by construction),
 * property rentPaymentHistory append, rent ledger entry and the optional
 * management-fee entry ALL commit in this single Convex transaction, deduped
 * by the caller's idempotencyKey (an offline-queue replay is a no-op that
 * returns the original receipt number).
 */
export const collectRentPayment = mutation({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    // The property record the rent history lives on (custom id or Convex id).
    propertyId: v.string(),
    // The ledger's unitId — may be an embedded/composite unit key, exactly
    // like the unitId addLedgerEntry receives elsewhere.
    unitId: v.string(),
    tenantId: v.optional(v.string()),
    amount: v.number(),                     // FULL rent received (receipt is always for what was paid)
    paymentMethod: v.optional(v.string()),
    transactionRef: v.optional(v.string()),
    periodStart: v.optional(v.string()),
    periodEnd: v.optional(v.string()),
    paymentDate: v.optional(v.string()),    // ISO date (defaults to today)
    // Management fee (separate obligation the landlord owes the firm — booked
    // as a PENDING ledger entry; the client still generates its invoice).
    feeAmount: v.optional(v.number()),
    // One key per SUBMIT (client-generated uuid, shared by the offline queue
    // replay) — a retried collection returns the original receipt instead of
    // double-booking.
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireSentryAuth(ctx, args.userEmail, args.firmId, args.sessionToken);

    // ── ROUND B (M5): validate money server-side before anything is read.
    const amount = assertPositiveAmount(args.amount, "Rent amount");
    const feeAmount = args.feeAmount !== undefined
      ? assertNonNegativeAmount(args.feeAmount, "Management fee amount")
      : 0;

    // ── IDEMPOTENCY: a replayed collection (offline queue, retry, double-tap)
    //    must return the ORIGINAL receipt, never book twice. The rent entry
    //    carries the key; its paymentRef IS the receipt number.
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("ledger_entries")
        .withIndex("by_idempotency", (q: any) => q.eq("idempotencyKey", args.idempotencyKey!))
        .first();
      if (existing) {
        return {
          success: true,
          duplicate: true,
          receiptNumber: (existing as any).paymentRef ?? null,
          rentLedgerId: existing._id,
        };
      }
    }

    // ── Property access + current history (read inside the transaction so
    //    the append is atomic: two concurrent collections of the same
    //    property serialize here and each sees the other's append).
    const prop = await requirePropertyAccess(ctx, auth, args.propertyId);
    const now = Date.now();
    const paidDate = args.paymentDate || new Date(now).toISOString();

    // ── M8: server-side sequential receipt number, unique per firm. The
    //    financial_counters row is read-modify-written INSIDE this
    //    transaction — Convex's serializable isolation makes concurrent
    //    collections conflict on the same counter row, so one retries and
    //    takes the next number. Sequential AND unique by construction.
    const counter = await ctx.db
      .query("financial_counters")
      .withIndex("by_firm_scope", (q: any) => q.eq("firmId", auth.firmId).eq("scope", "receipts"))
      .first();
    let sequence: number;
    if (counter) {
      sequence = counter.value + 1;
      await ctx.db.patch(counter._id, { value: sequence, updatedAt: now });
    } else {
      sequence = 1;
      await ctx.db.insert("financial_counters", { firmId: auth.firmId, scope: "receipts", value: sequence, updatedAt: now });
    }
    const receiptNumber = `REC-${String(sequence).padStart(5, "0")}`;

    // ── 1. Property rent history — the receipt records the FULL amount.
    const newPayment = {
      id: args.idempotencyKey ?? `rent-${now}`,
      dueDate: paidDate,
      paidDate,
      amount,
      status: "paid" as const,
      paymentMethod: args.paymentMethod,
      receiptNumber,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      transactionRef: args.transactionRef,
    };
    const updatedHistory = [...((prop as any).rentPaymentHistory || []), newPayment];
    await ctx.db.patch(prop._id, {
      rentPaymentHistory: updatedHistory,
      status: "Occupied",
    } as any);

    // ── 2. Ledger: rent received (cleared).
    const txHash = makeTxHash(auth.firmId, args.unitId, amount, now, "rent");
    const rentLedgerId = await ctx.db.insert("ledger_entries", {
      firmId: auth.firmId,
      propertyId: args.propertyId,
      unitId: args.unitId,
      tenantId: args.tenantId,
      amount,
      type: "rent",
      status: "cleared",
      timestamp: now,
      txHash,
      channel: args.transactionRef || args.paymentMethod || "Rent collection",
      paymentRef: receiptNumber,
      idempotencyKey: args.idempotencyKey ?? undefined,
      description: `Rent collection for ${args.unitId}${args.periodStart ? ` (${args.periodStart}${args.periodEnd ? ` to ${args.periodEnd}` : ""})` : ""}`,
    });

    // ── 3. Ledger: management fee (pending — the landlord owes the firm;
    //    the client generates the matching invoice separately).
    let feeLedgerId: any = null;
    if (feeAmount > 0) {
      const feeHash = makeTxHash(auth.firmId, args.unitId, feeAmount, now, "management_fee");
      feeLedgerId = await ctx.db.insert("ledger_entries", {
        firmId: auth.firmId,
        propertyId: args.propertyId,
        unitId: args.unitId,
        tenantId: args.tenantId,
        amount: feeAmount,
        type: "management_fee",
        status: "pending",
        timestamp: now,
        txHash: feeHash,
        channel: args.transactionRef || args.paymentMethod || "Rent collection",
        paymentRef: receiptNumber,
        idempotencyKey: args.idempotencyKey ? `${args.idempotencyKey}:fee` : undefined,
        description: `Management fee for rent collection ${receiptNumber}`,
      });
    }

    return { success: true, receiptNumber, rentLedgerId, feeLedgerId, newPayment };
  },
});

export const getCashFlowSummary = query({
  args: { sessionToken: v.optional(v.string()), firmId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, { firmId, userEmail , sessionToken }) => {
    await requireSentryAuth(ctx, userEmail, firmId, sessionToken);
    const entries = await ctx.db
      .query("ledger_entries")
      .withIndex("by_firm", q => q.eq("firmId", firmId))
      .take(2000);

    // FINANCIAL LIFECYCLE (accounting-integrity round): voided and
    // test-marked records are EXCLUDED from every money total — they are
    // excluded from revenue, risk and transaction counts alike, because
    // neither a reversal annotation nor test noise is money. The records
    // remain in the table and the audit log for forensics.
    const activeEntries = entries.filter(e => e.recordStatus !== "voided" && e.recordStatus !== "test");

    const cleared = activeEntries.filter(e => e.status === "cleared");
    const defaulted = activeEntries.filter(e => e.status === "defaulted");
    const pending = activeEntries.filter(e => e.status === "pending");

    const totalIncome = cleared.reduce((s, e) => s + e.amount, 0);
    const revenueAtRisk = defaulted.reduce((s, e) => s + e.amount, 0) + pending.reduce((s, e) => s + e.amount, 0);

    // Monthly buckets for the last 6 months
    const now = new Date();
    const monthlyData: Record<string, { income: number; risk: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyData[key] = { income: 0, risk: 0 };
    }

    for (const e of activeEntries) {
      const d = new Date(e.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthlyData[key]) {
        if (e.status === "cleared") monthlyData[key].income += e.amount;
        else monthlyData[key].risk += e.amount;
      }
    }

    return { totalIncome, revenueAtRisk, totalTransactions: activeEntries.length, monthlyData };
  },
});

// ─── SERVICE CHARGES ────────────────────────────────────────────────────────

export const upsertServiceCharge = mutation({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    unitId: v.string(),
    tenantId: v.optional(v.string()),
    // EXTENSIBLE CHARGES (Task 51): registry-validated category — the 5 system
    // categories plus any custom service-charge types the firm has added.
    category: v.string(),
    amount: v.number(),
    cycle: v.union(v.literal("Monthly"), v.literal("Quarterly"), v.literal("Annually")),
    nextDueDate: v.number(),
    notes: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: verify caller + firm ownership; write with session-derived firmId
    const auth = await requireSentryAuth(ctx, args.userEmail, args.firmId, args.sessionToken);

    // ── ROUND B (M5): a charge obligation must be a positive amount —
    //    zero/negative recurring charges poisoned auto-deduct and the
    //    overdue flagger (a negative charge could even CREDIT a wallet).
    const validatedAmount = assertPositiveAmount(args.amount, "Service charge amount");

    // EXTENSIBLE CHARGES (Task 51): reject unknown categories BEFORE any write.
    await assertValidChargeType(ctx, auth.firmId, "service", args.category);

    const { userEmail: _u, firmId: _f, sessionToken: _st, ...data } = args;

    // ROUND 6: auto-populate tenantId from the unit's tenant record when the
    // caller didn't supply one (no caller ever does). Without it, the charge
    // is invisible in tenant-portal dues and unreachable by wallet
    // auto-deduct. Resolver handles all four unitId shapes.
    let resolvedTenantId = args.tenantId ?? undefined;
    if (!resolvedTenantId) {
      try {
        const resolver = createUnitResolver(ctx, auth.firmId);
        const ref = await resolver.resolveUnit(args.unitId);
        if (ref) {
          resolvedTenantId = canonicalTenantId(await resolver.tenantFor(ref)) ?? undefined;
        }
      } catch {
        // Resolution is best-effort — never block the charge write itself.
      }
    }

    // Find existing charge for this unit+category
    const existing = await ctx.db
      .query("service_charges")
      .withIndex("by_unit", q => q.eq("unitId", args.unitId))
      .filter(q => q.eq(q.field("category"), args.category))
      .first();

    if (existing) {
      if (existing.firmId !== auth.firmId) {
        throw new Error("Not authorized: service charge belongs to a different firm.");
      }
      // Preserve an existing tenantId unless this call supplies a better one
      // (a bare patch with undefined would otherwise WIPE it — pre-existing
      // data-loss footgun, closed with the same change).
      const tenantId = resolvedTenantId ?? existing.tenantId;
      await ctx.db.patch(existing._id, { ...data, amount: validatedAmount, tenantId, firmId: auth.firmId, isDefaulter: false });
      return existing._id;
    }
    return await ctx.db.insert("service_charges", {
      ...data,
      amount: validatedAmount,
      tenantId: resolvedTenantId,
      firmId: auth.firmId,
      isDefaulter: false,
    });
  },
});

export const getServiceChargesByFirm = query({
  args: { sessionToken: v.optional(v.string()), firmId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, { firmId, userEmail , sessionToken }) => {
    // SECURITY: firm staff only. Portal tenants must use the tenant-scoped
    // portals.getTenantServiceCharges endpoint instead.
    await requireSentryAuth(ctx, userEmail, firmId, sessionToken);
    return await ctx.db
      .query("service_charges")
      .withIndex("by_firm", q => q.eq("firmId", firmId))
      .take(1000);
  },
});

export const applyLatePenalty = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    firmId: v.string(),
    serviceChargeId: v.id("service_charges"),
    penaltyAmount: v.number(),
    triggeredBy: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, { firmId, serviceChargeId, penaltyAmount, triggeredBy, userEmail , sessionToken }) => {
    const auth = await requireSentryAuth(ctx, userEmail, firmId, sessionToken);
    // ── ROUND B (M5): penalties are money too — validate + round server-side
    //    (a negative penalty used to write a negative pending ledger row).
    const validatedPenalty = assertPositiveAmount(penaltyAmount, "Penalty amount");
    const sc = await ctx.db.get(serviceChargeId);
    if (!sc) throw new Error("Service charge not found");
    if (sc.firmId !== auth.firmId) {
      throw new Error("Not authorized: service charge belongs to a different firm.");
    }
    // Mark penalty applied
    await ctx.db.patch(serviceChargeId, { penaltyApplied: true });
    // Write penalty to ledger
    const timestamp = Date.now();
    const txHash = makeTxHash(auth.firmId, sc.unitId, validatedPenalty, timestamp, "penalty");
    await ctx.db.insert("ledger_entries", {
      firmId: auth.firmId,
      unitId: sc.unitId,
      tenantId: sc.tenantId,
      amount: validatedPenalty,
      type: "penalty",
      status: "pending",
      timestamp,
      txHash,
      description: `Late penalty — ${sc.category} service charge`,
    });
    return { success: true };
  },
});

export const markChargeAsPaid = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    serviceChargeId: v.id("service_charges"),
    paidAmount: v.number(),
    firmId: v.string(),
    channel: v.optional(v.string()),
    isPartialPayment: v.optional(v.boolean()),
    userEmail: v.optional(v.string()),
    // IDEMPOTENCY (Phase 3): client-generated uuid per payment action. A
    // retried/double-submitted call with the same key returns the original
    // outcome instead of inserting a duplicate ledger entry (double-counted
    // revenue). Retained for backward compat: legacy calls without a key
    // behave exactly as before.
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, { serviceChargeId, paidAmount, firmId, channel, isPartialPayment, userEmail, idempotencyKey , sessionToken }) => {
    // SECURITY: verify caller + firm ownership; all writes use session firmId
    const auth = await requireSentryAuth(ctx, userEmail, firmId, sessionToken);

    // ── IDEMPOTENCY CHECK (Phase 3) ─────────────────────────────────────
    // Dedup on the client-supplied key BEFORE any write, so a network retry
    // or double-tap cannot double-credit the service charge or insert a
    // second ledger row. Returns the recorded state without side effects.
    if (idempotencyKey) {
      const existing = await ctx.db
        .query("ledger_entries")
        .withIndex("by_idempotency", (q: any) => q.eq("idempotencyKey", idempotencyKey))
        .first();
      if (existing) {
        const charge: any = await ctx.db.get(serviceChargeId);
        return {
          success: true,
          duplicate: true,
          ledgerEntryId: existing._id,
          serviceChargeStatus: charge?.serviceChargeStatus,
        };
      }
    }

    const sc = await ctx.db.get(serviceChargeId);
    if (!sc) throw new Error("Service charge not found");
    if (sc.firmId !== auth.firmId) {
      throw new Error("Not authorized: service charge belongs to a different firm.");
    }

    // ── ROUND B (M5): the paid amount is validated + rounded server-side —
    //    zero/negative "payments" used to commit silently (and a negative
    //    amount could REDUCE amountPaidThisCycle).
    const validatedPaidAmount = assertPositiveAmount(paidAmount, "Paid amount");

    // ── ROUND B (M5): overpayment credit is CARRIED FORWARD, not discarded.
    //    Previously paying ₦150k on a ₦100k charge booked ₦150k revenue but
    //    the extra ₦50k simply vanished (outstanding clamped to 0, cycle
    //    tracker reset) — the tenant's money disappeared from the books.
    //    Now the excess lands in creditCarriedForward, is consumed by the
    //    next cycle's reset / overdue flagger / wallet auto-deduct, and the
    //    ledger description records it.
    const totalAmount = sc.amount;
    const previouslyPaid = sc.amountPaidThisCycle ?? 0;
    const newTotalPaid = roundMoney(previouslyPaid + validatedPaidAmount);
    const rawOutstanding = roundMoney(totalAmount - newTotalPaid);
    const outstandingBalance = Math.max(0, rawOutstanding);
    const creditCarriedForward = rawOutstanding < 0 ? roundMoney(-rawOutstanding) : (sc.creditCarriedForward ?? 0);

    // Determine new status
    let newStatus: "PAID_FULLY" | "PARTIALLY_PAID" | "UNPAID";
    if (outstandingBalance <= 0) {
      newStatus = "PAID_FULLY";
    } else if (newTotalPaid > 0) {
      newStatus = "PARTIALLY_PAID";
    } else {
      newStatus = "UNPAID";
    }

    // If fully paid, advance nextDueDate
    let nextDueDate = sc.nextDueDate;
    let isDefaulter = sc.isDefaulter;
    let daysOverdue = sc.daysOverdue;
    let penaltyApplied = sc.penaltyApplied;

    if (newStatus === "PAID_FULLY") {
      const cycleMs = sc.cycle === "Monthly" ? 30 * 86400000 : sc.cycle === "Quarterly" ? 90 * 86400000 : 365 * 86400000;
      nextDueDate = Date.now() + cycleMs;
      isDefaulter = false;
      daysOverdue = 0;
      penaltyApplied = false;
    }

    await ctx.db.patch(serviceChargeId, {
      isDefaulter,
      lastPaidDate: Date.now(),
      nextDueDate,
      penaltyApplied,
      daysOverdue,
      serviceChargeStatus: newStatus,
      outstandingBalance: newStatus === "PAID_FULLY" ? 0 : outstandingBalance,
      amountPaidThisCycle: newStatus === "PAID_FULLY" ? 0 : newTotalPaid,
      creditCarriedForward,
      // Reset reminder tracking on any payment
      consecutiveReminderCount: 0,
      remindersPaused: false,
    });

    // Ledger entry
    const timestamp = Date.now();
    const txHash = makeTxHash(auth.firmId, sc.unitId, validatedPaidAmount, timestamp, "service_charge");
    await ctx.db.insert("ledger_entries", {
      firmId: auth.firmId,
      unitId: sc.unitId,
      tenantId: sc.tenantId,
      amount: validatedPaidAmount,
      type: "service_charge",
      status: newStatus === "PAID_FULLY" ? "cleared" : "pending",
      timestamp,
      txHash,
      channel,
      idempotencyKey: idempotencyKey ?? undefined,
      description: newStatus === "PAID_FULLY"
        ? `${sc.category} service charge — full payment${creditCarriedForward > 0 ? ` (₦${creditCarriedForward.toLocaleString()} credit carried to next cycle)` : ""}`
        : `${sc.category} service charge — partial payment (₦${newTotalPaid.toLocaleString()} of ₦${totalAmount.toLocaleString()})`,
    });

    // ── PAID Confirmation WhatsApp Message ──
    // When a tenant is marked as fully paid by the administrator,
    // send a confirmation message acknowledging the payment.
    if (newStatus === "PAID_FULLY") {
      try {
        // ROUND 6: shared unit resolver — the old by_custom_id + db.get
        // lookup only resolved standalone-property ids, so embedded units
        // (composite unitIds) silently got NO payment receipt. Also reads
        // tenant contact off the EMBEDDED UNIT (old code only checked
        // property-level rentalDetails).
        const resolver = createUnitResolver(ctx, auth.firmId);
        const ref = await resolver.resolveUnit(sc.unitId);

        if (ref) {
          const tenant = await resolver.tenantFor(ref);
          const tenantPhone: string = tenant.phone || '';
          const tenantEmail: string = tenant.email || '';
          const tenantName: string = tenant.name || 'Tenant';
          const unitName: string = ref.unit
            ? (ref.unit.unitName || ref.unit.name || ref.unit.id || 'Unit')
            : ((ref.property as any).rentalDetails?.unitName || 'Unit');
          const chargeLabel = sc.isMinimumVend ? (ref.property?.minimumVendLabel || 'Minimum Vend') : sc.category;
          const recipient = tenantPhone || tenantEmail;

          if (recipient) {
            const confirmMessage = `Dear ${tenantName}, we confirm receipt of your ${chargeLabel} service charge payment of ₦${totalAmount.toLocaleString()} for ${unitName}. Your account is now fully settled. Thank you for your prompt payment.`;
            // MESSAGES FIX: log as "sending" (not "sent") and schedule the
            // REAL dispatch for BOTH channels — previously only WhatsApp was
            // scheduled; email-channel receipts were logged "sent" but never
            // dispatched. processScheduledMessages corrects the log status
            // from the provider outcome.
            const automationLogId = await ctx.db.insert("automation_logs", {
              firmId: auth.firmId,
              unitId: sc.unitId,
              tenantId: sc.tenantId,
              messageType: "payment_receipt",
            // WHATSAPP REMOVAL (2026-09-14): the Chakra WhatsApp API
            // integration is retired. Automated sends now go EMAIL-FIRST
            // (Brevo is wired and live); phone-only tenants keep the
            // whatsapp channel so the message is composed and visible in the
            // Sent tab, where a one-tap "Share via WhatsApp" (wa.me deep
            // link with the message prefilled) lets the practitioner send
            // it manually. Receipt codes/references are embedded in the
            // content, so nothing is lost.
            channel: tenantEmail ? "email" : "whatsapp",
              recipient,
              messagePreview: confirmMessage,
              messageContent: confirmMessage,
              sentAt: Date.now(),
              status: "sending",
              triggeredBy: "admin_mark_paid",
            });
            await ctx.db.insert("scheduled_messages", {
              firmId: auth.firmId,
              content: confirmMessage,
            // WHATSAPP REMOVAL (2026-09-14): the Chakra WhatsApp API
            // integration is retired. Automated sends now go EMAIL-FIRST
            // (Brevo is wired and live); phone-only tenants keep the
            // whatsapp channel so the message is composed and visible in the
            // Sent tab, where a one-tap "Share via WhatsApp" (wa.me deep
            // link with the message prefilled) lets the practitioner send
            // it manually. Receipt codes/references are embedded in the
            // content, so nothing is lost.
            channel: tenantEmail ? "email" : "whatsapp",
              scheduledFor: Date.now(), // Send immediately
              status: "scheduled",
              messageType: "payment_receipt",
              tenantIds: [sc.tenantId || ''],
              recipientPhone: tenantPhone || undefined,
              recipientEmail: tenantEmail || undefined,
              recipientName: tenantName || undefined,
              // Template-retry data: when the free-form send is rejected
              // outside the 24h window, processScheduledMessages retries
              // with the firm's mapped payment_receipt template using these.
              templateData: {
                tenantName: tenantName || undefined,
                amount: totalAmount,
                address: unitName || undefined,
                messageText: confirmMessage,
              },
              automationLogId,
              // SCHEMA FIX: `createdBy` isn't a schema field — the schema's
              // equivalent is `triggeredBy`; `updatedAt` is required.
              triggeredBy: "system_automation",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            } as any);
          }
        }
      } catch (e) {
        // Non-blocking — don't fail the payment recording if confirmation fails
        console.warn("Failed to send PAID confirmation:", e);
      }
    }
  },
});

// Internal mutation called by cron job
export const flagOverdueCharges = internalMutation({
  args: {},
  handler: withCronReporting("crons:flagOverdueServiceCharges", async (ctx) => {
    const now = Date.now();
    // Bounded platform-wide cron scan (Item 4): overdue flagging reads at
    // most 5000 charge rows per run — cron repeats, so nothing is missed
    // for long; the read is capped instead of unbounded.
    const allCharges = await ctx.db.query("service_charges").take(5000);
    let flagged = 0;
    for (const charge of allCharges) {
      if (charge.nextDueDate < now && charge.serviceChargeStatus !== "PAID_FULLY") {
        const daysOverdue = Math.floor((now - charge.nextDueDate) / 86400000);
        // If no partial payment has been made, status stays UNPAID (or becomes UNPAID if not set)
        const currentStatus = charge.serviceChargeStatus || (charge.isDefaulter ? "UNPAID" : "UNPAID");
        // ROUND B (M5): carried-forward credit reduces what the tenant
        // actually owes for this cycle — the flagger must not chase money
        // the tenant already paid last cycle.
        const credit = Math.max(0, charge.creditCarriedForward ?? 0);
        await ctx.db.patch(charge._id, {
          isDefaulter: true,
          daysOverdue,
          // Preserve PARTIALLY_PAID if tenant has made a partial payment, otherwise UNPAID
          serviceChargeStatus: currentStatus === "PARTIALLY_PAID" ? "PARTIALLY_PAID" : "UNPAID",
          outstandingBalance: currentStatus === "PARTIALLY_PAID"
            ? Math.max(0, roundMoney((charge.outstandingBalance ?? charge.amount - (charge.amountPaidThisCycle ?? 0)) - credit))
            : Math.max(0, roundMoney(charge.amount - credit)),
        });
        flagged++;
      }
    }
    return { flagged };
  },),
});

// ─── LEADS PIPELINE ─────────────────────────────────────────────────────────

export const addLeadToPipeline = mutation({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    unitId: v.string(),
    applicantName: v.string(),
    contactInfo: v.string(),
    stage: v.optional(v.union(v.literal("Inquiry"), v.literal("Vetted"), v.literal("Lease_Generated"), v.literal("Closed"))),
    vettingScore: v.optional(v.number()),
    proposedRent: v.optional(v.number()),
    notes: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: firm staff only. The PUBLIC application form must use
    // submitPublicLead (which derives firmId server-side from the property).
    const auth = await requireSentryAuth(ctx, args.userEmail, args.firmId, args.sessionToken);
    const { userEmail: _u, firmId: _f, sessionToken: _st, ...data } = args;
    const now = Date.now();
    return await ctx.db.insert("leads_pipeline", {
      ...data,
      firmId: auth.firmId,
      stage: args.stage ?? "Inquiry",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * PUBLIC endpoint for the Atrium public vacancy application form.
 * SECURITY: unlike addLeadToPipeline (staff-only), this derives the firmId
 * SERVER-SIDE from the property record — the client never supplies it —
 * forces stage "Inquiry", and rate-limits by contact info (max 5
 * applications per contact per hour) to prevent pipeline spam flooding.
 */
export const submitPublicLead = mutation({
  args: {
    propertyId: v.string(),
    applicantName: v.string(),
    contactInfo: v.string(),
    proposedRent: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Resolve the property — by custom id first, then Convex _id
    let prop: any = await ctx.db
      .query("properties")
      .withIndex("by_custom_id", (q: any) => q.eq("id", args.propertyId))
      .first();
    if (!prop) {
      try { prop = await ctx.db.get(args.propertyId as any) || null; } catch { prop = null; }
    }
    if (!prop) throw new Error("Property not found");

    // Rate limit: max 5 leads per contactInfo per rolling hour
    const oneHourAgo = Date.now() - 3600000;
    const recent = await ctx.db
      .query("leads_pipeline")
      .withIndex("by_unit", (q: any) => q.eq("unitId", args.propertyId))
      .filter((q: any) => q.eq(q.field("contactInfo"), args.contactInfo))
      .take(500);
    if (recent.filter((l: any) => l.createdAt >= oneHourAgo).length >= 5) {
      throw new Error("Too many applications from this contact. Please try again later.");
    }

    const now = Date.now();
    return await ctx.db.insert("leads_pipeline", {
      firmId: prop.firmId,
      unitId: args.propertyId,
      applicantName: args.applicantName,
      contactInfo: args.contactInfo,
      stage: "Inquiry",
      proposedRent: args.proposedRent,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const advanceLeadStage = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    leadId: v.id("leads_pipeline"),
    stage: v.union(v.literal("Inquiry"), v.literal("Vetted"), v.literal("Lease_Generated"), v.literal("Closed")),
    vettingScore: v.optional(v.number()),
    notes: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, { leadId, stage, vettingScore, notes, userEmail , sessionToken }) => {
    // SECURITY: verify caller owns this lead's firm
    const auth = await requireSentryAuth(ctx, userEmail, undefined, sessionToken);
    const lead = await ctx.db.get(leadId);
    if (!lead) throw new Error("Lead not found");
    if (lead.firmId !== auth.firmId) {
      throw new Error("Not authorized: lead belongs to a different firm.");
    }
    await ctx.db.patch(leadId, { stage, vettingScore, notes, updatedAt: Date.now() });
  },
});

export const getPipelineByFirm = query({
  args: { sessionToken: v.optional(v.string()), firmId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, { firmId, userEmail , sessionToken }) => {
    await requireSentryAuth(ctx, userEmail, firmId, sessionToken);
    return await ctx.db
      .query("leads_pipeline")
      .withIndex("by_firm", q => q.eq("firmId", firmId))
      .take(500);
  },
});

// ─── AUTOMATION LOGS ────────────────────────────────────────────────────────

export const logAutomation = mutation({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    unitId: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    // NOTE: receipt issuance flows (Quick Payment Drawer auto-issue +
    // ReceiptModal manual issue) log as "payment_receipt". A caller once
    // passed "receipt_issued" — NOT in this union — so Convex rejected the
    // log write AFTER the receipt had already been delivered to the
    // resident's portal, the receipt number was never persisted and the UI
    // reported failure. Keep receipt payloads flowing through
    // src/utils/receiptDelivery.ts (buildReceiptLogArgs), which the
    // receiptDelivery.test.ts contract locks to this literal.
    messageType: v.union(
      v.literal("custom"),
      v.literal("rent_reminder"),
      v.literal("late_notice"),
      v.literal("payment_receipt"),
      v.literal("service_charge_alert"),
      v.literal("access_restriction"),
      v.literal("penalty_notice"),
      v.literal("lease_renewal"),
    ),
    channel: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("sms"), v.literal("portal"), v.literal("in-app")),
    recipient: v.string(),
    messagePreview: v.optional(v.string()),
    messageContent: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("outbound"), v.literal("inbound"))),
    senderName: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("simulated")),
    // WHY IT FAILED / PROOF OF DELIVERY (2026-09-08): previously callers
    // could not store the provider's error text or the gateway message id,
    // so a failed WhatsApp/email showed as "failed" with NO reason — the
    // user had no way to learn that e.g. Meta rejected a free-form message
    // outside the 24-hour window. AutomationCenter already passed
    // errorMessage (which Convex REJECTED as an unknown field — the log
    // row silently never persisted); it is now a declared arg.
    errorMessage: v.optional(v.string()),
    // MAPPED failure class (Task 39/Item 1) — persisted so the Sent tab
    // renders the mapped reason (raw provider text stays behind Details).
    errorClass: v.optional(v.string()),
    messageId: v.optional(v.string()),
    triggeredBy: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: verify caller + firm ownership; write with session firmId
    const auth = await requireSentryAuth(ctx, args.userEmail, args.firmId, args.sessionToken);
    const { userEmail: _u, firmId: _f, sessionToken: _st, ...data } = args;
    return await ctx.db.insert("automation_logs", { ...data, firmId: auth.firmId, sentAt: Date.now() });
  },
});

export const getAutomationLogs = query({
  args: { sessionToken: v.optional(v.string()), firmId: v.string(), limit: v.optional(v.number()), userEmail: v.optional(v.string()) },
  handler: async (ctx, { firmId, limit, userEmail , sessionToken }) => {
    await requireSentryAuth(ctx, userEmail, firmId, sessionToken);
    return await ctx.db
      .query("automation_logs")
      .withIndex("by_firm", q => q.eq("firmId", firmId))
      .order("desc")
      .take(limit ?? 50);
  },
});

// ─── SENT TAB ROW MANAGEMENT (2026-09-14) ───────────────────────────────────
// USER DIRECTIVE: "sent messages — there's no way to delete a message or
// archive these things." Archive = soft-hide (restorable, keeps the audit
// trail); delete = permanent removal (firm-verified, like every other
// destructive sentry action).

export const archiveAutomationLog = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    logId: v.id("automation_logs"),
    archived: v.optional(v.boolean()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, { logId, archived, userEmail, sessionToken }) => {
    // SECURITY: verify the caller belongs to the log's firm (same pattern
    // as deleteInboundMessage — auth first, then firm ownership).
    const auth = await requireSentryAuth(ctx, userEmail, undefined, sessionToken);
    const log = await ctx.db.get(logId);
    if (!log) throw new Error("Message log not found");
    if (log.firmId !== auth.firmId) {
      throw new Error("Not authorized: log belongs to a different firm.");
    }
    const next = archived ?? true;
    await ctx.db.patch(logId, {
      isArchived: next,
      archivedAt: next ? Date.now() : undefined,
    });
    return { archived: next };
  },
});

export const deleteAutomationLog = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    logId: v.id("automation_logs"),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, { logId, userEmail, sessionToken }) => {
    const auth = await requireSentryAuth(ctx, userEmail, undefined, sessionToken);
    const log = await ctx.db.get(logId);
    if (!log) throw new Error("Message log not found");
    if (log.firmId !== auth.firmId) {
      throw new Error("Not authorized: log belongs to a different firm.");
    }
    await ctx.db.delete(logId);
    return { deleted: true };
  },
});

// ─── SENT TAB: GROUPED RECIPIENT OPERATIONS (2026-09-14) ────────────────────
// USER DIRECTIVE: "why are sent messages not organized in terms of who they
// are sent to so that instead of having to delete messages one at a time we
// can delete all messages sent to a particular person at once?" The Sent tab
// now groups rows by recipient; these mutations operate on a whole recipient
// group in one call (firm-verified like the per-row variants).

export const archiveAutomationLogsByRecipient = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    recipient: v.string(),
    archived: v.optional(v.boolean()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, { recipient, archived, userEmail, sessionToken }) => {
    const auth = await requireSentryAuth(ctx, userEmail, undefined, sessionToken);
    const next = archived ?? true;
    // by_firm scan bounded at 1000 (mirrors getAutomationLogs' window) —
    // recipient-matched rows are a subset.
    const logs = await ctx.db
      .query("automation_logs")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .filter((q: any) => q.eq(q.field("recipient"), recipient))
      .take(1000);
    for (const log of logs) {
      await ctx.db.patch(log._id, {
        isArchived: next,
        archivedAt: next ? Date.now() : undefined,
      });
    }
    return { recipient, archived: next, updated: logs.length };
  },
});

export const deleteAutomationLogsByRecipient = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    recipient: v.string(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, { recipient, userEmail, sessionToken }) => {
    const auth = await requireSentryAuth(ctx, userEmail, undefined, sessionToken);
    const logs = await ctx.db
      .query("automation_logs")
      .withIndex("by_firm", (q: any) => q.eq("firmId", auth.firmId))
      .filter((q: any) => q.eq(q.field("recipient"), recipient))
      .take(1000);
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }
    return { recipient, deleted: logs.length };
  },
});

// ─── MESSAGES DELIVERY FIX ──────────────────────────────────────────────────
// The automation crons previously wrote status:"sent" into automation_logs at
// scheduling time and never corrected it — so the Messages screen claimed
// "email sent" / "whatsapp message sent" for messages that were never
// dispatched (or that the provider rejected). Now: crons write status
// "sending" + link the log to the scheduled_message; processScheduledMessages
// calls this internal mutation with the REAL provider outcome.
export const updateAutomationLogStatus = internalMutation({
  args: {
    logId: v.id("automation_logs"),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("simulated")),
    errorMessage: v.optional(v.string()),
    // MAPPED failure class (Task 39/Item 1) — stored alongside the raw
    // error text so the Sent tab can render the mapped reason.
    errorClass: v.optional(v.string()),
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.logId);
    if (!log) return; // log row was deleted — nothing to correct
    // Build the patch conditionally: Convex ignores undefined fields, so a
    // successful retry EXPLICITLY clears the previous failure's reason —
    // otherwise the log would keep showing the old error next to a
    // "Delivered" badge.
    const patch: any = { status: args.status };
    if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage;
    if (args.errorClass !== undefined) patch.errorClass = args.errorClass;
    if (args.messageId !== undefined) patch.messageId = args.messageId;
    if (args.status === "sent") {
      patch.errorMessage = args.errorMessage ?? "";
      patch.errorClass = args.errorClass ?? "";
    }
    await ctx.db.patch(args.logId, patch);
  },
});

// ─── AUDIT TRAIL ────────────────────────────────────────────────────────────
// Returns merged chronological timeline of outbound (automation_logs) and
// inbound (atrium_inbound_messages) communications for a firm.

export interface AuditTrailEntry {
  _id: string;
  direction: "outbound" | "inbound";
  channel: string;
  messageType?: string;
  recipient?: string;
  senderName?: string;
  senderContact?: string;
  content: string;
  timestamp: number;
  status?: string;
  triggeredBy?: string;
  unitId?: string;
  tenantId?: string;
}

export const processInboundMessage = internalMutation({
  args: {
    senderContact: v.string(),
    senderName: v.string(),
    content: v.string(),
    channel: v.union(v.literal("whatsapp"), v.literal("sms"), v.literal("email"), v.literal("portal")),
    mediaUrl: v.optional(v.string()),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Attempt to match the senderContact with a tenant
    // Phase 4 (perf): index seek via contacts.by_phone (previously a full
    // contacts table scan on EVERY inbound WhatsApp/SMS message).
    // V3 (V-MATTER-5): the seek is now FORMAT-RESILIENT. Providers deliver
    // sender numbers digits-only in E.164 (2348012345678) while stored
    // contact phones are free-form ("+234 803…", "0803…"). The old exact-
    // string seek missed every formatting variant. We probe the common
    // shapes of the SAME number — still pure index seeks, no table scan.
    const digits = (s: unknown) => (typeof s === "string" ? s.replace(/\D/g, "") : "");
    const rawSender = String(args.senderContact || "");
    const senderDigits = digits(rawSender);
    const phoneShapes = Array.from(new Set(
      [
        rawSender,
        senderDigits,
        senderDigits ? `+${senderDigits}` : "",
        senderDigits.length >= 10 ? `0${senderDigits.slice(-10)}` : "",
        senderDigits.length >= 10 ? senderDigits.slice(-10) : "",
      ].filter(Boolean)
    ));
    let contacts: any[] = [];
    for (const shape of phoneShapes) {
      const hits = await ctx.db
        .query("contacts")
        .withIndex("by_phone", (q: any) => q.eq("phone", shape))
        .take(50);
      if (hits.length > 0) {
        contacts = hits;
        break;
      }
    }

    let firmId = "unknown";
    let tenantId = undefined;
    
    if (contacts.length > 0) {
      firmId = contacts[0].firmId ?? "unknown";
      tenantId = contacts[0]._id;
    }

    await ctx.db.insert("atrium_inbound_messages", {
      firmId,
      tenantId,
      senderContact: args.senderContact,
      senderName: args.senderName,
      content: args.content,
      channel: args.channel,
      mediaUrl: args.mediaUrl,
      mimeType: args.mimeType,
      receivedAt: Date.now(),
      isRead: false,
    });
  },
});

// ─── SERVICE CHARGE WHATSAPP REMINDERS ─────────────────────────────────────
// Scans all active tenancies with unpaid or partially-paid service charges
// and triggers automated WhatsApp reminder notifications via the integration gateway.
// Called daily by cron job "serviceChargeWhatsAppReminder" at 6:30 AM UTC.
// Dynamically includes outstanding balance for PARTIALLY_PAID tenants.
export const sendServiceChargeReminders = internalMutation({
  args: {},
  handler: withCronReporting("crons:serviceChargeWhatsAppReminder", async (ctx) => {
    const now = Date.now();
    let remindersSent = 0;
    let remindersSkipped = 0;
    let remindersPausedCount = 0;

    // 1. Find all service_charges that are overdue or upcoming (nextDue within 7 days)
    // Phase 4 (perf): three index seeks replace a full table scan.
    // Union of {due within 7d} ∪ {defaulters} ∪ {partially paid} exactly
    // matches the old full-scan filter (all three OR branches covered).
    const SEVEN_DAYS_MS = 7 * 86400000;
    const [dueWindow, defaulterCharges, partialCharges] = await Promise.all([
      ctx.db
        .query("service_charges")
        .withIndex("by_next_due", (q: any) => q.lte("nextDueDate", now + SEVEN_DAYS_MS))
        .take(1000),
      ctx.db
        .query("service_charges")
        .withIndex("by_defaulter", (q: any) => q.eq("isDefaulter", true))
        .take(1000),
      ctx.db
        .query("service_charges")
        .withIndex("by_status", (q: any) => q.eq("serviceChargeStatus", "PARTIALLY_PAID"))
        .take(1000),
    ]);
    const chargeSeen = new Set<string>();
    const chargeCandidates = [...dueWindow, ...defaulterCharges, ...partialCharges].filter((sc: any) => {
      const key = String(sc._id);
      if (chargeSeen.has(key)) return false;
      chargeSeen.add(key);
      return true;
    });
    const actionableCharges = chargeCandidates.filter(sc => {
      // Skip fully paid charges
      if (sc.serviceChargeStatus === "PAID_FULLY") return false;
      const daysUntilDue = Math.floor((sc.nextDueDate - now) / 86400000);
      // Include: currently unpaid/defaulted OR partially paid OR due within the next 7 days
      return sc.isDefaulter || sc.serviceChargeStatus === "PARTIALLY_PAID" || daysUntilDue <= 7;
    });

    // Pre-load properties for property-level toggle checks.
    // Phase 4 (perf): fetch per-firm via by_firm instead of reading the
    // ENTIRE properties table — only firms that actually have actionable
    // charges are touched.
    const chargeFirmIds = new Set<string>();
    for (const sc of actionableCharges as any[]) {
      if (sc.firmId) chargeFirmIds.add(String(sc.firmId));
    }
    const propertyMap = new Map<string, any>();
    for (const fid of chargeFirmIds) {
      const firmProperties = await ctx.db
        .query("properties")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(2000);
      for (const p of firmProperties as any[]) {
        if (p.id) propertyMap.set(p.id, p);
        if (p._id) propertyMap.set(String(p._id), p);
        // Also index by unit IDs embedded in the property
        const units: any[] = (p as any).units || [];
        for (const u of units) {
          if (u.id) propertyMap.set(u.id, p);
        }
      }
    }

    // ROUND 6: shared unit resolver per firm (memoized property list) —
    // handles composite `propId_unitId` keys AND reads tenant contact off
    // the embedded unit itself. The old lookup chain (propertyMap →
    // by_custom_id → db.get) only resolved property-level ids, so embedded
    // units silently received NO reminders (and property-level reminder
    // toggles / cool-off overrides were missed for them too).
    const resolvers = new Map<string, ReturnType<typeof createUnitResolver>>();
    const getResolver = (firmId: string) => {
      let r = resolvers.get(firmId);
      if (!r) {
        r = createUnitResolver(ctx, firmId);
        resolvers.set(firmId, r);
      }
      return r;
    };

    for (const charge of actionableCharges) {
      // ── GUARD 0: Per-unit mute toggle ──
      if (charge.remindersMuted) {
        remindersSkipped++;
        continue;
      }

      // ── GUARD 1: Cool-off — if remindersPaused, skip entirely ──
      if (charge.remindersPaused) {
        remindersPausedCount++;
        remindersSkipped++;
        continue;
      }

      // 2. Resolve unit + tenant contact (all four unitId shapes) BEFORE the
      // property-level guards, so they see the parent property too.
      const resolver = getResolver(charge.firmId);
      const ref = await resolver.resolveUnit(charge.unitId);
      if (!ref) {
        remindersSkipped++;
        continue;
      }
      const tenantContact = await resolver.tenantFor(ref);

      // ── GUARD 2: Property-level reminders toggle ──
      const parentProperty: any = ref.property || propertyMap.get(charge.unitId);
      if (parentProperty && parentProperty.remindersEnabled === false) {
        remindersSkipped++;
        continue;
      }

      // Resolve cool-off threshold (property-level override or default 7)
      const coolOffThreshold = parentProperty?.reminderCoolOffDays || 7;

      // ── GUARD 3: Cool-off — check consecutive reminder count ──
      const consecutiveCount = charge.consecutiveReminderCount ?? 0;
      if (consecutiveCount >= coolOffThreshold) {
        // Auto-pause: flag the unit so admin sees REMINDERS_PAUSED_MAX_EFFORT
        await ctx.db.patch(charge._id, {
          remindersPaused: true,
        });
        remindersPausedCount++;
        remindersSkipped++;
        continue;
      }

      const effectiveDoc: any = ref.property;
      const tenantPhone: string = tenantContact.phone || '';
      const tenantEmail: string = tenantContact.email || '';
      const tenantName: string = tenantContact.name || 'Tenant';
      const unitName: string = ref.unit
        ? (ref.unit.unitName || ref.unit.name || ref.unit.id || 'Unit')
        : ((effectiveDoc.rentalDetails || {}).unitName || 'Unit');
      // Check if property has minimum vend enabled
      const minimumVendEnabled = effectiveDoc.minimumVendEnabled || false;
      const vendLabel = charge.isMinimumVend ? (effectiveDoc.minimumVendLabel || 'Minimum Vend') : null;

      if (!tenantPhone && !tenantEmail) {
        remindersSkipped++;
        continue;
      }

      // 3. Spam guard: check if we already sent a service_charge_alert in the last 24 hours
      const cutoff = now - 24 * 3600000;
      const recentAlert = await ctx.db
        .query("automation_logs")
        .withIndex("by_firm", (q: any) => q.eq("firmId", charge.firmId))
        .filter((q: any) =>
          q.and(
            q.eq(q.field("unitId"), charge.unitId),
            q.eq(q.field("messageType"), "service_charge_alert"),
            q.gte(q.field("sentAt"), cutoff)
          )
        )
        .first();

      if (recentAlert) {
        remindersSkipped++;
        continue;
      }

      // 4. Build dynamic reminder message based on payment status
      const daysOverdue = charge.isDefaulter && charge.daysOverdue
        ? charge.daysOverdue
        : Math.max(0, Math.floor((now - charge.nextDueDate) / 86400000));
      const isUpcoming = !charge.isDefaulter && charge.nextDueDate > now;
      const dueDateStr = new Date(charge.nextDueDate).toLocaleDateString('en-NG');
      const chargeLabel = charge.isMinimumVend ? (vendLabel || 'Minimum Vend') : charge.category;

      let messagePreview: string;
      if (charge.serviceChargeStatus === "PARTIALLY_PAID") {
        // Dynamic message for partial payments — include exact outstanding balance
        const outstanding = charge.outstandingBalance ?? (charge.amount - (charge.amountPaidThisCycle ?? 0));
        messagePreview = `Dear ${tenantName}, your ${chargeLabel} service charge for ${unitName} has an outstanding balance of ₦${outstanding.toLocaleString()}. You have paid ₦${(charge.amountPaidThisCycle ?? 0).toLocaleString()} of ₦${charge.amount.toLocaleString()}. Kindly complete the payment to avoid penalties.`;
      } else if (isUpcoming) {
        messagePreview = `Dear ${tenantName}, your ${chargeLabel} service charge of ₦${charge.amount.toLocaleString()} for ${unitName} is due on ${dueDateStr}. Please ensure timely payment.`;
      } else {
        messagePreview = `Dear ${tenantName}, your ${chargeLabel} service charge of ₦${charge.amount.toLocaleString()} for ${unitName} is ${daysOverdue} day(s) overdue. Kindly make payment to avoid penalties.`;
      }

      // WHATSAPP REMOVAL (2026-09-14): email-first — see the payment_receipt
      // note above. Phone-only tenants keep a whatsapp-channel row that the
      // practitioner sends manually via the Sent tab's wa.me share button.
      const channel = tenantEmail ? "email" as const : "whatsapp" as const;
      const recipient = tenantPhone || tenantEmail;

      // 6. Log the automation and create a scheduled_message for the real
      // dispatch. The processScheduledMessages cron (internalAction) will
      // pick it up and send via Brevo/Chakra, then correct this log's
      // status to the REAL provider outcome via updateAutomationLogStatus.
      // MESSAGES FIX: (a) the log starts as "sending" — NOT "sent" — so it
      // can never claim delivery before dispatch; (b) an email-channel
      // scheduled_message is now created too (previously email-channel
      // reminders were logged "sent" but NEVER scheduled — nothing was
      // dispatched at all); (c) the recipient contact is embedded so
      // dispatch doesn't depend on a tenantId → users lookup.
      const automationLogId = await ctx.db.insert("automation_logs", {
        firmId: charge.firmId,
        unitId: charge.unitId,
        tenantId: charge.tenantId,
        messageType: "service_charge_alert",
        channel,
        recipient,
        messagePreview,
        messageContent: messagePreview,
        sentAt: now,
        status: "sending",
        triggeredBy: "cron_service_charge_reminder",
      });

      // Create a scheduled_message for the REAL dispatch (both channels)
      await ctx.db.insert("scheduled_messages", {
        firmId: charge.firmId,
        content: messagePreview,
        channel: channel === "whatsapp" ? "whatsapp" : "email",
        scheduledFor: now, // Send immediately
        status: "scheduled",
        // Align with AutomationMessageType and the automation_logs entry —
        // "service_charge_reminder" isn't a mappable type, so the template
        // fallback could never resolve a mapping for it.
        messageType: "service_charge_alert",
        tenantIds: [charge.tenantId || ''],
        recipientPhone: tenantPhone || undefined,
        recipientEmail: tenantEmail || undefined,
        recipientName: tenantName || undefined,
        // Template-retry data for the 24h-window fallback.
        templateData: {
          tenantName: tenantName || undefined,
          amount: charge.amount,
          serviceCharge: charge.amount,
          address: unitName || undefined,
          dueDate: dueDateStr,
          messageText: messagePreview,
        },
        automationLogId,
        // SCHEMA FIX: createdBy → triggeredBy; updatedAt required
        triggeredBy: "system_cron",
        createdAt: now,
        updatedAt: now,
      } as any);

      // 7. Increment consecutive reminder counter + record last reminder timestamp
      await ctx.db.patch(charge._id, {
        consecutiveReminderCount: (charge.consecutiveReminderCount ?? 0) + 1,
        lastReminderSentAt: now,
      });

      remindersSent++;
    }

    return { remindersSent, remindersSkipped, remindersPausedCount };
  },),
});

// FIX: Wire runDailyAutomation to call the REAL sendWhatsApp action instead
// of logging "simulated" entries. The sendWhatsApp action in convex/communications.ts
// uses platform-level ChakraHQ credentials (env vars) — all firms share one account.
//
// Since internalMutation can't call ctx.runAction (only ctx.runMutation/ctx.runQuery),
// we split into: runDailyAutomation (internalMutation — scans DB, creates logs) →
// calls sendWhatsAppForAutomation (internalAction — calls the real sendWhatsApp).
export const runDailyAutomation = internalMutation({
  args: { sessionToken: v.optional(v.string()),},
  handler: withCronReporting("crons:sentryDailyAutomation", async (ctx) => {
    const now = Date.now();
    const overdueCharges = await ctx.db
      .query("service_charges")
      .withIndex("by_defaulter", (q: any) => q.eq("isDefaulter", true))
      .take(1000);

    let sentCount = 0;
    let skippedCount = 0;

    for (const charge of overdueCharges) {
      if (charge.daysOverdue !== 1) { skippedCount++; continue; }
      if (charge.remindersMuted || charge.remindersPaused) { skippedCount++; continue; }

      const property: any = await ctx.db.get(charge.unitId as any).catch(() => null);
      if (!property) { skippedCount++; continue; }

      const rd = property.rentalDetails || {};
      const tenantPhone = rd.tenantPhone || '';
      const tenantEmail = rd.tenantEmail || (property as any).tenantEmail || '';
      const tenantName = rd.tenantName || 'Resident';
      const unitName = rd.unitName || property.description || 'Unit';

      if (!tenantPhone && !tenantEmail) {
        await ctx.db.insert("automation_logs", {
          firmId: charge.firmId, unitId: charge.unitId, tenantId: charge.tenantId,
          messageType: "late_notice", channel: "whatsapp", recipient: "no_contact_on_file",
          messagePreview: `Late notice for ${tenantName} — no phone number or email on file.`,
          sentAt: now, status: "failed", triggeredBy: "system",
        });
        skippedCount++; continue;
      }

      const chargeLabel = charge.isMinimumVend ? "Electricity / Minimum Vend" : "Service Charge";
      const messageText = `Dear ${tenantName}, your ${chargeLabel} for ${unitName} is now 1 day overdue. Kindly make payment to avoid penalties. — PracticePro`;
      // MESSAGES FIX: log as "sending" (not "sent"); schedule the REAL
      // dispatch on whichever channel has a contact (previously email-only
      // tenants got a "no_phone" failure and nothing was ever sent);
      // processScheduledMessages corrects the status from the provider
      // outcome via updateAutomationLogStatus.
      // WHATSAPP REMOVAL (2026-09-14): email-first — see the payment_receipt
      // note above for the manual-share path for phone-only tenants.
      const lateChannel = tenantEmail ? "email" as const : "whatsapp" as const;
      const automationLogId = await ctx.db.insert("automation_logs", {
        firmId: charge.firmId, unitId: charge.unitId, tenantId: charge.tenantId,
        messageType: "late_notice", channel: lateChannel, recipient: tenantPhone || tenantEmail,
        messagePreview: messageText.substring(0, 100), messageContent: messageText,
        sentAt: now, status: "sending", triggeredBy: "system",
      });

      // Create a scheduled_message for the real dispatch via processScheduledMessages
      await ctx.db.insert("scheduled_messages", {
        firmId: charge.firmId,
        content: messageText,
        channel: lateChannel,
        scheduledFor: now, // Send immediately
        status: "scheduled",
        messageType: "late_notice",
        tenantIds: [charge.tenantId || ''],
        recipientPhone: tenantPhone || undefined,
        recipientEmail: tenantEmail || undefined,
        recipientName: tenantName || undefined,
        // Template-retry data for the 24h-window fallback.
        templateData: {
          tenantName: tenantName || undefined,
          amount: charge.amount,
          address: unitName || undefined,
          messageText: messageText,
        },
        automationLogId,
        // SCHEMA FIX: createdBy → triggeredBy; updatedAt required
        triggeredBy: "system_cron",
        createdAt: now,
        updatedAt: now,
      } as any);

      // Increment the reminder counter
      await ctx.db.patch(charge._id, {
        consecutiveReminderCount: (charge.consecutiveReminderCount ?? 0) + 1,
        lastReminderSentAt: now,
      });
      sentCount++;
    }
    console.log(`[runDailyAutomation] sent=${sentCount}, skipped=${skippedCount}`);
    return { sentCount, skippedCount };
  },),
});

export const getInboundMessages = query({
  args: { sessionToken: v.optional(v.string()), firmId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, { firmId, userEmail , sessionToken }) => {
    await requireSentryAuth(ctx, userEmail, firmId, sessionToken);
    return await ctx.db
      .query("atrium_inbound_messages")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .order("desc")
      .take(500);
  },
});

export const markMessageAsRead = mutation({
  args: { sessionToken: v.optional(v.string()), messageId: v.id("atrium_inbound_messages"), userEmail: v.optional(v.string()) },
  handler: async (ctx, { messageId, userEmail , sessionToken }) => {
    // SECURITY: verify caller owns this message's firm
    const auth = await requireSentryAuth(ctx, userEmail, undefined, sessionToken);
    const msg = await ctx.db.get(messageId);
    if (!msg) throw new Error("Message not found");
    if (msg.firmId !== auth.firmId) {
      throw new Error("Not authorized: message belongs to a different firm.");
    }
    await ctx.db.patch(messageId, { isRead: true });
  },
});

export const deleteInboundMessage = mutation({
  args: { sessionToken: v.optional(v.string()), messageId: v.id("atrium_inbound_messages"), userEmail: v.optional(v.string()) },
  handler: async (ctx, { messageId, userEmail , sessionToken }) => {
    // SECURITY: verify caller owns this message's firm
    const auth = await requireSentryAuth(ctx, userEmail, undefined, sessionToken);
    const msg = await ctx.db.get(messageId);
    if (!msg) throw new Error("Message not found");
    if (msg.firmId !== auth.firmId) {
      throw new Error("Not authorized: message belongs to a different firm.");
    }
    await ctx.db.delete(messageId);
  },
});

// ─── MONTHLY SERVICE CHARGE RESET ─────────────────────────────────────────
// Resets all active service charges back to UNPAID on the 1st of every month.
// Called by cron job "monthlyServiceChargeReset" at 00:30 UTC on the 1st.
// Handles both regular service charges and minimum vend charges.
export const resetMonthlyServiceCharges = internalMutation({
  args: { sessionToken: v.optional(v.string()),},
  handler: async (ctx) => {
    const now = Date.now();
    let resetCount = 0;
    let skippedCount = 0;

    // Get all service charges — bounded platform-wide cron scan (Item 4).
    const allCharges = await ctx.db.query("service_charges").take(5000);

    for (const charge of allCharges) {
      // Only reset Monthly cycle charges (Quarterly/Annual have their own cycle)
      // Also reset minimum vend charges regardless of cycle since they're monthly
      if (charge.cycle !== "Monthly" && !charge.isMinimumVend) {
        skippedCount++;
        continue;
      }

      // Skip if already reset this month (idempotency guard)
      if (charge.lastResetAt) {
        const lastReset = new Date(charge.lastResetAt);
        const currentMonth = new Date(now);
        if (lastReset.getMonth() === currentMonth.getMonth() && lastReset.getFullYear() === currentMonth.getFullYear()) {
          skippedCount++;
          continue;
        }
      }

      // Reset to UNPAID, clear cycle payment tracking.
      // ROUND B (M5): overpayment credit carried from the previous cycle is
      // CONSUMED here — it reduces (or covers) this cycle's obligation and is
      // decremented by exactly the amount used. The credit was already
      // booked to the ledger in the cycle it was overpaid, so no new ledger
      // row is written for the credited part.
      const credit = Math.max(0, charge.creditCarriedForward ?? 0);
      const creditUsed = Math.min(credit, charge.amount);
      await ctx.db.patch(charge._id, {
        serviceChargeStatus: "UNPAID",
        outstandingBalance: roundMoney(Math.max(0, charge.amount - creditUsed)),
        amountPaidThisCycle: 0,
        creditCarriedForward: roundMoney(credit - creditUsed),
        lastResetAt: now,
        // Recalculate nextDueDate for the new month
        nextDueDate: now + 30 * 86400000,
        // Clear defaulter status for the new cycle
        isDefaulter: false,
        daysOverdue: 0,
        penaltyApplied: false,
      });
      resetCount++;
    }

    // Also check for properties with minimumVendEnabled that might not have a service_charges record yet
    // Bounded platform-wide cron scan (Item 4) — properties with vend flags.
    const allProperties = await ctx.db.query("properties").take(5000);
    const propertiesWithVend = allProperties.filter(p => p.minimumVendEnabled);

    for (const prop of propertiesWithVend) {
      // Check if a minimum vend charge already exists for each unit
      const units: any[] = (prop as any).units || [];
      const unitIds = units.length > 0
        ? units.map((u: any) => u.id || u._id)
        : [prop.id];

      for (const unitId of unitIds) {
        if (!unitId) continue;

        const existingVend = allCharges.find(c =>
          c.unitId === unitId && c.isMinimumVend
        );

        if (!existingVend) {
          // Create the minimum vend charge record
          const vendAmount = (prop as any).minimumVendAmount || 0;
          if (vendAmount > 0) {
            await ctx.db.insert("service_charges", {
              firmId: prop.firmId!,
              unitId,
              tenantId: prop.tenantId || prop.currentTenantId || undefined,
              category: "Other",
              amount: vendAmount,
              cycle: "Monthly",
              nextDueDate: now + 30 * 86400000,
              isDefaulter: false,
              isMinimumVend: true,
              serviceChargeStatus: "UNPAID",
              outstandingBalance: vendAmount,
              amountPaidThisCycle: 0,
              lastResetAt: now,
            });
            resetCount++;
          }
        }
      }
    }

    return { resetCount, skippedCount };
  },
});

// ─── REMINDER TOGGLE MUTATIONS ──────────────────────────────────────────────

