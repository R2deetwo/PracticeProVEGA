#!/usr/bin/env node
/** Round 24 AFTER screenshots — same states/filenames as before/, new UI. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'ui-audit', 'aloa-fab', 'after');
const URL = process.env.VITE_URL || 'http://localhost:5199';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
fs.mkdirSync(OUT, { recursive: true });
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
  await page.waitForTimeout(3000);
}

async function shot(page, vp, theme, state, settle = 800) {
  await page.waitForTimeout(settle);
  if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: path.join(OUT, `${state}-${vp.name}-${theme}.png`) });
  log('captured', `${state}-${vp.name}-${theme}`);
}

const panel = (page) => page.waitForSelector('div[role="dialog"][aria-label="ALOA"]', { timeout: 15000 });

async function runStates(browser, vp, theme) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, permissions: ['microphone'] });
  const page = await ctx.newPage();
  await bootSession(page);

  await page.waitForSelector('[data-tour-id="aloa-fab"]', { timeout: 20000 });
  await shot(page, vp, theme, 'fab-idle', 300);

  // Panel → chat empty state (greeting + capability + chips + pane links)
  await page.click('[data-tour-id="aloa-fab"]');
  await panel(page);
  await shot(page, vp, theme, 'panel-chat-empty', 600);

  // Send a message (error card is expected in the demo — evidence of §2.3)
  try {
    const ta = await page.$('footer textarea');
    if (ta) {
      await ta.click();
      await ta.type('What are my court dates this week?');
      await page.click('button[aria-label="Send to ALOA"]');
      await page.waitForTimeout(9000).catch(() => {});
    }
  } catch (e) { log('send failed', e.message); }
  await shot(page, vp, theme, 'panel-chat-messages', 200);

  // History drawer (renamed)
  try {
    await page.click('button[aria-label="Conversation History"]');
    await shot(page, vp, theme, 'panel-chat-history', 500);
    await page.click('button[aria-label="Conversation History"]');
    await page.waitForTimeout(300);
  } catch (e) { log('history failed', e.message); }

  // Vox pane via the SEGMENT (no more chat-header mic)
  try {
    await page.click('div[role="dialog"] button:has-text("Vox")');
    await page.waitForTimeout(1400);
    await shot(page, vp, theme, 'vox-speak-idle', 300);

    await page.click('button[aria-label="Start recording"]');
    await page.waitForTimeout(3200);
    await shot(page, vp, theme, 'vox-speak-recording', 200);
    await page.locator('button:has-text("Stop")').last().click().catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, vp, theme, 'vox-speak-processing', 100);
    await page.waitForTimeout(10000).catch(() => {});
    const triage = await page.$('text=Save to');
    await shot(page, vp, theme, triage ? 'vox-triage' : 'vox-triage-unreachable', 100);
  } catch (e) { log('vox flow failed', e.message); }

  // Offline queued (offline BEFORE the take)
  try {
    await ctx.setOffline(true);
    await page.waitForTimeout(500);
    const mic = await page.$('button[aria-label="Start recording"]');
    if (mic) {
      await mic.click();
      await page.waitForTimeout(2400);
      await page.locator('button:has-text("Stop")').last().click().catch(() => {});
      await page.waitForTimeout(1200);
    }
    await shot(page, vp, theme, 'vox-speak-queued', 100);
    await ctx.setOffline(false);
    await page.waitForTimeout(600);
  } catch (e) { log('queued failed', e.message); await ctx.setOffline(false).catch(() => {}); }

  await shot(page, vp, theme, 'vox-recent', 200);

  try {
    await page.locator('button:has-text("Legal Pad")').last().click();
    await page.waitForTimeout(1100);
    await shot(page, vp, theme, 'vox-pad', 200);
    const back = await page.$('button:has-text("Back to Vox")');
    if (back) { await back.click(); await page.waitForTimeout(500); }
  } catch (e) { log('pad failed', e.message); }

  try {
    await page.locator('button:has-text("Session")').last().click();
    await page.waitForTimeout(1200);
    await shot(page, vp, theme, 'vox-session-setup', 200);
    const start = await page.$('button:has-text("Start recording")');
    if (start) {
      await start.click();
      await page.waitForTimeout(3200);
      await shot(page, vp, theme, 'vox-session-live', 200);
      const stop = await page.$('button:has-text("Stop")');
      if (stop) { await stop.click().catch(() => {}); await page.waitForTimeout(1200); }
      const back = await page.$('button:has-text("Back to Vox")');
      if (back) { await back.click().catch(() => {}); await page.waitForTimeout(500); }
    }
  } catch (e) { log('session failed', e.message); }

  try {
    const gear = await page.$('button[aria-label="ALOA Vox settings"]');
    if (gear) {
      await gear.click();
      await page.waitForTimeout(600);
      const tipsItem = await page.$('button:has-text("Voice tips, snippets & dictionary")');
      if (tipsItem) {
        await tipsItem.click();
        await page.waitForTimeout(800);
        await shot(page, vp, theme, 'vox-tips', 200);
        const closeTips = await page.$('button[aria-label="Close voice tips"]');
        if (closeTips) { await closeTips.click(); await page.waitForTimeout(300); }
      }
    }
  } catch (e) { log('tips failed', e.message); }

  try {
    const court = await page.$('div[role="dialog"] button:has-text("Court")');
    if (court) {
      await court.click();
      await page.waitForTimeout(1600);
      await shot(page, vp, theme, 'court-diary', 300);
    }
  } catch (e) { log('court failed', e.message); }

  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({
    headless: true, executablePath: EXEC,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  });
  for (const vp of VIEWPORTS) {
    for (const theme of ['light', 'dark']) {
      log(`── ${vp.name} ${theme} ──`);
      await runStates(browser, vp, theme).catch((e) => log('FAILED', vp.name, theme, e.message));
    }
  }
  await browser.close();
  log('DONE');
})().catch((e) => { log('FATAL', e); process.exit(1); });
