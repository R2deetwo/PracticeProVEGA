#!/usr/bin/env node
/**
 * generate-brand-assets.cjs — renders the product identity assets that
 * cannot be hand-authored as text:
 *
 *   public/brand/{vega,atrium}/favicon-48.png        (48x48 PNG favicon fallback)
 *   public/brand/{vega,atrium}/apple-touch-icon.png  (180x180 home-screen icon)
 *   public/assets/landing/og-vega.png                (1200x630 social card)
 *   public/assets/landing/og-atrium.png              (1200x630 social card)
 *
 * Favicons are screenshotted from the standalone SVG marks in
 * public/brand/. OG cards are rendered from inline HTML with the REAL
 * brand fonts (@fontsource woff2 files, file:// URLs) so the cards match
 * the pages exactly.
 *
 * Run:  node scripts/generate-brand-assets.cjs   (from the repo root)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const fontFace = (family, weight, file) => `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  src: url('file://${path.join(ROOT, 'node_modules', file).replace(/\\/g, '/')}') format('woff2');
}`;

const FRAUNCES = fontFace('Fraunces', '300 900', '@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2');
const GROTESK5 = fontFace('Space Grotesk', '500', '@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2');
const GROTESK7 = fontFace('Space Grotesk', '700', '@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2');
const PLEX = fontFace('IBM Plex Mono', '400', '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2');
const PLEX5 = fontFace('IBM Plex Mono', '500', '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2');

// The marks, inlined at card scale (resolved hex — self-contained card).
// R26: the Seal (Vega — a coin with the star cut out, burnt orange on
// espresso) and the Coin (Atrium — the twin coin with the square open
// court cut out, emerald on cream) — the same construction as
// public/brand/*/favicon.svg, at card scale.
const VEGA_MARK = `
<svg width="150" height="150" viewBox="0 0 48 48" aria-hidden="true">
  <defs>
    <linearGradient id="vgcard" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2E2015"/>
      <stop offset="1" stop-color="#22170F"/>
    </linearGradient>
    <linearGradient id="vgseal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#E07A3F"/>
      <stop offset="1" stop-color="#F3A66A"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="46" height="46" rx="11.5" fill="url(#vgcard)"/>
  <rect x="1" y="1" width="46" height="46" rx="11.5" fill="none" stroke="#E07A3F" stroke-opacity="0.5" stroke-width="1.5"/>
  <path d="M24 7 A17 17 0 1 0 24 41 A17 17 0 1 0 24 7 Z M24 12 L28.55 19.45 L36 24 L28.55 28.55 L24 36 L19.45 28.55 L12 24 L19.45 19.45 Z" fill="url(#vgseal)"/>
</svg>`;
const VEGA_MARK_SMALL = VEGA_MARK.replace('width="150" height="150"', 'width="64" height="64"');

const ATRIUM_MARK = `
<svg width="150" height="150" viewBox="0 0 48 48" aria-hidden="true">
  <defs>
    <linearGradient id="atcard" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0C7A57"/>
      <stop offset="1" stop-color="#053D2C"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="46" height="46" rx="11.5" fill="#FAF7F2"/>
  <rect x="1" y="1" width="46" height="46" rx="11.5" fill="none" stroke="#0C7A57" stroke-opacity="0.4" stroke-width="1.5"/>
  <path fill-rule="evenodd" d="M24 7 A17 17 0 1 0 24 41 A17 17 0 1 0 24 7 Z M19.5 17 H28.5 A2.5 2.5 0 0 1 31 19.5 V28.5 A2.5 2.5 0 0 1 28.5 31 H19.5 A2.5 2.5 0 0 1 17 28.5 V19.5 A2.5 2.5 0 0 1 19.5 17 Z" fill="url(#atcard)"/>
</svg>`;
const ATRIUM_MARK_SMALL = ATRIUM_MARK.replace('width="150" height="150"', 'width="64" height="64"');

