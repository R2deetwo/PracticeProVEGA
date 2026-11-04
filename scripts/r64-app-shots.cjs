#!/usr/bin/env node
/**
 * r64-app-shots — re-capture EVERY live app screenshot in the current
 * brand registers (R64).
 *
 * Why: the marketing surfaces carry "REAL captures, not mockups" (owner
 * direction R28, kept), but every Vega/Atrium app capture on the sites
 * still wore a retired register — the /vega hero dashboard and the suite
 * exhibits wore the Warm Chambers copper (R28 captures), the hub tour's
 * demo shots wore the pre-R28 green, the Atrium invoice showed the old
 * emerald Coin, and the portal shots wore the pre-rebrand amber/violet.
 * After R56 (the light-enterprise /vega) and R60 (the navy/indigo app
 * skin + the yellow Stepped Stack) the captures had to be re-taken —
 * same views, same demo firm, the CURRENT app.
 *
 * Method (the r28 pattern, extended): run the Vite DEV server (the demo
 * bypass is dev-gated), restore the demo session directly, pick the
 * product, wait for the skin class, walk the views, screenshot. Output:
 * progressive JPEGs (quality 88) into public/assets/landing/app/ (the
 * /vega + /atrium site exhibits) and public/assets/landing/work/ (the
 * hub tour + portfolio screens).
 *
 * R61 note: the demo workspace is now the HONEST workspace — no
 * Vega|Atrium toggle in the header (a real firm never sees one), and
 * the dev presence avatars show the team online (that is the point of
 * the captures: what several people in one workspace looks like).
 */
const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_OUT = path.join(ROOT, 'public', 'assets', 'landing', 'app');
const WORK_OUT = path.join(ROOT, 'public', 'assets', 'landing', 'work');
const URL = process.env.VITE_URL || 'http://localhost:5199';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';

fs.mkdirSync(APP_OUT, { recursive: true });
fs.mkdirSync(WORK_OUT, { recursive: true });
const RAW = '/tmp/r64-raw';
fs.mkdirSync(RAW, { recursive: true });

const log = (...a) => console.error(...a);

async function bootSession(page, product) {
  await page.goto(URL + '/?boot=prep', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.evaluate((p) => {
    sessionStorage.setItem('practicepro_user_session', JSON.stringify({ token: 'demo@practicepro.ng' }));
    sessionStorage.setItem('practicepro_demo_product', p);
    localStorage.setItem('practicepro_terms_accepted_version', '2026-07-27-v4');
    localStorage.setItem('practicepro_terms_accepted_at', new Date().toISOString());
    localStorage.setItem('practicepro_last_seen_version', 'v1.22.0');
    localStorage.setItem('practicepro_ai_consent', 'true');
    document.documentElement.className = '';
  }, product);
  await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForFunction(
    () => { const el = document.querySelector('.app-container'); return !!el && /app-skin-(vega|atrium)/.test(el.className); },
    { timeout: 45000 }
  );
  await page.waitForTimeout(3500); // session restore + firm data + cards
}

const shot = (page, name, settle = 1800) => async () => {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: path.join(RAW, `${name}.png`) });
  log('captured', name);
};

const navDesktop = async (page, label) => {
  await page.click(`aside :text-is("${label}")`, { timeout: 10000 });
  await page.waitForTimeout(2200);
};

