import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
    darkMode: "class",
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
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
                                foreground: 'hsl(var(--primary-foreground))'
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
