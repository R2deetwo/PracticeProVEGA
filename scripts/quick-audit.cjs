// Quick Playwright test to verify the Convex URL fix
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Use incognito context with no cache
  const context = await browser.newContext({
    bypassCSP: true,
    ignoreHTTPSErrors: true,
    // Clear all storage
    storageState: undefined,
  });
  const page = await context.newPage();

  // Clear all caches and storage before loading
  await page.route('**/*', route => {
    const headers = route.request().headers;
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    route.continue({ headers });
  });

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('requestfailed', req => errors.push('FAILED: ' + req.url()));
  page.on('response', res => {
    if (res.status() >= 400) {
      errors.push(`HTTP ${res.status()}: ${res.url()}`);
    }
  });

  console.log('Loading landing page with fresh browser...');
  await page.goto('https://practice-pro-vega.vercel.app/', { waitUntil: 'networkidle', timeout: 20000 });
  
  // Clear any cached state
  await page.evaluate(() => {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    try { caches.keys().then(keys => keys.forEach(k => caches.delete(k))); } catch {}
  });
  
  // Reload after clearing
  await page.goto('https://practice-pro-vega.vercel.app/?impersonate=demo@practicepro.ng', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);

  const bodyText = await page.textContent('body');
  console.log('Body text length:', bodyText?.length || 0);
  console.log('Body text preview:', bodyText?.substring(0, 300));
  
  console.log('\nErrors:', errors.length);
  const unique = [...new Set(errors)];
  unique.slice(0, 10).forEach(e => console.log('  →', e.substring(0, 150)));

  await browser.close();
})();
