const { chromium } = require('playwright');
const { spawn } = require('child_process');
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', '4177', '--strictPort', '--host', '127.0.0.1'], { cwd: process.cwd(), stdio: 'pipe' });
  await new Promise(r => setTimeout(r, 3500));
  const browser = await chromium.launch({ executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4177/vega', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelectorAll('[data-vg-reveal]').forEach(el => el.classList.add('vg-in')));
  const scrollToText = async (needle, extra = -120) => {
    await page.evaluate(({ n, x }) => {
      const root = document.querySelector('main')?.parentElement;
      const h = Array.from(document.querySelectorAll('h2,h3')).find(el => el.textContent.includes(n));
      if (h && root) root.scrollTo({ top: root.scrollTop + h.getBoundingClientRect().top + x, behavior: 'instant' });
    }, { n: needle, x: extra });
    await page.waitForTimeout(450);
  };
  await scrollToText('Try the arithmetic');
  await page.screenshot({ path: '/home/z/my-project/tmp/r39-qa/vega-ai-pullouts.png' });
  await page.getByRole('button', { name: /drafting studio/i }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/home/z/my-project/tmp/r39-qa/vega-ai-pullouts-b.png' });
  await browser.close(); server.kill();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
