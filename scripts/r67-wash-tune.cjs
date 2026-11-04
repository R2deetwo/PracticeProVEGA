#!/usr/bin/env node
/**
 * R67 — wash-tuning evidence capture.
 * Captures, on the real rendered /vega (desktop 1920x1080):
 *   1. exact bounding boxes (relative to the video band) + computed colors of
 *      every text element that overlays the band,
 *   2. RAW un-washed band frames sampled across the 7.96s loop (washes +
 *      content + fixed overlays hidden, video seeked deterministically).
 * A Python pass then composites candidate wash stacks over the raw frames and
 * finds the lightest stack that still clears WCAG behind every element.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');

const REPO = '/home/z/my-project/tmp/pprepo';
const OUT = '/home/z/my-project/download/r67-video-fit';
const PORT = 4181;
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  return spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'],
  });
}
async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/version.json`); if (r.ok) return; } catch {}
    await sleep(500);
  }
  throw new Error('preview server never became ready');
}

(async () => {
  const server = startServer();
  try {
    await waitReady();
    const browser = await chromium.launch({
      executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
      args: ['--no-sandbox'],
    });
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/vega`, { waitUntil: 'networkidle' });
    await sleep(2000);

    // ---- pass 1: element boxes + colors, relative to the band ----
    const info = await page.evaluate(() => {
      const band = document.querySelector('#home div[aria-hidden="true"]');
      const b = band.getBoundingClientRect();
      const pick = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          x: +((r.left - b.left) / b.width).toFixed(4),
          y: +((r.top - b.top) / b.height).toFixed(4),
          w: +(r.width / b.width).toFixed(4),
          h: +(r.height / b.height).toFixed(4),
          color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        };
      };
      const h1 = document.querySelector('#home h1');
      const sub = [...document.querySelectorAll('#home p')].find(p => p.textContent.includes('Matters, court-rule deadlines'));
      const ctaRow = [...document.querySelectorAll('#home div')].find(d => d.textContent.trim().startsWith('Get Started') === false && d.querySelector('a, button') && [...(d.textContent.matchAll(/Get Started|View Live Demo/g))].length >= 2);
      const micro = [...document.querySelectorAll('#home p')].find(p => p.textContent.includes('NO CREDIT CARD'));
      const eyebrow = document.querySelector('#home h1')?.previousElementSibling;
      const outline = ctaRow ? [...ctaRow.querySelectorAll('a, button')].find(el => el.textContent.includes('View Live Demo')) : null;
      const primary = ctaRow ? [...ctaRow.querySelectorAll('a, button')].find(el => el.textContent.includes('Get Started')) : null;
      return {
        band: { w: Math.round(b.width), h: Math.round(b.height) },
        eyebrow: pick(eyebrow), h1: pick(h1),
        navySpan: (() => { const s = h1?.querySelector('span'); return s ? pick(s) : null; })(),
        subcopy: pick(sub), ctaRow: pick(ctaRow), microcopy: pick(micro),
        outlineCta: pick(outline), primaryCta: pick(primary),
        outlineCtaBg: outline ? getComputedStyle(outline).backgroundColor : null,
        primaryCtaBg: primary ? getComputedStyle(primary).backgroundColor : null,
      };
    });
    fs.writeFileSync(`${OUT}/text-boxes.json`, JSON.stringify(info, null, 2));

    // ---- pass 2: raw band frames across the loop ----
    await page.evaluate(() => {
      // hide the content layer, the washes (all band children except the video),
      // and any fixed overlays (nav, cookie banner) — pure video underneath
      const band = document.querySelector('#home div[aria-hidden="true"]');
      [...band.children[0].children].forEach(c => { if (c.tagName !== 'VIDEO' && c.tagName !== 'IMG') c.style.visibility = 'hidden'; });
      const content = [...document.querySelector('#home').children].find(c => !c.hasAttribute('aria-hidden'));
      if (content) content.style.visibility = 'hidden';
      document.querySelectorAll('header, nav, [class*="fixed"], [class*="cookie" i]').forEach(el => { el.style.visibility = 'hidden'; });
    });
    const times = [0.4, 1.4, 2.4, 3.4, 4.4, 5.4, 6.4, 7.4];
    for (const t of times) {
      await page.evaluate((t) => {
        const v = document.querySelector('#home video');
        v.pause(); v.currentTime = t;
      }, t);
      await page.waitForTimeout(350);
      const band = await page.evaluate(() => {
        const b = document.querySelector('#home div[aria-hidden="true"]').getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      });
      await page.screenshot({ path: `${OUT}/raw-band-t${t}.png`, clip: band });
    }
    console.log(JSON.stringify(info, null, 2));
    console.log('raw frames:', times.map(t => `raw-band-t${t}.png`).join(', '));
    await ctx.close(); await browser.close();
  } finally { server.proc.kill('SIGTERM'); }
})().catch(e => { console.error(e); process.exit(1); });
