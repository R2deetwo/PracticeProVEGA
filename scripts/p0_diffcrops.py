#!/usr/bin/env python3
"""P0 — visual diff crops: where do baseline and after differ?"""
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "docs/brand/baseline"
B = ROOT / "docs/brand/p0-after"
OUT = Path("/home/z/my-project/download/p0-diffs")
OUT.mkdir(exist_ok=True, parents=True)

for name in ["hub-desktop-00.png", "hub-desktop-05.png", "hub-desktop-06.png",
             "hub-desktop-08.png", "hub-mobile-08.png", "hub-mobile-13.png"]:
    ia = Image.open(A / name).convert("RGB")
    ib = Image.open(B / name).convert("RGB")
    d = ImageChops.difference(ia, ib)
    bbox = d.getbbox()
    print(name, "diff bbox:", bbox, "size:", ia.size)
    if bbox:
        # composite: baseline | after | diff, cropped to the region (padded)
        pad = 40
        l, t, r, b = bbox
        l, t = max(0, l - pad), max(0, t - pad)
        r, b = min(ia.size[0], r + pad), min(ia.size[1], b + pad)
        w, h = r - l, b - t
        canvas = Image.new("RGB", (w * 3 + 20, h), (20, 20, 20))
        canvas.paste(ia.crop((l, t, r, b)), (0, 0))
        canvas.paste(ib.crop((l, t, r, b)), (w + 10, 0))
        canvas.paste(d.crop((l, t, r, b)), (w * 2 + 20, 0))
        canvas.save(OUT / name)
print("crops in", OUT)
