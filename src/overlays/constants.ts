/**
 * Z_TIERS — Single source of truth for overlay z-index stacking.
 *
 * Use these instead of hardcoded z-[3000] / z-[9999] etc. so nothing
 * ever fights. Higher tiers always render above lower tiers.
 *
 * Legend:
 *   base           0    Normal document flow
 *   stickyHeader   40    App header, sticky nav
 *   sidebar        50   Left/right navigation rails
 *   drawer        200   Docked panels (slide-in from side)
 *   modal         300   Center modals (the main overlay surface)
 *   dropdown      400   Selects, popovers, autocomplete
 *   banner        500   Top banners (always above modals)
 *   toast         600   Toasts (above banners so errors are visible)
 *   fullscreen    700   Splash, lock screen, onboarding tour
 *   devTools    9999   Floating test controls (highest)
 *
 * The old codebase used z-[3000] for modals and z-[9999] for toasts.
 * Those still work — this just makes the intent explicit and prevents
 * ad-hoc numbers from creeping in.
 */
export const Z_TIERS = {
  base: 0,
  stickyHeader: 40,
  sidebar: 50,
  drawer: 200,
  modal: 300,
  dropdown: 400,
  banner: 500,
  toast: 600,
  fullscreen: 700,
  devTools: 9999,
} as const;

export type ZTier = keyof typeof Z_TIERS;
