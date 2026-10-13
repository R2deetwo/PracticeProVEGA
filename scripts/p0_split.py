#!/usr/bin/env python3
"""P0 Phase B — mechanical split of src/components/LandingPage.tsx.

Everything extracted is copied VERBATIM by line range from the original
file so the after-split render is pixel-identical. Import blocks for the
extracted files are computed by scanning which imported identifiers the
extracted text actually references (word-boundary regex).

Moves (git mv, history-preserving):
  src/components/marketing/vega/     -> src/sites/vega/sections/
  src/components/marketing/atrium/   -> src/sites/atrium/sections/
  src/components/marketing/ContactSalesDrawer.tsx -> src/sites/shared/

Extracts from LandingPage.tsx:
  L91-199   -> src/sites/hub/hooks.ts        (3 hooks, exported)
  L201-239  -> src/sites/shared/ctas.tsx     (PrimaryButton/GhostButton, exported)
  L847-2376 -> src/sites/hub/sections/HubSections.tsx (all hub sections, verbatim;
              the 9 composed sections get `export`)

Path fixes inside moved files:
  vega sections: '../../ui' -> '../../../components/ui'
  ContactSalesDrawer: '../../../convex/_generated/api' -> '../../convex/_generated/api'
"""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"


def sh(*args):
    r = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"FAILED {' '.join(args)}\n{r.stdout}\n{r.stderr}")
    return r.stdout.strip()


# ── 1. directories + git mv (idempotent) ───────────────────────────────────
for d in ["src/sites/shared", "src/sites/hub/sections", "src/sites/vega", "src/sites/atrium"]:
    (ROOT / d).mkdir(parents=True, exist_ok=True)

if (SRC / "components/marketing/vega").exists():
    sh("git", "mv", "src/components/marketing/vega", "src/sites/vega/sections")
if (SRC / "components/marketing/atrium").exists():
    sh("git", "mv", "src/components/marketing/atrium", "src/sites/atrium/sections")
if (SRC / "components/marketing/ContactSalesDrawer.tsx").exists():
    sh("git", "mv", "src/components/marketing/ContactSalesDrawer.tsx",
       "src/sites/shared/ContactSalesDrawer.tsx")

# ── 2. path fixes inside moved files ───────────────────────────────────────
vega_ui_fixes = 0
for f in (SRC / "sites/vega/sections").glob("*.tsx"):
    t = f.read_text()
    if "from '../../ui'" in t:
        f.write_text(t.replace("from '../../ui'", "from '../../../components/ui'"))
        vega_ui_fixes += 1

drawer = SRC / "sites/shared/ContactSalesDrawer.tsx"
t = drawer.read_text()
drawer.write_text(t.replace("from '../../../convex/_generated/api'",
                            "from '../../convex/_generated/api'"))

# ── 3. read LandingPage.tsx + compute imports per extraction ──────────────
landing_lines = (SRC / "components/LandingPage.tsx").read_text().split("\n")


def lines(a, b):  # 1-indexed inclusive
    return "\n".join(landing_lines[a - 1:b])


# The import universe of the original file: name -> (module-from-LandingPage, kind)
IMPORT_UNIVERSE = {
    "React": ("react", "default"),
    "useState": ("react", "named"), "useEffect": ("react", "named"), "useRef": ("react", "named"),
    "createPortal": ("react-dom", "named"),
    "Logo": ("../constants", "named"), "CheckIcon": ("../constants", "named"),
    "ZapIcon": ("../constants", "named"), "ShieldCheckIcon": ("../constants", "named"),
    "SearchIcon": ("../constants", "named"), "ArrowLeftIcon": ("../constants", "named"),
    "LockClosedIcon": ("../constants", "named"), "BriefcaseIcon": ("../constants", "named"),
    "LinkIcon": ("../constants", "named"), "UsersIcon": ("../constants", "named"),
    "NairaCircleIcon": ("../constants", "named"), "BrainIcon": ("../constants", "named"),
    "MapPinIcon": ("../constants", "named"), "ClipboardListIcon": ("../constants", "named"),
    "PencilSquareIcon": ("../constants", "named"), "ComputerDesktopIcon": ("../constants", "named"),
    "CheckBadgeIcon": ("../constants", "named"), "ExternalLinkIcon": ("../constants", "named"),
    "ChevronDownIcon": ("../constants", "named"), "XMarkIcon": ("../constants", "named"),
    "ChevronRightIcon": ("../constants", "named"), "DeviceMobileIcon": ("../constants", "named"),
    "BellIcon": ("../constants", "named"), "MailIcon": ("../constants", "named"),
    "MorphScene": ("./marketing/MorphScene", "default"),
    "SystemCoreScene": ("./marketing/SystemCoreScene", "default"),
    "SystemTour": ("./marketing/SystemTour", "named"),
    "TourSystem": ("./marketing/SystemTour", "type"),
    "Button": ("./ui", "named"),
}


