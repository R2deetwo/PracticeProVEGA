/**
 * R13 — Product feature access (pure logic).
 *
 * PROBLEM (user report): a user who signs up for ATRIUM saw, as the first
 * screen after onboarding, the FeatureGuard dead-end wall:
 * "Feature not available — this feature is part of Vega."
 * Root cause: the app renders whatever URL the tab happens to be on
 * (a stale deep link like /matters left over from a previous Vega session
 * in that tab, or a logged-out tab sitting at a protected route). A fresh
 * Atrium user has no business being shown a legal view at all.
 *
 * FIX, in three layers:
 *   1. OnboardingWizard completion now navigates to '/' (dashboard) —
 *      App.tsx — so the first post-onboarding screen is deterministic.
 *   2. FeatureGuard no longer renders a dead-end wall: it auto-redirects
 *      to the dashboard with a friendly, product-named toast
 *      ("let's not take you to a page where you don't belong").
 *   3. This module holds the access decision as PURE, TESTED logic so
 *      the matrix (vega/atrium/unified x legal/property) is locked in by
 *      tests/unit/productAccess.test.ts.
 */

import { Product } from '../types';

/**
 * Can a workspace on `currentProduct` use a feature that belongs to
 * `requiredProduct`?
 *
 * Matrix (mirrors the pre-R13 inline logic in FeatureGuard exactly —
 * behavior is unchanged, only extracted for testing):
 *   - unified (Komplete) workspaces include everything.
 *   - vega ≡ legal, atrium ≡ property (legacy alias names accepted).
 */
export function isFeatureAllowed(
  requiredProduct: Product | Product[],
  currentProduct: Product | undefined
): boolean {
  const check = (req: Product, current: Product | undefined): boolean => {
    if (current === 'unified' || current === undefined) return true;
    if (req === 'property' && current === 'atrium') return true;
    if (req === 'atrium' && current === 'property') return true;
    if (req === 'legal' && current === 'vega') return true;
    if (req === 'vega' && current === 'legal') return true;
    return req === current;
  };

  return Array.isArray(requiredProduct)
    ? requiredProduct.some(req => check(req as Product, currentProduct))
    : check(requiredProduct as Product, currentProduct);
}

/** Display name for a product identifier, as used in user-facing copy. */
export function productDisplayName(product: Product | string): string {
  switch (product) {
    case 'legal':
    case 'vega':
      return 'Vega';
    case 'property':
    case 'atrium':
      return 'Atrium';
    default:
      return 'Komplete';
  }
}

/**
 * Friendly redirect copy for the auto-redirect toast. Kept here so the
 * wording is consistent and testable — never a dead-end "not available"
 * wall again.
 *
 * Examples:
 *   ("legal", "atrium") → "Matters & research are part of Vega. You're in your Atrium workspace — taking you to your dashboard."
 */
export function featureRedirectMessage(
  requiredProduct: Product | Product[],
  currentProduct: Product
): string {
  const missing = Array.isArray(requiredProduct)
    ? (requiredProduct as Product[]).map(productDisplayName).join(' or ')
    : productDisplayName(requiredProduct as Product);
  const current = productDisplayName(currentProduct);
  return `This area is part of ${missing}. Your ${current} workspace doesn't include it — taking you to your dashboard.`;
}
