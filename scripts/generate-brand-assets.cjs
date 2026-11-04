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
// R60: the Seal (Vega) wears the light-enterprise register — executive
// navy tile, white star lit toward indigo; the Stepped Stack (Atrium)
// wears its new yellow tile — the same constructions as
// public/brand/*/favicon.svg, at card scale.
const VEGA_MARK = `
<svg width="150" height="150" viewBox="0 0 48 48" aria-hidden="true">
  <defs>
    <linearGradient id="vgcard" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1E3A8A"/>
      <stop offset="1" stop-color="#172554"/>
    </linearGradient>
    <linearGradient id="vgseal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#C7D2FE"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="46" height="46" rx="11.5" fill="url(#vgcard)"/>
  <rect x="1" y="1" width="46" height="46" rx="11.5" fill="none" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="1.5"/>
  <path d="M24 7 A17 17 0 1 0 24 41 A17 17 0 1 0 24 7 Z M24 12 L28.55 19.45 L36 24 L28.55 28.55 L24 36 L19.45 28.55 L12 24 L19.45 19.45 Z" fill="url(#vgseal)"/>
</svg>`;
const VEGA_MARK_SMALL = VEGA_MARK.replace('width="150" height="150"', 'width="64" height="64"');

// R57 construction → R60 colour: the Stepped Stack (Atrium) — the
// company logo's construction on a flat YELLOW tile #EAB308 (owner:
// "make atrium yellow"), three stepped white blocks (100/80/60%) and
// the box A cut in negative space from the top block. Same construction
// as public/brand/atrium/favicon.svg, at card scale.
const ATRIUM_MARK = `
<svg width="150" height="150" viewBox="0 0 48 48" aria-hidden="true">
  <defs>
    <clipPath id="atcardclip">
      <rect x="1" y="1" width="46" height="46" rx="11.5"/>
    </clipPath>
  </defs>
  <rect x="1" y="1" width="46" height="46" rx="11.5" fill="#EAB308"/>
  <g clip-path="url(#atcardclip)">
    <rect x="10.5" y="6" width="27" height="21" rx="1.5" fill="#FFFFFF"/>
    <rect x="9" y="27" width="30" height="7.5" rx="1.5" fill="#FFFFFF" fill-opacity="0.8"/>
    <rect x="7.5" y="34.5" width="33" height="7.5" rx="1.5" fill="#FFFFFF" fill-opacity="0.6"/>
    <path fill-rule="evenodd" d="M15 7.5 H33 V25.5 H28.5 V19.5 H19.5 V25.5 H15 Z M19.5 10.5 H28.5 V16.5 H19.5 Z" fill="#EAB308"/>
  </g>
</svg>`;
const ATRIUM_MARK_SMALL = ATRIUM_MARK.replace('width="150" height="150"', 'width="64" height="64"');

