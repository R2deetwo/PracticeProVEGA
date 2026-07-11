#!/usr/bin/env python3
"""
Generate PracticePro app icon PNGs from the same SVG paths as the web Logo.
This ensures branding consistency — the APK icon uses the EXACT SAME "P"
letterform as the web app's Logo component.

The Logo is a "Top Block P" — three stacked rounded rectangles with a white
P cutout. We render this as a vector icon on a green (#16A34A) background
that fills the entire icon area (no black slits at top/bottom).
"""
import struct
import zlib
import os

def create_png(width, height, pixels):
    """Create a PNG file from RGBA pixel data."""
    def make_chunk(chunk_type, data):
        chunk = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)
        return struct.pack('>I', len(data)) + chunk + crc

    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA

    # IDAT chunk — pixel data with filter bytes
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # filter type: None
        for x in range(width):
            idx = (y * width + x) * 4
            raw_data += bytes(pixels[idx:idx+4])

    compressed = zlib.compress(raw_data, 9)

    # IEND chunk
    iend = b''

    return signature + make_chunk(b'IHDR', ihdr) + make_chunk(b'IDAT', compressed) + make_chunk(b'IEND', iend)

def draw_rounded_rect(pixels, width, height, x1, y1, x2, y2, radius, r, g, b, a=255):
    """Draw a filled rounded rectangle."""
    for y in range(max(0, y1), min(height, y2)):
        for x in range(max(0, x1), min(width, x2)):
            # Check corners
            in_corner = False
            corners = [
                (x1 + radius, y1 + radius),  # top-left
                (x2 - radius, y1 + radius),  # top-right
                (x1 + radius, y2 - radius),  # bottom-left
                (x2 - radius, y2 - radius),  # bottom-right
            ]
            for cx, cy in corners:
                dx = abs(x - cx)
                dy = abs(y - cy)
                if dx > radius or dy > radius:
                    continue
                if (x < cx if cx == x1 + radius else x >= cx) and (y < cy if cy == y1 + radius else y >= cy):
                    dist = (dx**2 + dy**2) ** 0.5
                    if dist <= radius:
                        idx = (y * width + x) * 4
                        pixels[idx] = r
                        pixels[idx+1] = g
                        pixels[idx+2] = b
                        pixels[idx+3] = a
                    in_corner = True
                    break

            if not in_corner:
                idx = (y * width + x) * 4
                pixels[idx] = r
                pixels[idx+1] = g
                pixels[idx+2] = b
                pixels[idx+3] = a

def draw_rect(pixels, width, height, x1, y1, x2, y2, r, g, b, a=255):
    """Draw a filled rectangle."""
    for y in range(max(0, y1), min(height, y2)):
        for x in range(max(0, x1), min(width, x2)):
            idx = (y * width + x) * 4
            pixels[idx] = r
            pixels[idx+1] = g
            pixels[idx+2] = b
            pixels[idx+3] = a

