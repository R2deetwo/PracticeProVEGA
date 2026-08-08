/**
 * useFounderTheme — theme management hook for the Founder APK.
 *
 * Ported from the consumer app's UIContext theme system. Supports all
 * the same themes as the main app so the founder has a consistent
 * experience across both apps.
 *
 * Themes available:
 *   - system        (follows OS preference)
 *   - light         (default light)
 *   - dark          (default dark)
 *   - midnight      (deep navy)
 *   - oled          (true black for OLED displays)
 *   - neon-cyber    (deep purple/blue with neon text)
 *   - sunlight-soft (warm cream)
 *   - city-lights   (cool gray-blue)
 *   - city-emerald  (light green-tinted)
 *   - midnight-emerald (dark green-tinted)
 *   - army-dark     (military green dark)
 *   - army-light    (soft sage)
 *
 * The theme is applied by adding CSS classes to the <html> element.
 * The theme CSS is defined in src/index.css (shared with the consumer app).
 */

import React, { useState, useEffect, useCallback } from 'react';

export type FounderTheme =
    | 'system'
    | 'light'
    | 'dark'
    | 'midnight'
    | 'oled'
    | 'neon-cyber'
    | 'sunlight-soft'
    | 'city-lights'
    | 'city-emerald'
    | 'midnight-emerald'
    | 'army-dark'
    | 'army-light';

export interface ThemeOption {
    id: FounderTheme;
    label: string;
    description: string;
    preview: { bg: string; text: string; accent: string };
    isDark: boolean;
}

export const THEME_OPTIONS: ThemeOption[] = [
    {
        id: 'system',
        label: 'System',
        description: 'Follows your device\'s setting',
        preview: { bg: 'bg-slate-200 dark:bg-zinc-800', text: 'text-slate-900 dark:text-white', accent: 'bg-primary-500' },
        isDark: false,
    },
    {
        id: 'light',
        label: 'Light',
        description: 'Clean, bright, default',
        preview: { bg: 'bg-white', text: 'text-slate-900', accent: 'bg-primary-500' },
        isDark: false,
    },
    {
        id: 'dark',
        label: 'Dark',
        description: 'Easy on the eyes at night',
        preview: { bg: 'bg-zinc-900', text: 'text-white', accent: 'bg-primary-400' },
        isDark: true,
    },
    {
        id: 'midnight',
        label: 'Midnight Royal',
        description: 'Deep navy blue',
        preview: { bg: 'bg-slate-950', text: 'text-slate-100', accent: 'bg-blue-500' },
        isDark: true,
    },
    {
        id: 'oled',
        label: 'OLED Black',
        description: 'True black for OLED displays',
        preview: { bg: 'bg-black', text: 'text-zinc-100', accent: 'bg-zinc-400' },
        isDark: true,
    },
    {
        id: 'neon-cyber',
        label: 'Neon Cyber',
        description: 'Deep purple with neon accents',
        preview: { bg: 'bg-purple-950', text: 'text-purple-100', accent: 'bg-fuchsia-500' },
        isDark: true,
    },
    {
        id: 'midnight-emerald',
        label: 'Midnight Emerald',
        description: 'Dark green-tinted',
        preview: { bg: 'bg-emerald-950', text: 'text-emerald-100', accent: 'bg-emerald-500' },
        isDark: true,
    },
    {
        id: 'army-dark',
        label: 'Army Dark',
        description: 'Military green dark',
        preview: { bg: 'bg-green-950', text: 'text-green-100', accent: 'bg-green-700' },
        isDark: true,
    },
    {
        id: 'sunlight-soft',
        label: 'Sunlight Soft',
        description: 'Warm cream tones',
        preview: { bg: 'bg-amber-50', text: 'text-amber-900', accent: 'bg-amber-500' },
        isDark: false,
    },
    {
        id: 'city-lights',
        label: 'City Lights',
        description: 'Cool gray-blue',
        preview: { bg: 'bg-slate-200', text: 'text-slate-800', accent: 'bg-indigo-500' },
        isDark: false,
    },
    {
        id: 'city-emerald',
        label: 'City Emerald',
        description: 'Light with green tint',
        preview: { bg: 'bg-emerald-50', text: 'text-emerald-900', accent: 'bg-emerald-600' },
        isDark: false,
    },
    {
        id: 'army-light',
        label: 'Army Light',
        description: 'Soft sage green',
        preview: { bg: 'bg-green-50', text: 'text-green-900', accent: 'bg-green-600' },
        isDark: false,
    },
];

const STORAGE_KEY = 'founder_theme';

function getInitialTheme(): FounderTheme {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && THEME_OPTIONS.some(t => t.id === stored)) {
            return stored as FounderTheme;
        }
    } catch {}
    return 'system';
}

export function useFounderTheme() {
    const [theme, setThemeState] = useState<FounderTheme>(getInitialTheme);

    // Apply theme to <html> element
    useEffect(() => {
        const root = window.document.documentElement;

        // Remove all theme classes
        root.classList.remove(
            'light', 'dark',
            'theme-midnight', 'theme-oled', 'theme-neon-cyber', 'theme-sunlight-soft', 'theme-city-lights',
            'theme-city-emerald', 'theme-midnight-emerald', 'theme-army-dark', 'theme-army-light'
        );

        let activeTheme = theme;
        if (theme === 'system') {
            activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        // Apply the active theme class
        if (activeTheme === 'dark') {
            root.classList.add('dark');
        } else if (activeTheme === 'midnight') {
            root.classList.add('dark', 'theme-midnight');
        } else if (activeTheme === 'oled') {
            root.classList.add('dark', 'theme-oled');
        } else if (activeTheme === 'neon-cyber') {
            root.classList.add('dark', 'theme-neon-cyber');
        } else if (activeTheme === 'midnight-emerald') {
            root.classList.add('dark', 'theme-midnight-emerald');
        } else if (activeTheme === 'army-dark') {
            root.classList.add('dark', 'theme-army-dark');
        } else if (activeTheme === 'sunlight-soft') {
            root.classList.add('theme-sunlight-soft');
        } else if (activeTheme === 'city-lights') {
            root.classList.add('theme-city-lights');
        } else if (activeTheme === 'city-emerald') {
            root.classList.add('theme-city-emerald');
        } else if (activeTheme === 'army-light') {
            root.classList.add('theme-army-light');
        } else {
            root.classList.add('light');
        }

        // Persist to localStorage
        try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
    }, [theme]);

    // Listen for system theme changes when in 'system' mode
    useEffect(() => {
        if (theme !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            // Trigger re-application by toggling state
            setThemeState(prev => prev);
        };
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [theme]);

    const setTheme = useCallback((newTheme: FounderTheme) => {
        setThemeState(newTheme);
    }, []);

    const cycleTheme = useCallback(() => {
        const currentIndex = THEME_OPTIONS.findIndex(t => t.id === theme);
        const nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
        setThemeState(THEME_OPTIONS[nextIndex].id);
    }, [theme]);

    return { theme, setTheme, cycleTheme };
}
