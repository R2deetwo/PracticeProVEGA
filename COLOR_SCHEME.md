# Color Scheme — PracticePro Brand Palette

The design system is **CSS-variable driven** (Tailwind reads `rgb(var(--…) / <alpha>)`), which gives us runtime-switchable light/dark palettes and per-product accent theming without class swaps. Source of truth: `src/index.css` (variables) + `tailwind.config.ts` (mapping).

---

## 1. Core neutrals (both products)

| Token | Light value | Meaning |
|-------|-------------|---------|
| `--color-ink` | `#0B1220` | Primary text — deep navy-ink, not pure black |
| `--color-paper` | `#FBFBF9` | Primary background — warm off-white |
| `--color-sage` | `#EEF2EB` | Section-break surface — pale moss tint |
| `--color-moss` | `#16A34A` | The brand green (also the favicon green) |

The ink/paper pairing is deliberate: pure-black-on-white reads clinical; the warm pair reads "professional practice."

## 2. Product accents

| Product | Accent | Hex | Used for |
|---------|--------|-----|----------|
| **PracticePro (parent)** | Moss green | `#16A34A` | Primary actions, links, brand moments |
| **Vega (legal)** | Amber | `#D97706` (amber-600) | Vega-tinted hero duotones, product-page accents |
| **Atrium (property)** | Emerald | `#059669` (emerald-600) | Atrium-tinted hero duotones, product-page accents |

The landing/product pages apply a **duotone brand tint** over hero photography — amber for Vega, emerald for Atrium — so the two verticals feel like siblings, not strangers.

## 3. Primary scale (interactive green)

Defined as RGB triplets for alpha compositing:

```
--color-primary-500: 22 163 74    /* #16A34A — favicon green, primary   */
--color-primary-600: 21 128 61    /* darker — hover/active              */
--color-primary-700: 20 83 45     /* pressed                            */
--color-primary-800: 22 101 52
```

A legacy "Brand Moss Green" palette (`#4A694C` family) exists as an alternate block in `src/index.css` (used by some admin surfaces) — the `#16A34A` family is the current primary.

## 4. Functional / semantic colors

- **Danger / critical:** rose family (`rose-500/600`), plus the banner system's deep crimson glass `rgba(186, 26, 43, 0.88)` for critical alerts
- **Warning:** amber family — banner amber glass `rgba(217, 131, 43, 0.75)`
- **Info:** sky blue — banner blue glass `rgba(82, 142, 186, 0.75)`
- **Success:** emerald — banner green glass `rgba(86, 178, 126, 0.75)`
- **Violet:** upsell/offer banners — `rgba(139, 92, 246, 0.75)`

The **unified banner system** (BroadcastBanner carousel) uses these frosted-glass fills with `backdrop-filter: blur(16px) saturate(180%)`, a white-25% pill, dark slate text, and a 1px translucent white border. See `src/components/BroadcastBanner.tsx` THEME map.

## 5. Dark mode

Dark palettes redefine the same variable names (`src/index.css` blocks under the dark selector): zinc-family surfaces, preserved accents. Because Tailwind maps the variables (not fixed hexes), every `bg-primary-600` / `text-ink` class re-themes automatically. The landing page is **always light** regardless of theme.

## 6. Radius scale (enforced)

Buttons/inputs `rounded-md` → cards/panels `rounded-lg` → modal shells `rounded-2xl`. `rounded-xl` is retired; ESLint `no-restricted-syntax` flags new string-literal uses. Full rules: `STYLE_GUIDE.md`.

## 7. Typography (companion note)

Display face: **Space Grotesk** (`font-display`) for headlines/wordmarks; system sans for UI text. This pairing carries the "modern professional" voice — geometric confidence, quiet body text.

---

**When adding colors:** extend via a CSS variable + Tailwind mapping, not a hardcoded hex — hardcoded values break theming and dark mode. Semantic colors come from the functional families above, not ad-hoc picks.
