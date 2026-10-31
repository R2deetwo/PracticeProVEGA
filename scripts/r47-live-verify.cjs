/**
 * R47 live verification — the products speak their own names.
 *
 * Production is healthy at 23b068c7 (version.json). This script probes the
 * R47 surfaces on https://practice-pro-vega.vercel.app:
 *   1. /atrium/resources — Atrium's own page: product title, product
 *      favicon, product header (mark + name), builder credit in footer.
 *   2. /vega/resources — the same, in Vega's name.
 *   3. / — the company hub: no company Resources nav item; company favicon.
 *   4. /atrium — the product page carries the product favicon.
 *   5. The Big A favicon SVG actually carries a letter A (the R47 mark).
 */
const { chromium } = require('playwright');

const BASE = 'https://practice-pro-vega.vercel.app';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

(async () => {
    const b = await chromium.launch({ headless: true, executablePath: EXEC });
    const page = await b.newPage({ viewport: { width: 1440, height: 900 } });

    // ── 1. Atrium's own resources page ──────────────────────────────────
    await page.goto(`${BASE}/atrium/resources`, { waitUntil: 'networkidle', timeout: 45000 });
    let t = await page.title();
    check('atrium/resources title carries Atrium', /atrium/i.test(t), t);

    const favicon = await page.evaluate(() => {
        const l = document.querySelector('link[rel~="icon"]') || document.querySelector('link[rel="icon"]');
        return l ? l.getAttribute('href') : null;
    });
    check('atrium/resources favicon is the product mark', /brand\/atrium/i.test(favicon || ''), String(favicon));

    const headerText = await page.evaluate(() => (document.querySelector('main') || document.body).innerText);
    check('atrium/resources header speaks Atrium', /Atrium/.test(headerText), headerText.split('\n').slice(0, 3).join(' | '));
    check('atrium/resources has a CTA', /Get Started|Talk to Sales|Start Free Trial|Start a free trial/i.test(headerText));

    const atriumFooter = await page.evaluate(() => document.body.innerText);
    check('Atrium builder credit present', /built by PracticePro/i.test(atriumFooter), (atriumFooter.match(/built by PracticePro[^\n]*/i) || [''])[0]);

    await page.screenshot({ path: '/tmp/r47-atrium-resources.png', fullPage: false });

    // ── 2. Vega's own resources page ────────────────────────────────────
    await page.goto(`${BASE}/vega/resources`, { waitUntil: 'networkidle', timeout: 45000 });
    t = await page.title();
    check('vega/resources title carries Vega', /vega/i.test(t), t);
    const vFavicon = await page.evaluate(() => {
        const l = document.querySelector('link[rel~="icon"]') || document.querySelector('link[rel="icon"]');
        return l ? l.getAttribute('href') : null;
    });
    check('vega/resources favicon is the product mark', /brand\/vega/i.test(vFavicon || ''), String(vFavicon));
    const vegaHeader = await page.evaluate(() => (document.querySelector('main') || document.body).innerText);
    check('vega/resources header speaks Vega', /Vega/.test(vegaHeader), vegaHeader.split('\n').slice(0, 3).join(' | '));
    check('vega/resources has a CTA', /Get Started|Talk to Sales|Start Free Trial|Start a free trial/i.test(vegaHeader));
    const vegaFooter = await page.evaluate(() => document.body.innerText);
    check('Vega builder credit present', /built by PracticePro/i.test(vegaFooter), (vegaFooter.match(/built by PracticePro[^\n]*/i) || [''])[0]);
    await page.screenshot({ path: '/tmp/r47-vega-resources.png', fullPage: false });

    // ── 3. The company hub ──────────────────────────────────────────────
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 45000 });
    const navText = await page.evaluate(() => {
        const nav = document.querySelector('nav') || document.body;
        return nav.innerText.slice(0, 1200);
    });
    check('hub nav has no company Resources item', !/resources/i.test(navText), 'nav scanned');
    const hubFavicon = await page.evaluate(() => {
        const l = document.querySelector('link[rel~="icon"]') || document.querySelector('link[rel="icon"]');
        return l ? l.getAttribute('href') : null;
    });
    check('hub keeps the company favicon', !/brand\/(atrium|vega)/i.test(hubFavicon || ''), String(hubFavicon));

    // ── 4. The Atrium product page carries the product favicon ──────────
    await page.goto(`${BASE}/atrium`, { waitUntil: 'networkidle', timeout: 45000 });
    const atriumPageFavicon = await page.evaluate(() => {
        const l = document.querySelector('link[rel~="icon"]') || document.querySelector('link[rel="icon"]');
        return l ? l.getAttribute('href') : null;
    });
    check('/atrium carries the Atrium favicon', /brand\/atrium/i.test(atriumPageFavicon || ''), String(atriumPageFavicon));

    // ── 5. The Big A actually reads as an A ─────────────────────────────
    const svg = await page.evaluate(async () => {
        const r = await fetch('/brand/atrium/favicon.svg');
        return r.ok ? await r.text() : '';
    });
    check('Big A favicon SVG is served', svg.length > 200, `${svg.length} bytes`);
    // The mark is a solid tile + a white A; the A must be path-drawn.
    const hasLetterform = /<path[^>]+[dD]=/.test(svg) && /fill="(white|#fff|#FFFFFF|rgba\(255)/i.test(svg);
    check('Big A favicon has a white glyph on the tile', hasLetterform);

    await b.close();

    const failed = results.filter(r => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('VERIFY ERROR', e); process.exit(1); });
