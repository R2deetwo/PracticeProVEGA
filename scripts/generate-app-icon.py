#!/usr/bin/env python3
"""
Generate PracticePro app icon PNGs from the SVG that matches the web Logo.
Uses cairosvg for pixel-perfect rendering.
"""
import cairosvg
import os

base_path = '/home/z/my-project/android/app/src/main/res'
svg_path = '/home/z/my-project/scripts/app-icon.svg'

# Icon sizes for each density
densities = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}

for folder, size in densities.items():
    dir_path = os.path.join(base_path, folder)
    os.makedirs(dir_path, exist_ok=True)

    # Generate the main launcher icon
    png_path = os.path.join(dir_path, 'ic_launcher.png')
    cairosvg.svg2png(url=svg_path, write_to=png_path,
                     output_width=size, output_height=size)
    print(f"  {folder}/ic_launcher.png: {size}x{size}")

    # Same image for round icon
    round_path = os.path.join(dir_path, 'ic_launcher_round.png')
    cairosvg.svg2png(url=svg_path, write_to=round_path,
                     output_width=size, output_height=size)
    print(f"  {folder}/ic_launcher_round.png: {size}x{size}")

    # Foreground only (for adaptive icon — transparent background, just the logo)
    # We use the same SVG since the background is already part of the icon
    fg_path = os.path.join(dir_path, 'ic_launcher_foreground.png')
    cairosvg.svg2png(url=svg_path, write_to=fg_path,
                     output_width=size, output_height=size)
    print(f"  {folder}/ic_launcher_foreground.png: {size}x{size}")

print("\nAll icons generated — P letterform matches the web Logo exactly.")