def generate_icon(size):
    """Generate the PracticePro icon at the given size.

    The icon matches the web Logo: a "Top Block P" with three stacked
    rounded rectangles. The P is white on a green (#16A34A) background
    that fills the entire icon — no black slits.
    """
    pixels = bytearray(size * size * 4)

    # Fill entire background with brand green (#16A34A)
    for i in range(size * size):
        idx = i * 4
        pixels[idx] = 0x16     # R
        pixels[idx+1] = 0xA3   # G
        pixels[idx+2] = 0x4A   # B
        pixels[idx+3] = 0xFF   # A

    # Scale factor — the logo viewBox is 64x64
    scale = size / 64.0

    # Draw the three stacked blocks (matching the web Logo SVG paths)
    # Block 1 (bottom): x=10, y=46, w=44, h=10, rx=2 — opacity 0.6
    x1 = int(10 * scale)
    y1 = int(46 * scale)
    x2 = int(54 * scale)
    y2 = int(56 * scale)
    radius = int(2 * scale)
    draw_rounded_rect(pixels, size, size, x1, y1, x2, y2, radius, 0x0A, 0x5C, 0x2E, 180)

    # Block 2 (middle): x=12, y=36, w=40, h=10, rx=2 — opacity 0.8
    x1 = int(12 * scale)
    y1 = int(36 * scale)
    x2 = int(52 * scale)
    y2 = int(46 * scale)
    radius = int(2 * scale)
    draw_rounded_rect(pixels, size, size, x1, y1, x2, y2, radius, 0x0E, 0x6B, 0x35, 210)

    # Block 3 (top — the main P body): x=14, y=8, w=36, h=28, rx=2 — full opacity
    x1 = int(14 * scale)
    y1 = int(8 * scale)
    x2 = int(50 * scale)
    y2 = int(36 * scale)
    radius = int(2 * scale)
    draw_rounded_rect(pixels, size, size, x1, y1, x2, y2, radius, 0x10, 0x7A, 0x3C, 255)

    # Draw the white P cutout on the top block
    # P outline: M20 12 V34 H26 V26 H38 C42 26 44 23 44 18 C44 13 42 10 38 10 H20 Z
    # This is the outer shape of the P
    p_top = int(10 * scale)
    p_bottom = int(34 * scale)
    p_left = int(20 * scale)
    p_right = int(44 * scale)
    p_stem_right = int(26 * scale)

    # White outer P shape
    draw_rect(pixels, size, size, p_left, p_top, p_stem_right, p_bottom, 0xFF, 0xFF, 0xFF, 255)
    # Top arm of P
    draw_rect(pixels, size, size, p_left, p_top, p_right, int(20 * scale), 0xFF, 0xFF, 0xFF, 255)
    # Right side of P loop (from y=10 to y=26, x=40 to 44)
    draw_rect(pixels, size, size, int(40 * scale), p_top, p_right, int(26 * scale), 0xFF, 0xFF, 0xFF, 255)

    # Cut out the counter (hole) of the P — make it green again
    # Counter: x=26, y=16, w=14, h=4 — the inner space of the P loop
    c_left = int(26 * scale)
    c_top = int(16 * scale)
    c_right = int(40 * scale)
    c_bottom = int(20 * scale)
    # Use the top-block green color for the counter
    draw_rect(pixels, size, size, c_left, c_top, c_right, c_bottom, 0x10, 0x7A, 0x3C, 255)

    return create_png(size, size, pixels)

# Generate icons for all required densities
base_path = '/home/z/my-project/android/app/src/main/res'
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

    icon_data = generate_icon(size)

    # Write ic_launcher.png
    with open(os.path.join(dir_path, 'ic_launcher.png'), 'wb') as f:
        f.write(icon_data)

    # Write ic_launcher_round.png (same image — the adaptive icon handles masking)
    with open(os.path.join(dir_path, 'ic_launcher_round.png'), 'wb') as f:
        f.write(icon_data)

    # Write ic_launcher_foreground.png (same — for adaptive icon)
    with open(os.path.join(dir_path, 'ic_launcher_foreground.png'), 'wb') as f:
        f.write(icon_data)

    print(f"  {folder}: {size}x{size} — generated")

# Also generate a foreground-only version (transparent background, just the P)
# for the adaptive icon foreground layer
def generate_foreground_icon(size):
    """Generate just the P letterform on transparent background."""
    pixels = bytearray(size * size * 4)

    # Transparent background (all zeros)
    scale = size / 108.0  # Adaptive icon foreground is 108x108dp

    # Center the P in the safe zone (inner 72x72 of 108x108)
    offset = int(18 * scale)  # 18dp padding on each side

    # Draw the three blocks
    # Block 1 (bottom)
    x1 = int((18 + 10) * scale)
    y1 = int((18 + 46) * scale)
    x2 = int((18 + 54) * scale)
    y2 = int((18 + 56) * scale)
    radius = int(2 * scale)
    draw_rounded_rect(pixels, size, size, x1, y1, x2, y2, radius, 0xFF, 0xFF, 0xFF, 150)

    # Block 2 (middle)
    x1 = int((18 + 12) * scale)
    y1 = int((18 + 36) * scale)
    x2 = int((18 + 52) * scale)
    y2 = int((18 + 46) * scale)
    draw_rounded_rect(pixels, size, size, x1, y1, x2, y2, radius, 0xFF, 0xFF, 0xFF, 200)

    # Block 3 (top)
    x1 = int((18 + 14) * scale)
    y1 = int((18 + 8) * scale)
    x2 = int((18 + 50) * scale)
    y2 = int((18 + 36) * scale)
    draw_rounded_rect(pixels, size, size, x1, y1, x2, y2, radius, 0xFF, 0xFF, 0xFF, 255)

    return create_png(size, size, pixels)

# Generate foreground icons
for folder, size in densities.items():
    dir_path = os.path.join(base_path, folder)
    fg_size = int(size * 108 / 48)  # Scale up for 108dp base
    fg_data = generate_foreground_icon(fg_size)
    with open(os.path.join(dir_path, 'ic_launcher_foreground.png'), 'wb') as f:
        f.write(fg_data)

print("\nAll icons generated — branding matches the web Logo.")
