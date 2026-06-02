/**
 * TIER MATRIX — Single Source of Truth
 *
 * All pricing, feature labels, unit limits, and WhatsApp quotas
 * for every product variant live here. UI components, backend
 * mutations, and entitlement gates must read from this file.
 *
 * Convex mirror: convex/tierLimits.ts (keep in sync when changing limits/prices)
 */

export type ProductMode = 'vega' | 'atrium' | 'unified' | 'legal' | 'property';
export type TierId = 'Core' | 'Growth' | 'Pro' | 'Enterprise';

/** Komplet bundle discount vs sum of Vega + Atrium at the same tier */
const KOMPLET_BUNDLE_FACTOR: Record<Exclude<TierId, 'Enterprise'>, number> = {
  Core: 0.85,
  Growth: 0.75,
  Pro: 0.7,
};

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
}

const fmt = (n: number) => `₦${n.toLocaleString('en-NG')}`;

/** SCE per tenant/month from annual price and unit cap */
function calcSce(annualPrice: number, units: number): { scePer: string; scePer_annual: string } {
  if (!units || units <= 0) return {};
  const perMonthFromAnnual = Math.round(annualPrice / 12 / units);
  const perMonthFromMonthly = Math.round((annualPrice / 10) / units);
  return {
    scePer: `${fmt(perMonthFromMonthly)}/mo`,
    scePer_annual: `${fmt(perMonthFromAnnual)}/mo`,
  };
}

function buildAtriumFeatures(t: Pick<TierDef, 'maxUsers' | 'maxUnits' | 'maxManagedProperties' | 'maxActiveTenants' | 'whatsappLimit'> & { extras?: string[] }): string[] {
  const tenantCap =
    t.maxActiveTenants == null
      ? 'Unlimited Total Tenant Capacity'
      : `Up to ${t.maxActiveTenants} Total Tenant Capacity`;
  const wa =
    t.whatsappLimit == null
      ? 'Unlimited automated WhatsApp rent & demand notices'
      : `${t.whatsappLimit} automated WhatsApp rent & demand notices included`;
  const base = [
    tenantCap,
    `Up to ${t.maxUnits} managed units across portfolio`,
    wa,
    'Revenue Monitor — defaulter dashboard & ledger',
  ];
  return [...base, ...(t.extras || [])];
}

function buildVegaFeatures(t: Pick<TierDef, 'maxUsers' | 'maxActiveMatters' | 'maxCaseFileStorageGb'> & { extras: string[] }): string[] {
  const matters =
    t.maxActiveMatters == null
      ? 'Unlimited active matters'
      : `${t.maxActiveMatters} active matters`;
  const storage = `${t.maxCaseFileStorageGb} GB digital case file storage`;
  return [
    matters,
    storage,
    ...t.extras,
  ];
}

