/* signout-dialog-probe — reproduce + attribute the native "Leave site?"
 * dialog the owner sees when signing out (Big A / Complete / Atrium).
 *
 * Method:
 *   1. addInitScript patches window/document.addEventListener BEFORE the app
 *      loads, recording every beforeunload registration (with stack) and
 *      wrapping each handler so we can see WHO calls preventDefault when the
 *      event actually fires.
 *   2. A DOM0 trap watches window.onbeforeunload assignments.
 *   3. A defineProperty trap watches the __suppressBeforeUnload flag.
 *   4. page.on('dialog') captures the native dialog (type beforeunload),
 *      screenshots the page BEHIND it, then accepts (Leave).
 *   5. Seed the DEV demo session (import.meta.env.DEV bypass), reload, sign
 *      out from the user menu, observe.
 *
 * Usage: node scripts/signout-dialog-probe.cjs [baseUrl] [product]
 *   product: vega | atrium | unified (default vega)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5000';
const PRODUCT = process.argv[3] || 'vega';
const OUT = path.join(__dirname, '..', 'audit-results', 'signout-probe');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
    // The sandbox carries chromium-1200 (a different Playwright build than
    // the repo's test dependency) — point at it directly.
    const EXECUTABLE = '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';
    const browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    await context.addInitScript(() => {
        window.__buProbe = { registrations: [], calls: [], dom0: [], flags: [] };
        const log = (kind, data) => {
            try { console.log('[BU-PROBE][' + kind + '] ' + JSON.stringify(data)); } catch (e) { /* noop */ }
        };
        const stackOf = () => {
            try { return (new Error().stack || '').split('\n').slice(2, 8).map(s => s.trim()).join(' | '); }
            catch (e) { return 'no-stack'; }
        };

        const patchAdd = (target, name) => {
            const orig = target.addEventListener.bind(target);
            target.addEventListener = function (type, ...rest) {
                if (type === 'beforeunload') {
                    const entry = { where: name, at: Date.now(), stack: stackOf() };
                    window.__buProbe.registrations.push(entry);
                    log('register', { where: name, stack: entry.stack });
                    const handler = rest[0];
                    if (typeof handler === 'function') {
                        const wrapped = function (e) {
                            let prevented = false;
                            const origPrevent = e.preventDefault.bind(e);
                            e.preventDefault = function () { prevented = true; return origPrevent(); };
                            try { handler.call(this, e); }
                            finally {
                                const rec = { where: name, prevented, returnValue: String(e.returnValue) };
                                window.__buProbe.calls.push(rec);
                                log('call', rec);
                            }
                        };
                        rest = [wrapped, ...rest.slice(1)];
                    }
                }
                return orig(type, ...rest);
            };
        };
        patchAdd(window, 'window');
        patchAdd(document, 'document');

        // DOM0 onbeforeunload trap
        try {
            let _obu = window.onbeforeunload;
            Object.defineProperty(window, 'onbeforeunload', {
                configurable: true,
                get: () => _obu,
                set: (fn) => {
                    _obu = fn;
                    const rec = { assigned: !!fn, at: Date.now(), stack: stackOf() };
                    window.__buProbe.dom0.push(rec);
                    log(fn ? 'dom0-set' : 'dom0-clear', rec);
                }
            });
        } catch (e) { /* defineProperty failed — skip */ }

        // suppress-flag trap
        try {
            let _sup;
            Object.defineProperty(window, '__suppressBeforeUnload', {
                configurable: true,
                get: () => _sup,
                set: (v) => {
                    _sup = v;
                    const rec = { value: v, at: Date.now() };
                    window.__buProbe.flags.push(rec);
                    log('flag', rec);
                }
            });
        } catch (e) { /* skip */ }
    });

    const page = await context.newPage();
    const dialogs = [];
    page.on('dialog', async (d) => {
        const rec = { type: d.type(), message: d.message(), pageUrl: page.url(), at: Date.now() };
        dialogs.push(rec);
        console.log('[DIALOG] ' + JSON.stringify(rec));
        try {
            await page.screenshot({ path: path.join(OUT, 'dialog-behind-' + PRODUCT + '.png') });
        } catch (e) { /* page may be navigating */ }
        try { await d.accept(); } catch (e) { try { await d.dismiss(); } catch (e2) { /* noop */ } }
    });
    page.on('console', (m) => {
        const t = m.text();
        if (t.includes('[BU-PROBE]')) console.log(t.slice(0, 600));
    });
    page.on('pageerror', (e) => console.log('[PAGEERROR] ' + String(e).slice(0, 200)));

    // 1. Landing
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 2. Seed the DEV demo session + product flag
    await page.evaluate((product) => {
        sessionStorage.setItem('practicepro_user_session', JSON.stringify({ token: 'demo@practicepro.ng' }));
        sessionStorage.setItem('practicepro_demo_product', product);
    }, PRODUCT);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000); // session restore + app boot
    await page.screenshot({ path: path.join(OUT, 'app-before-signout-' + PRODUCT + '.png') });
    console.log('[STEP] session restored, url=' + page.url());

    // 2b. Optional: simulate Convex's unsavedChangesWarning listener (the
    // exact handler from convex/dist/esm/browser/sync/client.js) with a
    // request in flight — reproduces the real-session sign-out condition
    // (logout fires revokeSessionMutation + trackEventMutation, then
    // navigates 200ms later while they are still in flight).
    if (process.argv.includes('simconvex')) {
        await page.evaluate(() => {
            window.__simInFlight = true;
            window.addEventListener('beforeunload', (e) => {
                if (window.__simInFlight) {
                    e.preventDefault();
                    const confirmationMessage = 'Are you sure you want to leave? Your changes may not be saved.';
                    (e || window.event).returnValue = confirmationMessage;
                    return confirmationMessage;
                }
            });
            console.log('[BU-PROBE][simconvex] installed convex-identical warning listener');
        });
    }

    // 3. Open the user menu and sign out
    const headerBtn = page.locator('button[aria-label="User menu"]');
    const nMenu = await headerBtn.count();
    console.log('[STEP] user-menu buttons=' + nMenu);
    const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 300).replace(/\n/g, ' / ');
    console.log('[STEP] body snippet: ' + bodyText);
    if (nMenu > 0) {
        await headerBtn.first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(OUT, 'user-menu-' + PRODUCT + '.png') });
        const signOut = page.locator('button:text-is("Sign out"), button:text-is("Exit Demo")');
        const n = await signOut.count();
        console.log('[STEP] sign-out buttons=' + n);
        if (n > 0) {
            await signOut.first().click();
            // Capture what's rendered at T+180ms — just BEFORE the 200ms
            // hard navigation — to see what the user sees BEHIND the dialog.
            await page.waitForTimeout(180);
            try {
                const snap = (await page.locator('body').innerText().catch(() => '')).slice(0, 220).replace(/\n/g, ' / ');
                console.log('[T+180ms] body snippet: ' + snap);
                await page.screenshot({ path: path.join(OUT, 'pre-nav-' + PRODUCT + '.png') });
            } catch (e) { /* renderer may be busy */ }
            // The logout flow: state clear → client re-render → 200ms → location.replace
            await page.waitForTimeout(5000);
        }
    }

    console.log('[STEP] final url=' + page.url());
    console.log('[RESULT] dialogs seen: ' + dialogs.length);
    console.log('[RESULT] ' + JSON.stringify(dialogs, null, 1));
    const probe = await page.evaluate(() => (window.__buProbe ? JSON.parse(JSON.stringify(window.__buProbe)) : null)).catch(() => null);
    if (probe) {
        console.log('[PROBE] registrations=' + probe.registrations.length + ' calls=' + probe.calls.length + ' dom0=' + probe.dom0.length + ' flags=' + probe.flags.length);
    } else {
        console.log('[PROBE] (page navigated — probe state lost; rely on the streamed [BU-PROBE] logs above)');
    }
    await browser.close();
    process.exit(0);
})();
