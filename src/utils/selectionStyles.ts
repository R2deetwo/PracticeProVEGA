/**
 * selectionStyles — ONE selection grammar across every multi-select list
 * (owner brief 2026-11-24: "Standardize selection visuals across list items
 * (Matters, Documents, and similar) using the same checkbox/selected-row
 * border and highlight style so selection feels cohesive").
 *
 * Matters previously highlighted rows with indigo, Documents with primary —
 * the same gesture produced two different looks. Every list that opts in
 * imports these constants so the row highlight, checkbox fill and
 * checkbox-check icon are pixel-identical everywhere.
 *
 * Classes are plain strings (Tailwind JIT scans this file), one export per
 * concern:
 *   • ROW_SELECTED / ROW_UNSELECTED   — the row/card container treatment
 *   • CHECKBOX / CHECKBOX_SELECTED    — the checkbox square
 *   • CHECK_ICON                      — the tick drawn inside when selected
 */
export const ROW_SELECTED =
    'bg-primary-50 dark:bg-primary-950/30 border-primary-400 dark:border-primary-700';

export const ROW_UNSELECTED =
    'border-transparent hover:border-slate-200 dark:hover:border-zinc-700';

/** The checkbox square (6×6-ish hit area, 5×5 visual). */
export const CHECKBOX =
    'w-5 h-5 rounded-md border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 flex items-center justify-center transition-all shrink-0';

export const CHECKBOX_SELECTED =
    'bg-primary-600 border-primary-600';

/** The tick path + colour for the check drawn inside a selected checkbox. */
export const CHECK_ICON_CLASS = 'w-3 h-3 text-white';
export const CHECK_ICON_PATH =
    'M5 13l4 4L19 7';
