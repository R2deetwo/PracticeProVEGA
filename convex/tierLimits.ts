/**
 * Convex mirror of src/constants/tiers.ts — keep in sync when changing limits/prices.
 * Atrium property firm limits keyed by subscriptionPlan (Core, not Starter).
 */

export const ATRIUM_LIMITS: Record<string, { units: number; whatsapp: number }> = {
  Core: { units: 15, whatsapp: 100 },
  Growth: { units: 35, whatsapp: 500 },
  Pro: { units: 100, whatsapp: 999999 },
  Enterprise: { units: 999999, whatsapp: 999999 },
};
