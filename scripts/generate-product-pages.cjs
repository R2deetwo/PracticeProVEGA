#!/usr/bin/env node
/**
 * generate-product-pages.cjs — derives the per-product HTML shells from
 * index.html (R76, 2026-11-24 WhatsApp share audit).
 *
 * WHY: the app is a single Vite SPA — one index.html for every route — so
 * WhatsApp's crawler (which does NOT run JavaScript) saw the HUB's og:
 * card no matter which URL was shared. Sharing practice-pro-vega.vercel.app
 * /vega in a lawyer group rendered the company card, never the Vega card.
 * The fix is Vite multi-page: vega.html and atrium.html as separate entry
 * HTML shells, each with its own static OG/Twitter card, JSON-LD, favicons
 * and theme colour. Vercel rewrites map /vega → /vega.html and /atrium →
 * /atrium.html (ahead of the SPA catch-all), so:
 *   - crawlers get route-correct og: tags (crisp WhatsApp link previews),
 *   - browsers get the exact same SPA (the shell difference is head-only,
 *     the boot scripts are pathname-agnostic and already treat /vega and
 *     /atrium as public routes).
 *
 * The product pages are GENERATED from index.html (single source of truth
 * — a head change in index.html propagates by re-running this script):
 *   node scripts/generate-product-pages.cjs
 *
 * What changes per product shell (everything else is byte-identical):
 *   title / meta description / keywords
 *   og:title, og:description, og:image (absolute), og:image:alt, og:url
 *   twitter:title/description/image/image:alt
 *   favicons + apple-touch-icon (the product marks from public/brand/)
 *   theme-color (light scheme) + apple-mobile-web-app-title
 *   JSON-LD: Organization + ONLY that product's SoftwareApplication node
 *   (the FAQPage block is hub-level content and stays on the hub only)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const ORIGIN = 'https://practice-pro-vega.vercel.app';

const PRODUCTS = {
  vega: {
    file: 'vega.html',
    // 2026-11-25 (initial-load fix): product pre-paint + boot-overlay tint.
    // prePaint = the ground this shell paints from the FIRST HTML paint
    // until the app's own CSS takes over (Vega's pristine white paper —
    // .theme-vega --color-paper: #FFFFFF). bootOverlay = the session-boot
    // overlay's ground on this product's page (Vega night blue #172554 —
    // --color-vega-night, the deep navy of Vega's dark bands). Together
    // they keep the pre-app phase product-scoped: no bare white flash, no
    // generic hub register on a product route.
    prePaint: '#FFFFFF',
    bootOverlay: '#172554',
    title: 'Vega — Legal Practice OS for Nigerian Law Firms | PracticePro',
    description:
      'Case management, AI-assisted drafting with ALOA, court-rule-aware calendaring and billing for Nigerian law firms — from intake to judgment, in one workspace. A PracticePro product.',
    keywords:
      'PracticePro Vega, legal practice management Nigeria, law firm software Lagos, case management Nigeria, legal drafting software, court rule calendaring, ALOA AI, law firm billing, Nigerian law firms',
    ogImageAlt: 'PracticePro Vega — the legal practice OS for Nigerian law firms',
    twitterDescription:
      'Vega — the legal practice OS for Nigerian law firms: matters, AI-assisted drafting with ALOA, court-rule-aware calendaring and billing in one workspace.',
    url: `${ORIGIN}/vega`,
    ogImage: `${ORIGIN}/assets/landing/og-vega.png`,
    themeLight: '#FFFFFF',
    appleTitle: 'Vega',
    faviconComment: 'Vega product mark (the Seal)',
    faviconSvg: '/brand/vega/favicon.svg',
    faviconPng: '/brand/vega/favicon-48.png',
    appleTouch: '/brand/vega/apple-touch-icon.png',
    dropProduct: 'Atrium',
  },
  atrium: {
    file: 'atrium.html',
    // 2026-11-25 (initial-load fix): Atrium cream paper (.theme-atrium
    // --color-paper: #FAF7F2) pre-paint + the Well-Kept Estate's emerald
    // (#059669) on the session-boot overlay.
    prePaint: '#FAF7F2',
    bootOverlay: '#059669',
    title: 'Atrium — Property Management OS for Nigerian Portfolios | PracticePro',
    description:
      "Rent and service-charge collection, residents' portal, maintenance workflows, Sentry Pass visitor management and revenue intelligence for Nigerian property portfolios — applying the tenancy law of all 36 states and the FCT. A PracticePro product.",
    keywords:
      'PracticePro Atrium, property management software Nigeria, rent collection Lagos, service charge management, estate management software, tenant portal Nigeria, property portfolio software, ARIA AI, Nigerian tenancy law',
    ogImageAlt: 'PracticePro Atrium — the property management OS for Nigerian portfolios',
    twitterDescription:
      'Atrium — the property management OS for Nigerian portfolios: rent and service-charge collection, residents portal, maintenance and revenue intelligence in one place.',
    url: `${ORIGIN}/atrium`,
    ogImage: `${ORIGIN}/assets/landing/og-atrium.png`,
    themeLight: '#059669',
    appleTitle: 'Atrium',
    faviconComment: 'Atrium product mark (the Stepped Stack)',
    faviconSvg: '/brand/atrium/favicon.svg',
    faviconPng: '/brand/atrium/favicon-48.png',
    appleTouch: '/brand/atrium/apple-touch-icon.png',
    dropProduct: 'Vega',
  },
};

const src = fs.readFileSync(INDEX, 'utf8');

/** Replace a whole tag. Paired elements (title) match their FULL element
 *  (opening + inner text + closing); void elements (meta) match just the
 *  self-contained opening tag.
 *
 *  2026-11-25 (unstyled-flash fix): the previous pattern matched ONLY the
 *  opening tag of the prefix. For the paired <title> that left the ORIGINAL
 *  title text + a bare "</title>" behind in the output as stray <head>
 *  text — and the HTML parser kicks stray head text into the <body>, so
 *  /vega and /atrium rendered "PracticePro Systems — Build Systems That
 *  Help Scale Your Business" as unstyled text above #root (the reported
 *  top-left flash on initial load). Paired tags now consume their whole
 *  element; void tags are unchanged (they carry no inner text).
 */
