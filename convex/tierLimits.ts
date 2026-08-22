/**
 * Convex mirror of src/constants/tiers.ts — keep in sync when changing limits/prices.
 *
 * This is the SINGLE SOURCE OF TRUTH for tier limits in the Convex backend.
 * The frontend has its own copy in src/constants/tiers.ts and src/hooks/useFeatures.ts
 * — both must stay in sync with this file.
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

/**
 * Get the max user seats for a firm based on its plan and product.
 *
 * This is the authoritative seat-limit lookup used by the founder dashboard.
 * Returns null for "unlimited" (Pro/Enterprise/Komplete).
 *
 * MIRRORS src/hooks/useFeatures.ts:107 — keep in sync.
 *
 * KOMPLETE = ENTERPRISE:
 *   Komplete is the top-tier unified platform. It is ALWAYS mapped to
 *   Enterprise-level features and limits (unlimited everything). It is
 *   NEVER labeled as "Pro" or "Basic".
 */
export function getMaxUsersForFirm(plan: string | undefined | null, product: string | undefined | null): number | null {
  const p = (plan || 'Core').trim();
  const prod = (product || 'legal').toLowerCase().trim();

  // Komplete (unified) = Enterprise tier = unlimited seats
  if (prod === 'unified' || prod === 'komplete' || p === 'Komplete') {
    return null;
  }

  // Vega (legal) tiers
  if (prod === 'legal' || prod === 'vega') {
    const limits = VEGA_LIMITS[p];
    if (limits) return limits.maxUsers;
    return VEGA_LIMITS.Core.maxUsers;
  }

  // Atrium (property) tiers — maxUsers is 1/5/null (same as Vega)
  if (prod === 'property' || prod === 'atrium') {
    if (p === 'Pro' || p === 'Enterprise') return null;
    if (p === 'Growth') return 5;
    return 1; // Core / Starter / default
  }

  return 1;
}

/**
 * Get the display plan label for a firm.
 *
 * KOMPLETE = ENTERPRISE:
 *   Firms on the Komplete product ALWAYS show as "Enterprise" regardless
 *   of their subscriptionPlan field. This enforces the brand rule that
 *   Komplete is the top-tier unified platform.
 *
 * Usage:
 *   const displayPlan = getDisplayPlan(firm.subscriptionPlan, firm.product);
 *   // Returns 'Enterprise' for Komplete firms, actual plan for others
 */
export function getDisplayPlan(plan: string | undefined | null, product: string | undefined | null): string {
  const p = (plan || 'Core').trim();
  const prod = (product || 'legal').toLowerCase().trim();

  // Komplete = Enterprise (always)
  if (prod === 'unified' || prod === 'komplete' || p === 'Komplete') {
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
 */
export function getTierLimitsForFirm(plan: string | undefined | null, product: string | undefined | null) {
  const p = (plan || 'Core').trim();
  const prod = (product || 'legal').toLowerCase().trim();

  const maxUsers = getMaxUsersForFirm(p, prod);

  // Komplete — all unlimited
  if (prod === 'unified' || prod === 'komplete' || p === 'Komplete') {
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

  // Vega (legal) — matters + storage
  if (prod === 'legal' || prod === 'vega') {
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
  if (prod === 'property' || prod === 'atrium') {
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

