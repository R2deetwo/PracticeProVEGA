#!/usr/bin/env node
/**
 * r28-app-shots — capture REAL app screenshots for the /vega marketing page
 * (owner direction: "the images do not look like what the app looks like —
 * let us use stuff from the app so we are not showing false images").
 *
 * Method: run the Vite DEV server (the demo-session bypass is dev-gated)
 * against the production Convex, restore the demo user's session directly
 * (the same shape login() writes), set the demo product to 'vega' so the
 * Warm Chambers skin + Vega favicon are active, then walk the workspace
 * views and screenshot. Output: progressive JPEGs in
 * public/assets/landing/app/ (same format as the existing work images).
 *
 * R28 round 2: wait for the skin to actually resolve (app-skin-vega on the
 * container) before each shot; pre-seed the changelog "What's New" banner
 * and the AI-consent gate so nothing overlays the workspace.
 */
const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'assets', 'landing', 'app');
const URL = process.env.VITE_URL || 'http://localhost:5199';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const launchOpts = { headless: true };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  // Pre-boot state: demo session + vega product + accepted terms/light theme
  // + changelog seen + AI consent — nothing overlays the workspace.
  await page.goto(URL + '/?boot=prep', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.evaluate(() => {
    sessionStorage.setItem('practicepro_user_session', JSON.stringify({ token: 'demo@practicepro.ng' }));
    sessionStorage.setItem('practicepro_demo_product', 'vega');
    localStorage.setItem('practicepro_terms_accepted_version', '2026-07-27-v4');
    localStorage.setItem('practicepro_terms_accepted_at', new Date().toISOString());
    localStorage.setItem('practicepro_last_seen_version', 'v1.22.0');
    localStorage.setItem('practicepro_ai_consent', 'true');
    document.documentElement.className = '';
  });

  // Boot into the app (splash → session restore → firm data → skin resolve).
  await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.app-container');
      return !!el && el.className.includes('app-skin-vega');
    },
    { timeout: 45000 }
  ).catch(() => console.log('WARN: skin class never appeared'));
  await page.waitForTimeout(2500); // let data cards settle

  const shot = async (name, settle = 2200) => {
    await page.waitForTimeout(settle);
    await page.screenshot({ path: path.join(OUT, `${name}-raw.png`) });
    console.log('captured', name);
  };

  await shot('dashboard', 1200);

  const nav = async (label) => {
    try {
      await page.click(`aside >> text=${label}`, { timeout: 7000 });
    } catch {
      await page.click(`nav >> text=${label}`, { timeout: 7000 });
    }
  };

  await nav('Matters');
  await shot('matters');

  await nav('Documents');
  await shot('documents');

  await nav('Calendar');
  await shot('calendar');

  await nav('Financials');
  await shot('billing');

  // ALOA panel — the chat surface (consent pre-accepted above).
  try {
    await page.click('#aloa-fab', { timeout: 5000 });
    await shot('aloa', 3000);
  } catch {
    console.log('aloa fab not found; trying aria-label');
    try {
      await page.click('[aria-label*="ALOA"], [aria-label*="assistant" i]', { timeout: 5000 });
      await shot('aloa', 3000);
    } catch { console.log('aloa panel not opened'); }
  }

  await browser.close();

  for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('-raw.png'))) {
    const name = f.replace('-raw.png', '');
    const src = path.join(OUT, f);
    const dst = path.join(OUT, `${name}.jpg`);
    await sharp(src).jpeg({ quality: 88, progressive: true }).toFile(dst);
    fs.unlinkSync(src);
    console.log(`wrote ${path.relative(ROOT, dst)} (${fs.statSync(dst).size} bytes)`);
  }
  console.log('done');
})();
