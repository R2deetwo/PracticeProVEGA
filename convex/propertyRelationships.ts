import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffCaller } from "./callerAuth";

/**
 * propertyRelationships — Atrium property use-relationship ontology (Task 52).
 *
 * WHY: Atrium's data model was tenant-only (properties.tenantId + units with
 * embedded tenant names + a thin `tenancies` table). Real Nigerian property
 * practice carries MANY more use relationships: licenses, easements, legal
 * and equitable mortgages, customary tenancies and pledges (family land),
 * caretaker arrangements, co-ownership (joint tenancy / tenancy in common),
 * pending sales, assignments (Governor's consent!), trusts and management
 * agencies — each with its own parties, lifecycle and consent paperwork.
 *
 * DESIGN (mirrors the proven charge_types registry, Task 51):
 *   - 16 SYSTEM relationship types encode the Nigerian land-law ontology.
 *   - Firms add custom kinds (relationship_types rows) and they flow through
 *     the SAME machinery — creation, lifecycle, consent tracking, ledger
 *     linkage and portal/statements display.
 *   - Writes validate against the registry (assertValidRelationshipType).
 *   - Existing tenancies/units are NOT auto-migrated —
 *     importTenanciesAsRelationships is an explicit, idempotent opt-in.
 *
 * NOTE: SYSTEM_RELATIONSHIP_TYPES is mirrored in
 * src/utils/relationshipTypes.ts for label rendering — KEEP IN SYNC.
 */