def compute_imports(text, path_rewrites, extra_named=None):
    """path_rewrites: module path (as written in LandingPage) -> new path for
    this file. Returns an import block. `extra_named` maps module -> [names]
    for modules whose names live outside IMPORT_UNIVERSE."""
    used = {name for name in IMPORT_UNIVERSE if re.search(rf"\b{name}\b", text)}
    for name in (extra_named or {}):
        used.update(extra_named.get(name, []))
    by_module = {}
    for name in used:
        mod, kind = IMPORT_UNIVERSE[name]
        by_module.setdefault(mod, []).append((name, kind))
    # react's default is React; other modules' default is their own name
    defaults = {n for n, k in ((nm, kd) for nm, kd in
                [(nm, kd) for mod_names in [v for v in by_module.values()]
                 for nm, kd in mod_names]) if k == "default"}
    block = []
    for mod, names in by_module.items():
        newpath = path_rewrites.get(mod, mod)
        named = sorted(n for n, k in names if k in ("named", "type"))
        has_default = any(k == "default" for n, k in names)
        parts = []
        if has_default:
            parts.append("React" if mod == "react" else
                         next(n for n, k in names if k == "default"))
        if named:
            parts.append("{ " + ", ".join(named) + " }")
        block.append(f"import {', '.join(parts)} from '{newpath}';")
    return "\n".join(sorted(block))


# ── 4. hub/hooks.ts (L91-199) ──────────────────────────────────────────────
hooks_text = lines(87, 199)  # include the doc comment block above useScrollReveal
for name in ["useScrollReveal", "useScrollParallax", "useSectionProgress"]:
    hooks_text = hooks_text.replace(f"function {name}<", f"export function {name}<")
(SRC / "sites/hub/hooks.ts").write_text(
    "import { useEffect, useRef } from 'react';\n\n" + hooks_text + "\n")

# ── 5. shared/ctas.tsx (L201-239) ──────────────────────────────────────────
ctas_text = lines(201, 239)
ctas_text = ctas_text.replace("const PrimaryButton:", "export const PrimaryButton:")
ctas_text = ctas_text.replace("const GhostButton:", "export const GhostButton:")
(SRC / "sites/shared/ctas.tsx").write_text(
    "import React from 'react';\n\n" + ctas_text + "\n")

# ── 6. hub/sections/HubSections.tsx (L847-2376 verbatim) ───────────────────
hub_text = lines(800, 2376)  # include the corporate-hub banner comment
EXPORTED = ["HubHero", "MarqueeStrip", "PainMirrorSection", "FluidSeam",
            "WhatWeDoSection", "OurWorkSection", "HowWeWorkSection",
            "AboutSection", "HubFinalCTASection"]
for name in EXPORTED:
    hub_text = hub_text.replace(f"const {name}: React.FC", f"export const {name}: React.FC")

hub_rewrites = {
    "../constants": "../../../constants",
    "./marketing/MorphScene": "../../../components/marketing/MorphScene",
    "./marketing/SystemCoreScene": "../../../components/marketing/SystemCoreScene",
    "./marketing/SystemTour": "../../../components/marketing/SystemTour",
    "./ui": "../../../components/ui",
}
hub_imports = compute_imports(hub_text, hub_rewrites)
# hooks imported from the sibling hooks file
used_hooks = [h for h in ["useScrollReveal", "useScrollParallax", "useSectionProgress"]
              if re.search(rf"\b{h}\b", hub_text)]
if used_hooks:
    hub_imports += f"\nimport {{ {', '.join(used_hooks)} }} from '../hooks';"
# CTAs if referenced
used_ctas = [c for c in ["PrimaryButton", "GhostButton"] if re.search(rf"\b{c}\b", hub_text)]
if used_ctas:
    hub_imports += f"\nimport {{ {', '.join(used_ctas)} }} from '../../shared/ctas';"

header = (
    "/**\n * HubSections — the PracticePro corporate hub's sections, moved\n"
    " * VERBATIM from src/components/LandingPage.tsx (P0 split). Line-for-line\n"
    " * copies; only `export` keywords and the import block were added. Restyle\n"
    " * happens in Prompt 1, not here.\n */\n\n"
)
(SRC / "sites/hub/sections/HubSections.tsx").write_text(
    hub_imports + "\n\n" + header + hub_text + "\n")

print("vega ui-import fixes:", vega_ui_fixes)
print("hooks exported:", used_hooks or "none")
print("ctas referenced by hub sections:", used_ctas or "none")
print("HubSections imports:\n" + hub_imports)
print("SPLIT-MECHANICAL OK")
