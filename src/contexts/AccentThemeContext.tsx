/**
 * AccentThemeContext — the centralised accent (brand colour) state, R52.
 *
 * One source of truth for "what colour is this workspace's primary
 * accent". Consumers:
 *   - App.tsx: paints the scope class on the app container (the ONLY
 *     place a skin class is ever applied);
 *   - Settings → Display → Appearance: the picker that lets the user
 *     lock a palette or follow the active product ('auto').
 *
 * Resolution lives in utils/accentTheme.ts (pure, unit-tested):
 * preference ('auto' default) × active product → palette id → scope
 * class. Persistence is per-account localStorage, mirroring
 * themeStorage (R12): `practicepro_accent_u:<email>`.
 *
 * The provider sits AFTER ProductProvider and AuthProvider in
 * AppProvider (it reads both), so every view — Home, Matters,
 * Documents, Research, anywhere — resolves the SAME accent. There is
 * deliberately no per-view input: module-level accent switching is the
 * bug this context exists to remove.
 *
 * 2026-11-22 (green-restore): the skin class is AUTH-GATED. The app
 * container wraps the ENTIRE tree — including the logged-out
 * marketing sites and login — so an ungated product skin repaints the
 * corporate hub (the PracticePro "P", Talk to Us) with the product
 * accent. With no authenticated user there IS no workspace, so there
 * is nothing for a product accent to brand: skinClass is '' and the
 * corporate green :root register owns every logged-out surface.
 * Authenticated users get their product register (Vega/Komplete blue,
 * Atrium jade) on every workspace route.
 */

import * as React from 'react';
import { useProduct } from './ProductContext';
import { useAuth } from './AuthContext';
import {
    AccentThemeId,
    AccentThemePreference,
    loadAccentPreference,
    resolveAccentTheme,
    saveAccentPreference,
    accentSkinClass,
} from '../utils/accentTheme';

export interface AccentThemeContextValue {
    /** The user's stored choice ('auto' follows the active product). */
    preference: AccentThemePreference;
    /** Set + persist the preference (immediate re-render of the accent). */
    setPreference: (preference: AccentThemePreference) => void;
    /** The palette actually active right now (never 'auto'). */
    resolved: AccentThemeId;
    /** The scope class for the app container ('app-skin-komplete' | 'app-skin-vega' | 'app-skin-atrium'). */
    skinClass: string;
}

const AccentThemeContext = React.createContext<AccentThemeContextValue | null>(null);

export const AccentThemeProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const { product } = useProduct();
    const { currentUser } = useAuth();
    const email = currentUser?.email ?? null;

    const [preference, setPreferenceState] = React.useState<AccentThemePreference>(() =>
        loadAccentPreference(email) ?? 'auto',
    );

    // Re-read storage when the signed-in account changes (login/logout,
    // workspace switches to another account) — the preference is per-user.
    React.useEffect(() => {
        setPreferenceState(loadAccentPreference(email) ?? 'auto');
    }, [email]);

    const setPreference = React.useCallback(
        (next: AccentThemePreference) => {
            setPreferenceState(next);
            saveAccentPreference(email, next);
        },
        [email],
    );

    const resolved = resolveAccentTheme(preference, product);
    // 2026-11-22 green-restore: AUTH GATE. The app container wraps the
    // logged-out marketing sites too — without this gate, the product
    // accent (e.g. the komplete blue) repaints the corporate hub's
    // PracticePro "P" and Talk to Us, which are the company green.
    // No signed-in user → no workspace → no product accent → the
    // corporate green :root register owns the surface.
    const skinClass = currentUser ? accentSkinClass(resolved) : '';

    const value = React.useMemo<AccentThemeContextValue>(
        () => ({ preference, setPreference, resolved, skinClass }),
        [preference, setPreference, resolved, skinClass],
    );

    return <AccentThemeContext.Provider value={value}>{children}</AccentThemeContext.Provider>;
};

export function useAccentTheme(): AccentThemeContextValue {
    const ctx = React.useContext(AccentThemeContext);
    if (!ctx) throw new Error('useAccentTheme must be used within AccentThemeProvider');
    return ctx;
}
