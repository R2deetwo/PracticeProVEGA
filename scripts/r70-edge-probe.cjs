const sharp = require('sharp');
async function probe(file, W, bandTop, bandH) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const midY = Math.round(bandTop + bandH * 0.5);
  const cols = [];
  for (const x of [1, 3, 6, 10, 16, 26, 40, 80, w-80, w-40, w-26, w-16, w-10, w-6, w-3, w-1]) {
    const idx = (midY * w + x) * 4;
    const lum = 0.2126*data[idx] + 0.7152*data[idx+1] + 0.0722*data[idx+2];
    cols.push(`${x}:${Math.round(lum)}`);
  }
  console.log(`${file.split('/').pop()} midY=${midY} cols(L..R): ${cols.join(' ')}`);
}
(async () => {
  const D = '/home/z/my-project/download/r70-background-restore';
  await probe(`${D}/hero-390x844.png`, 390, 96, 219.4);
  await probe(`${D}/hero-768x900.png`, 768, 96, 426.4);
  await probe(`${D}/hero-1920x1080.png`, 1920, 96, 1074.4);
})();
