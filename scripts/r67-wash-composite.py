#!/usr/bin/env python3
"""R67 wash tuning: composite candidate wash stacks over the raw un-washed
band frames and check WCAG contrast behind every text element that overlays
the band. Goal: the LIGHTEST veil that still passes, so the typing stays visible."""
import json, glob
import numpy as np
from PIL import Image

OUT = '/home/z/my-project/download/r67-video-fit'
boxes = json.load(open(f'{OUT}/text-boxes.json'))
W, H = boxes['band']['w'], boxes['band']['h']

def srgb(c):
    c = c / 255.0
    return np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def lum(rgb):  # rgb float array HxWx3
    r, g, b = srgb(rgb[..., 0]), srgb(rgb[..., 1]), srgb(rgb[..., 2])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast(fg, bg_lum):
    l1, l2 = lum(np.array(fg, float)), bg_lum
    hi, lo = np.maximum(l1, l2), np.minimum(l1, l2)
    return (hi + 0.05) / (lo + 0.05)

def parse_rgb(s):
    return tuple(int(x) for x in s[s.find('(') + 1:-1].split(','))

# ---- text elements: (name, box, color, min ratio) ----
def el(name, b, color, ratio):
    return (name, (b['x'], b['y'], b['x'] + b['w'], b['y'] + b['h']), parse_rgb(color), ratio)

elements = [
    el('h1 slate-900 (large 3.0)', boxes['h1'], boxes['h1']['color'], 3.0),
    el('navySpan (large 3.0)', boxes['navySpan'], boxes['navySpan']['color'], 3.0),
    el('subcopy slate-800 (4.5)', boxes['subcopy'], boxes['subcopy']['color'], 4.5),
    # microcopy is handled by a solid white pill (deterministic, backdrop-free):
    # slate-600 on #FFFFFF = 6.98:1, slate-500 on #FFF = 4.76:1 -- both pass 4.5.
]

# ---- raw frames ----
frames = []
for f in sorted(glob.glob(f'{OUT}/raw-band-t*.png')):
    frames.append((f.split('-t')[1][:-4], np.asarray(Image.open(f).convert('RGB'), dtype=float)))
print(f'{len(frames)} raw frames, band {W}x{H}')

yy, xx = np.mgrid[0:H, 0:W]
xn, yn = xx / (W - 1), yy / (H - 1)

def uniform(a):  return np.full((H, W), a)
def top_fade(peak, until):  # white alpha: peak at y=0 -> 0 at y=until
    return peak * np.clip(1 - yn / until, 0, 1)
def tw_top_fade(frm, via, until):  # Tailwind from/via/to over a div of height `until`
    t = np.clip(yn / until, 0, 1)
    a = np.where(t <= 0.5, frm + (via - frm) * (t / 0.5), via * (1 - (t - 0.5) / 0.5))
    return np.clip(a, 0, 1) * (yn <= until)
def bottom_fade(h):  # the R67 blend-into-white foot, alpha 0 -> 1 by y=1
    return np.clip((yn - (1 - h)) / h, 0, 1) * 1.0
def left_grad(frm, via):  # Tailwind from-white/X via-white/Y to-transparent
    a = np.where(xn <= 0.5, frm + (via - frm) * (xn / 0.5), via * (1 - (xn - 0.5) / 0.5))
    return np.clip(a, 0, 1)

CANDIDATES = {
    'N u35 + linear62 .62': [uniform(0.35), top_fade(0.62, 0.62)],
    'O u35 + tw65/45 .62': [uniform(0.35), tw_top_fade(0.65, 0.45, 0.62)],
    'P u40 + tw70/50 .65': [uniform(0.40), tw_top_fade(0.70, 0.50, 0.65)],
    'Q u30 + tw70/50 .65': [uniform(0.30), tw_top_fade(0.70, 0.50, 0.65)],
    'R u40 + tw65/45 .60': [uniform(0.40), tw_top_fade(0.65, 0.45, 0.60)],
    'S u45 + tw60/40 .58': [uniform(0.45), tw_top_fade(0.60, 0.40, 0.58)],
    'T u50 + tw55/35 .55': [uniform(0.50), tw_top_fade(0.55, 0.35, 0.55)],
}
BOTTOM = bottom_fade(0.07)  # always present (blends band into the white section)

# subject visibility proxies (band-relative boxes, from the luminance map + frame VLM)
SUBJECT = dict(womanFace=(0.41, 0.12, 0.66, 0.45), womanBody=(0.41, 0.45, 0.66, 0.99),
               typing=(0.33, 0.70, 0.74, 0.95), roomLeft=(0.0, 0.0, 0.30, 0.99))

def composite(frame, layers):
    total = np.zeros((H, W))
    for l in layers:
        total = total + l * (1 - total)
    total = total + BOTTOM * (1 - total)  # white-on-white stacking
    white = np.ones((H, W))
    a = total[..., None]
    return frame * (1 - a) + 255.0 * a, total

def worst_patch_lum(img, box):
    x0, y0, x1, y1 = [int(round(v * (W if i % 2 == 0 else H))) for i, v in enumerate(box)]
    x0, y0 = max(x0, 0), max(y0, 0)
    x1, y1 = min(x1, W), min(y1, H)
    if x1 - x0 < 8 or y1 - y0 < 8:
        region = img[y0:y1, x0:x1]
        return lum(region).min()
    L = lum(img)
    from numpy.lib.stride_tricks import sliding_window_view
    win = sliding_window_view(L[y0:y1, x0:x1], (8, 8))
    return win.mean(axis=(2, 3)).min()  # darkest 8x8 mean patch

print(f"{'candidate':34s} {'element':28s} {'worst':>7s}  verdict")
results = {}
for name, layers in CANDIDATES.items():
    results[name] = {}
    for ename, box, color, need in elements:
        worst = 1e9
        for t, frame in frames:
            comp, total_a = composite(frame, layers)
            bl = worst_patch_lum(comp, box)
            c = contrast(color, np.array(bl))
            worst = min(worst, float(c))
        results[name][ename] = round(worst, 2)
        flag = 'PASS' if worst >= need else 'FAIL'
        print(f"{name:34s} {ename:28s} {worst:7.2f}  {flag} (need {need})")
    # visibility: mean white-alpha over subject zones
    _, total_a = composite(frames[0][1], layers)
    vis = {k: round(float(total_a[int(y0*H):int(y1*H), int(x0*W):int(x1*W)].mean()), 3)
           for k, (x0, y0, x1, y1) in SUBJECT.items()}
    results[name]['_veil_means'] = vis
    print(f"{'':34s} veil: face={vis['womanFace']} body={vis['womanBody']} typing={vis['typing']} roomL={vis['roomLeft']}\n")

json.dump(results, open(f'{OUT}/wash-tuning.json', 'w'), indent=2)
print('saved wash-tuning.json')
