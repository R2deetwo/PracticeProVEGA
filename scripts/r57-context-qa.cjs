#!/usr/bin/env node
/**
 * r57-context-qa.cjs — in-context captures of the R57 Atrium mark.
 *   1. /atrium nav + hero (mark h-8 in the header lockup)
 *   2. /atrium footer (mark h-7)
 *   3. hub homepage hero (R55 ribbons + the built strip, mark w-6)
 *   4. hub products dropdown open (mark w-4 — the 16px hardest case)
 * Output: /tmp/r57qa/context-*.png
 * Run: node scripts/r57-context-qa.cjs   (dev server on :4182)
 */
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:4182';
const OUT = (n) => `/tmp/r57qa/context-${n}.png`;

(async () => {
  const fs = require('fs');
  try {
  const launchOpts = { headless: true };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const browser = await chromium.launch(launchOpts);

  // 1+2. /atrium desktop — nav and footer
  const a = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  a.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  a.on('pageerror', (e) => errors.push(String(e)));
  await a.goto(BASE + '/atrium', { waitUntil: 'networkidle', timeout: 60000 });
  await a.waitForTimeout(1200);
  console.log('atrium header/nav count:', await a.locator('header, nav').count());
  const nav = await a.locator('header, nav').first().screenshot().catch((e) => { console.log('nav shot failed:', String(e).slice(0, 200)); return null; });
  if (nav) { fs.writeFileSync(OUT('atrium-nav'), nav); console.log('wrote nav', nav.length); }
  await a.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await a.waitForTimeout(900);
  console.log('atrium footer count:', await a.locator('footer').count());
  const foot = await a.locator('footer').first().screenshot().catch((e) => { console.log('footer shot failed:', String(e).slice(0, 200)); return null; });
  if (foot) { fs.writeFileSync(OUT('atrium-footer'), foot); console.log('wrote footer', foot.length); }
  console.log('atrium console errors:', errors.length ? errors.slice(0, 5) : 'none');

  // 3. hub homepage — hero with R55 ribbons + built strip
  const h = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const hErrors = [];
  h.on('console', (m) => { if (m.type() === 'error') hErrors.push(m.text()); });
  h.on('pageerror', (e) => hErrors.push(String(e)));
  await h.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
  await h.waitForTimeout(2500); // let the ribbons settle into motion
  await h.screenshot({ path: OUT('hub-hero'), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  console.log('wrote hub-hero, exists:', fs.existsSync(OUT('hub-hero')));
  console.log('hub console errors:', hErrors.length ? hErrors.slice(0, 5) : 'none');

  // 4. hub products dropdown open (the w-4 16px mark case)
  const btn = h.locator('header button, nav button', { hasText: 'Products' }).first();
  console.log('Products button count:', await btn.count());
  if (await btn.count()) {
    await btn.click();
    await h.waitForTimeout(600);
    const menu = h.locator('.menu-in').first();
    console.log('menu-in count:', await menu.count());
    if (await menu.count()) {
      await menu.screenshot({ path: OUT('hub-dropdown') });
    } else {
      await h.screenshot({ path: OUT('hub-dropdown'), clip: { x: 0, y: 0, width: 700, height: 420 } });
    }
  } else {
    console.log('Products button not found — capturing nav bar instead');
    await h.screenshot({ path: OUT('hub-dropdown'), clip: { x: 0, y: 0, width: 900, height: 200 } });
  }

  await browser.close();
  } catch (e) {
    console.log('SCRIPT ERROR:', String(e).slice(0, 600));
  }
  const fs2 = require('fs');
  ['atrium-nav', 'atrium-footer', 'hub-hero', 'hub-dropdown'].forEach((n) => {
    const p = OUT(n);
    console.log(fs2.existsSync(p) ? '✓ ' + p : '✗ MISSING ' + p);
  });
})();
