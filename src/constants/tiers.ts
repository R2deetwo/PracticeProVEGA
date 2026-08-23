/**
 * TIER MATRIX — Single Source of Truth
 *
 * All pricing, feature labels, unit limits, and WhatsApp quotas
 * for every product variant live here. UI components, backend
 * mutations, and entitlement gates must read from this file.
 *
 * PRICING RULES:
 *   VEGA   — Primary: Monthly. Annual optional (20% off).
 *   ATRIUM — Monthly or Annual (annual gets ~20% discount). PRICING AUDIT: was annual-only.
 *            SCE (Service Charge Equivalent) is a framing device
 *            (annual ÷ 12 ÷ units), NOT a monthly payment option.
 *   KOMPLETE — Single tier, all features. Monthly or Annual.
 *
 * Convex mirror: convex/tierLimits.ts (keep in sync when changing limits/prices)
 */

export type ProductMode = 'vega' | 'atrium' | 'unified' | 'legal' | 'property';
export type TierId = 'Core' | 'Growth' | 'Pro' | 'Enterprise';

// Komplete is a SINGLE flat-rate tier — ₦2.5M/yr (ANNUAL ONLY, no monthly).
// FIX: Repriced from ₦2.2M to ₦2.5M. The old price was 23% below the raw sum
// of Vega Pro + Atrium Pro (₦768K + ₦2.1M = ₦2.868M). At ₦2.5M, Komplete is
// still a genuine ~13% discount off the raw sum, but positioned as a clear
// step above Atrium Pro alone (19% premium, not 5%).
// Unlimited seats. All add-ons included. Sentry Pass (VMS) included.
const KOMPLETE_MONTHLY = null;        // Komplete is NEVER billed monthly
const KOMPLETE_ANNUAL = 2500000;      // ₦2.5M/yr — unlimited seats, all add-ons

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
    scePer_annual: `${fmt(perUnitPerMonth)}/mo`,   // Same calc for both billing cycles
  };
}

/**
 * SCE CALCULATION FIX: For tiers with overage pricing (Atrium Pro, Enterprise),
 * the effective SCE decreases as the portfolio grows past the included unit cap.
 * Formula: (base_annual + overage_units × overage_rate × 12) ÷ 12 ÷ total_units
 *
 * Instead of showing a static "Scale-based" string, we compute a representative
 * SCE at the tier's base unit cap. The pricing page can show a live calculator
 * or a table demonstrating the decreasing cost per unit as portfolio grows.
 *
 * Worked example for Atrium Pro (₦2,100,000/yr, 100 included units, ₦1,600/unit/mo overage):
 *   At 100 units: (2,100,000 + 0 × 1,600 × 12) ÷ 12 ÷ 100 = ₦1,750/unit/mo
 *   At 200 units: (2,100,000 + 100 × 1,600 × 12) ÷ 12 ÷ 200 = ₦1,675/unit/mo
 *   At 300 units: (2,100,000 + 200 × 1,600 × 12) ÷ 12 ÷ 300 = ₦1,656/unit/mo
 *   At 400 units: (2,100,000 + 300 × 1,600 × 12) ÷ 12 ÷ 400 = ₦1,637.50/unit/mo
 */
function calcScaleBasedSce(
  baseAnnualPrice: number,
  includedUnits: number,
  overageRate: number,
): { scePer: string; scePer_annual: string } {
  // Show the SCE at the base unit cap — this is the starting point.
  // The pricing page can show the full decreasing table.
  const baseSce = Math.round(baseAnnualPrice / 12 / includedUnits);
  return {
    scePer: `From ${fmt(baseSce)}/mo`,
    scePer_annual: `From ${fmt(baseSce)}/mo`,
  };
}

