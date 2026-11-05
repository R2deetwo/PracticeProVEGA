#!/usr/bin/env node
/** R70 — debug probe: run the exact contrastAt sample() on the saved
 * 390 shot with the recorded rects; find why the reads return NaN. */
const sharp = require('sharp');
const path = '/home/z/my-project/download/r70-background-restore/hero-390x844.png';

(async () => {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const png = { data, width: info.width, height: info.height };
  console.log('png:', png.width, 'x', png.height, 'data bytes:', data.length, 'expected:', png.width * png.height * 4);

  const rects = {
    h1: { x: 16, y: 140.8, w: 358, h: 168 },
    sub: { x: 16, y: 332.8, w: 358, h: 112 },
  };

  const sample = (r) => {
    let worst = null;
    if (r.h < 10 || r.w < 10) return { mean: -1, rgb: null, note: 'rect too small' };
    for (let y = Math.max(0, r.y); y < r.y + r.h - 8; y += 12) {
      for (let x = Math.max(0, r.x); x < r.x + r.w - 8; x += 12) {
        let sum = 0;
        for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 8; dx++) {
          const idx = ((y + dy) * png.width + (x + dx)) * 4;
          const v = png.data[idx];
          if (v === undefined) { console.log('UNDEFINED READ at', { y: y + dy, x: x + dx, idx, len: data.length }); }
          sum += 0.2126 * v + 0.7152 * png.data[idx + 1] + 0.0722 * png.data[idx + 2];
        }
        const mean = sum / 64;
        if (!isFinite(mean)) console.log('non-finite patch mean at', { x, y });
        if (!worst || mean < worst.mean) worst = { mean, rgb: [png.data[((y + 4) * png.width + (x + 4)) * 4], png.data[((y + 4) * png.width + (x + 4)) * 4 + 1], png.data[((y + 4) * png.width + (x + 4)) * 4 + 2]] };
      }
    }
    return worst || { mean: -1, rgb: null, note: 'no samples' };
  };

  const h1W = sample(rects.h1);
  const subW = sample(rects.sub);
  console.log('h1 worst:', JSON.stringify(h1W));
  console.log('sub worst:', JSON.stringify(subW));
})();
