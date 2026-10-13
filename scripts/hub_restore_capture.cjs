/* Hub-restore — deterministic visual capture (P0 v2 protocol).
 *
 * Usage:  node scripts/hub_restore_capture.cjs <label>
 *         OUT_DIR defaults to docs/brand/hub-restore/<label>
 *
 * Protocol (identical for before / after-restore / after-3d):
 *   1. clock.install + clock.pauseAt(0) — timer-driven state holds t=0.
 *   2. rAF killed before load — WebGL loops never paint a moving frame.
 *   3. CSS animations paused + transitions disabled.
 *   4. TWO-PASS scroll of the INNER container (the page scrolls a
 *      100dvh div, not the window): pass 1 warms lazy images and reveal
 *      observers; pass 2 captures the settled state.
 *   5. 700ms settle per step; per-step viewport shots + one full-height
 *      composite per viewport (viewport resized to the inner container's
 *      scrollHeight so the whole page renders in one frame). */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const LABEL = process.argv[2] || 'before';
const BASE = process.env.BASE_URL || 'http://21.0.12.14:4173';
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', 'docs', 'brand', 'hub-restore', LABEL);
fs.mkdirSync(OUT, { recursive: true });

const surfaces = process.env.HUB_PATHS ? process.env.HUB_PATHS.split(',') : ['/'];
const viewports = [
    { name: '1440x900', width: 1440, height: 900 },
    { name: '390x844', width: 390, height: 844 },
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
            await page.goto(`${BASE}${s}`, { waitUntil: 'networkidle' });
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

            // ── pass 2: capture per-step ──
            let n = 0;
            for (let y = 0; y <= max; y += step, n++) {
                await setScroll(y);
                await page.waitForTimeout(700);
                await page.screenshot({
                    path: path.join(OUT, `hub-${vp.name}-${String(n).padStart(2, '0')}.png`),
                });
            }
            console.log(`hub ${vp.name} (${s}): ${n} step screens (max=${max}px)`);

            // ── full-height composite: resize the viewport to the inner
            //    container's scrollHeight so the whole page renders in one
            //    frame (the 100dvh container grows with the viewport). ──
            const fullH = await page.evaluate(() => {
                const els = Array.from(document.querySelectorAll('div'));
                const sc = els.find((e) => {
                    const cs = getComputedStyle(e);
                    return cs.overflowY === 'auto' && e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 400;
                });
                return sc ? sc.scrollHeight : document.body.scrollHeight;
            });
            await page.setViewportSize({ width: vp.width, height: Math.min(fullH, 20000) });
            await page.waitForTimeout(900);
            await page.screenshot({ path: path.join(OUT, `hub-${vp.name}-full.png`) });
            console.log(`hub ${vp.name} full: ${fullH}px tall`);
            await ctx.close();
        }
    }
    await browser.close();
    console.log(`DONE -> ${OUT}`);
})();
