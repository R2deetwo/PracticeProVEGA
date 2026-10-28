/**
 * r39-visual-qa.cjs — screenshot the rebuilt /vega and /atrium (R39)
 * from the local dist build. The sites scroll inside an INNER container
 * (h-[100dvh] overflow-y-auto), so Playwright's fullPage/element
 * captures stitch wrongly — this script scrolls the inner container by
 * JS and captures viewport-sized shots, stitching full pages itself.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DIST = path.join(__dirname, '..', 'dist');
const OUT = '/home/z/my-project/tmp/r39-qa';
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://127.0.0.1:4177';

/** The inner scroll container (the site root div). */
async function scrollContainer(page) {
  return page.evaluateHandle(() => {
    const el = document.querySelector('main')?.parentElement;
    return el && el.scrollHeight > el.clientHeight ? el : document.scrollingElement;
  });
}

async function revealAll(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-vg-reveal]').forEach((el) => el.classList.add('vg-in'));
  });
  await page.waitForTimeout(350);
}

/** Scroll the inner container so `selector`'s section top sits at viewport top. */
async function scrollToSection(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const root = document.querySelector('main')?.parentElement;
    if (el && root && root.scrollHeight > root.clientHeight) {
      root.scrollTo({ top: el.offsetTop - 8, behavior: 'instant' });
    } else if (el) {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 8, behavior: 'instant' });
    }
  }, selector);
  await page.waitForTimeout(450);
}

/** Stitched full-page capture via inner-container stepping. */
async function fullPageStitched(page, file, viewportH) {
  const handle = await scrollContainer(page);
  const info = await page.evaluate((root) => ({
    h: root.scrollHeight,
    ch: root.clientHeight,
  }), handle);
  const step = Math.floor(viewportH * 0.85);
  const shots = [];
  const n = Math.max(1, Math.ceil((info.h - viewportH) / step) + 1);
  for (let i = 0; i < n; i++) {
    const top = Math.min(i * step, Math.max(0, info.h - viewportH));
    await page.evaluate(({ root, top }) => root.scrollTo({ top, behavior: 'instant' }), { root: handle, top });
    await page.waitForTimeout(260);
    const p = `${file}-part${i}.png`;
    await page.screenshot({ path: p });
    shots.push(p);
  }
  // stitch
  const { execSync } = require('child_process');
  const pyList = JSON.stringify(shots);
  const pyOut = file.replace(/'/g, "'\\''");
  execSync(`python3 - <<'PY'
from PIL import Image
import json
shots = json.loads('${pyList.replace(/'/g, "\\'")}')
imgs = [Image.open(s) for s in shots]
W = max(i.width for i in imgs)
H = sum(i.height for i in imgs)
canvas = Image.new('RGB', (W, H))
y = 0
for i in imgs:
    canvas.paste(i, (0, y)); y += i.height
canvas.save('${pyOut}')
PY`);
  shots.forEach((s) => fs.unlinkSync(s));
  await page.evaluate((root) => root.scrollTo({ top: 0, behavior: 'instant' }), handle);
}

(async () => {
  const server = require('child_process').spawn(
    'npx', ['vite', 'preview', '--port', '4177', '--strictPort', '--host', '127.0.0.1'],
    { cwd: path.join(__dirname, '..'), stdio: 'pipe' }
  );
  await new Promise((r) => setTimeout(r, 3500));

  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
  });
  try {
    // ── Desktop ──────────────────────────────────────────────
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    for (const route of ['vega', 'atrium']) {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      await revealAll(page);

      await fullPageStitched(page, `${OUT}/${route}-desktop-full.png`, 900);
      await page.screenshot({ path: `${OUT}/${route}-desktop-hero.png` });

      if (route === 'vega') {
        await scrollToSection(page, '#ai-capabilities');
        await page.screenshot({ path: `${OUT}/vega-ai-band.png` });
        // scroll to the pullouts (lower in the band)
        await page.evaluate(() => {
          const root = document.querySelector('main')?.parentElement;
          root?.scrollTo({ top: root.scrollTop + 900, behavior: 'instant' });
        });
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/vega-ai-pullouts.png` });
        await scrollToSection(page, '#practice-areas');
        await page.screenshot({ path: `${OUT}/vega-segments.png` });
        await scrollToSection(page, 'section[aria-labelledby="vega-credentials-heading"]');
        await page.screenshot({ path: `${OUT}/vega-credentials.png` });
      } else {
        const estateSel = 'section[aria-labelledby="atrium-estate-heading"]';
        await scrollToSection(page, estateSel);
        await page.screenshot({ path: `${OUT}/atrium-estate-default.png` });
        await page.getByTitle('Unit A3 — Prepaid · Folake Adeyemi').click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUT}/atrium-estate-prepaid.png` });
        await page.getByRole('button', { name: 'Months', exact: true }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUT}/atrium-estate-months.png` });
        await page.getByTitle('Unit A5 — Vacant').click();
        await page.waitForTimeout(400);
        await page.getByRole('button', { name: 'Notices', exact: true }).click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/atrium-estate-vacant.png` });
        await scrollToSection(page, 'section[aria-labelledby="atrium-receipt-heading"]');
        await page.screenshot({ path: `${OUT}/atrium-receipt-ahead.png` });
        await page.getByRole('button', { name: 'In part' }).click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/atrium-receipt-part.png` });
        await page.evaluate(() => {
          const root = document.querySelector('main')?.parentElement;
          root?.scrollTo({ top: 0, behavior: 'instant' });
        });
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/atrium-logo.png`, clip: { x: 0, y: 0, width: 1440, height: 110 } });
      }
      await page.close();
    }
    await ctx.close();

    // ── Mobile ───────────────────────────────────────────────
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    for (const route of ['vega', 'atrium']) {
      const page = await mctx.newPage();
      await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await revealAll(page);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      console.log(`${route} mobile scrollWidth: ${sw} ${sw <= 390 ? '(no overflow)' : '(OVERFLOW!)'}`);
      await fullPageStitched(page, `${OUT}/${route}-mobile-full.png`, 844);
      await page.close();
    }
    await mctx.close();
  } finally {
    await browser.close();
    server.kill();
  }
  console.log('QA shots in', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
