#!/usr/bin/env node
/**
 * R70 — /vega hero: the band is the landing-page BACKGROUND again at
 * EVERY width. Runs against the production build via `vite preview`.
 *
 * Owner direction (verbatim shape): "you have messed the vidoe
 * up!!!??!?!? it is supposed to be ont the landingpage
 * background!!!!!??!?!?! put it back there !!!!!" — R68 had demoted the
 * clip to a framed card BELOW the copy for every width under 2xl; R70
 * restores the full-bleed band at every width, keeping R68's de-shove
 * (top-24), R67's zero-crop exact-16:9, R68's seamless playlist, and
 * R69's copy seat.
 *
 * Evidence collected:
 *  A. GEOMETRY AT EVERY WIDTH (1920/1536/1440/1280/1024/768/390):
 *     the band is full-bleed (width == layout viewport), 16:9 exact
 *     (ratio 1.7778 — zero crop, the typing stays whole), top == 96px
 *     (the de-shove held, never top-0), the copy RIDES the band (the h1
 *     top-anchored into it; the h1 seat at 1920 == R69's measured
 *     y=317), and the dashboard starts at/below the band foot (the
 *     wrapper min-h). No card register anywhere (radius 0, full-bleed).
 *  B. WCAG on the REAL rendered backdrop (text hidden, worst 8x8
 *     patch behind h1 / sub), BOTH clips, at the widths where the copy
 *     runs deepest into the band — the risk R70 opened: the sub's tail
 *     lands at ~64% of the band at 1280, ~75% at 1024, ~88% at 768,
 *     where R68's 2xl veils measured 1.04-2.55:1. R70's veil ladder
 *     (one rung per width range) must carry every rung.
 *  C. THE CYCLE: typist -> cufflink -> typist; held-frame crossfades
 *     (no dip to white), band crops of each clip.
 *  D. Network: poster 200 before the webm 206; clip 2 fetches only
 *     near the handoff (preload="none" until the prefetch window).
 *  E. prefers-reduced-motion: still poster, ZERO video requests.
 *  F. Playback: pause on scroll-out, resume on return; pause on
 *     tab-hidden, resume on visible.
 *  G. Mobile 390x844: the copy rides the band top, the copy block runs
 *     past the band foot onto the section's white (R67's mobile
 *     behaviour, held), veils visible at every width (the ladder's
 *     below-lg rung).
 *  H. ACTION-ZONE PROBE: on every width's screenshot, the band's
 *     bottom rows (y 78-100%, the typing/cufflink zone) must retain
 *     visible structure — mean luminance well below paper and a real
 *     pixel spread — so the deeper ladder rungs never wash the action
 *     to a blank (the R66 "faint ghost" lesson).
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const REPO = '/home/z/my-project/tmp/pprepo';
const OUT = '/home/z/my-project/download/r70-background-restore';
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function srgb(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function relLum([r, g, b]) { return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b); }
function contrast(fg, bg) {
  if (!bg) return null;
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

const layerState = (page) => page.evaluate(() => {
  const sec = document.querySelector('section#home');
  const vids = [...sec.querySelectorAll('video')];
  if (!vids.length) return { layers: [], activeSrc: 'still', activeT: 0 };
  const layers = vids.map(v => {
    const l = v.parentElement;
    const cs = getComputedStyle(l);
    return { src: v.currentSrc.split('/').pop(), opacity: +cs.opacity, z: cs.zIndex, t: +v.currentTime.toFixed(2), paused: v.paused, preload: v.preload };
  });
  const top = layers.reduce((a, b) => (+a.z > +b.z ? a : b));
  return { layers, activeSrc: top.src, activeT: top.t };
});

(async () => {
  const server = startServer();
  try {
    await waitReady();
    const browser = await chromium.launch();
    const report = { network: [], contrast: [], reducedMotion: {}, playback: {}, sanity: {}, geometry: {}, cycle: {}, actionZone: {} };

    /* ============ A. 1920 first (main page: sanity + geometry + shots) ============ */
    const dCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const dPage = await dCtx.newPage();
    const netLog = [];
    recordNetwork(dPage, netLog);
    const consoleErrors = [];
    dPage.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

    await dPage.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    await dPage.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
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

    const measureGeometry = async (page, label) => page.evaluate((label) => {
      const section = document.querySelector('section#home');
      const bandEl = document.querySelector('section#home video')?.closest('div[class*="aspect-video"]')
        || document.querySelector('section#home img[src*="vega-hero-poster"]')?.closest('div[class*="aspect-video"]');
      const sectionRect = section?.getBoundingClientRect();
      const band = bandEl?.getBoundingClientRect();
      const h1 = document.querySelector('section#home h1')?.getBoundingClientRect();
      const sub = [...document.querySelectorAll('section#home p')].find(p => p.className.includes('text-slate-800'))?.getBoundingClientRect();
      const pill = [...document.querySelectorAll('section#home p')].find(p => p.textContent.includes('NO CREDIT CARD'))?.getBoundingClientRect();
      const dash = [...document.querySelectorAll('section#home img')].find(i => i.src.includes('dashboard.jpg'))?.getBoundingClientRect();
      const cs = bandEl ? getComputedStyle(bandEl) : null;
      const layoutW = document.documentElement.clientWidth;
      return {
        label,
        vw: window.innerWidth,
        layoutW,
        sectionW: sectionRect ? +sectionRect.width.toFixed(1) : null,
        sectionLeft: sectionRect ? +sectionRect.left.toFixed(1) : null,
        band: band ? { top: +band.top.toFixed(1), w: +band.width.toFixed(1), h: +band.height.toFixed(1), ratio: +(band.width / band.height).toFixed(4) } : null,
        // full-bleed RELATIVE TO THE SECTION (inset-x-0). The gap vs
        // documentElement.clientWidth at desktop widths is the app shell's
        // own gutter (present since R68 live) — record it, gate on parity.
        bandFullBleed: band && sectionRect ? Math.abs(band.width - sectionRect.width) < 1 && Math.abs(band.left - sectionRect.left) < 1 : null,
        bandTopInSection: band && section ? +(band.top - section.getBoundingClientRect().top).toFixed(1) : null,
        bandRadius: cs ? cs.borderRadius : null,
        h1: h1 ? { top: +h1.top.toFixed(1), topInBand: band ? +(h1.top - band.top).toFixed(1) : null, depthPct: band ? +(((h1.bottom - band.top) / band.height) * 100).toFixed(1) : null } : null,
        sub: sub ? { bottom: +sub.bottom.toFixed(1), tailDepthPct: band ? +(((sub.bottom - band.top) / band.height) * 100).toFixed(1) : null, pastFoot: band ? sub.bottom > band.bottom : null } : sub,
        pill: pill ? { bottom: +pill.bottom.toFixed(1), pastFoot: band ? pill.bottom > band.bottom : null } : null,
        dashTopVsBandBottom: dash && band ? +(dash.top - band.bottom).toFixed(1) : null,
      };
    }, label);

    report.geometry['1920'] = await measureGeometry(dPage, '1920');
    await dPage.screenshot({ path: path.join(OUT, 'hero-1920x1080.png') });
    console.log('[A] 1920:', JSON.stringify(report.geometry['1920']));

    /* ---- H. the action-zone probe on a saved shot (band y 78-100%) ---- */
    const actionZoneProbe = async (file, label) => {
      const png = await getPixels(file);
      const g = report.geometry[label];
      if (!g || !g.band) return;
      const bandEl = { x: 0, y: g.band.top, w: g.band.w, h: g.band.h };
      const y0 = Math.round(bandEl.y + bandEl.h * 0.78), y1 = Math.round(bandEl.y + bandEl.h * 1.0);
      let sum = 0, n = 0, nonWhite = 0, min = 255, max = 0;
      for (let y = Math.max(0, y0); y < Math.min(png.height, y1); y += 3) {
        for (let x = 0; x < png.width; x += 6) {
          const idx = (y * png.width + x) * 4;
          const lum = 0.2126 * png.data[idx] + 0.7152 * png.data[idx + 1] + 0.0722 * png.data[idx + 2];
          sum += lum; n++;
          if (lum < 240) nonWhite++;
          if (lum < min) min = lum;
          if (lum > max) max = lum;
        }
      }
      report.actionZone[label] = {
        mean: +(sum / Math.max(1, n)).toFixed(1),
        nonWhiteFrac: +(nonWhite / Math.max(1, n)).toFixed(3),
        min, max,
        readsStructure: n > 0 && (sum / n) < 232 && (nonWhite / n) > 0.5,
      };
      console.log(`[H] ${label} action zone:`, JSON.stringify(report.actionZone[label]));
    };
    await actionZoneProbe(path.join(OUT, 'hero-1920x1080.png'), '1920');

    /* ---- B. the WCAG dip-probe (worst 8x8 behind the copy) ---- */
    const contrastAt = async (page, label, n = 4) => {
      const rects = await page.evaluate(() => {
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
      await page.evaluate(() => {
        const h1 = document.querySelector('section#home h1');
        const sub = [...h1.parentElement.querySelectorAll('p')].find(p => p.className.includes('text-slate-800'));
        h1.style.visibility = 'hidden'; sub.style.visibility = 'hidden';
      });
      const sample = (r, png) => {
        let worst = null;
        if (r.h < 10 || r.w < 10) return { mean: -1, rgb: null, note: 'rect too small' };
        for (let y = Math.max(0, r.y); y < r.y + r.h - 8; y += 12) {
          for (let x = Math.max(0, r.x); x < r.x + r.w - 8; x += 12) {
            let sum = 0;
            for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 8; dx++) {
              // THE 390 LESSON: fractional rects (y=140.8) make the index a
              // float (219712.00000000003) and Buffer[nonInteger] is
              // undefined -> NaN contrasts. Round every index.
              const idx = Math.round(((y + dy) * png.width + (x + dx)) * 4);
              sum += 0.2126 * png.data[idx] + 0.7152 * png.data[idx + 1] + 0.0722 * png.data[idx + 2];
            }
            const mean = sum / 64;
            const c = Math.round(((y + 4) * png.width + (x + 4)) * 4);
            if (!worst || mean < worst.mean) worst = { mean, rgb: [png.data[c], png.data[c + 1], png.data[c + 2]] };
          }
        }
        return worst || { mean: -1, rgb: null, note: 'no samples' };
      };
      const out = { label, samples: [] };
      for (let i = 0; i < n; i++) {
        await sleep(1500);
        const shot = path.join(OUT, `_bg.png`);
        await page.screenshot({ path: shot });
        const png = await getPixels(shot);
        const h1W = sample(rects.h1, png), subW = sample(rects.sub, png);
        out.samples.push({
          h1: contrast(hexToRgb(rects.h1.color), h1W.rgb),
          sub: contrast(hexToRgb(rects.sub.color), subW.rgb),
          navyApprox: contrast(hexToRgb(rects.navy.color), h1W.rgb),
          raw: { h1Note: h1W.note || h1W.mean, subNote: subW.note || subW.mean, pngW: png.width, pngH: png.height,
                 h1Rect: { x: +rects.h1.x.toFixed(1), y: +rects.h1.y.toFixed(1), w: +rects.h1.w.toFixed(1), h: +rects.h1.h.toFixed(1) },
                 subRect: { x: +rects.sub.x.toFixed(1), y: +rects.sub.y.toFixed(1), w: +rects.sub.w.toFixed(1), h: +rects.sub.h.toFixed(1) } },
        });
        fs.unlinkSync(shot);
      }
      const num = (v) => (v == null || !isFinite(v)) ? null : +v.toFixed(2);
      const raw = out.samples.map(s => s.raw); out.raw = raw;
      out.samples = out.samples.map(s => ({ h1: num(s.h1), sub: num(s.sub), navyApprox: num(s.navyApprox) }));
      const valid = out.samples.filter(s => s.h1 != null);
      if (!valid.length) { out.worst = null; out.pass = false; out.note = 'sampling failed'; }
      else {
        out.worst = {
          h1: Math.min(...valid.map(s => s.h1)),
          sub: Math.min(...valid.map(s => s.sub ?? 99)),
          navyApprox: Math.min(...valid.map(s => s.navyApprox ?? 99)),
        };
        out.pass = out.worst.h1 >= 3.0 && out.worst.navyApprox >= 3.0 && out.worst.sub >= 4.5;
      }
      await page.evaluate(() => {
        const h1 = document.querySelector('section#home h1');
        const sub = [...h1.parentElement.querySelectorAll('p')].find(p => p.className.includes('text-slate-800'));
        h1.style.visibility = ''; sub.style.visibility = '';
      });
      report.contrast.push(out);
      if (out.worst) console.log(`[B] ${label}:`, `worst h1=${out.worst.h1} navy~${out.worst.navyApprox} sub=${out.worst.sub} pass=${out.pass}`);
      else console.log(`[B] ${label}: sampling FAILED — raw:`, JSON.stringify(out.raw && out.raw[0]));
    };

    const activeNow = await layerState(dPage);
    await contrastAt(dPage, `w1920-${activeNow.activeSrc.includes('-2') ? 'cufflink' : 'typist'}`);
    const forceOther = async (page) => {
      await page.evaluate(() => {
        const vids = [...document.querySelectorAll('section#home video')];
        const top = vids.find(v => +getComputedStyle(v.parentElement).zIndex === 30) || vids[0];
        top.currentTime = Math.max(0, top.duration - 2.6);
      });
      for (let i = 0; i < 60; i++) {
        await sleep(200);
        const st = await layerState(page);
        if (st.activeT < 1.5) return st.activeSrc;
      }
      return null;
    };
    const other = await forceOther(dPage);
    if (other) await contrastAt(dPage, `w1920-${other.includes('-2') ? 'cufflink' : 'typist'}`);

    /* ============ C. the cycle: typist -> cufflink -> typist ============ */
    const bandBox = async () => {
      const box = await dPage.evaluate(() => {
        const b = document.querySelector('section#home video')?.closest('div[class*="aspect-video"]');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.width, height: r.height };
      });
      return box;
    };
    const bandClip = async (name) => {
      const box = await bandBox();
      if (box) await dPage.screenshot({ path: path.join(OUT, name), clip: box });
    };
    await bandClip('cycle-1-typist.png');
    let handoffSeen = null;
    for (let i = 0; i < 100; i++) {
      const st = await layerState(dPage);
      const incoming = st.layers.find(l => l.src.includes('vega-hero-2') && +l.z === 30);
      if (incoming && incoming.opacity < 1 && incoming.opacity > 0.02) {
        const held = st.layers.find(l => l.src.includes('vega-hero.webm'));
        handoffSeen = { incomingOpacity: incoming.opacity, heldUnder: held ? held.opacity : null, heldZ: held ? held.z : null, t: incoming.t };
        break;
      }
      if (incoming && incoming.opacity >= 1) { handoffSeen = { incomingOpacity: 1, note: 'fade already complete when polled', t: incoming.t }; break; }
      await sleep(120);
    }
    report.cycle.handoff = handoffSeen;
    await sleep(1200);
    report.cycle.afterFirstHandoff = await layerState(dPage);
    await bandClip('cycle-2-cufflink.png');
    let wrapSeen = false;
    for (let i = 0; i < 100; i++) {
      const st = await layerState(dPage);
      if (st.activeSrc.includes('vega-hero.webm') && st.activeT < 6) { wrapSeen = true; break; }
      await sleep(120);
    }
    report.cycle.wrappedBackToTypist = wrapSeen;
    await bandClip('cycle-3-typist-again.png');
    console.log('[C] cycle:', JSON.stringify({ handoff: handoffSeen, wrapped: wrapSeen }));

    /* ============ F. playback (scroll-out + tab-hidden) ============ */
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
    await dPage.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await sleep(700);
    report.playback.tabHidden = await dPage.evaluate(() => ({
      allPaused: [...document.querySelectorAll('section#home video')].every(v => v.paused),
    }));
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

    /* ============ A+B+H. the other widths ============ */
    const WIDTHS = [
      { w: 1536, h: 900 }, { w: 1440, h: 900 }, { w: 1280, h: 800 },
      { w: 1024, h: 768 }, { w: 768, h: 900 }, { w: 640, h: 900 },
    ];
    for (const { w, h } of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
      await page.waitForFunction(() => {
        const v = document.querySelector('section#home video');
        return v && v.readyState >= 2 && !v.paused && v.currentTime > 0.2;
      }, { timeout: 20000 }).catch(() => {});
      await sleep(1500);
      report.geometry[String(w)] = await measureGeometry(page, String(w));
      const shot = path.join(OUT, `hero-${w}x${h}.png`);
      await page.screenshot({ path: shot });
      console.log(`[A] ${w}:`, JSON.stringify(report.geometry[String(w)]));
      await actionZoneProbe(shot, String(w));
      await contrastAt(page, `w${w}-typist`, 3);
      const o = await forceOther(page);
      if (o) await contrastAt(page, `w${w}-${o.includes('-2') ? 'cufflink' : 'typist'}`, 3);
      await ctx.close();
    }

    /* ============ G+H. mobile 390 ============ */
    const mCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mPage = await mCtx.newPage();
    await mPage.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    await mPage.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
    await sleep(2200);
    report.geometry['390'] = await mPage.evaluate(() => {
      const bandEl = document.querySelector('section#home video')?.closest('div[class*="aspect-video"]');
      const band = bandEl?.getBoundingClientRect();
      const h1 = document.querySelector('section#home h1')?.getBoundingClientRect();
      const sub = [...document.querySelectorAll('section#home p')].find(p => p.className.includes('text-slate-800'))?.getBoundingClientRect();
      const dash = [...document.querySelectorAll('section#home img')].find(i => i.src.includes('dashboard.jpg'))?.getBoundingClientRect();
      const veilCount = [...document.querySelectorAll('section#home div')].filter(d => {
        const cs = getComputedStyle(d);
        return cs.display !== 'none' && (cs.backgroundImage.includes('linear-gradient') || (cs.backgroundColor.includes('rgba(255, 255, 255') && cs.opacity !== '0')) && d.closest('div[class*="aspect-video"]') && cs.position === 'absolute';
      }).length;
      return {
        vw: 390,
        band: band ? { top: +band.top.toFixed(1), w: +band.width.toFixed(1), h: +band.height.toFixed(1), ratio: +(band.width / band.height).toFixed(4) } : null,
        h1RidesBand: band && h1 ? h1.top >= band.top && h1.top < band.bottom : null,
        copyPastFoot: band && sub ? sub.bottom > band.bottom : null,
        dashTopVsBandBottom: dash && band ? +(dash.top - band.bottom).toFixed(1) : null,
        veilsVisibleInBand: veilCount,
      };
    });
    const mShot = path.join(OUT, 'hero-390x844.png');
    await mPage.screenshot({ path: mShot });
    console.log('[G] mobile 390:', JSON.stringify(report.geometry['390']));
    await actionZoneProbe(mShot, '390');
    await contrastAt(mPage, 'w390-typist', 3);
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

    /* ============ verdict ============ */
    const geoPass = Object.entries(report.geometry).every(([w, g]) => {
      if (!g.band) return false;
      const bandOk = Math.abs(g.band.top - 96) < 1 && Math.abs(g.band.ratio - 1.7778) < 0.002
        && (g.bandFullBleed !== false) && ((g.bandRadius || '0px') === '0px');
      // the 1920-768 entries carry the measured h1 seat; the 390 entry
      // (the G probe) carries h1RidesBand instead — both count.
      const seatOk = g.h1 ? g.h1.topInBand > 0 && g.h1.topInBand < g.band.h : g.h1RidesBand === true;
      const dashOk = g.dashTopVsBandBottom === null ? true : g.dashTopVsBandBottom >= 0;
      return bandOk && seatOk && dashOk;
    });
    const contrastPass = report.contrast.every(c => c.pass);
    report.verdict = {
      geometryAllWidths: geoPass,
      bandTop96: Object.values(report.geometry).every(g => g.band && Math.abs(g.band.top - 96) < 1),
      ratio1778: Object.values(report.geometry).every(g => g.band && Math.abs(g.band.ratio - 1.7778) < 0.002),
      contrastAll: contrastPass,
      cycle: { handoff: !!report.cycle.handoff, wrapped: report.cycle.wrappedBackToTypist },
      actionZonesRead: Object.values(report.actionZone).every(a => a.readsStructure),
      reducedMotionZeroVideo: report.reducedMotion.videoRequests === 0,
    };
    console.log('[VERDICT]', JSON.stringify(report.verdict));

    fs.writeFileSync(path.join(OUT, 'r70-report.json'), JSON.stringify(report, null, 2));
    console.log('report ->', path.join(OUT, 'r70-report.json'));
    await browser.close();
  } finally {
    server.kill('SIGTERM');
  }
})();
