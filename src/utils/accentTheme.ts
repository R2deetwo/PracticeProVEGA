/**
 * R52 — the accent theme engine (unified product branding).
 *
 * OWNER BUG REPORT: "In the unified app interface (?app=komplete), brand
 * accents are fragmenting across views. Home renders the primary brand
 * colour (green) correctly, but navigating to Matters, Documents or
 * Research abruptly overrides the accent with a hardcoded copper/brown
 * scheme. This colour state is forced rather than driven by a
 * centralised theme state or user-controlled appearance preferences."
 *
 * The R28 "legal-side skin" (App.tsx LEGAL_SIDE_VIEWS) is retired by
 * owner direction: a Komplete firm now keeps ONE uniform primary accent
 * (the favicon green) on EVERY route — Home, Properties, Matters, Tasks,
 * Documents, Research, Calendar, Financials — no module-level switching.
 * The accent is now resolved in exactly one place, from two inputs:
 *
 *   1. the ACTIVE PRODUCT (ProductContext — the app= URL param stays
 *      purely informational): 'unified' → komplete green, 'vega' → the
 *      Warm Chambers copper, 'atrium' → the estate jade;
 *   2. the USER'S LOCKED PREFERENCE (Settings → Display → Appearance),
 *      persisted per-account in localStorage, which overrides the
 *      product default when set to anything other than 'auto'.
 *
 * Application mechanism (unchanged from R28, it already beats the
 * html.theme-* cascade): a scope class on the app-container div remaps
 * the --color-primary-* ramp that every primary-* Tailwind class reads.
 * Komplete needs NO class — the :root default IS the komplete green —
 * so the default path stays byte-identical.
 */

import type { Product } from '../types';

/** What the user picks in Settings (or 'auto' to follow the product). */
export type AccentThemePreference = 'auto' | 'komplete' | 'vega' | 'atrium';

/** A concrete palette id. 'komplete' is the default (no scope class). */
export type AccentThemeId = 'komplete' | 'vega' | 'atrium';

export const ACCENT_PREFERENCES: AccentThemePreference[] = ['auto', 'komplete', 'vega', 'atrium'];

export function isAccentPreference(value: unknown): value is AccentThemePreference {
    return typeof value === 'string' && (ACCENT_PREFERENCES as string[]).includes(value);
}

/**
 * Resolve the active accent from preference + product.
 * 'auto' (the default) inherits from the active product mode:
 * unified/komplete → green, vega → legal copper, atrium → jade.
 * An explicit preference is a LOCK — it wins regardless of product.
 */
export function resolveAccentTheme(
    preference: AccentThemePreference,
    product: Product | string | null | undefined,
): AccentThemeId {
    if (preference !== 'auto') return preference;
    if (product === 'vega' || product === 'legal') return 'vega';
    if (product === 'atrium' || product === 'property') return 'atrium';
    return 'komplete'; // 'unified' / 'komplete' / unresolved → the default green
}

/**
 * The scope class for the app container. Komplete returns '' — the :root
 * green ramp already is the komplete register, so the default DOM is
 * byte-identical to pre-R52 for Komplete firms (and logged-out surfaces).
 */
export function accentSkinClass(id: AccentThemeId): string {
    if (id === 'vega') return 'app-skin-vega';
    if (id === 'atrium') return 'app-skin-atrium';
    return '';
}

/** Settings UI metadata: label + swatch per option (incl. 'auto'). */
export const ACCENT_THEME_OPTIONS: Array<{
    value: AccentThemePreference;
    label: string;
    description: string;
    /** CSS colour for the picker swatch (settings chrome is not token-gated). */
    swatch: string;
}> = [
    {
        value: 'auto',
        label: 'Auto — follow active product',
        description: 'Komplete → Green · Vega → Legal Copper · Atrium → Jade',
        swatch: 'linear-gradient(135deg, #16A34A 34%, #E07A3F 67%, #0C7A57 100%)',
    },
    {
        value: 'komplete',
        label: 'Komplete — Green',
        description: 'The PracticePro favicon green. The unified default.',
        swatch: '#16A34A',
    },
    {
        value: 'vega',
        label: 'Vega — Legal Copper',
        description: 'The Warm Chambers register of the Vega product.',
        swatch: '#E07A3F',
    },
    {
        value: 'atrium',
        label: 'Atrium — Jade',
        description: 'The estate register of the Atrium product.',
        swatch: '#0C7A57',
    },
];

// ─── Per-account persistence (mirrors utils/themeStorage.ts, R12) ────────
// The preference is cosmetic and device-local, so it lives in localStorage
// scoped to the signed-in account — the same shape the display theme uses
// (`practicepro_theme_u:<email>`). No legacy shared key exists (this is a
// new feature), so there is nothing to purge.

const USER_ACCENT_PREFIX = 'practicepro_accent_u:';

/** Per-user localStorage key for the accent preference. */
export function userAccentKey(email: string | null | undefined): string | null {
    const normalized = email?.trim().toLowerCase() || null;
    return normalized ? `${USER_ACCENT_PREFIX}${normalized}` : null;
}

export function isUserAccentKey(key: string): boolean {
    return key.startsWith(USER_ACCENT_PREFIX);
}

/** Load the persisted preference (null = never chosen → 'auto'). */
export function loadAccentPreference(email: string | null | undefined): AccentThemePreference | null {
    const key = userAccentKey(email);
    if (!key) return null;
    try {
        const raw = window.localStorage.getItem(key);
        return isAccentPreference(raw) ? raw : null;
    } catch {
        return null; // private mode / storage disabled — cosmetic, degrade quietly
    }
}

/** Persist the preference under the signed-in user's scoped key. */
export function saveAccentPreference(
    email: string | null | undefined,
    preference: AccentThemePreference,
): void {
    const key = userAccentKey(email);
    if (!key) return;
    try {
        window.localStorage.setItem(key, preference);
    } catch {
        /* private mode — cosmetic preference, not worth failing on */
    }
}
