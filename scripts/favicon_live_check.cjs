/* favicon_live_check — probe the LIVE deployment's per-route favicon swap. */
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const probe = async (url) => {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
        await page.waitForTimeout(2500);
        return page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('link[rel*="icon" i]'))
                .map(l => `${l.getAttribute('rel')}=${l.getAttribute('href')}`);
            const title = document.title;
            // pixel sample the apple-touch icon through a canvas — get its dominant color
            return { links, title };
        });
    };
    const hub = await probe('https://practice-pro-vega.vercel.app/');
    const vega = await probe('https://practice-pro-vega.vercel.app/vega');
    const atrium = await probe('https://practice-pro-vega.vercel.app/atrium');
    console.log('HUB   :', JSON.stringify(hub));
    console.log('VEGA  :', JSON.stringify(vega));
    console.log('ATRIUM:', JSON.stringify(atrium));
    await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
