#!/usr/bin/env node
/** R70 — probe the band's top edge (y 96-118) on the 1920 capture for
 * the VLM's "white notch at the top-left/top-center". */
const sharp = require('sharp');
const file = '/home/z/my-project/download/r70-background-restore/hero-1920x1080.png';

(async () => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  // the band spans y 96..1170 (56.25vw at 1910w -> 1074h). Sample the top
  // edge rows and 4 columns of the band.
  const rows = [98, 104, 112, 120, 140, 200];
  for (const y of rows) {
    const samples = [];
    for (let x = 0; x < W; x += 48) {
      const idx = (y * W + x) * 4;
      const lum = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
      samples.push(Math.round(lum));
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const whites = samples.filter(v => v > 248).length;
    console.log(`y=${y}: mean=${mean.toFixed(0)} pureWhiteCols=${whites}/${samples.length} row=[${samples.slice(0, 20).join(',')}]`);
  }
  // vertical scan down the center-left (x=25%), center (x=50%), right (x=90%)
  for (const fx of [0.25, 0.5, 0.9]) {
    const x = Math.round(W * fx);
    const col = [];
    for (let y = 90; y < 240; y += 6) {
      const idx = (y * W + x) * 4;
      col.push(Math.round(0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2]));
    }
    console.log(`col x=${x}:`, col.join(','));
  }
})();
