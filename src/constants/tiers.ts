/**
 * TIER MATRIX — Single Source of Truth
 *
 * All pricing, feature labels, unit limits, and WhatsApp quotas
 * for every product variant live here. UI components, backend
 * mutations, and entitlement gates must read from this file.
 *
 * PRICING RULES:
 *   VEGA   — Primary: Monthly. Annual optional (20% off).
 *   ATRIUM — Annual only. NO monthly billing option.
 *            SCE (Service Charge Equivalent) is a framing device
 *            (annual ÷ 12 ÷ units), NOT a monthly payment option.
 *   KOMPLETE — Single tier, all features. Monthly or Annual.
 *
 * Convex mirror: convex/tierLimits.ts (keep in sync when changing limits/prices)
 */

export type ProductMode = 'vega' | 'atrium' | 'unified' | 'legal' | 'property';
export type TierId = 'Core' | 'Growth' | 'Pro' | 'Enterprise';

// Komplete is a SINGLE flat-rate tier — ₦130K/mo or ₦1.248M/yr.
// All VEGA + Atrium features, unlimited capacity.
const KOMPLETE_MONTHLY = 130000;
const KOMPLETE_ANNUAL = 1248000;

export interface TierDef {
  id: TierId;
  label: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  monthlyPriceDisplay: string;
  annualPriceDisplay: string;
  features: string[];
  maxUsers: number | null;
  /** Property: managed units (null = unlimited) */
  maxUnits: number | null;
  /** Property: distinct property records */
  maxManagedProperties: number | null;
  /** Property: active tenant profiles */
  maxActiveTenants: number | null;
  /** Property: WhatsApp rent/demand notices per month (null = unlimited) */
  whatsappLimit: number | null;
  /** Legal: digital case file storage cap in GB (null = unlimited) */
  maxCaseFileStorageGb: number | null;
  /** Legal: active matters cap (null = unlimited) */
  maxActiveMatters: number | null;
  recommended?: boolean;
  requiresSetupFee?: boolean;
  scePer?: string;
  scePer_annual?: string;
  /** Property: per-unit/month overage rate for units beyond included allotment */
  overageRate?: number;
  /** Property: unit number at which overage billing starts (e.g. 11 for Core = unit 11+) */
  overageStartUnit?: number;
  /** Property: hard cap at which further unit creation is blocked and upgrade is required */
  forcedUpgradeCap?: number;
}

const fmt = (n: number) => `₦${n.toLocaleString('en-NG')}`;

/** SCE per unit/month from annual price and unit cap */
function calcSce(annualPrice: number, units: number): { scePer: string; scePer_annual: string } {
  if (!units || units <= 0) return { scePer: '', scePer_annual: '' };
  // SCE = annual price ÷ 12 months ÷ units. This is a framing device, NOT a payment option.
  const perUnitPerMonth = Math.round(annualPrice / 12 / units);
  return {
    scePer: `${fmt(perUnitPerMonth)}/mo`,
    scePer_annual: `${fmt(perUnitPerMonth)}/mo`,   // Same calc — Atrium is annual-only
  };
}

function buildAtriumFeatures(t: Pick<TierDef, 'maxUsers' | 'maxUnits' | 'maxManagedProperties' | 'maxActiveTenants' | 'whatsappLimit'> & { extras?: string[] }): string[] {
  const tenantCap =
    t.maxActiveTenants == null
      ? 'Unlimited Total Tenant Capacity'
      : `Up to ${t.maxActiveTenants} Total Tenant Capacity`;
  const wa =
    t.whatsappLimit == null
      ? 'Unlimited WhatsApp rent & demand notices'
      : `${t.whatsappLimit} WhatsApp rent & demand notices included`;
  const unitsLine =
    t.maxUnits == null
      ? 'Unlimited managed units across portfolio'
      : `Up to ${t.maxUnits} managed units across portfolio`;
  const base = [
    tenantCap,
    unitsLine,
    wa,
    'Revenue Monitor — defaulter dashboard & ledger',
  ];
  return [...base, ...(t.extras || [])];
}

function buildVegaFeatures(t: Pick<TierDef, 'maxUsers' | 'maxActiveMatters' | 'maxCaseFileStorageGb'> & { extras: string[]; isProperty?: boolean }): string[] {
  const { isProperty = false } = t;
  const matters =
    t.maxActiveMatters == null
      ? 'Unlimited active matters'
      : `${t.maxActiveMatters} active matters`;
  const storage = `${t.maxCaseFileStorageGb} GB digital ${isProperty ? 'property' : 'case'} file storage`;
  const extras = t.extras.map(e =>
    isProperty
      ? e
          .replace('Advanced legal billing & analytics', 'Advanced revenue billing & analytics')
          .replace('Legal billing', 'Revenue billing')
      : e
  );
  return [
    matters,
    storage,
    ...extras,
  ];
}

