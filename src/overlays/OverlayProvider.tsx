/**
 * OverlayProvider — Single mount point for ALL overlay layers.
 *
 * Wrap your app in this and every overlay (modals, toasts, banners,
 * drawers, popovers) is available without manual mounting in each
 * component. The layers read from UIContext and render themselves.
 *
 * Usage in App.tsx:
 *   <OverlayProvider>
 *     <YourApp />
 *   </OverlayProvider>
 *
 * For now, this renders ModalLayer alongside the legacy ModalManager
 * (backward compat). The ModalLayer only renders modals that ARE in
 * the modalRegistry; ModalManager handles the rest. Once all modals
 * are migrated, ModalManager can be removed.
 *
 * ToastLayer and BannerLayer are scaffolds — they need UIContext state
 * additions (toasts queue, banners queue) before they're functional.
 * The existing ToastContainer and ad-hoc banners continue to work.
 */
import React from 'react';
import { ModalLayer } from './layers/ModalLayer';

interface OverlayProviderProps {
  children: React.ReactNode;
}

export const OverlayProvider: React.FC<OverlayProviderProps> = ({ children }) => {
  return (
    <>
      {children}
      {/* New modal system — renders modals from the modalRegistry.
          Falls back to ModalManager for modals not yet migrated. */}
      <ModalLayer />
      {/* BannerLayer will mount here once UIContext has banner state.
          <BannerLayer banners={banners} onDismiss={dismissBanner} /> */}
      {/* ToastLayer will mount here once UIContext has a unified toast queue.
          The existing ToastContainer still works in parallel. */}
    </>
  );
};

export default OverlayProvider;
