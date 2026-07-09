#!/usr/bin/env python3
"""
Generate PracticePro app icon for Android.

DESIGN:
- Full-bleed white background (fills the entire icon)
- Centered green rounded square (the "tile") — gives a 3D elevated look
- White "P" as an INLAY carved into the green tile (no shadow, no drop shadow)
- The P is the same shape as the PracticePro logo P
- The P appears as a carved/inlaid element — slightly darker green inside
  the P shape to simulate depth without using shadows

The result is a clean, modern app icon that looks 3D without shadows.
"""

from PIL import Image, ImageDraw
import os
import math

# PracticePro brand colors
BRAND_GREEN = (22, 163, 74)       # #16A34A
DARKER_GREEN = (18, 130, 60)      # slightly darker for the inlay depth
WHITE = (255, 255, 255)

SOURCE_SIZE = 1024

# Android mipmap sizes
MIPMAP_SIZES = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}

# Android splash screen sizes
SPLASH_SIZES = {
    'drawable-port-mdpi': 480,
    'drawable-port-hdpi': 720,
    'drawable-port-xhdpi': 960,
    'drawable-port-xxhdpi': 1440,
    'drawable-port-xxxhdpi': 1920,
}

def create_source_icon():
    """Create a 1024x1024 source icon.
    
    Design:
    - White background fills entire icon
    - Green rounded square tile in center (80% of icon size) — 3D elevated look
    - White "P" shape carved/inlaid into the green tile
    - The P uses a slightly darker green to simulate inlay depth
    - No shadows anywhere — clean, flat, modern
    """
    img = Image.new('RGBA', (SOURCE_SIZE, SOURCE_SIZE), WHITE + (255,))
    draw = ImageDraw.Draw(img)
    
    # Green rounded square tile — centered, 80% of icon
    tile_margin = int(SOURCE_SIZE * 0.08)  # 8% margin on each side
    tile_size = SOURCE_SIZE - 2 * tile_margin
    tile_radius = int(tile_size * 0.22)  # rounded corners
    
    # Draw the green tile
    draw.rounded_rectangle(
        [tile_margin, tile_margin, tile_margin + tile_size, tile_margin + tile_size],
        radius=tile_radius,
        fill=BRAND_GREEN + (255,)
    )
    
    # Draw the "P" as an inlay — the P shape is filled with darker green
    # to simulate depth (like it's carved into the tile)
    # The P is based on the PracticePro logo path:
    # M20 12 V34 H26 V26 H38 C42 26 44 23 44 18 C44 13 42 10 38 10 H20Z
    # Scale from 64x64 viewBox to our tile size
    scale = tile_size / 64
    
    # Offset to center the P within the tile
    # The P path spans roughly x:14-44, y:8-36 in the 64x64 viewBox
    # Center of P path: x~29, y~22
    p_center_x = 29
    p_center_y = 22
    tile_center = tile_size / 2
    offset_x = tile_margin + tile_center - (p_center_x * scale)
    offset_y = tile_margin + tile_center - (p_center_y * scale)
    
    # Outer P shape (filled with darker green for inlay effect)
    p_points = [
        (20, 12), (20, 34), (26, 34), (26, 26), (38, 26), (42, 23), (44, 18),
        (44, 13), (42, 10), (38, 10), (20, 12)
    ]
    p_scaled = [(int(x * scale + offset_x), int(y * scale + offset_y)) for x, y in p_points]
    draw.polygon(p_scaled, fill=DARKER_GREEN + (255,))
    
    # Inner cutout (the hole inside the P) — filled with the tile green
    # to create the outline of the P
    # path: M26 16 H38 C39.5 16 40 17.5 40 18 C40 18.5 39.5 20 38 20 H26 V16Z
    inner_points = [
        (26, 16), (38, 16), (40, 18), (38, 20), (26, 20), (26, 16)
    ]
    inner_scaled = [(int(x * scale + offset_x), int(y * scale + offset_y)) for x, y in inner_points]
    draw.polygon(inner_scaled, fill=BRAND_GREEN + (255,))
    
    # Add a subtle inner highlight on the top edge of the P for 3D effect
    # (a thin lighter green line along the top of the P — no shadow)
    highlight_color = (35, 180, 85)  # slightly lighter green
    # Top stroke of the P (y=10-12 area)
    stroke_width = max(2, int(2 * scale))
    draw.line(
        [(int(20 * scale + offset_x), int(11 * scale + offset_y)),
         (int(44 * scale + offset_x), int(11 * scale + offset_y))],
        fill=highlight_color + (255,),
        width=stroke_width
    )
    
    return img

def save_icon(img, path, size):
    """Resize and save the icon."""
    resized = img.resize((size, size), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    resized.save(path, 'PNG')
    print(f"  Saved: {path} ({size}x{size})")

def create_splash(size):
    """Create splash screen with dark background and the logo."""
    width = size
    height = int(size * 4 / 3)
    DARK_BG = (14, 14, 17)  # #0e0e11
    img = Image.new('RGBA', (width, height), DARK_BG + (255,))
    
    # Draw the logo in the center (scaled to ~35% of width)
    logo_size = int(width * 0.35)
    logo_x = (width - logo_size) // 2
    logo_y = (height - logo_size) // 2
    
    # Create a temp logo image and paste it
    temp_logo = create_source_icon().resize((logo_size, logo_size), Image.LANCZOS)
    img.paste(temp_logo, (logo_x, logo_y), temp_logo)
    
    return img

def main():
    android_res = 'android/app/src/main/res'

    print("Creating source icon (1024x1024)...")
    source_icon = create_source_icon()

    print("\nGenerating app icons (mipmap)...")
    for folder, size in MIPMAP_SIZES.items():
        save_icon(source_icon, os.path.join(android_res, folder, 'ic_launcher.png'), size)
        save_icon(source_icon, os.path.join(android_res, folder, 'ic_launcher_round.png'), size)

    print("\nGenerating foreground icons (for adaptive icon)...")
    for folder, size in MIPMAP_SIZES.items():
        save_icon(source_icon, os.path.join(android_res, folder, 'ic_launcher_foreground.png'), size)

    print("\nGenerating splash screens...")
    for folder, size in SPLASH_SIZES.items():
        splash = create_splash(size)
        path = os.path.join(android_res, folder, 'splash.png')
        os.makedirs(os.path.dirname(path), exist_ok=True)
        splash.save(path, 'PNG')
        print(f"  Saved: {path} ({splash.width}x{splash.height})")

    source_icon.save('resources/icon.png', 'PNG')
    print(f"\nSource icon saved to: resources/icon.png")
    print("\n✅ All icons generated — P is now an inlay, no shadows!")

if __name__ == '__main__':
    main()
