/**
 * probe-lightbox-r81.ts — visual check of the lightbox true-expand: open a
 * capture from the suite section, screenshot FIT mode, toggle 1:1 and
 * screenshot the native-resolution view (scrollable, drag-pan cursor).
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const BASE = process.env.CAPTURE_BASE || 'http://localhost:5000';

async function main() {
  const EXECUTABLE = '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(BASE + '/vega#suite', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // The Documents tab carries the DraftPro editor exhibit — click the tab,
  // then the capture's expand hit-area.
  await page.click('button[role="tab"]:has-text("Smart Documents")');
  await page.waitForTimeout(800);
  // The expand control is the transparent full-cover button over the shot.
  await page.click('button[aria-label*="Expand the"]');
  await page.waitForSelector('[role="dialog"]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  const fit = await page.screenshot({ type: 'jpeg', quality: 80 });
  writeFileSync('/tmp/render/lightbox-fit.jpg', fit);

  // Toggle to 1:1.
  await page.click('button[aria-pressed]:has-text("Fit")');
  await page.waitForTimeout(1200);
  const full = await page.screenshot({ type: 'jpeg', quality: 80 });
  writeFileSync('/tmp/render/lightbox-full.jpg', full);

  // Geometry probe: frame width in both modes.
  const geo = await page.evaluate(() => {
    const frame = document.querySelector('[role="dialog"] figure > div[style*="aspect-ratio"], [role="dialog"] figure > div') as HTMLElement | null;
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null;
    const stage = dialog?.querySelector('.overflow-auto') as HTMLElement | null;
    return {
      frameWidth: frame ? Math.round(frame.getBoundingClientRect().width) : null,
      stageScrollable: stage ? stage.scrollWidth > stage.clientWidth : null,
      hasToggle: !!dialog?.querySelector('button[aria-pressed]'),
    };
  });
  console.log(JSON.stringify(geo, null, 2));
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
