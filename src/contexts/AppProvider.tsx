
import * as React from 'react';
import { AuthProvider } from './AuthContext';
import { UIProvider } from './UIContext';
import { AppContextProvider } from './AppContext';
import { DataProvider } from './DataProvider';
import { ProductProvider } from './ProductContext';
import { CoreProvider } from './CoreContext';
import { MatterProvider } from './MatterContext';
import { FinanceProvider } from './FinanceContext';
import { ExecutionProvider } from './ExecutionContext';
import { DocumentProvider } from './DocumentContext';
import { OnboardingProvider } from './OnboardingProvider';
import { AloaProvider } from './AloaProvider';
import { ProviderComposer } from '../utils/providerUtils';

/**
 * Unified AppProvider that flattens all domain contexts.
 */
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ProviderComposer
      providers={[
        <AuthProvider />,
        <UIProvider />,
        <AppContextProvider />,
        <DataProvider />,
        <ProductProvider />,
        <CoreProvider />,
        <MatterProvider />,
        <FinanceProvider />,
        <ExecutionProvider />,
        <DocumentProvider />,
        <OnboardingProvider />,
        <AloaProvider />
      ]}
    >
      {children}
    </ProviderComposer>
  );
};
