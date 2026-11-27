#!/usr/bin/env node
/**
 * ALOA FAB surface — Phase 0 diagnostic capture (Round 24).
 *
 * BEFORE screenshots (light + dark) at 390x844, 768x1024, 1440x900 of the
 * whole FAB → panel → chat → Vox → Court Mode path, plus the runtime
 * probes the findings need (backdrop-vs-take, drag handle, pointerdown
 * Close, chrome budget). No code changes — this only observes.
 *
 * Output:
 *   docs/ui-audit/aloa-fab/before/<state>-<WxH>-<light|dark>.png
 *   docs/ui-audit/aloa-fab/probes.json
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'ui-audit', 'aloa-fab', 'before');
const URL = process.env.VITE_URL || 'http://localhost:5199';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';

fs.mkdirSync(OUT, { recursive: true });
const probes = { startedAt: new Date().toISOString(), url: URL, states: {}, runtime: {} };
const log = (...a) => console.error(...a);

const VIEWPORTS = [
  { name: '390x844', w: 390, h: 844, mobile: true },
  { name: '768x1024', w: 768, h: 1024, mobile: false },
  { name: '1440x900', w: 1440, h: 900, mobile: false },
];

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
  await page.waitForTimeout(3200);
}

async function ensureDark(page, dark) {
  if (dark) {
    await page.evaluate(() => document.documentElement.classList.add('dark'));
  }
}

async function shot(page, vp, theme, state, settle = 900) {
  await page.waitForTimeout(settle);
  await ensureDark(page, theme === 'dark');
  const file = path.join(OUT, `${state}-${vp.name}-${theme}.png`);
  await page.screenshot({ path: file });
  probes.states[`${state}-${vp.name}-${theme}`] = { file: path.relative(ROOT, file) };
  log('captured', `${state}-${vp.name}-${theme}`);
}

const panelOpen = (page) => page.waitForSelector('button[aria-label="Close panel"], button[aria-label="Close Court Mode"]', { timeout: 15000 });

async function runStates(browser, vp, theme) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    isMobile: vp.mobile, hasTouch: vp.mobile,
    permissions: ['microphone'],
  });
  const page = await ctx.newPage();
  const consoleLines = [];
  page.on('console', (m) => { const t = m.text(); if (/error|warn|take|record|queue|capture/i.test(t)) consoleLines.push(t.slice(0, 200)); });
  await bootSession(page);

  // 1. FAB idle
  await page.waitForSelector('[data-tour-id="aloa-fab"]', { timeout: 20000 });
  const fab = await page.$('[data-tour-id="aloa-fab"]');
  if (fab) {
    probes.runtime[`fab-aria-${vp.name}-${theme}`] = await fab.getAttribute('aria-label');
    probes.runtime[`fab-title-${vp.name}-${theme}`] = await fab.getAttribute('title');
    // FAB listening probe: try to reach aloaState 'listening' from the console
    probes.runtime[`fab-listening-reachable-${vp.name}-${theme}`] = await page.evaluate(() => {
      // The only aloaState writer is AloaProvider ('idle'); nothing else exposes it.
      return typeof window.__aloaState === 'undefined' ? 'no-exposed-setter' : 'unexpected-exposed-setter';
    });
  }
  await shot(page, vp, theme, 'fab-idle', 400);

  // 2. Panel → chat empty
  await page.click('[data-tour-id="aloa-fab"]');
  await panelOpen(page);
  await page.waitForTimeout(1200);
  await shot(page, vp, theme, 'panel-chat-empty', 400);

  // 3. Chat with messages (send one; response may succeed or render the error card — both are evidence)
  try {
    const ta = await page.$('footer textarea');
    if (ta) {
      await ta.click();
      await ta.type('What are my court dates this week?');
      await page.waitForTimeout(300);
      await page.click('button[aria-label="Send to ALOA"]');
      await page.waitForTimeout(25000).catch(() => {});
    }
  } catch (e) { log('send failed', e.message); }
  await shot(page, vp, theme, 'panel-chat-messages', 300);

  // 4. History drawer
  try {
    await page.click('button[title="Conversation History"]');
    await page.waitForTimeout(900);
    await shot(page, vp, theme, 'panel-chat-history', 200);
    await page.click('button[title="Conversation History"]');
    await page.waitForTimeout(400);
  } catch (e) { log('history failed', e.message); }

  // 5. Vox Speak idle (chat header mic)
  try {
    await page.click('button[aria-label="Open Vox mode"]');
    await page.waitForTimeout(1500);
    await shot(page, vp, theme, 'vox-speak-idle', 300);
  } catch (e) { log('vox open failed', e.message); }

  // 6. Upsell reachable? (locked mic → canUseVox false)
  const micBtn = await page.$('button[aria-label^="Unlock ALOA Vox"]');
  if (micBtn) {
    await micBtn.click().catch(() => {});
    await page.waitForTimeout(900);
    await shot(page, vp, theme, 'vox-upsell', 200);
    probes.runtime[`canUseVox-${vp.name}-${theme}`] = false;
  } else {
    probes.runtime[`canUseVox-${vp.name}-${theme}`] = true;
    // 7. Recording
    try {
      await page.click('button[aria-label="Start recording"]');
      await page.waitForTimeout(3600);
      await shot(page, vp, theme, 'vox-speak-recording', 200);
      // 8. Stop → processing
      await page.locator('button:has-text("Stop")').last().click().catch(() => {});
      await page.waitForTimeout(700);
      await shot(page, vp, theme, 'vox-speak-processing', 100);
      // 9. Triage or failure card (up to 35s)
      await page.waitForTimeout(35000).catch(() => {});
      const triage = await page.$('text=Save to');
      await shot(page, vp, theme, triage ? 'vox-triage' : 'vox-triage-unreachable', 100);
      probes.runtime[`triage-reached-${vp.name}-${theme}`] = !!triage;
    } catch (e) { log('recording flow failed', e.message); }
  }

  // 10. Queued (offline take)
  try {
    await ctx.setOffline(true);
    await page.waitForTimeout(600);
    const idleAgain = await page.$('button[aria-label="Start recording"]');
    if (idleAgain) {
      await idleAgain.click();
      await page.waitForTimeout(2600);
      await page.locator('button:has-text("Stop")').last().click().catch(() => {});
      await page.waitForTimeout(1200);
      await shot(page, vp, theme, 'vox-speak-queued', 100);
    }
    await ctx.setOffline(false);
    await page.waitForTimeout(800);
  } catch (e) { log('queued flow failed', e.message); await ctx.setOffline(false).catch(() => {}); }

  // 11. Recent list state
  await shot(page, vp, theme, 'vox-recent', 200);

  // 12. Legal Pad
  try {
    await page.locator('button:has-text("Legal Pad")').last().click();
    await page.waitForTimeout(1200);
    await shot(page, vp, theme, 'vox-pad', 200);
    const back = await page.$('button:has-text("Back to Vox")');
    if (back) { await back.click(); await page.waitForTimeout(600); }
  } catch (e) { log('pad failed', e.message); }

  // 13. Session setup + live
  try {
    await page.locator('button:has-text("Session")').last().click();
    await page.waitForTimeout(1400);
    await shot(page, vp, theme, 'vox-session-setup', 200);
    const start = await page.$('button:has-text("Start recording")');
    if (start) {
      await start.click();
      await page.waitForTimeout(3500);
      await shot(page, vp, theme, 'vox-session-live', 200);
      const stop = await page.$('button:has-text("Stop")');
      if (stop) { await stop.click().catch(() => {}); await page.waitForTimeout(1500); }
      const back = await page.$('button:has-text("Back to Vox")');
      if (back) { await back.click().catch(() => {}); await page.waitForTimeout(600); }
    }
  } catch (e) { log('session failed', e.message); }

  // 14. Voice tips (gear → tips)
  try {
    const gear = await page.$('button[aria-label="ALOA Vox settings"]');
    if (gear) {
      await gear.click();
      await page.waitForTimeout(700);
      const tipsItem = await page.$('button:has-text("Voice tips, snippets & dictionary")');
      if (tipsItem) {
        await tipsItem.click();
        await page.waitForTimeout(900);
        await shot(page, vp, theme, 'vox-tips', 200);
        const closeTips = await page.$('button[aria-label="Close voice tips"]');
        if (closeTips) { await closeTips.click(); await page.waitForTimeout(400); }
      }
    }
  } catch (e) { log('tips failed', e.message); }

  // 15. Court Mode diary
  try {
    const court = await page.$('button:has-text("Court Mode")');
    if (court) {
      await court.click();
      await page.waitForTimeout(1800);
      await shot(page, vp, theme, 'court-diary', 300);
    }
  } catch (e) { log('court failed', e.message); }

  probes.runtime[`console-lines-${vp.name}-${theme}`] = consoleLines.slice(0, 25);
  await ctx.close();
}

// ── Probes (evidence for FINDINGS) ─────────────────────────────────────

async function probeBackdropTake(browser) {
  // Does backdrop click close the panel while Vox is RECORDING, and what
  // happens to the take? Desktop 1440x900 (the veil is only clickable when
  // the panel is a side drawer).
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
  const page = await ctx.newPage();
  await bootSession(page);
  await page.click('[data-tour-id="aloa-fab"]');
  await panelOpen(page);
  await page.click('button[aria-label="Open Vox mode"]');
  await page.waitForTimeout(1200);
  await page.click('button[aria-label="Start recording"]');
  await page.waitForTimeout(3000);
  const recording = await page.$('button:has-text("Stop")');
  const result = { recordingStarted: !!recording };
  // click the veil well left of the 520px drawer
  await page.mouse.click(60, 450);
  await page.waitForTimeout(1200);
  const panelGone = !(await page.$('button[aria-label="Close panel"], button[aria-label="Close Court Mode"]'));
  result.panelClosedByBackdropDuringRecording = panelGone;
  // Reopen → is the take anywhere? (recent list / queued strip)
  await page.click('[data-tour-id="aloa-fab"]');
  await panelOpen(page);
  await page.click('button[aria-label="Open Vox mode"]');
  await page.waitForTimeout(1500);
  const recentRows = await page.$$eval('section[aria-label="Recent voice notes"] > div > div', (els) => els.length).catch(() => 0);
  const queuedStrip = await page.$('text=waiting to upload');
  result.takeSurvived = { recentRows, queuedStrip: !!queuedStrip };
  await page.screenshot({ path: path.join(OUT, `probe-backdrop-take-1440x900-light.png`) });
  await ctx.close();
  return result;
}

async function probeDragHandle(browser) {
  // Mobile drag handle: visual-only? Dispatch a full swipe gesture on it.
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
  // Chat Close uses onPointerDown — a touch that starts on the button and
  // scrolls away still closes (pointerdown fires before the gesture is
  // resolved as a scroll).
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, hasTouch: true });
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
  // How many px of chrome stack above Vox content (panel switcher + Vox
  // header + bottom mode bar [+ drag handle on mobile])?
  const out = {};
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, permissions: ['microphone'] });
    const page = await ctx.newPage();
    await bootSession(page);
    await page.click('[data-tour-id="aloa-fab"]');
    await panelOpen(page);
    await page.click('button[aria-label="Open Vox mode"]');
    await page.waitForTimeout(1500);
    const measure = await page.evaluate(() => {
      const find = (sel) => document.querySelector(sel);
      const panel = [...document.querySelectorAll('div')].find((d) => d.className && /sidePanel|animate-in/.test(d.className) && getComputedStyle(d).position === 'fixed');
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
    headless: true,
    executablePath: EXEC,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  });
  for (const vp of VIEWPORTS) {
    for (const theme of ['light', 'dark']) {
      log(`── ${vp.name} ${theme} ──`);
      await runStates(browser, vp, theme).catch((e) => log('STATES FAILED', vp.name, theme, e.message));
    }
  }
  probes.runtime.backdropTake = await probeBackdropTake(browser).catch((e) => ({ error: e.message }));
  probes.runtime.dragHandle = await probeDragHandle(browser).catch((e) => ({ error: e.message }));
  probes.runtime.pointerDownClose = await probePointerDownClose(browser).catch((e) => ({ error: e.message }));
  probes.runtime.chromeBudget = await probeChromeBudget(browser).catch((e) => ({ error: e.message }));
  await browser.close();
  fs.writeFileSync(path.join(ROOT, 'docs', 'ui-audit', 'aloa-fab', 'probes.json'), JSON.stringify(probes, null, 2));
  log('DONE — probes.json written');
})().catch((e) => { log('FATAL', e); process.exit(1); });
