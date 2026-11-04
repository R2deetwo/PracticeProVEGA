/**
 * R63 live verification — four rounds promoted on f26413f3.
 *
 * Production version.json serves f26413f3… (healthy). This script probes
 * the four promoted surfaces on https://practice-pro-vega.vercel.app:
 *
 *   R59 — the hero ribbons v2: one plain-2D canvas in the hero, moving
 *         (two sampled frames differ), green concentrated on the right.
 *   R60 — the brand follows the rebrand: /vega favicon carries the navy
 *         seal (#1E3A8A), /atrium favicon carries the yellow stack
 *         (#EAB308), the served CSS registers --color-atrium-tile:
 *         234 179 8, and /vega keeps the light-enterprise h1.
 *   R61 — no public-surface delta by design (the retired switcher and
 *         the synthetic presence are demo/dev surfaces); covered by the
 *         suite, noted in the worklog.
 *   R62 — the folding portfolio: real <button> trigger rows with
 *         aria-expanded, first row open, hover opens / mouse-away folds;
 *         the about copy retirements live; the hero canvas hides when
 *         scrolled out of view.
 *   All — zero console errors on /, /vega, /atrium.
 */
const { chromium } = require('playwright');
const sharp = require('sharp');

const BASE = 'https://practice-pro-vega.vercel.app';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

