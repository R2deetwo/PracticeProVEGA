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
const VEGA_MARK = `
<svg width="150" height="150" viewBox="0 0 48 48" aria-hidden="true">
  <rect x="2" y="2" width="44" height="44" rx="10" fill="#7B1E1E"/>
  <path d="M14.5 17 L24 35.5" fill="none" stroke="#FBFBF9" stroke-width="4"/>
  <path d="M33.5 17 L24 35.5" fill="none" stroke="#FBFBF9" stroke-width="4"/>
  <path d="M11.5 16.8 H17" stroke="#FBFBF9" stroke-width="3"/>
  <path d="M31 16.8 H36.5" stroke="#FBFBF9" stroke-width="3"/>
  <path d="M24 5.5 C24.85 8.1 25.4 8.65 28 9.5 C25.4 10.35 24.85 10.9 24 13.5 C23.15 10.9 22.6 10.35 20 9.5 C22.6 8.65 23.15 8.1 24 5.5 Z" fill="#D8B26C"/>
</svg>`;
const VEGA_MARK_SMALL = VEGA_MARK.replace('width="150" height="150"', 'width="64" height="64"');

const ATRIUM_MARK = `
<svg width="150" height="150" viewBox="0 0 48 48" aria-hidden="true">
  <rect x="2" y="2" width="44" height="44" rx="10" fill="#059669"/>
  <path d="M16 36.5 V22 C16 14 32 14 32 22 V36.5" fill="none" stroke="#FAF7F2" stroke-width="4"/>
  <path d="M11.5 36.5 H36.5" stroke="#FAF7F2" stroke-width="3.5"/>
  <path d="M24 8 L27.2 11.7 L24 15.4 L20.8 11.7 Z" fill="#FAF7F2"/>
</svg>`;
const ATRIUM_MARK_SMALL = ATRIUM_MARK.replace('width="150" height="150"', 'width="64" height="64"');

const VEGA_CARD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${FRAUNCES}${PLEX}${PLEX5}
  * { margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body { background: #0B1220; font-family: 'Fraunces', Georgia, serif; position: relative; }
  /* faint pleading-paper rules, the ghost of the page */
  body::before { content: ''; position: absolute; inset: 0;
    background: repeating-linear-gradient(to bottom, transparent 0, transparent 39px, rgba(251,251,249,0.05) 39px, rgba(251,251,249,0.05) 40px); }
  .wrap { position: absolute; inset: 0; padding: 88px 96px; box-sizing: border-box; display: flex; }
  .left { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .kicker { font-family: 'IBM Plex Mono', monospace; font-weight: 500; font-size: 19px; letter-spacing: 0.32em; color: #D8B26C; text-transform: uppercase; margin-bottom: 26px; }
  h1 { font-size: 118px; font-weight: 600; color: #FBFBF9; letter-spacing: -0.01em; line-height: 1; }
  .rule { width: 76px; height: 2px; background: #7B1E1E; margin: 34px 0 30px; }
  .tag { font-family: 'Fraunces', Georgia, serif; font-size: 31px; font-weight: 400; color: #94A3B8; line-height: 1.45; max-width: 560px; }
  .footer { position: absolute; left: 96px; bottom: 72px; display: flex; align-items: center; gap: 24px; }
  .footer .by { font-family: 'IBM Plex Mono', monospace; font-size: 18px; letter-spacing: 0.28em; color: #64748B; text-transform: uppercase; }
  .footer .url { font-family: 'IBM Plex Mono', monospace; font-size: 19px; letter-spacing: 0.22em; color: #64748B; }
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
