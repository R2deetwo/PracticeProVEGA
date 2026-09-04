import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useDataState } from "./DataContext";

import { Product as ProductType } from '../types';

interface Terminology {
  matter: string;
  matters: string;
  client: string;
  clients: string;
  type: string;
  stage: string;
  newMatter: string;
  activeMatters: string;
}

/** Role-derived signer context for KOMPLETE (unified) mode. */
export interface SignerContext {
  /** The user's actual name from their profile (e.g. "Barr. Chukwuma Okafor") */
  signerName: string;
  /** A human-readable title/role the user has set (e.g. "Principal Counsel", "Managing Director", "Property Consultant") */
  signerTitle: string;
  /** The raw UserRole enum value from the user profile */
  userRole: string;
}

interface ProductContextValue {
  product: ProductType;
  isLegal: boolean;
  isProperty: boolean;
  isUnified: boolean;
  isVega: boolean;
  isAtrium: boolean;
  /** True if firm has property-management features (Atrium OR Komplete). */
  hasPropertyFeatures: boolean;
  /** True if firm has legal-practice features (Vega OR Komplete). */
  hasLegalFeatures: boolean;
  terminology: Terminology;
  /** Only populated when `isUnified` (KOMPLETE). VEGA/ATRIUM derive role from product variant. */
  signerContext: SignerContext | null;
  /**
   * ROUND 15: True once the product variant came from REAL data (demo
   * flag for the demo user, the firm record once data is loaded, or the
   * user record's own product field) — rather than the 'unified'
   * hydration default. Until this flips true, `product`/`isProperty`/
   * `isUnified` are provisional and completion-style logic (getting-
   * started checklist celebration, setup banner) must NOT evaluate on
   * them: during the hydration window the default briefly makes every
   * firm look KOMPLETE, which historically let the wrong item set drive
   * premature "You're all set!" celebration toasts.
   */
  isProductResolved: boolean;
}

const ProductContext = createContext<ProductContextValue>({
  product: "unified",
  isLegal: true,
  isProperty: true,
  isUnified: true,
  isVega: false,
  isAtrium: false,
  hasPropertyFeatures: true,
  hasLegalFeatures: true,
  terminology: {
    matter: 'Matter',
    matters: 'Matters',
    client: 'Client',
    clients: 'Clients',
    type: 'Practice Area',
    stage: 'Stage',
    newMatter: 'New Matter',
    activeMatters: 'Active Matters'
  },
  signerContext: null,
  isProductResolved: false,
});

