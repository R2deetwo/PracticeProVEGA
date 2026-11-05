#!/usr/bin/env node
/**
 * R68 — /vega clip-playlist hero: acceptance harness.
 * Runs against the production build via `vite preview`.
 *
 * Evidence collected:
 *  A. desktop 1920x1080: screenshot + GEOMETRY (the de-shove: band lifted
 *     off the section top by exactly 6rem; band box == 16:9 zero-crop;
 *     dashboard starts below the band foot) + sanity (muted, no controls,
 *     playsInline, 1920x1080, playing)
 *  B. THE CYCLE: the playlist runs typist -> cufflink -> typist; layer
 *     states recorded through a handoff (incoming fades over a HELD
 *     outgoing frame — never a dip to white); band crops of each clip
 *  C. WCAG on the real rendered backdrop (text hidden, worst 8x8 patch
 *     behind h1 / navy span / subcopy), BOTH clips, at 1920 AND 1536
 *     (the narrow-2xl depth where the copy runs deepest into the band)
 *  D. network: poster 200 before the webm 206; clip-2 fetches only near
 *     the handoff (preload="none" until the prefetch window)
 *  E. prefers-reduced-motion: still poster, ZERO video requests
 *  F. playback: pause on scroll-out (the app's inner scroller), resume on
 *     return; pause on tab-hidden, resume on visible — across the ACTIVE
 *     clip whichever it is
 *  G. mobile 390x844: copy FIRST, the clip card below it (the de-shove),
 *     card == 16:9, no veil on the card
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const REPO = '/home/z/my-project/tmp/pprepo';
const OUT = '/home/z/my-project/download/r68-clip-playlist';
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function srgb(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function relLum([r, g, b]) { return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b); }
function contrast(fg, bg) {
  const l1 = relLum(fg), l2 = relLum(bg);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}
async function getPixels(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
function hexToRgb(hex) {
  const m = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
}

function startServer() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return proc;
}
async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/version.json`); if (r.ok) return; } catch {}
    await sleep(500);
  }
  throw new Error('preview server never became ready');
}
function recordNetwork(page, log) {
  page.on('response', async (res) => {
    if (!res.url().includes('/video/')) return;
    let bytes = -1;
    try { bytes = (await res.body()).length; } catch {}
    log.push({ t: Date.now(), url: res.url().replace(BASE, ''), status: res.status(), bytes });
  });
}

(async () => {
  const server = startServer();
  try {
    await waitReady();
    const browser = await chromium.launch();
    const report = { network: [], contrast: [], reducedMotion: {}, playback: {}, sanity: {}, geometry: {}, cycle: {} };

    /* ============ A. desktop 1920: geometry + sanity + first screenshot ============ */
    const dCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const dPage = await dCtx.newPage();
    const netLog = [];
    recordNetwork(dPage, netLog);
    const consoleErrors = [];
    dPage.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

    await dPage.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    await dPage.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
    // Wait for the copy to be revealed (r66's pattern) — the blind event
    // alone can race the SPA's listener.
    await dPage.waitForFunction(() => {
      const h = document.querySelector('h1');
      return h && parseFloat(getComputedStyle(h).opacity) > 0.9;
    }, { timeout: 15000 }).catch(() => {});
    await dPage.waitForFunction(() => {
      const v = document.querySelector('section#home video');
      return v && v.readyState >= 2 && !v.paused && v.currentTime > 0.2;
    }, { timeout: 20000 }).catch(() => {});
    await sleep(2000);

    report.sanity = await dPage.evaluate(() => {
      const v = document.querySelector('section#home video');
      const all = [...document.querySelectorAll('section#home video')];
      if (!v) return { exists: false };
      return {
        exists: true, videoCount: all.length,
        muted: all.every(x => x.muted), controls: all.some(x => x.controls),
        playsInline: all.every(x => x.playsInline),
        w: v.videoWidth, h: v.videoHeight, duration: +v.duration.toFixed(3),
        firstPlaying: !all[0].paused,
        posterEl: !!document.querySelector('section#home video[poster*="vega-hero-poster"]'),
        secondClipHasNoPoster: !all[1] || !all[1].getAttribute('poster'),
      };
    });
    report.geometry.desktop = await dPage.evaluate(() => {
      const section = document.querySelector('section#home');
      const band = document.querySelector('section#home video')?.closest('div.relative, div[class*="aspect-video"]');
      const bandBox = [...document.querySelectorAll('section#home video')].map(v => v.getBoundingClientRect())[0];
      const card = band?.getBoundingClientRect();
      const dash = [...document.querySelectorAll('section#home img')].find(i => i.src.includes('dashboard.jpg'))?.getBoundingClientRect();
      const h1 = document.querySelector('section#home h1')?.getBoundingClientRect();
      return {
        sectionTop: section.getBoundingClientRect().top,
        bandTopInSection: +(card.top - section.getBoundingClientRect().top).toFixed(1),
        bandBox: { w: +card.width.toFixed(1), h: +card.height.toFixed(1), ratio: +(card.width / card.height).toFixed(4) },
        videoBox: { w: +bandBox.width.toFixed(1), h: +bandBox.height.toFixed(1) },
        dashboardTopVsBandBottom: dash && card ? +(dash.top - card.bottom).toFixed(1) : null,
        copyOnBand: h1 ? +(h1.top - card.top).toFixed(1) : null,
        bandBelowNavbar: +(card.top).toFixed(1),
      };
    });
    await dPage.screenshot({ path: path.join(OUT, 'hero-1920x1080.png') });
    console.log('[A] desktop:', JSON.stringify(report.geometry.desktop));

    /* ============ B. the cycle: typist -> cufflink -> typist ============ */
    // Clip 1 is ~7.96s; the advance fires ~0.85s before its end. Poll the
    // layer stack every 120ms, recording handoffs, then crop the band at
    // three moments: clip 1 live, clip 2 live, clip 1 again.
    const bandClip = async (name) => {
      const box = await dPage.evaluate(() => {
        const b = document.querySelector('section#home video').closest('div[class*="aspect-video"]').getBoundingClientRect();
        return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: b.width, height: b.height };
      });
      await dPage.screenshot({ path: path.join(OUT, name), clip: box });
    };
    const layerState = () => dPage.evaluate(() => {
      const sec = document.querySelector('section#home');
      const vids = [...sec.querySelectorAll('video')];
      const layers = vids.map(v => {
        const l = v.parentElement;
        const cs = getComputedStyle(l);
        return { src: v.currentSrc.split('/').pop(), opacity: +cs.opacity, z: cs.zIndex, t: +v.currentTime.toFixed(2), paused: v.paused, preload: v.preload };
      });
      const top = layers.reduce((a, b) => (+a.z > +b.z ? a : b));
      return { layers, activeSrc: top.src, activeT: top.t };
    });
    // moment 1: clip 1 live
    await bandClip('cycle-1-typist.png');
    // watch for the handoff to clip 2 (up to 12s), recording the fade
    let handoffSeen = null;
    for (let i = 0; i < 100; i++) {
      const st = await layerState();
      const incoming = st.layers.find(l => l.src.includes('vega-hero-2') && +l.z === 30);
      const outgoing = st.layers.find(l => l.src.includes('vega-hero.webm') && +l.z === 30);
      if (incoming && incoming.opacity < 1 && incoming.opacity > 0.02) {
        const held = st.layers.find(l => l.src.includes('vega-hero.webm'));
        handoffSeen = { incomingOpacity: incoming.opacity, heldUnder: held ? held.opacity : null, heldZ: held ? held.z : null, t: incoming.t };
        break;
      }
      if (incoming && incoming.opacity >= 1) { handoffSeen = { incomingOpacity: 1, note: 'fade already complete when polled', t: incoming.t }; break; }
      await sleep(120);
    }
    report.cycle.handoff = handoffSeen;
    await sleep(1200); // let the dissolve land
    const after = await layerState();
    report.cycle.afterFirstHandoff = after;
    await bandClip('cycle-2-cufflink.png');
    // watch for the wrap back to clip 1 (up to 12s more)
    let wrapSeen = false;
    for (let i = 0; i < 100; i++) {
      const st = await layerState();
      if (st.activeSrc.includes('vega-hero.webm') && st.activeT < 6) { wrapSeen = true; break; }
      await sleep(120);
    }
    report.cycle.wrappedBackToTypist = wrapSeen;
    await bandClip('cycle-3-typist-again.png');
    console.log('[B] cycle:', JSON.stringify({ handoff: handoffSeen, wrapped: wrapSeen }));

    /* ============ C. WCAG on the real render, both clips, 1920 ============ */
    const contrastAt = async (label) => {
      const rects = await dPage.evaluate(() => {
        const h1 = document.querySelector('section#home h1');
        const sub = [...h1.parentElement.querySelectorAll('p')].find(p => p.className.includes('text-slate-800'));
        const navy = h1.querySelector('span');
        const r1 = h1.getBoundingClientRect(), r2 = sub.getBoundingClientRect();
        return {
          h1: { x: r1.x, y: r1.y, w: r1.width, h: r1.height, color: getComputedStyle(h1).color },
          sub: { x: r2.x, y: r2.y, w: r2.width, h: r2.height, color: getComputedStyle(sub).color },
          navy: { x: navy.getBoundingClientRect().x - r1.x, color: getComputedStyle(navy).color },
        };
      });
      await dPage.evaluate(() => {
        const h1 = document.querySelector('section#home h1');
        const sub = [...h1.parentElement.querySelectorAll('p')].find(p => p.className.includes('text-slate-800'));
        h1.style.visibility = 'hidden'; sub.style.visibility = 'hidden';
      });
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
            if (!worst || mean < worst.mean) worst = { mean, rgb: [png.data[((y + 4) * png.width + (x + 4)) * 4], png.data[((y + 4) * png.width + (x + 4)) * 4 + 1], png.data[((y + 4) * png.width + (x + 4)) * 4 + 2]] };
          }
        }
        return worst;
      };
      const out = { label, samples: [] };
      for (let i = 0; i < 4; i++) {
        await sleep(1500);
        const shot = path.join(OUT, `_bg.png`);
        await dPage.screenshot({ path: shot });
        const png = await getPixels(shot);
        const h1W = sample(rects.h1, png), subW = sample(rects.sub, png);
        out.samples.push({
          h1: +contrast(hexToRgb(rects.h1.color), h1W.rgb).toFixed(2),
          sub: +contrast(hexToRgb(rects.sub.color), subW.rgb).toFixed(2),
          navyApprox: +contrast(hexToRgb(rects.navy.color), h1W.rgb).toFixed(2),
        });
        fs.unlinkSync(shot);
      }
      out.worst = {
        h1: Math.min(...out.samples.map(s => s.h1)),
        sub: Math.min(...out.samples.map(s => s.sub)),
        navyApprox: Math.min(...out.samples.map(s => s.navyApprox)),
      };
      out.pass = out.worst.h1 >= 3.0 && out.worst.navyApprox >= 3.0 && out.worst.sub >= 4.5;
      await dPage.evaluate(() => {
        const h1 = document.querySelector('section#home h1');
        const sub = [...h1.parentElement.querySelectorAll('p')].find(p => p.className.includes('text-slate-800'));
        h1.style.visibility = ''; sub.style.visibility = '';
      });
      report.contrast.push(out);
      console.log(`[C] ${label}: worst h1=${out.worst.h1} navy~${out.worst.navyApprox} sub=${out.worst.sub} pass=${out.pass}`);
    };
    // whichever clip is active now (clip 1 after the wrap) — sample it…
    const activeNow = await layerState();
    await contrastAt(`desktop-1920-${activeNow.activeSrc.includes('-2') ? 'cufflink' : 'typist'}`);
    // …then force the other clip: seek the active one to just before the
    // advance point and wait for the handoff.
    const forceOther = async () => {
      await dPage.evaluate(() => {
        const vids = [...document.querySelectorAll('section#home video')];
        const top = vids.find(v => +getComputedStyle(v.parentElement).zIndex === 30) || vids[0];
        top.currentTime = Math.max(0, top.duration - 2.6);
      });
      for (let i = 0; i < 60; i++) {
        await sleep(200);
        const st = await layerState();
        if (st.activeT < 1.5 && st.activeSrc !== activeNow.activeSrc) return st.activeSrc;
      }
      return null;
    };
    const other = await forceOther();
    if (other) await contrastAt(`desktop-1920-${other.includes('-2') ? 'cufflink' : 'typist'}`);

    /* ============ C2. WCAG at 1536 (narrow 2xl — copy runs deepest) ============ */
    const d2Ctx = await browser.newContext({ viewport: { width: 1536, height: 900 } });
    const d2Page = await d2Ctx.newPage();
    await d2Page.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    await d2Page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
    await d2Page.waitForFunction(() => {
      const v = document.querySelector('section#home video');
      return v && v.readyState >= 2 && !v.paused && v.currentTime > 0.2;
    }, { timeout: 20000 }).catch(() => {});
    await sleep(1500);
    // sample the typist first…
    // (reuse the same routine inline — page-scoped)
    const contrastAt1536 = async (label) => {
      const rects = await d2Page.evaluate(() => {
        const h1 = document.querySelector('section#home h1');
        const sub = [...h1.parentElement.querySelectorAll('p')].find(p => p.className.includes('text-slate-800'));
        const r1 = h1.getBoundingClientRect(), r2 = sub.getBoundingClientRect();
        return {
          h1: { x: r1.x, y: r1.y, w: r1.width, h: r1.height, color: getComputedStyle(h1).color },
          sub: { x: r2.x, y: r2.y, w: r2.width, h: r2.height, color: getComputedStyle(sub).color },
        };
      });
      await d2Page.evaluate(() => {
        const h1 = document.querySelector('section#home h1');
        const sub = [...h1.parentElement.querySelectorAll('p')].find(p => p.className.includes('text-slate-800'));
        h1.style.visibility = 'hidden'; sub.style.visibility = 'hidden';
      });
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
            if (!worst || mean < worst.mean) worst = { mean, rgb: [png.data[((y + 4) * png.width + (x + 4)) * 4], png.data[((y + 4) * png.width + (x + 4)) * 4 + 1], png.data[((y + 4) * png.width + (x + 4)) * 4 + 2]] };
          }
        }
        return worst;
      };
      const out = { label, samples: [] };
      for (let i = 0; i < 3; i++) {
        await sleep(1500);
        const shot = path.join(OUT, `_bg2.png`);
        await d2Page.screenshot({ path: shot });
        const png = await getPixels(shot);
        const h1W = sample(rects.h1, png), subW = sample(rects.sub, png);
        out.samples.push({
          h1: +contrast(hexToRgb(rects.h1.color), h1W.rgb).toFixed(2),
          sub: +contrast(hexToRgb(rects.sub.color), subW.rgb).toFixed(2),
        });
        fs.unlinkSync(shot);
      }
      out.worst = { h1: Math.min(...out.samples.map(s => s.h1)), sub: Math.min(...out.samples.map(s => s.sub)) };
      out.pass = out.worst.h1 >= 3.0 && out.worst.sub >= 4.5;
      await d2Page.evaluate(() => {
        const h1 = document.querySelector('section#home h1');
        const sub = [...h1.parentElement.querySelectorAll('p')].find(p => p.className.includes('text-slate-800'));
        h1.style.visibility = ''; sub.style.visibility = '';
      });
      report.contrast.push(out);
      console.log(`[C2] ${label}: worst h1=${out.worst.h1} sub=${out.worst.sub} pass=${out.pass}`);
    };
    await contrastAt1536('narrow-2xl-1536-typist');
    await d2Page.evaluate(() => {
      const vids = [...document.querySelectorAll('section#home video')];
      const top = vids.find(v => +getComputedStyle(v.parentElement).zIndex === 30) || vids[0];
      top.currentTime = Math.max(0, top.duration - 2.6);
    });
    await sleep(2600);
    await contrastAt1536('narrow-2xl-1536-cufflink');
    report.geometry.narrow2xl = await d2Page.evaluate(() => {
      const band = document.querySelector('section#home video').closest('div[class*="aspect-video"]').getBoundingClientRect();
      return { bandTop: +band.top.toFixed(1), w: +band.width.toFixed(1), h: +band.height.toFixed(1), ratio: +(band.width / band.height).toFixed(4) };
    });
    await d2Page.screenshot({ path: path.join(OUT, 'hero-1536x900.png') });
    await d2Ctx.close();

    /* ============ F. pause on scroll-out + tab hidden (desktop page) ============ */
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
      const vids = [...document.querySelectorAll('section#home video')];
      const top = vids.find(v => +getComputedStyle(v.parentElement).zIndex === 30) || vids[0];
      return { allPaused: vids.every(v => v.paused), activeT: +top.currentTime.toFixed(2) };
    });
    await dPage.evaluate(() => { if (window.__scroller) window.__scroller.scrollTop = 0; });
    await sleep(900);
    report.playback.resumedAfterScrollBack = await dPage.evaluate(() => {
      const vids = [...document.querySelectorAll('section#home video')];
      const top = vids.find(v => +getComputedStyle(v.parentElement).zIndex === 30) || vids[0];
      return { activePaused: top.paused, t: +top.currentTime.toFixed(2) };
    });
    // tab-hidden: synthetic visibilitychange (headless cannot background)
    await dPage.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await sleep(700);
    report.playback.tabHidden = await dPage.evaluate(() => {
      const vids = [...document.querySelectorAll('section#home video')];
      return { allPaused: vids.every(v => v.paused) };
    });
    await dPage.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await sleep(900);
    report.playback.resumedAfterVisible = await dPage.evaluate(() => {
      const vids = [...document.querySelectorAll('section#home video')];
      const top = vids.find(v => +getComputedStyle(v.parentElement).zIndex === 30) || vids[0];
      return { activePaused: top.paused, t: +top.currentTime.toFixed(2) };
    });
    console.log('[F] playback:', JSON.stringify(report.playback));

    report.network = netLog;
    report.consoleErrors = consoleErrors;
    await dCtx.close();

    /* ============ G. mobile 390x844 ============ */
    const mCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mPage = await mCtx.newPage();
    await mPage.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    await mPage.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
    await sleep(2200);
    report.geometry.mobile = await mPage.evaluate(() => {
      const h1 = document.querySelector('section#home h1').getBoundingClientRect();
      const card = document.querySelector('section#home video')?.closest('div[class*="aspect-video"]')?.getBoundingClientRect();
      const veil = [...document.querySelectorAll('section#home div')].filter(d => {
        const cs = getComputedStyle(d);
        return cs.display !== 'none' && (cs.backgroundImage.includes('linear-gradient') || (cs.backgroundColor.includes('rgba(255, 255, 255') && cs.opacity !== '0')) && d.closest('div[class*="aspect-video"]') && cs.position === 'absolute';
      }).length;
      return {
        copyFirst: card ? +(card.top - h1.bottom).toFixed(1) : null,
        cardBox: card ? { w: +card.width.toFixed(1), h: +card.height.toFixed(1), ratio: +(card.width / card.height).toFixed(4) } : null,
        cardTop: card ? +card.top.toFixed(1) : null,
        veilDivsVisibleInCard: veil,
        cardRounded: card ? getComputedStyle(document.querySelector('section#home video').closest('div[class*="aspect-video"]')).borderRadius : null,
      };
    });
    await mPage.screenshot({ path: path.join(OUT, 'hero-390x844.png') });
    // scroll to the card and crop it
    await mPage.evaluate(() => {
      const card = document.querySelector('section#home video').closest('div[class*="aspect-video"]');
      let el = card;
      while (el && el !== document.documentElement) {
        const s = getComputedStyle(el);
        if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) { el.scrollTop += card.getBoundingClientRect().top - 120; break; }
        el = el.parentElement;
      }
    });
    await sleep(1200);
    await mPage.screenshot({ path: path.join(OUT, 'mobile-card-390.png') });
    console.log('[G] mobile:', JSON.stringify(report.geometry.mobile));
    await mCtx.close();

    /* ============ E. reduced motion ============ */
    const rCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await rCtx.addInitScript(() => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      Object.defineProperty(mq, 'matches', { value: true });
      window.matchMedia = () => mq;
    });
    const rPage = await rCtx.newPage();
    const rNet = [];
    recordNetwork(rPage, rNet);
    await rPage.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    await sleep(2500);
    report.reducedMotion = await rPage.evaluate(() => ({
      videoCount: document.querySelectorAll('section#home video').length,
      posterImg: !!document.querySelector('section#home img[src*="vega-hero-poster"]'),
    }));
    report.reducedMotion.videoRequests = rNet.filter(e => e.url.endsWith('.webm') || e.url.endsWith('.mp4')).length;
    await rPage.screenshot({ path: path.join(OUT, 'reduced-motion-1920.png') });
    console.log('[E] reduced motion:', JSON.stringify(report.reducedMotion));
    await rCtx.close();

    fs.writeFileSync(path.join(OUT, 'r68-report.json'), JSON.stringify(report, null, 2));
    console.log('report ->', path.join(OUT, 'r68-report.json'));
    await browser.close();
  } finally {
    server.kill('SIGTERM');
  }
})();
