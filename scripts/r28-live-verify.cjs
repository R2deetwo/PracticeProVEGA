#!/usr/bin/env node
/** r28-live-verify — confirm the R28 surfaces on production. */
const { chromium } = require('playwright');
(async () => {
  const launchOpts = { headless: true };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const b = await chromium.launch(launchOpts);
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 80)));

  await p.goto('https://practice-pro-vega.vercel.app/vega', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await p.evaluate(async () => {
    const sc = Array.from(document.querySelectorAll('*')).find(el => { const s = getComputedStyle(el); return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 100; });
    const limit = sc ? sc.scrollHeight : 4000;
    for (let y = 0; y <= limit; y += 600) { if (sc) sc.scrollTop = y; await new Promise(r => setTimeout(r, 60)); }
  });
  await p.waitForTimeout(2200);
  const vega = await p.evaluate(() => ({
    band: !!document.getElementById('workspace'),
    heading: (document.getElementById('vega-workspace-heading') || {}).textContent || 'MISSING',
    shots: Array.from(document.querySelectorAll('img')).filter(i => (i.getAttribute('src') || '').includes('/app/')).map(i => i.complete && i.naturalWidth > 0),
    favicon: Array.from(document.querySelectorAll('link[rel="icon"]')).map(l => l.getAttribute('href')),
  }));
  console.log('VEGA LIVE:', JSON.stringify(vega));

  await p.goto('https://practice-pro-vega.vercel.app/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(2000);
  const hub = await p.evaluate(() => {
    const h1 = document.querySelector('h1');
    const subs = Array.from(document.querySelectorAll('p')).find(pp => pp.textContent.includes('custom systems'));
    return { h1: h1 ? h1.textContent.trim() : 'MISSING', sub: subs ? subs.textContent.trim() : 'MISSING' };
  });
  console.log('HUB LIVE:', JSON.stringify(hub));
  console.log('page errors:', errs.length ? JSON.stringify(errs) : 'none');
  await b.close();
})();
