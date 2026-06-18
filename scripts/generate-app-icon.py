#!/usr/bin/env python3
"""
Generate PracticePro app icon for Android.
Creates a 1024x1024 icon with the PracticePro green background and white "P" logo.
Then generates all required Android mipmap sizes.
"""

from PIL import Image, ImageDraw, ImageFont
import os

# PracticePro brand green
BRAND_GREEN = (22, 163, 74)  # #16A34A
# Dark background matching the web splash screen
SPLASH_BG = (14, 14, 17)  # #0e0e11
WHITE = (255, 255, 255)

# Source icon size
SOURCE_SIZE = 1024

# Android mipmap sizes (in pixels)
MIPMAP_SIZES = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}

# Android splash screen sizes (portrait)
SPLASH_SIZES = {
    'drawable-port-mdpi': 480,
    'drawable-port-hdpi': 720,
    'drawable-port-xhdpi': 960,
    'drawable-port-xxhdpi': 1440,
    'drawable-port-xxxhdpi': 1920,
}

def create_source_icon():
    """Create a 1024x1024 source icon with PracticePro branding."""
    img = Image.new('RGBA', (SOURCE_SIZE, SOURCE_SIZE), BRAND_GREEN + (255,))
    draw = ImageDraw.Draw(img)

    # Draw a large white "P" in the center
    # Try to use a bold system font; fall back to default if not available
    font = None
    font_paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, 680)  # Large font size
                print(f"Using font: {fp}")
                break
            except Exception:
                continue

    if font is None:
        font = ImageFont.load_default()
        print("Using default font")

    # Calculate text position to center it
    text = "P"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (SOURCE_SIZE - text_width) // 2 - bbox[0]
    y = (SOURCE_SIZE - text_height) // 2 - bbox[1] - 20  # Slight upward adjustment

    # Draw the "P"
    draw.text((x, y), text, fill=WHITE + (255,), font=font)

    return img

def save_icon(img, path, size):
    """Resize and save the icon to the specified path."""
    resized = img.resize((size, size), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    resized.save(path, 'PNG')
    print(f"  Saved: {path} ({size}x{size})")

def create_splash(size):
    """Create a splash screen with the dark background (matching web splash) and white logo."""
    # Portrait aspect ratio (3:4 roughly)
    width = size
    height = int(size * 4 / 3)
    img = Image.new('RGBA', (width, height), SPLASH_BG + (255,))
    draw = ImageDraw.Draw(img)

    # Draw a white "P" in the center
    font = None
    font_paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font_size = int(size * 0.4)
                font = ImageFont.truetype(fp, font_size)
                break
            except Exception:
                continue

    if font is None:
        font = ImageFont.load_default()

    text = "P"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (width - text_width) // 2 - bbox[0]
    y = (height - text_height) // 2 - bbox[1]

    draw.text((x, y), text, fill=WHITE + (255,), font=font)
    return img

def main():
    android_res = 'android/app/src/main/res'

    print("Creating source icon (1024x1024)...")
    source_icon = create_source_icon()

    print("\nGenerating app icons (mipmap)...")
    for folder, size in MIPMAP_SIZES.items():
        # Save as ic_launcher.png (main icon)
        save_icon(source_icon, os.path.join(android_res, folder, 'ic_launcher.png'), size)
        # Save as ic_launcher_round.png (round icon for some Android UIs)
        save_icon(source_icon, os.path.join(android_res, folder, 'ic_launcher_round.png'), size)

    print("\nGenerating splash screens...")
    for folder, size in SPLASH_SIZES.items():
        splash = create_splash(size)
        path = os.path.join(android_res, folder, 'splash.png')
        os.makedirs(os.path.dirname(path), exist_ok=True)
        splash.save(path, 'PNG')
        print(f"  Saved: {path} ({splash.width}x{splash.height})")

    # Also save the source icon for reference
    source_icon.save('resources/icon.png', 'PNG')
    print(f"\nSource icon saved to: resources/icon.png")

    print("\n✅ All icons generated successfully!")

if __name__ == '__main__':
    main()
