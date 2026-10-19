#!/usr/bin/env node
/**
 * r31-style-probe — computed-style ground truth for the modernized chat
 * surface. Boots the vega demo session, opens ALOA, sends one message,
 * then dumps the resolved styles of the three contested surfaces:
 *
 *   1. model bubble frame  — must be FLAT (transparent bg, 0 border, 0 shadow)
 *   2. user bubble frame    — must be a raised card (primary bg, shadow-sm)
 *   3. composer box         — must have a visible 1px border (legible hairline)
 *   4. panel shell          — must be border-l only (no directional shadow)
 */
const { chromium } = require('playwright');

const URL = process.env.VITE_URL || 'http://localhost:5199';

(async () => {
    const launchOpts = { headless: true };
    if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
    const browser = await chromium.launch(launchOpts);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();

    await page.goto(URL + '/?boot=prep', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.evaluate(() => {
        sessionStorage.setItem('practicepro_user_session', JSON.stringify({ token: 'demo@practicepro.ng' }));
        sessionStorage.setItem('practicepro_demo_product', 'vega');
        localStorage.setItem('practicepro_terms_accepted_version', '2026-07-27-v4');
        localStorage.setItem('practicepro_terms_accepted_at', new Date().toISOString());
        localStorage.setItem('practicepro_last_seen_version', 'v1.22.0');
        localStorage.setItem('practicepro_ai_consent', 'true');
        document.documentElement.className = '';
    });
    await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForFunction(
        () => { const el = document.querySelector('.app-container'); return !!el && el.className.includes('app-skin-vega'); },
        { timeout: 45000 }
    ).catch(() => console.log('WARN: skin never appeared'));
    await page.waitForTimeout(2000);

    await page.click('[data-tour-id="aloa-fab"]', { timeout: 8000 });
    await page.waitForSelector('h2:has-text("ALOA")', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Cycle the model badge to FLASH — 2.5-flash still serves on the demo
    // key (Google retired 2.5-pro for new accounts; the pro tier errors).
    for (let i = 0; i < 5; i++) {
        const badge = await page.textContent('button:has-text("auto"), button:has-text("flash"), button:has-text("pro"), button:has-text("research")').catch(() => null);
        if (badge && badge.trim().toLowerCase().startsWith('flash')) break;
        await page.click('button[title="Auto — AI chooses the best mode for each query"], button[title*="mode"], button:has-text("auto")', { timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
    }

    const ta = page.locator('textarea[aria-label^="Ask ALOA"]').first();
    await ta.click();
    await ta.type('Hello — in one short sentence, what can you help me with?');
    await page.click('button[aria-label="Send to ALOA"]');
    // Wait for the MODEL's prose specifically (the user message also renders
    // a .prose wrapper — so wait until there are TWO of them).
    await page.waitForFunction(() => document.querySelectorAll('.prose').length >= 2, { timeout: 60000 });
    await page.waitForTimeout(1500);

    const dump = await page.evaluate(() => {
        const pick = (el) => {
            if (!el) return null;
            const cs = getComputedStyle(el);
            return {
                className: (el.getAttribute('class') || '').slice(0, 160),
                bg: cs.backgroundColor,
                borderWidth: cs.borderWidth,
                borderColor: cs.borderColor,
                boxShadow: cs.boxShadow === 'none' ? 'none' : cs.boxShadow.slice(0, 90),
                borderRadius: cs.borderRadius,
            };
        };
        // The model frame: the LAST .prose block (user content also renders
        // through a .prose wrapper — the first one belongs to the user).
        const proses = document.querySelectorAll('.prose');
        const prose = proses[proses.length - 1];
        const modelFrame = prose ? prose.parentElement : null;
        // The user bubble: the element whose class contains bg-primary
        const userFrame = Array.from(document.querySelectorAll('div'))
            .find(d => (d.getAttribute('class') || '').includes('rounded-tr-md'));
        // Composer box: first child form > div inside .chat-input-dock
        const composer = document.querySelector('.chat-input-dock form > div');
        // Panel shell
        const panel = document.querySelector('.fixed.z-\\[2000\\]');
        return {
            modelFrame: pick(modelFrame),
            userFrame: pick(userFrame),
            composer: pick(composer),
            panel: pick(panel),
        };
    });
    console.log(JSON.stringify(dump, null, 2));
    await page.screenshot({ path: '/home/z/my-project/tmp/r31-shots/exchange-flash.png' });
    console.log('captured exchange-flash.png');
    await browser.close();
})();
