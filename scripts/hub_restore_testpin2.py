#!/usr/bin/env python3
"""hub-restore Phase B: flip the P1 'RETIRED' test blocks back to the
restored W18 contracts + apply the R21 routing keep to the work cards."""
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

def patch(path, pairs):
    src = open(path, encoding='utf-8').read()
    for old, new, label in pairs:
        assert old in src, f"NOT FOUND in {path}: {label or old[:60]!r}"
        src = src.replace(old, new, 1)
        print(f"patched {os.path.basename(path)}: {label}")
    open(path, 'w', encoding='utf-8').write(src)

# ── 1. OurWorkSection: R21 routing keep — /vega + /atrium cards open in
#        new tabs (W18 data predates R21; this is a non-visual keep).
patch(os.path.join(REPO, 'src/sites/hub/sections/OurWorkSection.tsx'), [
    ("cta: { label: 'Explore Vega', href: '/vega', external: false },",
     "cta: { label: 'Explore Vega', href: '/vega', external: true },",
     'Explore Vega external:true (R21 keep)'),
    ("cta: { label: 'Explore Atrium', href: '/atrium', external: false },",
     "cta: { label: 'Explore Atrium', href: '/atrium', external: true },",
     'Explore Atrium external:true (R21 keep)'),
])

# ── 2. websiteRepositioning.test.ts — flip the P1 retirement pins.
T = os.path.join(REPO, 'tests', 'unit', 'websiteRepositioning.test.ts')
patch(T, [
    # hero structural fallback — restored
    ("""    // RETIRED (P1): MorphScene is deleted; the hero is a static system
    // diagram. The pins now assert the retirement holds.
    expect(hub).not.toContain("MorphScene");
    expect(hub).not.toContain("w8-lattice-fallback");""",
     """    // hub-restore: MorphScene is back behind the headline with its
    // structural CSS fallback (the fallback paints even before WebGL).
    expect(hub).toContain("MorphScene");
    expect(hub).toContain("w8-lattice-fallback");""",
     'hero fallback pin'),
    # W8 lattice
    ("""  it("RETIRED (P1) — the hero shows structure that morphs — a system lattice, not a blob", () => {
    expect(hub).not.toContain("w8-lattice");
  });""",
     """  it("the hero shows structure that morphs — a system lattice, not a blob (W8, restored)", () => {
    expect(hub).toContain("w8-lattice");
  });""",
     'w8 lattice'),
    # W10 seams
    ("""  it("RETIRED (P1) — sections pour into each other through visible SVG waves that morph as you scroll (W10)", () => {
    expect(hub).not.toContain("FluidSeam");
  });""",
     """  it("sections pour into each other through visible SVG waves that morph as you scroll (W10, restored)", () => {
    expect(hub).toContain("FluidSeam");
    expect(hubIndex).toContain('<FluidSeam from="#0A101C" to="#FFFFFF" phase={0}');
    expect(hubIndex).toContain('<FluidSeam from="#FBFBF9" to="#0A101C" phase={3}');
  });""",
     'w10 seams'),
    # W8 nav pill
    ("""  it("RETIRED (P1) — the nav carries a fluid pill that morphs between sections", () => {
    expect(hub).not.toContain("w8-nav-pill");
  });""",
     """  it("the nav carries a fluid pill that morphs between sections (W8, restored)", () => {
    expect(hub).toContain("w8-nav-pill");
  });""",
     'nav pill'),
    # W13 system core
    ("""  it("RETIRED (P1) — the What-we-do visual is a real 3D system core (W13)", () => {
    expect(hub).not.toContain("SystemCoreScene");
  });""",
     """  it("the What-we-do visual is a real 3D system core (W13, restored)", () => {
    expect(hub).toContain("SystemCoreScene");
    expect(hub).toContain("w13-canvas");
  });""",
     'system core'),
    # W13 icon chip
    ("""  it("RETIRED (P1) — each capability card carries a quiet, always-on icon chip (W13)", () => {
    expect(hub).not.toContain("w14-chip");
  });""",
     """  it("each capability card carries a quiet, always-on icon chip (W13, restored)", () => {
    expect(hub).toContain("w14-chip");
  });""",
     'icon chip'),
    # W13 inside canvas
    ("""  it("RETIRED (P1) — everything renders INSIDE the canvas (W13)", () => {
    expect(hub).not.toContain("w13-");
  });""",
     """  it("everything renders INSIDE the canvas (W13, restored)", () => {
    expect(hub).toContain("w13-stage");
    expect(hub).toContain("w13-fallback");
    expect(hub).toContain("w13-caption");
  });""",
     'inside canvas'),
    # engine contract
    ("""  it("RETIRED (P1) — the scene runs on the hero's engine contract", () => {
    expect(hub).not.toContain("w13-canvas");
  });""",
     """  it("the scene runs on the hero's engine contract (restored)", () => {
    // Same lazy-chunk + pause-offscreen contract as the hero scene.
    expect(hubScenes).toContain("SystemCoreScene");
    expect(hubScenes).toContain("MorphScene");
  });""",
     'engine contract'),
    # w9 reveal machinery
    ("""  it("RETIRED (P1) — text settles in softly across the hub (w9 reveal machinery)", () => {
    // The hub reveal is now a plain 200ms opacity fade (hub-reveal).
    expect(hub).not.toContain("w9-reveal");
    expect(hub).not.toContain("w9-step-node");
  });""",
     """  it("text settles in softly across the hub (w9 reveal machinery, restored)", () => {
    expect(hub).toContain("w9-reveal");
    expect(hub).toContain("w9-reveal-stagger");
    expect(hub).toContain("w9-step-node");
  });""",
     'w9 reveal'),
    # hero sells the problem (P1 references to hubSoundFamiliar)
    ("""    // P1: the description is the owner's exact 30-word positioning; the
    // pain lives in 04 — SOUND FAMILIAR with the PAIN_MIRROR copy.
    expect(hubSoundFamiliar).toContain("PAIN_MIRROR");
    expect(hubSoundFamiliar).toContain("Orders and requests arrive by WhatsApp, SMS and walk-in");""",
     """    // hub-restore: the W18 pain-first hero description is back; the
    // pain mirror itself is the Sound familiar? section (PAIN_MIRROR copy).
    expect(hub).toContain("When spreadsheets, chat threads and memory can no longer keep up");
    expect(hubPainMirror).toContain("PAIN_MIRROR");
    expect(hubPainMirror).toContain("Orders and requests arrive by WhatsApp, SMS and walk-in");""",
     'hero problem'),
    # mirror before the pitch — P1's numbered band -> W18 strings
    ("""    expect(hub).toContain("PAIN_MIRROR");
    expect(hub).toContain("04 — SOUND FAMILIAR");
    expect(hub).toContain("just not software");
    expect(hub).toContain("You need a system");
    expect(hub).toContain("Tell us what runs your business today");
    expect(hubIndex).toContain('<SoundFamiliarSection onContactSales');""",
     """    expect(hub).toContain("PAIN_MIRROR");
    expect(hub).toContain("Sound familiar?");
    expect(hub).toContain("just not software");
    expect(hub).toContain("You need a system");
    expect(hub).toContain("Tell us what runs your business today");
    expect(hubIndex).toContain('<PainMirrorSection onContactSales');""",
     'mirror section'),
    # RETIRED W14 descent/shapes block
    ("""  it("RETIRED (P1) — MorphScene, SystemCoreScene, the descent and the Iso shapes", () => {
    // All deleted by owner direction (P1): no WebGL on the hub, no shape
    // watermarks, no scroll-linked descent.
    expect(hub).not.toContain("useLandingCards");
    expect(hub).not.toContain("w14-card");
    expect(hub).not.toContain("CARD_SHAPES");
    expect(hub).not.toContain("Iso");
  });""",
     """  it("the descent: shapes land in their cards, the Iso watermarks return (W14, restored)", () => {
    // The scroll-linked descent is back: useLandingCards lands each card's
    // wireframe shape; CARD_SHAPES are the iso watermarks.
    expect(hub).toContain("useLandingCards");
    expect(hub).toContain("w14-card");
    expect(hub).toContain("CARD_SHAPES");
    expect(hub).toContain("Iso");
  });""",
     'descent/shapes'),
    # footer Built-by — W18 wording
    ("""    // P1 B2: the footer's exact attribution line.
    expect(hub).toContain("Vega and Atrium are built by PracticePro Systems Limited.");""",
     """    // hub-restore: the W18 footer attribution line (bottom bar).
    expect(hub).toContain("Vega & Atrium · Built by PracticePro");""",
     'footer attribution'),
])
print('OK')
