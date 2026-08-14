/**
 * ADD-ONS CATALOG — Streamlined offerings
 *
 * PURGED: All WhatsApp add-ons removed (Extra 500 / Extra 2,000 messages).
 *         WhatsApp messaging is now a built-in feature, not a billable add-on.
 * PURGED: AI Priority Boost (consolidated into Pro plan).
 * PURGED: Managed Data Migration (now a free onboarding service).
 *
 * ACTIVE ADD-ONS (clean catalog):
 *   1. Extra Team Seats (5 + 10 packs)
 *   2. File Storage Expansion (50 GB)
 *   3. Custom Integration Setup (one-time)
 *
 * Pipeline:
 *   1. User purchases add-on → createAddonRequest mutation writes a
 *      pending row in subscriptionAddons table + notifies the Founder
 *   2. Founder sees pending requests in SubscriptionRequestsCenter
 *   3. Founder approves → addon becomes 'active'
 *   4. Active add-ons visible in Billing & Plans page
 *   5. Firm can cancel at any time (status → 'cancelled')
 */

export type AddonCategory = 'seats' | 'storage' | 'integration';
export type AddonBillingInterval = 'monthly' | 'annual' | 'one_time';
export type ProductType = 'legal' | 'property' | 'unified' | 'vega' | 'atrium' | 'komplete';

export interface AddonDef {
  id: string;
  name: string;
  description: string;
  category: AddonCategory;
  billingInterval: AddonBillingInterval;
  amount: number;             // NGN price per unit per billing cycle
  unitLabel: string;          // e.g. 'per 5 seats/mo'
  applicableProducts: ProductType[] | 'all';
  icon?: string;              // emoji or icon name (optional)
  popular?: boolean;
}

// ─── Category metadata for accordion grouping ──────────────────────────────
export const ADDON_CATEGORIES: { id: AddonCategory; label: string; subtitle: string; icon: string }[] = [
  { id: 'seats', label: 'Capacity & Storage', subtitle: 'Expand your workspace', icon: '👥' },
  { id: 'storage', label: 'Capacity & Storage', subtitle: 'Expand your workspace', icon: '💾' },
  { id: 'integration', label: 'Professional Services', subtitle: 'Bespoke setup & white-glove onboarding', icon: '🔌' },
];

export const ADDON_CATALOG: AddonDef[] = [
  // ─── EXTRA SEATS (all products) ─────────────────────────────────────
  {
    id: 'extra_seats_5',
    name: 'Extra 5 Seats',
    description: 'Add 5 additional user seats to your workspace. Includes full access to your current plan features.',
    category: 'seats',
    billingInterval: 'monthly',
    amount: 20000,
    unitLabel: 'per 5 seats/mo',
    applicableProducts: 'all',
    icon: '👥',
    popular: true,
  },
  {
    id: 'extra_seats_10',
    name: 'Extra 10 Seats',
    description: 'Add 10 additional user seats to your workspace. Best value for growing teams.',
    category: 'seats',
    billingInterval: 'monthly',
    amount: 36000,
    unitLabel: 'per 10 seats/mo',
    applicableProducts: 'all',
    icon: '👥',
  },

  // ─── STORAGE ADD-ONS (Vega / Komplete) ─────────────────────────────
  {
    id: 'extra_storage_50gb',
    name: 'Extra 50 GB File Storage',
    description: 'Add 50 GB of additional file storage for large document-heavy matters and external integrations.',
    category: 'storage',
    billingInterval: 'monthly',
    amount: 8000,
    unitLabel: 'per 50 GB/mo',
    applicableProducts: ['legal', 'vega', 'unified', 'komplete'],
    icon: '💾',
  },

  // ─── INTEGRATION ADD-ONS ────────────────────────────────────────────
  {
    id: 'custom_integration_setup',
    name: 'Custom Integration Setup',
    description: 'One-time setup of a custom integration (e.g. CAC API, Land Registry, accounting software). Includes 8 hours of developer time and white-glove onboarding.',
    category: 'integration',
    billingInterval: 'one_time',
    amount: 250000,
    unitLabel: 'one-time',
    applicableProducts: 'all',
    icon: '🔌',
    popular: true,
  },
];

/**
 * Get add-ons applicable to a given product.
 */
export function getAddonsForProduct(product: string | null | undefined): AddonDef[] {
  if (!product) return ADDON_CATALOG.filter(a => a.applicableProducts === 'all');
  const p = product.toLowerCase();
  return ADDON_CATALOG.filter(a => {
    if (a.applicableProducts === 'all') return true;
    return a.applicableProducts.some(ap => {
      const apLower = ap.toLowerCase();
      // Normalize: 'vega' == 'legal', 'atrium' == 'property', 'komplete' == 'unified'
      if (apLower === p) return true;
      if (apLower === 'legal' && p === 'vega') return true;
      if (apLower === 'vega' && p === 'legal') return true;
      if (apLower === 'property' && p === 'atrium') return true;
      if (apLower === 'atrium' && p === 'property') return true;
      if (apLower === 'unified' && p === 'komplete') return true;
      if (apLower === 'komplete' && p === 'unified') return true;
      return false;
    });
  });
}

/**
 * Get a single add-on by ID.
 */
export function getAddonById(id: string): AddonDef | null {
  return ADDON_CATALOG.find(a => a.id === id) || null;
}

/**
 * Format an add-on's price for display.
 */
export function formatAddonPrice(addon: AddonDef): string {
  const naira = `₦${addon.amount.toLocaleString('en-NG')}`;
  const suffix = addon.billingInterval === 'monthly' ? '/mo'
               : addon.billingInterval === 'annual' ? '/yr'
               : '';
  return `${naira}${suffix}`;
}
