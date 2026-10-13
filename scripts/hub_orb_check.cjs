/* hub-orb-check — serve dist/ and capture the hub hero with the restored
 * living orb, desktop + mobile, plus a WebGL-off poster check. Proof for the
 * hub-revert task (owner: the diorama was "particularly rubbish"). */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const OUT = path.join(__dirname, '..', '..', '..', 'download', 'hub-orb-check');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };

const server = http.createServer((req, res) => {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
    const file = path.join(DIST, p);
    fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('nf'); return; }
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
    });
});

(async () => {
    await new Promise(r => server.listen(4177, r));
    const results = [];
    const check = (name, ok, extra = '') => { results.push(`${ok ? 'OK ' : 'BAD'} ${name}${extra ? ' — ' + extra : ''}`); };

    for (const [label, vp, webgl] of [
        ['desktop', { width: 1440, height: 900 }, true],
        ['desktop-webgl-off', { width: 1440, height: 900 }, false],
        ['mobile', { width: 390, height: 844 }, true],
    ]) {
        const browser = await chromium.launch({ args: webgl ? [] : ['--disable-webgl'] });
        const page = await browser.newPage({ viewport: vp });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
        await page.goto('http://localhost:4177/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2600); // let the orb settle + hero-stagger finish
        const h1 = await page.locator('h1').first().innerText().catch(() => '');
        check(`${label}: H1 present`, h1.includes('finally in one place'), JSON.stringify(h1).slice(0, 60));
        const canvas = await page.locator('canvas').count();
        check(`${label}: canvas count (orb live)`, webgl ? canvas === 1 : canvas === 0, `canvas=${canvas}`);
        const diorama = await page.locator('text=Order arrives').count();
        check(`${label}: diorama captions gone`, diorama === 0, `found=${diorama}`);
        await page.screenshot({ path: path.join(OUT, `hub-hero-${label}.png`) });
        if (label === 'desktop') {
            // full page too
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(800);
            await page.screenshot({ path: path.join(OUT, 'hub-hero-desktop-scrolled.png') });
            // horizontal overflow check
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
            check('desktop: no horizontal overflow', !overflow);
        }
        check(`${label}: zero page errors`, errors.length === 0, errors.join('; '));
        await browser.close();
    }
    server.close();
    console.log(results.join('\n'));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
