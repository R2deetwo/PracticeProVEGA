import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  // Test both products on mobile viewport
  for (const product of ['vega', 'atrium']) {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`  [CONSOLE ERROR ${product}]: ${msg.text().slice(0, 300)}`);
    });
    page.on('pageerror', err => console.log(`  [PAGE ERROR ${product}]: ${err.message.slice(0, 300)}`));

    try {
      console.log(`\n=== Testing /${product} (mobile 375x812) ===`);
      await page.goto(`https://practice-pro-vega.prototypechigo.workers.dev/${product}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      const title = await page.title();
      console.log(`Title: ${title}`);

      // Check for visible text content
      const bodyText = await page.evaluate(() => document.body?.innerText || '');
      console.log(`Body text length: ${bodyText.length}`);

      // Check for specific sections
      const hasTestimonials = bodyText.includes('What Nigerian');
      const hasSceButton = bodyText.includes('Calculate your SCE');
      const hasFinalCta = bodyText.includes('Ready to') || bodyText.includes('stop managing chaos') || bodyText.includes('run a sharper');
      console.log(`Has testimonials: ${hasTestimonials}`);
      console.log(`Has SCE button: ${hasSceButton}`);
      console.log(`Has Final CTA: ${hasFinalCta}`);

      // If body text is short, there's likely a render error
      if (bodyText.length < 500) {
        console.log(`⚠️  Body text too short (${bodyText.length} chars) — likely a render error`);
        console.log(`First 300 chars: ${bodyText.slice(0, 300)}`);
      }

      // Take screenshot
      await page.screenshot({ path: `/home/z/my-project/audit-results/live-${product}-mobile.png`, fullPage: false });
      console.log(`Screenshot saved: audit-results/live-${product}-mobile.png`);

    } catch(e: any) {
      console.log(`FAIL: ${e.message.slice(0, 300)}`);
    }
    await page.close();
  }

  await browser.close();
}

main();
