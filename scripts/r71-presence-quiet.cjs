#!/usr/bin/env node
/** R71 probe — the presence stack is quiet chrome.
 *  Owner direction: "it should just be seen as visible and not
 *  highlighted or highlightable." Verify on the built site:
 *   1. AT REST the stack renders (3 avatars + "+5" chip) in the hero
 *      capture's header gap.
 *   2. ON HOVER nothing changes — no scale pop, no white plate. The
 *      trigger's rect + computed transform must be identical before and
 *      after a hover, and no plate element may exist.
 *   3. ON CLICK the roster dropdown still opens (8 teammates, DM rows).
 *   4. Same quiet behaviour on a suite card and in the lightbox.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REPO = '/home/z/my-project/tmp/pprepo';
const PORT = 4181;
const BASE = `http://localhost:${PORT}`;
const OUT = '/tmp/r71';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) { try { const r = await fetch(`${BASE}/version.json`); if (r.ok) break; } catch {} await sleep(500); }
    const browser = await chromium.launch();
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    await sleep(900);
    await page.evaluate(() => {
      const banner = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Acknowledge');
      banner?.click();
    });
    await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
    await sleep(1200);

    const measure = () => page.evaluate(() => {
      const triggers = [...document.querySelectorAll('[data-collab-trigger]')];
      const t = triggers[0];
      if (!t) return { count: triggers.length };
      // avatar spans: the rounded-full initials circles (the "+5" chip is
      // rounded-full too, but its text starts with "+", not two caps)
      const avatars = [...t.querySelectorAll('span.rounded-full')].filter((s) => /^[A-Z]{2}/.test(s.textContent?.trim() || ''));
      const chip = t.textContent?.includes('+5');
      const plate = !!t.querySelector('span[class*="bg-white/85"]');
      const r = t.getBoundingClientRect();
      const cs = getComputedStyle(t);
      return {
        count: triggers.length,
        avatars: avatars.length,
        hasPlus5: chip,
        hasPlate: plate,
        rect: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
        transform: cs.transform, transitionProperty: cs.transitionProperty,
        hoverClassHasScale: /hover:scale|focus-visible:scale/.test(t.className),
      };
    });

    // scroll the hero capture into view FIRST so page.hover cannot
    // scroll mid-measurement (a scroll changes viewport-relative y and
    // would fake a "change" between the two measurements)
    await page.locator('[data-collab-trigger]').first().scrollIntoViewIfNeeded();
    await sleep(300);
    const rest = await measure();
    console.log('REST:', JSON.stringify(rest));

    // --- HOVER: nothing may change ---
    await page.hover('[data-collab-trigger]');
    await sleep(450);
    const hovered = await measure();
    console.log('HOVER:', JSON.stringify(hovered));
    const quiet =
      rest.avatars === 3 && rest.hasPlus5 && !rest.hasPlate &&
      !rest.hoverClassHasScale &&
      hovered.transform === 'none' &&
      JSON.stringify(rest.rect) === JSON.stringify(hovered.rect) &&
      !hovered.hasPlate;
    console.log('QUIET-ON-HOVER:', quiet ? 'PASS' : 'FAIL');

    // screenshots: hero capture at rest vs hover (should be identical)
    const heroCard = page.locator('section#home [data-collab-trigger] >> xpath=ancestor::div[2]');
    await page.screenshot({ path: `${OUT}/hero-rest.png`, clip: { x: 200, y: 150, width: 1040, height: 700 } });
    await page.hover('[data-collab-trigger]');
    await sleep(450);
    await page.screenshot({ path: `${OUT}/hero-hover.png`, clip: { x: 200, y: 150, width: 1040, height: 700 } });

    // --- CLICK: the roster dropdown still opens ---
    await page.click('[data-collab-trigger]');
    await page.waitForSelector('[data-collab-menu]', { timeout: 5000 });
    const menu = await page.evaluate(() => {
      const m = document.querySelector('[data-collab-menu]');
      const rows = [...m.querySelectorAll('[role="menuitem"]')];
      const dm = [...m.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'DM');
      return { heading: m.textContent?.includes('8 teammates in this workspace'), rows: rows.length, dmButtons: dm.length };
    });
    console.log('MENU:', JSON.stringify(menu));
    await page.screenshot({ path: `${OUT}/hero-menu.png`, clip: { x: 200, y: 150, width: 1040, height: 700 } });
    await page.keyboard.press('Escape');

    // --- a suite card: same quiet stack ---
    const suite = await page.evaluate(() => {
      const t = [...document.querySelectorAll('[data-collab-trigger]')][1];
      if (!t) return null;
      const cs = getComputedStyle(t);
      const r = t.getBoundingClientRect();
      return { transform: cs.transform, w: +r.width.toFixed(0), h: +r.height.toFixed(0),
        hoverScale: /hover:scale/.test(t.className), plate: !!t.querySelector('span[class*="bg-white/85"]') };
    });
    console.log('SUITE-CARD:', JSON.stringify(suite));

    // --- lightbox: stack present, still quiet ---
    await page.click('section#home button[aria-label="Expand the Dashboard view"]');
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await sleep(600);
    const lb = await page.evaluate(() => {
      const t = document.querySelector('[role="dialog"] [data-collab-trigger]');
      if (!t) return null;
      const cs = getComputedStyle(t);
      return { transform: cs.transform, hoverScale: /hover:scale/.test(t.className), plate: !!t.querySelector('span[class*="bg-white/85"]') };
    });
    console.log('LIGHTBOX:', JSON.stringify(lb));
    await page.screenshot({ path: `${OUT}/lightbox.png` });
    await page.keyboard.press('Escape');

    console.log('CONSOLE-ERRORS:', errors.length ? JSON.stringify(errors) : 'none');
    await browser.close();
  } finally { server.kill('SIGTERM'); }
})();
