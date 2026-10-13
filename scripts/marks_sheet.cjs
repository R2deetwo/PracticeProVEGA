/* marks_sheet — the new R25 marks at real scales: nav lockups on /vega and
 * /atrium, the dropdown, and the favicon PNGs at 16/32/48px. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const OUT = path.join(__dirname, '..', '..', '..', 'download', 'r25-marks');
fs.mkdirSync(OUT, { recursive: true });
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
server.listen(4182, async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:4182/vega', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    // nav lockup
    const nav = await page.$('header');
    await nav.screenshot({ path: path.join(OUT, 'vega-nav-lockup.png') });
    // favicon PNGs at tab scale — build a small contact sheet page
    await page.setContent(`<!doctype html><html><body style="margin:0;background:#333;display:flex;align-items:center;gap:28px;padding:28px;font-family:monospace;color:#eee">
<img src="http://localhost:4182/brand/vega/favicon-48.png" width="16" height="16"><span>16px</span>
<img src="http://localhost:4182/brand/vega/favicon-48.png" width="32" height="32"><span>32px</span>
<img src="http://localhost:4182/brand/vega/favicon-48.png" width="48" height="48"><span>48px</span>
<span style="width:40px"></span>
<img src="http://localhost:4182/brand/atrium/favicon-48.png" width="16" height="16"><span>16px</span>
<img src="http://localhost:4182/brand/atrium/favicon-48.png" width="32" height="32"><span>32px</span>
<img src="http://localhost:4182/brand/atrium/favicon-48.png" width="48" height="48"><span>48px</span>
</body></html>`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'favicon-scales.png') });
    // atrium nav lockup
    await page.goto('http://localhost:4182/atrium', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const nav2 = await page.$('header');
    await nav2.screenshot({ path: path.join(OUT, 'atrium-nav-lockup.png') });
    await browser.close(); server.close();
    console.log('captured: vega-nav-lockup.png, atrium-nav-lockup.png, favicon-scales.png');
});