export function ProductProvider({ children }: { children?: ReactNode }) {
  const { currentUser } = useAuth();
  const { appState, isDataLoaded } = useDataState();

  const value = useMemo<ProductContextValue>(() => {
    // Read session storage once at memo compute time (safe — useMemo only runs when deps change)
    const demoProd = typeof window !== 'undefined' ? window.sessionStorage.getItem('practicepro_demo_product') : null;

    let rawProduct = "unified";

    // ─── Defense-in-depth: ignore demo flag for real users ──────────────
    // The demo flag ('practicepro_demo_product') is set by LeadCaptureModal
    // when the user clicks "Try Demo". It should ONLY apply to the demo
    // user (demo@practicepro.ng). For real users, we ignore it and use
    // the firm/user data instead. This prevents a stale demo flag from
    // overriding a Komplete firm's product mode.
    const isDemoUser = currentUser?.email === 'demo@practicepro.ng';

    if (demoProd && isDemoUser) {
      // Demo switcher takes highest priority — but only for the demo user
      rawProduct = demoProd;
    } else if (currentUser && isDataLoaded && appState?.firmDetails) {
      // Fall back to firm's saved product setting
      rawProduct = (appState.firmDetails as any).product || "unified";

      // ─── SAFETY NET (Komplete/Enterprise plan enforcement) ──────────────
      // If ANY of the following signals indicate Komplete/Enterprise, force
      // the product to 'unified'. This is the LAST line of defense against
      // the recurring "properties disappearing for Komplete firms" bug.
      //
      // Signals checked:
      // 1. firmDetails.subscriptionPlan === 'Komplete' or 'Enterprise'
      // 2. firmDetails.product === 'komplete' or 'unified'
      // 3. currentUser.product === 'unified' or 'komplete'
      // 4. firmDetails has property data (properties array exists and non-empty)
      //
      // WHY SO AGGRESSIVE: The user has reported property features disappearing
      // from Komplete firms MULTIPLE times. Each time, the root cause is that
      // firmDetails.product is stale ('vega') and the subscriptionPlan field
      // is missing or not set to 'Komplete'. Rather than rely on a single
      // field, we check ALL available signals.
      const plan = (appState.firmDetails as any).subscriptionPlan;
      const planStr = typeof plan === 'string' ? plan.toLowerCase() : '';
      const firmProduct = (appState.firmDetails as any).product;
      const userProduct = currentUser?.product;

      // Check 1: subscription plan
      const planIsKomplete = planStr === 'komplete' || planStr === 'enterprise';

      // Check 2: firm product field
      const firmProductIsUnified = firmProduct === 'komplete' || firmProduct === 'unified';

      // Check 3: user product field (the user's own record)
      // Cast to string because the type doesn't include 'komplete' but
      // the database might store it.
      const userProductStr = typeof userProduct === 'string' ? userProduct.toLowerCase() : '';
      const userProductIsUnified = userProductStr === 'unified' || userProductStr === 'komplete';

      // Check 4: firm has property data (if properties array exists and is
      // non-empty, this firm DOES property management — so they should be
      // unified or atrium, never pure vega)
      const hasPropertyData = Array.isArray((appState as any).properties) && (appState as any).properties.length > 0;

      if (planIsKomplete || firmProductIsUnified || userProductIsUnified) {
        rawProduct = 'unified';
      }
      // Additional safety: if the firm has property data but product is 'vega',
      // they SHOULD be unified (you can't have properties on a legal-only plan).
      // This catches the case where a Komplete firm downgraded in the DB but
      // still has property records.
      else if (hasPropertyData && firmProduct === 'vega') {
        console.warn('[ProductContext] Firm has property data but product=vega — forcing unified. Check the firms table in Convex.');
        rawProduct = 'unified';
      }
    } else if (currentUser?.product) {
      // Portal users may not have firmDetails loaded (firm data queries are skipped for them),
      // so fall back to the user's own product field (set during portal invite acceptance)
      const userProduct = currentUser.product;
      if (userProduct === 'legal' || userProduct === 'vega') rawProduct = 'vega';
      else if (userProduct === 'property' || userProduct === 'atrium') rawProduct = 'atrium';
      else rawProduct = userProduct; // catches 'unified' and 'komplete'
    }

    // Aliases — map legacy/alternate product names to canonical ones.
    // 'komplete' is included in case the backend ever stores it literally.
    const aliases: Record<string, ProductType> = {
      sentry: 'atrium',
      property: 'atrium',
      legal: 'vega',
      komplete: 'unified',
    };
    const product = (aliases[rawProduct] ?? rawProduct) as ProductType;

    // ROUND 15: did the product decision come from real data, or the
    // 'unified' hydration default? Mirrors the rawProduct resolution chain
    // above (demo flag > firm record > user record > default). Consumers
    // gate completion-style side effects on this so the provisional
    // default can never drive "you're all set" logic.
    const isProductResolved =
      !!(demoProd && isDemoUser) ||
      !!(currentUser && isDataLoaded && appState?.firmDetails) ||
      !!currentUser?.product;

    // Derive boolean flags — clear, non-overlapping
    const isAtrium = product === "atrium";
    const isVega = product === "vega";
    const isUnified = product === "unified";
    // FEATURE FLAGS — which product features are available.
    // Komplete (unified) has BOTH legal and property features.
    const isLegal = isVega || isUnified;
    const hasPropertyFeatures = isAtrium || isUnified;
    const hasLegalFeatures = isVega || isUnified;

    // ASSISTANT NAME FLAG — which AI assistant name to use by default.
    // Komplete (unified) defaults to ALOA (legal) per user request.
    // Only pure Atrium mode uses ARIA.
    // This is SEPARATE from the feature flags above — changing the
    // assistant name must NOT hide property features.
    const isProperty = isAtrium;

    // Terminology: Atrium-exclusive gets property language for matters;
    // BUT 'Contacts' is universal across ALL products (Vega, Atrium, Komplete).
    // The user explicitly requested this — lawyers, property managers, and
    // unified firms all see 'Contacts' in the nav and page headings.
    const usePropertyTerms = isAtrium; // Only pure Atrium mode uses Property language for matters

    const terminology: Terminology = {
      matter:        usePropertyTerms ? 'Property' : 'Matter',
      matters:       usePropertyTerms ? 'Properties' : 'Matters',
      client:        'Contact',     // Universal — always 'Contact' on all products
      clients:       'Contacts',    // Universal — always 'Contacts' on all products
      type:          usePropertyTerms ? 'Property Category' : 'Practice Area',
      stage:         usePropertyTerms ? 'Pipeline State' : 'Stage',
      newMatter:     usePropertyTerms ? 'New Property' : 'New Matter',
      activeMatters: usePropertyTerms ? 'Active Properties' : 'Active Matters',
    };

    // ── Signer Context (KOMPLETE / Unified only) ──────────────────────────
    // In VEGA, the user is always "Solicitor". In ATRIUM, always "Property Manager".
    // In KOMPLETE, we must derive the signer identity from the user's profile —
    // we never guess or assume "lawyer" vs "property manager".
    let signerContext: SignerContext | null = null;
    if (isUnified && currentUser) {
      // Derive a human-readable title from the user's role.
      // The user may also have a custom `signerTitle` stored in firmDetails.settings.
      const customTitle = (appState?.firmDetails as any)?.settings?.signerTitle as string | undefined;
      const userRole = currentUser.role || '';

      // Default title mapping from UserRole enum
      const defaultTitleMap: Record<string, string> = {
        Admin: 'Administrator',
        Lawyer: 'Solicitor',
        Paralegal: 'Paralegal',
        'External Counsel': 'External Counsel',
        Client: 'Client',
        Tenant: 'Tenant',
        Pending: 'User',
      };

      signerContext = {
        signerName: currentUser.name || '',
        signerTitle: customTitle || defaultTitleMap[userRole] || userRole || 'User',
        userRole,
      };
    }

    return { product, isLegal, isProperty, isUnified, isVega, isAtrium, hasPropertyFeatures, hasLegalFeatures, terminology, signerContext, isProductResolved };
  }, [currentUser, isDataLoaded, appState?.firmDetails]);

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProduct() {
  return useContext(ProductContext);
}

export function useTerminology() {
    return useProduct().terminology;
}

export function useIsLegal() { return useProduct().isLegal; }
export function useIsProperty() { return useProduct().isProperty; }
export function useIsUnified() { return useProduct().isUnified; }
export function useIsAtrium() { return useProduct().isAtrium; }
/** Returns signer context (only populated for KOMPLETE/unified mode). */
export function useSignerContext() { return useProduct().signerContext; }
