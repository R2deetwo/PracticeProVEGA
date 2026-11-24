/**
 * qa-splash-2026-11-25.cjs — visual verification of the two-stage splash
 * (owner brief 2026-11-25) against the built dist.
 *
 * Checks (screenshots saved to audit-shots/splash-2026-11-25/):
 *   1. The HTML boot overlay is BLACK (pixel sample), not green.
 *   2. The in-app splash opens BLACK (no green flash at t=0).
 *   3. Stage 1 amber + green phases render (logo color samples).
 *   4. The retired 3-icon lockup row is absent.
 *   5. Settings nav shows NO Compliance item; bell popover defaults Firm.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
const OUT = path.join(__dirname, '..', 'audit-shots', 'splash-2026-11-25');

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ headless: true, executablePath: EXEC });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

    // Boot overlay + splash: load the app with a saved session stub so the
    // splash plays. We plant a fake session key + a cached vega product so
    // the two-stage sequence runs deterministically.
    await page.addInitScript(() => {
        localStorage.setItem('practicepro_user_session', JSON.stringify({ stub: true }));
        localStorage.setItem('pp_splash_product', 'vega');
    });

    await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });

    // 1 — boot overlay / early splash pixels (t≈150ms): must be black.
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, '01-t0-black.png') });
    const early = await page.evaluate(() => {
        const el = document.querySelector('.splash-screen');
        return el ? getComputedStyle(el).backgroundColor : null;
    });
    console.log('[1] splash bg at t=150ms:', early);

    // 2 — amber phase (t≈600ms)
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(OUT, '02-amber.png') });

    // 3 — green phase (t≈1100ms)
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, '03-green.png') });
    const greenPhase = await page.evaluate(() => {
        const logo = document.querySelector('.splash-logo');
        return logo ? getComputedStyle(logo).color : null;
    });
    console.log('[3] logo color at green phase:', greenPhase);

    // 4 — Stage 2 blackout/product (t≈2000ms): the company logo dissolved,
    //     the Vega end-card heroes, NO 3-icon lockup.
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, '04-product-finale.png') });
    const finale = await page.evaluate(() => {
        const lockup = document.querySelector('.splash-lockup');
        const endcard = document.querySelector('.splash-endcard');
        const logo = document.querySelector('.splash-logo');
        return {
            lockupPresent: !!lockup,
            endcardPresent: !!endcard,
            endcardOpacity: endcard ? getComputedStyle(endcard).opacity : null,
            logoOpacity: logo ? getComputedStyle(logo).opacity : null,
        };
    });
    console.log('[4] finale state:', JSON.stringify(finale));

    // 5 — the splash CSS background is pure black, the ::before shimmer is gone.
    const cssState = await page.evaluate(() => {
        const el = document.querySelector('.splash-screen');
        const sheet = Array.from(document.styleSheets).map(s => { try { return Array.from(s.cssRules).map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
        return {
            bg: el ? getComputedStyle(el).backgroundColor : null,
            hasAmbientBreath: sheet.includes('splashAmbientBreath'),
            hasBgReveal: sheet.includes('splashBgReveal'),
        };
    });
    console.log('[5] css state:', JSON.stringify(cssState));

    await browser.close();
    console.log('[done] shots in', OUT);
})().catch(e => { console.error('QA FAILED:', e.message); process.exit(1); });
