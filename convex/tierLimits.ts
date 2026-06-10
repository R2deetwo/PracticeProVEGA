/**
 * Convex mirror of src/constants/tiers.ts — keep in sync when changing limits/prices.
 * Atrium property firm limits keyed by subscriptionPlan (Core, not Starter).
 * IMPORTANT: Both "Core" and "Starter" keys map to the same limits.
 * The UI shows "Starter" but the SubscriptionPlan enum uses "Core".
 */

export const ATRIUM_LIMITS: Record<string, { units: number; tenants: number; whatsapp: number }> = {
  Starter:    { units: 15,  tenants: 20,   whatsapp: 100 },
  Core:       { units: 15,  tenants: 20,   whatsapp: 100 },   // alias for Starter
  Growth:     { units: 35,  tenants: 50,   whatsapp: 500 },
  Pro:        { units: 100, tenants: 200,  whatsapp: 999999 },
  Enterprise: { units: 999999, tenants: 999999, whatsapp: 999999 },
};
