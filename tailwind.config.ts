import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
    darkMode: "class",
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./index.html",
  ],
  theme: {
        extend: {
                colors: {
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
                        card: {
                                DEFAULT: 'hsl(var(--card))',
                                foreground: 'hsl(var(--card-foreground))'
                        },
                        popover: {
                                DEFAULT: 'hsl(var(--popover))',
                                foreground: 'hsl(var(--popover-foreground))'
                        },
                        primary: {
                                DEFAULT: 'hsl(var(--primary))',
                                foreground: 'hsl(var(--primary-foreground))',
                                50: 'rgb(var(--color-primary-50) / <alpha-value>)',
                                100: 'rgb(var(--color-primary-100) / <alpha-value>)',
                                200: 'rgb(var(--color-primary-200) / <alpha-value>)',
                                300: 'rgb(var(--color-primary-300) / <alpha-value>)',
                                400: 'rgb(var(--color-primary-400) / <alpha-value>)',
                                500: 'rgb(var(--color-primary-500) / <alpha-value>)',
                                600: 'rgb(var(--color-primary-600) / <alpha-value>)',
                                700: 'rgb(var(--color-primary-700) / <alpha-value>)',
                                800: 'rgb(var(--color-primary-800) / <alpha-value>)',
                                900: 'rgb(var(--color-primary-900) / <alpha-value>)',
                                950: 'rgb(var(--color-primary-950) / <alpha-value>)',
                        },
                        secondary: {
                                DEFAULT: 'hsl(var(--secondary))',
                                foreground: 'hsl(var(--secondary-foreground))'
                        },
                        muted: {
                                DEFAULT: 'hsl(var(--muted))',
                                foreground: 'hsl(var(--muted-foreground))'
                        },
                        accent: {
                                DEFAULT: 'hsl(var(--accent))',
                                foreground: 'hsl(var(--accent-foreground))'
                        },
                        destructive: {
                                DEFAULT: 'hsl(var(--destructive))',
                                foreground: 'hsl(var(--destructive-foreground))'
                        },
                        border: 'hsl(var(--border))',
                        input: 'hsl(var(--input))',
                        ring: 'hsl(var(--ring))',
                        chart: {
                                '1': 'hsl(var(--chart-1))',
                                '2': 'hsl(var(--chart-2))',
                                '3': 'hsl(var(--chart-3))',
                                '4': 'hsl(var(--chart-4))',
                                '5': 'hsl(var(--chart-5))'
                        },
                        // ─── THEME-AWARE NEUTRAL COLORS (Aug 2026 fix) ────────
                        // Maps Tailwind's slate/zinc/gray/white/black to the CSS
                        // variables defined in index.css. Without this mapping,
                        // bg-white, bg-slate-50, dark:bg-zinc-800, text-slate-900
                        // etc. generate hardcoded hex values from Tailwind's default
                        // palette — they NEVER respond to theme overrides.
                        // Now every theme class (.dark, .theme-midnight, .theme-oled
                        // etc.) can override --color-white, --color-slate-800, etc.
                        // and all Tailwind utilities that reference those colors
                        // will update automatically.
                        slate: {
                                50:  'rgb(var(--color-slate-50) / <alpha-value>)',
                                100: 'rgb(var(--color-slate-100) / <alpha-value>)',
                                200: 'rgb(var(--color-slate-200) / <alpha-value>)',
                                300: 'rgb(var(--color-slate-300) / <alpha-value>)',
                                400: 'rgb(var(--color-slate-400) / <alpha-value>)',
                                500: 'rgb(var(--color-slate-500) / <alpha-value>)',
                                600: 'rgb(var(--color-slate-600) / <alpha-value>)',
                                700: 'rgb(var(--color-slate-700) / <alpha-value>)',
                                800: 'rgb(var(--color-slate-800) / <alpha-value>)',
                                900: 'rgb(var(--color-slate-900) / <alpha-value>)',
                                950: 'rgb(var(--color-slate-950) / <alpha-value>)',
                        },
                        zinc: {
                                50:  'rgb(var(--color-zinc-50) / <alpha-value>)',
                                100: 'rgb(var(--color-zinc-100) / <alpha-value>)',
                                200: 'rgb(var(--color-zinc-200) / <alpha-value>)',
                                300: 'rgb(var(--color-zinc-300) / <alpha-value>)',
                                400: 'rgb(var(--color-zinc-400) / <alpha-value>)',
                                500: 'rgb(var(--color-zinc-500) / <alpha-value>)',
                                600: 'rgb(var(--color-zinc-600) / <alpha-value>)',
                                700: 'rgb(var(--color-zinc-700) / <alpha-value>)',
                                800: 'rgb(var(--color-zinc-800) / <alpha-value>)',
                                900: 'rgb(var(--color-zinc-900) / <alpha-value>)',
                                950: 'rgb(var(--color-zinc-950) / <alpha-value>)',
                        },
                        gray: {
                                50:  'rgb(var(--color-gray-50) / <alpha-value>)',
                                100: 'rgb(var(--color-gray-100) / <alpha-value>)',
                                200: 'rgb(var(--color-gray-200) / <alpha-value>)',
                                300: 'rgb(var(--color-gray-300) / <alpha-value>)',
                                400: 'rgb(var(--color-gray-400) / <alpha-value>)',
                                500: 'rgb(var(--color-gray-500) / <alpha-value>)',
                                600: 'rgb(var(--color-gray-600) / <alpha-value>)',
                                700: 'rgb(var(--color-gray-700) / <alpha-value>)',
                                800: 'rgb(var(--color-gray-800) / <alpha-value>)',
                                900: 'rgb(var(--color-gray-900) / <alpha-value>)',
                                950: 'rgb(var(--color-gray-950) / <alpha-value>)',
                        },
                        white: 'rgb(var(--color-white) / <alpha-value>)',
                        black: 'rgb(var(--color-black) / <alpha-value>)',
                        // ─── Premium Portal Design Tokens ──────────────────────
                        // Used by the portal pages (ClientDashboard, TenantPortal)
                        // to create the soft, elevated, borderless aesthetic.
                        brand: {
                                primary: '#10b981',      // Emerald green — keeps your brand identity
                                surface: '#F8FAF6',      // Very light off-white with a hint of green
                                card: '#FFFFFF',          // Pure white for card elevation
                        },
                },
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)',
                        // Premium portal rounding
                        premium: '24px',       // Large, soft corners for hero cards & sheets
                        icon: '16px',          // Slightly sharper for small icon containers
                },
                boxShadow: {
                        // Subtle depth — replaces visible borders on portal cards
                        soft: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                        softer: '0 2px 12px -2px rgba(0, 0, 0, 0.03)',
                        premium: '0 8px 32px -4px rgba(0, 0, 0, 0.08)',
                },
                // ─── Micro typography ─────────────────────────────────────────
                // These utility classes (text-2xs, text-3xs, tracking-wide-label)
                // are used in 30+ places across LandingPage.tsx, ContactSalesDrawer.tsx,
                // designTokens.ts, FounderBottomNav, AdminLogin, NotificationCenter,
                // and more. Without these definitions, Tailwind silently drops the
                // classes and text falls back to the inherited (larger) size —
                // breaking the tight micro-labels on badges, pills, and modal stats.
                fontSize: {
                        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],   // 10px / 14px
                        '3xs': ['0.5rem',   { lineHeight: '0.75rem' }],     // 8px / 12px
                },
                letterSpacing: {
                        'wide-label': '0.05em',
                },
        }
  },
  plugins: [tailwindcssAnimate],
};
export default config;