function kompletPrice(vega: TierDef, atrium: TierDef, tierId: Exclude<TierId, 'Enterprise'>): { monthly: number; annual: number } {
  const vm = vega.monthlyPrice ?? 0;
  const va = vega.annualPrice ?? 0;
  const am = atrium.monthlyPrice ?? 0;
  const aa = atrium.annualPrice ?? 0;
  const f = KOMPLET_BUNDLE_FACTOR[tierId];
  return {
    monthly: Math.round((vm + am) * f),
    annual: Math.round((va + aa) * f),
  };
}

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
      extras: ['Legal billing & ledger record-keeping'],
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
      maxUsers: 3,
      maxActiveMatters: 50,
      maxCaseFileStorageGb: 20,
      extras: [
        'Legal billing & ledger record-keeping',
        'Court rules & procedural intelligence',
        'Client Communication Portal (Secure Hub)',
        'ALOA® AI copilot (Standard)',
      ],
    }),
    maxUsers: 3,
    maxUnits: null,
    maxManagedProperties: null,
    maxActiveTenants: null,
    whatsappLimit: null,
    maxCaseFileStorageGb: 20,
    maxActiveMatters: 50,
  },
  Pro: {
    id: 'Pro',
    label: 'Pro',
    monthlyPrice: 80000,
    annualPrice: 768000,
    monthlyPriceDisplay: fmt(80000),
    annualPriceDisplay: fmt(768000),
    features: buildVegaFeatures({
      maxUsers: 10,
      maxActiveMatters: null,
      maxCaseFileStorageGb: 100,
      extras: [
        'Advanced legal billing & analytics',
        'Court rules & procedural intelligence',
        'Advanced Client Communications Portal',
        'ALOA® AI copilot (Uncapped Priority)',
      ],
    }),
    maxUsers: 10,
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
    features: ['Unlimited users', 'Unlimited matters', 'Custom court document archives', 'Contact sales for onboarding'],
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
    label: 'Starter',
    monthlyPrice: 19000,
    annualPrice: 190000,
    monthlyPriceDisplay: fmt(19000),
    annualPriceDisplay: fmt(190000),
    features: buildAtriumFeatures({
      maxUsers: 1,
      maxUnits: 15,
      maxManagedProperties: 10,
      maxActiveTenants: 20,
      whatsappLimit: 100,
      extras: ['Lease tracking & maintenance log'],
    }),
    maxUsers: 1,
    maxUnits: 15,
    maxManagedProperties: 10,
    maxActiveTenants: 20,
    whatsappLimit: 100,
    maxCaseFileStorageGb: null,
    maxActiveMatters: null,
    ...calcSce(190000, 15),
  },
  Growth: {
    id: 'Growth',
    label: 'Growth',
    monthlyPrice: 40000,
    annualPrice: 360000,
    monthlyPriceDisplay: fmt(40000),
    annualPriceDisplay: fmt(360000),
    features: buildAtriumFeatures({
      maxUsers: 3,
      maxUnits: 35,
      maxManagedProperties: 25,
      maxActiveTenants: 50,
      whatsappLimit: 500,
      extras: ['Service charge tracking', 'Rent demand notice templates'],
    }),
    maxUsers: 3,
    maxUnits: 35,
    maxManagedProperties: 25,
    maxActiveTenants: 50,
    whatsappLimit: 500,
    maxCaseFileStorageGb: null,
    maxActiveMatters: null,
    ...calcSce(360000, 35),
  },
  Pro: {
    id: 'Pro',
    label: 'Pro',
    monthlyPrice: 90000,
    annualPrice: 840000,
    monthlyPriceDisplay: fmt(90000),
    annualPriceDisplay: fmt(840000),
    features: buildAtriumFeatures({
      maxUsers: 10,
      maxUnits: 100,
      maxManagedProperties: 75,
      maxActiveTenants: 200,
      whatsappLimit: null,
      extras: ['Legal document generation (notices & demands)', 'Live defaulter dashboard'],
    }),
    maxUsers: 10,
    maxUnits: 100,
    maxManagedProperties: 75,
    maxActiveTenants: 200,
    whatsappLimit: null,
    maxCaseFileStorageGb: null,
    maxActiveMatters: null,
    recommended: true,
    ...calcSce(840000, 100),
  },
  Enterprise: {
    id: 'Enterprise',
    label: 'Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    monthlyPriceDisplay: 'Custom',
    annualPriceDisplay: 'Custom',
    features: ['Unlimited users, units & properties', 'Custom WhatsApp volume', 'Dedicated onboarding'],
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

// ─── UNIFIED (Komplet) — bundle discount vs Vega + Atrium ───────────────────
const kompletCore = kompletPrice(VEGA_TIERS.Core, ATRIUM_TIERS.Core, 'Core');
const kompletGrowth = kompletPrice(VEGA_TIERS.Growth, ATRIUM_TIERS.Growth, 'Growth');
const kompletPro = kompletPrice(VEGA_TIERS.Pro, ATRIUM_TIERS.Pro, 'Pro');

export const UNIFIED_TIERS: Record<TierId, TierDef> = {
  Core: {
    id: 'Core',
    label: 'Komplet Starter',
    monthlyPrice: kompletCore.monthly,
    annualPrice: kompletCore.annual,
    monthlyPriceDisplay: fmt(kompletCore.monthly),
    annualPriceDisplay: fmt(kompletCore.annual),
    features: [
      '1 User · 10 matters + 15 units',
      '1 GB case files + property revenue ledger',
      '100 WhatsApp notices/mo',
      'Lease & matter tracking',
    ],
    maxUsers: 1,
    maxUnits: 15,
    maxManagedProperties: 10,
    maxActiveTenants: 20,
    whatsappLimit: 100,
    maxCaseFileStorageGb: 5,
    maxActiveMatters: 10,
  },
  Growth: {
    id: 'Growth',
    label: 'Komplet Growth',
    monthlyPrice: kompletGrowth.monthly,
    annualPrice: kompletGrowth.annual,
    monthlyPriceDisplay: fmt(kompletGrowth.monthly),
    annualPriceDisplay: fmt(kompletGrowth.annual),
    features: [
      'Up to 3 Users · 50 matters + 35 units',
      '20 GB court document archives',
      '500 WhatsApp notices/mo',
      'Legal billing + service charge tracking',
    ],
    maxUsers: 3,
    maxUnits: 35,
    maxManagedProperties: 25,
    maxActiveTenants: 50,
    whatsappLimit: 500,
    maxCaseFileStorageGb: 25,
    maxActiveMatters: 50,
  },
  Pro: {
    id: 'Pro',
    label: 'Komplet Pro',
    monthlyPrice: kompletPro.monthly,
    annualPrice: kompletPro.annual,
    monthlyPriceDisplay: fmt(kompletPro.monthly),
    annualPriceDisplay: fmt(kompletPro.annual),
    features: [
      'Up to 10 Users · unlimited matters + 100 units',
      '100 GB secure matter archives',
      'Unlimited WhatsApp notices',
      'ALOA® AI + rent demand document generation',
    ],
    maxUsers: 10,
    maxUnits: 100,
    maxManagedProperties: 75,
    maxActiveTenants: 200,
    whatsappLimit: null,
    maxCaseFileStorageGb: 100,
    maxActiveMatters: null,
    recommended: true,
  },
  Enterprise: {
    id: 'Enterprise',
    label: 'Komplet Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    monthlyPriceDisplay: 'Custom',
    annualPriceDisplay: 'Custom',
    features: ['Full legal + property suite', 'Custom limits', 'Contact sales'],
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

export const getTiersForProduct = (product: ProductMode): Record<TierId, TierDef> => {
  if (product === 'atrium' || product === 'property') return ATRIUM_TIERS;
  if (product === 'unified') return UNIFIED_TIERS;
  return VEGA_TIERS;
};

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
  if (tier.monthlyPrice === null) return { price: 'Custom', per: '' };
  if (tier.monthlyPrice === 0 && tier.annualPrice === 0) return { price: 'Free', per: '' };
  if (billingCycle === 'annual') {
    return { price: tier.annualPriceDisplay, per: 'Per Annum' };
  }
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
export const ATRIUM_LIMITS_BY_PLAN: Record<string, { units: number; whatsapp: number }> = {
  Core: { units: ATRIUM_TIERS.Core.maxUnits!, whatsapp: ATRIUM_TIERS.Core.whatsappLimit! },
  Growth: { units: ATRIUM_TIERS.Growth.maxUnits!, whatsapp: ATRIUM_TIERS.Growth.whatsappLimit! },
  Pro: { units: ATRIUM_TIERS.Pro.maxUnits!, whatsapp: 999999 },
  Enterprise: { units: 999999, whatsapp: 999999 },
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
