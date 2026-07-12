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
});

export function ProductProvider({ children }: { children?: ReactNode }) {
  const { currentUser } = useAuth();
  const { appState, isDataLoaded } = useDataState();

  const value = useMemo<ProductContextValue>(() => {
    // Read session storage once at memo compute time (safe — useMemo only runs when deps change)
    const demoProd = typeof window !== 'undefined' ? window.sessionStorage.getItem('practicepro_demo_product') : null;

    let rawProduct = "unified";

    if (demoProd) {
      // Demo switcher takes highest priority
      rawProduct = demoProd;
    } else if (currentUser && isDataLoaded && appState?.firmDetails) {
      // Fall back to firm's saved product setting
      rawProduct = (appState.firmDetails as any).product || "unified";

      // ─── SAFETY NET (Komplete/Enterprise plan enforcement) ──────────────
      // If the firm's subscription plan is Komplete or Enterprise, force
      // the product to 'unified' regardless of what firmDetails.product says.
      // These plans ALWAYS include both legal and property features.
      //
      // WHY THIS EXISTS: A firm on Komplete plan might have product='vega'
      // (set during signup before the plan was upgraded). Without this check,
      // they'd lose access to Properties, Units, Resident messages, etc.
      //
      // WHY IT'S CRITICAL: The user has reported property features disappearing
      // from Komplete firms multiple times. This safety net is the LAST line
      // of defense. If you're tempted to remove or weaken it, DON'T.
      // Instead, fix the upstream bug that's setting the wrong product value.
      const plan = (appState.firmDetails as any).subscriptionPlan;
      const planStr = typeof plan === 'string' ? plan.toLowerCase() : '';
      if (
        planStr === 'komplete' ||
        planStr === 'enterprise' ||
        // Also catch the case where product is explicitly 'komplete' even if
        // the plan field is missing — some legacy firms store it this way.
        (appState.firmDetails as any).product === 'komplete' ||
        (appState.firmDetails as any).product === 'unified'
      ) {
        rawProduct = 'unified';
      }
    } else if (currentUser?.product) {
      // Portal users may not have firmDetails loaded (firm data queries are skipped for them),
      // so fall back to the user's own product field (set during portal invite acceptance)
      const userProduct = currentUser.product;
      if (userProduct === 'legal' || userProduct === 'vega') rawProduct = 'vega';
      else if (userProduct === 'property' || userProduct === 'atrium') rawProduct = 'atrium';
      else rawProduct = userProduct;
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

    return { product, isLegal, isProperty, isUnified, isVega, isAtrium, hasPropertyFeatures, hasLegalFeatures, terminology, signerContext };
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
