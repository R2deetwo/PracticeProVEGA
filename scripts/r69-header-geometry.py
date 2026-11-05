#!/usr/bin/env python3
"""R69 — measure the app-header element geometry in the live captures.
Detects dark-pixel column clusters in the header strip (white bg) to find
the exact x-extents of: ONLINE chip, monitor icon, bell, divider, profile
text, DU avatar. Output as % of image width so a DOM overlay can be
positioned precisely. Runs on every standard-header capture used by /vega.
"""
from PIL import Image
import numpy as np
import sys, os, json

APP = '/home/z/my-project/tmp/pprepo/public/assets/landing/app'
# The standard-header captures (editor.jpg is DraftPro chrome — no app header;
# aloa/research etc. checked too).
CANDIDATES = ['dashboard.jpg', 'matters-ledger.jpg', 'tasks-status.jpg', 'tasks-flat.jpg',
              'contacts.jpg', 'documents.jpg', 'research.jpg', 'tasks-team.jpg',
              'calendar.jpg', 'matter-notes.jpg', 'billing.jpg', 'invoice-bank.jpg',
              'analytics.jpg', 'matters.jpg', 'matter-detail.jpg', 'chronology.jpg',
              'aloa.jpg', 'vega-aloa.jpg', 'vega-aloa-drawout.jpg', 'atrium-invoice.jpg']

def analyze(path):
    im = Image.open(path).convert('L')
    w, h = im.size
    a = np.array(im, dtype=np.uint8)
    # Find the header strip: the first strong full-width horizontal dark line
    # (the header's bottom border) — scan rows 0..h*0.2 for a row whose dark
    # fraction > 0.5.
    strip_end = None
    for y in range(0, int(h * 0.2)):
        row = a[y]
        dark_frac = (row < 200).mean()
        if dark_frac > 0.5:
            strip_end = y
            break
    if strip_end is None:
        return {'file': os.path.basename(path), 'header': None}
    # Header content rows: 10%..90% of the strip (avoid the border line).
    y0, y1 = int(strip_end * 0.12), int(strip_end * 0.88)
    band = a[y0:y1, :]
    # Column darkness profile in the right half only (x > 55%).
    xs = int(w * 0.55)
    col_dark = (band[:, xs:] < 160).sum(axis=0)
    # Cluster contiguous columns with any dark pixels (>=2 rows dark).
    occupied = col_dark >= 2
    clusters = []
    in_c = False
    for i, occ in enumerate(occupied):
        if occ and not in_c:
            start = i; in_c = True
        elif not occ and in_c:
            clusters.append((start, i)); in_c = False
    if in_c: clusters.append((start, len(occupied)))
    out = []
    for s, e in clusters:
        if e - s < 6:  # noise
            continue
        out.append({
            'x0': round((xs + s) / w * 100, 2),
            'x1': round((xs + e) / w * 100, 2),
            'w_pct': round((e - s) / w * 100, 2),
            'w_px_native': int(e - s),
        })
    return {'file': os.path.basename(path), 'header_px': strip_end, 'header_pct': round(strip_end / h * 100, 2), 'elements': out}

results = []
for f in CANDIDATES:
    p = os.path.join(APP, f)
    if not os.path.exists(p):
        print(f'MISSING {f}'); continue
    results.append(analyze(p))

for r in results:
    if r.get('header') is None and r.get('header_px') is None:
        print(f"{r['file']}: NO HEADER LINE")
    else:
        print(f"\n{r['file']}: header strip {r['header_px']}px = {r['header_pct']}% of height")
        for e in r['elements']:
            print(f"   x {e['x0']:5.2f}–{e['x1']:5.2f}%  (w {e['w_pct']:4.2f}% = {e['w_px_native']}px)")
json.dump(results, open('/tmp/r68w/header-geometry.json', 'w'), indent=1)