(async () => {
    const b = await chromium.launch({ headless: true, executablePath: EXEC });

    // ── The hub: ribbons v2 + the folding portfolio + the about copy ────
    {
        const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        page.on('pageerror', (e) => errors.push(String(e)));

        await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 });

        // R59 — the hero canvas: first canvas on the page, 2D only, moving
        const hero = await page.evaluate(() => {
            const c = document.querySelector('canvas');
            if (!c) return null;
            const r = c.getBoundingClientRect();
            return {
                ariaHidden: c.getAttribute('aria-hidden'),
                webgl: !!c.getContext('webgl'),
                w: Math.round(r.width), h: Math.round(r.height),
                x: Math.round(r.x), y: Math.round(r.y),
            };
        });
        check('R59 hero canvas present', !!hero, hero ? `${hero.w}x${hero.h} at (${hero.x},${hero.y})` : 'none');
        check('R59 hero canvas aria-hidden', hero && hero.ariaHidden === 'true', String(hero && hero.ariaHidden));
        check('R59 hero canvas is plain 2D (webgl ctx null)', hero && hero.webgl === false, `webgl=${hero && hero.webgl}`);

        // motion: two clipped frames ~4s apart, sampled diff
        const clip = { x: Math.max(0, hero.x), y: Math.max(0, hero.y), width: Math.min(hero.w, 1440), height: Math.min(hero.h, 900) };
        const t0 = await page.screenshot({ clip });
        await page.waitForTimeout(4000);
        const t4 = await page.screenshot({ clip });
        const [a, c] = await Promise.all([sharp(t0).raw().toBuffer({ resolveWithObject: true }), sharp(t4).raw().toBuffer({ resolveWithObject: true })]);
        let changed = 0, green = 0, greenXSum = 0, total = 0;
        const { width: W, height: H } = a.info;
        for (let y = 0; y < H; y += 3) {
            for (let x = 0; x < W; x += 3) {
                const i = (y * W + x) * a.info.channels;
                total++;
                if (Math.abs(a.data[i] - c.data[i]) > 12 || Math.abs(a.data[i + 1] - c.data[i + 1]) > 12) changed++;
                const [r, g, bl] = [c.data[i], c.data[i + 1], c.data[i + 2]];
                if (g > 90 && g > r * 1.6 && g > bl * 1.6) { green++; greenXSum += x; }
            }
        }
        check('R59 ribbons move (frames differ)', changed / total > 0.01, `${changed}/${total} sampled px changed (${(100 * changed / total).toFixed(1)}%)`);
        check('R59 green present and right-side weighted', green > 500 && (greenXSum / green / W) > 0.6,
            `${green} green px, mean x = ${(100 * greenXSum / Math.max(1, green) / W).toFixed(1)}% of width`);

        // R62 — the hero canvas hides when scrolled out of view.
        // (the hub site scrolls an inner div.overflow-y-auto container —
        // the window itself never scrolls, docScrollH == viewport height)
        await page.evaluate(() => {
            const sc = document.querySelector('div.overflow-y-auto');
            if (sc) sc.scrollTop = sc.scrollHeight;
        });
        await page.waitForTimeout(1200);
        const vis = await page.evaluate(() => {
            const c = document.querySelector('canvas');
            return c ? { v: getComputedStyle(c).visibility, top: Math.round(c.getBoundingClientRect().top) } : null;
        });
        check('R62 hero canvas visibility hidden when off-screen', vis && vis.v === 'hidden',
            `visibility=${vis && vis.v}, canvas top=${vis && vis.top}px (out of the 900px viewport)`);
        await page.evaluate(() => {
            const sc = document.querySelector('div.overflow-y-auto');
            if (sc) sc.scrollTop = 0;
        });
        await page.waitForTimeout(1200);

        // R62 — the folding portfolio
        const rows = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('#ourWork button[aria-expanded], section[id] button[aria-expanded]'));
            return btns.map((el) => ({
                expanded: el.getAttribute('aria-expanded'),
                controls: el.getAttribute('aria-controls'),
                text: el.innerText.replace(/\s+/g, ' ').slice(0, 40),
            }));
        });
        check('R62 portfolio trigger rows are buttons with aria-expanded', rows.length >= 4, `${rows.length} rows: ${rows.map((r) => r.text.split(' ')[0]).join(', ')}`);
        check('R62 rows carry aria-controls', rows.every((r) => !!r.controls), rows[0] ? `controls=${rows[0].controls}` : 'none');
        check('R62 first row ships open', rows.length > 0 && rows[0].expanded === 'true', `row0 aria-expanded=${rows[0] && rows[0].expanded}`);

        // hover the SECOND row → it opens; move away → it folds.
        // (scoped to the portfolio rows by aria-controls — the generic
        // aria-expanded selector also matches hidden disclosures elsewhere)
        const pageTxt = await page.evaluate(() => document.body.innerText);
        const rowHandles = await page.$$('button[aria-controls^="work-exhibit-"]');
        if (rowHandles.length >= 2) {
            await rowHandles[1].scrollIntoViewIfNeeded();
            await rowHandles[1].hover();
            await page.waitForTimeout(900); // let the grid-rows transition finish
            const openStates = await page.evaluate(() =>
                Array.from(document.querySelectorAll('button[aria-controls^="work-exhibit-"]')).map((el) => el.getAttribute('aria-expanded')));
            check('R62 hover opens the hovered row', openStates[1] === 'true', openStates.join(','));
            // move the mouse away — to the top of the viewport, well
            // outside the portfolio section
            await page.mouse.move(720, 10);
            await page.waitForTimeout(900);
            const foldedStates = await page.evaluate(() =>
                Array.from(document.querySelectorAll('button[aria-controls^="work-exhibit-"]')).map((el) => el.getAttribute('aria-expanded')));
            check('R62 mouse-away folds it back', foldedStates[1] === 'false', foldedStates.join(','));
        } else {
            check('R62 hover open/fold probe', false, 'not enough rows found');
        }

        // R62 — the about copy retirements
        check('R62 about: 3-systems enumeration gone', !pageTxt.includes('3 systems live in production'));
        check('R62 about: product roll-call gone', !pageTxt.includes('Vega serves Nigerian law firms'));
        check('R62 about: vendor-vs-partner musing gone', !pageTxt.includes('vendor and a software partner'));
        check('R62 about: tightened credibility line present', pageTxt.includes('We run our own systems in production every working day'));

        // R60 — the served CSS registers the yellow Atrium tile token
        const cssLinks = await page.evaluate(() => Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.href));
        let cssText = '';
        for (const href of cssLinks) {
            const t = await page.evaluate(async (u) => (await (await fetch(u)).text()), href);
            cssText += t;
        }
        check('R60 CSS carries --color-atrium-tile: 234 179 8', cssText.includes('--color-atrium-tile: 234 179 8'));
        check('R60 CSS carries the vega navy skin (30 58 138)', /\.app-skin-vega/.test(cssText) && cssText.includes('30 58 138'));

        check('R63 zero console errors on /', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');
        await page.close();
    }

    // ── /vega — the navy seal + the light-enterprise page ───────────────
    {
        const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${BASE}/vega`, { waitUntil: 'networkidle', timeout: 60000 });

        const h1 = await page.evaluate(() => { const h = document.querySelector('h1'); return h ? h.innerText.replace(/\s+/g, ' ').trim() : ''; });
        check('R60 /vega h1 is the light-enterprise line', /Legal workflow automation for Nigerian law firms/.test(h1), h1);

        const favicon = await page.evaluate(() => {
            const l = document.querySelector('link[rel~="icon"]') || document.querySelector('link[rel="icon"]');
            return l ? l.getAttribute('href') : null;
        });
        check('R60 /vega favicon from /brand/vega/', /brand\/vega/i.test(favicon || ''), String(favicon));

        // the served <link> points at favicon-48.png — the SVG source of
        // truth lives at /brand/vega/favicon.svg; fetch it directly
        const svg = await page.evaluate(async (u) => (await (await fetch(u)).text()), `${BASE}/brand/vega/favicon.svg`);
        check('R60 vega favicon.svg carries the navy seal #1E3A8A', /#1E3A8A/i.test(svg), (svg.match(/#[0-9A-Fa-f]{6}/g) || []).slice(0, 4).join(' '));
        check('R60 vega favicon.svg has no burnt orange left', !/#E07A3F/i.test(svg));

        check('R63 zero console errors on /vega', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');
        await page.close();
    }

    // ── /atrium — the yellow stepped stack ──────────────────────────────
    {
        const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${BASE}/atrium`, { waitUntil: 'networkidle', timeout: 60000 });

        const favicon = await page.evaluate(() => {
            const l = document.querySelector('link[rel~="icon"]') || document.querySelector('link[rel="icon"]');
            return l ? l.getAttribute('href') : null;
        });
        check('R60 /atrium favicon from /brand/atrium/', /brand\/atrium/i.test(favicon || ''), String(favicon));

        const svg = await page.evaluate(async (u) => (await (await fetch(u)).text()), `${BASE}/brand/atrium/favicon.svg`);
        check('R60 atrium favicon.svg carries the yellow #EAB308', /#EAB308/i.test(svg), (svg.match(/#[0-9A-Fa-f]{6}/g) || []).slice(0, 4).join(' '));
        check('R60 atrium favicon.svg has no indigo left', !/#4F46E5/i.test(svg));

        check('R63 zero console errors on /atrium', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');
        await page.close();
    }

    await b.close();

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
