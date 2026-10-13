/* R23 — contact sheet of the new marks at favicon/nav/hero scales for review. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const vega = fs.readFileSync(path.join(root, 'public/brand/vega/favicon.svg'), 'utf8');
const atrium = fs.readFileSync(path.join(root, 'public/brand/atrium/favicon.svg'), 'utf8');

const html = `<!doctype html><meta charset="utf-8">
<style>
  body{margin:0;padding:40px;background:#0D111B;font-family:monospace;color:#94A3B8;display:flex;gap:56px;align-items:flex-end}
  .col{display:flex;flex-direction:column;gap:24px;align-items:flex-start}
  .row{display:flex;gap:20px;align-items:flex-end}
  .lbl{font-size:10px;letter-spacing:.15em;color:#64748B;margin-top:6px}
  .light{background:#FAF7F2;padding:20px;border-radius:12px}
</style>
<div class="col">
  <div class="row">${[16, 24, 32, 48, 96].map((s) => `<div><div style="width:${s}px;height:${s}px">${vega}</div><div class="lbl">${s}px</div></div>`).join('')}</div>
  <div class="row light">${[24, 48].map((s) => `<div><div style="width:${s}px;height:${s}px">${vega}</div><div class="lbl">${s} light</div></div>`).join('')}</div>
</div>
<div class="col">
  <div class="row">${[16, 24, 32, 48, 96].map((s) => `<div><div style="width:${s}px;height:${s}px">${atrium}</div><div class="lbl">${s}px</div></div>`).join('')}</div>
  <div class="row light">${[24, 48].map((s) => `<div><div style="width:${s}px;height:${s}px">${atrium}</div><div class="lbl">${s} light</div></div>`).join('')}</div>
</div>`;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 900, height: 480 }, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.screenshot({ path: '/home/z/my-project/download/r23-marks-sheet.png', omitBackground: false });
    await browser.close();
    console.log('sheet written');
})();
