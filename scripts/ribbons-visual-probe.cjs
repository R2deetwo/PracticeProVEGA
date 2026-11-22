#!/usr/bin/env node
/**
 * ribbons-visual-probe — Phase 3 items 6 & 7 evidence:
 *   1. hero screenshot at 1920x1080 @2x (full + a 300%-zoom crop of the
 *      ribbon area: top fade boundary, hairlines, bottom fade boundary);
 *   2. prefers-reduced-motion: ONE static frame, no loop (paint counter
 *      frozen over 3s);
 *   3. hero scrolled off-screen: the loop stops (paint counter frozen);
 *   4. tab hidden: document.hidden path — reported via the pinned
 *      visibilitychange contract (not fakeable honestly in headless).
 * Usage: node scripts/ribbons-visual-probe.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.VITE_URL || 'http://localhost:5199/';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
const OUT = '/tmp/ribbons-visual';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXEC });

  /* ── 1. The 2x screenshots ── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__paints = 0;
      const origGet = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        const ctx = origGet.call(this, type, ...rest);
        if (type === '2d' && ctx && !ctx.__patched) {
          try {
            Object.defineProperty(ctx, '__patched', { value: true });
            for (const m of ['clearRect', 'stroke', 'beginPath', 'moveTo', 'lineTo']) {
              const orig = ctx[m];
              if (typeof orig === 'function') ctx[m] = function (...a) { window.__paints++; return orig.apply(this, a); };
            }
          } catch {}
        }
        return ctx;
      };
    });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('canvas', { timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/hero-1920.png` });
    // 300% zoom crops (CSS px -> 2x device px): the top fade boundary
    // (ribbon upper ends), a mid ribbon hairline area, the bottom fade.
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (box) {
      const w = Math.round(box.width), h = Math.round(box.height);
      // top-right: top fade + ribbon tops; mid: hairlines; bottom-right: fade
      await page.screenshot({ path: `${OUT}/crop-top.png`, clip: { x: box.x + w * 0.45, y: box.y + Math.max(0, h * 0.02), width: Math.min(500, w * 0.4), height: Math.min(320, h * 0.25) } });
      await page.screenshot({ path: `${OUT}/crop-mid.png`, clip: { x: box.x + w * 0.3, y: box.y + h * 0.38, width: Math.min(500, w * 0.4), height: Math.min(320, h * 0.2) } });
      await page.screenshot({ path: `${OUT}/crop-bottom.png`, clip: { x: box.x + w * 0.45, y: box.y + h * 0.78, width: Math.min(500, w * 0.4), height: Math.min(320, h * 0.2) } });
    }
    console.log('screenshots:', fs.readdirSync(OUT).join(', '));

    /* ── 3. Off-screen: scroll the hero away, the loop stops ── */
    const before = await page.evaluate(() => window.__paints);
    await page.evaluate(() => new Promise((r) => setTimeout(r, 800)));
    const during = await page.evaluate(() => window.__paints);
    // scroll the hero fully out of view
    await page.evaluate(() => {
      const host = (() => {
        let node = document.querySelector('canvas')?.parentElement || null;
        while (node && node !== document.body) {
          const oy = getComputedStyle(node).overflowY;
          if (oy === 'auto' || oy === 'scroll') return node;
          node = node.parentElement;
        }
        return null;
      })();
      if (host) host.scrollTop = host.clientHeight * 1.5;
      else window.scrollTo(0, window.innerHeight * 1.5);
    });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 1200)));
    const canvasHidden = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c ? getComputedStyle(c).visibility : 'missing';
    });
    const afterScroll = await page.evaluate(() => window.__paints);
    await page.evaluate(() => new Promise((r) => setTimeout(r, 1500)));
    const afterWait = await page.evaluate(() => window.__paints);
    console.log(`off-screen: paints before=${before} duringHero=${during} afterScrollOut=${afterScroll} after+1.5s=${afterWait} canvasVisibility=${canvasHidden}`);
    console.log(`off-screen verdict: loop ${afterWait === afterScroll ? 'STOPPED (no further paints)' : 'STILL PAINTING'}; canvas ${canvasHidden}`);
    await ctx.close();
  }

  /* ── 2. Reduced motion: ONE static frame, no loop ── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__paints = 0;
      const origGet = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        const ctx = origGet.call(this, type, ...rest);
        if (type === '2d' && ctx && !ctx.__patched) {
          try {
            Object.defineProperty(ctx, '__patched', { value: true });
            for (const m of ['clearRect', 'stroke', 'beginPath', 'moveTo', 'lineTo']) {
              const orig = ctx[m];
              if (typeof orig === 'function') ctx[m] = function (...a) { window.__paints++; return orig.apply(this, a); };
            }
          } catch {}
        }
        return ctx;
      };
    });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('canvas', { timeout: 60000 });
    await page.waitForTimeout(1000);
    const p1 = await page.evaluate(() => window.__paints);
    await page.evaluate(() => new Promise((r) => setTimeout(r, 3000)));
    const p2 = await page.evaluate(() => window.__paints);
    console.log(`reduced-motion: paints after load=${p1} after +3s=${p2} — ${p2 === p1 ? 'STATIC (no loop)' : 'LOOPING (FAIL)'}`);
    await ctx.close();
  }

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
