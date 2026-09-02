/**
 * unitLookup — shared server-side resolver for the many shapes of
 * `service_charges.unitId` (and the same field on automation_logs /
 * scheduled_messages / ledger_entries).
 *
 * PAGE-AUDIT ROUND 6 (migration-gated items). `unitId` values in production
 * data come from four different writers and appear in four shapes:
 *   1. Property custom id (`properties.id`, legacy frontend id) — standalone
 *      properties picked from unit dropdowns before Convex ids were used.
 *   2. Property Convex `_id` — standalone properties (the dropdown emits
 *      `p.id`, which is the `_id` when no custom id exists).
 *   3. Composite `${propertyId}_${unitId|unitName}` — embedded units
 *      (usePropertyGroups flatUnits, AddChargeModal, round-5 lease bridge).
 *   4. Bare embedded unit id (`units[].id`) — older rows.
 *
 * Before this module, every consumer invented its own partial resolution
 * (`ctx.db.get(unitId)` + `.catch(() => null)`), which silently returns null
 * for shapes 3 and 4 — the reason wallet auto-deduct skipped embedded units
 * and payment-receipt WhatsApp messages were never sent for them.
 *
 * This module is server-internal (plain functions, not Convex functions):
 * create a resolver per firm and reuse it — the firm's property list is
 * fetched once and memoized, as are tenant-email → user lookups.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type UnitIdMatchShape =
  | "custom_id" // shape 1
  | "convex_id" // shape 2
  | "composite" // shape 3
  | "bare_unit"; // shape 4

export interface ResolvedUnitRef {
  /** The property document (standalone or parent of the embedded unit). */
  property: any;
  /** The embedded unit object, or null for standalone properties. */
  unit: any | null;
  /** Property Convex _id as a string. */
  propertyId: string;
  /** Property custom (legacy) id, when present. */
  customId: string | null;
  /** Best-effort human label, e.g. "Unit 3B · 12 Marina Rd". */
  label: string;
  /** Which shape matched — surfaced in migration reports. */
  match: UnitIdMatchShape;
}

export interface ResolvedTenantRef {
  /** Canonical tenant id: Convex user _id resolved via tenant email. */
  userConvexId: string | null;
  /** Raw tenant id stored on the unit/property (contact id, phone, legacy). */
  rawTenantId: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
}

// ── Resolver factory ───────────────────────────────────────────────────────

/**
 * Build a firm-scoped resolver. The firm's properties are loaded once and
 * memoized; per-email user lookups are memoized too, so scanning many
 * charges costs one properties query + one user query per distinct tenant.
 */
