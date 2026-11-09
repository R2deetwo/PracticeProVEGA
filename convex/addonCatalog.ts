/**
 * addonCatalog.ts — the CANONICAL add-on catalog (server-side source of truth).
 *
 * ROUND D (Wave 2, D2): the catalog used to live only in
 * src/constants/addons.ts (frontend). The paid activation path
 * (purchaseAddonWithPayment) validates the charged amount against the
 * catalog price server-side — a client-claimed amount is spoofable, so the
 * price list the server trusts must also live server-side. The frontend
 * module now re-exports this one; there is exactly ONE catalog.
 *
 * No Convex functions here — plain data + pure helpers (same pattern as
 * portals.ts NOTIFICATION_TYPE_DEFAULTS: non-function exports in convex/
 * modules are legal and ignored by the function registry).
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

export const ADDON_CATALOG: AddonDef[] = [
  // ─── EXTRA SEATS (all products except Komplete — unlimited seats there) ──
  {
    id: 'extra_seats_5',
    name: 'Extra 5 Seats',
    description: 'Add 5 additional user seats to your workspace. Includes full access to your current plan features.',
    category: 'seats',
    billingInterval: 'monthly',
    amount: 20000,
    unitLabel: 'per 5 seats/mo',
    applicableProducts: ['legal', 'vega', 'property', 'atrium'], // PRICING AUDIT: exclude Komplete (unlimited seats)
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
    applicableProducts: ['legal', 'vega', 'property', 'atrium'], // PRICING AUDIT: exclude Komplete (unlimited seats)
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

/** Server-side lookup used by the paid activation path. */
export function getAddonById(id: string): AddonDef | null {
  return ADDON_CATALOG.find((a) => a.id === id) || null;
}

/**
 * Expected payable amount for a purchase: catalog unit price × quantity.
 * The paid path requires the VERIFIED Paystack amount to cover this —
 * a client that charged itself less (manipulated popup amount) gets
 * rejected instead of activated.
 */
export function expectedAddonAmount(addonId: string, quantity: number): number | null {
  const addon = getAddonById(addonId);
  if (!addon) return null;
  const qty = Number.isFinite(quantity) && quantity >= 1 ? Math.floor(quantity) : 1;
  return addon.amount * qty;
}
