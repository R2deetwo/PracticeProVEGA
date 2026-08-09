/**
 * Design Tokens — Single source of truth for typography, spacing, and layout.
 *
 * Import these instead of inlining Tailwind class strings. This makes future
 * migrations trivial and prevents drift.
 *
 * Usage:
 *   import { PAGE_TITLE, CARD_BASE, INPUT_BASE } from '../utils/designTokens';
 *   <h2 className={PAGE_TITLE}>Matters</h2>
 *   <div className={CARD_BASE}>...</div>
 */

// ─── Typography ──────────────────────────────────────────────────
export const PAGE_TITLE = 'text-xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white';
export const PAGE_SUBTITLE = 'text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5';
export const SECTION_LABEL = 'text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500';
export const SECTION_TITLE = 'text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-3';

// Stat numbers — unified across StatCard, AnalyticsView, BillingMonitorView
export const STAT_VALUE_LG = 'text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-none';
export const STAT_VALUE_SM = 'text-base lg:text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight';

// Body text
export const BODY_TEXT = 'text-sm text-slate-600 dark:text-zinc-300';
export const BODY_MUTED = 'text-xs text-slate-500 dark:text-zinc-400';

// ─── Layout ──────────────────────────────────────────────────────
export const PAGE_CONTAINER = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6';
export const PAGE_CONTAINER_NARROW = 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6';

// ─── Cards ───────────────────────────────────────────────────────
export const CARD_BASE = 'bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-sm';
export const CARD_WIDGET = 'bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-sm';
export const CARD_PAD = 'p-5';

// ─── Inputs ──────────────────────────────────────────────────────
export const INPUT_BASE = 'w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all';
export const LABEL_BASE = 'block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5';

// ─── Buttons ─────────────────────────────────────────────────────
export const BTN_PRIMARY = 'bg-primary-600 text-white rounded-md px-4 py-2.5 text-sm font-bold hover:bg-primary-700 shadow-sm active-press transition-colors touch-target';
export const BTN_SECONDARY = 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 rounded-md px-4 py-2.5 text-sm font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors touch-target';
export const BTN_GHOST = 'text-slate-600 dark:text-zinc-300 rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors';

// ─── Colors ──────────────────────────────────────────────────────
export const TEXT_PRIMARY = 'text-slate-900 dark:text-white';
export const TEXT_MUTED = 'text-slate-500 dark:text-zinc-400';
export const TEXT_SECONDARY = 'text-slate-600 dark:text-zinc-300';
export const BORDER_STANDARD = 'border-slate-200 dark:border-zinc-700';
export const BG_PAGE = 'bg-slate-50 dark:bg-zinc-900';
export const BG_CARD = 'bg-white dark:bg-zinc-800';

// ─── Product Brand Colors (single source of truth) ───────────────
export const PRODUCT_COLORS = {
    vega: { primary: 'amber', literal: '#D97706', tailwind: 'bg-amber-500', text: 'text-amber-500' },
    atrium: { primary: 'emerald', literal: '#059669', tailwind: 'bg-emerald-500', text: 'text-emerald-500' },
    komplete: { primary: 'violet', literal: '#7C3AED', tailwind: 'bg-violet-500', text: 'text-violet-500' },
} as const;
