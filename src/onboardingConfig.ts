
import { View } from "./types";

export interface TourStep {
  /** Desktop CSS selector — anchored to the side panel */
  target: string;
  /** Mobile CSS selector — anchored to the bottom nav (when on small viewports) */
  mobileTarget?: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Mobile placement overrides — defaults to 'top' for bottom-nav targets */
  mobilePlacement?: 'top' | 'bottom' | 'center';
  navigateTo?: View;
  /** If true, this step is skipped entirely on mobile (e.g. desktop-only targets like side panel) */
  skipOnMobile?: boolean;
}

// ─── VEGA (Legal) TOUR STEPS ──────────────────────────────────────────────
const vegaTourSteps: TourStep[] = [
  {
    target: 'body',
    title: 'Welcome to Vega',
    content: 'Your complete legal practice management system. This brief tour will help you navigate your new digital workspace and unlock the power of AI for your firm.',
    placement: 'center',
    mobilePlacement: 'center',
  },
  {
    target: '[data-tour-id="nav-dashboard"]',
    title: 'Mission Control',
    content: 'Start your day here. The Dashboard gives you a high-level overview of critical deadlines, upcoming court hearings, and your firm\'s financial health.',
    placement: 'right',
    mobilePlacement: 'top',
    navigateTo: 'dashboard',
  },
  {
    target: '[data-tour-id="nav-matters"]',
    title: 'Case Management',
    content: 'This is your central hub for all active cases. Track matter progress, access case files, and monitor stage timelines in one unified view.',
    placement: 'right',
    mobilePlacement: 'top',
    navigateTo: 'matters',
  },
  {
    target: '#new-matter-button',
    title: 'Quick Create',
    content: 'Open a new file instantly. You can also ask ARIA to "Create a new matter for [Client Name]" using voice commands.',
    placement: 'bottom',
    mobilePlacement: 'top',
    navigateTo: 'matters',
  },
  {
    target: '[data-tour-id="nav-research"]',
    title: 'Research Studio',
    content: 'Your digital war room. Upload case files to generate chronologies, find Nigerian case law, and analyze legal risks using AI.',
    placement: 'right',
    mobilePlacement: 'top',
    navigateTo: 'research',
  },
  {
    target: '[data-tour-id="aloa-fab"]',
    title: 'Meet ARIA®',
    content: 'Your AI Paralegal is always one click away. Tap here to draft documents, summarize briefs, or navigate the app using voice or text.',
    placement: 'top',
    mobilePlacement: 'top',
    navigateTo: 'dashboard',
  },
  {
    target: '#nav-settings-sidebar',
    mobileTarget: '[data-tour-id="nav-settings"]',
    title: 'Firm Configuration',
    content: 'Customize your experience. Configure workflows, manage user roles, and set up your firm\'s branding and billing preferences here.',
    placement: 'right',
    mobilePlacement: 'top',
    navigateTo: 'settings',
  },
];

// ─── ATRIUM (Property) TOUR STEPS ─────────────────────────────────────────
const atriumTourSteps: TourStep[] = [
  {
    target: 'body',
    title: 'Welcome to Atrium',
    content: 'Your complete property management system. This quick tour will show you how to manage your properties, tenants, and revenue from one powerful dashboard.',
    placement: 'center',
    mobilePlacement: 'center',
  },
  {
    target: '[data-tour-id="nav-dashboard"]',
    title: 'Property Dashboard',
    content: 'Your command center. See rent collection status, upcoming lease expirations, maintenance requests, and revenue at a glance.',
    placement: 'right',
    mobilePlacement: 'top',
    navigateTo: 'dashboard',
  },
  {
    target: '[data-tour-id="nav-properties"]',
    title: 'Property Management',
    content: 'Your central hub for managing all properties and units. Track occupancy, monitor lease timelines, and oversee each property\'s financial performance in one unified view.',
    placement: 'right',
    mobilePlacement: 'top',
    navigateTo: 'properties',
  },
  {
    target: '[data-tour-id="nav-contacts"]',
    title: 'Tenant Directory',
    content: 'Keep track of all your tenants, their lease terms, and contact details. Send rent reminders and demand notices directly from here.',
    placement: 'right',
    mobilePlacement: 'top',
    navigateTo: 'contacts',
  },
  {
    target: '[data-tour-id="nav-billing"]',
    title: 'Revenue Engine',
    content: 'Track rent payments, service charges, and generate invoices. The Revenue Monitor helps you identify defaulters and automate reminders.',
    placement: 'right',
    mobilePlacement: 'top',
    navigateTo: 'billing',
  },
  {
    target: '[data-tour-id="aloa-fab"]',
    title: 'Meet ARIA®',
    content: 'Your AI property assistant is one click away. Ask ARIA to generate demand notices, summarize tenant ledgers, or draft lease agreements.',
    placement: 'top',
    mobilePlacement: 'top',
    navigateTo: 'dashboard',
  },
  {
    target: '#nav-settings-sidebar',
    mobileTarget: '[data-tour-id="nav-settings"]',
    title: 'Portfolio Configuration',
    content: 'Customize your setup. Configure service charge templates, WhatsApp notification settings, and manage portal access for your tenants.',
    placement: 'right',
    mobilePlacement: 'top',
    navigateTo: 'settings',
  },
];

