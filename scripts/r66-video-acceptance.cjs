#!/usr/bin/env node
/**
 * R65 — /vega lifestyle-video hero: acceptance harness.
 * Runs against the production build via `vite preview` (spawned as a child).
 *
 * Evidence collected:
 *  A. desktop 1920x1080 screenshot (subject visible, headline readable)
 *  B. mobile 390x844 screenshot
 *  C. WCAG contrast: worst-case background behind headline + subcopy,
 *     sampled over multiple loop times, text hidden for a clean backdrop
 *  D. network: /video/* requests — status, order (poster first), bytes
 *  E. prefers-reduced-motion: still poster, zero video requests
 *  F. pause when scrolled out of view + when tab hidden; resume on return
 *  G. video element sanity: muted, no controls, loop, playsInline
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function getPixels(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const REPO = '/home/z/my-project/tmp/pprepo';
const OUT = '/home/z/my-project/download/r66-video-hero';
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- WCAG ---------- */
function srgb(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function relLum([r, g, b]) { return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b); }
function contrast(fg, bg) {
  const l1 = relLum(fg), l2 = relLum(bg);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

/* ---------- server ---------- */
function startServer() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buf = '';
  proc.stdout.on('data', (d) => (buf += d));
  proc.stderr.on('data', (d) => (buf += d));
  return { proc, getLog: () => buf };
}
async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/version.json`);
      if (res.ok) return true;
    } catch {}
    await sleep(500);
  }
  throw new Error('preview server never became ready');
}

/* ---------- network recorder ---------- */
function recordNetwork(page, log) {
  page.on('request', (req) => {
    if (req.url().includes('/video/')) log.push({ t: Date.now(), phase: 'request', url: req.url(), type: req.resourceType() });
  });
  page.on('response', async (res) => {
    if (!res.url().includes('/video/')) return;
    let bytes = -1, cl = res.headers()['content-length'] || null;
    try { bytes = (await res.body()).length; } catch {}
    log.push({ t: Date.now(), phase: 'response', url: res.url(), status: res.status(), bytes, contentLength: cl });
  });
}

(async () => {
  const server = startServer();
  try {
    await waitReady();
    const browser = await chromium.launch();
    const report = { network: [], contrast: [], reducedMotion: {}, playback: {}, sanity: {} };

    /* ============ A. desktop: screenshot + network + sanity ============ */
    const dCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const dPage = await dCtx.newPage();
    const netLog = [];
    recordNetwork(dPage, netLog);
    const consoleErrors = [];
    dPage.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

    await dPage.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    // wait for the reveal animation to land on the headline
    await dPage.waitForFunction(() => {
      const h = document.querySelector('h1');
      if (!h) return false;
      const op = parseFloat(getComputedStyle(h).opacity);
      return op > 0.9;
    }, { timeout: 15000 }).catch(() => {});
    // wait until the video is actually playing
    await dPage.waitForFunction(() => {
      const v = document.querySelector('section#home video');
      return v && v.readyState >= 2 && !v.paused && v.currentTime > 0.2;
    }, { timeout: 20000 }).catch(() => {});
    await sleep(2500); // settle: frames advancing, network streaming

    report.sanity = await dPage.evaluate(() => {
      const v = document.querySelector('section#home video');
      if (!v) return { exists: false };
      const cs = getComputedStyle(v);
      return {
        exists: true, muted: v.muted, loop: v.loop, playsInline: v.playsInline,
        autoplay: v.autoplay, controls: v.controls, w: v.videoWidth, h: v.videoHeight,
        duration: +v.duration.toFixed(3), paused: v.paused, currentTime: +v.currentTime.toFixed(2),
        objectPosition: cs.objectPosition,
        posterEl: !!document.querySelector('section#home video[poster*="vega-hero-poster"]'),
      };
    });

    await dPage.screenshot({ path: path.join(OUT, 'hero-1920x1080.png'), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    console.log('[A] desktop screenshot saved');

    /* ============ C. contrast over multiple loop times ============ */
    const rects = await dPage.evaluate(() => {
      const h1 = document.querySelector('section#home h1');
      const sub = h1.parentElement.querySelector('p.text-base, p[class*="text-slate-600"]');
      const r1 = h1.getBoundingClientRect(), r2 = sub.getBoundingClientRect();
      return {
        h1: { x: r1.x, y: r1.y, w: r1.width, h: r1.height, color: getComputedStyle(h1).color },
        sub: { x: r2.x, y: r2.y, w: r2.width, h: r2.height, color: getComputedStyle(sub).color },
        navy: getComputedStyle(h1.querySelector('span') || h1).color,
      };
    });
    // hide the text (keep everything else) for clean backdrop shots
    await dPage.evaluate(() => {
      const h1 = document.querySelector('section#home h1');
      const sub = h1.parentElement.querySelector('p.text-base, p[class*="text-slate-600"]');
      h1.style.visibility = 'hidden'; sub.style.visibility = 'hidden';
    });
    // sample the loop 4 times: darkest 8x8 patch behind each block = worst case
    const sample = (r, png) => {
      let worst = null;
      for (let y = Math.max(0, r.y); y < r.y + r.h - 8; y += 12) {
        for (let x = Math.max(0, r.x); x < r.x + r.w - 8; x += 12) {
          let sum = 0;
          for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 8; dx++) {
            const idx = ((y + dy) * png.width + (x + dx)) * 4;
            sum += 0.2126 * png.data[idx] + 0.7152 * png.data[idx + 1] + 0.0722 * png.data[idx + 2];
          }
          const mean = sum / 64;
          if (!worst || mean < worst.mean) worst = { mean, x, y, rgb: [png.data[((y + 4) * png.width + (x + 4)) * 4], png.data[((y + 4) * png.width + (x + 4)) * 4 + 1], png.data[((y + 4) * png.width + (x + 4)) * 4 + 2]] };
        }
      }
      return worst;
    };
    for (let i = 0; i < 4; i++) {
      await sleep(1800);
      const shot = path.join(OUT, `_bg_${i}.png`);
      await dPage.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
      const png = await getPixels(shot);
      report.contrast.push({
        loopSample: i,
        h1Worst: sample(rects.h1, png),
        subWorst: sample(rects.sub, png),
      });
      fs.unlinkSync(shot);
    }
    await dPage.evaluate(() => {
      const h1 = document.querySelector('section#home h1');
      const sub = h1.parentElement.querySelector('p.text-base, p[class*="text-slate-600"]');
      h1.style.visibility = ''; sub.style.visibility = '';
    });
    report.contrast.textColors = rects;

    /* ============ F1. pause when scrolled out of view ============ */
    // NOTE: the app scrolls inside an inner .overflow-y-auto container
    // (html/body are overflow:hidden) — scroll THAT container.
    await dPage.evaluate(() => {
      const hero = document.querySelector('section#home');
      let el = hero;
      while (el && el !== document.documentElement) {
        const s = getComputedStyle(el);
        if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) {
          el.scrollTop = hero.getBoundingClientRect().bottom + el.scrollTop;
          window.__scroller = el;
          break;
        }
        el = el.parentElement;
      }
    });
    await sleep(900);
    report.playback.scrolledOut = await dPage.evaluate(() => {
      const hero = document.querySelector('section#home');
      const sc = window.__scroller;
      return {
        scrollerFound: !!sc,
        scrollerScrollTop: sc ? sc.scrollTop : null,
        heroBottomInViewport: hero.getBoundingClientRect().bottom <= 0,
        videoPaused: document.querySelector('section#home video').paused,
      };
    });
    console.log('[F1] scrolled-out pause:', JSON.stringify(report.playback.scrolledOut));
    // scroll back — should resume
    await dPage.evaluate(() => { if (window.__scroller) window.__scroller.scrollTop = 0; });
    await sleep(900);
    report.playback.resumedAfterScrollBack = await dPage.evaluate(() => {
      const v = document.querySelector('section#home video');
      return { paused: v.paused, t: +v.currentTime.toFixed(2) };
    });
    console.log('[F1b] resume after scroll-back:', JSON.stringify(report.playback.resumedAfterScrollBack));

    /* ============ F2. pause when tab hidden ============ */
    // Headless tabs don't background via bringToFront — try CDP lifecycle
    // freeze first, fall back to a synthetic visibilitychange with the
    // document.hidden property overridden (method recorded in the report).
    const cdp = await dPage.context().newCDPSession(dPage);
    let method = 'cdp-freeze';
    try {
      await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
      await sleep(700);
      let st = await dPage.evaluate(() => ({ hidden: document.hidden, state: document.visibilityState, paused: document.querySelector('section#home video').paused }));
      if (!st.hidden) {
        method = 'synthetic-visibilitychange';
        await dPage.evaluate(() => {
          Object.defineProperty(document, 'hidden', { value: true, configurable: true });
          Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await sleep(700);
        st = await dPage.evaluate(() => ({ hidden: document.hidden, state: document.visibilityState, paused: document.querySelector('section#home video').paused }));
      }
      report.playback.tabHidden = st;
    } catch (e) {
      method = 'failed: ' + e.message;
      report.playback.tabHidden = { error: e.message };
    }
    report.playback.tabHiddenMethod = method;
    console.log('[F2] tab-hidden pause (' + method + '):', JSON.stringify(report.playback.tabHidden));
    // unfreeze / restore visibility and confirm it resumes
    try {
      await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    } catch {}
    await dPage.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await sleep(900);
    report.playback.resumedAfterVisible = await dPage.evaluate(() => {
      const v = document.querySelector('section#home video');
      return { visibilityState: document.visibilityState, paused: v.paused, t: +v.currentTime.toFixed(2) };
    });
    console.log('[F2b] resume on visible:', JSON.stringify(report.playback.resumedAfterVisible));
    await cdp.detach().catch(() => {});

    report.network = netLog.map((e) => ({ ...e, url: e.url.replace(BASE, '') }));
    report.consoleErrors = consoleErrors;
    await dCtx.close();

    /* ============ B. mobile 390x844 ============ */
    const mCtx = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const mPage = await mCtx.newPage();
    await mPage.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    await mPage.waitForFunction(() => {
      const h = document.querySelector('h1');
      return h && parseFloat(getComputedStyle(h).opacity) > 0.9;
    }, { timeout: 15000 }).catch(() => {});
    await sleep(2000);
    await mPage.screenshot({ path: path.join(OUT, 'hero-390x844.png'), clip: { x: 0, y: 0, width: 390, height: 844 } });
    // mobile worst-case contrast sample (subcopy)
    const mRects = await mPage.evaluate(() => {
      const h1 = document.querySelector('section#home h1');
      const sub = h1.parentElement.querySelector('p.text-base, p[class*="text-slate-600"]');
      const r2 = sub.getBoundingClientRect();
      return { sub: { x: r2.x, y: r2.y, w: r2.width, h: r2.height } };
    });
    await mPage.evaluate(() => {
      const h1 = document.querySelector('section#home h1');
      const sub = h1.parentElement.querySelector('p.text-base, p[class*="text-slate-800"]');
      h1.style.visibility = 'hidden'; sub.style.visibility = 'hidden';
    });
    // sample 3 times across the loop (mobile is the tightest case)
    const mWorst = { mean: 1e9, rgb: null }, mWorstPixel = { lum: 1e9, rgb: null };
    for (let mi = 0; mi < 3; mi++) {
      await sleep(1500);
      const mShot = path.join(OUT, '_mbg.png');
      await mPage.screenshot({ path: mShot, clip: { x: 0, y: 0, width: 390, height: 844 } });
      const mImg = await getPixels(mShot);
      for (let y = Math.max(0, mRects.sub.y); y < mRects.sub.y + mRects.sub.h - 8; y += 6) {
        for (let x = Math.max(0, mRects.sub.x); x < mRects.sub.x + mRects.sub.w - 8; x += 6) {
          let sum = 0;
          for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 8; dx++) {
            const idx = ((y | 0) + dy) * mImg.width + ((x | 0) + dx);
            sum += 0.2126 * mImg.data[idx * 4] + 0.7152 * mImg.data[idx * 4 + 1] + 0.0722 * mImg.data[idx * 4 + 2];
          }
          const mean = sum / 64;
          const cidx = (((y | 0) + 4) * mImg.width + ((x | 0) + 4)) * 4;
          if (mean < mWorst.mean) mWorst.mean = mean, mWorst.rgb = [mImg.data[cidx], mImg.data[cidx + 1], mImg.data[cidx + 2]];
          const pl = 0.2126 * mImg.data[cidx] + 0.7152 * mImg.data[cidx + 1] + 0.0722 * mImg.data[cidx + 2];
          if (pl < mWorstPixel.lum) mWorstPixel.lum = pl, mWorstPixel.rgb = [mImg.data[cidx], mImg.data[cidx + 1], mImg.data[cidx + 2]];
        }
      }
      fs.unlinkSync(mShot);
    }
    report.contrast.mobileSubWorst = mWorst;
    report.contrast.mobileSubWorstPixel = mWorstPixel;
    await mCtx.close();
    console.log('[B] mobile screenshot saved');

    /* ============ E. prefers-reduced-motion ============ */
    const rCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
    const rPage = await rCtx.newPage();
    const rNet = [];
    recordNetwork(rPage, rNet);
    await rPage.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    await sleep(2500);
    report.reducedMotion = await rPage.evaluate(() => {
      const img = document.querySelector('section#home img[src*="vega-hero-poster"]');
      const video = document.querySelector('section#home video');
      return {
        stillImg: !!img, imgSrc: img ? img.getAttribute('src') : null,
        videoElement: !!video,
        matchesReduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      };
    });
    await rPage.screenshot({ path: path.join(OUT, 'hero-reduced-motion-1920x1080.png'), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    report.reducedMotion.videoRequests = rNet.filter((e) => e.phase === 'response').map((e) => ({ url: e.url.replace(BASE, ''), status: e.status }));
    await rCtx.close();
    console.log('[E] reduced-motion:', JSON.stringify(report.reducedMotion));

    await browser.close();

    /* ---------- summarize ---------- */
    const summary = {
      sanity: report.sanity,
      network: report.network,
      consoleErrors: report.consoleErrors,
      playback: report.playback,
      reducedMotion: report.reducedMotion,
      contrast: {
        textColors: report.contrast.textColors,
        loopSamples: report.contrast.filter((c) => c.loopSample !== undefined),
        mobileSubWorst: report.contrast.mobileSubWorst,
        mobileSubWorstPixel: report.contrast.mobileSubWorstPixel,
      },
    };
    fs.writeFileSync(path.join(OUT, 'acceptance-report.json'), JSON.stringify(summary, null, 2));
    console.log('\n===== SUMMARY =====');
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    server.proc.kill('SIGKILL');
  }
})().catch((e) => { console.error('HARNESS FAILED:', e); process.exit(1); });
