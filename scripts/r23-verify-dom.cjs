/* R23 — DOM-level verification of the marks: do the SVGs render, are the
 * gradient defs present, and does a tight element screenshot show pixels? */
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    await page.goto('http://21.0.12.14:4173/vega', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const report = await page.evaluate(() => {
        const out = { svgs: [], firstMarkHTML: null };
        // The nav lockup: VegaMark renders an svg with a linearGradient child
        const svgs = Array.from(document.querySelectorAll('nav svg, header svg')).slice(0, 6);
        svgs.forEach((s) => {
            const r = s.getBoundingClientRect();
            out.svgs.push({
                w: Math.round(r.width), h: Math.round(r.height),
                x: Math.round(r.x), y: Math.round(r.y),
                hasGradient: !!s.querySelector('linearGradient'),
                pathCount: s.querySelectorAll('path').length,
            });
        });
        const first = document.querySelector('nav svg, header svg');
        if (first) out.firstMarkHTML = first.outerHTML.slice(0, 400);
        return out;
    });
    console.log(JSON.stringify(report, null, 2));

    // Tight screenshot of the first mark, blown up 4x for inspection
    const mark = page.locator('nav svg, header svg').first();
    const box = await mark.boundingBox();
    if (box) {
        await page.screenshot({
            path: '/home/z/my-project/download/r23-mark-closeup.png',
            clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 },
        });
        console.log('closeup captured, box=', JSON.stringify(box));
    }
    await browser.close();
})();
