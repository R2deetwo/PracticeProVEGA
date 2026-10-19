#!/usr/bin/env node
/**
 * r31-frame-inventory — dump EVERY message frame in the live ALOA thread:
 * role, first chars of text, and the computed style of its bubble frame.
 * Settles (with ground truth) whether a streamed model reply renders FLAT.
 */
const { chromium } = require('playwright');
const URL = process.env.VITE_URL || 'http://localhost:5199';

(async () => {
    const launchOpts = { headless: true };
    if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
    const browser = await chromium.launch(launchOpts);
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

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

    // Cycle badge to FLASH (the tier that still serves on the demo key).
    for (let i = 0; i < 6; i++) {
        const t = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const badge = btns.find(b => /^(auto|flash|pro|research)$/i.test((b.textContent || '').trim()));
            return badge ? (b => b)(badge.textContent.trim()) : null;
        });
        if (t && t.toLowerCase() === 'flash') break;
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const badge = btns.find(b => /^(auto|flash|pro|research)$/i.test((b.textContent || '').trim()));
            if (badge) badge.click();
        });
        await page.waitForTimeout(400);
    }

    const ta = page.locator('textarea[aria-label^="Ask ALOA"]').first();
    await ta.click();
    await ta.type('Reply with exactly: PracticePro runs on Convex.');
    await page.click('button[aria-label="Send to ALOA"]');

    // Wait for the flash reply to produce content (model .prose = 2nd+).
    try {
        await page.waitForFunction(() => document.querySelectorAll('.prose').length >= 2, { timeout: 60000 });
    } catch { console.log('WARN: 2nd prose never appeared'); }
    await page.waitForTimeout(4000); // let the stream finish

    const inv = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('.prose').forEach((p, i) => {
            const frame = p.parentElement;
            const cs = frame ? getComputedStyle(frame) : null;
            out.push({
                idx: i,
                text: (p.textContent || '').slice(0, 80),
                frameClass: frame ? (frame.getAttribute('class') || '').slice(0, 110) : null,
                frameBg: cs ? cs.backgroundColor : null,
                frameShadow: cs ? cs.boxShadow.slice(0, 40) : null,
                frameRadius: cs ? cs.borderRadius : null,
            });
        });
        return {
            proseCount: out.length,
            inventory: out,
            statusRow: (document.body.textContent.match(/Thinking\.\.\.|reading…/g) || []).slice(0, 2),
        };
    });
    console.log(JSON.stringify(inv, null, 2));
    await page.screenshot({ path: '/home/z/my-project/tmp/r31-shots/exchange-flash.png' });
    await browser.close();
})();
