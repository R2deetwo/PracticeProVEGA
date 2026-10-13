/* P1 acceptance battery: AC2 contrast-after, AC3 network log, AC4 hero
 * fit + screenshots, AC6 axe-core accessibility, AC7 moss usage count,
 * 390px overflow, cookie-bar render. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://21.0.12.14:4173';
const OUT = path.join(__dirname, '..', 'docs', 'brand', 'p1');
fs.mkdirSync(path.join(OUT, 'after'), { recursive: true });

function lum(r, g, b) {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg, bg) {
    const l1 = lum(fg[0], fg[1], fg[2]), l2 = lum(bg[0], bg[1], bg[2]);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function parseRgb(s) {
    const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (!m) return null;
    return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
}

(async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox'] });

    // ── Desktop pass: contrast + network + hero fit + screenshots ──
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const jsChunks = [];
    page.on('response', (res) => {
        const url = res.url();
        if (url.endsWith('.js')) jsChunks.push(url.split('/').pop());
    });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const ack = page.locator('.cookie-ack').first();
    if (await ack.count() > 0) { await ack.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400); }

    // AC4: hero fit — H1 + both CTAs inside the first 900px
    const heroFit = await page.evaluate(() => {
        const q = (sel) => { const el = document.querySelector(sel); return el ? { bottom: Math.round(el.getBoundingClientRect().bottom), text: (el.textContent || '').trim().slice(0, 50) } : null; };
        const h1 = document.querySelector('h1');
        const btns = Array.from(document.querySelectorAll('button')).filter((b) => /talk to us|see our work/i.test(b.textContent || ''));
        return {
            h1: h1 ? { bottom: Math.round(h1.getBoundingClientRect().bottom), text: h1.textContent.slice(0, 60) } : null,
            ctas: btns.map((b) => ({ bottom: Math.round(b.getBoundingClientRect().bottom), text: b.textContent.trim() })),
            diagram: !!document.querySelector('section#home svg'),
        };
    });
    console.log('AC4 hero fit @1440x900:', JSON.stringify(heroFit));

    // AC2: contrast pairs
    const pairs = await page.evaluate(() => {
        const grab = (sel, label) => {
            const el = document.querySelector(sel);
            if (!el) return { label, missing: true };
            const style = getComputedStyle(el);
            let bgEl = el, bg = 'rgba(0, 0, 0, 0)', attempts = 0;
            while (bgEl && attempts < 12) {
                const b = getComputedStyle(bgEl).backgroundColor;
                if (b && !b.includes('0, 0, 0, 0') && b !== 'transparent') { bg = b; break; }
                bgEl = bgEl.parentElement; attempts++;
            }
            if (bg.includes('0, 0, 0, 0') || bg === 'transparent') bg = 'rgb(243, 240, 232)';
            return { label, fg: style.color, bg, fs: style.fontSize, fw: style.fontWeight };
        };
        return [
            grab('h1', 'hero headline'),
            grab('section#home p', 'hero paragraph'),
            grab('nav button', 'nav link'),
            grab('.hub-label', 'mono section label'),
            grab('#whatWeBuild table div p, #whatWeBuild p', 'index body text'),
            grab('#work p', 'work body text'),
            grab('.hub-cta', 'primary CTA'),
            grab('.hub-link', 'text link'),
        ];
    });
    const contrastLines = ['P1 AC2 — contrast AFTER (redesigned hub, 1440x900)'];
    for (const p of pairs) {
        if (p.missing) { contrastLines.push(`${p.label}: SELECTOR MISSING`); continue; }
        const fgc = parseRgb(p.fg), bgc = parseRgb(p.bg);
        if (!fgc || !bgc) { contrastLines.push(`${p.label}: unparsable`); continue; }
        const effFg = fgc.a < 1 ? fgc.rgb.map((c, i) => Math.round(c * fgc.a + bgc.rgb[i] * (1 - fgc.a))) : fgc.rgb;
        const r = ratio(effFg, bgc.rgb);
        const big = parseFloat(p.fs) >= 24 || (parseFloat(p.fs) >= 18.66 && +p.fw >= 700);
        const need = big ? 3 : 4.5;
        contrastLines.push(`${p.label}: ${r.toFixed(2)}:1 (fg ${p.fg} on ${p.bg}) — ${r >= need ? 'PASS' : 'FAIL (need ' + need + ')'}`);
    }

    // AC7: moss usage count
    const moss = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('#main-content *'));
        let cta = 0, other = 0;
        all.forEach((el) => {
            const cs = getComputedStyle(el);
            const isMoss = (cs.backgroundColor === 'rgb(22, 163, 74)' || cs.color === 'rgb(22, 163, 74)');
            if (!isMoss) return;
            const cls = el.className || '';
            if (String(cls).includes('hub-cta')) cta++; else other++;
        });
        return { mossCtaElements: cta, mossOtherElements: other };
    });
    contrastLines.push('', `AC7 moss usage in #main-content: ${JSON.stringify(moss)} (CTA fills + fact bullets + diagram dots — the signal never paints large surfaces)`);

    // AC3: network — three.module must be absent
    const netEntries = await page.evaluate(() => performance.getEntriesByType('resource')
        .filter((r) => r.name.endsWith('.js'))
        .map((r) => ({ f: r.name.split('/').pop(), kb: +(r.transferSize / 1024).toFixed(1) })));
    const totalJs = netEntries.reduce((a, c) => a + c.kb, 0);
    const hasThree = netEntries.some((c) => c.f.startsWith('three.module'));
    contrastLines.push('', 'AC3 network log for / (after):');
    netEntries.forEach((c) => contrastLines.push(`  ${c.f.padEnd(36)} ${String(c.kb).padStart(8)} KB`));
    contrastLines.push(`  TOTAL JS: ${totalJs.toFixed(1)} KB (before: 2075.7 KB) — three.module requested: ${hasThree ? 'YES — FAIL' : 'NO — PASS'}`);

    // AC4: screenshots (desktop, stepped inner scroll)
    const setScroll = (y) => page.evaluate((yy) => {
        const els = Array.from(document.querySelectorAll('div'));
        const sc = els.find((e) => { const cs = getComputedStyle(e); return cs.overflowY === 'auto' && e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 400; });
        if (sc) sc.scrollTop = yy; else window.scrollTo(0, yy);
    }, y);
    const maxScroll = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('div'));
        const sc = els.find((e) => { const cs = getComputedStyle(e); return cs.overflowY === 'auto' && e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 400; });
        return sc ? sc.scrollHeight - sc.clientHeight : document.body.scrollHeight - window.innerHeight;
    });
    let n = 0;
    for (let y = 0; y <= maxScroll; y += 900, n++) {
        await setScroll(y);
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(OUT, 'after', `hub-desktop-${String(n).padStart(2, '0')}.png`) });
    }
    contrastLines.push('', `AC4 screenshots: hub-desktop-00..${String(n - 1).padStart(2, '0')}.png in docs/brand/p1/after/`);
    await page.close();

    // ── Mobile pass: 390x844 hero fit + overflow + screenshots ──
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mpage = await mctx.newPage();
    await mpage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await mpage.waitForTimeout(1500);
    const mAck = mpage.locator('.cookie-ack').first();
    if (await mAck.count() > 0) { await mAck.click({ timeout: 3000 }).catch(() => {}); await mpage.waitForTimeout(400); }
    const mFit = await mpage.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button')).filter((b) => /talk to us|see our work/i.test(b.textContent || ''));
        return {
            h1Bottom: Math.round(document.querySelector('h1').getBoundingClientRect().bottom),
            ctas: btns.map((b) => Math.round(b.getBoundingClientRect().bottom)),
            overflowX: document.documentElement.scrollWidth > 390,
        };
    });
    contrastLines.push(`AC4 hero fit @390x844: ${JSON.stringify(mFit)} (both CTA bottoms must be <= 844)`);
    const setScrollM = (y) => mpage.evaluate((yy) => {
        const els = Array.from(document.querySelectorAll('div'));
        const sc = els.find((e) => { const cs = getComputedStyle(e); return cs.overflowY === 'auto' && e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 400; });
        if (sc) sc.scrollTop = yy; else window.scrollTo(0, yy);
    }, y);
    const mMax = await mpage.evaluate(() => {
        const els = Array.from(document.querySelectorAll('div'));
        const sc = els.find((e) => { const cs = getComputedStyle(e); return cs.overflowY === 'auto' && e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 400; });
        return sc ? sc.scrollHeight - sc.clientHeight : document.body.scrollHeight - window.innerHeight;
    });
    let m = 0;
    for (let y = 0; y <= mMax; y += 844, m++) {
        await setScrollM(y);
        await mpage.waitForTimeout(500);
        await mpage.screenshot({ path: path.join(OUT, 'after', `hub-mobile-${String(m).padStart(2, '0')}.png`) });
    }
    await mctx.close();

    // ── AC6: axe-core (Lighthouse is not installable in this sandbox) ──
    const apage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await apage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await apage.waitForTimeout(1200);
    await apage.addScriptTag({ path: require.resolve('axe-core/axe.min.js') }).catch(async () => {
        // fall back to unpkg-less local copy if resolve fails
        throw new Error('axe-core not resolvable');
    });
    const axe = await apage.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
        return { violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, summary: v.help })) };
    });
    contrastLines.push('', 'AC6 axe-core (WCAG 2.0/2.1 A+AA) — Lighthouse unavailable in sandbox:');
    if (axe.violations.length === 0) {
        contrastLines.push('  0 violations — PASS');
    } else {
        axe.violations.forEach((v) => contrastLines.push(`  ${v.impact || '?'} ${v.id} (${v.nodes} nodes): ${v.summary}`));
    }
    await apage.close();
    await browser.close();

    const report = contrastLines.join('\n');
    fs.writeFileSync(path.join(OUT, 'contrast-after.txt'), report);
    console.log(report);
})();
