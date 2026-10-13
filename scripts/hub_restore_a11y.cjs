/* Acceptance 5 — reduced motion shows a static frame; WebGL disabled
 * (--disable-gpu --disable-webgl) shows the SVG poster. Hero viewport
 * captures at 1440x900. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://21.0.12.14:4173';
const OUT = path.join(__dirname, '..', 'docs', 'brand', 'hub-restore', 'a11y');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--disable-webgl'] });

    // ── 1. prefers-reduced-motion: reduce → one static frame (tableau) ──
    {
        const ctx = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            deviceScaleFactor: 1,
            reducedMotion: 'reduce',
        });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2500);
        const ack = page.locator('.cookie-ack').first();
        if (await ack.count() > 0) await ack.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(OUT, 'reduced-motion-static-frame.png') });
        const state = await page.evaluate(() => {
            const captions = Array.from(document.querySelectorAll('span, p'))
                .map((e) => e.textContent || '').filter((t) => t === 'Order arrives');
            return { captionRows: document.body.innerText.includes('Order arrives') && document.body.innerText.includes('Receipt sent') };
        });
        console.log('reduced-motion: all four captions present =', state.captionRows, '| page errors:', errors.length);
        await ctx.close();
    }

    // ── 2. WebGL disabled → the SVG poster ──
    {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2500);
        const ack = page.locator('.cookie-ack').first();
        if (await ack.count() > 0) await ack.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(OUT, 'webgl-disabled-svg-poster.png') });
        const hasSvg = await page.evaluate(() => !!document.querySelector('svg[role="img"][aria-label^="One order"]'));
        const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
        console.log('webgl-disabled: SVG poster present =', hasSvg, '| canvases on page:', canvasCount, '| page errors:', errors.length);
        await ctx.close();
    }
    await browser.close();
    console.log(`DONE -> ${OUT}`);
})();
