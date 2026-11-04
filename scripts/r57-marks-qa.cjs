#!/usr/bin/env node
/**
 * r57-marks-qa.cjs — stage 1: rasterize every mark at 16/32/48/96px.
 * Output: /tmp/r57qa/<key>-<size>.png  (deviceScaleFactor 1, exact pixels)
 * Run: PLAYWRIGHT_CHROMIUM_PATH=... node scripts/r57-marks-qa.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUTDIR = '/tmp/r57qa';
fs.mkdirSync(OUTDIR, { recursive: true });

const OLD_ATRIUM = execSync('git show HEAD:public/brand/atrium/favicon.svg', { cwd: ROOT, encoding: 'utf8' });
const b64 = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');

const P_FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 8 36 28"><path d="M14 34C14 35.1046 14.8954 36 16 36H48C49.1046 36 50 35.1046 50 34V10C50 8.89543 49.1046 8 48 8H16C14.8954 8 14 8.89543 14 10V34Z" fill="#16A34A"/><path d="M20 12V34H26V26H38C42 26 44 23 44 18C44 13 42 10 38 10H20Z" fill="white"/><path d="M26 16H38C39.5 16 40 17.5 40 18C40 18.5 39.5 20 38 20H26V16Z" fill="#16A34A"/></svg>`;

const MARKS = [
  { key: 'company-logo', src: 'file://' + path.join(ROOT, 'public/logo.svg') },
  { key: 'company-favicon', src: b64(P_FAVICON) },
  { key: 'vega', src: 'file://' + path.join(ROOT, 'public/brand/vega/favicon.svg') },
  { key: 'atrium-old', src: b64(OLD_ATRIUM) },
  { key: 'atrium-new', src: 'file://' + path.join(ROOT, 'public/brand/atrium/favicon.svg') },
  { key: 'komplete', src: 'file://' + path.join(ROOT, 'public/brand/komplete/favicon.svg') },
];
const SIZES = [16, 32, 48, 96];

(async () => {
  const launchOpts = { headless: true };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const browser = await chromium.launch(launchOpts);
  for (const m of MARKS) {
    for (const size of SIZES) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.goto(m.src, { waitUntil: 'load' });
      await page.screenshot({ path: path.join(OUTDIR, `${m.key}-${size}.png`), clip: { x: 0, y: 0, width: size, height: size } });
      await page.close();
    }
  }
  await browser.close();
  console.log('rasterized ' + MARKS.length * SIZES.length + ' captures to ' + OUTDIR);
})();
