#!/usr/bin/env node
/** R69 probe — why does the lightbox screenshot dark? DOM truth + pixels. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REPO = '/home/z/my-project/tmp/pprepo';
const PORT = 4178;
const BASE = `http://localhost:${PORT}`;

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) { try { const r = await fetch(`${BASE}/version.json`); if (r.ok) break; } catch {} await sleep(500); }
    const browser = await chromium.launch();
    const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
    await page.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    await sleep(900);
    await page.evaluate(() => {
      const banner = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Acknowledge');
      banner?.click();
    });
    await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
    await sleep(1000);
    await page.click('section#home button[aria-label="Expand the Dashboard view"]');
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    for (const wait of [300, 1000, 2000]) {
      await sleep(wait === 300 ? 300 : wait === 1000 ? 700 : 1000);
      const st = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        const img = dlg.querySelector('img');
        const cs = getComputedStyle(dlg);
        const ir = img.getBoundingClientRect();
        return {
          dlgOpacity: cs.opacity, dlgAnim: cs.animationName, dlgFilter: cs.filter,
          imgComplete: img.complete, imgNatural: img.naturalWidth + 'x' + img.naturalHeight,
          imgRect: { x: +ir.x.toFixed(0), y: +ir.y.toFixed(0), w: +ir.width.toFixed(0), h: +ir.height.toFixed(0) },
          imgSrc: img.getAttribute('src'),
        };
      });
      console.log(`+${wait}ms:`, JSON.stringify(st));
    }
    await page.screenshot({ path: '/tmp/r68w/lb-probe.png' });
    const px = await page.evaluate(() => {
      // sample the img element's own pixels via a canvas draw
      const img = document.querySelector('[role="dialog"] img');
      const c = document.createElement('canvas');
      c.width = 60; c.height = 40;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 60, 40);
      const d = ctx.getImageData(0, 0, 60, 40).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
      return { imgMeanLum: (sum / (d.length / 4)).toFixed(1) };
    });
    console.log('img canvas pixels:', JSON.stringify(px));
    await browser.close();
  } finally { server.kill('SIGTERM'); }
})();
