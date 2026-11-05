#!/usr/bin/env node
/** R70 — LIVE verification against practice-pro-vega.vercel.app: the
 *  video is the landing-page background at EVERY width — run at 1920
 *  (the control) and 1280 (the width R68/R69 had demoted to a framed
 *  card): the band must be the full-bleed background with the copy
 *  riding on it, not a card below the text. Plus the cycle, the copy
 *  seat, and zero console errors. Run AFTER the R70 push + promote. */
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/home/z/my-project/download/r70-background-restore';
const BASE = 'https://practice-pro-vega.vercel.app';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const report = { consoleErrors: [], widths: {}, version: {} };

  // version.json first — prove WHICH build is being verified.
  try {
    const r = await fetch(`${BASE}/version.json`, { cache: 'no-store' });
    report.version = await r.json();
  } catch (e) { report.version = { error: String(e) }; }
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  for (const [w, h] of [[1920, 1080], [1280, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && report.consoleErrors.push(m.text()));
    await page.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 90000 });
    await sleep(1000);
    await page.evaluate(() => {
      const banner = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Acknowledge');
      banner?.click();
    });
    await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
    await page.waitForFunction(() => {
      const v = document.querySelector('section#home video');
      const h1 = document.querySelector('h1');
      return v && v.readyState >= 2 && !v.paused && h1 && parseFloat(getComputedStyle(h1).opacity) > 0.9;
    }, { timeout: 30000 }).catch(() => {});
    await sleep(1500);

    report.widths[String(w)] = await page.evaluate(() => {
      const sec = document.querySelector('section#home');
      const h1 = sec.querySelector('h1').getBoundingClientRect();
      const bandEl = sec.querySelector('video')?.closest('div[class*="aspect-video"]');
      const band = bandEl?.getBoundingClientRect();
      const dash = [...sec.querySelectorAll('img')].find(i => i.src.includes('dashboard.jpg'))?.getBoundingClientRect();
      const cs = bandEl ? getComputedStyle(bandEl) : null;
      return {
        // THE RESTORE: the copy rides the band, the band is the
        // background (not a card below the copy), zero-crop, de-shoved.
        bandTop: band ? +band.top.toFixed(0) : null,
        bandTopInSection: band ? +(band.top - sec.getBoundingClientRect().top).toFixed(0) : null,
        bandRatio: band ? +(band.width / band.height).toFixed(4) : null,
        bandRadius: cs ? cs.borderRadius : null,
        copyOnBand: band ? +(h1.top - band.top).toFixed(0) : null,
        h1Top: +h1.top.toFixed(0),
        cardRegisterGone: cs ? cs.borderRadius === '0px' : null,
        dashBelowBandFoot: dash && band ? +(dash.top - band.bottom).toFixed(0) : null,
      };
    });
    await page.screenshot({ path: `${OUT}/live-hero-${w}.png` });

    // the cycle at this width: watch for a handoff to clip 2 and back.
    if (w === 1920) {
      let sawCufflink = false, wrapped = false;
      for (let i = 0; i < 120; i++) {
        const st = await page.evaluate(() => {
          const vids = [...document.querySelectorAll('section#home video')];
          if (!vids.length) return { activeSrc: 'still', t: 0 };
          const top = vids.find(v => +getComputedStyle(v.parentElement).zIndex === 30) || vids[0];
          return { activeSrc: top.currentSrc.split('/').pop(), t: +top.currentTime.toFixed(2) };
        });
        if (st.activeSrc.includes('vega-hero-2')) sawCufflink = true;
        if (sawCufflink && st.activeSrc.includes('vega-hero.webm') && st.t < 6) { wrapped = true; break; }
        await sleep(250);
      }
      report.cycle = { sawCufflink, wrappedBackToTypist: wrapped };
    }
    await ctx.close();
  }

  console.log(JSON.stringify(report, null, 1));
  fs.writeFileSync(`${OUT}/r70-live-report.json`, JSON.stringify(report, null, 2));
  const ok = report.widths['1920'].bandTop === 96
    && Math.abs(report.widths['1920'].bandRatio - 1.7778) < 0.002
    && report.widths['1280'].bandTop === 96
    && Math.abs(report.widths['1280'].bandRatio - 1.7778) < 0.002
    && report.widths['1280'].copyOnBand > 0
    && report.widths['1280'].cardRegisterGone
    && report.cycle && report.cycle.wrappedBackToTypist
    && report.consoleErrors.length === 0;
  console.log('R70 LIVE VERDICT:', ok ? 'PASS — the video is the landing-page background at every width' : 'FAIL');
  process.exit(ok ? 0 : 1);
})();
