#!/usr/bin/env node
/**
 * r21-verify.cjs — browser verification of the R21 owner-direction changes
 * (re-run for R22 "The Night Chambers": screenshots now land in
 * download/vega-night/ and captures force-reveal scroll-reveal sections):
 *   1. Product selection opens the product page in a NEW TAB (dropdown,
 *      work card, footer link).
 *   2. Per-product favicon + title swap (and company restore on hub).
 *   3. Product lockups render in nav + footer on product pages.
 *   4. No pricing tier copy anywhere on either product page.
 *   5. No 390px horizontal overflow on either product page.
 *   6. Full-page screenshots at 1440 and 390 → download/r21/.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.AUDIT_URL || 'http://localhost:4173';
const OUT = '/home/z/my-project/download/vega-night';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name) => { results.push(`✓ ${name}`); console.log(`  ✓ ${name}`); };
const bad = (name, detail = '') => { results.push(`✗ ${name} ${detail}`); console.log(`  ✗ ${name} ${detail}`); };

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── 1. New-tab behavior from the hub ──────────────────────────────────
  console.log('\n── New-tab product selection ──');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    // Work card CTA (Explore Vega) opens a new tab.
    let popupUrl = null;
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 8000 }),
      page.click('a:has-text("Explore Vega")'),
    ]).catch(() => [null]);
    if (popup) {
      popupUrl = popup.url();
      await popup.waitForLoadState('networkidle').catch(() => {});
      const t = await popup.title();
      if (popupUrl.endsWith('/vega')) ok(`Work card "Explore Vega" opened /vega in a new tab`);
      else bad('Work card new tab URL', popupUrl);
      if (t.includes('Vega') && t.includes('PracticePro')) ok(`Popup title: "${t}"`);
      else bad('Popup title', t);
      const vFavicon = await popup.evaluate(() =>
        Array.from(document.querySelectorAll('link[rel="icon"]')).map((l) => l.getAttribute('href')).join('|')
      );
      if (vFavicon.includes('/brand/vega/')) ok(`Vega favicon applied (${vFavicon.split('|').filter(Boolean).join(', ')})`);
      else bad('Vega favicon', vFavicon);
      await popup.close();
    } else {
      bad('Work card "Explore Vega" did not open a new tab');
    }

    // Products dropdown opens Atrium in a new tab.
    await page.click('button:has-text("Products")');
    await page.waitForTimeout(300);
    const [popup2] = await Promise.all([
      page.waitForEvent('popup', { timeout: 8000 }),
      page.click('button:has-text("Atrium")'),
    ]).catch(() => [null]);
    if (popup2) {
      if (popup2.url().endsWith('/atrium')) ok('Products dropdown opened /atrium in a new tab');
      else bad('Dropdown new tab URL', popup2.url());
      await popup2.waitForLoadState('networkidle').catch(() => {});
      const t2 = await popup2.title();
      if (t2.includes('Atrium') && t2.includes('PracticePro')) ok(`Atrium title: "${t2}"`);
      else bad('Atrium title', t2);
      const aFavicon = await popup2.evaluate(() =>
        Array.from(document.querySelectorAll('link[rel="icon"]')).map((l) => l.getAttribute('href')).join('|')
      );
      if (aFavicon.includes('/brand/atrium/')) ok(`Atrium favicon applied`);
      else bad('Atrium favicon', aFavicon);
      await popup2.close();
    } else {
      bad('Products dropdown did not open a new tab');
    }

    // The hub tab is still the hub, with the PracticePro company favicon.
    const hubTitle = await page.title();
    const hubIcon = await page.evaluate(() =>
      Array.from(document.querySelectorAll('link[rel="icon"]')).map((l) => l.getAttribute('href')).join('|')
    );
    if (hubTitle.includes('PracticePro Systems')) ok(`Hub title unchanged: "${hubTitle.slice(0, 50)}…"`);
    else bad('Hub title', hubTitle);
    if (!hubIcon.includes('/brand/')) ok('Hub favicon is the PracticePro company icon (no product override)');
    else bad('Hub favicon leaked product', hubIcon);

    // Footer product links carry target=_blank.
    const targets = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll('footer a[href="/vega"], footer a[href="/atrium"]'));
      return a.map((el) => el.getAttribute('target'));
    });
    if (targets.length >= 2 && targets.every((t) => t === '_blank')) ok('Footer product links open in new tabs');
    else bad('Footer link targets', JSON.stringify(targets));

    await context.close();
  }

  // ── 2. Per-product page checks + screenshots ──────────────────────────
  for (const product of ['vega', 'atrium']) {
    console.log(`\n── /${product} page checks + screenshots ──`);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/${product}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Product lockup present; tier copy absent.
    const bodyText = (await page.locator('body').textContent()) || '';
    const headerText = (await page.locator('header').first().textContent()) || '';
    // R24 (owner, 2026-10-13): the header lockup is mark + wordmark only —
    // no visible "BY PRACTICEPRO" line; the attribution lives in the footer.
    if (!headerText.includes('BY PRACTICEPRO')) ok(`${product}: header lockup is mark + wordmark only (R24)`);
    else bad(`${product}: header still renders BY PRACTICEPRO`);
    if (bodyText.includes('BY PRACTICEPRO')) ok(`${product}: footer attribution renders`);
    else bad(`${product}: footer attribution missing`);
    const tiers = ['Most Popular', 'Start Growth', 'Save 20%', 'Growth+'].filter((m) => bodyText.includes(m));
    if (tiers.length === 0) ok(`${product}: zero tier copy`);
    else bad(`${product}: tier copy leaked`, tiers.join(', '));
    if (await page.locator('section#pricing').count() === 0) ok(`${product}: no pricing section`);
    else bad(`${product}: pricing section renders`);

    // Desktop full-page screenshot.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    // Dismiss the cookie consent bar so it does not paint over the hero in
    // full-page captures (it is a fixed overlay until acknowledged).
    const cookieAck = page.locator('.cookie-ack').first();
    if (await cookieAck.count() > 0) {
        await cookieAck.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
    }
    // R22: force-reveal scroll-reveal sections before the full-page capture.
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('vg:reveal-all')));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, `${product}-1440-full.png`), fullPage: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    ok(`${product}: 1440 full-page screenshot`);

    await context.close();

    // Mobile 390: overflow check + screenshot.
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mpage = await mctx.newPage();
    await mpage.goto(`${BASE}/${product}`, { waitUntil: 'networkidle' });
    await mpage.waitForTimeout(1200);
    const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow <= 1) ok(`${product}: no 390px horizontal overflow`);
    else bad(`${product}: 390px overflow`, `${overflow}px`);
    // Dismiss the cookie bar on mobile too (fixed overlay over the hero).
    const mCookieAck = mpage.locator('.cookie-ack').first();
    if (await mCookieAck.count() > 0) {
        await mCookieAck.click({ timeout: 3000 }).catch(() => {});
        await mpage.waitForTimeout(400);
    }
    await mpage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await mpage.waitForTimeout(800);
    await mpage.evaluate(() => document.dispatchEvent(new CustomEvent('vg:reveal-all')));
    await mpage.waitForTimeout(1200);
    await mpage.screenshot({ path: path.join(OUT, `${product}-390-full.png`), fullPage: true });
    await mpage.evaluate(() => window.scrollTo(0, 0));
    ok(`${product}: 390 full-page screenshot`);
    await mctx.close();
  }

  await browser.close();

  console.log('\n════ R22 VERIFICATION (R21 behaviors + Night Chambers) ════');
  const failed = results.filter((r) => r.startsWith('✗')).length;
  results.forEach((r) => console.log(r));
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed > 0 ? 1 : 0);
})();
