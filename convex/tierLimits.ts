/**
 * Convex mirror of src/constants/tiers.ts — keep in sync when changing limits/prices.
 *
 * This is the SINGLE SOURCE OF TRUTH for tier limits in the Convex backend.
 * The frontend has its own copy in src/constants/tiers.ts and the pure
 * entitlement decision in src/utils/entitlements.ts — all must stay in sync.
 *
 * Atrium property firm limits keyed by subscriptionPlan.
 * Both "Core" and "Starter" keys map to the same limits for backward compat.
 */

export const ATRIUM_LIMITS: Record<string, { units: number; tenants: number; whatsapp: number; overageRate?: number; overageStartUnit?: number; forcedUpgradeCap?: number }> = {
  // PRICING AUDIT: whatsapp increased from 100 to 250 for Starter/Core
  Starter:    { units: 10,  tenants: 15,   whatsapp: 999999, overageRate: 2700, overageStartUnit: 11, forcedUpgradeCap: 25 },
  Core:       { units: 10,  tenants: 15,   whatsapp: 999999, overageRate: 2700, overageStartUnit: 11, forcedUpgradeCap: 25 },
  Growth:     { units: 25,  tenants: 40,   whatsapp: 999999, overageRate: 2100, overageStartUnit: 26, forcedUpgradeCap: 70 },
  Pro:        { units: 100, tenants: 999999, whatsapp: 999999, overageRate: 1600, overageStartUnit: 101, forcedUpgradeCap: 400 },
  Enterprise: { units: 999999, tenants: 999999, whatsapp: 999999 },
};

/**
 * Vega (Legal) tier limits — mirrors src/constants/tiers.ts VEGA_TIERS.
 * maxUsers is the user seat limit (null = unlimited).
 * maxActiveMatters is the active matter cap (null = unlimited).
 * maxCaseFileStorageGb is the storage cap in GB (null = unlimited).
 */
export const VEGA_LIMITS: Record<string, { maxUsers: number | null; maxActiveMatters: number | null; maxCaseFileStorageGb: number | null }> = {
  Core:       { maxUsers: 1,   maxActiveMatters: 10,   maxCaseFileStorageGb: 1 },
  Growth:     { maxUsers: 5,   maxActiveMatters: null, maxCaseFileStorageGb: 20 },
  Pro:        { maxUsers: null, maxActiveMatters: null, maxCaseFileStorageGb: 100 },
  Enterprise: { maxUsers: null, maxActiveMatters: null, maxCaseFileStorageGb: null },
};

/**
 * Komplete (Unified) tier — single flat plan, all limits null (unlimited).
 */
export const KOMPLETE_LIMITS = {
  maxUsers: null as number | null,
  maxUnits: null as number | null,
  maxManagedProperties: null as number | null,
  maxActiveTenants: null as number | null,
  maxActiveMatters: null as number | null,
};

// ════════════════════════════════════════════════════════════════════════
// K-3 (KOMPLETE unified-product integrity): THE AUTHORITATIVE PLAN RULE.
//
// DEFECT this fixes: every function below treated product === 'unified'
// as "unlimited everything" REGARDLESS of the plan. A unified firm whose
// Komplete trial expired (subscriptionPlan reverted to Core by the
// scanExpiredTrials cron) — or that was downgraded to a single-product
// plan without the product field flipping (the founderMetrics D5 leak:
// ~₦400K+/yr per firm) — kept unlimited seats, units and matters forever.
// The product field says which SURFACES exist; only the Komplete plan
// (or Enterprise, its equivalent — or an active trial of either) confers
// unlimited DEPTH. A unified product on any other plan gets that plan's
// limits across BOTH dimension sets: seats/matters/storage from the Vega
// table, units/tenants/WhatsApp from the Atrium table.
// ════════════════════════════════════════════════════════════════════════

/** Trial-aware effective plan for a firm record (mirrors useFeatures). */
export function effectiveFirmPlan(firm: {
  subscriptionPlan?: string | null;
  trialPlan?: string | null;
  trialEndsAt?: number | null;
}): string {
  const now = Date.now();
  if (
    firm.trialEndsAt &&
    firm.trialPlan &&
    firm.trialEndsAt > now
  ) {
    return firm.trialPlan;
  }
  return firm.subscriptionPlan || 'Core';
}