// ── The Nigerian land-law use-relationship ontology ─────────────────────────
//
// legalNature: what the relationship legally IS (drives UI copy + checks)
//   estate_in_land    — grantees hold an estate (term of years etc.)
//   license           — bare permission, no estate, revocable per terms
//   servitude         — right exercisable over another's land (easement/profit)
//   security_interest — lender's interest securing repayment
//   co_ownership      — concurrent ownership between the parties
//   transactional     — pre-completion or transfer stage of a transaction
//   management        — agency/custody, no estate and no title transfer
//
// requiresGovernorConsent: LUA s.22 — assignment, mortgage, transfer of
// possession and sublease of a right of occupancy require the Governor's
// consent first had and obtained. State practice varies (tenancies below the
// state threshold are exempt); the flag drives the consent tracker UI.
export const SYSTEM_RELATIONSHIP_TYPES = [
  {
    key: "tenancy",
    label: "Tenancy (Lease)",
    legalNature: "estate_in_land",
    grantorRole: "Landlord",
    granteeRole: "Tenant",
    requiresGovernorConsent: false,
    drivesRentLedger: true,
    lawBasis:
      "Periodic or fixed-term tenancy; recovery of premises governed by the state's tenancy / recovery-of-premises law (Tenancy Law of Lagos State 2011 in Lagos; Recovery of Premises Act in the FCT). Long terms can qualify as subleases needing Governor's consent.",
  },
  {
    key: "sublease",
    label: "Sublease / Sub-underlease",
    legalNature: "estate_in_land",
    grantorRole: "Head Tenant",
    granteeRole: "Subtenant",
    requiresGovernorConsent: true,
    drivesRentLedger: true,
    lawBasis:
      "Estate carved out of the head lease; alienation of the head tenant's right of occupancy is caught by LUA s.22 (consent) where the term exceeds the state threshold — track consent status.",
  },
  {
    key: "license",
    label: "License (bare permission)",
    legalNature: "license",
    grantorRole: "Licensor",
    granteeRole: "Licensee",
    requiresGovernorConsent: false,
    drivesRentLedger: false,
    lawBasis:
      "Personal permission to use land (kiosk, event space, equipment siting). Confers no estate and no title; revocable per its terms. Fees tracked as one-off or periodic consideration, not rent arrears.",
  },
  {
    key: "easement",
    label: "Easement (right of way etc.)",
    legalNature: "servitude",
    grantorRole: "Servient Owner",
    granteeRole: "Dominant Owner",
    requiresGovernorConsent: false,
    drivesRentLedger: false,
    lawBasis:
      "Right exercisable over the servient land (right of way, drainage, light and air) benefiting the dominant tenement. Runs with the land; created by grant, prescription or implication of long use.",
  },
  {
    key: "profit_a_prendre",
    label: "Profit à Prendre",
    legalNature: "servitude",
    grantorRole: "Servient Owner",
    granteeRole: "Profit Holder",
    requiresGovernorConsent: false,
    drivesRentLedger: false,
    lawBasis:
      "Right to take part of the land's produce or profits (timber, fish, minerals). Distinguished from an easement (which is a right of USE); commonly coupled with access easements.",
  },
  {
    key: "leasehold_mortgage",
    label: "Legal Mortgage (by deed / sublease)",
    legalNature: "security_interest",
    grantorRole: "Mortgagor",
    granteeRole: "Mortgagee",
    requiresGovernorConsent: true,
    drivesRentLedger: false,
    lawBasis:
      "Legal mortgage of a right of occupancy (usually a sublease or a demise by deed with power of sale). LUA s.22 consent required. Redemption, power of sale and foreclosure tracking apply.",
  },
  {
    key: "equitable_mortgage",
    label: "Equitable Mortgage (deposit of title deeds)",
    legalNature: "security_interest",
    grantorRole: "Mortgagor",
    granteeRole: "Mortgagee",
    requiresGovernorConsent: false,
    drivesRentLedger: false,
    lawBasis:
      "Created by deposit of title documents (and often a memorandum) with the lender. Weaker security than a legal mortgage; consent requirements and enforceability vary by state — record which documents are held.",
  },
  {
    key: "customary_tenancy",
    label: "Customary Tenancy (family land)",
    legalNature: "estate_in_land",
    grantorRole: "Overlord / Family Head",
    granteeRole: "Customary Tenant",
    requiresGovernorConsent: false,
    drivesRentLedger: false,
    lawBasis:
      "Possessory right held under customary law from the overlord family/community, often with tribute or acknowledgement. Determinable per customary law; NOT the same as a statutory tenancy — eviction and alienation follow customary rules.",
  },
  {
    key: "customary_pledge",
    label: "Customary Pledge of Land",
    legalNature: "security_interest",
    grantorRole: "Pledgor",
    granteeRole: "Pledgee",
    requiresGovernorConsent: false,
    drivesRentLedger: false,
    lawBasis:
      "Possession passes to the pledgee as security; redeemable by the pledgor on repayment (no forfeiture for default). Track the redemption window — disputes commonly turn on whether redemption remains open.",
  },
  {
    key: "caretaker",
    label: "Caretaker Arrangement",
    legalNature: "management",
    grantorRole: "Owner",
    granteeRole: "Caretaker",
    requiresGovernorConsent: false,
    drivesRentLedger: false,
    lawBasis:
      "Common Nigerian practice: the caretaker occupies/keeps the land or building, collects dues or oversees it for the owner. Rarely documented; position is weak against the owner but the arrangement generates recurring disputes — record the terms.",
  },
  {
    key: "joint_ownership",
    label: "Joint Ownership (survivorship)",
    legalNature: "co_ownership",
    grantorRole: "Co-Owner A",
    granteeRole: "Co-Owner B",
    requiresGovernorConsent: false,
    drivesRentLedger: false,
    lawBasis:
      "Joint tenancy with the four unities; survivorship operates on death. Alienation of a joint tenant's share severs the joint tenancy (converted to tenancy in common).",
  },
  {
    key: "tenancy_in_common",
    label: "Tenancy in Common (distinct shares)",
    legalNature: "co_ownership",
    grantorRole: "Co-Owner A",
    granteeRole: "Co-Owner B",
    requiresGovernorConsent: false,
    drivesRentLedger: false,
    lawBasis:
      "Concurrent ownership in defined or undivided shares without survivorship — the default for many family holdings. Track the shares; disposal of a share needs consent (LUA s.22) and first-refusal practice among co-owners.",
  },
  {
    key: "sale_pending",
    label: "Contract of Sale (pre-completion)",
    legalNature: "transactional",
    grantorRole: "Vendor",
    granteeRole: "Purchaser",
    requiresGovernorConsent: false,
    drivesRentLedger: false,
    lawBasis:
      "Equitable interest arises on contract (vendor becomes trustee of the legal estate for the purchaser). Track deposit, completion date, and perfection: Governor's consent + registration on completion.",
  },
  {
    key: "assignment",
    label: "Assignment of Right of Occupancy",
    legalNature: "transactional",
    grantorRole: "Assignor",
    granteeRole: "Assignee",
    requiresGovernorConsent: true,
    drivesRentLedger: false,
    lawBasis:
      "Transfer of the whole right of occupancy by deed of assignment. LUA s.22: Governor's consent first had and obtained; perfection then registration at the state lands registry.",
  },
  {
    key: "trust",
    label: "Trust / Beneficial Interest",
    legalNature: "estate_in_land",
    grantorRole: "Trustee",
    granteeRole: "Beneficiary",
    requiresGovernorConsent: false,
    drivesRentLedger: false,
    lawBasis:
      "Trustee holds the right of occupancy on trust (express, resulting or constructive). Beneficial interest binds in equity; document the trust instrument and the beneficiaries' entitlements.",
  },
  {
    key: "management_agency",
    label: "Management Agency",
    legalNature: "management",
    grantorRole: "Principal (Owner)",
    granteeRole: "Agent (Manager)",
    requiresGovernorConsent: false,
    drivesRentLedger: false,
    lawBasis:
      "Property-management mandate: collection of rents, maintenance, service-charge administration and reporting for a fee. No estate passes; authority and remuneration are purely contractual.",
  },
] as const;

