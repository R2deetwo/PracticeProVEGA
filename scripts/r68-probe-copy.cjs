#!/usr/bin/env node
/** R68 probe — is the hero copy actually VISIBLE (opacity/visibility) after
 *  a proper reveal wait? Crops the copy region for VLM inspection. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');

const REPO = '/home/z/my-project/tmp/pprepo';
const OUT = '/home/z/my-project/download/r68-clip-playlist';
const PORT = 4174;
const BASE = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) { try { const r = await fetch(`${BASE}/version.json`); if (r.ok) break; } catch {} await sleep(500); }
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    // Wait for the copy to be naturally revealed (h1 opacity > 0.9), like r66 did.
    const h1State = await page.waitForFunction(() => {
      const h = document.querySelector('h1');
      if (!h) return false;
      return parseFloat(getComputedStyle(h).opacity) > 0.9;
    }, { timeout: 15000 }).then(() => 'revealed').catch(() => 'TIMEOUT');
    await sleep(1500);
    const probe = await page.evaluate(() => {
      const h1 = document.querySelector('section#home h1');
      const cs = getComputedStyle(h1);
      const r = h1.getBoundingClientRect();
      return {
        h1: { opacity: cs.opacity, visibility: cs.visibility, display: cs.display, transform: cs.transform, rect: { x: +r.x.toFixed(0), y: +r.y.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0) } },
        eyebrowVisible: (() => { const p = document.querySelector('section#home p'); const s = getComputedStyle(p); return { opacity: s.opacity, visibility: s.visibility }; })(),
      };
    });
    console.log('h1 wait:', h1State, JSON.stringify(probe));
    await page.screenshot({ path: `${OUT}/probe-1920-copy.png` });
    await browser.close();
  } finally { server.kill('SIGTERM'); }
})();
