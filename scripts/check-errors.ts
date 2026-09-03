import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });

  const failedRequests: string[] = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      failedRequests.push(`[${response.status()}] ${response.url().slice(0, 120)}`);
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[CONSOLE ERROR]: ${msg.text().slice(0, 400)}`);
  });

  await page.goto('https://practice-pro-vega.vercel.app/atrium', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('\n=== Failed requests ===');
  failedRequests.forEach(r => console.log(r));

  await browser.close();
}

main();
