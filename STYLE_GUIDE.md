# PracticePro Brand UI & Style Guide

This style guide defines the visual identity, spacing scales, and layout rules for PracticePro, Vega, Atrium, and Komplete to maintain UI consistency across all modules.

---

## 1. Brand & Semantic Color System

> **RETIRED (P0 brand source-of-truth split, 2026-10-13).** The colour
> sections of this guide are superseded by the per-surface brand records:
>
> - The company/hub identity: `docs/brand/practicepro.md`
> - Vega (legal, /vega): `docs/brand/vega.md` — shipped night/gilt tokens
> - Atrium (property, /atrium): `docs/brand/atrium.md` — shipped emerald tokens
>
> The historical "Dark Moss Green `#4A694C`" palette below is **LEGACY** —
> it never described the shipped product surfaces and is retained for
> archaeology only.

### LEGACY — Primary Corporate Palette (superseded)
- **Dark Moss Green:** `#4A694C` (RGB 74, 105, 76) — *legacy, unused on the
  shipped marketing surfaces.*

### ALOA / ARIA Semantic State Colors
To prevent brand confusion with Dark Moss Green, use these desaturated, soft semantic background and text pairings for warning and alert states:
- 🔴 **High Priority / Alerts:** Background `#FCE8E6`, Text `#C5221F`
- 🟢 **Standard Reviews / Status:** Background `#E6F4EA`, Text `#137333` (Distinguished from brand Moss Green)
- 🔵 **Informational / Research:** Background `#E8F0FE`, Text `#1A73E8`

---

## 2. Border-Radius Scale (Strictly Enforced)

**UX-17: this section now documents the COMPILED TRUTH** (tailwind.config.ts `borderRadius`) — the previous prose described a scale that never shipped (8/12/16px) and a "deprecated 14px" rounded-xl that is actually an alias of 20px. The real scale:
- `rounded-sm` (6px): Buttons, inputs, badges, pills.
- `rounded-md` (12px): Form inputs in dense toolbars, action buttons, small utility chips.
- `rounded-lg` (20px): Cards, modals, banners, dashboard widgets, hero blocks, layout wrappers — the dominant tier (2,100+ uses).
- `rounded-xl` and `rounded-2xl` are ALIASES of `rounded-lg` (20px). `rounded-xl` is deprecated per the CI ratchet (check-design-tokens.mjs — the count may only shrink); prefer `rounded-lg`. `rounded-2xl` is the accepted spelling for the same 20px.
- `rounded-3xl` (24px): hero cards only.
- `rounded-full`: pills, avatars.

---

## 3. Shadows & Spacing Scales

### Golden Ratio Spacing
All padding, margin, gaps, and layouts should align to the Golden Ratio proportional spacing system. In practice, use Tailwind's default spacing scale (which is close to this) and avoid arbitrary values unless specifically needed:
- **Tiny:** `8px` (`space-2` / `p-2`)
- **Small:** `12px` (`space-3` / `p-3`) — used instead of 13px for Tailwind alignment
- **Medium:** `20px` (`space-5` / `p-5`) — used instead of 21px for Tailwind alignment
- **Large:** `32px` (`space-8` / `p-8`) — used instead of 34px for Tailwind alignment
- **Extra Large:** `48px` (`space-12` / `p-12`) — used instead of 55px for Tailwind alignment

### Elevation Shadows
**UX-45: the authoritative mapping is the `boxShadow` block in tailwind.config.ts.** The semantic levels:
- `shadow-elevation-1` (=`shadow-sm`): buttons at rest.
- `shadow-elevation-2` (=`shadow-md`/`DEFAULT`/`soft`): cards, list items.
- `shadow-elevation-3`: modals, dropdowns, popovers.
- `shadow-elevation-4` (=`shadow-lg`): floating elements (tooltips, bottom sheets).

The `elevation-N` names are preferred in NEW marketing-site code (the Atrium site already uses them); `sm/md/lg` aliases are the established app spelling — both resolve to the same four compiled values, so there is exactly one elevation system, not three.

---

## 4. Page Transitions

Transitions should be smooth and professional — inspired by Google Workspace, not jarring or flashy. For a legal practice management app, the goal is **calm confidence**.

### Transition Principles
- **Duration:** 200-300ms for most transitions. Never faster than 150ms (feels abrupt) or slower than 400ms (feels sluggish).
- **Easing:** Use `ease-out` for elements entering the viewport, `ease-in` for elements leaving. `ease-in-out` for state toggles.
- **Opacity + Transform:** Combine `opacity` with `translateY(4px)` for a subtle "lift" effect on page changes. Avoid scale transforms on full pages (feels zoomy/unprofessional).
- **No bounce/spring:** This is a legal tool, not a consumer app. Avoid `cubic-bezier` overshoot curves.

### Implementation
Use CSS transitions on the main content wrapper:
```css
.app-content {
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}
.app-content.entering {
  opacity: 0;
  transform: translateY(4px);
}
```

Or with Tailwind:
```tsx
<div className="transition-all duration-200 ease-out">
  {children}
</div>
```

### What NOT to do
- ❌ Full-page slide animations (left/right) — feels like a mobile app, not a desktop tool
- ❌ Scale/zoom transitions — feels disorienting
- ❌ Bounce or spring physics — too playful for a legal context
- ❌ Long fade durations (>400ms) — feels broken/slow

---

## 5. Typography

- **Primary Font:** Inter (sans-serif) — for UI, navigation, and body text
- **Document Font:** Times New Roman (serif) — for DraftPro/editor content
- **Monospace:** For code blocks and data tables
- **Heading Scale:** 10px → 12px → 14px → 16px → 20px → 24px → 32px
- **Body Text:** 14px (text-sm) for most UI, 13px (text-xs) for secondary/metadata
- **Line Height:** 1.5 for body text, 1.25 for headings

---

## 6. Component Patterns

### Buttons
- Primary: `bg-primary-600 text-white rounded-md px-4 py-2 text-sm font-bold hover:bg-primary-700 transition-colors shadow-sm`
- Secondary: `bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-md px-4 py-2 text-sm font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors`
- Danger: `bg-red-600 text-white rounded-md px-4 py-2 text-sm font-bold hover:bg-red-700 transition-colors shadow-sm`

### Input Fields
- `rounded-md border border-slate-200 dark:border-zinc-700 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all`

### Cards
- `bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-slate-100 dark:border-zinc-700 p-4`

### Modals
- Container: `bg-white dark:bg-zinc-800 rounded-2xl shadow-xl`
- Header: `px-6 py-4 border-b border-slate-100 dark:border-zinc-700`
- Body: `px-6 py-4`
- Footer: `px-6 py-4 border-t border-slate-100 dark:border-zinc-700 flex justify-end gap-2`
