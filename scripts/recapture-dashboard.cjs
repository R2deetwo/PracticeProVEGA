#!/usr/bin/env node
/**
 * recapture-dashboard — re-take ONLY the /vega dashboard exhibit
 * (2026-11-22). The FocusMatterWidget header was realigned (title leads
 * at the left edge, the Recent/Review/Quiet pills follow it, "All"
 * stays right) — the capture must reflect the app. Same method as
 * r64-app-shots.cjs (dev demo session, vega skin, 1440x900 @2x,
 * progressive JPEG q88), scoped to the one shot.
 */
const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_OUT = path.join(ROOT, 'public', 'assets', 'landing', 'app');
const URL = process.env.VITE_URL || 'http://localhost:5199';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
const RAW = '/tmp/recapture-dashboard';
fs.mkdirSync(RAW, { recursive: true });

const log = (...a) => console.error(...a);

async function bootSession(page, product) {
  await page.goto(URL + '/?boot=prep', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.evaluate((p) => {
    sessionStorage.setItem('practicepro_user_session', JSON.stringify({ token: 'demo@practicepro.ng' }));
    sessionStorage.setItem('practicepro_demo_product', p);
    localStorage.setItem('practicepro_terms_accepted_version', '2026-07-27-v4');
    localStorage.setItem('practicepro_terms_accepted_at', new Date().toISOString());
    localStorage.setItem('practicepro_last_seen_version', 'v1.22.0');
    localStorage.setItem('practicepro_ai_consent', 'true');
    document.documentElement.className = '';
  }, product);
  await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForFunction(
    () => { const el = document.querySelector('.app-container'); return !!el && /app-skin-(vega|atrium)/.test(el.className); },
    { timeout: 45000 }
  );
  await page.waitForTimeout(3500); // session restore + firm data + cards
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXEC });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await bootSession(page, 'vega');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(RAW, 'dashboard.png') });
  log('captured dashboard');
  await browser.close();

  const dst = path.join(APP_OUT, 'dashboard.jpg');
  await sharp(path.join(RAW, 'dashboard.png')).jpeg({ quality: 88, progressive: true }).toFile(dst);
  log(`wrote ${path.relative(ROOT, dst)} (${fs.statSync(dst).size} bytes)`);
})().catch((e) => { log('FATAL', e.message); process.exit(1); });
