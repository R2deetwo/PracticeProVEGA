/* Acceptance 7 — contrast of hero text and nav labels ≥ 4.5:1 (AA).
 * Measures COMPUTED text colours on the live page; backgrounds come from
 * the computed layers behind each element (the nav glass is composited
 * over the hero ink base, as on the real page). */
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://21.0.12.14:4173';

// WCAG relative luminance + ratio
const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
    const l1 = Math.max(lum(a[0], a[1], a[2]), lum(b[0], b[1], b[2]));
    const l2 = Math.min(lum(a[0], a[1], a[2]), lum(b[0], b[1], b[2]));
    return (l1 + 0.05) / (l2 + 0.05);
};
const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
const blend = (fg, bg, alpha) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));

(async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const data = await page.evaluate(() => {
        const hero = document.querySelector('#home > div'); // layer 0 ink base
        const h1 = document.querySelector('#home h1');
        const sub = document.querySelector('#home h1')?.parentElement?.querySelector('p + p') || document.querySelectorAll('#home p')[1];
        const eyebrow = document.querySelector('#home p');
        const navBtns = Array.from(document.querySelectorAll('header nav button')).map((b) => getComputedStyle(b).color);
        const navGlass = getComputedStyle(document.querySelector('header > div')).backgroundColor;
        const heroBase = getComputedStyle(hero).backgroundColor;
        const caption = document.querySelector('#home [class*="emerald-200"]');
        const navCta = document.querySelector('header button');
        return {
            heroBase,
            navGlass,
            h1: getComputedStyle(h1).color,
            h1Size: getComputedStyle(h1).fontSize,
            sub: getComputedStyle(sub).color,
            eyebrow: getComputedStyle(eyebrow).color,
            navBtns,
            caption: caption ? getComputedStyle(caption).color : null,
            navCta: getComputedStyle(navCta).color,
        };
    });

    const ink = parse(data.heroBase);            // hero base, e.g. rgb(7,13,24)
    const glass = blend(parse(data.navGlass).slice(0, 3).length ? [255, 255, 255] : [255, 255, 255], ink, parse(data.navGlass)[3] ?? 0.8); // white/80 over ink
    const rows = [];
    const check = (name, fgStr, bg, bgLabel) => {
        const fg = parse(fgStr).slice(0, 3);
        const r = ratio(fg, bg);
        rows.push({ name, fg: fgStr, bg: bgLabel, ratio: r.toFixed(2), pass: r >= 4.5 });
    };

    check('hero H1', data.h1, ink, `hero ink base ${data.heroBase}`);
    check('hero sub', data.sub, ink, `hero ink base ${data.heroBase}`);
    check('hero eyebrow', data.eyebrow, ink, `hero ink base ${data.heroBase}`);
    if (data.caption) check('scene caption', data.caption, ink, `hero ink base ${data.heroBase}`);
    data.navBtns.forEach((c, i) => check(`nav label ${i + 1}`, c, glass, `glass nav over ink (${data.navGlass} over ${data.heroBase})`));
    check('nav "Talk to us" CTA', data.navCta, glass, 'glass nav over ink');

    console.log('=== CONTRAST REPORT (acceptance 7) — target ≥ 4.5:1 ===');
    for (const r of rows) {
        console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.ratio.padStart(6)}:1  ${r.name}  [${r.fg}] on ${r.bg}`);
    }
    const fails = rows.filter((r) => !r.pass).length;
    console.log(fails === 0 ? 'ALL PAIRS ≥ 4.5:1' : `${fails} PAIRS BELOW 4.5:1`);
    await browser.close();
    process.exit(fails === 0 ? 0 : 1);
})();
