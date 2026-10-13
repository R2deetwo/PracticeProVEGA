#!/usr/bin/env python3
"""P0 — retarget tests/unit/websiteRepositioning.test.ts to the sites split.

Line-scanner approach: every `expect(landing)` assertion is retargeted by
content rules; remaining ones are reported for manual review. No assertion
semantics change — only which file(s) the pin reads.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
T = ROOT / "tests/unit/websiteRepositioning.test.ts"
src = T.read_text()

# ── 1. new const reads after `landing` ────────────────────────────────────
ANCHOR = 'const landing = read("src", "components", "LandingPage.tsx");'
assert src.count(ANCHOR) == 1
src = src.replace(ANCHOR, ANCHOR + """
// P0 sites split: the three surfaces moved out of LandingPage.tsx into
// src/sites/{hub,vega,atrium}. The hub branch is now three files (the
// moved sections, the shell, the composition); `hub` is their union —
// the faithful equivalent of the old single-file hub branch.
const hubSections = read("src", "sites", "hub", "sections", "HubSections.tsx");
const hubShell = read("src", "sites", "hub", "HubShell.tsx");
const hubIndex = read("src", "sites", "hub", "index.tsx");
const hub = hubSections + "\\n" + hubShell + "\\n" + hubIndex;
const vegaSite = read("src", "sites", "vega", "index.tsx");
const vegaShell = read("src", "sites", "vega", "VegaShell.tsx");
const atriumSite = read("src", "sites", "atrium", "index.tsx");
const atriumShell = read("src", "sites", "atrium", "AtriumShell.tsx");
const productPages = vegaSite + "\\n" + vegaShell + "\\n" + atriumSite + "\\n" + atriumShell;
const sharedChrome = read("src", "sites", "shared", "useSiteChrome.ts");
const surfaces = landing + "\\n" + hub + "\\n" + productPages;""")

# ── 2. moved section file paths ───────────────────────────────────────────
src = src.replace('read("src", "components", "marketing", "vega", ',
                  'read("src", "sites", "vega", "sections", ')
src = src.replace('read("src", "components", "marketing", "atrium", ',
                  'read("src", "sites", "atrium", "sections", ')

# ── 3. targeted single-line retargets (keyword -> new receiver) ───────────
RULES = [
    # product-page chrome pins
    ('"Start Free Trial"', "productPages", "toContain"),
    ('"Log In"', "productPages", "toContain"),
    ('"auth lives with the products"', "productPages", "toContain"),
    ('"Vega — a PracticePro product, back to all products', "vegaShell", "toContain"),
    ('"onClick={onBackToHub}"', "productPages", "toContain"),
    ('"pathname !== \'/\'"', "productPages", "toContain"),
    ('"navigate(\'/\')"', "productPages", "toContain"),
    ('"BY PRACTICEPRO"', "productPages", "toContain"),
    ('"window.open(p === \'vega\'', "surfaces", "toContain"),
    ('"navigate(target)"', "surfaces", "not"),
    ('"The Chambers Standard — Built by PracticePro"', "vegaSite", "toContain"),
    ('"Atrium · Built by PracticePro"', "atriumSite", "toContain"),
    # vega composition
    ('"import { VegaIndexLine }"', "vegaSite", "toContain"),
    # atrium wiring
    ("import { AtriumHero }", "atriumSite", "import-rewrite"),
    ("import { AtriumReceipt }", "atriumSite", "import-rewrite"),
    ("import { AtriumEstate }", "atriumSite", "import-rewrite"),
    ("import { AtriumSentryPass }", "atriumSite", "import-rewrite"),
    ('"<AtriumHero />"', "atriumSite", "toContain"),
    ('"<AtriumReceipt />"', "atriumSite", "toContain"),
    ('"<AtriumEstate />"', "atriumSite", "toContain"),
    ('"<AtriumSentryPass />"', "atriumSite", "toContain"),
    ("tone=\"atrium\"", "atriumSite", "toContain"),
    ("eyebrow={'Atrium · Built by PracticePro'}", "atriumSite", "toContain"),
    ("body.classList.toggle('on-atrium-page'", "sharedChrome", "body-class-rewrite"),
    ('"const HomeSection"', "surfaces", "not"),
    ('"atrium-hero-1.jpg"', "surfaces", "not"),
    # pricing retirement (NOT pins across all surfaces)
    ('"VegaPricingLedger"', "surfaces", "not"),
    ('"AtriumPricing"', "surfaces", "not"),
    ('"getDisplayTiersForProduct"', "surfaces", "not"),
    ("scrollTo(\\'pricing\\')", "surfaces", "not"),
    ('"id=\\"pricing\\""', "surfaces", "not"),
    ('"run on PracticePro"', "surfaces", "not"),
]

lines = src.split("\n")
out = []
manual = []
for line in lines:
    if "expect(landing)" not in line:
        out.append(line)
        continue
    matched = False
    for kw, target, mode in RULES:
        if kw not in line:
            continue
        if mode == "import-rewrite":
            # rewrite the whole assertion to the new import path
            name = kw[len("import { "):-2]
            line = line.replace(
                f"expect(landing).toContain(\"{kw} from './marketing/atrium/{name}'\");",
                f"expect({target}).toContain(\"{kw} from './sections/{name}'\");")
        elif mode == "body-class-rewrite":
            line = line.replace(
                "expect(landing).toContain(\"body.classList.toggle('on-atrium-page', onAtrium)\");",
                "// P0: the body-class machinery moved to shared/useSiteChrome.ts, parametrised\n"
                "    // by the site's product instead of the old onAtrium boolean.\n"
                "    expect(sharedChrome).toContain(\"body.classList.toggle('on-atrium-page', product === 'atrium')\");")
        elif mode == "not":
            line = line.replace("expect(landing).not.toContain",
                                f"expect({target}).not.toContain")
        else:
            line = line.replace("expect(landing).toContain",
                                f"expect({target}).toContain")
        matched = True
        break
    if not matched:
        # default: hub-surface pin (the pre-split hub branch content)
        line = line.replace("expect(landing).toContain", "expect(hub).toContain")
        line = line.replace("expect(landing).not.toContain", "expect(hub).not.toContain")
    out.append(line)
src = "\n".join(out)

# tier-name loop
src = src.replace(
    '''    for (const tier of ["Most Popular", "Start Growth", "Start Pro Trial", "Save 20%"]) {
      expect(landing).not.toContain(tier);''',
    '''    for (const tier of ["Most Popular", "Start Growth", "Start Pro Trial", "Save 20%"]) {
      expect(surfaces).not.toContain(tier);''')

# ── 4. vega branch extraction ─────────────────────────────────────────────
old_branch = """    // Extract the vega branch of the product-page render.
    const branch = landing.match(
      /\\{activeProduct === 'vega' \\? \\(([\\s\\S]*?)\\n {20}\\) : \\(/
    );
    expect(branch).not.toBeNull();
    const body = branch![1];"""
assert old_branch in src
src = src.replace(old_branch, """    // P0 split: the vega render branch moved verbatim into its own file,
    // src/sites/vega/index.tsx — that file IS the branch.
    const body = vegaSite;""")

# ── 5. atrium order extraction ────────────────────────────────────────────
src = src.replace('const marker = landing.indexOf("<AtriumHero");',
                  'const marker = atriumSite.indexOf("<AtriumHero");')
src = src.replace("const tail = landing.slice(marker);",
                  "const tail = atriumSite.slice(marker);")

# ── 6. cross-isolation path pins ──────────────────────────────────────────
src = src.replace('expect(src).not.toContain("marketing/atrium/");',
                  'expect(src).not.toContain("sites/atrium/");\n      expect(src).not.toContain("../../atrium/");')
src = src.replace('expect(src).not.toContain("marketing/vega/");',
                  'expect(src).not.toContain("sites/vega/");\n      expect(src).not.toContain("../../vega/");')

T.write_text(src)
rest = [l.strip() for l in src.split("\n") if "expect(landing)" in l]
print("applied. REMAINING expect(landing) lines (manual review):")
for l in rest:
    print("  ", l)
print("done")