/** A plan (already trial-resolved) at Komplete/Enterprise depth. */
export function isUnifiedEntitledPlan(plan: string | null | undefined): boolean {
  const p = (plan || '').trim();
  return p === 'Komplete' || p === 'Enterprise';
}

function isUnifiedProduct(product: string | null | undefined): boolean {
  const prod = (product || '').toLowerCase().trim();
  return prod === 'unified' || prod === 'komplete';
}

function isVegaProduct(product: string | null | undefined): boolean {
  const prod = (product || '').toLowerCase().trim();
  return prod === 'legal' || prod === 'vega';
}

function isAtriumProduct(product: string | null | undefined): boolean {
  const prod = (product || '').toLowerCase().trim();
  return prod === 'property' || prod === 'atrium';
}

/**
 * Get the max user seats for a firm based on its plan and product.
 *
 * This is the authoritative seat-limit lookup used by the founder dashboard.
 * Returns null for "unlimited" (Pro/Enterprise/Komplete).
 *
 * MIRRORS src/utils/entitlements.ts — keep in sync.
 *
 * KOMPLETE = ENTERPRISE — but only when ENTITLED: a unified firm needs the
 * Komplete (or Enterprise) plan for unlimited seats. A unified firm on any
 * other plan (e.g. Core after trial expiry) gets that plan's seat limit.
 */
export function getMaxUsersForFirm(plan: string | undefined | null, product: string | undefined | null): number | null {
  const p = (plan || 'Core').trim();
  const prod = (product || 'legal').toLowerCase().trim();

  // Billed Komplete (or Enterprise-equivalent) — unlimited regardless of product
  if (isUnifiedEntitledPlan(p)) {
    return null;
  }

  // Komplete (unified) product WITHOUT the Komplete plan (post-trial /
  // downgraded): apply the plan's limits — same seats as Vega/Atrium at
  // that plan. Legal and property dimensions both come from the same plan.
  if (isUnifiedProduct(prod)) {
    const vega = VEGA_LIMITS[p] || VEGA_LIMITS.Core;
    return vega.maxUsers;
  }

  // Vega (legal) tiers
  if (isVegaProduct(prod)) {
    const limits = VEGA_LIMITS[p];
    if (limits) return limits.maxUsers;
    return VEGA_LIMITS.Core.maxUsers;
  }

  // Atrium (property) tiers — maxUsers is 1/5/null (same as Vega)
  if (isAtriumProduct(prod)) {
    if (p === 'Pro' || p === 'Enterprise') return null;
    if (p === 'Growth') return 5;
    return 1; // Core / Starter / default
  }

  return 1;
}

/**
 * Get the display plan label for a firm.
 *
 * KOMPLETE = ENTERPRISE — but only when ENTITLED: a unified firm on the
 * Komplete/Enterprise plan displays as "Enterprise" (the brand rule); a
 * unified firm on any other plan displays its REAL plan (the honest state
 * that also nudges the owner to fix the plan/product mismatch).
 */
export function getDisplayPlan(plan: string | undefined | null, product: string | undefined | null): string {
  const p = (plan || 'Core').trim();

  // Billed Komplete/Enterprise displays as "Enterprise" — the brand rule —
  // for ANY product (a Vega row awaiting Fix Product Mode still paid the
  // Komplete price). Everything else, including a unified product on a
  // lower plan, displays its REAL plan.
  if (isUnifiedEntitledPlan(p)) {
    return 'Enterprise';
  }

  return p;
}

/**
 * Get all tier limits for a firm based on its plan and product.
 * Used by the founder dashboard to show usage vs. limits for multiple metrics.
 *
 * Returns an object with:
 *   maxUsers           — user seat limit (null = unlimited)
 *   maxUnits           — Atrium property units (null = unlimited, Atrium only)
 *   maxManagedProperties — Atrium property records (null = unlimited, Atrium only)
 *   maxActiveTenants   — Atrium tenant profiles (null = unlimited, Atrium only)
 *   maxActiveMatters   — Vega active matters (null = unlimited, Vega only)
 *   maxCaseFileStorageGb — Vega storage in GB (null = unlimited, Vega only)
 *   whatsappLimit      — Atrium WhatsApp messages/month (null = unlimited, Atrium only)
 *
 * K-3: callers holding a firm RECORD should prefer resolveTierLimitsForFirm
 * (trial-aware). This pure (plan, product) form assumes the plan is already
 * trial-resolved.
 */
