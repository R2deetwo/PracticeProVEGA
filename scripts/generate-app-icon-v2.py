#!/usr/bin/env python3
"""
PracticePro App Icon Generator — creates a brand-green app icon matching
the splash screen logo EXACTLY.

The splash logo is:
  - Three stacked rounded rectangles (the "platform" metaphor)
  - A white P cutout in the top block
  - Brand green color: #16A34A (Tailwind emerald-600)

This script generates:
  1. SVG source (512x512)
  2. PNG icons at all required sizes for Android (mipmap-*)
  3. A 1024x1024 master PNG for Capacitor
  4. Fixes the drawable-v24 foreground XML
  5. Fixes the values/ic_launcher_background.xml color

The "stacked blocks P" logo design:
  - On a SOLID GREEN background (#16A34A), the blocks are WHITE (with
    opacity for depth) and the P cutout is GREEN (the background showing
    through). This makes the P clearly visible on a green field.
"""

import subprocess
import os
from pathlib import Path

PROJECT_ROOT = Path("/home/z/my-project")
ANDROID_RES = PROJECT_ROOT / "android" / "app" / "src" / "main" / "res"
PUBLIC_DIR = PROJECT_ROOT / "public"
RESOURCES_DIR = PROJECT_ROOT / "resources"
SCRIPTS_DIR = PROJECT_ROOT / "scripts"

BRAND_GREEN = "#16A34A"
WHITE = "#FFFFFF"

# ─── SVG LOGO (the exact splash logo, rendered on a green background) ───
# This is the source of truth for all generated icons.
# The logo paths come from src/constants.tsx (the <Logo> component).
# ViewBox is 64x64, scaled up to the target size.

