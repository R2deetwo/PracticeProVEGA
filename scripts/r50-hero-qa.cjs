#!/usr/bin/env node
/**
 * r50-hero-qa — local visual QA of the R50 hero rework:
 *   - / (hub): full-screen faded hero, dark gradient, silk canvas, light copy.
 *   - /vega: single stable full-bleed photograph (carousel retired), the
 *     Vega silk in cyan/gold, light copy.
 * Both at desktop (1440x900) and mobile (390x844), plus a
 * prefers-reduced-motion pass (static frame, no animation loop).
 */
const { chromium } = require('playwright');

const URL = process.env.VITE_URL || 'http://localhost:5199';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function probe(page, path, label, viewportH) {
    await page.goto(`${URL}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
    // Dismiss the cookie banner so it never overlays the hero screenshots.
    await page.click('text=Acknowledge', { timeout: 2500 }).catch(() => {});
    await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
    await page.waitForTimeout(1400); // let the image fade + the silk draw frames

    const hero = await page.evaluate(() => {
        const section = document.querySelector('#home');
        if (!section) return null;
        const canvas = section.querySelector('canvas');
        const img = section.querySelector('img');
        const cs = section ? getComputedStyle(section) : null;
        // Count painted pixels in the silk canvas (transparent background +
        // stroked bands → thousands of non-transparent pixels when live).
        let painted = 0;
        if (canvas) {
            try {
                const c2d = canvas.getContext('2d');
                const data = c2d.getImageData(0, 0, canvas.width, canvas.height).data;
                for (let i = 3; i < data.length; i += 40) { if (data[i] > 8) painted++; } // sampled
                painted = Math.round((painted * 40) / 4); // rough scale of sampled count
            } catch { painted = -1; }
        }
        return {
            minH: cs ? cs.minHeight : null,
            hasCanvas: !!canvas,
            canvasSize: canvas ? [canvas.width, canvas.height] : null,
            painted,
            imgSrc: img ? img.getAttribute('src') : null,
            imgOpacity: img ? getComputedStyle(img).opacity : null,
            gradient: !!section.querySelector('.bg-gradient-to-b'),
            h1: section.querySelector('h1') ? getComputedStyle(section.querySelector('h1')).color : null,
            bodyColor: section.querySelector('h1 + p, p') ? getComputedStyle(section.querySelector('h1 + p, p')).color : null,
            width: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
        };
    });
    if (!hero) { check(`${label}: hero section present`, false); return; }

    check(`${label}: hero is full-screen (min-height 100dvh)`, Math.abs(parseFloat(hero.minH || '0') - viewportH) <= 2, hero.minH);
    check(`${label}: silk canvas mounted`, hero.hasCanvas, hero.canvasSize ? hero.canvasSize.join('x') : '');
    check(`${label}: silk canvas is painting`, hero.painted > 500, `${hero.painted} px sampled`);
    check(`${label}: hero image present`, !!hero.imgSrc, hero.imgSrc);
    check(`${label}: hero image is faded (≤60%)`, parseFloat(hero.imgOpacity || '1') <= 0.6, hero.imgOpacity);
    check(`${label}: dark gradient overlay present`, hero.gradient);
    check(`${label}: headline renders light on dark`, /rgb\(255, 255, 255\)|255, 255, 255/.test(hero.h1 || ''), hero.h1);
    check(`${label}: no horizontal overflow`, hero.width <= hero.clientWidth + 1, `${hero.width} vs ${hero.clientWidth}`);
    return hero;
}

(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: EXEC });

    // ── Desktop ─────────────────────────────────────────────────────────
    let page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

    const hub = await probe(page, '/', 'hub desktop', 900);
    if (hub) {
        check('hub desktop: the still is ambient-still, 60% anchored', /ambient-still/.test(hub.imgSrc || ''), hub.imgSrc);
        const card = await page.$('#home .r42-card-in');
        check('hub desktop: featured-solutions card floats', !!card);
        const dots = await page.$$('#home [aria-label="Hero gallery"]');
        check('hub desktop: no gallery dots', dots.length === 0);
        await page.screenshot({ path: '/tmp/r50-hub-desktop.png' });
    }

    const vega = await probe(page, '/vega', 'vega desktop', 900);
    if (vega) {
        check('vega desktop: single stable photograph (vega-hero-2)', /vega-hero-2/.test(vega.imgSrc || ''), vega.imgSrc);
        const dots = await page.$$('#home [aria-label="Hero gallery"]');
        check('vega desktop: carousel + dots retired', dots.length === 0);
        const scenes = await page.$$eval('#home img', (imgs) => imgs.map((i) => i.getAttribute('src')));
        check('vega desktop: exactly ONE hero image', scenes.filter((s) => /vega-hero-/.test(s || '')).length === 1, scenes.join(','));
        await page.screenshot({ path: '/tmp/r50-vega-desktop.png' });
    }

    // ── Mobile ──────────────────────────────────────────────────────────
    page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const hubM = await probe(page, '/', 'hub mobile', 844);
    if (hubM) {
        await page.screenshot({ path: '/tmp/r50-hub-mobile.png' });
    }
    const vegaM = await probe(page, '/vega', 'vega mobile', 844);
    if (vegaM) {
        await page.screenshot({ path: '/tmp/r50-vega-mobile.png' });
    }

    // ── Reduced motion: static frame, no loop ───────────────────────────
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const rm = await probe(page, '/', 'hub reduced-motion', 900);
    if (rm) {
        await page.screenshot({ path: '/tmp/r50-hub-reduced.png' });
    }

    // ── Console ─────────────────────────────────────────────────────────
    const relevant = errors.filter((e) => !/net::ERR|favicon|Content Security Policy|\[::1\]:3210|404/i.test(e));
    check('no console errors (desktop pass)', relevant.length === 0, relevant.slice(0, 2).join(' | '));

    await browser.close();
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('QA ERROR', e); process.exit(1); });
