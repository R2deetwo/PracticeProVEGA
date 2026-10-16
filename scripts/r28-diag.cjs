#!/usr/bin/env node
/** r28-diag — why is the Vega skin not active for the demo user? */
const { chromium } = require('playwright');
const URL = process.env.VITE_URL || 'http://localhost:5199';
(async () => {
  const launchOpts = { headless: true };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', m => { if (m.type() === 'warn' || m.type() === 'error') console.log('[console]', m.text().slice(0, 160)); });
  await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.evaluate(() => {
    sessionStorage.setItem('practicepro_user_session', JSON.stringify({ token: 'demo@practicepro.ng' }));
    sessionStorage.setItem('practicepro_demo_product', 'vega');
    localStorage.setItem('practicepro_terms_accepted_version', '2026-07-27-v4');
  });
  await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(12000);
  const info = await page.evaluate(() => {
    const el = document.querySelector('.app-container');
    return {
      containerClass: el ? el.className : 'NOT FOUND',
      demoProductFlag: sessionStorage.getItem('practicepro_demo_product'),
      session: sessionStorage.getItem('practicepro_user_session'),
      title: document.title,
      favicon: Array.from(document.querySelectorAll('link[rel="icon"]')).map(l => l.getAttribute('href')),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
