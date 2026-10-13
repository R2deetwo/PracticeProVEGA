#!/usr/bin/env python3
"""P1 — update websiteRepositioning.test.ts for the hub redesign.

Every edit is either (a) a block DELETION for machinery the owner's P1
spec removed (MorphScene, SystemCoreScene, FluidSeam, MarqueeStrip,
ScalingNoun, Iso shapes, w9/w14 machinery), or (b) a pin RETARGET to the
replacement copy. Each replacement asserts its expected count.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
T = ROOT / "tests/unit/websiteRepositioning.test.ts"
src = T.read_text()


def rep(old, new, count=1):
    global src
    n = src.count(old)
    assert n == count, f"expected {count} of {old[:70]!r}, found {n}"
    src = src.replace(old, new)


# ── 1. const reads: HubSections.tsx is gone; MorphScene/SystemCoreScene deleted ──
rep(
    'const hubSections = read("src", "sites", "hub", "sections", "HubSections.tsx");',
    '// P1: HubSections.tsx was replaced by per-section files.\n'
    'const hubHeroSection = read("src", "sites", "hub", "sections", "HeroSection.tsx");\n'
    'const hubProducts = read("src", "sites", "hub", "sections", "ProductsSection.tsx");\n'
    'const hubWhatWeBuild = read("src", "sites", "hub", "sections", "WhatWeBuildSection.tsx");\n'
    'const hubWork = read("src", "sites", "hub", "sections", "WorkSection.tsx");\n'
    'const hubSoundFamiliar = read("src", "sites", "hub", "sections", "SoundFamiliarSection.tsx");\n'
    'const hubProcess = read("src", "sites", "hub", "sections", "ProcessSections.tsx");'
)
rep(
    'const hub = hubSections + "\\n" + hubShell + "\\n" + hubIndex;',
    'const hub = [hubShell, hubIndex, hubHeroSection, hubProducts, hubWhatWeBuild,\n'
    '  hubWork, hubSoundFamiliar, hubProcess].join("\\n");'
)
rep('const scene = read("src", "components", "marketing", "MorphScene.tsx");\n', '')
rep('const coreScene = read("src", "components", "marketing", "SystemCoreScene.tsx");\n', '')

# ── 2. hero block: the ScalingNoun promise is retired; exact P1 copy pins ──
rep('''  it("the hero sells what the company does, value-first", () => {
    expect(hub).toContain("Build systems that help");''',
    '''  it("the hero sells what the company does, value-first", () => {
    // P1 (owner direction): the scaling-noun promise is retired. The hero
    // opens with the company's plain promise, exact copy.
    expect(hub).toContain("We build the systems your business runs on.");
    expect(hub).toContain("PracticePro Systems designs, builds and runs business software from Lagos.");
    expect(hub).toContain("Two products of our own, Vega for law firms and Atrium for property");
    expect(hub).toContain("plus custom systems for clients.");
    expect(hub).not.toContain("SCALE_NOUNS");
    expect(hub).not.toContain("ScalingNoun");''')

# the rest of the old W17 pin lines inside this block (now unreachable asserts) — delete
rep('''    // W17: the promise is “Build systems that help scale your X”. X is a
    // single noun the owner recognises, and ONLY the noun ever changes.
    // W16 padded every noun into a box as wide as “organization” — a dead
    // gap after every shorter word. W17 MEASURES each noun in the live
    // headline font and glides the slot to exactly the live word: no
    // reserve, no trailing gap, no full stop, and the line count is
    // locked (below sm the noun owns its own line; from sm up the final
    // line is sized for the widest noun).
    expect(hub).toContain("scale your");
    expect(hub).toContain("SCALE_NOUNS");
    expect(hub).not.toContain("SCALE_NOUN_RESERVE");
    expect(hub).toContain("getBoundingClientRect().width");
    expect(hub).toContain("ResizeObserver");
    expect(hub).toContain("document.fonts.ready");
    // No full stop riding the cycling word.
    expect(hub).not.toContain("{SCALE_NOUNS[i]}.");
    // The noun owns its line below sm — no noun can change the wrap.
    expect(hub).not.toContain("scale your{' '}<ScalingNoun />");
    expect(hub).toContain('<br className="sm:hidden" />');
    expect(hub).toContain("'business'");
    expect(hub).toContain("'practice'");
    expect(hub).toContain("'firm'");
    expect(hub).toContain("'clinic'");
    expect(hub).toContain("'pharmacy'");
    expect(hub).toContain("'school'");
    expect(hub).toContain("'restaurant'");
    expect(hub).toContain("'organization'");
    expect(hub).not.toContain("scale with.");
    expect(hub).not.toContain("SCALE_VERTICALS");
    expect(hub).not.toContain("businesses run on.");
  });''',
    '''    // The hero CTAs: one primary (moss) + one text link (P1 C1).
    expect(hub).toContain("Talk to us");
    expect(hub).toContain("See our work");
    // The static system diagram — four labelled nodes, no WebGL.
    expect(hub).toContain("WhatsApp order");
    expect(hub).toContain("One queue");
    expect(hub).toContain("Ledger");
    expect(hub).toContain("Receipt");
    expect(hub).not.toContain("MorphScene");
    expect(hub).not.toContain("SystemCoreScene");
  });''')

# ── 3. W17 amber block: keep the amber bans, drop the gradient ramps ──
rep('''    expect(hub).toContain("linear-gradient(to right, #6EE7B7, #34D399)");
    expect(hub).toContain("linear-gradient(to right, #34D399, #4ADE80)");
    expect(hub).not.toContain("#F59E0B");''',
    '''    // P1: the gradient headline is retired with the scaling noun; the
    // amber ban stays forever.
    expect(hub).not.toContain("#F59E0B");''')

# ── 4. W18 gradient-words block: retired ──
rep('''  it("W18 — every word of the scaling promise paints its own clipped gradient (owner: “your X is not clear or rendering properly”)", () => {
    // background-clip:text on the hero wrapper cannot paint through the
    // noun slot: the slot is an inline-block carrying transform + filter
    // (its own stacking context), and several browsers exclude such
    // descendants from the ancestor's text clip — the noun inherited
    // colour:transparent and vanished. Every text-bearing span is now
    // self-sufficient.
    expect(hub).toContain(
      'className="inline-block align-baseline text-transparent bg-clip-text pb-1"',
    );
    expect(hub).toContain(
      "backgroundImage: 'linear-gradient(to right, #34D399, #4ADE80)'",
    );
    // At rest the slot carries NO transform/filter — it must never sit
    // in its own stacking context (none still transitions to value, so
    // the exchange stays fluid).
    expect(hub).toContain("transform: on ? 'none' : 'translateY(-0.22em)'");
    expect(hub).toContain("filter: on ? 'none' : 'blur(5px)'");
    // The wrapper around the noun must never itself clip text — only
    // the word spans do.
    expect(hub).not.toContain("bg-clip-text inline sm:inline-block");
  });

''', '')

# ── 5. nav labels ──
rep('''    expect(hub).toContain("What We Do");
    expect(hub).toContain("Our Work");
    expect(hub).toContain("How We Work");
    expect(hub).toContain("About");''',
    '''    expect(hub).toContain("Products");
    expect(hub).toContain("Work");
    expect(hub).toContain("How we work");
    expect(hub).toContain("About");''')

# ── 6. services block: WHAT_WE_DO -> WHAT_WE_BUILD index table ──
rep('''  it("the services section presents builder capabilities", () => {
    expect(hub).toContain("WHAT_WE_DO");
    expect(hub).toContain("What we can build for you");
    expect(hub).toContain("Custom business systems");''',
    '''  it("the services section presents builder capabilities", () => {
    // P1 C3: the card grid is now a ruled index table; the seven
    // capabilities and their copy survive.
    expect(hub).toContain("WHAT_WE_BUILD");
    expect(hub).toContain("Custom business systems");''')

# ── 7. marquee block: retired ──
rep('''  it("the capabilities marquee carries the builder vocabulary", () => {
    expect(hub).toContain("MARQUEE_ITEMS");
    expect(hub).toContain("Custom Integrations");
    expect(hub).toContain("AI & Automation");
  });

''', '')

# ── 8. MorphScene hero block: retired ──
rep('''  it("the hero carries the morphing system with a structural CSS fallback", () => {
    expect(hub).toContain("MorphScene");
    expect(hub).toContain("w8-lattice-fallback");
    expect(hub).toContain("w8-scene-enter");
  });
''',
    '''  it("the hero carries the morphing system with a structural CSS fallback", () => {
    // RETIRED (P1): MorphScene is deleted; the hero is a static system
    // diagram. The pins now assert the retirement holds.
    expect(hub).not.toContain("MorphScene");
    expect(hub).not.toContain("w8-lattice-fallback");
  });
''')

# ── 9. lattice + fluid seam + pill blocks: retired ──
rep('''  it("the hero shows structure that morphs — a system lattice, not a blob", () => {''',
    '''  it("RETIRED (P1) — the hero shows structure that morphs — a system lattice, not a blob", () => {
    expect(hub).not.toContain("w8-lattice");
  });

  it("UNUSED_GUARD_1", () => {''')
rep('''  it("sections pour into each other through visible SVG waves that morph as you scroll (W10)", () => {''',
    '''  it("RETIRED (P1) — sections pour into each other through visible SVG waves that morph as you scroll (W10)", () => {
    expect(hub).not.toContain("FluidSeam");
  });

  it("UNUSED_GUARD_2", () => {''')
rep('''  it("the nav carries a fluid pill that morphs between sections", () => {''',
    '''  it("RETIRED (P1) — the nav carries a fluid pill that morphs between sections", () => {
    expect(hub).not.toContain("w8-nav-pill");
  });

  it("UNUSED_GUARD_3", () => {''')

# ── 10. W13 blocks: retired ──
rep('''  it("the What-we-do visual is a real 3D system core — and the mark is nowhere in it (W13)", () => {''',
    '''  it("RETIRED (P1) — the What-we-do visual is a real 3D system core (W13)", () => {
    expect(hub).not.toContain("SystemCoreScene");
  });

  it("UNUSED_GUARD_4", () => {''')
rep('''  it("each capability card carries a quiet, always-on icon chip (W13)", () => {''',
    '''  it("RETIRED (P1) — each capability card carries a quiet, always-on icon chip (W13)", () => {
    expect(hub).not.toContain("w14-chip");
  });

  it("UNUSED_GUARD_5", () => {''')
rep('''  it("everything renders INSIDE the canvas — no line may ever cross the text (W13)", () => {''',
    '''  it("RETIRED (P1) — everything renders INSIDE the canvas (W13)", () => {
    expect(hub).not.toContain("w13-");
  });

  it("UNUSED_GUARD_6", () => {''')
rep('''  it("the scene runs on the hero's engine contract — lazy, pausable, disposable", () => {''',
    '''  it("RETIRED (P1) — the scene runs on the hero's engine contract", () => {
    expect(hub).not.toContain("w13-canvas");
  });

  it("UNUSED_GUARD_7", () => {''')

# ── 11. w9 blocks: retired ──
rep('''  it("text settles in softly across the hub — never a hard cut", () => {
    expect(css).toContain(".w9-reveal");
    expect(css).toContain(".w9-reveal-stagger");
    expect(hub).toContain("w9-reveal text-center");
    expect(hub).toContain("w9-reveal-stagger grid");
  });

  it("the process walks itself — steps light up in sequence", () => {
    expect(hub).toContain("w9-step-node");
    expect(hub).toContain("w9-step-card");
    expect(hub).toContain("w9-spine-pulse");
    expect(hub).toContain("WALKS ITSELF");
    expect(css).toContain(".w9-step-node.is-active");
  });

  it("a workflow & notification capability joins the builder services", () => {
    expect(hub).toContain("Workflow & notification engines");
    expect(hub).toContain("Workflow Automation");
  });''',
    '''  it("RETIRED (P1) — text settles in softly across the hub (w9 reveal machinery)", () => {
    // The hub reveal is now a plain 200ms opacity fade (hub-reveal).
    expect(hub).not.toContain("w9-reveal");
    expect(hub).not.toContain("w9-step-node");
  });

  it("a workflow & notification capability joins the builder services", () => {
    expect(hub).toContain("Workflow & notification engines");
  });''')

# ── 12. hero-sells-the-problem pin: new sub copy ──
rep('''    // The description plants the pain instead of listing the portfolio.
    expect(hub).toContain("arrive on WhatsApp to the receipts that leave with every job");''',
    '''    // P1: the description is the owner's exact 30-word positioning; the
    // pain lives in 04 — SOUND FAMILIAR with the PAIN_MIRROR copy.
    expect(hubSoundFamiliar).toContain("PAIN_MIRROR");
    expect(hubSoundFamiliar).toContain("Orders and requests arrive by WhatsApp, SMS and walk-in");''')

# ── 13. PainMirrorSection -> SoundFamiliarSection ──
rep("""    expect(hub).toContain('<PainMirrorSection onContactSales');""",
    """    expect(hubIndex).toContain('<SoundFamiliarSection onContactSales');""")

# ── 14. MorphScene zip + descent blocks: deleted files, retire blocks ──
rep('''  it("the orb zips a point toward the pointer — wave out, echo back (MorphScene)", () => {
    expect(scene).toContain("uPulseDir");
    expect(scene).toContain("uAntiAmp");
    expect(scene).toContain("firePulse");
    // Two damped springs: the near zip and the far-side echo.
    expect(scene).toContain("SPRING_K");
    expect(scene).toContain("ANTI_K");
  });

  it("the system core morphs its shapes and they descend into the cards", () => {
    // The superellipsoid engine: one formula, every form the owner asked for.
    expect(coreScene).toContain("SUPERELLIPSOID");
    expect(coreScene).toContain("const SHAPES: ShapeDef[]");
    expect(coreScene).toContain("applyShape");
    // Cubes are no longer the only citizens — pyramids, prisms, octahedra.
    expect(coreScene).toContain("pyramid");
    expect(coreScene).toContain("prism");
    expect(coreScene).toContain("octahedron");
    // The scroll-linked descent: shapes leave the canvas toward the cards.
    expect(coreScene).toContain("descentProgress");
    // Vertical pointer authority matches the horizontal.
    expect(coreScene).toContain("curY * 0.24");
  });

  it("each capability card receives its own shape on landing", () => {
    expect(hub).toContain("useLandingCards");
    expect(hub).toContain("w14-card");
    expect(hub).toContain("w14-shape");
    expect(hub).toContain("w14-chip");
    expect(hub).toContain('id="whatWeDoGrid"');
    expect(hub).toContain("CARD_SHAPES");
    expect(css).toContain(".w14-card.w14-landed .w14-shape");
    expect(css).toContain(".w14-card.w14-landed .w14-chip::after");
    // The cue under the scene continues the descent to the cards.
    expect(hub).toContain("scrollTo('whatWeDoGrid')");
  });''',
    '''  it("RETIRED (P1) — MorphScene, SystemCoreScene, the descent and the Iso shapes", () => {
    // All deleted by owner direction (P1): no WebGL on the hub, no shape
    // watermarks, no scroll-linked descent.
    expect(hub).not.toContain("useLandingCards");
    expect(hub).not.toContain("w14-card");
    expect(hub).not.toContain("CARD_SHAPES");
    expect(hub).not.toContain("Iso");
  });''')

# ── 15. footer Built-by line: P1 exact line ──
rep('''    expect(hub).toContain("Vega &amp; Atrium · Built by PracticePro");''',
    '''    // P1 B2: the footer's exact attribution line.
    expect(hub).toContain("Vega and Atrium are built by PracticePro Systems Limited.");''')

T.write_text(src)
print("P1 test updates applied")
