#!/usr/bin/env node
/** R69 — LIVE verification against practice-pro-vega.vercel.app: the
 *  pill is gone, the presence overlay sits in the bell→profile gap and
 *  opens the roster, the lightbox opens/labeled/navigable, R68's band
 *  geometry held. */
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/home/z/my-project/download/r69-captures';
const BASE = 'https://practice-pro-vega.vercel.app';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const report = { consoleErrors: [] };
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && report.consoleErrors.push(m.text()));
  await page.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 90000 });
  await sleep(1000);
  await page.evaluate(() => {
    const banner = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Acknowledge');
    banner?.click();
  });
  await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
  await page.waitForFunction(() => {
    const v = document.querySelector('section#home video');
    const h = document.querySelector('h1');
    return v && v.readyState >= 2 && !v.paused && h && parseFloat(getComputedStyle(h).opacity) > 0.9;
  }, { timeout: 30000 }).catch(() => {});
  await sleep(1500);

  report.hero = await page.evaluate(() => {
    const sec = document.querySelector('section#home');
    const h1 = sec.querySelector('h1').getBoundingClientRect();
    const band = sec.querySelector('video').closest('div[class*="aspect-video"]').getBoundingClientRect();
    const img = sec.querySelector('img[src*="dashboard.jpg"]');
    const trigger = sec.querySelector('[data-collab-trigger]');
    let presence = null;
    if (img && trigger) {
      const ir = img.getBoundingClientRect(), br = trigger.getBoundingClientRect();
      presence = +(((br.right - ir.left) / ir.width) * 100).toFixed(2);
    }
    return {
      pillGone: !sec.querySelector('.max-w-3xl > p.inline-flex'),
      h1Top: +h1.top.toFixed(0),
      bandRatio: +(band.width / band.height).toFixed(4),
      bandTop: +(band.top - sec.getBoundingClientRect().top).toFixed(0),
      presenceRightPct: presence,
    };
  });
  // roster on the live hero card
  await page.click('section#home [data-collab-trigger]');
  await page.waitForSelector('[data-collab-menu]', { timeout: 8000 });
  report.roster = await page.evaluate(() => ({
    rows: document.querySelectorAll('[data-collab-menu] li[role="menuitem"]').length,
    dmButtons: document.querySelectorAll('[data-collab-menu] button[aria-label^="Send direct message to"]').length,
  }));
  await page.keyboard.press('Escape');
  await sleep(200);
  // lightbox: open + label + key nav
  await page.click('section#home button[aria-label="Expand the Dashboard view"]');
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 8000 });
  await sleep(1500);
  report.lightbox = await page.evaluate(() => ({
    label: document.querySelector('[role="dialog"] h2')?.textContent,
    presenceInside: !!document.querySelector('[role="dialog"] [data-collab-trigger]'),
    imgBright: (() => {
      const img = document.querySelector('[role="dialog"] img');
      return img && img.getBoundingClientRect().width > 300;
    })(),
  }));
  await page.keyboard.press('ArrowRight');
  await sleep(1200);
  report.lightbox.afterArrowRight = await page.evaluate(() => document.querySelector('[role="dialog"] h2')?.textContent);
  await page.keyboard.press('Escape');
  await sleep(300);
  report.lightbox.closed = await page.evaluate(() => !document.querySelector('[role="dialog"]'));
  await page.screenshot({ path: `${OUT}/live-hero-1920.png` });
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
