#!/usr/bin/env node
/**
 * r41-reference-shots — ground-truth screenshots of the REAL app for the
 * interactive estate explorer build (R41).
 *
 * Boots the dev server's demo session (product=atrium) against the
 * production Convex — the same r28 pattern the R40 captures used — then
 * walks the Properties workspace on desktop (1440x900) and a phone
 * (390x844) through the exact interaction path the explorer must
 * replicate:
 *
 *   Properties list -> Parkview Gardens -> (Summary ->) Units tab ->
 *   Unit 1A expanded (Tier 1 quick actions) -> More (Tier 2 full
 *   detail + the full action set).
 *
 * Output: PNG references under /home/z/my-project/tmp/r41-refs/ (working
 * artifacts, not repo assets). Also greps the live DOM for the R41 unit
 * chips ("8 Units") to prove the app fix renders.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.VITE_URL || 'http://localhost:5199';
const OUT = '/home/z/my-project/tmp/r41-refs';
fs.mkdirSync(OUT, { recursive: true });

async function bootSession(page) {
  await page.goto(URL + '/?boot=prep', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.evaluate(() => {
    sessionStorage.setItem('practicepro_user_session', JSON.stringify({ token: 'demo@practicepro.ng' }));
    sessionStorage.setItem('practicepro_demo_product', 'atrium');
    localStorage.setItem('practicepro_terms_accepted_version', '2026-07-27-v4');
    localStorage.setItem('practicepro_terms_accepted_at', new Date().toISOString());
    localStorage.setItem('practicepro_last_seen_version', 'v1.22.0');
    localStorage.setItem('practicepro_ai_consent', 'true');
    document.documentElement.className = '';
  });
  await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForFunction(
    () => !!document.querySelector('.app-container'),
    { timeout: 45000 }
  );
  await page.waitForTimeout(3000); // session restore + firm data
}

async function shot(page, name, settle = 2200) {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('captured', name);
}

(async () => {
  const launchOpts = { headless: true };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  else {
    // The sandbox ships an older chromium build than the repo's playwright
    // expects — use it explicitly rather than downloading a new one.
    const cached = '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
    if (fs.existsSync(cached)) launchOpts.executablePath = cached;
  }
  const browser = await chromium.launch(launchOpts);

  // ─────────────────────────── DESKTOP ───────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await bootSession(page);

    // Properties via the sidebar
    await page.click('aside >> text=Properties', { timeout: 20000 });
    await shot(page, 'd1-properties');

    // R41 fix proof: the unit chips on the property cards
    const chips = await page.$$eval('[data-item-id], .group', () => null).catch(() => null);
    const chipText = await page.evaluate(() => document.body.innerText.match(/\d+\s+Units?/g));
    console.log('UNIT CHIPS VISIBLE:', JSON.stringify(chipText));

    // Open Parkview Gardens (detail lands on Summary)
    await page.click('text=Parkview Gardens', { timeout: 15000 });
    await shot(page, 'd2-parkview-summary');

    // Units tab
    await page.click('nav.no-scrollbar >> text=Units', { timeout: 10000 }).catch(async () => {
      await page.click('button:has-text("Units")', { timeout: 10000 });
    });
    await shot(page, 'd3-parkview-units');

    // Expand Unit 1A (Tier 1)
    await page.click('text=Unit 1A', { timeout: 10000 });
    await shot(page, 'd4-unit-expanded');

    // More -> Tier 2
    await page.click('button[title="Full unit details and more actions"]', { timeout: 10000 });
    await shot(page, 'd5-unit-more');

    console.log('DESKTOP CONSOLE ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
    await ctx.close();
  }

  // ──────────────────────────── PHONE ────────────────────────────
  {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await bootSession(page);

    // Bottom nav -> Properties
    await page.click('#bottom-nav >> text=Properties', { timeout: 20000 });
    await shot(page, 'm1-properties');

    const chipText = await page.evaluate(() => document.body.innerText.match(/\d+\s+Units?/g));
    console.log('MOBILE UNIT CHIPS VISIBLE:', JSON.stringify(chipText));

    // Tap Parkview -> full-screen detail (Summary)
    await page.click('text=Parkview Gardens', { timeout: 15000 });
    await shot(page, 'm2-parkview-summary');

    // Units tab (horizontally scrollable tab bar)
    await page.click('nav.no-scrollbar >> text=Units', { timeout: 10000 }).catch(async () => {
      await page.click('button:has-text("Units")', { timeout: 10000 });
    });
    await shot(page, 'm3-parkview-units');

    // Expand Unit 1A
    await page.click('text=Unit 1A', { timeout: 10000 });
    await shot(page, 'm4-unit-expanded');

    // More -> Tier 2
    await page.click('button[title="Full unit details and more actions"]', { timeout: 10000 });
    await shot(page, 'm5-unit-more');

    console.log('MOBILE CONSOLE ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
    await ctx.close();
  }

  await browser.close();
  console.log('DONE — references in', OUT);
})().catch(e => { console.error(e); process.exit(1); });
