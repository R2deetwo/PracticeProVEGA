#!/usr/bin/env python3
"""R67 wash tuning, round 3: plateau-then-cliff veil shapes.
Hold strong through the text block (y <= hold), fall to clear by the typing
zone (y >= until). Find the lightest stack passing h1/navy 3.0 + subcopy 4.5."""
import json, glob
import numpy as np
from PIL import Image
from numpy.lib.stride_tricks import sliding_window_view

OUT = '/home/z/my-project/download/r67-video-fit'
boxes = json.load(open(f'{OUT}/text-boxes.json'))
W, H = boxes['band']['w'], boxes['band']['h']

def srgb(c):
    c = np.asarray(c, float) / 255.0
    return np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def lum(rgb):
    r, g, b = srgb(rgb[..., 0]), srgb(rgb[..., 1]), srgb(rgb[..., 2])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def txt_lum(color):
    c = np.array(color, float)
    return float((0.2126 * srgb([c[0]]) + 0.7152 * srgb([c[1]]) + 0.0722 * srgb([c[2]]))[0])

def contrast(color, bg_lum):
    lt = txt_lum(color)
    hi, lo = max(lt, bg_lum), min(lt, bg_lum)
    return (hi + 0.05) / (lo + 0.05)

def parse_rgb(s):
    return tuple(int(x) for x in s[s.find('(') + 1:-1].split(','))

def boxof(b):
    return (b['x'], b['y'], b['x'] + b['w'], b['y'] + b['h'])

elements = [
    ('h1(3.0)', boxof(boxes['h1']), parse_rgb(boxes['h1']['color']), 3.0),
    ('navy(3.0)', boxof(boxes['navySpan']), parse_rgb(boxes['navySpan']['color']), 3.0),
    ('sub(4.5)', boxof(boxes['subcopy']), parse_rgb(boxes['subcopy']['color']), 4.5),
]

frames = [(f.split('-t')[1][:-4], np.asarray(Image.open(f).convert('RGB'), float))
          for f in sorted(glob.glob(f'{OUT}/raw-band-t*.png'))]
yy, xx = np.mgrid[0:H, 0:W]
yn = yy / (H - 1)

def uniform(a):
    return np.full((H, W), a)

def plateau(p, hold, until):
    return p * np.clip((until - yn) / (until - hold), 0, 1)

def bottom_fade(h):
    return np.clip((yn - (1 - h)) / h, 0, 1)

BOTTOM = bottom_fade(0.07)

def worst_patch_lum(img, box):
    x0, y0, x1, y1 = [int(round(v * (W if i % 2 == 0 else H))) for i, v in enumerate(box)]
    x0, y0 = max(x0, 0), max(y0, 0)
    x1, y1 = min(x1, W), min(y1, H)
    L = lum(img[y0:y1, x0:x1])
    win = sliding_window_view(L, (8, 8))
    return float(win.mean(axis=(2, 3)).min())

def composite(frame, layers):
    total = np.zeros((H, W))
    for l in layers:
        total = total + l * (1 - total)
    total = total + BOTTOM * (1 - total)
    return frame * (1 - total[..., None]) + 255.0 * total[..., None], total

SUBJ = dict(face=(0.41, 0.12, 0.66, 0.45), body=(0.41, 0.45, 0.66, 0.99),
            typing=(0.33, 0.70, 0.74, 0.95), roomL=(0.0, 0.0, 0.30, 0.99))

CANDS = {
    'U u35+plat.62/.45/.68': [uniform(0.35), plateau(0.62, 0.45, 0.68)],
    'V u40+plat.58/.45/.68': [uniform(0.40), plateau(0.58, 0.45, 0.68)],
    'W u30+plat.65/.45/.68': [uniform(0.30), plateau(0.65, 0.45, 0.68)],
    'X u35+plat.68/.48/.70': [uniform(0.35), plateau(0.68, 0.48, 0.70)],
    'Y u40+plat.62/.48/.70': [uniform(0.40), plateau(0.62, 0.48, 0.70)],
    'Z u35+plat.62/.50/.72': [uniform(0.35), plateau(0.62, 0.50, 0.72)],
    'Z2 u30+plat.65/.48/.70': [uniform(0.30), plateau(0.65, 0.48, 0.70)],
}

results = {}
for name, layers in CANDS.items():
    row, res = [], {}
    for ename, box, color, need in elements:
        worst = 1e9
        for t, fr in frames:
            comp, _ = composite(fr, layers)
            worst = min(worst, contrast(color, worst_patch_lum(comp, box)))
        res[ename] = round(worst, 2)
        row.append(f'{ename}={worst:.2f}{"P" if worst >= need else "F"}')
    _, ta = composite(frames[0][1], layers)
    vis = {k: round(float(ta[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)].mean()), 3)
           for k, (x0, y0, x1, y1) in SUBJ.items()}
    res['veil'] = vis
    results[name] = res
    print(f"{name:26s} {' '.join(row)}  veil face={vis['face']} body={vis['body']} typing={vis['typing']} roomL={vis['roomL']}")

json.dump(results, open(f'{OUT}/wash-tuning-plateau.json', 'w'), indent=2)
print('saved wash-tuning-plateau.json')
