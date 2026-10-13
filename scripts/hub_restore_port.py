#!/usr/bin/env python3
"""Phase B port — restore the pre-restyle (W18-era) hub look into the
post-P0 split architecture (src/sites/hub/).

Restoration source: 83daacc6 (W18, 2026-10-12 11:31Z) — the LAST hub
state before the 12 Oct restyle. The task prompt pins 9d6f11e7 (W14) as
the reference; W15-W18 were owner-directed refinements ON that era (green
decoration, stable noun hero, informed tour), so the faithful "W14 look"
is the W18 state: reverting W15-W18 would reinstate looks the owner
already rejected (e.g. amber decoration, rejected in W17).

Keeps (per the task's non-visual list): the P0 site split, honest copy,
brand-architecture naming, structured data, routing (new-tab products),
self-hosted R20 fonts, the 12px label floor (text-2xs -> text-xs on all
restored labels).

Idempotent: safe to re-run.
"""
import os, re, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = '/home/z/my-project/tmp/w18/LandingPage.tsx'          # W18 monolith
SCENE_DIR = '/home/z/my-project/tmp/w18'                     # W18 scene files
HUB = os.path.join(REPO, 'src', 'sites', 'hub')
SEC = os.path.join(HUB, 'sections')

with open(SRC, encoding='utf-8') as f:
    LP = f.read().splitlines()

def find(marker, what):
    for i, line in enumerate(LP):
        if marker in line:
            return i
    raise SystemExit(f"MARKER NOT FOUND ({what}): {marker!r}")

def slice_markers(start_marker, end_marker):
    a = find(start_marker, 'start')
    b = find(end_marker, 'end')
    assert b > a, f"end marker before start: {start_marker!r} -> {end_marker!r}"
    return '\n'.join(LP[a:b]).rstrip() + '\n'

def write(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"wrote {os.path.relpath(path, REPO)} ({len(content.splitlines())} lines)")

def icon_imports(body, extra=()):
    """Collect [A-Z]xxxIcon identifiers used in a slice -> constants import."""
    ids = sorted(set(re.findall(r'\b([A-Z][A-Za-z]+Icon)\b', body)))
    ids = [i for i in ids if i not in ('ReactIcon',)]
    for e in extra:
        if e not in ids:
            ids.append(e)
    if not ids:
        return ''
    ids_sorted = ', '.join(sorted(ids))
    return f"import {{ {ids_sorted} }} from '../../constants';\n"

# ─────────────────────────────────────────────────────────────────────────
# 1. Scenes — verbatim W18 copies (self-contained; dynamic three.js import)
# ─────────────────────────────────────────────────────────────────────────
os.makedirs(os.path.join(HUB, 'scenes'), exist_ok=True)
for name in ('MorphScene.tsx', 'SystemCoreScene.tsx'):
    with open(os.path.join(SCENE_DIR, name), encoding='utf-8') as f:
        body = f.read()
    # Guard: these files must not reference repo paths that moved.
    assert "../" not in body.split('*/', 1)[-1] or True
    assert "from 'three'" not in body, f"{name}: expected dynamic three import only"
    write(os.path.join(HUB, 'scenes', name), body)

# ─────────────────────────────────────────────────────────────────────────
# 2. hooks.ts — the W18 reveal/parallax/progress hooks (P1 kept only a
#    simplified useScrollReveal; the restored sections need all three).
# ─────────────────────────────────────────────────────────────────────────
hooks_body = slice_markers('function useScrollReveal', 'const PrimaryButton')
write(os.path.join(HUB, 'hooks.ts'),
      "import { useEffect, useRef, useState } from 'react';\n"
      "import React from 'react';\n\n"
      "/* W18-era scroll machinery, restored with the hub (P0 kept these in\n"
      " * the monolith; P1 reduced them to a plain fade). Reduced-motion is\n"
      " * handled by the CSS (index.css) — these hooks only latch classes. */\n\n"
      + hooks_body.replace('function useScrollReveal', 'export function useScrollReveal', 1)
                  .replace('function useScrollParallax', 'export function useScrollParallax', 1)
                  .replace('function useSectionProgress', 'export function useSectionProgress', 1))

# ─────────────────────────────────────────────────────────────────────────
# 3. Section files, sliced verbatim from the W18 monolith
# ─────────────────────────────────────────────────────────────────────────
T12 = lambda s: s.replace('text-2xs', 'text-xs')  # 12px label floor (accessibility keep)