export function getTierLimitsForFirm(plan: string | undefined | null, product: string | undefined | null) {
  const p = (plan || 'Core').trim();
  const prod = (product || 'legal').toLowerCase().trim();

  const maxUsers = getMaxUsersForFirm(p, prod);

  // Billed Komplete (or Enterprise-equivalent) — unlimited everything,
  // regardless of the product field (a Vega row awaiting Fix Product Mode
  // still paid the Komplete price).
  if (isUnifiedEntitledPlan(p)) {
    return {
      maxUsers,
      maxUnits: KOMPLETE_LIMITS.maxUnits,
      maxManagedProperties: KOMPLETE_LIMITS.maxManagedProperties,
      maxActiveTenants: KOMPLETE_LIMITS.maxActiveTenants,
      maxActiveMatters: KOMPLETE_LIMITS.maxActiveMatters,
      maxCaseFileStorageGb: null,
      whatsappLimit: null,
    };
  }

  // Komplete (unified) product WITHOUT the Komplete plan (post-trial /
  // downgraded): the firm keeps both SURFACES but gets the plan's DEPTH on
  // each side — seats/matters/storage from the Vega table, units/tenants/
  // WhatsApp from the Atrium table. No dimension is unlimited unless that
  // plan makes it unlimited for the single-product firm.
  if (isUnifiedProduct(prod)) {
    const vega = VEGA_LIMITS[p] || VEGA_LIMITS.Core;
    const atrium = ATRIUM_LIMITS[p] || ATRIUM_LIMITS.Core;
    const atriumUnlimited = atrium.units === 999999;
    return {
      maxUsers,
      maxUnits: atriumUnlimited ? null : atrium.units,
      maxManagedProperties: atriumUnlimited ? null : atrium.units, // same as maxUnits
      maxActiveTenants: atrium.tenants === 999999 ? null : atrium.tenants,
      maxActiveMatters: vega.maxActiveMatters,
      maxCaseFileStorageGb: vega.maxCaseFileStorageGb,
      whatsappLimit: atrium.whatsapp === 999999 ? null : atrium.whatsapp,
    };
  }

  // Vega (legal) — matters + storage
  if (isVegaProduct(prod)) {
    const limits = VEGA_LIMITS[p] || VEGA_LIMITS.Core;
    return {
      maxUsers,
      maxUnits: null as number | null,           // N/A for Vega
      maxManagedProperties: null as number | null,
      maxActiveTenants: null as number | null,
      maxActiveMatters: limits.maxActiveMatters,
      maxCaseFileStorageGb: limits.maxCaseFileStorageGb,
      whatsappLimit: null as number | null,
    };
  }

  // Atrium (property) — units + tenants + properties + whatsapp
  if (isAtriumProduct(prod)) {
    const atrium = ATRIUM_LIMITS[p] || ATRIUM_LIMITS.Core;
    const isUnlimited = atrium.units === 999999;
    return {
      maxUsers,
      maxUnits: isUnlimited ? null : atrium.units,
      maxManagedProperties: isUnlimited ? null : atrium.units, // same as maxUnits
      maxActiveTenants: atrium.tenants === 999999 ? null : atrium.tenants,
      maxActiveMatters: null as number | null,  // N/A for Atrium
      maxCaseFileStorageGb: null as number | null,
      whatsappLimit: atrium.whatsapp === 999999 ? null : atrium.whatsapp,
    };
  }

  // Default
  return {
    maxUsers,
    maxUnits: null as number | null,
    maxManagedProperties: null as number | null,
    maxActiveTenants: null as number | null,
    maxActiveMatters: null as number | null,
    maxCaseFileStorageGb: null as number | null,
    whatsappLimit: null as number | null,
  };
}

/**
 * Trial-aware tier limits for a firm RECORD: resolves the effective plan
 * (trialPlan while the trial window is open, else subscriptionPlan) and
 * delegates to getTierLimitsForFirm. Every caller that holds the firm doc
 * should use this so a firm trialing Komplete keeps unlimited limits for
 * the trial window — and honestly loses them the moment it expires.
 */
export function resolveTierLimitsForFirm(firm: {
  subscriptionPlan?: string | null;
  product?: string | null;
  trialPlan?: string | null;
  trialEndsAt?: number | null;
}) {
  return getTierLimitsForFirm(effectiveFirmPlan(firm), firm.product);
}
