/* Vega claims-audit visual capture (2026-11-22 footer/FAQ/claims round).
 *
 * Usage: node scripts/vega_claims_capture.cjs
 * Captures /vega at desktop + mobile: the footer close, the FAQ band,
 * the trust/attestations band and the practice cards.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', 'audit-results', 'vega-claims');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
    // This sandbox caches an older Chromium build — use it directly when
    // the Playwright-managed binary is absent.
    const fs = require('fs');
    const cached = '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
    const launchArgs = fs.existsSync(cached) ? { executablePath: cached } : {};
    const browser = await chromium.launch(launchArgs);
    for (const vp of [
        { name: '1440x900', width: 1440, height: 900 },
        { name: '390x844', width: 390, height: 844 },
    ]) {
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        await page.goto(`${BASE}/vega`, { waitUntil: 'networkidle', timeout: 60000 });
        // Force all reveals visible (the audit convention).
        await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
        const root = page.locator('div[data-public-page]').first();
        await root.evaluate((el) => { el.scrollTop = el.scrollHeight; });
        await page.waitForTimeout(1200);
        await root.evaluate((el) => { el.scrollTop = 0; });
        await page.waitForTimeout(400);

        // 1. The footer (bottom of the page).
        await root.evaluate(() => {
            const f = document.querySelector('footer');
            if (f) f.scrollIntoView({ block: 'end' });
        });
        await page.waitForTimeout(700);
        await page.screenshot({ path: path.join(OUT, `footer-${vp.name}.png`) });

        // 2. The FAQ band (inside #pricing).
        await root.evaluate(() => {
            const s = document.getElementById('pricing');
            if (s) s.scrollIntoView({ block: 'start' });
        });
        await page.waitForTimeout(700);
        await page.screenshot({ path: path.join(OUT, `pricing-faq-${vp.name}.png`) });

        // 3. The trust band (attestations + practice cards).
        await root.evaluate(() => {
            const s = document.getElementById('practice-areas');
            if (s) s.scrollIntoView({ block: 'start' });
        });
        await page.waitForTimeout(700);
        await page.screenshot({ path: path.join(OUT, `trust-${vp.name}.png`) });

        await page.close();
    }
    await browser.close();
    console.log('captured to', OUT);
})();
