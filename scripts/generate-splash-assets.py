#!/usr/bin/env python3
"""
generate-splash-assets.py — regenerate the Android native splash images.

WHY (2026-11-18, founder-reported): the splash resources were a patchwork —
portrait phones got a DARK image (#0E0E11), landscape/base drawables were
the default WHITE Capacitor logo, the splash plugin painted green behind a
CENTER_CROP'd image that covered it, and the web body painted white for
light-theme users. One boot = white → green flash → white → black. The
founder saw a dead white screen for seconds and thought the app hung.

OWNER BRIEF 2026-11-25 (Splash Sequence & Product-Specific Finale): the
standard launch now opens BLACK-FIRST — the previous all-green boot chain
(green native splash → green plugin → green boot overlay → black cinematic)
flashed bright green before the main transition began, which the owner
directed removed. THE CANONICAL BOOT SEQUENCE (all black until the in-app
cinematic's amber/green phases):
  1. Launch theme window background (@drawable/splash) — BLACK
  2. Splash plugin (backgroundColor #000000 + this image + spinner) — BLACK
  3. HTML boot overlay (index.html #pp-boot-overlay) — BLACK + white P + spinner
  4. In-app SplashScreen cinematic: Black → PracticePro (Black → Amber
     → Green) → Black → the single product mark

This script renders every density bucket as solid BLACK (#000000) with the
white PracticePro "P" mark (the favicon's Top-Block letterform) centered.
Run from the repo root:  python3 scripts/generate-splash-assets.py

The ADMIN/FOUNDER APK keeps its own green native splash (its resources
live under android/branding/... and its own config) — untouched here.
"""

from pathlib import Path

from PIL import Image, ImageDraw

# 2026-11-25: the background is BLACK now — the counter color just needs to
# match the background so the P's bowl window cuts through; the mark itself
# stays WHITE.
BACKGROUND = (0, 0, 0, 255)  # #000000
WHITE = (255, 255, 255, 255)

RES_ROOT = Path(__file__).resolve().parent.parent / "android" / "app" / "src" / "main" / "res"

# (folder, width, height) — the exact buckets Capacitor's template ships.
SPLASH_BUCKETS = [
    ("drawable", 480, 320),
    ("drawable-land-hdpi", 800, 480),
    ("drawable-land-mdpi", 480, 320),
    ("drawable-land-xhdpi", 1280, 720),
    ("drawable-land-xxhdpi", 1600, 960),
    ("drawable-land-xxxhdpi", 1920, 1280),
    ("drawable-port-hdpi", 720, 960),
    ("drawable-port-mdpi", 480, 640),
    ("drawable-port-xhdpi", 960, 1280),
    ("drawable-port-xxhdpi", 1440, 1920),
    ("drawable-port-xxxhdpi", 1920, 2560),
]

# The "P" letterform from the brand favicon (Top-Block mark), in its 50x50
# design grid. Outer shape + counter (the counter paints brand green over
# the white fill, cutting the bowl's window).
def cubic(p0, p1, p2, p3, n=16):
    """Sample points along a cubic bezier."""
    pts = []
    for i in range(n + 1):
        t = i / n
        mt = 1 - t
        x = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0]
        y = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def p_mark_outer():
    """M20 12 V34 H26 V26 H38 C42 26 44 23 44 18 C44 13 42 10 38 10 H20 Z"""
    pts = [(20, 12), (20, 34), (26, 34), (26, 26), (38, 26)]
    pts += cubic((38, 26), (42, 26), (44, 23), (44, 18))   # bowl lower-right curve up
    pts += cubic((44, 18), (44, 13), (42, 10), (38, 10))   # bowl upper-right curve to top
    pts += [(38, 10), (20, 10)]
    return pts


def p_mark_counter():
    """M26 16 H38 C39.5 16 40 17.5 40 18 C40 18.5 39.5 20 38 20 H26 V16 Z"""
    pts = [(26, 16), (38, 16)]
    pts += cubic((38, 16), (39.5, 16), (40, 17.5), (40, 18))
    pts += cubic((40, 18), (40, 18.5), (39.5, 20), (38, 20))
    pts += [(38, 20), (26, 20), (26, 16)]
    return pts


# The mark's design-grid bounding box: x 20..44, y 10..34 (24x24 units).
MARK_BOX = (20, 10, 44, 34)
SS = 4  # supersampling factor


def render(width: int, height: int) -> Image.Image:
    ss_w, ss_h = width * SS, height * SS
    img = Image.new("RGBA", (ss_w, ss_h), BACKGROUND)
    draw = ImageDraw.Draw(img)

    # Scale the 24-unit mark to ~20% of the shorter screen side.
    mark_px = int(min(width, height) * 0.20) * SS
    scale = mark_px / (MARK_BOX[2] - MARK_BOX[0])
    cx, cy = ss_w / 2, ss_h / 2

    def to_canvas(pts):
        return [
            (cx + (x - (MARK_BOX[0] + MARK_BOX[2]) / 2) * scale,
             cy + (y - (MARK_BOX[1] + MARK_BOX[3]) / 2) * scale)
            for x, y in pts
        ]

    draw.polygon(to_canvas(p_mark_outer()), fill=WHITE)
    draw.polygon(to_canvas(p_mark_counter()), fill=BACKGROUND)

    return img.resize((width, height), Image.LANCZOS)


def main():
    for folder, w, h in SPLASH_BUCKETS:
        out = RES_ROOT / folder / "splash.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        img = render(w, h)
        img.save(out, optimize=True)
        print(f"wrote {out.relative_to(RES_ROOT.parent.parent.parent.parent)} ({w}x{h})")
    print("done — all splash images are black + white P")


if __name__ == "__main__":
    main()