function replaceTag(html, prefix, newTag, paired = false) {
  const re = paired
    ? new RegExp(`[ \\t]*<(${prefix})[^>]*>[\\s\\S]*?</${prefix}>\\n?`, 'g')
    : new RegExp(`[ \\t]*<(${prefix})[^>]*>\\n?`, 'g');
  const out = html.replace(re, () => `${newTag}\n`);
  if (out === html) throw new Error(`replaceTag found no match for: ${prefix}`);
  return out;
}

for (const [key, p] of Object.entries(PRODUCTS)) {
  let html = src;

  // 1) Title (PAIRED element — the full <title>…</title> element is
  //    replaced; see replaceTag's unstyled-flash fix above).
  html = replaceTag(html, 'title', `  <title>${p.title}</title>`, true);

  // 2) Description / keywords.
  html = replaceTag(html, 'meta name="description"', `  <meta name="description" content="${p.description}" />`);
  html = replaceTag(html, 'meta name="keywords"', `  <meta name="keywords" content="${p.keywords}" />`);

  // 3) OG block (title/description/image/alt; site_name and the R76
  //    absolute-URL comment stay from the hub shell).
  html = replaceTag(html, 'meta property="og:title"', `  <meta property="og:title" content="${p.title}" />`);
  html = replaceTag(html, 'meta property="og:description"', `  <meta property="og:description" content="${p.description}" />`);
  html = replaceTag(html, 'meta property="og:url"', `  <meta property="og:url" content="${p.url}" />`);
  html = replaceTag(html, 'meta property="og:image"', `  <meta property="og:image" content="${p.ogImage}" />`);
  html = replaceTag(html, 'meta property="og:image:alt"', `  <meta property="og:image:alt" content="${p.ogImageAlt}" />`);

  // 4) Twitter block.
  html = replaceTag(html, 'meta name="twitter:title"', `  <meta name="twitter:title" content="${p.title}" />`);
  html = replaceTag(html, 'meta name="twitter:description"', `  <meta name="twitter:description" content="${p.twitterDescription}" />`);
  html = replaceTag(html, 'meta name="twitter:image"', `  <meta name="twitter:image" content="${p.ogImage}" />`);
  html = replaceTag(html, 'meta name="twitter:image:alt"', `  <meta name="twitter:image:alt" content="${p.ogImageAlt}" />`);

  // 5) Favicons — the company P data-URL tile becomes the product marks.
  const faviconBlock = `  <!-- ${p.faviconComment} -->
  <link rel="icon" href="${p.faviconSvg}" type="image/svg+xml" />
  <link rel="icon" href="${p.faviconPng}" type="image/png" />
  <link rel="apple-touch-icon" href="${p.appleTouch}" />`;
  html = html.replace(
    /[ \t]*<!-- PracticePro Top Block Favicon -->\n[ \t]*<link rel="icon"\n[\s\S]*?type="image\/svg\+xml" \/>\n/,
    () => `${faviconBlock}\n`,
  );

  // 6) theme-color (light) + apple-mobile-web-app-title.
  html = html.replace(
    /(<meta name="theme-color" content=")#16A34A(" media="\(prefers-color-scheme: light\)")/,
    `$1${p.themeLight}$2`,
  );
  html = replaceTag(
    html,
    'meta name="apple-mobile-web-app-title"',
    `  <meta name="apple-mobile-web-app-title" content="${p.appleTitle}">`,
  );

  // 7) JSON-LD: drop the OTHER product's SoftwareApplication node.
  const dropRe = new RegExp(
    `      \\{\\n        "@type": "SoftwareApplication",\\n        "name": "${p.dropProduct}",[\\s\\S]*?      \\},?\\n`,
  );
  html = html.replace(dropRe, '');

  // 8) JSON-LD: drop the hub-level FAQPage block (structured data for THIS
  //    page is Organization + this product's SoftwareApplication).
  const faq = html.match(/[ \t]*<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema\.org",\s*"@type": "FAQPage"[\s\S]*?<\/script>\n/);
  if (faq) html = html.replace(faq[0], '');

  // 9) Generated-shell marker (right after the doctype comment-free line).
  html = html.replace(
    '<!DOCTYPE html>\n<html lang="en">\n',
    `<!DOCTYPE html>\n<!-- GENERATED by scripts/generate-product-pages.cjs (R76) — do not edit by hand;\n     re-run the script after changing index.html. -->\n<html lang="en">\n`,
  );

  // 10) PRODUCT PRE-PAINT (2026-11-25 initial-load fix). Injected AFTER the
  //     shell's main <style> block so same-specificity rules win the
  //     cascade: html paints this product's ground from the very first
  //     paint (before any CSS bundle arrives), and the session-boot
  //     overlay carries the product's ground instead of the hub green —
  //     Vega night blue on /vega, Atrium green on /atrium. Head-only:
  //     the DOM the SPA hydrates stays byte-identical to the hub shell.
  const prePaint = `\n  <!-- PRODUCT PRE-PAINT (generated — see scripts/generate-product-pages.cjs):
       this route paints its OWN product ground from the first HTML paint
       until the app's styles take over (never a bare white/dark flash,
       never the generic hub register). The boot overlay — shown only to
       session-restoring visitors per the splash discipline — carries the
       same product ground. -->
  <style>
    html { background: ${p.prePaint}; }
    #pp-boot-overlay { background: ${p.bootOverlay}; }
  </style>
`;
  html = html.replace(/(\n  <\/style>\n)/, `$1${prePaint}`);

  fs.writeFileSync(path.join(ROOT, p.file), html);
  console.log(`  ✓ ${p.file} (${(html.length / 1024).toFixed(1)} KB)`);
}
console.log('Done.');
