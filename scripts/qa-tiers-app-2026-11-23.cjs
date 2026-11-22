#!/usr/bin/env node
/**
 * qa-tiers-app-2026-11-23 — in-app QA: the Subscription settings PlanCards
 * render the baseLine rows ("Everything in Growth, plus:") and the
 * corrected user-limit chips (Growth = Up to 5 Users, Pro = Unlimited).
 * Boots the dev demo session (vega skin) like recapture-dashboard.cjs.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.VITE_URL || 'http://localhost:5199';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
const OUT = '/tmp/qa-tiers';
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXEC });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));

  await page.goto(URL + '/?boot=prep', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.evaluate(() => {
    sessionStorage.setItem('practicepro_user_session', JSON.stringify({ token: 'demo@practicepro.ng' }));
    sessionStorage.setItem('practicepro_demo_product', 'vega');
    localStorage.setItem('practicepro_terms_accepted_version', '2026-07-27-v4');
    localStorage.setItem('practicepro_terms_accepted_at', new Date().toISOString());
    localStorage.setItem('practicepro_last_seen_version', 'v1.22.0');
    localStorage.setItem('practicepro_ai_consent', 'true');
    localStorage.setItem('practicepro_cookie_consent', 'true');
    document.documentElement.className = '';
  });
  await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForFunction(
    () => { const el = document.querySelector('.app-container'); return !!el && /app-skin-vega/.test(el.className); },
    { timeout: 45000 }
  );
  await page.waitForTimeout(3500);

  // Navigate to Settings → Subscription (the gear/tab labels vary; find a
  // way into the settings view).
  const settingsBtn = page.locator('button[title*="ettings"], [aria-label*="ettings"], button:has-text("Settings")').first();
  if (await settingsBtn.count()) { await settingsBtn.click().catch(() => {}); await page.waitForTimeout(1200); }
  // The subscription section may be a tab or sub-page inside settings.
  const subTab = page.locator('button:has-text("Subscription"), [role="tab"]:has-text("Subscription"), a:has-text("Subscription")').first();
  if (await subTab.count()) { await subTab.click().catch(() => {}); await page.waitForTimeout(1500); }

  const found = await page.evaluate(() => {
    const baseLines = Array.from(document.querySelectorAll('li'))
      .filter((li) => /Everything in (Free|Growth|Pro|Starter), plus:/.test(li.textContent || ''))
      .map((li) => li.textContent?.trim());
    const userChips = Array.from(document.querySelectorAll('*'))
      .filter((el) => el.children.length === 0 && /^(Up to \d+ Users?|Unlimited Users|1 User Account)$/.test((el.textContent || '').trim()))
      .map((el) => el.textContent?.trim());
    return { baseLines, userChips };
  });
  log('baseLine rows rendered in-app:', JSON.stringify(found.baseLines));
  log('user-limit chips rendered in-app:', JSON.stringify(found.userChips));
  await page.screenshot({ path: `${OUT}/03-app-subscription.png` });
  log('console errors:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
})().catch((e) => { log('FATAL', e.message); process.exit(1); });