function buildAtriumFeatures(t: Pick<TierDef, 'maxUsers' | 'maxUnits' | 'maxManagedProperties' | 'maxActiveTenants' | 'whatsappLimit'> & { extras?: string[] }): string[] {
  const tenantCap =
    t.maxActiveTenants == null
      ? 'Unlimited Total Tenant Capacity'
      : `Up to ${t.maxActiveTenants} Total Tenant Capacity`;
  // FIX: WhatsApp is now unlimited on ALL tiers. The tier-specific sophistication
  // copy (template-based, automated triggers, AI-personalized, custom API) is
  // added via the extras[] array by each tier definition. No longer generate a
  // generic WhatsApp line here — it would duplicate the extras line.
  const unitsLine =
    t.maxUnits == null
      ? 'Unlimited managed units across portfolio'
      : `Up to ${t.maxUnits} managed units across portfolio`;
  const base = [
    tenantCap,
    unitsLine,
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
    label: 'Free',                    // PRICING AUDIT: renamed from 'Core' to fix naming collision
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
        'Court Date Reminders — automated WhatsApp alerts 7/3/1 days before hearings',
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
// PRICING AUDIT: Added monthly billing (20% premium over annual/12)
// PRICING AUDIT: Renamed 'Core' label to 'Starter' (id stays 'Core' for DB compat)
// PRICING AUDIT: Increased WhatsApp limits (Starter 100→250, Pro already unlimited)
export const ATRIUM_TIERS: Record<TierId, TierDef> = {
  Core: {
    id: 'Core',
    label: 'Starter',                  // PRICING AUDIT: renamed from 'Core' to fix naming collision with Vega Free
    monthlyPrice: 49000,               // PRICING AUDIT: N49,000/mo (20% premium over N490K/yr ÷ 12)
    annualPrice: 490000,
    monthlyPriceDisplay: fmt(49000),
    annualPriceDisplay: fmt(490000),
    features: buildAtriumFeatures({
      maxUsers: 1,
      maxUnits: 10,
      maxManagedProperties: 10,
      maxActiveTenants: 15,
      whatsappLimit: null,              // FIX: Unlimited — no longer count-gated
      extras: ['Lease tracking & maintenance log', 'Includes 10 units, then ₦2,700/unit/month', 'Unlimited WhatsApp — template-based rent & demand notices*'],
    }),
    maxUsers: 1,
    maxUnits: 10,
    maxManagedProperties: 10,
    maxActiveTenants: 15,
    whatsappLimit: null,              // FIX: Unlimited (backend keeps fair-use sentinel)
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
    monthlyPrice: 96500,               // PRICING AUDIT: N96,500/mo (20% premium)
    annualPrice: 965000,
    monthlyPriceDisplay: fmt(96500),
    annualPriceDisplay: fmt(965000),
    features: buildAtriumFeatures({
      maxUsers: 5,
      maxUnits: 25,
      maxManagedProperties: 25,
      maxActiveTenants: 40,
      whatsappLimit: null,              // FIX: Unlimited — adds automated triggers
      extras: ['Service charge tracking', 'Rent demand notice templates', "Residents' Portal — SC/MV status, payment ledgers, automated receipts, maintenance tickets", 'Includes 25 units, then ₦2,100/unit/month (upgrade to Pro at 70 units)', 'Unlimited WhatsApp — adds automated triggers (auto-receipts, service charge notices)*'],
    }),
    maxUsers: 5,
    maxUnits: 25,
    maxManagedProperties: 25,
    maxActiveTenants: 40,
    whatsappLimit: null,              // FIX: Unlimited (backend keeps fair-use sentinel)
    maxCaseFileStorageGb: null,
    maxActiveMatters: null,
    // FIX: Lowered from 100 to 70. At 70+ units, Growth+overage costs
    // more than Pro's flat rate (₦2,100,000/yr). The old cap of 100 meant
    // firms at 85-100 units were silently overpaying by ₦277K-₦755K/yr.
    overageRate: 2100,
    overageStartUnit: 26,
    forcedUpgradeCap: 70,
    ...calcSce(965000, 25),
  },
  Pro: {
    id: 'Pro',
    label: 'Pro',
    monthlyPrice: 210000,              // FIX: Corrected to match ×10 pattern (210,000×10=2,100,000). Starter and Growth both use monthly×10=annual.
    annualPrice: 2100000,
    monthlyPriceDisplay: fmt(210000),
    annualPriceDisplay: fmt(2100000),
    features: buildAtriumFeatures({
      maxUsers: null,
      maxUnits: 100,
      maxManagedProperties: null,
      maxActiveTenants: null,
      whatsappLimit: null,
      extras: ['Estate administration document generation (notices & demands)', 'Live defaulter dashboard', "Uncapped Residents' Portal — SC/MV status, payment ledgers, automated receipts, maintenance tickets", 'Smart notification batching — digest delivery instead of scattered pings', 'Includes 100 units, then ₦1,600/unit/month', 'Unlimited WhatsApp — AI-personalized notices, live-triggered by defaulter dashboard events*'],
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
    ...calcScaleBasedSce(2100000, 100, 1600),
  },
  Enterprise: {
    id: 'Enterprise',
    label: 'Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    monthlyPriceDisplay: 'Custom',
    annualPriceDisplay: 'Custom',
    features: ['Unlimited users, units & properties', 'Unlimited WhatsApp — custom automation flows via API*', "Uncapped Residents' Portal (all features)", 'Dedicated onboarding', '400+ units — custom scaling', 'Dedicated support & custom integrations'],
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
// FIX: ₦2.5M/yr (up from ₦2.2M). Unlimited seats, all add-ons included.
// Position as "Everything. Everyone. One price."
// Komplete is the TOP-TIER unified platform — its price MUST NEVER be
// lower than individual standalone Pro/Enterprise plans.
// (Atrium Pro = ₦2.1M/yr, so Komplete at ₦2.5M/yr is correctly positioned above.)
export const KOMPLETE_TIER: TierDef = {
  id: 'Core',                       // Uses Core as TierId for compatibility
  label: 'Komplete',
  monthlyPrice: KOMPLETE_MONTHLY,   // null — Komplete is annual-only
  annualPrice: KOMPLETE_ANNUAL,
  monthlyPriceDisplay: '—',         // No monthly option for Komplete
  annualPriceDisplay: fmt(KOMPLETE_ANNUAL),
  features: [
    'Unlimited Seats (was 10 — now unlimited per pricing audit)',
    'Unlimited Matters & Units',
    'Unlimited Active Tenants',
    'Unlimited WhatsApp Reminders',
    'ARIA® AI Copilot (Uncapped Priority)',
    'Full Legal + Property Suite',
    'Sentry Pass (VMS) included — ₦7.5K/mo value',
    '500 GB shared storage',
    'Dedicated account manager',
    'Priority phone & WhatsApp support',
    'Custom integrations included',
    'Automated Retainer Billing & Client Auto-Invoicing',
    'Billing Monitor — pending queue, lawyer override controls',
  ],
  maxUsers: null,              // PRICING AUDIT: unlimited seats (was 10)
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

export const DISPLAY_TIER_IDS: TierId[] = ['Core', 'Growth', 'Pro', 'Enterprise'];

export const getDisplayTiersForProduct = (product: ProductMode): Record<TierId, TierDef> => {
  const all = getTiersForProduct(product);
  return { Core: all.Core, Growth: all.Growth, Pro: all.Pro, Enterprise: all.Enterprise };
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
  // Monthly billing: check monthlyPrice for null (Komplete annual-only = no monthly)
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
