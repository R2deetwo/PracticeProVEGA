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
                                DEFAULT: 'rgb(var(--text-muted) / <alpha-value>)',
                                foreground: 'rgb(var(--text-subtle) / <alpha-value>)'
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
                        // Maps Tailwind's slate/zinc/dim/white/black to the CSS
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
                        // ─── DIM SCALE (P4 batch 2) ────────────────────────────
                        // The theme-INVERTED neutral ramp (formerly the `gray` key).
                        // Every dark theme remaps these vars so dim-N AUTO-FLIPS:
                        // low shades become dark surfaces, high shades light text.
                        // Use for unpaired light classes and dark: variants that
                        // rely on the flip; converges into the batch-7 dark role
                        // layer. The `gray` name is deleted — re-adding it is a
                        // CI failure (scripts/check-design-tokens.mjs).
                        dim: {
                                50:  'rgb(var(--color-dim-50) / <alpha-value>)',
                                100: 'rgb(var(--color-dim-100) / <alpha-value>)',
                                200: 'rgb(var(--color-dim-200) / <alpha-value>)',
                                300: 'rgb(var(--color-dim-300) / <alpha-value>)',
                                400: 'rgb(var(--color-dim-400) / <alpha-value>)',
                                500: 'rgb(var(--color-dim-500) / <alpha-value>)',
                                600: 'rgb(var(--color-dim-600) / <alpha-value>)',
                                700: 'rgb(var(--color-dim-700) / <alpha-value>)',
                                800: 'rgb(var(--color-dim-800) / <alpha-value>)',
                                900: 'rgb(var(--color-dim-900) / <alpha-value>)',
                                950: 'rgb(var(--color-dim-950) / <alpha-value>)',
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
                        // ─── SEMANTIC ROLE TOKENS (P4, docs/design/TOKENS.md) ──
                        // Exact aliases of the neutral scale vars — a class swap
                        // (text-slate-900 → text-strong) is zero-visual-change by
                        // construction: same var, same value, every theme. The old
                        // shadcn `muted` entry (hsl(var(--muted)) — var never
                        // defined, zero usages) was repurposed into this layer.
                        // NOTE: a Tailwind color key serves every utility prefix
                        // (text-/bg-/border-), so border roles get DISTINCT key
                        // names (hairline/edge) that alias the --border-* vars —
                        // sharing the `subtle`/`strong` keys would have made
                        // border-subtle resolve to the TEXT value (slate-400),
                        // caught by the built-CSS equivalence check.
                        strong:  'rgb(var(--text-strong) / <alpha-value>)',      // = slate-900
                        body:    'rgb(var(--text-body) / <alpha-value>)',        // = slate-700
                        subtle:  'rgb(var(--text-subtle) / <alpha-value>)',     // = slate-400
                        hairline: 'rgb(var(--border-subtle) / <alpha-value>)',   // border-hairline = slate-200
                        edge:    'rgb(var(--border-strong) / <alpha-value>)',    // border-edge = slate-300
                        surface: {
                                DEFAULT: 'rgb(var(--bg-surface) / <alpha-value>)',   // = slate-50
                                2: 'rgb(var(--bg-surface-2) / <alpha-value>)',       // = slate-100
                        },
                },
                // ─── BORDER RADIUS (3 tokens, enforced) ─────────────────────────
                // sm  = 6px   → Buttons, inputs, badges, pills
                // md  = 12px  → Cards, modals, banners
                // lg  = 20px  → Hero sections, landing cards, bottom sheets
                // premium/icon kept for backward compat (mapped to lg/md)
                borderRadius: {
                        sm: '6px',
                        md: '12px',
                        lg: '20px',
                        xl: '20px',         // alias — old rounded-xl now = rounded-lg
                        '2xl': '20px',      // alias — old rounded-2xl now = rounded-lg
                        '3xl': '24px',      // hero cards only
                        full: '9999px',
                        premium: '20px',    // alias to lg (backward compat)
                        icon: '12px',       // alias to md (backward compat)
                },
                // ─── SHADOW (4 elevation levels, enforced) ───────────────────────
                // elevation-1 = buttons at rest
                // elevation-2 = cards, list items
                // elevation-3 = modals, dropdowns, popovers
                // elevation-4 = floating elements (tooltips, bottom sheets)
                // soft/softer/premium kept as aliases for backward compat
                boxShadow: {
                        'elevation-1': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                        'elevation-2': '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
                        'elevation-3': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
                        'elevation-4': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
                        // Aliases for backward compat
                        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
                        md: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
                        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
                        soft: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
                        softer: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                        premium: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
                },
                // ─── TYPOGRAPHY SCALE (enforced) ────────────────────────────────
                // 8 sizes total: 2 micro + 6 standard.
                // BAN arbitrary values (text-[11px], text-[13px]) — use these.
                fontSize: {
                        '3xs': ['0.5rem',   { lineHeight: '0.75rem',   letterSpacing: '0.02em' }],     // 8px  / 12px
                        '2xs': ['0.625rem', { lineHeight: '0.875rem',   letterSpacing: '0.02em' }],     // 10px / 14px
                        'xs':  ['0.75rem',  { lineHeight: '1rem',       letterSpacing: '0.01em' }],     // 12px / 16px
                        'sm':  ['0.875rem', { lineHeight: '1.25rem',    letterSpacing: '0' }],         // 14px / 20px
                        'base':['1rem',     { lineHeight: '1.5rem',     letterSpacing: '0' }],         // 16px / 24px
                        'lg':  ['1.125rem', { lineHeight: '1.75rem',    letterSpacing: '-0.01em' }],   // 18px / 28px
                        'xl':  ['1.25rem',  { lineHeight: '1.75rem',    letterSpacing: '-0.02em' }],   // 20px / 28px
                        '2xl': ['1.5rem',   { lineHeight: '2rem',       letterSpacing: '-0.02em' }],   // 24px / 32px
                        '3xl': ['1.875rem', { lineHeight: '2.25rem',    letterSpacing: '-0.03em' }],   // 30px / 36px
                },
                letterSpacing: {
                        'wide-label': '0.05em',
                        wider: '0.05em',
                        widest: '0.1em',
                },
        }
  },
  plugins: [tailwindcssAnimate],
};
export default config;
