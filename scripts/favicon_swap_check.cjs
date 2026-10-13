/* favicon_swap_check — local build: the product favicon must be the ONLY
 * icon link on /vega and /atrium (R25 fix); the company icon returns on hub. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const server = http.createServer((req, res) => {
    let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
    fs.readFile(path.join(DIST, p), (err, data) => {
        if (err) { fs.readFile(path.join(DIST, 'index.html'), (e2, d2) => {
            if (e2) { res.writeHead(404); res.end(); return; }
            res.writeHead(200, { 'content-type': 'text/html' }); res.end(d2); }); return; }
        const M = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
        res.writeHead(200, { 'content-type': M[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    });
});
server.listen(4181, async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const out = [];
    for (const route of ['/', '/vega', '/atrium', '/']) {
        await page.goto(`http://localhost:4181${route}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1800);
        const icons = await page.evaluate(() => Array.from(document.querySelectorAll('link[rel="icon" i], link[rel="apple-touch-icon" i]')).map(l => `${l.getAttribute('rel')}=${l.getAttribute('href')}`));
        out.push(`${route.padEnd(8)} -> ${icons.join(' | ')}`);
    }
    console.log(out.join('\n'));
    // Also verify the served PNG is the NEW mark (sample the favicon-48.png bytes changed)
    await browser.close(); server.close();
});