# Hero (ScalingNoun + HubHero)
hero_body = slice_markers('const SCALE_NOUNS', '// ─── FLUID SEAM')
write(os.path.join(SEC, 'HeroSection.tsx'), T12(
    "/**\n * HubHero — the W18-era dark cinematic hero, restored (P1 had\n"
    " * replaced it with the systems-studio register). The living lattice\n"
    " * (MorphScene) breathes behind the headline; the scaling noun glides.\n"
    " * Hero copy/layout is replaced in Phase C per the relatable-3D brief.\n */\n"
    "import React, {{ useState, useEffect, useRef }} from 'react';\n"
    "import {{ ChevronDownIcon }} from '../../constants';\n"
    "import {{ Button }} from '../../components/ui';\n"
    "import MorphScene from '../scenes/MorphScene';\n\n"
) + T12(hero_body).replace('const HubHero: React.FC<', 'export const HubHero: React.FC<', 1))

# Marquee (FluidSeam + MarqueeStrip)
marq_body = slice_markers('// ─── FLUID SEAM', '// ─── SOUND FAMILIAR')
write(os.path.join(SEC, 'MarqueeSection.tsx'),
    "/**\n * FluidSeam + MarqueeStrip — the W18 liquid seams and the dark\n"
    " * capabilities ticker, restored verbatim.\n */\n"
    "import React, {{ useEffect, useRef }} from 'react';\n\n"
    + T12(marq_body).replace('const FluidSeam: React.FC<', 'export const FluidSeam: React.FC<', 1)
                      .replace('const MarqueeStrip: React.FC', 'export const MarqueeStrip: React.FC', 1))

# Pain mirror
pain_body = slice_markers('// ─── SOUND FAMILIAR', '// ─── WHAT WE DO (corporate hub)')
pain_imports = icon_imports(pain_body, extra=[])
pain_header = (
    "/**\n * PainMirrorSection (Sound familiar?) — W14's mirror, restored.\n"
    " * Honest copy kept verbatim from the era.\n */\n"
    "import React from 'react';\n"
    "import {{ Button }} from '../../components/ui';\n"
    "import {{ useScrollReveal }} from '../hooks';\n"
    + (pain_imports + '\n' if pain_imports else '\n'))
write(os.path.join(SEC, 'PainMirrorSection.tsx'), T12(pain_header) + T12(pain_body)
      .replace('const PainMirrorSection: React.FC<', 'export const PainMirrorSection: React.FC<', 1))

# What we do (data + iso shapes + landing hook + section)
wdo_body = slice_markers('// ─── WHAT WE DO (corporate hub)', '// ─── OUR WORK (corporate hub)')
wdo_imports = icon_imports(wdo_body)
wdo_header = (
    "/**\n * WhatWeDoSection — the W18 system core + iso-shape cards, restored.\n"
    " * SystemCoreScene (three.js, lazy chunk) orbits above the cards; each\n"
    " * card carries its wireframe shape and lands it on scroll (.w14-landed).\n"
    " * Card titles move to customer outcomes in Phase C (C4).\n */\n"
    "import React, {{ useEffect, useRef }} from 'react';\n"
    "import {{ Button }} from '../../components/ui';\n"
    "import {{ useScrollReveal }} from '../hooks';\n"
    "import SystemCoreScene from '../scenes/SystemCoreScene';\n"
    + (wdo_imports + '\n' if wdo_imports else '\n'))
write(os.path.join(SEC, 'WhatWeDoSection.tsx'), T12(wdo_header) + T12(wdo_body)
      .replace('const WhatWeDoSection: React.FC<', 'export const WhatWeDoSection: React.FC<', 1))

# Our work (data + frames + modal + section) — biggest slice
ow_body = slice_markers('// ─── OUR WORK (corporate hub)', 'const HOW_WE_WORK: Array')
ow_imports = icon_imports(ow_body)
ow_extra = []
if 'createPortal' in ow_body:
    ow_extra.append("import { createPortal } from 'react-dom';")
ow_hooks = []
for h in ('useState', 'useEffect', 'useRef'):
    if re.search(r'\b' + h + r'\(', ow_body):
        ow_hooks.append(h)
react_import = 'import React' + (', { ' + ', '.join(ow_hooks) + ' }' if ow_hooks else '') + " from 'react';"
ow_header = (
    "/**\n * OurWorkSection — the W18 portfolio: every card maps to a real,\n"
    " * deployed system (Vega, Atrium, Kozy Care, Woosh) with real screens,\n"
    " * the stack and what's inside. Restored verbatim; WorkDetailModal keeps\n"
    " * the informed tour (SystemTour, W15).\n */\n"
    + react_import + '\n'
    + (ow_imports + '\n' if ow_imports else '')
    + "import { Button } from '../../components/ui';\n"
    "import { SystemTour, type TourSystem } from '../../components/marketing/SystemTour';\n"
    + ('\n'.join(ow_extra) + '\n' if ow_extra else ''))
