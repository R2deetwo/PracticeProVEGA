#!/usr/bin/env node
/** R71 — LIVE verification against practice-pro-vega.vercel.app: the
 *  presence stack is QUIET chrome on production. Proves which build
 *  (version.json sha), then: at rest the 3 avatars + "+5" render in the
 *  hero header gap; on hover NOTHING changes (no pop, no plate — rect +
 *  transform identical); on click the roster still opens (8 rows, 8 DM
 *  buttons); a suite-card trigger is equally quiet; zero console
 *  errors. Run AFTER the R71 push + promote. */
const { chromium } = require('playwright');
const BASE = 'https://practice-pro-vega.vercel.app';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const report = { version: {}, consoleErrors: [] };
  try {
    const r = await fetch(`${BASE}/version.json`, { cache: 'no-store' });
    report.version = await r.json();
  } catch (e) { report.version = { error: String(e) }; }
  console.log('version.json:', JSON.stringify(report.version));

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  page.on('console', (m) => m.type() === 'error' && report.consoleErrors.push(m.text()));
  await page.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 90000 });
  await sleep(1200);
  await page.evaluate(() => {
    const banner = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Acknowledge');
    banner?.click();
  });
  await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
  await sleep(1500);

  const measure = (sel) => page.evaluate((sel) => {
    const triggers = [...document.querySelectorAll('[data-collab-trigger]')];
    const t = sel === 'first' ? triggers[0] : triggers[1];
    if (!t) return { found: false, count: triggers.length };
    const avatars = [...t.querySelectorAll('span.rounded-full')].filter((s) => /^[A-Z]{2}/.test(s.textContent?.trim() || ''));
    const r = t.getBoundingClientRect();
    const cs = getComputedStyle(t);
    return {
      found: true, count: triggers.length, avatars: avatars.length,
      hasPlus5: t.textContent?.includes('+5') || false,
      hasPlate: !!t.querySelector('span[class*="bg-white/85"]'),
      hoverScaleClass: /hover:scale|focus-visible:scale/.test(t.className),
      rect: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
      transform: cs.transform,
    };
  }, sel);

  await page.locator('[data-collab-trigger]').first().scrollIntoViewIfNeeded();
  await sleep(400);
  const rest = await measure('first');
  console.log('REST:', JSON.stringify(rest));
  await page.hover('[data-collab-trigger]');
  await sleep(500);
  const hovered = await measure('first');
  console.log('HOVER:', JSON.stringify(hovered));
  const quiet = rest.found && rest.avatars === 3 && rest.hasPlus5 && !rest.hasPlate && !rest.hoverScaleClass &&
    hovered.transform === 'none' && JSON.stringify(rest.rect) === JSON.stringify(hovered.rect) && !hovered.hasPlate;
  console.log('QUIET-ON-HOVER:', quiet ? 'PASS' : 'FAIL');

  await page.click('[data-collab-trigger]');
  await page.waitForSelector('[data-collab-menu]', { timeout: 8000 });
  const menu = await page.evaluate(() => {
    const m = document.querySelector('[data-collab-menu]');
    return { heading: m.textContent?.includes('8 teammates in this workspace') || false,
      rows: m.querySelectorAll('[role="menuitem"]').length,
      dm: [...m.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'DM').length };
  });
  console.log('MENU:', JSON.stringify(menu));
  await page.keyboard.press('Escape');

  const suite = await measure('second');
  console.log('SUITE-CARD:', JSON.stringify(suite));
  console.log('CONSOLE-ERRORS:', report.consoleErrors.length ? JSON.stringify(report.consoleErrors) : 'none');
  await browser.close();
})();
