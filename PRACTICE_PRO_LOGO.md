# PracticePro Logo — Usage Guide

## The mark

The PracticePro logo is the **Top Block P**: a solid rounded rectangle with a geometric, slab-serif-style letter **P** cut out of it — the letter's bowl and stem share the block's edges, so the mark reads as one object, a "block you build practice on."

- **Block fill:** brand moss green `#16A34A` (light contexts) — see `COLOR_SCHEME.md`
- **Cut-out:** transparent (shows the surface behind)
- **Inner detail:** the P's counter (the hole in the bowl) is a smaller green rectangle matching the block fill

**Files:**
| File | Use |
|------|-----|
| `public/logo.svg` | Default full-color mark (web, docs, email) |
| `public/logo-black-with-text.svg` | Monochrome variant with wordmark (print, invoices, letterhead) |
| `public/logo.png` | Raster fallback (favicons/social previews) |
| `index.html` favicon | Inline SVG "Top Block P" (no network fetch — instant render) |

The in-app sidebar/header/launcher use the same SVG mark with currentColor theming, so it adapts to light/dark automatically.

## Wordmark

Set in **Space Grotesk** (the brand display face — `font-display`): "PracticePro" as a single word, CamelCase, no space. Product names Vega / Atrium / Komplete are set in the same face when paired with the mark.

## Rules

1. **Clear space:** keep at least the block's height as padding on all sides.
2. **Minimum size:** 24×24 px digital, 8 mm print. Below that, use the favicon-style block-only version (drop the wordmark).
3. **Color:** default green block; on green backgrounds use the monochrome variant (white block or ink `#0B1220`). Never re-color the block to non-brand hues.
4. **Don'ts:** no stretching/skewing; no drop shadows; no gradients on the block; no re-lettering the P; no placing the mark on busy photography without a scrim — use the duotone treatment instead.
5. **Product pairing:** when Vega or Atrium appears beside the parent mark, the product name sits right-aligned with the accent color of that product (amber `#D97706` Vega / emerald `#059669` Atrium), PracticePro mark at left in green.

## In code

Reuse — do not recreate:
- Web: reference `public/logo.svg` or the themed component instances in `src/components/` (Sidebar / Header / launch surfaces)
- Favicon: the inline SVG in `index.html` (self-contained)
- Print/letterhead (invoices, notices): `logo-black-with-text.svg`

For AI-assistant identity marks (ALOA/ARIA) see `ALOA_LOGO.md`.
