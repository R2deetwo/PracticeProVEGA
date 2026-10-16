#!/usr/bin/env node
/** R28 marks sheet — the new Coin of the House (Atrium) and the Twin
 *  Coins (Komplete) at 16/32/48/128 px on light + dark bars, next to the
 *  (unchanged) Vega Seal, for VLM legibility review. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const PUB = p => 'file://' + path.join(ROOT, 'public', 'brand', p);
const OUT = path.join(ROOT, 'scripts', '.r28-marks-sheet.png');

const sizes = [16, 32, 48, 128];
const marks = [
  ['Vega (unchanged)', 'vega/favicon.svg'],
  ['Atrium — Coin of the House (NEW)', 'atrium/favicon.svg'],
  ['Komplete — Twin Coins (NEW)', 'komplete/favicon.svg'],
];

const cells = marks.map(([label, file]) => `
  <div class="markrow">
    <div class="label">${label}</div>
    <div class="icons light">${sizes.map(s => `<img src="${PUB(file)}" style="width:${s}px;height:${s}px">`).join('')}</div>
    <div class="icons dark">${sizes.map(s => `<img src="${PUB(file)}" style="width:${s}px;height:${s}px">`).join('')}</div>
  </div>`).join('');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width: 900px; padding: 24px; font-family: sans-serif; background: #F1F5F9; }
  .head { font-size: 13px; font-weight: 700; color:#334155; margin-bottom: 6px; }
  .sub { font-size: 11px; color:#64748B; margin-bottom: 16px; }
  .cols { display:flex; gap:12px; font-size:10px; color:#64748B; margin-bottom:6px; padding-left: 210px; }
  .cols div { flex:1; }
  .markrow { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
  .label { width: 198px; font-size:11px; color:#334155; font-weight:600; }
  .icons { flex:1; display:flex; align-items:center; gap:14px; padding:10px 12px; border-radius:8px; }
  .icons.light { background:#FFFFFF; border:1px solid #E2E8F0; }
  .icons.dark { background:#0B1220; border:1px solid #1E293B; }
</style></head><body>
  <div class="head">R28 marks review — 16 / 32 / 48 / 128 px on light and dark bars</div>
  <div class="sub">Atrium: Monopoly-style house void in the emerald coin. Komplete: twin overlapping coins (Vega orange + Atrium emerald) on deep ink with indigo hairline.</div>
  <div class="cols"><div>on light</div><div>on dark</div></div>
  ${cells}
</body></html>`;

(async () => {
  const launchOpts = { headless: true };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 2 });
  const tmp = path.join(ROOT, 'scripts', '.r28-marks.html');
  fs.writeFileSync(tmp, html);
  await page.goto('file://' + tmp, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT });
  fs.unlinkSync(tmp);
  await browser.close();
  console.log('sheet →', OUT);
})();
