#!/usr/bin/env node
/**
 * qa-tiers-2026-11-23 — visual QA for the no-repetition tier model.
 *  1. /vega pricing band: every card above Free starts with the
 *     "Everything in X, plus:" row; the Vox line appears on the PRO card
 *     ONLY; no feature line repeats across cards.
 *  2. The landing Vox band's tier line says "Pro plan and above".
 * Screenshots + DOM assertions; console errors captured.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.VITE_URL || 'http://localhost:5199/vega';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
const OUT = '/tmp/qa-tiers';
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXEC });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  await page.addInitScript(() => {
    localStorage.setItem('practicepro_cookie_consent', 'true');
    localStorage.setItem('practicepro_terms_accepted_version', '2026-07-27-v4');
    localStorage.setItem('practicepro_terms_accepted_at', new Date().toISOString());
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
  await page.waitForTimeout(400);

  // 1. The pricing band
  await page.locator('#pricing').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/01-pricing.png`, fullPage: false });

  const matrix = await page.evaluate(() => {
    const section = document.querySelector('#pricing');
    const cards = Array.from(section.querySelectorAll('.grid > div')).map((card) => ({
      label: card.querySelector('p.font-display')?.textContent?.trim() || '',
      baseLine: Array.from(card.querySelectorAll('ul > li'))
        .find((li) => /Everything in/.test(li.textContent || ''))?.textContent?.trim() || null,
      features: Array.from(card.querySelectorAll('ul > li'))
        .filter((li) => !/Everything in/.test(li.textContent || ''))
        .map((li) => li.textContent?.trim() || ''),
    }));
    const voxLine = 'ALOA Vox';
    const voxCards = cards.filter((c) => c.features.some((f) => f.includes(voxLine))).map((c) => c.label);
    return { cards, voxCards };
  });
  log('cards:', JSON.stringify(matrix.cards.map((c) => ({ label: c.label, baseLine: c.baseLine, n: c.features.length })), null, 1));
  log('cards carrying the ALOA Vox line:', JSON.stringify(matrix.voxCards));

  // No feature repeats across cards
  const seen = new Map();
  let dup = null;
  for (const c of matrix.cards) for (const f of c.features) {
    if (seen.has(f)) dup = f;
    seen.set(f, c.label);
  }
  log('repeated feature lines across cards:', dup ? JSON.stringify(dup) : 'NONE');

  // 2. The Vox band tier line
  const voxBand = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('section p')).find((p) => /plan and above/.test(p.textContent || ''));
    return el ? el.textContent?.trim() : null;
  });
  log('vox band tier line:', JSON.stringify(voxBand));

  // assertions
  const pass = [];
  pass.push(['Free card has no baseLine', matrix.cards[0]?.baseLine === null]);
  pass.push(['Growth baseLine', /Everything in Free, plus:/.test(matrix.cards[1]?.baseLine || '')]);
  pass.push(['Pro baseLine', /Everything in Growth, plus:/.test(matrix.cards[2]?.baseLine || '')]);
  pass.push(['Enterprise baseLine', /Everything in Pro, plus:/.test(matrix.cards[3]?.baseLine || '')]);
  pass.push(['Vox on the Pro card only', matrix.voxCards.length === 1 && matrix.voxCards[0] === 'Pro']);
  pass.push(['no repeated feature lines', dup === null]);
  pass.push(['vox band says Pro plan and above', /Pro plan and above/.test(voxBand || '')]);
  for (const [name, ok] of pass) log(`${ok ? 'PASS' : 'FAIL'} — ${name}`);
  log('console errors:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
  const failed = pass.filter(([, ok]) => !ok);
  if (failed.length) { log(`FAILURES: ${failed.length}`); process.exit(1); }
  log('ALL PASS');
})().catch((e) => { log('FATAL', e.message); process.exit(1); });