// Close a blocking modal by clicking its backdrop (inset-0 overlay).
const closeModal = (page) => async () => {
  await page.mouse.click(15, 885); // the backdrop's bottom-left corner
  await page.waitForTimeout(900);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXEC });

  // ── VEGA, desktop ────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await bootSession(page, 'vega');

    const nav = (l) => navDesktop(page, l); // awaits the click directly
    const snap = (n, s) => shot(page, n, s);

    // The dashboard (hero + tour stop)
    await snap('dashboard', 1200)();

    // Matters ledger
    await nav('Matters'); await snap('matters-ledger')();

    // Matter detail (tour stop) — open the first matter
    await page.click('text=Industrial Corp v. State Authority', { timeout: 10000 });
    await page.waitForTimeout(2500);
    await snap('vega-demo-matter-detail')();

    // Matter notes — the Notes tab on the same detail
    const notesTab = await page.$('button:has-text("Notes")');
    if (notesTab) { await notesTab.click(); await page.waitForTimeout(2000); }
    await snap('matter-notes')();

    // Back to the ledger, then the New Matter modal (tour stop)
    const newMatter = await page.$('#new-matter-button');
    if (newMatter) { await newMatter.click(); await page.waitForTimeout(2200); }
    await snap('vega-demo-newmatter')();
    await closeModal(page)();
    await page.waitForTimeout(800);
    // Tasks — status (default), flat (None), team (Seun's chip)
    await nav('Tasks'); await snap('tasks-status')();
    const noneBtn = await page.$('button:has-text("None")');
    if (noneBtn) { await noneBtn.click(); await page.waitForTimeout(1500); }
    await snap('tasks-flat')();
    const statusBtn = await page.$('button:has-text("Status")');
    if (statusBtn) { await statusBtn.click(); await page.waitForTimeout(1200); }
    const seunChip = await page.$('button:has-text("Seun")');
    if (seunChip) { await seunChip.click(); await page.waitForTimeout(1500); }
    await snap('tasks-team')();

    // Documents vault + the DraftPro editor (seeded draft session)
    await nav('Documents'); await snap('documents')();
    const SOC_HTML = [
      '<h2>IN THE HIGH COURT OF LAGOS STATE</h2>',
      '<p>In the LAGOS JUDICIAL DIVISION</p>',
      '<p><strong>SUIT NO: [SUIT NUMBER]</strong></p>',
      '<p>BETWEEN</p>',
      '<p><strong>[CLAIMANT NAME]</strong> … CLAIMANT</p>',
      '<p>AND</p>',
      '<p><strong>[DEFENDANT NAME]</strong> … DEFENDANT</p>',
      '<h3>STATEMENT OF CLAIM</h3>',
      '<p>1. The Claimant is a [DESCRIPTION OF CLAIMANT] and carries on business at [CLAIMANT ADDRESS].</p>',
      '<p>2. The Defendant is a [DESCRIPTION OF DEFENDANT] with its registered office at [DEFENDANT ADDRESS].</p>',
      '<p>3. On or about [DATE OF AGREEMENT], the Claimant and the Defendant entered into [NATURE OF AGREEMENT].</p>',
      '<p>4. The Claimant avers that [STATEMENT OF MATERIAL FACTS].</p>',
      '<p>5. Despite repeated demands, the Defendant has failed, refused and/or neglected to [PARTICULARS OF THE BREACH].</p>',
      '<p>WHEREOF the Claimant claims against the Defendant as follows:</p>',
      '<p>(a) The sum of ₦[AMOUNT CLAIMED] being [PARTICULARS OF DEBT OR DAMAGES];</p>',
      '<p>(b) Interest on the said sum at the rate of [INTEREST RATE]% per annum from [DATE] until judgment and thereafter at the same rate until final liquidation;</p>',
      '<p>(c) [FURTHER OR OTHER RELIEF].</p>',
      '<p>Signed:</p>',
      '<p><strong>[COUNSEL NAME]</strong>, Counsel to the Claimant</p>',
    ].join('');
    await page.evaluate((html) => {
      localStorage.setItem('draftpro:demo-firm-id:draft:general:statement-of-claim', JSON.stringify({
        title: 'Statement of Claim', content: html, draftPrompt: '', updatedAt: new Date().toISOString(), savedAt: Date.now(),
      }));
    }, SOC_HTML);
    const popupPromise = page.waitForEvent('popup', { timeout: 12000 });
    await page.click('button:has-text("DraftPro")', { timeout: 10000 });
    const ed = await popupPromise;
    await ed.setViewportSize({ width: 1440, height: 900 });
    await ed.goto(URL + '/editor?draftKey=' + encodeURIComponent('draft:general:statement-of-claim') + '&title=' + encodeURIComponent('Statement of Claim'), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await ed.waitForTimeout(4500);
    await ed.screenshot({ path: path.join(RAW, 'editor.png') });
    log('captured editor');
    await ed.close();

    // Research — the notebook with sources + Argument Lab
    await nav('Research');
    const nb = await page.$('text=Nigerian Land Law Research');
    if (nb) { await nb.click(); await page.waitForTimeout(2200); }
    await snap('research')();

    // Calendar + Analytics
    await nav('Calendar'); await snap('calendar')();
    await nav('Analytics'); await snap('analytics')();

    // Contacts — a contact record (company client with relationships)
    await nav('Contacts');
    const coastal = await page.$('text=Coastal Group');
    if (coastal) { await coastal.click(); await page.waitForTimeout(2200); }
    await snap('contacts')();

    // Financials + the invoice with bank transfer details
    await nav('Financials'); await snap('billing')(); await snap('vega-demo-billing', 300)();
    const inv = await page.$('text=/INV\\//');
    if (inv) { await inv.click(); await page.waitForTimeout(2200); }
    await snap('invoice-bank')();

    // ALOA open over Financials (+ the tour copy)
    await nav('Financials'); await page.waitForTimeout(1500);
    const fab = await page.$('[data-tour-id="aloa-fab"]');
    if (fab) { await fab.click(); await page.waitForTimeout(2800); }
    await snap('vega-aloa', 800)(); await snap('vega-demo-aloa', 300)();

    // The draw-out — the New Contact form over the ALOA chat. The ALOA
    // panel (a right-side drawer) covers the Contacts toolbar, so the
    // same modal ALOA's create_contact tool opens is triggered through
    // the command palette: Ctrl+K → "Add New Contact" (openModal
    // ('newContact')) — the modal renders above the panel.
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(1200);
    await page.keyboard.type('new contact');
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2400);
    await snap('vega-aloa-drawout')();
    await closeModal(page)();

    // Messages — the compose modal with recipients + a drafted notice
    await nav('Messages');
    await page.waitForTimeout(3500);
    const newMsg = await page.$('button:has-text("New Message")');
    if (newMsg) { await newMsg.click(); await page.waitForTimeout(2000); }
    const selAll = await page.$('button:has-text("SELECT ALL"), button:has-text("Select All")');
    if (selAll) { await selAll.click(); await page.waitForTimeout(800); }
    const ta = await page.$('textarea');
    if (ta) {
      await ta.click();
      await ta.type('NOTICE OF ADJOURNMENT — Kindly note that the matter earlier scheduled for hearing has been adjourned by the Court. The new date will be communicated as soon as the registry confirms it. We remain in your service.');
      await page.waitForTimeout(600);
    }
    await snap('vega-demo-messages', 600)();
    await closeModal(page)();

    await ctx.close();
  }

  // ── VEGA, mobile (the phone form factor — the same bundle the APK runs) ──
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await bootSession(page, 'vega');

    const snap = (n, s) => shot(page, n, s);
    // The bottom tab bar for the primary views.
    const tab = async (label) => {
      await page.locator('button:visible', { hasText: new RegExp(`^${label}$`) }).first().click({ timeout: 9000 });
      await page.waitForTimeout(2400);
    };
    // "More" opens the bottom sheet with the rest of the nav.
    const sheetNav = async (label) => {
      await page.locator('button:visible', { hasText: /^More$/ }).first().click({ timeout: 9000 }).catch(() => {});
      await page.waitForTimeout(1400);
      await page.locator('button:visible', { hasText: label }).first().click({ timeout: 9000 });
      await page.waitForTimeout(2600);
    };

    await snap('vega-m-dashboard', 1200)();

    // Matters → open the first matter (matter detail on the phone)
    await tab('Matters');
    const m = await page.$('text=Industrial Corp v. State Authority');
    if (m) { await m.click(); await page.waitForTimeout(2400); }
    await snap('vega-m-matters')();

    // Financials via the More sheet
    await sheetNav('Financials');
    await snap('vega-m-billing')();

    // Messages → the Scheduled tab ("scheduled client messaging")
    await sheetNav('Messages');
    await page.waitForTimeout(2500);
    await snap('vega-messages')(); // the phone capture the portfolio shows
    const sched = await page.$('button:has-text("Scheduled")');
    if (sched) { await sched.click(); await page.waitForTimeout(1800); }
    await snap('vega-m-messages')();

    // Calendar via the More sheet
    await sheetNav('Calendar');
    await snap('vega-calendar')();

    await ctx.close();
  }

  // ── ATRIUM, desktop ─────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await bootSession(page, 'atrium');

    const nav = (l) => navDesktop(page, l); // awaits the click directly
    const snap = (n, s) => shot(page, n, s);

    await snap('atrium-demo-dashboard', 1500)();
    await nav('Financials'); await snap('atrium-demo-financials')();
    const inv = await page.$('text=/INV\\//');
    if (inv) { await inv.click(); await page.waitForTimeout(2200); }
    await snap('atrium-invoice')();

    await ctx.close();
  }

  // ── ATRIUM, mobile ──────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await bootSession(page, 'atrium');
    await shot(page, 'atrium-m-dashboard', 1500)();

    // Financials via the More sheet
    await page.locator('button:visible', { hasText: /^More$/ }).first().click({ timeout: 9000 }).catch(() => {});
    await page.waitForTimeout(1400);
    await page.locator('button:visible', { hasText: 'Financials' }).first().click({ timeout: 9000 }).catch(() => {});
    await page.waitForTimeout(2600);
    await shot(page, 'atrium-financials')();

    await ctx.close();
  }

  // ── The portals (public routes, no session) ─────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const portal = async (url, name) => {
      await page.goto(URL + url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(2500);
      // the cookie banner's Acknowledge (a hidden duplicate exists —
      // pick the VISIBLE one)
      await page.locator('button:visible', { hasText: 'Acknowledge' }).first().click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(RAW, `${name}.png`) });
      log('captured', name);
    };
    await portal('/portal/client/login', 'vega-portal');
    await portal('/portal/tenant/login', 'atrium-portal');
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const portal = async (url, name) => {
      await page.goto(URL + url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(2500);
      // the cookie banner's Acknowledge (a hidden duplicate exists —
      // pick the VISIBLE one)
      await page.locator('button:visible', { hasText: 'Acknowledge' }).first().click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(RAW, `${name}.png`) });
      log('captured', name);
    };
    await portal('/portal/client/login', 'vega-m-portal');
    await portal('/portal/tenant/login', 'atrium-m-portal');
    await ctx.close();
  }

  await browser.close();

  // ── Convert to progressive JPEGs in the repo asset folders ─────────
  const routing = {
    // /vega + /atrium site exhibits (public/assets/landing/app/)
    dashboard: APP_OUT, 'matters-ledger': APP_OUT, 'tasks-status': APP_OUT, 'tasks-flat': APP_OUT,
    'tasks-team': APP_OUT, contacts: APP_OUT, editor: APP_OUT, documents: APP_OUT, research: APP_OUT,
    billing: APP_OUT, 'invoice-bank': APP_OUT, analytics: APP_OUT, calendar: APP_OUT,
    'matter-notes': APP_OUT, 'vega-aloa': APP_OUT, 'vega-aloa-drawout': APP_OUT, 'atrium-invoice': APP_OUT,
    // hub tour + portfolio screens (public/assets/landing/work/)
    'vega-demo-matter-detail': WORK_OUT, 'vega-demo-newmatter': WORK_OUT, 'vega-demo-billing': WORK_OUT,
    'vega-demo-aloa': WORK_OUT, 'vega-demo-messages': WORK_OUT,
    'vega-m-dashboard': WORK_OUT, 'vega-m-matters': WORK_OUT, 'vega-m-billing': WORK_OUT, 'vega-m-messages': WORK_OUT,
    'vega-messages': WORK_OUT, 'vega-calendar': WORK_OUT,
    'atrium-demo-dashboard': WORK_OUT, 'atrium-demo-financials': WORK_OUT,
    'atrium-m-dashboard': WORK_OUT, 'atrium-financials': WORK_OUT,
    'vega-portal': WORK_OUT, 'vega-m-portal': WORK_OUT, 'atrium-portal': WORK_OUT, 'atrium-m-portal': WORK_OUT,
  };
  let n = 0;
  for (const f of fs.readdirSync(RAW).filter((f) => f.endsWith('.png'))) {
    const name = f.replace('.png', '');
    const dir = routing[name];
    if (!dir) { log('UNROUTED (skipped):', name); continue; }
    const dst = path.join(dir, `${name}.jpg`);
    await sharp(path.join(RAW, f)).jpeg({ quality: 88, progressive: true }).toFile(dst);
    log(`wrote ${path.relative(ROOT, dst)} (${fs.statSync(dst).size} bytes)`);
    n++;
  }
  // The tour's dashboard + calendar stops are the same views the /vega
  // exhibits show — same capture, second filename (as before).
  for (const [src, dst] of [
    ['dashboard', 'vega-demo-dashboard'],
    ['calendar', 'vega-demo-calendar'],
  ]) {
    await sharp(path.join(RAW, `${src}.png`)).jpeg({ quality: 88, progressive: true }).toFile(path.join(WORK_OUT, `${dst}.jpg`));
    log(`wrote work/${dst}.jpg (from the ${src} capture)`);
    n++;
  }
  log(`done — ${n} captures`);
})().catch((e) => { log('FATAL', e.message); process.exit(1); });