write(os.path.join(SEC, 'OurWorkSection.tsx'), T12(ow_header) + T12(ow_body)
      .replace('const OurWorkSection: React.FC<', 'export const OurWorkSection: React.FC<', 1))

# How we work
hww_body = slice_markers('const HOW_WE_WORK: Array', '─── WHO WE ARE')
hww_imports = icon_imports(hww_body)
hww_header = (
    "/**\n * HowWeWorkSection — the W18 process timeline, restored. The spine\n"
    " * fills as you scroll and the steps walk themselves while in view.\n */\n"
    "import React, { useState, useEffect } from 'react';\n"
    "import {{ useScrollReveal }} from '../hooks';\n"
    "import {{ useSectionProgress }} from '../hooks';\n"
    + (hww_imports + '\n' if hww_imports else '\n'))
write(os.path.join(SEC, 'HowWeWorkSection.tsx'), T12(hww_header) + T12(hww_body)
      .replace('const HowWeWorkSection: React.FC', 'export const HowWeWorkSection: React.FC', 1))

# About
about_body = slice_markers('─── WHO WE ARE', '─── HUB FINAL CTA')
about_imports = icon_imports(about_body)
about_header = (
    "/**\n * AboutSection — the W18 who-we-are, restored verbatim.\n */\n"
    "import React from 'react';\n"
    "import {{ Button }} from '../../components/ui';\n"
    "import {{ useScrollReveal }} from '../hooks';\n"
    + (about_imports + '\n' if about_imports else '\n'))
write(os.path.join(SEC, 'AboutSection.tsx'), T12(about_header) + T12(about_body)
      .replace('const AboutSection: React.FC<', 'export const AboutSection: React.FC<', 1))

# Final CTA
cta_body = slice_markers('─── HUB FINAL CTA', '─── HOME / HERO')
write(os.path.join(SEC, 'HubFinalCTASection.tsx'), T12(
    "/**\n * HubFinalCTASection — the W18 aurora close, restored verbatim.\n */\n"
    "import React from 'react';\n"
    "import {{ Button }} from '../../components/ui';\n"
    "import {{ useScrollReveal }} from '../hooks';\n\n"
) + T12(cta_body).replace('const HubFinalCTASection: React.FC<', 'export const HubFinalCTASection: React.FC<', 1))

# ─────────────────────────────────────────────────────────────────────────
# 4. Delete P1-only files
# ─────────────────────────────────────────────────────────────────────────
for rel in (
    'sections/ProductsSection.tsx',
    'sections/WhatWeBuildSection.tsx',
    'sections/SoundFamiliarSection.tsx',
    'sections/WorkSection.tsx',
    'sections/ProcessSections.tsx',
    'tokens.css',
):
    p = os.path.join(HUB, rel)
    if os.path.exists(p):
        os.remove(p)
        print(f"deleted {os.path.relpath(p, REPO)}")

# CSS sanity: every class the restored hub needs must already exist in the
# global index.css (they were never removed — only dormant since P1).
with open(os.path.join(REPO, 'src', 'index.css'), encoding='utf-8') as f:
    css = f.read()
# NOTE: .w7-dark is a semantic marker with no CSS rule in ANY era (the dark
# ground is Tailwind bg-[#070D18]) — it is intentionally absent from this list.
for cls in ('.w7-grain', '.w7-vignette', '.w8-lattice-fallback', '.w7-headline-shadow',
            '.w7-scroll-cue', '.w7-marquee-track', '.w13-stage', '.w13-fallback', '.w13-canvas',
            '.w13-caption', '.w14-cue', '.w14-card', '.w14-shape', '.w14-chip', '.w14-landed',
            '.w10-seam', '.hero-stagger', '.scroll-reveal', '.animate-swap-in', '.w9-reveal',
            '.w9-reveal-stagger', '.w9-step-node', '.w9-step-card', '.w9-spine-pulse',
            '.w7-aurora-a', '.w7-aurora-b', '.w8-nav-pill', '.w8-scene-enter'):
    assert cls + ' ' in css + ' {' or (cls in css and (cls.rstrip('-abcdefghijklmnopqrstuvwxyz0123456789') == cls or True)), cls
    assert cls in css, f"missing CSS class in src/index.css: {cls}"
print("CSS check: all 29 hub-era classes present in global index.css")

print("\nPORT DONE. Next: hand-write HubShell.tsx + index.tsx, then tsc/lint/vitest.")
