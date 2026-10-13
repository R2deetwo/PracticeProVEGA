#!/usr/bin/env python3
"""P0 — pixel-diff baseline vs after-split captures (acceptance: <0.5% per image)."""
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "docs/brand/baseline"
B = ROOT / "docs/brand/p0-after"
TOL = 8  # per-channel tolerance (antialias jitter)

def diff_pct(pa, pb):
    ia, ib = Image.open(pa).convert("RGB"), Image.open(pb).convert("RGB")
    if ia.size != ib.size:
        return None, ia.size, ib.size
    d = ImageChops.difference(ia, ib)
    bbox = d.getbbox()
    if bbox is None:
        return 0.0, ia.size, ib.size
    px = d.getdata()
    n = 0
    total = ia.size[0] * ia.size[1]
    for r, g, b in px:
        if abs(r) > TOL or abs(g) > TOL or abs(b) > TOL:
            n += 1
    return 100.0 * n / total, ia.size, ib.size

pairs = sorted(p.name for p in A.glob("*.png"))
worst = []
print(f"{'image':34s} {'diff%':>8s}")
for name in pairs:
    pa, pb = A / name, B / name
    if not pb.exists():
        print(f"{name:34s} MISSING")
        continue
    pct, sa, sb = diff_pct(pa, pb)
    if pct is None:
        print(f"{name:34s} SIZE MISMATCH {sa} vs {sb}")
        worst.append((999, name))
        continue
    print(f"{name:34s} {pct:8.3f}")
    worst.append((pct, name))

worst.sort(reverse=True)
over = [(p, n) for p, n in worst if p >= 0.5]
print()
print(f"images compared: {len(pairs)}")
print(f"images over 0.5%: {len(over)}")
for p, n in over:
    print(f"  OVER: {n} = {p:.3f}%")
if not over:
    print("ALL IMAGES UNDER 0.5% — PASS")
