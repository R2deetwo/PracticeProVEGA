#!/usr/bin/env node
/**
 * r41-visual-qa — local dist QA for the R41 estate band.
 *
 * Captures the interactive estate band through the owner's exact path
 * (property -> units -> unit -> More) on BOTH frames, proves the hover
 * hint appears, verifies the favicon swap + the bright Atrium coin
 * serves, and checks the phone band + 390px overflow + console errors.
 * The sites scroll in an INNER container — the r39 pattern.
 */
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.QA_BASE || 'http://127.0.0.1:4177';
const OUT = '/home/z/my-project/tmp/r41-qa';
fs.mkdirSync(OUT, { recursive: true });

const WORKSPACE = '[aria-label="Atrium workspace — interactive preview"]';
const PHONE = '[aria-label="Atrium on a phone — interactive preview"]';

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
  await page.waitForTimeout(500);
}

(async () => {
  const launchOpts = { headless: true };
  const cached = '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
  if (fs.existsSync(cached)) launchOpts.executablePath = cached;
  const browser = await chromium.launch(launchOpts);
  const failures = [];

  // ─── Desktop: the interaction path ───
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(BASE + '/atrium', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector(WORKSPACE, { timeout: 30000 });
    await page.waitForTimeout(1500);

    // Favicon swap on /atrium + the bright coin asset
    const fav = await page.evaluate(() => {
      const svg = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
      return svg ? svg.getAttribute('href') : null;
    });
    console.log('FAVICON href on /atrium:', fav);
    if (!fav || !fav.includes('/brand/atrium/favicon.svg') || !fav.includes('?v=')) {
      failures.push('atrium favicon not swapped/cache-busted: ' + fav);
    }
    const coin = await page.evaluate(async () => {
      const r = await fetch('/brand/atrium/favicon.svg');
      return (await r.text()).includes('#10B981');
    });
    if (!coin) failures.push('bright atrium coin not served');

    await scrollToSection(page, '#atrium-estate-heading');
    await page.screenshot({ path: path.join(OUT, 'estate-default.png') });

    // Hover hint on a property card — a real hover must reveal "Open →"
    const lekkiCard = await page.$(`${WORKSPACE} [aria-label^="Open Lekki"]`);
    await lekkiCard.hover();
    await page.waitForTimeout(300);
    const hintVisible = await page.evaluate(sel => {
      const card = document.querySelector(sel);
      if (!card) return null;
      const span = Array.from(card.querySelectorAll('span')).find(s => (s.textContent || '').trim().startsWith('Open'));
      return span ? getComputedStyle(span).opacity : null;
    }, `${WORKSPACE} [aria-label^="Open Lekki"]`);
    console.log('HOVER HINT opacity after hover (1 = revealed):', hintVisible);
    if (hintVisible === null) failures.push('hover hint element missing');
    else if (hintVisible !== '1') failures.push('hover hint did not reveal on hover: ' + hintVisible);

    // The owner's path — desktop
    await page.click(`${WORKSPACE} [aria-label^="Open Parkview"]`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'estate-property-open.png') });

    await page.click(`${WORKSPACE} [aria-label="Unit 1A"]`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'estate-unit-expanded.png') });

    await page.click(`${WORKSPACE} [aria-label="Full unit details and more actions"]`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'estate-unit-more.png') });

    // The unit-count chips on the explorer's list
    const chips = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      return root ? (root.innerText.match(/\d+\s+units?/gi) || []) : null;
    }, WORKSPACE);
    console.log('EXPLORER UNIT CHIPS:', JSON.stringify(chips));
    if (!chips || !chips.includes('8 UNITS')) failures.push('explorer list missing 8 UNITS chip: ' + JSON.stringify(chips));

    // The phone path
    await page.click(`${PHONE} [aria-label^="Open Parkview"]`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'estate-phone-property.png') });

    await page.click(`${PHONE} [aria-label="Unit 1A"]`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'estate-phone-unit.png') });

    await page.click(`${PHONE} [aria-label="Full unit details and more actions"]`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'estate-phone-more.png') });

    // The phone screen must be edge-to-edge (no black void): the screen
    // div fills the bezel and the app UI is live inside it.
    const phoneGeometry = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), imgs: el.querySelectorAll('img').length };
    }, PHONE);
    console.log('PHONE FRAME:', JSON.stringify(phoneGeometry));
    if (phoneGeometry.imgs !== 0) failures.push('phone renders an image (should be live UI)');
    if (phoneGeometry.h < 500) failures.push('phone screen too short: ' + phoneGeometry.h);

    // Honest labels
    const labels = await page.evaluate(() => document.body.innerText.includes('INTERACTIVE PREVIEW'));
    if (!labels) failures.push('INTERACTIVE PREVIEW label missing');

    console.log('DESKTOP CONSOLE ERRORS:', errors.length ? errors.slice(0, 6) : 'none');
    if (errors.length) failures.push('console errors: ' + errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // ─── Mobile 390: overflow + the band ───
  {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(BASE + '/atrium', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector(PHONE, { timeout: 30000 });
    await page.waitForTimeout(1200);
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    console.log('MOBILE scrollWidth:', scrollW);
    if (scrollW > 390) failures.push('horizontal overflow on /atrium mobile: ' + scrollW);
    await scrollToSection(page, '#atrium-estate-heading');
    await page.screenshot({ path: path.join(OUT, 'estate-mobile-band.png') });
    // Tap through the phone on a phone
    await page.click(`${PHONE} [aria-label^="Open Parkview"]`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'estate-mobile-phone-open.png') });
    console.log('MOBILE CONSOLE ERRORS:', errors.length ? errors.slice(0, 4) : 'none');
    if (errors.length) failures.push('mobile console errors: ' + errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  await browser.close();
  if (failures.length) {
    console.log('\nFAILURES:\n' + failures.map(f => ' - ' + f).join('\n'));
    process.exit(1);
  }
  console.log('\nALL R41 VISUAL QA CHECKS PASSED — shots in', OUT);
})().catch(e => { console.error(e); process.exit(1); });
