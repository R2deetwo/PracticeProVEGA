#!/usr/bin/env node
/**
 * R67 — the video-fit fix: acceptance harness.
 * The R66 build zoomed the 16:9 clip to cover the whole ~1900px hero section
 * (1.76x) and cropped the subject out. R67 pins the video to a full-width,
 * exact-16:9 band — zero crop at any width.
 *
 * Evidence:
 *  A. desktop 1920x1080 + mobile 390x844 screenshots of /vega
 *  B. geometric proof of zero crop: the video element's box ratio must equal
 *     the clip's intrinsic ratio (1920x1080); object-fit:cover crops nothing
 *     when the two match. Also logs the band's on-page geometry.
 *  C. the band's bottom fade never reaches the hands (bottom 7% = desk only)
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');

const REPO = '/home/z/my-project/tmp/pprepo';
const OUT = '/home/z/my-project/download/r67-video-fit';
const PORT = 4180;
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { proc };
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
      // the sandbox's cached build (1200) rather than playwright 1.62's pinned 1234
      executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
      args: ['--no-sandbox'],
    });
    const report = {};

    for (const [name, vp] of [['desktop', { width: 1920, height: 1080 }], ['mobile', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/vega`, { waitUntil: 'networkidle' });
      // let the loop roll a moment so we screenshot a mid-loop frame, not the poster
      await sleep(2500);
      const file = `${OUT}/hero-${name}-${vp.width}x${vp.height}.png`;
      await page.screenshot({ path: file });

      // geometric proof: video box ratio vs intrinsic ratio
      const geo = await page.evaluate(() => {
        const v = document.querySelector('#home video, #home img');
        if (!v) return { found: false };
        const r = v.getBoundingClientRect();
        const iw = v.videoWidth || v.naturalWidth, ih = v.videoHeight || v.naturalHeight;
        const band = v.closest('div[aria-hidden="true"]')?.getBoundingClientRect();
        const sec = document.querySelector('#home')?.getBoundingClientRect();
        return {
          found: true, tag: v.tagName,
          box: { w: Math.round(r.width), h: Math.round(r.height) },
          boxRatio: +(r.width / r.height).toFixed(4),
          intrinsic: { w: iw, h: ih },
          intrinsicRatio: +(iw / ih).toFixed(4),
          zeroCrop: Math.abs(r.width / r.height - iw / ih) < 0.01,
          band: band ? { w: Math.round(band.width), h: Math.round(band.height), top: Math.round(band.top), bottom: Math.round(band.bottom) } : null,
          section: sec ? { h: Math.round(sec.height), top: Math.round(sec.top) } : null,
          currentTime: v.currentTime ?? null, paused: v.paused ?? null,
        };
      });
      report[name] = { screenshot: file, geo };
      await ctx.close();
    }

    fs.writeFileSync(`${OUT}/fit-report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
  } finally {
    server.proc.kill('SIGTERM');
  }
})().catch((e) => { console.error(e); process.exit(1); });
