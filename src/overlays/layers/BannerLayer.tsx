/**
 * BannerLayer — Unified banner queue.
 *
 * Replaces the 5 separate banner components (VersionRefreshBanner,
 * ApkUpdateBanner, CriticalLeaseBanner, TermsAcceptance, ToastRefreshNotification)
 * with a single stack. Banners are pushed from anywhere via `useUI().addBanner()`
 * and auto-dismiss or stay until dismissed.
 *
 * Banners stack vertically with gap-2, always at the top of the viewport,
 * always above modals (z-banner = 500) and below toasts (z-toast = 600).
 *
 * MIGRATION: The legacy banner components still render in App.tsx. To migrate:
 *   1. Replace the legacy component with an addBanner() call in the
 *      appropriate hook/effect
 *   2. Remove the legacy component from App.tsx
 *
 * NOTE: This layer is a scaffold. The addBanner/dismissBanner API needs to
 * be added to UIContext before it's functional. For now, the legacy
 * components continue to work in parallel.
 */
import React from 'react';
import { BannerShell, BannerType } from '../primitives/BannerShell';
import { Z_TIERS } from '../constants';

// This will be populated from UIContext once the banner state is wired.
// For now, it's a typed placeholder — the actual implementation will
// read from useUI().banners + useUI().dismissBanner.
export interface Banner {
  id: string;
  type: BannerType;
  message: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  dismissible?: boolean;
}

interface BannerLayerProps {
  banners: Banner[];
  onDismiss: (id: string) => void;
}

export const BannerLayer: React.FC<BannerLayerProps> = ({ banners, onDismiss }) => {
  if (!banners || banners.length === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 flex flex-col gap-2 p-4 pointer-events-none"
      style={{ zIndex: Z_TIERS.banner }}
    >
      {banners.map((banner) => (
        <div key={banner.id} className="pointer-events-auto animate-fade-in">
          <BannerShell
            type={banner.type}
            message={banner.message}
            action={banner.action}
            secondaryAction={banner.secondaryAction}
            onDismiss={banner.dismissible !== false ? () => onDismiss(banner.id) : undefined}
          />
        </div>
      ))}
    </div>
  );
};

export default BannerLayer;
