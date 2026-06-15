
import { View } from "./types";

export interface TourStep {
  target: string; // CSS selector for the element to highlight
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  navigateTo?: View; // View to navigate to for this step
}

// ─── VEGA (Legal) TOUR STEPS ──────────────────────────────────────────────
const vegaTourSteps: TourStep[] = [
  {
    target: 'body',
    title: 'Welcome to Vega',
    content: 'Your complete legal practice management system. This brief tour will help you navigate your new digital workspace and unlock the power of AI for your firm.',
    placement: 'center',
  },
  {
    target: '[data-tour-id="nav-dashboard"]',
    title: 'Mission Control',
    content: 'Start your day here. The Dashboard gives you a high-level overview of critical deadlines, upcoming court hearings, and your firm\'s financial health.',
    placement: 'right',
    navigateTo: 'dashboard',
  },
  {
    target: '[data-tour-id="nav-matters"]',
    title: 'Case Management',
    content: 'This is your central hub for all active cases. Track matter progress, access case files, and monitor stage timelines in one unified view.',
    placement: 'right',
    navigateTo: 'matters',
  },
  {
    target: '#new-matter-button',
    title: 'Quick Create',
    content: 'Open a new file instantly. You can also ask ARIA to "Create a new matter for [Client Name]" using voice commands.',
    placement: 'bottom',
    navigateTo: 'matters',
  },
  {
    target: '[data-tour-id="nav-research"]',
    title: 'Research Studio',
    content: 'Your digital war room. Upload case files to generate chronologies, find Nigerian case law, and analyze legal risks using AI.',
    placement: 'right',
    navigateTo: 'research',
  },
  {
    target: '[data-tour-id="aloa-fab"]',
    title: 'Meet ARIA®',
    content: 'Your AI Paralegal is always one click away. Tap here to draft documents, summarize briefs, or navigate the app using voice or text.',
    placement: 'top',
    navigateTo: 'dashboard',
  },
  {
    target: '#nav-settings-sidebar',
    title: 'Firm Configuration',
    content: 'Customize your experience. Configure workflows, manage user roles, and set up your firm\'s branding and billing preferences here.',
    placement: 'right',
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
  },
  {
    target: '[data-tour-id="nav-dashboard"]',
    title: 'Property Dashboard',
    content: 'Your command center. See rent collection status, upcoming lease expirations, maintenance requests, and revenue at a glance.',
    placement: 'right',
    navigateTo: 'dashboard',
  },
  {
    target: '[data-tour-id="nav-properties"]',
    title: 'Property Portfolio',
    content: 'Manage all your properties and units here. Add buildings, track occupancy, and monitor each property\'s financial performance.',
    placement: 'right',
    navigateTo: 'properties',
  },
  {
    target: '[data-tour-id="nav-contacts"]',
    title: 'Tenant Directory',
    content: 'Keep track of all your tenants, their lease terms, and contact details. Send rent reminders and demand notices directly from here.',
    placement: 'right',
    navigateTo: 'contacts',
  },
  {
    target: '[data-tour-id="nav-billing"]',
    title: 'Revenue Engine',
    content: 'Track rent payments, service charges, and generate invoices. The Revenue Monitor helps you identify defaulters and automate reminders.',
    placement: 'right',
    navigateTo: 'billing',
  },
  {
    target: '[data-tour-id="aloa-fab"]',
    title: 'Meet ARIA®',
    content: 'Your AI property assistant is one click away. Ask ARIA to generate demand notices, summarize tenant ledgers, or draft lease agreements.',
    placement: 'top',
    navigateTo: 'dashboard',
  },
  {
    target: '#nav-settings-sidebar',
    title: 'Portfolio Configuration',
    content: 'Customize your setup. Configure service charge templates, WhatsApp notification settings, and manage portal access for your tenants.',
    placement: 'right',
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
  },
  {
    target: '[data-tour-id="nav-dashboard"]',
    title: 'Unified Dashboard',
    content: 'See everything at once — legal deadlines, property revenue, court dates, and rent collections in a single view.',
    placement: 'right',
    navigateTo: 'dashboard',
  },
  {
    target: '[data-tour-id="nav-matters"]',
    title: 'Cases & Properties',
    content: 'Manage legal matters and property portfolios from one place. Switch between Legal and Property views using the sidebar.',
    placement: 'right',
    navigateTo: 'matters',
  },
  {
    target: '[data-tour-id="nav-billing"]',
    title: 'Financial Hub',
    content: 'Track legal billing and property revenue together. Generate invoices for clients and rent demands for tenants.',
    placement: 'right',
    navigateTo: 'billing',
  },
  {
    target: '[data-tour-id="aloa-fab"]',
    title: 'Meet ARIA®',
    content: 'Your AI assistant handles both legal and property tasks. Draft documents, generate notices, or analyze your portfolio — all from one chat.',
    placement: 'top',
    navigateTo: 'dashboard',
  },
  {
    target: '#nav-settings-sidebar',
    title: 'Workspace Settings',
    content: 'Configure legal workflows, property templates, billing preferences, and manage access for your entire team.',
    placement: 'right',
    navigateTo: 'settings',
  },
];

// ─── EXPORTS ──────────────────────────────────────────────────────────────

// Legacy default — used if no product is specified
export const tourSteps = vegaTourSteps;

/** Get the correct tour steps for the user's product */
export function getTourStepsForProduct(product?: string | null): TourStep[] {
  if (product === 'property' || product === 'atrium') return atriumTourSteps;
  if (product === 'unified') return kompleteTourSteps;
  return vegaTourSteps; // Default: Vega (legal)
}
