#!/usr/bin/env node
/**
 * r31-chat-shots — visual proof for the ALOA/ARIA chat modernization (R31).
 *
 * Method: vite DEV server (the demo-session bypass is dev-gated) against
 * the production Convex, demo session seeded 'vega' first (Warm Chambers
 * skin — proves the chat surface follows the per-product primary ramp),
 * then 'atrium' (ARIA). Walks the surface in reading order:
 *
 *   1. fab-desktop        — AloaFAB resting state (shadow-lg, no ping halo)
 *   2. panel-empty        — panel shell + empty state (hero on primary ramp,
 *                            ModelBadge, suggestion chips, composer)
 *   3. composer-filled    — suggestion chip fill + send button
 *   4. exchange-loading    — optimistic user bubble + status card + Stop
 *   5. exchange-result     — user raised bubble vs FLAT model block
 *   6. history             — history sidebar (New Search / New Note / list)
 *   7. aria-empty          — ARIA identity under the atrium product
 *   8. mobile-panel        — 390px full-width panel + drag handle
 *
 * Output PNGs (default: /home/z/my-project/tmp/r31-shots — the agent
 * workspace convention; override with R31_OUT).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = process.env.R31_OUT || '/home/z/my-project/tmp/r31-shots';
const URL = process.env.VITE_URL || 'http://localhost:5199';
fs.mkdirSync(OUT, { recursive: true });

const SEED = (product) => `
    sessionStorage.setItem('practicepro_user_session', JSON.stringify({ token: 'demo@practicepro.ng' }));
    sessionStorage.setItem('practicepro_demo_product', '${product}');
    localStorage.setItem('practicepro_terms_accepted_version', '2026-07-27-v4');
    localStorage.setItem('practicepro_terms_accepted_at', new Date().toISOString());
    localStorage.setItem('practicepro_last_seen_version', 'v1.22.0');
    localStorage.setItem('practicepro_ai_consent', 'true');
    document.documentElement.className = '';
`;

(async () => {
    const launchOpts = { headless: true };
    if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
    const browser = await chromium.launch(launchOpts);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    const boot = async (product, waitForSkin) => {
        await page.goto(URL + '/?boot=prep', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await page.evaluate(SEED(product));
        await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        if (waitForSkin) {
            await page.waitForFunction(
                () => { const el = document.querySelector('.app-container'); return !!el && el.className.includes('app-skin-vega'); },
                { timeout: 45000 }
            ).catch(() => console.log('WARN: vega skin class never appeared'));
        } else {
            await page.waitForSelector('.app-container', { timeout: 45000 }).catch(() => console.log('WARN: app container never appeared'));
        }
        await page.waitForTimeout(2500);
    };

    const shot = async (name, settle = 2000) => {
        await page.waitForTimeout(settle);
        await page.screenshot({ path: path.join(OUT, `${name}.png`) });
        console.log('captured', name);
    };

    const openPanel = async () => {
        try {
            await page.click('[data-tour-id="aloa-fab"]', { timeout: 8000 });
        } catch {
            await page.click('[aria-label*="AI Assistant"]', { timeout: 8000 });
        }
        await page.waitForSelector('h2:has-text("ALOA"), h2:has-text("ARIA")', { timeout: 15000 });
        await page.waitForTimeout(1200); // sheet reveal (200ms) + data settle
    };

    // ── Round 1: Vega (ALOA) ────────────────────────────────────────────────
    await boot('vega', true);
    await shot('fab-desktop', 1500);

    await openPanel();
    await shot('panel-empty');

    // Suggestion chip fill
    try {
        await page.click('button:has-text("Draft a Notice to Quit")', { timeout: 6000 });
        await shot('composer-filled', 800);
    } catch { console.log('WARN: suggestion chip not found'); }

    // Real exchange — replace the drafting suggestion with a light question
    // (a drafting prompt would spawn DraftPro tabs; a conversational one
    // exercises the plain chat path: optimistic bubble → status → reply).
    try {
        const ta = page.locator('textarea[aria-label^="Ask ALOA"], textarea[aria-label^="Ask ARIA"]').first();
        await ta.click();
        await ta.fill('');
        await ta.type('Hello — in one short sentence, what can you help me with?');
        await page.click('button[aria-label="Send to ALOA"], button[aria-label="Send to ARIA"]', { timeout: 5000 });
        await shot('exchange-loading', 700);   // status card + typing trio + Stop
        await page.waitForFunction(
            () => !!document.querySelector('.prose'),
            { timeout: 45000 }
        ).catch(() => console.log('WARN: no model prose block appeared (send may have errored)'));
        await shot('exchange-result', 2500);
    } catch (e) { console.log('WARN: exchange flow failed:', String(e).slice(0, 120)); }

    // History sidebar
    try {
        await page.click('button[title="Conversation History"]', { timeout: 6000 });
        await shot('history', 1500);
        await page.click('button[title="Conversation History"]', { timeout: 6000 }).catch(() => {});
    } catch { console.log('WARN: history sidebar not opened'); }

    // ── Round 2: Atrium (ARIA) ──────────────────────────────────────────────
    await page.click('[aria-label="Close panel"]', { timeout: 6000 }).catch(() => {});
    await boot('atrium', false);
    await openPanel();
    await shot('aria-empty', 2200);
    await page.click('[aria-label="Close panel"]', { timeout: 6000 }).catch(() => {});

    // ── Round 3: mobile 390 ─────────────────────────────────────────────────
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const mpage = await mctx.newPage();
    mpage.on('pageerror', (e) => errors.push(String(e)));
    await mpage.goto(URL + '/?boot=prep', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await mpage.evaluate(SEED('vega'));
    await mpage.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await mpage.waitForSelector('.app-container', { timeout: 45000 }).catch(() => {});
    await mpage.waitForTimeout(2500);
    try {
        await mpage.click('[data-tour-id="aloa-fab"]', { timeout: 8000 });
        await mpage.waitForSelector('h2:has-text("ALOA")', { timeout: 15000 });
        await mpage.waitForTimeout(1200);
        await mpage.screenshot({ path: path.join(OUT, 'mobile-panel.png') });
        console.log('captured mobile-panel');
    } catch { console.log('WARN: mobile panel not captured'); }

    await browser.close();
    if (errors.length) console.log('PAGE ERRORS:', errors.slice(0, 5));
    console.log('done — shots in', OUT);
})();