// (kompletPrice function removed — Komplete is now a single flat-rate tier)

// ─── VEGA (Legal / PracticePro) ───────────────────────────────────────────────
export const VEGA_TIERS: Record<TierId, TierDef> = {
  Core: {
    id: 'Core',
    label: 'Core',
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyPriceDisplay: 'Free',
    annualPriceDisplay: 'Free',
    features: buildVegaFeatures({
      maxUsers: 1,
      maxActiveMatters: 10,
      maxCaseFileStorageGb: 1,
      extras: [
        'Legal billing & ledger record-keeping',
      ],
    }),
    maxUsers: 1,
    maxUnits: null,
    maxManagedProperties: null,
    maxActiveTenants: null,
    whatsappLimit: null,
    maxCaseFileStorageGb: 1,
    maxActiveMatters: 10,
  },
  Growth: {
    id: 'Growth',
    label: 'Growth',
    monthlyPrice: 45000,
    annualPrice: 432000,
    monthlyPriceDisplay: fmt(45000),
    annualPriceDisplay: fmt(432000),
    features: buildVegaFeatures({
      maxUsers: 5,
      maxActiveMatters: null,
      maxCaseFileStorageGb: 20,
      extras: [
        'Legal billing & ledger record-keeping',
        'Court rules & procedural intelligence',
        'Client Portal — milestone tracking, document vault, KYC uploads (up to 20 clients)',
        'ALOA™ AI copilot (Standard)',
        'Automated Retainer Billing & Client Auto-Invoicing',
      ],
    }),
    maxUsers: 5,
    maxUnits: null,
    maxManagedProperties: null,
    maxActiveTenants: null,
    whatsappLimit: null,
    maxCaseFileStorageGb: 20,
    maxActiveMatters: null,
  },
  Pro: {
    id: 'Pro',
    label: 'Pro',
    monthlyPrice: 80000,
    annualPrice: 768000,
    monthlyPriceDisplay: fmt(80000),
    annualPriceDisplay: fmt(768000),
    features: buildVegaFeatures({
      maxUsers: null,
      maxActiveMatters: null,
      maxCaseFileStorageGb: 100,
      extras: [
        'Advanced legal billing & analytics',
        'Court rules & procedural intelligence',
        'Uncapped Client Portal — milestone tracking, document vault, KYC uploads',
        'ALOA™ AI copilot (Uncapped Priority)',
        'Automated Retainer Billing & Client Auto-Invoicing',
        'Billing Monitor — pending queue, lawyer override controls',
        'Court Date Reminders — automated WhatsApp alerts 7/3/1 days before hearings',
      ],
    }),
    maxUsers: null,
    maxUnits: null,
    maxManagedProperties: null,
    maxActiveTenants: null,
    whatsappLimit: null,
    maxCaseFileStorageGb: 100,
    maxActiveMatters: null,
    recommended: true,
  },
  Enterprise: {
    id: 'Enterprise',
    label: 'Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    monthlyPriceDisplay: 'Custom',
    annualPriceDisplay: 'Custom',
    features: ['Unlimited users', 'Unlimited matters', 'Custom court document archives', 'Court Date Reminders — automated WhatsApp alerts 7/3/1 days before hearings', 'Contact sales for onboarding'],
    maxUsers: null,
    maxUnits: null,
    maxManagedProperties: null,
    maxActiveTenants: null,
    whatsappLimit: null,
    maxCaseFileStorageGb: null,
    maxActiveMatters: null,
    requiresSetupFee: true,
  },
};

