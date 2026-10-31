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
    /** The scope class for the app container ('' | 'app-skin-vega' | 'app-skin-atrium'). */
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
    const skinClass = accentSkinClass(resolved);

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
