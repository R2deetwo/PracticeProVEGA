/**
 * TIER MATRIX — Single Source of Truth
 *
 * All pricing, feature labels, unit limits, WhatsApp quotas, and
 * tenant capacity for every product variant live here.
 * UI components, backend mutations, and entitlement gates must
 * read from this file. DO NOT hardcode prices anywhere else.
 *
 * PRICING RULES:
 *   VEGA   — Primary: Monthly. Annual optional (20% off).
 *   ATRIUM — Annual only. NO monthly billing option.
 *            SCE (Service Charge Equivalent) is a framing device
 *            (annual ÷ 12 ÷ units), NOT a monthly payment option.
 *   KOMPLETE — Single tier, all features. Monthly or Annual.
 */

export type ProductMode = 'vega' | 'atrium' | 'unified' | 'legal' | 'property';
export type TierId = 'Core' | 'Growth' | 'Pro' | 'Enterprise';

export interface TierDef {
  id: TierId;
  /** Display label shown in pricing cards */
  label: string;
  /** null = annual-only product (Atrium); 0 = free tier */
  monthlyPrice: number | null;
  /** null = Custom / contact sales */
  annualPrice: number | null;
  monthlyPriceDisplay: string;
  annualPriceDisplay: string;
  features: string[];
  /** null = unlimited */
  maxUsers: number | null;
  /** null = unlimited (VEGA has no unit concept) */
  maxUnits: number | null;
  /** null = unlimited */
  maxTenants: number | null;
  /** null = unlimited */
  whatsappLimit: number | null;
  recommended?: boolean;
  requiresSetupFee?: boolean;      // ₦150,000 one-time fee
  scePer?: string;                 // Service Charge Equivalent display text
}

// ─── VEGA (Legal) ─────────────────────────────────────────────────────────────
// Primary: Monthly billing. Annual available at 20% discount.
// Will shift to monthly-only when law reports launch.
export const VEGA_TIERS: Record<TierId, TierDef> = {
  Core: {
    id: 'Core',
    label: 'Core',
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyPriceDisplay: 'Free',
    annualPriceDisplay: 'Free',
    features: [
      '1 User Account',
      '10 Active Matters',
      'Unlimited Data & Records',
      'Basic Case Management',
      'Procedural Intelligence',
    ],
    maxUsers: 1,
    maxUnits: null,
    maxTenants: null,
    whatsappLimit: null,
  },
  Growth: {
    id: 'Growth',
    label: 'Growth',
    monthlyPrice: 45000,
    annualPrice: 432000,
    monthlyPriceDisplay: '₦45,000',
    annualPriceDisplay: '₦432,000',
    features: [
      'Up to 3 Users',
      '50 Active Matters',
      'Unlimited Data & Records',
      'Client Communication',
      'Advanced Legal Billing',
    ],
    maxUsers: 3,
    maxUnits: null,
    maxTenants: null,
    whatsappLimit: null,
  },
  Pro: {
    id: 'Pro',
    label: 'Pro',
    monthlyPrice: 80000,
    annualPrice: 768000,
    monthlyPriceDisplay: '₦80,000',
    annualPriceDisplay: '₦768,000',
    features: [
      'Up to 10 Users',
      'Unlimited Matters',
      'Unlimited Data & Records',
      'ALOA® AI Copilot',
      'Enterprise Jurisdiction Intake',
    ],
    maxUsers: 10,
    maxUnits: null,
    maxTenants: null,
    whatsappLimit: null,
    recommended: true,
  },
  Enterprise: {
    id: 'Enterprise',
    label: 'Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    monthlyPriceDisplay: 'Custom',
    annualPriceDisplay: 'Custom',
    features: [
      'Unlimited Users',
      'Unlimited Matters',
      'Audit Logs & Role-Based Access',
      'Dedicated Account Manager',
      'Custom SLA Guarantee',
    ],
    maxUsers: null,
    maxUnits: null,
    maxTenants: null,
    whatsappLimit: null,
    requiresSetupFee: true,
  },
};

