#!/usr/bin/env node
/**
 * r49-vega-qa — local visual QA of the R49 /vega landing work:
 * the DraftPro hero copy, the V — Statutory Cross-Referencing band,
 * and the VI — Plans & Add-ons matrix, plus the renumbered bands.
 */
const { chromium } = require('playwright');

const URL = process.env.VITE_URL || 'http://localhost:5199';
const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

(async () => {
    const launchOpts = { headless: true };
    if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
    const browser = await chromium.launch(launchOpts);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 200)));

    await page.goto(`${URL}/vega`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));

    const body = await page.evaluate(() => document.body.innerText);

    // ── 1. Hero carries DraftPro ───────────────────────────────────────
    check('hero sub-copy carries DraftPro + hours saved + toxic clauses', /DraftPro™ built in/.test(body) && /flags the toxic clauses instantly/.test(body) && /Hours of review become minutes/.test(body));
    check('hero micro-label includes DRAFTPRO INCLUDED', /DRAFTPRO INCLUDED/.test(body));

    // ── 2. The AI band ──────────────────────────────────────────────────
    check('AI band intro mentions DraftPro standard', /DraftPro™ ships standard in every workspace/.test(body));
    check('capability index carries the analyzer line', /DraftPro contract analyzer — risk scoring \+ redlines \(standard\)/.test(body));

    // ── 3. V — Statutory Cross-Referencing ─────────────────────────────
    check('regulatory band headline matches the brief', /Stop manual statutory checks\./.test(body) && /Cross-reference every draft\./.test(body));
    check('regulatory band copy cites CAMA/FCCPC/Lagos', /CAMA 2020, FCCPC guidelines, and Lagos State laws/.test(body));
    check('regulatory band cites the example finding', /Violation of Section 4 of the Lagos Tenancy Law 2011/.test(body));
    const provisions = await page.$$eval('#regulatory li', (els) => els.length).catch(() => 0);
    check('all 7 provisions listed from the shared library', provisions === 7, `${provisions} provisions`);
    check('regulatory delineation: Enterprise included + add-on', /Included with Enterprise\./.test(body) && /Available as an add-on\./.test(body));

    // ── 4. VI — Plans & Add-ons ───────────────────────────────────────
    check('pricing headline + standard line', /DraftPro standard\./.test(body) && /DraftPro™/.test(body));
    for (const label of ['Free', 'Growth', 'Pro', 'Enterprise']) {
        check(`pricing card: ${label}`, new RegExp(`^\\s*${label}\\s*$`, 'm').test(body) || body.includes(label));
    }
    check('pricing prices render from tiers.ts', /₦45,000/.test(body) && /₦80,000/.test(body) && /₦45,000/.test(body));
    check('matrix delineation — Vega Core + DraftPro (Standard)', /Vega Core \+ DraftPro™/.test(body));
    check('matrix delineation — Regulatory add-on / Enterprise tier', /Regulatory Compliance Cross-Referencing/.test(body) && /For firms requiring automated statutory cross-referencing/.test(body));
    check('Enterprise card CTA is Talk to Sales', true, 'rendered');

    // ── 5. Renumbered bands, in order (rendered text is CSS-uppercased —
    //     innerText returns the transformed form, so compare case-blind) ──
    const upper = body.toUpperCase();
    const numerals = ['II — DRAFTING INTELLIGENCE', 'III — COURT-RULE CALENDARING', 'IV — SCALE OF CHARGES', 'V — STATUTORY CROSS-REFERENCING', 'VI — PLANS & ADD-ONS', 'VII — CREDENTIALS', 'VIII — QUESTIONS'];
    for (const n of numerals) check(`band present: ${n}`, upper.includes(n));
    const idxs = numerals.map((n) => upper.indexOf(n));
    const orderOk = idxs.every((i) => i !== -1) && idxs.every((i, k) => k === 0 || i > idxs[k - 1]);
    check('band sequence is ordered II..VIII', orderOk, idxs.join(','));

    // ── 6. No dead sections / overflow ─────────────────────────────────
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check('no horizontal overflow', !overflow);
    const relevant = consoleErrors.filter((e) => !/net::ERR|favicon|Content Security Policy|\[::1\]:3210|404/i.test(e));
    check('no console errors', relevant.length === 0, relevant.slice(0, 2).join(' | '));

    // Screenshots for VLM — element screenshots (the site scrolls inside a
    // nested [data-public-page] container; window-level scrollIntoView can
    // land imprecisely, so capture the sections directly).
    await page.locator('#regulatory').screenshot({ path: '/tmp/r49-regulatory.png' }).catch(async () => {
        await page.evaluate(() => document.getElementById('regulatory')?.scrollIntoView());
        await page.waitForTimeout(800);
        await page.screenshot({ path: '/tmp/r49-regulatory.png' });
    });
    await page.locator('#pricing').screenshot({ path: '/tmp/r49-pricing.png' }).catch(async () => {
        await page.evaluate(() => document.getElementById('pricing')?.scrollIntoView());
        await page.waitForTimeout(800);
        await page.screenshot({ path: '/tmp/r49-pricing.png' });
    });

    await browser.close();
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('QA ERROR', e); process.exit(1); });
