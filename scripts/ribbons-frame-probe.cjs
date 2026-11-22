#!/usr/bin/env node
/**
 * ribbons-frame-probe — measures the hub hero's animation cadence the
 * honest way this sandbox allows (the DevTools Performance panel
 * equivalent): a Playwright page, hero in view, NO scrolling, and an
 * in-page rAF sampler that records (a) every rAF interval and (b) the
 * interval between actual canvas CONTENT changes (the repaint cadence —
 * what the eye sees), via a patched CanvasRenderingContext2D prototype
 * installed BEFORE the app loads.
 *
 * Usage: node scripts/ribbons-frame-probe.cjs [label]
 * Writes /tmp/ribbons-frame-probe-<label>.json + prints a summary.
 */
const { chromium } = require('playwright');

const URL = process.env.VITE_URL || 'http://localhost:5199/';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
const LABEL = process.argv[2] || 'run';
const SECONDS = Number(process.env.SECONDS || 10);
const CPU_THROTTLE = Number(process.env.CPU_THROTTLE || 0);

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXEC });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  if (CPU_THROTTLE > 0) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  }
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  const debugs = [];
  page.on('console', (m) => { if (m.type() === 'debug' || m.type() === 'info') debugs.push(m.text()); });

  // Install the canvas-paint probe BEFORE the app boots: every 2D
  // context's draw calls bump a counter; the rAF sampler records the
  // counter so we can compute the real REPAINT interval (not just the
  // rAF interval).
  await page.addInitScript(() => {
    window.__paints = 0;
    window.__samples = [];
    const origGet = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      const ctx = origGet.call(this, type, ...rest);
      if (type === '2d' && ctx && !ctx.__patched) {
        try {
          Object.defineProperty(ctx, '__patched', { value: true });
          for (const m of ['clearRect', 'fillRect', 'stroke', 'fill', 'beginPath', 'moveTo', 'lineTo', 'drawImage']) {
            const orig = ctx[m];
            if (typeof orig === 'function') ctx[m] = function (...a) { window.__paints++; return orig.apply(this, a); };
          }
        } catch { /* non-wrapped contexts are fine */ }
      }
      return ctx;
    };
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('canvas', { timeout: 60000 });
  await page.waitForTimeout(2500); // let the hero settle

  // SCROLL mode: drive the page's real scroll host back and forth for
  // the whole window while sampling — the ribbons must keep painting
  // (>= ~30fps), never freeze. WARMUP (seconds) lets the pacer settle to
  // its tier first, so the measurement catches the steady state.
  if (process.env.SCROLL) {
    if (Number(process.env.WARMUP || 0) > 0) await page.waitForTimeout(Number(process.env.WARMUP) * 1000);
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
      window.__scrollHost = host;
      window.__scrolling = true;
      // Ping-pong within the first viewport: the scroll events fire
      // continuously while the hero STAYS in view (scrolling it away
      // stops the loop by design — that is the off-screen pause test).
      let dir = 1;
      const step = () => {
        if (!window.__scrolling) return;
        if (host) {
          const span = host.clientHeight * 0.5;
          host.scrollTop += dir * 40;
          if (host.scrollTop >= span) dir = -1;
          if (host.scrollTop <= 0) dir = 1;
        } else {
          window.scrollBy(0, dir * 40);
          if (window.scrollY > window.innerHeight * 0.5) dir = -1;
          if (window.scrollY <= 0) dir = 1;
        }
        setTimeout(step, 60);
      };
      step();
    });
  }

  const data = await page.evaluate(async (seconds) => {
    const t0 = performance.now();
    let last = 0;
    await new Promise((resolve) => {
      const tick = (now) => {
        if (last) window.__samples.push({ dt: now - last, paints: window.__paints });
        last = now;
        if (now - t0 < seconds * 1000) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const dts = window.__samples.map((s) => s.dt).filter((d) => d > 0 && d < 1000);
    // Repaint cadence: intervals between successive paint-counter bumps,
    // plus the LAST-5s slice (steady state after the pacer settled).
    let lastPaints = window.__samples[0].paints;
    const repaintGaps = [];
    const lateRepaintGaps = [];
    let sincePaint = 0;
    const cutoff = window.__samples.length * 0.5;
    window.__samples.slice(1).forEach((s, i) => {
      sincePaint += s.dt;
      if (s.paints > lastPaints) {
        repaintGaps.push(sincePaint);
        if (i >= cutoff) lateRepaintGaps.push(sincePaint);
        sincePaint = 0; lastPaints = s.paints;
      }
    });
    const q = (arr, p) => (arr.length ? [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] : null);
    const rg = repaintGaps;
    return {
      frames: dts.length,
      medianFrameMs: q(dts, 0.5),
      p95FrameMs: q(dts, 0.95),
      meanFrameMs: dts.reduce((a, b) => a + b, 0) / dts.length,
      repaints: rg.length,
      medianRepaintMs: q(rg, 0.5),
      p95RepaintMs: q(rg, 0.95),
      lateMedianRepaintMs: q(lateRepaintGaps, 0.5),
      lateP95RepaintMs: q(lateRepaintGaps, 0.95),
    };
  }, SECONDS);

  require('fs').writeFileSync(`/tmp/ribbons-frame-probe-${LABEL}.json`, JSON.stringify({ label: LABEL, url: URL, ...data, tierSteps: debugs, errors }, null, 2));
  console.log(`[${LABEL}] frames=${data.frames} medianFrame=${data.medianFrameMs?.toFixed(1)}ms p95Frame=${data.p95FrameMs?.toFixed(1)}ms meanFrame=${data.meanFrameMs?.toFixed(1)}ms`);
  console.log(`[${LABEL}] repaints=${data.repaints} medianRepaint=${data.medianRepaintMs === null ? 'n/a' : data.medianRepaintMs.toFixed(1) + 'ms'} p95Repaint=${data.p95RepaintMs === null ? 'n/a' : data.p95RepaintMs.toFixed(1) + 'ms'} | LAST-HALF median=${data.lateMedianRepaintMs === null ? 'n/a' : data.lateMedianRepaintMs.toFixed(1) + 'ms'} p95=${data.lateP95RepaintMs === null ? 'n/a' : data.lateP95RepaintMs.toFixed(1) + 'ms'}`);
  if (debugs.length) console.log(`[${LABEL}] TIER STEPS:`, debugs.join(' | '));
  if (errors.length) console.log(`[${LABEL}] PAGE ERRORS:`, errors.slice(0, 5));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