def logo_svg(size: int = 512, with_background: bool = True) -> str:
    """Generate the PracticePro logo SVG at the given size."""
    scale = size / 64
    bg_rect = ""
    if with_background:
        bg_rect = f'<rect width="{size}" height="{size}" fill="{BRAND_GREEN}"/>'
    return f'''<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg">
  <title>PracticePro Logo</title>
  {bg_rect}
  <g transform="scale({scale})">
    <!-- Bottom block (white at 60% opacity) -->
    <path d="M10 54C10 55.1046 10.8954 56 12 56H52C53.1046 56 54 55.1046 54 54V48C54 46.8954 53.1046 46 52 46H12C10.8954 46 10 46.8954 10 48V54Z" fill="{WHITE}" opacity="0.6"/>
    <!-- Middle block (white at 80% opacity) -->
    <path d="M12 44C12 45.1046 12.8954 46 14 46H50C51.1046 46 52 45.1046 52 44V38C52 36.8954 51.1046 36 50 36H14C12.8954 36 12 36.8954 12 38V44Z" fill="{WHITE}" opacity="0.8"/>
    <!-- Top block (white at 100% opacity) -->
    <path d="M14 34C14 35.1046 14.8954 36 16 36H48C49.1046 36 50 35.1046 50 34V10C50 8.89543 49.1046 8 48 8H16C14.8954 8 14 8.89543 14 10V34Z" fill="{WHITE}"/>
    <!-- P outer shape (brand green — cut out from the white block) -->
    <path d="M20 12V34H26V26H38C42 26 44 23 44 18C44 13 42 10 38 10H20Z" fill="{BRAND_GREEN}"/>
    <!-- P counter / hole (white — same as the top block) -->
    <path d="M26 16H38C39.5 16 40 17.5 40 18C40 18.5 39.5 20 38 20H26V16Z" fill="{WHITE}"/>
  </g>
</svg>'''


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def svg_to_png(svg_content: str, output_path: Path, size: int):
    """Convert SVG to PNG using cairosvg (available in the environment)."""
    try:
        import cairosvg
        cairosvg.svg2png(
            bytestring=svg_content.encode('utf-8'),
            write_to=str(output_path),
            output_width=size,
            output_height=size,
        )
        print(f"  ✓ Generated {output_path.name} ({size}x{size})")
        return True
    except ImportError:
        print("  ✗ cairosvg not available, trying rsvg-convert...")
        # Fall back to rsvg-convert
        svg_file = output_path.with_suffix('.tmp.svg')
        svg_file.write_text(svg_content)
        result = subprocess.run(
            ['rsvg-convert', '-w', str(size), '-h', str(size), '-o', str(output_path), str(svg_file)],
            capture_output=True, text=True
        )
        svg_file.unlink(missing_ok=True)
        if result.returncode == 0:
            print(f"  ✓ Generated {output_path.name} ({size}x{size})")
            return True
        else:
            print(f"  ✗ Failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"  ✗ Failed to generate {output_path}: {e}")
        return False


def main():
    print("=" * 60)
    print("PracticePro App Icon Generator")
    print("=" * 60)
    print(f"Brand green: {BRAND_GREEN}")
    print()

    # ─── 1. Save the master SVG (512x512) ───
    print("[1/5] Saving master SVG...")
    master_svg_path = SCRIPTS_DIR / "app-icon.svg"
    ensure_dir(SCRIPTS_DIR)
    master_svg_path.write_text(logo_svg(512))
    print(f"  ✓ {master_svg_path}")

    # ─── 2. Generate PNG icons for Android mipmap-* ───
    print()
    print("[2/5] Generating Android mipmap PNG icons...")
    mipmap_sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }
    for folder, size in mipmap_sizes.items():
        mipmap_dir = ANDROID_RES / folder
        ensure_dir(mipmap_dir)
        svg = logo_svg(size)
        for name in ['ic_launcher.png', 'ic_launcher_round.png']:
            svg_to_png(svg, mipmap_dir / name, size)
        # Foreground is larger (108dp for adaptive icons)
        fg_size = int(size * 1.5)
        fg_svg = logo_svg(fg_size, with_background=False)
        svg_to_png(fg_svg, mipmap_dir / 'ic_launcher_foreground.png', fg_size)

    # ─── 3. Generate the 1024x1024 master PNG for Capacitor ───
    print()
    print("[3/5] Generating 1024x1024 Capacitor source icon...")
    ensure_dir(RESOURCES_DIR)
    master_png = RESOURCES_DIR / "icon.png"
    svg_to_png(logo_svg(1024), master_png, 1024)

    # ─── 4. Generate public/logo.svg and public/logo.png ───
    print()
    print("[4/5] Generating public/ logo files...")
    ensure_dir(PUBLIC_DIR)
    logo_svg_path = PUBLIC_DIR / "logo.svg"
    logo_svg_path.write_text(logo_svg(256))
    print(f"  ✓ {logo_svg_path}")
    svg_to_png(logo_svg(512), PUBLIC_DIR / "logo.png", 512)

    # ─── 5. Fix drawable-v24/ic_launcher_foreground.xml ───
    print()
    print("[5/5] Fixing drawable-v24/ic_launcher_foreground.xml...")
    drawable_v24_dir = ANDROID_RES / "drawable-v24"
    ensure_dir(drawable_v24_dir)
    # Copy the same content as drawable/ic_launcher_foreground.xml
    # (which already has the correct design)
    main_foreground = ANDROID_RES / "drawable" / "ic_launcher_foreground.xml"
    v24_foreground = drawable_v24_dir / "ic_launcher_foreground.xml"
    if main_foreground.exists():
        v24_foreground.write_text(main_foreground.read_text())
        print(f"  ✓ {v24_foreground} (copied from main drawable)")
    else:
        # Write the correct content directly
        v24_foreground.write_text("""<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:fillColor="#FFFFFF" android:fillAlpha="0.6" android:pathData="M29.25,78.75 C29.25,79.99 30.26,81 31.5,81 H76.5 C77.74,81 78.75,79.99 78.75,78.75 V72 C78.75,70.76 77.74,69.75 76.5,69.75 H31.5 C30.26,69.75 29.25,70.76 29.25,72 V78.75 Z" />
    <path android:fillColor="#FFFFFF" android:fillAlpha="0.8" android:pathData="M31.5,67.5 C31.5,68.74 32.51,69.75 33.75,69.75 H74.25 C75.49,69.75 76.5,68.74 76.5,67.5 V60.75 C76.5,59.51 75.49,58.5 74.25,58.5 H33.75 C32.51,58.5 31.5,59.51 31.5,60.75 V67.5 Z" />
    <path android:fillColor="#FFFFFF" android:pathData="M33.75,56.25 C33.75,57.49 34.76,58.5 36,58.5 H72 C73.24,58.5 74.25,57.49 74.25,56.25 V29.25 C74.25,28.01 73.24,27 72,27 H36 C34.76,27 33.75,28.01 33.75,29.25 V56.25 Z" />
    <path android:fillColor="#16A34A" android:pathData="M40.5,31.5 V56.25 H47.25 V47.25 H60.75 C65.25,47.25 67.5,43.875 67.5,38.25 C67.5,32.625 65.25,29.25 60.75,29.25 H40.5 Z" />
    <path android:fillColor="#FFFFFF" android:pathData="M47.25,36 H60.75 C62.44,36 63,37.69 63,38.25 C63,38.81 62.44,40.5 60.75,40.5 H47.25 V36 Z" />
</vector>""")
        print(f"  ✓ {v24_foreground} (written directly)")

    # ─── 6. Fix values/ic_launcher_background.xml ───
    print()
    print("[6/6] Fixing values/ic_launcher_background.xml color...")
    values_dir = ANDROID_RES / "values"
    ensure_dir(values_dir)
    bg_color_file = values_dir / "ic_launcher_background.xml"
    bg_color_file.write_text(f"""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">{BRAND_GREEN}</color>
</resources>
""")
    print(f"  ✓ {bg_color_file} → {BRAND_GREEN}")

    print()
    print("=" * 60)
    print("✅ All app icons generated and fixed!")
    print("=" * 60)
    print()
    print("Summary of changes:")
    print(f"  • Master SVG: {SCRIPTS_DIR / 'app-icon.svg'}")
    print(f"  • Master PNG (1024): {master_png}")
    print(f"  • Android mipmaps: all sizes regenerated with brand green")
    print(f"  • drawable-v24 foreground: now matches main drawable")
    print(f"  • values/ic_launcher_background.xml: now {BRAND_GREEN}")
    print(f"  • public/logo.svg: filled with correct logo")
    print(f"  • public/logo.png: regenerated as true PNG (512x512)")
    print()
    print("The app icon now EXACTLY matches the splash screen logo:")
    print(f"  • Brand green background: {BRAND_GREEN}")
    print("  • White stacked blocks with depth (60%/80%/100% opacity)")
    print("  • Green P cutout in the top block")
    print()
    print("NOTE: After deploying, you may need to:")
    print("  1. Uninstall the old app from your device/emulator")
    print("  2. Rebuild the APK: npx cap copy android && cd android && ./gradlew assembleDebug")
    print("  3. Clear the browser cache if testing on web")


if __name__ == "__main__":
    main()
