/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      // ─── TYPOGRAPHY TOKENS (Phase 6.1) ────────────────────────────
      // text-2xs (10px) is the 3rd most-used size in the app (979 occurrences
      // as text-[10px]). Now it's a named token. text-3xs (9px) for badges.
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.02em' }],
        '3xs': ['9px', { lineHeight: '12px', letterSpacing: '0.03em' }],
      },
      colors: {
        // These color families are overridden via CSS variables so themes can remap them at runtime.
        slate: {
          50:  'rgb(var(--color-slate-50)  / <alpha-value>)',
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
          50:  'rgb(var(--color-zinc-50)  / <alpha-value>)',
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
        // Phase 6.5: gray is aliased to slate so we have ONE neutral scale.
        // All gray-* references now render identically to slate-*.
        // This eliminates the visual drift where gray and slate had slightly
        // different undertones on some screens.
        gray: {
          50:  'rgb(var(--color-slate-50)  / <alpha-value>)',
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
        white: 'rgb(var(--color-white) / <alpha-value>)',
        black: 'rgb(var(--color-black) / <alpha-value>)',
        // Phase 6.4: primary moved to CSS variables for theme remapping.
        // The hex values are preserved as CSS variable defaults in index.css.
        // This allows dark/light mode to use different primary shades
        // without code changes.
        primary: {
          50:  'rgb(var(--color-primary-50)  / <alpha-value>)',
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
      },
      // ─── Z-INDEX SCALE (Phase 6.2) ────────────────────────────────
      // Centralized z-index scale. Use these tokens instead of arbitrary
      // z-[9999] values. This prevents z-index wars between components.
      //   z-sticky    = sticky headers, sidebars (30)
      //   z-dropdown  = dropdowns, popovers, tooltips (50)
      //   z-fab       = floating action buttons (1001)
      //   z-drawer    = docked modals, side panels (2000)
      //   z-modal     = full-screen modals (3000)
      //   z-toast     = toast notifications (9999)
      //   z-dialog    = confirm dialogs, always on top (10000)
      zIndex: {
        sticky: 30,
        dropdown: 50,
        fab: 1001,
        drawer: 2000,
        modal: 3000,
        toast: 9999,
        dialog: 10000,
      },
      // ─── SHADOW SCALE (Phase 6.3) ─────────────────────────────────
      // 3-level shadow system: card (resting), popover (overlay), modal (dialog).
      // Use shadow-card, shadow-popover, shadow-modal instead of shadow-sm/md/lg/xl/2xl.
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'popover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'modal': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'glow-primary': '0 0 40px 0 rgba(34,197,94,0.3)',
        'glow-sm': '0 0 20px 0 rgba(34,197,94,0.2)',
      },
      // ─── BORDER-RADIUS SCALE (Phase 6.3) ──────────────────────────
      // Named radius tokens: card (lg=12px), modal (2xl=16px), sheet (3xl=24px top-only)
      borderRadius: {
        'card': '12px',
        'modal': '16px',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
      },
      keyframes: {
        fadeInUp: {
          from: { transform: 'translateY(24px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      transitionProperty: {
        'colors-all': 'background-color, border-color, color, fill, stroke',
      },
    },
  },
  plugins: [],
}
