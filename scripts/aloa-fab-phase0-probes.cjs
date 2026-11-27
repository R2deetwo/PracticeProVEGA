#!/usr/bin/env node
/** Phase 0 probes only (backdrop-take, drag handle, pointerdown-close, chrome budget). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'ui-audit', 'aloa-fab', 'before');
const URL = process.env.VITE_URL || 'http://localhost:5199';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
const log = (...a) => console.error(...a);

async function bootSession(page) {
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
    () => { const el = document.querySelector('.app-container'); return !!el && /app-skin-(vega|atrium)/.test(el.className); },
    { timeout: 45000 }
  );
  await page.waitForTimeout(3000);
}
const panelOpen = (page) => page.waitForSelector('button[aria-label="Close panel"], button[aria-label="Close Court Mode"]', { timeout: 15000 });

async function probeBackdropTake(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
  const page = await ctx.newPage();
  await bootSession(page);
  await page.click('[data-tour-id="aloa-fab"]');
  await panelOpen(page);
  await page.click('button[aria-label="Open Vox mode"]');
  await page.waitForTimeout(1500);
  await page.click('button[aria-label="Start recording"]');
  await page.waitForTimeout(3000);
  const recording = await page.$('button:has-text("Stop")');
  const result = { recordingStarted: !!recording };
  await page.mouse.click(60, 450);
  await page.waitForTimeout(1200);
  const panelGone = !(await page.$('button[aria-label="Close panel"], button[aria-label="Close Court Mode"]'));
  result.panelClosedByBackdropDuringRecording = panelGone;
  await page.click('[data-tour-id="aloa-fab"]');
  await panelOpen(page);
  await page.click('button[aria-label="Open Vox mode"]');
  await page.waitForTimeout(1600);
  const recentRows = await page.$$eval('section[aria-label="Recent voice notes"] > div > div', (els) => els.length).catch(() => 0);
  const queuedStrip = await page.$('text=waiting to upload');
  result.takeSurvived = { recentRows, queuedStrip: !!queuedStrip };
  await page.screenshot({ path: path.join(OUT, 'probe-backdrop-take-1440x900-light.png') });
  await ctx.close();
  return result;
}

async function probeDragHandle(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await bootSession(page);
  await page.click('[data-tour-id="aloa-fab"]');
  await panelOpen(page);
  await page.waitForTimeout(800);
  const handle = await page.$('div.w-10.h-1');
  if (!handle) return { handlePresent: false };
  const box = await handle.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let dy = 20; dy <= 260; dy += 30) await page.mouse.move(cx, cy + dy, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const stillOpen = !!(await page.$('button[aria-label="Close panel"]'));
  await page.screenshot({ path: path.join(OUT, 'probe-drag-handle-390x844-light.png') });
  const handlers = await page.evaluate(() => {
    const el = document.querySelector('div.w-10.h-1').parentElement;
    return { pointerdown: !!el.onpointerdown, touchstart: !!el.ontouchstart };
  });
  return { handlePresent: true, swiped: true, panelStillOpenAfterSwipe: stillOpen, handleGestureHandlers: handlers };
}

async function probePointerDownClose(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await bootSession(page);
  await page.click('[data-tour-id="aloa-fab"]');
  await panelOpen(page);
  await page.waitForTimeout(800);
  const close = await page.$('button[aria-label="Close panel"]');
  const box = await close.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy + 320 }] });
  const closedBeforeTouchEnd = !(await page.$('button[aria-label="Close panel"]'));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(600);
  const closedAfter = !(await page.$('button[aria-label="Close panel"]'));
  return { closedBeforeTouchEnd, closedAfter, gesture: 'touchStart on Close then touchMove +320px (scroll intent)' };
}

async function probeChromeBudget(browser) {
  const out = {};
  for (const vp of [{ name: '390x844', w: 390, h: 844, mobile: true }, { name: '1440x900', w: 1440, h: 900, mobile: false }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, permissions: ['microphone'] });
    const page = await ctx.newPage();
    await bootSession(page);
    await page.click('[data-tour-id="aloa-fab"]');
    await panelOpen(page);
    await page.click('button[aria-label="Open Vox mode"]');
    await page.waitForTimeout(1600);
    const measure = await page.evaluate(() => {
      const find = (sel) => document.querySelector(sel);
      const header = find('header');
      const nav = find('nav[aria-label="Capture mode"]');
      const handle = find('div.w-10.h-1');
      const h = (el) => (el ? Math.round(el.getBoundingClientRect().height) : 0);
      const switcher = [...document.querySelectorAll('[role="group"][aria-label="Vox pane"]')].pop();
      return {
        viewport: { w: window.innerWidth, h: window.innerHeight },
        dragHandleRow: handle ? Math.round(handle.parentElement.getBoundingClientRect().height) : 0,
        panelSwitcherRow: h(switcher),
        voxHeader: h(header),
        bottomModeBar: h(nav),
      };
    });
    measure.chromeAboveContent = measure.dragHandleRow + measure.panelSwitcherRow + measure.voxHeader;
    out[vp.name] = measure;
    await ctx.close();
  }
  return out;
}

(async () => {
  const browser = await chromium.launch({
    headless: true, executablePath: EXEC,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  });
  const probes = { startedAt: new Date().toISOString(), runtime: {} };
  probes.runtime.backdropTake = await probeBackdropTake(browser).catch((e) => ({ error: e.message }));
  log('backdrop:', JSON.stringify(probes.runtime.backdropTake));
  probes.runtime.dragHandle = await probeDragHandle(browser).catch((e) => ({ error: e.message }));
  log('handle:', JSON.stringify(probes.runtime.dragHandle));
  probes.runtime.pointerDownClose = await probePointerDownClose(browser).catch((e) => ({ error: e.message }));
  log('pointerdown:', JSON.stringify(probes.runtime.pointerDownClose));
  probes.runtime.chromeBudget = await probeChromeBudget(browser).catch((e) => ({ error: e.message }));
  log('chrome:', JSON.stringify(probes.runtime.chromeBudget));
  await browser.close();
  fs.writeFileSync(path.join(ROOT, 'docs', 'ui-audit', 'aloa-fab', 'probes.json'), JSON.stringify(probes, null, 2));
  log('DONE — probes.json written');
})().catch((e) => { log('FATAL', e); process.exit(1); });
