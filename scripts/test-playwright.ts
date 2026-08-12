import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  try {
    console.log('Trying 127.0.0.1:5173...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('SUCCESS: Page loaded');
    const title = await page.title();
    console.log('Title:', title);
    const bodyLen = await page.evaluate(() => document.body?.innerText?.length || 0);
    console.log('Body text length:', bodyLen);
  } catch(e: any) {
    console.log('FAIL:', e.message.slice(0, 200));
  }
  await browser.close();
}

main();
