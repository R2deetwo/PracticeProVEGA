/**
 * Convex mirror of src/constants/tiers.ts — keep in sync when changing limits/prices.
 * Atrium property firm limits keyed by subscriptionPlan.
 * Both "Core" and "Starter" keys map to the same limits for backward compat.
 */

export const ATRIUM_LIMITS: Record<string, { units: number; tenants: number; whatsapp: number; overageRate?: number; overageStartUnit?: number; forcedUpgradeCap?: number }> = {
  Starter:    { units: 10,  tenants: 15,   whatsapp: 100, overageRate: 2700, overageStartUnit: 11, forcedUpgradeCap: 25 },
  Core:       { units: 10,  tenants: 15,   whatsapp: 100, overageRate: 2700, overageStartUnit: 11, forcedUpgradeCap: 25 },
  Growth:     { units: 25,  tenants: 50,   whatsapp: 500, overageRate: 2100, overageStartUnit: 26, forcedUpgradeCap: 100 },
  Pro:        { units: 100, tenants: 999999, whatsapp: 999999, overageRate: 1600, overageStartUnit: 101, forcedUpgradeCap: 400 },
  Enterprise: { units: 999999, tenants: 999999, whatsapp: 999999 },
};