const VEGA_CARD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${GROTESK5}${GROTESK7}${PLEX}${PLEX5}
  * { margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body { background: #22170F; font-family: 'Space Grotesk', sans-serif; position: relative; }
  /* faint pleading-paper rules, the ghost of the page */
  body::before { content: ''; position: absolute; inset: 0;
    background: repeating-linear-gradient(to bottom, transparent 0, transparent 39px, rgba(247,240,231,0.05) 39px, rgba(247,240,231,0.05) 40px); }
  .wrap { position: absolute; inset: 0; padding: 88px 96px; box-sizing: border-box; display: flex; }
  .left { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .kicker { font-family: 'IBM Plex Mono', monospace; font-weight: 500; font-size: 19px; letter-spacing: 0.32em; color: #E07A3F; text-transform: uppercase; margin-bottom: 26px; }
  h1 { font-size: 118px; font-weight: 700; color: #F7F0E7; letter-spacing: -0.02em; line-height: 1; }
  .rule { width: 76px; height: 4px; background: #E07A3F; border-radius: 2px; margin: 34px 0 30px; }
  .tag { font-family: 'Space Grotesk', sans-serif; font-weight: 500; font-size: 31px; color: #B5A48F; line-height: 1.45; max-width: 560px; }
  .footer { position: absolute; left: 96px; bottom: 72px; display: flex; align-items: center; gap: 24px; }
  .footer .by { font-family: 'IBM Plex Mono', monospace; font-size: 18px; letter-spacing: 0.28em; color: #7C6A58; text-transform: uppercase; }
  .footer .url { font-family: 'IBM Plex Mono', monospace; font-size: 19px; letter-spacing: 0.22em; color: #7C6A58; }
</style></head><body>
  <div class="wrap"><div class="left">
    <div class="kicker">PracticePro Systems</div>
    <h1>Vega</h1>
    <div class="rule"></div>
    <div class="tag">The legal practice OS for Nigerian law firms — matters, drafting and court-rule calendaring in one workspace.</div>
  </div></div>
  <div class="footer">${VEGA_MARK_SMALL}<span class="by">A PracticePro product</span><span class="url">PRACTICEPRO.NG/VEGA</span></div>
</body></html>`;

const ATRIUM_CARD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${GROTESK5}${GROTESK7}${PLEX}
  * { margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body { background: #059669; font-family: 'Space Grotesk', sans-serif; position: relative; }
  body::before { content: ''; position: absolute; inset: 0;
    background: repeating-linear-gradient(to bottom, transparent 0, transparent 39px, rgba(250,247,242,0.06) 39px, rgba(250,247,242,0.06) 40px); }
  .wrap { position: absolute; inset: 0; padding: 88px 96px; box-sizing: border-box; display: flex; }
  .left { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .kicker { font-family: 'IBM Plex Mono', monospace; font-size: 19px; letter-spacing: 0.32em; color: #FAF7F2; text-transform: uppercase; margin-bottom: 26px; opacity: 0.85; }
  h1 { font-size: 118px; font-weight: 700; color: #FAF7F2; letter-spacing: -0.02em; line-height: 1; }
  .rule { width: 76px; height: 4px; background: #B4846C; border-radius: 2px; margin: 34px 0 30px; }
  .tag { font-family: 'Space Grotesk', sans-serif; font-weight: 500; font-size: 31px; color: #FAF7F2; opacity: 0.92; line-height: 1.45; max-width: 560px; }
  .footer { position: absolute; left: 96px; bottom: 72px; display: flex; align-items: center; gap: 24px; }
  .footer .by { font-family: 'IBM Plex Mono', monospace; font-size: 18px; letter-spacing: 0.28em; color: rgba(250,247,242,0.75); text-transform: uppercase; }
  .footer .url { font-family: 'IBM Plex Mono', monospace; font-size: 19px; letter-spacing: 0.22em; color: rgba(250,247,242,0.75); }
</style></head><body>
  <div class="wrap"><div class="left">
    <div class="kicker">PracticePro Systems</div>
    <h1>Atrium</h1>
    <div class="rule"></div>
    <div class="tag">The property management OS for Nigerian portfolios — rent, service charge and residents in one place.</div>
  </div></div>
  <div class="footer">${ATRIUM_MARK_SMALL}<span class="by">A PracticePro product</span><span class="url">PRACTICEPRO.NG/ATRIUM</span></div>
</body></html>`;

async function shootSvg(page, svgPath, size, outPath, scale = 1) {
  const url = 'file://' + svgPath;
  await page.setViewportSize({ width: size, height: size });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`  ✓ ${path.relative(ROOT, outPath)} (${size}x${size})`);
}

async function shootCard(page, html, outPath) {
  // file:// @font-face fonts settle reliably with goto() on a real file
  // (setContent leaves an about:blank origin that can stall networkidle).
  const tmp = path.join(ROOT, 'scripts', '.og-card-tmp.html');
  fs.writeFileSync(tmp, html);
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto('file://' + tmp, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400); // let variable fonts settle
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  fs.unlinkSync(tmp);
  console.log(`  ✓ ${path.relative(ROOT, outPath)} (1200x630)`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();

  console.log('Rendering product favicon PNGs (deviceScaleFactor 2 → crisp):');
  await shootSvg(page, path.join(PUBLIC, 'brand/vega/favicon.svg'), 24, path.join(PUBLIC, 'brand/vega/favicon-48.png'));
  await shootSvg(page, path.join(PUBLIC, 'brand/atrium/favicon.svg'), 24, path.join(PUBLIC, 'brand/atrium/favicon-48.png'));
  await shootSvg(page, path.join(PUBLIC, 'brand/vega/favicon.svg'), 90, path.join(PUBLIC, 'brand/vega/apple-touch-icon.png'));
  await shootSvg(page, path.join(PUBLIC, 'brand/atrium/favicon.svg'), 90, path.join(PUBLIC, 'brand/atrium/apple-touch-icon.png'));

  console.log('Rendering OG social cards:');
  fs.mkdirSync(path.join(PUBLIC, 'assets/landing'), { recursive: true });
  await shootCard(page, VEGA_CARD, path.join(PUBLIC, 'assets/landing/og-vega.png'));
  await shootCard(page, ATRIUM_CARD, path.join(PUBLIC, 'assets/landing/og-atrium.png'));

  await browser.close();
  console.log('Done.');
})();