// ─── ATRIUM (Property) — 2× baseline pricing, operational limits only ─────────
export const ATRIUM_TIERS: Record<TierId, TierDef> = {
  Core: {
    id: 'Core',
    label: 'Core',
    monthlyPrice: null,              // Atrium is annual-only — NO monthly option
    annualPrice: 490000,
    monthlyPriceDisplay: '—',        // No monthly option
    annualPriceDisplay: fmt(490000),
    features: buildAtriumFeatures({
      maxUsers: 1,
      maxUnits: 10,
      maxManagedProperties: 10,
      maxActiveTenants: 15,
      whatsappLimit: 100,
      extras: ['Lease tracking & maintenance log', 'Includes 10 units, then ₦2,700/unit/month'],
    }),
    maxUsers: 1,
    maxUnits: 10,
    maxManagedProperties: 10,
    maxActiveTenants: 15,
    whatsappLimit: 100,
    maxCaseFileStorageGb: null,
    maxActiveMatters: null,
    // Overage pricing: ₦2,700/unit/month for units 11-25, forced upgrade at 25
    overageRate: 2700,
    overageStartUnit: 11,
    forcedUpgradeCap: 25,
    ...calcSce(490000, 10),
  },
  Growth: {
    id: 'Growth',
    label: 'Growth',
    monthlyPrice: null,              // Atrium is annual-only
    annualPrice: 965000,
    monthlyPriceDisplay: '—',
    annualPriceDisplay: fmt(965000),
    features: buildAtriumFeatures({
      maxUsers: 5,
      maxUnits: 25,
      maxManagedProperties: 25,
      maxActiveTenants: 40,
      whatsappLimit: 500,
      extras: ['Service charge tracking', 'Rent demand notice templates', "Residents' Portal — SC/MV status, payment ledgers, automated receipts, maintenance tickets", 'Includes 25 units, then ₦2,100/unit/month'],
    }),
    maxUsers: 5,
    maxUnits: 25,
    maxManagedProperties: 25,
    maxActiveTenants: 40,
    whatsappLimit: 500,
    maxCaseFileStorageGb: null,
    maxActiveMatters: null,
    // Overage pricing: ₦2,100/unit/month for units 26-100, forced upgrade at 100
    overageRate: 2100,
    overageStartUnit: 26,
    forcedUpgradeCap: 100,
    ...calcSce(965000, 25),
  },
  Pro: {
    id: 'Pro',
    label: 'Pro',
    monthlyPrice: null,              // Atrium is annual-only
    annualPrice: 2100000,
    monthlyPriceDisplay: '—',
    annualPriceDisplay: fmt(2100000),
    features: buildAtriumFeatures({
      maxUsers: null,
      maxUnits: 100,
      maxManagedProperties: null,
      maxActiveTenants: null,
      whatsappLimit: null,
      extras: ['Estate administration document generation (notices & demands)', 'Live defaulter dashboard', "Uncapped Residents' Portal — SC/MV status, payment ledgers, automated receipts, maintenance tickets", 'Morning WhatsApp notification throttle system', 'Includes 100 units, then ₦1,600/unit/month'],
    }),
    maxUsers: null,
    maxUnits: 100,
    maxManagedProperties: null,
    maxActiveTenants: null,
    whatsappLimit: null,
    maxCaseFileStorageGb: null,
    maxActiveMatters: null,
    // Overage pricing: ₦1,600/unit/month for units 101-400, forced upgrade at 400
    overageRate: 1600,
    overageStartUnit: 101,
    forcedUpgradeCap: 400,
    recommended: true,
    scePer: 'Scale-based',
    scePer_annual: 'Scale-based',
  },
  Enterprise: {
    id: 'Enterprise',
    label: 'Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    monthlyPriceDisplay: 'Custom',
    annualPriceDisplay: 'Custom',
    features: ['Unlimited users, units & properties', 'Custom WhatsApp volume', "Uncapped Residents' Portal (all features)", 'Dedicated onboarding', '400+ units — custom scaling', 'Dedicated support & custom integrations'],
    maxUsers: null,
    maxUnits: null,
    maxManagedProperties: null,
    maxActiveTenants: null,
    whatsappLimit: null,
    maxCaseFileStorageGb: null,
    maxActiveMatters: null,
    requiresSetupFee: true,
    scePer: 'Scale-based',
    scePer_annual: 'Scale-based',
  },
};

// ─── KOMPLETE (Unified) — single tier, all features ──────────────────────────
// Only shown when user selects the Unified/Komplete product.
// Flat rate: ₦130K/mo or ₦1.248M/yr. All VEGA + Atrium features.
// Komplete is the TOP-TIER unified platform — its price MUST NEVER be
// lower than individual standalone Pro/Enterprise plans.
// Seat allowance: 10 seats standard, max 15 (Enterprise cap).
export const KOMPLETE_TIER: TierDef = {
  id: 'Core',                       // Uses Core as TierId for compatibility
  label: 'Komplete',
  monthlyPrice: KOMPLETE_MONTHLY,
  annualPrice: KOMPLETE_ANNUAL,
  monthlyPriceDisplay: fmt(KOMPLETE_MONTHLY),
  annualPriceDisplay: fmt(KOMPLETE_ANNUAL),
  features: [
    '10 Seats Standard (Max Enterprise Cap: 15 Seats)',
    'Unlimited Matters & Units',
    'Unlimited Active Tenants',
    'Unlimited WhatsApp Reminders',
    'ARIA® AI Copilot (Uncapped Priority)',
    'Full Legal + Property Suite',
    'Automated Retainer Billing & Client Auto-Invoicing',
    'Billing Monitor — pending queue, lawyer override controls',
  ],
  maxUsers: 10,              // 10 seats standard (not null/unlimited)
  maxUnits: null,
  maxManagedProperties: null,
  maxActiveTenants: null,
  whatsappLimit: null,
  maxCaseFileStorageGb: null,
  maxActiveMatters: null,
  recommended: true,
};

