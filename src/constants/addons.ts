/**
 * ADD-ONS CATALOG — CRO Audit Revenue Expansion
 *
 * Defines upsellable add-ons that firms can purchase on top of their base
 * subscription. Each add-on has:
 *   - id: stable catalog identifier (used in DB)
 *   - name: human-readable display name
 *   - description: what the add-on includes
 *   - category: 'whatsapp' | 'seats' | 'storage' | 'ai' | 'integration'
 *   - billingInterval: 'monthly' | 'annual' | 'one_time'
 *   - amount: NGN price (per billing cycle, per unit)
 *   - unitLabel: e.g. 'per 500 messages', 'per seat', 'per GB'
 *   - applicableProducts: which products can buy this add-on
 *
 * Pipeline:
 *   1. User purchases add-on in main app → createAddonRequest mutation
 *      writes a pending row in subscriptionAddons table
 *   2. Founder sees pending add-on requests in SubscriptionRequestsCenter
 *   3. Founder approves (optionally with discount) → addon becomes 'active'
 *   4. Active add-ons are visible in the firm's Billing & Plans page
 *   5. Firm can cancel an active add-on at any time (status → 'cancelled')
 */

export type AddonCategory = 'whatsapp' | 'seats' | 'storage' | 'ai' | 'integration' | 'migration';
export type AddonBillingInterval = 'monthly' | 'annual' | 'one_time';
export type ProductType = 'legal' | 'property' | 'unified' | 'vega' | 'atrium' | 'komplete';

export interface AddonDef {
  id: string;
  name: string;
  description: string;
  category: AddonCategory;
  billingInterval: AddonBillingInterval;
  amount: number;             // NGN price per unit per billing cycle
  unitLabel: string;          // e.g. 'per 500 messages/mo'
  applicableProducts: ProductType[] | 'all';
  icon?: string;              // emoji or icon name (optional)
  popular?: boolean;
}

export const ADDON_CATALOG: AddonDef[] = [
  // ─── WHATSAPP ADD-ONS (Atrium / Komplete only) ──────────────────────
  {
    id: 'extra_whatsapp_500',
    name: 'Extra 500 WhatsApp Messages',
    description: 'Add 500 additional WhatsApp rent/demand notices per month. Useful for portfolios with high tenant turnover or seasonal demand notices.',
    category: 'whatsapp',
    billingInterval: 'monthly',
    amount: 5000,
    unitLabel: 'per 500 messages/mo',
    applicableProducts: ['property', 'atrium', 'unified', 'komplete'],
    icon: '💬',
    popular: true,
  },
  {
    id: 'extra_whatsapp_2000',
    name: 'Extra 2,000 WhatsApp Messages',
    description: 'Add 2,000 additional WhatsApp rent/demand notices per month. Best value for large portfolios.',
    category: 'whatsapp',
    billingInterval: 'monthly',
    amount: 18000,
    unitLabel: 'per 2,000 messages/mo',
    applicableProducts: ['property', 'atrium', 'unified', 'komplete'],
    icon: '💬',
  },

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
    name: 'Extra 50 GB Case File Storage',
    description: 'Add 50 GB of additional digital case file storage for large document-heavy matters.',
    category: 'storage',
    billingInterval: 'monthly',
    amount: 8000,
    unitLabel: 'per 50 GB/mo',
    applicableProducts: ['legal', 'vega', 'unified', 'komplete'],
    icon: '💾',
  },

  // ─── AI ADD-ONS (Vega Growth+ / Komplete) ───────────────────────────
  {
    id: 'ai_priority_boost',
    name: 'ARIA Priority Boost',
    description: 'Get priority queuing for ARIA AI requests during peak hours. Reduces response time by up to 60%.',
    category: 'ai',
    billingInterval: 'monthly',
    amount: 15000,
    unitLabel: 'per month',
    applicableProducts: ['legal', 'vega', 'unified', 'komplete'],
    icon: '⚡',
  },

  // ─── INTEGRATION ADD-ONS ────────────────────────────────────────────
  {
    id: 'custom_integration_setup',
    name: 'Custom Integration Setup',
    description: 'One-time setup of a custom integration (e.g. CAC API, Land Registry, accounting software). Includes 8 hours of developer time.',
    category: 'integration',
    billingInterval: 'one_time',
    amount: 250000,
    unitLabel: 'one-time',
    applicableProducts: 'all',
    icon: '🔌',
  },

  // ─── DATA MIGRATION ADD-ON (Atrium) ────────────────────────────────
  {
    id: 'managed_data_migration',
    name: 'Managed Data Migration',
    description: 'Our team migrates your Excel rent roll, tenant list, and lease data into Atrium. Up to 50 units included; ₦2,500 per additional unit.',
    category: 'migration',
    billingInterval: 'one_time',
    amount: 150000,
    unitLabel: 'one-time (up to 50 units)',
    applicableProducts: ['property', 'atrium', 'unified', 'komplete'],
    icon: '📦',
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
