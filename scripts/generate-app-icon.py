#!/usr/bin/env python3
"""
Generate PracticePro app icon for Android — matches the actual logo.
The PracticePro logo is: stacked horizontal bars (decreasing opacity from
bottom to top) with a white "P" cutout on the top bar.
"""

from PIL import Image, ImageDraw, ImageFont
import os
import math

# PracticePro brand green
BRAND_GREEN = (22, 163, 74)  # #16A34A
WHITE = (255, 255, 255)
<<<<<<< HEAD
DARK_BG = (15, 23, 42)  # #0f172a Slate-900 — matches auth screen gradient
=======
DARK_BG = (14, 14, 17)  # #0e0e11 for splash
>>>>>>> 2bea3ae (fix: Logo not defined crash + correct PracticePro app icon)

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
    """Create a 1024x1024 source icon matching the PracticePro logo.
    
    The logo is:
    - Top bar (full opacity): green rectangle with white "P" cutout
    - Middle bar (80% opacity): green rectangle
    - Bottom bar (60% opacity): green rectangle
    - Bars are stacked from top to bottom with decreasing opacity
    """
    img = Image.new('RGBA', (SOURCE_SIZE, SOURCE_SIZE), BRAND_GREEN + (255,))
    draw = ImageDraw.Draw(img)
    
    # The logo uses viewBox 0 0 64 64 — scale to 1024
    scale = SOURCE_SIZE / 64  # = 16
    
    # Bottom bar (y=46-56, opacity 0.6) — drawn first (behind)
    # path: M10 54C10 55.1 10.9 56 12 56 H52 C53.1 56 54 55.1 54 54 V48 C54 46.9 53.1 46 52 46 H12 C10.9 46 10 46.9 10 48 V54Z
    bottom_y1 = int(46 * scale)
    bottom_y2 = int(56 * scale)
    bottom_x1 = int(10 * scale)
    bottom_x2 = int(54 * scale)
    # Rounded rectangle
    r = int(2 * scale)
    draw.rounded_rectangle([bottom_x1, bottom_y1, bottom_x2, bottom_y2], radius=r, fill=BRAND_GREEN + (153,))  # 60% opacity
    
    # Middle bar (y=36-46, opacity 0.8)
    mid_y1 = int(36 * scale)
    mid_y2 = int(46 * scale)
    mid_x1 = int(12 * scale)
    mid_x2 = int(52 * scale)
    draw.rounded_rectangle([mid_x1, mid_y1, mid_x2, mid_y2], radius=r, fill=BRAND_GREEN + (204,))  # 80% opacity
    
    # Top bar (y=8-36, full opacity)
    top_y1 = int(8 * scale)
    top_y2 = int(36 * scale)
    top_x1 = int(14 * scale)
    top_x2 = int(50 * scale)
    draw.rounded_rectangle([top_x1, top_y1, top_x2, top_y2], radius=r, fill=BRAND_GREEN + (255,))  # 100% opacity
    
    # White "P" on the top bar
    # path: M20 12 V34 H26 V26 H38 C42 26 44 23 44 18 C44 13 42 10 38 10 H20Z
    # This is a complex path — let's draw it as a filled shape
    p_points = [
        (20, 12), (20, 34), (26, 34), (26, 26), (38, 26), (42, 23), (44, 18),
        (44, 13), (42, 10), (38, 10), (20, 12)
    ]
    p_scaled = [(int(x * scale), int(y * scale)) for x, y in p_points]
    draw.polygon(p_scaled, fill=WHITE + (255,))
    
    # Inner cutout (the green part inside the P)
    # path: M26 16 H38 C39.5 16 40 17.5 40 18 C40 18.5 39.5 20 38 20 H26 V16Z
    inner_points = [
        (26, 16), (38, 16), (40, 18), (38, 20), (26, 20), (26, 16)
    ]
    inner_scaled = [(int(x * scale), int(y * scale)) for x, y in inner_points]
    draw.polygon(inner_scaled, fill=BRAND_GREEN + (255,))
    
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
    img = Image.new('RGBA', (width, height), DARK_BG + (255,))
    draw = ImageDraw.Draw(img)
    
    # Draw the logo in the center (scaled to ~40% of width)
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

    print("\nGenerating splash screens...")
    for folder, size in SPLASH_SIZES.items():
        splash = create_splash(size)
        path = os.path.join(android_res, folder, 'splash.png')
        os.makedirs(os.path.dirname(path), exist_ok=True)
        splash.save(path, 'PNG')
        print(f"  Saved: {path} ({splash.width}x{splash.height})")

    source_icon.save('resources/icon.png', 'PNG')
    print(f"\nSource icon saved to: resources/icon.png")
    print("\n✅ All icons generated — now matches the PracticePro logo!")

if __name__ == '__main__':
    main()
