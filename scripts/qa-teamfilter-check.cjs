#!/usr/bin/env node
/** qa-teamfilter-check — after the pill-count fix: filter to Kemi and
 * read the pill counts vs the visible rows. Consent is seeded BEFORE
 * load so the cookie banner never mounts (it otherwise intercepts). */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('practicepro_cookie_consent', 'true');
    localStorage.setItem('practicepro_terms_accepted_version', '2026-07-27-v4');
    localStorage.setItem('practicepro_terms_accepted_at', new Date().toISOString());
  });
  await page.goto('http://localhost:5199/vega', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
  await page.waitForTimeout(500);
  await page.locator('button[aria-label="See all app views — open the full gallery"]').click();
  await page.waitForTimeout(900);
  await page.getByRole('dialog').getByRole('button', { name: 'Team tasks', exact: true }).click();
  await page.waitForTimeout(700);
  const pills = await page.getByRole('dialog').getByRole('button', { name: /All Users|Seun|Kemi|Tunde/ }).allInnerTexts();
  await page.getByRole('dialog').getByRole('button', { name: /Kemi/ }).first().click();
  await page.waitForTimeout(600);
  const rowTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="dialog"] button, [role="dialog"] [class*="grid"]'))
      .map((el) => (el.textContent || '').trim())
      .filter((t) => /Client Meeting|Statement of Claim|Witness Statements|Weekly Report|Portfolio|Court Brief/.test(t))
  );
  console.log('pills:', JSON.stringify(pills));
  console.log('rows after Kemi filter:', JSON.stringify(rowTexts.slice(0, 8)));
  await page.screenshot({ path: '/tmp/qa-vega/16b-teamtasks-filtered.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
