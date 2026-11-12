/**
 * Z_TIERS / Z_CLASS — Single source of truth for overlay z-index stacking.
 *
 * UX-18 (z-index governance): the codebase used to carry 125 hardcoded
 * `z-[NNNN]` literals across 60+ files. Every one of them now maps to a
 * named tier below; ESLint bans raw `z-[NNNN]` outside this file, so a
 * new overlay must take a tier (or consciously add one here, with a
 * comment, next to its neighbours).
 *
 * The values are the ladder the codebase already used — this file gives
 * it names and one home, it does not renumber history. Two deliberate
 * corrections shipped with the migration (both audit findings):
 *   - `modal` is 3000 (the real modal tier). The previous idealised
 *     value of 300 put registry-path ModalShell dialogs UNDER the bottom
 *     nav (1000), side panels (2000) and every legacy-path modal (3000).
 *   - `banner` is 9990 (top chrome). The previous idealised value of 500
 *     put the (still unmounted) BannerLayer under every legacy banner.
 *
 * Semantic aliases (toast vs systemAlert, banner vs checklist) share a
 * value today; splitting them later is a one-line change here.
 *
 * Use Z_TIERS for `style={{ zIndex }}` and Z_CLASS for Tailwind
 * classNames. Z_CLASS strings are static literals so the Tailwind
 * scanner generates the utilities from this file.
 */

// ── Local chrome — inside a panel/editor stacking context ──────────────
// Absolute values here are local: they only fight siblings inside the
// same panel, so the numbers stay small and dense.
const LOCAL = {
  /** In-panel dropdown menu (TaskList status menu). */
  panelDropdown: 50,
  /** Sticky sub-bars, in-panel menus and their close veils, loading veils. */
  panelRaise: 60,
  /** Editor toolbar menus (one above their z-60 close veils). */
  panelMenu: 61,
  /** In-content floating notices/shortcuts (demo banner, editor assists). */
  panelFloat: 70,
  /** Editor side dock (above its z-70 floating buttons). */
  panelDock: 71,
  /** In-panel choice dialogs, tab menus, avatar menus, mobile search. */
  panelOverlay: 100,
  /** Test-controls panel, avatar-stack hover raise. */
  panelTop: 110,
} as const;

// ── Shells — marketing sites and product app shells ───────────────────
const SHELL = {
  /** Command palette dialog. */
  palette: 200,
  /** Mobile quick-actions dock (site shells). */
  shellDock: 210,
  /** Floating action buttons (site shells). */
  shellFab: 220,
  /** Mobile menu sheets (site shells). */
  shellMenu: 240,
  /** Fixed site headers. */
  shellHeader: 250,
  /** Marketing lightbox. */
  lightbox: 280,
  /** Marketing hotspot popovers. */
  hotspot: 290,
  /** Skip-links, SCM partial-payment overlay. */
  siteOverlay: 300,
} as const;

// ── Mobile chrome ──────────────────────────────────────────────────────
const MOBILE = {
  /** Bottom nav bars; DraftProEditor blocking veil rides the same rung. */
  bottomNav: 1000,
  /** Sheet backdrops above the nav; ALOA FAB. */
  bottomNavVeil: 1001,
  /** Sheets above the nav. */
  bottomNavSheet: 1002,
  /** Bulk-action bar. */
  bulkBar: 1100,
} as const;

// ── Docked panels ──────────────────────────────────────────────────────
const DOCKED = {
  /** Side-panel backdrop (ALOA). */
  panelVeil: 1999,
  /** Side panels: ALOA panel, lock screen, admin compose modals, editor embed picker. */
  sidePanel: 2000,
  /** DockedModal backdrop. */
  dockedVeil: 2100,
  /** DockedModal panel. */
  docked: 2101,
} as const;

