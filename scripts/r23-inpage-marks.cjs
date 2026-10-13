/* R23 — in-page closeups of the new marks: vega nav, vega footer lockup,
 * atrium nav, hub products dropdown. Served from dist/ on :4173. */
const { chromium } = require('playwright');

const BASE = 'http://21.0.12.14:4173';
const shots = [
    { url: `${BASE}/vega`, sel: 'nav', name: 'vega-nav' },
    { url: `${BASE}/vega`, sel: 'footer', name: 'vega-footer' },
    { url: `${BASE}/atrium`, sel: 'nav', name: 'atrium-nav' },
];

(async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    for (const s of shots) {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
        await page.goto(s.url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1200);
        const el = page.locator(s.sel).first();
        if (await el.count() > 0) {
            await el.screenshot({ path: `/home/z/my-project/download/r23-${s.name}.png` });
            console.log(`captured ${s.name}`);
        } else {
            console.log(`MISSING ${s.sel} on ${s.url}`);
        }
        await page.close();
    }
    await browser.close();
})();
