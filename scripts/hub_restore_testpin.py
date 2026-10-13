#!/usr/bin/env python3
"""Repin tests/unit/websiteRepositioning.test.ts to the RESTORED (W18-era)
hub. Phase-B state: the hero is the W18 scaling-noun hero; Phase C will
swap the hero copy + card titles and repin again (separate diff)."""
import os, re

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
P = os.path.join(REPO, 'tests', 'unit', 'websiteRepositioning.test.ts')
src = open(P, encoding='utf-8').read()

def sub(old, new, count=1, label=''):
    global src
    assert old in src, f"NOT FOUND: {label or old[:60]!r}"
    src = src.replace(old, new, count)
    print(f"patched: {label or old[:50]!r}")

# 1. Hub read list -> restored files.
sub(
"""const hubHeroSection = read("src", "sites", "hub", "sections", "HeroSection.tsx");
const hubProducts = read("src", "sites", "hub", "sections", "ProductsSection.tsx");
const hubWhatWeBuild = read("src", "sites", "hub", "sections", "WhatWeBuildSection.tsx");
const hubWork = read("src", "sites", "hub", "sections", "WorkSection.tsx");
const hubSoundFamiliar = read("src", "sites", "hub", "sections", "SoundFamiliarSection.tsx");
const hubProcess = read("src", "sites", "hub", "sections", "ProcessSections.tsx");
const hubShell = read("src", "sites", "hub", "HubShell.tsx");
const hubIndex = read("src", "sites", "hub", "index.tsx");
const hub = [hubShell, hubIndex, hubHeroSection, hubProducts, hubWhatWeBuild,
  hubWork, hubSoundFamiliar, hubProcess].join("\\n");""",
"""const hubHeroSection = read("src", "sites", "hub", "sections", "HeroSection.tsx");
const hubMarquee = read("src", "sites", "hub", "sections", "MarqueeSection.tsx");
const hubPainMirror = read("src", "sites", "hub", "sections", "PainMirrorSection.tsx");
const hubWhatWeDo = read("src", "sites", "hub", "sections", "WhatWeDoSection.tsx");
const hubWork = read("src", "sites", "hub", "sections", "OurWorkSection.tsx");
const hubHowWeWork = read("src", "sites", "hub", "sections", "HowWeWorkSection.tsx");
const hubAbout = read("src", "sites", "hub", "sections", "AboutSection.tsx");
const hubFinalCTA = read("src", "sites", "hub", "sections", "HubFinalCTASection.tsx");
const hubShell = read("src", "sites", "hub", "HubShell.tsx");
const hubIndex = read("src", "sites", "hub", "index.tsx");
const hubHooks = read("src", "sites", "hub", "hooks.ts");
const hubScenes = read("src", "sites", "hub", "scenes", "MorphScene.tsx") + "\\n" +
  read("src", "sites", "hub", "scenes", "SystemCoreScene.tsx");
const hub = [hubShell, hubIndex, hubHooks, hubScenes, hubHeroSection, hubMarquee,
  hubPainMirror, hubWhatWeDo, hubWork, hubHowWeWork, hubAbout, hubFinalCTA].join("\\n");""",
label='hub read list')

# 2. Hero pins -> the restored W18 hero (Phase B; Phase C swaps these).
sub(
"""    // P1 (owner direction): the scaling-noun promise is retired. The hero
    // opens with the company's plain promise, exact copy.
    expect(hub).toContain("We build the systems your business runs on.");
    expect(hub).toContain("PracticePro Systems designs, builds and runs business software from Lagos.");
    expect(hub).toContain("Two products of our own, Vega for law firms and Atrium for property");
    expect(hub).toContain("plus custom systems for clients.");
    expect(hub).not.toContain("SCALE_NOUNS");
    expect(hub).not.toContain("ScalingNoun");
    // The hero CTAs: one primary (moss) + one text link (P1 C1).
    expect(hub).toContain("Talk to us");
    expect(hub).toContain("See our work");
    // The static system diagram — four labelled nodes, no WebGL.
    expect(hub).toContain("WhatsApp order");
    expect(hub).toContain("One queue");
    expect(hub).toContain("Ledger");
    expect(hub).toContain("Receipt");
    expect(hub).not.toContain("MorphScene");
    expect(hub).not.toContain("SystemCoreScene");""",
"""    // hub-restore (Phase B): the W18-era hero is back — the living lattice
    // (MorphScene) behind the scaling-noun headline. Phase C replaces the
    // hero copy/layout/scene (relatable-3D brief) and repins here.
    expect(hub).toContain("SCALE_NOUNS");
    expect(hub).toContain("ScalingNoun");
    expect(hub).toContain("Build systems that help");
    expect(hub).toContain("We design, build &amp; run business software");
    expect(hub).toContain("from the orders that arrive on WhatsApp to the receipts that leave with every job");
    // The hero CTAs (W18 exact).
    expect(hub).toContain("Talk to us about your system");
    expect(hub).toContain("See what we&apos;ve built");
    // The 3D scenes are restored (hero lattice + the system core).
    expect(hub).toContain("MorphScene");
    expect(hub).toContain("SystemCoreScene");""",
label='hero pins')

# 3. The no-WebGL comment block + green-era pins (keep the amber ban; the
#    restored hub is the W17+ green era).
sub(
"""    // P1: the 3D scenes (MorphScene, SystemCoreScene) are deleted with
    // their colour contracts — the hub has no WebGL at all.
    // The hero's structural fallback cloud is mint too.""",
"""    // hub-restore: the scenes are back; their colour contracts are the
    // W17+ green era (mint ignition, emerald fresnel) — never amber.
    // The hero's structural fallback cloud is mint too.""",
label='webgl comment')

# 4. Broad positioning pin -> W18 exact phrasing.
sub('    expect(hub).toContain("PracticePro Systems designs, builds and runs");',
    '    expect(hub).toContain("PracticePro Systems designs, builds and runs");',
    label='positioning (holds)')

# 5. Services pins: WHAT_WE_BUILD -> the restored WHAT_WE_DO (same honest
#    card copy, verbatim from the era).
sub(
"""    // P1 C3: the card grid is now a ruled index table; the seven
    // capabilities and their copy survive.
    expect(hub).toContain("WHAT_WE_BUILD");""",
"""    // hub-restore: the W18 bento card grid + iso shapes are back. Phase C
    // (C4) moves the card titles to customer outcomes and repins here.
    expect(hub).toContain("WHAT_WE_DO");""", label='services pin')

open(P, 'w', encoding='utf-8').write(src)
print('OK')
