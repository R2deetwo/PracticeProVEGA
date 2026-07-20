/**
 * Shared form input styles for PracticePro.
 * Use these instead of inline commonInputClass definitions.
 *
 * Three style variants:
 * - inputModern: Primary style for main forms (ring-based, rounded-xl)
 * - inputClassic: Secondary style for simple/modal forms (border-based, rounded-md)
 * - inputLarge: Larger variant for modals and auth screens
 *
 * All variants are LIGHT-ONLY. The landing page forces light mode, and
 * modals are always light (see Modal.tsx). The dark: variants caused
 * dark dialogue/input boxes to render on light backgrounds when a user
 * had dark mode saved. Stripped per founder request.
 */

export const inputModern = "w-full bg-white border-none ring-1 ring-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm";

export const inputClassic = "text-gray-900 w-full bg-gray-50 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-primary-500 focus:border-primary-500";

export const inputLarge = "text-gray-900 w-full bg-gray-50 border border-gray-300 rounded-md shadow-sm p-3 min-h-[48px] focus:ring-primary-500 focus:border-primary-500";

// Backward-compatible alias — defaults to the Modern style.
// Components can migrate one at a time by importing the specific variant they need.
export const commonInputClass = inputModern;
