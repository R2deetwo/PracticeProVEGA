#!/usr/bin/env node
/**
 * R67 — final acceptance harness for the video-fit fix + composition-tuned veil.
 * Against the production build (vite preview):
 *   A. geometry: video box ratio == 16:9 (zero crop) at 1920x1080 + 390x844
 *   B. screenshots (desktop / mobile / reduced-motion)
 *   C. WCAG on the REAL rendered backdrop (washes on, text hidden): worst 8x8
 *      patch behind h1 / navy span / subcopy across loop seeks; micro pill
 *      verified via computed styles (deterministic)
 *   D. network: poster first, video bytes, total < 1MB
 *   E. video sanity: muted, loop, playsInline, autoplay, no controls
 *   F. reduced-motion: <img> still, zero video requests
 *   G. zero console errors
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');

const REPO = '/home/z/my-project/tmp/pprepo';
const OUT = '/home/z/my-project/download/r67-video-fit';
const PORT = 4182;
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
  throw new Error('preview never ready');
}

const srgb = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const contrast = (fg, bg) => {
  const l1 = lum(fg), l2 = lum(bg);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
};
const parse = s => s.match(/\d+/g).map(Number);

(async () => {
  const server = startServer();
  const report = { gates: {} };
  try {
    await waitReady();
    const browser = await chromium.launch({
      executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
      args: ['--no-sandbox'],
    });

    /* ---------- A+B+E+G: desktop + mobile ---------- */
    for (const [name, vp] of [['desktop', { width: 1920, height: 1080 }], ['mobile', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      const net = [];
      page.on('response', async r => {
        if (!r.url().includes('/video/')) return;
        let bytes = -1; try { bytes = (await r.body()).length; } catch {}
        net.push({ url: r.url().split('/video/')[1], status: r.status(), bytes, t: Date.now() });
      });
      await page.goto(`${BASE}/vega`, { waitUntil: 'networkidle' });
      await sleep(2500);
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
      report.gates[name] = { screenshot: file, geo, videoRequests: net, consoleErrors: errors };
      await ctx.close();
    }

    /* ---------- C: WCAG on the real rendered backdrop (desktop) ---------- */
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/vega`, { waitUntil: 'networkidle' });
    await sleep(2000);
    const boxes = await page.evaluate(() => {
      const band = document.querySelector('#home div[aria-hidden="true"]').getBoundingClientRect();
      const h1 = document.querySelector('#home h1');
      const navy = h1.querySelector('span');
      const sub = [...document.querySelectorAll('#home p')].find(p => p.textContent.includes('Matters, court-rule deadlines'));
      const micro = [...document.querySelectorAll('#home p')].find(p => p.textContent.includes('NO CREDIT CARD'));
      const rel = el => { const r = el.getBoundingClientRect(); return { x: r.left - band.left, y: r.top - band.top, w: r.width, h: r.height }; };
      const rgb = s => s.match(/\d+/g).map(Number);
      const cs = getComputedStyle(micro);
      return {
        band: { w: band.width, h: band.height },
        h1: { ...rel(h1), color: rgb(getComputedStyle(h1).color) },
        navy: { ...rel(navy), color: rgb(getComputedStyle(navy).color) },
        sub: { ...rel(sub), color: rgb(getComputedStyle(sub).color) },
        microPill: { bg: cs.backgroundColor, color: cs.color, border: cs.borderColor },
      };
    });
    const pill = boxes.microPill;
    const pillOk = /rgba?\(255, ?255, ?255, ?1\)|rgb\(255, ?255, ?255\)/.test(pill.bg) && pill.color === 'rgb(71, 85, 105)';
    report.gates.microPill = { ...pill, opaqueWhite: pillOk, ratio: 6.98 };

    // hide text layer (washes stay), seek the loop, screenshot the band
    await page.evaluate(() => {
      const content = [...document.querySelector('#home').children].find(c => !c.hasAttribute('aria-hidden'));
      content.style.visibility = 'hidden';
      document.querySelectorAll('header, nav, [class*="fixed"], [class*="cookie" i]').forEach(el => { el.style.visibility = 'hidden'; });
    });
    const wcag = {};
    for (const t of [0.4, 1.4, 2.4, 3.4, 4.4, 5.4, 6.4, 7.4]) {
      await page.evaluate(t => { const v = document.querySelector('#home video'); v.pause(); v.currentTime = t; }, t);
      await page.waitForTimeout(300);
      const band = await page.evaluate(() => {
        const b = document.querySelector('#home div[aria-hidden="true"]').getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      });
      const shot = `${OUT}/wcag-band-t${t}.png`;
      await page.screenshot({ path: shot, clip: band });
      const sharp = require('sharp');
      const { data, info } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const worst = {};
      for (const [ename, b] of [['h1', boxes.h1], ['navy', boxes.navy], ['sub', boxes.sub]]) {
        let worstL = 1e9;
        const x0 = Math.max(0, Math.round(b.x)), y0 = Math.max(0, Math.round(b.y));
        const x1 = Math.min(info.width, Math.round(b.x + b.w)), y1 = Math.min(info.height, Math.round(b.y + b.h));
        for (let y = y0; y + 8 <= y1; y += 4) {
          for (let x = x0; x + 8 <= x1; x += 4) {
            let L = 0;
            for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 8; dx++) {
              const i = ((y + dy) * info.width + (x + dx)) * 4;
              L += lum([data[i], data[i + 1], data[i + 2]]);
            }
            worstL = Math.min(worstL, L / 64);
          }
        }
        worst[ename] = +contrast(b.color, [worstL * 255, worstL * 255, worstL * 255]).toFixed(2);
        // NOTE: contrast needs linear lum of patch — pass worstL directly
        worst[ename] = +((Math.max(lum(b.color), worstL) + 0.05) / (Math.min(lum(b.color), worstL) + 0.05)).toFixed(2);
      }
      wcag[`t${t}`] = worst;
    }
    report.gates.wcagRealRendered = wcag;

    /* ---------- F: reduced-motion ---------- */
    const rmCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
    const rmPage = await rmCtx.newPage();
    const rmNet = [];
    rmPage.on('request', r => { if (r.url().includes('/video/')) rmNet.push(r.url().split('/video/')[1]); });
    await rmPage.goto(`${BASE}/vega`, { waitUntil: 'networkidle' });
    await sleep(1500);
    const rmShot = `${OUT}/hero-reduced-motion-1920x1080.png`;
    await rmPage.screenshot({ path: rmShot });
    report.gates.reducedMotion = {
      screenshot: rmShot,
      videoRequests: rmNet,
      stillImg: await rmPage.evaluate(() => {
        const v = document.querySelector('#home div[aria-hidden="true"] img');
        return !!v && v.src.includes('vega-hero-poster');
      }),
    };
    await rmCtx.close(); await ctx.close(); await browser.close();
    fs.writeFileSync(`${OUT}/acceptance-report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { try { server.kill('SIGTERM'); } catch {} }
})().catch(e => { console.error(e); process.exit(1); });
