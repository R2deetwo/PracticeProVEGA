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

export const inputClassic = "text-slate-900 dark:text-zinc-100 w-full bg-slate-50 dark:bg-zinc-800/60 border border-slate-300 dark:border-zinc-700 rounded-md shadow-sm p-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 placeholder:text-slate-400 dark:placeholder:text-zinc-400";

export const inputLarge = "text-slate-900 dark:text-zinc-100 w-full bg-slate-50 dark:bg-zinc-800/60 border border-slate-300 dark:border-zinc-700 rounded-md shadow-sm p-3 min-h-[48px] focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 placeholder:text-slate-400 dark:placeholder:text-zinc-400";

// Chunk B (Task 61) — the settings-screen form family: flat (no shadow),
// zinc-700 dark surface, zinc-600 dark border, p-2, no focus ring.
// MEASURED pattern: 5 occurrences in 3 files (ProfileSettings, ReportingView,
// NewDirectMessageForm) — the dominant input style of the settings screens.
// Note: unlike the three variants above it has NO focus classes and NO
// shadow — that flatness is the look; don't "fix" it here.
export const inputSettings = "text-slate-900 dark:text-zinc-300 w-full bg-slate-50 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md p-2";

// Backward-compatible alias — defaults to the Modern style.
// Components can migrate one at a time by importing the specific variant they need.
export const commonInputClass = inputModern;