const SYSTEM_RELATIONSHIP_KEYS = new Set<string>(
  SYSTEM_RELATIONSHIP_TYPES.map((t) => t.key as string)
);

/**
 * Write-path validation: system types always pass; custom types must be an
 * ACTIVE registry entry of the caller's firm.
 */
export async function assertValidRelationshipType(
  ctx: any,
  firmId: string,
  typeKey: string
): Promise<void> {
  if (SYSTEM_RELATIONSHIP_KEYS.has(typeKey)) return;

  const custom = await ctx.db
    .query("relationship_types")
    .withIndex("by_firm_key", (q: any) => q.eq("firmId", firmId).eq("key", typeKey))
    .first();
  if (!custom || custom.status !== "active") {
    throw new Error(
      `Unknown relationship type "${typeKey}". Add it under the property's Relationships tab first, or use a system type.`
    );
  }
}

/**
 * Resolve any property id form (Convex _id or legacy custom id) to the
 * canonical Convex document ID, verifying firm ownership. Returns null when
 * the property doesn't exist or belongs to another firm.
 */
async function resolvePropertyId(ctx: any, firmId: string, propertyIdArg: string): Promise<string | null> {
  let property: any = null;
  try {
    property = await ctx.db.get(propertyIdArg as any);
  } catch {
    // not a Convex id — fall through to the legacy-id lookup
  }
  if (!property) {
    property = await ctx.db
      .query("properties")
      .withIndex("by_custom_id", (q: any) => q.eq("id", propertyIdArg))
      .first();
  }
  if (!property || property.firmId?.toString() !== firmId.toString()) return null;
  return property._id as string;
}

/** Resolve type metadata (system or the firm's custom registry). */
async function resolveType(ctx: any, firmId: string, typeKey: string) {
  const system = SYSTEM_RELATIONSHIP_TYPES.find((t) => t.key === typeKey);
  if (system) return { ...system, isSystem: true };
  const custom = await ctx.db
    .query("relationship_types")
    .withIndex("by_firm_key", (q: any) => q.eq("firmId", firmId).eq("key", typeKey))
    .first();
  if (!custom) return null;
  return {
    key: custom.key,
    label: custom.label,
    legalNature: custom.legalNature ?? "estate_in_land",
    grantorRole: custom.grantorRole ?? "Grantor",
    granteeRole: custom.granteeRole ?? "Grantee",
    requiresGovernorConsent: custom.requiresGovernorConsent ?? false,
    drivesRentLedger: custom.drivesRentLedger ?? false,
    lawBasis: custom.lawBasis ?? "",
    isSystem: false,
  };
}

