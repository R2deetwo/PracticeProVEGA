#!/usr/bin/env node
/**
 * r49-retake — retake the /vega band screenshots at a tall viewport.
 *
 * The regulatory band is ~1,700px tall; at a 900px viewport the element
 * screenshot stitches badly (the VLM saw a clipped, red-filled bottom).
 * A 3,200px viewport captures the whole section in one frame.
 */
const { chromium } = require('playwright');
const URL = process.env.VITE_URL || 'http://localhost:5199';

(async () => {
    const b = await chromium.launch({
        headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
    });
    const page = await b.newPage({ viewport: { width: 1440, height: 3200 } });
    await page.goto(URL + '/vega', { waitUntil: 'networkidle', timeout: 60000 });
    await page.click('text=Acknowledge', { timeout: 2500 }).catch(() => {});
    await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
    await page.waitForTimeout(600);
    await page.locator('#regulatory').screenshot({ path: '/tmp/r49-regulatory.png' });
    await page.locator('#pricing').screenshot({ path: '/tmp/r49-pricing.png' });
    await b.close();
    console.log('retaken');
})();
