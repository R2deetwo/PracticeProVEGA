#!/usr/bin/env python3
"""
PracticePro FOUNDER App Icon Generator — creates a BLACK app icon
matching the splash screen's final phase (black logo).

The consumer app icon is GREEN (#16A34A). The founder app icon is
BLACK (#000000) — the same black that the consumer app's splash
STARTS with, and the same black that the founder app's splash ENDS
with.

This script generates all the black icon files into:
  resources/founder-icons/

The swap script (scripts/sync-admin-config.cjs) copies these over
the existing green icons before the founder build, then restores
the green icons after.

The consumer app's icons are NEVER touched.
"""

import subprocess
import os
from pathlib import Path

PROJECT_ROOT = Path("/home/z/my-project")
FOUNDER_ICONS_DIR = PROJECT_ROOT / "resources" / "founder-icons"

BLACK = "#000000"
WHITE = "#FFFFFF"

def logo_svg(size: int = 512, with_background: bool = True) -> str:
    """Generate the PracticePro logo SVG at the given size with BLACK background."""
    scale = size / 64
    bg_rect = ""
    if with_background:
        bg_rect = f'<rect width="{size}" height="{size}" fill="{BLACK}"/>'
    return f'''<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg">
  <title>PracticePro Founder Logo</title>
  {bg_rect}
  <g transform="scale({scale})">
    <!-- Bottom block (white at 60% opacity) -->
    <path d="M10 54C10 55.1046 10.8954 56 12 56H52C53.1046 56 54 55.1046 54 54V48C54 46.8954 53.1046 46 52 46H12C10.8954 46 10 46.8954 10 48V54Z" fill="{WHITE}" opacity="0.6"/>
    <!-- Middle block (white at 80% opacity) -->
    <path d="M12 44C12 45.1046 12.8954 46 14 46H50C51.1046 46 52 45.1046 52 44V38C52 36.8954 51.1046 36 50 36H14C12.8954 36 12 36.8954 12 38V44Z" fill="{WHITE}" opacity="0.8"/>
    <!-- Top block (white at 100% opacity) -->
    <path d="M14 34C14 35.1046 14.8954 36 16 36H48C49.1046 36 50 35.1046 50 34V10C50 8.89543 49.1046 8 48 8H16C14.8954 8 14 8.89543 14 10V34Z" fill="{WHITE}"/>
    <!-- P outer shape (BLACK — cut out from the white block) -->
    <path d="M20 12V34H26V26H38C42 26 44 23 44 18C44 13 42 10 38 10H20Z" fill="{BLACK}"/>
    <!-- P counter / hole (white — same as the top block) -->
    <path d="M26 16H38C39.5 16 40 17.5 40 18C40 18.5 39.5 20 38 20H26V16Z" fill="{WHITE}"/>
  </g>
</svg>'''


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def svg_to_png(svg_content: str, output_path: Path, size: int):
    """Convert SVG to PNG using cairosvg."""
    try:
        import cairosvg
        cairosvg.svg2png(
            bytestring=svg_content.encode('utf-8'),
            write_to=str(output_path),
            output_width=size,
            output_height=size,
        )
        print(f"  ✓ Generated {output_path} ({size}x{size})")
        return True
    except ImportError:
        print("  ✗ cairosvg not available, trying rsvg-convert...")
        svg_file = output_path.with_suffix('.tmp.svg')
        svg_file.write_text(svg_content)
        result = subprocess.run(
            ['rsvg-convert', '-w', str(size), '-h', str(size), '-o', str(output_path), str(svg_file)],
            capture_output=True, text=True
        )
        svg_file.unlink(missing_ok=True)
        if result.returncode == 0:
            print(f"  ✓ Generated {output_path} ({size}x{size})")
            return True
        else:
            print(f"  ✗ Failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"  ✗ Failed to generate {output_path}: {e}")
        return False


def main():
    print("=" * 60)
    print("PracticePro FOUNDER App Icon Generator (BLACK)")
    print("=" * 60)
    print(f"Black: {BLACK}")
    print(f"Output: {FOUNDER_ICONS_DIR}")
    print()

    # ─── 1. Generate PNG icons for Android mipmap-* ───
    print("[1/3] Generating Android mipmap PNG icons (black)...")
    mipmap_sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }
    for folder, size in mipmap_sizes.items():
        mipmap_dir = FOUNDER_ICONS_DIR / folder
        ensure_dir(mipmap_dir)
        svg = logo_svg(size)
        for name in ['ic_launcher.png', 'ic_launcher_round.png']:
            svg_to_png(svg, mipmap_dir / name, size)
        # Foreground is larger (108dp for adaptive icons) — no background
        fg_size = int(size * 1.5)
        fg_svg = logo_svg(fg_size, with_background=False)
        svg_to_png(fg_svg, mipmap_dir / 'ic_launcher_foreground.png', fg_size)

    # ─── 2. Generate the drawable XML files (black background + black P) ───
    print()
    print("[2/3] Generating drawable XML files (black)...")
    drawable_dir = FOUNDER_ICONS_DIR / "drawable"
    ensure_dir(drawable_dir)

    # ic_launcher_background.xml — BLACK background
    (drawable_dir / "ic_launcher_background.xml").write_text(f"""<?xml version="1.0" encoding="utf-8"?>
<!-- PracticePro FOUNDER launcher icon background — BLACK (#000000).
     This is the standard for the Founder App. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportHeight="108"
    android:viewportWidth="108">
    <path
        android:fillColor="{BLACK}"
        android:pathData="M0,0h108v108h-108z" />
</vector>
""")
    print(f"  ✓ {drawable_dir / 'ic_launcher_background.xml'}")

    # ic_launcher_foreground.xml — white blocks with BLACK P cutout
    (drawable_dir / "ic_launcher_foreground.xml").write_text("""<?xml version="1.0" encoding="utf-8"?>
<!--
  PracticePro FOUNDER App Icon Foreground — BLACK version.
  Same design as the consumer (green) icon but with BLACK instead of green.
-->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:fillColor="#FFFFFF" android:fillAlpha="0.6" android:pathData="M29.25,78.75 C29.25,79.99 30.26,81 31.5,81 H76.5 C77.74,81 78.75,79.99 78.75,78.75 V72 C78.75,70.76 77.74,69.75 76.5,69.75 H31.5 C30.26,69.75 29.25,70.76 29.25,72 V78.75 Z" />
    <path android:fillColor="#FFFFFF" android:fillAlpha="0.8" android:pathData="M31.5,67.5 C31.5,68.74 32.51,69.75 33.75,69.75 H74.25 C75.49,69.75 76.5,68.74 76.5,67.5 V60.75 C76.5,59.51 75.49,58.5 74.25,58.5 H33.75 C32.51,58.5 31.5,59.51 31.5,60.75 V67.5 Z" />
    <path android:fillColor="#FFFFFF" android:pathData="M33.75,56.25 C33.75,57.49 34.76,58.5 36,58.5 H72 C73.24,58.5 74.25,57.49 74.25,56.25 V29.25 C74.25,28.01 73.24,27 72,27 H36 C34.76,27 33.75,28.01 33.75,29.25 V56.25 Z" />
    <path android:fillColor="#000000" android:pathData="M40.5,31.5 V56.25 H47.25 V47.25 H60.75 C65.25,47.25 67.5,43.875 67.5,38.25 C67.5,32.625 65.25,29.25 60.75,29.25 H40.5 Z" />
    <path android:fillColor="#FFFFFF" android:pathData="M47.25,36 H60.75 C62.44,36 63,37.69 63,38.25 C63,38.81 62.44,40.5 60.75,40.5 H47.25 V36 Z" />
</vector>
""")
    print(f"  ✓ {drawable_dir / 'ic_launcher_foreground.xml'}")

    # ─── 3. Generate values/ic_launcher_background.xml (color resource) ───
    print()
    print("[3/3] Generating values/ic_launcher_background.xml (black color)...")
    values_dir = FOUNDER_ICONS_DIR / "values"
    ensure_dir(values_dir)
    (values_dir / "ic_launcher_background.xml").write_text(f"""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">{BLACK}</color>
</resources>
""")
    print(f"  ✓ {values_dir / 'ic_launcher_background.xml'}")

    # ─── 4. Generate drawable-v24/ic_launcher_foreground.xml ───
    print()
    print("[4/4] Generating drawable-v24/ic_launcher_foreground.xml (black)...")
    drawable_v24_dir = FOUNDER_ICONS_DIR / "drawable-v24"
    ensure_dir(drawable_v24_dir)
    (drawable_v24_dir / "ic_launcher_foreground.xml").write_text(
        (drawable_dir / "ic_launcher_foreground.xml").read_text()
    )
    print(f"  ✓ {drawable_v24_dir / 'ic_launcher_foreground.xml'}")

    print()
    print("=" * 60)
    print("✅ All FOUNDER app icons generated (BLACK)!")
    print("=" * 60)
    print()
    print("The swap script will copy these over the green icons when")
    print("building the founder APK, then restore the green icons after.")
    print("The consumer app's icons are never touched.")


if __name__ == "__main__":
    main()
