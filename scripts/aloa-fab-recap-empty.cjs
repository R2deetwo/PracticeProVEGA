const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/z/my-project/tmp/pprepo';
const OUT = path.join(ROOT, 'docs/ui-audit/aloa-fab/after');
const URL = 'http://localhost:5199';
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
  await page.waitForFunction(() => { const el = document.querySelector('.app-container'); return !!el && /app-skin-(vega|atrium)/.test(el.className); }, { timeout: 45000 });
  await page.waitForTimeout(3000);
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome', args: ['--use-fake-device-for-media-stream'] });
  for (const vp of [{ name: '390x844', w: 390, h: 844, mobile: true }, { name: '768x1024', w: 768, h: 1024, mobile: false }, { name: '1440x900', w: 1440, h: 900, mobile: false }]) {
    for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, permissions: ['microphone'] });
      const page = await ctx.newPage();
      await bootSession(page);
      await page.click('[data-tour-id="aloa-fab"]');
      await page.waitForSelector('div[role="dialog"][aria-label="ALOA"]', { timeout: 15000 });
      await page.waitForTimeout(1200);
      if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.screenshot({ path: path.join(OUT, `panel-chat-empty-${vp.name}-${theme}.png`) });
      console.error('recaptured', vp.name, theme);
      await ctx.close();
    }
  }
  await browser.close();
})();