// ── The modal ladder ───────────────────────────────────────────────────
// 3000 is THE modal tier (legacy Modal.tsx + ModalShell + direct fixed
// modals). Everything above it is a surface that opens FROM a modal:
const MODAL = {
  /** Terms-acceptance bar (below modals so its dimmer never covers them). */
  termsBar: 2990,
  /** THE modal tier — both render paths (registry ModalShell, legacy Modal). */
  modal: 3000,
  /** Modal opened from a modal (SmartMatter); APK update banner. */
  modalRaised: 4000,
  /** Drawer opened from a modal — backdrop (service-charge bars). */
  drawerVeil: 4500,
  /** Drawer opened from a modal — panel. */
  drawer: 4501,
  /** Receipts / unit-ledger (second modal stack). */
  modalStack: 4600,
  /** Document preview — top of the modal ladder. */
  modalPeak: 5000,
} as const;

// ── System chrome — global surfaces above all product UI ───────────────
const SYSTEM = {
  /** Print preview drawer — backdrop / panel. */
  printVeil: 9000,
  /** Print preview drawer — panel. */
  print: 9001,
  /** Contact-sales drawer (marketing) — backdrop / panel. */
  contactVeil: 9500,
  /** Contact-sales drawer (marketing) — panel. */
  contact: 9600,
  /** Getting-started checklist; banner-layer scaffold rides this rung. */
  checklist: 9990,
  /** Alias for the (unmounted) BannerLayer scaffold. */
  banner: 9990,
  /** Refresh toasts, what's-new, billing monitor — just under toasts. */
  toastSub: 9998,
  /** Standard toast stack. */
  toast: 9999,
  /** Confirm dialogs, context menus, tours, cookie consent, connection status. */
  systemAlert: 9999,
  /** Version-refresh banner, client receipt overlay, top lightbox, skip-links. */
  refreshBanner: 10000,
  /** Crash screens — nothing renders above this. */
  crashScreen: 99999,
} as const;

export const Z_TIERS = {
  ...LOCAL,
  ...SHELL,
  ...MOBILE,
  ...DOCKED,
  ...MODAL,
  ...SYSTEM,
} as const;

export type ZTier = keyof typeof Z_TIERS;

/**
 * Z_CLASS — Tailwind className twin of Z_TIERS.
 * Static string literals (not derived) so the Tailwind content scanner
 * generates every `z-[NNNN]` utility from this file alone; the unit
 * test (tests/unit/zTiers.test.ts) asserts Z_CLASS ≡ Z_TIERS so the
 * two can never drift.
 */
export const Z_CLASS = {
  // LOCAL
  panelDropdown: 'z-[50]',
  panelRaise: 'z-[60]',
  panelMenu: 'z-[61]',
  panelFloat: 'z-[70]',
  panelDock: 'z-[71]',
  panelOverlay: 'z-[100]',
  panelTop: 'z-[110]',
  // SHELL
  palette: 'z-[200]',
  shellDock: 'z-[210]',
  shellFab: 'z-[220]',
  shellMenu: 'z-[240]',
  shellHeader: 'z-[250]',
  lightbox: 'z-[280]',
  hotspot: 'z-[290]',
  siteOverlay: 'z-[300]',
  // MOBILE
  bottomNav: 'z-[1000]',
  bottomNavVeil: 'z-[1001]',
  bottomNavSheet: 'z-[1002]',
  bulkBar: 'z-[1100]',
  // DOCKED
  panelVeil: 'z-[1999]',
  sidePanel: 'z-[2000]',
  dockedVeil: 'z-[2100]',
  docked: 'z-[2101]',
  // MODAL
  termsBar: 'z-[2990]',
  modal: 'z-[3000]',
  modalRaised: 'z-[4000]',
  drawerVeil: 'z-[4500]',
  drawer: 'z-[4501]',
  modalStack: 'z-[4600]',
  modalPeak: 'z-[5000]',
  // SYSTEM
  printVeil: 'z-[9000]',
  print: 'z-[9001]',
  contactVeil: 'z-[9500]',
  contact: 'z-[9600]',
  checklist: 'z-[9990]',
  banner: 'z-[9990]',
  toastSub: 'z-[9998]',
  toast: 'z-[9999]',
  systemAlert: 'z-[9999]',
  refreshBanner: 'z-[10000]',
  crashScreen: 'z-[99999]',
} as const;

export type ZClassName = keyof typeof Z_CLASS;
