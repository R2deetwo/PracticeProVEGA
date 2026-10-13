/* P1 A3+A5 — WCAG contrast check on the CURRENT hub + network log for /. */
const { chromium } = require('playwright');
const fs = require('fs');

function lum(r, g, b) {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg, bg) {
    const [r1, g1, b1] = fg, [r2, g2, b2] = bg;
    const l1 = lum(r1, g1, b1), l2 = lum(r2, g2, b2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function parseRgb(s) {
    const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (!m) return null;
    return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
}
function blend(fg, bg) {
    // composite fg over bg using fg alpha
    return fg.rgb.map((c, i) => Math.round(c * fg.a + bg[i] * (1 - fg.a)));
}

(async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    // A5: network log
    const jsChunks = [];
    page.on('response', (res) => {
        const url = res.url();
        if (url.endsWith('.js')) {
            const len = +(res.headers()['content-length'] || 0);
            jsChunks.push({ url: url.split('/').pop(), bytes: len });
        }
    });
    await page.goto('http://21.0.12.14:4173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const targets = [
        { name: 'hero headline (h1 span)', sel: 'h1 span' },
        { name: 'hero paragraph', sel: 'h1 ~ p, [class*="text-lg"] p, section p' },
        { name: 'nav links', sel: 'nav button' },
        { name: 'marquee text', sel: '[class*="marquee"] span, [class*="animate-marquee"] span' },
        { name: 'card body text', sel: '[class*="card"] p, .landing-card p' },
    ];
    const results = [];
    for (const t of targets) {
        const el = page.locator(t.sel).first();
        if ((await el.count()) === 0) { results.push(`${t.name}: SELECTOR NOT FOUND (${t.sel})`); continue; }
        const info = await el.evaluate((node) => {
            let n = node;
            const style = getComputedStyle(n);
            const fg = style.color, fs = style.fontSize, fw = style.fontWeight;
            // walk up for an opaque background
            let bgEl = n, bg = 'rgba(0, 0, 0, 0)', attempts = 0;
            while (bgEl && attempts < 12) {
                const b = getComputedStyle(bgEl).backgroundColor;
                if (b && !b.includes('0, 0, 0, 0') && b !== 'transparent') { bg = b; break; }
                bgEl = bgEl.parentElement; attempts++;
            }
            if (bg.includes('0, 0, 0, 0') || bg === 'transparent') bg = 'rgb(255, 255, 255)';
            return { fg, bg, fs, fw, text: (node.textContent || '').slice(0, 40) };
        });
        const fgc = parseRgb(info.fg), bgc = parseRgb(info.bg);
        if (!fgc || !bgc) { results.push(`${t.name}: unparsable colors ${info.fg} / ${info.bg}`); continue; }
        const effFg = fgc.a < 1 ? blend(fgc, bgc.rgb) : fgc.rgb;
        const effBg = bgc.a < 1 ? blend(bgc, [255, 255, 255]) : bgc.rgb;
        const r = ratio(effFg, effBg);
        const big = parseFloat(info.fs) >= 24 || (parseFloat(info.fs) >= 18.66 && +info.fw >= 700);
        const need = big ? 3 : 4.5;
        results.push(`${t.name}: ${r.toFixed(2)}:1 (fg ${info.fg} on ${info.bg}, ${info.fs}/${info.fw}) — ${r >= need ? 'PASS' : 'FAIL (need ' + need + ')'}`);
    }
    const totalJs = jsChunks.reduce((a, c) => a + c.bytes, 0);
    const report = [
        'P1 A3 — contrast BEFORE (current hub, 1440x900)',
        ...results,
        '',
        'P1 A5 — network log for / (JS chunks)',
        ...jsChunks.map((c) => `  ${c.url}  ${(c.bytes / 1024).toFixed(1)} KB`),
        `  TOTAL JS: ${(totalJs / 1024).toFixed(1)} KB across ${jsChunks.length} chunks`,
    ].join('\n');
    fs.mkdirSync('docs/brand/p1', { recursive: true });
    fs.writeFileSync('docs/brand/p1/contrast-before.txt', report);
    console.log(report);
    await browser.close();
})();
