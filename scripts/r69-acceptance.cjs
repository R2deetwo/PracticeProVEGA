#!/usr/bin/env node
/**
 * R69 — /vega hero pill retirement + live-capture presence & lightbox:
 * acceptance harness. Runs against the production build via vite preview.
 *
 * Evidence collected:
 *  A. DESKTOP 1920 — the hero: the attribution pill is GONE (no eyebrow
 *     node), the headline keeps its seat (y ~316, the R68 geometry), the
 *     video band still zero-crop (R68 regression).
 *  B. THE PRESENCE OVERLAY — on the hero's dashboard capture: the trigger
 *     sits in the measured bell→profile gap (avatar right edge ~91.45% of
 *     the image width, between bell 86.8% and profile 91.5%); clicking it
 *     opens the portal'd roster; "Send direct message to …" swaps to the
 *     honest demo note.
 *  C. THE LIGHTBOX — expand from the hero card: role=dialog + prominent
 *     "Dashboard" label + the presence overlay at 1.3x; ArrowRight walks
 *     into the suite exhibits ("Ledger") without closing; the pill strip
 *     jumps across groups ("Calendar"); Escape closes and returns focus.
 *  D. THE SUITE — the active exhibit's capture carries the trigger; the
 *     Documents tab's editor capture (DraftPro toolbar — no app header)
 *     does NOT; expanding from the Team tab opens the lightbox on "Tasks".
 *  E. MOBILE 390 — the hero pill is gone there too; the suite capture is
 *     tappable into the lightbox; the touch expand chip is visible.
 *  F. Zero console errors throughout.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = '/home/z/my-project/tmp/pprepo';
const OUT = '/home/z/my-project/download/r69-captures';
const PORT = 4177;
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: 'ignore' });
  try {
    for (let i = 0; i < 60; i++) { try { const r = await fetch(`${BASE}/version.json`); if (r.ok) break; } catch {} await sleep(500); }
    const browser = await chromium.launch();
    const report = { consoleErrors: [] };

    /* ============ A+B+C: desktop ============ */
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && report.consoleErrors.push(`[desktop] ${m.text()}`));
    await page.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    // Dismiss the pre-existing cookie banner — it sits at z-[9999] (above
    // the lightbox) and otherwise intercepts clicks near the viewport
    // foot. It animates in shortly after load, so wait for it first.
    await sleep(900);
    await page.waitForSelector('button:has-text("Acknowledge")', { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => {
      const banner = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Acknowledge');
      banner?.click();
    });
    await sleep(300);
    await page.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
    await page.waitForFunction(() => {
      const v = document.querySelector('section#home video');
      const h = document.querySelector('h1');
      return v && v.readyState >= 2 && !v.paused && h && parseFloat(getComputedStyle(h).opacity) > 0.9;
    }, { timeout: 20000 }).catch(() => {});
    await sleep(1500);

    // A. the pill is gone; the headline keeps its seat; band geometry held.
    report.hero = await page.evaluate(() => {
      const sec = document.querySelector('section#home');
      const pill = sec.querySelector('.max-w-3xl > p.inline-flex');
      const h1 = sec.querySelector('h1').getBoundingClientRect();
      const band = document.querySelector('section#home video').closest('div[class*="aspect-video"]').getBoundingClientRect();
      return {
        eyebrowPillGone: !pill,
        h1Top: +h1.top.toFixed(0),
        h1OverBand: +(h1.top - band.top).toFixed(0),
        bandRatio: +(band.width / band.height).toFixed(4),
        bandTopInSection: +(band.top - sec.getBoundingClientRect().top).toFixed(0),
      };
    });
    await page.screenshot({ path: path.join(OUT, 'hero-1920.png') });
    console.log('[A] hero:', JSON.stringify(report.hero));

    // B. the presence overlay on the dashboard capture.
    const heroImg = page.locator('section#home img[src*="dashboard.jpg"]');
    const heroTrigger = page.locator('section#home [data-collab-trigger]').first();
    await heroImg.waitFor({ state: 'visible' });
    await sleep(400);
    report.presence = await page.evaluate(() => {
      const img = document.querySelector('section#home img[src*="dashboard.jpg"]');
      const btn = document.querySelector('section#home [data-collab-trigger]');
      if (!img || !btn) return { exists: false };
      const ir = img.getBoundingClientRect(), br = btn.getBoundingClientRect();
      // The avatar stack hugs the trigger's right edge — the measured gap.
      return {
        exists: true,
        triggerRightPctOfImg: +(((br.right - ir.left) / ir.width) * 100).toFixed(2),
        triggerTopPctOfImg: +(((br.top - ir.top) / ir.height) * 100).toFixed(2),
        betweenBellAndProfile: br.right - ir.left <= 0.916 * ir.width && br.right - ir.left >= 0.90 * ir.width,
        insideHeaderStrip: (br.bottom - ir.top) / ir.height < 0.085,
      };
    });
    // A closeup crop of the header-right zone, resting + hovered (pop).
    await heroImg.scrollIntoViewIfNeeded();
    await sleep(600);
    const heroImgBox = await heroImg.boundingBox();
    await page.screenshot({ path: path.join(OUT, 'presence-resting.png'), clip: { x: heroImgBox.x + heroImgBox.width * 0.70, y: heroImgBox.y, width: heroImgBox.width * 0.30, height: heroImgBox.height * 0.14 } });
    await heroTrigger.hover();
    await sleep(400);
    await page.screenshot({ path: path.join(OUT, 'presence-hover.png'), clip: { x: heroImgBox.x + heroImgBox.width * 0.62, y: heroImgBox.y - 10, width: heroImgBox.width * 0.38, height: heroImgBox.height * 0.20 } });
    console.log('[B] presence geometry:', JSON.stringify(report.presence));

    // B2. the dropdown: open → roster rows + DM; DM → demo note; Back.
    await heroTrigger.click();
    await page.waitForSelector('[data-collab-menu]', { timeout: 5000 });
    report.dropdown = await page.evaluate(() => {
      const menu = document.querySelector('[data-collab-menu]');
      return {
        open: !!menu,
        role: menu?.getAttribute('role'),
        rosterRows: menu ? menu.querySelectorAll('li[role="menuitem"]').length : 0,
        dmButtons: menu ? menu.querySelectorAll('button[aria-label^="Send direct message to"]').length : 0,
        headerText: menu?.querySelector('p.text-sm')?.textContent || '',
      };
    });
    await page.screenshot({ path: path.join(OUT, 'presence-dropdown.png') });
    await page.click('button[aria-label="Send direct message to Adaeze Okonkwo"]');
    await sleep(250);
    report.dropdown.noteAfterDm = await page.evaluate(() => document.querySelector('[data-collab-menu]')?.textContent?.includes('Direct messages open inside Vega') || false);
    report.dropdown.startFreeInNote = await page.evaluate(() => !!document.querySelector('[data-collab-menu] button') && document.querySelector('[data-collab-menu]').textContent.includes('Start free'));
    await page.keyboard.press('Escape');
    await sleep(250);
    report.dropdown.closedOnEscape = await page.evaluate(() => !document.querySelector('[data-collab-menu]'));
    console.log('[B2] dropdown:', JSON.stringify(report.dropdown));

    // C. the lightbox — expand from the hero's dashboard capture (the
    // transparent overlay Button above the img).
    await page.click('section#home button[aria-label="Expand the Dashboard view"]');
    await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 5000 });
    await sleep(600); // image decode
    report.lightbox = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"][aria-modal="true"]');
      return {
        open: !!dlg,
        label: dlg?.querySelector('h2')?.textContent || '',
        group: dlg?.querySelector('p.font-mono')?.textContent || '',
        presenceInside: !!dlg?.querySelector('[data-collab-trigger]'),
        pills: dlg ? [...dlg.querySelectorAll('nav button')].map((b) => b.textContent) : [],
        scrollLocked: document.querySelector('[data-public-page]')?.style?.overflowY === 'hidden',
      };
    });
    await page.screenshot({ path: path.join(OUT, 'lightbox-dashboard.png') });
    // ArrowRight → walks into the suite exhibits without closing.
    await page.keyboard.press('ArrowRight');
    await sleep(700);
    report.lightbox.afterArrowRight = await page.evaluate(() => document.querySelector('[role="dialog"] h2')?.textContent || '');
    // The pill strip jumps across groups — "Calendar" (Team Workflows).
    await page.click('[role="dialog"] nav button:has-text("Calendar")');
    await sleep(700);
    report.lightbox.afterPillJump = await page.evaluate(() => document.querySelector('[role="dialog"] h2')?.textContent || '');
    report.lightbox.groupAfterJump = await page.evaluate(() => document.querySelector('[role="dialog"] p.font-mono')?.textContent || '');
    await page.screenshot({ path: path.join(OUT, 'lightbox-calendar.png') });
    // Escape closes; focus returns; scroll unlocks.
    await page.keyboard.press('Escape');
    await sleep(300);
    report.lightbox.closedOnEscape = await page.evaluate(() => !document.querySelector('[role="dialog"]'));
    report.lightbox.scrollUnlocked = await page.evaluate(() => document.querySelector('[data-public-page]')?.style?.overflowY !== 'hidden');
    console.log('[C] lightbox:', JSON.stringify(report.lightbox));

    /* ============ D. the suite section ============ */
    await page.evaluate(() => document.querySelector('#suite')?.scrollIntoView());
    await sleep(900);
    // The Matters tab (default) first exhibit: matters-ledger — has the trigger.
    report.suite = await page.evaluate(() => {
      const sec = document.querySelector('#suite');
      const img = sec.querySelector('.vg-shot img');
      return {
        activeExhibit: img?.getAttribute('src'),
        triggerOnCapture: !!sec.querySelector('[data-collab-trigger]'),
        expandBtn: !!sec.querySelector('.vg-shot button[aria-label^="Expand the"]'),
      };
    });
    // Switch to Team Workflows, expand its Tasks exhibit.
    await page.click('#suite [role="tab"]:has-text("Team Workflows")');
    await sleep(700);
    await page.click('#suite .vg-shot button[aria-label^="Expand the"]');
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await sleep(600);
    report.suite.lightboxFromTeam = await page.evaluate(() => ({
      label: document.querySelector('[role="dialog"] h2')?.textContent || '',
      group: document.querySelector('[role="dialog"] p.font-mono')?.textContent || '',
    }));
    // Walk with ArrowRight: Tasks → Calendar → Notes without closing.
    await page.keyboard.press('ArrowRight'); await sleep(500);
    await page.keyboard.press('ArrowRight'); await sleep(500);
    report.suite.walk = await page.evaluate(() => document.querySelector('[role="dialog"] h2')?.textContent || '');
    await page.keyboard.press('Escape'); await sleep(250);
    // The Documents tab's EDITOR capture opts out (no app header).
    await page.click('#suite [role="tab"]:has-text("Smart Documents & DraftPro")');
    await sleep(700);
    report.suite.editorOptsOut = await page.evaluate(() => {
      const sec = document.querySelector('#suite');
      return {
        editorShown: sec.querySelector('.vg-shot img')?.getAttribute('src')?.includes('editor.jpg') || false,
        triggerOnEditor: !!sec.querySelector('.vg-shot [data-collab-trigger]'),
      };
    });
    console.log('[D] suite:', JSON.stringify(report.suite));

    /* ============ E. mobile 390 ============ */
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const mpage = await mctx.newPage();
    mpage.on('console', (m) => m.type() === 'error' && report.consoleErrors.push(`[mobile] ${m.text()}`));
    await mpage.goto(`${BASE}/vega`, { waitUntil: 'load', timeout: 60000 });
    await sleep(900);
    await mpage.waitForSelector('button:has-text("Acknowledge")', { timeout: 5000 }).catch(() => {});
    await mpage.evaluate(() => {
      const banner = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Acknowledge');
      banner?.click();
    });
    await sleep(300);
    await mpage.evaluate(() => document.dispatchEvent(new Event('vg:reveal-all')));
    await sleep(1800);
    report.mobile = await mpage.evaluate(() => {
      const sec = document.querySelector('section#home');
      return { eyebrowPillGone: !sec.querySelector('.max-w-3xl > p.inline-flex') };
    });
    await mpage.screenshot({ path: path.join(OUT, 'hero-390.png') });
    await mpage.evaluate(() => document.querySelector('#suite')?.scrollIntoView());
    await sleep(1200);
    report.mobile.suiteTrigger = await mpage.evaluate(() => !!document.querySelector('#suite .vg-shot [data-collab-trigger]'));
    // Tap the capture → lightbox (the touch path).
    await mpage.tap('#suite .vg-shot button[aria-label^="Expand the"]');
    await mpage.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await sleep(700);
    report.mobile.lightboxLabel = await mpage.evaluate(() => document.querySelector('[role="dialog"] h2')?.textContent || '');
    await mpage.screenshot({ path: path.join(OUT, 'lightbox-390.png') });
    console.log('[E] mobile:', JSON.stringify(report.mobile));
    await mctx.close();
    await ctx.close();

    fs.writeFileSync(path.join(OUT, 'r69-report.json'), JSON.stringify(report, null, 2));
    console.log('consoleErrors:', report.consoleErrors.length ? report.consoleErrors : 'none');
    console.log('report ->', path.join(OUT, 'r69-report.json'));
    await browser.close();
  } finally { server.kill('SIGTERM'); }
})();