// ── Registry queries / mutations (mirror chargeTypes) ───────────────────────

/** Firm's full relationship-type registry (system + custom) for UI dropdowns. */
export const getRelationshipTypes = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = caller.firmId as string;

    const rows = await ctx.db
      .query("relationship_types")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .collect();

    const custom = rows
      .filter((r: any) => r.status === "active")
      .map((r: any) => ({
        key: r.key,
        label: r.label,
        legalNature: r.legalNature ?? "estate_in_land",
        grantorRole: r.grantorRole ?? "Grantor",
        granteeRole: r.granteeRole ?? "Grantee",
        requiresGovernorConsent: r.requiresGovernorConsent ?? false,
        drivesRentLedger: r.drivesRentLedger ?? false,
        lawBasis: r.lawBasis ?? "",
        isSystem: false,
      }));

    const system = SYSTEM_RELATIONSHIP_TYPES.map((t) => ({ ...t, isSystem: true }));
    return [...system, ...custom];
  },
});

/** Add a custom relationship type (staff, own firm). Key is slugified + unique. */
export const createRelationshipType = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    label: v.string(),
    legalNature: v.optional(
      v.union(
        v.literal("estate_in_land"),
        v.literal("license"),
        v.literal("servitude"),
        v.literal("security_interest"),
        v.literal("co_ownership"),
        v.literal("transactional"),
        v.literal("management")
      )
    ),
    grantorRole: v.optional(v.string()),
    granteeRole: v.optional(v.string()),
    requiresGovernorConsent: v.optional(v.boolean()),
    drivesRentLedger: v.optional(v.boolean()),
    lawBasis: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = caller.firmId as string;

    const label = args.label.trim();
    if (label.length < 2) throw new Error("Relationship type label is too short.");

    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!key) throw new Error("Relationship type label must contain letters or digits.");
    if (SYSTEM_RELATIONSHIP_KEYS.has(key)) {
      throw new Error(`"${label}" collides with a system relationship type.`);
    }

    const existing = await ctx.db
      .query("relationship_types")
      .withIndex("by_firm_key", (q: any) => q.eq("firmId", firmId).eq("key", key))
      .first();
    if (existing) {
      if (existing.status === "archived") {
        await ctx.db.patch(existing._id, { status: "active", label });
        return existing._id;
      }
      throw new Error(`A relationship type named "${label}" already exists.`);
    }

    return await ctx.db.insert("relationship_types", {
      firmId,
      key,
      label,
      legalNature: args.legalNature ?? "estate_in_land",
      grantorRole: args.grantorRole ?? "Grantor",
      granteeRole: args.granteeRole ?? "Grantee",
      requiresGovernorConsent: args.requiresGovernorConsent ?? false,
      drivesRentLedger: args.drivesRentLedger ?? false,
      lawBasis: args.lawBasis ?? "",
      status: "active",
      createdBy: caller.email ?? args.userEmail,
      createdAt: Date.now(),
    });
  },
});

/** Archive (soft-delete) a custom relationship type. System types cannot be removed. */
export const archiveRelationshipType = mutation({
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
    if (SYSTEM_RELATIONSHIP_KEYS.has(args.key)) {
      throw new Error("System relationship types cannot be removed.");
    }
    const existing = await ctx.db
      .query("relationship_types")
      .withIndex("by_firm_key", (q: any) => q.eq("firmId", caller.firmId as string).eq("key", args.key))
      .first();
    if (!existing) throw new Error(`No custom relationship type "${args.key}".`);
    await ctx.db.patch(existing._id, { status: "archived" });
    return existing._id;
  },
});

// ── Relationship records ─────────────────────────────────────────────────────

const CONSENT_STATUSES = ["not_required", "not_applied", "applied", "approved", "rejected"];
const RELATIONSHIP_STATUSES = ["pending", "active", "expired", "terminated", "disputed", "redeemed"];

const frequencyMap: Record<string, string> = {
  Monthly: "monthly",
  Quarterly: "quarterly",
  "Bi-Annually": "bi_annually",
  Annually: "annually",
};

