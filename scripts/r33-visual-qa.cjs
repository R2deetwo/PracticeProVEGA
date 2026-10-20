#!/usr/bin/env node
/* R33 — live visual QA capture: serve dist, let WebGL run, screenshot
 * the three sites + the specific R33 bands (vega Balance, vega portrait,
 * hub about, hub final CTA). Not deterministic — a QA read, not a diff. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', 'tmp-r33-shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
    const browser = await chromium.launch({
        // CHROME_PATH: override for environments whose playwright cache
        // holds a different chromium build than the driver expects.
        executablePath: process.env.CHROME_PATH || undefined,
        args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const shots = [
        { name: 'hub-hero', path: '/', wait: 4200 },
        { name: 'hub-about', path: '/#about', wait: 2600 },
        { name: 'hub-final-cta', path: '/', scroll: 26000, wait: 3000 },
        { name: 'vega-hero', path: '/vega', wait: 3200 },
        { name: 'vega-record-balance', path: '/vega', anchor: '#record', wait: 4200 },
        { name: 'vega-credentials-people', path: '/vega', anchor: '#record', scroll: 2600, wait: 3200 },
        { name: 'atrium-hero', path: '/atrium', wait: 4200 },
        { name: 'atrium-full', path: '/atrium', scroll: 12000, wait: 2600 },
    ];
    for (const s of shots) {
        await page.goto(`${BASE}${s.path}`, { waitUntil: 'networkidle' });
        if (s.anchor) {
            await page.evaluate((a) => { document.querySelector(a)?.scrollIntoView({ block: 'center' }); }, s.anchor);
        }
        if (s.scroll) {
            await page.evaluate((y) => window.scrollTo({ top: y }), s.scroll);
        }
        await page.waitForTimeout(s.wait);
        await page.screenshot({ path: path.join(OUT, `${s.name}.png`) });
        console.log(`✓ ${s.name}`);
    }
    await browser.close();
    console.log('DONE ->', OUT);
})();