const VEGA_CARD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${GROTESK5}${GROTESK7}${PLEX}${PLEX5}
  * { margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body { background: #FFFFFF; font-family: 'Space Grotesk', sans-serif; position: relative; }
  /* R60: the light-enterprise card — pristine white, the faint 48px
     grid of the rebranded hero, deep-slate display type, the executive
     navy accents. The Warm Chambers espresso card retires. */
  body::before { content: ''; position: absolute; inset: 0;
    background-image:
      repeating-linear-gradient(to right, transparent 0, transparent 47px, rgba(15,23,42,0.045) 47px, rgba(15,23,42,0.045) 48px),
      repeating-linear-gradient(to bottom, transparent 0, transparent 47px, rgba(15,23,42,0.045) 47px, rgba(15,23,42,0.045) 48px); }
  /* the bottom padding keeps the centered copy clear of the footer row */
  .wrap { position: absolute; inset: 0; padding: 88px 96px 200px; box-sizing: border-box; display: flex; }
  .left { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .kicker { font-family: 'IBM Plex Mono', monospace; font-weight: 500; font-size: 19px; letter-spacing: 0.32em; color: #1E3A8A; text-transform: uppercase; margin-bottom: 26px; }
  h1 { font-size: 118px; font-weight: 700; color: #0F172A; letter-spacing: -0.02em; line-height: 1; }
  .rule { width: 76px; height: 4px; background: #1E3A8A; border-radius: 2px; margin: 34px 0 30px; }
  .tag { font-family: 'Space Grotesk', sans-serif; font-weight: 500; font-size: 31px; color: #475569; line-height: 1.45; max-width: 560px; }
  .footer { position: absolute; left: 96px; bottom: 72px; display: flex; align-items: center; gap: 24px; }
  .footer .by { font-family: 'IBM Plex Mono', monospace; font-size: 18px; letter-spacing: 0.28em; color: #64748B; text-transform: uppercase; }
  .footer .url { font-family: 'IBM Plex Mono', monospace; font-size: 19px; letter-spacing: 0.22em; color: #64748B; }
</style></head><body>
  <div class="wrap"><div class="left">
    <div class="kicker">PracticePro Systems</div>
    <h1>Vega</h1>
    <div class="rule"></div>
    <div class="tag">Legal workflow automation for Nigerian law firms — matters, drafting and court-rule calendaring in one workspace.</div>
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
  /* the bottom padding keeps the centered copy clear of the footer row */
  .wrap { position: absolute; inset: 0; padding: 88px 96px 200px; box-sizing: border-box; display: flex; }
  .left { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .kicker { font-family: 'IBM Plex Mono', monospace; font-size: 19px; letter-spacing: 0.32em; color: #FAF7F2; text-transform: uppercase; margin-bottom: 26px; opacity: 0.85; }
  h1 { font-size: 118px; font-weight: 700; color: #FAF7F2; letter-spacing: -0.02em; line-height: 1; }
  .rule { width: 76px; height: 4px; background: rgba(250,247,242,0.55); border-radius: 2px; margin: 34px 0 30px; }
  .tag { font-family: 'Space Grotesk', sans-serif; font-weight: 500; font-size: 31px; color: #FAF7F2; opacity: 0.92; line-height: 1.45; max-width: 560px; }
  .footer { position: absolute; left: 96px; bottom: 72px; display: flex; align-items: center; gap: 24px; }
  /* R60: the yellow mark sits on a cream plate so it integrates with
     the card's cream type system instead of clashing with the emerald */
  .mark-plate { background: #FAF7F2; border-radius: 14px; padding: 10px; display: flex; }
  .footer .by { font-family: 'IBM Plex Mono', monospace; font-size: 18px; letter-spacing: 0.28em; color: rgba(250,247,242,0.75); text-transform: uppercase; }
  .footer .url { font-family: 'IBM Plex Mono', monospace; font-size: 19px; letter-spacing: 0.22em; color: rgba(250,247,242,0.75); }
</style></head><body>
  <div class="wrap"><div class="left">
    <div class="kicker">PracticePro Systems</div>
    <h1>Atrium</h1>
    <div class="rule"></div>
    <div class="tag">The property management OS for Nigerian portfolios — rent, service charge and residents in one place.</div>
  </div></div>
  <div class="footer"><span class="mark-plate">${ATRIUM_MARK_SMALL}</span><span class="by">A PracticePro product</span><span class="url">PRACTICEPRO.NG/ATRIUM</span></div>
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
  // Optional product filter: `node scripts/generate-brand-assets.cjs atrium`
  // regenerates ONLY that product's assets. R60 re-renders BOTH cards
  // deliberately: the marks and the /vega register changed, so the
  // manually-designed light og-vega card now lives HERE (encoded once,
  // re-renderable forever).
  const only = process.argv[2];
  const want = (p) => !only || only === p;

  // PLAYWRIGHT_CHROMIUM_PATH lets the script run in environments where the
  // playwright package version doesn't match the ms-playwright cache build
  // (CI pins its own; local sandboxes can point at any cached chromium).
  const launchOpts = { headless: true };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();

  console.log('Rendering product favicon PNGs (deviceScaleFactor 2 → crisp):');
  if (want('vega')) {
    await shootSvg(page, path.join(PUBLIC, 'brand/vega/favicon.svg'), 24, path.join(PUBLIC, 'brand/vega/favicon-48.png'));
    await shootSvg(page, path.join(PUBLIC, 'brand/vega/favicon.svg'), 90, path.join(PUBLIC, 'brand/vega/apple-touch-icon.png'));
  }
  if (want('atrium')) {
    await shootSvg(page, path.join(PUBLIC, 'brand/atrium/favicon.svg'), 24, path.join(PUBLIC, 'brand/atrium/favicon-48.png'));
    await shootSvg(page, path.join(PUBLIC, 'brand/atrium/favicon.svg'), 90, path.join(PUBLIC, 'brand/atrium/apple-touch-icon.png'));
  }
  if (want('komplete')) {
    await shootSvg(page, path.join(PUBLIC, 'brand/komplete/favicon.svg'), 24, path.join(PUBLIC, 'brand/komplete/favicon-48.png'));
    await shootSvg(page, path.join(PUBLIC, 'brand/komplete/favicon.svg'), 90, path.join(PUBLIC, 'brand/komplete/apple-touch-icon.png'));
  }

  console.log('Rendering OG social cards:');
  fs.mkdirSync(path.join(PUBLIC, 'assets/landing'), { recursive: true });
  if (want('vega')) {
    await shootCard(page, VEGA_CARD, path.join(PUBLIC, 'assets/landing/og-vega.png'));
  }
  if (want('atrium')) {
    await shootCard(page, ATRIUM_CARD, path.join(PUBLIC, 'assets/landing/og-atrium.png'));
  }

  await browser.close();
  console.log('Done.');
})();
