# A2 — visual vs non-visual hunks (9d6f11e7 → HEAD, hub components)

Diff base as instructed: `git diff 9d6f11e7 HEAD -- src/components/LandingPage.tsx src/components/marketing/MorphScene.tsx src/components/marketing/SystemCoreScene.tsx src/index.css`
(A1 stat: 625 insertions, 5,573 deletions across 4 files.)

Restoration note: the prompt pins 9d6f11e7 (W14) as "the last hub version before the 12 Oct restyle". Between 9d6f11e7 and the restyle (c1db6c0d, 13f22dc4) there were four owner-directed refinements — W15 (informed tour, scale positioning), W16 (stable noun headline), W17 (decoration goes brand-green — the owner rejected amber), W18 (per-span noun gradient). The faithful "W14 look" is therefore the W18 state (83daacc6): reverting W15–W18 would reinstate looks the owner already rejected. Every hunk from the 12 Oct restyle onward is reverted per the brief; W15–W18 are kept.

| # | Hunk | File:line (then → now) | Class | Keep / Revert | Done |
|---|------|------------------------|-------|---------------|------|
| 1 | Hero headline: scaling noun + green gradients (W15–W18) | LandingPage.tsx:824–1010 → sections/HeroSection.tsx | VISUAL | Keep (W15–W18, owner-directed) — then Phase C replaces copy/layout | ✅ replaced in Phase C |
| 2 | Hero 3D lattice (MorphScene) + structural CSS fallback | marketing/MorphScene.tsx (deleted by P1) → scenes/ | VISUAL | Revert in B; Phase C replaces with HubScene | ✅ HubScene live |
| 3 | Liquid seams between bands (W10 FluidSeam SVG waves) | LandingPage.tsx:1037–1099 → sections/MarqueeSection.tsx | VISUAL | Revert | ✅ |
| 4 | Capabilities marquee (W7 ticker) | LandingPage.tsx:1100–1132 → sections/MarqueeSection.tsx | VISUAL | Revert | ✅ |
| 5 | Pain mirror "Sound familiar?" (W14) | LandingPage.tsx:1134–1247 → sections/PainMirrorSection.tsx | VISUAL (copy kept — the honest-marketing era) | Revert | ✅ |
| 6 | System core 3D + descent + iso card shapes (W13/W14) | marketing/SystemCoreScene.tsx (deleted by P1) + LandingPage.tsx:1243–1484 → sections/WhatWeDoSection.tsx | VISUAL | Revert | ✅ |
| 7 | Portfolio band with real screens (W7; OUR_WORK data) | LandingPage.tsx:1499–2078 → sections/OurWorkSection.tsx | VISUAL + honest copy | Revert; keep R21 routing (external:true new-tab CTAs) | ✅ |
| 8 | Process timeline that walks itself (W9) | LandingPage.tsx:2079–2199 → sections/HowWeWorkSection.tsx | VISUAL | Revert | ✅ |
| 9 | About band (Lagos honesty) | LandingPage.tsx:2201–2293 → sections/AboutSection.tsx | VISUAL | Revert | ✅ |
| 10 | Aurora final CTA (W7 dark close) | LandingPage.tsx:2295–2344 → sections/HubFinalCTASection.tsx | VISUAL | Revert | ✅ |
| 11 | Hub nav/footer variants (glass nav, fluid pill, dark colophon) + WhatsApp FAB | LandingPage.tsx:192–710, 3890–3917 → HubShell.tsx | VISUAL | Revert | ✅ |
| 12 | Hub CSS (w7/w8/w9/w13/w14/w10-seam, hero-stagger, reveals) | index.css:1738–2800 | VISUAL | Never removed (dormant since P1) — no change needed | ✅ verified present |
| 13 | 12 Oct restyle: mono kickers, 6px CTA radius, neutral elevation (R20 Ph2/4a) | throughout | VISUAL | Reverted with the era look; 12px label floor KEPT (text-2xs→text-xs) | ✅ |
| 14 | P1 systems-studio hub redesign (paper/ink/Archivo, no 3D) | src/sites/hub/* (P1) | VISUAL | Revert (the main undo) | ✅ |
| 15 | Product-page split (Pass A/B: page-specific sections) | LandingPage.tsx 4243→33-line router; src/sites/{vega,atrium} | NON-VISUAL (architecture) | KEEP (out of hub scope) | ✅ untouched |
| 16 | Honest-marketing copy fixes (pain-first, honest claims) | hero desc, PAIN_MIRROR, About, WHAT_WE_DO bodies | NON-VISUAL | KEEP | ✅ (bodies verbatim; titles → outcomes in C4 per the brief) |
| 17 | Brand-architecture naming ("PracticePro Systems", Vega/Atrium as products) | throughout | NON-VISUAL | KEEP | ✅ |
| 18 | Structured data (index.html JSON-LD) | index.html | NON-VISUAL | KEEP | ✅ untouched |
| 19 | Routing (legal/resources pages; products open in new tabs — R21) | HubShell dropdown/footer, work cards external:true | NON-VISUAL | KEEP | ✅ |
| 20 | Tests | tests/unit/websiteRepositioning.test.ts | NON-VISUAL | KEEP files; repin hub contracts | ✅ 79/79 |
| 21 | Self-hosted fonts (Figtree/Space Grotesk/Plex Mono, R20 Ph2) + 12px label floor | package/index.css | NON-VISUAL (accessibility/fonts keep) | KEEP | ✅ |
| 22 | R23 product marks in the Products dropdown | HubShell.tsx | identity keep | KEEP | ✅ |
| 23 | Phase C: hero copy/layout/scene (C2/C3) + C4 outcome titles + C5 perf guards | HeroSection.tsx, HubScene.tsx, WhatWeDoSection.tsx | NEW (per the brief) | — | ✅ |

**Acceptance 2 check** (`grep -rn "src/components/marketing/vega\|src/components/marketing/atrium\|theme-vega\|theme-atrium"` on the branch diff): see the final reply — returns nothing.

**DEFERRED** (per the brief): OG image, the Komplete page, Vega and Atrium page changes, Android and in-app visuals.
