/* P0 — hub hero diagnostics: what state does each build render? */
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.clock.install({ time: 0 });
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto('http://21.0.12.14:4173/', { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '*,*::before,*::after{animation-play-state:paused!important;transition:none!important}' });
    await page.waitForTimeout(1500);
    const ack = page.locator('.cookie-ack').first();
    if (await ack.count() > 0) await ack.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(600);

    const dump = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const nouns = Array.from(document.querySelectorAll('h1 span')).map((s) => ({
            text: s.textContent?.trim().slice(0, 30),
            cls: s.className.slice(0, 80),
            w: Math.round(s.getBoundingClientRect().width),
        }));
        const imgs = Array.from(document.querySelectorAll('img')).slice(0, 8).map((i) => ({
            src: i.src.split('/').pop()?.slice(0, 40),
            opacity: getComputedStyle(i).opacity,
            complete: i.complete,
        }));
        const steps = Array.from(document.querySelectorAll('[class*="w9-step"]')).slice(0, 6).map((s) => s.className.slice(0, 90));
        return {
            h1: h1?.innerText.replace(/\n/g, ' | '),
            nouns,
            imgs,
            steps,
            bodyClasses: document.body.className,
            mainClass: document.querySelector('main')?.className,
        };
    });
    console.log(JSON.stringify(dump, null, 1));
    await browser.close();
})();