/** Create a property-use relationship. Type is registry-validated. */
export const createRelationship = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    propertyId: v.string(),
    unitId: v.optional(v.string()),
    typeKey: v.string(),
    status: v.optional(v.string()),
    grantorContactId: v.optional(v.string()),
    granteeContactId: v.optional(v.string()),
    grantorName: v.optional(v.string()),
    granteeName: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    considerationAmount: v.optional(v.number()),
    considerationFrequency: v.optional(v.string()),
    consentStatus: v.optional(v.string()),
    consentReference: v.optional(v.string()),
    documentId: v.optional(v.string()),
    matterId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = caller.firmId as string;

    await assertValidRelationshipType(ctx, firmId, args.typeKey);

    // The property must belong to the caller's firm (R16: no cross-firm writes).
    // Accepts either the Convex _id or the legacy custom id; stores the
    // canonical _id so every relationship keys consistently.
    const canonicalPropertyId = await resolvePropertyId(ctx, firmId, args.propertyId);
    if (!canonicalPropertyId) {
      throw new Error("Property not found in this firm.");
    }

    if (args.status && !RELATIONSHIP_STATUSES.includes(args.status)) {
      throw new Error(`Invalid relationship status "${args.status}".`);
    }
    if (args.consentStatus && !CONSENT_STATUSES.includes(args.consentStatus)) {
      throw new Error(`Invalid consent status "${args.consentStatus}".`);
    }
    if (!args.grantorContactId && !args.grantorName && !args.granteeContactId && !args.granteeName) {
      throw new Error("Name at least one party (grantor or grantee).");
    }

    const type = await resolveType(ctx, firmId, args.typeKey);
    const nowIso = new Date().toISOString();

    return await ctx.db.insert("property_relationships", {
      firmId,
      propertyId: canonicalPropertyId,
      unitId: args.unitId,
      typeKey: args.typeKey,
      status: args.status ?? "active",
      grantorContactId: args.grantorContactId,
      granteeContactId: args.granteeContactId,
      grantorName: args.grantorName,
      granteeName: args.granteeName,
      startDate: args.startDate,
      endDate: args.endDate,
      considerationAmount: args.considerationAmount,
      considerationFrequency: args.considerationFrequency,
      drivesRentLedger: args.typeKey === "tenancy" || args.typeKey === "sublease" || (type?.drivesRentLedger ?? false),
      consentStatus: args.consentStatus ?? (type?.requiresGovernorConsent ? "not_applied" : "not_required"),
      consentReference: args.consentReference,
      documentId: args.documentId,
      matterId: args.matterId,
      notes: args.notes,
      source: "manual",
      _lastModifiedBy: caller.email ?? args.userEmail,
      _version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  },
});

/** Update an existing relationship (parties, dates, consent, status…). */
export const updateRelationship = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    relationshipId: v.string(), // Convex document ID
    patch: v.object({
      status: v.optional(v.string()),
      grantorContactId: v.optional(v.string()),
      granteeContactId: v.optional(v.string()),
      grantorName: v.optional(v.string()),
      granteeName: v.optional(v.string()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      considerationAmount: v.optional(v.number()),
      considerationFrequency: v.optional(v.string()),
      consentStatus: v.optional(v.string()),
      consentReference: v.optional(v.string()),
      documentId: v.optional(v.string()),
      matterId: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });

    if (args.patch.status && !RELATIONSHIP_STATUSES.includes(args.patch.status)) {
      throw new Error(`Invalid relationship status "${args.patch.status}".`);
    }
    if (args.patch.consentStatus && !CONSENT_STATUSES.includes(args.patch.consentStatus)) {
      throw new Error(`Invalid consent status "${args.patch.consentStatus}".`);
    }

    const rel: any = await ctx.db.get(args.relationshipId as any);
    if (!rel || rel.firmId !== (caller.firmId as string)) {
      throw new Error("Relationship not found in this firm.");
    }

    await ctx.db.patch(args.relationshipId as any, {
      ...args.patch,
      _lastModifiedBy: caller.email ?? args.userEmail,
      _version: (rel._version ?? 1) + 1,
      updatedAt: new Date().toISOString(),
    });
    return args.relationshipId;
  },
});

