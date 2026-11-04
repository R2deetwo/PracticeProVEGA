/**
 * R64 live verification — the re-captured screenshots + the vega/atrium
 * toggle, on https://practice-pro-vega.vercel.app.
 *
 *   1. /vega "View Live Demo" OPENS the demo-access modal — the toggle
 *      (Vega — Legal OS | Atrium — Property OS, both marks, radiogroup)
 *      pre-toggled to Vega; switching to Atrium flips aria-checked.
 *   2. The hero's dashboard capture is the NEW navy/indigo one (pixel
 *      hue test: navy/indigo present, the Warm Chambers copper gone).
 *   3. A suite exhibit sample (tasks-status.jpg) also re-captured.
 *   4. The portals: /portal/client/login carries the Seal + the indigo
 *      badge; /portal/tenant/login the Stepped Stack + yellow.
 *   5. The hub portfolio tour renders with the R64 accents (the tour
 *      chips carry the vega indigo, not the retired amber).
 *   6. Zero console errors on /, /vega, both portal logins.
 */
const { chromium } = require('playwright');
const sharp = require('sharp');

const BASE = 'https://practice-pro-vega.vercel.app';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome';

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

(async () => {
    const b = await chromium.launch({ headless: true, executablePath: EXEC });

    // ── 1+2: /vega — the modal + the hero capture ──────────────────────
    {
        const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${BASE}/vega`, { waitUntil: 'networkidle', timeout: 60000 });

        await page.click('text=View Live Demo');
        await page.waitForTimeout(1600);
        const modal = await page.evaluate(() => {
            const dlg = document.querySelector('[role="dialog"]');
            const t = dlg ? dlg.textContent : '';
            const radios = Array.from(document.querySelectorAll('[role="dialog"] [role="radio"]'))
                .map((r) => ({ checked: r.getAttribute('aria-checked'), text: r.textContent.trim().slice(0, 22) }));
            const svg = dlg ? dlg.querySelectorAll('svg').length : 0;
            const cta = dlg ? Array.from(dlg.querySelectorAll('button')).find((x) => /Start Exploring/.test(x.textContent)) : null;
            const ctaBg = cta ? getComputedStyle(cta).backgroundColor : null;
            return { open: !!dlg, hasVega: /Vega — Legal OS/.test(t), hasAtrium: /Atrium — Property OS/.test(t), radios, svgs: svg, ctaBg };
        });
        check('R64 View Live Demo opens the demo-access modal', modal.open && modal.hasVega && modal.hasAtrium,
            modal.radios.map((r) => `${r.text}${r.checked === 'true' ? '✓' : ''}`).join(' | '));
        check('R64 Vega pre-toggled', modal.radios[0] && modal.radios[0].checked === 'true');
        check('R64 the CTA is the executive navy', modal.ctaBg && /rgb\(30, 58, 138\)/.test(modal.ctaBg), String(modal.ctaBg));
        // flip to Atrium
        await page.click('[role="dialog"] [role="radio"]:has-text("Atrium")');
        await page.waitForTimeout(600);
        const flipped = await page.evaluate(() =>
            Array.from(document.querySelectorAll('[role="dialog"] [role="radio"]')).map((r) => r.getAttribute('aria-checked')));
        check('R64 the toggle flips to Atrium', flipped[1] === 'true', flipped.join(','));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);

        // the hero capture — pixel hue test on the SERVED image
        const heroUrl = await page.evaluate(() => document.querySelector('#home img').src);
        const img = await page.evaluate(async (u) => {
            const res = await fetch(u);
            const buf = await res.arrayBuffer();
            return Array.from(new Uint8Array(buf));
        }, heroUrl);
        const { data, info } = await sharp(Buffer.from(img)).resize(400, 250).raw().toBuffer({ resolveWithObject: true });
        let navy = 0, copper = 0, total = 0;
        for (let i = 0; i < data.length; i += info.channels * 7) {
            const r = data[i], g = data[i + 1], bl = data[i + 2];
            total++;
            if (bl > 90 && bl > r * 1.35 && g < bl * 1.05) navy++;          // navy/indigo family
            if (r > 120 && r > bl * 1.5 && g > 60 && g < r) copper++;      // the Warm Chambers copper
        }
        check('R64 hero capture is the new one (navy present)', navy / total > 0.005, `${navy}/${total} navy px (${(100 * navy / total).toFixed(2)}%)`);
        check('R64 hero capture has no Warm Chambers copper left', copper / total < 0.004, `${copper}/${total} copper px (${(100 * copper / total).toFixed(2)}%)`);

        // a suite exhibit sample
        const tUrl = `${BASE}/assets/landing/app/tasks-status.jpg`;
        const tImg = await page.evaluate(async (u) => {
            const res = await fetch(u); const buf = await res.arrayBuffer(); return Array.from(new Uint8Array(buf));
        }, tUrl);
        const t = await sharp(Buffer.from(tImg)).resize(400, 250).raw().toBuffer({ resolveWithObject: true });
        let tGreen = 0, tTotal = 0, tNavy = 0;
        for (let i = 0; i < t.data.length; i += t.info.channels * 7) {
            const r = t.data[i], g = t.data[i + 1], bl = t.data[i + 2];
            tTotal++;
            if (g > 100 && g > r * 1.5 && g > bl * 1.5) tGreen++;
            if (bl > 90 && bl > r * 1.35 && g < bl * 1.05) tNavy++;
        }
        check('R64 the suite exhibit (tasks-status) is re-captured — navy skin', tNavy / tTotal > 0.004 && tGreen / tTotal < 0.01,
            `navy ${(100 * tNavy / tTotal).toFixed(2)}% / green ${(100 * tGreen / tTotal).toFixed(2)}%`);

        check('R64 zero console errors on /vega', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');
        await page.close();
    }

    // ── 4: the portals ──────────────────────────────────────────────────
    {
        const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        await page.goto(`${BASE}/portal/client/login`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(2500);
        await page.locator('button:visible', { hasText: 'Acknowledge' }).first().click({ timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(600);
        const client = await page.evaluate(() => {
            const badge = Array.from(document.querySelectorAll('span')).find((s) => /^Vega$/i.test(s.textContent.trim()));
            return {
                badge: badge ? badge.textContent.trim() : null,
                badgeColor: badge ? getComputedStyle(badge).color : null,
                svg: !!document.querySelector('header svg, nav svg, .container svg'),
            };
        });
        check('R64 client portal wears the indigo Vega badge', client.badge === 'Vega' && /112, 99, 246|129, 140, 248|165, 180, 252/.test(client.badgeColor || ''),
            `badge=${client.badge} color=${client.badgeColor}`);

        await page.goto(`${BASE}/portal/tenant/login`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(2500);
        await page.locator('button:visible', { hasText: 'Acknowledge' }).first().click({ timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(600);
        const tenant = await page.evaluate(() => {
            const badge = Array.from(document.querySelectorAll('span')).find((s) => /^Atrium$/i.test(s.textContent.trim()));
            const cta = Array.from(document.querySelectorAll('button')).find((x) => /Sign In/i.test(x.textContent) && x.getBoundingClientRect().height > 30);
            const cs = cta ? getComputedStyle(cta) : null;
            return {
                badge: badge ? badge.textContent.trim() : null,
                badgeColor: badge ? getComputedStyle(badge).color : null,
                ctaBg: cs ? cs.backgroundColor + ' | ' + cs.backgroundImage : null,
            };
        });
        check('R64 tenant portal wears the yellow Atrium badge', tenant.badge === 'Atrium' && /250, 204, 21|253, 224, 71|161, 98, 7/.test(tenant.badgeColor || ''),
            `badge=${tenant.badge} color=${tenant.badgeColor}`);
        check('R64 tenant portal CTA is yellow', tenant.ctaBg && /250, 204, 21|234, 179, 8/.test(tenant.ctaBg), String(tenant.ctaBg).slice(0, 90));
        check('R64 zero console errors on the portals', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');
        await page.close();
    }

    // ── 5: the hub portfolio tour accent (the folded exhibit's chips) ──
    {
        const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 });
        const rows = await page.$$('button[aria-controls^="work-exhibit-"]');
        if (rows.length >= 2) {
            await rows[0].scrollIntoViewIfNeeded();
            await page.waitForTimeout(2800); // scroll-reveal settle
            // the tour lives in the "Preview the system" modal — open it
            await page.click('button:has-text("Preview the system")', { timeout: 10000 });
            await page.waitForTimeout(2500);
            const accent = await page.evaluate(() => {
                const dlg = document.querySelector('[role="dialog"]') || document.body;
                const el = dlg.querySelector('[style*="79, 70, 229"], [style*="79,70,229"], [style*="#4F46E5"]');
                const old = dlg.querySelector('[style*="217, 119, 6"], [style*="217,119,6"], [style*="#D97706"]');
                return { newAccent: !!el, oldAccent: !!old };
            });
            check('R64 the tour accent is vega indigo (not the retired amber)', accent.newAccent && !accent.oldAccent,
                `indigo=${accent.newAccent} amber=${accent.oldAccent}`);
        } else {
            check('R64 the tour accent probe', false, 'portfolio rows not found');
        }
        check('R64 zero console errors on /', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');
        await page.close();
    }

    await b.close();
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