// UNIFIED_TIERS kept for backward compat — all keys map to the single Komplete tier.
export const UNIFIED_TIERS: Record<TierId, TierDef> = {
  Core: KOMPLETE_TIER,
  Growth: KOMPLETE_TIER,
  Pro: KOMPLETE_TIER,
  Enterprise: KOMPLETE_TIER,
};

export const getTiersForProduct = (product: ProductMode): Record<TierId, TierDef> => {
  if (product === 'atrium' || product === 'property') return ATRIUM_TIERS;
  if (product === 'unified') return UNIFIED_TIERS;  // All keys → KOMPLETE_TIER
  return VEGA_TIERS;
};

/** Checks if a product mode is Komplete (unified single-tier). */
export const isKomplete = (product?: string | null): boolean =>
  product === 'unified';

export const DISPLAY_TIER_IDS: TierId[] = ['Core', 'Growth', 'Pro'];

export const getDisplayTiersForProduct = (product: ProductMode): Record<Exclude<TierId, 'Enterprise'>, TierDef> => {
  const all = getTiersForProduct(product);
  return { Core: all.Core, Growth: all.Growth, Pro: all.Pro };
};

/** Price string for landing/settings cards */
export function formatTierPrice(
  tier: TierDef,
  billingCycle: 'monthly' | 'annual'
): { price: string; per: string } {
  // Free tier: both prices are 0
  if (tier.monthlyPrice === 0 && tier.annualPrice === 0) return { price: 'Free', per: '' };
  // Annual billing: check annualPrice for null (Enterprise = Custom)
  if (billingCycle === 'annual') {
    if (tier.annualPrice === null) return { price: 'Custom', per: '' };
    return { price: tier.annualPriceDisplay, per: 'Per Annum' };
  }
  // Monthly billing: check monthlyPrice for null (Atrium annual-only = no monthly)
  if (tier.monthlyPrice === null) return { price: tier.annualPriceDisplay, per: 'Per Annum' };
  return { price: tier.monthlyPriceDisplay, per: '/mo' };
}

export function formatTierFeatures(tier: TierDef): string[] {
  return tier.features;
}

/** Limits for Convex firm creation / enforcement */
export function getTierLimits(tierId: TierId, product: ProductMode): {
  maxUnits: number;
  whatsappLimit: number;
  maxCaseFileStorageGb: number;
} {
  const tier = getTiersForProduct(product)[tierId];
  return {
    maxUnits: tier.maxUnits ?? 999999,
    whatsappLimit: tier.whatsappLimit ?? 999999,
    maxCaseFileStorageGb: tier.maxCaseFileStorageGb ?? 999999,
  };
}

/** Map SubscriptionPlan enum string to tier limits for property firms */
export const ATRIUM_LIMITS_BY_PLAN: Record<string, { units: number; tenants: number; whatsapp: number }> = {
  Core: { units: ATRIUM_TIERS.Core.maxUnits!, tenants: ATRIUM_TIERS.Core.maxActiveTenants!, whatsapp: ATRIUM_TIERS.Core.whatsappLimit! },
  Growth: { units: ATRIUM_TIERS.Growth.maxUnits!, tenants: ATRIUM_TIERS.Growth.maxActiveTenants!, whatsapp: ATRIUM_TIERS.Growth.whatsappLimit! },
  Pro: { units: 999999, tenants: 999999, whatsapp: 999999 },
  Enterprise: { units: 999999, tenants: 999999, whatsapp: 999999 },
};

export const isPropertyCapable = (product?: string | null): boolean =>
  product === 'property' || product === 'atrium' || product === 'unified';

export const isLegalCapable = (product?: string | null): boolean =>
  product === 'legal' || product === 'vega' || product === 'unified' || !product;

/** In-app settings: map tier to SubscriptionPlan upgrade target */
export const TIER_TO_SUBSCRIPTION_PLAN: Record<TierId, string> = {
  Core: 'Core',
  Growth: 'Growth',
  Pro: 'Pro',
  Enterprise: 'Enterprise',
};
