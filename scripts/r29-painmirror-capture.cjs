/* R29 — PainMirror "Ada's week" + wording-pass capture (element shots).
 *
 * Usage:  node scripts/r29-painmirror-capture.cjs
 *         BASE_URL defaults to http://localhost:4173 (vite preview)
 *
 * Element screenshots (immune to viewport framing): the stage card at
 * both beats for four moments, the moment rows, the Our Work badges,
 * the final CTA and the footer. Output: docs/brand/r29/<viewport>/
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const OUT_ROOT = path.join(__dirname, '..', 'docs', 'brand', 'r29');

const viewports = [
    { name: '1440', width: 1440, height: 900 },
    { name: '390', width: 390, height: 844 },
];

(async () => {
    // The sandbox carries playwright browser build 1200; package 1.62
    // wants 1234. Point launch at the existing binary (env override wins).
    const EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        || '/home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell';
    const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: EXE });
    fs.mkdirSync(OUT_ROOT, { recursive: true });
    for (const vp of viewports) {
        const OUT = path.join(OUT_ROOT, vp.name);
        fs.mkdirSync(OUT, { recursive: true });
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(BASE + '/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(900);

        // Clip-screenshot (page.screenshot + clip): unlike
        // elementHandle.screenshot it never AUTO-SCROLLS — and an auto-scroll
        // was the phantom: with the pointer parked on a row, the scroll slid
        // a NEIGHBOUR row under it and fired a mouseover that hijacked the
        // scene mid-capture. We scroll deliberately (pointer parked on the
        // stage first) and then clip without touching anything.
        const shot = async (name, locator) => {
            let box = await (await locator.elementHandle()).boundingBox();
            if (!box) throw new Error('no box for ' + name);
            if (box.y < 8 || box.y + box.height > vp.height - 8) {
                await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
                await page.waitForTimeout(350);
                box = await (await locator.elementHandle()).boundingBox();
            }
            await page.screenshot({
                path: path.join(OUT, name + '.png'),
                clip: { x: box.x, y: box.y, width: box.width, height: box.height },
            });
        };

        // ── Sound familiar? — moments at both beats ──────────────────
        const section = page.locator('section:has-text("Sound familiar?")').first();
        await section.scrollIntoViewIfNeeded();
        await page.waitForTimeout(700);

        // The whole section once (settled, moment 1).
        await page.locator('[role="option"]').nth(0).hover();
        await page.waitForTimeout(2100);
        await shot('section-full', section);

        const stage = page.locator('[role="img"]').first();
        const moments = [
            { row: 1, key: 'm1-buried-order', title: 'The order that got buried' },
            { row: 2, key: 'm2-payment', title: 'The payment you can' }, // can\u2019t — prefix match
            { row: 3, key: 'm3-keyman', title: 'The one who knows is away' },
            { row: 4, key: 'm4-receipt', title: 'The receipt hunt' },
            { row: 5, key: 'm5-owner', title: 'shift' },
        ];
        for (const m of moments) {
            const row = page.locator('[role="option"]').nth(m.row - 1);
            await row.scrollIntoViewIfNeeded();
            await page.waitForTimeout(250);
            // Real click (exercises the real handler), then park the pointer
            // over the STAGE — no row under it, so no scroll can hijack.
            await row.click();
            await page.mouse.move(960, 480);
            await page.waitForTimeout(400);
            const expectTitle = async () => {
                const label = (await stage.getAttribute('aria-label')) || '';
                return label.includes(m.title);
            };
            if (!(await expectTitle())) {
                await row.scrollIntoViewIfNeeded();
                await row.click();
                await page.mouse.move(960, 480);
                await page.waitForTimeout(400);
            }
            // Beat 1 (today) is fully populated by ~1.4s and swaps at
            // 2.6s; beat 2 is fully in by ~4.1s.
            await page.waitForTimeout(1700);
            if (!(await expectTitle())) {
                await row.scrollIntoViewIfNeeded();
                await row.click();
                await page.mouse.move(960, 480);
                await page.waitForTimeout(2100);
            }
            await shot(m.key + '-today', stage);
            await page.waitForTimeout(2000);
            if (!(await expectTitle())) {
                await row.scrollIntoViewIfNeeded();
                await row.click();
                await page.mouse.move(960, 480);
                await page.waitForTimeout(4100);
            }
            await shot(m.key + '-system', stage);
            const label = (await stage.getAttribute('aria-label')) || '';
            console.log(`[${vp.name}] ${m.key}: stage="${label.slice(0, 40)}…"`);
        }

        // The moment list itself.
        await shot('moment-rows', page.locator('[role="listbox"]').first());

        // ── Our Work — the 'A product' badges ────────────────────────
        const work = page.locator('section:has-text("Systems we\'ve built")').first();
        await work.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(1100);
        await shot('ourwork-badges', work);

        // ── Final CTA — 'Explore both products' ──────────────────────
        const cta = page.locator('section:has-text("Explore both products")').first();
        await cta.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(700);
        await shot('final-cta', cta);

        // ── Footer — 'two products, Vega and Atrium' ─────────────────
        const foot = page.locator('footer');
        await foot.first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(600);
        await shot('footer', foot.first());

        console.log(`[${vp.name}] page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
        await ctx.close();
    }
    await browser.close();
    console.log('DONE → ' + OUT_ROOT);
})();
