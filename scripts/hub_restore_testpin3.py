#!/usr/bin/env python3
"""Phase C test repins: the new hero (C2/C3), the relatable scene contracts
(C1/C5), the C4 outcome titles, and MorphScene's retirement."""
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
P = os.path.join(REPO, 'tests', 'unit', 'websiteRepositioning.test.ts')
src = open(P, encoding='utf-8').read()

def sub(old, new, label):
    global src
    assert old in src, f"NOT FOUND: {label or old[:60]!r}"
    src = src.replace(old, new, 1)
    print(f"patched: {label}")

# 1. Read list: MorphScene is deleted with Phase C (hero uses HubScene).
sub("""const hubScenes = read("src", "sites", "hub", "scenes", "MorphScene.tsx") + "\\n" +
  read("src", "sites", "hub", "scenes", "SystemCoreScene.tsx");""",
    """const hubScenes = read("src", "sites", "hub", "scenes", "SystemCoreScene.tsx") + "\\n" +
  read("src", "sites", "hub", "scenes", "HubScene.tsx");""",
    'scene read list')

# 2. Hero pins: the Phase C copy + scene contracts.
sub("""    // hub-restore (Phase B): the W18-era hero is back — the living lattice
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
    """    // Phase C: plain language, relatable at a glance. The abstract lattice
    // is retired; the hero now tells one order's story in the scene.
    expect(hub).toContain("Your orders, payments and customers, finally in one place.");
    expect(hub).toContain("We design, build &amp; run business software");
    expect(hub).toContain("Vega for law firms, Atrium for property managers, and custom systems for businesses like yours");
    // The hero CTAs.
    expect(hub).toContain("Talk to us");
    expect(hub).toContain("See what we&apos;ve built");
    // The relatable scene replaces the abstract polyhedron in the hero.
    expect(hub).toContain("HubScene");
    expect(hub).not.toContain("ScalingNoun");
    expect(hub).not.toContain("SCALE_NOUNS");
    // The system core (What we do) keeps its scene; MorphScene is retired.
    expect(hub).toContain("SystemCoreScene");
    expect(hub).not.toContain("MorphScene");""",
    'phase C hero pins')

# 3. Add a Phase C scene-contract test after the W17 green block. Anchor on
#    the auth-lives-with-products test (stable neighbour).
sub("""  it("auth lives with the products, not on the company page", () => {""",
    """  it("Phase C — the hero scene is one order, start to finish (C1/C5)", () => {
    // The four stages and their captions.
    expect(hub).toContain("Order arrives");
    expect(hub).toContain("Nobody loses it");
    expect(hub).toContain("Money recorded");
    expect(hub).toContain("Receipt sent");
    // Built from primitives; the naira mark is drawn as strokes, no font.
    expect(hub).toContain("the naira mark is drawn as strokes");
    // Performance + safety contract.
    expect(hub).toContain("Math.min(window.devicePixelRatio || 1, 1.5)");
    expect(hub).toContain("prefers-reduced-motion");
    expect(hub).toContain("HubScenePoster");
    expect(hub).toContain("renderer.dispose()");
    // Layout: text left, scene right — the scene never sits behind text
    // (grid columns, not an absolute overlay), and its box reserves height.
    expect(hubHeroSection).toContain("lg:grid-cols-[1.05fr_0.95fr]");
    expect(hubHeroSection).toContain("aspect-[4/3]");
  });

  it("Phase C — What we build speaks in outcomes, not technology (C4)", () => {
    expect(hub).toContain("Software shaped around how your business already runs");
    expect(hub).toContain("Your tools, wired into one workflow");
    expect(hub).toContain("Customers who help themselves, any hour, any phone");
    expect(hub).toContain("Money recorded the moment it lands");
    expect(hub).toContain("The repetitive work, done for you");
    expect(hub).toContain("Nothing slips, the right person is alerted on time");
    expect(hub).toContain("Your system stays up and your data stays yours");
    // Honest facts stay checkable against the repo.
    expect(hub).toContain("Paystack and bank transfer flows already in production");
    expect(hub).toContain("NDPA 2023-aligned data handling");
  });

  it("auth lives with the products, not on the company page", () => {""",
    'phase C scene tests')

# 4. The services pins: C4 titles replace the era titles.
sub("""    // hub-restore: the W18 bento card grid + iso shapes are back. Phase C
    // (C4) moves the card titles to customer outcomes and repins here.
    expect(hub).toContain("WHAT_WE_DO");""",
    """    // hub-restore: the W18 bento card grid + iso shapes are back; C4 moved
    // the card titles to customer outcomes (see the Phase C test above).
    expect(hub).toContain("WHAT_WE_DO");""",
    'services comment')

open(P, 'w', encoding='utf-8').write(src)
print('OK')
