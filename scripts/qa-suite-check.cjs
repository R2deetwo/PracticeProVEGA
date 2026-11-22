#!/usr/bin/env node
/** qa-suite-check — does the "One workspace" heading sit clear of the
 * fixed header under NATURAL scroll (not scrollIntoView, which lands the
 * section flush under the fixed header)? 2026-11-22 TASK A QA. */
const { chromium } = require('playwright');
const URL = process.env.VITE_URL || 'http://localhost:5199/vega';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  const accept = page.locator('button', { hasText: /accept|acknowledge|got it/i }).first();
  if (await accept.count()) { await accept.click().catch(() => {}); await page.waitForTimeout(300); }
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(800);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(800);
  const geom = await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('h2')).find((el) => el.textContent?.includes('One workspace'));
    const header = document.querySelector('header') || document.querySelector('nav');
    if (!h || !header) return { found: false };
    const hr = h.getBoundingClientRect(), hd = header.getBoundingClientRect();
    return { found: true, headingTop: Math.round(hr.top), headerBottom: Math.round(hd.bottom), clear: hr.top >= hd.bottom, text: h.textContent };
  });
  console.log('natural-scroll heading geometry:', JSON.stringify(geom));
  await page.screenshot({ path: '/tmp/qa-vega/02b-suite-natural.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
