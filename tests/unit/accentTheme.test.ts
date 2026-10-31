// @vitest-environment node
/**
 * R52 — the accent theme engine (unified product branding).
 *
 * Owner bug report: "brand accents are fragmenting across different
 * views. While the Home dashboard correctly renders using the primary
 * brand color (Green), navigating to other core modules like Matters,
 * Documents, or Research abruptly overrides the accent with a
 * hardcoded copper/brown color scheme." The R28 legal-side skin is
 * retired; the accent resolves in one place from product + user
 * preference. These tests pin that contract.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    resolveAccentTheme,
    accentSkinClass,
    userAccentKey,
    isUserAccentKey,
    loadAccentPreference,
    saveAccentPreference,
    isAccentPreference,
    ACCENT_THEME_OPTIONS,
} from '../../src/utils/accentTheme';

const read = (...p: string[]) => readFileSync(join(__dirname, '..', '..', ...p), 'utf8');

// ─── Resolution: the product mapping the owner specified ────────────────

describe('R52 accent resolution — one accent per product, no per-view switching', () => {
    it('auto follows the active product mode', () => {
        // Komplete (unified / default) → GREEN everywhere
        expect(resolveAccentTheme('auto', 'unified')).toBe('komplete');
        expect(resolveAccentTheme('auto', 'komplete')).toBe('komplete');
        expect(resolveAccentTheme('auto', undefined)).toBe('komplete');
        // Vega → the legal copper
        expect(resolveAccentTheme('auto', 'vega')).toBe('vega');
        expect(resolveAccentTheme('auto', 'legal')).toBe('vega');
        // Atrium → the estate jade
        expect(resolveAccentTheme('auto', 'atrium')).toBe('atrium');
        expect(resolveAccentTheme('auto', 'property')).toBe('atrium');
    });

    it('an explicit preference is a LOCK — it wins regardless of product', () => {
        expect(resolveAccentTheme('vega', 'unified')).toBe('vega');
        expect(resolveAccentTheme('komplete', 'vega')).toBe('komplete');
        expect(resolveAccentTheme('atrium', 'unified')).toBe('atrium');
    });

    it('komplete maps to NO scope class — the :root green is the komplete register', () => {
        expect(accentSkinClass('komplete')).toBe('');
        expect(accentSkinClass('vega')).toBe('app-skin-vega');
        expect(accentSkinClass('atrium')).toBe('app-skin-atrium');
    });

    it('the settings picker offers auto + the three product palettes', () => {
        expect(ACCENT_THEME_OPTIONS.map((o) => o.value)).toEqual(['auto', 'komplete', 'vega', 'atrium']);
        expect(isAccentPreference('auto')).toBe(true);
        expect(isAccentPreference('purple')).toBe(false);
        expect(isAccentPreference(null)).toBe(false);
    });
});

// ─── Persistence: per-account localStorage (the themeStorage pattern) ───

describe('R52 accent persistence — per-account, localStorage', () => {
    // The repo's unit suites run in the node environment (no jsdom) —
    // stub the storage surface the wrappers touch.
    const store = new Map<string, string>();
    const localStorageStub = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
    } as unknown as Storage;

    beforeEach(() => {
        store.clear();
        (globalThis as any).window = { localStorage: localStorageStub };
    });

    it('derives a per-user key from the normalized email', () => {
        expect(userAccentKey('Demo@PracticePro.NG ')).toBe('practicepro_accent_u:demo@practicepro.ng');
        expect(userAccentKey(null)).toBeNull();
        expect(userAccentKey('   ')).toBeNull();
        expect(isUserAccentKey('practicepro_accent_u:a@b.c')).toBe(true);
        expect(isUserAccentKey('practicepro_theme_u:a@b.c')).toBe(false);
    });

    it('round-trips a saved preference and ignores junk', () => {
        saveAccentPreference('user@example.com', 'vega');
        expect(loadAccentPreference('user@example.com')).toBe('vega');
        store.set('practicepro_accent_u:other@example.com', 'neon-pink');
        expect(loadAccentPreference('other@example.com')).toBeNull(); // not a valid preference
        expect(loadAccentPreference('nobody')).toBeNull(); // never chosen
    });

    it('saving with no signed-in email is a quiet no-op', () => {
        expect(() => saveAccentPreference(null, 'atrium')).not.toThrow();
        expect(store.has('practicepro_accent_u:null')).toBe(false);
    });
});

// ─── Wiring: the app consumes the context, never a view list ────────────

describe('R52 wiring — one application point, no per-view skinning', () => {
    it('App.tsx applies the accent from AccentThemeContext, and LEGAL_SIDE_VIEWS is gone', () => {
        const app = read('src', 'components', 'App.tsx');
        expect(app).toContain('useAccentTheme');
        expect(app).toContain('accentSkinClass}');
        // The R28 per-view skinning is retired — the exact bug the owner reported.
        expect(app).not.toContain('LEGAL_SIDE_VIEWS');
        expect(app).not.toContain('app-skin-vega'); // the class name lives only in CSS + accentTheme.ts
    });

    it('the provider is registered after ProductProvider (it reads product + auth)', () => {
        const providers = read('src', 'contexts', 'AppProvider.tsx');
        const productIdx = providers.indexOf('<ProductProvider />');
        const accentIdx = providers.indexOf('<AccentThemeProvider />');
        expect(productIdx).toBeGreaterThan(-1);
        expect(accentIdx).toBeGreaterThan(productIdx);
    });

    it('index.css carries all three registers: default green, vega copper, atrium jade', () => {
        const css = read('src', 'index.css');
        // Komplete = the :root favicon green
        expect(css).toContain('--color-primary-500: 22 163 74');
        // Vega = the Warm Chambers copper
        expect(css).toMatch(/\.app-skin-vega\s*\{[\s\S]*?--color-primary-500: 224 122 63/);
        // Atrium = the estate jade ramp
        expect(css).toMatch(/\.app-skin-atrium\s*\{[\s\S]*?--color-primary-500: 5 150 105/);
        expect(css).toMatch(/\.app-skin-atrium\s*\{[\s\S]*?--color-primary-600: 12 122 87/);
    });

    it('Settings → Display → Appearance exposes the accent controller', () => {
        const display = read('src', 'components', 'settings', 'DisplaySettings.tsx');
        expect(display).toContain('AccentPicker');
        expect(display).toContain('useAccentTheme');
        expect(display).toContain('Accent Colour (Product Theme)');
    });

    it('the sidebar workspace row reads the primary ramp, not a hardcoded green', () => {
        const sidebar = read('src', 'components', 'Sidebar.tsx');
        expect(sidebar).not.toContain('bg-green-50 text-green-700');
        expect(sidebar).toContain('bg-primary-50 text-primary-700');
    });
});
