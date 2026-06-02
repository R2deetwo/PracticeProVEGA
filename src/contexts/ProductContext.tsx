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

interface ProductContextValue {
  product: ProductType;
  isLegal: boolean;
  isProperty: boolean;
  isUnified: boolean;
  isVega: boolean;
  isAtrium: boolean;
  terminology: Terminology;
}

const ProductContext = createContext<ProductContextValue>({
  product: "unified",
  isLegal: true,
  isProperty: true,
  isUnified: true,
  isVega: false,
  isAtrium: false,
  terminology: {
    matter: 'Matter',
    matters: 'Matters',
    client: 'Client',
    clients: 'Clients',
    type: 'Practice Area',
    stage: 'Stage',
    newMatter: 'New Matter',
    activeMatters: 'Active Matters'
  }
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
    }

    const aliases: Record<string, ProductType> = { sentry: 'atrium', property: 'atrium', legal: 'vega' };
    const product = (aliases[rawProduct] ?? rawProduct) as ProductType;

    // Derive boolean flags — clear, non-overlapping
    const isAtrium = product === "atrium";
    const isVega = product === "vega";
    const isUnified = product === "unified";

    // In unified mode, both legal and property features are available
    const isProperty = isAtrium || isUnified;
    const isLegal = isVega || isUnified;

    // Terminology: Atrium-exclusive gets property language; everything else (including Unified) stays neutral
    const usePropertyTerms = isAtrium; // Only pure Atrium mode uses Property/Tenant language

    const terminology: Terminology = {
      matter:        usePropertyTerms ? 'Property' : 'Matter',
      matters:       usePropertyTerms ? 'Properties' : 'Matters',
      client:        usePropertyTerms ? 'Tenant' : 'Client',
      clients:       usePropertyTerms ? 'Tenants' : 'Clients',
      type:          usePropertyTerms ? 'Property Category' : 'Practice Area',
      stage:         usePropertyTerms ? 'Pipeline State' : 'Case Stage',
      newMatter:     usePropertyTerms ? 'New Property' : 'New Matter',
      activeMatters: usePropertyTerms ? 'Active Properties' : 'Active Matters',
    };

    return { product, isLegal, isProperty, isUnified, isVega, isAtrium, terminology };
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
