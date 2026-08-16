import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  for (const product of ['atrium', 'vega']) {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`  [CONSOLE ERROR ${product}]: ${msg.text().slice(0, 500)}`);
    });
    page.on('pageerror', err => console.log(`  [PAGE ERROR ${product}]: ${err.message.slice(0, 500)}`));

    try {
      console.log(`\n=== Testing /${product} (mobile 375x812) — FULL PAGE ===`);
      await page.goto(`https://practice-pro-vega.prototypechigo.workers.dev/${product}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Get the full rendered text content
      const bodyText = await page.evaluate(() => document.body?.innerText || '');

      // Find specific sections and their scroll positions
      const sections = await page.evaluate(() => {
        const results: Array<{tag: string, text: string, y: number, visible: boolean}> = [];
        // Find all headings and buttons
        document.querySelectorAll('h1, h2, h3, button').forEach(el => {
          const text = el.textContent?.trim().slice(0, 80) || '';
          const rect = el.getBoundingClientRect();
          if (text && rect.width > 0) {
            results.push({
              tag: el.tagName,
              text,
              y: Math.round(rect.top + window.scrollY),
              visible: rect.top < window.innerHeight && rect.bottom > 0
            });
          }
        });
        return results;
      });

      console.log(`\nVisible headings and buttons (first 30):`);
      sections.slice(0, 30).forEach(s => {
        console.log(`  [${s.tag}] y=${s.y} ${s.visible ? '👁' : '  '} "${s.text}"`);
      });

      // Check specifically for the testimonials heading
      const testimonialHeading = sections.find(s => s.text.includes('What Nigerian'));
      if (testimonialHeading) {
        console.log(`\n✅ Testimonials heading found at y=${testimonialHeading.y}: "${testimonialHeading.text}"`);
      } else {
        console.log(`\n❌ Testimonials heading NOT found`);
      }

      // Check for Final CTA
      const finalCta = sections.find(s => s.text.includes('Ready to'));
      if (finalCta) {
        console.log(`✅ Final CTA found at y=${finalCta.y}: "${finalCta.text}"`);
      }

      // Check for SCE button
      const sceButton = sections.find(s => s.text.includes('Calculate your SCE'));
      if (sceButton) {
        console.log(`✅ SCE button found at y=${sceButton.y}: "${sceButton.text}"`);
      }

      // Take full-page screenshot
      await page.screenshot({ path: `/home/z/my-project/audit-results/live-${product}-fullpage.png`, fullPage: true });
      console.log(`Full-page screenshot saved: audit-results/live-${product}-fullpage.png`);

    } catch(e: any) {
      console.log(`FAIL: ${e.message.slice(0, 300)}`);
    }
    await page.close();
  }

  await browser.close();
}

main();
