#!/usr/bin/env node
/** R67 — compact final gate collection (runs against an already-up preview). */
const { chromium } = require('playwright');

const OUT = '/home/z/my-project/download/r67-video-fit';
const BASE = process.argv[2] || 'http://localhost:4182';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
    args: ['--no-sandbox'],
  });
  const report = {};
  for (const [name, vp] of [['desktop', { width: 1920, height: 1080 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const net = [];
    page.on('response', async r => {
      if (!r.url().includes('/video/')) return;
      let bytes = -1; try { bytes = (await r.body()).length; } catch {}
      net.push({ url: r.url().split('/video/')[1], status: r.status(), bytes });
    });
    await page.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 30000 });
    await sleep(3000);
    const file = `${OUT}/hero-${name}-${vp.width}x${vp.height}.png`;
    await page.screenshot({ path: file });
    const geo = await page.evaluate(() => {
      const v = document.querySelector('#home video, #home img');
      if (!v) return { found: false };
      const r = v.getBoundingClientRect();
      const iw = v.videoWidth || v.naturalWidth, ih = v.videoHeight || v.naturalHeight;
      return {
        found: true, tag: v.tagName,
        box: { w: Math.round(r.width), h: Math.round(r.height) },
        zeroCrop: Math.abs(r.width / r.height - iw / ih) < 0.01,
        muted: v.muted, loop: v.loop, playsInline: v.playsInline,
        controls: v.controls ?? false, paused: v.paused,
      };
    });
    report[name] = { screenshot: file, geo, videoRequests: net, consoleErrors: errors };
    await ctx.close();
  }
  await browser.close();
  require('fs').writeFileSync(`${OUT}/final-gates.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
