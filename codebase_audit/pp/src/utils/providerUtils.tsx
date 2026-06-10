
import * as React from 'react';

interface ProviderComposerProps {
  providers: React.ReactElement[];
  children: React.ReactNode;
}

/**
 * Flattens nested providers into a single component.
 */
export const ProviderComposer: React.FC<ProviderComposerProps> = ({ providers, children }) => {
  return (
    <>
      {providers.reduceRight((acc, provider) => {
        return React.cloneElement(provider, { children: acc });
      }, children)}
    </>
  );
};