export function createUnitResolver(ctx: any, firmId: string) {
  let propsPromise: Promise<any[]> | null = null;
  const userByEmailCache = new Map<string, Promise<any | null>>();

  const loadProps = (): Promise<any[]> => {
    if (!propsPromise) {
      propsPromise = ctx.db
        .query("properties")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .collect()
        .catch(() => [] as any[]);
    }
    return propsPromise;
  };

  const userByEmail = (emailLower: string): Promise<any | null> => {
    let p = userByEmailCache.get(emailLower);
    if (!p) {
      p = (async () => {
        // by_token is the index every other tenant lookup in the app uses
        // (portals.getTenantInfo, authHelpers). by_email is a harmless
        // second chance for rows where the token identifier diverged.
        let user: any = await ctx.db
          .query("users")
          .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", emailLower))
          .first();
        if (!user) {
          user = await ctx.db
            .query("users")
            .withIndex("by_email", (q: any) => q.eq("email", emailLower))
            .first();
        }
        return user || null;
      })();
      userByEmailCache.set(emailLower, p);
    }
    return p;
  };

  const standalone = (prop: any, match: UnitIdMatchShape): ResolvedUnitRef => {
    const addr = (prop?.address || "").split(",")[0] || "Property";
    return {
      property: prop,
      unit: null,
      propertyId: String(prop._id),
      customId: prop?.id != null ? String(prop.id) : null,
      label: addr,
      match,
    };
  };

  const withUnit = (prop: any, unit: any, match: UnitIdMatchShape): ResolvedUnitRef => {
    const addr = (prop?.address || "").split(",")[0] || "Property";
    const unitName = unit?.unitName || unit?.name || unit?.id || "";
    return {
      property: prop,
      unit,
      propertyId: String(prop._id),
      customId: prop?.id != null ? String(prop.id) : null,
      label: unitName ? `${unitName} · ${addr}` : addr,
      match,
    };
  };

  /** Resolve any of the four unitId shapes to a property + optional unit. */
  const resolveUnit = async (unitId: string): Promise<ResolvedUnitRef | null> => {
    if (!unitId) return null;

    // Shape 1: property custom id ("id" field). Not firm-scoped — verify.
    let prop: any = await ctx.db
      .query("properties")
      .withIndex("by_custom_id", (q: any) => q.eq("id", unitId))
      .first();
    if (prop) {
      if (prop.firmId && prop.firmId !== firmId) return null;
      return standalone(prop, "custom_id");
    }

    // Shape 2: property Convex _id. db.get throws on non-id strings — catch.
    try {
      const direct: any = await ctx.db.get(unitId);
      if (direct && direct.firmId !== undefined && direct.address !== undefined) {
        // Looks like a property document (has address + firmId).
        if (direct.firmId && direct.firmId !== firmId) return null;
        return standalone(direct, "convex_id");
      }
    } catch {
      // Not a valid Convex id — composite or bare-unit shape; fall through.
    }

    // Shapes 3 & 4 need the firm's property list.
    const props = await loadProps();

    // Shape 3: composite `${propertyId}_${unitId|unitName}`. Never split on
    // "_" blindly — custom ids may contain underscores; instead test each
    // property's custom id AND Convex _id as the prefix, then exact-match
    // the suffix against the embedded units.
    for (const p of props) {
      const units: any[] = Array.isArray(p?.units) ? p.units : [];
      if (units.length === 0) continue;
      const prefixes = [p.id != null ? String(p.id) : null, String(p._id)];
      for (const prefix of prefixes) {
        if (!prefix || !unitId.startsWith(prefix + "_")) continue;
        const suffix = unitId.slice(prefix.length + 1);
        const unit = units.find(
          (u: any) => String(u?.id ?? "") === suffix || String(u?.unitName ?? "") === suffix
        );
        if (unit) return withUnit(p, unit, "composite");
      }
    }

    // Shape 4: bare embedded unit id.
    for (const p of props) {
      const units: any[] = Array.isArray(p?.units) ? p.units : [];
      const unit = units.find((u: any) => String(u?.id ?? "") === unitId);
      if (unit) return withUnit(p, unit, "bare_unit");
    }

    return null;
  };

  /** Derive tenant contact info (and canonical user id) for a resolved unit. */
  const tenantFor = async (ref: ResolvedUnitRef): Promise<ResolvedTenantRef> => {
    const p = ref.property || {};
    const u = ref.unit || {};
    const unitRd = u.rentalDetails || {};
    const propRd = p.rentalDetails || {};

    const email = (
      u.tenantEmail ||
      unitRd.tenantEmail ||
      propRd.tenantEmail ||
      p.tenantEmail ||
      ""
    )
      .toString()
      .trim() || null;

    const name = (
      u.tenantName ||
      unitRd.tenantName ||
      propRd.tenantName ||
      p.tenantName ||
      ""
    )
      .toString()
      .trim() || null;

    const phone = (
      u.tenantPhone ||
      unitRd.tenantPhone ||
      propRd.tenantPhone ||
      p.tenantPhone ||
      ""
    )
      .toString()
      .trim() || null;

    const rawTenantId = u.currentTenantId || u.tenantId || p.currentTenantId || p.tenantId || null;

    let userConvexId: string | null = null;
    if (email) {
      const user = await userByEmail(email.toLowerCase());
      if (user) userConvexId = String(user._id);
    }

    return { userConvexId, rawTenantId, name, phone, email };
  };

  return { resolveUnit, tenantFor, userByEmail };
}

/**
 * The canonical tenant id to write onto `service_charges.tenantId`.
 * Portal dues (portals.getTenantServiceCharges) and wallet auto-deduct
 * (wallets.processAutoDeductions) both key on the tenant's Convex user _id
 * first (portal `userId` / wallet `tenantId` are `currentUser.id`, the
 * Convex _id), with the raw stored tenant field as the legacy fallback.
 */
export function canonicalTenantId(t: ResolvedTenantRef): string | null {
  return t.userConvexId || (t.rawTenantId ? String(t.rawTenantId) : null) || null;
}
