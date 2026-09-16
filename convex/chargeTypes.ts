import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffCaller } from "./callerAuth";

/**
 * chargeTypes — firm-scoped, extensible charge type registry (Task 51).
 *
 * WHY: ledger_entries.type and service_charges.category were hardcoded
 * 5-value unions. Adding "Diesel Levy" or "Waste Management" required a
 * schema change and a deploy. Now:
 *   - The 5 pre-existing values on each surface are SYSTEM types — always
 *     valid, never seeded as rows, always returned by getChargeTypes.
 *   - A firm can add custom types (registry rows) and they flow through the
 *     SAME machinery: creation, cycles, partial payments, dunning/reminder
 *     guardrails, statements and portal display.
 *   - Writes validate against the registry (assertValidChargeType).
 *
 * NOTE: SYSTEM_LEDGER_TYPES / SYSTEM_SERVICE_CATEGORIES are mirrored in
 * src/utils/chargeTypeUtils.ts for label rendering — KEEP IN SYNC.
 */

export const SYSTEM_LEDGER_TYPES = [
  { key: "rent", label: "Rent", participatesInDunning: true, refundable: false },
  { key: "service_charge", label: "Service Charge", participatesInDunning: true, refundable: false },
  { key: "penalty", label: "Penalty", participatesInDunning: true, refundable: false },
  { key: "deposit", label: "Deposit", participatesInDunning: false, refundable: true },
  { key: "management_fee", label: "Management Fee", participatesInDunning: true, refundable: false },
] as const;

export const SYSTEM_SERVICE_CATEGORIES = [
  { key: "Diesel", label: "Diesel", participatesInDunning: true, refundable: false },
  { key: "Security", label: "Security", participatesInDunning: true, refundable: false },
  { key: "Cleaning", label: "Cleaning", participatesInDunning: true, refundable: false },
  { key: "Water", label: "Water", participatesInDunning: true, refundable: false },
  { key: "Other", label: "Other", participatesInDunning: true, refundable: false },
] as const;

const SYSTEM_LEDGER_KEYS = new Set<string>(SYSTEM_LEDGER_TYPES.map((t) => t.key as string));
const SYSTEM_SERVICE_KEYS = new Set<string>(SYSTEM_SERVICE_CATEGORIES.map((t) => t.key as string));

/**
 * Write-path validation: system types always pass; custom types must be an
 * ACTIVE registry entry of the right kind for the caller's firm.
 */
export async function assertValidChargeType(
  ctx: any,
  firmId: string,
  kind: "ledger" | "service",
  value: string
): Promise<void> {
  const systemKeys = kind === "ledger" ? SYSTEM_LEDGER_KEYS : SYSTEM_SERVICE_KEYS;
  if (systemKeys.has(value as any)) return;

  const custom = await ctx.db
    .query("charge_types")
    .withIndex("by_firm_key", (q: any) => q.eq("firmId", firmId).eq("key", value))
    .first();
  if (!custom || custom.kind !== kind || custom.status !== "active") {
    throw new Error(
      `Unknown ${kind} charge type "${value}". Add it under Settings → Charge Types first, or use a system type.`
    );
  }
}

/** Firm's full registry (system + custom) for a surface, for UI dropdowns. */
export const getChargeTypes = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    kind: v.optional(v.union(v.literal("ledger"), v.literal("service"))),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = caller.firmId as string;

    const rows = await ctx.db
      .query("charge_types")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const custom = rows
      .filter((r) => !args.kind || r.kind === args.kind)
      .filter((r) => r.status === "active")
      .map((r) => ({
        key: r.key,
        label: r.label,
        kind: r.kind,
        category: r.category,
        defaultCycle: r.defaultCycle ?? null,
        defaultAmount: r.defaultAmount ?? null,
        isSystem: false,
        participatesInDunning: r.participatesInDunning,
        refundable: r.refundable,
      }));

    const system = (args.kind
      ? args.kind === "ledger"
        ? SYSTEM_LEDGER_TYPES
        : SYSTEM_SERVICE_CATEGORIES
      : [...SYSTEM_LEDGER_TYPES, ...SYSTEM_SERVICE_CATEGORIES]
    ).map((t) => ({
      key: t.key,
      label: t.label,
      kind: (SYSTEM_LEDGER_KEYS.has(t.key as any) ? "ledger" : "service") as "ledger" | "service",
      category: "system",
      defaultCycle: null,
      defaultAmount: null,
      isSystem: true,
      participatesInDunning: t.participatesInDunning,
      refundable: t.refundable,
    }));

    return [...system, ...custom];
  },
});

/** Add a custom charge type (staff, own firm). Key is slugified + uniqueness-checked. */
export const createChargeType = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    label: v.string(),
    kind: v.union(v.literal("ledger"), v.literal("service")),
    category: v.optional(
      v.union(
        v.literal("billing"),
        v.literal("statutory"),
        v.literal("utility"),
        v.literal("service"),
        v.literal("penalty"),
        v.literal("deposit"),
        v.literal("other")
      )
    ),
    defaultCycle: v.optional(
      v.union(v.literal("Monthly"), v.literal("Quarterly"), v.literal("Annually"), v.literal("One-off"))
    ),
    defaultAmount: v.optional(v.number()),
    participatesInDunning: v.optional(v.boolean()),
    refundable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = caller.firmId as string;

    const label = args.label.trim();
    if (label.length < 2) throw new Error("Charge type label is too short.");

    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!key) throw new Error("Charge type label must contain letters or digits.");

    const systemKeys = args.kind === "ledger" ? SYSTEM_LEDGER_KEYS : SYSTEM_SERVICE_KEYS;
    if (systemKeys.has(key as any)) {
      throw new Error(`"${label}" collides with a system charge type.`);
    }

    const existing = await ctx.db
      .query("charge_types")
      .withIndex("by_firm_key", (q) => q.eq("firmId", firmId).eq("key", key))
      .first();
    if (existing) {
      if (existing.status === "archived") {
        await ctx.db.patch(existing._id, { status: "active", label });
        return existing._id;
      }
      throw new Error(`A charge type named "${label}" already exists.`);
    }

    return await ctx.db.insert("charge_types", {
      firmId,
      key,
      label,
      kind: args.kind,
      category: args.category ?? "other",
      defaultCycle: args.defaultCycle,
      defaultAmount: args.defaultAmount,
      isSystem: false,
      participatesInDunning: args.participatesInDunning ?? true,
      refundable: args.refundable ?? false,
      status: "active",
      createdBy: caller.email ?? args.userEmail,
      createdAt: Date.now(),
    });
  },
});

/** Archive (soft-delete) a custom charge type. System types cannot be removed. */
export const archiveChargeType = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = caller.firmId as string;

    const existing = await ctx.db
      .query("charge_types")
      .withIndex("by_firm_key", (q) => q.eq("firmId", firmId).eq("key", args.key))
      .first();
    if (!existing) throw new Error("Charge type not found.");
    if (existing.isSystem) throw new Error("System charge types cannot be archived.");

    // Archiving keeps historical ledger rows readable (label resolution
    // falls back to the raw key) but blocks new charges of this type.
    await ctx.db.patch(existing._id, { status: "archived" });
    return { ok: true };
  },
});
