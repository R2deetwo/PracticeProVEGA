/* P0-A5 — visual baseline capture for the sites split.
 * The landing page scrolls inside a div (h-[100dvh] overflow-y-auto),
 * NOT the window. Captures every "screen" of that container by stepping
 * its scrollTop, waiting 700ms per step, stitching into one tall PNG per
 * surface+viewport. Outputs docs/brand/baseline/{surface}-{desktop,mobile}-NN.png
 * (NN = screen index) plus a full-page capture per surface. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://21.0.12.14:4173';
const OUT = path.join(__dirname, '..', 'docs', 'brand', 'baseline');
fs.mkdirSync(OUT, { recursive: true });

const surfaces = [
    { name: 'hub', path: '/' },
    { name: 'vega', path: '/vega' },
    { name: 'atrium', path: '/atrium' },
];
const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
];

(async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    for (const vp of viewports) {
        for (const s of surfaces) {
            const ctx = await browser.newContext({
                viewport: { width: vp.width, height: vp.height },
                deviceScaleFactor: 1,
            });
            const page = await ctx.newPage();
            await page.goto(`${BASE}${s.path}`, { waitUntil: 'networkidle' });
            await page.waitForTimeout(1500);

            // dismiss cookie bar if present
            const ack = page.locator('.cookie-ack').first();
            if (await ack.count() > 0) {
                await ack.click({ timeout: 3000 }).catch(() => {});
                await page.waitForTimeout(400);
            }
            // force-reveal vega scroll-reveal sections
            await page.evaluate(() => document.dispatchEvent(new CustomEvent('vg:reveal-all')));
            await page.waitForTimeout(1200);

            // identify the scroll container: the div with overflow-y-auto + h-[100dvh]
            const info = await page.evaluate(() => {
                const els = Array.from(document.querySelectorAll('div'));
                const sc = els.find((e) => {
                    const cs = getComputedStyle(e);
                    return cs.overflowY === 'auto' && e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 400;
                });
                return sc
                    ? { found: true, scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight }
                    : { found: false, bodyScroll: document.body.scrollHeight };
            });

            const step = vp.height;
            const maxScroll = info.found ? info.scrollHeight - info.clientHeight : document.body.scrollHeight - vp.height;
            let n = 0;
            for (let y = 0; y <= maxScroll; y += step, n++) {
                await page.evaluate((yy) => {
                    const els = Array.from(document.querySelectorAll('div'));
                    const sc = els.find((e) => {
                        const cs = getComputedStyle(e);
                        return cs.overflowY === 'auto' && e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 400;
                    });
                    if (sc) sc.scrollTop = yy; else window.scrollTo(0, yy);
                }, y);
                await page.waitForTimeout(700);
                await page.screenshot({
                    path: path.join(OUT, `${s.name}-${vp.name}-${String(n).padStart(2, '0')}.png`),
                });
            }
            console.log(`${s.name}-${vp.name}: ${n} screens, container=${info.found ? 'inner-div' : 'window'}`);
            await ctx.close();
        }
    }
    await browser.close();
})();