/** End a relationship (terminated / expired / redeemed). Keeps history. */
export const endRelationship = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    relationshipId: v.string(),
    endStatus: v.optional(
      v.union(
        v.literal("terminated"),
        v.literal("expired"),
        v.literal("redeemed")
      )
    ),
    endDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });

    const rel: any = await ctx.db.get(args.relationshipId as any);
    if (!rel || rel.firmId !== (caller.firmId as string)) {
      throw new Error("Relationship not found in this firm.");
    }

    await ctx.db.patch(args.relationshipId as any, {
      status: args.endStatus ?? "terminated",
      endDate: args.endDate ?? rel.endDate ?? new Date().toISOString(),
      notes: args.notes ? `${rel.notes ? rel.notes + "\n" : ""}${args.notes}` : rel.notes,
      _lastModifiedBy: caller.email ?? args.userEmail,
      _version: (rel._version ?? 1) + 1,
      updatedAt: new Date().toISOString(),
    });
    return args.relationshipId;
  },
});

/**
 * List relationships for a property (or the whole firm), enriched with type
 * metadata (label, roles, consent flag) so the UI needs one call.
 */
export const getRelationships = query({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
    propertyId: v.optional(v.string()),
    includeEnded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = caller.firmId as string;

    // Resolve the property id arg (Convex _id or legacy custom id) to the
    // canonical _id relationships are keyed on.
    let canonicalPropertyId: string | null = null;
    if (args.propertyId) {
      canonicalPropertyId = await resolvePropertyId(ctx, firmId, args.propertyId);
      if (!canonicalPropertyId) return []; // unknown/foreign property → no rows
    }

    const rows = canonicalPropertyId
      ? await ctx.db
          .query("property_relationships")
          .withIndex("by_property", (q: any) => q.eq("propertyId", canonicalPropertyId))
          .collect()
      : await ctx.db
          .query("property_relationships")
          .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
          .collect();

    const firmRows = rows.filter((r: any) => r.firmId === firmId);

    // Resolve custom types once for enrichment.
    const customTypes = await ctx.db
      .query("relationship_types")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .collect();
    const customByKey = new Map(customTypes.map((t: any) => [t.key, t]));

    const statusRank: Record<string, number> = {
      active: 0, disputed: 1, pending: 2, expired: 3, redeemed: 4, terminated: 5,
    };

    return firmRows
      .filter((r: any) => args.includeEnded || !["terminated", "expired", "redeemed"].includes(r.status))
      .map((r: any) => {
        const t =
          SYSTEM_RELATIONSHIP_TYPES.find((s) => s.key === r.typeKey) ?? customByKey.get(r.typeKey);
        return {
          _id: r._id,
          propertyId: r.propertyId,
          unitId: r.unitId ?? null,
          typeKey: r.typeKey,
          typeLabel: t?.label ?? r.typeKey,
          legalNature: t?.legalNature ?? null,
          grantorRole: t?.grantorRole ?? "Grantor",
          granteeRole: t?.granteeRole ?? "Grantee",
          requiresGovernorConsent: t?.requiresGovernorConsent ?? false,
          status: r.status,
          grantorContactId: r.grantorContactId ?? null,
          granteeContactId: r.granteeContactId ?? null,
          grantorName: r.grantorName ?? null,
          granteeName: r.granteeName ?? null,
          startDate: r.startDate ?? null,
          endDate: r.endDate ?? null,
          considerationAmount: r.considerationAmount ?? null,
          considerationFrequency: r.considerationFrequency ?? null,
          drivesRentLedger: r.drivesRentLedger ?? false,
          consentStatus: r.consentStatus ?? "not_required",
          consentReference: r.consentReference ?? null,
          documentId: r.documentId ?? null,
          matterId: r.matterId ?? null,
          notes: r.notes ?? null,
          source: r.source ?? "manual",
          createdAt: r.createdAt ?? null,
        };
      })
      .sort(
        (a: any, b: any) =>
          (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) ||
          String(a.endDate ?? "9999").localeCompare(String(b.endDate ?? "9999"))
      );
  },
});

