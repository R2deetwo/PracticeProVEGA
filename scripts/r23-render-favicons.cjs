/* R23 — render the new product favicon SVGs to crisp PNGs (48px tab icon
 * + 180px apple-touch-icon) at exact device pixel ratios. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const jobs = [
    { svg: 'public/brand/vega/favicon.svg', out: 'public/brand/vega/favicon-48.png', size: 48 },
    { svg: 'public/brand/vega/favicon.svg', out: 'public/brand/vega/apple-touch-icon.png', size: 180 },
    { svg: 'public/brand/atrium/favicon.svg', out: 'public/brand/atrium/favicon-48.png', size: 48 },
    { svg: 'public/brand/atrium/favicon.svg', out: 'public/brand/atrium/apple-touch-icon.png', size: 180 },
];

(async () => {
    const browser = await chromium.launch();
    for (const j of jobs) {
        const svgAbs = path.join(root, j.svg);
        const outAbs = path.join(root, j.out);
        const page = await browser.newPage({
            viewport: { width: j.size, height: j.size },
            deviceScaleFactor: 1,
        });
        const html = `<!doctype html><meta charset="utf-8">
<style>*{margin:0;padding:0}html,body{width:${j.size}px;height:${j.size}px;overflow:hidden;background:transparent}
svg{display:block;width:${j.size}px;height:${j.size}px}</style>
${fs.readFileSync(svgAbs, 'utf8')}`;
        await page.setContent(html, { waitUntil: 'load' });
        await page.waitForTimeout(150);
        await page.screenshot({ path: outAbs, omitBackground: true });
        await page.close();
        console.log(`wrote ${j.out} (${j.size}x${j.size})`);
    }
    await browser.close();
})();