// ─── KOMPLETE (Unified) TOUR STEPS ────────────────────────────────────────
const kompleteTourSteps: TourStep[] = [
  {
    target: 'body',
    title: 'Welcome to Komplete',
    content: 'Your unified legal and property management platform. This tour covers the key areas of your all-in-one workspace.',
    placement: 'center',
    mobilePlacement: 'center',
  },
  {
    target: '[data-tour-id="nav-dashboard"]',
    title: 'Unified Dashboard',
    content: 'See everything at once — legal deadlines, property revenue, court dates, and rent collections in a single view.',
    placement: 'right',
    mobilePlacement: 'top',
    navigateTo: 'dashboard',
  },
  {
    target: '[data-tour-id="nav-matters"]',
    title: 'Cases & Properties',
    content: 'Manage legal matters and property portfolios from one place. Switch between Legal and Property views using the sidebar.',
    placement: 'right',
    mobilePlacement: 'top',
    navigateTo: 'matters',
  },
  {
    target: '[data-tour-id="nav-billing"]',
    title: 'Financial Hub',
    content: 'Track legal billing and property revenue together. Generate invoices for clients and rent demands for tenants.',
    placement: 'right',
    mobilePlacement: 'top',
    navigateTo: 'billing',
  },
  {
    target: '[data-tour-id="aloa-fab"]',
    title: 'Meet ARIA®',
    content: 'Your AI assistant handles both legal and property tasks. Draft documents, generate notices, or analyze your portfolio — all from one chat.',
    placement: 'top',
    mobilePlacement: 'top',
    navigateTo: 'dashboard',
  },
  {
    target: '#nav-settings-sidebar',
    mobileTarget: '[data-tour-id="nav-settings"]',
    title: 'Workspace Settings',
    content: 'Configure legal workflows, property templates, billing preferences, and manage access for your entire team.',
    placement: 'right',
    mobilePlacement: 'top',
    navigateTo: 'settings',
  },
];

// ─── EXPORTS ──────────────────────────────────────────────────────────────

// REMOVED: Legacy `export const tourSteps = vegaTourSteps` — always returned Vega (legal) steps,
// which could leak legal terminology to Atrium (property) users. Use getTourStepsForProduct() instead.

/** Get the correct tour steps for the user's product */
export function getTourStepsForProduct(product?: string | null): TourStep[] {
  if (product === 'property' || product === 'atrium') return atriumTourSteps;
  if (product === 'unified') return kompleteTourSteps;
  return vegaTourSteps; // Default: Vega (legal)
}

/**
 * Mobile viewport detection — used by the tour engine to switch target anchors
 * from the desktop side panel to the mobile bottom nav.
 *
 * Returns true if EITHER:
 *   1. The window is narrower than Tailwind's `md` breakpoint (768px), OR
 *   2. The app is running inside a Capacitor native shell (APK) — because the
 *      APK is fundamentally a mobile form factor, even when the WebView reports
 *      a wider viewport (e.g. tablet, BlueStacks landscape, foldable).
 *
 * This dual check fixes the bug where the tour was rendering desktop-style
 * tooltips inside the APK because `window.innerWidth` was >= 768.
 */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;

  // CSS viewport check — matches Tailwind's `md` breakpoint
  const isNarrowViewport = window.innerWidth < 768;

  // Native platform check — Capacitor APK / iOS app
  let isNative = false;
  try {
    // Capacitor exposes itself as window.Capacitor when running natively
    const capacitor = (window as any).Capacitor;
    if (capacitor && typeof capacitor.isNativePlatform === 'function') {
      isNative = capacitor.isNativePlatform();
    } else if (typeof navigator !== 'undefined') {
      // Fallback: Android WebView user-agent detection
      const ua = navigator.userAgent || '';
      isNative = /Android.*; wv\)/.test(ua) || /iPhone|iPad|iPod/.test(ua);
    }
  } catch {
    // Ignore — assume not native
  }

  return isNarrowViewport || isNative;
}
