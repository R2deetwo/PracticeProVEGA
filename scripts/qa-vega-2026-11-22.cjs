#!/usr/bin/env node
/**
 * qa-vega-2026-11-22 — visual QA for the TASK A + TASK B round on /vega.
 * Walks the live dev page: hero (no dashboard viewer card), header (no
 * All Products), the suite Team tab (Kanban + team previews), and the
 * See All lightbox (Dashboard markers + per-date calendar flip, Matters
 * callouts, the Kanban/team exhibits, the visible close X).
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.env.VITE_URL || 'http://localhost:5199/vega';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
const OUT = '/tmp/qa-vega';
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXEC });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  // Dismiss the cookie consent bar if present (it intercepts clicks).
  const accept = page.locator('button', { hasText: /accept|acknowledge|got it/i }).first();
  if (await accept.count()) { await accept.click().catch(() => {}); await page.waitForTimeout(400); }
  await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
  await page.waitForTimeout(400);

  // 1. The header + hero.
  await page.screenshot({ path: path.join(OUT, '01-hero.png') });
  const allProducts = await page.locator('header:has-text("All Products")').count();
  log('All Products in header:', allProducts);

  // 2. What follows the hero band — the suite heading directly.
  await page.locator('#suite').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '02-suite-top.png') });
  const heroText = await page.locator('#home').innerText();
  log('hero contains app.practicepro.ng card text:', heroText.includes('app.practicepro.ng'));
  log('hero contains OPEN THE INTERACTIVE PREVIEW:', heroText.includes('OPEN THE INTERACTIVE PREVIEW'));

  // 3. The Team Workflows tab — the Kanban preview.
  await page.getByRole('tab', { name: 'Team Workflows' }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, '03-team-kanban-panel.png') });
  // 3b. The team table exhibit.
  await page.getByLabel('Exhibits').getByRole('button', { name: 'Team tasks', exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '04-team-table-panel.png') });

  // 4. See All — the lightbox at the current exhibit.
  await page.locator('button[aria-label="See all app views — open the full gallery"]').click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, '05-lightbox-open.png') });

  // 5. The Dashboard exhibit — resting markers + always-visible monikers.
  await page.getByRole('dialog').getByRole('button', { name: 'Dashboard', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '06-dashboard-markers.png') });

  // 6. Hover a zone — the spotlight (dim veil + floating hint).
  const recent = page.locator('div[aria-label^="Recent Matters"]').first();
  await recent.hover();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '07-dashboard-spotlight.png') });
  await page.mouse.move(30, 450);
  await page.waitForTimeout(400);

  // 7. Click date 24 — the per-date calendar flip.
  await page.locator('button[aria-label*="24 November"]').click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, '08-calendar-day-24.png') });
  // back to the month, then an empty date (the honest clear day)
  await page.locator('button', { hasText: 'Back to the month' }).click();
  await page.waitForTimeout(700);
  await page.locator('button[aria-label*="10 November"]').click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, '09-calendar-clear-day.png') });
  await page.locator('button', { hasText: 'Back to the month' }).click();
  await page.waitForTimeout(500);

  // 8. The Matters exhibit — the callouts.
  await page.getByRole('dialog').getByRole('button', { name: 'Matters', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '10-matters-rest.png') });
  const stage = page.locator('div[aria-label^="Stage-tagged files"]').first();
  await stage.hover();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '11-matters-spotlight.png') });
  await page.mouse.move(30, 450);
  await page.waitForTimeout(300);

  // 9. Task board — the Kanban.
  await page.getByRole('dialog').getByRole('button', { name: 'Task board', exact: true }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '12-kanban.png') });
  // advance a card
  const firstCard = page.locator('button[aria-label*="advance to"]').first();
  await firstCard.hover();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '13-kanban-hover.png') });
  await firstCard.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '14-kanban-advanced.png') });

  // 10. Team tasks — the table with multi-assignee stacks.
  await page.getByRole('dialog').getByRole('button', { name: 'Team tasks', exact: true }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, '15-teamtasks.png') });
  await page.getByRole('dialog').getByRole('button', { name: /Kemi/ }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '16-teamtasks-filtered.png') });

  log('console errors:', errors.length ? errors.slice(0, 6) : 'none');
  await browser.close();
  log('done — shots in', OUT);
})().catch((e) => { log('FATAL', e.message); process.exit(1); });
