/* vega_rearrange_check — capture the rearranged /vega (LawPavilion
 * arrangement) and verify the structural contract: suite grid, record
 * band, segments tabs (switchable), alternating deep-dives, nav links,
 * no 390px overflow, zero page errors. */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const OUT = path.join(__dirname, '..', '..', '..', 'download', 'vega-rearrange');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
    fs.readFile(path.join(DIST, p), (err, data) => {
        if (err) {
            // SPA fallback — routes like /vega have no file on disk.
            fs.readFile(path.join(DIST, 'index.html'), (e2, d2) => {
                if (e2) { res.writeHead(404); res.end('nf'); return; }
                res.writeHead(200, { 'content-type': 'text/html' });
                res.end(d2);
            });
            return;
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
        res.end(data);
    });
});

(async () => {
    await new Promise(r => server.listen(4179, r));
    const results = [];
    const check = (name, ok, extra = '') => results.push(`${ok ? 'OK ' : 'BAD'} ${name}${extra ? ' — ' + extra : ''}`);

    for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
        const browser = await chromium.launch();
        const page = await browser.newPage({ viewport: vp });
        const errors = [];
        page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
        await page.goto('http://localhost:4179/vega', { waitUntil: 'networkidle' });
        await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
        await page.waitForTimeout(700);

        check(`${label}: nav has The Suite`, (await page.locator('nav:has-text("The Suite")').count()) === 1);
        check(`${label}: nav has Practice Areas`, (await page.getByRole('button', { name: 'Practice Areas', exact: true }).count()) >= 1);
        const instruments = await page.locator('#suite .group').count();
        check(`${label}: suite grid 6 instruments`, instruments === 6, `got ${instruments}`);
        const figures = await page.locator('#record p.font-vega').count();
        check(`${label}: record band 4 figures`, figures === 4, `got ${figures}`);
        const tabs = await page.locator('#practice-areas [role="tab"]').count();
        check(`${label}: segments 4 tabs`, tabs === 4, `got ${tabs}`);

        // Tab switching: click tab 2 (Corporate & Commercial), panel must change
        if (label === 'desktop') {
            await page.locator('#practice-areas [role="tab"]').nth(1).click();
            await page.waitForTimeout(300);
            const panelTitle = await page.locator('#vg-segment-panel h3').first().innerText();
            check('desktop: tab switch works', panelTitle.includes('transactional desk'), JSON.stringify(panelTitle).slice(0, 50));
            // suite Explore link scrolls to court-rules
            await page.locator('#suite button:has-text("Explore calendaring")').first().click();
            await page.waitForTimeout(900);
            const crTop = await page.locator('#court-rules').evaluate(el => el.getBoundingClientRect().top);
            check('desktop: suite explore scroll works', crTop < 200 && crTop > -80, `court-rules top=${Math.round(crTop)}`);
        }

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        check(`${label}: no horizontal overflow`, !overflow);
        check(`${label}: zero page errors`, errors.length === 0, errors.join('; '));

        // full page capture
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT, `vega-${label}-top.png`) });
        await page.evaluate(() => { const el = document.querySelector('#suite'); el && el.scrollIntoView(); });
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(OUT, `vega-${label}-suite.png`) });
        await page.evaluate(() => { const el = document.querySelector('#record'); el && el.scrollIntoView(); });
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(OUT, `vega-${label}-record.png`) });
        await page.evaluate(() => { const el = document.querySelector('#practice-areas'); el && el.scrollIntoView(); });
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(OUT, `vega-${label}-segments.png`) });
        await page.evaluate(() => { const el = document.querySelector('#scale-of-charges'); el && el.scrollIntoView(); });
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(OUT, `vega-${label}-scale.png`) });
        await browser.close();
    }
    server.close();
    console.log(results.join('\n'));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
