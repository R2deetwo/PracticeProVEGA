#!/usr/bin/env python3
"""R67 — WCAG on the REAL rendered backdrop (8 loop frames, text hidden, washes on)."""
import json, glob
import numpy as np
from PIL import Image
from numpy.lib.stride_tricks import sliding_window_view

OUT = '/home/z/my-project/download/r67-video-fit'
tb = json.load(open(f'{OUT}/text-boxes.json'))
W, H = tb['band']['w'], tb['band']['h']

def srgb(c):
    c = np.asarray(c, float) / 255.0
    return np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def lum3(rgb):
    return 0.2126 * srgb(rgb[..., 0]) + 0.7152 * srgb(rgb[..., 1]) + 0.0722 * srgb(rgb[..., 2])

def txt_lum(c):
    c = np.array(c, float)
    return float((0.2126 * srgb([c[0]]) + 0.7152 * srgb([c[1]]) + 0.0722 * srgb([c[2]]))[0])

def parse(s):
    return tuple(int(x) for x in s[s.find('(') + 1:-1].split(','))

elements = [
    ('h1', tb['h1'], 3.0),      # 68px semibold slate-900 -> large
    ('navy', tb['navySpan'], 3.0),  # 68px semibold navy -> large
    ('sub', tb['subcopy'], 4.5),    # 18px regular slate-800
]

results = {}
for f in sorted(glob.glob(f'{OUT}/wcag-band-t*.png')):
    t = f.split('-t')[1][:-4]
    img = np.asarray(Image.open(f).convert('RGB'), dtype=float)
    assert img.shape[0] == H and img.shape[1] == W, f'unexpected size {img.shape}'
    L = lum3(img)
    row = {}
    for name, b, need in elements:
        x0 = max(0, int(b['x'] * W)); y0 = max(0, int(b['y'] * H))
        x1 = min(W, int((b['x'] + b['w']) * W)); y1 = min(H, int((b['y'] + b['h']) * H))
        win = sliding_window_view(L[y0:y1, x0:x1], (8, 8))
        worst = float(win.mean(axis=(2, 3)).min())
        lt = txt_lum(parse(b['color']))
        hi, lo = max(lt, worst), min(lt, worst)
        row[name] = round((hi + 0.05) / (lo + 0.05), 2)
    results[t] = row

print(f"{'frame':8s} {'h1(3.0)':>10s} {'navy(3.0)':>10s} {'sub(4.5)':>10s}")
for t, row in results.items():
    print(f"{t:8s} {row['h1']:>10.2f} {row['navy']:>10.2f} {row['sub']:>10.2f}")
worst = {n: min(r[n] for r in results.values()) for n, _, _ in elements}
print('WORST  ', {n: worst[n] for n in worst})
for name, b, need in elements:
    print(f"  {name}: worst {worst[name]} vs need {need} -> {'PASS' if worst[name] >= need else 'FAIL'}")
json.dump(results, open(f'{OUT}/wcag-real-rendered.json', 'w'), indent=2)
print('saved wcag-real-rendered.json')
