/* P0 — deterministic visual capture for the sites split. v2 protocol.
 *
 * Determinism guarantees (identical for baseline and after runs):
 *   1. clock.install + clock.pauseAt(0): fake timers installed AND the
 *      clock held at t=0 — the ScalingNoun cycle, the w9 "walks itself"
 *      step lighting and every other timer-driven state hold their t=0
 *      settle state (the one fonts.ready-driven noun advance is identical
 *      in both builds — verified by DOM dumps).
 *   2. rAF killed before load: WebGL loops (MorphScene) and parallax
 *      loops never paint a moving frame.
 *   3. CSS animations paused + transitions disabled.
 *   4. TWO-PASS scroll: pass 1 warms everything (lazy images decode,
 *      IntersectionObserver reveals latch, cookie dismissed), then the
 *      page returns to top; pass 2 captures the settled state.
 *   5. 700ms settle per step. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://21.0.12.14:4173';
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', 'docs', 'brand', 'baseline');
fs.mkdirSync(OUT, { recursive: true });

const surfaces = [
    { name: 'hub', path: '/' },
    { name: 'vega', path: '/vega' },
    { name: 'atrium', path: '/atrium' },
];
const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
];

(async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    for (const vp of viewports) {
        for (const s of surfaces) {
            const ctx = await browser.newContext({
                viewport: { width: vp.width, height: vp.height },
                deviceScaleFactor: 1,
            });
            const page = await ctx.newPage();
            await page.clock.install({ time: 0 });
            await page.clock.pauseAt(0);
            await page.addInitScript(() => {
                window.requestAnimationFrame = () => 0;
            });
            await page.goto(`${BASE}${s.path}`, { waitUntil: 'networkidle' });
            await page.addStyleTag({ content: `
                *, *::before, *::after {
                    animation-play-state: paused !important;
                    transition: none !important;
                    caret-color: transparent !important;
                }` });
            await page.waitForTimeout(1500);
            const ack = page.locator('.cookie-ack').first();
            if (await ack.count() > 0) {
                await ack.click({ timeout: 3000 }).catch(() => {});
                await page.waitForTimeout(400);
            }
            await page.evaluate(() => document.dispatchEvent(new CustomEvent('vg:reveal-all')));
            await page.waitForTimeout(800);

            const getScroll = () => page.evaluate(() => {
                const els = Array.from(document.querySelectorAll('div'));
                const sc = els.find((e) => {
                    const cs = getComputedStyle(e);
                    return cs.overflowY === 'auto' && e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 400;
                });
                if (sc) return { el: sc, max: sc.scrollHeight - sc.clientHeight };
                return { el: null, max: document.body.scrollHeight - window.innerHeight };
            });
            const setScroll = (y) => page.evaluate((yy) => {
                const els = Array.from(document.querySelectorAll('div'));
                const sc = els.find((e) => {
                    const cs = getComputedStyle(e);
                    return cs.overflowY === 'auto' && e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 400;
                });
                if (sc) sc.scrollTop = yy; else window.scrollTo(0, yy);
            }, y);

            const { max } = await getScroll();
            const step = vp.height;

            // ── pass 1: warm (lazy images, reveals) ──
            for (let y = 0; y <= max; y += step) {
                await setScroll(y);
                await page.waitForTimeout(500);
            }
            await setScroll(max);
            await page.waitForTimeout(1500);
            await setScroll(0);
            await page.waitForTimeout(1000);

            // ── pass 2: capture ──
            let n = 0;
            for (let y = 0; y <= max; y += step, n++) {
                await setScroll(y);
                await page.waitForTimeout(700);
                await page.screenshot({
                    path: path.join(OUT, `${s.name}-${vp.name}-${String(n).padStart(2, '0')}.png`),
                });
            }
            console.log(`${s.name}-${vp.name}: ${n} screens (max=${max})`);
            await ctx.close();
        }
    }
    await browser.close();
})();
