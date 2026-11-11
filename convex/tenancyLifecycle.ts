/**
 * tenancyLifecycle — ROUND E (Wave E1): the tenancy lifecycle engine.
 * ─────────────────────────────────────────────────────────────────────────
 * ROUND E CONTEXT: the audit round that preceded this one asked "where does
 * resident state LIVE?" and the answer was "nowhere" — tenant identity was
 * denormalized onto properties.rentalDetails / embedded units[] and a re-let
 * OVERWROTE the previous resident in place. The tenancies table existed in
 * the schema but had zero writers. This module activates it as the canonical
 * tenancy LEDGER:
 *
 *   allocateTenant        vacant unit  → new active tenancy (guided allocation)
 *   recordExistingTenancy occupied unit with no ledger row → backfill bridge
 *   renewTenancy          active tenancy → ended('renewed') + new active row
 *   endTenancy            active tenancy → ended(move_out|terminated|other)
 *   transferTenant        active tenancy → ended('transferred') + new row on
 *                         the target unit — one atomic transaction
 *   getUnitsTenancyStatus board read: per-unitId {active, total} for the UI
 *   getUnitTenancyHistory per-unit ledger + payment attribution
 *   getResidentHistory    the consolidated resident history read
 *
 * INVARIANTS (pinned by tests/unit/roundEWave1.test.ts):
 *   1. Every function self-authenticates FIRST (requireStaffCaller — portal
 *      roles are rejected) and writes only with the session-derived firm.
 *   2. ONE unit has AT MOST ONE active tenancy — the by_firm_unit_key
 *      check-then-insert runs inside the mutation's serializable
 *      transaction (the same argument as wallet_transactions' paystack
 *      dedup), so concurrent double-submits cannot create duplicates.
 *      An optional idempotencyKey gives replay callers the same row back.
 *   3. Financial history is NEVER touched: rentPaymentHistory,
 *      ledger_entries and service_charges are read-only here. Ending a
 *      tenancy clears only the unit's tenant-identity fields — payments,
 *      receipts and balances survive the resident moving out.
 *   4. The denormalized unit fields (tenantName/Phone/Email,
 *      currentTenantId, lease dates, rent, status) stay in sync so every
 *      existing surface — portal alias matching (portals.getTenantInfo),
 *      unit cards, WhatsApp sends — keeps working unchanged.
 *
 * Unit identity: `unitId` args accept any of the FOUR shapes in production
 * data (custom id / Convex _id / composite / bare embedded id) — resolved
 * via convex/unitLookup.ts. `unitKey` stored on the ledger is the
 * NORMALIZED identity (parent Convex _id [+ embedded unit id/name]), which
 * is shape-independent — the duplicate guard cannot be bypassed by passing
 * a different spelling of the same unit.
 */
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffCaller } from "./callerAuth";
import { createUnitResolver, ResolvedUnitRef } from "./unitLookup";
import { assertNonNegativeAmount, roundMoney } from "./moneyUtils";
import { isActiveFinancialRecord } from "./financialIntegrity";

const RENT_FREQUENCIES = ["Annually", "Bi-Annually", "Quarterly", "Monthly"];
const END_REASONS = ["move_out", "terminated", "other"];

// ── Validation helpers ──────────────────────────────────────────────────────

/** Validate + normalize a YYYY-MM-DD (or full ISO) date argument. */
function isoDay(value: string | undefined | null, label: string): string {
  const s = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(s)) {
    throw new Error(`${label} must be a valid date (YYYY-MM-DD).`);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`${label} must be a valid date (YYYY-MM-DD).`);
  }
  return s.slice(0, 10);
}

function assertRentFrequency(value: string | undefined | null): string {
  const s = String(value ?? "").trim();
  if (!RENT_FREQUENCIES.includes(s)) {
    throw new Error(`Rent frequency must be one of: ${RENT_FREQUENCIES.join(", ")}.`);
  }
  return s;
}

/** Emergency contact is optional but name+phone are both-or-neither. */
function normalizeEmergency(args: {
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
}): { name: string | null; phone: string | null; relationship: string | null } {
  const name = String(args.emergencyContactName ?? "").trim() || null;
  const phone = String(args.emergencyContactPhone ?? "").trim() || null;
  const relationship = String(args.emergencyContactRelationship ?? "").trim() || null;
  if ((name && !phone) || (phone && !name)) {
    throw new Error("Emergency contact needs both a name and a phone number (or leave both blank).");
  }
  return { name, phone, relationship };
}

// ── Unit identity + snapshot helpers ────────────────────────────────────────

/** Normalized, shape-independent unit identity for the ledger. */
function unitKeyFor(ref: ResolvedUnitRef): string {
  const propPart = String(ref.propertyId);
  if (ref.unit) {
    const unitPart = String(ref.unit.id ?? ref.unit.unitName ?? "");
    return unitPart ? `${propPart}_${unitPart}` : propPart;
  }
  return propPart;
}

export interface UnitSnapshot {
  unitLabel: string;
  status: string | null;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  currentTenantId: string | null;
  rentAmount: number;
  rentFrequency: string;
  leaseStart: string;
  leaseEnd: string;
  cautionDeposit: number;
  legalFee: number;
  agencyFee: number;
}

/**
 * Read the unit's CURRENT denormalized state. Embedded units fall back to
 * the property-level fields only when the property has exactly one embedded
 * unit (the same unambiguity rule as usePropertyGroups' rentPaymentHistory
 * attribution) — otherwise a multi-unit property's shared rentalDetails
 * would bleed one unit's tenant into every sibling.
 */
function snapshotUnit(ref: ResolvedUnitRef): UnitSnapshot {
  const p = ref.property || {};
  const prd = (p.rentalDetails || {}) as any;
  const label = ref.label || String(p.address || "Unit");
  if (ref.unit) {
    const u = ref.unit as any;
    const rd = (u.rentalDetails || {}) as any;
    const embedded: any[] = Array.isArray(p.units) ? p.units : [];
    const singleEmbedded = embedded.length === 1;
    return {
      unitLabel: label,
      status: (u.status ?? null) as string | null,
      tenantName: String(u.tenantName || rd.tenantName || (singleEmbedded ? prd.tenantName : "") || "").trim(),
      tenantPhone: String(u.tenantPhone || rd.tenantPhone || (singleEmbedded ? prd.tenantPhone : "") || "").trim(),
      tenantEmail: String(u.tenantEmail || rd.tenantEmail || (singleEmbedded ? prd.tenantEmail : "") || "").trim(),
      currentTenantId: (u.currentTenantId || u.tenantId || (singleEmbedded ? (p.currentTenantId || p.tenantId) : null) || null) as string | null,
      rentAmount: Number(u.rentAmount ?? rd.rentAmount ?? (singleEmbedded ? prd.rentAmount : 0)) || 0,
      rentFrequency: String(u.rentFrequency || rd.rentFrequency || (singleEmbedded ? prd.rentFrequency : "") || ""),
      leaseStart: String(u.leaseStart || rd.leaseStart || (singleEmbedded ? prd.leaseStart : "") || ""),
      leaseEnd: String(u.leaseEnd || rd.leaseEnd || (singleEmbedded ? prd.leaseEnd : "") || ""),
      cautionDeposit: Number(u.cautionDeposit ?? rd.cautionDeposit ?? (singleEmbedded ? prd.cautionDeposit : 0)) || 0,
      legalFee: Number(u.legalFee ?? rd.legalFee ?? (singleEmbedded ? prd.legalFee : 0)) || 0,
      agencyFee: Number(u.agencyFee ?? rd.agencyFee ?? (singleEmbedded ? prd.agencyFee : 0)) || 0,
    };
  }
  // Standalone property row: the row IS the unit.
  return {
    unitLabel: label,
    status: (p.status ?? null) as string | null,
    tenantName: String(prd.tenantName || p.tenantName || "").trim(),
    tenantPhone: String(prd.tenantPhone || p.tenantPhone || "").trim(),
    tenantEmail: String(prd.tenantEmail || p.tenantEmail || "").trim(),
    currentTenantId: (p.currentTenantId || p.tenantId || null) as string | null,
    rentAmount: Number(prd.rentAmount ?? p.rentAmount) || 0,
    rentFrequency: String(prd.rentFrequency || p.rentFrequency || ""),
    leaseStart: String(prd.leaseStart || ""),
    leaseEnd: String(prd.leaseEnd || ""),
    cautionDeposit: Number(prd.cautionDeposit) || 0,
    legalFee: Number(prd.legalFee) || 0,
    agencyFee: Number(prd.agencyFee) || 0,
  };
}

/** Resolve a unitId arg to a firm-owned unit ref, or throw. */
async function resolveUnitOrThrow(ctx: any, firmId: string, unitId: string): Promise<ResolvedUnitRef> {
  const resolver = createUnitResolver(ctx, firmId);
  const ref = await resolver.resolveUnit(String(unitId || ""));
  if (!ref || !ref.property || String(ref.property.firmId ?? "") !== firmId) {
    throw new Error("Unit not found for this firm. Refresh the property and try again.");
  }
  return ref;
}

// ── Ledger lookups ──────────────────────────────────────────────────────────

async function loadTenancy(ctx: any, tenancyId: string): Promise<any> {
  let t: any = null;
  try {
    t = await ctx.db.get(tenancyId as any);
  } catch {
    t = null;
  }
  if (!t) throw new Error("Tenancy not found.");
  return t;
}

function assertTenancyFirm(t: any, firmId: string): void {
  if (String(t.firmId ?? "") !== firmId) {
    throw new Error("Not authorized: this tenancy belongs to a different firm.");
  }
}

async function findActiveTenancy(ctx: any, firmId: string, unitKey: string): Promise<any | null> {
  const rows = await ctx.db
    .query("tenancies")
    .withIndex("by_firm_unit_key", (q: any) => q.eq("firmId", firmId).eq("unitKey", unitKey))
    .collect();
  return (rows || []).find((t: any) => String(t.status ?? "") === "active") || null;
}

