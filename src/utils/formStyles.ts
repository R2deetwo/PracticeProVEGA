/**
 * Shared form input styles for PracticePro.
 * Use these instead of inline commonInputClass definitions.
 *
 * Three style variants:
 * - inputModern: Primary style for main forms (ring-based, rounded-md)
 * - inputClassic: Secondary style for simple/modal forms (border-based, rounded-md)
 * - inputLarge: Larger variant for modals and auth screens
 *
 * DARK-MODE SUPPORT (Aug 2026 refresh):
 * All three variants now include explicit `dark:` variants for background,
 * text color, placeholder color, ring/border color, and focus state.
 *
 * This was previously stripped because the comment said "modals are always
 * light" — but Modal.tsx line 192 uses `bg-white dark:bg-zinc-900`, so
 * modals DO render with dark backgrounds when the user has dark mode on.
 * The light-only versions caused critically low text contrast in dark
 * mode (selected <option> values like "Civil" / "Commercial" were nearly
 * invisible — see user feedback screenshot).
 *
 * Specificity safety: Tailwind's `dark:bg-zinc-800/60` compiles to
 * `.dark .bg-zinc-800\/60 { ... }` (specificity 0,2,0) which BEATS
 * the global `.dark input { ... }` rule in index.css (specificity 0,1,1),
 * so explicit dark: variants here take precedence over the safety net.
 */

export const inputModern = "w-full bg-white dark:bg-zinc-800/60 border-none ring-1 ring-slate-200 dark:ring-zinc-700 rounded-md px-4 py-2.5 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-400 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 outline-none transition-all shadow-sm";

export const inputClassic = "text-gray-900 dark:text-zinc-100 w-full bg-gray-50 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-md shadow-sm p-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 placeholder:text-slate-400 dark:placeholder:text-zinc-400";

export const inputLarge = "text-gray-900 dark:text-zinc-100 w-full bg-gray-50 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-md shadow-sm p-3 min-h-[48px] focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 placeholder:text-slate-400 dark:placeholder:text-zinc-400";

// Backward-compatible alias — defaults to the Modern style.
// Components can migrate one at a time by importing the specific variant they need.
export const commonInputClass = inputModern;
