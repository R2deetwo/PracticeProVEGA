#!/usr/bin/env node
/** Phase 0 addendum: offline-queued state (offline BEFORE take) + FAB a11y labels. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'ui-audit', 'aloa-fab', 'before');
const URL = process.env.VITE_URL || 'http://localhost:5199';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
const log = (...a) => console.error(...a);

async function bootSession(page) {
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
  await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForFunction(
    () => { const el = document.querySelector('.app-container'); return !!el && /app-skin-(vega|atrium)/.test(el.className); },
    { timeout: 45000 }
  );
  await page.waitForTimeout(3000);
}

(async () => {
  const browser = await chromium.launch({
    headless: true, executablePath: EXEC,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  });
  const fabA11y = {};
  const queued = {};
  for (const vp of [
    { name: '390x844', w: 390, h: 844, mobile: true },
    { name: '768x1024', w: 768, h: 1024, mobile: false },
    { name: '1440x900', w: 1440, h: 900, mobile: false },
  ]) {
    for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({
        viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile,
        permissions: ['microphone'],
      });
      const page = await ctx.newPage();
      await bootSession(page);
      const fab = await page.$('[data-tour-id="aloa-fab"]');
      fabA11y[`${vp.name}-${theme}`] = {
        ariaLabel: await fab.getAttribute('aria-label'),
        tooltipTitle: await fab.getAttribute('title'),
        tooltipText: await page.evaluate(() => {
          const el = [...document.querySelectorAll('div')].find((d) => d.textContent && /Open ALOA|Unlock ALOA/.test(d.textContent) && getComputedStyle(d).position !== 'static');
          return el ? el.textContent.trim() : null;
        }),
      };
      // FAB overlap check (mobile): bottom nav present?
      if (vp.mobile) {
        fabA11y[`${vp.name}-${theme}`].fabBox = await fab.boundingBox();
      }
      // offline queued state: offline BEFORE the take
      await ctx.setOffline(true);
      await page.click('[data-tour-id="aloa-fab"]');
      await page.waitForSelector('button[aria-label="Close panel"]', { timeout: 15000 });
      await page.click('button[aria-label="Open Vox mode"]');
      await page.waitForTimeout(1500);
      const mic = await page.$('button[aria-label="Start recording"]');
      if (mic) {
        await mic.click();
        await page.waitForTimeout(2600);
        await page.locator('button:has-text("Stop")').last().click().catch(() => {});
        await page.waitForTimeout(1500);
        if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
        const file = path.join(OUT, `vox-speak-queued-${vp.name}-${theme}.png`);
        await page.screenshot({ path: file });
        queued[`${vp.name}-${theme}`] = path.relative(ROOT, file);
        log('queued captured', vp.name, theme);
      } else {
        log('mic not reachable in idle state for', vp.name, theme);
      }
      await ctx.setOffline(false).catch(() => {});
      await ctx.close();
    }
  }
  await browser.close();
  const p = path.join(ROOT, 'docs', 'ui-audit', 'aloa-fab', 'probes.json');
  const probes = JSON.parse(fs.readFileSync(p, 'utf8'));
  probes.runtime.fabA11y = fabA11y;
  probes.runtime.queuedStates = queued;
  fs.writeFileSync(p, JSON.stringify(probes, null, 2));
  log('DONE');
})().catch((e) => { log('FATAL', e); process.exit(1); });