async function findTenancyRowsForUnit(ctx: any, firmId: string, unitKey: string): Promise<any[]> {
  const rows = await ctx.db
    .query("tenancies")
    .withIndex("by_firm_unit_key", (q: any) => q.eq("firmId", firmId).eq("unitKey", unitKey))
    .collect();
  return (rows || []).slice().sort((a: any, b: any) => String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")));
}

async function findByIdempotencyKey(ctx: any, key: string, firmId: string): Promise<any | null> {
  const rows = await ctx.db
    .query("tenancies")
    .withIndex("by_idempotency", (q: any) => q.eq("idempotencyKey", key))
    .collect();
  const hit = (rows || []).find((t: any) => String(t.firmId ?? "") === firmId) || null;
  return hit;
}

// ── Denormalized-field sync (the mirror that keeps every existing
//    surface working: portal alias matching, unit cards, WhatsApp sends) ────

export interface TenantFieldPatch {
  tenantName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  tenantContactId?: string;
  currentTenantId?: string | null;
  leaseStart?: string;
  leaseEnd?: string;
  rentAmount?: number;
  rentFrequency?: string;
  cautionDeposit?: number;
  legalFee?: number;
  agencyFee?: number;
  status?: string;
}

function mergeRd(rd: any, fields: TenantFieldPatch, mode: "set" | "clear"): any {
  const next = { ...(rd || {}) };
  if (mode === "set") {
    if (fields.tenantName !== undefined) next.tenantName = fields.tenantName;
    if (fields.tenantPhone !== undefined) next.tenantPhone = fields.tenantPhone;
    if (fields.tenantEmail !== undefined) next.tenantEmail = fields.tenantEmail;
    if (fields.tenantContactId !== undefined) next.tenantContactId = fields.tenantContactId;
    if (fields.leaseStart !== undefined) next.leaseStart = fields.leaseStart;
    if (fields.leaseEnd !== undefined) next.leaseEnd = fields.leaseEnd;
    if (fields.rentAmount !== undefined) next.rentAmount = fields.rentAmount;
    if (fields.rentFrequency !== undefined) next.rentFrequency = fields.rentFrequency;
    if (fields.cautionDeposit !== undefined) next.cautionDeposit = fields.cautionDeposit;
    if (fields.legalFee !== undefined) next.legalFee = fields.legalFee;
    if (fields.agencyFee !== undefined) next.agencyFee = fields.agencyFee;
  } else {
    // Clear ONLY the resident identity — lease/financial terms stay for the
    // next letting; payment history is on other fields and never touched.
    next.tenantName = "";
    next.tenantPhone = "";
    next.tenantEmail = "";
    if ("tenantContactId" in next) next.tenantContactId = "";
  }
  return next;
}

async function syncUnitTenantFields(
  ctx: any,
  ref: ResolvedUnitRef,
  fields: TenantFieldPatch,
  mode: "set" | "clear"
): Promise<void> {
  const p = ref.property || {};
  const now = new Date().toISOString();
  const patch: any = { updatedAt: now };

  if (!ref.unit) {
    // Standalone property row — the row IS the unit.
    patch.rentalDetails = mergeRd((p.rentalDetails || {}) as any, fields, mode);
    if (fields.status !== undefined) patch.status = fields.status;
    if (mode === "set") {
      if (fields.currentTenantId !== undefined) {
        patch.currentTenantId = fields.currentTenantId ?? null;
        patch.tenantId = fields.currentTenantId ?? null;
      }
    } else {
      patch.currentTenantId = null;
      patch.tenantId = null;
    }
    await ctx.db.patch(ref.propertyId as any, patch);
    return;
  }

  // Embedded unit — patch the matching entry of the parent's units[].
  const units: any[] = Array.isArray(p.units) ? [...p.units] : [];
  const unitPart = String(ref.unit.id ?? ref.unit.unitName ?? "");
  const idx = units.findIndex(
    (u: any) => String(u?.id ?? "") === unitPart || String(u?.unitName ?? "") === unitPart
  );
  if (idx < 0) return; // resolved ref must belong to this property; be safe.
  const u = { ...units[idx] };
  u.rentalDetails = mergeRd((u.rentalDetails || {}) as any, fields, mode);
  if (mode === "set") {
    if (fields.tenantName !== undefined) u.tenantName = fields.tenantName;
    if (fields.tenantPhone !== undefined) u.tenantPhone = fields.tenantPhone;
    if (fields.tenantEmail !== undefined) u.tenantEmail = fields.tenantEmail;
    if (fields.currentTenantId !== undefined) {
      u.currentTenantId = fields.currentTenantId ?? null;
      u.tenantId = fields.currentTenantId ?? null;
    }
    if (fields.rentAmount !== undefined) u.rentAmount = fields.rentAmount;
    if (fields.rentFrequency !== undefined) u.rentFrequency = fields.rentFrequency;
    if (fields.leaseStart !== undefined) u.leaseStart = fields.leaseStart;
    if (fields.leaseEnd !== undefined) u.leaseEnd = fields.leaseEnd;
    if (fields.cautionDeposit !== undefined) u.cautionDeposit = fields.cautionDeposit;
    if (fields.legalFee !== undefined) u.legalFee = fields.legalFee;
    if (fields.agencyFee !== undefined) u.agencyFee = fields.agencyFee;
  } else {
    u.tenantName = "";
    u.tenantPhone = "";
    u.tenantEmail = "";
    u.currentTenantId = null;
    u.tenantId = null;
  }
  if (fields.status !== undefined) u.status = fields.status;
  units[idx] = u;
  patch.units = units;

  // Single-embedded-unit property: the property-level rentalDetails/status
  // mirror this unit (usePropertyGroups falls back to them) — keep both true.
  if (units.length === 1) {
    patch.rentalDetails = mergeRd((p.rentalDetails || {}) as any, fields, mode);
    if (fields.status !== undefined) patch.status = fields.status;
    if (mode === "set") {
      if (fields.currentTenantId !== undefined) {
        patch.currentTenantId = fields.currentTenantId ?? null;
        patch.tenantId = fields.currentTenantId ?? null;
      }
    } else {
      patch.currentTenantId = null;
      patch.tenantId = null;
    }
  }
  await ctx.db.patch(ref.propertyId as any, patch);
}

async function appendTimelineEvent(ctx: any, ref: ResolvedUnitRef, description: string): Promise<void> {
  const p = ref.property || {};
  const timeline: any[] = Array.isArray(p.trackingTimeline) ? [...p.trackingTimeline] : [];
  timeline.push({
    id: `tenancy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "tenant_change",
    date: new Date().toISOString(),
    description,
  });
  await ctx.db.patch(ref.propertyId as any, { trackingTimeline: timeline.slice(-200) } as any);
}

// ── Payment attribution (read-only; mirrors usePropertyGroups' rules) ───────

function rentHistoryFor(ref: ResolvedUnitRef): any[] {
  const p = ref.property || {};
  if (ref.unit) {
    const u = ref.unit as any;
    if (Array.isArray(u.rentPaymentHistory) && u.rentPaymentHistory.length > 0) {
      return u.rentPaymentHistory;
    }
    const embedded: any[] = Array.isArray(p.units) ? p.units : [];
    const tenanted = embedded.filter((x: any) => x && x.tenantName);
    // Property-level history is unambiguous only when exactly one embedded
    // unit exists (or exactly one is tenanted) — same rule as the client.
    if (embedded.length === 1 || tenanted.length === 1) {
      return Array.isArray(p.rentPaymentHistory) ? p.rentPaymentHistory : [];
    }
    return [];
  }
  return Array.isArray(p.rentPaymentHistory) ? p.rentPaymentHistory : [];
}

function paymentsForWindow(history: any[], t: any, nowDay: string): { payments: any[]; totalPaid: number } {
  const start = t.startDate ? String(t.startDate).slice(0, 10) : null;
  const end = String(t.endedAt || t.endDate || nowDay).slice(0, 10);
  const payments = (history || []).filter((p: any) => {
    const day = String(p?.paidDate || p?.dueDate || "").slice(0, 10);
    if (!day) return false;
    if (start && day < start) return false;
    return day <= end;
  });
  const totalPaid = payments
    .filter((p: any) => p?.status === "paid")
    .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  return { payments, totalPaid };
}

// ── Shared identity fields copied through renewals/transfers ───────────────

function identityFields(t: any): Record<string, any> {
  return {
    firmId: t.firmId,
    tenantId: t.tenantId ?? null,
    tenantUserId: t.tenantUserId ?? null,
    tenantContactId: t.tenantContactId ?? null,
    tenantName: t.tenantName ?? null,
    tenantPhone: t.tenantPhone ?? null,
    tenantEmail: t.tenantEmail ?? null,
    emergencyContactName: t.emergencyContactName ?? null,
    emergencyContactPhone: t.emergencyContactPhone ?? null,
    emergencyContactRelationship: t.emergencyContactRelationship ?? null,
    cautionDeposit: t.cautionDeposit ?? null,
    legalFee: t.legalFee ?? null,
    agencyFee: t.agencyFee ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * allocateTenant — the guided allocation: register a resident onto a VACANT
 * unit. Creates the ledger row and syncs the unit's denormalized fields.
 * Occupied units are refused with guidance (record the sitting tenancy
 * first, then end/transfer it) so an allocation can never silently evict.
 */
export const allocateTenant = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    unitId: v.string(),
    tenantContactId: v.optional(v.string()),
    tenantName: v.string(),
    tenantPhone: v.optional(v.string()),
    tenantEmail: v.optional(v.string()),
    leaseStart: v.string(),
    leaseEnd: v.optional(v.string()),
    rentAmount: v.number(),
    rentFrequency: v.string(),
    cautionDeposit: v.optional(v.number()),
    legalFee: v.optional(v.number()),
    agencyFee: v.optional(v.number()),
    emergencyContactName: v.optional(v.string()),
    emergencyContactPhone: v.optional(v.string()),
    emergencyContactRelationship: v.optional(v.string()),
    notes: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = String(caller.firmId || args.firmId);

    const name = String(args.tenantName ?? "").trim();
    if (!name) throw new Error("Resident name is required.");
    const start = isoDay(args.leaseStart, "Lease start");
    const end = args.leaseEnd ? isoDay(args.leaseEnd, "Lease end") : null;
    if (end && end <= start) throw new Error("Lease end must be after lease start.");
    const rentAmount = roundMoney(assertNonNegativeAmount(args.rentAmount, "Rent amount"));
    const frequency = assertRentFrequency(args.rentFrequency);
    const emergency = normalizeEmergency(args);
    const phone = String(args.tenantPhone ?? "").trim() || null;
    const email = String(args.tenantEmail ?? "").trim().toLowerCase() || null;
    const contactId = String(args.tenantContactId ?? "").trim() || null;

    // Concurrent-submission guard 1: idempotency replay.
    if (args.idempotencyKey) {
      const existing = await findByIdempotencyKey(ctx, args.idempotencyKey, firmId);
      if (existing) return { tenancyId: existing._id, replayed: true as const };
    }

    const ref = await resolveUnitOrThrow(ctx, firmId, args.unitId);
    const unitKey = unitKeyFor(ref);
    const snap = snapshotUnit(ref);

    // Concurrent-submission guard 2: at most one ACTIVE tenancy per unit —
    // check-then-insert inside this mutation's serializable transaction.
    const active = await findActiveTenancy(ctx, firmId, unitKey);
    if (active) {
      throw new Error(
        `This unit already has an active tenancy (${active.tenantName || "current resident"}). Renew or end it before allocating someone new.`
      );
    }
    // Informal occupancy (legacy data, no ledger row) — refuse with guidance.
    if (String(snap.status ?? "").toLowerCase() === "occupied" || snap.tenantName) {
      throw new Error(
        "This unit is marked occupied but has no recorded tenancy. Use 'Record Current Tenancy' to register the sitting resident first, then end or transfer that tenancy before allocating someone new."
      );
    }

    // Resolve the resident's portal user (when one exists) so the ledger row
    // carries the canonical user id the portal alias-matching keys on.
    let tenantUserId: string | null = null;
    if (email) {
      const resolver = createUnitResolver(ctx, firmId);
      const u = await resolver.userByEmail(email);
      if (u) tenantUserId = String(u._id);
    }

    const now = new Date().toISOString();
    const tenancyId = await ctx.db.insert("tenancies", {
      firmId,
      propertyId: String(ref.propertyId),
      propertyCustomId: ref.customId ?? null,
      unitId: String(args.unitId),
      unitKey,
      unitName: snap.unitLabel,
      tenantId: tenantUserId || contactId || null,
      tenantUserId,
      tenantContactId: contactId,
      tenantName: name,
      tenantPhone: phone,
      tenantEmail: email,
      emergencyContactName: emergency.name,
      emergencyContactPhone: emergency.phone,
      emergencyContactRelationship: emergency.relationship,
      status: "active",
      startDate: start,
      endDate: end,
      rentAmount,
      paymentFrequency: frequency,
      cautionDeposit: args.cautionDeposit != null ? roundMoney(assertNonNegativeAmount(args.cautionDeposit, "Caution deposit")) : null,
      legalFee: args.legalFee != null ? roundMoney(assertNonNegativeAmount(args.legalFee, "Legal fee")) : null,
      agencyFee: args.agencyFee != null ? roundMoney(assertNonNegativeAmount(args.agencyFee, "Agency fee")) : null,
      notes: String(args.notes ?? "").trim() || null,
      source: "allocation",
      idempotencyKey: args.idempotencyKey ?? null,
      createdAt: now,
      updatedAt: now,
    });

    await syncUnitTenantFields(
      ctx,
      ref,
      {
        tenantName: name,
        tenantPhone: phone ?? "",
        tenantEmail: email ?? "",
        tenantContactId: contactId ?? "",
        currentTenantId: tenantUserId || contactId || null,
        leaseStart: start,
        leaseEnd: end ?? undefined,
        rentAmount,
        rentFrequency: frequency,
        cautionDeposit: args.cautionDeposit != null ? roundMoney(args.cautionDeposit) : undefined,
        legalFee: args.legalFee != null ? roundMoney(args.legalFee) : undefined,
        agencyFee: args.agencyFee != null ? roundMoney(args.agencyFee) : undefined,
        status: "Occupied",
      },
      "set"
    );
    await appendTimelineEvent(
      ctx,
      ref,
      `Tenancy recorded: ${name} allocated to ${snap.unitLabel} (lease from ${start}${end ? ` to ${end}` : ""}).`
    );

    return { tenancyId, unitKey, replayed: false as const };
  },
});

/**
 * recordExistingTenancy — the bridge for legacy occupied units: registers
 * the SITTING resident (already denormalized on the unit) as an active
 * ledger row without changing anything else. Idempotent — a second call
 * returns the existing row. This is the entry point for every unit that was
 * let before the lifecycle ledger existed.
 */
export const recordExistingTenancy = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    unitId: v.string(),
    emergencyContactName: v.optional(v.string()),
    emergencyContactPhone: v.optional(v.string()),
    emergencyContactRelationship: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = String(caller.firmId || args.firmId);
    const emergency = normalizeEmergency(args);

    const ref = await resolveUnitOrThrow(ctx, firmId, args.unitId);
    const unitKey = unitKeyFor(ref);
    const snap = snapshotUnit(ref);

    const active = await findActiveTenancy(ctx, firmId, unitKey);
    if (active) return { tenancyId: active._id, alreadyRecorded: true as const };

    if (!snap.tenantName) {
      throw new Error(
        "This unit has no current resident recorded on it. Add the resident via the property form, or use 'Allocate Resident' for a new tenancy."
      );
    }

    let tenantUserId: string | null = null;
    if (snap.tenantEmail) {
      const resolver = createUnitResolver(ctx, firmId);
      const u = await resolver.userByEmail(snap.tenantEmail.toLowerCase());
      if (u) tenantUserId = String(u._id);
    }

    const now = new Date().toISOString();
    const tenancyId = await ctx.db.insert("tenancies", {
      firmId,
      propertyId: String(ref.propertyId),
      propertyCustomId: ref.customId ?? null,
      unitId: String(args.unitId),
      unitKey,
      unitName: snap.unitLabel,
      tenantId: tenantUserId || snap.currentTenantId || null,
      tenantUserId,
      tenantContactId: null,
      tenantName: snap.tenantName,
      tenantPhone: snap.tenantPhone || null,
      tenantEmail: snap.tenantEmail ? snap.tenantEmail.toLowerCase() : null,
      emergencyContactName: emergency.name,
      emergencyContactPhone: emergency.phone,
      emergencyContactRelationship: emergency.relationship,
      status: "active",
      startDate: snap.leaseStart || null,
      endDate: snap.leaseEnd || null,
      rentAmount: snap.rentAmount || null,
      paymentFrequency: snap.rentFrequency || null,
      cautionDeposit: snap.cautionDeposit || null,
      legalFee: snap.legalFee || null,
      agencyFee: snap.agencyFee || null,
      notes: String(args.notes ?? "").trim() || null,
      source: "record_existing",
      idempotencyKey: null,
      createdAt: now,
      updatedAt: now,
    });

    // No denormalized sync — this row MIRRORS what is already on the unit.
    await appendTimelineEvent(
      ctx,
      ref,
      `Existing tenancy recorded: ${snap.tenantName} on ${snap.unitLabel} (backfilled from the unit record).`
    );

    return { tenancyId, alreadyRecorded: false as const };
  },
});

/**
 * renewTenancy — end the current ledger row (endReason 'renewed') and create
 * the successor row with the new lease terms, chained via
 * previousTenancyId/renewedToTenancyId. Payment history is untouched — the
 * new row simply attributes payments from its own start date forward.
 */
export const renewTenancy = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    tenancyId: v.string(),
    newLeaseStart: v.string(),
    newLeaseEnd: v.optional(v.string()),
    newRentAmount: v.optional(v.number()),
    newRentFrequency: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = String(caller.firmId || args.firmId);

    const t = await loadTenancy(ctx, args.tenancyId);
    assertTenancyFirm(t, firmId);
    if (String(t.status ?? "") !== "active") {
      throw new Error("Only an active tenancy can be renewed. Allocate a new tenancy instead.");
    }

    const start = isoDay(args.newLeaseStart, "New lease start");
    const end = args.newLeaseEnd ? isoDay(args.newLeaseEnd, "New lease end") : null;
    if (end && end <= start) throw new Error("New lease end must be after the new lease start.");
    const rentAmount =
      args.newRentAmount != null
        ? roundMoney(assertNonNegativeAmount(args.newRentAmount, "New rent amount"))
        : (t.rentAmount ?? null);
    const frequency = args.newRentFrequency
      ? assertRentFrequency(args.newRentFrequency)
      : (t.paymentFrequency ?? null);

    const now = new Date().toISOString();
    const newId = await ctx.db.insert("tenancies", {
      ...identityFields(t),
      propertyId: t.propertyId ?? null,
      propertyCustomId: t.propertyCustomId ?? null,
      unitId: t.unitId ?? null,
      unitKey: t.unitKey ?? null,
      unitName: t.unitName ?? null,
      status: "active",
      startDate: start,
      endDate: end,
      rentAmount,
      paymentFrequency: frequency,
      endReason: null,
      endedAt: null,
      endNotes: null,
      previousTenancyId: String(t._id),
      renewedToTenancyId: null,
      notes: String(args.notes ?? "").trim() || null,
      source: "renewal",
      idempotencyKey: null,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(t._id, {
      status: "ended",
      endReason: "renewed",
      endDate: start, // superseded at the renewal's commencement
      endedAt: start,
      endNotes: String(args.notes ?? "").trim() || null,
      renewedToTenancyId: String(newId),
      updatedAt: now,
    });

    // Keep the LIVE lease terms on the unit in step with the renewal.
    if (t.unitId) {
      const ref = await resolveUnitOrThrow(ctx, firmId, String(t.unitId)).catch(() => null);
      if (ref) {
        await syncUnitTenantFields(
          ctx,
          ref,
          { leaseStart: start, leaseEnd: end ?? undefined, rentAmount: rentAmount ?? undefined, rentFrequency: frequency ?? undefined },
          "set"
        );
        await appendTimelineEvent(
          ctx,
          ref,
          `Lease renewed for ${t.tenantName || "the resident"} on ${t.unitName || "the unit"} (${start}${end ? ` to ${end}` : ""}).`
        );
      }
    }

    return { oldTenancyId: String(t._id), tenancyId: String(newId) };
  },
});

/**
 * endTenancy — end an active tenancy and vacate the unit. Clears ONLY the
 * unit's resident-identity fields; rentPaymentHistory, ledger entries,
 * receipts, service charges and the tenancy ledger row itself are all
 * preserved verbatim (Round E technical safeguard: move-out never deletes
 * historical financial or tenancy information).
 */
export const endTenancy = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    tenancyId: v.string(),
    endDate: v.string(),
    endReason: v.string(),
    notes: v.optional(v.string()),
    markUnitVacant: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = String(caller.firmId || args.firmId);

    if (!END_REASONS.includes(String(args.endReason ?? ""))) {
      throw new Error(`End reason must be one of: ${END_REASONS.join(", ")}.`);
    }
    const end = isoDay(args.endDate, "End date");

    const t = await loadTenancy(ctx, args.tenancyId);
    assertTenancyFirm(t, firmId);
    if (String(t.status ?? "") !== "active") {
      throw new Error("This tenancy is already ended.");
    }

    const vacate = args.markUnitVacant !== false;
    const now = new Date().toISOString();
    await ctx.db.patch(t._id, {
      status: "ended",
      endReason: String(args.endReason),
      endedAt: end,
      endNotes: String(args.notes ?? "").trim() || null,
      updatedAt: now,
    });

    if (vacate && t.unitId) {
      const ref = await resolveUnitOrThrow(ctx, firmId, String(t.unitId)).catch(() => null);
      if (ref) {
        await syncUnitTenantFields(ctx, ref, { status: "Vacant" }, "clear");
        await appendTimelineEvent(
          ctx,
          ref,
          `Tenancy ended (${String(args.endReason).replace("_", " ")}): ${t.tenantName || "the resident"} left ${t.unitName || "the unit"} (effective ${end}). Payment and ledger history preserved.`
        );
      }
    }

    return { tenancyId: String(t._id), unitVacated: vacate };
  },
});

/**
 * transferTenant — move a resident to another unit ATOMICALLY: ends the
 * current tenancy ('transferred'), vacates the old unit, and allocates the
 * new unit — all in this mutation's single serializable transaction, so a
 * failure anywhere leaves the resident exactly where they were.
 */
export const transferTenant = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    tenancyId: v.string(),
    targetUnitId: v.string(),
    newLeaseStart: v.string(),
    newLeaseEnd: v.optional(v.string()),
    newRentAmount: v.optional(v.number()),
    newRentFrequency: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = String(caller.firmId || args.firmId);

    const t = await loadTenancy(ctx, args.tenancyId);
    assertTenancyFirm(t, firmId);
    if (String(t.status ?? "") !== "active") {
      throw new Error("Only an active tenancy can be transferred.");
    }

    const start = isoDay(args.newLeaseStart, "New lease start");
    const end = args.newLeaseEnd ? isoDay(args.newLeaseEnd, "New lease end") : null;
    if (end && end <= start) throw new Error("New lease end must be after the new lease start.");
    const rentAmount =
      args.newRentAmount != null
        ? roundMoney(assertNonNegativeAmount(args.newRentAmount, "New rent amount"))
        : (t.rentAmount ?? null);
    const frequency = args.newRentFrequency
      ? assertRentFrequency(args.newRentFrequency)
      : (t.paymentFrequency ?? null);

    const targetRef = await resolveUnitOrThrow(ctx, firmId, args.targetUnitId);
    const targetKey = unitKeyFor(targetRef);
    const targetSnap = snapshotUnit(targetRef);
    if (t.unitKey && targetKey === String(t.unitKey)) {
      throw new Error("The transfer target must be a different unit.");
    }
    const targetActive = await findActiveTenancy(ctx, firmId, targetKey);
    if (targetActive) {
      throw new Error(
        `The target unit already has an active tenancy (${targetActive.tenantName || "current resident"}). End it first.`
      );
    }
    if (String(targetSnap.status ?? "").toLowerCase() === "occupied" || targetSnap.tenantName) {
      throw new Error(
        "The target unit is marked occupied but has no recorded tenancy. Record and end that tenancy first."
      );
    }

    const now = new Date().toISOString();

    // 1. End the current tenancy.
    await ctx.db.patch(t._id, {
      status: "ended",
      endReason: "transferred",
      endDate: start,
      endedAt: start,
      endNotes: String(args.notes ?? "").trim() || `Transferred to ${targetSnap.unitLabel}.`,
      updatedAt: now,
    });

    // 2. Vacate the old unit (identity fields only — history preserved).
    if (t.unitId) {
      const oldRef = await resolveUnitOrThrow(ctx, firmId, String(t.unitId)).catch(() => null);
      if (oldRef) {
        await syncUnitTenantFields(ctx, oldRef, { status: "Vacant" }, "clear");
        await appendTimelineEvent(
          ctx,
          oldRef,
          `Resident transferred out: ${t.tenantName || "the resident"} moved from ${t.unitName || "the unit"} to ${targetSnap.unitLabel}.`
        );
      }
    }

    // 3. Create the successor tenancy on the target unit.
    const newId = await ctx.db.insert("tenancies", {
      ...identityFields(t),
      propertyId: String(targetRef.propertyId),
      propertyCustomId: targetRef.customId ?? null,
      unitId: String(args.targetUnitId),
      unitKey: targetKey,
      unitName: targetSnap.unitLabel,
      status: "active",
      startDate: start,
      endDate: end,
      rentAmount,
      paymentFrequency: frequency,
      endReason: null,
      endedAt: null,
      endNotes: null,
      previousTenancyId: String(t._id),
      renewedToTenancyId: null,
      notes: String(args.notes ?? "").trim() || null,
      source: "transfer",
      idempotencyKey: null,
      createdAt: now,
      updatedAt: now,
    });

    // 4. Occupy the target unit.
    await syncUnitTenantFields(
      ctx,
      targetRef,
      {
        tenantName: t.tenantName ?? "",
        tenantPhone: t.tenantPhone ?? "",
        tenantEmail: t.tenantEmail ?? "",
        currentTenantId: t.tenantUserId || t.tenantContactId || null,
        leaseStart: start,
        leaseEnd: end ?? undefined,
        rentAmount: rentAmount ?? undefined,
        rentFrequency: frequency ?? undefined,
        status: "Occupied",
      },
      "set"
    );
    await appendTimelineEvent(
      ctx,
      targetRef,
      `Resident transferred in: ${t.tenantName || "the resident"} allocated to ${targetSnap.unitLabel} (lease from ${start}${end ? ` to ${end}` : ""}).`
    );

    return { oldTenancyId: String(t._id), tenancyId: String(newId) };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * getUnitsTenancyStatus — board read for the property detail view: for each
 * unitId the client passes (any of the 4 shapes), the active tenancy (if
 * any) and the total ledger rows for that unit.
 */
export const getUnitsTenancyStatus = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    unitIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = args.firmId;

    const out: Record<string, { resolved: boolean; unitKey?: string; active: any | null; total: number }> = {};
    for (const unitId of args.unitIds.slice(0, 60)) {
      const ref = await resolveUnitOrThrow(ctx, firmId, unitId).catch(() => null);
      if (!ref) {
        out[unitId] = { resolved: false, active: null, total: 0 };
        continue;
      }
      const unitKey = unitKeyFor(ref);
      const rows = await findTenancyRowsForUnit(ctx, firmId, unitKey);
      const active = rows.find((r: any) => String(r.status ?? "") === "active") || null;
      out[unitId] = { resolved: true, unitKey, active, total: rows.length };
    }
    return out;
  },
});

/**
 * getUnitTenancyHistory — the full ledger for one unit (newest first), each
 * row attributed its in-window payments from the unit's rent history.
 */
export const getUnitTenancyHistory = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    unitId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = args.firmId;

    const ref = await resolveUnitOrThrow(ctx, firmId, args.unitId);
    const unitKey = unitKeyFor(ref);
    const rows = await findTenancyRowsForUnit(ctx, firmId, unitKey);
    const history = rentHistoryFor(ref);
    const nowDay = new Date().toISOString().slice(0, 10);

    const tenancies = rows.map((t: any) => {
      const { payments, totalPaid } = paymentsForWindow(history, t, nowDay);
      return { ...t, payments, totalPaid };
    });

    return {
      unit: { unitId: args.unitId, unitKey, label: snapshotUnit(ref).unitLabel },
      tenancies,
    };
  },
});

/**
 * getResidentHistory — the consolidated resident history read (Round E
 * acceptance criterion #8): every tenancy for a resident (by contact id,
 * portal user id, email or exact name), each with its attributed payments,
 * plus their maintenance tickets and totals. Aggregated server-side so the
 * resident profile surface (Wave E2) has ONE query.
 */
export const getResidentHistory = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    tenantContactId: v.optional(v.string()),
    tenantUserId: v.optional(v.string()),
    tenantEmail: v.optional(v.string()),
    tenantName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = args.firmId;

    const contactId = String(args.tenantContactId ?? "").trim() || null;
    const emailLower = String(args.tenantEmail ?? "").trim().toLowerCase() || null;
    const nameArg = String(args.tenantName ?? "").trim() || null;
    let userId = String(args.tenantUserId ?? "").trim() || null;
    if (!contactId && !userId && !emailLower && !nameArg) {
      throw new Error("Provide a contact, portal user, email or name to look up.");
    }

    const resolver = createUnitResolver(ctx, firmId);
    if (emailLower && !userId) {
      const u = await resolver.userByEmail(emailLower);
      if (u) userId = String(u._id);
    }

    const all = await ctx.db
      .query("tenancies")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000);
    const matched = (all || [])
      .filter((t: any) => {
        if (contactId && String(t.tenantContactId ?? "") === contactId) return true;
        if (userId && String(t.tenantUserId ?? "") === userId) return true;
        if (emailLower && String(t.tenantEmail ?? "").toLowerCase() === emailLower) return true;
        if (nameArg && String(t.tenantName ?? "").trim().toLowerCase() === nameArg.toLowerCase()) return true;
        return false;
      })
      .sort((a: any, b: any) => String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")));

    // Unit labels + payment attribution: resolve each DISTINCT unit once.
    const unitCache = new Map<string, { label: string; history: any[] }>();
    const labelFor = async (unitId: string | null): Promise<string> => {
      if (!unitId) return "Unit";
      const cached = unitCache.get(unitId);
      if (cached) return cached.label;
      const ref = await resolver.resolveUnit(unitId).catch(() => null);
      if (!ref) {
        unitCache.set(unitId, { label: "Unit", history: [] });
        return "Unit";
      }
      const entry = { label: snapshotUnit(ref).unitLabel, history: rentHistoryFor(ref) };
      unitCache.set(unitId, entry);
      return entry.label;
    };
    const historyFor = async (unitId: string | null): Promise<any[]> => {
      if (!unitId) return [];
      await labelFor(unitId); // populates the cache
      return unitCache.get(unitId)?.history ?? [];
    };

    const nowDay = new Date().toISOString().slice(0, 10);
    const tenancies: any[] = [];
    for (const t of matched) {
      const label = await labelFor(t.unitId ?? null);
      const history = await historyFor(t.unitId ?? null);
      const { payments, totalPaid } = paymentsForWindow(history, t, nowDay);
      tenancies.push({ ...t, unitLabel: label, payments, totalPaid });
    }

    // Maintenance tickets: keyed by the resident's user id, with a bounded
    // name-snapshot fallback for residents without a portal account.
    const ticketsRaw = await ctx.db
      .query("maintenance_tickets")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(500);
    const maintenance = (ticketsRaw || []).filter(
      (m: any) =>
        (userId && String(m.tenantId ?? "") === userId) ||
        (nameArg && String(m.tenantName ?? "").trim().toLowerCase() === nameArg.toLowerCase())
    );

    const activeCount = tenancies.filter((t: any) => String(t.status ?? "") === "active").length;
    const totalPaid = tenancies.reduce((s: number, t: any) => s + (Number(t.totalPaid) || 0), 0);
    const paymentsCount = tenancies.reduce(
      (s: number, t: any) => s + (Array.isArray(t.payments) ? t.payments.length : 0),
      0
    );
    const first = tenancies[0] || null;

    return {
      resident: {
        name: first?.tenantName ?? nameArg ?? null,
        phone: first?.tenantPhone ?? null,
        email: first?.tenantEmail ?? emailLower ?? null,
        contactId,
        userId,
      },
      tenancies,
      maintenance,
      totals: { tenancies: tenancies.length, activeCount, paymentsCount, totalPaid, maintenanceCount: maintenance.length },
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUND E (WAVE E2) — the resident directory + consolidated resident profile
// ═══════════════════════════════════════════════════════════════════════════
// The ledger is the truth layer, so the roster is derived from TENANCIES —
// a resident who was never linked to a Contact row still appears (the E1
// allocation only links a contact when matchResidentContact finds one).
//
// Grouping uses MERGE semantics: two rows are the same resident when they
// share ANY of contact id / portal user / email / exact name, and a row
// that bridges two groups merges them — the "three residents linked to the
// existing contact" fragmentation (2026-09-12 report) cannot happen here.
//
// Privacy (owner brief §2): both reads are staff-only (requireStaffCaller)
// and firm-scoped — a foreign firm's staff receives zero rows. Everything
// here is a READ-ONLY projection: balances, documents and communications
// are never written or deleted by this module, and the underlying rows
// survive move-outs by design (E1(c) — history is never deleted).

/** Outstanding due on a service charge row (read-only; never written here). */
function chargeOutstanding(c: any): number {
  const status = String(c.serviceChargeStatus ?? "");
  const amount = Number(c.amount) || 0;
  if (status === "PAID_FULLY") return 0;
  if (status === "PARTIALLY_PAID") {
    if (typeof c.outstandingBalance === "number") return Math.max(0, c.outstandingBalance);
    return Math.max(0, amount - (Number(c.amountPaidThisCycle) || 0));
  }
  // UNPAID (and legacy rows without a status): the cycle amount less any
  // Round B overpayment credit carried forward.
  return Math.max(0, amount - (Number(c.creditCarriedForward) || 0));
}

/** Identity keys a ledger row contributes to its resident group. */
function rowIdentityKeys(t: any): string[] {
  const ks: string[] = [];
  if (t.tenantContactId) ks.push(`c:${String(t.tenantContactId)}`);
  if (t.tenantUserId) ks.push(`u:${String(t.tenantUserId)}`);
  const email = String(t.tenantEmail ?? "").trim().toLowerCase();
  if (email) ks.push(`e:${email}`);
  const name = String(t.tenantName ?? "").trim().toLowerCase();
  if (name) ks.push(`n:${name}`);
  return ks;
}

interface ResidentGroup {
  keys: Set<string>;
  rows: any[];
  dead: boolean;
}

/** Union-merge ledger rows into resident groups (see section header). */
function groupResidentRows(all: any[]): any[][] {
  const groups: ResidentGroup[] = [];
  const keyIndex = new Map<string, number>();
  for (const t of all || []) {
    const ks = rowIdentityKeys(t);
    if (!ks.length) continue;
    const targets = Array.from(
      new Set(ks.map((k) => keyIndex.get(k)).filter((x): x is number => x !== undefined))
    );
    let gi: number;
    if (targets.length === 0) {
      groups.push({ keys: new Set(), rows: [], dead: false });
      gi = groups.length - 1;
    } else {
      gi = targets[0];
      for (const other of targets.slice(1)) {
        const g = groups[other];
        for (const k of g.keys) {
          keyIndex.set(k, gi);
          groups[gi].keys.add(k);
        }
        groups[gi].rows.push(...g.rows);
        g.keys = new Set();
        g.rows = [];
        g.dead = true;
      }
    }
    for (const k of ks) {
      keyIndex.set(k, gi);
      groups[gi].keys.add(k);
    }
    groups[gi].rows.push(t);
  }
  return groups.filter((g) => !g.dead && g.rows.length > 0).map((g) => g.rows);
}

/**
 * getResidentDirectory — the firm-wide resident roster (staff-only).
 * One entry per resident (union-merged across the ledger), with the
 * current tenancy, a maintenance count and — for residents with an active
 * tenancy — the outstanding service-charge balance on that unit (current
 * state truth; per-past-resident charge attribution does not exist in the
 * data and is never invented).
 */
export const getResidentDirectory = query({
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
    const resolver = createUnitResolver(ctx, firmId);

    const all = await ctx.db
      .query("tenancies")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000);

    const tickets = await ctx.db
      .query("maintenance_tickets")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(500);

    const charges = await ctx.db
      .query("service_charges")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(500);

    // Resolve each DISTINCT charge unit id once — shape-proof, the same
    // resolver that backs the ledger's duplicate guard (a charge stored
    // under the custom id matches a tenancy stored under the Convex _id).
    const chargeUnitKeys = new Map<string, string | null>();
    const keyForCharge = async (unitId: string): Promise<string | null> => {
      const id = String(unitId || "");
      if (!id) return null;
      if (chargeUnitKeys.has(id)) return chargeUnitKeys.get(id) ?? null;
      let key: string | null = null;
      try {
        const ref = await resolver.resolveUnit(id);
        if (ref && ref.property && String(ref.property.firmId ?? "") === firmId) key = unitKeyFor(ref);
      } catch {
        key = null;
      }
      chargeUnitKeys.set(id, key);
      return key;
    };

    const residents: any[] = [];
    for (const rows of groupResidentRows(all || [])) {
      const sorted = rows
        .slice()
        .sort((a: any, b: any) => String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")));
      const latest = sorted[0] || {};
      const contactId = sorted.map((t: any) => t.tenantContactId).find((x: any) => x) ?? null;
      const userId = sorted.map((t: any) => t.tenantUserId).find((x: any) => x) ?? null;
      const activeRow = sorted.find((t: any) => String(t.status ?? "") === "active") ?? null;

      // Current tenancy projection (the live lease terms stay on the unit,
      // synced by the E1 mutations; the ledger row is the snapshot).
      let currentTenancy: any = null;
      if (activeRow) {
        let unitLabel = String(activeRow.unitName || "");
        try {
          const ref = await resolver.resolveUnit(String(activeRow.unitId || ""));
          if (ref) unitLabel = snapshotUnit(ref).unitLabel;
        } catch {
          // keep the row's own snapshot label
        }
        currentTenancy = {
          unitId: activeRow.unitId ?? null,
          unitKey: activeRow.unitKey ?? null,
          unitLabel,
          propertyId: activeRow.propertyId ?? null,
          startDate: activeRow.startDate ?? null,
          endDate: activeRow.endDate ?? null,
          rentAmount: Number(activeRow.rentAmount) || 0,
          paymentFrequency: activeRow.paymentFrequency ?? null,
        };
      }

      // Balances: current-state service charges on the ACTIVE unit only.
      let outstanding: any = null;
      if (activeRow && activeRow.unitKey) {
        const targetKey = String(activeRow.unitKey);
        const matchedCharges: any[] = [];
        for (const c of charges || []) {
          const key = await keyForCharge(String(c.unitId || ""));
          if (key && key === targetKey) matchedCharges.push(c);
        }
        if (matchedCharges.length) {
          outstanding = {
            amount: matchedCharges.reduce((s: number, c: any) => s + chargeOutstanding(c), 0),
            charges: matchedCharges.length,
            unpaid: matchedCharges.filter((c: any) => String(c.serviceChargeStatus ?? "") === "UNPAID").length,
            partial: matchedCharges.filter((c: any) => String(c.serviceChargeStatus ?? "") === "PARTIALLY_PAID").length,
            paid: matchedCharges.filter((c: any) => String(c.serviceChargeStatus ?? "") === "PAID_FULLY").length,
            defaulters: matchedCharges.filter((c: any) => c.isDefaulter === true).length,
          };
        }
      }

      const name = String(latest.tenantName ?? "").trim();
      const maintenanceCount = (tickets || []).filter(
        (m: any) =>
          (userId && String(m.tenantId ?? "") === String(userId)) ||
          (name && String(m.tenantName ?? "").trim().toLowerCase() === name.toLowerCase())
      ).length;

      residents.push({
        key: rowIdentityKeys(latest)[0] ?? (name ? `n:${name.toLowerCase()}` : null),
        name: name || null,
        phone: String(latest.tenantPhone ?? "").trim() || null,
        email: String(latest.tenantEmail ?? "").trim().toLowerCase() || null,
        contactId: contactId ? String(contactId) : null,
        userId: userId ? String(userId) : null,
        hasPortalAccount: !!userId,
        active: !!activeRow,
        currentTenancy,
        totals: { tenancies: rows.length, maintenanceCount },
        outstanding,
      });
    }

    // Active residents first, then by name.
    residents.sort((a: any, b: any) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });

    return {
      residents,
      counts: {
        total: residents.length,
        active: residents.filter((r: any) => r.active).length,
        withOutstanding: residents.filter((r: any) => r.outstanding && r.outstanding.amount > 0).length,
      },
    };
  },
});

/**
 * getResidentProfile — the consolidated resident profile (staff-only):
 * identity + emergency contact, current + previous tenancies with attributed
 * payments, outstanding service-charge balances on the active unit, the
 * resident's maintenance tickets, documents filed on their tenancy
 * properties, and their portal conversations.
 *
 * A deliberate SUPERSET twin of getResidentHistory (which stays untouched
 * so the E1 surface and its pinned tests remain byte-stable). History is
 * read-only here: ending a tenancy never removed these rows (E1(c)), so a
 * past resident's profile is complete by construction.
 */
export const getResidentProfile = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    tenantContactId: v.optional(v.string()),
    tenantUserId: v.optional(v.string()),
    tenantEmail: v.optional(v.string()),
    tenantName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = args.firmId;

    const contactId = String(args.tenantContactId ?? "").trim() || null;
    const emailLower = String(args.tenantEmail ?? "").trim().toLowerCase() || null;
    const nameArg = String(args.tenantName ?? "").trim() || null;
    let userId = String(args.tenantUserId ?? "").trim() || null;
    if (!contactId && !userId && !emailLower && !nameArg) {
      throw new Error("Provide a contact, portal user, email or name to look up.");
    }

    const resolver = createUnitResolver(ctx, firmId);
    if (emailLower && !userId) {
      const u = await resolver.userByEmail(emailLower);
      if (u) userId = String(u._id);
    }

    const all = await ctx.db
      .query("tenancies")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000);
    const matched = (all || [])
      .filter((t: any) => {
        if (contactId && String(t.tenantContactId ?? "") === contactId) return true;
        if (userId && String(t.tenantUserId ?? "") === userId) return true;
        if (emailLower && String(t.tenantEmail ?? "").toLowerCase() === emailLower) return true;
        if (nameArg && String(t.tenantName ?? "").trim().toLowerCase() === nameArg.toLowerCase()) return true;
        return false;
      })
      .sort((a: any, b: any) => String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")));

    // Unit labels + payment attribution — the E1 twin (see getResidentHistory).
    const unitCache = new Map<string, { label: string; history: any[] }>();
    const labelFor = async (unitId: string | null): Promise<string> => {
      if (!unitId) return "Unit";
      const cached = unitCache.get(unitId);
      if (cached) return cached.label;
      const ref = await resolver.resolveUnit(unitId).catch(() => null);
      if (!ref) {
        unitCache.set(unitId, { label: "Unit", history: [] });
        return "Unit";
      }
      const entry = { label: snapshotUnit(ref).unitLabel, history: rentHistoryFor(ref) };
      unitCache.set(unitId, entry);
      return entry.label;
    };
    const historyFor = async (unitId: string | null): Promise<any[]> => {
      if (!unitId) return [];
      await labelFor(unitId); // populates the cache
      return unitCache.get(unitId)?.history ?? [];
    };

    const nowDay = new Date().toISOString().slice(0, 10);
    const tenancies: any[] = [];
    for (const t of matched) {
      const label = await labelFor(t.unitId ?? null);
      const history = await historyFor(t.unitId ?? null);
      const { payments, totalPaid } = paymentsForWindow(history, t, nowDay);
      tenancies.push({ ...t, unitLabel: label, payments, totalPaid });
    }

    const activeRow = matched.find((t: any) => String(t.status ?? "") === "active") ?? null;

    // Balances on the active unit (current-state charges, read-only).
    let balances: any = null;
    if (activeRow && activeRow.unitKey) {
      const charges = await ctx.db
        .query("service_charges")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .take(500);
      const targetKey = String(activeRow.unitKey);
      const chargeKeyCache = new Map<string, string | null>();
      const matchedCharges: any[] = [];
      for (const c of charges || []) {
        const id = String(c.unitId || "");
        let key: string | null = null;
        if (id) {
          if (chargeKeyCache.has(id)) {
            key = chargeKeyCache.get(id) ?? null;
          } else {
            try {
              const ref = await resolver.resolveUnit(id);
              key = ref ? unitKeyFor(ref) : null;
            } catch {
              key = null;
            }
            chargeKeyCache.set(id, key);
          }
        }
        if (key && key === targetKey) {
          matchedCharges.push({
            _id: c._id,
            category: c.category ?? null,
            amount: Number(c.amount) || 0,
            cycle: c.cycle ?? null,
            nextDueDate: c.nextDueDate ?? null,
            serviceChargeStatus: c.serviceChargeStatus ?? null,
            outstanding: chargeOutstanding(c),
            amountPaidThisCycle: c.amountPaidThisCycle ?? null,
            isDefaulter: c.isDefaulter === true,
            daysOverdue: c.daysOverdue ?? null,
            remindersMuted: c.remindersMuted === true,
          });
        }
      }
      matchedCharges.sort((a: any, b: any) => (b.outstanding || 0) - (a.outstanding || 0));
      balances = {
        charges: matchedCharges,
        totals: {
          outstanding: matchedCharges.reduce((s: number, c: any) => s + (c.outstanding || 0), 0),
          unpaid: matchedCharges.filter((c: any) => c.serviceChargeStatus === "UNPAID").length,
          partial: matchedCharges.filter((c: any) => c.serviceChargeStatus === "PARTIALLY_PAID").length,
          paid: matchedCharges.filter((c: any) => c.serviceChargeStatus === "PAID_FULLY").length,
          defaulters: matchedCharges.filter((c: any) => c.isDefaulter).length,
        },
      };
    }

    // Documents on the resident's tenancy properties (the documents table
    // links by propertyId — read-only here; E3 revives the property
    // documents section proper).
    const propertyIds = new Set(
      (matched || [])
        .map((t: any) => (t.propertyId ? String(t.propertyId) : null))
        .filter((x: any): x is string => !!x)
    );
    let documents: any[] = [];
    if (propertyIds.size) {
      const docsRaw = await ctx.db
        .query("documents")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .take(300);
      documents = (docsRaw || [])
        .filter((d: any) => d.propertyId && propertyIds.has(String(d.propertyId)))
        .sort((a: any, b: any) => String(b.dateFiled ?? "").localeCompare(String(a.dateFiled ?? "")))
        .slice(0, 100)
        .map((d: any) => ({
          _id: d._id,
          title: d.title ?? null,
          dateFiled: d.dateFiled ?? null,
          categoryId: d.categoryId ?? null,
          propertyId: d.propertyId ?? null,
          source: d.source ?? null,
        }));
    }

    // Portal conversations (only exist for residents with portal accounts).
    let communications: any[] = [];
    if (userId) {
      const convs = await ctx.db
        .query("portal_conversations")
        .withIndex("by_participant", (q: any) => q.eq("participantId", userId))
        .take(50);
      communications = (convs || [])
        .slice()
        .sort((a: any, b: any) => (Number(b.lastMessageAt) || 0) - (Number(a.lastMessageAt) || 0))
        .map((c: any) => ({
          _id: c._id,
          propertyId: c.propertyId ?? null,
          unitId: c.unitId ?? null,
          lastMessageAt: c.lastMessageAt ?? null,
          lastMessagePreview: c.lastMessagePreview ?? null,
          lastMessageBy: c.lastMessageBy ?? null,
          participantRole: c.participantRole ?? null,
        }));
    }

    // Maintenance tickets (same keying as getResidentHistory: portal user id
    // with a bounded name-snapshot fallback).
    const ticketsRaw = await ctx.db
      .query("maintenance_tickets")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(500);
    const maintenance = (ticketsRaw || []).filter(
      (m: any) =>
        (userId && String(m.tenantId ?? "") === userId) ||
        (nameArg && String(m.tenantName ?? "").trim().toLowerCase() === nameArg.toLowerCase())
    );

    const activeCount = tenancies.filter((t: any) => String(t.status ?? "") === "active").length;
    const totalPaid = tenancies.reduce((s: number, t: any) => s + (Number(t.totalPaid) || 0), 0);
    const paymentsCount = tenancies.reduce(
      (s: number, t: any) => s + (Array.isArray(t.payments) ? t.payments.length : 0),
      0
    );
    const first = tenancies[0] || null;

    return {
      resident: {
        name: first?.tenantName ?? nameArg ?? null,
        phone: first?.tenantPhone ?? null,
        email: first?.tenantEmail ?? emailLower ?? null,
        contactId,
        userId,
        hasPortalAccount: !!userId,
        emergencyContact: first
          ? {
              name: first.emergencyContactName ?? null,
              phone: first.emergencyContactPhone ?? null,
              relationship: first.emergencyContactRelationship ?? null,
            }
          : null,
      },
      tenancies,
      maintenance,
      balances,
      documents,
      communications,
      totals: {
        tenancies: tenancies.length,
        activeCount,
        paymentsCount,
        totalPaid,
        maintenanceCount: maintenance.length,
        documentsCount: documents.length,
        conversationsCount: communications.length,
        outstanding: balances ? balances.totals.outstanding : 0,
      },
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUND E (WAVE E3) — the per-property financial summary
// ═══════════════════════════════════════════════════════════════════════════
// The property-side aggregate mirroring E2's resident-side aggregate. The
// owner brief (§1) asks for a property financial summary; until now the
// only per-property figures were CLIENT-side StatCards that read the
// denormalized rentalDetails snapshot — they missed embedded-unit rows
// (composite unit ids) and the service_charges table entirely, and could
// not resolve a charge stored under the custom unit id against a tenancy
// stored under the Convex _id.
//
// This read computes the rollup server-side from the LEDGER truth:
//   • the property group = every firm row sharing the anchor's NORMALIZED
//     address (the sibling-row multi-unit model) plus their embedded units
//   • charges/ledger rows are matched SHAPE-PROOF via the E1 resolver —
//     all four unitId shapes land on the same unitKey set
//   • voided/test ledger records are annotations, not money (the
//     accounting-integrity round's rule) — excluded and COUNTED
//   • rent receipts use the unit-first attribution rule (embedded unit
//     history before property-level; property-level only when unambiguous)
//   • occupancy comes from the E1 tenancy ledger (active rows), with the
//     denormalized unit status reported alongside as the legacy snapshot
//   • read-only: nothing here writes, and history is never deleted

// ─── ROUND F (Wave F1): the per-resident rent bill / statement ───────────────
//
// The owner brief §2 gap: the ledger backend was complete (ledger_entries
// with tenantId/type/period/paymentRef/channel) but there was no bill view —
// no way to see ONE resident's money as a statement: what was brought
// forward, what was raised this period (charges + rent per lease terms),
// what was paid (their attributed payments), what was adjusted (voided
// entries stay visible, struck, excluded), and what is due now.
//
// Double-counting rule (the reason this is not a naive ledger dump): the
// debit side comes from the OBLIGATION stores (service_charges rows for the
// unit, plus rent derived from the lease terms), the credit side from the
// PAYMENT store (ledger rows attributed to the resident-unit in-window).
// A settled charge therefore shows its full amount as a debit AND its
// payment as a credit — netting to zero — instead of double-counting both
// stores as "money in". Voided ledger rows are ANNOTATIONS (excluded from
// the running total, shown with their reason) and the Round B overpayment
// credit is applied once, at the end, as its own closing line.
//
// All arithmetic is integer kobo internally (Round F §6: new money code
// computes in kobo; storage stays naira @2dp — the storage migration is a
// separate, deliberately deferred wave).
export const getResidentBill = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    // The unit the bill is for (any id shape the E1 resolver accepts).
    unitId: v.string(),
    // Resident identity keys — any one suffices (same union as
    // getResidentProfile; the bill is for ONE resident on ONE unit).
    tenantContactId: v.optional(v.string()),
    tenantUserId: v.optional(v.string()),
    tenantEmail: v.optional(v.string()),
    tenantName: v.optional(v.string()),
    // Statement window. Defaults: to = now, from = 30 days before `to`.
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = args.firmId;

    const contactId = String(args.tenantContactId ?? "").trim() || null;
    const emailLower = String(args.tenantEmail ?? "").trim().toLowerCase() || null;
    const nameArg = String(args.tenantName ?? "").trim() || null;
    let userId = String(args.tenantUserId ?? "").trim() || null;
    if (!contactId && !userId && !emailLower && !nameArg) {
      throw new Error("Provide a contact, portal user, email or name to look up.");
    }

    // ── The unit (any id shape → one resolved unit + its key). ──────────
    const resolver = createUnitResolver(ctx, firmId);
    const ref = await resolver.resolveUnit(args.unitId).catch(() => null);
    if (!ref) {
      throw new Error("Unit not found.");
    }
    const targetKey = unitKeyFor(ref);
    const unitLabel = snapshotUnit(ref).unitLabel;

    if (emailLower && !userId) {
      const u = await resolver.userByEmail(emailLower);
      if (u) userId = String(u._id);
    }

    // ── The resident's tenancy rows ON THIS UNIT (identity union). ──────
    const identityHit = (t: any): boolean => {
      if (contactId && String(t.tenantContactId ?? "") === contactId) return true;
      if (userId && String(t.tenantUserId ?? "") === userId) return true;
      if (emailLower && String(t.tenantEmail ?? "").toLowerCase() === emailLower) return true;
      if (nameArg && String(t.tenantName ?? "").trim().toLowerCase() === nameArg.toLowerCase()) return true;
      return false;
    };
    const allTenancies = await ctx.db
      .query("tenancies")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000);
    const residentRows = (allTenancies || [])
      .filter((t: any) => String(t.unitKey ?? "") === targetKey && identityHit(t))
      .sort((a: any, b: any) => String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")));
    const activeRow = residentRows.find((t: any) => String(t.status ?? "") === "active") ?? residentRows[0] ?? null;

    // ── Window. ──────────────────────────────────────────────────────────
    const toMs = args.to ? new Date(args.to).getTime() : Date.now();
    const fromMs = args.from ? new Date(args.from).getTime() : toMs - 30 * 86400000;
    if (!isFinite(toMs) || !isFinite(fromMs) || fromMs > toMs) {
      throw new Error("Invalid statement window.");
    }

    // ── Obligations: service charges for this unit (E2 shape-proof match). ──
    const firmCharges = await ctx.db
      .query("service_charges")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(500);
    const chargeKeyCache = new Map<string, string | null>();
    const chargeKey = async (id: string): Promise<string | null> => {
      const raw = String(id || "");
      if (!raw) return null;
      if (chargeKeyCache.has(raw)) return chargeKeyCache.get(raw) ?? null;
      let key: string | null = null;
      try {
        const cref = await resolver.resolveUnit(raw);
        key = cref ? unitKeyFor(cref) : null;
      } catch {
        key = null;
      }
      chargeKeyCache.set(raw, key);
      return key;
    };
    const unitCharges: any[] = [];
    for (const c of firmCharges || []) {
      const key = await chargeKey(c.unitId);
      if (key && key === targetKey) unitCharges.push(c);
    }

    // ── Payments: ledger rows attributed to this resident-unit. ─────────
    // Attribution rule (the E2 in-window twin): a row with a tenantId must
    // carry THIS resident's id; a legacy row with no tenantId counts only
    // inside the resident's tenancy window (never another tenant's payment).
    const firmLedger = await ctx.db
      .query("ledger_entries")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(4000);
    const ledgerKeyCache = new Map<string, string | null>();
    const ledgerKey = async (row: any): Promise<string | null> => {
      const raw = String(row.unitId || "");
      if (!raw) return null;
      if (ledgerKeyCache.has(raw)) return ledgerKeyCache.get(raw) ?? null;
      let key: string | null = null;
      try {
        const lref = await resolver.resolveUnit(raw);
        key = lref ? unitKeyFor(lref) : null;
      } catch {
        key = null;
      }
      ledgerKeyCache.set(raw, key);
      return key;
    };
    const tenancyStartMs = activeRow?.startDate ? new Date(String(activeRow.startDate)).getTime() : null;
    const tenancyEndMs = activeRow
      ? (activeRow.endedAt ?? activeRow.endDate)
        ? new Date(String(activeRow.endedAt ?? activeRow.endDate)).getTime()
        : Date.now()
      : Date.now();
    const rowBelongsToResident = (row: any): boolean => {
      const rt = String(row.tenantId ?? "").trim();
      if (rt) {
        if (contactId && rt === contactId) return true;
        if (userId && rt === userId) return true;
        if (emailLower && rt.toLowerCase() === emailLower) return true;
        if (nameArg && rt.trim().toLowerCase() === nameArg.toLowerCase()) return true;
        return false;
      }
      // No tenant stamp: in-window attribution only.
      const ts = Number(row.timestamp) || 0;
      if (tenancyStartMs && ts < tenancyStartMs) return false;
      return ts <= tenancyEndMs;
    };

    // ── Kobo-internal arithmetic (Round F §6). ───────────────────────────
    const kb = (naira: any): number => Math.round((Number(naira) || 0) * 100);
    const naira = (kobo: number): number => Math.round((kobo / 100) * 100) / 100;

    // Opening balance: unsettled obligations due BEFORE the window, as of
    // the current state (the charge store is current-state; per-date
    // history is not tracked — the label says exactly this).
    let openingKb = 0;
    const openingCharges: string[] = [];
    for (const c of unitCharges) {
      const due = Number(c.nextDueDate) || 0;
      if (due && due < fromMs) {
        const out = chargeOutstanding(c);
        if (out > 0) {
          openingKb += kb(out);
          openingCharges.push(String(c.category ?? "Service charge"));
        }
      }
    }

    // In-window lines.
    interface BillLine {
      kind: "charge" | "rent" | "payment" | "penalty" | "adjustment" | "credit_applied";
      date: number;
      label: string;
      detail?: string | null;
      debitKb: number;
      creditKb: number;
    }
    const lines: BillLine[] = [];

    // (a) Charge obligations raised/due in-window — the FULL cycle amount;
    //     their settlements appear on the ledger side as payments.
    for (const c of unitCharges) {
      const due = Number(c.nextDueDate) || 0;
      if (due && due >= fromMs && due <= toMs) {
        lines.push({
          kind: "charge",
          date: due,
          label: `${c.category ?? "Service charge"} service charge`,
          detail: c.cycle ?? null,
          debitKb: kb(c.amount),
          creditKb: 0,
        });
      }
    }

    // (b) Rent obligations derived from the lease terms (the rent-arrears
    //     model Round B flagged as missing — derivable, never invented: the
    //     amounts come from the tenancy row's terms; a term-less row raises
    //     no rent line).
    if (activeRow) {
      const rentTerms = Number(
        (activeRow as any).rent ?? (activeRow as any).rentAmount ?? snapshotUnit(ref).rentAmount
      ) || 0;
      if (rentTerms > 0) {
        const d = new Date(fromMs);
        const end = new Date(toMs);
        // One debit per calendar month in the window (a rent bill is
        // monthly by convention; other frequencies are still billed
        // monthly and the label carries no invented period).
        let guard = 0;
        while (d <= end && guard < 36) {
          guard++;
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          lines.push({
            kind: "rent",
            date: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
            label: `Rent — ${monthKey}`,
            detail: "per lease terms",
            debitKb: kb(rentTerms),
            creditKb: 0,
          });
          d.setMonth(d.getMonth() + 1);
        }
      }
    }

    // (c) Ledger rows in-window: payments (cleared) + penalties (pending —
    //     an obligation) + voided rows (adjustments — visible, excluded).
    for (const row of firmLedger || []) {
      // Resolve the unit key ONCE per row (the resolver is shape-proof: a
      // row stored under the custom unit id matches this unit's Convex id).
      const rowKey = await ledgerKey(row);
      if (!rowKey || rowKey !== targetKey) continue;
      if (!rowBelongsToResident(row)) continue;
      const ts = Number(row.timestamp) || 0;

      // Voided/test rows are ANNOTATIONS, not money: an in-window voided
      // row is shown on the statement (struck, with its reason) but never
      // enters the running total.
      if (!isActiveFinancialRecord(row.recordStatus)) {
        if (row.recordStatus === "voided" && ts >= fromMs && ts <= toMs) {
          lines.push({
            kind: "adjustment",
            date: ts,
            label: String(row.type ?? "entry"),
            detail: row.voidReason ? `voided — ${row.voidReason}` : "voided",
            debitKb: 0,
            creditKb: 0,
          });
        }
        continue;
      }

      if (ts < fromMs || ts > toMs) continue;

      if (row.type === "penalty") {
        // A penalty row is an obligation (pending) or already collected
        // (cleared = it became a payment).
        if (row.status === "pending") {
          lines.push({
            kind: "penalty",
            date: ts,
            label: "Late penalty",
            detail: row.description ?? null,
            debitKb: kb(row.amount),
            creditKb: 0,
          });
        } else if (row.status === "cleared") {
          lines.push({
            kind: "payment",
            date: ts,
            label: "Penalty payment",
            detail: [row.channel, row.paymentRef].filter(Boolean).join(" · ") || null,
            debitKb: 0,
            creditKb: kb(row.amount),
          });
        }
        continue;
      }

      if (row.status === "cleared") {
        lines.push({
          kind: "payment",
          date: ts,
          label: row.type === "rent" ? "Rent payment" : `${String(row.type ?? "payment")} payment`,
          detail: [row.channel, row.paymentRef].filter(Boolean).join(" · ") || null,
          debitKb: 0,
          creditKb: kb(row.amount),
        });
      }
    }

    lines.sort((a, b) => a.date - b.date);

    // Running balance + closing credit application (Round B
    // creditCarriedForward — applied ONCE here, as its own closing line).
    let runningKb = openingKb;
    const rendered = lines.map((l) => {
      runningKb += l.debitKb - l.creditKb;
      return {
        kind: l.kind,
        date: l.date,
        label: l.label,
        detail: l.detail ?? null,
        debit: naira(l.debitKb),
        credit: naira(l.creditKb),
        balance: naira(runningKb),
      };
    });

    const creditKb = unitCharges.reduce((s, c) => s + kb(Number(c.creditCarriedForward) || 0), 0);
    let endingKb = runningKb;
    let creditAppliedLine: any = null;
    if (creditKb > 0) {
      endingKb -= creditKb;
      creditAppliedLine = {
        kind: "credit_applied" as const,
        date: toMs,
        label: "Overpayment credit applied",
        detail: "Round B creditCarriedForward — already paid in a previous period",
        debit: 0,
        credit: naira(creditKb),
        balance: naira(endingKb),
      };
      rendered.push(creditAppliedLine);
    }

    const totalDebitKb = lines.reduce((s, l) => s + l.debitKb, 0);
    const totalCreditKb = lines.reduce((s, l) => s + l.creditKb, 0);
    const adjustmentsShown = rendered.filter((l) => l.kind === "adjustment").length;

    return {
      unitLabel,
      residentName: activeRow?.tenantName ?? nameArg ?? emailLower ?? null,
      period: { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() },
      openingBalance: naira(openingKb),
      openingNote:
        openingCharges.length > 0
          ? `Unsettled charges due before the window (${openingCharges.slice(0, 5).join(", ")}${openingCharges.length > 5 ? ", …" : ""})`
          : "No unsettled charges due before the window",
      lines: rendered,
      totals: {
        charges: naira(totalDebitKb),
        payments: naira(totalCreditKb),
        adjustmentsExcluded: adjustmentsShown,
        creditApplied: naira(creditKb),
      },
      endingBalance: naira(endingKb),
      endingNote:
        endingKb > 0
          ? "Amount currently due from this resident"
          : endingKb < 0
            ? "Resident is in credit (paid beyond what is due in this window)"
            : "Fully settled for this window",
    };
  },
});

/**
 * getPropertyFinancialSummary — the server-computed per-property rollup
 * (staff-only, firm-scoped). `propertyId` accepts the Convex _id OR the
 * legacy custom id; the summary covers the whole address group.
 */
export const getPropertyFinancialSummary = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    propertyId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = args.firmId;

    // Resolve the anchor property (Convex _id first, then legacy custom id).
    let anchor: any = null;
    try {
      const direct: any = await ctx.db.get(args.propertyId as any);
      if (direct && direct.firmId !== undefined && direct.address !== undefined) {
        anchor = direct;
      }
    } catch {
      // not a Convex id — fall through to the custom-id lookup
    }
    if (!anchor) {
      anchor = await ctx.db
        .query("properties")
        .withIndex("by_custom_id", (q: any) => q.eq("id", args.propertyId))
        .first();
    }
    if (!anchor || String(anchor.firmId ?? "") !== firmId) {
      throw new Error("Property not found.");
    }

    const resolver = createUnitResolver(ctx, firmId);
    const normAddr = (s: any) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const anchorKey = normAddr(anchor.address);

    // The address group: every firm row at the same normalized address.
    const firmProps = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000);
    const siblings = (firmProps || []).filter((p: any) => normAddr(p.address) === anchorKey);

    // The unit set: each sibling row is one unit (standalone model) or
    // contributes its embedded units (legacy model) — same unitKey
    // semantics as the ledger's duplicate guard.
    interface SummaryUnit {
      key: string;
      label: string;
      rowId: string;
      status: string | null;
      tenantName: string | null;
      rentAmount: number;
      rentFrequency: string | null;
      leaseStart: string | null;
      leaseEnd: string | null;
      activeTenancy: boolean;
      chargesOutstanding: number;
      receiptsPaid: number;
      receiptsCount: number;
    }
    const units: SummaryUnit[] = [];
    const unitRefs: Array<{ property: any; unit: any | null }> = [];
    const addr0 = String(anchor.address || "").split(",")[0] || "Property";
    for (const p of siblings) {
      const pAddr0 = String(p.address || "").split(",")[0] || addr0;
      const embedded: any[] = Array.isArray(p.units) ? p.units : [];
      if (embedded.length > 0) {
        for (const u of embedded) {
          const unitPart = String(u.id ?? u.unitName ?? "");
          const rd = u.rentalDetails || {};
          units.push({
            key: unitPart ? `${String(p._id)}_${unitPart}` : String(p._id),
            label: u.unitName ? `${String(u.unitName)} · ${pAddr0}` : pAddr0,
            rowId: p.id != null ? String(p.id) : String(p._id),
            status: u.status ?? p.status ?? null,
            tenantName: u.tenantName ?? rd.tenantName ?? null,
            rentAmount: Number(u.rentAmount ?? rd.rentAmount) || 0,
            rentFrequency: u.rentFrequency ?? rd.rentFrequency ?? null,
            leaseStart: u.leaseStart ?? rd.leaseStart ?? null,
            leaseEnd: u.leaseEnd ?? rd.leaseEnd ?? null,
            activeTenancy: false,
            chargesOutstanding: 0,
            receiptsPaid: 0,
            receiptsCount: 0,
          });
          unitRefs.push({ property: p, unit: u });
        }
      } else {
        const rd = p.rentalDetails || {};
        units.push({
          key: String(p._id),
          label: rd.unitName ? `${String(rd.unitName)} · ${pAddr0}` : pAddr0,
          rowId: p.id != null ? String(p.id) : String(p._id),
          status: p.status ?? null,
          tenantName: rd.tenantName ?? null,
          rentAmount: Number(rd.rentAmount) || 0,
          rentFrequency: rd.rentFrequency ?? null,
          leaseStart: rd.leaseStart ?? null,
          leaseEnd: rd.leaseEnd ?? null,
          activeTenancy: false,
          chargesOutstanding: 0,
          receiptsPaid: 0,
          receiptsCount: 0,
        });
        unitRefs.push({ property: p, unit: null });
      }
    }
    const unitByKey = new Map<string, SummaryUnit>();
    for (const u of units) unitByKey.set(u.key, u);
    const unitKeySet = new Set(unitByKey.keys());

    // Every id spelling of every sibling row (for propertyId-keyed rows).
    const siblingIds = new Set<string>();
    for (const p of siblings) {
      siblingIds.add(String(p._id));
      if (p.id != null) siblingIds.add(String(p.id));
    }

    // Resolve ANY unitId shape to a unitKey in this property group (memoized).
    const keyCache = new Map<string, string | null>();
    const keyForUnitId = async (unitId: any): Promise<string | null> => {
      const id = String(unitId || "");
      if (!id) return null;
      if (keyCache.has(id)) return keyCache.get(id) ?? null;
      let key: string | null = null;
      try {
        const ref = await resolver.resolveUnit(id);
        if (ref && String(ref.property.firmId ?? "") === firmId) {
          const k = unitKeyFor(ref);
          if (unitKeySet.has(k)) key = k;
        }
      } catch {
        key = null;
      }
      keyCache.set(id, key);
      return key;
    };

    // ── Service charges (shape-proof, credit-netted) ─────────────────────────
    const charges = await ctx.db
      .query("service_charges")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000);
    const sc = { count: 0, unpaid: 0, partial: 0, paid: 0, defaulters: 0, outstanding: 0, creditCarriedForward: 0 };
    for (const c of charges || []) {
      const key = await keyForUnitId(c.unitId);
      if (!key) continue;
      const u = unitByKey.get(key);
      if (!u) continue;
      sc.count++;
      const status = String(c.serviceChargeStatus ?? "");
      if (status === "PAID_FULLY") sc.paid++;
      else if (status === "PARTIALLY_PAID") sc.partial++;
      else sc.unpaid++;
      if (c.isDefaulter === true) sc.defaulters++;
      const out = chargeOutstanding(c);
      sc.outstanding += out;
      sc.creditCarriedForward += Number(c.creditCarriedForward) || 0;
      u.chargesOutstanding += out;
    }

    // ── Ledger entries (propertyId-keyed OR shape-proof unitId) ──────────────
    const ledgerRows = await ctx.db
      .query("ledger_entries")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000);
    const ledger = {
      cleared: 0,
      pending: 0,
      defaulted: 0,
      voidedExcluded: 0,
      testExcluded: 0,
      byType: {} as Record<string, { cleared: number; pending: number; defaulted: number; total: number }>,
    };
    const nowYear = String(new Date().getFullYear());
    let rentClearedYtd = 0;
    for (const e of ledgerRows || []) {
      const rs = String(e.recordStatus ?? "");
      if (rs === "voided") { ledger.voidedExcluded++; continue; }
      if (rs === "test") { ledger.testExcluded++; continue; }
      let matched = false;
      if (e.propertyId && siblingIds.has(String(e.propertyId))) matched = true;
      if (!matched && e.unitId) {
        const key = await keyForUnitId(e.unitId);
        matched = !!key;
      }
      if (!matched) continue;
      const type = String(e.type ?? "other");
      const bucket = (ledger.byType[type] ||= { cleared: 0, pending: 0, defaulted: 0, total: 0 });
      const amount = Number(e.amount) || 0;
      const status = String(e.status ?? "");
      if (status === "cleared") { ledger.cleared += amount; bucket.cleared += amount; }
      else if (status === "defaulted") { ledger.defaulted += amount; bucket.defaulted += amount; }
      else { ledger.pending += amount; bucket.pending += amount; }
      bucket.total += amount;
      if (status === "cleared" && type === "rent") {
        const ts = Number(e.timestamp) || 0;
        if (ts > 0 && new Date(ts).getFullYear() === Number(nowYear)) rentClearedYtd += amount;
      }
    }

    // ── Rent receipts (unit-first attribution — the E1 rentHistoryFor rule) ──
    const receipts = { count: 0, totalPaid: 0, ytdPaid: 0 };
    for (let i = 0; i < units.length; i++) {
      const ref = unitRefs[i];
      const history = rentHistoryFor(ref as ResolvedUnitRef);
      let unitPaid = 0;
      for (const p of history || []) {
        if (p?.status !== "paid") continue;
        const amount = Number(p.amount) || 0;
        receipts.count++;
        receipts.totalPaid += amount;
        unitPaid += amount;
        const day = String(p?.paidDate || "").slice(0, 4);
        if (day === nowYear) receipts.ytdPaid += amount;
      }
      units[i].receiptsPaid = unitPaid;
      units[i].receiptsCount = (history || []).filter((p: any) => p?.status === "paid").length;
    }

    // ── Maintenance (counts, no money) ───────────────────────────────────────
    const tickets = await ctx.db
      .query("maintenance_tickets")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(1000);
    const maintenance = { total: 0, open: 0 };
    for (const t of tickets || []) {
      if (!t.propertyId || !siblingIds.has(String(t.propertyId))) continue;
      maintenance.total++;
      if (!["resolved", "closed", "cancelled"].includes(String(t.status ?? ""))) maintenance.open++;
    }

    // ── Occupancy from the tenancy ledger (the E1 truth) ─────────────────────
    const tenancyRows = await ctx.db
      .query("tenancies")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000);
    let activeTenancies = 0;
    let totalTenancies = 0;
    for (const t of tenancyRows || []) {
      if (!t.unitKey || !unitKeySet.has(String(t.unitKey))) continue;
      totalTenancies++;
      if (String(t.status ?? "") === "active") {
        activeTenancies++;
        const u = unitByKey.get(String(t.unitKey));
        if (u) u.activeTenancy = true;
      }
    }

    return {
      property: {
        _id: String(anchor._id),
        id: anchor.id != null ? String(anchor.id) : null,
        address: anchor.address ?? null,
        category: anchor.category ?? null,
        ownershipType: anchor.ownershipType ?? null,
        rentCollectionMode: anchor.rentCollectionMode ?? null,
        propertyType: anchor.propertyType ?? null,
        managementFeePercentage: Number(anchor.managementFeePercentage) || 0,
      },
      units,
      counts: {
        units: units.length,
        activeTenancies,
        totalTenancies,
        statusOccupied: units.filter((u) => String(u.status ?? "") === "Occupied").length,
        statusVacant: units.filter((u) => String(u.status ?? "") === "Vacant").length,
      },
      ledger,
      rentCollected: { ytdLedger: rentClearedYtd },
      receipts,
      serviceCharges: sc,
      maintenance,
    };
  },
});

// ROUND E (WAVE E4) — authorised bulk operations
// ═══════════════════════════════════════════════════════════════════════════
// The owner brief (§4) asks for bulk operations for AUTHORISED users, with
// §6 demanding backend validation and data consistency. Until now the only
// bulk path was the client fan-out in useProperties.handleBulkUpdateProperties
// — N sequential updateItem calls, each gated by requireFirmUser (any firm
// member, not staff) with no enum validation, no consistency checks and a
// partial-failure state (half the rows updated, half not, one toast).
//
// bulkUpdateProperties replaces it with ONE staff-authed mutation:
//   • requireStaffCaller + assertSameFirm — staff only, firm-scoped.
//   • Whitelist: only `status` and `category` are patchable. Everything
//     else a caller smuggles in is rejected with an error (the generic
//     updateItem path can patch anything; this mutation cannot).
//   • Enum validation: status must be a real PropertyStatus, category a
//     real PropertyCategory (the old modal wrote 'Available'/'Leased'/
//     'Under Renovation' — statuses no surface recognises).
//   • Ledger-consistency guard: the tenancy ledger is the truth for
//     occupancy (E1). Marking a unit Vacant/Listed/Sold while an ACTIVE
//     tenancy exists would contradict the ledger — the row is SKIPPED and
//     reported as a conflict ("end the tenancy first"). The same applies
//     to every EMBEDDED unit under a property row.
//   • Financial history is untouchable here: the whitelist means
//     rentPaymentHistory / ledger_entries / service_charges can never be
//     reached from this mutation at all.
//
// Idempotent by nature: re-running the same bulk update just re-patches
// the same two fields. Unknown or cross-firm ids are skipped and counted
// (a firm-2 id inside a firm-1 bulk list is ignored, never patched).

const BULK_PROPERTY_STATUSES = ["Occupied", "Vacant", "Listed", "Maintenance", "Sold"] as const;
const BULK_PROPERTY_CATEGORIES = [
  "Tenanted Property",
  "Property For Sale",
  "Disputed Property",
  "Personal Residence",
  "Other",
] as const;
/** Statuses that assert "nobody lives here" — ledger-guarded. */
const VACANT_CLASS_STATUSES = new Set(["Vacant", "Listed", "Sold"]);

/** Resolve a property row by Convex _id OR legacy custom id (any input shape). */
async function resolveBulkProperty(ctx: any, id: string): Promise<any | null> {
  try {
    const direct: any = await ctx.db.get(id as any);
    if (direct && direct.firmId !== undefined && direct.address !== undefined) return direct;
  } catch {
    // not a Convex id — fall through to the custom-id lookup
  }
  return await ctx.db
    .query("properties")
    .withIndex("by_custom_id", (q: any) => q.eq("id", id))
    .first();
}

/** Every unitKey a property row covers (the row itself + embedded units).
 *  Mirrors unitKeyFor: the ledger's key is the property Convex _id
 *  (optionally + embedded unit id/name) — see convex/unitLookup.ts. */
function propertyUnitKeys(row: any): string[] {
  const propKey = String(row._id ?? "");
  if (!propKey) return [];
  const keys = [propKey];
  for (const u of Array.isArray(row.units) ? row.units : []) {
    const unitPart = String(u?.id ?? u?.unitName ?? "");
    if (unitPart) keys.push(`${propKey}_${unitPart}`);
  }
  return keys;
}

export const bulkUpdateProperties = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    propertyIds: v.array(v.string()),
    status: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = String(caller.firmId || args.firmId);

    const status = args.status != null ? String(args.status) : null;
    const category = args.category != null ? String(args.category) : null;
    // Selection shape first (the user must pick rows before picking values),
    // then payload, then enums.
    if (!Array.isArray(args.propertyIds) || args.propertyIds.length === 0) {
      throw new Error("Select at least one property.");
    }
    if (args.propertyIds.length > 500) {
      throw new Error("Bulk updates are capped at 500 properties per call.");
    }
    if (!status && !category) {
      throw new Error("Nothing to update — provide a status or a category.");
    }
    if (status && !(BULK_PROPERTY_STATUSES as readonly string[]).includes(status)) {
      throw new Error(`Status must be one of: ${BULK_PROPERTY_STATUSES.join(", ")}.`);
    }
    if (category && !(BULK_PROPERTY_CATEGORIES as readonly string[]).includes(category)) {
      throw new Error(`Category must be one of: ${BULK_PROPERTY_CATEGORIES.join(", ")}.`);
    }

    const now = new Date().toISOString();
    let updated = 0;
    let conflicts = 0;
    let skipped = 0;
    const conflictLabels: string[] = [];

    // Deduplicate by the RESOLVED row (the same unit listed twice — or once by
    // Convex _id and once by legacy custom id — patches exactly once).
    const seenRowIds = new Set<string>();
    for (const rawId of args.propertyIds) {
      const id = String(rawId ?? "").trim();
      if (!id) continue;

      const row = await resolveBulkProperty(ctx, id);
      // Unknown ids and other firms' rows are skipped, never patched, and
      // never leak their existence beyond the count.
      if (!row || String(row.firmId ?? "") !== firmId) {
        skipped += 1;
        continue;
      }
      const rowId = String(row._id);
      if (seenRowIds.has(rowId)) continue;
      seenRowIds.add(rowId);

      // Ledger-consistency guard: a vacant-class status may not be applied
      // to a row whose units still have an ACTIVE tenancy.
      if (status && VACANT_CLASS_STATUSES.has(status)) {
        let activeOn: string | null = null;
        for (const key of propertyUnitKeys(row)) {
          const active = await findActiveTenancy(ctx, firmId, key);
          if (active) {
            activeOn = key;
            break;
          }
        }
        if (activeOn) {
          conflicts += 1;
          conflictLabels.push(
            `${row.address ?? "Property"}${row.rentalDetails?.unitName ? ` (${row.rentalDetails.unitName})` : ""}`
          );
          continue;
        }
      }

      const patch: any = { updatedAt: now };
      if (status) patch.status = status;
      if (category) patch.category = category;
      await ctx.db.patch(row._id, patch);
      updated += 1;
    }

    return { updated, conflicts, skipped, conflictLabels: conflictLabels.slice(0, 20) };
  },
});
