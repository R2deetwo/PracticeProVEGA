#!/usr/bin/env python3
"""r57-marks-qa.py — stage 2: compose the QA sheet from /tmp/r57qa captures.

Grid: one row per mark (company logo, company favicon, vega, atrium-old,
atrium-new, komplete) x columns 16/32/48/96px, plus a final column with the
16px capture upscaled 4x nearest-neighbour (tab-scale legibility).
Also renders each row on white and on dark slate chips.
Output: /home/z/my-project/tmp/pprepo/scripts/.r57-marks-qa.png
"""
from PIL import Image, ImageDraw

D = "/tmp/r57qa"
OUT = "/home/z/my-project/tmp/pprepo/scripts/.r57-marks-qa.png"

MARKS = [
    ("company-logo", "PracticePro logo (company)"),
    ("company-favicon", "PracticePro favicon (top block)"),
    ("vega", "Vega — the Seal"),
    ("atrium-old", "Atrium OLD — R51 chunky emerald"),
    ("atrium-new", "Atrium NEW — R57 stepped stack"),
    ("komplete", "Komplete — twin coins"),
]
SIZES = [16, 32, 48, 96]
PAD = 18          # padding inside each cell
CELL = 96 + 2 * PAD   # largest capture 96 + padding
LABEL_W = 300
GAP = 10
HDR = 46
ZOOM_CELL = 64 + 2 * PAD

W = LABEL_W + len(SIZES) * (CELL + GAP) + ZOOM_CELL + GAP + PAD
H = HDR + len(MARKS) * (CELL + GAP) + PAD + 30

BG = (226, 232, 240)
CARD = (255, 255, 255)
CARD_DARK = (15, 23, 42)
INK = (15, 23, 42)
MUTE = (71, 85, 105)

sheet = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(sheet)

def text(x, y, s, fill=INK, size=13):
    d.text((x, y), s, fill=fill)

# header
text(PAD, 12, "R57 — Atrium Stepped Stack · family lineup & size ladder (16 / 32 / 48 / 96 px, last column = 16px @ 4x nearest)")
x0 = LABEL_W + GAP
for i, s in enumerate(SIZES):
    text(x0 + i * (CELL + GAP) + PAD, 26, f"{s}px", MUTE, 11)
text(x0 + len(SIZES) * (CELL + GAP) + PAD, 26, "16px @4x", MUTE, 11)

for r, (key, label) in enumerate(MARKS):
    y = HDR + r * (CELL + GAP)
    text(PAD, y + CELL // 2 - 7, label, INK)
    for c, s in enumerate(SIZES):
        cx = x0 + c * (CELL + GAP)
        # white chip + dark chip side by side within the cell
        chip_w = (CELL - 2 * PAD - 4) // 2
        sheet.paste(Image.new("RGB", (chip_w, CELL - 2 * PAD), CARD), (cx + PAD, y + PAD))
        sheet.paste(Image.new("RGB", (chip_w, CELL - 2 * PAD), CARD_DARK), (cx + PAD + chip_w + 4, y + PAD))
        im = Image.open(f"{D}/{key}-{s}.png").convert("RGBA")
        # white chip
        px = cx + PAD + (chip_w - s) // 2
        py = y + PAD + (CELL - 2 * PAD - s) // 2
        sheet.paste(im, (px, py), im)
        # dark chip
        px2 = cx + PAD + chip_w + 4 + (chip_w - s) // 2
        sheet.paste(im, (px2, py), im)
    # zoom column: 16px upscaled 4x nearest
    zx = x0 + len(SIZES) * (CELL + GAP)
    sheet.paste(Image.new("RGB", (ZOOM_CELL, CELL - 2 * PAD), CARD), (zx + PAD, y + PAD))
    im16 = Image.open(f"{D}/{key}-16.png").convert("RGBA")
    big = im16.resize((64, 64), Image.NEAREST)
    px = zx + PAD + (ZOOM_CELL - 2 * PAD - 64) // 2
    py = y + PAD + (CELL - 2 * PAD - 64) // 2
    sheet.paste(big, (px, py), big)

sheet.save(OUT)
print("saved", OUT, sheet.size)
