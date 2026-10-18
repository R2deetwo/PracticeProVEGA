/* One-off: verify m5 TODAY beat on production — tall viewport so the
 * whole section (rows + sticky stage) is visible at once. */
const { chromium } = require('playwright');
(async () => {
    const EXE = '/home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell';
    const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: EXE });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
    await page.goto('https://practice-pro-vega.vercel.app/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const section = page.locator('section:has-text("Sound familiar?")').first();
    await section.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(800);
    const row = page.locator('[role="option"]').nth(4);
    if (!(await row.isVisible())) { await row.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); }
    await row.click();
    await page.mouse.move(1000, 700);
    const stage = page.locator('[role="img"]').first();
    // TODAY beat: fully populated ~1.4s, swaps at 2.6s — shoot at 1.9s.
    await page.waitForTimeout(1900);
    let box = await (await stage.elementHandle()).boundingBox();
    if (!box || box.y < 8 || box.y + box.height > 1392) {
        await stage.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(300);
        box = await (await stage.elementHandle()).boundingBox();
    }
    await page.screenshot({ path: '/tmp/prod-m5-today.png', clip: box });
    // SYSTEM beat: wait past the swap + full populate (~4.3s from click).
    await page.waitForTimeout(2400);
    box = await (await stage.elementHandle()).boundingBox();
    if (box.y < 8 || box.y + box.height > 1392) {
        await stage.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(300);
        box = await (await stage.elementHandle()).boundingBox();
    }
    await page.screenshot({ path: '/tmp/prod-m5-system.png', clip: box });
    const aria = (await stage.getAttribute('aria-label')) || '';
    console.log('aria:', aria.slice(0, 50));
    await browser.close();
})();
