# PracticePro Brand UI & Style Guide

This style guide defines the visual identity, spacing scales, and layout rules for PracticePro, Vega, Atrium, and Komplete to maintain UI consistency across all modules.

---

## 1. Brand & Semantic Color System

### Primary Corporate Palette
- **Dark Moss Green:** `#4A694C` (RGB 74, 105, 76) — Used for main brand accents, headers, and primary actions.
- **Backgrounds:** Clean White (`#FFFFFF`) or Off-white (`#F9FAFB`).
- **Text & Accents:** True Black (`#000000`) and Deep Slate/Charcoal (`#1F2937`).

### ALOA / ARIA Semantic State Colors
To prevent brand confusion with Dark Moss Green, use these desaturated, soft semantic background and text pairings for warning and alert states:
- 🔴 **High Priority / Alerts:** Background `#FCE8E6`, Text `#C5221F`
- 🟢 **Standard Reviews / Status:** Background `#E6F4EA`, Text `#137333` (Distinguished from brand Moss Green)
- 🔵 **Informational / Research:** Background `#E8F0FE`, Text `#1A73E8`

---

## 2. Border-Radius Scale (Strictly Enforced)

All components must strictly adhere to this 3-tier scale to prevent visual drift:
- `rounded-md` (8px): Form inputs, action buttons, small utility chips.
- `rounded-lg` (12px): Information cards, list items, navigation dropdowns, popovers.
- `rounded-2xl` (16px): Dashboard widgets, modal containers, hero blocks, layout wrappers.

**Note:** `rounded-xl` (14px) is deprecated — migrate existing uses to `rounded-lg` or `rounded-2xl` based on context.

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
- `shadow-sm`: Default flat card elevation.
- `shadow-md`: Interactive hover states.
- `shadow-xl`: Layered modal overlays and floating drop-downs.

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
