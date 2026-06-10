/**
 * Convex mirror of src/constants/tiers.ts — keep in sync when changing limits/prices.
 * Atrium property firm limits keyed by subscriptionPlan.
 * Both "Core" and "Starter" keys map to the same limits for backward compat.
 */

export const ATRIUM_LIMITS: Record<string, { units: number; tenants: number; whatsapp: number }> = {
  Starter:    { units: 20,  tenants: 25,   whatsapp: 100 },
  Core:       { units: 20,  tenants: 25,   whatsapp: 100 },   // alias for Starter
  Growth:     { units: 150, tenants: 200,  whatsapp: 500 },
  Pro:        { units: 999999, tenants: 999999, whatsapp: 999999 },
  Enterprise: { units: 999999, tenants: 999999, whatsapp: 999999 },
};
