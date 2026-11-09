/**
 * ADD-ONS CATALOG — re-export of the CANONICAL server-side catalog.
 *
 * ROUND D (Wave 2, D2): the catalog's single source of truth moved to
 * convex/addonCatalog.ts so the paid activation path can validate charged
 * amounts against catalog prices SERVER-SIDE (client-claimed amounts are
 * spoofable — a manipulated Paystack popup could charge ₦1 for a ₦20,000
 * add-on and self-activate). This module keeps its import path so no
 * frontend call site churns; the data and the helpers are identical.
 *
 * PURGED (historical): all WhatsApp add-ons (Extra 500 / Extra 2,000
 * messages — WhatsApp messaging is now built-in), AI Priority Boost
 * (consolidated into Pro), Managed Data Migration (now free onboarding).
 *
 * Pipeline:
 *   1. Paystack configured → user pays → purchaseAddonWithPayment ACTION
 *      verifies the reference + amount server-side and activates DIRECTLY
 *      (self-serve; the old flow wrote a pending_review row for a PAID
 *      purchase and no UI could ever approve it).
 *   2. Paystack NOT configured → createAddonRequest writes a pending_review
 *      row + notifies the Founder; the founder approves in the Founder
 *      App → Subscriptions → Add-ons tab (approve/reject, optional
 *      discount).
 *   3. Active add-ons visible in Billing & Plans; firm can cancel anytime.
 */

export * from '../../convex/addonCatalog';

// ─── Category metadata for accordion grouping (display-only, stays here) ────
import { ADDON_CATALOG } from '../../convex/addonCatalog';
import type { AddonCategory, AddonDef } from '../../convex/addonCatalog';

export const ADDON_CATEGORIES: { id: AddonCategory; label: string; subtitle: string; icon: string }[] = [
  { id: 'seats', label: 'Capacity & Storage', subtitle: 'Expand your workspace', icon: '👥' },
  { id: 'storage', label: 'Capacity & Storage', subtitle: 'Expand your workspace', icon: '💾' },
  { id: 'integration', label: 'Professional Services', subtitle: 'Bespoke setup & white-glove onboarding', icon: '🔌' },
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
 * Format an add-on's price for display.
 */
export function formatAddonPrice(addon: AddonDef): string {
  const naira = `₦${addon.amount.toLocaleString('en-NG')}`;
  const suffix = addon.billingInterval === 'monthly' ? '/mo'
               : addon.billingInterval === 'annual' ? '/yr'
               : '';
  return `${naira}${suffix}`;
}
