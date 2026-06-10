
import { View } from "./types";

export interface TourStep {
  target: string; // CSS selector for the element to highlight
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  navigateTo?: View; // View to navigate to for this step
}

export const tourSteps: TourStep[] = [
  {
    target: 'body',
    title: 'Welcome to PracticePro',
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
    content: 'Open a new file instantly. You can also ask ALOA to "Create a new matter for [Client Name]" using voice commands.',
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
    title: 'Meet ALOA®',
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