// ─── ATRIUM (Property) ────────────────────────────────────────────────────────
// ANNUAL ONLY. No monthly billing option.
// SCE = Service Charge Equivalent = annualPrice ÷ 12 ÷ maxUnits.
// This is a marketing framing device, not a payment option.
export const ATRIUM_TIERS: Record<TierId, TierDef> = {
  Core: {
    id: 'Core',
    label: 'Starter',
    monthlyPrice: null,              // Atrium is annual-only
    annualPrice: 190000,
    monthlyPriceDisplay: '—',        // No monthly option
    annualPriceDisplay: '₦190,000',
    features: [
      '1 User Account',
      'Up to 15 Units',
      'Up to 20 Tenants',
      '100 WhatsApp Reminders/mo',
      'Revenue Ledger',
    ],
    maxUsers: 1,
    maxUnits: 15,
    maxTenants: 20,
    whatsappLimit: 100,
    scePer: '₦1,056/mo',           // 190000 ÷ 12 ÷ 15 = 1055.56
  },
  Growth: {
    id: 'Growth',
    label: 'Growth',
    monthlyPrice: null,
    annualPrice: 360000,
    monthlyPriceDisplay: '—',
    annualPriceDisplay: '₦360,000',
    features: [
      'Up to 3 Users',
      'Up to 35 Units',
      'Up to 50 Tenants',
      '500 WhatsApp Reminders/mo',
      'Service Charge Tracking',
    ],
    maxUsers: 3,
    maxUnits: 35,
    maxTenants: 50,
    whatsappLimit: 500,
    scePer: '₦857/mo',             // 360000 ÷ 12 ÷ 35 = 857.14
  },
  Pro: {
    id: 'Pro',
    label: 'Pro',
    monthlyPrice: null,
    annualPrice: 840000,
    monthlyPriceDisplay: '—',
    annualPriceDisplay: '₦840,000',
    features: [
      'Up to 10 Users',
      'Up to 100 Units',
      'Up to 200 Tenants',
      'Unlimited WhatsApp Reminders',
      'Legal Document Generation',
      'Tenant Scoring & Pipeline',
    ],
    maxUsers: 10,
    maxUnits: 100,
    maxTenants: 200,
    whatsappLimit: null,
    recommended: true,
    scePer: '₦700/mo',             // 840000 ÷ 12 ÷ 100 = 700
  },
  Enterprise: {
    id: 'Enterprise',
    label: 'Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    monthlyPriceDisplay: 'Custom',
    annualPriceDisplay: 'Custom',
    features: [
      'Unlimited Users',
      'Unlimited Units & Tenants',
      '₦150k One-Time Setup Fee',
      'Audit Logs & Role-Based Access',
      'Dedicated Account Manager',
    ],
    maxUsers: null,
    maxUnits: null,
    maxTenants: null,
    whatsappLimit: null,
    requiresSetupFee: true,
    scePer: 'Scale-based',
  },
};

// ─── KOMPLETE (Unified) ───────────────────────────────────────────────────────
// Single tier. All VEGA + Atrium features, unlimited capacity.
// Only shown when user selects the Unified/Komplete product.
export const KOMPLETE_TIER: TierDef = {
  id: 'Core',                       // Uses Core as TierId for compatibility
  label: 'Komplete',
  monthlyPrice: 130000,
  annualPrice: 1248000,
  monthlyPriceDisplay: '₦130,000',
  annualPriceDisplay: '₦1,248,000',
  features: [
    'Unlimited Users',
    'Unlimited Matters & Units',
    'Unlimited Tenants',
    'Unlimited WhatsApp Reminders',
    'ALOA® AI Copilot',
    'Full Legal + Property Suite',
  ],
  maxUsers: null,
  maxUnits: null,
  maxTenants: null,
  whatsappLimit: null,
  recommended: true,
};

/**
 * Returns the correct tier set for a given product mode.
 * For unified/komplet, wraps the single tier in a Record for
 * compatibility with components that expect Record<TierId, TierDef>.
 */
export const getTiersForProduct = (product: ProductMode): Record<TierId, TierDef> => {
  if (product === 'atrium' || product === 'property') return ATRIUM_TIERS;
  if (product === 'unified') {
    // Komplete is a single tier; map it as "Core" for compatibility
    return { Core: KOMPLETE_TIER, Growth: KOMPLETE_TIER, Pro: KOMPLETE_TIER, Enterprise: KOMPLETE_TIER };
  }
  return VEGA_TIERS; // 'vega' | 'legal' | default
};

/** Checks if a product mode is property-capable (should unlock Atrium features). */
export const isPropertyCapable = (product?: string | null): boolean =>
  product === 'property' || product === 'atrium' || product === 'unified';

/** Checks if a product mode is legal-capable (should unlock Vega features). */
export const isLegalCapable = (product?: string | null): boolean =>
  product === 'legal' || product === 'vega' || product === 'unified' || !product;

/** Checks if a product mode is Komplete (unified single-tier). */
export const isKomplete = (product?: string | null): boolean =>
  product === 'unified';
