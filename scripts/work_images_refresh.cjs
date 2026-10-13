/* work_images_refresh — recapture the "Our work" product-page shots from the
 * new build (the pages changed: Night Chambers /vega + LawPavilion
 * arrangement, Well-Kept Estate /atrium), replacing the stale light-era
 * shots. Also captures the portal login pages for a drift comparison.
 * Existing images are progressive JPEGs; sharp re-encodes to match. */
const { chromium } = require('playwright');
const sharp = require('sharp');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const WORK = path.join(__dirname, '..', 'public', 'assets', 'landing', 'work');
const TMP = path.join(__dirname, '..', '..', 'tmp', 'work-captures');
fs.mkdirSync(TMP, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
    let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
    fs.readFile(path.join(DIST, p), (err, data) => {
        if (err) {
            fs.readFile(path.join(DIST, 'index.html'), (e2, d2) => {
                if (e2) { res.writeHead(404); res.end(); return; }
                res.writeHead(200, { 'content-type': 'text/html' }); res.end(d2);
            });
            return;
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
        res.end(data);
    });
});

const JOBS = [
    { route: '/vega', vp: { width: 1440, height: 900 }, out: 'vega-page.jpg', vega: true },
    { route: '/vega', vp: { width: 390, height: 844 }, out: 'vega-m-page.jpg', vega: true },
    { route: '/atrium', vp: { width: 1440, height: 900 }, out: 'atrium-page.jpg', vega: false },
    { route: '/atrium', vp: { width: 390, height: 844 }, out: 'atrium-m-page.jpg', vega: false },
    { route: '/portal/client/login', vp: { width: 1440, height: 900 }, out: 'vega-portal-fresh.jpg', vega: false, portal: true },
    { route: '/portal/tenant/login', vp: { width: 1440, height: 900 }, out: 'atrium-portal-fresh.jpg', vega: false, portal: true },
];

(async () => {
    await new Promise(r => server.listen(4183, r));
    const browser = await chromium.launch();
    for (const j of JOBS) {
        const page = await browser.newPage({ viewport: j.vp });
        await page.goto(`http://localhost:4183${j.route}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
        if (j.vega) { try { await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all'))); } catch {} }
        await page.waitForTimeout(j.portal ? 2200 : 3000);
        const shot = path.join(TMP, `${j.out}.png`);
        await page.screenshot({ path: shot });
        await page.close();
        // Progressive JPEG q85 — matches the existing work-image format.
        const target = path.join(WORK, j.out);
        await sharp(shot).jpeg({ quality: 85, progressive: true }).toFile(target);
        console.log(`wrote ${path.relative(path.join(__dirname, '..'), target)} (${fs.statSync(target).size} bytes)`);
    }
    await browser.close();
    server.close();
    console.log('done');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
