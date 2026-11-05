#!/usr/bin/env node
/** R68 WCAG dip probe — samples the subcopy's worst 8x8 patch every 500ms
 *  for ~11s at 1920, alongside layer opacities + veil computed styles, to
 *  find exactly when the worst-case dip happens (steady state vs mid-dissolve)
 *  and what the veil is doing at that moment. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const sharp = require('sharp');

const REPO = '/home/z/my-project/tmp/pprepo';
const PORT = 4175;
const BASE = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const contrast = (fg, bg) => { const a = lum(fg), b = lum(bg); const [x, y] = a > b ? [a, b] : [b, a]; return (x + 0.05) / (y + 0.05); };

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) { try { const r = await fetch(`${BASE}/version.json`); if (r.ok) break; } catch {} await sleep(500); }
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => {
      const v = document.querySelector('section#home video');
      const h = document.querySelector('h1');
      return v && v.readyState >= 2 && !v.paused && h && parseFloat(getComputedStyle(h).opacity) > 0.9;
    }, { timeout: 20000 }).catch(() => {});

    const rect = await page.evaluate(() => {
      const h1 = document.querySelector('section#home h1');
      const sub = [...h1.parentElement.querySelectorAll('p')].find(p => p.className.includes('text-slate-800'));
      const r = sub.getBoundingClientRect();
      const cs = getComputedStyle(sub);
      return { x: r.x, y: r.y, w: r.width, h: r.height, color: cs.color };
    });
    await page.evaluate(() => {
      const h1 = document.querySelector('section#home h1');
      const sub = [...h1.parentElement.querySelectorAll('p')].find(p => p.className.includes('text-slate-800'));
      h1.style.visibility = 'hidden'; sub.style.visibility = 'hidden';
    });

    const fg = [30, 41, 59]; // slate-800 #1E293B (design token — deterministic)
    const rows = [];
    for (let i = 0; i < 22; i++) {
      const shot = '/tmp/r68w/_dip.png';
      await page.screenshot({ path: shot });
      const { data, info } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const width = info.width;
      let worst = null;
      for (let y = (rect.y | 0); y < rect.y + rect.h - 8; y += 10) {
        for (let x = (rect.x | 0); x < rect.x + rect.w - 8; x += 10) {
          let s = 0;
          for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 8; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            s += 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
          }
          const m = s / 64;
          const cidx = ((y + 4) * width + (x + 4)) * 4;
          if (!worst || m < worst.m) worst = { m, rgb: [data[cidx], data[cidx + 1], data[cidx + 2]] };
        }
      }
      const st = await page.evaluate(() => {
        const vids = [...document.querySelectorAll('section#home video')];
        return vids.map(v => {
          const l = v.parentElement, cs = getComputedStyle(l);
          const veil = [...l.children].filter(c => c.tagName === 'DIV').map(d => {
            const s = getComputedStyle(d);
            return { display: s.display, bg: (s.backgroundImage + ' ' + s.backgroundColor).slice(0, 60) };
          });
          return { src: v.currentSrc.split('/').pop(), t: +v.currentTime.toFixed(2), op: cs.opacity, z: cs.zIndex, veil };
        });
      });
      rows.push({ i, ratio: +contrast(fg, worst.rgb).toFixed(2), worstLum: +worst.m.toFixed(3), layers: st });
      await sleep(500);
    }
    for (const r of rows) {
      console.log(`#${String(r.i).padStart(2)} ratio=${r.ratio.toFixed(2).padStart(5)} worstLum=${r.worstLum.toFixed(3)} | ` +
        r.layers.map(l => `${l.src.includes('-2') ? 'cuff' : 'typ'} t=${l.t}s op=${l.op} z=${l.z} veil=${l.veil.map(v => v.display).join(',')}`).join('  ||  '));
    }
    await browser.close();
  } finally { server.kill('SIGTERM'); }
})();
