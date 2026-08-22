/**
 * productConfig.ts — Van Clief-inspired structured product configuration.
 *
 * PRINCIPLE: "The structure IS the business logic."
 * Pricing tiers, feature flags, core services, and product metadata
 * should live in ONE structured data file — not scattered across
 * tiers.ts, addons.ts, tierLimits.ts, and hardcoded UI strings.
 *
 * This file is the SINGLE SOURCE OF TRUTH for:
 *   - Product names, descriptions, and branding
 *   - Pricing tiers (all three products)
 *   - Core service definitions (Atrium)
 *   - Add-on catalog
 *   - Feature flag defaults
 *
 * Both the frontend (landing page, settings, billing) and the backend
 * (tierLimits.ts, founderMetrics.ts) should import from here.
 */

// ─── Product Definitions ─────────────────────────────────────────────────

export type ProductId = 'vega' | 'atrium' | 'komplete';

export interface ProductDef {
  id: ProductId;
  name: string;
  tagline: string;
  description: string;
  icon: string; // emoji or icon name
  color: string; // tailwind color class
  landingPageSection: string;
}

export const PRODUCTS: Record<ProductId, ProductDef> = {
  vega: {
    id: 'vega',
    name: 'Vega',
    tagline: 'Legal Practice Management',
    description: 'Case management, AI-assisted drafting, and automated billing for Nigerian law firms.',
    icon: '⚖️',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    landingPageSection: 'Legal For Nigerian Law Firms',
  },
  atrium: {
    id: 'atrium',
    name: 'Atrium',
    tagline: 'Property Management',
    description: 'Rent collection, resident portals, maintenance tickets, and Sentry Pass visitor management for Nigerian property managers.',
    icon: '🏢',
    color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    landingPageSection: 'Property For Estate Managers',
  },
  komplete: {
    id: 'komplete',
    name: 'Komplete',
    tagline: 'Unified Platform',
    description: 'All Vega + Atrium features in one platform for diversified firms handling both legal and property matters.',
    icon: '🎯',
    color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    landingPageSection: 'Unified Legal + Property',
  },
};

// ─── Core Services (Atrium) ──────────────────────────────────────────────

export interface CoreServiceDef {
  key: 'serviceCharge' | 'electricity' | 'internet' | 'wasteManagement';
  label: string;
  description: string;
  icon: string;
  defaultActive: boolean;
}

export const CORE_SERVICES: CoreServiceDef[] = [
  {
    key: 'serviceCharge',
    label: 'Service Charge',
    description: 'Periodic charge for property maintenance and shared services',
    icon: 'Receipt',
    defaultActive: true,
  },
  {
    key: 'electricity',
    label: 'Electricity',
    description: 'Minimum Vend (MV) and prepaid meter tracking',
    icon: 'Bolt',
    defaultActive: true,
  },
  {
    key: 'internet',
    label: 'Internet',
    description: 'ISP billing and connectivity management',
    icon: 'Wifi',
    defaultActive: true,
  },
  {
    key: 'wasteManagement',
    label: 'Waste Management',
    description: 'Waste collection and disposal tracking',
    icon: 'Trash',
    defaultActive: true,
  },
];

// ─── Feature Flags ───────────────────────────────────────────────────────

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
  productScope: ProductId[] | 'all';
  tierRequired?: string; // minimum tier required
}

export const FEATURE_FLAGS: FeatureFlag[] = [
  {
    key: 'ai_chat',
    label: 'AI Copilot (ALOA/ARIA)',
    description: 'AI-powered chat assistant for legal/property queries',
    defaultEnabled: true,
    productScope: 'all',
  },
  {
    key: 'draft_pro',
    label: 'DraftPro Editor',
    description: 'AI-powered document drafting with placeholder guardrails',
    defaultEnabled: true,
    productScope: 'all',
  },
  {
    key: 'resident_portal',
    label: 'Resident Portal',
    description: 'Self-service portal for residents to view payments, log maintenance',
    defaultEnabled: true,
    productScope: ['atrium', 'komplete'],
    tierRequired: 'Growth',
  },
  {
    key: 'sentry_pass',
    label: 'Sentry Pass (VMS)',
    description: 'Visitor access code generation with gatehouse verification',
    defaultEnabled: false,
    productScope: ['atrium', 'komplete'],
  },
  {
    key: 'whatsapp_notifications',
    label: 'WhatsApp Notifications',
    description: 'WhatsApp rent reminders and demand notices (requires integration setup)',
    defaultEnabled: true,
    productScope: ['atrium', 'komplete'],
  },
  {
    key: 'trust_accounting',
    label: 'Trust Accounting',
    description: 'Toggleable trust account ledger for legal firms',
    defaultEnabled: false,
    productScope: ['vega', 'komplete'],
  },
];

// ─── Company Info ────────────────────────────────────────────────────────

export const COMPANY = {
  name: 'PracticePro Systems Limited',
  shortName: 'PracticePro',
  location: 'Lagos, Nigeria',
  email: 'practiceprosystems@gmail.com',
  founderEmail: 'founder@practicepro.ng',
  website: 'https://practice-pro-vega.vercel.app',
  established: '2026',
};

// ─── Helper Functions ────────────────────────────────────────────────────

export function getProduct(id: ProductId): ProductDef {
  return PRODUCTS[id];
}

export function getCoreService(key: string): CoreServiceDef | undefined {
  return CORE_SERVICES.find(s => s.key === key);
}

export function isFeatureEnabled(
  flagKey: string,
  product: ProductId,
  tier?: string,
  firmOverrides?: Record<string, boolean>,
): boolean {
  const flag = FEATURE_FLAGS.find(f => f.key === flagKey);
  if (!flag) return false;

  // Check product scope
  if (flag.productScope !== 'all' && !flag.productScope.includes(product)) {
    return false;
  }

  // Check tier requirement
  if (flag.tierRequired && tier) {
    const tierOrder = ['Core', 'Growth', 'Pro', 'Enterprise', 'Komplete'];
    const requiredIdx = tierOrder.indexOf(flag.tierRequired);
    const currentIdx = tierOrder.indexOf(tier);
    if (currentIdx < requiredIdx) return false;
  }

  // Check firm-level overrides
  if (firmOverrides && flagKey in firmOverrides) {
    return firmOverrides[flagKey];
  }

  return flag.defaultEnabled;
}