/**
 * One-click, idempotent import of existing tenancies into the ontology.
 * Sources: the property's embedded units (multi-unit) and the top-level
 * tenant fields (single-tenant properties). Re-runs skip units/properties
 * that already have an active imported tenancy relationship.
 */
export const importTenanciesAsRelationships = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    firmId: v.string(),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const firmId = caller.firmId as string;

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .collect();

    // Existing imported relationships, for idempotency.
    const existing = await ctx.db
      .query("property_relationships")
      .withIndex("by_firm_type", (q: any) => q.eq("firmId", firmId).eq("typeKey", "tenancy"))
      .collect();
    const existingKeys = new Set(
      existing
        .filter((r: any) => !["terminated", "expired", "redeemed"].includes(r.status))
        .map((r: any) => `${r.propertyId}::${r.unitId ?? ""}`)
    );

    let created = 0;
    let skipped = 0;
    const nowIso = new Date().toISOString();

    for (const prop of properties as any[]) {
      const units = Array.isArray(prop.units) ? prop.units : [];
      const occupied = units.filter((u: any) => u && (u.tenantName || u.tenantContactId));

      if (occupied.length > 0) {
        for (const u of occupied) {
          const key = `${prop._id}::${u.id ?? u.unitName ?? ""}`;
          if (existingKeys.has(key)) { skipped++; continue; }
          await ctx.db.insert("property_relationships", {
            firmId,
            propertyId: prop._id,
            unitId: u.id ?? u.unitName ?? undefined,
            typeKey: "tenancy",
            status: "active",
            grantorContactId: prop.landlordId ?? undefined,
            granteeContactId: u.tenantContactId ?? undefined,
            granteeName: u.tenantName ?? undefined,
            startDate: u.leaseStart ?? undefined,
            endDate: u.leaseEnd ?? undefined,
            considerationAmount: u.rentAmount ?? undefined,
            considerationFrequency: u.rentFrequency
              ? frequencyMap[u.rentFrequency] ?? String(u.rentFrequency).toLowerCase()
              : undefined,
            drivesRentLedger: true,
            consentStatus: "not_required",
            source: "imported_unit",
            _lastModifiedBy: caller.email ?? args.userEmail,
            _version: 1,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
          existingKeys.add(key);
          created++;
        }
      } else {
        // Single-tenant property: tenantName lives in rentalDetails / top
        // level fields; import only when we can name a tenant.
        const tenantName =
          prop.tenantName ??
          (prop.rentalDetails && (prop.rentalDetails.tenantName || prop.rentalDetails.tenant)) ??
          null;
        if (!tenantName && !prop.currentTenantId && !prop.tenantId) { skipped++; continue; }

        const key = `${prop._id}::`;
        if (existingKeys.has(key)) { skipped++; continue; }
        await ctx.db.insert("property_relationships", {
          firmId,
          propertyId: prop._id,
          typeKey: "tenancy",
          status: "active",
          grantorContactId: prop.landlordId ?? undefined,
          granteeContactId: prop.currentTenantId ?? prop.tenantId ?? undefined,
          granteeName: tenantName ?? undefined,
          startDate: prop.rentalDetails?.leaseStart ?? undefined,
          endDate: prop.rentalDetails?.leaseEnd ?? undefined,
          considerationAmount: prop.rentalDetails?.rentAmount ?? undefined,
          considerationFrequency: prop.rentalDetails?.rentFrequency
            ? frequencyMap[prop.rentalDetails.rentFrequency] ?? String(prop.rentalDetails.rentFrequency).toLowerCase()
            : undefined,
          drivesRentLedger: true,
          consentStatus: "not_required",
          source: "imported_tenancy",
          _lastModifiedBy: caller.email ?? args.userEmail,
          _version: 1,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        existingKeys.add(key);
        created++;
      }
    }

    return {
      message: `Import complete: ${created} tenancy relationship${created === 1 ? "" : "s"} created, ${skipped} skipped (already imported or no tenant).`,
      created,
      skipped,
    };
  },
});
